import { NextRequest, NextResponse } from "next/server";
import { getSessionPro } from "@/lib/auth";
import { generatePasskeyRegistration, verifyPasskeyRegistration } from "@/lib/webauthn";

// GET — Generate registration options (user must be logged in)
export async function GET() {
  try {
    const session = await getSessionPro();
    if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { prisma } = await import("@/lib/prisma");
    const pro = await prisma.professionnel.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!pro) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

    const options = await generatePasskeyRegistration(session.id, pro.email);
    return NextResponse.json(options);
  } catch (error) {
    console.error("passkey register GET:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

// POST — Verify registration response
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionPro();
    if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { response, name } = await request.json();
    if (!response) return NextResponse.json({ error: "Réponse WebAuthn requise." }, { status: 400 });

    const result = await verifyPasskeyRegistration(session.id, response, name);
    return NextResponse.json({ message: "Passkey enregistrée avec succès.", ...result });
  } catch (error) {
    console.error("passkey register POST:", error);
    const msg = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
