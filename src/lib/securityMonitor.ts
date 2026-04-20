// ─── Centralized Security Monitor ───
//
// Aggregates security signals across the application and emits structured
// alerts when anomalous patterns are detected. Designed for log aggregation
// (CloudWatch, Datadog, Sentry) via structured console output.
//
// Monitors:
//   1. Credential stuffing — same IP targeting multiple accounts
//   2. Athlete enumeration — single pro accessing many distinct athletes rapidly
//   3. Export spikes — unusual export frequency or volume patterns
//   4. Aggregated security events — unified alert feed
//
// Integration:
//   - securityMonitor.trackLogin(ip, email, success)       → call from login route
//   - securityMonitor.trackAthleteAccess(proId, athleteId)  → call from athlete routes
//   - securityMonitor.trackExport(proId, athleteId, cats)   → call from export route
//   - securityMonitor.getAlerts()                           → admin monitoring

import { prisma } from "@/lib/prisma";

// ─── Types ───

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "credential_stuffing"
  | "athlete_enumeration"
  | "export_spike"
  | "bulk_access"
  | "off_hours_activity"
  | "rapid_actions";

export interface SecurityAlert {
  id: string;
  timestamp: string;
  type: AlertType;
  severity: AlertSeverity;
  actor: string;        // proId or IP
  detail: string;
  metadata: Record<string, unknown>;
}

// ─── Configuration ───

const CONFIG = {
  // Credential stuffing: same IP tries N distinct accounts in window
  credentialStuffing: {
    windowMs: 15 * 60 * 1000,  // 15 min
    maxDistinctAccounts: 5,
  },

  // Athlete enumeration: pro accesses N distinct athletes in window
  athleteEnumeration: {
    windowMs: 10 * 60 * 1000,  // 10 min
    warnThreshold: 20,         // warning at 20 distinct athletes
    criticalThreshold: 50,     // critical at 50
  },

  // Export spike: pro triggers N exports in a shorter-than-normal window
  exportSpike: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    warnThreshold: 3,           // 3 exports in 1h = warning
    criticalThreshold: 8,       // 8 in 1h = critical (across multiple hours)
    dailyWindowMs: 24 * 60 * 60 * 1000,
  },

  // Off-hours: activity between 1am-5am CET
  offHoursStart: 1,  // 1am
  offHoursEnd: 5,     // 5am

  // Rapid bulk actions (create/update/delete) from a single pro
  rapidActions: {
    windowMs: 60 * 1000,   // 1 min
    threshold: 50,          // 50 write operations in 1 min
  },
};

// ─── In-Memory Tracking Stores ───

interface TimestampedEntry {
  ts: number;
  value: string;
}

// IP → accounts attempted
const loginAttempts = new Map<string, TimestampedEntry[]>();

// proId → distinct athlete IDs accessed
const athleteAccess = new Map<string, TimestampedEntry[]>();

// proId → export timestamps
const exportEvents = new Map<string, TimestampedEntry[]>();

// proId → write action timestamps
const writeActions = new Map<string, TimestampedEntry[]>();

// Alert ring buffer
const alerts: SecurityAlert[] = [];
const MAX_ALERTS = 5000;
let alertCounter = 0;

// ─── Cleanup (every 10 min) ───

setInterval(() => {
  const cutoff = Date.now() - 25 * 60 * 60 * 1000; // 25h retention
  for (const [key, entries] of loginAttempts) {
    const filtered = entries.filter((e) => e.ts > cutoff);
    if (filtered.length === 0) loginAttempts.delete(key);
    else loginAttempts.set(key, filtered);
  }
  for (const [key, entries] of athleteAccess) {
    const filtered = entries.filter((e) => e.ts > cutoff);
    if (filtered.length === 0) athleteAccess.delete(key);
    else athleteAccess.set(key, filtered);
  }
  for (const [key, entries] of exportEvents) {
    const filtered = entries.filter((e) => e.ts > cutoff);
    if (filtered.length === 0) exportEvents.delete(key);
    else exportEvents.set(key, filtered);
  }
  for (const [key, entries] of writeActions) {
    const filtered = entries.filter((e) => e.ts > cutoff);
    if (filtered.length === 0) writeActions.delete(key);
    else writeActions.set(key, filtered);
  }
}, 10 * 60 * 1000);

