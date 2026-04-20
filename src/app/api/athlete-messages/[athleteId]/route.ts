import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { canMessage, logAccess } from "@/lib/privacyGuard";

// GET /api/athlete-messages/:athleteId — get messages with a specific athlete
export const GET = withAuth(async (
  _request: NextRequest,
  ctx,
  routeCtx
) => {
  try {
    const proId = ctx.session.id;
    const { athleteId } = await routeCtx!.params;

    // Verify connection exists
    const conn = await (prisma as any).connectionRequest.findFirst({
      where: { athleteUserId: athleteId, professionnelId: proId, status: "accepted" },
    });
    if (!conn) return NextResponse.json({ error: "Non connecté à cet athlète" }, { status: 403 });

    // Privacy: athlete may have disabled messaging
    if (!await canMessage(athleteId, proId)) {
      logAccess(athleteId, proId, "view_messages", { blocked: true });
      return NextResponse.json({ error: "L'athlète a désactivé la messagerie." }, { status: 403 });
    }
    logAccess(athleteId, proId, "view_messages");

    const messages = await (prisma as any).athleteProMessage.findMany({
      where: { athleteUserId: athleteId, professionnelId: proId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    // Mark unread athlete messages as read
    await (prisma as any).athleteProMessage.updateMany({
      where: {
        athleteUserId: athleteId,
        professionnelId: proId,
        senderType: "athlete",
        read: false,
      },
      data: { read: true },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("GET /api/athlete-messages/:athleteId error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "messagerie" });

// POST /api/athlete-messages/:athleteId — send a message to an athlete
export const POST = withAuth(async (
  request: NextRequest,
  ctx,
  routeCtx
) => {
  try {
    const proId = ctx.session.id;
    const { athleteId } = await routeCtx!.params;

    const body = await request.json();
    const content = body.content?.trim();
    if (!content || content.length > 5000) {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    }

    // Verify connection exists
    const conn = await (prisma as any).connectionRequest.findFirst({
      where: { athleteUserId: athleteId, professionnelId: proId, status: "accepted" },
    });
    if (!conn) return NextResponse.json({ error: "Non connecté à cet athlète" }, { status: 403 });

    // Privacy: athlete may have disabled messaging
    if (!await canMessage(athleteId, proId)) {
      logAccess(athleteId, proId, "view_messages", { blocked: true });
      return NextResponse.json({ error: "L'athlète a désactivé la messagerie." }, { status: 403 });
    }

    const message = await (prisma as any).athleteProMessage.create({
      data: {
        athleteUserId: athleteId,
        professionnelId: proId,
        senderType: "pro",
        content,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("POST /api/athlete-messages/:athleteId error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "messagerie" });
