// ─── Restore a Previous Document Version ───
//
// POST /api/documents/[id]/versions/restore
// Body: { versionId: string }
//
// Restores a previous version by making it the "current" document.
// A new version entry is created (restore = new version pointing to old file).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

export const POST = withAuth(async (
  request: NextRequest,
  ctx,
  routeCtx,
) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;

    const body = await request.json();
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json({ error: "versionId requis." }, { status: 400 });
    }

    // Fetch document
    const doc = await (prisma as any).sharedDocument.findUnique({
      where: { id },
      select: { id: true, senderProId: true, receiverProId: true, currentVersion: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }

    // Only sender can restore versions
    if (doc.senderProId !== session.id) {
      return NextResponse.json({ error: "Seul l'expéditeur peut restaurer une version." }, { status: 403 });
    }

    // Fetch the target version
    const targetVersion = await (prisma as any).documentVersion.findUnique({
      where: { id: versionId },
    });

    if (!targetVersion || targetVersion.documentId !== id) {
      return NextResponse.json({ error: "Version introuvable." }, { status: 404 });
    }

    const newVersionNum = doc.currentVersion + 1;

    // Create a new version entry (restore = new version referencing old file)
    // and update the document to point to the restored file
    const [restoredVersion] = await (prisma as any).$transaction([
      (prisma as any).documentVersion.create({
        data: {
          version: newVersionNum,
          filename: targetVersion.filename,
          originalName: targetVersion.originalName,
          mimeType: targetVersion.mimeType,
          size: targetVersion.size,
          filePath: targetVersion.filePath,
          note: `Restauration de la version ${targetVersion.version}`,
          uploadedById: session.id,
          documentId: id,
        },
      }),
      (prisma as any).sharedDocument.update({
        where: { id },
        data: {
          filename: targetVersion.filename,
          originalName: targetVersion.originalName,
          mimeType: targetVersion.mimeType,
          size: targetVersion.size,
          filePath: targetVersion.filePath,
          currentVersion: newVersionNum,
        },
      }),
    ]);

    return NextResponse.json({
      message: `Version ${targetVersion.version} restaurée en tant que v${newVersionNum}.`,
      restoredFrom: targetVersion.version,
      newVersion: newVersionNum,
      version: restoredVersion,
    });
  } catch (error) {
    console.error("POST /api/documents/[id]/versions/restore error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}, { resource: "documents" });
