import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownBlock, ownExercise, notFound } from "@/lib/idor";
import { sanitizeBody } from "@/lib/sanitize";

// POST /api/programmes/[id]/exercises — add exercise to a block
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;
    const body = sanitizeBody(await request.json());
    const { blockId, name, sets, reps, duration, distance, intensity, tempo, repos, consignes, videoUrl } = body;

    if (!blockId || !name) return NextResponse.json({ error: "blockId et name requis" }, { status: 400 });
    if (!await ownBlock(blockId, pro.id)) return notFound("Bloc introuvable");

    const maxPos = await prisma.exercise.count({ where: { blockId } });

    const exercise = await prisma.exercise.create({
      data: {
        name,
        sets: sets || null,
        reps: reps || null,
        duration: duration || null,
        distance: distance || null,
        intensity: intensity || null,
        tempo: tempo || null,
        repos: repos || null,
        consignes: consignes || null,
        videoUrl: videoUrl || null,
        position: maxPos,
        blockId,
      },
    });

    return NextResponse.json(exercise, { status: 201 });
  } catch (error) {
    console.error("POST /api/programmes/[id]/exercises error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "sessions" });

// PATCH /api/programmes/[id]/exercises — update an exercise
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;
    const body = sanitizeBody(await request.json());
    const { exerciseId, ...fields } = body;
    if (!exerciseId) return NextResponse.json({ error: "exerciseId requis" }, { status: 400 });
    if (!await ownExercise(exerciseId, pro.id)) return notFound("Exercice introuvable");

    const data: Record<string, unknown> = {};
    for (const f of ["name", "sets", "reps", "duration", "distance", "intensity", "tempo", "repos", "consignes", "videoUrl"]) {
      if (fields[f] !== undefined) data[f] = fields[f] || null;
    }
    if (fields.position !== undefined) data.position = fields.position;

    const exercise = await prisma.exercise.update({ where: { id: exerciseId }, data });
    return NextResponse.json(exercise);
  } catch (error) {
    console.error("PATCH /api/programmes/[id]/exercises error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "sessions" });

// DELETE /api/programmes/[id]/exercises — delete exercise by exerciseId in body
export const DELETE = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;
    const { exerciseId } = await request.json();
    if (!exerciseId) return NextResponse.json({ error: "exerciseId requis" }, { status: 400 });
    if (!await ownExercise(exerciseId, pro.id)) return notFound("Exercice introuvable");

    await prisma.exercise.delete({ where: { id: exerciseId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/programmes/[id]/exercises error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "sessions" });
