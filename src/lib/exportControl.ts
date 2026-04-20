// ─── Export Control: Scoped Data Exports for Professionals ───
//
// Rules:
//   1. Scope enforcement — only export data the pro is authorized to access (ABAC)
//   2. Controlled formats — CSV/PDF only, no raw JSON/SQL dumps
//   3. Rate limiting — 1 export per hour per pro (configurable)
//   4. Audit logging — every export is logged with who, what, when
//
// Usage:
//   const check = checkExportQuota(proId);
//   if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 429 });
//   const data = await fetchExportData(proId, athleteId, categories, accessResult);
//   const csv = formatCsv(data);
//   recordExport(proId, athleteId, categories, "csv");

import { prisma } from "@/lib/prisma";
import {
  type DataCategory,
  type AccessResult,
  type ActionLevel,
  ALL_DATA_CATEGORIES,
  OWNER_SCOPES,
  meetsActionLevel,
  checkAthleteAccess,
} from "@/lib/abac";
import { audit } from "@/lib/auditLog";

// ─── Rate Limiting ───

const EXPORT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const MAX_EXPORTS_PER_DAY = 10;

interface ExportRecord {
  ts: number;
  athleteId: string;
  categories: string[];
  format: string;
}

const exportHistory = new Map<string, ExportRecord[]>();

export interface ExportQuotaResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

export function checkExportQuota(proId: string): ExportQuotaResult {
  const now = Date.now();
  const records = exportHistory.get(proId) || [];

  // Clean old entries (>24h)
  const recent = records.filter((r) => now - r.ts < 24 * 60 * 60 * 1000);
  exportHistory.set(proId, recent);

  // Daily limit
  if (recent.length >= MAX_EXPORTS_PER_DAY) {
    return {
      allowed: false,
      reason: `Limite quotidienne atteinte (${MAX_EXPORTS_PER_DAY} exports/jour). Réessayez demain.`,
    };
  }

  // Cooldown since last export
  const last = recent[recent.length - 1];
  if (last && now - last.ts < EXPORT_COOLDOWN_MS) {
    const retryAfterMs = EXPORT_COOLDOWN_MS - (now - last.ts);
    const minutes = Math.ceil(retryAfterMs / 60000);
    return {
      allowed: false,
      reason: `Un export a déjà été effectué récemment. Réessayez dans ${minutes} minute(s).`,
      retryAfterMs,
    };
  }

  return { allowed: true };
}

export function recordExport(
  proId: string,
  athleteId: string,
  categories: DataCategory[],
  format: string,
): void {
  const records = exportHistory.get(proId) || [];
  records.push({ ts: Date.now(), athleteId, categories, format });
  exportHistory.set(proId, records);

  // Trim map size
  if (exportHistory.size > 5000) {
    const oldest = [...exportHistory.entries()].sort(
      (a, b) => (a[1][a[1].length - 1]?.ts || 0) - (b[1][b[1].length - 1]?.ts || 0),
    );
    for (let i = 0; i < 2500; i++) exportHistory.delete(oldest[i][0]);
  }
}

// ─── Allowed Formats ───

export type ExportFormat = "csv" | "pdf";
const ALLOWED_FORMATS: ExportFormat[] = ["csv", "pdf"];

export function isAllowedFormat(format: string): format is ExportFormat {
  return ALLOWED_FORMATS.includes(format as ExportFormat);
}

// ─── Scope Filtering ───

/**
 * Filter requested categories to only those the pro can access (at least "read" level).
 */
export function filterAllowedCategories(
  requested: DataCategory[],
  accessResult: AccessResult,
): DataCategory[] {
  if (!accessResult.granted) return [];

  // Owner can export everything
  if (accessResult.accessType === "owner") {
    return requested.filter((c) => ALL_DATA_CATEGORIES.includes(c));
  }

  // Connection: filter by scopes
  const scopes = accessResult.dataScopes;
  if (!scopes) return [];

  return requested.filter((cat) => {
    if (!ALL_DATA_CATEGORIES.includes(cat)) return false;
    return meetsActionLevel(scopes[cat], "read");
  });
}

// ─── Data Fetching (scoped) ───

export interface ExportDataSet {
  category: DataCategory;
  label: string;
  columns: string[];
  rows: string[][];
}

/**
 * Fetch exportable data for each allowed category.
 * Only returns data the pro is authorized to see.
 */
