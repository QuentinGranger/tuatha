// ─── Consent Traceability (RGPD Santé) ───
//
// Immutable audit trail for all consent events on athlete data.
// Every grant, revoke, or update of consent is logged with full metadata:
//   - Who (professional), What (consent type), When, How (method), Why (purpose)
//   - IP address and user agent for forensic traceability
//
// Consent types:
//   - "general"         — GDPR baseline data processing consent
//   - "partage"         — Sharing data with other professionals
//   - "export"          — Exporting data outside the platform
//   - "data_processing" — Specific processing (e.g. AI analysis)
//
// Actions:
//   - "granted"  — Consent given (false → true)
//   - "revoked"  — Consent withdrawn (true → false)
//   - "renewed"  — Consent re-confirmed (true → true)
//
// Usage:
//   import { consent } from "@/lib/consent";
//   await consent.grant("general", athleteId, proId, { ip, userAgent, method: "verbal" });
//   await consent.revoke("partage", athleteId, proId, { ip });
//   await consent.getHistory(athleteId);

import { prisma } from "@/lib/prisma";

// ─── Types ───

export type ConsentType = "general" | "partage" | "export" | "data_processing";
export type ConsentAction = "granted" | "revoked" | "renewed";
export type ConsentMethod = "verbal" | "written" | "digital" | "email";

export interface ConsentContext {
  ip?: string | null;
  userAgent?: string | null;
  method?: ConsentMethod;
  purpose?: string;
}

