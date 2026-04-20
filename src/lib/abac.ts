// ─── Attribute-Based Access Control (ABAC) ───
// Contextual rules: a pro can access athlete data only if:
//   1. Direct ownership (athlete.professionnelId === proId), OR
//   2. Active ProConnection (status=connecte, not expired) with matching scope
//
// Granular data scopes: each category has an action level (none/read/comment/write).
// Access is time-limited via expiresAt (default 30 days). Owner can renew.

import { prisma } from "@/lib/prisma";

// ─── Data Categories ───
// Each represents a distinct data domain with independent access levels.

export type DataCategory =
  | "entrainement"   // Programmes, sessions, plans kiné, plans nutri
  | "indicateurs"    // KPIs, exercise logs, measures
  | "constantes"     // Vitals (médecin vital entries)
  | "imagerie"       // Medical imaging, CRs, ordonnances, prescriptions
  | "documents"      // Shared documents (PDFs, uploads)
  | "blessures"      // Injury notes, antécédents, pathology
  | "nutrition"      // Nutri plans, meals, journal, objectives
  | "notes";         // Collab notes, clinical notes, athlete notes

export const ALL_DATA_CATEGORIES: DataCategory[] = [
  "entrainement", "indicateurs", "constantes", "imagerie",
  "documents", "blessures", "nutrition", "notes",
];

// ─── Action Levels (ordered by power) ───

export type ActionLevel = "none" | "read" | "comment" | "write";

const ACTION_LEVEL_ORDER: Record<ActionLevel, number> = {
  none: 0,
  read: 1,
  comment: 2,
  write: 3,
};

/** Check if `actual` level meets or exceeds `required` level */
export function meetsActionLevel(actual: ActionLevel, required: ActionLevel): boolean {
  return ACTION_LEVEL_ORDER[actual] >= ACTION_LEVEL_ORDER[required];
}

// ─── DataScopes type (stored as Json on ProConnection) ───

export type DataScopes = Partial<Record<DataCategory, ActionLevel>>;

/** Full-access scopes (owner sees everything) */
export const OWNER_SCOPES: Record<DataCategory, ActionLevel> = {
  entrainement: "write",
  indicateurs: "write",
  constantes: "write",
  imagerie: "write",
  documents: "write",
  blessures: "write",
  nutrition: "write",
  notes: "write",
};

/** Zero-access baseline (least privilege) — nothing open by default */
export const ZERO_SCOPES: Record<DataCategory, ActionLevel> = {
  entrainement: "none",
  indicateurs: "none",
  constantes: "none",
  imagerie: "none",
  documents: "none",
  blessures: "none",
  nutrition: "none",
  notes: "none",
};

/** Default scopes for a new shared connection — nothing open, must be granted explicitly */
export const DEFAULT_SHARED_SCOPES: Record<DataCategory, ActionLevel> = { ...ZERO_SCOPES };

// ─── Backward compatibility ───
// Resolves scopes from either dataScopes (new) or boolean fields (legacy)

export function resolveDataScopes(connection: Record<string, unknown>): Record<DataCategory, ActionLevel> {
  // New dataScopes field takes precedence
  if (connection.dataScopes && typeof connection.dataScopes === "object") {
    const ds = connection.dataScopes as DataScopes;
    const resolved = { ...ZERO_SCOPES };
    for (const cat of ALL_DATA_CATEGORIES) {
      if (ds[cat]) resolved[cat] = ds[cat]!;
    }
    return resolved;
  }

  // Legacy boolean fallback
  return {
    entrainement: connection.readProgramme ? (connection.writeProgramme ? "write" : "read") : "none",
    indicateurs: connection.readIndicateurs ? "read" : "none",
    constantes: "none",
    imagerie: "none",
    documents: connection.readDocuments ? "read" : "none",
    blessures: connection.readBlessures ? "read" : "none",
    nutrition: "none",
    notes: connection.writeNote ? "comment" : "none",
  };
}

// ─── Legacy Access Scopes (kept for backward compat with existing code) ───

export type AccessScope =
  | "readProgramme"
  | "readIndicateurs"
  | "readBlessures"
  | "readDocuments"
  | "writeNote"
  | "writeProgramme"
  | "writeValidation";

export const DEFAULT_ACCESS_DURATION_DAYS = 30;

// ─── Access Result ───

export interface AccessResult {
  granted: boolean;
  reason?: string;
  accessType?: "owner" | "connection";
  connection?: Record<string, unknown>;
  dataScopes?: Record<DataCategory, ActionLevel>;  // Resolved scopes for this connection
  expired?: boolean;
}

// ─── Core Check ───

export interface DataScopeRequirement {
  category: DataCategory;
  level: ActionLevel;
}

/**
 * Check if a professional has access to an athlete's data.
 *
 * @param proId - The professional's ID
 * @param athleteId - The athlete's ID
 * @param requirements - Optional data scope requirements to check
 * @param legacyScopes - Legacy boolean scope names (backward compat)
 */
