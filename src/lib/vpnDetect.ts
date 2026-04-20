// ─── VPN / Proxy / Tor Detection ───
//
// Multi-layer VPN/proxy detection with ACTIVE BLOCKING.
// Policy: connections from any country are allowed WITHOUT VPN.
//         VPN/proxy/Tor connections are BLOCKED on authenticated routes.
//
// Detection layers:
//   Layer 1: External IP intelligence API (ip-api.com — free, no key)
//   Layer 2: Header heuristics (proxy chain, Via, mismatch)
//   Layer 3: Known datacenter IP ranges
//   Layer 4: Tor exit node DNS check
//   Layer 5: Behavioral signals (UA, timezone)
//
// Score ≥ 40 → BLOCKED (not just warned)

import { NextRequest } from "next/server";

// ─── Types ───

export interface VpnDetectResult {
  isVpn: boolean;
  isBlocked: boolean;     // true = request should be rejected
  score: number;          // 0-100
  signals: string[];      // Which checks triggered
  ip: string;
  country?: string;
  isp?: string;
  recommendation: "allow" | "warn" | "block";
}

// ─── Thresholds ───

const BLOCK_THRESHOLD = 40;   // Score ≥ 40 → actively blocked
const WARN_THRESHOLD = 20;    // Score 20-39 → warned but allowed

// ─── Known proxy/VPN headers ───

const PROXY_HEADERS = [
  "via",
  "x-proxy-id",
  "x-proxy-connection",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-server",
  "proxy-connection",
  "x-blazeclient-ip",
  "x-turbopage-id",
  "cf-connecting-ip",     // Cloudflare (legitimate but indicates proxy layer)
  "true-client-ip",
  "x-originating-ip",
  "x-client-ip",
  "x-cluster-client-ip",
] as const;

// Headers that specifically indicate anonymizing proxies
const ANON_PROXY_HEADERS = [
  "x-anonymous",
  "x-proxy-id",
  "x-blazeclient-ip",
] as const;

// ─── Known datacenter IP ranges (first octets) ───
// Major VPN/datacenter providers — partial list of common ranges

const DATACENTER_PREFIXES = [
  // DigitalOcean
  "104.131.", "104.236.", "138.68.", "138.197.", "139.59.", "142.93.",
  "146.185.", "159.65.", "159.89.", "161.35.", "162.243.", "163.47.",
  "164.90.", "165.22.", "165.227.", "167.71.", "167.99.", "174.138.",
  "178.62.", "178.128.", "188.166.", "188.226.", "192.34.", "192.241.",
  "198.199.", "198.211.", "206.81.", "206.189.", "207.154.",
  // AWS EC2 (partial)
  "3.0.", "3.1.", "3.8.", "3.9.", "3.16.", "3.17.", "3.18.",
  "13.52.", "13.56.", "13.57.", "13.58.", "13.59.",
  "18.130.", "18.188.", "18.189.", "18.190.", "18.191.",
  "34.192.", "34.193.", "34.194.", "34.195.", "34.196.",
  "35.153.", "35.154.", "35.155.", "35.156.", "35.157.",
  "52.47.", "52.57.", "52.58.", "52.59.",
  // Vultr
  "45.32.", "45.63.", "45.76.", "45.77.", "66.42.", "78.141.",
  "95.179.", "104.156.", "108.61.", "136.244.", "140.82.", "149.28.",
  "155.138.", "207.148.", "209.250.",
  // OVH
  "51.68.", "51.75.", "51.77.", "51.79.", "51.81.", "51.83.", "51.89.",
  "51.91.", "54.36.", "54.37.", "54.38.", "54.39.",
  "91.121.", "92.222.", "137.74.", "144.217.", "145.239.", "149.56.",
  "158.69.", "164.132.", "176.31.", "178.32.", "178.33.",
  // Hetzner
  "5.9.", "46.4.", "78.46.", "78.47.", "88.198.", "88.99.",
  "116.202.", "116.203.", "136.243.", "138.201.", "144.76.",
  "148.251.", "159.69.", "162.55.", "168.119.", "176.9.",
  "178.63.", "195.201.",
  // Linode
  "45.33.", "45.56.", "45.79.", "50.116.", "66.175.", "69.164.",
  "72.14.", "74.207.", "96.126.", "97.107.", "139.162.", "172.104.",
  "173.230.", "173.255.", "176.58.", "192.155.", "194.195.", "198.58.",
  // NordVPN / ExpressVPN / common VPN exit ranges
  "185.153.", "185.189.", "185.230.", "185.244.", "185.253.",
  "193.37.", "193.56.", "194.35.", "195.206.", "196.240.",
  "212.102.", "212.103.",
];

