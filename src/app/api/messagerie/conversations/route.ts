import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { getConnectedProIds } from "@/lib/conversationAccess";

// GET /api/messagerie/conversations — list all conversations for the current pro
export const GET = withAuth(async (_request, ctx) => {
  try {
    const session = ctx.session;

    // Get all messages involving this pro
    const messages = await (prisma as any).proMessage.findMany({
      where: {
        OR: [
          { senderProId: session.id },
          { receiverProId: session.id },
        ],
      },
      include: {
        senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        receiverPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Only show conversations with currently connected pros
    const connectedIds = await getConnectedProIds(session.id);

    // Group by conversation partner
    const convMap = new Map<string, { pro: any; lastMessage: any; unread: number }>();

    for (const msg of messages) {
      const otherPro = msg.senderProId === session.id ? msg.receiverPro : msg.senderPro;
      const key = otherPro.id;

      // Skip conversations with pros we're no longer connected to
      if (!connectedIds.has(key)) continue;

      if (!convMap.has(key)) {
        const unread = msg.receiverProId === session.id && !msg.read ? 1 : 0;
        convMap.set(key, { pro: otherPro, lastMessage: msg, unread });
      } else {
        const conv = convMap.get(key)!;
        if (msg.receiverProId === session.id && !msg.read) {
          conv.unread++;
        }
      }
    }

    const conversations = Array.from(convMap.values()).map((c) => ({
      proId: c.pro.id,
      pro: c.pro,
      lastMessage: {
        content: c.lastMessage.content,
        createdAt: c.lastMessage.createdAt,
        isMe: c.lastMessage.senderProId === session.id,
      },
      unread: c.unread,
    }));

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("GET /api/messagerie/conversations error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "messagerie" });
