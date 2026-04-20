import { NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/athlete/profile
// Returns the authenticated athlete user's profile for pre-filling forms.

export async function GET() {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const user = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        sport: true,
        dateNaissance: true,
        antecedents: true,
        traitements: true,
        contreIndications: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET /api/athlete/profile:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
