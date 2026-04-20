import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

export const dynamic = "force-dynamic";

// ─── Fetch 1:1 conversations for an athlete ───

async function getConversationsForAthlete(athleteUserId: string) {
  const connections = await prisma.connectionRequest.findMany({
    where: { athleteUserId, status: "accepted" },
    include: {
      professionnel: {
        select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true },
      },
    },
  });

  const conversations = [];
  for (const conn of connections) {
    const pro = conn.professionnel;

    const lastMsg = await prisma.athleteProMessage.findFirst({
      where: { athleteUserId, professionnelId: pro.id },
      orderBy: { createdAt: "desc" },
    });

    const unread = await prisma.athleteProMessage.count({
      where: {
        athleteUserId,
        professionnelId: pro.id,
        senderType: "pro",
        read: false,
      },
    });

    conversations.push({
      proId: pro.id,
      pro: { ...pro, avatarUrl: signAvatarUrl(pro.avatarPath) },
      lastMessage: lastMsg
        ? { content: lastMsg.content, createdAt: lastMsg.createdAt, isMe: lastMsg.senderType === "athlete" }
        : null,
      unread,
    });
  }

  conversations.sort((a: any, b: any) => {
    if (a.lastMessage && b.lastMessage) return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return `${a.pro.prenom} ${a.pro.nom}`.localeCompare(`${b.pro.prenom} ${b.pro.nom}`);
  });

  return conversations;
}

// ─── Fetch group conversations for an athlete ───

async function getGroupsForAthlete(athleteUserId: string) {
  const groups = await prisma.athleteGroupConversation.findMany({
    where: { athleteUserId },
    include: {
      members: {
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = await Promise.all(
    groups.map(async (g: any) => {
      const unread = await prisma.athleteGroupMessage.count({
        where: { conversationId: g.id, senderType: "pro", read: false },
      });

      const lastMsg = g.messages[0] || null;
      let senderName: string | null = null;
      if (lastMsg && lastMsg.senderType === "pro" && lastMsg.senderProId) {
        const member = g.members.find((m: any) => m.professionnel.id === lastMsg.senderProId);
        senderName = member ? member.professionnel.prenom : null;
      }

      return {
        id: g.id,
        name: g.name,
        isGroup: true,
        members: g.members.map((m: any) => ({
          ...m.professionnel,
          avatarUrl: signAvatarUrl(m.professionnel.avatarPath),
          role: m.role,
        })),
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              createdAt: lastMsg.createdAt,
              senderName: lastMsg.senderType === "athlete" ? null : senderName,
              isMe: lastMsg.senderType === "athlete",
            }
          : null,
        unread,
        createdAt: g.createdAt,
      };
    })
  );

  return result;
}

// ─── Fetch messages for a 1:1 conversation ───

async function getMessagesForPro(athleteUserId: string, proId: string) {
  // Mark unread pro messages as read
  await prisma.athleteProMessage.updateMany({
    where: { athleteUserId, professionnelId: proId, senderType: "pro", read: false },
    data: { read: true },
  });

  const messages = await prisma.athleteProMessage.findMany({
    where: { athleteUserId, professionnelId: proId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return messages.reverse();
}

// ─── Fetch messages for a group conversation ───

async function getMessagesForGroup(athleteUserId: string, groupId: string) {
  // Verify ownership
  const group = await prisma.athleteGroupConversation.findUnique({
    where: { id: groupId },
    select: { athleteUserId: true },
  });
  if (!group || group.athleteUserId !== athleteUserId) return [];

  // Mark unread messages as read
  await prisma.athleteGroupMessage.updateMany({
    where: { conversationId: groupId, senderType: "pro", read: false },
    data: { read: true },
  });

  const messages = await prisma.athleteGroupMessage.findMany({
    where: { conversationId: groupId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return messages.reverse();
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
//   ?proId=xxx   → stream messages for a specific 1:1 conversation
//   ?groupId=xxx → stream messages for a specific group conversation
//   (none)       → stream conversations list (1:1 + groups combined)

const CONV_POLL_MS = 5000;
const MSG_POLL_MS = 2000;
const HEARTBEAT_MS = 30000;

export async function GET(req: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const athleteUserId = session.id;
  const proId = req.nextUrl.searchParams.get("proId");
  const groupId = req.nextUrl.searchParams.get("groupId");
  const isMessageStream = !!proId || !!groupId;
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
          let data: any;
          if (proId) {
            data = await getMessagesForPro(athleteUserId, proId);
          } else if (groupId) {
            data = await getMessagesForGroup(athleteUserId, groupId);
          } else {
            // Conversations list: merge 1:1 + groups
            const convs = await getConversationsForAthlete(athleteUserId);
            let groups: any[] = [];
            try { groups = await getGroupsForAthlete(athleteUserId); } catch {}
            data = { conversations: convs, groups };
          }

          const json = JSON.stringify(data);
          const hash = quickHash(json);

          if (hash !== lastHash) {
            lastHash = hash;
            controller.enqueue(encoder.encode(`data: ${json}\n\n`));
          }
        } catch (err) {
          console.error("[SSE athlete] poll error:", err);
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
