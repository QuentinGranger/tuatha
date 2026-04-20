import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// PATCH /api/athlete/groups/messages/[id]/pin — toggle pin on a group message
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  try {
    const msg = await prisma.athleteGroupMessage.findUnique({
      where: { id },
      include: { conversation: { select: { athleteUserId: true } } },
    });
    if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    if (msg.conversation.athleteUserId !== session.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const updated = await prisma.athleteGroupMessage.update({
      where: { id },
      data: { pinned: !msg.pinned },
      include: { attachments: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/athlete/groups/messages/[id]/pin error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