export interface ConsentLogEntry {
  id: string;
  consentType: string;
  action: string;
  previousValue: boolean | null;
  newValue: boolean;
  method: string;
  purpose: string | null;
  athleteId: string;
  actorProId: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

// ─── Field mapping: consent type → Athlete model fields ───

const CONSENT_FIELDS: Record<ConsentType, { field: string; dateField: string }> = {
  general:         { field: "consentement",        dateField: "consentementDate" },
  partage:         { field: "consentementPartage", dateField: "consentementPartageDate" },
  export:          { field: "consentement",        dateField: "consentementDate" },        // uses general consent
  data_processing: { field: "consentement",        dateField: "consentementDate" },        // uses general consent
};

// ─── Helpers ───

async function getCurrentValue(athleteId: string, consentType: ConsentType): Promise<boolean | null> {
  const fields = CONSENT_FIELDS[consentType];
  if (!fields) return null;

  const athlete = await (prisma as any).athlete.findUnique({
    where: { id: athleteId },
    select: { [fields.field]: true },
  });

  return athlete ? athlete[fields.field] ?? false : null;
}

async function writeLog(
  consentType: ConsentType,
  action: ConsentAction,
  previousValue: boolean | null,
  newValue: boolean,
  athleteId: string,
  actorProId: string,
  ctx: ConsentContext = {},
): Promise<ConsentLogEntry> {
  return (prisma as any).consentLog.create({
    data: {
      consentType,
      action,
      previousValue,
      newValue,
      method: ctx.method || "digital",
      purpose: ctx.purpose || null,
      athleteId,
      actorProId,
      ip: ctx.ip || null,
      userAgent: ctx.userAgent || null,
    },
  });
}

// ─── Public API ───

export const consent = {

  /**
   * Grant a consent (set to true).
   * If already granted, logs a "renewed" action instead.
   */
  async grant(
    type: ConsentType,
    athleteId: string,
    proId: string,
    ctx: ConsentContext = {},
  ): Promise<{ ok: boolean; action: ConsentAction; log: ConsentLogEntry }> {
    const previous = await getCurrentValue(athleteId, type);
    const action: ConsentAction = previous === true ? "renewed" : "granted";

    // Update athlete record
    const fields = CONSENT_FIELDS[type];
    await (prisma as any).athlete.update({
      where: { id: athleteId },
      data: {
        [fields.field]: true,
        [fields.dateField]: new Date(),
      },
    });

    // Write immutable log
    const log = await writeLog(type, action, previous, true, athleteId, proId, ctx);

    console.log(
      `[Consent] ${type} ${action} for athlete=${athleteId} by pro=${proId} (method=${ctx.method || "digital"})`,
    );

    return { ok: true, action, log };
  },

  /**
   * Revoke a consent (set to false).
   */
  async revoke(
    type: ConsentType,
    athleteId: string,
    proId: string,
    ctx: ConsentContext = {},
  ): Promise<{ ok: boolean; log: ConsentLogEntry }> {
    const previous = await getCurrentValue(athleteId, type);

    // Update athlete record
    const fields = CONSENT_FIELDS[type];
    await (prisma as any).athlete.update({
      where: { id: athleteId },
      data: {
        [fields.field]: false,
        [fields.dateField]: null,
      },
    });

    // Write immutable log
    const log = await writeLog(type, "revoked", previous, false, athleteId, proId, ctx);

    console.log(
      `[Consent] ${type} revoked for athlete=${athleteId} by pro=${proId}`,
    );

    return { ok: true, log };
  },

  /**
   * Get full consent history for an athlete (all types).
   * Returns entries in reverse chronological order.
   */
  async getHistory(
    athleteId: string,
    options: { type?: ConsentType; limit?: number } = {},
  ): Promise<ConsentLogEntry[]> {
    const where: Record<string, unknown> = { athleteId };
    if (options.type) where.consentType = options.type;

    return (prisma as any).consentLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit || 100,
    });
  },

  /**
   * Get current consent status for an athlete (all consent types).
   */
  async getStatus(athleteId: string): Promise<{
    athleteId: string;
    general: { granted: boolean; since: Date | null };
    partage: { granted: boolean; since: Date | null };
    totalEvents: number;
    lastEvent: ConsentLogEntry | null;
  }> {
    const athlete = await (prisma as any).athlete.findUnique({
      where: { id: athleteId },
      select: {
        consentement: true,
        consentementDate: true,
        consentementPartage: true,
        consentementPartageDate: true,
      },
    });

    if (!athlete) {
      return {
        athleteId,
        general: { granted: false, since: null },
        partage: { granted: false, since: null },
        totalEvents: 0,
        lastEvent: null,
      };
    }

    const [totalEvents, lastEvent] = await Promise.all([
      (prisma as any).consentLog.count({ where: { athleteId } }),
      (prisma as any).consentLog.findFirst({
        where: { athleteId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      athleteId,
      general: {
        granted: athlete.consentement ?? false,
        since: athlete.consentementDate ?? null,
      },
      partage: {
        granted: athlete.consentementPartage ?? false,
        since: athlete.consentementPartageDate ?? null,
      },
      totalEvents,
      lastEvent,
    };
  },

  /**
   * Get consent history for a specific professional (all athletes they manage).
   * Useful for auditing a professional's consent collection practices.
   */
  async getProHistory(
    proId: string,
    options: { limit?: number } = {},
  ): Promise<ConsentLogEntry[]> {
    return (prisma as any).consentLog.findMany({
      where: { actorProId: proId },
      orderBy: { createdAt: "desc" },
      take: options.limit || 100,
      include: {
        athlete: { select: { id: true, name: true } },
      },
    });
  },

  /**
   * Verify consent is currently valid for a specific purpose.
   * Returns structured result for use in API guards.
   */
  async verify(
    athleteId: string,
    requiredType: ConsentType,
  ): Promise<{
    valid: boolean;
    reason?: string;
    grantedAt?: Date;
    lastVerified: Date;
  }> {
    const fields = CONSENT_FIELDS[requiredType];
    const athlete = await (prisma as any).athlete.findUnique({
      where: { id: athleteId },
      select: {
        name: true,
        [fields.field]: true,
        [fields.dateField]: true,
      },
    });

    if (!athlete) {
      return { valid: false, reason: "Athlète introuvable.", lastVerified: new Date() };
    }

    const granted = athlete[fields.field] ?? false;
    if (!granted) {
      return {
        valid: false,
        reason: `Consentement "${requiredType}" non recueilli pour ${athlete.name}.`,
        lastVerified: new Date(),
      };
    }

    return {
      valid: true,
      grantedAt: athlete[fields.dateField] ?? undefined,
      lastVerified: new Date(),
    };
  },
};
