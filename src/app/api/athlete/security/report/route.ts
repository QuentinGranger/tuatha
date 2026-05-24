// ─── Signalement d'activité suspecte par l'athlète ───
//
// POST /api/athlete/security/report
//
// Permet à l'athlète de signaler une activité suspecte vue dans son
// espace sécurité (connexion inconnue, accès non autorisé, etc.)
//
// Body: { type: string, description: string, relatedSessionId?: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

const REPORT_TYPES = [
  "unknown_session",
  "unauthorized_access",
  "unknown_device",
  "data_breach_suspicion",
  "other",
] as const;

export async function POST(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await request.json();
    const { type, description, relatedSessionId } = body;

    if (!type || !REPORT_TYPES.includes(type)) {
      return NextResponse.json({
        error: `Type invalide. Types valides: ${REPORT_TYPES.join(", ")}`,
      }, { status: 400 });
    }

    if (!description || typeof description !== "string" || description.length < 10) {
      return NextResponse.json({
        error: "Description requise (minimum 10 caractères).",
      }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;

    // Log the report as an athlete access log entry
    await (prisma as any).athleteAccessLog.create({
      data: {
        athleteUserId: session.id,
        action: "security_report",
        resource: JSON.stringify({ type, description: description.slice(0, 500), relatedSessionId }),
        ip,
        userAgent,
      },
    });

    // If related to an unknown session, auto-revoke it
    if (relatedSessionId && type === "unknown_session") {
      const target = await prisma.authSession.findFirst({
        where: { id: relatedSessionId, athleteUserId: session.id, revoked: false },
      });
      if (target) {
        await prisma.authSession.update({
          where: { id: relatedSessionId },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "suspicious_report" },
        });
      }
    }

    console.warn(
      `[SECURITY-AUDIT] ATHLETE_SUSPICIOUS_REPORT userId=${session.id} type=${type} ip=${ip}`,
    );

    return NextResponse.json({
      message: "Signalement enregistré. Notre équipe sécurité a été notifiée.",
      type,
    });
  } catch (error) {
    console.error("POST /api/athlete/security/report error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
