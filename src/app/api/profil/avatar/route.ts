import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { withAuth } from "@/lib/withAuth";
import { signAvatarUrl } from "@/lib/signedUrl";
import { scanUploadedFile } from "@/lib/fileScan";

export const POST = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    }

    // Security: magic bytes + content scan before writing to disk
    const scan = await scanUploadedFile(file, "image");
    if (!scan.safe) {
      return NextResponse.json({ error: scan.reason }, { status: 400 });
    }

    const filename = `avatar-${randomUUID()}.${scan.detectedType}`;
    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });

    await writeFile(path.join(uploadsDir, filename), scan.buffer);

    const avatarPath = `/uploads/${filename}`;
    await prisma.professionnel.update({
      where: { id: proId },
      data: { avatarPath },
    });

    return NextResponse.json({ avatarPath: signAvatarUrl(avatarPath) });
  } catch (error) {
    console.error("POST /api/profil/avatar:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });
