import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sanitizeBody } from "@/lib/sanitize";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { buildVisioPairRoom } from "@/lib/visio";
import { isPaymentReady } from "@/lib/accountStatus";

export const dynamic = "force-dynamic";

// POST /api/athlete/book-appointment
// Creates a calendar event (type "rdv") for the selected pro, sends confirmation emails.

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = sanitizeBody(await request.json());
    const {
      proId,
      date,
      duration,
      motif,
      format,
      complaint,
      comment,
      altAvailability,
      documents,
      attachAntecedents,
    } = body;

    if (!proId || !date || !motif) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    // Verify the athlete has an accepted connection with this pro
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Vous n'êtes pas connecté avec ce professionnel." }, { status: 403 });
    }

    // Get athlete user info
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true, prenom: true, nom: true, telephone: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Get pro info
    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { id: true, nom: true, prenom: true, email: true, specialite: true, adresseCabinet: true, accountStatus: true },
    });
    if (!pro) {
      return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });
    }

    // Block booking if pro is not payment-ready
    if (!isPaymentReady(pro.accountStatus)) {
      return NextResponse.json(
        { error: "Ce professionnel n'est pas encore disponible pour les réservations. Son compte est en cours de vérification." },
        { status: 403 }
      );
    }

    // Find the Athlete record linked to this pro (by email match)
    const athleteRecord = await prisma.athlete.findFirst({
      where: {
        professionnelId: proId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true },
    });

    const startDate = new Date(date);
    const durationMin = duration || 30;
    const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);

    // Build description with form data
    const descParts: string[] = [];
    if (complaint) descParts.push(`Problème : ${complaint}`);
    if (comment) descParts.push(`Note : ${comment}`);
    if (altAvailability) descParts.push(`Dispo alternative : ${altAvailability}`);
    if (documents && documents.length > 0) descParts.push(`Documents : ${documents.join(", ")}`);
    if (attachAntecedents) descParts.push("Antécédents médicaux joints");
    if (format) descParts.push(`Format : ${format === "presentiel" ? "Présentiel" : "Téléconsultation"}`);

    const description = descParts.length > 0 ? descParts.join("\n") : null;

    // Anti-double-booking: atomic check + create inside a serializable transaction
    // Uses pg_advisory_xact_lock to serialize bookings per pro, preventing race conditions.
    const event = await prisma.$transaction(async (tx) => {
      // Acquire an advisory lock scoped to this pro's calendar for the duration of the transaction
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        proId,
      );

      // Check for overlapping events
      const conflicting = await tx.calendarEvent.findFirst({
        where: {
          professionnelId: proId,
          deletedAt: null,
          date: { lt: endDate },
          endDate: { gt: startDate },
        },
        select: { id: true },
      });
      if (conflicting) {
        throw new Error("SLOT_TAKEN");
      }

      // Create the CalendarEvent
      const visioRoomId = format === "teleconsultation"
        ? buildVisioPairRoom("athlete", session.id, "pro", proId)
        : null;

      return tx.calendarEvent.create({
        data: {
          title: `RDV ${motif} — ${athleteUser.prenom} ${athleteUser.nom}`,
          date: startDate,
          endDate,
          type: "rdv",
          color: "orange",
          description,
          reminderMinutes: 30,
          athleteId: athleteRecord?.id || null,
          athleteUserId: session.id,
          professionnelId: proId,
          visioRoomId,
        },
      });
    });

    // ─── Seed booking reminders ───
    const docsStr = documents && documents.length > 0 ? documents.join(", ") : "Carte Vitale ou attestation, Ordonnance (si disponible), Examens récents";
    const isVisio = format === "teleconsultation";

    const reminderBase = {
      calendarEventId: event.id,
      athleteUserId: session.id,
      professionnelId: proId,
      eventTitle: event.title,
      eventDate: startDate,
      eventEndDate: endDate,
      eventFormat: format || "presentiel",
      eventMotif: motif,
      eventAddress: pro.adresseCabinet || null,
      eventDocuments: docsStr,
      eventVisioRoomId: event.visioRoomId || null,
    };

    const remindersToCreate: Array<typeof reminderBase & { type: string; scheduledAt: Date; channel: string; recipientType: string }> = [];

    // Helper to push both athlete + pro reminders
    const pushForBoth = (type: string, scheduledAt: Date, channel: string) => {
      remindersToCreate.push({ ...reminderBase, type, scheduledAt, channel, recipientType: "athlete" });
      remindersToCreate.push({ ...reminderBase, type, scheduledAt, channel, recipientType: "pro" });
    };

    // J-2 (2 days before at 9am)
    const j2 = new Date(startDate);
    j2.setDate(j2.getDate() - 2);
    j2.setHours(9, 0, 0, 0);
    if (j2 > new Date()) {
      pushForBoth("j2", j2, "email");
      pushForBoth("j2", j2, "inapp");
    }

    // J-1 (1 day before at 9am)
    const j1 = new Date(startDate);
    j1.setDate(j1.getDate() - 1);
    j1.setHours(9, 0, 0, 0);
    if (j1 > new Date()) {
      pushForBoth("j1", j1, "email");
      pushForBoth("j1", j1, "inapp");
    }

    // H-2 (2 hours before)
    const h2 = new Date(startDate.getTime() - 2 * 60 * 60 * 1000);
    if (h2 > new Date()) {
      pushForBoth("h2", h2, "email");
      pushForBoth("h2", h2, "inapp");
    }

    // H-1 visio (1 hour before, only for teleconsultation)
    if (isVisio) {
      const h1 = new Date(startDate.getTime() - 1 * 60 * 60 * 1000);
      if (h1 > new Date()) {
        pushForBoth("h1_visio", h1, "email");
        pushForBoth("h1_visio", h1, "inapp");
      }
    }

    // "C'est maintenant" visio (at event start, only for teleconsultation)
    if (isVisio) {
      pushForBoth("now_visio", startDate, "email");
      pushForBoth("now_visio", startDate, "inapp");
    }

    // Bulk create all reminders
    if (remindersToCreate.length > 0) {
      await prisma.bookingReminder.createMany({ data: remindersToCreate });
    }

    // Format for emails
    const dateLabel = startDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const heureLabel = startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    // Send confirmation email to athlete (fire & forget)
    sendBookingConfirmationEmail({
      to: athleteUser.email,
      prenom: athleteUser.prenom,
      proName: `${pro.prenom} ${pro.nom}`,
      proSpecialite: pro.specialite,
      date: dateLabel,
      heure: heureLabel,
      duree: `${durationMin} min`,
      motif,
      format: format || "presentiel",
      lieu: pro.adresseCabinet || null,
    }).catch((err) => console.error("[book] Athlete email error:", err));

    // Send notification email to pro (fire & forget)
    sendBookingConfirmationEmail({
      to: pro.email,
      prenom: pro.prenom,
      proName: `${athleteUser.prenom} ${athleteUser.nom}`,
      proSpecialite: "Patient",
      date: dateLabel,
      heure: heureLabel,
      duree: `${durationMin} min`,
      motif,
      format: format || "presentiel",
      lieu: pro.adresseCabinet || null,
    }).catch((err) => console.error("[book] Pro email error:", err));

    return NextResponse.json({
      success: true,
      eventId: event.id,
      date: startDate,
      endDate,
      proName: `${pro.prenom} ${pro.nom}`,
      proSpecialite: pro.specialite,
      visioRoomId: event.visioRoomId || null,
    });
  } catch (error: any) {
    if (error?.message === "SLOT_TAKEN") {
      return NextResponse.json({ error: "Ce créneau vient d'être réservé par quelqu'un d'autre. Veuillez en choisir un autre." }, { status: 409 });
    }
    console.error("POST /api/athlete/book-appointment error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
