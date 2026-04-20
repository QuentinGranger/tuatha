import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createEventSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

// GET /api/events?month=2026-02
export const GET = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const { searchParams } = request.nextUrl;
    const monthParam = searchParams.get("month"); // format: YYYY-MM

    let start: Date;
    let end: Date;

    if (monthParam) {
      const [y, m] = monthParam.split("-").map(Number);
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const athleteIdFilter = searchParams.get("athleteId");

    const events = await prisma.calendarEvent.findMany({
      where: {
        professionnelId: pro.id,
        ...(athleteIdFilter ? { athleteId: athleteIdFilter } : { date: { gte: start, lt: end } }),
      },
      include: { athlete: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "events" });

// POST /api/events
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), createEventSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const event = await prisma.calendarEvent.create({
      data: {
        title: d.title,
        date: new Date(d.date),
        endDate: d.endDate ? new Date(d.endDate) : null,
        allDay: d.allDay,
        type: d.type || "rdv",
        color: d.color || "orange",
        description: d.description || null,
        athleteId: d.athleteId || null,
        reminderMinutes: d.reminderMinutes ?? null,
        reminderSeen: false,
        professionnelId: pro.id,
      },
      include: { athlete: { select: { id: true, name: true } } },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "events" });
