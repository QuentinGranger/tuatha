import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";

// POST /api/connection-request/[id] — accept or reject a connection request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionPro();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const { accept } = await request.json();

    if (typeof accept !== "boolean") {
      return NextResponse.json({ error: "Paramètre 'accept' requis (boolean)." }, { status: 400 });
    }

    // Find the connection request, must belong to this pro
    const connectionRequest = await (prisma as any).connectionRequest.findUnique({
      where: { id },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, email: true, sport: true } },
      },
    });

    if (!connectionRequest) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    if (connectionRequest.professionnelId !== session.id) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    }

    if (connectionRequest.status !== "pending") {
      return NextResponse.json({ error: "Cette demande a déjà été traitée.", status: connectionRequest.status }, { status: 400 });
    }

    const newStatus = accept ? "accepted" : "rejected";

    await (prisma as any).connectionRequest.update({
      where: { id },
      data: {
        status: newStatus,
        respondedAt: new Date(),
      },
    });

    // When accepted, create an Athlete record under this pro if none exists
    if (accept) {
      const au = connectionRequest.athleteUser;
      const existing = await prisma.athlete.findFirst({
        where: {
          professionnelId: session.id,
          contactEmail: { equals: au.email, mode: "insensitive" },
        },
      });
      if (!existing) {
        await prisma.athlete.create({
          data: {
            name: `${au.prenom} ${au.nom}`,
            sport: au.sport || null,
            contactEmail: au.email,
            professionnelId: session.id,
            consentement: true,
            consentementDate: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      status: newStatus,
      athleteName: `${connectionRequest.athleteUser.prenom} ${connectionRequest.athleteUser.nom}`,
    });
  } catch (error) {
    console.error("[connection-request] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
