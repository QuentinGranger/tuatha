// ─── Report User API ───
// POST /api/support/report — Allows athletes to report pros (or pros to report athletes)
// Creates a SupportTicket + SecurityAlert for admin review

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete, getSessionPro } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

// ─── Security: strict rate limit (2 reports per hour) ───
const REPORT_RATE = { windowMs: 3_600_000, maxRequests: 2 };

// ─── Security: UUID v4 format check ───
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REPORT_REASONS = [
  "inappropriate_behavior",
  "harassment",
  "fraud",
  "impersonation",
  "unprofessional_conduct",
  "privacy_violation",
  "spam",
  "other",
] as const;

const REASON_LABELS: Record<string, string> = {
  inappropriate_behavior: "Comportement inapproprié",
  harassment: "Harcèlement",
  fraud: "Fraude / arnaque",
  impersonation: "Usurpation d'identité",
  unprofessional_conduct: "Conduite non professionnelle",
  privacy_violation: "Violation de la vie privée",
  spam: "Spam / sollicitation abusive",
  other: "Autre",
};

export async function POST(request: NextRequest) {
  // ── Strict rate limit ──
  const limited = rateLimit(request, REPORT_RATE);
  if (limited) return limited;

  const athlete = await getSessionAthlete();
  const pro = !athlete ? await getSessionPro() : null;

  if (!athlete && !pro) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ua = request.headers.get("user-agent")?.slice(0, 500) || null;

  try {
    const body = await request.json();
    const { reportedUserId, reportedUserType, reason, description } = body;

    // ── Honeypot anti-bot ──
    if (body._hp_email) {
      console.warn(`[SECURITY] Honeypot triggered on /api/support/report from IP=${ip}`);
      return NextResponse.json({ success: true, message: "Signalement envoyé." });
    }

    // ── Validate reportedUserId is a valid UUID ──
    if (!reportedUserId || typeof reportedUserId !== "string" || !UUID_RE.test(reportedUserId)) {
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    }
    if (!reportedUserType || !["pro", "athlete"].includes(reportedUserType)) {
      return NextResponse.json({ error: "Type invalide." }, { status: 400 });
    }
    if (!reason || !REPORT_REASONS.includes(reason as any)) {
      return NextResponse.json({ error: "Raison invalide." }, { status: 400 });
    }

    const reporterType = athlete ? "athlete" : "pro";
    const reporterId = athlete?.id ?? pro?.id;

    // ── Prevent self-reporting ──
    if (reportedUserId === reporterId) {
      return NextResponse.json({ error: "Impossible de vous signaler vous-même." }, { status: 400 });
    }

    // ── Verify reported user exists ──
    if (reportedUserType === "pro") {
      const exists = await (prisma as any).professionnel.findUnique({ where: { id: reportedUserId }, select: { id: true } });
      if (!exists) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    } else {
      const exists = await (prisma as any).athleteUser.findUnique({ where: { id: reportedUserId }, select: { id: true } });
      if (!exists) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    // ── Anti-flood: prevent reporting the same user within 24h ──
    const dayAgo = new Date(Date.now() - 24 * 3_600_000);
    const duplicateWhere: any = {
      category: "security",
      createdByRole: "system",
      createdAt: { gte: dayAgo },
      description: { contains: `Signalé par: ${reporterId}` },
    };
    if (reportedUserType === "pro") duplicateWhere.professionnelId = reportedUserId;
    else duplicateWhere.athleteUserId = reportedUserId;

    const recentReport = await (prisma as any).supportTicket.findFirst({ where: duplicateWhere, select: { id: true } });
    if (recentReport) {
      return NextResponse.json(
        { error: "Vous avez déjà signalé cet utilisateur récemment. Notre équipe traite votre signalement." },
        { status: 429 },
      );
    }

    // ── Sanitize description (centralized XSS protection) ──
    let cleanDesc = "";
    if (description) {
      const descResult = sanitizeText(String(description), { maxLength: 1000, context: "description" });
      cleanDesc = descResult.ok ? descResult.text : "";
    }

    const reasonLabel = REASON_LABELS[reason] ?? reason;
    const priority = ["harassment", "fraud", "impersonation"].includes(reason) ? "high" : "normal";

    // ── Create SupportTicket ──
    await (prisma as any).supportTicket.create({
      data: {
        subject: `Signalement utilisateur : ${reasonLabel}`,
        description: `Un ${reporterType === "athlete" ? "athlète" : "professionnel"} a signalé un ${reportedUserType === "pro" ? "professionnel" : "athlète"} pour : ${reasonLabel}.${cleanDesc ? `\n\nDétails : ${cleanDesc}` : ""}\n\nSignalé par: ${reporterId}\nUtilisateur signalé: ${reportedUserId} (${reportedUserType})\nIP: ${ip}`,
        category: "security",
        priority,
        status: "open",
        createdByRole: "system",
        athleteUserId: reportedUserType === "athlete" ? reportedUserId : (athlete?.id ?? null),
        professionnelId: reportedUserType === "pro" ? reportedUserId : (pro?.id ?? null),
      },
    });

    // ── Create SecurityAlert (only if reported user is a pro, SecurityAlert requires professionnelId) ──
    if (reportedUserType === "pro") {
      await prisma.securityAlert.create({
        data: {
          type: "user_report",
          message: `Signalement (${reasonLabel}) par un ${reporterType} (${reporterId}) contre ce professionnel.`,
          professionnelId: reportedUserId,
          ip,
        },
      });
    }

    // ── Audit trail ──
    console.warn(`[SECURITY-AUDIT] USER_REPORT reporter=${reporterId}(${reporterType}) reported=${reportedUserId}(${reportedUserType}) reason=${reason} ip=${ip} ua=${ua?.slice(0, 80)}`);

    return NextResponse.json({
      success: true,
      message: "Signalement envoyé. Notre équipe va examiner ce profil.",
    });
  } catch (error) {
    console.error("POST /api/support/report error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
