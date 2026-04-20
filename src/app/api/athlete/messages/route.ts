import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/athlete/messages — list conversations (one per connected pro)
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    // Get all accepted connections
    const connections = await prisma.connectionRequest.findMany({
      where: { athleteUserId: session.id, status: "accepted" },
      include: {
        professionnel: {
          select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true },
        },
      },
    });

    // For each connected pro, get the last message + unread count
    const conversations = [];
    for (const conn of connections) {
      const pro = conn.professionnel;

      const lastMsg = await prisma.athleteProMessage.findFirst({
        where: { athleteUserId: session.id, professionnelId: pro.id },
        orderBy: { createdAt: "desc" },
      });

      const unread = await prisma.athleteProMessage.count({
        where: {
          athleteUserId: session.id,
          professionnelId: pro.id,
          senderType: "pro",
          read: false,
        },
      });

      conversations.push({
        proId: pro.id,
        pro: {
          ...pro,
          avatarUrl: signAvatarUrl(pro.avatarPath),
        },
        lastMessage: lastMsg
          ? { content: lastMsg.content, createdAt: lastMsg.createdAt, isMe: lastMsg.senderType === "athlete" }
          : null,
        unread,
      });
    }

    // Sort by last message date (most recent first), then by pro name
    conversations.sort((a: any, b: any) => {
      if (a.lastMessage && b.lastMessage) return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return `${a.pro.prenom} ${a.pro.nom}`.localeCompare(`${b.pro.prenom} ${b.pro.nom}`);
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("GET /api/athlete/messages error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
