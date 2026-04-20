import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-auth";
import { incident } from "@/lib/incidentResponse";

export async function GET(request: NextRequest) {
  const professionnelId = request.nextUrl.searchParams.get("professionnelId");

  if (!professionnelId) {
    return NextResponse.json(
      { error: "Identifiant professionnel manquant." },
      { status: 400 }
    );
  }

  if (incident.isIntegrationKilled("google")) {
    return NextResponse.json(
      { error: "L'authentification Google est temporairement désactivée." },
      { status: 503 },
    );
  }

  const authUrl = getAuthUrl(professionnelId);
  return NextResponse.redirect(authUrl);
}
