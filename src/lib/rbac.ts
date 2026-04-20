// ─── Role-Based Access Control (RBAC) ───
import { getRbacRole } from "@/lib/specialites";

// Internal RBAC roles (map to dashboard/API structure)
export type Role = "coach" | "kine" | "medecin" | "nutri";

/** Resolve any specialite value (new or legacy) to an internal RBAC Role */
export function resolveRole(specialite: string): Role {
  return getRbacRole(specialite) as Role;
}
export type Action = "read" | "write" | "export" | "invite" | "delete";

export type Resource =
  // Shared resources (all roles)
  | "athletes"
  | "events"
  | "sessions"
  | "facturation"
  | "documents"
  | "kanban"
  | "messagerie"
  | "notifications"
  | "profil"
  | "invitation"
  | "indicateurs"
  | "athlete-videos"
  | "reseau"
  | "cabinet"
  // Kiné-specific
  | "kine:plans"
  | "kine:alerts"
  | "kine:alert-rules"
  | "kine:videos"
  // Médecin-specific
  | "medecin:prescriptions"
  | "medecin:ordonnances"
  | "medecin:protocols"
  | "medecin:notes"
  | "medecin:vitals"
  | "medecin:alerts"
  | "medecin:plans"
  // Nutri-specific
  | "nutri:plans"
  | "nutri:meals"
  | "nutri:food-items"
  | "nutri:journal"
  | "nutri:measures"
  | "nutri:notes"
  | "nutri:objectives"
  | "nutri:alerts"
  | "nutri:alternatives"
  | "nutri:rules"
  | "nutri:templates";

// ─── Permissions matrix ───
// Each role maps to a set of resources, each with allowed actions.

const ALL_ACTIONS: Action[] = ["read", "write", "export", "invite", "delete"];
const READ_WRITE: Action[] = ["read", "write"];
const READ_ONLY: Action[] = ["read"];

const SHARED_PERMISSIONS: Record<string, Action[]> = {
  athletes: ALL_ACTIONS,
  events: ALL_ACTIONS,
  sessions: ALL_ACTIONS,
  facturation: ALL_ACTIONS,
  documents: ALL_ACTIONS,
  kanban: ALL_ACTIONS,
  messagerie: ["read", "write"],
  notifications: READ_ONLY,
  profil: ["read", "write", "delete"],
  invitation: ["read", "write", "delete"],
  indicateurs: READ_ONLY,
  "athlete-videos": READ_WRITE,
  reseau: ALL_ACTIONS,
  cabinet: ALL_ACTIONS,
};

const PERMISSIONS: Record<Role, Record<string, Action[]>> = {
  coach: {
    ...SHARED_PERMISSIONS,
  },
  kine: {
    ...SHARED_PERMISSIONS,
    "kine:plans": ALL_ACTIONS,
    "kine:alerts": ALL_ACTIONS,
    "kine:alert-rules": ALL_ACTIONS,
    "kine:videos": READ_WRITE,
  },
  medecin: {
    ...SHARED_PERMISSIONS,
    "medecin:prescriptions": ALL_ACTIONS,
    "medecin:ordonnances": ALL_ACTIONS,
    "medecin:protocols": ALL_ACTIONS,
    "medecin:notes": ALL_ACTIONS,
    "medecin:vitals": READ_WRITE,
    "medecin:alerts": ALL_ACTIONS,
    "medecin:plans": ALL_ACTIONS,
  },
  nutri: {
    ...SHARED_PERMISSIONS,
    "nutri:plans": ALL_ACTIONS,
    "nutri:meals": ALL_ACTIONS,
    "nutri:food-items": ALL_ACTIONS,
    "nutri:journal": READ_WRITE,
    "nutri:measures": ALL_ACTIONS,
    "nutri:notes": ALL_ACTIONS,
    "nutri:objectives": ALL_ACTIONS,
    "nutri:alerts": ALL_ACTIONS,
    "nutri:alternatives": ALL_ACTIONS,
    "nutri:rules": ALL_ACTIONS,
    "nutri:templates": ALL_ACTIONS,
  },
};

// ─── Public API ───

export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  const rolePerms = PERMISSIONS[role];
  if (!rolePerms) return false;
  const actions = rolePerms[resource];
  if (!actions) return false;
  return actions.includes(action);
}

export function getAllPermissions(role: Role): Record<string, Action[]> {
  return PERMISSIONS[role] || {};
}

export function isValidRole(value: string): boolean {
  // Accept both internal RBAC roles and new specialite values
  return ["coach", "kine", "medecin", "nutri", "dieteticien", "autre"].includes(value);
}

// ─── Route → Resource mapping ───
// Maps API path prefixes to resources for automatic permission checking.

const ROUTE_RESOURCE_MAP: [RegExp, Resource][] = [
  [/^\/api\/kine\/alert-rules/, "kine:alert-rules"],
  [/^\/api\/kine\/alerts/, "kine:alerts"],
  [/^\/api\/kine\/plans/, "kine:plans"],
  [/^\/api\/kine\/videos/, "kine:videos"],
  [/^\/api\/medecin\/prescriptions/, "medecin:prescriptions"],
  [/^\/api\/medecin\/ordonnances/, "medecin:ordonnances"],
  [/^\/api\/medecin\/protocols/, "medecin:protocols"],
  [/^\/api\/medecin\/notes/, "medecin:notes"],
  [/^\/api\/medecin\/vitals/, "medecin:vitals"],
  [/^\/api\/medecin\/alerts/, "medecin:alerts"],
  [/^\/api\/medecin\/plans/, "medecin:plans"],
  [/^\/api\/nutri\/plans/, "nutri:plans"],
  [/^\/api\/nutri\/meals/, "nutri:meals"],
  [/^\/api\/nutri\/food-items/, "nutri:food-items"],
  [/^\/api\/nutri\/journal/, "nutri:journal"],
  [/^\/api\/nutri\/measures/, "nutri:measures"],
  [/^\/api\/nutri\/notes/, "nutri:notes"],
  [/^\/api\/nutri\/objectives/, "nutri:objectives"],
  [/^\/api\/nutri\/alerts/, "nutri:alerts"],
  [/^\/api\/nutri\/alternatives/, "nutri:alternatives"],
  [/^\/api\/nutri\/rules/, "nutri:rules"],
  [/^\/api\/nutri\/templates/, "nutri:templates"],
  [/^\/api\/programmes/, "sessions"],
  [/^\/api\/athletes/, "athletes"],
  [/^\/api\/athlete-videos/, "athlete-videos"],
  [/^\/api\/events/, "events"],
  [/^\/api\/facturation/, "facturation"],
  [/^\/api\/documents/, "documents"],
  [/^\/api\/kanban/, "kanban"],
  [/^\/api\/messagerie/, "messagerie"],
  [/^\/api\/notifications/, "notifications"],
  [/^\/api\/profil/, "profil"],
  [/^\/api\/invitation/, "invitation"],
  [/^\/api\/reseau/, "reseau"],
  [/^\/api\/cabinet/, "cabinet"],
  [/^\/api\/indicateurs/, "indicateurs"],
];

export function getResourceFromPath(pathname: string): Resource | null {
  for (const [regex, resource] of ROUTE_RESOURCE_MAP) {
    if (regex.test(pathname)) return resource;
  }
  return null;
}

// Map HTTP method → default action
export function getActionFromMethod(method: string): Action {
  switch (method.toUpperCase()) {
    case "GET": return "read";
    case "POST": return "write";
    case "PUT": return "write";
    case "PATCH": return "write";
    case "DELETE": return "delete";
    default: return "read";
  }
}
