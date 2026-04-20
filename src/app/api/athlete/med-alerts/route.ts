import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/med-alerts?proId=xxx
// Returns medical alerts for the authenticated athlete linked to a specific pro (read-only)
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-med-alerts:${ip}`, RATE_LIMITS.search);
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

    const alerts = await (prisma as any).medAlert.findMany({
      where: { athleteId: athlete.id, proId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        severity: true,
        status: true,
        source: true,
        title: true,
        description: true,
        context: true,
        commentMedecin: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[athlete/med-alerts] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
