import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownNutriAlert, notFound } from "@/lib/idor";
import { sanitizeBody } from "@/lib/sanitize";

export const PATCH = withAuth(async (req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriAlert(id, pro.id)) return notFound("Alerte introuvable");

    const body = sanitizeBody(await req.json());

    const data: Record<string, unknown> = {};
    if (typeof body.severity === "string") data.severity = body.severity;
    if (typeof body.status === "string") data.status = body.status;
    if (typeof body.action === "string") data.action = body.action;
    if (typeof body.closedNote === "string") data.closedNote = body.closedNote;

    const updated = await (prisma as any).nutriAlert.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/nutri/alerts/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:alerts" });

export const DELETE = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriAlert(id, pro.id)) return notFound("Alerte introuvable");

    await (prisma as any).nutriAlert.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/nutri/alerts/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:alerts" });
