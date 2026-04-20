import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

// POST /api/athlete/data-access-request/:requestId — accept or reject
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { requestId } = await context.params;
    const body = await request.json();
    const { accept } = body;
    if (typeof accept !== "boolean") {
      return NextResponse.json({ error: "accept (boolean) requis" }, { status: 400 });
    }

    // Find the request and verify ownership
    const req = await (prisma as any).dataAccessRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }
    if (req.athleteUserId !== session.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
    if (req.status !== "pending") {
      return NextResponse.json({ error: "Demande déjà traitée", status: req.status }, { status: 409 });
    }

    const newStatus = accept ? "accepted" : "rejected";

    if (accept) {
      // Update privacy settings to grant access + update request status in a transaction
      await (prisma as any).$transaction([
        (prisma as any).athletePrivacySettings.upsert({
          where: {
            athleteUserId_professionnelId: {
              athleteUserId: session.id,
              professionnelId: req.professionnelId,
            },
          },
          create: {
            athleteUserId: session.id,
            professionnelId: req.professionnelId,
            [req.dataKey]: true,
          },
          update: {
            [req.dataKey]: true,
          },
        }),
        (prisma as any).dataAccessRequest.update({
          where: { id: requestId },
          data: { status: newStatus, respondedAt: new Date() },
        }),
      ]);
    } else {
      // Just reject the request
      await (prisma as any).dataAccessRequest.update({
        where: { id: requestId },
        data: { status: newStatus, respondedAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (error) {
    console.error("POST /api/athlete/data-access-request/:requestId error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
