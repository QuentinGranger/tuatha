import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/google-auth";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/webhook";
import { incident } from "@/lib/incidentResponse";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/inscription/professionnel/configuration?error=google_auth_failed", request.url)
    );
  }

  if (incident.isIntegrationKilled("google")) {
    return NextResponse.redirect(
      new URL("/inscription/professionnel/configuration?error=google_disabled", request.url)
    );
  }

  // Verify signed state token (CSRF + anti-forge)
  const professionnelId = verifyOAuthState(state);
  if (!professionnelId) {
    return NextResponse.redirect(
      new URL("/inscription/professionnel/configuration?error=invalid_state", request.url)
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Upsert calendar sync record
    await prisma.calendrierSync.upsert({
      where: {
        professionnelId_type: {
          professionnelId,
          type: "google",
        },
      },
      update: {
        actif: true,
        accessToken: tokens.access_token || null,
        refreshToken: tokens.refresh_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: userInfo.email || null,
      },
      create: {
        type: "google",
        actif: true,
        accessToken: tokens.access_token || null,
        refreshToken: tokens.refresh_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: userInfo.email || null,
        professionnelId,
      },
    });

    // Redirect back to configuration page with success
    const redirectUrl = new URL(
      `/inscription/professionnel/configuration?id=${professionnelId}&google=connected`,
      request.url
    );
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/inscription/professionnel/configuration?error=google_auth_failed`,
        request.url
      )
    );
  }
}
