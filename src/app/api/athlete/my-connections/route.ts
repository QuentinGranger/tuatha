import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

// GET /api/athlete/my-connections — returns all connection requests for the logged-in athlete
export async function GET(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  try {
    const connections = await prisma.connectionRequest.findMany({
      where: { athleteUserId: session.id },
      include: {
        professionnel: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
            avatarPath: true,
            adresseCabinet: true,
            tarifs: {
              where: { active: true },
              select: { id: true, label: true, price: true, duration: true, description: true, format: true, prestationType: true, remboursementLabel: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const results = connections.map((c: any) => ({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt,
      respondedAt: c.respondedAt,
      professionnel: {
        id: c.professionnel.id,
        nom: c.professionnel.nom,
        prenom: c.professionnel.prenom,
        specialite: c.professionnel.specialite,
        avatarUrl: signAvatarUrl(c.professionnel.avatarPath),
        adresseCabinet: c.professionnel.adresseCabinet,
        tarifs: c.professionnel.tarifs || [],
      },
    }));

    return NextResponse.json({ connections: results });
  } catch (error) {
    console.error("[my-connections] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
