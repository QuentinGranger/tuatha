import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, updateKineAlertSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

// PATCH /api/kine/alerts/[id] — update status, clinicalNote, etc.
export const PATCH = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;

    const existing = await (prisma as any).kineAlert.findUnique({ where: { id } });
    if (!existing || existing.professionnelId !== pro.id)
      return NextResponse.json({ error: "Alerte introuvable" }, { status: 404 });

    const parsed = validateBody(sanitizeBody(await request.json()), updateKineAlertSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const data: any = {};
    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === "closed") data.closedAt = new Date();
    }
    if (body.clinicalNote !== undefined) data.clinicalNote = body.clinicalNote || null;
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.detail !== undefined) data.detail = body.detail || null;
    if (body.type !== undefined) data.type = body.type;
    if (body.intensity !== undefined) data.intensity = body.intensity;

    const updated = await (prisma as any).kineAlert.update({
      where: { id },
      data,
      include: {
        athlete: { select: { id: true, name: true } },
        plan: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/kine/alerts/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:alerts" });

// DELETE /api/kine/alerts/[id]
export const DELETE = withAuth(async (_request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;

    const existing = await (prisma as any).kineAlert.findUnique({ where: { id } });
    if (!existing || existing.professionnelId !== pro.id)
      return NextResponse.json({ error: "Alerte introuvable" }, { status: 404 });

    await (prisma as any).kineAlert.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/kine/alerts/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:alerts" });
