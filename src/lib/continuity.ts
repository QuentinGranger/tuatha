// ─── Business Continuity: RPO / RTO Monitoring ───
//
// Defines and enforces Recovery Point Objective (RPO) and Recovery Time
// Objective (RTO) targets for the Tuatha Pro platform.
//
// RPO — maximum acceptable data loss window:
//   - Database: 24h (daily backups)
//   - Uploads:  24h (daily backups)
//   → A failure at the worst moment loses at most 24h of data.
//
// RTO — maximum acceptable downtime:
//   - Database restore: < 30 min (pg_dump restore from encrypted backup)
//   - File restore:     < 15 min (tar extract from encrypted backup)
//   - Session recovery: < 1 min  (users re-login after token revocation)
//   - Full platform:    < 1h     (worst-case full restore + restart)
//
// Monitoring:
//   - Tracks backup freshness (last backup age vs RPO threshold)
//   - Tracks restore readiness (encryption key, pg_dump/psql, disk space)
//   - Exposes compliance status via continuity.getStatus()
//   - Emits structured alerts when RPO is at risk
//
// Integration:
//   - Works with backup.ts (backup history + verify)
//   - Works with incidentResponse.ts (lockdown status)
//   - Exposed via GET /api/admin/continuity

import { backup } from "@/lib/backup";
import { incident } from "@/lib/incidentResponse";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { access } from "fs/promises";
import path from "path";

const exec = promisify(execCb);

// ─── RPO / RTO Targets ───

export const RPO = {
  database: {
    target: 24 * 60 * 60 * 1000,   // 24h in ms
    label: "24 heures",
    description: "Perte maximale acceptable de données en base",
  },
  files: {
    target: 24 * 60 * 60 * 1000,   // 24h in ms
    label: "24 heures",
    description: "Perte maximale acceptable de fichiers uploadés",
  },
} as const;

export const RTO = {
  database: {
    target: 30 * 60 * 1000,        // 30 min
    label: "30 minutes",
    description: "Temps maximum pour restaurer la base de données",
  },
  files: {
    target: 15 * 60 * 1000,        // 15 min
    label: "15 minutes",
    description: "Temps maximum pour restaurer les fichiers",
  },
  sessions: {
    target: 1 * 60 * 1000,         // 1 min
    label: "1 minute",
    description: "Temps pour que les utilisateurs puissent se reconnecter",
  },
  fullPlatform: {
    target: 60 * 60 * 1000,        // 1h
    label: "1 heure",
    description: "Temps maximum pour une restauration complète",
  },
} as const;

// ─── Backup schedule (for RPO enforcement) ───

export const BACKUP_SCHEDULE = {
  frequency: "daily",
  cronExpression: "0 3 * * *",     // 03:00 UTC every day
  description: "Backup complet quotidien à 03h00 UTC",
  type: "full" as const,
} as const;

// ─── Types ───

export type ComplianceLevel = "ok" | "warning" | "critical" | "unknown";

interface RPOStatus {
  component: string;
  target: string;
  lastBackupAge: number | null;      // ms since last backup, null if no backup
  lastBackupAgeLabel: string;
  lastBackupId: string | null;
  compliance: ComplianceLevel;
  message: string;
}

interface RTOReadiness {
  component: string;
  target: string;
  ready: boolean;
  checks: { name: string; passed: boolean; detail?: string }[];
  message: string;
}

interface ContinuityStatus {
  timestamp: string;
  rpo: RPOStatus[];
  rto: RTOReadiness[];
  overallCompliance: ComplianceLevel;
  incidentActive: boolean;
  backupSchedule: typeof BACKUP_SCHEDULE;
  recommendations: string[];
}

// ─── Helpers ───