// ─── Alert Emitter ───

function emitAlert(
  type: AlertType,
  severity: AlertSeverity,
  actor: string,
  detail: string,
  metadata: Record<string, unknown> = {},
): SecurityAlert {
  alertCounter++;
  const alert: SecurityAlert = {
    id: `sec_${Date.now()}_${alertCounter}`,
    timestamp: new Date().toISOString(),
    type,
    severity,
    actor,
    detail,
    metadata,
  };

  alerts.push(alert);
  if (alerts.length > MAX_ALERTS) {
    alerts.splice(0, alerts.length - MAX_ALERTS);
  }

  // Structured log for log aggregation (CloudWatch, Datadog, Sentry, etc.)
  const logFn = severity === "critical" ? console.error : console.warn;
  logFn(
    `[SECURITY-MONITOR] ${severity.toUpperCase()} type=${type} actor=${actor} — ${detail}`,
    JSON.stringify(metadata),
  );

  // Persist critical alerts to DB (non-blocking)
  if (severity === "critical") {
    persistAlertToDb(alert).catch(() => {});
  }

  return alert;
}

async function persistAlertToDb(alert: SecurityAlert): Promise<void> {
  try {
    // Only persist to DB if the actor is a valid proId (required FK)
    const isProId = /^[0-9a-f-]{36}$/i.test(alert.actor);
    if (!isProId) return; // IP-only alerts stay in structured logs only

    await prisma.securityAlert.create({
      data: {
        type: alert.type,
        message: alert.detail,
        ip: (alert.metadata.ip as string) || null,
        userAgent: (alert.metadata.userAgent as string) || null,
        professionnelId: alert.actor,
      },
    });
  } catch {
    // DB write failed, structured log is still present
  }
}

// ─── Helpers ───

function distinctValues(entries: TimestampedEntry[], windowMs: number): string[] {
  const cutoff = Date.now() - windowMs;
  const recent = entries.filter((e) => e.ts > cutoff);
  return [...new Set(recent.map((e) => e.value))];
}

function countInWindow(entries: TimestampedEntry[], windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  return entries.filter((e) => e.ts > cutoff).length;
}

function isOffHours(): boolean {
  const hour = (new Date().getUTCHours() + 1) % 24; // CET approximation
  return hour >= CONFIG.offHoursStart && hour < CONFIG.offHoursEnd;
}

function pushEntry(store: Map<string, TimestampedEntry[]>, key: string, value: string): TimestampedEntry[] {
  const entries = store.get(key) || [];
  entries.push({ ts: Date.now(), value });
  store.set(key, entries);
  return entries;
}

// ─── Public API ───