// ─── Tor Exit Node Detection (DNS-based) ───

const TOR_DNS_SUFFIX = ".dnsel.torproject.org";

/**
 * Check if an IP is a Tor exit node via DNS reverse lookup.
 * Non-blocking: returns false on timeout/error.
 */
async function isTorExitNode(ip: string): Promise<boolean> {
  // Only check IPv4
  if (!ip || ip.includes(":") || ip === "unknown" || ip === "127.0.0.1") return false;

  try {
    const parts = ip.split(".");
    if (parts.length !== 4) return false;

    // Tor DNSEL format: reversed-ip.port.reversed-target-ip.dnsel.torproject.org
    // Simplified check against 443 (HTTPS) on a common target
    const reversed = parts.reverse().join(".");
    const query = `${reversed}.80.1.0.0.127${TOR_DNS_SUFFIX}`;

    // Use DNS resolution with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const { resolve4 } = await import("dns/promises");
      const result = await resolve4(query);
      clearTimeout(timeout);
      // If resolves to 127.0.0.2, it's a Tor exit node
      return result.some((r) => r === "127.0.0.2");
    } catch {
      clearTimeout(timeout);
      return false;
    }
  } catch {
    return false;
  }
}

// ─── Core Detection ───

// ─── Layer 1: External IP Intelligence API ───

interface IpApiResult {
  proxy: boolean;
  hosting: boolean;
  country?: string;
  isp?: string;
  org?: string;
}

