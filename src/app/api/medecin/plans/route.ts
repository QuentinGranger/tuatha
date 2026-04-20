import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createMedPlanSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    // Return the latest plan for this athlete
    const plan = await (prisma as any).medPlan.findFirst({
      where: { athleteId, proId: session.id },
      orderBy: { updatedAt: "desc" },
    });

    if (!plan) return NextResponse.json(null);

    return NextResponse.json({
      ...plan,
      conduite: JSON.parse(plan.conduiteJson || "[]"),
      restrictions: JSON.parse(plan.restrictionsJson || "[]"),
      nextSteps: JSON.parse(plan.nextStepsJson || "[]"),
    });
  } catch (error) {
    console.error("GET /api/medecin/plans error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:plans" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const parsed = validateBody(sanitizeBody(await req.json()), createMedPlanSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    // Upsert: find existing plan for this athlete or create new
    const existing = await (prisma as any).medPlan.findFirst({
      where: { athleteId: d.athleteId, proId: session.id },
      orderBy: { updatedAt: "desc" },
    });

    let plan;
    const data = {
      episode: d.episode,
      patientStatus: d.patientStatus,
      conduiteJson: d.conduiteJson,
      restrictionsJson: d.restrictionsJson,
      nextStepsJson: d.nextStepsJson,
    };

    if (existing) {
      plan = await (prisma as any).medPlan.update({
        where: { id: existing.id },
        data,
      });
    } else {
      plan = await (prisma as any).medPlan.create({
        data: { ...data, athleteId: d.athleteId, proId: session.id },
      });
    }

    return NextResponse.json({
      ...plan,
      conduite: JSON.parse(plan.conduiteJson || "[]"),
      restrictions: JSON.parse(plan.restrictionsJson || "[]"),
      nextSteps: JSON.parse(plan.nextStepsJson || "[]"),
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("POST /api/medecin/plans error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:plans" });
