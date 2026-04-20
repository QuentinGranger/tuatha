import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";

// POST /api/push/unsubscribe — remove a push subscription
export async function POST(request: NextRequest) {
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint requis" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, proId: session.id },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
