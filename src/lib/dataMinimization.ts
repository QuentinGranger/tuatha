// ─── Data Minimization (RGPD Article 5(1)(c)) ───
//
// Ensures only necessary data is collected, stored, and returned.
//
// Features:
//   1. Response projection  — strip fields not needed for each use case
//   2. Data retention       — configurable TTL per data type, auto-cleanup
//   3. Anonymization        — replace PII with anonymized values on request
//   4. Collection guards    — reject over-collection at creation time
//
// Principles:
//   - Only collect data adequate, relevant, and limited to what is necessary
//   - Retain data only as long as needed for the stated purpose
//   - Anonymize or delete when purpose is fulfilled or consent revoked

import { prisma } from "@/lib/prisma";

// ─── 1. Response Projection ───
// Define minimal field sets per use case to avoid over-exposure.

/** Fields returned when listing athletes (dashboard cards) */
export const ATHLETE_LIST_SELECT = {
  id: true,
  name: true,
  sport: true,
  status: true,
  riskLevel: true,
  trend: true,
  lastContactAt: true,
  objectif: true,
  motif: true,
  bodyZone: true,
  consentement: true,
  professionnelId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { notes: true } },
} as const;

/** Fields returned when viewing an athlete in shared (réseau) context */
export const ATHLETE_SHARED_SELECT = {
  id: true,
  name: true,
  sport: true,
  status: true,
  bodyZone: true,
  motif: true,
  objectif: true,
  riskLevel: true,
  trend: true,
} as const;

/** Fields for search results (absolute minimum) */
export const ATHLETE_SEARCH_SELECT = {
  id: true,
  name: true,
  sport: true,
  status: true,
} as const;

/** Fields returned in invoice context (only billing-relevant) */
export const ATHLETE_INVOICE_SELECT = {
  id: true,
  name: true,
  contactEmail: true,
} as const;

// ─── 2. Data Retention Policies ───

export interface RetentionPolicy {
  /** Model name (Prisma) */
  model: string;
  /** Human-readable description */
  description: string;
  /** Maximum retention in days (null = indefinite / legal obligation) */
  maxDays: number | null;
  /** Which date field to use for age calculation */
  dateField: string;
  /** Additional where clause for scoping */
  scope?: Record<string, unknown>;
  /** Whether to anonymize instead of delete */
  anonymize?: boolean;
  /** Data category for reporting */
  category: RetentionCategory;
  /** Legal basis for this retention period */
  legalBasis: string;
}

export type RetentionCategory =
  | "medical"          // Données de santé (dossier patient)
  | "administrative"   // Facturation, comptabilité
  | "communication"    // Messages, notifications
  | "security"         // Logs sécurité, sessions
  | "consent"          // Consentements (obligation légale)
  | "operational";     // Données techniques (logs, exercice)

// ─── Durées de conservation ───
//
// Fondements juridiques (France):
//   - Code de la santé publique Art. R.1112-7: dossier médical = 20 ans après dernier contact
//   - Code de commerce Art. L.123-22: pièces comptables = 10 ans
//   - RGPD Art. 5(1)(e): limitation de la conservation
//   - RGPD Art. 17: droit à l'effacement
//   - CNIL Délibération 2018-155: données de santé
//   - Code pénal Art. 226-20: conservation au-delà de la durée autorisée = sanction pénale
//
// Principe: conserver uniquement le temps nécessaire à la finalité du traitement.
// Les durées ci-dessous sont des MAXIMUMS. La suppression peut intervenir plus tôt
// si l'athlète exerce son droit à l'effacement ou si le consentement est retiré.

