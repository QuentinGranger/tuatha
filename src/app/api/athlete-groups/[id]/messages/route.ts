import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/athlete-groups/[id]/messages — pro reads messages from an athlete group
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionPro();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  // Verify pro is a member of this group
  const membership = await (prisma as any).athleteGroupMember.findFirst({
    where: { conversationId: id, professionnelId: session.id },
  });
  if (!membership) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  // Mark messages as read (messages not sent by this pro)
  await (prisma as any).athleteGroupMessage.updateMany({
    where: {
      conversationId: id,
      read: false,
      OR: [
        { senderType: "athlete" },
        { senderType: "pro", senderProId: { not: session.id } },
      ],
    },
    data: { read: true },
  });

  const messages = await (prisma as any).athleteGroupMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json({ messages });
}

// POST /api/athlete-groups/[id]/messages — pro sends a message to an athlete group
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionPro();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const { content } = await req.json();

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Contenu requis" }, { status: 400 });
  }

  // Verify pro is a member of this group
  const membership = await (prisma as any).athleteGroupMember.findFirst({
    where: { conversationId: id, professionnelId: session.id },
  });
  if (!membership) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  const message = await (prisma as any).athleteGroupMessage.create({
    data: {
      conversationId: id,
      senderType: "pro",
      senderProId: session.id,
      content: content.trim(),
    },
  });

  return NextResponse.json(message);
}
