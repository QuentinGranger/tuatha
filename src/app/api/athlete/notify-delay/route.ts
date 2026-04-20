import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sanitizeBody } from "@/lib/sanitize";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/athlete/notify-delay — notify the pro that the athlete will be late
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { eventId, delayMinutes, message } = sanitizeBody(await request.json());

    if (!eventId || !delayMinutes) {
      return NextResponse.json({ error: "eventId et delayMinutes requis" }, { status: 400 });
    }

    // Get the event with pro info
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: {
        professionnel: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
    }

    // Check that the authenticated athlete owns this event
    let isOwner = event.athleteUserId === session.id;
    if (!isOwner && event.athleteId) {
      const athleteRecord = await prisma.athlete.findUnique({
        where: { id: event.athleteId },
        select: { contactEmail: true },
      });
      const ownerUser = await prisma.athleteUser.findUnique({
        where: { id: session.id },
        select: { email: true },
      });
      if (athleteRecord && ownerUser) {
        isOwner = athleteRecord.contactEmail?.toLowerCase() === ownerUser.email?.toLowerCase();
      }
    }
    if (!isOwner) {
      return NextResponse.json({ error: "Vous ne pouvez pas signaler un retard pour ce rendez-vous" }, { status: 403 });
    }

    // Get athlete info
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { prenom: true, nom: true, email: true, telephone: true },
    });

    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Create an in-app notification for the pro via a CalendarEvent note or message
    // We'll create a BookingReminder of type "delay_notice" for the pro to see
    try {
      await prisma.bookingReminder.create({
        data: {
          calendarEventId: eventId,
          athleteUserId: session.id,
          professionnelId: event.professionnelId,
          type: "delay_notice",
          scheduledAt: new Date(),
          sentAt: new Date(),
          channel: "inapp",
          eventTitle: event.title || "Rendez-vous",
          eventDate: event.date,
          eventEndDate: event.endDate,
          eventFormat: "presentiel",
          eventMotif: `Retard de ${delayMinutes} min${message ? ` — ${message}` : ""}`,
          eventAddress: `${athleteUser.prenom} ${athleteUser.nom} sera en retard de ~${delayMinutes} minutes`,
        },
      });
    } catch (e) {
      console.error("Failed to create delay notification:", e);
    }

    // Also send a message in the athlete-pro conversation if the messaging system exists
    try {
      await prisma.athleteProMessage.create({
        data: {
          athleteUserId: session.id,
          professionnelId: event.professionnelId,
          senderType: "athlete",
          content: `⏰ Je serai en retard d'environ ${delayMinutes} minutes pour le rendez-vous de ${new Date(event.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.${message ? ` ${message}` : ""}`,
          read: false,
        },
      });
    } catch (e) {
      console.error("Failed to send delay message:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/athlete/notify-delay error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
