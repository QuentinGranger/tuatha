import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// PATCH /api/athlete/messages/edit/[id] — edit a 1:1 message sent by athlete
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  try {
    const { content } = await req.json();
    const trimmed = content?.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Le message ne peut pas être vide" }, { status: 400 });
    }

    const msg = await prisma.athleteProMessage.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

    // Only the athlete who sent it can edit
    if (msg.athleteUserId !== session.id || msg.senderType !== "athlete") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const updated = await prisma.athleteProMessage.update({
      where: { id },
      data: { content: trimmed, editedAt: new Date() },
      include: { attachments: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/athlete/messages/edit/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