export const RETENTION_POLICIES: RetentionPolicy[] = [

  // ═══════════════════════════════════════════════
  // DONNÉES MÉDICALES / DE SANTÉ
  // Base légale: Code de la santé publique Art. R.1112-7
  // Durée: 20 ans après le dernier contact, ou 10 ans après le décès
  // Pour cette app: les profils inactifs > 5 ans sont anonymisés
  // (le pro peut conserver les données plus longtemps sur demande motivée)
  // ═══════════════════════════════════════════════

  {
    model: "athlete",
    description: "Profils athlètes archivés inactifs > 5 ans → anonymisation",
    maxDays: 1825, // 5 ans
    dateField: "updatedAt",
    scope: { status: "archived" },
    anonymize: true,
    category: "medical",
    legalBasis: "RGPD Art. 5(1)(e) — limitation conservation ; CSP Art. R.1112-7 (max 20 ans, anonymisation anticipée pour profils sans activité)",
  },
  {
    model: "athleteNote",
    description: "Notes cliniques d'athlètes > 5 ans",
    maxDays: 1825,
    dateField: "createdAt",
    category: "medical",
    legalBasis: "CSP Art. R.1112-7 — conservation du dossier patient ; RGPD Art. 5(1)(e)",
  },
  {
    model: "kinePlan",
    description: "Plans kiné soft-deleted > 3 ans",
    maxDays: 1095,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "medical",
    legalBasis: "RGPD Art. 5(1)(e) — données cliniques supprimées",
  },
  {
    model: "nutriPlan",
    description: "Plans nutrition soft-deleted > 3 ans",
    maxDays: 1095,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "medical",
    legalBasis: "RGPD Art. 5(1)(e) — données cliniques supprimées",
  },
  {
    model: "medOrdonnance",
    description: "Ordonnances soft-deleted > 5 ans",
    maxDays: 1825,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "medical",
    legalBasis: "CSP Art. R.1112-7 — pièces du dossier médical ; Art. L.1111-8",
  },
  {
    model: "medProtocol",
    description: "Protocoles médicaux soft-deleted > 5 ans",
    maxDays: 1825,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "medical",
    legalBasis: "CSP Art. R.1112-7 — protocoles de soins",
  },

  // ═══════════════════════════════════════════════
  // DONNÉES OPÉRATIONNELLES / EXERCICE
  // Données de suivi d'entraînement et d'exercice
  // ═══════════════════════════════════════════════

  {
    model: "exerciseLog",
    description: "Logs d'exercices > 3 ans",
    maxDays: 1095,
    dateField: "createdAt",
    category: "operational",
    legalBasis: "RGPD Art. 5(1)(e) — données de suivi d'entraînement",
  },
  {
    model: "session",
    description: "Séances soft-deleted > 2 ans",
    maxDays: 730,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "operational",
    legalBasis: "RGPD Art. 5(1)(e) — données d'entraînement supprimées",
  },
  {
    model: "calendarEvent",
    description: "Événements soft-deleted > 1 an",
    maxDays: 365,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "operational",
    legalBasis: "RGPD Art. 5(1)(e) — événements d'agenda supprimés",
  },
  {
    model: "kanbanTask",
    description: "Tâches soft-deleted > 6 mois",
    maxDays: 180,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "operational",
    legalBasis: "RGPD Art. 5(1)(e) — tâches organisationnelles supprimées",
  },

  // ═══════════════════════════════════════════════
  // FACTURATION & COMPTABILITÉ
  // Base légale: Code de commerce Art. L.123-22 = 10 ans
  // ═══════════════════════════════════════════════

  {
    model: "invoice",
    description: "Factures soft-deleted > 10 ans (obligation comptable)",
    maxDays: 3650, // 10 ans
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "administrative",
    legalBasis: "Code de commerce Art. L.123-22 — pièces comptables 10 ans ; Code général des impôts Art. L.102 B",
  },

  // ═══════════════════════════════════════════════
  // COMMUNICATION
  // Messages, documents partagés, vidéos
  // ═══════════════════════════════════════════════

  {
    model: "proMessage",
    description: "Messages soft-deleted > 1 an",
    maxDays: 365,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "communication",
    legalBasis: "RGPD Art. 5(1)(e) — correspondance professionnelle supprimée",
  },
  {
    model: "collabNote",
    description: "Notes collaboratives soft-deleted > 2 ans",
    maxDays: 730,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "communication",
    legalBasis: "RGPD Art. 5(1)(e) — notes interprofessionnelles supprimées",
  },
  {
    model: "sharedDocument",
    description: "Documents partagés soft-deleted > 3 ans",
    maxDays: 1095,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "communication",
    legalBasis: "CSP Art. R.1112-7 — documents du dossier patient",
  },
  {
    model: "athleteVideo",
    description: "Vidéos soft-deleted > 1 an",
    maxDays: 365,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "communication",
    legalBasis: "RGPD Art. 5(1)(e) — contenus multimédias supprimés",
  },

  // ═══════════════════════════════════════════════
  // SÉCURITÉ & TECHNIQUE
  // ═══════════════════════════════════════════════

  {
    model: "securityAlert",
    description: "Alertes sécurité > 1 an",
    maxDays: 365,
    dateField: "createdAt",
    category: "security",
    legalBasis: "RGPD Art. 5(1)(e) — journalisation technique ; CNIL recommandation 6 mois à 1 an",
  },
  {
    model: "authSession",
    description: "Sessions révoquées > 6 mois",
    maxDays: 180,
    dateField: "createdAt",
    scope: { revoked: true },
    category: "security",
    legalBasis: "RGPD Art. 5(1)(e) — tokens de session expirés ; CNIL durée de conservation recommandée",
  },

  // ═══════════════════════════════════════════════
  // CONSENTEMENT & AUDIT (JAMAIS SUPPRIMÉ)
  // Base légale: RGPD Art. 7(1) — preuve du consentement
  // ═══════════════════════════════════════════════

  {
    model: "consentLog",
    description: "Logs de consentement — conservation légale indéfinie",
    maxDays: null,
    dateField: "createdAt",
    category: "consent",
    legalBasis: "RGPD Art. 7(1) — le responsable du traitement doit être en mesure de démontrer que la personne a donné son consentement ; aucune durée maximale applicable",
  },

  // ═══════════════════════════════════════════════
  // CABINET
  // ═══════════════════════════════════════════════

  {
    model: "cabinet",
    description: "Cabinets soft-deleted > 2 ans",
    maxDays: 730,
    dateField: "deletedAt",
    scope: { deletedAt: { not: null } },
    category: "administrative",
    legalBasis: "RGPD Art. 5(1)(e) — structure organisationnelle supprimée",
  },
];

