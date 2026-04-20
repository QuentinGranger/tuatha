import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, updateMedAlertSchema } from "@/lib/validation";
import { ownMedAlert, notFound } from "@/lib/idor";
import { sanitizeBody } from "@/lib/sanitize";

export const PATCH = withAuth(async (req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownMedAlert(id, pro.id)) return notFound("Alerte introuvable");

    const parsed = validateBody(sanitizeBody(await req.json()), updateMedAlertSchema);
    if (!parsed.success) return parsed.errorResponse;

    const alert = await (prisma as any).medAlert.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error("PATCH /api/medecin/alerts/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:alerts" });

export const DELETE = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownMedAlert(id, pro.id)) return notFound("Alerte introuvable");

    await (prisma as any).medAlert.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/medecin/alerts/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:alerts" });
