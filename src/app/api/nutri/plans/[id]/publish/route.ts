import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownNutriPlan, notFound } from "@/lib/idor";
import { sanitizeBody } from "@/lib/sanitize";

export const POST = withAuth(async (req, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriPlan(id, session.id)) return notFound("Plan introuvable");

    const body = sanitizeBody(await req.json().catch(() => ({})));
    const startDate = body.startDate ? new Date(body.startDate) : null;

    const plan = await (prisma as any).nutriPlan.findUnique({
      where: { id },
      include: { meals: { include: { items: { include: { alternatives: true } } } } },
    });
    if (!plan) return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });

    const snapshot = JSON.stringify({ meals: plan.meals, objectives: { kcalTarget: plan.kcalTarget, proteinTarget: plan.proteinTarget, carbsTarget: plan.carbsTarget, fatTarget: plan.fatTarget } });
    const newVersion = plan.version + 1;

    await (prisma as any).nutriPlanVersion.create({
      data: { planId: id, version: newVersion, snapshot },
    });

    const updated = await (prisma as any).nutriPlan.update({
      where: { id },
      data: {
        status: "publie",
        version: newVersion,
        ...(startDate ? { startDate } : {}),
      },
      include: { meals: { include: { items: { include: { alternatives: true } } } }, versions: { orderBy: { version: "desc" } } },
    });

    // Sync NutriObjective so indicateurs page uses the same targets
    await (prisma as any).nutriObjective.upsert({
      where: { athleteId_proId: { athleteId: plan.athleteId, proId: session.id } },
      update: {
        goal: plan.notePro?.includes("masse") ? "prise_masse" : plan.notePro?.includes("sèche") || plan.notePro?.includes("seche") ? "seche" : "sante",
        kcal: plan.kcalTarget,
        protein: plan.proteinTarget,
        carbs: plan.carbsTarget,
        fat: plan.fatTarget,
        water: plan.waterTarget ?? 2.0,
      },
      create: {
        athleteId: plan.athleteId,
        proId: session.id,
        kcal: plan.kcalTarget,
        protein: plan.proteinTarget,
        carbs: plan.carbsTarget,
        fat: plan.fatTarget,
        water: plan.waterTarget ?? 2.0,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/nutri/plans/[id]/publish error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:plans" });
