import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, updateKanbanSchema } from "@/lib/validation";
import { ownKanbanTask, notFound } from "@/lib/idor";
import { softDelete } from "@/lib/softDelete";
import { sanitizeBody } from "@/lib/sanitize";

// PATCH /api/kanban/:id — update task (column, position, title, etc.)
export const PATCH = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownKanbanTask(id, pro.id)) return notFound("Tâche introuvable");

    const parsed = validateBody(sanitizeBody(await request.json()), updateKanbanSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.column !== undefined) data.column = body.column;
    if (body.position !== undefined) data.position = body.position;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.athleteId !== undefined) data.athleteId = body.athleteId || null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.reminderMinutes !== undefined) {
      data.reminderMinutes = body.reminderMinutes ?? null;
      data.reminderSeen = false;
    }
    if (body.reminderSeen !== undefined) data.reminderSeen = body.reminderSeen;

    const updated = await prisma.kanbanTask.update({
      where: { id },
      data,
      include: { athlete: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/kanban/:id error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kanban" });

// DELETE /api/kanban/:id
export const DELETE = withAuth(async (_request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownKanbanTask(id, pro.id)) return notFound("Tâche introuvable");

    await softDelete("kanbanTask", id, pro.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/kanban/:id error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kanban" });
