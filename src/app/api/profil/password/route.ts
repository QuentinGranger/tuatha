import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { withAuth } from "@/lib/withAuth";
import { validateBody, z } from "@/lib/validation";

export const PUT = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;

    const schema = z.object({
      currentPassword: z.string().min(1, "Mot de passe actuel requis."),
      newPassword: z.string().min(8, "Le nouveau mot de passe doit faire au moins 8 caractères."),
    });
    const parsed = validateBody(await request.json(), schema);
    if (!parsed.success) return parsed.errorResponse;
    const { currentPassword, newPassword } = parsed.data;

    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { password: true },
    });

    if (!pro) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, pro.password);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 403 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.professionnel.update({
      where: { id: proId },
      data: { password: hashed },
    });

    return NextResponse.json({ message: "Mot de passe modifié" });
  } catch (error) {
    console.error("PUT /api/profil/password:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });
