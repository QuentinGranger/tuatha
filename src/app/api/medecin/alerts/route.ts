import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createMedAlertSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const alerts = await (prisma as any).medAlert.findMany({
      where: { athleteId, proId: session.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("GET /api/medecin/alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:alerts" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const parsed = validateBody(sanitizeBody(await req.json()), createMedAlertSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const alert = await (prisma as any).medAlert.create({
      data: {
        athleteId: d.athleteId,
        proId: session.id,
        severity: d.severity,
        source: d.source,
        title: d.title,
        description: d.description,
        context: d.context || null,
        commentMedecin: d.commentMedecin || null,
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error("POST /api/medecin/alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:alerts" });
