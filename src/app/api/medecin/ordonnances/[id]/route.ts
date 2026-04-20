import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { softDelete } from "@/lib/softDelete";
import { validateBody, updateOrdonnanceSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

export const PATCH = withAuth(async (req, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;
    const parsed = validateBody(sanitizeBody(await req.json()), updateOrdonnanceSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const existing = await (prisma as any).medOrdonnance.findFirst({ where: { id, proId: session.id } });
    if (!existing) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

    const data: Record<string, any> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.diagnosis !== undefined) data.diagnosis = body.diagnosis;
    if (body.content !== undefined) data.contentJson = JSON.stringify(body.content);
    if (body.episode !== undefined) data.episode = body.episode || null;
    if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (body.signedAt !== undefined) data.signedAt = body.signedAt ? new Date(body.signedAt) : null;
    if (body.signatureData !== undefined) data.signatureData = body.signatureData;

    const updated = await (prisma as any).medOrdonnance.update({ where: { id }, data });
    return NextResponse.json({ ...updated, content: JSON.parse(updated.contentJson || "{}") });
  } catch (error) {
    console.error("PATCH /api/medecin/ordonnances/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:ordonnances" });

export const DELETE = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;

    const existing = await (prisma as any).medOrdonnance.findFirst({ where: { id, proId: session.id } });
    if (!existing) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

    await softDelete("medOrdonnance", id, session.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/medecin/ordonnances/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:ordonnances" });
