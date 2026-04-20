import { NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { getAuthorizationUrl } from "@/lib/oura";
import crypto from "crypto";

/**
 * GET /api/auth/oura
 * Initiates Oura OAuth 2.0 flow.
 */
export async function GET() {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = `${baseUrl}/api/auth/oura/callback`;
    const state = crypto.randomBytes(16).toString("hex");
    const authorizeUrl = getAuthorizationUrl(callbackUrl, state);

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error("GET /api/auth/oura error:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl}/dashboard/athlete/sante?error=oura_auth_failed`);
  }
}
