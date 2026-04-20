import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownNutriMeal, notFound } from "@/lib/idor";
import { sanitizeBody } from "@/lib/sanitize";

export const PATCH = withAuth(async (req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriMeal(id, pro.id)) return notFound("Repas introuvable");

    const body = sanitizeBody(await req.json());

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.time !== undefined) data.time = body.time;
    if (body.position !== undefined) data.position = body.position;
    if (body.rule !== undefined) data.rule = body.rule;

    const updated = await (prisma as any).nutriMeal.update({
      where: { id },
      data,
      include: { items: { orderBy: { position: "asc" }, include: { alternatives: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/nutri/meals/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:meals" });

export const DELETE = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriMeal(id, pro.id)) return notFound("Repas introuvable");

    await (prisma as any).nutriMeal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/nutri/meals/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:meals" });
