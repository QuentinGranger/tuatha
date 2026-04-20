import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createKanbanSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

// GET /api/kanban — all tasks for the professional + upcoming RDV events as virtual cards
export const GET = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const athleteIdFilter = request.nextUrl.searchParams.get("athleteId");

    const tasks = await prisma.kanbanTask.findMany({
      where: { professionnelId: pro.id, ...(athleteIdFilter ? { athleteId: athleteIdFilter } : {}) },
      include: { athlete: { select: { id: true, name: true } } },
      orderBy: { position: "asc" },
    });

    // Also fetch CalendarEvent RDVs and map them to virtual kanban items
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(todayStart); windowEnd.setDate(windowEnd.getDate() + 14);

    const rdvEvents = await (prisma as any).calendarEvent.findMany({
      where: {
        professionnelId: pro.id,
        type: "rdv",
        deletedAt: null,
        date: { gte: new Date(todayStart.getTime() - 24 * 60 * 60 * 1000), lte: windowEnd },
        ...(athleteIdFilter ? { athleteId: athleteIdFilter } : {}),
      },
      include: { athlete: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    });

    const rdvCards = rdvEvents
      .map((ev: any) => {
        const evDate = new Date(ev.date);
        const evEnd = ev.endDate ? new Date(ev.endDate) : new Date(evDate.getTime() + 30 * 60 * 1000);
        let column = "todo";
        if (evEnd <= now) column = "done";
        else if (evDate <= now && evEnd > now) column = "doing";

        return {
          id: `rdv_${ev.id}`,
          title: ev.title,
          description: ev.description || null,
          column,
          position: -1,
          priority: "high",
          dueDate: ev.date,
          reminderMinutes: ev.reminderMinutes,
          athleteId: ev.athleteId || null,
          athlete: ev.athlete || null,
          isRdv: true,
          rdvFormat: ev.visioRoomId ? "teleconsultation" : ((ev.description || "").includes("éléconsultation") ? "teleconsultation" : "presentiel"),
          rdvEndDate: ev.endDate,
          visioRoomId: ev.visioRoomId || null,
          _evEnd: evEnd,
        };
      })
      .filter((card: any) => {
        // Hide RDV cards 24h after the appointment ended
        if (card.column === "done") {
          const hoursSinceEnd = (now.getTime() - card._evEnd.getTime()) / (1000 * 60 * 60);
          return hoursSinceEnd <= 24;
        }
        return true;
      })
      .map(({ _evEnd, ...card }: any) => card);

    return NextResponse.json([...tasks, ...rdvCards]);
  } catch (error) {
    console.error("GET /api/kanban error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kanban" });

// POST /api/kanban — create a task
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), createKanbanSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { title, description, column, priority, athleteId, dueDate, reminderMinutes } = parsed.data;

    const maxPos = await prisma.kanbanTask.aggregate({
      where: { professionnelId: pro.id, column },
      _max: { position: true },
    });

    const task = await prisma.kanbanTask.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        column: column || "todo",
        position: (maxPos._max.position ?? -1) + 1,
        priority: priority || "medium",
        athleteId: athleteId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderMinutes: reminderMinutes ?? null,
        reminderSeen: false,
        professionnelId: pro.id,
      },
      include: { athlete: { select: { id: true, name: true } } },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/kanban error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kanban" });
