import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { exchangeCodeForToken } from "@/lib/oura";

/**
 * GET /api/auth/oura/callback?code=...&state=...
 * Oura OAuth 2.0 callback.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.redirect(`${baseUrl}/connexion/athlete`);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      console.error("Oura callback: missing code");
      return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=oura_missing_code`);
    }

    const callbackUrl = `${baseUrl}/api/auth/oura/callback`;
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForToken(code, callbackUrl);

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Store connection
    await prisma.healthAppConnection.upsert({
      where: {
        athleteUserId_provider: { athleteUserId: session.id, provider: "OURA" },
      },
      create: {
        athleteUserId: session.id,
        provider: "OURA",
        status: "connected",
        accessToken,
        refreshToken,
        tokenExpiresAt,
        scopes: ["daily", "heartrate", "workout", "session", "sleep", "personal"],
      },
      update: {
        status: "connected",
        accessToken,
        refreshToken,
        tokenExpiresAt,
        lastSyncError: null,
      },
    });

    console.log(`Oura connected for athlete ${session.id}`);
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?connected=OURA`);
  } catch (error) {
    console.error("GET /api/auth/oura/callback error:", error);
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=oura_callback_failed`);
  }
}
