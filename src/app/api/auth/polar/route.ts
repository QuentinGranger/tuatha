import { NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { getAuthorizationUrl } from "@/lib/polar";

/**
 * GET /api/auth/polar
 * Initiates Polar OAuth 2.0 flow.
 */
export async function GET() {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = `${baseUrl}/api/auth/polar/callback`;
    const authorizeUrl = getAuthorizationUrl(callbackUrl);

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error("GET /api/auth/polar error:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=polar_auth_failed`);
  }
}
