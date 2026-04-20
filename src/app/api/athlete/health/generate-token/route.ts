import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

const VALID_PROVIDERS = ["GARMIN", "POLAR", "WHOOP", "OURA"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

/**
 * POST /api/athlete/health/generate-token
 * Returns the OAuth initiation URL for the requested provider.
 * Body: { provider: "GARMIN" | "POLAR" | "WHOOP" | "OURA" }
 *
 * - GARMIN → /api/auth/garmin (OAuth 1.0a, handled server-side)
 * - POLAR → /api/auth/polar (OAuth 2.0, TODO)
 * - WHOOP → /api/auth/whoop (OAuth 2.0, TODO)
 * - OURA → /api/auth/oura (OAuth 2.0, TODO)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { provider } = await request.json();
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "Provider invalide." }, { status: 400 });
    }

    // Check if already connected
    const existing = await prisma.healthAppConnection.findUnique({
      where: { athleteUserId_provider: { athleteUserId: session.id, provider } },
    });

    if (existing && existing.status === "connected") {
      return NextResponse.json({ error: "Ce provider est déjà connecté." }, { status: 409 });
    }

    // Build OAuth initiation URL per provider
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const OAUTH_URLS: Record<Provider, string> = {
      GARMIN: `${baseUrl}/api/auth/garmin`,
      POLAR: `${baseUrl}/api/auth/polar`,
      WHOOP: `${baseUrl}/api/auth/whoop`,
      OURA: `${baseUrl}/api/auth/oura`,
    };

    const url = OAUTH_URLS[provider as Provider];

    return NextResponse.json({ url });
  } catch (error) {
    console.error("POST /api/athlete/health/generate-token error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
