import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

type AthleteReaction = { by: string; emoji: string };

function isAthleteReaction(value: unknown): value is AthleteReaction {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as { by?: unknown; emoji?: unknown };
  return typeof candidate.by === "string" && typeof candidate.emoji === "string";
}

// POST /api/athlete/groups/messages/[id]/react — toggle a reaction on a group message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { emoji } = await req.json();
    if (!emoji) return NextResponse.json({ error: "Emoji requis" }, { status: 400 });

    const msg = await prisma.athleteGroupMessage.findUnique({
      where: { id },
      include: { conversation: { select: { athleteUserId: true } } },
    });
    if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

    // Only the athlete who owns the group can react
    if (msg.conversation.athleteUserId !== session.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const current = Array.isArray(msg.reactions) ? msg.reactions.filter(isAthleteReaction) : [];
    const existing = current.find((r) => r.by === session.id && r.emoji === emoji);

    let reactions: AthleteReaction[];
    if (existing) {
      reactions = current.filter((r) => !(r.by === session.id && r.emoji === emoji));
    } else {
      reactions = [...current.filter((r) => r.by !== session.id), { by: session.id, emoji }];
    }

    await prisma.athleteGroupMessage.update({
      where: { id },
      data: { reactions },
    });

    return NextResponse.json({ reactions });
  } catch (error) {
    console.error("POST /api/athlete/groups/messages/[id]/react error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
