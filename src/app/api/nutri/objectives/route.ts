import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, nutriObjectiveSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const obj = await (prisma as any).nutriObjective.findUnique({
      where: { athleteId_proId: { athleteId, proId: session.id } },
    });
    return NextResponse.json(obj);
  } catch (error) {
    console.error("GET /api/nutri/objectives error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:objectives" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const parsed = validateBody(sanitizeBody(await req.json()), nutriObjectiveSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const obj = await (prisma as any).nutriObjective.upsert({
      where: { athleteId_proId: { athleteId: d.athleteId, proId: session.id } },
      update: { goal: d.goal, kcal: d.kcal, protein: d.protein, carbs: d.carbs, fat: d.fat, water: d.water, weeklyRate: d.weeklyRate },
      create: { athleteId: d.athleteId, proId: session.id, goal: d.goal, kcal: d.kcal, protein: d.protein, carbs: d.carbs, fat: d.fat, water: d.water, weeklyRate: d.weeklyRate },
    });
    return NextResponse.json(obj);
  } catch (error) {
    console.error("POST /api/nutri/objectives error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:objectives" });
