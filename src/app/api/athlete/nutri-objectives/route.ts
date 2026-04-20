import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/nutri-objectives?proId=xxx
// Returns nutritional objectives for the authenticated athlete from NutriObjective,
// with fallback to the active plan targets if no explicit objectives exist.
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-nutri-obj:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const proId = searchParams.get("proId");
    if (!proId) {
      return NextResponse.json({ error: "proId requis" }, { status: 400 });
    }

    // Verify accepted connection
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté" }, { status: 403 });
    }

    // Resolve Athlete record via email
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const athlete = await (prisma as any).athlete.findFirst({
      where: {
        professionnelId: proId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Fiche athlète introuvable" }, { status: 404 });
    }

    // 1) Try explicit NutriObjective
    const obj = await (prisma as any).nutriObjective.findUnique({
      where: { athleteId_proId: { athleteId: athlete.id, proId } },
    });

    if (obj) {
      return NextResponse.json({
        source: "objective",
        goal: obj.goal,
        kcal: obj.kcal,
        protein: obj.protein,
        carbs: obj.carbs,
        fat: obj.fat,
        water: obj.water,
        weeklyRate: obj.weeklyRate,
      });
    }

    // 2) Fallback: derive from active/published plan
    const plan = await (prisma as any).nutriPlan.findFirst({
      where: {
        athleteId: athlete.id,
        proId,
        status: { in: ["publie", "en_cours"] },
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        kcalTarget: true,
        proteinTarget: true,
        carbsTarget: true,
        fatTarget: true,
        waterTarget: true,
      },
    });

    if (plan) {
      return NextResponse.json({
        source: "plan",
        goal: "sante",
        kcal: plan.kcalTarget,
        protein: plan.proteinTarget,
        carbs: plan.carbsTarget,
        fat: plan.fatTarget,
        water: plan.waterTarget ?? 2.0,
        weeklyRate: 0,
      });
    }

    // 3) No data at all — return defaults
    return NextResponse.json({
      source: "default",
      goal: "sante",
      kcal: 2000,
      protein: 120,
      carbs: 250,
      fat: 65,
      water: 2.0,
      weeklyRate: 0,
    });
  } catch (error) {
    console.error("[athlete/nutri-objectives] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
