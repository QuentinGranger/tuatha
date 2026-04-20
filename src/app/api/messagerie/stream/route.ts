import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";
import { getConnectedProIds } from "@/lib/conversationAccess";

// Force dynamic (no static caching)
export const dynamic = "force-dynamic";

// ─── Fetch conversations for a pro ───

async function getConversationsForPro(proId: string) {
  const messages = await (prisma as any).proMessage.findMany({
    where: {
      conversationId: null,
      OR: [{ senderProId: proId }, { receiverProId: proId }],
    },
    include: {
      senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
      receiverPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const connectedIds = await getConnectedProIds(proId);

  const convMap = new Map<string, { pro: any; lastMessage: any; unread: number }>();
  for (const msg of messages) {
    const otherPro = msg.senderProId === proId ? msg.receiverPro : msg.senderPro;
    const key = otherPro.id;
    if (!connectedIds.has(key)) continue;

    if (!convMap.has(key)) {
      const unread = msg.receiverProId === proId && !msg.read ? 1 : 0;
      convMap.set(key, { pro: otherPro, lastMessage: msg, unread });
    } else {
      const conv = convMap.get(key)!;
      if (msg.receiverProId === proId && !msg.read) conv.unread++;
    }
  }

  const directConvs = Array.from(convMap.values()).map((c) => ({
    proId: c.pro.id,
    pro: c.pro,
    isGroup: false,
    lastMessage: {
      content: c.lastMessage.content,
      createdAt: c.lastMessage.createdAt,
      isMe: c.lastMessage.senderProId === proId,
    },
    unread: c.unread,
  }));

  // Fetch group conversations
  const groups = await (prisma as any).proConversation.findMany({
    where: { isGroup: true, members: { some: { proId } } },
    include: {
      members: { include: { pro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } } } },
      athlete: { select: { id: true, name: true } },
      messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, include: { senderPro: { select: { id: true, prenom: true } } } },
    },
  });

  const groupConvs = await Promise.all(groups.map(async (g: any) => {
    const unread = await (prisma as any).proMessage.count({
      where: { conversationId: g.id, senderProId: { not: proId }, read: false, deletedAt: null },
    });
    const lastMsg = g.messages[0] || null;
    return {
      proId: g.id,
      groupId: g.id,
      isGroup: true,
      name: g.name,
      athlete: g.athlete,
      members: g.members.map((m: any) => ({ ...m.pro, role: m.role })),
      lastMessage: lastMsg ? {
        content: lastMsg.content,
        createdAt: lastMsg.createdAt,
        isMe: lastMsg.senderProId === proId,
        senderName: lastMsg.senderPro.prenom,
      } : null,
      unread,
    };
  }));

  // Merge and sort by last message date
  const all = [...directConvs, ...groupConvs];
  all.sort((a, b) => {
    const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return tb - ta;
  });
  return all;
}

// ─── Fetch messages for a specific 1:1 conversation ───

async function getMessagesForConversation(proId: string, otherProId: string) {
  const connectedIds = await getConnectedProIds(proId);
  if (!connectedIds.has(otherProId)) return [];

  const rows = await (prisma as any).proMessage.findMany({
    where: {
      conversationId: null,
      OR: [
        { senderProId: proId, receiverProId: otherProId },
        { senderProId: otherProId, receiverProId: proId },
      ],
    },
    include: {
      senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
      attachments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const messages = rows.reverse();

  // Mark received messages as read
  const unreadIds = messages
    .filter((m: any) => m.receiverProId === proId && !m.read)
    .map((m: any) => m.id);

  if (unreadIds.length > 0) {
    await (prisma as any).proMessage.updateMany({
      where: { id: { in: unreadIds } },
      data: { read: true },
    });
  }

  return messages.map((m: any) => ({
    id: m.id,
    content: m.content,
    senderProId: m.senderProId,
    senderPro: m.senderPro,
    reactions: typeof m.reactions === "string" ? JSON.parse(m.reactions) : m.reactions || [],
    pinned: m.pinned,
    important: m.important,
    replyToId: m.replyToId,
    attachments: m.attachments || [],
    createdAt: m.createdAt,
    editedAt: m.editedAt,
  }));
}

// ─── Fetch messages for a group conversation ───

async function getMessagesForGroup(proId: string, conversationId: string) {
  const membership = await (prisma as any).proConversationMember.findUnique({
    where: { conversationId_proId: { conversationId, proId } },
  });
  if (!membership) return [];

  const rows = await (prisma as any).proMessage.findMany({
    where: { conversationId, deletedAt: null },
    include: {
      senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
      attachments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const messages = rows.reverse();

  // Mark received messages as read
  const unreadIds = messages
    .filter((m: any) => m.senderProId !== proId && !m.read)
    .map((m: any) => m.id);
  if (unreadIds.length > 0) {
    await (prisma as any).proMessage.updateMany({
      where: { id: { in: unreadIds } },
      data: { read: true },
    });
  }

  return messages.map((m: any) => ({
    id: m.id,
    content: m.content,
    senderProId: m.senderProId,
    senderPro: m.senderPro,
    reactions: typeof m.reactions === "string" ? JSON.parse(m.reactions) : m.reactions || [],
    pinned: m.pinned,
    important: m.important,
    replyToId: m.replyToId,
    attachments: m.attachments || [],
    createdAt: m.createdAt,
    editedAt: m.editedAt,
  }));
}

// ─── Simple hash for change detection ───

function quickHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash + c) | 0;
  }
  return hash.toString(36);
}

// ─── SSE endpoint ───
// Query params:
//   ?proId=xxx  → stream messages for a specific conversation
//   (none)      → stream conversations list

const CONV_POLL_MS = 5000;    // Conversations list: every 5s
const MSG_POLL_MS = 2000;     // Active conversation messages: every 2s
const HEARTBEAT_MS = 30000;

export async function GET(req: NextRequest) {
  const session = await getSessionPro();
  if (!session) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const proId = session.id;
  const otherProId = req.nextUrl.searchParams.get("proId");
  const conversationId = req.nextUrl.searchParams.get("conversationId");
  const isMessageStream = !!otherProId || !!conversationId;
  const pollInterval = isMessageStream ? MSG_POLL_MS : CONV_POLL_MS;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastHash = "";
      let alive = true;

      controller.enqueue(encoder.encode(": connected\n\n"));

      const poll = async () => {
        if (!alive) return;
        try {
          const data = conversationId
            ? await getMessagesForGroup(proId, conversationId)
            : otherProId
              ? await getMessagesForConversation(proId, otherProId)
              : await getConversationsForPro(proId);

          const json = JSON.stringify(data);
          const hash = quickHash(json);

          if (hash !== lastHash) {
            lastHash = hash;
            controller.enqueue(encoder.encode(`data: ${json}\n\n`));
          }
        } catch (err) {
          console.error("[SSE messagerie] poll error:", err);
        }
      };

      // Initial fetch
      poll();

      const pollTimer = setInterval(poll, pollInterval);

      const heartbeatTimer = setInterval(() => {
        if (!alive) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          alive = false;
        }
      }, HEARTBEAT_MS);

      req.signal.addEventListener("abort", () => {
        alive = false;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
