import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

// GET /api/athlete/pro-profile/[proId] — full public profile of a connected pro
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ proId: string }> }
) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { proId } = await context.params;

  try {
    // Verify the athlete is connected to this pro
    const connection = await prisma.connectionRequest.findFirst({
      where: {
        athleteUserId: session.id,
        professionnelId: proId,
        status: "accepted",
      },
      select: { id: true, createdAt: true, respondedAt: true },
    });

    if (!connection) {
      return NextResponse.json({ error: "Connexion non trouvée." }, { status: 404 });
    }

    // Fetch full pro info
    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        specialite: true,
        statutExercice: true,
        avatarPath: true,
        adresseCabinet: true,
        latitude: true,
        longitude: true,
        professionAffichee: true,
        specialiteAffichee: true,
        conventionne: true,
        prestationRemboursableType: true,
        ordonnanceRequise: true,
        mutuelleAcceptee: true,
        remboursementNote: true,
        tarifs: {
          where: { active: true },
          select: {
            id: true,
            label: true,
            price: true,
            duration: true,
            description: true,
            format: true,
            prestationType: true,
            remboursementLabel: true,
          },
          orderBy: { createdAt: "asc" },
        },
        disponibilites: {
          select: {
            id: true,
            jourDebut: true,
            jourFin: true,
            heureDebut: true,
            heureFin: true,
          },
        },
      },
    });

    if (!pro) {
      return NextResponse.json({ error: "Professionnel introuvable." }, { status: 404 });
    }

    return NextResponse.json({
      id: pro.id,
      nom: pro.nom,
      prenom: pro.prenom,
      email: pro.email,
      telephone: pro.telephone,
      specialite: pro.specialite,
      statutExercice: pro.statutExercice,
      avatarUrl: signAvatarUrl(pro.avatarPath),
      adresseCabinet: pro.adresseCabinet,
      latitude: pro.latitude,
      longitude: pro.longitude,
      professionAffichee: pro.professionAffichee,
      specialiteAffichee: pro.specialiteAffichee,
      conventionne: pro.conventionne,
      prestationRemboursableType: pro.prestationRemboursableType,
      ordonnanceRequise: pro.ordonnanceRequise,
      mutuelleAcceptee: pro.mutuelleAcceptee,
      remboursementNote: pro.remboursementNote,
      tarifs: pro.tarifs,
      disponibilites: pro.disponibilites,
      connectedSince: connection.respondedAt || connection.createdAt,
    });
  } catch (error) {
    console.error("[pro-profile] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
