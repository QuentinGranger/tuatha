import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// PATCH /api/athlete/messages/pin/[id] — toggle pin on a 1:1 message
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  try {
    const msg = await prisma.athleteProMessage.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    if (msg.athleteUserId !== session.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const updated = await prisma.athleteProMessage.update({
      where: { id },
      data: { pinned: !msg.pinned },
      include: { attachments: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/athlete/messages/pin/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
