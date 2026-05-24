import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { stat } from "fs/promises";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";
import { readFileAuto, resolveFilePath } from "@/lib/fileEncryption";
import { verifyFileToken } from "@/lib/signedUrl";
import { getSessionPro } from "@/lib/auth";
import { checkFileAccess } from "@/lib/fileAccess";
import { checkDownloadQuota, recordDownload, logDownload } from "@/lib/exfiltration";
import { getDownloadPolicy, buildDownloadHeaders, auditDownload, type AccessType } from "@/lib/downloadControl";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".zip": "application/zip",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // IP-level rate limit (basic DDoS protection)
  const ip = getIP(request);
  const limited = applyRateLimit(`download:${ip}`, RATE_LIMITS.download);
  if (limited) return limited;

  // Signed URL verification — no permanent public links
  const token = request.nextUrl.searchParams.get("token");
  const expires = request.nextUrl.searchParams.get("expires");
  const sub = decodeURIComponent(request.nextUrl.searchParams.get("sub") || "");

  if (!token || !expires || !sub) {
    return NextResponse.json({ error: "Acc\u00e8s non autoris\u00e9. URL sign\u00e9e requise." }, { status: 403 });
  }

  try {
    const { path: segments } = await params;
    const filename = segments.join("/");

    // Security: prevent directory traversal
    if (filename.includes("..")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify signed token (HMAC includes sub in payload)
    const internalPath = `/uploads/${filename}`;
    if (!verifyFileToken(internalPath, token, expires, sub)) {
      return NextResponse.json({ error: "Lien expir\u00e9 ou invalide." }, { status: 403 });
    }

    // ─── Per-download access control based on sub type ───

    if (sub === "email") {
      // Email links: no session required, signed URL is sufficient (time-limited)
    } else if (sub === "avatar") {
      // Avatars: signed URL is sufficient (HMAC + expiry).
      // No session check — next/image optimizer makes server-side requests without cookies.
    } else {
      // sub = proId: verify session matches AND check DB permission
      const session = await getSessionPro();
      if (!session) {
        return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
      }
      if (session.id !== sub) {
        return NextResponse.json({ error: "Acc\u00e8s non autoris\u00e9." }, { status: 403 });
      }
      // DB-level permission check: verify this pro can access this specific file
      const access = await checkFileAccess(session.id, internalPath);
      if (!access.allowed) {
        return NextResponse.json({ error: access.reason }, { status: 403 });
      }
    }

    const rawPath = path.join(process.cwd(), "uploads", filename);
    // Strip .enc for extension detection (encrypted files keep their original extension in path)
    const cleanFilename = filename.replace(/\.enc$/, "");
    const ext = path.extname(cleanFilename).toLowerCase();
    const contentType = MIME_TYPES[ext];

    if (!contentType) {
      return NextResponse.json({ error: "Type non support\u00e9" }, { status: 400 });
    }

    // Resolve actual path (may be .enc on disk)
    const filePath = await resolveFilePath(rawPath);

    // Get file size for quota tracking
    const fileStat = await stat(filePath);
    const fileSize = fileStat.size;

    // ─── Anti-exfiltration: per-user download quotas ───
    const isAvatar = sub === "avatar";
    const quotaUserId = sub === "email" ? `email:${ip}` : sub === "avatar" ? `avatar:${ip}` : sub;
    const quotaBlock = checkDownloadQuota(quotaUserId, fileSize, isAvatar);
    if (quotaBlock) return quotaBlock;

    // ─── Role-based download restrictions ───
    let policyHeaders: Record<string, string> = {};
    if (sub !== "email" && sub !== "avatar") {
      const proRecord = await (prisma as any).professionnel.findUnique({
        where: { id: sub },
        select: { specialite: true, nom: true, prenom: true },
      });
      const role = (proRecord?.specialite || "coach") as Role;
      const proName = proRecord ? `${proRecord.prenom} ${proRecord.nom}` : sub;

      // Detect document category from DB
      const doc = await (prisma as any).sharedDocument.findFirst({
        where: { filePath: internalPath },
        select: { category: true, receiverAthleteId: true, senderProId: true },
      });
      const category = doc?.category || "autre";
      const accessType: AccessType = doc?.senderProId === sub ? "owner" : "connection";

      const policy = getDownloadPolicy(role, accessType, category);

      if (!policy.canDownload) {
        return NextResponse.json(
          { error: policy.reason || "Téléchargement non autorisé pour votre rôle.", confidentiality: policy.confidentialityLevel },
          { status: 403 },
        );
      }

      policyHeaders = buildDownloadHeaders(policy, sub, proName);

      // Audit the download
      auditDownload("download", sub, {
        fileName: filename,
        athleteId: doc?.receiverAthleteId || undefined,
        category,
        confidentiality: policy.confidentialityLevel,
      });
    }

    const file = await readFileAuto(rawPath);

    // Record download for quota tracking + audit
    recordDownload(quotaUserId, fileSize, internalPath);
    const ua = request.headers.get("user-agent") || "";
    if (sub !== "avatar") {
      logDownload(quotaUserId, internalPath, fileSize, ip, ua);
    }

    return new NextResponse(file as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        ...policyHeaders,
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
