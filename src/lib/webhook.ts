// ─── Webhook & Integration Security ───
// Reusable infrastructure for securing inbound webhooks and external callbacks.
//
// Features:
//   1. HMAC signature verification (SHA-256)
//   2. Replay protection (timestamp + nonce dedup)
//   3. IP allowlist
//   4. Key rotation (current + previous key accepted)
//
// Usage (future webhook endpoint):
//   import { verifyWebhookSignature, checkReplay, isAllowedIP } from "@/lib/webhook";
//
//   export async function POST(req: NextRequest) {
//     if (!isAllowedIP(req, STRIPE_IPS)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//     const body = await req.text();
//     if (!verifyWebhookSignature(body, req.headers.get("x-signature")!, "whsec_...")) return ...;
//     if (!checkReplay(req.headers.get("x-request-id")!, req.headers.get("x-timestamp")!)) return ...;
//     // handle event...
//   }

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

// ─── 1. HMAC Signature Verification ───

/**
 * Verify an HMAC-SHA256 signature on a webhook payload.
 * Supports key rotation: pass an array of keys (current + previous).
 * Returns true if signature matches ANY of the provided keys.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secrets: string | string[],
  algorithm = "sha256",
): boolean {
  const keys = Array.isArray(secrets) ? secrets : [secrets];

  for (const key of keys) {
    const expected = createHmac(algorithm, key).update(rawBody, "utf8").digest("hex");
    const sig = signature.replace(/^sha256=/, ""); // strip prefix if present

    if (sig.length !== expected.length) continue;

    try {
      if (timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

// ─── 2. Replay Protection ───
// Uses timestamp window + nonce deduplication.

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const nonceStore = new Map<string, number>();

// Cleanup stale nonces every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - REPLAY_WINDOW_MS * 2;
  for (const [nonce, ts] of nonceStore) {
    if (ts < cutoff) nonceStore.delete(nonce);
  }
}, 10 * 60 * 1000);

/**
 * Check for replay attacks.
 * - Rejects if timestamp is outside the allowed window.
 * - Rejects if nonce has been seen before.
 * Returns true if the request is fresh (not a replay).
 */
export function checkReplay(
  nonce: string | null,
  timestampHeader: string | null,
  windowMs = REPLAY_WINDOW_MS,
): boolean {
  // Validate timestamp
  if (timestampHeader) {
    const ts = Number(timestampHeader);
    if (isNaN(ts)) return false;

    const age = Math.abs(Date.now() - ts * 1000); // assume seconds
    if (age > windowMs) return false;
  }

  // Validate nonce uniqueness
  if (nonce) {
    if (nonceStore.has(nonce)) return false;
    nonceStore.set(nonce, Date.now());
  }

  return true;
}

// ─── 3. IP Allowlist ───

/**
 * Check if the request IP is in the allowlist.
 * Extracts IP from x-forwarded-for or x-real-ip headers.
 */
export function isAllowedIP(
  request: NextRequest,
  allowlist: string[],
): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return allowlist.includes(ip);
}

// ─── 4. Known Provider IP Ranges ───
// Update these periodically from provider documentation.

export const WEBHOOK_IP_ALLOWLISTS = {
  // Stripe webhook IPs — https://docs.stripe.com/ips
  stripe: [
    "3.18.12.63", "3.130.192.231", "13.235.14.237", "13.235.122.149",
    "18.211.135.69", "35.154.171.200", "52.15.183.38", "54.88.130.119",
    "54.88.130.237", "54.187.174.169", "54.187.205.235", "54.187.216.72",
  ],
  // Calendly — no fixed IPs, verify via signature instead
  calendly: [],
} as const;

// ─── 5. Signed OAuth State (CSRF for OAuth flows) ───
// Creates a HMAC-signed, timestamped state parameter to prevent OAuth CSRF/forge attacks.

import { secrets as vault } from "@/lib/vault";

const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getSigningKey(): string {
  // Use ENCRYPTION_KEY as the signing key (already in env)
  try {
    return vault.encryptionKey();
  } catch {
    // Fallback for dev: use a static key (NOT for production)
    return "dev-oauth-state-signing-key-not-for-production";
  }
}

/**
 * Create a signed OAuth state token.
 * Format: base64(JSON({ proId, ts, nonce })) + "." + hmac
 */
export function createOAuthState(professionnelId: string): string {
  const payload = JSON.stringify({
    proId: professionnelId,
    ts: Math.floor(Date.now() / 1000),
    nonce: Math.random().toString(36).slice(2),
  });

  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", getSigningKey()).update(encoded).digest("base64url");

  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a signed OAuth state token.
 * Returns the professionnelId or null if invalid/expired.
 */
export function verifyOAuthState(state: string): string | null {
  const dotIdx = state.indexOf(".");
  if (dotIdx === -1) return null;

  const encoded = state.slice(0, dotIdx);
  const sig = state.slice(dotIdx + 1);

  // Verify signature
  const expected = createHmac("sha256", getSigningKey()).update(encoded).digest("base64url");

  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  // Decode payload
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    const { proId, ts } = payload;

    // Check expiry
    const ageMs = (Math.floor(Date.now() / 1000) - ts) * 1000;
    if (ageMs > OAUTH_STATE_MAX_AGE_MS || ageMs < -60_000) return null; // allow 1min clock skew

    return proId || null;
  } catch {
    return null;
  }
}
