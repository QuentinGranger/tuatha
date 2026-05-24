import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";

// ─── Token Lifetimes ───

const ACCESS_TOKEN_TTL_MIN = 15;                                  // 15 minutes
const REFRESH_TOKEN_TTL_DAYS = 30;                                // 30 days
const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_MIN * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// ─── Cookie Names ───
// In production, use __Host- / __Secure- prefixes (anti-MITM):
//   __Host- requires Secure + Path=/ + no Domain → prevents cookie injection via subdomains
//   __Secure- requires Secure → prevents transmission over HTTP

const IS_PROD = process.env.NODE_ENV === "production";

const ACCESS_COOKIE = IS_PROD ? "__Host-tuatha_access" : "tuatha_access";
const REFRESH_COOKIE = IS_PROD ? "__Secure-tuatha_refresh" : "tuatha_refresh";

// Old cookie names for backward compat during migration
const LEGACY_ACCESS = "tuatha_access";
const LEGACY_REFRESH = "tuatha_refresh";
const LEGACY_COOKIE = "tuatha_session";

// ─── Device fingerprinting ───

export function parseDevice(userAgent: string | null): { name: string; hash: string } {
  if (!userAgent) return { name: "Appareil inconnu", hash: "unknown" };

  let browser = "Navigateur";
  let os = "Système";

  // Browser detection
  if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Edg/")) browser = "Edge";
  else if (userAgent.includes("OPR") || userAgent.includes("Opera")) browser = "Opera";
  else if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Chrome";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";

  // OS detection
  if (userAgent.includes("Mac OS")) os = "macOS";
  else if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

  const name = `${browser} sur ${os}`;
  const hash = createHash("sha256").update(userAgent).digest("hex").slice(0, 16);

  return { name, hash };
}

// ─── Token generation ───

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function generateTokenFamily(): string {
  return randomBytes(16).toString("hex");
}

// ─── Create session (dual tokens) ───

export interface CreateSessionResult {
  accessToken: string;       // Short-lived (15min)
  refreshToken: string;      // Long-lived (30d), rotated on use
  isNewDevice: boolean;
  deviceName: string;
  sessionId: string;
}

export async function createSession(
  professionnelId: string,
  specialite: string,
  ip: string | null,
  userAgent: string | null
): Promise<CreateSessionResult>;
export async function createSession(
  userId: string,
  role: string,
  ip: string | null,
  userAgent: string | null,
  userType?: "pro" | "athlete"
): Promise<CreateSessionResult>;
export async function createSession(
  userId: string,
  role: string,
  ip: string | null,
  userAgent: string | null,
  userType: "pro" | "athlete" = "pro"
): Promise<CreateSessionResult> {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const tokenFamily = generateTokenFamily();
  const device = parseDevice(userAgent);

  const now = new Date();
  const accessExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS);
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

  // Check if this device has been seen before
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceWhere: any = userType === "athlete"
    ? { athleteUserId: userId, deviceHash: device.hash, revoked: false }
    : { professionnelId: userId, deviceHash: device.hash, revoked: false };
  const existingDevice = await prisma.authSession.findFirst({ where: deviceWhere });
  const isNewDevice = !existingDevice;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createData: any = {
    token: accessToken,
    refreshToken,
    expiresAt: accessExpiresAt,
    refreshExpiresAt,
    tokenFamily,
    rotationCount: 0,
    ip,
    userAgent,
    deviceName: device.name,
    deviceHash: device.hash,
  };
  if (userType === "athlete") createData.athleteUserId = userId;
  else createData.professionnelId = userId;

  const session = await prisma.authSession.create({ data: createData });

  return {
    accessToken: `${accessToken}:${role}`,
    refreshToken,
    isNewDevice,
    deviceName: device.name,
    sessionId: session.id,
  };
}

// ─── Validate access token (called from API routes) ───

export interface SessionData {
  id: string;
  specialite: string;
  sessionId: string;
}

