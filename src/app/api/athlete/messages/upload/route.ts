import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { scanUploadedFile } from "@/lib/fileScan";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MAX_FILES = 5;

// POST /api/athlete/messages/upload
// Uploads file(s) for a message attachment. Returns attachment metadata.
// FormData: files[]
export async function POST(req: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await req.formData();

    // Collect files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} fichiers par envoi` }, { status: 400 });
    }

    // Ensure upload directory exists
    const uploadsDir = path.join(process.cwd(), "uploads", "athlete-messages");
    await mkdir(uploadsDir, { recursive: true });

    const results: {
      id: string;
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      filePath: string;
    }[] = [];

    for (const file of files) {
      // Security scan (magic bytes, content scan, size check)
      const scan = await scanUploadedFile(file, "message");
      if (!scan.safe) {
        return NextResponse.json(
          { error: `${file.name}: ${scan.reason}` },
          { status: 400 },
        );
      }

      const ext = `.${scan.detectedType}`;
      const filename = `ath-${randomUUID()}${ext}`;
      await writeFile(path.join(uploadsDir, filename), scan.buffer);
      const filePath = `/uploads/athlete-messages/${filename}`;

      results.push({
        id: randomUUID(),
        filename,
        originalName: scan.sanitizedName,
        mimeType: scan.detectedMime,
        size: file.size,
        filePath,
      });
    }

    return NextResponse.json({ attachments: results });
  } catch (error) {
    console.error("POST /api/athlete/messages/upload error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