async function checkIpApi(ip: string): Promise<IpApiResult | null> {
  if (ip === "unknown" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=proxy,hosting,country,isp,org`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      proxy: !!data.proxy,
      hosting: !!data.hosting,
      country: data.country,
      isp: data.isp,
      org: data.org,
    };
  } catch {
    return null;
  }
}

/**
 * Analyze a request for VPN/proxy/Tor indicators.
 * Returns a scored result — score >= 40 means BLOCKED.
 */
export async function detectVpn(request: NextRequest): Promise<VpnDetectResult> {
  let score = 0;
  const signals: string[] = [];
  let country: string | undefined;
  let isp: string | undefined;

  const xff = request.headers.get("x-forwarded-for") || "";
  const xri = request.headers.get("x-real-ip") || "";
  const ip = xff.split(",")[0]?.trim() || xri || "unknown";

  // ─── Layer 1: External IP intelligence (ip-api.com) ───
  // This catches most commercial VPNs (NordVPN, ExpressVPN, etc.)

  const ipApi = await checkIpApi(ip);
  if (ipApi) {
    country = ipApi.country;
    isp = ipApi.isp;
    if (ipApi.proxy) {
      score += 60; // ip-api confirmed proxy/VPN → instant block
      signals.push("ipapi:proxy_confirmed");
    }
    if (ipApi.hosting) {
      score += 40; // Hosting/datacenter IP → block
      signals.push(`ipapi:hosting_ip:${ipApi.isp || "unknown"}`);
    }
  }

  // ─── Layer 2: Header heuristics ───

  // 2a. Multiple hops in X-Forwarded-For (proxy chain)

  const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
  if (hops.length >= 3) {
    score += 25;
    signals.push(`proxy_chain:${hops.length}_hops`);
  } else if (hops.length === 2) {
    score += 10;
    signals.push("proxy_chain:2_hops");
  }

  // 2b. Proxy-specific headers

  let proxyHeaderCount = 0;
  for (const h of PROXY_HEADERS) {
    if (request.headers.get(h)) {
      proxyHeaderCount++;
    }
  }
  if (proxyHeaderCount >= 3) {
    score += 20;
    signals.push(`proxy_headers:${proxyHeaderCount}`);
  } else if (proxyHeaderCount >= 1) {
    score += 5 * proxyHeaderCount;
    signals.push(`proxy_headers:${proxyHeaderCount}`);
  }

  // Anonymizing proxy headers are stronger signals
  for (const h of ANON_PROXY_HEADERS) {
    if (request.headers.get(h)) {
      score += 15;
      signals.push(`anon_proxy_header:${h}`);
    }
  }

  // 2c. IP mismatch between X-Forwarded-For first hop and X-Real-IP

  if (xff && xri && hops[0] && hops[0] !== xri) {
    score += 15;
    signals.push("ip_mismatch:xff_vs_xri");
  }

  // ─── Layer 3: Datacenter IP range check ───

  if (ip !== "unknown") {
    const isDatacenter = DATACENTER_PREFIXES.some((prefix) => ip.startsWith(prefix));
    if (isDatacenter) {
      score += 30;
      signals.push("datacenter_ip");
    }
  }

  // ─── Layer 4: Tor exit node check (async, with timeout) ───

  if (ip !== "unknown") {
    const isTor = await isTorExitNode(ip);
    if (isTor) {
      score += 50;
      signals.push("tor_exit_node");
    }
  }

  // ─── Layer 5: Behavioral signals ───

  const ua = request.headers.get("user-agent") || "";
  if (!ua || ua.length < 20) {
    score += 10;
    signals.push("suspicious_ua:short_or_missing");
  }

  // 5b. Connection header anomalies

  const via = request.headers.get("via");
  if (via) {
    // "Via" header reveals proxy software
    if (/squid|varnish|proxy|cdn|cloudfront/i.test(via)) {
      // CDN/cache proxies are normal, less suspicious
      score += 5;
      signals.push(`via_header:${via.substring(0, 50)}`);
    } else {
      score += 15;
      signals.push(`via_header_unknown:${via.substring(0, 50)}`);
    }
  }

  // 5c. Timezone header check (client-hints)

  const tzHint = request.headers.get("sec-ch-ua-timezone") || request.headers.get("x-timezone");
  if (tzHint === "Etc/UTC" || tzHint === "UTC") {
    // UTC timezone is suspicious for a real user — most VPNs default to UTC
    score += 5;
    signals.push("timezone_utc");
  }

  // ─── Clamp score ───
  score = Math.min(score, 100);

  // ─── Decision ───
  let recommendation: "allow" | "warn" | "block" = "allow";
  if (score >= BLOCK_THRESHOLD) {
    recommendation = "block";
  } else if (score >= WARN_THRESHOLD) {
    recommendation = "warn";
  }

  return {
    isVpn: score >= WARN_THRESHOLD,
    isBlocked: score >= BLOCK_THRESHOLD,
    score,
    signals,
    ip,
    country,
    isp,
    recommendation,
  };
}

// ─── Logging ───

/**
 * Log VPN detection result if flagged.
 */
export function logVpnDetection(
  proId: string | null,
  result: VpnDetectResult,
  action: string = "request",
): void {
  if (!result.isVpn) return;

  const level = result.recommendation === "block" ? "BLOCK" : "WARN";
  console.log(
    `[VPN-DETECT] [${level}] ${action} ip=${result.ip} score=${result.score} ` +
    `recommendation=${result.recommendation} ` +
    `signals=[${result.signals.join(",")}] ` +
    `proId=${proId || "anonymous"}`,
  );
}

// ─── In-memory cache to avoid re-checking the same IP ───

interface CachedResult {
  result: VpnDetectResult;
  ts: number;
}

const vpnCache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 5000;

/**
 * Cached version of detectVpn — avoids Tor DNS lookups on every request.
 */
export async function detectVpnCached(request: NextRequest): Promise<VpnDetectResult> {
  const xff = request.headers.get("x-forwarded-for") || "";
  const xri = request.headers.get("x-real-ip") || "";
  const ip = xff.split(",")[0]?.trim() || xri || "unknown";

  const now = Date.now();
  const cached = vpnCache.get(ip);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.result;
  }

  const result = await detectVpn(request);

  // Store in cache
  vpnCache.set(ip, { result, ts: now });

  // Trim cache
  if (vpnCache.size > MAX_CACHE_SIZE) {
    const entries = [...vpnCache.entries()]
      .sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < MAX_CACHE_SIZE / 2; i++) {
      vpnCache.delete(entries[i][0]);
    }
  }

  return result;
}
