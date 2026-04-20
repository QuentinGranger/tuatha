import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { scanUploadedFile } from "@/lib/fileScan";
import { verifyConversationAccess } from "@/lib/conversationAccess";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// POST /api/reseau/messages/upload
// Uploads file(s) for a message attachment. Returns attachment metadata.
// FormData: files[], receiverProId, athleteId? 

const MAX_FILES = 5;

export const POST = withAuth(async (request, ctx) => {
  try {
    const session = ctx.session;
    const formData = await request.formData();

    const receiverProId = formData.get("receiverProId") as string | null;
    if (!receiverProId) {
      return NextResponse.json({ error: "receiverProId requis" }, { status: 400 });
    }

    const athleteId = formData.get("athleteId") as string | null;

    // Verify conversation access
    const access = await verifyConversationAccess(session.id, receiverProId, athleteId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

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
    const uploadsDir = path.join(process.cwd(), "uploads", "messages");
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
      const filename = `msg-${randomUUID()}${ext}`;
      await writeFile(path.join(uploadsDir, filename), scan.buffer);
      const filePath = `/uploads/messages/${filename}`;

      results.push({
        id: randomUUID(), // temporary ID, real ID assigned when message is created
        filename,
        originalName: scan.sanitizedName,
        mimeType: scan.detectedMime,
        size: file.size,
        filePath,
      });
    }

    return NextResponse.json({ attachments: results });
  } catch (error) {
    console.error("POST /api/reseau/messages/upload error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });
