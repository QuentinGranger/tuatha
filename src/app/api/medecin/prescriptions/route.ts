import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createPrescriptionSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const prescriptions = await (prisma as any).medPrescription.findMany({
      where: { athleteId, proId: session.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(prescriptions.map((p: any) => ({
      ...p,
      content: JSON.parse(p.contentJson || "[]"),
    })));
  } catch (error) {
    console.error("GET /api/medecin/prescriptions error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:prescriptions" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const parsed = validateBody(sanitizeBody(await req.json()), createPrescriptionSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const prescription = await (prisma as any).medPrescription.create({
      data: {
        athleteId: d.athleteId,
        proId: session.id,
        type: d.type,
        title: d.title,
        contentJson: d.contentJson,
        dateStart: new Date(d.dateStart),
        dateEnd: d.dateEnd ? new Date(d.dateEnd) : null,
        redFlags: d.redFlags,
        visiblePatient: d.visiblePatient,
        linkedProtocolId: d.linkedProtocolId || null,
        status: d.status,
      },
    });

    return NextResponse.json({ ...prescription, content: JSON.parse(prescription.contentJson || "[]") }, { status: 201 });
  } catch (error) {
    console.error("POST /api/medecin/prescriptions error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:prescriptions" });
