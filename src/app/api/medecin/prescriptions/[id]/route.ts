import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, updatePrescriptionSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

export const PATCH = withAuth(async (req, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;
    const parsed = validateBody(sanitizeBody(await req.json()), updatePrescriptionSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const existing = await (prisma as any).medPrescription.findFirst({ where: { id, proId: session.id } });
    if (!existing) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

    const data: Record<string, any> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.title !== undefined) data.title = body.title;
    if (body.contentJson !== undefined) data.contentJson = body.contentJson;
    if (body.dateEnd !== undefined) data.dateEnd = body.dateEnd ? new Date(body.dateEnd) : null;
    if (body.redFlags !== undefined) data.redFlags = body.redFlags;
    if (body.visiblePatient !== undefined) data.visiblePatient = body.visiblePatient;

    const updated = await (prisma as any).medPrescription.update({ where: { id }, data });
    return NextResponse.json({ ...updated, content: JSON.parse(updated.contentJson || "[]") });
  } catch (error) {
    console.error("PATCH /api/medecin/prescriptions/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:prescriptions" });
