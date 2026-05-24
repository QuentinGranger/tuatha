import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";
import { readFile } from "fs/promises";
import path from "path";
import { readFileAuto } from "@/lib/fileEncryption";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv", ".txt": "text/plain", ".zip": "application/zip",
};

// GET /api/athlete/documents/download?id=xxx&type=received|sent
// Serves the file after verifying the athlete owns/received the document
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-doc-dl:${ip}`, RATE_LIMITS.download);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("id");
    const type = searchParams.get("type"); // "received" or "sent"

    if (!docId || !type) {
      return NextResponse.json({ error: "id et type requis" }, { status: 400 });
    }

    // Get athlete email for matching
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    let filePath: string | null = null;
    let originalName: string | null = null;
    let mimeType: string | null = null;

    if (type === "received") {
      // Document from SharedDocument where athlete is receiver
      const athletes = await (prisma as any).athlete.findMany({
        where: { contactEmail: { equals: athleteUser.email, mode: "insensitive" } },
        select: { id: true },
      });
      const athleteIds = athletes.map((a: any) => a.id);

      if (athleteIds.length === 0) {
        return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
      }

      const doc = await (prisma as any).sharedDocument.findFirst({
        where: {
          id: docId,
          receiverAthleteId: { in: athleteIds },
          deletedAt: null,
        },
        select: { filePath: true, originalName: true, mimeType: true },
      });

      if (!doc) {
        return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
      }

      filePath = doc.filePath;
      originalName = doc.originalName;
      mimeType = doc.mimeType;

      // Mark as read
      await (prisma as any).sharedDocument.update({
        where: { id: docId },
        data: { readAt: new Date() },
      }).catch(() => {});

    } else if (type === "sent") {
      // Document from AthleteDocument where athlete is sender
      const doc = await (prisma as any).athleteDocument.findFirst({
        where: {
          id: docId,
          athleteUserId: session.id,
          deletedAt: null,
        },
        select: { filePath: true, originalName: true, mimeType: true },
      });

      if (!doc) {
        return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
      }

      filePath = doc.filePath;
      originalName = doc.originalName;
      mimeType = doc.mimeType;
    } else {
      return NextResponse.json({ error: "type invalide" }, { status: 400 });
    }

    if (!filePath) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    // Prevent directory traversal
    if (filePath.includes("..")) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
    }

    const absPath = path.join(process.cwd(), filePath.replace(/^\//, ""));
    // Strip .enc extension for MIME type detection
    const cleanPath = absPath.replace(/\.enc$/, "");
    const ext = path.extname(cleanPath).toLowerCase();
    const contentType = mimeType || MIME_TYPES[ext] || "application/octet-stream";

    // Auto-decrypt if .enc version exists
    const fileBuf = await readFileAuto(absPath.replace(/\.enc$/, ""));

    return new NextResponse(fileBuf as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(originalName || "document")}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[athlete/documents/download] error:", error);
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
