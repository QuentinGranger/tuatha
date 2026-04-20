import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/med-protocols?proId=xxx
// Returns active/completed protocols for the authenticated athlete (read-only)
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-med-protocols:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const proId = searchParams.get("proId");
    if (!proId) {
      return NextResponse.json({ error: "proId requis" }, { status: 400 });
    }

    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté" }, { status: 403 });
    }

    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const athlete = await (prisma as any).athlete.findFirst({
      where: {
        professionnelId: proId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Fiche athlète introuvable" }, { status: 404 });
    }

    // Only active/completed, exclude drafts + soft-deleted
    const rawProtocols = await (prisma as any).medProtocol.findMany({
      where: {
        athleteId: athlete.id,
        proId,
        status: { in: ["active", "completed"] },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    const protocols = rawProtocols.map((p: any) => {
      let phases: any[] = [];
      if (p.phasesJson) {
        try { phases = JSON.parse(p.phasesJson); } catch { /* ignore */ }
      }

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        objectives: p.objectives || [],
        phases,
        linkedTemplates: p.linkedTemplates || [],
        status: p.status,
        createdAt: p.createdAt,
      };
    });

    return NextResponse.json({ protocols });
  } catch (error) {
    console.error("[athlete/med-protocols] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
