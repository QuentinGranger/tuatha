// ─── POST /api/exports — Scoped data export ───
//
// Body: { athleteId, categories: ["notes","documents",...], format: "csv"|"pdf" }
//
// Security:
//   1. Auth required (withAuth)
//   2. ABAC scope check per category (only export what pro is authorized to read)
//   3. Rate limited: 1 export/hour, 10/day
//   4. Controlled formats: CSV or PDF only
//   5. CSV injection protection
//   6. Full audit trail

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { checkAthleteAccess, type DataCategory, ALL_DATA_CATEGORIES } from "@/lib/abac";
import {
  checkExportQuota,
  recordExport,
  isAllowedFormat,
  filterAllowedCategories,
  fetchExportData,
  formatCsv,
  formatPdfData,
  type ExportFormat,
} from "@/lib/exportControl";
import { audit } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";
import { checkSharingConsent } from "@/lib/consentCheck";
import { getExportPolicy, buildDownloadHeaders, watermarkCsv, watermarkPdfData, auditDownload } from "@/lib/downloadControl";
import type { Role } from "@/lib/rbac";
import { securityMonitor } from "@/lib/securityMonitor";

export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;
    const body = await request.json();

    const { athleteId, categories, format } = body;

    // ─── Validate inputs ───

    if (!athleteId || typeof athleteId !== "string") {
      return NextResponse.json({ error: "athleteId requis." }, { status: 400 });
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { error: "Au moins une catégorie requise.", allowedCategories: ALL_DATA_CATEGORIES },
        { status: 400 },
      );
    }

    const requestedFormat: ExportFormat = format || "csv";
    if (!isAllowedFormat(requestedFormat)) {
      return NextResponse.json(
        { error: "Format non autorisé. Formats acceptés : csv, pdf." },
        { status: 400 },
      );
    }

    // ─── Consent check: athlete must have consented to data sharing ───

    const consent = await checkSharingConsent(athleteId);
    if (!consent.granted) {
      return NextResponse.json({ error: consent.reason, consentRequired: true }, { status: 403 });
    }

    // ─── Rate limit ───

    const quota = checkExportQuota(pro.id);
    if (!quota.allowed) {
      const response = NextResponse.json({ error: quota.reason }, { status: 429 });
      if (quota.retryAfterMs) {
        response.headers.set("Retry-After", String(Math.ceil(quota.retryAfterMs / 1000)));
      }
      return response;
    }

    // ─── ABAC: check access to this athlete ───

    const access = await checkAthleteAccess(pro.id, athleteId);
    if (!access.granted) {
      return NextResponse.json({ error: access.reason || "Accès refusé." }, { status: 403 });
    }

    // ─── Filter categories to only those the pro can read ───

    const requestedCategories = categories.filter(
      (c: string) => ALL_DATA_CATEGORIES.includes(c as DataCategory),
    ) as DataCategory[];

    const allowedCategories = filterAllowedCategories(requestedCategories, access);

    if (allowedCategories.length === 0) {
      const denied = requestedCategories.filter((c) => !allowedCategories.includes(c));
      return NextResponse.json(
        {
          error: "Aucune catégorie autorisée pour cet export.",
          deniedCategories: denied,
        },
        { status: 403 },
      );
    }

    // Log which categories were filtered out
    const denied = requestedCategories.filter((c) => !allowedCategories.includes(c));

    // ─── Fetch data (scoped to allowed categories) ───

    const datasets = await fetchExportData(pro.id, athleteId, allowedCategories);

    if (datasets.length === 0) {
      return NextResponse.json({ error: "Aucune donnée à exporter." }, { status: 404 });
    }

    // ─── Role-based export restrictions ───

    const proRecord = await (prisma as any).professionnel.findUnique({
      where: { id: pro.id },
      select: { nom: true, prenom: true, specialite: true },
    });
    const role = (proRecord?.specialite || "coach") as Role;
    const proName = proRecord ? `${proRecord.prenom} ${proRecord.nom}` : pro.id;
    const accessType = access.accessType || "connection";

    const exportPolicy = getExportPolicy(role, accessType, allowedCategories);
    if (!exportPolicy.canDownload) {
      return NextResponse.json(
        { error: exportPolicy.reason || "Export non autorisé pour votre rôle.", confidentiality: exportPolicy.confidentialityLevel },
        { status: 403 },
      );
    }

    const policyHeaders = buildDownloadHeaders(exportPolicy, pro.id, proName);

    // ─── Record export + audit ───

    recordExport(pro.id, athleteId, allowedCategories, requestedFormat);
    securityMonitor.trackExport(pro.id, athleteId, allowedCategories);

    // Persist security alert for pro notification
    const athleteName = await getAthleteName(athleteId);
    prisma.securityAlert.create({
      data: {
        type: "data_exported",
        message: `Export ${requestedFormat.toUpperCase()} effectué — ${allowedCategories.length} catégorie(s) pour ${athleteName}.`,
        professionnelId: pro.id,
      },
    }).catch(() => {});

    audit.logCreate("collabNote", `export_${Date.now()}`, pro.id, {
      type: "data_export",
      athleteId,
      format: requestedFormat,
      categories: allowedCategories,
      deniedCategories: denied.length > 0 ? denied : undefined,
      rowCount: datasets.reduce((sum, ds) => sum + ds.rows.length, 0),
    });

    auditDownload("export", pro.id, {
      athleteId,
      format: requestedFormat,
      confidentiality: exportPolicy.confidentialityLevel,
    });

    // ─── Format and return ───

    if (requestedFormat === "csv") {
      let csv = formatCsv(datasets);
      // Watermark CSV with confidentiality notice + pro identity
      if (exportPolicy.watermark) {
        csv = watermarkCsv(csv, proName, pro.id, exportPolicy.confidentialityLevel);
      }
      const filename = `export_${slugify(athleteName)}_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          ...policyHeaders,
        },
      });
    }

    if (requestedFormat === "pdf") {
      let pdfData: Record<string, unknown> = formatPdfData(datasets, {
        proName,
        athleteName,
        exportDate: new Date().toISOString(),
      });
      // Watermark PDF with confidentiality notice + pro identity
      if (exportPolicy.watermark) {
        pdfData = watermarkPdfData(pdfData, proName, pro.id, exportPolicy.confidentialityLevel);
      }

      return NextResponse.json(pdfData, {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          ...policyHeaders,
        },
      });
    }

    return NextResponse.json({ error: "Format non supporté." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/exports error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
});

// ─── Helpers ───

async function getAthleteName(athleteId: string): Promise<string> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { name: true },
  });
  return athlete?.name || "athlete";
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
