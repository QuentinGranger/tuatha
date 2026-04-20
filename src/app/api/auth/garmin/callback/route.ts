import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { getAccessToken } from "@/lib/garmin";

/**
 * GET /api/auth/garmin/callback?oauth_token=...&oauth_verifier=...
 * Garmin OAuth 1.0a callback.
 * Exchanges the request token + verifier for an access token.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.redirect(`${baseUrl}/connexion/athlete`);
    }

    const { searchParams } = new URL(request.url);
    const oauthToken = searchParams.get("oauth_token");
    const oauthVerifier = searchParams.get("oauth_verifier");

    if (!oauthToken || !oauthVerifier) {
      console.error("Garmin callback: missing oauth_token or oauth_verifier");
      return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=garmin_missing_params`);
    }

    // Find the pending connection with the request token secret
    const connection = await prisma.healthAppConnection.findUnique({
      where: {
        athleteUserId_provider: { athleteUserId: session.id, provider: "GARMIN" },
      },
    });

    if (!connection || connection.status !== "pending" || !connection.accessTokenSecret) {
      console.error("Garmin callback: no pending connection found");
      return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=garmin_no_pending`);
    }

    const requestTokenSecret = connection.accessTokenSecret;

    // Step 3: Exchange for access token
    const { accessToken, accessTokenSecret } = await getAccessToken(
      oauthToken,
      requestTokenSecret,
      oauthVerifier
    );

    // Store the real access tokens
    await prisma.healthAppConnection.update({
      where: { id: connection.id },
      data: {
        status: "connected",
        accessToken,
        accessTokenSecret,
        lastSyncError: null,
        metadata: { step: "connected", connectedAt: new Date().toISOString() },
      },
    });

    console.log(`Garmin connected for athlete ${session.id}`);

    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?connected=GARMIN`);
  } catch (error) {
    console.error("GET /api/auth/garmin/callback error:", error);
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=garmin_callback_failed`);
  }
}
