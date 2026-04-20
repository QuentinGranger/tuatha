// ─── Anti-Exfiltration: Download Quotas + Burst Detection + Audit Logging ───
//
// Prevents bulk data downloads by enforcing per-user quotas at multiple time scales:
//   - Per-minute burst limit (rapid sequential downloads)
//   - Per-hour count + volume limit
//   - Per-day count + volume limit
//
// All downloads are logged to an audit trail for anomaly detection.
//
// Usage:
//   const guard = checkDownloadQuota(proId, fileSizeBytes);
//   if (guard) return guard; // 429 response
//   recordDownload(proId, fileSizeBytes, filePath); // after serving

// ─── Configuration ───

interface QuotaTier {
  windowMs: number;
  maxCount: number;
  maxBytes: number;
  label: string;
}

const QUOTA_TIERS: QuotaTier[] = [
  // Burst: max 10 downloads per minute
  { windowMs: 60 * 1000, maxCount: 10, maxBytes: 50 * 1024 * 1024, label: "minute" },
  // Hourly: max 60 downloads, 200 MB
  { windowMs: 60 * 60 * 1000, maxCount: 60, maxBytes: 200 * 1024 * 1024, label: "heure" },
  // Daily: max 200 downloads, 500 MB
  { windowMs: 24 * 60 * 60 * 1000, maxCount: 200, maxBytes: 500 * 1024 * 1024, label: "jour" },
];

// Separate (lighter) limits for avatars since they load on every page
const AVATAR_BURST_LIMIT = { windowMs: 60 * 1000, maxCount: 60 };

// ─── In-Memory Sliding Window Store ───

interface DownloadEvent {
  timestamp: number;
  bytes: number;
  filePath: string;
}

interface UserDownloadState {
  events: DownloadEvent[];
  blocked: boolean;
  blockedUntil: number;
  violations: number;  // cumulative violation count for progressive lockout
}

const downloadStore = new Map<string, UserDownloadState>();

// Cleanup stale entries every 15 minutes
setInterval(() => {
  const cutoff = Date.now() - 25 * 60 * 60 * 1000; // Keep 25h of data
  for (const [key, state] of downloadStore) {
    state.events = state.events.filter((e) => e.timestamp > cutoff);
    if (state.events.length === 0 && (!state.blockedUntil || Date.now() > state.blockedUntil)) {
      downloadStore.delete(key);
    }
  }
}, 15 * 60 * 1000);

function getState(userId: string): UserDownloadState {
  let state = downloadStore.get(userId);
  if (!state) {
    state = { events: [], blocked: false, blockedUntil: 0, violations: 0 };
    downloadStore.set(userId, state);
  }
  return state;
}

// ─── Quota Check ───

import { NextResponse } from "next/server";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  tier?: string;
  retryAfterMs?: number;
}

/**
 * Check if a user is within their download quotas.
 * Returns a 429 NextResponse if quota exceeded, or null if allowed.
 *
 * @param userId   - The authenticated user's ID (proId)
 * @param fileSize - Size of the file being downloaded in bytes
 * @param isAvatar - Whether this is an avatar download (lighter limits)
 */
export function checkDownloadQuota(
  userId: string,
  fileSize: number,
  isAvatar = false,
): NextResponse | null {
  const now = Date.now();
  const state = getState(userId);

  // Check progressive lockout
  if (state.blocked && now < state.blockedUntil) {
    const retryMs = state.blockedUntil - now;
    logAnomaly(userId, "blocked_download_attempt", `User still locked out for ${Math.ceil(retryMs / 1000)}s`);
    const res = NextResponse.json(
      { error: "Téléchargements temporairement suspendus. Réessayez plus tard.", retryAfter: Math.ceil(retryMs / 1000) },
      { status: 429 },
    );
    res.headers.set("Retry-After", Math.ceil(retryMs / 1000).toString());
    return res;
  }

  // Clear expired lockout
  if (state.blocked && now >= state.blockedUntil) {
    state.blocked = false;
  }

  // Avatar: only check burst limit
  if (isAvatar) {
    const recentCount = state.events.filter(
      (e) => e.timestamp > now - AVATAR_BURST_LIMIT.windowMs,
    ).length;
    if (recentCount >= AVATAR_BURST_LIMIT.maxCount) {
      return NextResponse.json(
        { error: "Trop de requêtes. Réessayez dans un instant." },
        { status: 429 },
      );
    }
    return null;
  }

  // Check each quota tier
  for (const tier of QUOTA_TIERS) {
    const windowStart = now - tier.windowMs;
    const windowEvents = state.events.filter((e) => e.timestamp > windowStart);
    const windowCount = windowEvents.length;
    const windowBytes = windowEvents.reduce((sum, e) => sum + e.bytes, 0);

    // Count limit
    if (windowCount >= tier.maxCount) {
      return applyViolation(userId, state, tier, "count", windowCount, tier.maxCount);
    }

    // Volume limit
    if (windowBytes + fileSize > tier.maxBytes) {
      const maxMB = Math.round(tier.maxBytes / (1024 * 1024));
      return applyViolation(userId, state, tier, "volume", Math.round(windowBytes / (1024 * 1024)), maxMB);
    }
  }

  return null;
}

