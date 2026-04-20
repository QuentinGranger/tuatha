import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/coach-sessions?proId=xxx
// Returns coach sessions for the authenticated athlete
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-coach-sessions:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const proId = searchParams.get("proId");

    // Get athlete user email
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Build the where clause for finding Athlete records
    const athleteWhere: any = {
      contactEmail: { equals: athleteUser.email, mode: "insensitive" },
    };

    if (proId) {
      // Verify accepted connection with this specific pro
      const connection = await prisma.connectionRequest.findFirst({
        where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
      });
      if (!connection) {
        return NextResponse.json({ error: "Non connecté" }, { status: 403 });
      }
      athleteWhere.professionnelId = proId;
    } else {
      // Get all accepted connections
      const connections = await prisma.connectionRequest.findMany({
        where: { athleteUserId: session.id, status: "accepted" },
        select: { professionnelId: true },
      });
      const connectedProIds = connections.map((c) => c.professionnelId);
      if (connectedProIds.length === 0) {
        return NextResponse.json({ sessions: [] });
      }
      athleteWhere.professionnelId = { in: connectedProIds };
    }

    // Find Athlete records linked to connected pros matching the athlete's email
    const athletes = await (prisma as any).athlete.findMany({
      where: athleteWhere,
      select: { id: true, professionnelId: true },
    });

    const athleteIds = athletes.map((a: any) => a.id);
    if (athleteIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Build map athleteId -> professionnelId for pro lookup
    const athleteProMap = new Map<string, string>();
    for (const a of athletes) {
      athleteProMap.set(a.id, a.professionnelId);
    }

    // Get unique pro IDs to fetch names
    const proIds = [...new Set(athletes.map((a: any) => a.professionnelId))];
    const pros = await prisma.professionnel.findMany({
      where: { id: { in: proIds as string[] } },
      select: { id: true, nom: true, prenom: true, specialite: true },
    });
    const proMap = new Map(pros.map((p) => [p.id, p]));

    // Fetch sessions: visible to athlete, not deleted, not draft
    const sessions = await (prisma as any).session.findMany({
      where: {
        athleteId: { in: athleteIds },
        visibleAthlete: true,
        deletedAt: null,
        status: { not: "brouillon" },
      },
      include: {
        blocks: {
          include: {
            exercises: {
              orderBy: { position: "asc" },
            },
          },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { date: "desc" },
    });

    // Map to clean response — mask private fields
    const result = sessions.map((s: any) => {
      const pro = proMap.get(athleteProMap.get(s.athleteId) || "");
      const proName = pro ? `${pro.prenom} ${pro.nom}` : null;

      return {
        id: s.id,
        name: s.name,
        date: s.date,
        time: s.time,
        lieu: s.lieu,
        status: s.status,
        objectif: s.objectif,
        tags: s.tags,
        // Prescription fields (visible to athlete)
        rpeCible: s.rpeCible,
        zoneCardio: s.zoneCardio,
        contraintes: s.contraintes,
        criteresArret: s.criteresArret,
        focusTechnique: s.focusTechnique,
        // Athlete feedback fields (athlete can see/fill)
        rpeRessenti: s.rpeRessenti,
        douleur: s.douleur,
        douleurZone: s.douleurZone,
        feedbackAthlete: s.feedbackAthlete,
        // Private fields masked: notePro, analysePro, recommandation
        proName,
        proId: athleteProMap.get(s.athleteId) || null,
        blocks: s.blocks.map((b: any) => ({
          id: b.id,
          name: b.name,
          position: b.position,
          exercises: b.exercises.map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            duration: ex.duration,
            distance: ex.distance,
            intensity: ex.intensity,
            tempo: ex.tempo,
            repos: ex.repos,
            consignes: ex.consignes,
            videoUrl: ex.videoUrl,
            position: ex.position,
          })),
        })),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return NextResponse.json({ sessions: result });
  } catch (error) {
    console.error("[athlete/coach-sessions] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
