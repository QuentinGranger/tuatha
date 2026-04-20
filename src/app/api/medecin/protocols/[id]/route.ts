import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { softDelete } from "@/lib/softDelete";
import { validateBody, updateProtocolSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

export const PATCH = withAuth(async (req, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;
    const parsed = validateBody(sanitizeBody(await req.json()), updateProtocolSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const existing = await (prisma as any).medProtocol.findFirst({ where: { id, proId: session.id } });
    if (!existing) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

    const data: Record<string, any> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.objectives !== undefined) data.objectives = body.objectives;
    if (body.phasesJson !== undefined) data.phasesJson = body.phasesJson;
    if (body.linkedTemplates !== undefined) data.linkedTemplates = body.linkedTemplates;
    if (body.status !== undefined) data.status = body.status;

    const updated = await (prisma as any).medProtocol.update({ where: { id }, data });
    return NextResponse.json({ ...updated, phases: JSON.parse(updated.phasesJson || "[]") });
  } catch (error) {
    console.error("PATCH /api/medecin/protocols/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:protocols" });

export const DELETE = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;

    const existing = await (prisma as any).medProtocol.findFirst({ where: { id, proId: session.id } });
    if (!existing) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

    await softDelete("medProtocol", id, session.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/medecin/protocols/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:protocols" });
