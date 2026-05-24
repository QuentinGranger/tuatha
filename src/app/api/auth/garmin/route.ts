import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { getRequestToken } from "@/lib/garmin";
import { encrypt } from "@/lib/encryption";

/**
 * GET /api/auth/garmin
 * Initiates Garmin OAuth 1.0a flow.
 * 1. Gets a request token from Garmin
 * 2. Stores the token secret in DB (needed for step 2)
 * 3. Redirects user to Garmin authorization page
 */
export async function GET() {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = `${baseUrl}/api/auth/garmin/callback`;

    // Step 1: Get request token
    const { oauthToken, oauthTokenSecret, authorizeUrl } = await getRequestToken(callbackUrl);

    // Store request token secret + athlete ID in a pending connection
    await prisma.healthAppConnection.upsert({
      where: {
        athleteUserId_provider: { athleteUserId: session.id, provider: "GARMIN" },
      },
      create: {
        athleteUserId: session.id,
        provider: "GARMIN",
        status: "pending",
        accessToken: encrypt(oauthToken), // Temporary: store request token (encrypted)
        accessTokenSecret: encrypt(oauthTokenSecret), // Store request token secret (encrypted)
        scopes: ["dailies", "activities", "sleeps"],
        metadata: { step: "request_token" },
      },
      update: {
        status: "pending",
        accessToken: encrypt(oauthToken),
        accessTokenSecret: encrypt(oauthTokenSecret),
        lastSyncError: null,
        metadata: { step: "request_token" },
      },
    });

    // Step 2: Redirect to Garmin authorization
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error("GET /api/auth/garmin error:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=garmin_auth_failed`);
  }
}
