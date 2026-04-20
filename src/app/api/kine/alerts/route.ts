import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createKineAlertSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

// GET /api/kine/alerts?athleteId=xxx&status=unread&type=alert
export const GET = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const origin = searchParams.get("origin");

    const where: any = { professionnelId: pro.id };
    if (athleteId) where.athleteId = athleteId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (origin) where.origin = origin;

    const alerts = await (prisma as any).kineAlert.findMany({
      where,
      include: {
        athlete: { select: { id: true, name: true } },
        plan: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("GET /api/kine/alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:alerts" });

// POST /api/kine/alerts
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), createKineAlertSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const alert = await (prisma as any).kineAlert.create({
      data: {
        type: d.type,
        origin: "kine",
        title: d.title,
        description: d.description || null,
        detail: d.detail || null,
        intensity: d.intensity ?? null,
        athleteId: d.athleteId,
        planId: d.planId || null,
        professionnelId: pro.id,
      },
      include: {
        athlete: { select: { id: true, name: true } },
        plan: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error("POST /api/kine/alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:alerts" });
