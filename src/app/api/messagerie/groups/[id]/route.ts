import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/messagerie/groups/[id] — get group details
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionPro();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const group = await (prisma as any).proConversation.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          pro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
      },
      athlete: { select: { id: true, name: true } },
    },
  });

  if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  const isMember = group.members.some((m: any) => m.proId === session.id);
  if (!isMember) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  return NextResponse.json({
    id: group.id,
    name: group.name,
    isGroup: group.isGroup,
    athleteId: group.athleteId,
    athlete: group.athlete,
    members: group.members.map((m: any) => ({ ...m.pro, role: m.role })),
    createdAt: group.createdAt,
    createdById: group.createdById,
  });
}

// PATCH /api/messagerie/groups/[id] — update group (rename, add/remove members)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionPro();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const group = await (prisma as any).proConversation.findUnique({
    where: { id },
    include: { members: true },
  });

  if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  const myMembership = group.members.find((m: any) => m.proId === session.id);
  if (!myMembership) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  // Rename
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed) {
      await (prisma as any).proConversation.update({ where: { id }, data: { name: trimmed } });
    }
  }

  // Add members
  if (Array.isArray(body.addMembers) && body.addMembers.length > 0) {
    for (const proId of body.addMembers) {
      try {
        await (prisma as any).proConversationMember.create({
          data: { conversationId: id, proId, role: "member" },
        });
      } catch {} // ignore duplicates
    }
  }

  // Remove members (only admin can remove, and can't remove self if last admin)
  if (Array.isArray(body.removeMembers) && body.removeMembers.length > 0) {
    if (myMembership.role !== "admin") {
      return NextResponse.json({ error: "Seul un admin peut retirer des membres" }, { status: 403 });
    }
    for (const proId of body.removeMembers) {
      if (proId === session.id) continue; // can't remove yourself
      await (prisma as any).proConversationMember.deleteMany({
        where: { conversationId: id, proId },
      });
    }
  }

  // Leave group
  if (body.leave === true) {
    await (prisma as any).proConversationMember.deleteMany({
      where: { conversationId: id, proId: session.id },
    });
    // If no members left, delete the conversation
    const remaining = await (prisma as any).proConversationMember.count({ where: { conversationId: id } });
    if (remaining === 0) {
      await (prisma as any).proConversation.delete({ where: { id } });
    }
    return NextResponse.json({ ok: true, left: true });
  }

  // Return updated group
  const updated = await (prisma as any).proConversation.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          pro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
      },
      athlete: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    members: updated.members.map((m: any) => ({ ...m.pro, role: m.role })),
  });
}