export async function checkAthleteAccess(
  proId: string,
  athleteId: string,
  requirements: DataScopeRequirement[] = [],
  legacyScopes: AccessScope[] = []
): Promise<AccessResult> {
  // 1. Direct ownership — full access, no expiration
  const athlete = await prisma.athlete.findFirst({
    where: { id: athleteId, professionnelId: proId },
    select: { id: true },
  });

  if (athlete) {
    return { granted: true, accessType: "owner", dataScopes: OWNER_SCOPES };
  }

  // 1b. Connected AthleteUser via accepted ConnectionRequest — treated as owner
  const connectedAthleteUser = await (prisma as any).connectionRequest.findFirst({
    where: { athleteUserId: athleteId, professionnelId: proId, status: "accepted" },
    select: { id: true },
  });
  if (connectedAthleteUser) {
    return { granted: true, accessType: "owner", dataScopes: OWNER_SCOPES };
  }

  // 2. Shared access via ProConnection
  const connection = await (prisma as any).proConnection.findFirst({
    where: {
      athleteId,
      connectedProId: proId,
      status: "connecte",
    },
  });

  if (!connection) {
    return {
      granted: false,
      reason: "Aucun accès à cet athlète. Demandez une invitation au professionnel référent.",
    };
  }

  // 3. Check expiration
  if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
    return {
      granted: false,
      reason: "Votre accès à cet athlète a expiré. Demandez un renouvellement.",
      accessType: "connection",
      connection,
      expired: true,
    };
  }

  // 4. Resolve data scopes
  const scopes = resolveDataScopes(connection);

  // 5. Check granular requirements
  for (const req of requirements) {
    const actual = scopes[req.category];
    if (!meetsActionLevel(actual, req.level)) {
      return {
        granted: false,
        reason: `Accès insuffisant pour "${categoryLabel(req.category)}" (requis: ${levelLabel(req.level)}, actuel: ${levelLabel(actual)}).`,
        accessType: "connection",
        connection,
        dataScopes: scopes,
      };
    }
  }

  // 6. Legacy boolean check (backward compat)
  for (const scope of legacyScopes) {
    if (!connection[scope]) {
      return {
        granted: false,
        reason: `Vous n'avez pas la permission "${legacyScopeLabel(scope)}" pour cet athlète.`,
        accessType: "connection",
        connection,
        dataScopes: scopes,
      };
    }
  }

  return {
    granted: true,
    accessType: "connection",
    connection,
    dataScopes: scopes,
  };
}

// ─── Convenience: check a single data scope ───

export function checkDataScope(
  result: AccessResult,
  category: DataCategory,
  requiredLevel: ActionLevel = "read"
): boolean {
  if (!result.granted) return false;
  if (result.accessType === "owner") return true;
  const scopes = result.dataScopes;
  if (!scopes) return false;
  return meetsActionLevel(scopes[category], requiredLevel);
}

// ─── Renewal ───

export async function renewConnection(
  connectionId: string,
  ownerProId: string,
  durationDays: number = DEFAULT_ACCESS_DURATION_DAYS
): Promise<{ success: boolean; error?: string; expiresAt?: Date }> {
  const connection = await (prisma as any).proConnection.findFirst({
    where: { id: connectionId, ownerProId, status: "connecte" },
  });

  if (!connection) {
    return { success: false, error: "Connexion introuvable ou vous n'êtes pas le propriétaire." };
  }

  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + durationDays);

  await (prisma as any).proConnection.update({
    where: { id: connectionId },
    data: {
      expiresAt: newExpiresAt,
      renewedAt: new Date(),
    },
  });

  return { success: true, expiresAt: newExpiresAt };
}

// ─── Update data scopes on a connection ───

export async function updateConnectionDataScopes(
  connectionId: string,
  ownerProId: string,
  dataScopes: DataScopes
): Promise<{ success: boolean; error?: string }> {
  const connection = await (prisma as any).proConnection.findFirst({
    where: { id: connectionId, ownerProId, status: "connecte" },
  });

  if (!connection) {
    return { success: false, error: "Connexion introuvable ou vous n'êtes pas le propriétaire." };
  }

  // Validate all values
  for (const [cat, level] of Object.entries(dataScopes)) {
    if (!ALL_DATA_CATEGORIES.includes(cat as DataCategory)) {
      return { success: false, error: `Catégorie inconnue: ${cat}` };
    }
    if (!["none", "read", "comment", "write"].includes(level as string)) {
      return { success: false, error: `Niveau d'accès invalide: ${level}` };
    }
  }

  // Merge with existing scopes
  const existing = (connection.dataScopes as DataScopes) || {};
  const merged = { ...existing, ...dataScopes };

  await (prisma as any).proConnection.update({
    where: { id: connectionId },
    data: { dataScopes: merged },
  });

  return { success: true };
}

// ─── Set initial expiration on connection creation ───

export function getDefaultExpiresAt(durationDays: number = DEFAULT_ACCESS_DURATION_DAYS): Date {
  const d = new Date();
  d.setDate(d.getDate() + durationDays);
  return d;
}

// ─── Labels ───

function categoryLabel(cat: DataCategory): string {
  const labels: Record<DataCategory, string> = {
    entrainement: "Entraînement / Programmes",
    indicateurs: "Indicateurs / KPI",
    constantes: "Constantes / Vitaux",
    imagerie: "Imagerie / CR médicaux",
    documents: "Documents partagés",
    blessures: "Blessures / Pathologies",
    nutrition: "Nutrition",
    notes: "Notes",
  };
  return labels[cat] || cat;
}

function levelLabel(level: ActionLevel): string {
  const labels: Record<ActionLevel, string> = {
    none: "Aucun accès",
    read: "Lecture seule",
    comment: "Commenter",
    write: "Édition",
  };
  return labels[level] || level;
}

function legacyScopeLabel(scope: AccessScope): string {
  const labels: Record<AccessScope, string> = {
    readProgramme: "Lire les programmes",
    readIndicateurs: "Lire les indicateurs",
    readBlessures: "Lire les blessures",
    readDocuments: "Lire les documents",
    writeNote: "Écrire des notes",
    writeProgramme: "Modifier les programmes",
    writeValidation: "Valider",
  };
  return labels[scope] || scope;
}
