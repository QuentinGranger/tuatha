// ─── Document Versioning API ───
//
// GET  /api/documents/[id]/versions          — List all versions of a document
// POST /api/documents/[id]/versions          — Upload a new version
// POST /api/documents/[id]/versions/restore  — Restore a previous version
//
// Only the sender (owner) or receiver can access versions.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { scanUploadedFile } from "@/lib/fileScan";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { signFilePathInRecords } from "@/lib/signedUrl";

// ─── GET /api/documents/[id]/versions — list version history ───

export const GET = withAuth(async (
  request: NextRequest,
  ctx,
  routeCtx,
) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;

    // Fetch document + verify access
    const doc = await (prisma as any).sharedDocument.findUnique({
      where: { id },
      select: {
        id: true,
        senderProId: true,
        receiverProId: true,
        currentVersion: true,
        filename: true,
        originalName: true,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }

    // Access check: sender or receiver
    if (doc.senderProId !== session.id && doc.receiverProId !== session.id) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
    }

    // Fetch all versions
    const versions = await (prisma as any).documentVersion.findMany({
      where: { documentId: id },
      include: {
        uploadedBy: {
          select: { id: true, nom: true, prenom: true, specialite: true },
        },
      },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({
      documentId: id,
      currentVersion: doc.currentVersion,
      versions: signFilePathInRecords(versions, session.id),
    });
  } catch (error) {
    console.error("GET /api/documents/[id]/versions error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}, { resource: "documents" });

// ─── POST /api/documents/[id]/versions — upload new version ───

export const POST = withAuth(async (
  request: NextRequest,
  ctx,
  routeCtx,
) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;

    const limited = applyRateLimit(`upload:${session.id}`, RATE_LIMITS.upload);
    if (limited) return limited;

    // Fetch document + verify ownership
    const doc = await (prisma as any).sharedDocument.findUnique({
      where: { id },
      select: {
        id: true,
        senderProId: true,
        receiverProId: true,
        currentVersion: true,
        category: true,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }

    // Only sender or receiver can upload a new version
    if (doc.senderProId !== session.id && doc.receiverProId !== session.id) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const note = formData.get("note") as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    // Security scan
    const scan = await scanUploadedFile(file, "document");
    if (!scan.safe) {
      return NextResponse.json({ error: scan.reason }, { status: 400 });
    }

    // Save file
    const uploadsDir = path.join(process.cwd(), "uploads", "documents");
    await mkdir(uploadsDir, { recursive: true });

    const ext = `.${scan.detectedType}`;
    const filename = `doc-${randomUUID()}${ext}`;
    await writeFile(path.join(uploadsDir, filename), scan.buffer);
    const filePath = `/uploads/documents/${filename}`;

    const newVersion = doc.currentVersion + 1;

    // Create version entry + update document atomically
    const [version, updatedDoc] = await (prisma as any).$transaction([
      (prisma as any).documentVersion.create({
        data: {
          version: newVersion,
          filename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          filePath,
          note: note || null,
          uploadedById: session.id,
          documentId: id,
        },
        include: {
          uploadedBy: {
            select: { id: true, nom: true, prenom: true, specialite: true },
          },
        },
      }),
      (prisma as any).sharedDocument.update({
        where: { id },
        data: {
          filename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          filePath,
          currentVersion: newVersion,
        },
      }),
    ]);

    return NextResponse.json({
      message: `Version ${newVersion} uploadée.`,
      version,
      currentVersion: newVersion,
    });
  } catch (error) {
    console.error("POST /api/documents/[id]/versions error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}, { resource: "documents" });
