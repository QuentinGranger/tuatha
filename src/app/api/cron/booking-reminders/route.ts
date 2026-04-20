import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingReminderEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/cron/booking-reminders
// Called periodically (every 5 min via Vercel cron or external scheduler).
// Finds all unsent reminders whose scheduledAt <= now and sends them.

export async function GET(request: NextRequest) {
  // Optional: protect with a secret header for cron security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find all due reminders that haven't been sent or dismissed
    const dueReminders = await (prisma as any).bookingReminder.findMany({
      where: {
        sentAt: null,
        dismissed: false,
        scheduledAt: { lte: now },
        // Don't send reminders for events that have already passed
        eventDate: { gt: new Date(now.getTime() - 30 * 60 * 1000) },
      },
      include: {
        athleteUser: { select: { email: true, prenom: true, nom: true } },
        professionnel: { select: { nom: true, prenom: true, specialite: true, telephone: true, email: true, adresseCabinet: true } },
        calendarEvent: { select: { deletedAt: true } },
      },
      take: 50, // batch limit
      orderBy: { scheduledAt: "asc" },
    });

    let sent = 0;
    let skipped = 0;

    for (const reminder of dueReminders) {
      // Skip if the event was soft-deleted (cancelled)
      if (reminder.calendarEvent?.deletedAt) {
        await (prisma as any).bookingReminder.update({
          where: { id: reminder.id },
          data: { dismissed: true },
        });
        skipped++;
        continue;
      }

      // Process based on channel
      if (reminder.channel === "email") {
        const validTypes = ["j2", "j1", "h2", "h1_visio", "now_visio"] as const;
        const reminderType = validTypes.includes(reminder.type as any)
          ? (reminder.type as "j2" | "j1" | "h2" | "h1_visio" | "now_visio")
          : "j1";

        const dateLabel = new Date(reminder.eventDate).toLocaleDateString("fr-FR", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        });
        const heureLabel = new Date(reminder.eventDate).toLocaleTimeString("fr-FR", {
          hour: "2-digit", minute: "2-digit",
        });

        const durationMs = reminder.eventEndDate
          ? new Date(reminder.eventEndDate).getTime() - new Date(reminder.eventDate).getTime()
          : 30 * 60 * 1000;
        const durationMin = Math.round(durationMs / 60000);

        const isPro = reminder.recipientType === "pro";
        const recipientEmail = isPro ? reminder.professionnel.email : reminder.athleteUser.email;
        const recipientPrenom = isPro ? reminder.professionnel.prenom : reminder.athleteUser.prenom;
        const displayName = isPro
          ? `${reminder.athleteUser.prenom} ${reminder.athleteUser.nom}`
          : `${reminder.professionnel.prenom} ${reminder.professionnel.nom}`;
        const displaySpec = isPro ? "Patient" : reminder.professionnel.specialite;

        if (!recipientEmail) {
          // Pro has no email — skip
          await (prisma as any).bookingReminder.update({ where: { id: reminder.id }, data: { dismissed: true } });
          skipped++;
          continue;
        }

        try {
          await sendBookingReminderEmail({
            to: recipientEmail,
            prenom: recipientPrenom,
            type: reminderType,
            proName: displayName,
            proSpecialite: displaySpec,
            proTelephone: isPro ? null : (reminder.professionnel.telephone || null),
            proEmail: isPro ? null : (reminder.professionnel.email || null),
            date: dateLabel,
            heure: heureLabel,
            duree: `${durationMin} min`,
            motif: reminder.eventMotif,
            format: reminder.eventFormat as "presentiel" | "teleconsultation",
            lieu: reminder.eventAddress || reminder.professionnel.adresseCabinet || null,
            documents: isPro ? null : (reminder.eventDocuments || null),
            visioRoomId: reminder.eventVisioRoomId || null,
          });
        } catch (err) {
          console.error(`[cron] Failed to send email reminder ${reminder.id}:`, err);
          // Don't mark as sent so it gets retried next run
          continue;
        }
      }

      // For inapp channel: just mark as sent — the client will fetch unsent inapp reminders
      // (inapp reminders are displayed by the GET /api/athlete/booking-reminders endpoint)

      // Mark as sent
      await (prisma as any).bookingReminder.update({
        where: { id: reminder.id },
        data: { sentAt: now },
      });
      sent++;
    }

    console.log(`[cron] Booking reminders: ${sent} sent, ${skipped} skipped`);
    return NextResponse.json({ ok: true, sent, skipped });
  } catch (error) {
    console.error("[cron] booking-reminders error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
