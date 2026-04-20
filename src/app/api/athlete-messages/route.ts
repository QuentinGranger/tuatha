import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { signAvatarUrl } from "@/lib/signedUrl";
import { getPrivacySettingsBatch } from "@/lib/privacyGuard";

// GET /api/athlete-messages — list athlete conversations for current pro
export const GET = withAuth(async (_request, ctx) => {
  try {
    const proId = ctx.session.id;

    // Get all accepted connections with athletes
    const connections = await (prisma as any).connectionRequest.findMany({
      where: { professionnelId: proId, status: "accepted" },
      include: {
        athleteUser: {
          select: { id: true, nom: true, prenom: true, sport: true, avatarPath: true },
        },
      },
    });

    // Privacy: batch-load settings to filter messaging access
    const allAthleteIds = connections.map((c: any) => c.athleteUser?.id).filter(Boolean);
    const privacyMap = await getPrivacySettingsBatch(allAthleteIds, proId);

    const conversations = [];
    for (const conn of connections) {
      const au = conn.athleteUser;
      if (!au) continue;

      // Skip athletes who disabled messaging
      const privacy = privacyMap.get(au.id);
      if (privacy && !privacy.shareMessaging) continue;

      const lastMsg = await (prisma as any).athleteProMessage.findFirst({
        where: { athleteUserId: au.id, professionnelId: proId },
        orderBy: { createdAt: "desc" },
      });

      const unread = await (prisma as any).athleteProMessage.count({
        where: {
          athleteUserId: au.id,
          professionnelId: proId,
          senderType: "athlete",
          read: false,
        },
      });

      conversations.push({
        athleteUserId: au.id,
        athlete: {
          id: au.id,
          name: `${au.prenom} ${au.nom}`,
          sport: privacy?.shareSport !== false ? au.sport : null,
          avatarUrl: privacy?.sharePhoto !== false ? signAvatarUrl(au.avatarPath) : null,
        },
        lastMessage: lastMsg
          ? { content: lastMsg.content, createdAt: lastMsg.createdAt, isMe: lastMsg.senderType === "pro" }
          : null,
        unread,
      });
    }

    conversations.sort((a: any, b: any) => {
      if (a.lastMessage && b.lastMessage) return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return a.athlete.name.localeCompare(b.athlete.name);
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("GET /api/athlete-messages error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "messagerie" });
