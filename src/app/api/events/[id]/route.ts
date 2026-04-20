import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { softDelete } from "@/lib/softDelete";
import { validateBody, updateEventSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";
import { sendCancellationEmail, sendRescheduleEmail } from "@/lib/email";

// PATCH /api/events/:id
export const PATCH = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    const parsed = validateBody(sanitizeBody(await request.json()), updateEventSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const existing = await prisma.calendarEvent.findFirst({
      where: { id, professionnelId: pro.id },
      select: {
        id: true, date: true, endDate: true, title: true, athleteUserId: true, athleteId: true, professionnelId: true, deletedAt: true,
        professionnel: { select: { nom: true, prenom: true } },
      },
    });
    if (!existing) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

    const oldDate = existing.date;
    const dateChanged = body.date !== undefined && new Date(body.date).getTime() !== oldDate.getTime();

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.date !== undefined) data.date = new Date(body.date);
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.allDay !== undefined) data.allDay = body.allDay;
    if (body.type !== undefined) data.type = body.type;
    if (body.color !== undefined) data.color = body.color;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.athleteId !== undefined) data.athleteId = body.athleteId || null;
    if (body.reminderMinutes !== undefined) {
      data.reminderMinutes = body.reminderMinutes ?? null;
      data.reminderSeen = false;
    }

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data,
      include: { athlete: { select: { id: true, name: true } } },
    });

    // ── Notify athlete if date changed (email + in-app) ──
    if (dateChanged && !existing.deletedAt) {
      try {
        let athleteUserId = existing.athleteUserId;
        let athleteEmail: string | null = null;
        let athletePrenom: string | null = null;

        if (athleteUserId) {
          const au = await prisma.athleteUser.findUnique({
            where: { id: athleteUserId },
            select: { email: true, prenom: true },
          });
          athleteEmail = au?.email || null;
          athletePrenom = au?.prenom || null;
        } else if (existing.athleteId) {
          const athlete = await prisma.athlete.findUnique({
            where: { id: existing.athleteId },
            select: { contactEmail: true, name: true },
          });
          if (athlete?.contactEmail) {
            const au = await prisma.athleteUser.findFirst({
              where: { email: { equals: athlete.contactEmail, mode: "insensitive" } },
              select: { id: true, email: true, prenom: true },
            });
            if (au) {
              athleteUserId = au.id;
              athleteEmail = au.email;
              athletePrenom = au.prenom || athlete.name?.split(" ")[0] || null;
            }
          }
        }

        if (athleteUserId && athleteEmail) {
          const proFullName = `${existing.professionnel?.prenom || ""} ${existing.professionnel?.nom || ""}`.trim();
          const newDate = new Date(body.date!);
          const oldDateStr = oldDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          const oldHeureStr = oldDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          const newDateStr = newDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          const newHeureStr = newDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

          // Send reschedule email
          sendRescheduleEmail({
            to: athleteEmail,
            recipientPrenom: athletePrenom || "Patient",
            proName: proFullName,
            oldDate: oldDateStr,
            oldHeure: oldHeureStr,
            newDate: newDateStr,
            newHeure: newHeureStr,
          }).catch((err) => console.error("[events PATCH] Reschedule email error:", err));

          // Create in-app notification
          await prisma.bookingReminder.create({
            data: {
              calendarEventId: id,
              athleteUserId,
              professionnelId: existing.professionnelId,
              type: "rdv_rescheduled_by_pro",
              scheduledAt: new Date(),
              sentAt: new Date(),
              channel: "inapp",
              eventTitle: existing.title || "Rendez-vous",
              eventDate: newDate,
              eventEndDate: body.endDate ? new Date(body.endDate) : existing.endDate,
              eventFormat: "presentiel",
              eventMotif: `Reprogrammé par ${proFullName} — ancienne date : ${oldDateStr} à ${oldHeureStr}`,
            },
          });
        }
      } catch (notifErr) {
        console.error("Failed to notify athlete of pro reschedule:", notifErr);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/events/:id error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "events" });

// DELETE /api/events/:id
export const DELETE = withAuth(async (_request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;

    const existing = await prisma.calendarEvent.findFirst({
      where: { id, professionnelId: pro.id },
      select: {
        id: true, date: true, endDate: true, title: true, athleteUserId: true, athleteId: true, professionnelId: true,
        professionnel: { select: { nom: true, prenom: true } },
      },
    });
    if (!existing) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

    await softDelete("calendarEvent", id, pro.id);

    // Dismiss all pending reminders for this event
    await prisma.bookingReminder.updateMany({
      where: { calendarEventId: id, sentAt: null },
      data: { dismissed: true },
    });

    // ── Notify the athlete (email + in-app) ──
    try {
      // Resolve athleteUserId (direct or via legacy Athlete record)
      let athleteUserId = existing.athleteUserId;
      let athleteEmail: string | null = null;
      let athletePrenom: string | null = null;

      if (athleteUserId) {
        const au = await prisma.athleteUser.findUnique({
          where: { id: athleteUserId },
          select: { email: true, prenom: true },
        });
        athleteEmail = au?.email || null;
        athletePrenom = au?.prenom || null;
      } else if (existing.athleteId) {
        // Legacy: resolve via Athlete.contactEmail → AthleteUser
        const athlete = await prisma.athlete.findUnique({
          where: { id: existing.athleteId },
          select: { contactEmail: true, name: true },
        });
        if (athlete?.contactEmail) {
          const au = await prisma.athleteUser.findFirst({
            where: { email: { equals: athlete.contactEmail, mode: "insensitive" } },
            select: { id: true, email: true, prenom: true },
          });
          if (au) {
            athleteUserId = au.id;
            athleteEmail = au.email;
            athletePrenom = au.prenom || athlete.name?.split(" ")[0] || null;
          }
        }
      }

      if (athleteUserId && athleteEmail) {
        const proFullName = `${existing.professionnel?.prenom || ""} ${existing.professionnel?.nom || ""}`.trim();
        const eventDate = existing.date;
        const dateStr = eventDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        const heureStr = eventDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

        // Send cancellation email to athlete
        await sendCancellationEmail({
          to: athleteEmail,
          recipientPrenom: athletePrenom || "Patient",
          otherPartyName: proFullName,
          date: dateStr,
          heure: heureStr,
          motif: null,
          cancelledBy: "pro",
          refundInfo: null,
        });

        // Create in-app notification via BookingReminder
        await prisma.bookingReminder.create({
          data: {
            calendarEventId: id,
            athleteUserId,
            professionnelId: existing.professionnelId,
            type: "rdv_cancelled_by_pro",
            scheduledAt: new Date(),
            sentAt: new Date(),
            channel: "inapp",
            eventTitle: existing.title || "Rendez-vous",
            eventDate: existing.date,
            eventEndDate: existing.endDate,
            eventFormat: "presentiel",
            eventMotif: `Annulé par ${proFullName}`,
          },
        });
      }
    } catch (notifErr) {
      console.error("Failed to notify athlete of pro cancellation:", notifErr);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/events/:id error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "events" });
