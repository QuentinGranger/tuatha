import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";

// POST /api/connection-request/[id]/block — block the athlete who sent this request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionPro();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

    // Find the connection request
    const connectionRequest = await (prisma as any).connectionRequest.findUnique({
      where: { id },
      select: { professionnelId: true, athleteUserId: true },
    });

    if (!connectionRequest) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    if (connectionRequest.professionnelId !== session.id) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    }

    // Reject the connection request
    await (prisma as any).connectionRequest.update({
      where: { id },
      data: { status: "rejected", respondedAt: new Date() },
    });

    // Create the block (upsert to be idempotent)
    await (prisma as any).blockedAthlete.upsert({
      where: {
        professionnelId_athleteUserId: {
          professionnelId: session.id,
          athleteUserId: connectionRequest.athleteUserId,
        },
      },
      create: {
        professionnelId: session.id,
        athleteUserId: connectionRequest.athleteUserId,
        reason,
      },
      update: {
        reason,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[block-athlete] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
