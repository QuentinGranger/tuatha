import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, _ctx) => {
  try {
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const alerts = await (prisma as any).nutriAlert.findMany({
      where: { athleteId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(alerts);
  } catch (error) {
    console.error("GET /api/nutri/alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:alerts" });

export const POST = withAuth(async (req, _ctx) => {
  try {
    const body = sanitizeBody(await req.json());
    const { athleteId, type, severity, origin, title, description } = body;
    if (!athleteId || !title) return NextResponse.json({ error: "athleteId et title requis" }, { status: 400 });

    const alert = await (prisma as any).nutriAlert.create({
      data: {
        athleteId, title,
        type: type || "alert",
        severity: severity || "modere",
        origin: origin || "manual",
        description: description || null,
      },
    });
    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:alerts" });
