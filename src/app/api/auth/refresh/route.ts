import { NextRequest, NextResponse } from "next/server";
import { refreshSession, REFRESH_COOKIE_NAME, LEGACY_REFRESH_NAME, setAuthCookies, clearAuthCookies } from "@/lib/session";
import { checkRateLimit, retryAfterSeconds, RATE_LIMITS } from "@/lib/rateLimit";
import { cookies } from "next/headers";

// POST /api/auth/refresh
// Uses the httpOnly refresh token cookie to rotate tokens and issue a new access token.
// The refresh cookie is scoped to /api/auth so it's only sent here.

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    const userAgent = request.headers.get("user-agent") || null;

    // Rate limit refresh attempts per IP
    const limit = checkRateLimit(`refresh:${ip}`, RATE_LIMITS.login);
    if (!limit.allowed) {
      const res = NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard.", retryAfter: Math.ceil(limit.retryAfterMs / 1000) },
        { status: 429 }
      );
      res.headers.set("Retry-After", retryAfterSeconds(limit.retryAfterMs));
      return res;
    }

    // Read refresh token from cookie (try prefixed name first, then old name)
    const cookieStore = await cookies();
    const oldRefreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value
      || cookieStore.get(LEGACY_REFRESH_NAME)?.value;

    if (!oldRefreshToken) {
      return NextResponse.json(
        { error: "Token de refresh manquant.", code: "REFRESH_MISSING" },
        { status: 401 }
      );
    }

    // Attempt rotation
    const result = await refreshSession(oldRefreshToken, ip === "unknown" ? null : ip, userAgent);

    if (!result.success) {
      const response = NextResponse.json(
        { error: result.error, code: result.theftDetected ? "THEFT_DETECTED" : "REFRESH_INVALID" },
        { status: 401 }
      );

      // Clear all cookies on failure — force re-login
      clearAuthCookies(response);
      return response;
    }

    // Success: set new dual cookies
    const response = NextResponse.json({ message: "Session renouvelée." });
    setAuthCookies(response, result.accessToken!, result.refreshToken!);

    return response;
  } catch (error) {
    console.error("[Refresh] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
