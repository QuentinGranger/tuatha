import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { softDelete } from "@/lib/softDelete";
import { validateBody, updateKinePlanSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

/**
 * Resolve an athlete ID that may be either an Athlete.id or an AthleteUser.id.
 * If it's an AthleteUser.id, find-or-create a proper Athlete record.
 */
async function resolveAthleteId(rawId: string, proId: string): Promise<string | null> {
  if (!rawId) return null;
  const existing = await prisma.athlete.findFirst({
    where: { id: rawId, professionnelId: proId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const conn = await prisma.connectionRequest.findFirst({
    where: { athleteUserId: rawId, professionnelId: proId, status: "accepted" },
    include: { athleteUser: { select: { id: true, nom: true, prenom: true, email: true, sport: true } } },
  });
  if (!conn?.athleteUser) return null;
  const au = conn.athleteUser;

  const byEmail = await prisma.athlete.findFirst({
    where: { professionnelId: proId, contactEmail: { equals: au.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (byEmail) return byEmail.id;

  const created = await prisma.athlete.create({
    data: { name: `${au.prenom} ${au.nom}`, sport: au.sport || null, contactEmail: au.email, consentement: true, consentementDate: new Date(), professionnelId: proId },
  });
  return created.id;
}

// PATCH /api/kine/plans/[id]
export const PATCH = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;

    const existing = await (prisma as any).kinePlan.findUnique({ where: { id } });
    if (!existing || existing.professionnelId !== pro.id)
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });

    const parsed = validateBody(sanitizeBody(await request.json()), updateKinePlanSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;
    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.objective !== undefined) data.objective = body.objective;
    if (body.pathology !== undefined) data.pathology = body.pathology || null;
    if (body.phase !== undefined) data.phase = body.phase || null;
    if (body.globalProgress !== undefined) data.globalProgress = body.globalProgress;
    if (body.notesPro !== undefined) data.notesPro = body.notesPro;
    if (body.notesPatient !== undefined) data.notesPatient = body.notesPatient;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.frequency !== undefined) data.frequency = body.frequency;
    if (body.nextRdvDate !== undefined) data.nextRdvDate = body.nextRdvDate ? new Date(body.nextRdvDate) : null;
    if (body.nextRdvTime !== undefined) data.nextRdvTime = body.nextRdvTime || null;
    if (body.nextRdvLocation !== undefined) data.nextRdvLocation = body.nextRdvLocation || null;
    if (body.status !== undefined) data.status = body.status;
    if (body.conclusion !== undefined) data.conclusion = body.conclusion || null;
    if (body.outcomeScore !== undefined) data.outcomeScore = body.outcomeScore;
    if (body.athleteId !== undefined) data.athleteId = body.athleteId ? await resolveAthleteId(body.athleteId, pro.id) : null;

    const updated = await (prisma as any).kinePlan.update({
      where: { id },
      data,
      include: {
        athlete: { select: { id: true, name: true } },
        exercises: {
          include: { video: { select: { id: true, title: true, thumbnail: true, category: true, url: true } } },
          orderBy: { position: "asc" },
        },
        _count: { select: { logs: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/kine/plans/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:plans" });

// DELETE /api/kine/plans/[id]
export const DELETE = withAuth(async (_request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;

    const existing = await (prisma as any).kinePlan.findUnique({ where: { id } });
    if (!existing || existing.professionnelId !== pro.id)
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });

    await softDelete("kinePlan", id, pro.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/kine/plans/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:plans" });
