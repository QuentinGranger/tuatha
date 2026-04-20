import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { audit } from "@/lib/auditLog";
import { sanitizeBody } from "@/lib/sanitize";

type ProReaction = { proId: string; emoji: string };

function isProReaction(value: unknown): value is ProReaction {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as { proId?: unknown; emoji?: unknown };
  return typeof candidate.proId === "string" && typeof candidate.emoji === "string";
}

// POST /api/reseau/messages/[id]/react — toggle a reaction on a message
export const POST = withAuth(async (req, ctx, routeCtx) => {
  try {
    const { id } = await routeCtx!.params;
    const session = ctx.session;

    const { emoji } = sanitizeBody(await req.json());
    if (!emoji) return NextResponse.json({ error: "Emoji requis" }, { status: 400 });

    const msg = await prisma.proMessage.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

    // Only sender or receiver can react
    if (msg.senderProId !== session.id && msg.receiverProId !== session.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // reactions: single emoji per message (last one wins, toggle to remove)
    const current = Array.isArray(msg.reactions) ? msg.reactions.filter(isProReaction) : [];
    const myReaction = current.find(r => r.proId === session.id && r.emoji === emoji);

    // If I already reacted with the same emoji → remove it (toggle off)
    // Otherwise → replace ALL reactions with just mine
    const reactions = myReaction ? [] : [{ proId: session.id, emoji }];

    await prisma.proMessage.update({
      where: { id },
      data: { reactions },
    });

    audit.logUpdate("reaction", id, session.id, {
      emoji,
      action: myReaction ? "removed" : "added",
      before: current,
      after: reactions,
    });

    return NextResponse.json({ reactions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("POST /api/reseau/messages/[id]/react error:", message, stack);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });
