// ─── Download & Print Control ───
//
// Role-based restrictions on file downloads, prints, and exports:
//   1. Policy engine: which roles can download/print which document categories
//   2. Access type restrictions: owner vs connected pro (stricter for connections)
//   3. Confidentiality warnings injected into response headers
//   4. Watermark metadata for downloaded files (who, when, from where)
//   5. Print control headers for frontend enforcement
//
// Usage:
//   const policy = getDownloadPolicy(role, accessType, category);
//   if (!policy.canDownload) return NextResponse.json({ error: policy.reason }, { status: 403 });
//   const headers = buildDownloadHeaders(policy, proId, proName);
//   // apply headers to response

import { type Role } from "@/lib/rbac";
import { type DataCategory } from "@/lib/abac";
import { audit } from "@/lib/auditLog";

// ─── Types ───

export type AccessType = "owner" | "connection";

export interface DownloadPolicy {
  canDownload: boolean;
  canPrint: boolean;
  reason?: string;
  warning?: string;
  watermark: boolean;
  confidentialityLevel: "public" | "interne" | "confidentiel" | "medical";
}

// ─── Document Category → Confidentiality Level ───

const CATEGORY_CONFIDENTIALITY: Record<string, "public" | "interne" | "confidentiel" | "medical"> = {
  bilan: "confidentiel",
  ordonnance: "medical",
  imagerie: "medical",
  "compte-rendu": "medical",
  programme: "interne",
  administratif: "interne",
  autre: "interne",
};

// ─── Data Category → Confidentiality Level (for exports) ───

const DATA_CATEGORY_CONFIDENTIALITY: Record<DataCategory, "public" | "interne" | "confidentiel" | "medical"> = {
  entrainement: "interne",
  indicateurs: "interne",
  constantes: "medical",
  imagerie: "medical",
  documents: "confidentiel",
  blessures: "medical",
  nutrition: "confidentiel",
  notes: "confidentiel",
};

// ─── Policy Rules ───
//
// Owner: full access to everything
// Connected pro: restrictions based on role + document category

interface PolicyRule {
  canDownload: boolean;
  canPrint: boolean;
  warning?: string;
}

// Connected pro restrictions by role and confidentiality level
const CONNECTION_POLICIES: Record<Role, Record<string, PolicyRule>> = {
  coach: {
    public: { canDownload: true, canPrint: true },
    interne: { canDownload: true, canPrint: true, warning: "Document interne — usage professionnel uniquement." },
    confidentiel: { canDownload: true, canPrint: false, warning: "Document confidentiel — impression interdite. Téléchargement avec traçabilité." },
    medical: { canDownload: false, canPrint: false, warning: "Document médical — accès restreint aux professionnels de santé." },
  },
  kine: {
    public: { canDownload: true, canPrint: true },
    interne: { canDownload: true, canPrint: true },
    confidentiel: { canDownload: true, canPrint: true, warning: "Document confidentiel — ne pas diffuser sans autorisation." },
    medical: { canDownload: true, canPrint: false, warning: "Document médical — téléchargement autorisé, impression interdite hors cabinet." },
  },
  medecin: {
    public: { canDownload: true, canPrint: true },
    interne: { canDownload: true, canPrint: true },
    confidentiel: { canDownload: true, canPrint: true },
    medical: { canDownload: true, canPrint: true, warning: "Document médical — confidentialité patient à respecter." },
  },
  nutri: {
    public: { canDownload: true, canPrint: true },
    interne: { canDownload: true, canPrint: true },
    confidentiel: { canDownload: true, canPrint: false, warning: "Document confidentiel — impression interdite." },
    medical: { canDownload: false, canPrint: false, warning: "Document médical — accès restreint aux professionnels de santé." },
  },
};

// ─── Public API ───

/**
 * Get download/print policy for a document category.
 */
export function getDownloadPolicy(
  role: Role,
  accessType: AccessType,
  documentCategory: string,
): DownloadPolicy {
  const confidentiality = CATEGORY_CONFIDENTIALITY[documentCategory] || "interne";

  // Owner: full access, always watermarked for medical docs
  if (accessType === "owner") {
    return {
      canDownload: true,
      canPrint: true,
      watermark: confidentiality === "medical" || confidentiality === "confidentiel",
      confidentialityLevel: confidentiality,
      warning: confidentiality === "medical"
        ? "Document médical — confidentialité patient à respecter."
        : undefined,
    };
  }

  // Connected pro: apply role-based restrictions
  const rolePolicy = CONNECTION_POLICIES[role];
  if (!rolePolicy) {
    return {
      canDownload: false,
      canPrint: false,
      reason: "Rôle non reconnu.",
      watermark: true,
      confidentialityLevel: confidentiality,
    };
  }

  const rule = rolePolicy[confidentiality];
  if (!rule) {
    return {
      canDownload: false,
      canPrint: false,
      reason: "Politique de téléchargement non définie pour ce niveau de confidentialité.",
      watermark: true,
      confidentialityLevel: confidentiality,
    };
  }

  return {
    canDownload: rule.canDownload,
    canPrint: rule.canPrint,
    reason: rule.canDownload ? undefined : rule.warning || "Téléchargement non autorisé pour votre rôle.",
    warning: rule.warning,
    watermark: true, // Always watermark for connected pros
    confidentialityLevel: confidentiality,
  };
}

/**
 * Get download/print policy for an export (data category based).
 */
export function getExportPolicy(
  role: Role,
  accessType: AccessType,
  dataCategories: DataCategory[],
): DownloadPolicy {
  // Find the highest confidentiality level across all requested categories
  const levels = dataCategories.map((c) => DATA_CATEGORY_CONFIDENTIALITY[c] || "interne");
  const order = { public: 0, interne: 1, confidentiel: 2, medical: 3 };
  const maxLevel = levels.reduce(
    (max, l) => (order[l] > order[max] ? l : max),
    "public" as "public" | "interne" | "confidentiel" | "medical",
  );

  return getDownloadPolicy(role, accessType, getCategoryForConfidentiality(maxLevel));
}

function getCategoryForConfidentiality(level: string): string {
  // Map back to a document category for policy lookup
  const map: Record<string, string> = {
    public: "autre",
    interne: "programme",
    confidentiel: "bilan",
    medical: "ordonnance",
  };
  return map[level] || "autre";
}

// ─── Response Headers ───

/**
 * Build response headers that enforce download/print policy.
 * Frontend should read these headers to show/hide print buttons and warnings.
 */
export function buildDownloadHeaders(
  policy: DownloadPolicy,
  proId: string,
  proName: string,
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Confidentiality level
  headers["X-Confidentiality"] = policy.confidentialityLevel;

  // Print control (frontend reads this to disable print button)
  headers["X-Print-Allowed"] = policy.canPrint ? "true" : "false";

  // Warning message (frontend shows this as a banner)
  if (policy.warning) {
    headers["X-Download-Warning"] = encodeURIComponent(policy.warning);
  }

  // Watermark metadata (who downloaded, when)
  if (policy.watermark) {
    const watermark = JSON.stringify({
      downloadedBy: proId,
      downloadedByName: proName,
      downloadedAt: new Date().toISOString(),
      confidentiality: policy.confidentialityLevel,
    });
    headers["X-Watermark"] = encodeURIComponent(watermark);
  }

  // Prevent caching of sensitive documents
  if (policy.confidentialityLevel === "medical" || policy.confidentialityLevel === "confidentiel") {
    headers["Cache-Control"] = "private, no-store, no-cache, max-age=0, must-revalidate";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
  }

  return headers;
}

// ─── CSV Watermark ───

/**
 * Prepend a watermark/confidentiality notice to CSV export content.
 */
export function watermarkCsv(
  csv: string,
  proName: string,
  proId: string,
  confidentiality: string,
): string {
  const now = new Date().toISOString();
  const lines = [
    `# DOCUMENT CONFIDENTIEL`,
    `# Exporté par: ${proName} (${proId})`,
    `# Date: ${now}`,
    `# Niveau de confidentialité: ${confidentiality.toUpperCase()}`,
    `# Ce document contient des données personnelles protégées.`,
    `# Toute diffusion non autorisée est interdite et tracée.`,
    `#`,
    csv,
  ];
  return lines.join("\n");
}

// ─── PDF Watermark Metadata ───

/**
 * Add watermark metadata to PDF export data (for client-side rendering).
 */
export function watermarkPdfData(
  pdfData: Record<string, unknown>,
  proName: string,
  proId: string,
  confidentiality: string,
): Record<string, unknown> {
  return {
    ...pdfData,
    watermark: {
      text: `Confidentiel — ${proName} — ${new Date().toISOString().split("T")[0]}`,
      downloadedBy: proId,
      downloadedByName: proName,
      downloadedAt: new Date().toISOString(),
      confidentiality,
      notice: "Ce document contient des données personnelles protégées. Toute diffusion non autorisée est interdite.",
    },
  };
}

// ─── Audit ───

/**
 * Log a download/print event for audit trail.
 */
export function auditDownload(
  action: "download" | "print" | "export",
  proId: string,
  details: {
    documentId?: string;
    athleteId?: string;
    category?: string;
    format?: string;
    confidentiality: string;
    fileName?: string;
  },
): void {
  audit.logCreate("collabNote", `${action}_${Date.now()}`, proId, {
    type: `file_${action}`,
    ...details,
  });

  // Extra log for medical/confidential documents
  if (details.confidentiality === "medical" || details.confidentiality === "confidentiel") {
    console.warn(
      `[DOWNLOAD-AUDIT] ${action.toUpperCase()} ${details.confidentiality} doc by=${proId}`,
      `file=${details.fileName || details.documentId || "export"}`,
      `athlete=${details.athleteId || "unknown"}`,
    );
  }
}
