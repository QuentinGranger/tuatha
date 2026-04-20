import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete, getSessionPro } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const proSession = await getSessionPro();
    if (proSession) {
      const pro = await prisma.professionnel.findUnique({
        where: { id: proSession.id },
        select: { id: true, prenom: true, nom: true },
      });
      if (!pro) return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });
      return NextResponse.json({
        role: "pro",
        id: pro.id,
        participantId: `pro:${pro.id}`,
        displayName: `${pro.prenom} ${pro.nom}`,
      });
    }

    const athleteSession = await getSessionAthlete();
    if (athleteSession) {
      const athlete = await prisma.athleteUser.findUnique({
        where: { id: athleteSession.id },
        select: { id: true, prenom: true, nom: true },
      });
      if (!athlete) return NextResponse.json({ error: "Athlète introuvable" }, { status: 404 });
      return NextResponse.json({
        role: "athlete",
        id: athlete.id,
        participantId: `athlete:${athlete.id}`,
        displayName: `${athlete.prenom} ${athlete.nom}`,
      });
    }

    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  } catch (error) {
    console.error("GET /api/visio/me error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
