import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { signAvatarPaths } from "@/lib/signedUrl";
import { verifyConversationAccess } from "@/lib/conversationAccess";
import { sanitizeMessage } from "@/lib/sanitize";
import { clearTyping } from "@/lib/typingStore";
import { sendPushToUser, sendPushToUsers } from "@/lib/webpush";

// GET /api/reseau/messages?proId=xxx&athleteId=yyy&limit=50&before=cursorId
// Returns { messages, nextCursor, hasMore }
const DEFAULT_PAGE = 50;
const MAX_PAGE = 100;

export const GET = withAuth(async (request, ctx) => {
  try {
    const session = ctx.session;

    const conversationId = request.nextUrl.searchParams.get("conversationId");
    const proId = request.nextUrl.searchParams.get("proId");
    const limitParam = parseInt(request.nextUrl.searchParams.get("limit") || "", 10);
    const limit = Math.min(Math.max(limitParam || DEFAULT_PAGE, 1), MAX_PAGE);
    const beforeCursor = request.nextUrl.searchParams.get("before");

    // ─── Group conversation messages ───
    if (conversationId) {
      // Verify membership
      const membership = await (prisma as any).proConversationMember.findUnique({
        where: { conversationId_proId: { conversationId, proId: session.id } },
      });
      if (!membership) return NextResponse.json({ error: "Non membre de cette conversation" }, { status: 403 });

      const where: any = { conversationId, deletedAt: null };
      if (beforeCursor) {
        const cursorMsg = await (prisma as any).proMessage.findUnique({ where: { id: beforeCursor }, select: { createdAt: true } });
        if (cursorMsg) where.createdAt = { lt: cursorMsg.createdAt };
      }

      const rows = await (prisma as any).proMessage.findMany({
        where,
        include: {
          senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
          attachments: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      if (hasMore) rows.pop();
      rows.reverse();
      const nextCursor = hasMore && rows.length > 0 ? rows[0].id : null;

      // Mark unread
      if (!beforeCursor) {
        await (prisma as any).proMessage.updateMany({
          where: { conversationId, senderProId: { not: session.id }, read: false },
          data: { read: true },
        });
      }

      return NextResponse.json({ messages: signAvatarPaths(rows), nextCursor, hasMore });
    }

    // ─── 1:1 conversation messages (existing logic) ───
    if (!proId) return NextResponse.json({ error: "proId ou conversationId requis" }, { status: 400 });

    const athleteId = request.nextUrl.searchParams.get("athleteId");

    // Verify the two pros share an active connection
    const access = await verifyConversationAccess(session.id, proId, athleteId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const where: any = {
      conversationId: null,
      OR: [
        { senderProId: session.id, receiverProId: proId },
        { senderProId: proId, receiverProId: session.id },
      ],
    };
    // Restrict to messages about shared athletes only
    if (athleteId) {
      where.athleteId = athleteId;
    } else {
      where.OR_athlete = undefined;
      where.athleteId = { in: [...access.sharedAthleteIds, null] };
    }

    // Cursor-based pagination
    if (beforeCursor) {
      const cursorMsg = await (prisma as any).proMessage.findUnique({
        where: { id: beforeCursor },
        select: { createdAt: true },
      });
      if (cursorMsg) {
        where.createdAt = { lt: cursorMsg.createdAt };
      }
    }

    const rows = await (prisma as any).proMessage.findMany({
      where,
      include: {
        senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        attachments: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    rows.reverse();

    const nextCursor = hasMore && rows.length > 0 ? rows[0].id : null;

    if (!beforeCursor) {
      await (prisma as any).proMessage.updateMany({
        where: { senderProId: proId, receiverProId: session.id, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({
      messages: signAvatarPaths(rows),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("GET /api/reseau/messages error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });

// POST /api/reseau/messages — send a message (with optional attachments)
export const POST = withAuth(async (request, ctx) => {
  try {
    const session = ctx.session;

    const { receiverProId, conversationId, athleteId, content, replyToId, attachments } = await request.json();
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    // Sanitize message content
    const rawContent = content?.trim() || "";
    let finalContent = "";
    if (rawContent) {
      const sanitized = sanitizeMessage(rawContent);
      if (!sanitized.ok) {
        return NextResponse.json({ error: sanitized.reason }, { status: 400 });
      }
      finalContent = sanitized.text;
    } else if (hasAttachments) {
      finalContent = `📎 ${attachments.length} pièce${attachments.length > 1 ? "s" : ""} jointe${attachments.length > 1 ? "s" : ""}`;
    }

    if (!finalContent && !hasAttachments) {
      return NextResponse.json({ error: "Contenu ou pièce jointe requis" }, { status: 400 });
    }

    // ─── Group conversation message ───
    if (conversationId) {
      const membership = await (prisma as any).proConversationMember.findUnique({
        where: { conversationId_proId: { conversationId, proId: session.id } },
      });
      if (!membership) return NextResponse.json({ error: "Non membre de cette conversation" }, { status: 403 });

      const message = await (prisma as any).proMessage.create({
        data: {
          senderProId: session.id,
          receiverProId: session.id, // self-ref for group messages
          conversationId,
          content: finalContent,
          replyToId: replyToId || null,
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
        include: {
          senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
          attachments: true,
        },
      });

      // Push notification to all other group members
      try {
        const members = await (prisma as any).proConversationMember.findMany({
          where: { conversationId, proId: { not: session.id } },
          select: { proId: true },
        });
        const senderName = message.senderPro ? `${message.senderPro.prenom} ${message.senderPro.nom}` : "Nouveau message";
        const otherProIds = members.map((m: any) => m.proId);
        if (otherProIds.length > 0) {
          sendPushToUsers(otherProIds, {
            title: senderName,
            body: "Nouveau message",
            tag: `group-${conversationId}`,
            url: `/dashboard/${session.specialite}/messagerie`,
          }).catch(() => {});
        }
      } catch {}

      return NextResponse.json(signAvatarPaths(message), { status: 201 });
    }

    // ─── 1:1 message (existing logic) ───
    if (!receiverProId) {
      return NextResponse.json({ error: "receiverProId ou conversationId requis" }, { status: 400 });
    }

    // Verify the two pros share an active connection
    const access = await verifyConversationAccess(session.id, receiverProId, athleteId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    if (athleteId && !access.sharedAthleteIds.includes(athleteId)) {
      return NextResponse.json({ error: "Connexion inactive pour cet athlète." }, { status: 403 });
    }

    const message = await (prisma as any).proMessage.create({
      data: {
        senderProId: session.id,
        receiverProId,
        athleteId: athleteId || null,
        content: finalContent,
        replyToId: replyToId || null,
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
      include: {
        senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        attachments: true,
      },
    });

    // Clear typing indicator now that message is sent
    clearTyping(session.id, receiverProId);

    // Push notification to receiver
    try {
      const senderName = message.senderPro ? `${message.senderPro.prenom} ${message.senderPro.nom}` : "Nouveau message";
      sendPushToUser(receiverProId, {
        title: senderName,
        body: "Nouveau message",
        tag: `msg-${session.id}`,
        url: `/dashboard/${session.specialite}/messagerie`,
      }).catch(() => {});
    } catch {}

    return NextResponse.json(signAvatarPaths(message), { status: 201 });
  } catch (error) {
    console.error("POST /api/reseau/messages error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });
