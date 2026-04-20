import { NextRequest, NextResponse } from "next/server";
import { getCalendlyAuthUrl } from "@/lib/calendly-auth";
import { incident } from "@/lib/incidentResponse";

export async function GET(request: NextRequest) {
  const professionnelId = request.nextUrl.searchParams.get("professionnelId");

  if (!professionnelId) {
    return NextResponse.json(
      { error: "Identifiant professionnel manquant." },
      { status: 400 }
    );
  }

  if (incident.isIntegrationKilled("calendly")) {
    return NextResponse.json(
      { error: "L'intégration Calendly est temporairement désactivée." },
      { status: 503 },
    );
  }

  const authUrl = getCalendlyAuthUrl(professionnelId);
  return NextResponse.redirect(authUrl);
}
