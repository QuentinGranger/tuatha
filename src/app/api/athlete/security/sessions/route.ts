// ─── Gestion des sessions athlète ───
//
// GET    — Liste des sessions actives (appareils connectés)
// DELETE — Révoquer une session spécifique ou toutes les sessions
//
// Body DELETE: { sessionId?: string, all?: boolean }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete, revokeAllSessions } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET — Active sessions (devices)
export async function GET() {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const sessions = await prisma.authSession.findMany({
      where: { athleteUserId: session.id, revoked: false },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        deviceName: true,
        ip: true,
        userAgent: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    const currentSessionId = (session as any).sessionId;
    const result = sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));

    return NextResponse.json({ sessions: result });
  } catch (error) {
    console.error("GET /api/athlete/security/sessions error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — Revoke sessions
export async function DELETE(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await request.json();
    const { sessionId, all } = body;

    if (all) {
      // Revoke all sessions except current
      const currentSessionId = (session as any).sessionId;
      const count = await revokeAllSessions(session.id, currentSessionId, "athlete", "user_revoke_all");
      console.log(`[SECURITY-AUDIT] ATHLETE_REVOKE_ALL_SESSIONS userId=${session.id} count=${count}`);
      return NextResponse.json({ message: `${count} session(s) révoquée(s).`, count });
    }

    if (sessionId) {
      // Revoke a specific session (must belong to this athlete)
      const target = await prisma.authSession.findFirst({
        where: { id: sessionId, athleteUserId: session.id, revoked: false },
      });

      if (!target) {
        return NextResponse.json({ error: "Session introuvable." }, { status: 404 });
      }

      // Can't revoke current session via this endpoint
      const currentSessionId = (session as any).sessionId;
      if (target.id === currentSessionId) {
        return NextResponse.json({ error: "Utilisez /api/auth/logout pour la session courante." }, { status: 400 });
      }

      await prisma.authSession.update({
        where: { id: sessionId },
        data: { revoked: true, revokedAt: new Date(), revokedReason: "user_revoke" },
      });

      return NextResponse.json({ message: "Session révoquée." });
    }

    return NextResponse.json({ error: "Paramètre sessionId ou all requis." }, { status: 400 });
  } catch (error) {
    console.error("DELETE /api/athlete/security/sessions error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
