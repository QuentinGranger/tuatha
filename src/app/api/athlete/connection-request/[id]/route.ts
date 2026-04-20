import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

// POST /api/athlete/connection-request/[id] — athlete accepts or declines a connection request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionAthlete();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { id } = await params;
    const { accept } = await request.json();

    if (typeof accept !== "boolean") {
      return NextResponse.json({ error: "Paramètre 'accept' requis (boolean)." }, { status: 400 });
    }

    const connectionRequest = await prisma.connectionRequest.findUnique({
      where: { id },
      include: {
        professionnel: { select: { id: true, prenom: true, nom: true, specialite: true } },
      },
    });

    if (!connectionRequest) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    if (connectionRequest.athleteUserId !== session.id) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    }

    if (connectionRequest.status !== "pending") {
      return NextResponse.json({ error: "Cette demande a déjà été traitée.", status: connectionRequest.status }, { status: 400 });
    }

    const newStatus = accept ? "accepted" : "rejected";

    await prisma.connectionRequest.update({
      where: { id },
      data: { status: newStatus, respondedAt: new Date() },
    });

    // When accepted, create an Athlete record under this pro if none exists
    if (accept) {
      const athleteUser = await prisma.athleteUser.findUnique({
        where: { id: session.id },
        select: { prenom: true, nom: true, email: true, sport: true },
      });
      if (athleteUser) {
        const proId = connectionRequest.professionnelId;
        const existing = await prisma.athlete.findFirst({
          where: {
            professionnelId: proId,
            contactEmail: { equals: athleteUser.email, mode: "insensitive" },
          },
        });
        if (!existing) {
          await prisma.athlete.create({
            data: {
              name: `${athleteUser.prenom} ${athleteUser.nom}`,
              sport: athleteUser.sport || null,
              contactEmail: athleteUser.email,
              professionnelId: proId,
              consentement: true,
              consentementDate: new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      status: newStatus,
      proName: `${connectionRequest.professionnel.prenom} ${connectionRequest.professionnel.nom}`,
    });
  } catch (error) {
    console.error("[athlete/connection-request] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
