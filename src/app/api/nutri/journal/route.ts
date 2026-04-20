import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, _ctx) => {
  try {
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    const days = parseInt(req.nextUrl.searchParams.get("days") || "7");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const since = new Date();
    since.setDate(since.getDate() - days);

    const entries = await (prisma as any).nutriJournal.findMany({
      where: { athleteId, date: { gte: since } },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/nutri/journal error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:journal" });

export const POST = withAuth(async (req, _ctx) => {
  try {
    const body = sanitizeBody(await req.json());
    const { athleteId, date, kcal, protein, carbs, fat, water, completed } = body;
    if (!athleteId || !date) return NextResponse.json({ error: "athleteId et date requis" }, { status: 400 });

    const entry = await (prisma as any).nutriJournal.upsert({
      where: { athleteId_date: { athleteId, date: new Date(date) } },
      update: { kcal, protein, carbs, fat, water, completed },
      create: { athleteId, date: new Date(date), kcal, protein, carbs, fat, water, completed },
    });
    return NextResponse.json(entry);
  } catch (error) {
    console.error("POST /api/nutri/journal error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:journal" });
