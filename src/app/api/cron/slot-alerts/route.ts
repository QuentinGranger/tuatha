import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSlotAlertEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/cron/slot-alerts
// Checks active slot alerts against available slots (cancelled events = freed slots).
// When a match is found, sends push/email/SMS notification.

export async function GET() {
  try {
    // Fetch all active slot alerts
    const alerts = await (prisma as any).slotAlert.findMany({
      where: { active: true, bookedEventId: null },
      include: {
        athleteUser: { select: { id: true, email: true, prenom: true, nom: true, telephone: true } },
        professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, adresseCabinet: true } },
      },
    });

    if (alerts.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let notified = 0;
    const now = new Date();

    for (const alert of alerts) {
      // Skip if already notified in last 6 hours
      if (alert.notifiedAt && now.getTime() - new Date(alert.notifiedAt).getTime() < 6 * 60 * 60 * 1000) {
        continue;
      }

      // Look for recently freed slots (cancelled events in the future for this pro)
      // A "freed slot" = a CalendarEvent that was soft-deleted (deletedAt not null) and is still in the future
      const proFilter = alert.professionnelId ? { professionnelId: alert.professionnelId } : {};

      const freedSlots = await (prisma as any).calendarEvent.findMany({
        where: {
          ...proFilter,
          deletedAt: { not: null },
          date: { gt: now },
        },
        select: { id: true, date: true, endDate: true, professionnelId: true, title: true },
        orderBy: { date: "asc" },
        take: 10,
      });

      if (freedSlots.length === 0) continue;

      // Filter by preferences
      const matchingSlots = freedSlots.filter((slot: any) => {
        const slotDate = new Date(slot.date);
        const dayOfWeek = slotDate.getDay();
        const timeStr = slotDate.toTimeString().slice(0, 5); // "HH:MM"

        // Preferred days
        if (alert.preferredDays.length > 0 && !alert.preferredDays.includes(dayOfWeek)) {
          return false;
        }

        // Time range
        if (alert.timeStart && timeStr < alert.timeStart) return false;
        if (alert.timeEnd && timeStr > alert.timeEnd) return false;

        return true;
      });

      if (matchingSlots.length === 0) continue;

      const bestSlot = matchingSlots[0];
      const slotDate = new Date(bestSlot.date);

      // Update alert with matched slot
      await (prisma as any).slotAlert.update({
        where: { id: alert.id },
        data: { notifiedAt: now, matchedSlotDate: slotDate },
      });

      // Send email notification
      try {
        const proName = alert.professionnel
          ? `${alert.professionnel.prenom} ${alert.professionnel.nom}`
          : "un praticien";

        await sendSlotAlertEmail({
          to: alert.athleteUser.email,
          athleteName: alert.athleteUser.prenom,
          proName,
          slotDate,
          alertId: alert.id,
        });
      } catch (e) {
        console.error("Failed to send slot alert email:", e);
      }

      // Create an in-app notification for the header
      // We create a BookingReminder with type "slot_freed" for in-app display
      if (alert.professionnelId) {
        try {
          await (prisma as any).bookingReminder.create({
            data: {
              calendarEventId: bestSlot.id,
              athleteUserId: alert.athleteUser.id,
              professionnelId: alert.professionnelId,
              type: "slot_freed",
              scheduledAt: now,
              sentAt: now,
              channel: "inapp",
              eventTitle: bestSlot.title || "Créneau libéré",
              eventDate: slotDate,
              eventEndDate: bestSlot.endDate,
              eventFormat: alert.format || "presentiel",
              eventMotif: alert.motif || "Consultation",
              eventAddress: alert.professionnel?.adresseCabinet || null,
            },
          });
        } catch (e) {
          console.error("Failed to create in-app slot alert:", e);
        }
      }

      notified++;
    }

    return NextResponse.json({ processed: alerts.length, notified });
  } catch (error) {
    console.error("GET /api/cron/slot-alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
