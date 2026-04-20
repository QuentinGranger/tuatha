import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/nutri-journal?proId=xxx&days=7
// Returns journal entries for the authenticated athlete linked to a specific pro
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-nutri-journal:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const proId = searchParams.get("proId");
    const days = parseInt(searchParams.get("days") || "7");
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

    // Resolve Athlete record
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

    const since = new Date();
    since.setDate(since.getDate() - days);

    const entries = await (prisma as any).nutriJournal.findMany({
      where: { athleteId: athlete.id, date: { gte: since } },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("[athlete/nutri-journal] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/athlete/nutri-journal
// Upsert a journal entry for a given date
export async function POST(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-nutri-journal-post:${ip}`, RATE_LIMITS.upload);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { proId, date, kcal, protein, carbs, fat, water, completed } = body;

    if (!proId || !date) {
      return NextResponse.json({ error: "proId et date requis" }, { status: 400 });
    }

    // Verify accepted connection
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté" }, { status: 403 });
    }

    // Resolve Athlete record
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

    const entry = await (prisma as any).nutriJournal.upsert({
      where: { athleteId_date: { athleteId: athlete.id, date: new Date(date) } },
      update: {
        kcal: kcal ?? 0,
        protein: protein ?? 0,
        carbs: carbs ?? 0,
        fat: fat ?? 0,
        water: water ?? 0,
        completed: completed ?? false,
      },
      create: {
        athleteId: athlete.id,
        date: new Date(date),
        kcal: kcal ?? 0,
        protein: protein ?? 0,
        carbs: carbs ?? 0,
        fat: fat ?? 0,
        water: water ?? 0,
        completed: completed ?? false,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("[athlete/nutri-journal] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