// ─── 3. Anonymization ───
// Replace PII with anonymized values. Used when:
//   - Athlete is permanently archived and consent revoked
//   - RGPD "right to be forgotten" request
//   - Data retention period exceeded for inactive athletes

/** PII fields on the Athlete model that must be anonymized */
const ATHLETE_PII_FIELDS = [
  "name",
  "contactEmail",
  "contactPhone",
  "injuryNote",
  "latestNote",
  "antecedents",
  "traitements",
  "contreIndications",
  "objectif",
  "motif",
] as const;

/**
 * Anonymize an athlete's PII. Replaces personal data with generic placeholders.
 * Consent is revoked, and a ConsentLog entry is written.
 *
 * ⚠️ IRREVERSIBLE — cannot be undone.
 *
 * @param athleteId  - ID of the athlete to anonymize
 * @param actorProId - ID of the professional requesting anonymization
 * @param reason     - Reason for anonymization (audit trail)
 * @returns Summary of what was anonymized
 */
export async function anonymizeAthlete(
  athleteId: string,
  actorProId: string,
  reason: string,
): Promise<{ ok: boolean; anonymized: string[]; error?: string }> {
  try {
    const athlete = await (prisma as any).athlete.findUnique({
      where: { id: athleteId },
      select: { name: true, professionnelId: true },
    });

    if (!athlete) {
      return { ok: false, anonymized: [], error: "Athlète introuvable." };
    }

    // Only owner can anonymize
    if (athlete.professionnelId !== actorProId) {
      return { ok: false, anonymized: [], error: "Seul le professionnel référent peut anonymiser." };
    }

    const anonymizedId = athleteId.slice(0, 8);
    const anonymizedFields: string[] = [];

    // Build anonymization data
    const data: Record<string, unknown> = {
      name: `Anonyme-${anonymizedId}`,
      contactEmail: null,
      contactPhone: null,
      injuryNote: null,
      latestNote: null,
      antecedents: [],
      traitements: null,
      contreIndications: null,
      objectif: null,
      motif: null,
      dateNaissance: null,
      taille: null,
      poids: null,
      dataTracking: [],
      canalCommunication: null,
      // Revoke all consent
      consentement: false,
      consentementDate: null,
      consentementPartage: false,
      consentementPartageDate: null,
      // Mark as archived
      status: "archived",
    };

    anonymizedFields.push(...ATHLETE_PII_FIELDS);

    // Transaction: anonymize + log consent revocation
    await (prisma as any).$transaction([
      (prisma as any).athlete.update({
        where: { id: athleteId },
        data,
      }),
      // Log the anonymization as consent revocation
      (prisma as any).consentLog.create({
        data: {
          consentType: "general",
          action: "revoked",
          previousValue: true,
          newValue: false,
          method: "digital",
          purpose: `Anonymisation RGPD: ${reason}`,
          athleteId,
          actorProId,
        },
      }),
      // Also delete athlete notes (PII)
      (prisma as any).athleteNote.deleteMany({
        where: { athleteId },
      }),
    ]);

    console.log(
      `[DataMinimization] Athlete ${athleteId} anonymized by ${actorProId}: ${reason}`,
    );

    return { ok: true, anonymized: anonymizedFields };
  } catch (error) {
    console.error("[DataMinimization] Anonymization error:", error);
    return { ok: false, anonymized: [], error: "Erreur lors de l'anonymisation." };
  }
}

// ─── 4. Retention Enforcement ───

export interface RetentionResult {
  policy: string;
  model: string;
  category: RetentionCategory;
  action: "deleted" | "anonymized" | "skipped";
  affected: number;
  legalBasis: string;
}

/**
 * Apply all retention policies: delete or anonymize data past its retention period.
 * Should be called periodically (e.g. weekly cron).
 *
 * For policies with `anonymize: true`, records are anonymized rather than deleted.
 * For policies with `maxDays: null`, the policy is skipped (legal retention indefinite).
 */
export async function enforceRetention(): Promise<RetentionResult[]> {
  const results: RetentionResult[] = [];

  console.log("[DataMinimization] Enforcing retention policies...");

  for (const policy of RETENTION_POLICIES) {
    if (policy.maxDays === null) {
      results.push({
        policy: policy.description,
        model: policy.model,
        category: policy.category,
        action: "skipped",
        affected: 0,
        legalBasis: policy.legalBasis,
      });
      continue;
    }

    try {
      const cutoff = new Date(Date.now() - policy.maxDays * 24 * 60 * 60 * 1000);
      const delegate = (prisma as any)[policy.model];
      if (!delegate) continue;

      const where: Record<string, unknown> = {
        [policy.dateField]: { lt: cutoff },
        ...(policy.scope || {}),
      };

      // Anonymize instead of delete for flagged policies (e.g. archived athletes)
      if (policy.anonymize && policy.model === "athlete") {
        const expiredAthletes = await delegate.findMany({
          where,
          select: { id: true, professionnelId: true },
        });

        let anonymized = 0;
        for (const athlete of expiredAthletes) {
          const result = await anonymizeAthlete(
            athlete.id,
            athlete.professionnelId,
            `Rétention automatique: ${policy.description}`,
          );
          if (result.ok) anonymized++;
        }

        results.push({
          policy: policy.description,
          model: policy.model,
          category: policy.category,
          action: "anonymized",
          affected: anonymized,
          legalBasis: policy.legalBasis,
        });

        if (anonymized > 0) {
          console.log(`[DataMinimization] ${policy.description}: ${anonymized} anonymisé(s).`);
        }
        continue;
      }

      // Standard deletion
      const { count } = await delegate.deleteMany({ where });

      results.push({
        policy: policy.description,
        model: policy.model,
        category: policy.category,
        action: "deleted",
        affected: count,
        legalBasis: policy.legalBasis,
      });

      if (count > 0) {
        console.log(`[DataMinimization] ${policy.description}: ${count} supprimé(s).`);
      }
    } catch (error) {
      console.error(`[DataMinimization] Retention error for ${policy.model}:`, error);
      results.push({
        policy: policy.description,
        model: policy.model,
        category: policy.category,
        action: "skipped",
        affected: 0,
        legalBasis: policy.legalBasis,
      });
    }
  }

  const totalDeleted = results.filter(r => r.action === "deleted").reduce((s, r) => s + r.affected, 0);
  const totalAnonymized = results.filter(r => r.action === "anonymized").reduce((s, r) => s + r.affected, 0);
  console.log(`[DataMinimization] Retention complete: ${totalDeleted} supprimé(s), ${totalAnonymized} anonymisé(s).`);

  return results;
}

// ─── 5. Collection Guards ───

