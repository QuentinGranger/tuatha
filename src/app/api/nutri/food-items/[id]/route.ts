import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownNutriFoodItem, notFound } from "@/lib/idor";
import { sanitizeBody } from "@/lib/sanitize";

export const PATCH = withAuth(async (req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriFoodItem(id, pro.id)) return notFound("Aliment introuvable");

    const body = sanitizeBody(await req.json());

    const allowed = ["name", "quantity", "unit", "kcal", "protein", "carbs", "fat", "category", "mandatory", "position"];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) data[k] = body[k];
    }

    const updated = await (prisma as any).nutriFoodItem.update({
      where: { id },
      data,
      include: { alternatives: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/nutri/food-items/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:food-items" });

export const DELETE = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriFoodItem(id, pro.id)) return notFound("Aliment introuvable");

    await (prisma as any).nutriFoodItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/nutri/food-items/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:food-items" });
