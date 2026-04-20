import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, kinePlanExerciseSchema, z, uuid } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

// POST /api/kine/plans/[id]/exercises — add exercise to plan
export const POST = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;

    const plan = await (prisma as any).kinePlan.findUnique({ where: { id } });
    if (!plan || plan.professionnelId !== pro.id)
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });

    const parsed = validateBody(sanitizeBody(await request.json()), kinePlanExerciseSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const maxPos = await (prisma as any).kinePlanExercise.count({ where: { planId: id } });

    const exercise = await (prisma as any).kinePlanExercise.create({
      data: {
        position: d.position ?? maxPos,
        sets: d.sets ?? null,
        reps: d.reps || null,
        duration: d.duration || null,
        tempo: d.tempo || null,
        rest: d.rest || null,
        frequency: d.frequency || null,
        painThreshold: d.painThreshold ?? null,
        consignes: d.consignes || null,
        equipment: d.equipment || null,
        alternative: d.alternative || null,
        planId: id,
        videoId: d.videoId,
      },
      include: { video: { select: { id: true, title: true, thumbnail: true, category: true, url: true } } },
    });

    return NextResponse.json(exercise, { status: 201 });
  } catch (error) {
    console.error("POST /api/kine/plans/[id]/exercises error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:plans" });

// PATCH /api/kine/plans/[id]/exercises — update or reorder exercise
export const PATCH = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;

    const plan = await (prisma as any).kinePlan.findUnique({ where: { id } });
    if (!plan || plan.professionnelId !== pro.id)
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });

    const updateExSchema = kinePlanExerciseSchema.partial().extend({ exerciseId: uuid });
    const parsed = validateBody(sanitizeBody(await request.json()), updateExSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { exerciseId, ...fields } = parsed.data;

    const data: any = {};
    if (fields.position !== undefined) data.position = fields.position;
    if (fields.sets !== undefined) data.sets = fields.sets ?? null;
    if (fields.reps !== undefined) data.reps = fields.reps || null;
    if (fields.duration !== undefined) data.duration = fields.duration || null;
    if (fields.tempo !== undefined) data.tempo = fields.tempo || null;
    if (fields.rest !== undefined) data.rest = fields.rest || null;
    if (fields.frequency !== undefined) data.frequency = fields.frequency || null;
    if (fields.painThreshold !== undefined) data.painThreshold = fields.painThreshold ?? null;
    if (fields.consignes !== undefined) data.consignes = fields.consignes || null;
    if (fields.equipment !== undefined) data.equipment = fields.equipment || null;
    if (fields.alternative !== undefined) data.alternative = fields.alternative || null;
    if (fields.videoId !== undefined) data.videoId = fields.videoId;

    const updated = await (prisma as any).kinePlanExercise.update({
      where: { id: exerciseId },
      data,
      include: { video: { select: { id: true, title: true, thumbnail: true, category: true, url: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/kine/plans/[id]/exercises error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:plans" });

// DELETE /api/kine/plans/[id]/exercises — remove exercise (body: { exerciseId })
export const DELETE = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;

    const plan = await (prisma as any).kinePlan.findUnique({ where: { id } });
    if (!plan || plan.professionnelId !== pro.id)
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const exerciseId = searchParams.get("exerciseId");
    if (!exerciseId) return NextResponse.json({ error: "exerciseId requis" }, { status: 400 });

    await (prisma as any).kinePlanExercise.delete({ where: { id: exerciseId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/kine/plans/[id]/exercises error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:plans" });
