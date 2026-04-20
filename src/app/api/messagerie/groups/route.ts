import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/messagerie/groups — create a group conversation
export async function POST(req: NextRequest) {
  const session = await getSessionPro();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { name, memberIds, athleteId } = body as {
    name?: string;
    memberIds: string[];
    athleteId?: string;
  };

  if (!Array.isArray(memberIds) || memberIds.length < 2) {
    return NextResponse.json({ error: "Au moins 2 membres requis (en plus de vous)" }, { status: 400 });
  }

  // Ensure creator is included in members
  const allMemberIds = Array.from(new Set([session.id, ...memberIds]));

  // Verify all members exist
  const existingPros = await (prisma as any).professionnel.findMany({
    where: { id: { in: allMemberIds } },
    select: { id: true, nom: true, prenom: true },
  });
  if (existingPros.length !== allMemberIds.length) {
    return NextResponse.json({ error: "Un ou plusieurs membres introuvables" }, { status: 400 });
  }

  // Auto-generate name if not provided
  const groupName = name?.trim() || existingPros
    .filter((p: any) => p.id !== session.id)
    .map((p: any) => p.prenom)
    .join(", ");

  const conversation = await (prisma as any).proConversation.create({
    data: {
      name: groupName,
      isGroup: true,
      athleteId: athleteId || null,
      createdById: session.id,
      members: {
        create: allMemberIds.map((proId: string) => ({
          proId,
          role: proId === session.id ? "admin" : "member",
        })),
      },
    },
    include: {
      members: {
        include: {
          pro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
      },
      athlete: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(conversation);
}

// GET /api/messagerie/groups — list group conversations for the current user
export async function GET(req: NextRequest) {
  const session = await getSessionPro();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const groups = await (prisma as any).proConversation.findMany({
    where: {
      isGroup: true,
      members: { some: { proId: session.id } },
    },
    include: {
      members: {
        include: {
          pro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
      },
      athlete: { select: { id: true, name: true } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Format response with last message and unread count
  const result = await Promise.all(
    groups.map(async (g: any) => {
      const unread = await (prisma as any).proMessage.count({
        where: {
          conversationId: g.id,
          senderProId: { not: session.id },
          read: false,
          deletedAt: null,
        },
      });

      const lastMsg = g.messages[0] || null;
      return {
        id: g.id,
        name: g.name,
        isGroup: true,
        athleteId: g.athleteId,
        athlete: g.athlete,
        members: g.members.map((m: any) => ({ ...m.pro, role: m.role })),
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              createdAt: lastMsg.createdAt,
              senderName: lastMsg.senderPro.prenom,
              isMe: lastMsg.senderProId === session.id,
            }
          : null,
        unread,
        createdAt: g.createdAt,
      };
    })
  );

  return NextResponse.json(result);
}
