import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeBody } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

// GET /api/athlete/consultation-prep?eventId=xxx
// Returns existing prep data for a given calendar event, or null.

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId manquant" }, { status: 400 });
  }

  try {
    // Verify the event belongs to this athlete
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { id: true, athleteId: true, athleteUserId: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
    }
    let isOwner = event.athleteUserId === session.id;
    if (!isOwner && event.athleteId) {
      const athleteRecord = await prisma.athlete.findUnique({ where: { id: event.athleteId }, select: { contactEmail: true } });
      const athleteUser = await prisma.athleteUser.findUnique({ where: { id: session.id }, select: { email: true } });
      if (athleteRecord && athleteUser) isOwner = athleteRecord.contactEmail?.toLowerCase() === athleteUser.email?.toLowerCase();
    }
    if (!isOwner) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const prep = await prisma.consultationPrep.findUnique({
      where: { calendarEventId: eventId },
    });

    return NextResponse.json({ prep: prep || null });
  } catch (error) {
    console.error("GET /api/athlete/consultation-prep error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/athlete/consultation-prep
// Upsert prep data for a given calendar event.

export async function PUT(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = sanitizeBody(await request.json());
    const { eventId, motifDetail, symptoms, painLevel, fatigueLevel, documents, evolution, questionnaire, completed } = body;

    if (!eventId) {
      return NextResponse.json({ error: "eventId manquant" }, { status: 400 });
    }

    // Verify the event belongs to this athlete
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { id: true, athleteId: true, athleteUserId: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
    }
    let isOwner = event.athleteUserId === session.id;
    if (!isOwner && event.athleteId) {
      const athleteRecord = await prisma.athlete.findUnique({ where: { id: event.athleteId }, select: { contactEmail: true } });
      const athleteUser = await prisma.athleteUser.findUnique({ where: { id: session.id }, select: { email: true } });
      if (athleteRecord && athleteUser) isOwner = athleteRecord.contactEmail?.toLowerCase() === athleteUser.email?.toLowerCase();
    }
    if (!isOwner) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const prep = await prisma.consultationPrep.upsert({
      where: { calendarEventId: eventId },
      create: {
        calendarEventId: eventId,
        athleteUserId: session.id,
        motifDetail: motifDetail || null,
        symptoms: symptoms || null,
        painLevel: painLevel != null ? parseInt(painLevel, 10) : null,
        fatigueLevel: fatigueLevel != null ? parseInt(fatigueLevel, 10) : null,
        documents: documents || [],
        evolution: evolution || null,
        questionnaire: questionnaire || null,
        completedAt: completed ? new Date() : null,
      },
      update: {
        motifDetail: motifDetail || null,
        symptoms: symptoms || null,
        painLevel: painLevel != null ? parseInt(painLevel, 10) : null,
        fatigueLevel: fatigueLevel != null ? parseInt(fatigueLevel, 10) : null,
        documents: documents || [],
        evolution: evolution || null,
        questionnaire: questionnaire || null,
        completedAt: completed ? new Date() : null,
      },
    });

    return NextResponse.json({ prep });
  } catch (error) {
    console.error("PUT /api/athlete/consultation-prep error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
