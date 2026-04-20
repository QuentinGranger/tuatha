import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/nutri-plans?proId=xxx
// Returns published/active nutri plans for the authenticated athlete from a specific pro
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-nutri-plans:${ip}`, RATE_LIMITS.search);
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

    // Verify accepted connection
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté" }, { status: 403 });
    }

    // Resolve Athlete record via email
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

    // Fetch published/active plans only
    const plans = await (prisma as any).nutriPlan.findMany({
      where: {
        athleteId: athlete.id,
        proId,
        status: { in: ["publie", "en_cours"] },
        deletedAt: null,
      },
      include: {
        meals: {
          orderBy: { position: "asc" },
          include: {
            items: {
              orderBy: { position: "asc" },
              include: { alternatives: true },
            },
          },
        },
        versions: {
          orderBy: { version: "desc" },
          select: { id: true, version: true, publishedAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Strip notePro (private pro note) from response
    const sanitized = plans.map((p: any) => {
      const { notePro, ...rest } = p;
      return rest;
    });

    return NextResponse.json({ plans: sanitized });
  } catch (error) {
    console.error("[athlete/nutri-plans] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
