import { NextRequest, NextResponse } from "next/server";
import { getOutlookAuthUrl } from "@/lib/outlook-auth";
import { incident } from "@/lib/incidentResponse";

export async function GET(request: NextRequest) {
  const professionnelId = request.nextUrl.searchParams.get("professionnelId");

  if (!professionnelId) {
    return NextResponse.json(
      { error: "Identifiant professionnel manquant." },
      { status: 400 }
    );
  }

  if (incident.isIntegrationKilled("outlook")) {
    return NextResponse.json(
      { error: "L'authentification Outlook est temporairement désactivée." },
      { status: 503 },
    );
  }

  const authUrl = getOutlookAuthUrl(professionnelId);
  return NextResponse.redirect(authUrl);
}