function formatDuration(ms: number): string {
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)}min`;
  if (ms < 24 * 60 * 60 * 1000) {
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return m > 0 ? `${h}h${m}min` : `${h}h`;
  }
  const d = Math.floor(ms / 86400000);
  const h = Math.round((ms % 86400000) / 3600000);
  return h > 0 ? `${d}j ${h}h` : `${d}j`;
}

function rpoCompliance(ageMs: number | null, targetMs: number): ComplianceLevel {
  if (ageMs === null) return "unknown";
  if (ageMs <= targetMs * 0.8) return "ok";           // < 80% of target
  if (ageMs <= targetMs) return "warning";             // 80-100% of target
  return "critical";                                   // > 100% of target
}

async function commandAvailable(cmd: string): Promise<boolean> {
  try {
    await exec(`which ${cmd}`);
    return true;
  } catch {
    // Try common PostgreSQL install paths on macOS
    const paths = [
      "/opt/homebrew/opt/postgresql@17/bin",
      "/opt/homebrew/opt/postgresql@16/bin",
      "/opt/homebrew/opt/postgresql@15/bin",
      "/usr/local/opt/postgresql/bin",
      "/Applications/Postgres.app/Contents/Versions/latest/bin",
    ];
    for (const p of paths) {
      try {
        await access(path.join(p, cmd));
        return true;
      } catch { /* next */ }
    }
    return false;
  }
}

// ─── Scheduled backup tracking ───

let lastScheduledBackupCheck = 0;
let scheduledBackupTimer: ReturnType<typeof setInterval> | null = null;

function startScheduledBackupMonitor(): void {
  if (scheduledBackupTimer) return;

  // Check every hour if a backup is needed
  scheduledBackupTimer = setInterval(async () => {
    try {
      const history = await backup.getHistory();
      if (history.length === 0) {
        console.warn("[Continuity] ⚠️ RPO à risque : aucun backup trouvé.");
        return;
      }

      const latest = history[0];
      const age = Date.now() - new Date(latest.timestamp).getTime();
      const rpoTarget = RPO.database.target;

      // Alert at 80% of RPO
      if (age > rpoTarget * 0.8) {
        console.warn(
          `[Continuity] ⚠️ RPO warning : dernier backup il y a ${formatDuration(age)} ` +
          `(cible: ${RPO.database.label}). Backup planifié nécessaire.`,
        );
      }

      // Critical at 100% of RPO
      if (age > rpoTarget) {
        console.error(
          `[Continuity] 🔴 RPO VIOLATION : dernier backup il y a ${formatDuration(age)} ` +
          `(cible: ${RPO.database.label}). Lancer un backup immédiatement !`,
        );
      }

      lastScheduledBackupCheck = Date.now();
    } catch (err) {
      console.error("[Continuity] Erreur monitoring RPO:", err);
    }
  }, 60 * 60 * 1000); // Every hour
}

// ─── Public API ───

export const continuity = {

  /**
   * Get full continuity status (RPO compliance + RTO readiness).
   */
  async getStatus(): Promise<ContinuityStatus> {
    const now = new Date();
    const recommendations: string[] = [];

    // ── RPO Status ──

    const history = await backup.getHistory();
    const latestBackup = history.length > 0 ? history[0] : null;
    const lastBackupAge = latestBackup
      ? Date.now() - new Date(latestBackup.timestamp).getTime()
      : null;

    const rpoDatabase: RPOStatus = {
      component: "Base de données PostgreSQL",
      target: RPO.database.label,
      lastBackupAge,
      lastBackupAgeLabel: lastBackupAge !== null ? formatDuration(lastBackupAge) : "Aucun backup",
      lastBackupId: latestBackup?.id || null,
      compliance: rpoCompliance(lastBackupAge, RPO.database.target),
      message: lastBackupAge === null
        ? "Aucun backup trouvé — RPO non respecté"
        : lastBackupAge > RPO.database.target
          ? `Dernier backup il y a ${formatDuration(lastBackupAge)} — RPO dépassé`
          : `Dernier backup il y a ${formatDuration(lastBackupAge)} — RPO respecté`,
    };

    const rpoFiles: RPOStatus = {
      component: "Fichiers uploadés (documents, vidéos, avatars)",
      target: RPO.files.label,
      lastBackupAge,
      lastBackupAgeLabel: lastBackupAge !== null ? formatDuration(lastBackupAge) : "Aucun backup",
      lastBackupId: latestBackup?.id || null,
      compliance: rpoCompliance(lastBackupAge, RPO.files.target),
      message: lastBackupAge === null
        ? "Aucun backup trouvé — RPO non respecté"
        : lastBackupAge > RPO.files.target
          ? `Dernier backup il y a ${formatDuration(lastBackupAge)} — RPO dépassé`
          : `Dernier backup il y a ${formatDuration(lastBackupAge)} — RPO respecté`,
    };

    // RPO recommendations
    if (rpoDatabase.compliance === "unknown") {
      recommendations.push("Créer un premier backup : POST /api/admin/backup");
    }
    if (rpoDatabase.compliance === "critical") {
      recommendations.push("URGENT : lancer un backup immédiat, le RPO est dépassé.");
    }
    if (rpoDatabase.compliance === "warning") {
      recommendations.push("Le prochain backup planifié doit s'exécuter dans les prochaines heures.");
    }

    // ── RTO Readiness ──

    // Database restore readiness
    const pgDumpAvail = await commandAvailable("pg_dump");
    const psqlAvail = await commandAvailable("psql");
    const backupConfig = backup.getConfig();

    const dbChecks = [
      {
        name: "pg_dump disponible",
        passed: pgDumpAvail,
        detail: pgDumpAvail ? undefined : "Installer postgresql-client",
      },
      {
        name: "psql disponible",
        passed: psqlAvail,
        detail: psqlAvail ? undefined : "Installer postgresql-client",
      },
      {
        name: "Clé de chiffrement configurée",
        passed: backupConfig.encryptionKeyConfigured,
        detail: backupConfig.encryptionKeyConfigured
          ? undefined
          : "ENCRYPTION_KEY manquante dans .env",
      },
      {
        name: "Backup récent disponible",
        passed: history.length > 0,
        detail: history.length > 0
          ? `${history.length} backup(s) disponible(s)`
          : "Aucun backup trouvé",
      },
    ];

    // Verify latest backup integrity
    let lastVerified = false;
    if (latestBackup) {
      try {
        const v = await backup.verify(latestBackup.id);
        lastVerified = v.valid;
        dbChecks.push({
          name: "Dernier backup vérifié (intégrité)",
          passed: v.valid,
          detail: v.valid ? "Checksums et déchiffrement OK" : "Échec de vérification",
        });
      } catch {
        dbChecks.push({
          name: "Dernier backup vérifié (intégrité)",
          passed: false,
          detail: "Erreur lors de la vérification",
        });
      }
    }

    const dbReady = dbChecks.every((c) => c.passed);
    const rtoDatabase: RTOReadiness = {
      component: "Restauration base de données",
      target: RTO.database.label,
      ready: dbReady,
      checks: dbChecks,
      message: dbReady
        ? `Prêt — restauration estimée < ${RTO.database.label}`
        : `Non prêt — ${dbChecks.filter((c) => !c.passed).length} prérequis manquant(s)`,
    };

    // File restore readiness
    let tarAvail = false;
    try {
      await exec("which tar");
      tarAvail = true;
    } catch { /* */ }

    const fileChecks = [
      { name: "tar disponible", passed: tarAvail },
      {
        name: "Clé de chiffrement configurée",
        passed: backupConfig.encryptionKeyConfigured,
      },
      {
        name: "Backup récent avec fichiers",
        passed: history.some((h) => h.type === "full" || h.type === "files"),
        detail: history.some((h) => h.type === "full" || h.type === "files")
          ? undefined
          : "Aucun backup de fichiers trouvé",
      },
    ];

    const filesReady = fileChecks.every((c) => c.passed);
    const rtoFiles: RTOReadiness = {
      component: "Restauration fichiers",
      target: RTO.files.label,
      ready: filesReady,
      checks: fileChecks,
      message: filesReady
        ? `Prêt — restauration estimée < ${RTO.files.label}`
        : `Non prêt — ${fileChecks.filter((c) => !c.passed).length} prérequis manquant(s)`,
    };

    // Session recovery readiness
    const rtoSessions: RTOReadiness = {
      component: "Récupération des sessions",
      target: RTO.sessions.label,
      ready: true,
      checks: [
        {
          name: "Révocation globale disponible",
          passed: true,
          detail: "incident.revokeAllTokens() prêt",
        },
        {
          name: "Login fonctionnel (sans dépendance externe)",
          passed: true,
          detail: "Auth locale bcrypt — pas de dépendance tierce",
        },
      ],
      message: `Prêt — re-login < ${RTO.sessions.label}`,
    };

    // Full platform
    const fullReady = dbReady && filesReady;
    const rtoFull: RTOReadiness = {
      component: "Restauration complète plateforme",
      target: RTO.fullPlatform.label,
      ready: fullReady,
      checks: [
        { name: "DB restore prêt", passed: dbReady },
        { name: "Files restore prêt", passed: filesReady },
        { name: "Sessions: re-login automatique", passed: true },
      ],
      message: fullReady
        ? `Prêt — restauration complète estimée < ${RTO.fullPlatform.label}`
        : "Non prêt — voir les prérequis DB et fichiers ci-dessus",
    };

    // RTO recommendations
    if (!pgDumpAvail || !psqlAvail) {
      recommendations.push("Installer postgresql-client pour permettre la restauration DB.");
    }
    if (!backupConfig.encryptionKeyConfigured) {
      recommendations.push("Configurer ENCRYPTION_KEY dans .env pour déchiffrer les backups.");
    }
    if (!lastVerified && latestBackup) {
      recommendations.push("Le dernier backup n'a pas passé la vérification d'intégrité.");
    }

    // ── Overall compliance ──

    const allRpo = [rpoDatabase, rpoFiles];
    const allRto = [rtoDatabase, rtoFiles, rtoFull];

    let overallCompliance: ComplianceLevel = "ok";
    if (allRpo.some((r) => r.compliance === "unknown") || allRto.some((r) => !r.ready)) {
      overallCompliance = "warning";
    }
    if (allRpo.some((r) => r.compliance === "critical")) {
      overallCompliance = "critical";
    }
    if (allRpo.every((r) => r.compliance === "unknown")) {
      overallCompliance = "critical";
    }

    // Incident impact
    const incidentActive = incident.isReadOnly();
    if (incidentActive) {
      recommendations.push("Mode read-only actif — les écritures sont bloquées.");
    }

    return {
      timestamp: now.toISOString(),
      rpo: [rpoDatabase, rpoFiles],
      rto: [rtoDatabase, rtoFiles, rtoSessions, rtoFull],
      overallCompliance,
      incidentActive,
      backupSchedule: BACKUP_SCHEDULE,
      recommendations,
    };
  },

  /**
   * Start background RPO monitoring (hourly check).
   * Call once at application startup.
   */
  startMonitoring(): void {
    startScheduledBackupMonitor();
    console.log("[Continuity] RPO/RTO monitoring started (hourly check).");
  },

  /**
   * Stop background monitoring.
   */
  stopMonitoring(): void {
    if (scheduledBackupTimer) {
      clearInterval(scheduledBackupTimer);
      scheduledBackupTimer = null;
    }
  },

  /**
   * Get RPO/RTO targets summary (for documentation).
   */
  getTargets(): {
    rpo: Record<string, { target: string; description: string }>;
    rto: Record<string, { target: string; description: string }>;
    schedule: typeof BACKUP_SCHEDULE;
  } {
    return {
      rpo: {
        database: { target: RPO.database.label, description: RPO.database.description },
        files: { target: RPO.files.label, description: RPO.files.description },
      },
      rto: {
        database: { target: RTO.database.label, description: RTO.database.description },
        files: { target: RTO.files.label, description: RTO.files.description },
        sessions: { target: RTO.sessions.label, description: RTO.sessions.description },
        fullPlatform: { target: RTO.fullPlatform.label, description: RTO.fullPlatform.description },
      },
      schedule: BACKUP_SCHEDULE,
    };
  },
};