function applyViolation(
  userId: string,
  state: UserDownloadState,
  tier: QuotaTier,
  type: "count" | "volume",
  current: number,
  max: number,
): NextResponse {
  state.violations++;

  // Progressive lockout: first violation = wait for window, repeated = escalating lockout
  const lockoutDurations = [
    0,                          // 1st: just rate limit (wait for window)
    15 * 60 * 1000,             // 2nd: 15 min
    60 * 60 * 1000,             // 3rd: 1 hour
    4 * 60 * 60 * 1000,         // 4th+: 4 hours
  ];

  const lockIdx = Math.min(state.violations - 1, lockoutDurations.length - 1);
  const lockDuration = lockoutDurations[lockIdx];
  const retryMs = lockDuration > 0 ? lockDuration : tier.windowMs;

  if (lockDuration > 0) {
    state.blocked = true;
    state.blockedUntil = Date.now() + lockDuration;
  }

  const detail = type === "count"
    ? `${current}/${max} téléchargements par ${tier.label}`
    : `${current}/${max} Mo par ${tier.label}`;

  logAnomaly(userId, "quota_exceeded", `${type} quota exceeded: ${detail} (violation #${state.violations})`);

  const res = NextResponse.json(
    {
      error: `Limite de téléchargement atteinte (${detail}). Réessayez plus tard.`,
      retryAfter: Math.ceil(retryMs / 1000),
    },
    { status: 429 },
  );
  res.headers.set("Retry-After", Math.ceil(retryMs / 1000).toString());
  return res;
}

// ─── Record Successful Download ───

/**
 * Record a completed download for quota tracking.
 * Call this AFTER successfully serving the file.
 */
export function recordDownload(userId: string, fileSize: number, filePath: string): void {
  const state = getState(userId);
  state.events.push({
    timestamp: Date.now(),
    bytes: fileSize,
    filePath,
  });
}

// ─── Audit Logging ───

interface AuditEntry {
  timestamp: number;
  userId: string;
  action: string;
  filePath: string;
  fileSize: number;
  ip: string;
  userAgent: string;
}

const auditLog: AuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 10000;

/**
 * Log a file download for audit trail.
 */
export function logDownload(
  userId: string,
  filePath: string,
  fileSize: number,
  ip: string,
  userAgent: string,
): void {
  auditLog.push({
    timestamp: Date.now(),
    userId,
    action: "download",
    filePath,
    fileSize,
    ip,
    userAgent,
  });

  // Trim old entries
  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_ENTRIES);
  }
}

// ─── Anomaly Logging ───

interface AnomalyEntry {
  timestamp: number;
  userId: string;
  type: string;
  detail: string;
}

const anomalyLog: AnomalyEntry[] = [];
const MAX_ANOMALY_ENTRIES = 1000;

function logAnomaly(userId: string, type: string, detail: string): void {
  console.warn(`[EXFILTRATION] user=${userId} type=${type} detail="${detail}"`);
  anomalyLog.push({ timestamp: Date.now(), userId, type, detail });

  if (anomalyLog.length > MAX_ANOMALY_ENTRIES) {
    anomalyLog.splice(0, anomalyLog.length - MAX_ANOMALY_ENTRIES);
  }
}

// ─── Admin: Get Download Stats (for monitoring dashboard) ───

export function getDownloadStats(userId: string): {
  lastHour: { count: number; bytes: number };
  lastDay: { count: number; bytes: number };
  violations: number;
  blocked: boolean;
} {
  const state = downloadStore.get(userId);
  if (!state) {
    return {
      lastHour: { count: 0, bytes: 0 },
      lastDay: { count: 0, bytes: 0 },
      violations: 0,
      blocked: false,
    };
  }

  const now = Date.now();
  const hourEvents = state.events.filter((e) => e.timestamp > now - 60 * 60 * 1000);
  const dayEvents = state.events.filter((e) => e.timestamp > now - 24 * 60 * 60 * 1000);

  return {
    lastHour: {
      count: hourEvents.length,
      bytes: hourEvents.reduce((s, e) => s + e.bytes, 0),
    },
    lastDay: {
      count: dayEvents.length,
      bytes: dayEvents.reduce((s, e) => s + e.bytes, 0),
    },
    violations: state.violations,
    blocked: state.blocked && now < state.blockedUntil,
  };
}

/**
 * Get recent anomaly entries (for admin monitoring).
 */
export function getRecentAnomalies(limit = 50): AnomalyEntry[] {
  return anomalyLog.slice(-limit);
}

/**
 * Get recent audit log entries (for admin monitoring).
 */
export function getRecentAuditLog(limit = 100): AuditEntry[] {
  return auditLog.slice(-limit);
}
