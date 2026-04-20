// ─── In-memory rate limiter with progressive backoff ───

import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil: number | null;
  lockLevel: number; // 0 = no lock, 1 = 15min, 2 = 30min, 3 = 1h, 4+ = 2h
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    const staleAfter = 2 * 60 * 60 * 1000; // 2h
    if (now - entry.lastAttempt > staleAfter && (!entry.lockedUntil || now > entry.lockedUntil)) {
      store.delete(key);
    }
  }
}, 10 * 60 * 1000);

function getEntry(key: string): RateLimitEntry {
  let entry = store.get(key);
  if (!entry) {
    entry = { count: 0, firstAttempt: Date.now(), lastAttempt: Date.now(), lockedUntil: null, lockLevel: 0 };
    store.set(key, entry);
  }
  return entry;
}

// ─── Generic rate limiter ───

export interface RateLimitConfig {
  windowMs: number;     // Time window in ms
  maxAttempts: number;  // Max attempts in window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  totalAttempts: number;
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = getEntry(key);

  // Check if locked
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.lockedUntil - now,
      totalAttempts: entry.count,
    };
  }

  // Reset if window expired
  if (now - entry.firstAttempt > config.windowMs) {
    entry.count = 0;
    entry.firstAttempt = now;
    entry.lockedUntil = null;
  }

  entry.count++;
  entry.lastAttempt = now;

  const remaining = Math.max(0, config.maxAttempts - entry.count);

  if (entry.count > config.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: config.windowMs - (now - entry.firstAttempt),
      totalAttempts: entry.count,
    };
  }

  return { allowed: true, remaining, retryAfterMs: 0, totalAttempts: entry.count };
}

// ─── Progressive backoff for login brute-force ───

const BACKOFF_DURATIONS = [
  15 * 60 * 1000,   // Level 1: 15 min
  30 * 60 * 1000,   // Level 2: 30 min
  60 * 60 * 1000,   // Level 3: 1h
  2 * 60 * 60 * 1000, // Level 4+: 2h
];

export interface LoginProtectionResult {
  allowed: boolean;
  locked: boolean;
  lockLevel: number;
  retryAfterMs: number;
  failedAttempts: number;
  requiresCaptcha: boolean;
}

const LOGIN_MAX_BEFORE_LOCK = 5;
const LOGIN_CAPTCHA_THRESHOLD = 3;

export function checkLoginProtection(identifier: string): LoginProtectionResult {
  const now = Date.now();
  const key = `login:${identifier}`;
  const entry = getEntry(key);

  // Check if currently locked
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      locked: true,
      lockLevel: entry.lockLevel,
      retryAfterMs: entry.lockedUntil - now,
      failedAttempts: entry.count,
      requiresCaptcha: true,
    };
  }

  // If lock has expired, allow but keep lock level for progressive backoff
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    entry.lockedUntil = null;
    entry.count = 0;
    entry.firstAttempt = now;
  }

  return {
    allowed: true,
    locked: false,
    lockLevel: entry.lockLevel,
    retryAfterMs: 0,
    failedAttempts: entry.count,
    requiresCaptcha: entry.count >= LOGIN_CAPTCHA_THRESHOLD,
  };
}

export function recordLoginFailure(identifier: string): LoginProtectionResult {
  const now = Date.now();
  const key = `login:${identifier}`;
  const entry = getEntry(key);

  entry.count++;
  entry.lastAttempt = now;

  if (entry.count >= LOGIN_MAX_BEFORE_LOCK) {
    entry.lockLevel = Math.min(entry.lockLevel + 1, BACKOFF_DURATIONS.length);
    const duration = BACKOFF_DURATIONS[Math.min(entry.lockLevel - 1, BACKOFF_DURATIONS.length - 1)];
    entry.lockedUntil = now + duration;

    return {
      allowed: false,
      locked: true,
      lockLevel: entry.lockLevel,
      retryAfterMs: duration,
      failedAttempts: entry.count,
      requiresCaptcha: true,
    };
  }

  return {
    allowed: true,
    locked: false,
    lockLevel: entry.lockLevel,
    retryAfterMs: 0,
    failedAttempts: entry.count,
    requiresCaptcha: entry.count >= LOGIN_CAPTCHA_THRESHOLD,
  };
}

export function recordLoginSuccess(identifier: string): void {
  const key = `login:${identifier}`;
  store.delete(key);
}

// ─── Preset rate limit configs ───

export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, maxAttempts: 10 },        // 10 per 15min per IP
  resetRequest: { windowMs: 60 * 60 * 1000, maxAttempts: 3 },  // 3 per hour
  otpVerify: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },     // 5 per 15min
  otpResend: { windowMs: 60 * 1000, maxAttempts: 1 },          // 1 per minute
  register: { windowMs: 60 * 60 * 1000, maxAttempts: 5 },      // 5 per hour per IP
  search: { windowMs: 60 * 1000, maxAttempts: 30 },            // 30 per minute
  upload: { windowMs: 15 * 60 * 1000, maxAttempts: 20 },       // 20 uploads per 15min
  download: { windowMs: 60 * 1000, maxAttempts: 60 },          // 60 downloads per minute
  placesApi: { windowMs: 60 * 1000, maxAttempts: 20 },         // 20 Google Places calls per minute
  heavyQuery: { windowMs: 60 * 1000, maxAttempts: 15 },        // 15 heavy queries per minute
};

// ─── Helper to build Retry-After header ───

export function retryAfterSeconds(ms: number): string {
  return Math.ceil(ms / 1000).toString();
}

// ─── Reusable rate-limit guard ───
// Returns a 429 NextResponse if limit exceeded, or null if allowed.

export function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function applyRateLimit(
  key: string,
  config: RateLimitConfig,
): NextResponse | null {
  const result = checkRateLimit(key, config);
  if (!result.allowed) {
    const res = NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard.", retryAfter: Math.ceil(result.retryAfterMs / 1000) },
      { status: 429 },
    );
    res.headers.set("Retry-After", retryAfterSeconds(result.retryAfterMs));
    return res;
  }
  return null;
}
