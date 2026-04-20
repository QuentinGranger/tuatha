import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sendDocumentEmail } from "@/lib/email";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { secrets } from "@/lib/vault";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { signFilePathInRecords, signFileUrlForEmail } from "@/lib/signedUrl";
import { scanUploadedFile } from "@/lib/fileScan";
import { softDelete, notDeleted } from "@/lib/softDelete";

const CATEGORY_LABELS: Record<string, string> = {
  bilan: "Bilan", ordonnance: "Ordonnance", imagerie: "Imagerie",
  "compte-rendu": "Compte-rendu", programme: "Programme",
  administratif: "Administratif", autre: "Autre",
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain",
  "application/zip", "application/x-zip-compressed",
  "application/x-rar-compressed", "application/x-7z-compressed",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// GET /api/documents — list documents for the current pro
// ?type=pro|athlete — filter by document type
// ?proId=xxx — filter pro-to-pro docs with a specific pro
// ?athleteId=xxx — filter pro-to-athlete docs with a specific athlete
export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const listLimit = applyRateLimit(`list-docs:${session.id}`, RATE_LIMITS.heavyQuery);
    if (listLimit) return listLimit;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "pro" or "athlete"
    const proId = searchParams.get("proId");
    const athleteId = searchParams.get("athleteId");

    let where: any;

    if (type === "pro") {
      if (proId) {
        where = {
          receiverAthleteId: null,
          OR: [
            { senderProId: session.id, receiverProId: proId },
            { senderProId: proId, receiverProId: session.id },
          ],
        };
      } else {
        where = {
          receiverAthleteId: null,
          OR: [
            { senderProId: session.id, receiverProId: { not: null } },
            { receiverProId: session.id },
          ],
        };
      }
    } else if (type === "athlete") {
      if (athleteId) {
        where = { senderProId: session.id, receiverAthleteId: athleteId, deletedAt: null };
      } else {
        where = { senderProId: session.id, receiverAthleteId: { not: null }, deletedAt: null };
      }
    } else {
      where = {
        OR: [
          { senderProId: session.id },
          { receiverProId: session.id },
        ],
      };
    }

    const docs = await (prisma as any).sharedDocument.findMany({
      where,
      include: {
        senderPro: { select: { id: true, nom: true, prenom: true, specialite: true } },
        receiverPro: { select: { id: true, nom: true, prenom: true, specialite: true } },
        receiverAthlete: { select: { id: true, name: true } },
        athlete: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also fetch documents sent BY athletes TO this pro (AthleteDocument)
    if (type === "athlete") {
      const athleteDocWhere: any = { professionnelId: session.id, deletedAt: null };
      if (athleteId) athleteDocWhere.athleteId = athleteId;

      const athleteDocs = await (prisma as any).athleteDocument.findMany({
        where: athleteDocWhere,
        include: {
          athlete: { select: { id: true, name: true } },
          athleteUser: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Map athlete docs to match SharedDocument shape for the frontend
      const mappedAthleteDocs = athleteDocs.map((d: any) => ({
        id: d.id,
        filename: d.filename,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
        filePath: d.filePath,
        category: d.category,
        note: d.note,
        senderProId: null,
        senderPro: null,
        receiverPro: { id: session.id, nom: "", prenom: "", specialite: "" },
        receiverAthlete: null,
        receiverAthleteId: null,
        athlete: d.athlete || (d.athleteUser ? { id: d.athleteUser.id, name: `${d.athleteUser.prenom} ${d.athleteUser.nom}` } : null),
        readAt: d.readAt,
        createdAt: d.createdAt,
        _fromAthlete: true,
        _athleteUserName: d.athleteUser ? `${d.athleteUser.prenom} ${d.athleteUser.nom}` : null,
      }));

      const allDocs = [...signFilePathInRecords(docs, session.id), ...signFilePathInRecords(mappedAthleteDocs, session.id)];
      allDocs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json(allDocs);
    }

    return NextResponse.json(signFilePathInRecords(docs, session.id));
  } catch (error) {
    console.error("GET /api/documents error:", error instanceof Error ? error.message : error, error instanceof Error ? error.stack : "");
    return NextResponse.json({ error: "Erreur serveur", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}, { resource: "documents" });

// POST /api/documents — upload a new document
export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const limited = applyRateLimit(`upload:${session.id}`, RATE_LIMITS.upload);
    if (limited) return limited;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const receiverProId = formData.get("receiverProId") as string | null;
    const receiverAthleteId = formData.get("receiverAthleteId") as string | null;
    const athleteId = formData.get("athleteId") as string | null; // context
    const category = (formData.get("category") as string) || "autre";
    const note = formData.get("note") as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }
    if (!receiverProId && !receiverAthleteId) {
      return NextResponse.json({ error: "Destinataire requis" }, { status: 400 });
    }

    // Security: magic bytes + content scan before writing to disk
    const scan = await scanUploadedFile(file, "document");
    if (!scan.safe) {
      return NextResponse.json({ error: scan.reason }, { status: 400 });
    }

    // Save scanned file
    const uploadsDir = path.join(process.cwd(), "uploads", "documents");
    await mkdir(uploadsDir, { recursive: true });

    const ext = `.${scan.detectedType}`;
    const filename = `doc-${randomUUID()}${ext}`;
    await writeFile(path.join(uploadsDir, filename), scan.buffer);
    const filePath = `/uploads/documents/${filename}`;

    const doc = await (prisma as any).sharedDocument.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        filePath,
        category,
        note: note || null,
        senderProId: session.id,
        receiverProId: receiverProId || null,
        receiverAthleteId: receiverAthleteId || null,
        athleteId: athleteId || null,
        currentVersion: 1,
      },
      include: {
        senderPro: { select: { id: true, nom: true, prenom: true, specialite: true } },
        receiverPro: { select: { id: true, nom: true, prenom: true, specialite: true } },
        receiverAthlete: { select: { id: true, name: true } },
      },
    });

    // Create initial version entry (v1)
    (prisma as any).documentVersion.create({
      data: {
        version: 1,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        filePath,
        note: note || null,
        uploadedById: session.id,
        documentId: doc.id,
      },
    }).catch(() => {});

    // Send email to athlete if they have a contactEmail
    if (receiverAthleteId) {
      try {
        const athlete = await (prisma as any).athlete.findUnique({
          where: { id: receiverAthleteId },
          select: { name: true, contactEmail: true },
        });
        if (athlete?.contactEmail) {
          const sender = await prisma.professionnel.findUnique({
            where: { id: session.id },
            select: { nom: true, prenom: true, specialite: true },
          });
          const baseUrl = secrets.appUrl();
          await sendDocumentEmail({
            to: athlete.contactEmail,
            senderName: sender ? `${sender.prenom} ${sender.nom}` : "Un professionnel",
            senderSpecialite: sender?.specialite || null,
            athleteName: athlete.name,
            documentName: file.name,
            category: CATEGORY_LABELS[category] || category,
            note: note || null,
            downloadUrl: `${baseUrl}${signFileUrlForEmail(filePath)}`,
          });
        }
      } catch (emailErr) {
        console.error("[Documents] Email send failed (non-blocking):", emailErr);
      }
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("POST /api/documents error:", error instanceof Error ? error.message : error, error instanceof Error ? error.stack : "");
    return NextResponse.json({ error: "Erreur serveur", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}, { resource: "documents" });

// DELETE /api/documents?id=xxx — delete a document
export const DELETE = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const doc = await (prisma as any).sharedDocument.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    if (doc.senderProId !== session.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Soft-delete (file preserved on disk for recovery during retention period)
    await softDelete("sharedDocument", id, session.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/documents error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "documents" });
