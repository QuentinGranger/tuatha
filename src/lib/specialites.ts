// ─── Catégories de professionnels — MVP ───
// Source unique de vérité pour les spécialités autorisées.
// Les dashboards existants (/dashboard/kine, /dashboard/medecin, /dashboard/nutri, /dashboard/coach)
// sont conservés ; ce fichier fait le mapping entre la valeur DB et le chemin dashboard / rôle RBAC.

export type Specialite = "medecin" | "kine" | "dieteticien" | "autre";

export interface SpecialiteInfo {
  value: Specialite;
  label: string;
  shortLabel: string;
  color: string;
  remboursable: boolean;
  remboursableLabel: string;
  verificationLabel: string;
  verificationPlaceholder: string;
  verificationHint: string;
  verificationPattern: RegExp;
  verificationExample: string;
  dashboardPath: string;
  rbacRole: string;
}

export const SPECIALITES: Record<Specialite, SpecialiteInfo> = {
  medecin: {
    value: "medecin",
    label: "Médecin",
    shortLabel: "Médecin",
    color: "#a855f7",
    remboursable: true,
    remboursableLabel: "Remboursable",
    verificationLabel: "Numéro RPPS *",
    verificationPlaceholder: "Ex : 10000668540",
    verificationHint: "11 chiffres — identifiant national RPPS",
    verificationPattern: /^\d{11}$/,
    verificationExample: "10000668540",
    dashboardPath: "/dashboard/medecin",
    rbacRole: "medecin",
  },
  kine: {
    value: "kine",
    label: "Kinésithérapeute",
    shortLabel: "Kiné",
    color: "#3b82f6",
    remboursable: true,
    remboursableLabel: "Remboursable",
    verificationLabel: "Numéro RPPS *",
    verificationPlaceholder: "Ex : 10000668540",
    verificationHint: "11 chiffres — identifiant national RPPS (anciennement ADELI, migré depuis oct. 2024)",
    verificationPattern: /^\d{11}$/,
    verificationExample: "10000668540",
    dashboardPath: "/dashboard/kine",
    rbacRole: "kine",
  },
  dieteticien: {
    value: "dieteticien",
    label: "Diététicien",
    shortLabel: "Diététicien",
    color: "#f59e0b",
    remboursable: true,
    remboursableLabel: "Remboursable sous conditions",
    verificationLabel: "Numéro RPPS *",
    verificationPlaceholder: "Ex : 10000668540",
    verificationHint: "11 chiffres — identifiant national RPPS (anciennement ADELI, migré depuis oct. 2024)",
    verificationPattern: /^\d{11}$/,
    verificationExample: "10000668540",
    dashboardPath: "/dashboard/nutri",
    rbacRole: "nutri",
  },
  autre: {
    value: "autre",
    label: "Autre professionnel (non remboursable)",
    shortLabel: "Autre pro",
    color: "#10b981",
    remboursable: false,
    remboursableLabel: "Non remboursable",
    verificationLabel: "Numéro de carte professionnelle ou SIRET *",
    verificationPlaceholder: "Ex : 01234ED0123 ou 12345678901234",
    verificationHint: "Carte d'éducateur sportif (5 chiffres + ED + 4 chiffres) ou SIRET (14 chiffres)",
    verificationPattern: /^(\d{5}ED\d{4}|\d{14})$/,
    verificationExample: "01234ED0123",
    dashboardPath: "/dashboard/coach",
    rbacRole: "coach",
  },
};

export const SPECIALITE_LIST: SpecialiteInfo[] = Object.values(SPECIALITES);

// ─── Mapping helpers ───

/** Resolve dashboard path from any specialite value (supports legacy "coach"/"nutri") */
export function getDashboardPath(specialite: string): string {
  const legacy: Record<string, string> = { coach: "/dashboard/coach", nutri: "/dashboard/nutri" };
  const info = SPECIALITES[specialite as Specialite];
  if (info) return info.dashboardPath;
  return legacy[specialite] || "/dashboard";
}

/** Resolve RBAC role from any specialite value (supports legacy) */
export function getRbacRole(specialite: string): string {
  const legacy: Record<string, string> = { coach: "coach", nutri: "nutri" };
  const info = SPECIALITES[specialite as Specialite];
  if (info) return info.rbacRole;
  return legacy[specialite] || specialite;
}

/** Get display label from any specialite value (supports legacy) */
export function getSpecialiteLabel(specialite: string): string {
  const legacy: Record<string, string> = { coach: "Autre professionnel", nutri: "Diététicien" };
  const info = SPECIALITES[specialite as Specialite];
  if (info) return info.label;
  return legacy[specialite] || specialite;
}

/** Get color from any specialite value (supports legacy) */
export function getSpecialiteColor(specialite: string): string {
  const legacy: Record<string, string> = { coach: "#10b981", nutri: "#f59e0b" };
  const info = SPECIALITES[specialite as Specialite];
  if (info) return info.color;
  return legacy[specialite] || "#6b7280";
}

/** Check if a specialite value is valid (new or legacy) */
export function isValidSpecialite(value: string): boolean {
  return value in SPECIALITES || value === "coach" || value === "nutri";
}
