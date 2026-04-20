// ─── Droits Utilisateur RGPD ───
//
// Implémente les droits des personnes concernées (athlètes/patients) :
//
//   Art. 15 — Droit d'accès         : export complet de toutes les données personnelles
//   Art. 16 — Droit de rectification : correction des données inexactes
//   Art. 17 — Droit à l'effacement  : suppression (quand applicable)
//   Art. 20 — Droit à la portabilité: export structuré (JSON)
//
// Chaque exercice de droit est tracé via SubjectAccessRequest pour audit.
//
// Usage:
//   import { userRights } from "@/lib/userRights";
//   await userRights.access(athleteId, proId, { ip, userAgent });
//   await userRights.rectify(athleteId, proId, corrections, { ip });
//   await userRights.erase(athleteId, proId, reason, { ip });

import { prisma } from "@/lib/prisma";
import { anonymizeAthlete } from "@/lib/dataMinimization";
import { consent } from "@/lib/consent";

// ─── Types ───

export type RightType = "access" | "rectification" | "erasure" | "portability" | "opposition";
export type RequestStatus = "pending" | "processing" | "completed" | "rejected" | "partial";

export interface RightContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AccessResult {
  requestId: string;
  athleteId: string;
  data: {
    profile: Record<string, unknown>;
    consentStatus: Record<string, unknown>;
    consentHistory: unknown[];
    notes: unknown[];
    sessions: unknown[];
    documents: unknown[];
    invoices: unknown[];
    messages: unknown[];
    kinePlans: unknown[];
    nutriPlans: unknown[];
    medOrdonnances: unknown[];
    medProtocols: unknown[];
    videos: unknown[];
    events: unknown[];
    kanbanTasks: unknown[];
  };
  exportedAt: string;
}

export interface RectifyResult {
  requestId: string;
  corrected: string[];
  unchanged: string[];
}

export interface EraseResult {
  requestId: string;
  erased: boolean;
  anonymizedFields: string[];
  reason?: string;
}

// ─── Allowed rectification fields ───
// Only these fields can be corrected via rectification right.
// Medical/clinical data entered by a pro cannot be rectified by the patient.

const RECTIFIABLE_FIELDS = new Set([
  "name",
  "contactEmail",
  "contactPhone",
  "dateNaissance",
  "taille",
  "poids",
  "sport",
  "objectif",
  "motif",
  "bodyZone",
  "frequence",
  "canalCommunication",
]);

// ─── Fields that block erasure (legal retention obligations) ───

function getErasureBlockers(athlete: Record<string, unknown>): string[] {
  const blockers: string[] = [];

  // Check if there are invoices (10-year accounting retention)
  // This is checked at the route level with actual DB counts
  return blockers;
}

// ─── Helper: create SAR entry ───

async function createRequest(
  rightType: RightType,
  athleteId: string,
  proId: string,
  details: Record<string, unknown> | null,
  ctx: RightContext = {},
): Promise<string> {
  const sar = await (prisma as any).subjectAccessRequest.create({
    data: {
      rightType,
      athleteId,
      requestedByProId: proId,
      details: details ? JSON.stringify(details) : null,
      ip: ctx.ip || null,
      userAgent: ctx.userAgent || null,
    },
  });
  return sar.id;
}

async function completeRequest(
  requestId: string,
  status: RequestStatus,
  result: Record<string, unknown>,
  reason?: string,
): Promise<void> {
  await (prisma as any).subjectAccessRequest.update({
    where: { id: requestId },
    data: {
      status,
      result: JSON.stringify(result),
      reason: reason || null,
      processedAt: new Date(),
      completedAt: status === "completed" || status === "rejected" ? new Date() : null,
    },
  });
}

// ─── Public API ───

