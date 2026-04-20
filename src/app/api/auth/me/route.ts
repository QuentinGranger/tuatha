import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/signedUrl";

export async function GET() {
  try {
    const session = await getSessionPro();

    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const pro = await prisma.professionnel.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        specialite: true,
        avatarPath: true,
      },
    });

    if (!pro) {
      return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });
    }

    // Signed avatar URL — no permanent public links
    const avatarUrl = signAvatarUrl(pro.avatarPath);

    return NextResponse.json({ ...pro, avatarPath: avatarUrl });
  } catch (error) {
    console.error("Erreur /api/auth/me:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