/**
 * Validate that a data collection request doesn't gather unnecessary fields.
 * Returns warnings for fields that should not be collected given the stated purpose.
 */
export function checkCollectionMinimality(
  purpose: "creation" | "update" | "export" | "sharing",
  fields: string[],
): { warnings: string[] } {
  const warnings: string[] = [];

  const NEVER_FOR_SHARING = new Set([
    "contactEmail", "contactPhone", "dateNaissance",
    "consentement", "consentementDate",
  ]);

  const NEVER_FOR_EXPORT = new Set([
    "consentement", "consentementDate",
    "consentementPartage", "consentementPartageDate",
  ]);

  if (purpose === "sharing") {
    for (const field of fields) {
      if (NEVER_FOR_SHARING.has(field)) {
        warnings.push(`Le champ "${field}" ne devrait pas être partagé (minimisation des données).`);
      }
    }
  }

  if (purpose === "export") {
    for (const field of fields) {
      if (NEVER_FOR_EXPORT.has(field)) {
        warnings.push(`Le champ "${field}" ne devrait pas être exporté (données internes).`);
      }
    }
  }

  return { warnings };
}

// ─── 6. Status & Reporting ───

export interface RetentionStatusReport {
  retentionPolicies: Array<{
    model: string;
    description: string;
    maxDays: number | null;
    category: RetentionCategory;
    legalBasis: string;
    recordsInScope: number;
    recordsExpiring30d: number;
  }>;
  summary: {
    totalPolicies: number;
    byCategory: Record<string, number>;
    anonymizedAthletes: number;
    archivedAthletes: number;
    totalRecordsExpiring30d: number;
  };
}

/**
 * Get comprehensive data retention status with per-policy counts and upcoming expirations.
 */
export async function getMinimizationStatus(): Promise<RetentionStatusReport> {
  const policyDetails: RetentionStatusReport["retentionPolicies"] = [];
  let totalExpiring30d = 0;
  const byCategory: Record<string, number> = {};

  for (const policy of RETENTION_POLICIES) {
    byCategory[policy.category] = (byCategory[policy.category] || 0) + 1;

    const delegate = (prisma as any)[policy.model];
    if (!delegate) {
      policyDetails.push({
        model: policy.model,
        description: policy.description,
        maxDays: policy.maxDays,
        category: policy.category,
        legalBasis: policy.legalBasis,
        recordsInScope: 0,
        recordsExpiring30d: 0,
      });
      continue;
    }

    try {
      // Count records currently matching the scope
      const scopeWhere = policy.scope || {};
      const inScope = await delegate.count({ where: scopeWhere });

      // Count records expiring within the next 30 days (only if policy has a maxDays)
      let expiring30d = 0;
      if (policy.maxDays !== null) {
        const cutoff = new Date(Date.now() - policy.maxDays * 24 * 60 * 60 * 1000);
        const warningCutoff = new Date(Date.now() - (policy.maxDays - 30) * 24 * 60 * 60 * 1000);
        expiring30d = await delegate.count({
          where: {
            [policy.dateField]: { gte: cutoff, lt: warningCutoff },
            ...scopeWhere,
          },
        });
        totalExpiring30d += expiring30d;
      }

      policyDetails.push({
        model: policy.model,
        description: policy.description,
        maxDays: policy.maxDays,
        category: policy.category,
        legalBasis: policy.legalBasis,
        recordsInScope: inScope,
        recordsExpiring30d: expiring30d,
      });
    } catch {
      policyDetails.push({
        model: policy.model,
        description: policy.description,
        maxDays: policy.maxDays,
        category: policy.category,
        legalBasis: policy.legalBasis,
        recordsInScope: 0,
        recordsExpiring30d: 0,
      });
    }
  }

  const [anonymizedCount, archivedCount] = await Promise.all([
    (prisma as any).athlete.count({
      where: { name: { startsWith: "Anonyme-" } },
    }),
    (prisma as any).athlete.count({
      where: { status: "archived" },
    }),
  ]);

  return {
    retentionPolicies: policyDetails,
    summary: {
      totalPolicies: RETENTION_POLICIES.length,
      byCategory,
      anonymizedAthletes: anonymizedCount,
      archivedAthletes: archivedCount,
      totalRecordsExpiring30d: totalExpiring30d,
    },
  };
}
