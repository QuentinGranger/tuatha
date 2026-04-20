// ─── Per-File Access Control ───
// Every file download triggers a DB-level permission check.
// Maps file path → DB record → verifies the requesting user has access.
//
// File types and their permission rules:
//   /uploads/documents/...     → SharedDocument: senderProId OR receiverProId
//   /uploads/videos/...        → AthleteVideo: professionnelId
//   /uploads/verification/...  → VerificationDocument: professionnelId
//   /uploads/avatar-...        → Professionnel.avatarPath: any authenticated user
//
// Called by the uploads route at every download.

import { prisma } from "@/lib/prisma";

export type FileAccessResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Check if a professional has permission to access a specific file.
 *
 * @param proId     - The authenticated professional's ID
 * @param filePath  - Internal file path, e.g. "/uploads/documents/doc-uuid.pdf"
 * @returns { allowed: true } or { allowed: false, reason }
 */
export async function checkFileAccess(proId: string, filePath: string): Promise<FileAccessResult> {
  // ─── Documents ───
  if (filePath.startsWith("/uploads/documents/")) {
    return checkDocumentAccess(proId, filePath);
  }

  // ─── Videos ───
  if (filePath.startsWith("/uploads/videos/")) {
    return checkVideoAccess(proId, filePath);
  }

  // ─── Verification documents ───
  if (filePath.startsWith("/uploads/verification/")) {
    return checkVerificationAccess(proId, filePath);
  }

  // ─── Message attachments ───
  if (filePath.startsWith("/uploads/messages/")) {
    return checkMessageAttachmentAccess(proId, filePath);
  }

  // ─── Avatars ─── any authenticated user can view
  if (filePath.match(/^\/uploads\/avatar-/)) {
    return { allowed: true };
  }

  // Unknown file type — deny by default
  return { allowed: false, reason: "Type de fichier non reconnu." };
}

// ─── Document permission check ───

async function checkDocumentAccess(proId: string, filePath: string): Promise<FileAccessResult> {
  try {
    const doc = await (prisma as any).sharedDocument.findFirst({
      where: { filePath },
      select: { senderProId: true, receiverProId: true },
    });

    if (!doc) {
      return { allowed: false, reason: "Document introuvable." };
    }

    // Sender or receiver can access
    if (doc.senderProId === proId || doc.receiverProId === proId) {
      return { allowed: true };
    }

    return { allowed: false, reason: "Accès non autorisé à ce document." };
  } catch {
    return { allowed: false, reason: "Erreur de vérification." };
  }
}

// ─── Video permission check ───

async function checkVideoAccess(proId: string, filePath: string): Promise<FileAccessResult> {
  try {
    const video = await (prisma as any).athleteVideo.findFirst({
      where: { filePath },
      select: { professionnelId: true },
    });

    if (!video) {
      return { allowed: false, reason: "Vidéo introuvable." };
    }

    if (video.professionnelId === proId) {
      return { allowed: true };
    }

    return { allowed: false, reason: "Accès non autorisé à cette vidéo." };
  } catch {
    return { allowed: false, reason: "Erreur de vérification." };
  }
}

// ─── Verification document permission check ───

async function checkVerificationAccess(proId: string, filePath: string): Promise<FileAccessResult> {
  try {
    const doc = await (prisma as any).verificationDocument.findFirst({
      where: { filePath },
      select: { professionnelId: true },
    });

    if (!doc) {
      return { allowed: false, reason: "Document de vérification introuvable." };
    }

    // Only the owner can access their verification documents
    if (doc.professionnelId === proId) {
      return { allowed: true };
    }

    return { allowed: false, reason: "Accès non autorisé." };
  } catch {
    return { allowed: false, reason: "Erreur de vérification." };
  }
}

// ─── Message attachment permission check ───

async function checkMessageAttachmentAccess(proId: string, filePath: string): Promise<FileAccessResult> {
  try {
    const attachment = await (prisma as any).proMessageAttachment.findFirst({
      where: { filePath },
      select: {
        message: {
          select: { senderProId: true, receiverProId: true },
        },
      },
    });

    if (!attachment?.message) {
      return { allowed: false, reason: "Pièce jointe introuvable." };
    }

    // Sender or receiver can access
    if (attachment.message.senderProId === proId || attachment.message.receiverProId === proId) {
      return { allowed: true };
    }

    return { allowed: false, reason: "Accès non autorisé à cette pièce jointe." };
  } catch {
    return { allowed: false, reason: "Erreur de vérification." };
  }
}
