// ─── Signed URLs for Private File Access ───
// Generates time-limited HMAC-signed tokens for file downloads.
// No permanent public links — every file access requires a valid signed URL.
//
// Every signed URL embeds a `sub` (subject) identifying who the URL was generated for:
//   - proId string → only that authenticated pro can download
//   - "email"      → external link (e.g. athlete email), no session required but time-limited
//
// Usage:
//   signFileUrl("/uploads/documents/doc.pdf", proId)
//   // → "/api/uploads/documents/doc.pdf?token=xxx&expires=yyy&sub=proId"
//
//   verifyFileToken(filePath, token, expires, sub)
//   // → true if HMAC valid, not expired

import { createHmac, timingSafeEqual } from "crypto";
import { secrets } from "@/lib/vault";

// ─── Configuration ───

const DEFAULT_TTL_MS = 60 * 60 * 1000;        // 1 hour for documents/videos
const AVATAR_TTL_MS = 24 * 60 * 60 * 1000;    // 24 hours for avatars (frequently displayed)

function getSigningKey(): string {
  try {
    return secrets.encryptionKey();
  } catch {
    return "dev-signed-url-key-not-for-production";
  }
}

const EMAIL_TTL_MS = 24 * 60 * 60 * 1000;     // 24 hours for email download links

// ─── Token Generation ───

function generateToken(filePath: string, expiresAt: number, sub: string): string {
  const payload = `${filePath}:${expiresAt}:${sub}`;
  return createHmac("sha256", getSigningKey()).update(payload).digest("base64url");
}

// ─── Public API ───

/**
 * Convert an internal filePath to a signed API URL bound to a specific user.
 *
 * @param filePath - Internal path, e.g. "/uploads/documents/doc-uuid.pdf"
 * @param sub      - Subject: proId (for authenticated access) or "email" (for external links)
 * @param ttlMs    - Time-to-live in milliseconds (default 1 hour)
 */
export function signFileUrl(filePath: string, sub: string, ttlMs = DEFAULT_TTL_MS): string {
  const normalized = filePath.startsWith("/uploads/") ? filePath : `/uploads/${filePath}`;
  const apiPath = normalized.replace(/^\/uploads\//, "/api/uploads/");

  const expiresAt = Math.floor((Date.now() + ttlMs) / 1000);
  const token = generateToken(normalized, expiresAt, sub);

  return `${apiPath}?token=${token}&expires=${expiresAt}&sub=${encodeURIComponent(sub)}`;
}

/**
 * Sign a file URL for email recipients (no authentication required, 24h TTL).
 */
export function signFileUrlForEmail(filePath: string): string {
  return signFileUrl(filePath, "email", EMAIL_TTL_MS);
}

/**
 * Sign an avatar URL (longer TTL, any authenticated user can view).
 */
export function signAvatarUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  return signFileUrl(filePath, "avatar", AVATAR_TTL_MS);
}

/**
 * Verify a signed file token.
 *
 * @param filePath - The internal file path (e.g. "/uploads/documents/doc-uuid.pdf")
 * @param token - The HMAC token from query params
 * @param expires - The expiration timestamp (seconds) from query params
 * @param sub - The subject from query params (proId, "email", or "avatar")
 * @returns true if HMAC valid and not expired
 */
export function verifyFileToken(filePath: string, token: string, expires: string, sub: string): boolean {
  const expiresAt = Number(expires);
  if (isNaN(expiresAt)) return false;
  if (!sub) return false;

  // Check expiry
  if (Math.floor(Date.now() / 1000) > expiresAt) return false;

  // Verify HMAC (includes sub in payload)
  const expected = generateToken(filePath, expiresAt, sub);

  if (token.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Sign all filePath fields in an array of records.
 * Adds a `signedUrl` field and replaces `filePath` with the signed URL.
 */
export function signFilePathInRecords<T extends Record<string, unknown>>(
  records: T[],
  proId: string,
  field = "filePath",
): T[] {
  return records.map((r) => signFilePathInRecord(r, proId, field));
}

/**
 * Sign the filePath field in a single record.
 */
export function signFilePathInRecord<T extends Record<string, unknown>>(
  record: T,
  proId: string,
  field = "filePath",
): T {
  const value = record[field];
  if (typeof value === "string" && value) {
    return { ...record, [field]: signFileUrl(value, proId) };
  }
  return record;
}

/**
 * Recursively sign all `avatarPath` fields in a deeply nested object/array.
 * Useful for API responses that include related records with avatarPath.
 */
export function signAvatarPaths<T>(data: T): T {
  if (data == null) return data;
  if (Array.isArray(data)) {
    return data.map((item) => signAvatarPaths(item)) as T;
  }
  if (typeof data === "object") {
    const obj = { ...data } as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key === "avatarPath" && typeof obj[key] === "string") {
        obj[key] = signAvatarUrl(obj[key] as string);
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        obj[key] = signAvatarPaths(obj[key]);
      }
    }
    return obj as T;
  }
  return data;
}
