import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createOrdonnanceSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";
import { logAccess } from "@/lib/privacyGuard";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    logAccess(athleteId, session.id, "view_ordonnance");
    const ordonnances = await (prisma as any).medOrdonnance.findMany({
      where: { athleteId, proId: session.id },
      orderBy: { createdAt: "desc" },
    });

    // Parse contentJson for each ordonnance
    return NextResponse.json(ordonnances.map((o: any) => ({
      ...o,
      content: JSON.parse(o.contentJson || "{}"),
    })));
  } catch (error) {
    console.error("GET /api/medecin/ordonnances error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:ordonnances" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const parsed = validateBody(sanitizeBody(await req.json()), createOrdonnanceSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const ordonnance = await (prisma as any).medOrdonnance.create({
      data: {
        athleteId: d.athleteId,
        proId: session.id,
        type: d.type,
        status: d.status,
        diagnosis: d.diagnosis,
        contentJson: JSON.stringify(d.content || {}),
        episode: d.episode || null,
        validUntil: d.validUntil ? new Date(d.validUntil) : null,
        signedAt: d.signedAt ? new Date(d.signedAt) : null,
        signatureData: d.signatureData || null,
      },
    });

    return NextResponse.json({ ...ordonnance, content: JSON.parse(ordonnance.contentJson || "{}") }, { status: 201 });
  } catch (error) {
    console.error("POST /api/medecin/ordonnances error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:ordonnances" });