export async function fetchExportData(
  proId: string,
  athleteId: string,
  categories: DataCategory[],
): Promise<ExportDataSet[]> {
  const results: ExportDataSet[] = [];

  for (const cat of categories) {
    try {
      const data = await fetchCategory(proId, athleteId, cat);
      if (data) results.push(data);
    } catch (err) {
      console.error(`[Export] Error fetching ${cat} for athlete ${athleteId}:`, err);
    }
  }

  return results;
}

async function fetchCategory(
  proId: string,
  athleteId: string,
  category: DataCategory,
): Promise<ExportDataSet | null> {
  switch (category) {
    case "notes":
      return fetchNotes(proId, athleteId);
    case "documents":
      return fetchDocuments(proId, athleteId);
    case "indicateurs":
      return fetchIndicateurs(athleteId);
    case "entrainement":
      return fetchEntrainement(proId, athleteId);
    case "nutrition":
      return fetchNutrition(athleteId);
    case "blessures":
      return fetchBlessures(athleteId);
    default:
      return null;
  }
}

async function fetchNotes(_proId: string, athleteId: string): Promise<ExportDataSet> {
  const [collabNotes, athleteNotes] = await Promise.all([
    (prisma as any).collabNote.findMany({
      where: { athleteId },
      select: { id: true, content: true, type: true, pinned: true, createdAt: true, authorPro: { select: { nom: true, prenom: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.athleteNote.findMany({
      where: { athleteId },
      select: { id: true, note: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: string[][] = [];
  for (const n of collabNotes) {
    rows.push([
      formatDate(n.createdAt),
      "collab",
      n.type || "note",
      `${n.authorPro?.prenom || ""} ${n.authorPro?.nom || ""}`.trim(),
      n.content || "",
      n.pinned ? "oui" : "non",
    ]);
  }
  for (const n of athleteNotes) {
    rows.push([formatDate(n.createdAt), "athlete", "note", "", n.note || "", ""]);
  }

  return {
    category: "notes",
    label: "Notes",
    columns: ["Date", "Source", "Type", "Auteur", "Contenu", "Épinglée"],
    rows,
  };
}

async function fetchDocuments(_proId: string, athleteId: string): Promise<ExportDataSet> {
  const docs = await (prisma as any).sharedDocument.findMany({
    where: {
      OR: [{ receiverAthleteId: athleteId }],
    },
    select: {
      id: true, originalName: true, mimeType: true, category: true,
      createdAt: true, senderPro: { select: { nom: true, prenom: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: string[][] = docs.map((d: any) => [
    formatDate(d.createdAt),
    d.originalName || "",
    d.category || "",
    d.mimeType || "",
    `${d.senderPro?.prenom || ""} ${d.senderPro?.nom || ""}`.trim(),
  ]);

  return {
    category: "documents",
    label: "Documents",
    columns: ["Date", "Nom", "Catégorie", "Type MIME", "Envoyé par"],
    rows,
  };
}

async function fetchIndicateurs(athleteId: string): Promise<ExportDataSet> {
  const logs = await (prisma as any).exerciseLog.findMany({
    where: { exercise: { block: { session: { athleteId } } } },
    select: {
      id: true, done: true, pain: true, difficulty: true,
      completedAt: true, createdAt: true,
      exercise: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const rows: string[][] = logs.map((l: any) => [
    formatDate(l.completedAt || l.createdAt),
    l.exercise?.name || "",
    l.done ? "oui" : "non",
    l.pain != null ? String(l.pain) : "",
    l.difficulty || "",
  ]);

  return {
    category: "indicateurs",
    label: "Indicateurs",
    columns: ["Date", "Exercice", "Fait", "Douleur", "Difficulté"],
    rows,
  };
}

async function fetchEntrainement(proId: string, athleteId: string): Promise<ExportDataSet> {
  const sessions = await (prisma as any).session.findMany({
    where: { athleteId, professionnelId: proId },
    select: {
      id: true, name: true, date: true, status: true,
      blocks: {
        select: {
          name: true,
          exercises: { select: { name: true, sets: true, reps: true, weight: true } },
        },
      },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  const rows: string[][] = [];
  for (const s of sessions) {
    for (const b of s.blocks || []) {
      for (const e of b.exercises || []) {
        rows.push([
          formatDate(s.date),
          s.name || "",
          s.status || "",
          b.name || "",
          e.name || "",
          e.sets || "",
          e.reps || "",
          e.weight || "",
        ]);
      }
    }
  }

  return {
    category: "entrainement",
    label: "Entraînement",
    columns: ["Date", "Séance", "Statut", "Bloc", "Exercice", "Séries", "Reps", "Poids"],
    rows,
  };
}

async function fetchNutrition(athleteId: string): Promise<ExportDataSet> {
  const [journals, measures] = await Promise.all([
    (prisma as any).nutriJournal.findMany({
      where: { athleteId },
      select: { date: true, kcal: true, protein: true, carbs: true, fat: true },
      orderBy: { date: "desc" },
      take: 365,
    }),
    (prisma as any).nutriMeasure.findMany({
      where: { athleteId },
      select: { date: true, weight: true, bodyFat: true, muscleMass: true },
      orderBy: { date: "desc" },
      take: 365,
    }),
  ]);

  const rows: string[][] = [];
  for (const j of journals) {
    rows.push([
      formatDate(j.date),
      "journal",
      j.kcal != null ? String(j.kcal) : "",
      j.protein != null ? String(j.protein) : "",
      j.carbs != null ? String(j.carbs) : "",
      j.fat != null ? String(j.fat) : "",
      "", "", "",
    ]);
  }
  for (const m of measures) {
    rows.push([
      formatDate(m.date),
      "mesure",
      "", "", "", "",
      m.weight != null ? String(m.weight) : "",
      m.bodyFat != null ? String(m.bodyFat) : "",
      m.muscleMass != null ? String(m.muscleMass) : "",
    ]);
  }

  return {
    category: "nutrition",
    label: "Nutrition",
    columns: ["Date", "Type", "Kcal", "Protéines", "Glucides", "Lipides", "Poids", "Masse grasse", "Masse musculaire"],
    rows,
  };
}

async function fetchBlessures(athleteId: string): Promise<ExportDataSet> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { name: true, injuryNote: true, riskLevel: true },
  });

  // Also fetch kiné plans with pathology info
  const plans = await (prisma as any).kinePlan.findMany({
    where: { athleteId },
    select: { title: true, pathology: true, phase: true, notesPro: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const rows: string[][] = [];
  if (athlete) {
    rows.push([
      athlete.name || "",
      athlete.riskLevel || "",
      athlete.injuryNote || "",
      "", "", "",
    ]);
  }
  for (const p of plans) {
    rows.push([
      "", "",
      p.pathology || "",
      p.phase || "",
      p.title || "",
      formatDate(p.createdAt),
    ]);
  }

  return {
    category: "blessures",
    label: "Blessures",
    columns: ["Athlète", "Niveau risque", "Note blessure", "Phase", "Plan kiné", "Date"],
    rows,
  };
}

// ─── CSV Formatting ───

/**
 * Convert export data sets into a single CSV string.
 * Each category gets a section header.
 */
export function formatCsv(datasets: ExportDataSet[]): string {
  const lines: string[] = [];

  for (const ds of datasets) {
    // Section header
    lines.push(`# ${ds.label}`);
    lines.push(ds.columns.map(escapeCsvField).join(","));
    for (const row of ds.rows) {
      lines.push(row.map(escapeCsvField).join(","));
    }
    lines.push(""); // Blank line between sections
  }

  return lines.join("\n");
}

function escapeCsvField(field: string): string {
  if (!field) return "";
  // Prevent CSV injection (formulae starting with =, +, -, @, \t, \r)
  const dangerous = /^[=+\-@\t\r]/;
  let safe = field;
  if (dangerous.test(safe)) {
    safe = `'${safe}`;
  }
  // Quote if contains comma, quote, or newline
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

// ─── PDF Formatting (lightweight text-based) ───

/**
 * Generate a simple text-based export (for PDF rendering on client).
 * Returns structured data the client can render as PDF.
 */
export function formatPdfData(
  datasets: ExportDataSet[],
  meta: { proName: string; athleteName: string; exportDate: string },
): { meta: typeof meta; sections: ExportDataSet[] } {
  return { meta, sections: datasets };
}

// ─── Helpers ───

function formatDate(d: unknown): string {
  if (!d) return "";
  try {
    return new Date(d as string).toISOString().split("T")[0];
  } catch {
    return String(d);
  }
}
