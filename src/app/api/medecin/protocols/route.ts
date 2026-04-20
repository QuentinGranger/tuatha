import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createProtocolSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const protocols = await (prisma as any).medProtocol.findMany({
      where: { athleteId, proId: session.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(protocols.map((p: any) => ({
      ...p,
      phases: JSON.parse(p.phasesJson || "[]"),
    })));
  } catch (error) {
    console.error("GET /api/medecin/protocols error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:protocols" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const parsed = validateBody(sanitizeBody(await req.json()), createProtocolSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const protocol = await (prisma as any).medProtocol.create({
      data: {
        athleteId: d.athleteId,
        proId: session.id,
        name: d.name,
        description: d.description || null,
        objectives: d.objectives,
        phasesJson: d.phasesJson,
        linkedTemplates: d.linkedTemplates,
        status: d.status,
      },
    });

    return NextResponse.json({ ...protocol, phases: JSON.parse(protocol.phasesJson || "[]") }, { status: 201 });
  } catch (error) {
    console.error("POST /api/medecin/protocols error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:protocols" });
