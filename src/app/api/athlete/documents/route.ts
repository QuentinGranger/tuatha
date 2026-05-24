import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";
import { scanUploadedFile } from "@/lib/fileScan";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { encryptBuffer } from "@/lib/fileEncryption";

export const dynamic = "force-dynamic";

// GET /api/athlete/documents?proId=xxx
// Returns documents received from the pro + documents sent by the athlete to this pro
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-docs:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const proId = searchParams.get("proId");
    if (!proId) {
      return NextResponse.json({ error: "proId requis" }, { status: 400 });
    }

    // Verify accepted connection
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté" }, { status: 403 });
    }

    // Find athlete records linked to this pro
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const athletes = await (prisma as any).athlete.findMany({
      where: {
        professionnelId: proId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true },
    });
    const athleteIds = athletes.map((a: any) => a.id);

    // 1) Docs received FROM the pro (SharedDocument where receiverAthleteId matches)
    const receivedDocs = athleteIds.length > 0
      ? await (prisma as any).sharedDocument.findMany({
          where: {
            receiverAthleteId: { in: athleteIds },
            senderProId: proId,
            deletedAt: null,
          },
          include: {
            senderPro: { select: { id: true, nom: true, prenom: true, specialite: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // 2) Docs sent BY the athlete to this pro (AthleteDocument)
    const sentDocs = await (prisma as any).athleteDocument.findMany({
      where: {
        athleteUserId: session.id,
        professionnelId: proId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    // Map received docs
    const received = receivedDocs.map((d: any) => ({
      id: d.id,
      direction: "received" as const,
      filename: d.filename,
      originalName: d.originalName,
      mimeType: d.mimeType,
      size: d.size,
      filePath: d.filePath,
      category: d.category,
      note: d.note,
      senderName: d.senderPro ? `${d.senderPro.prenom} ${d.senderPro.nom}` : null,
      createdAt: d.createdAt,
    }));

    // Map sent docs
    const sent = sentDocs.map((d: any) => ({
      id: d.id,
      direction: "sent" as const,
      filename: d.filename,
      originalName: d.originalName,
      mimeType: d.mimeType,
      size: d.size,
      filePath: d.filePath,
      category: d.category,
      note: d.note,
      senderName: null,
      createdAt: d.createdAt,
    }));

    // Merge + sort by date desc
    const documents = [...received, ...sent].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("[athlete/documents] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/athlete/documents
// Athlete uploads a document to send to a pro
export async function POST(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-docs-upload:${ip}`, RATE_LIMITS.upload);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const proId = formData.get("proId") as string | null;
    const category = (formData.get("category") as string) || "autre";
    const note = formData.get("note") as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }
    if (!proId) {
      return NextResponse.json({ error: "proId requis" }, { status: 400 });
    }

    // Verify accepted connection
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté" }, { status: 403 });
    }

    // Security scan
    const scan = await scanUploadedFile(file, "document");
    if (!scan.safe) {
      return NextResponse.json({ error: scan.reason }, { status: 400 });
    }

    // Save file
    const uploadsDir = path.join(process.cwd(), "uploads", "athlete-documents");
    await mkdir(uploadsDir, { recursive: true });

    const ext = `.${scan.detectedType}`;
    const baseFilename = `adoc-${randomUUID()}${ext}`;
    const diskPath = path.join(uploadsDir, baseFilename);
    // Encrypt file at rest
    const encPath = await encryptBuffer(scan.buffer, diskPath);
    const filename = path.basename(encPath);
    const filePath = `/uploads/athlete-documents/${filename}`;

    // Find athlete record for this pro
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    const athlete = athleteUser
      ? await (prisma as any).athlete.findFirst({
          where: {
            professionnelId: proId,
            contactEmail: { equals: athleteUser.email, mode: "insensitive" },
          },
          select: { id: true },
        })
      : null;

    const doc = await (prisma as any).athleteDocument.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        filePath,
        category,
        note: note?.trim() || null,
        athleteUserId: session.id,
        athleteId: athlete?.id || null,
        professionnelId: proId,
      },
    });

    // Audit log: athlete document uploaded (CNIL traceability)
    console.log(
      `[SECURITY-AUDIT] ATHLETE_DOCUMENT_UPLOADED by=athlete:${session.id} docId=${doc.id} category=${category} proId=${proId} size=${file.size}`,
    );

    return NextResponse.json({
      document: {
        id: doc.id,
        direction: "sent",
        filename: doc.filename,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
        filePath: doc.filePath,
        category: doc.category,
        note: doc.note,
        createdAt: doc.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[athlete/documents] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
