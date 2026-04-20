import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownSession, notFound } from "@/lib/idor";
import { softDelete } from "@/lib/softDelete";
import { sanitizeBody } from "@/lib/sanitize";

const INCLUDE_FULL = {
  athlete: { select: { id: true, name: true, sport: true, status: true } },
  blocks: {
    orderBy: { position: "asc" as const },
    include: { exercises: { orderBy: { position: "asc" as const } } },
  },
};

// GET /api/programmes/[id]
export const GET = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    const session = await prisma.session.findFirst({
      where: { id, professionnelId: pro.id },
      include: INCLUDE_FULL,
    });

    if (!session) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
    return NextResponse.json(session);
  } catch (error) {
    console.error("GET /api/programmes/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "sessions" });

// PATCH /api/programmes/[id]
export const PATCH = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownSession(id, pro.id)) return notFound("Séance introuvable");

    const body = sanitizeBody(await request.json());
    const data: Record<string, unknown> = {};

    const stringFields = [
      "name", "time", "lieu", "objectif", "notePro",
      "rpeCible", "zoneCardio", "douleurZone", "feedbackAthlete",
      "analysePro", "recommandation",
    ];
    for (const f of stringFields) {
      if (body[f] !== undefined) data[f] = body[f] || null;
    }
    if (body.status !== undefined) {
      data.status = body.status;
      // Auto-show to athlete when status moves past brouillon
      if (body.status !== "brouillon") data.visibleAthlete = true;
    }
    if (body.date !== undefined) data.date = new Date(body.date);
    if (body.athleteId !== undefined) data.athleteId = body.athleteId || null;
    if (body.visibleAthlete !== undefined) data.visibleAthlete = body.visibleAthlete;
    if (body.visiblePros !== undefined) data.visiblePros = body.visiblePros;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.contraintes !== undefined) data.contraintes = body.contraintes;
    if (body.criteresArret !== undefined) data.criteresArret = body.criteresArret;
    if (body.focusTechnique !== undefined) data.focusTechnique = body.focusTechnique;
    if (body.rpeRessenti !== undefined) data.rpeRessenti = body.rpeRessenti != null ? parseInt(body.rpeRessenti) : null;
    if (body.douleur !== undefined) data.douleur = body.douleur != null ? parseInt(body.douleur) : null;

    const session = await prisma.session.update({
      where: { id },
      data,
      include: INCLUDE_FULL,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("PATCH /api/programmes/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "sessions" });

// DELETE /api/programmes/[id]
export const DELETE = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownSession(id, pro.id)) return notFound("Séance introuvable");

    await softDelete("session", id, pro.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/programmes/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "sessions" });
