import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { verifyDocument } from "@/lib/verifyDocument";
import { withAuth } from "@/lib/withAuth";
import { secrets } from "@/lib/vault";
import { scanUploadedFile } from "@/lib/fileScan";
import { sendProVerificationEmail } from "@/lib/email";

const DOC_TYPES: Record<string, string> = {
  rpps: "Numéro RPPS",
  adeli: "Numéro ADELI",
  carte_pro: "Carte professionnelle",
  diplome: "Diplôme",
  structure: "Justificatif de structure",
  other: "Autre document",
};

// GET — Fetch verification status + documents
export const GET = withAuth(async (_req, ctx) => {
  try {
    const proId = ctx.session.id;

    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: {
        verificationStatus: true,
        verifiedAt: true,
        verificationNote: true,
        numeroVerification: true,
        documentPath: true,
        specialite: true,
        verificationDocs: {
          select: {
            id: true,
            type: true,
            label: true,
            filePath: true,
            status: true,
            note: true,
            aiVerified: true,
            aiConfidence: true,
            aiSummary: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!pro) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    return NextResponse.json(pro);
  } catch (error) {
    console.error("GET /api/profil/verification:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });

// POST — Upload a new verification document and request verification
export const POST = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;
    const label = formData.get("label") as string | null;

    if (!file || !type) {
      return NextResponse.json({ error: "Fichier et type requis" }, { status: 400 });
    }

    if (!DOC_TYPES[type]) {
      return NextResponse.json({ error: "Type de document invalide" }, { status: 400 });
    }

    // Security: magic bytes + content scan before writing to disk
    const scan = await scanUploadedFile(file, "verification");
    if (!scan.safe) {
      return NextResponse.json({ error: scan.reason }, { status: 400 });
    }

    // Save scanned file
    const fileName = `verif_${proId}_${type}_${Date.now()}.${scan.detectedType}`;
    const dir = path.join(process.cwd(), "uploads", "verification");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), scan.buffer);

    const docLabel = label || DOC_TYPES[type];
    const storedPath = `/uploads/verification/${fileName}`;

    // Fetch pro info for AI verification
    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { nom: true, prenom: true, specialite: true, numeroVerification: true, verificationStatus: true },
    });

    if (!pro) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    // Create verification document
    const doc = await prisma.verificationDocument.create({
      data: {
        type,
        label: docLabel,
        filePath: storedPath,
        professionnelId: proId,
      },
    });

    // Update status to pending
    if (pro.verificationStatus === "unverified" || pro.verificationStatus === "rejected") {
      await prisma.professionnel.update({
        where: { id: proId },
        data: { verificationStatus: "pending", verificationNote: null },
      });
    }

    // Run AI verification (non-blocking — don't make user wait)
    if (secrets.hasOpenAI()) {
      verifyDocument(storedPath, type, {
        nom: pro.nom,
        prenom: pro.prenom,
        specialite: pro.specialite,
        numeroVerification: pro.numeroVerification,
      }).then(async (result) => {
        const docStatus = result.verified && result.confidence >= 80
          ? "accepted"
          : result.confidence < 50
            ? "rejected"
            : "pending";

        await prisma.verificationDocument.update({
          where: { id: doc.id },
          data: {
            aiVerified: result.verified,
            aiConfidence: result.confidence,
            aiSummary: result.summary,
            aiRawResponse: result.rawResponse,
            status: docStatus,
            note: docStatus === "rejected"
              ? `IA : ${result.summary}`
              : docStatus === "accepted"
                ? `Vérifié automatiquement (confiance : ${result.confidence}%)`
                : null,
          },
        });

        // Auto-verify pro if high confidence
        if (docStatus === "accepted") {
          await prisma.professionnel.update({
            where: { id: proId },
            data: {
              verificationStatus: "verified",
              verifiedAt: new Date(),
              verificationNote: `Vérifié automatiquement par IA (confiance : ${result.confidence}%)`,
            },
          });

          // Send pro verified email
          try {
            const verifiedPro = await prisma.professionnel.findUnique({
              where: { id: proId },
              select: { email: true, prenom: true, nom: true, specialite: true },
            });
            if (verifiedPro?.email) {
              await sendProVerificationEmail({
                to: verifiedPro.email,
                prenom: verifiedPro.prenom || "",
                nom: verifiedPro.nom || "",
                status: "verified",
                note: null,
                specialite: verifiedPro.specialite || "Professionnel de santé",
              });
            }
          } catch (emailErr) {
            console.error("Failed to send pro verified email:", emailErr);
          }
        } else if (docStatus === "rejected") {
          await prisma.professionnel.update({
            where: { id: proId },
            data: {
              verificationNote: `IA : ${result.summary}`,
            },
          });

          // Send pro rejected email
          try {
            const rejectedPro = await prisma.professionnel.findUnique({
              where: { id: proId },
              select: { email: true, prenom: true, nom: true, specialite: true },
            });
            if (rejectedPro?.email) {
              await sendProVerificationEmail({
                to: rejectedPro.email,
                prenom: rejectedPro.prenom || "",
                nom: rejectedPro.nom || "",
                status: "rejected",
                note: result.summary || null,
                specialite: rejectedPro.specialite || "Professionnel de santé",
              });
            }
          } catch (emailErr) {
            console.error("Failed to send pro rejected email:", emailErr);
          }
        }
      }).catch((err) => {
        console.error("AI verification background error:", err);
      });
    }

    return NextResponse.json({
      message: "Document soumis — vérification automatique en cours",
      document: {
        id: doc.id,
        type: doc.type,
        label: doc.label,
        status: doc.status,
        createdAt: doc.createdAt,
      },
    });
  } catch (error) {
    console.error("POST /api/profil/verification:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });
