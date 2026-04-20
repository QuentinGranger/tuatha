import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";

// POST /api/push/subscribe — save a push subscription for the authenticated user
export async function POST(request: NextRequest) {
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { subscription } = await request.json();

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Subscription invalide" }, { status: 400 });
    }

    // Upsert: if same endpoint exists, update keys (they may rotate)
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        proId: session.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: request.headers.get("user-agent") || null,
      },
      update: {
        proId: session.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
