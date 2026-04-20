import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { exchangeCodeForToken } from "@/lib/whoop";

/**
 * GET /api/auth/whoop/callback?code=...&state=...
 * WHOOP OAuth 2.0 callback.
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
      console.error("WHOOP callback: missing code");
      return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=whoop_missing_code`);
    }

    const callbackUrl = `${baseUrl}/api/auth/whoop/callback`;
    const { accessToken, refreshToken, expiresIn, whoopUserId } = await exchangeCodeForToken(code, callbackUrl);

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Store connection
    await prisma.healthAppConnection.upsert({
      where: {
        athleteUserId_provider: { athleteUserId: session.id, provider: "WHOOP" },
      },
      create: {
        athleteUserId: session.id,
        provider: "WHOOP",
        status: "connected",
        accessToken,
        refreshToken,
        tokenExpiresAt,
        providerUserId: whoopUserId,
        scopes: ["read:recovery", "read:cycles", "read:sleep", "read:workout", "read:profile", "read:body_measurement"],
      },
      update: {
        status: "connected",
        accessToken,
        refreshToken,
        tokenExpiresAt,
        providerUserId: whoopUserId,
        lastSyncError: null,
      },
    });

    console.log(`WHOOP connected for athlete ${session.id}`);
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?connected=WHOOP`);
  } catch (error) {
    console.error("GET /api/auth/whoop/callback error:", error);
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=whoop_callback_failed`);
  }
}
