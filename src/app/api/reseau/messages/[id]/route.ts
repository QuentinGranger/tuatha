import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { softDelete } from "@/lib/softDelete";
import { audit } from "@/lib/auditLog";
import { sanitizeBody } from "@/lib/sanitize";

// PATCH /api/reseau/messages/[id] — update message (pin, important, content)
export const PATCH = withAuth(async (request, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;
    const body = sanitizeBody(await request.json());

    const msg = await (prisma as any).proMessage.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

    if (msg.senderProId !== session.id && msg.receiverProId !== session.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const data: any = {};
    if (typeof body.pinned === "boolean") data.pinned = body.pinned;
    if (typeof body.important === "boolean") data.important = body.important;

    // Content editing: only the sender can edit content
    if (typeof body.content === "string") {
      if (msg.senderProId !== session.id) {
        return NextResponse.json({ error: "Seul l'expéditeur peut modifier le contenu" }, { status: 403 });
      }
      const trimmed = body.content.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Le message ne peut pas être vide" }, { status: 400 });
      }
      data.content = trimmed;
      data.editedAt = new Date();
    }

    const updated = await (prisma as any).proMessage.update({ where: { id }, data });

    // Audit: log message changes
    const changes: Record<string, unknown> = {};
    if (typeof body.pinned === "boolean") changes.pinned = { before: msg.pinned, after: body.pinned };
    if (typeof body.important === "boolean") changes.important = { before: msg.important, after: body.important };
    if (typeof body.content === "string") changes.content = { before: msg.content, after: data.content };
    audit.logUpdate("message", id, session.id, changes);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/reseau/messages/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });

// DELETE /api/reseau/messages/[id] — delete a message
export const DELETE = withAuth(async (_request, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;

    // Only allow deleting messages the user sent or received
    const msg = await (prisma as any).proMessage.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

    if (msg.senderProId !== session.id && msg.receiverProId !== session.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Audit: snapshot full message content BEFORE deletion (non-repudiation)
    audit.logDelete("message", id, session.id, {
      content: msg.content,
      senderProId: msg.senderProId,
      receiverProId: msg.receiverProId,
      athleteId: msg.athleteId,
      createdAt: msg.createdAt,
      pinned: msg.pinned,
      important: msg.important,
    });

    await softDelete("proMessage", id, session.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/reseau/messages/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });
