// ─── Signalement de message par l'athlète ───
//
// POST /api/athlete/messages/report
//
// Permet à l'athlète de signaler un message inapproprié, abusif ou suspect.
// Le signalement est loggé dans l'audit trail et peut déclencher une revue.
//
// Body: { messageId: string, reason: string, description?: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

// ─── Security: strict rate limit (3 message reports per hour) ───
const MSG_REPORT_RATE = { windowMs: 3_600_000, maxRequests: 3 };

// ─── Security: UUID v4 format check ───
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REPORT_REASONS = [
  "inappropriate",
  "harassment",
  "spam",
  "medical_advice_unsafe",
  "privacy_violation",
  "other",
] as const;

export async function POST(request: NextRequest) {
  // ── Strict rate limit ──
  const limited = rateLimit(request, MSG_REPORT_RATE);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ua = request.headers.get("user-agent")?.slice(0, 500) || null;

  try {
    const body = await request.json();
    const { messageId, reason, description } = body;

    // ── UUID validation ──
    if (!messageId || typeof messageId !== "string" || !UUID_RE.test(messageId)) {
      return NextResponse.json({ error: "messageId invalide." }, { status: 400 });
    }

    if (!reason || !REPORT_REASONS.includes(reason)) {
      return NextResponse.json({ error: "Raison invalide." }, { status: 400 });
    }

    // Verify the message belongs to a conversation with this athlete
    const message = await prisma.athleteProMessage.findFirst({
      where: { id: messageId, athleteUserId: session.id },
      select: { id: true, professionnelId: true, senderType: true, content: true },
    });

    if (!message) {
      return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
    }

    // ── Anti-flood: prevent re-reporting same message within 1h ──
    const hourAgo = new Date(Date.now() - 3_600_000);
    const duplicate = await (prisma as any).supportTicket.findFirst({
      where: {
        category: "security",
        createdByRole: "system",
        athleteUserId: session.id,
        createdAt: { gte: hourAgo },
        description: { contains: messageId },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Ce message a déjà été signalé. Notre équipe le traite." },
        { status: 429 },
      );
    }

    // ── Sanitize description (centralized XSS protection) ──
    let cleanDesc: string | null = null;
    if (description) {
      const descResult = sanitizeText(String(description), { maxLength: 500, context: "description" });
      cleanDesc = descResult.ok ? descResult.text : null;
    }

    // Log the report
    await (prisma as any).athleteAccessLog.create({
      data: {
        athleteUserId: session.id,
        action: "message_report",
        resource: JSON.stringify({
          messageId,
          professionnelId: message.professionnelId,
          reason,
          description: cleanDesc,
          senderType: message.senderType,
        }),
        ip,
        userAgent: ua,
      },
    });

    console.warn(
      `[SECURITY-AUDIT] ATHLETE_MESSAGE_REPORT userId=${session.id} messageId=${messageId} reason=${reason} ip=${ip}`,
    );

    // Create a SupportTicket for admin visibility
    const reasonLabels: Record<string, string> = {
      inappropriate: "Contenu inapproprié",
      harassment: "Harcèlement",
      spam: "Spam",
      medical_advice_unsafe: "Conseil médical dangereux",
      privacy_violation: "Violation vie privée",
      other: "Autre",
    };
    await (prisma as any).supportTicket.create({
      data: {
        subject: `Signalement : ${reasonLabels[reason] ?? reason}`,
        description: `L'athlète a signalé un message (ID: ${messageId}) du professionnel pour raison : ${reasonLabels[reason] ?? reason}.${cleanDesc ? `\n\nDétails : ${cleanDesc}` : ""}\n\nIP: ${ip}`,
        category: "security",
        priority: reason === "harassment" || reason === "medical_advice_unsafe" ? "high" : "normal",
        status: "open",
        createdByRole: "system",
        athleteUserId: session.id,
        professionnelId: message.professionnelId,
      },
    });

    // Create a SecurityAlert for the admin dashboard
    await prisma.securityAlert.create({
      data: {
        type: "message_report",
        message: `Signalement de message (${reasonLabels[reason] ?? reason}) par un athlète contre le pro ${message.professionnelId}.`,
        professionnelId: message.professionnelId,
        ip,
      },
    });

    return NextResponse.json({
      message: "Signalement enregistré. Notre équipe modération a été notifiée.",
    });
  } catch (error) {
    console.error("POST /api/athlete/messages/report error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
