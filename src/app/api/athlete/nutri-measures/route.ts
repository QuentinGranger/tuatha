import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/nutri-measures?proId=xxx
// Returns body composition measures for the authenticated athlete
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-nutri-measures:${ip}`, RATE_LIMITS.search);
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

    const measures = await (prisma as any).nutriMeasure.findMany({
      where: { athleteId: athlete.id },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ measures });
  } catch (error) {
    console.error("[athlete/nutri-measures] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/athlete/nutri-measures  — athlete self-reports a measure
export async function POST(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-nutri-measures-post:${ip}`, RATE_LIMITS.upload);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { proId, weight, waist, hydration } = body;
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

    const bmi = weight ? +((weight) / (1.75 * 1.75)).toFixed(1) : null;

    const measure = await (prisma as any).nutriMeasure.create({
      data: {
        athleteId: athlete.id,
        date: new Date(new Date().toISOString().slice(0, 10)),
        weight: weight ? +weight : null,
        bmi,
        bodyFat: null,
        waist: waist ? +waist : null,
        hydration: hydration ? +hydration : null,
        source: "athlete",
      },
    });

    return NextResponse.json(measure, { status: 201 });
  } catch (error) {
    console.error("[athlete/nutri-measures] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
