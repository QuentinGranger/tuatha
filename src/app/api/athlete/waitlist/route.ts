import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/athlete/waitlist
// Subscribe to be alerted if an earlier slot opens for the same pro.

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { eventId } = await request.json();
    if (!eventId) {
      return NextResponse.json({ error: "eventId manquant" }, { status: 400 });
    }

    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { id: true, date: true, professionnelId: true, deletedAt: true },
    });

    if (!event || event.deletedAt) {
      return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
    }

    // Upsert waitlist entry (alert for any slot before current date)
    const entry = await prisma.waitlistEntry.upsert({
      where: {
        calendarEventId_athleteUserId: {
          calendarEventId: eventId,
          athleteUserId: session.id,
        },
      },
      create: {
        calendarEventId: eventId,
        athleteUserId: session.id,
        professionnelId: event.professionnelId,
        beforeDate: event.date,
        active: true,
      },
      update: {
        active: true,
        notifiedAt: null,
        beforeDate: event.date,
      },
    });

    return NextResponse.json({ ok: true, waitlistId: entry.id });
  } catch (error) {
    console.error("POST /api/athlete/waitlist error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/athlete/waitlist
// Unsubscribe from waitlist.

export async function DELETE(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { eventId } = await request.json();
    if (!eventId) {
      return NextResponse.json({ error: "eventId manquant" }, { status: 400 });
    }

    await prisma.waitlistEntry.updateMany({
      where: { calendarEventId: eventId, athleteUserId: session.id },
      data: { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/athlete/waitlist error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/athlete/waitlist?eventId=xxx
// Check if user is on waitlist for this event.

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const eventId = request.nextUrl.searchParams.get("eventId");

  try {
    if (eventId) {
      const entry = await prisma.waitlistEntry.findUnique({
        where: {
          calendarEventId_athleteUserId: {
            calendarEventId: eventId,
            athleteUserId: session.id,
          },
        },
        select: { id: true, active: true, createdAt: true },
      });
      return NextResponse.json({ waitlist: entry?.active ? entry : null });
    }

    // Return all active waitlist entries for this athlete
    const entries = await prisma.waitlistEntry.findMany({
      where: { athleteUserId: session.id, active: true },
      select: { id: true, calendarEventId: true, beforeDate: true, createdAt: true },
    });
    return NextResponse.json({ waitlist: entries });
  } catch (error) {
    console.error("GET /api/athlete/waitlist error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
