import { NextRequest, NextResponse } from "next/server";
import { generatePasskeyAuthentication, verifyPasskeyAuthentication } from "@/lib/webauthn";
import { createSession, setAuthCookies } from "@/lib/session";
import { checkRateLimit, retryAfterSeconds, RATE_LIMITS } from "@/lib/rateLimit";
import { getDashboardPath } from "@/lib/specialites";

// GET — Generate authentication options (public, no auth required)
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email") || undefined;
    const { options, challengeKey } = await generatePasskeyAuthentication(email);
    return NextResponse.json({ options, challengeKey });
  } catch (error) {
    console.error("passkey auth GET:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

// POST — Verify authentication response and create session
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || null;

    // Rate limit
    const limit = checkRateLimit(`passkey-auth:${ip}`, RATE_LIMITS.login);
    if (!limit.allowed) {
      const res = NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429 }
      );
      res.headers.set("Retry-After", retryAfterSeconds(limit.retryAfterMs));
      return res;
    }

    const { response, challengeKey } = await request.json();
    if (!response || !challengeKey) {
      return NextResponse.json({ error: "Réponse WebAuthn et challengeKey requises." }, { status: 400 });
    }

    const result = await verifyPasskeyAuthentication(response, challengeKey);
    const pro = result.professionnel;

    const redirectPath = getDashboardPath(pro.specialite);

    // Create DB-backed session (dual tokens)
    const { accessToken, refreshToken } = await createSession(pro.id, pro.specialite, ip === "unknown" ? null : ip, userAgent);

    const res = NextResponse.json({
      message: "Connexion par passkey réussie",
      redirect: redirectPath,
    });

    setAuthCookies(res, accessToken, refreshToken);

    return res;
  } catch (error) {
    console.error("passkey auth POST:", error);
    const msg = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
