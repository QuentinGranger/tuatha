import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sanitizeBody } from "@/lib/sanitize";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getCancellationEligibility } from "@/lib/cancellation";
import { sendCancellationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/athlete/cancel-appointment
// Soft-deletes a calendar event and dismisses all pending reminders.

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { eventId, reason } = sanitizeBody(await request.json());
    if (!eventId) {
      return NextResponse.json({ error: "eventId manquant" }, { status: 400 });
    }

    // Verify ownership: the event must be linked to this athlete
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true, athleteId: true, athleteUserId: true, date: true, professionnelId: true, deletedAt: true, description: true,
        professionnel: { select: { nom: true, prenom: true, email: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
    }
    if (event.deletedAt) {
      return NextResponse.json({ error: "Ce rendez-vous est déjà annulé" }, { status: 400 });
    }

    // Check that the authenticated athlete owns this event
    let isOwner = event.athleteUserId === session.id;
    if (!isOwner && event.athleteId) {
      // Fallback: check if the athlete record belongs to this user (legacy events without athleteUserId)
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
      return NextResponse.json({ error: "Vous ne pouvez pas annuler ce rendez-vous" }, { status: 403 });
    }

    // Determine cancellation eligibility for refund policy
    const eligibility = getCancellationEligibility(event.date);
    const cancelTag = `[Annulé par le patient | ${eligibility.outcome}${reason ? ` — ${reason}` : ""}]`;

    // Soft-delete the event
    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        deletedAt: new Date(),
        deletedBy: session.id,
        description: event.description
          ? `${event.description}\n${cancelTag}`
          : cancelTag,
      },
    });

    // Dismiss all pending reminders for this event
    await prisma.bookingReminder.updateMany({
      where: { calendarEventId: eventId, sentAt: null },
      data: { dismissed: true },
    });

    // Deactivate any waitlist entries
    await prisma.waitlistEntry.updateMany({
      where: { calendarEventId: eventId },
      data: { active: false },
    });

    // Send cancellation emails (non-blocking)
    try {
      const athleteUser = await prisma.athleteUser.findUnique({
        where: { id: session.id },
        select: { email: true, prenom: true },
      });

      const eventDate = event.date;
      const dateStr = eventDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const heureStr = eventDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const proFullName = `${event.professionnel?.prenom || ""} ${event.professionnel?.nom || ""}`.trim();
      const athletePrenom = athleteUser?.prenom || "Patient";
      const refundLabel = eligibility.rule?.label || null;

      // Email to athlete
      if (athleteUser?.email) {
        await sendCancellationEmail({
          to: athleteUser.email,
          recipientPrenom: athletePrenom,
          otherPartyName: proFullName,
          date: dateStr,
          heure: heureStr,
          motif: reason || null,
          cancelledBy: "athlete",
          refundInfo: refundLabel,
        });
      }

      // Email to pro
      if (event.professionnel?.email) {
        await sendCancellationEmail({
          to: event.professionnel.email,
          recipientPrenom: event.professionnel.prenom || "Professionnel",
          otherPartyName: athletePrenom,
          date: dateStr,
          heure: heureStr,
          motif: reason || null,
          cancelledBy: "athlete",
          refundInfo: null,
        });
      }
    } catch (cancelEmailErr) {
      console.error("Failed to send cancellation emails:", cancelEmailErr);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/athlete/cancel-appointment error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
