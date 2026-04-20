import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownNutriPlan, notFound } from "@/lib/idor";
import { softDelete } from "@/lib/softDelete";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriPlan(id, pro.id)) return notFound("Plan introuvable");

    const plan = await (prisma as any).nutriPlan.findUnique({
      where: { id },
      include: {
        meals: {
          orderBy: { position: "asc" },
          include: {
            items: {
              orderBy: { position: "asc" },
              include: { alternatives: true },
            },
          },
        },
        versions: { orderBy: { version: "desc" } },
      },
    });
    if (!plan) return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    return NextResponse.json(plan);
  } catch (error) {
    console.error("GET /api/nutri/plans/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:plans" });

export const PATCH = withAuth(async (req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriPlan(id, pro.id)) return notFound("Plan introuvable");

    const body = sanitizeBody(await req.json());

    const allowed = ["name", "status", "kcalTarget", "proteinTarget", "carbsTarget", "fatTarget", "fiberTarget", "saltTarget", "waterTarget", "proteinPct", "carbsPct", "fatPct", "notePatient", "notePro", "startDate", "version"];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (data.startDate && typeof data.startDate === "string") {
      data.startDate = new Date(data.startDate as string);
    }

    const updated = await (prisma as any).nutriPlan.update({
      where: { id },
      data,
      include: {
        meals: {
          orderBy: { position: "asc" },
          include: { items: { orderBy: { position: "asc" }, include: { alternatives: true } } },
        },
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/nutri/plans/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:plans" });

export const DELETE = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriPlan(id, pro.id)) return notFound("Plan introuvable");

    await softDelete("nutriPlan", id, pro.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/nutri/plans/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:plans" });
