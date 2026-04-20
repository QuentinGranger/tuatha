import { NextRequest, NextResponse } from "next/server";
import { getSessionPro, getActiveSessions, revokeSession, revokeAllSessions } from "@/lib/session";
import { validateBody, sessionsDeleteSchema } from "@/lib/validation";

// GET — List active sessions for the current user
export async function GET() {
  try {
    const session = await getSessionPro();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const sessions = await getActiveSessions(session.id);

    // Mark current session
    const result = sessions.map((s: { id: string; deviceName: string | null; ip: string | null; lastActiveAt: Date; createdAt: Date }) => ({
      ...s,
      isCurrent: s.id === session.sessionId,
    }));

    return NextResponse.json({ sessions: result });
  } catch (error) {
    console.error("sessions GET error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

// DELETE — Revoke a specific session or all sessions
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionPro();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const parsed = validateBody(await request.json(), sessionsDeleteSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { sessionId, all } = parsed.data;

    if (all) {
      // Revoke all except current
      const count = await revokeAllSessions(session.id, session.sessionId);
      return NextResponse.json({ message: `${count} session(s) révoquée(s).`, count });
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId requis." }, { status: 400 });
    }

    // Don't allow revoking your own current session via this endpoint
    if (sessionId === session.sessionId) {
      return NextResponse.json({ error: "Utilisez /api/auth/logout pour déconnecter la session courante." }, { status: 400 });
    }

    await revokeSession(sessionId);
    return NextResponse.json({ message: "Session révoquée." });
  } catch (error) {
    console.error("sessions DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
