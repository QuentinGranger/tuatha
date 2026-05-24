// ─── Admin Session Management ───
// Separate from pro/athlete sessions. Admin uses a dedicated cookie.
// Only one admin account exists (hardcoded hash, not in DB).

import { cookies } from "next/headers";
import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

// ─── Config ───

const ADMIN_COOKIE = "tuatha_admin_session";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const IS_PROD = process.env.NODE_ENV === "production";

// ─── Admin credentials ───
// SHA-256 of the admin password — never store plaintext
const ADMIN_EMAIL = "quentinsavigny@protonmail.com";
const ADMIN_PASSWORD_HASH = createHash("sha256")
  .update("Tuatha-Admin-2024!")
  .digest("hex");

// ─── Public API ───

export function verifyAdminCredentials(email: string, password: string): boolean {
  if (email.toLowerCase().trim() !== ADMIN_EMAIL) return false;

  const inputHash = createHash("sha256").update(password).digest("hex");
  const expected = Buffer.from(ADMIN_PASSWORD_HASH, "hex");
  const actual = Buffer.from(inputHash, "hex");

  return timingSafeEqual(expected, actual);
}

export async function createAdminSession(ip?: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Use raw SQL to insert session
  await prisma.$executeRaw`
    INSERT INTO "AdminSession" (id, token, email, ip, "userAgent", "expiresAt", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${token}, ${ADMIN_EMAIL}, ${ip}, ${userAgent}, ${expiresAt}, NOW(), NOW())
  `;

  // Cleanup expired sessions
  await prisma.$executeRaw`DELETE FROM "AdminSession" WHERE "expiresAt" < NOW()`;

  return token;
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const sessions = await prisma.$queryRaw<{ email: string; expiresAt: Date }[]>`
    SELECT email, "expiresAt" FROM "AdminSession" WHERE token = ${token} LIMIT 1
  `;
  
  const session = sessions[0];
  if (!session) return null;
  
  if (session.expiresAt < new Date()) {
    await prisma.$executeRaw`DELETE FROM "AdminSession" WHERE token = ${token}`;
    return null;
  }

  return { email: session.email };
}

export async function destroyAdminSession(token: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "AdminSession" WHERE token = ${token}`;
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE;
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
