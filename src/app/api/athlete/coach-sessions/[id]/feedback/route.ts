import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// PATCH /api/athlete/coach-sessions/[id]/feedback
// Allows the athlete to submit feedback on a coach session
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-session-feedback:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  try {
    const body = await request.json();

    // Validate allowed fields
    const { feedbackAthlete, rpeRessenti, douleur, douleurZone } = body;

    if (
      feedbackAthlete === undefined &&
      rpeRessenti === undefined &&
      douleur === undefined &&
      douleurZone === undefined
    ) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    // Validate rpeRessenti (1-10)
    if (rpeRessenti !== undefined && rpeRessenti !== null) {
      const rpe = Number(rpeRessenti);
      if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) {
        return NextResponse.json({ error: "rpeRessenti doit être entre 1 et 10" }, { status: 400 });
      }
    }

    // Validate douleur (0-10)
    if (douleur !== undefined && douleur !== null) {
      const d = Number(douleur);
      if (!Number.isInteger(d) || d < 0 || d > 10) {
        return NextResponse.json({ error: "douleur doit être entre 0 et 10" }, { status: 400 });
      }
    }

    // Get athlete user email
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Fetch the session
    const coachSession = await (prisma as any).session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        athleteId: true,
        professionnelId: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!coachSession || coachSession.deletedAt) {
      return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
    }

    // Verify status is en_cours or realisee
    if (!["en_cours", "realisee"].includes(coachSession.status)) {
      return NextResponse.json(
        { error: "Le feedback ne peut être donné que sur une séance en cours ou réalisée" },
        { status: 403 }
      );
    }

    // Verify the session is assigned to this athlete
    if (!coachSession.athleteId) {
      return NextResponse.json({ error: "Séance non assignée" }, { status: 403 });
    }

    // Check that the athlete record belongs to this user (via email match)
    const athleteRecord = await (prisma as any).athlete.findFirst({
      where: {
        id: coachSession.athleteId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true, professionnelId: true },
    });

    if (!athleteRecord) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Verify accepted connection with the pro
    const connection = await prisma.connectionRequest.findFirst({
      where: {
        athleteUserId: session.id,
        professionnelId: athleteRecord.professionnelId,
        status: "accepted",
      },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté à ce professionnel" }, { status: 403 });
    }

    // Build update data — only allowed fields
    const updateData: any = {};
    if (feedbackAthlete !== undefined) {
      updateData.feedbackAthlete = feedbackAthlete === null ? null : String(feedbackAthlete).slice(0, 5000);
    }
    if (rpeRessenti !== undefined) {
      updateData.rpeRessenti = rpeRessenti === null ? null : Number(rpeRessenti);
    }
    if (douleur !== undefined) {
      updateData.douleur = douleur === null ? null : Number(douleur);
    }
    if (douleurZone !== undefined) {
      updateData.douleurZone = douleurZone === null ? null : String(douleurZone).slice(0, 500);
    }

    const updated = await (prisma as any).session.update({
      where: { id: sessionId },
      data: updateData,
      select: {
        id: true,
        feedbackAthlete: true,
        rpeRessenti: true,
        douleur: true,
        douleurZone: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[athlete/coach-sessions/feedback] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
