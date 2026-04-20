import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { exchangeCodeForToken, registerUser } from "@/lib/polar";

/**
 * GET /api/auth/polar/callback?code=...
 * Polar OAuth 2.0 callback.
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
      console.error("Polar callback: missing code");
      return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=polar_missing_code`);
    }

    const callbackUrl = `${baseUrl}/api/auth/polar/callback`;
    const { accessToken, polarUserId } = await exchangeCodeForToken(code, callbackUrl);

    // Register user with Polar Accesslink
    await registerUser(accessToken, polarUserId);

    // Store connection
    await prisma.healthAppConnection.upsert({
      where: {
        athleteUserId_provider: { athleteUserId: session.id, provider: "POLAR" },
      },
      create: {
        athleteUserId: session.id,
        provider: "POLAR",
        status: "connected",
        accessToken,
        providerUserId: polarUserId.toString(),
        scopes: ["accesslink.read_all"],
      },
      update: {
        status: "connected",
        accessToken,
        providerUserId: polarUserId.toString(),
        lastSyncError: null,
      },
    });

    console.log(`Polar connected for athlete ${session.id}`);
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?connected=POLAR`);
  } catch (error) {
    console.error("GET /api/auth/polar/callback error:", error);
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=polar_callback_failed`);
  }
}
