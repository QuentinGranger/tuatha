import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// DELETE /api/athlete/groups/messages/[id]/delete — delete a group message sent by athlete
export async function DELETE(
  _req: NextRequest,
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

    if (msg.conversation.athleteUserId !== session.id || msg.senderType !== "athlete") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    await prisma.athleteGroupMessage.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/athlete/groups/messages/[id]/delete error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
