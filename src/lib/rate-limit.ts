// ─── In-Memory Rate Limiter ───
//
// Sliding-window rate limiter using in-memory Maps.
// Suitable for single-instance deployments. For multi-instance,
// replace the Map with Redis (e.g. @upstash/ratelimit).
//
// Usage in API routes:
//   import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
//
//   export async function POST(request: NextRequest) {
//     const limited = rateLimit(request, RATE_LIMITS.write);
//     if (limited) return limited;
//     ...
//   }

import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";

// ─── Configuration presets ───

export const RATE_LIMITS = {
  /** Read endpoints: 60 requests per minute */
  read: { windowMs: 60_000, maxRequests: 60 },
  /** Write endpoints (book, cancel, reschedule): 10 requests per minute */
  write: { windowMs: 60_000, maxRequests: 10 },
  /** Sensitive endpoints (auth, email-sending): 5 requests per minute */
  sensitive: { windowMs: 60_000, maxRequests: 5 },
  /** Search / heavy queries: 20 requests per minute */
  search: { windowMs: 60_000, maxRequests: 20 },
} as const;

// ─── Sliding window store ───

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs * 2;
  for (const [key, entry] of store) {
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
      store.delete(key);
    }
  }
}

// ─── Core rate limit function ───

/**
 * Check rate limit for a request. Returns a 429 NextResponse if limited,
 * or null if the request is allowed.
 *
 * Identifies clients by session ID (authenticated) or IP (anonymous).
 */
export function rateLimit(
  request: NextRequest,
  config: { windowMs: number; maxRequests: number },
): NextResponse | null {
  const now = Date.now();
  cleanup(config.windowMs);

  // Build a key: prefer session-based, fallback to IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const key = `rl:${ip}:${request.nextUrl.pathname}`;

  // Get or create entry
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  const windowStart = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  // Check limit
  if (entry.timestamps.length >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.timestamps[0] + config.windowMs - now) / 1000);
    return NextResponse.json(
      { error: "Trop de requêtes. Veuillez patienter avant de réessayer." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(retryAfter, 1)),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((entry.timestamps[0] + config.windowMs) / 1000)),
        },
      },
    );
  }

  // Record this request
  entry.timestamps.push(now);

  return null; // Allowed
}

/**
 * Async variant that uses session ID for the rate limit key (more accurate
 * for authenticated routes). Falls back to IP if no session.
 */
export async function rateLimitAuth(
  request: NextRequest,
  config: { windowMs: number; maxRequests: number },
): Promise<NextResponse | null> {
  const now = Date.now();
  cleanup(config.windowMs);

  // Try session-based key first
  let keyId: string;
  try {
    const session = await getSessionAthlete();
    keyId = session?.id || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  } catch {
    keyId = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  }

  const key = `rl:${keyId}:${request.nextUrl.pathname}`;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  const windowStart = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.timestamps[0] + config.windowMs - now) / 1000);
    return NextResponse.json(
      { error: "Trop de requêtes. Veuillez patienter avant de réessayer." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(retryAfter, 1)),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  entry.timestamps.push(now);
  return null;
}