export async function getSessionPro(): Promise<SessionData | null> {
  const cookieStore = await cookies();

  // Try prefixed cookie first, then old names, then legacy cookie
  const raw = cookieStore.get(ACCESS_COOKIE)?.value
    || cookieStore.get(LEGACY_ACCESS)?.value
    || cookieStore.get(LEGACY_COOKIE)?.value;
  if (!raw) return null;

  // Format: "token:specialite"
  const colonIdx = raw.indexOf(":");
  if (colonIdx === -1) return null;
  const token = raw.slice(0, colonIdx);
  const specialite = raw.slice(colonIdx + 1);
  if (!token || !specialite) return null;

  // Validate in DB
  const session = await prisma.authSession.findUnique({ where: { token } });
  if (!session) return null;
  if (session.revoked) return null;
  if (new Date() > session.expiresAt) return null; // Access token expired → client must refresh

  // Update lastActiveAt (throttled: only if >5 min since last update)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (session.lastActiveAt < fiveMinAgo) {
    prisma.authSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    }).catch(() => {}); // fire-and-forget
  }

  return { id: session.professionnelId!, specialite, sessionId: session.id };
}

// ─── Validate access token for athlete users ───

export interface AthleteSessionData {
  id: string;
  role: "athlete";
  sessionId: string;
}

export async function getSessionAthlete(): Promise<AthleteSessionData | null> {
  const cookieStore = await cookies();

  const raw = cookieStore.get(ACCESS_COOKIE)?.value
    || cookieStore.get(LEGACY_ACCESS)?.value
    || cookieStore.get(LEGACY_COOKIE)?.value;
  if (!raw) return null;

  const colonIdx = raw.indexOf(":");
  if (colonIdx === -1) return null;
  const token = raw.slice(0, colonIdx);
  const role = raw.slice(colonIdx + 1);
  if (!token || role !== "athlete") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session: any = await prisma.authSession.findUnique({ where: { token } });
  if (!session) return null;
  if (session.revoked) return null;
  if (new Date() > session.expiresAt) return null;
  if (!session.athleteUserId) return null;

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (session.lastActiveAt < fiveMinAgo) {
    prisma.authSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    }).catch(() => {});
  }

  return { id: session.athleteUserId, role: "athlete", sessionId: session.id };
}

// ─── Refresh token: rotate and issue new access token ───

export interface RefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  specialite?: string;
  error?: string;
  theftDetected?: boolean;
}

export async function refreshSession(
  oldRefreshToken: string,
  ip: string | null,
  userAgent: string | null
): Promise<RefreshResult> {
  // Find the session with this refresh token
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session: any = await prisma.authSession.findUnique({
    where: { refreshToken: oldRefreshToken },
    include: { professionnel: { select: { specialite: true } } },
  });

  if (!session) {
    return { success: false, error: "Token de refresh invalide." };
  }

  // Check if revoked — possible theft detection
  if (session.revoked) {
    // Token reuse detected! Someone is using a rotated-out token.
    // Revoke the ENTIRE token family as a precaution.
    await revokeTokenFamily(session.tokenFamily!, "theft_detected");
    return {
      success: false,
      error: "Activité suspecte détectée. Toutes les sessions ont été révoquées.",
      theftDetected: true,
    };
  }

  // Check refresh token expiry
  if (session.refreshExpiresAt && new Date() > session.refreshExpiresAt) {
    await prisma.authSession.update({
      where: { id: session.id },
      data: { revoked: true, revokedAt: new Date(), revokedReason: "expired" },
    });
    return { success: false, error: "Session expirée. Veuillez vous reconnecter." };
  }

  // ─── Rotate: revoke old, create new ───

  const newAccessToken = generateToken();
  const newRefreshToken = generateToken();
  const now = new Date();

  // Revoke the old session (mark as rotated, not stolen)
  await prisma.authSession.update({
    where: { id: session.id },
    data: { revoked: true, revokedAt: now, revokedReason: "rotation" },
  });

  // Determine user type
  const isAthlete = !!session.athleteUserId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rotateData: any = {
    token: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    tokenFamily: session.tokenFamily,
    rotationCount: session.rotationCount + 1,
    ip,
    userAgent,
    deviceName: session.deviceName,
    deviceHash: session.deviceHash,
  };
  if (isAthlete) rotateData.athleteUserId = session.athleteUserId;
  else rotateData.professionnelId = session.professionnelId;

  // Create the new session in the same token family
  await prisma.authSession.create({ data: rotateData });

  const specialite = isAthlete ? "athlete" : session.professionnel?.specialite || "unknown";

  return {
    success: true,
    accessToken: `${newAccessToken}:${specialite}`,
    refreshToken: newRefreshToken,
    specialite,
  };
}

