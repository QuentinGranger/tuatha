import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";
import { signFilePathInRecords } from "@/lib/signedUrl";

export const dynamic = "force-dynamic";

// GET /api/athlete/videos?proId=xxx — list videos the athlete has sent to pros
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-videos:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const proId = searchParams.get("proId");

    // 1. Get athlete user email
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // 2. Find Athlete records via contactEmail
    const athleteWhere: Record<string, unknown> = {
      contactEmail: { equals: athleteUser.email, mode: "insensitive" },
    };

    if (proId) {
      // Verify accepted connection
      const connection = await prisma.connectionRequest.findFirst({
        where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
      });
      if (!connection) {
        return NextResponse.json({ error: "Non connecté à ce professionnel" }, { status: 403 });
      }
      athleteWhere.professionnelId = proId;
    } else {
      // All accepted connections
      const connections = await prisma.connectionRequest.findMany({
        where: { athleteUserId: session.id, status: "accepted" },
        select: { professionnelId: true },
      });
      const connectedProIds = connections.map((c) => c.professionnelId);
      if (connectedProIds.length === 0) {
        return NextResponse.json([]);
      }
      athleteWhere.professionnelId = { in: connectedProIds };
    }

    const athletes = await prisma.athlete.findMany({
      where: athleteWhere,
      select: { id: true, professionnelId: true },
    });

    const athleteIds = athletes.map((a) => a.id);
    if (athleteIds.length === 0) {
      return NextResponse.json([]);
    }

    // Build athleteId -> professionnelId map for pro name lookup
    const athleteProMap = new Map<string, string>();
    for (const a of athletes) {
      athleteProMap.set(a.id, a.professionnelId);
    }

    // Fetch pro names
    const proIds = [...new Set(athletes.map((a) => a.professionnelId))];
    const pros = await prisma.professionnel.findMany({
      where: { id: { in: proIds } },
      select: { id: true, nom: true, prenom: true, specialite: true },
    });
    const proMap = new Map(pros.map((p) => [p.id, p]));

    // 3. Fetch videos for these athlete records, not soft-deleted
    const videos = await (prisma as any).athleteVideo.findMany({
      where: {
        athleteId: { in: athleteIds },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    // Sign file paths for the athlete
    const signed = signFilePathInRecords(videos, session.id);

    // Add pro info to each video
    const result = signed.map((v: any) => {
      const pid = athleteProMap.get(v.athleteId) || "";
      const pro = proMap.get(pid);
      return {
        id: v.id,
        originalName: v.originalName,
        mimeType: v.mimeType,
        size: v.size,
        filePath: v.filePath,
        note: v.note,
        viewed: v.viewed,
        createdAt: v.createdAt,
        proName: pro ? `${pro.prenom} ${pro.nom}` : null,
        proSpecialite: pro?.specialite || null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[athlete/videos] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
