import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/athlete/groups/[id]/messages — get messages for a group
// Query params: ?cursor=msgId&take=N (for pagination of older messages)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const cursor = req.nextUrl.searchParams.get("cursor");
  const take = Math.min(Number(req.nextUrl.searchParams.get("take")) || 40, 100);

  // Verify athlete owns this group
  const group = await prisma.athleteGroupConversation.findUnique({
    where: { id },
    select: { athleteUserId: true },
  });
  if (!group || group.athleteUserId !== session.id) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  // Mark all pro messages as read (only on initial load)
  if (!cursor) {
    await prisma.athleteGroupMessage.updateMany({
      where: { conversationId: id, senderType: "pro", read: false },
      data: { read: true },
    });
  }

  const query: any = {
    where: { conversationId: id },
    include: { attachments: true },
    orderBy: { createdAt: "desc" },
    take: take + 1,
  };
  if (cursor) {
    query.cursor = { id: cursor };
    query.skip = 1;
  }

  const raw = await prisma.athleteGroupMessage.findMany(query);
  const hasMore = raw.length > take;
  const messages = (hasMore ? raw.slice(0, take) : raw).reverse();
  const nextCursor = hasMore && messages.length > 0 ? messages[0].id : null;

  return NextResponse.json({ messages, hasMore, nextCursor });
}

// POST /api/athlete/groups/[id]/messages — send a message to the group (with optional attachments)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const rawContent = body.content?.trim() || "";
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const hasAttachments = attachments.length > 0;
  const replyToId = body.replyToId || null;

  let finalContent = rawContent;
  if (!finalContent && hasAttachments) {
    finalContent = `📎 ${attachments.length} pièce${attachments.length > 1 ? "s" : ""} jointe${attachments.length > 1 ? "s" : ""}`;
  }

  if (!finalContent && !hasAttachments) {
    return NextResponse.json({ error: "Contenu requis" }, { status: 400 });
  }

  // Verify athlete owns this group
  const group = await prisma.athleteGroupConversation.findUnique({
    where: { id },
    select: { athleteUserId: true },
  });
  if (!group || group.athleteUserId !== session.id) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  const message = await prisma.athleteGroupMessage.create({
    data: {
      conversationId: id,
      senderType: "athlete",
      content: finalContent,
      replyToId,
      ...(hasAttachments && {
        attachments: {
          create: attachments.map((a: any) => ({
            filename: a.filename,
            originalName: a.originalName,
            mimeType: a.mimeType,
            size: a.size,
            filePath: a.filePath,
          })),
        },
      }),
    },
    include: { attachments: true },
  });

  return NextResponse.json(message);
}