// ─── Revoke entire token family (theft response) ───

async function revokeTokenFamily(family: string, reason: string): Promise<number> {
  const result = await prisma.authSession.updateMany({
    where: { tokenFamily: family, revoked: false },
    data: { revoked: true, revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

// ─── Revoke single session ───

export async function revokeSession(sessionId: string, reason = "logout"): Promise<void> {
  await prisma.authSession.update({
    where: { id: sessionId },
    data: { revoked: true, revokedAt: new Date(), revokedReason: reason },
  });
}

// ─── Revoke ALL sessions for a user (logout global) ───

export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string,
  userType: "pro" | "athlete" = "pro",
  reason = "logout",
): Promise<number> {
  const where: Record<string, unknown> = {
    revoked: false,
  };
  if (userType === "athlete") where.athleteUserId = userId;
  else where.professionnelId = userId;
  if (exceptSessionId) {
    where.id = { not: exceptSessionId };
  }

  const result = await prisma.authSession.updateMany({
    where,
    data: { revoked: true, revokedAt: new Date(), revokedReason: reason },
  });

  return result.count;
}

// ─── Get active sessions for a user ───

export async function getActiveSessions(professionnelId: string) {
  return prisma.authSession.findMany({
    where: {
      professionnelId,
      revoked: false,
      refreshExpiresAt: { gte: new Date() },
    },
    select: {
      id: true,
      deviceName: true,
      ip: true,
      lastActiveAt: true,
      createdAt: true,
      rotationCount: true,
    },
    orderBy: { lastActiveAt: "desc" },
  });
}

// ─── Anti-MITM: get session's stored IP for comparison ───

const sessionIpCache = new Map<string, { ip: string | null; ts: number }>();
const IP_CACHE_TTL = 5 * 60 * 1000; // 5 min cache to avoid DB hits on every request

export async function getSessionIp(sessionId: string): Promise<string | null> {
  const cached = sessionIpCache.get(sessionId);
  if (cached && Date.now() - cached.ts < IP_CACHE_TTL) return cached.ip;

  try {
    const session = await (prisma as any).authSession.findUnique({
      where: { id: sessionId },
      select: { ip: true },
    });
    const ip = session?.ip || null;
    sessionIpCache.set(sessionId, { ip, ts: Date.now() });

    // Trim cache
    if (sessionIpCache.size > 1000) {
      const oldest = [...sessionIpCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
      for (let i = 0; i < 500; i++) sessionIpCache.delete(oldest[i][0]);
    }

    return ip;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ───

export const SESSION_COOKIE_NAME = ACCESS_COOKIE;
export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;
export const LEGACY_COOKIE_NAME = LEGACY_COOKIE;
export const LEGACY_REFRESH_NAME = LEGACY_REFRESH;
export const ACCESS_COOKIE_MAX_AGE = ACCESS_TOKEN_TTL_MIN * 60;                // 15 min in seconds
export const REFRESH_COOKIE_MAX_AGE = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;  // 30 days in seconds

// Backward compat alias
export const SESSION_COOKIE_MAX_AGE = ACCESS_COOKIE_MAX_AGE;

// ─── Helper: set both cookies on a response ───

export function setAuthCookies(
  response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } },
  accessToken: string,
  refreshToken: string
): void {
  const isProduction = process.env.NODE_ENV === "production";

  // Short-lived access cookie
  response.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  // Long-lived refresh cookie (stricter path: only accessible from /api/auth)
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  // Clear legacy cookie if present
  response.cookies.set(LEGACY_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// ─── Helper: clear all auth cookies ───

export function clearAuthCookies(
  response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } }
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const clearOpts = { httpOnly: true, secure: isProduction, sameSite: "lax" as const, path: "/", maxAge: 0 };

  response.cookies.set(ACCESS_COOKIE, "", clearOpts);
  response.cookies.set(REFRESH_COOKIE, "", { ...clearOpts, path: "/api/auth" });
  // Clear old unprefixed cookies too (migration cleanup)
  if (IS_PROD) {
    response.cookies.set(LEGACY_ACCESS, "", clearOpts);
    response.cookies.set(LEGACY_REFRESH, "", { ...clearOpts, path: "/api/auth" });
  }
  response.cookies.set(LEGACY_COOKIE, "", clearOpts);
}
