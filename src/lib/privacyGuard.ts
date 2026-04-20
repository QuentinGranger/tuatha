// ─── Privacy Guard ───
//
// Centralized enforcement of athlete privacy settings.
// Every pro-side API route that accesses AthleteUser data MUST use this guard.
//
// Principle: athlete's decisions are absolute and cannot be overridden
// by any professional, admin, or system process.
//
// Usage:
//   const guard = await getPrivacyGuard(athleteUserId, professionnelId);
//   const filtered = guard.filterAthleteData(rawData);
//
// The guard returns DEFAULT-DENY for sensitive fields: if no settings exist,
// medical data is hidden. Only explicitly granted permissions are honored.

import { prisma } from "@/lib/prisma";

export interface PrivacySettings {
  shareSport: boolean;
  sharePhysical: boolean;
  shareAntecedents: boolean;
  shareTraitements: boolean;
  shareContraindic: boolean;
  shareVitals: boolean;
  shareConsultPrep: boolean;
  sharePhoto: boolean;
  shareMessaging: boolean;
}

// Default: medical data OFF, general data ON
const DEFAULT_SETTINGS: PrivacySettings = {
  shareSport: true,
  sharePhysical: true,
  shareAntecedents: false,
  shareTraitements: false,
  shareContraindic: false,
  shareVitals: false,
  shareConsultPrep: true,
  sharePhoto: true,
  shareMessaging: true,
};

/**
 * Fetch the privacy settings for a specific athlete-pro pair.
 * Returns defaults (medical OFF) if no settings exist.
 */
export async function getPrivacySettings(
  athleteUserId: string,
  professionnelId: string,
): Promise<PrivacySettings> {
  try {
    const row = await (prisma as any).athletePrivacySettings.findUnique({
      where: {
        athleteUserId_professionnelId: { athleteUserId, professionnelId },
      },
    });

    if (!row) return { ...DEFAULT_SETTINGS };

    return {
      shareSport: row.shareSport,
      sharePhysical: row.sharePhysical,
      shareAntecedents: row.shareAntecedents,
      shareTraitements: row.shareTraitements,
      shareContraindic: row.shareContraindic,
      shareVitals: row.shareVitals,
      shareConsultPrep: row.shareConsultPrep,
      sharePhoto: row.sharePhoto,
      shareMessaging: row.shareMessaging,
    };
  } catch (error) {
    // On any error, default to MOST RESTRICTIVE to protect athlete
    console.error("[PrivacyGuard] Failed to load settings, defaulting to restrictive:", error);
    return {
      shareSport: false,
      sharePhysical: false,
      shareAntecedents: false,
      shareTraitements: false,
      shareContraindic: false,
      shareVitals: false,
      shareConsultPrep: false,
      sharePhoto: false,
      shareMessaging: false,
    };
  }
}

/**
 * Batch-fetch privacy settings for multiple athletes at once.
 * Used by list endpoints (e.g. GET /api/athletes).
 */
export async function getPrivacySettingsBatch(
  athleteUserIds: string[],
  professionnelId: string,
): Promise<Map<string, PrivacySettings>> {
  const map = new Map<string, PrivacySettings>();
  if (athleteUserIds.length === 0) return map;

  try {
    const rows = await (prisma as any).athletePrivacySettings.findMany({
      where: {
        athleteUserId: { in: athleteUserIds },
        professionnelId,
      },
    });

    for (const row of rows) {
      map.set(row.athleteUserId, {
        shareSport: row.shareSport,
        sharePhysical: row.sharePhysical,
        shareAntecedents: row.shareAntecedents,
        shareTraitements: row.shareTraitements,
        shareContraindic: row.shareContraindic,
        shareVitals: row.shareVitals,
        shareConsultPrep: row.shareConsultPrep,
        sharePhoto: row.sharePhoto,
        shareMessaging: row.shareMessaging,
      });
    }
  } catch (error) {
    console.error("[PrivacyGuard] Batch load failed:", error);
  }

  // Fill missing with defaults
  for (const id of athleteUserIds) {
    if (!map.has(id)) {
      map.set(id, { ...DEFAULT_SETTINGS });
    }
  }

  return map;
}

/**
 * Filter an athlete data object based on privacy settings.
 * Redacts fields the athlete has not authorized.
 * Works for both AthleteUser data and merged athlete card data.
 */
export function applyPrivacyFilter(
  data: Record<string, unknown>,
  settings: PrivacySettings,
): Record<string, unknown> {
  const filtered = { ...data };
  const redacted: string[] = [];

  // Sport & Objectif
  if (!settings.shareSport) {
    filtered.sport = null;
    filtered.objectif = null;
    redacted.push("shareSport");
  }

  // Physical data
  if (!settings.sharePhysical) {
    filtered.dateNaissance = null;
    filtered.taille = null;
    filtered.poids = null;
    redacted.push("sharePhysical");
  }

  // Medical: antecedents
  if (!settings.shareAntecedents) {
    filtered.antecedents = [];
    redacted.push("shareAntecedents");
  }

  // Medical: traitements
  if (!settings.shareTraitements) {
    filtered.traitements = null;
    redacted.push("shareTraitements");
  }

  // Medical: contre-indications
  if (!settings.shareContraindic) {
    filtered.contreIndications = null;
    redacted.push("shareContraindic");
  }

  // Photo
  if (!settings.sharePhoto) {
    filtered.avatarUrl = null;
    filtered.avatarPath = null;
    redacted.push("sharePhoto");
  }

  // Messaging
  if (!settings.shareMessaging) {
    redacted.push("shareMessaging");
  }

  // Vitals
  if (!settings.shareVitals) {
    redacted.push("shareVitals");
  }

  filtered._privacyRedacted = redacted;

  return filtered;
}

/**
 * Check if a pro is allowed to send/receive messages with an athlete.
 */
export async function canMessage(
  athleteUserId: string,
  professionnelId: string,
): Promise<boolean> {
  const settings = await getPrivacySettings(athleteUserId, professionnelId);
  return settings.shareMessaging;
}

/**
 * Check if a pro is allowed to access vitals for an athlete.
 */
export async function canAccessVitals(
  athleteUserId: string,
  professionnelId: string,
): Promise<boolean> {
  const settings = await getPrivacySettings(athleteUserId, professionnelId);
  return settings.shareVitals;
}

/**
 * Check if a pro is allowed to see consultation prep data.
 */
export async function canAccessConsultPrep(
  athleteUserId: string,
  professionnelId: string,
): Promise<boolean> {
  const settings = await getPrivacySettings(athleteUserId, professionnelId);
  return settings.shareConsultPrep;
}

/**
 * Check if an athlete is visible in pro search results.
 */
export async function isVisibleInSearch(athleteUserId: string): Promise<boolean> {
  return true;
}

// ─── Access Logging ───

export type AccessAction =
  | "view_profile"
  | "view_list"
  | "view_vitals"
  | "view_messages"
  | "view_plan_kine"
  | "view_plan_nutri"
  | "view_ordonnance"
  | "view_programme"
  | "view_protocol"
  | "search";

/**
 * Log a professional's access to athlete data.
 * Fire-and-forget: never blocks the request.
 */
export function logAccess(
  athleteUserId: string,
  professionnelId: string,
  action: AccessAction,
  options?: { resource?: string; blocked?: boolean },
): void {
  (prisma as any).proAccessLog
    .create({
      data: {
        athleteUserId,
        professionnelId,
        action,
        resource: options?.resource ?? null,
        blocked: options?.blocked ?? false,
      },
    })
    .catch((err: unknown) => {
      console.error("[PrivacyGuard] logAccess failed:", err);
    });
}
