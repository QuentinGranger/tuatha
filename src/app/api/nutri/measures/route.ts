import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, _ctx) => {
  try {
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const measures = await (prisma as any).nutriMeasure.findMany({
      where: { athleteId },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(measures);
  } catch (error) {
    console.error("GET /api/nutri/measures error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:measures" });

export const POST = withAuth(async (req, _ctx) => {
  try {
    const body = sanitizeBody(await req.json());
    const { athleteId, date, weight, bmi, bodyFat, waist, hydration, source } = body;
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const measure = await (prisma as any).nutriMeasure.create({
      data: {
        athleteId,
        date: new Date(date || new Date().toISOString().slice(0, 10)),
        weight: weight ?? null,
        bmi: bmi ?? null,
        bodyFat: bodyFat ?? null,
        waist: waist ?? null,
        hydration: hydration ?? null,
        source: source || "manual",
      },
    });
    return NextResponse.json(measure, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/measures error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:measures" });
