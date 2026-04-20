import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";
import { scanUploadedFile } from "@/lib/fileScan";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/athlete/videos/upload — authenticated athlete uploads a video for a pro
export async function POST(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-video-upload:${ip}`, RATE_LIMITS.upload);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const proId = formData.get("proId") as string | null;
    const note = formData.get("note") as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }
    if (!proId) {
      return NextResponse.json({ error: "Professionnel requis" }, { status: 400 });
    }

    // Verify accepted connection
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté à ce professionnel" }, { status: 403 });
    }

    // Resolve Athlete record
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const athlete = await prisma.athlete.findFirst({
      where: {
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
        professionnelId: proId,
      },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Fiche athlète introuvable pour ce professionnel" }, { status: 404 });
    }

    // Security scan
    const scan = await scanUploadedFile(file, "video");
    if (!scan.safe) {
      return NextResponse.json({ error: scan.reason }, { status: 400 });
    }

    // Save file
    const uploadsDir = path.join(process.cwd(), "uploads", "videos");
    await mkdir(uploadsDir, { recursive: true });

    const ext = `.${scan.detectedType}`;
    const filename = `vid-${randomUUID()}${ext}`;
    await writeFile(path.join(uploadsDir, filename), scan.buffer);
    const filePath = `/uploads/videos/${filename}`;

    // Create DB record
    const video = await (prisma as any).athleteVideo.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        filePath,
        note: note || null,
        uploadToken: `athlete-${randomUUID()}`,
        athleteId: athlete.id,
        professionnelId: proId,
      },
    });

    return NextResponse.json({ ok: true, id: video.id });
  } catch (error) {
    console.error("[athlete/videos/upload] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
