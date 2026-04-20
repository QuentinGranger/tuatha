import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/auth";

// GET — List passkeys for current user
export async function GET() {
  try {
    const session = await getSessionPro();
    if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const passkeys = await prisma.passkey.findMany({
      where: { professionnelId: session.id },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ passkeys });
  } catch (error) {
    console.error("passkey GET:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

// DELETE — Remove a passkey
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionPro();
    if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { passkeyId } = await request.json();
    if (!passkeyId) return NextResponse.json({ error: "passkeyId requis." }, { status: 400 });

    // Verify ownership
    const passkey = await prisma.passkey.findFirst({
      where: { id: passkeyId, professionnelId: session.id },
    });

    if (!passkey) return NextResponse.json({ error: "Passkey introuvable." }, { status: 404 });

    await prisma.passkey.delete({ where: { id: passkeyId } });

    return NextResponse.json({ message: "Passkey supprimée." });
  } catch (error) {
    console.error("passkey DELETE:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
