import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

export const dynamic = "force-dynamic";

// POST /api/athlete/groups — create a group conversation with connected pros
export async function POST(req: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { name, memberIds } = body as { name?: string; memberIds: string[] };

  if (!Array.isArray(memberIds) || memberIds.length < 1) {
    return NextResponse.json({ error: "Au moins 1 professionnel requis" }, { status: 400 });
  }

  // Verify all members are connected professionals
  const connections = await prisma.connectionRequest.findMany({
    where: {
      athleteUserId: session.id,
      professionnelId: { in: memberIds },
      status: "accepted",
    },
    select: { professionnelId: true },
  });
  const connectedIds = new Set(connections.map((c: any) => c.professionnelId));
  const invalidIds = memberIds.filter((id) => !connectedIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json({ error: "Certains professionnels ne sont pas connectés" }, { status: 400 });
  }

  // Get pro names for auto-name
  const pros = await prisma.professionnel.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true },
  });

  const groupName = name?.trim() || pros.map((p: any) => `${p.prenom} ${p.nom}`).join(", ");

  const conversation = await prisma.athleteGroupConversation.create({
    data: {
      name: groupName,
      athleteUserId: session.id,
      members: {
        create: memberIds.map((proId: string) => ({ professionnelId: proId })),
      },
    },
    include: {
      members: {
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
      },
    },
  });

  return NextResponse.json({
    id: conversation.id,
    name: conversation.name,
    members: conversation.members.map((m: any) => ({
      ...m.professionnel,
      avatarUrl: signAvatarUrl(m.professionnel.avatarPath),
      role: m.role,
    })),
    createdAt: conversation.createdAt,
  });
}

// GET /api/athlete/groups — list athlete group conversations
export async function GET() {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const groups = await prisma.athleteGroupConversation.findMany({
    where: { athleteUserId: session.id },
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
        where: {
          conversationId: g.id,
          senderType: "pro",
          read: false,
        },
      });

      const lastMsg = g.messages[0] || null;
      // Get sender name for last message
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

  return NextResponse.json(result);
}
