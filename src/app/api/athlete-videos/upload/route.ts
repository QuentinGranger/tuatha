import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { scanUploadedFile } from "@/lib/fileScan";

const ALLOWED_VIDEO_TYPES = [
  "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo",
  "video/x-matroska", "video/mpeg",
];
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB

// POST /api/athlete-videos/upload — public upload endpoint (token-based)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const token = formData.get("token") as string | null;
    const athleteId = formData.get("athleteId") as string | null;
    const professionnelId = formData.get("professionnelId") as string | null;
    const note = formData.get("note") as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }
    if (!token || !athleteId || !professionnelId) {
      return NextResponse.json({ error: "Lien invalide" }, { status: 400 });
    }

    // Security: magic bytes + content scan before writing to disk
    const scan = await scanUploadedFile(file, "video");
    if (!scan.safe) {
      return NextResponse.json({ error: scan.reason }, { status: 400 });
    }

    // Verify athlete + pro exist
    const athlete = await (prisma as any).athlete.findFirst({
      where: { id: athleteId, professionnelId },
      select: { id: true, name: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
    }

    // Save scanned file
    const uploadsDir = path.join(process.cwd(), "uploads", "videos");
    await mkdir(uploadsDir, { recursive: true });

    const ext = `.${scan.detectedType}`;
    const filename = `vid-${randomUUID()}${ext}`;
    await writeFile(path.join(uploadsDir, filename), scan.buffer);
    const filePath = `/uploads/videos/${filename}`;

    const video = await (prisma as any).athleteVideo.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        filePath,
        note: note || null,
        uploadToken: token,
        athleteId,
        professionnelId,
      },
    });

    return NextResponse.json({ ok: true, id: video.id });
  } catch (error) {
    console.error("POST /api/athlete-videos/upload error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
