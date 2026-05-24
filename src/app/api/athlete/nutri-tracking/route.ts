import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/athlete/nutri-tracking?date=YYYY-MM-DD
// Returns all consumed item IDs for a given date (defaults to today)
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const dateParam = request.nextUrl.searchParams.get("date");
  const date = dateParam ? new Date(dateParam + "T00:00:00") : new Date(new Date().toISOString().split("T")[0] + "T00:00:00");

  const logs = await (prisma as any).nutriDayLog.findMany({
    where: {
      athleteUserId: session.id,
      date,
      consumed: true,
    },
    select: { mealItemId: true },
  });

  return NextResponse.json({
    date: date.toISOString().split("T")[0],
    consumedItemIds: logs.map((l: any) => l.mealItemId),
  });
}

// POST /api/athlete/nutri-tracking
// Body: { mealItemId: string, consumed: boolean, date?: "YYYY-MM-DD" }
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { mealItemId, consumed, date: dateParam } = body;

  if (!mealItemId || typeof consumed !== "boolean") {
    return NextResponse.json({ error: "mealItemId et consumed requis" }, { status: 400 });
  }

  const date = dateParam ? new Date(dateParam + "T00:00:00") : new Date(new Date().toISOString().split("T")[0] + "T00:00:00");

  const log = await (prisma as any).nutriDayLog.upsert({
    where: {
      date_athleteUserId_mealItemId: {
        date,
        athleteUserId: session.id,
        mealItemId,
      },
    },
    update: { consumed },
    create: {
      date,
      athleteUserId: session.id,
      mealItemId,
      consumed,
    },
  });

  return NextResponse.json({ ok: true, log });
}