export const securityMonitor = {

  // ── 1. Login Tracking (credential stuffing detection) ──

  /**
   * Track a login attempt. Call from the login route for every attempt.
   * Detects credential stuffing: same IP targeting many accounts.
   */
  trackLogin(ip: string, email: string, success: boolean): void {
    if (!ip || ip === "unknown") return;

    const entries = pushEntry(loginAttempts, `ip:${ip}`, email);
    const distinctAccounts = distinctValues(entries, CONFIG.credentialStuffing.windowMs);

    if (distinctAccounts.length >= CONFIG.credentialStuffing.maxDistinctAccounts) {
      emitAlert(
        "credential_stuffing",
        "critical",
        ip,
        `IP ${ip} a tenté ${distinctAccounts.length} comptes distincts en ${CONFIG.credentialStuffing.windowMs / 60000} min`,
        {
          ip,
          distinctAccounts: distinctAccounts.length,
          accounts: distinctAccounts.slice(0, 10), // Log first 10 only
          windowMin: CONFIG.credentialStuffing.windowMs / 60000,
          lastAttemptSuccess: success,
        },
      );
    }

    // Off-hours login attempt (any)
    if (!success && isOffHours()) {
      emitAlert(
        "off_hours_activity",
        "warning",
        ip,
        `Tentative de login échouée en heures creuses pour ${email}`,
        { ip, email, hour: new Date().getUTCHours() + 1, success },
      );
    }
  },

  // ── 2. Athlete Access Tracking (enumeration detection) ──

  /**
   * Track an athlete profile access. Call from athlete GET routes.
   * Detects mass enumeration: one pro scraping many athlete profiles.
   */
  trackAthleteAccess(proId: string, athleteId: string): void {
    const entries = pushEntry(athleteAccess, proId, athleteId);
    const distinctAthletes = distinctValues(entries, CONFIG.athleteEnumeration.windowMs);
    const count = distinctAthletes.length;

    if (count >= CONFIG.athleteEnumeration.criticalThreshold) {
      emitAlert(
        "athlete_enumeration",
        "critical",
        proId,
        `Pro ${proId} a accédé à ${count} athlètes distincts en ${CONFIG.athleteEnumeration.windowMs / 60000} min`,
        {
          proId,
          distinctAthletes: count,
          windowMin: CONFIG.athleteEnumeration.windowMs / 60000,
          threshold: CONFIG.athleteEnumeration.criticalThreshold,
        },
      );
    } else if (count >= CONFIG.athleteEnumeration.warnThreshold) {
      // Only warn once per threshold crossing (check if previous count was below)
      const prevCount = distinctValues(
        entries.filter((e) => e.ts < Date.now() - 1000), // exclude this entry
        CONFIG.athleteEnumeration.windowMs,
      ).length;

      if (prevCount < CONFIG.athleteEnumeration.warnThreshold) {
        emitAlert(
          "athlete_enumeration",
          "warning",
          proId,
          `Pro ${proId} a accédé à ${count} athlètes distincts en ${CONFIG.athleteEnumeration.windowMs / 60000} min`,
          {
            proId,
            distinctAthletes: count,
            windowMin: CONFIG.athleteEnumeration.windowMs / 60000,
            threshold: CONFIG.athleteEnumeration.warnThreshold,
          },
        );
      }
    }
  },

  // ── 3. Export Spike Detection ──

  /**
   * Track a data export. Call from the export route.
   * Detects unusual export frequency patterns.
   */
  trackExport(proId: string, athleteId: string, categories: string[]): void {
    const entries = pushEntry(exportEvents, proId, athleteId);

    const hourlyCount = countInWindow(entries, CONFIG.exportSpike.windowMs);
    const dailyCount = countInWindow(entries, CONFIG.exportSpike.dailyWindowMs);
    const distinctAthletesExported = distinctValues(entries, CONFIG.exportSpike.dailyWindowMs);

    if (hourlyCount >= CONFIG.exportSpike.criticalThreshold) {
      emitAlert(
        "export_spike",
        "critical",
        proId,
        `Pro ${proId}: ${hourlyCount} exports en 1h (${dailyCount}/jour), ${distinctAthletesExported.length} athlètes distincts`,
        {
          proId,
          hourlyCount,
          dailyCount,
          distinctAthletesExported: distinctAthletesExported.length,
          lastAthleteId: athleteId,
          lastCategories: categories,
        },
      );
    } else if (hourlyCount >= CONFIG.exportSpike.warnThreshold) {
      emitAlert(
        "export_spike",
        "warning",
        proId,
        `Pro ${proId}: ${hourlyCount} exports en 1h, ${distinctAthletesExported.length} athlètes distincts`,
        {
          proId,
          hourlyCount,
          dailyCount,
          distinctAthletesExported: distinctAthletesExported.length,
          lastAthleteId: athleteId,
          lastCategories: categories,
        },
      );
    }
  },

  // ── 4. Rapid Write Actions (bulk manipulation detection) ──

  /**
   * Track a write action (POST/PATCH/DELETE). Call from withAuth.
   * Detects automated scripting / mass data manipulation.
   */
  trackWriteAction(proId: string, path: string): void {
    const entries = pushEntry(writeActions, proId, path);
    const count = countInWindow(entries, CONFIG.rapidActions.windowMs);

    if (count >= CONFIG.rapidActions.threshold) {
      // Only alert once per burst (check if just crossed threshold)
      if (count === CONFIG.rapidActions.threshold) {
        emitAlert(
          "rapid_actions",
          "warning",
          proId,
          `Pro ${proId}: ${count} actions d'écriture en ${CONFIG.rapidActions.windowMs / 1000}s sur ${path}`,
          {
            proId,
            count,
            windowSec: CONFIG.rapidActions.windowMs / 1000,
            lastPath: path,
          },
        );
      }
    }
  },

  // ── Query API (admin / monitoring dashboard) ──

  /**
   * Get recent security alerts, optionally filtered.
   */
  getAlerts(opts?: {
    limit?: number;
    severity?: AlertSeverity;
    type?: AlertType;
    actor?: string;
    sinceMs?: number;
  }): SecurityAlert[] {
    const limit = opts?.limit || 100;
    const since = opts?.sinceMs ? Date.now() - opts.sinceMs : 0;
    let filtered = alerts;

    if (since > 0) filtered = filtered.filter((a) => new Date(a.timestamp).getTime() > since);
    if (opts?.severity) filtered = filtered.filter((a) => a.severity === opts.severity);
    if (opts?.type) filtered = filtered.filter((a) => a.type === opts.type);
    if (opts?.actor) filtered = filtered.filter((a) => a.actor === opts.actor);

    return filtered.slice(-limit).reverse();
  },

  /**
   * Get a summary of security signals for monitoring dashboards.
   */
  getSummary(sinceMs = 60 * 60 * 1000): {
    totalAlerts: number;
    critical: number;
    warning: number;
    byType: Record<string, number>;
    topActors: { actor: string; count: number }[];
  } {
    const since = Date.now() - sinceMs;
    const recent = alerts.filter((a) => new Date(a.timestamp).getTime() > since);

    const byType: Record<string, number> = {};
    const actorCounts: Record<string, number> = {};

    for (const a of recent) {
      byType[a.type] = (byType[a.type] || 0) + 1;
      actorCounts[a.actor] = (actorCounts[a.actor] || 0) + 1;
    }

    const topActors = Object.entries(actorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([actor, count]) => ({ actor, count }));

    return {
      totalAlerts: recent.length,
      critical: recent.filter((a) => a.severity === "critical").length,
      warning: recent.filter((a) => a.severity === "warning").length,
      byType,
      topActors,
    };
  },

  /**
   * Get live stats for a specific pro (for admin investigation).
   */
  getProStats(proId: string): {
    athleteAccessLast10min: number;
    exportsLastHour: number;
    exportsLastDay: number;
    writeActionsLastMin: number;
    alerts: SecurityAlert[];
  } {
    const athleteEntries = athleteAccess.get(proId) || [];
    const exportEntries = exportEvents.get(proId) || [];
    const writeEntries = writeActions.get(proId) || [];

    return {
      athleteAccessLast10min: distinctValues(athleteEntries, CONFIG.athleteEnumeration.windowMs).length,
      exportsLastHour: countInWindow(exportEntries, CONFIG.exportSpike.windowMs),
      exportsLastDay: countInWindow(exportEntries, CONFIG.exportSpike.dailyWindowMs),
      writeActionsLastMin: countInWindow(writeEntries, CONFIG.rapidActions.windowMs),
      alerts: alerts
        .filter((a) => a.actor === proId)
        .slice(-20)
        .reverse(),
    };
  },
};
