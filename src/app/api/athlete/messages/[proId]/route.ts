import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeBody } from "@/lib/sanitize";

// GET /api/athlete/messages/:proId — get messages with a specific pro
// Query params: ?cursor=msgId&take=N (for pagination of older messages)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proId: string }> }
) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { proId } = await params;
  const cursor = request.nextUrl.searchParams.get("cursor");
  const take = Math.min(Number(request.nextUrl.searchParams.get("take")) || 40, 100);

  try {
    // Verify connection exists
    const conn = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!conn) return NextResponse.json({ error: "Non connecté à ce professionnel" }, { status: 403 });

    // Build query: fetch messages BEFORE cursor, ordered desc, then reverse
    const query: any = {
      where: { athleteUserId: session.id, professionnelId: proId },
      include: { attachments: true },
      orderBy: { createdAt: "desc" },
      take: take + 1, // +1 to check hasMore
    };
    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1; // skip the cursor message itself
    }

    const raw = await prisma.athleteProMessage.findMany(query);
    const hasMore = raw.length > take;
    const messages = (hasMore ? raw.slice(0, take) : raw).reverse();
    const nextCursor = hasMore && messages.length > 0 ? messages[0].id : null;

    // Mark unread pro messages as read (only on initial load)
    if (!cursor) {
      await prisma.athleteProMessage.updateMany({
        where: {
          athleteUserId: session.id,
          professionnelId: proId,
          senderType: "pro",
          read: false,
        },
        data: { read: true },
      });
    }

    return NextResponse.json({ messages, hasMore, nextCursor });
  } catch (error) {
    console.error("GET /api/athlete/messages/:proId error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/athlete/messages/:proId — send a message to a pro (with optional attachments)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proId: string }> }
) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { proId } = await params;

  try {
    const body = sanitizeBody(await request.json());
    const rawContent = body.content?.trim() || "";
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const hasAttachments = attachments.length > 0;
    const replyToId = body.replyToId || null;

    let finalContent = rawContent;
    if (!finalContent && hasAttachments) {
      finalContent = `📎 ${attachments.length} pièce${attachments.length > 1 ? "s" : ""} jointe${attachments.length > 1 ? "s" : ""}`;
    }

    if (!finalContent && !hasAttachments) {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    }

    // Verify connection exists
    const conn = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!conn) return NextResponse.json({ error: "Non connecté à ce professionnel" }, { status: 403 });

    const message = await prisma.athleteProMessage.create({
      data: {
        athleteUserId: session.id,
        professionnelId: proId,
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

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("POST /api/athlete/messages/:proId error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
