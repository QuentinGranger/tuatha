import { NextRequest, NextResponse } from "next/server";
import { exchangeCalendlyCode, getCalendlyUser } from "@/lib/calendly-auth";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/webhook";
import { incident } from "@/lib/incidentResponse";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/inscription/professionnel/configuration?error=calendly_auth_failed", request.url)
    );
  }

  if (incident.isIntegrationKilled("calendly")) {
    return NextResponse.redirect(
      new URL("/inscription/professionnel/configuration?error=calendly_disabled", request.url)
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
    const tokens = await exchangeCalendlyCode(code);
    const user = await getCalendlyUser(tokens.access_token);

    await prisma.calendrierSync.upsert({
      where: {
        professionnelId_type: {
          professionnelId,
          type: "calendly",
        },
      },
      update: {
        actif: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        email: user.email,
      },
      create: {
        type: "calendly",
        actif: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        email: user.email,
        professionnelId,
      },
    });

    const redirectUrl = new URL(
      `/inscription/professionnel/configuration?id=${professionnelId}&calendly=connected`,
      request.url
    );
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Calendly OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/inscription/professionnel/configuration?error=calendly_auth_failed`,
        request.url
      )
    );
  }
}