export const userRights = {

  // ═══════════════════════════════════════════════
  // Art. 15 — DROIT D'ACCÈS
  // Export complet de toutes les données personnelles d'un athlète.
  // Délai légal: 1 mois (ici: immédiat).
  // ═══════════════════════════════════════════════

  async access(
    athleteId: string,
    proId: string,
    ctx: RightContext = {},
  ): Promise<AccessResult> {
    const requestId = await createRequest("access", athleteId, proId, null, ctx);

    try {
      // Fetch ALL personal data for this athlete
      const [
        profile,
        consentHistory,
        notes,
        sessions,
        documents,
        invoices,
        messages,
        kinePlans,
        nutriPlans,
        medOrdonnances,
        medProtocols,
        videos,
        events,
        kanbanTasks,
      ] = await Promise.all([
        // Full profile
        (prisma as any).athlete.findUnique({
          where: { id: athleteId },
          include: { notes: true },
        }),
        // Consent trail
        (prisma as any).consentLog.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        }),
        // Notes
        (prisma as any).athleteNote.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        }),
        // Sessions/programmes
        (prisma as any).session.findMany({
          where: { athleteId },
          include: { blocks: { include: { exercises: true } } },
          orderBy: { createdAt: "desc" },
        }),
        // Documents
        (prisma as any).sharedDocument.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        }),
        // Invoices
        (prisma as any).invoice.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        }),
        // Messages mentioning this athlete
        (prisma as any).proMessage.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        }),
        // Kiné plans
        (prisma as any).kinePlan.findMany({
          where: { athleteId },
          include: { exercises: true },
          orderBy: { createdAt: "desc" },
        }),
        // Nutri plans
        (prisma as any).nutriPlan.findMany({
          where: { athleteId },
          include: { meals: { include: { items: true } } },
          orderBy: { createdAt: "desc" },
        }),
        // Medical ordonnances
        (prisma as any).medOrdonnance.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        }),
        // Medical protocols
        (prisma as any).medProtocol.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        }),
        // Videos
        (prisma as any).athleteVideo.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        }),
        // Calendar events
        (prisma as any).calendarEvent.findMany({
          where: { athleteId },
          orderBy: { date: "desc" },
        }),
        // Kanban tasks
        (prisma as any).kanbanTask.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const consentStatus = await consent.getStatus(athleteId);

      const result: AccessResult = {
        requestId,
        athleteId,
        data: {
          profile: profile || {},
          consentStatus,
          consentHistory,
          notes,
          sessions,
          documents,
          invoices,
          messages,
          kinePlans,
          nutriPlans,
          medOrdonnances,
          medProtocols,
          videos,
          events,
          kanbanTasks,
        },
        exportedAt: new Date().toISOString(),
      };

      const categories = Object.entries(result.data)
        .filter(([, v]) => Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0)
        .map(([k]) => k);

      await completeRequest(requestId, "completed", {
        categoriesExported: categories,
        totalRecords: Object.values(result.data)
          .reduce((sum: number, v) => sum + (Array.isArray(v) ? v.length : 1), 0),
      });

      console.log(`[UserRights] Art.15 access fulfilled for athlete=${athleteId} by pro=${proId}`);

      return result;
    } catch (error) {
      await completeRequest(requestId, "rejected", { error: String(error) }, "Erreur technique");
      throw error;
    }
  },

  // ═══════════════════════════════════════════════
  // Art. 16 — DROIT DE RECTIFICATION
  // Correction des données personnelles inexactes.
  // Seuls les champs identitaires/contact sont rectifiables.
  // Les données cliniques saisies par un pro ne sont PAS rectifiables
  // par cette voie (elles relèvent de la correction du dossier médical).
  // ═══════════════════════════════════════════════

  async rectify(
    athleteId: string,
    proId: string,
    corrections: Record<string, unknown>,
    ctx: RightContext = {},
  ): Promise<RectifyResult> {
    const requestId = await createRequest("rectification", athleteId, proId, { corrections }, ctx);

    try {
      const corrected: string[] = [];
      const unchanged: string[] = [];
      const updateData: Record<string, unknown> = {};

      for (const [field, value] of Object.entries(corrections)) {
        if (!RECTIFIABLE_FIELDS.has(field)) {
          unchanged.push(field);
          continue;
        }

        // Type coercion for specific fields
        if (field === "dateNaissance" && value) {
          updateData[field] = new Date(value as string);
        } else if ((field === "taille" || field === "poids") && value !== null) {
          updateData[field] = Number(value);
        } else {
          updateData[field] = value;
        }
        corrected.push(field);
      }

      if (corrected.length > 0) {
        await (prisma as any).athlete.update({
          where: { id: athleteId },
          data: updateData,
        });
      }

      const result: RectifyResult = { requestId, corrected, unchanged };

      await completeRequest(
        requestId,
        corrected.length > 0 ? "completed" : "rejected",
        { corrected, unchanged },
        unchanged.length > 0
          ? `Champs non rectifiables: ${unchanged.join(", ")}. Les données cliniques doivent être corrigées par le professionnel.`
          : undefined,
      );

      console.log(
        `[UserRights] Art.16 rectification for athlete=${athleteId}: ${corrected.length} corrected, ${unchanged.length} refused`,
      );

      return result;
    } catch (error) {
      await completeRequest(requestId, "rejected", { error: String(error) }, "Erreur technique");
      throw error;
    }
  },

  // ═══════════════════════════════════════════════
  // Art. 17 — DROIT À L'EFFACEMENT
  // Suppression des données personnelles.
  //
  // ⚠️ EXCEPTIONS (effacement refusé) :
  //   - Obligation légale de conservation (factures: 10 ans)
  //   - Dossier médical (CSP Art. R.1112-7: 20 ans)
  //   - Contentieux en cours
  //
  // Si applicable: anonymisation irréversible via anonymizeAthlete().
  // ═══════════════════════════════════════════════

  async erase(
    athleteId: string,
    proId: string,
    reason: string,
    ctx: RightContext = {},
  ): Promise<EraseResult> {
    const requestId = await createRequest("erasure", athleteId, proId, { reason }, ctx);

    try {
      // Check for legal retention blockers
      const [invoiceCount, activeOrdonnances] = await Promise.all([
        (prisma as any).invoice.count({ where: { athleteId } }),
        (prisma as any).medOrdonnance.count({ where: { athleteId, deletedAt: null } }),
      ]);

      // Block if active invoices exist (10-year retention)
      if (invoiceCount > 0) {
        const rejectReason =
          `Effacement impossible: ${invoiceCount} facture(s) associée(s) (obligation de conservation comptable de 10 ans — Code de commerce Art. L.123-22). L'anonymisation partielle a été appliquée à la place.`;

        // Partial anonymization: anonymize PII but keep invoice-linked records
        const anonResult = await anonymizeAthlete(athleteId, proId, `Art.17 partiel: ${reason}`);

        await completeRequest(requestId, "partial", {
          blocked: true,
          reason: rejectReason,
          invoiceCount,
          anonymized: anonResult.anonymized,
        }, rejectReason);

        console.log(`[UserRights] Art.17 erasure PARTIAL for athlete=${athleteId}: ${invoiceCount} invoices block full erasure`);

        return {
          requestId,
          erased: false,
          anonymizedFields: anonResult.anonymized,
          reason: rejectReason,
        };
      }

      // Full anonymization
      const anonResult = await anonymizeAthlete(athleteId, proId, `Droit à l'effacement Art. 17: ${reason}`);

      if (!anonResult.ok) {
        await completeRequest(requestId, "rejected", { error: anonResult.error }, anonResult.error);
        return { requestId, erased: false, anonymizedFields: [], reason: anonResult.error };
      }

      await completeRequest(requestId, "completed", {
        erased: true,
        anonymizedFields: anonResult.anonymized,
      });

      console.log(`[UserRights] Art.17 erasure completed for athlete=${athleteId} by pro=${proId}`);

      return { requestId, erased: true, anonymizedFields: anonResult.anonymized };
    } catch (error) {
      await completeRequest(requestId, "rejected", { error: String(error) }, "Erreur technique");
      throw error;
    }
  },

  // ═══════════════════════════════════════════════
  // HISTORIQUE DES DEMANDES
  // ═══════════════════════════════════════════════

  /** Get all rights requests for an athlete */
  async getHistory(
    athleteId: string,
    options: { limit?: number } = {},
  ): Promise<unknown[]> {
    return (prisma as any).subjectAccessRequest.findMany({
      where: { athleteId },
      orderBy: { createdAt: "desc" },
      take: options.limit || 50,
    });
  },

  /** Get all rights requests made by a pro (audit) */
  async getProHistory(
    proId: string,
    options: { limit?: number } = {},
  ): Promise<unknown[]> {
    return (prisma as any).subjectAccessRequest.findMany({
      where: { requestedByProId: proId },
      orderBy: { createdAt: "desc" },
      take: options.limit || 50,
      include: {
        athlete: { select: { id: true, name: true } },
      },
    });
  },

  /** Get pending requests count (admin dashboard) */
  async getPendingCount(): Promise<number> {
    return (prisma as any).subjectAccessRequest.count({
      where: { status: "pending" },
    });
  },
};
