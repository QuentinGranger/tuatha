import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

export async function GET() {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const athlete = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        sport: true,
        avatarPath: true,
        taille: true,
        poids: true,
        dateNaissance: true,
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
    }

    return NextResponse.json({ ...athlete, avatarPath: signAvatarUrl(athlete.avatarPath) });
  } catch (error) {
    console.error("Erreur profil athlète:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
