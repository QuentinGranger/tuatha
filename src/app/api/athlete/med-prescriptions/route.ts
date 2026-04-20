import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/med-prescriptions?proId=xxx
// Returns patient-visible prescriptions (active/completed) for the authenticated athlete
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-med-prescriptions:${ip}`, RATE_LIMITS.search);
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

    // Only visiblePatient:true + active/completed
    const rawPrescriptions = await (prisma as any).medPrescription.findMany({
      where: {
        athleteId: athlete.id,
        proId,
        visiblePatient: true,
        status: { in: ["active", "completed"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const prescriptions = rawPrescriptions.map((p: any) => {
      let content: string[] = [];
      if (p.contentJson) {
        try { content = JSON.parse(p.contentJson); } catch { /* ignore */ }
      }

      return {
        id: p.id,
        type: p.type,
        title: p.title,
        content,
        dateStart: p.dateStart,
        dateEnd: p.dateEnd,
        redFlags: p.redFlags || [],
        status: p.status,
        createdAt: p.createdAt,
      };
    });

    return NextResponse.json({ prescriptions });
  } catch (error) {
    console.error("[athlete/med-prescriptions] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
