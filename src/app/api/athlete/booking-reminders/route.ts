import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/athlete/booking-reminders
// Returns active (unsent inapp + recently sent) reminders for the logged-in athlete.
// Used by the front-end to display reminder banners.

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Fetch inapp reminders that are due (scheduledAt <= now) and not dismissed
    // Include recently sent ones (last 24h) so the UI can show them
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const reminders = await prisma.bookingReminder.findMany({
      where: {
        athleteUserId: session.id,
        channel: "inapp",
        dismissed: false,
        scheduledAt: { lte: now },
        // Only show reminders for future or very recent events (not old ones)
        eventDate: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
        OR: [
          { sentAt: null },
          { sentAt: { gte: cutoff } },
        ],
      },
      include: {
        professionnel: {
          select: { nom: true, prenom: true, specialite: true, telephone: true, email: true, adresseCabinet: true },
        },
      },
      orderBy: { scheduledAt: "desc" },
      take: 10,
    });

    // Mark unsent inapp reminders as sent
    const unsentIds = reminders.filter((r: any) => !r.sentAt).map((r: any) => r.id);
    if (unsentIds.length > 0) {
      await prisma.bookingReminder.updateMany({
        where: { id: { in: unsentIds } },
        data: { sentAt: now },
      });
    }

    return NextResponse.json({ reminders });
  } catch (error) {
    console.error("GET /api/athlete/booking-reminders error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/athlete/booking-reminders
// Dismiss a reminder by id.

export async function PATCH(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { reminderId } = await request.json();
    if (!reminderId) {
      return NextResponse.json({ error: "reminderId manquant" }, { status: 400 });
    }

    await prisma.bookingReminder.updateMany({
      where: { id: reminderId, athleteUserId: session.id },
      data: { dismissed: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/athlete/booking-reminders error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
