import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { signAvatarPaths } from "@/lib/signedUrl";

// GET /api/reseau/shared/pro-info?proId=X — get basic info about a connected pro
export const GET = withAuth(async (request, _ctx) => {
  try {

    const proId = request.nextUrl.searchParams.get("proId");
    if (!proId) return NextResponse.json({ error: "proId requis" }, { status: 400 });

    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true, email: true, telephone: true },
    });

    if (!pro) return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });

    return NextResponse.json(signAvatarPaths(pro));
  } catch (error) {
    console.error("GET /api/reseau/shared/pro-info error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });
