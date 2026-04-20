import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/athlete/next-rdv
// Returns the next upcoming appointment(s) for the authenticated athlete user.
// Links AthleteUser → ConnectionRequest (accepted) → Professionnel → Athlete (by email) → CalendarEvent

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    // Get the athlete user's email to match with pro-managed Athlete records
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true, prenom: true, nom: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Find accepted connections
    const connections = await prisma.connectionRequest.findMany({
      where: { athleteUserId: session.id, status: "accepted" },
      select: { professionnelId: true },
    });

    const proIds = connections.map((c: any) => c.professionnelId);

    // Find Athlete records linked to these pros that match athlete user's email
    let athleteIds: string[] = [];
    if (proIds.length > 0) {
      const athletes = await prisma.athlete.findMany({
        where: {
          professionnelId: { in: proIds },
          contactEmail: { equals: athleteUser.email, mode: "insensitive" },
        },
        select: { id: true },
      });
      athleteIds = athletes.map((a: any) => a.id);
    }

    // Get upcoming calendar events (type "rdv") — match by athleteId OR athleteUserId
    const now = new Date();
    const orConditions: any[] = [{ athleteUserId: session.id }];
    if (athleteIds.length > 0) {
      orConditions.push({ athleteId: { in: athleteIds } });
    }

    const appointments = await prisma.calendarEvent.findMany({
      where: {
        OR: orConditions,
        type: "rdv",
        date: { gte: now },
        deletedAt: null,
      },
      orderBy: { date: "asc" },
      take: 5,
      include: {
        professionnel: {
          select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true, adresseCabinet: true, telephone: true },
        },
      },
    });

    const mapped = appointments.map((a: any) => {
      // Parse format from description (e.g. "Format: Présentiel")
      const descLines = (a.description || "").split("\n");
      const formatLine = descLines.find((l: string) => l.toLowerCase().startsWith("format"));
      const format = formatLine?.includes("éléconsultation") ? "teleconsultation" : "presentiel";
      // Parse consignes if present
      const consignesLine = descLines.find((l: string) => l.toLowerCase().startsWith("consignes") || l.toLowerCase().startsWith("instructions"));
      const consignes = consignesLine ? consignesLine.replace(/^(consignes|instructions)\s*:\s*/i, "").trim() : null;

      return {
        id: a.id,
        title: a.title,
        date: a.date,
        endDate: a.endDate,
        description: a.description,
        color: a.color,
        format,
        consignes,
        visioRoomId: a.visioRoomId || null,
        pro: {
          id: a.professionnel.id,
          nom: a.professionnel.nom,
          prenom: a.professionnel.prenom,
          specialite: a.professionnel.specialite,
          adresseCabinet: a.professionnel.adresseCabinet || null,
          telephone: a.professionnel.telephone || null,
        },
      };
    });

    return NextResponse.json({
      appointments: mapped,
      next: mapped.length > 0 ? mapped[0] : null,
    });
  } catch (error) {
    console.error("GET /api/athlete/next-rdv error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
