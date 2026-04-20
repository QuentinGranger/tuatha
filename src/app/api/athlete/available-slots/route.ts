import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/athlete/available-slots?proId=xxx&period=this-week&timeSlots=matin,apres-midi&duration=30
// Generates real available slots from the pro's Disponibilite records,
// excluding already-booked CalendarEvent entries.

const DAYS_FR: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 0,
};

function dayNameToNumber(day: string): number {
  return DAYS_FR[day.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? -1;
}

// Expand a Disponibilite range (jourDebut–jourFin) into an array of day numbers
function expandDayRange(jourDebut: string, jourFin: string): number[] {
  const start = dayNameToNumber(jourDebut);
  const end = dayNameToNumber(jourFin);
  if (start === -1 || end === -1) return [];

  const days: number[] = [];
  // Handle wrap-around (e.g., Samedi–Dimanche)
  let current = start;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    days.push(current);
    if (current === end) break;
    current = (current + 1) % 7;
    if (days.length > 7) break; // safety
  }
  return days;
}

// Parse "HH:MM" to { hours, minutes }
function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(":").map(Number);
  return { hours: h || 0, minutes: m || 0 };
}

// Time slot ranges
const TIME_SLOT_RANGES: Record<string, { start: number; end: number }> = {
  matin: { start: 8, end: 12 },
  midi: { start: 12, end: 14 },
  "apres-midi": { start: 14, end: 18 },
  soir: { start: 18, end: 21 },
};

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const proId = searchParams.get("proId");
  const period = searchParams.get("period") || "any"; // this-week | next-week | this-month | any
  const timeSlotsParam = searchParams.get("timeSlots") || ""; // matin,midi,apres-midi,soir
  const durationParam = parseInt(searchParams.get("duration") || "30", 10);
  const firstAvailable = searchParams.get("firstAvailable") === "true";

  if (!proId) {
    return NextResponse.json({ error: "proId requis" }, { status: 400 });
  }

  try {
    // Verify the athlete has an accepted connection to this pro
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Pas de connexion avec ce professionnel" }, { status: 403 });
    }

    // Fetch pro's disponibilites
    const disponibilites = await prisma.disponibilite.findMany({
      where: { professionnelId: proId },
    });

    if (disponibilites.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    // Determine date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date(startDate);

    if (period === "this-week") {
      const daysUntilSunday = 7 - now.getDay();
      endDate.setDate(endDate.getDate() + daysUntilSunday);
    } else if (period === "next-week") {
      const daysUntilNextMonday = (8 - now.getDay()) % 7 || 7;
      startDate.setDate(startDate.getDate() + daysUntilNextMonday);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
    } else if (period === "this-month") {
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      // "any" → next 21 days
      endDate.setDate(endDate.getDate() + 21);
    }

    // Fetch existing events for this pro in the date range
    const existingEvents = await prisma.calendarEvent.findMany({
      where: {
        professionnelId: proId,
        deletedAt: null,
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true, endDate: true },
    });

    // Build a set of busy intervals [start, end] in epoch ms
    const busyIntervals = existingEvents.map((e) => ({
      start: new Date(e.date).getTime(),
      end: e.endDate
        ? new Date(e.endDate).getTime()
        : new Date(e.date).getTime() + 30 * 60 * 1000, // default 30 min
    }));

    // Parse active time slot filters
    const activeTimeSlots = timeSlotsParam
      ? timeSlotsParam.split(",").filter((s) => s in TIME_SLOT_RANGES)
      : [];

    const slotDuration = durationParam > 0 ? durationParam : 30;

    // Generate slots
    interface Slot {
      id: string;
      date: string; // ISO string
      duration: number;
    }

    const slots: Slot[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon, ...

      // Find matching disponibilites for this day
      for (const dispo of disponibilites) {
        const activeDays = expandDayRange(dispo.jourDebut, dispo.jourFin);
        if (!activeDays.includes(dayOfWeek)) continue;

        const startTime = parseTime(dispo.heureDebut);
        const endTime = parseTime(dispo.heureFin);

        // Generate slots within this dispo window
        let slotHour = startTime.hours;
        let slotMinute = startTime.minutes;

        while (
          slotHour < endTime.hours ||
          (slotHour === endTime.hours && slotMinute + slotDuration <= endTime.minutes)
        ) {
          const slotStart = new Date(currentDate);
          slotStart.setHours(slotHour, slotMinute, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

          // Skip slots in the past
          if (slotStart <= now) {
            slotMinute += slotDuration;
            if (slotMinute >= 60) {
              slotHour += Math.floor(slotMinute / 60);
              slotMinute = slotMinute % 60;
            }
            continue;
          }

          // Check time slot filter
          if (activeTimeSlots.length > 0) {
            const h = slotStart.getHours();
            const inRange = activeTimeSlots.some((ts) => {
              const range = TIME_SLOT_RANGES[ts];
              return h >= range.start && h < range.end;
            });
            if (!inRange) {
              slotMinute += slotDuration;
              if (slotMinute >= 60) {
                slotHour += Math.floor(slotMinute / 60);
                slotMinute = slotMinute % 60;
              }
              continue;
            }
          }

          // Check for conflicts with existing events
          const slotStartMs = slotStart.getTime();
          const slotEndMs = slotEnd.getTime();
          const hasConflict = busyIntervals.some(
            (b) => slotStartMs < b.end && slotEndMs > b.start
          );

          if (!hasConflict) {
            slots.push({
              id: `${proId}-${slotStart.toISOString()}`,
              date: slotStart.toISOString(),
              duration: slotDuration,
            });
          }

          slotMinute += slotDuration;
          if (slotMinute >= 60) {
            slotHour += Math.floor(slotMinute / 60);
            slotMinute = slotMinute % 60;
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort chronologically
    slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // If first available mode, return only the first 8
    const result = firstAvailable ? slots.slice(0, 8) : slots;

    return NextResponse.json({ slots: result, total: slots.length });
  } catch (error) {
    console.error("GET /api/athlete/available-slots:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
