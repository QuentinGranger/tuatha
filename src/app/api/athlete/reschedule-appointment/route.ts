import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeBody } from "@/lib/sanitize";
import { isPaymentReady } from "@/lib/accountStatus";

export const dynamic = "force-dynamic";

// POST /api/athlete/reschedule-appointment
// Updates the event date in-place and regenerates reminders.

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { eventId, newDate, newDuration } = sanitizeBody(await request.json());
    if (!eventId || !newDate) {
      return NextResponse.json({ error: "eventId et newDate requis" }, { status: 400 });
    }

    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { id: true, athleteId: true, athleteUserId: true, professionnelId: true, title: true, date: true, deletedAt: true, description: true, visioRoomId: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
    }
    if (event.deletedAt) {
      return NextResponse.json({ error: "Ce rendez-vous est annulé" }, { status: 400 });
    }

    // Check that the authenticated athlete owns this event
    let isOwner = event.athleteUserId === session.id;
    if (!isOwner && event.athleteId) {
      const athleteRecord = await prisma.athlete.findUnique({
        where: { id: event.athleteId },
        select: { contactEmail: true },
      });
      const athleteUser = await prisma.athleteUser.findUnique({
        where: { id: session.id },
        select: { email: true },
      });
      if (athleteRecord && athleteUser) {
        isOwner = athleteRecord.contactEmail?.toLowerCase() === athleteUser.email?.toLowerCase();
      }
    }
    if (!isOwner) {
      return NextResponse.json({ error: "Vous ne pouvez pas modifier ce rendez-vous" }, { status: 403 });
    }

    // Block reschedule if pro is not payment-ready
    if (event.professionnelId) {
      const pro = await prisma.professionnel.findUnique({
        where: { id: event.professionnelId },
        select: { accountStatus: true },
      });
      if (pro && !isPaymentReady(pro.accountStatus)) {
        return NextResponse.json(
          { error: "Ce professionnel n'est pas encore disponible pour les réservations. Son compte est en cours de vérification." },
          { status: 403 }
        );
      }
    }

    const startDate = new Date(newDate);
    const durationMin = newDuration || 30;
    const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);

    // Atomic conflict check + update inside a transaction with advisory lock
    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        event.professionnelId,
      );

      const conflicting = await tx.calendarEvent.findFirst({
        where: {
          professionnelId: event.professionnelId,
          deletedAt: null,
          id: { not: eventId },
          date: { lt: endDate },
          endDate: { gt: startDate },
        },
        select: { id: true },
      });
      if (conflicting) {
        throw new Error("SLOT_TAKEN");
      }

      await tx.calendarEvent.update({
        where: { id: eventId },
        data: { date: startDate, endDate },
      });
    });

    // Delete old unsent reminders and recreate
    await prisma.bookingReminder.deleteMany({
      where: { calendarEventId: eventId, sentAt: null },
    });

    // Get pro info for reminders
    const pro = await prisma.professionnel.findUnique({
      where: { id: event.professionnelId },
      select: { adresseCabinet: true },
    });

    // Parse format from description
    const descText = event.description || "";
    const isVisio = descText.toLowerCase().includes("téléconsultation") || descText.toLowerCase().includes("teleconsultation");
    const format = isVisio ? "teleconsultation" : "presentiel";

    // Extract motif from title: "RDV {motif} — {name}"
    const motifMatch = event.title?.match(/^RDV (.+?) —/);
    const motif = motifMatch ? motifMatch[1] : "Consultation";

    const reminderBase = {
      calendarEventId: eventId,
      athleteUserId: session.id,
      professionnelId: event.professionnelId,
      eventTitle: event.title,
      eventDate: startDate,
      eventEndDate: endDate,
      eventFormat: format,
      eventMotif: motif,
      eventAddress: pro?.adresseCabinet || null,
      eventDocuments: "Carte Vitale ou attestation, Ordonnance (si disponible), Examens récents",
      eventVisioRoomId: event.visioRoomId || null,
    };

    const reminders: Array<typeof reminderBase & { type: string; scheduledAt: Date; channel: string; recipientType: string }> = [];
    const now = new Date();

    const pushForBoth = (type: string, scheduledAt: Date, channel: string) => {
      reminders.push({ ...reminderBase, type, scheduledAt, channel, recipientType: "athlete" });
      reminders.push({ ...reminderBase, type, scheduledAt, channel, recipientType: "pro" });
    };

    // J-2
    const j2 = new Date(startDate);
    j2.setDate(j2.getDate() - 2);
    j2.setHours(9, 0, 0, 0);
    if (j2 > now) { pushForBoth("j2", j2, "email"); pushForBoth("j2", j2, "inapp"); }

    // J-1
    const j1 = new Date(startDate);
    j1.setDate(j1.getDate() - 1);
    j1.setHours(9, 0, 0, 0);
    if (j1 > now) { pushForBoth("j1", j1, "email"); pushForBoth("j1", j1, "inapp"); }

    // H-2
    const h2 = new Date(startDate.getTime() - 2 * 60 * 60 * 1000);
    if (h2 > now) { pushForBoth("h2", h2, "email"); pushForBoth("h2", h2, "inapp"); }

    if (isVisio) {
      const h1 = new Date(startDate.getTime() - 1 * 60 * 60 * 1000);
      if (h1 > now) { pushForBoth("h1_visio", h1, "email"); pushForBoth("h1_visio", h1, "inapp"); }
      pushForBoth("now_visio", startDate, "email");
      pushForBoth("now_visio", startDate, "inapp");
    }

    if (reminders.length > 0) {
      await prisma.bookingReminder.createMany({ data: reminders });
    }

    // Deactivate waitlist (since they rescheduled)
    await prisma.waitlistEntry.updateMany({
      where: { calendarEventId: eventId },
      data: { active: false },
    });

    return NextResponse.json({ ok: true, date: startDate, endDate });
  } catch (error: any) {
    if (error?.message === "SLOT_TAKEN") {
      return NextResponse.json({ error: "Ce créneau est déjà pris. Veuillez en choisir un autre." }, { status: 409 });
    }
    console.error("POST /api/athlete/reschedule-appointment error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
