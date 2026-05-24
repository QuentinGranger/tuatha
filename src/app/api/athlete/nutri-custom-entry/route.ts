import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST – add a custom food entry to a meal
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { nutriMealId, name, quantity, unit, kcal, protein, carbs, fat, date: dateParam } = body;

  if (!nutriMealId || !name) {
    return NextResponse.json({ error: "nutriMealId et name requis" }, { status: 400 });
  }

  // Verify the meal belongs to a day log owned by this athlete
  const meal = await (prisma as any).nutriMeal.findUnique({
    where: { id: nutriMealId },
    select: { dayLog: { select: { athleteUserId: true } } },
  });
  if (!meal?.dayLog || meal.dayLog.athleteUserId !== session.id) {
    return NextResponse.json({ error: "Repas introuvable" }, { status: 404 });
  }

  const date = dateParam
    ? new Date(dateParam + "T00:00:00")
    : new Date(new Date().toISOString().split("T")[0] + "T00:00:00");

  const entry = await (prisma as any).nutriCustomEntry.create({
    data: {
      date,
      athleteUserId: session.id,
      nutriMealId,
      name,
      quantity: quantity || 1,
      unit: unit || "portion",
      kcal: kcal || 0,
      protein: protein || 0,
      carbs: carbs || 0,
      fat: fat || 0,
    },
  });

  return NextResponse.json({ ok: true, entry });
}

// DELETE – remove a custom food entry
export async function DELETE(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }

  const entry = await (prisma as any).nutriCustomEntry.findUnique({ where: { id } });
  if (!entry || entry.athleteUserId !== session.id) {
    return NextResponse.json({ error: "Entrée non trouvée" }, { status: 404 });
  }

  await (prisma as any).nutriCustomEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
