import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { signAvatarUrl } from "@/lib/signedUrl";

// GET /api/pro/[id] — fetch a pro's public profile
export const GET = withAuth(async (_request, _ctx, routeCtx) => {
  try {
    const { id } = await routeCtx!.params;

    const pro = await (prisma as any).professionnel.findUnique({
      where: { id },
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        telephone: true,
        specialite: true,
        avatarPath: true,
        adresseCabinet: true,
        createdAt: true,
      },
    });

    if (!pro) return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });

    // Signed avatar URL — no permanent public links
    if (pro.avatarPath) {
      pro.avatarPath = signAvatarUrl(pro.avatarPath);
    }

    return NextResponse.json(pro);
  } catch (error) {
    console.error("GET /api/pro/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });
