import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeBody } from "@/lib/sanitize";
import { buildVisioPairRoom } from "@/lib/visio";
import { isPaymentReady } from "@/lib/accountStatus";

export const dynamic = "force-dynamic";

// POST /api/athlete/schedule-followup
// Quick-book a follow-up appointment based on a past RDV, at a suggested interval

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { pastEventId, days, proId } = sanitizeBody(await request.json());

    if (!proId || !days) {
      return NextResponse.json({ error: "proId et days requis" }, { status: 400 });
    }

    // Verify accepted connection
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Vous n'êtes pas connecté avec ce professionnel." }, { status: 403 });
    }

    // Get athlete info
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

    // Block follow-up if pro is not payment-ready
    if (!isPaymentReady(pro.accountStatus)) {
      return NextResponse.json(
        { error: "Ce professionnel n'est pas encore disponible pour les réservations. Son compte est en cours de vérification." },
        { status: 403 }
      );
    }

    // Find the Athlete record
    const athleteRecord = await prisma.athlete.findFirst({
      where: {
        professionnelId: proId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true },
    });

    // Get info from past event if provided
    let motif = "Suivi";
    let duration = 30;
    let format = "presentiel";
    if (pastEventId) {
      try {
        const pastEvent = await prisma.calendarEvent.findUnique({
          where: { id: pastEventId },
          select: { title: true, description: true, date: true, endDate: true },
        });
        if (pastEvent) {
          const descLines = (pastEvent.description || "").split("\n");
          const motifLine = descLines.find((l: string) => l.toLowerCase().startsWith("motif"));
          if (motifLine) motif = motifLine.replace(/^motif\s*:\s*/i, "").trim();
          const formatLine = descLines.find((l: string) => l.toLowerCase().startsWith("format"));
          if (formatLine?.includes("éléconsultation")) format = "teleconsultation";
          if (pastEvent.endDate && pastEvent.date) {
            duration = Math.round((new Date(pastEvent.endDate).getTime() - new Date(pastEvent.date).getTime()) / 60000);
          }
        }
      } catch { /* silent */ }
    }

    // Calculate target date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    // Set to 9:00 AM on target day
    targetDate.setHours(9, 0, 0, 0);

    const endDate = new Date(targetDate.getTime() + duration * 60000);

    // Check pro availability: fetch disponibilites for the target day
    const dayNames = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const targetDayName = dayNames[targetDate.getDay()];

    const disponibilites = await prisma.disponibilite.findMany({
      where: { professionnelId: proId },
    });

    // Verify the pro works on the target day
    const proWorksOnDay = disponibilites.some((dispo) => {
      const daysMap: Record<string, number> = {
        lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
      };
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const start = daysMap[norm(dispo.jourDebut)] ?? -1;
      const end = daysMap[norm(dispo.jourFin)] ?? -1;
      if (start === -1 || end === -1) return false;
      const dayNum = targetDate.getDay();
      // Handle wrap-around ranges
      if (start <= end) return dayNum >= start && dayNum <= end;
      return dayNum >= start || dayNum <= end;
    });

    if (!proWorksOnDay) {
      // Shift to the next available working day (up to 7 days forward)
      let shifted = false;
      for (let offset = 1; offset <= 7; offset++) {
        const candidate = new Date(targetDate);
        candidate.setDate(candidate.getDate() + offset);
        const candDay = candidate.getDay();
        const works = disponibilites.some((dispo) => {
          const daysMap: Record<string, number> = {
            lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
          };
          const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const start = daysMap[norm(dispo.jourDebut)] ?? -1;
          const end = daysMap[norm(dispo.jourFin)] ?? -1;
          if (start === -1 || end === -1) return false;
          if (start <= end) return candDay >= start && candDay <= end;
          return candDay >= start || candDay <= end;
        });
        if (works) {
          targetDate.setDate(candidate.getDate());
          targetDate.setMonth(candidate.getMonth());
          targetDate.setFullYear(candidate.getFullYear());
          endDate.setTime(targetDate.getTime() + duration * 60000);
          shifted = true;
          break;
        }
      }
      if (!shifted) {
        return NextResponse.json({ error: "Aucune disponibilité trouvée pour ce professionnel dans les 7 prochains jours" }, { status: 409 });
      }
    }

    // Pick the first available hour from the pro's dispo for this day (instead of hardcoded 9h)
    const targetDayNum = targetDate.getDay();
    for (const dispo of disponibilites) {
      const daysMap: Record<string, number> = {
        lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
      };
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const start = daysMap[norm(dispo.jourDebut)] ?? -1;
      const end = daysMap[norm(dispo.jourFin)] ?? -1;
      if (start === -1 || end === -1) continue;
      const inRange = start <= end ? (targetDayNum >= start && targetDayNum <= end) : (targetDayNum >= start || targetDayNum <= end);
      if (inRange) {
        const [sh, sm] = dispo.heureDebut.split(":").map(Number);
        targetDate.setHours(sh || 9, sm || 0, 0, 0);
        endDate.setTime(targetDate.getTime() + duration * 60000);
        break;
      }
    }

    const formatLabel = format === "teleconsultation" ? "Téléconsultation" : "Présentiel";
    const description = [
      `Motif: ${motif}`,
      `Format: ${formatLabel}`,
      `Suivi programmé automatiquement`,
    ].join("\n");

    // Atomic conflict check + create inside a transaction with advisory lock
    const event = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        proId,
      );

      const conflicting = await tx.calendarEvent.findFirst({
        where: {
          professionnelId: proId,
          deletedAt: null,
          date: { lt: endDate },
          endDate: { gt: targetDate },
        },
        select: { id: true },
      });
      if (conflicting) {
        throw new Error("SLOT_TAKEN");
      }

      const visioRoomId = format === "teleconsultation"
        ? buildVisioPairRoom("athlete", session.id, "pro", proId)
        : null;

      return tx.calendarEvent.create({
        data: {
          title: `RDV Suivi — ${athleteUser.prenom} ${athleteUser.nom}`,
          date: targetDate,
          endDate,
          type: "rdv",
          reminderMinutes: 30,
          athleteId: athleteRecord?.id || null,
          athleteUserId: session.id,
          professionnelId: proId,
          description,
          visioRoomId,
        },
      });
    });

    // Seed reminders for this follow-up (both athlete + pro)
    try {
      const isVisio = format === "teleconsultation";
      const reminderBase = {
        calendarEventId: event.id,
        athleteUserId: session.id,
        professionnelId: proId,
        eventTitle: event.title,
        eventDate: targetDate,
        eventEndDate: endDate,
        eventFormat: format,
        eventMotif: motif,
        eventAddress: format === "presentiel" ? (pro.adresseCabinet || null) : null,
        eventVisioRoomId: event.visioRoomId || null,
      };

      const remindersToCreate: Array<typeof reminderBase & { type: string; scheduledAt: Date; channel: string; recipientType: string }> = [];
      const pushForBoth = (type: string, scheduledAt: Date, channel: string) => {
        remindersToCreate.push({ ...reminderBase, type, scheduledAt, channel, recipientType: "athlete" });
        remindersToCreate.push({ ...reminderBase, type, scheduledAt, channel, recipientType: "pro" });
      };

      const j2 = new Date(targetDate); j2.setDate(j2.getDate() - 2); j2.setHours(9, 0, 0, 0);
      if (j2 > new Date()) { pushForBoth("j2", j2, "email"); pushForBoth("j2", j2, "inapp"); }

      const j1 = new Date(targetDate); j1.setDate(j1.getDate() - 1); j1.setHours(9, 0, 0, 0);
      if (j1 > new Date()) { pushForBoth("j1", j1, "email"); pushForBoth("j1", j1, "inapp"); }

      const h2 = new Date(targetDate.getTime() - 2 * 60 * 60 * 1000);
      if (h2 > new Date()) { pushForBoth("h2", h2, "email"); pushForBoth("h2", h2, "inapp"); }

      if (isVisio) {
        const h1 = new Date(targetDate.getTime() - 1 * 60 * 60 * 1000);
        if (h1 > new Date()) { pushForBoth("h1_visio", h1, "email"); pushForBoth("h1_visio", h1, "inapp"); }
        pushForBoth("now_visio", targetDate, "email");
        pushForBoth("now_visio", targetDate, "inapp");
      }

      if (remindersToCreate.length > 0) {
        await prisma.bookingReminder.createMany({ data: remindersToCreate });
      }
    } catch (e) {
      console.error("Failed to seed follow-up reminders:", e);
    }

    return NextResponse.json({
      ok: true,
      event: {
        id: event.id,
        title: event.title,
        date: event.date,
        endDate: event.endDate,
        proName: `${pro.prenom} ${pro.nom}`,
      },
    });
  } catch (error: any) {
    if (error?.message === "SLOT_TAKEN") {
      return NextResponse.json({ error: "Ce créneau est déjà pris, veuillez réserver manuellement" }, { status: 409 });
    }
    console.error("POST /api/athlete/schedule-followup error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
