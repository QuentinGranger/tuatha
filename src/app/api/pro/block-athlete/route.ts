import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";

// POST /api/pro/block-athlete — block an athlete by ID
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionPro();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { athleteUserId, reason } = await request.json();
    if (!athleteUserId || typeof athleteUserId !== "string") {
      return NextResponse.json({ error: "athleteUserId requis." }, { status: 400 });
    }

    // Verify athlete exists
    const athlete = await (prisma as any).athleteUser.findUnique({
      where: { id: athleteUserId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlète introuvable." }, { status: 404 });
    }

    // Upsert block
    await (prisma as any).blockedAthlete.upsert({
      where: {
        professionnelId_athleteUserId: {
          professionnelId: session.id,
          athleteUserId,
        },
      },
      create: {
        professionnelId: session.id,
        athleteUserId,
        reason: typeof reason === "string" ? reason.slice(0, 500) : null,
      },
      update: {
        reason: typeof reason === "string" ? reason.slice(0, 500) : null,
      },
    });

    // Also reject any pending connection request from this athlete
    await (prisma as any).connectionRequest.updateMany({
      where: {
        athleteUserId,
        professionnelId: session.id,
        status: "pending",
      },
      data: { status: "rejected", respondedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[block-athlete] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

// DELETE /api/pro/block-athlete — unblock an athlete
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionPro();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { athleteUserId } = await request.json();
    if (!athleteUserId || typeof athleteUserId !== "string") {
      return NextResponse.json({ error: "athleteUserId requis." }, { status: 400 });
    }

    await (prisma as any).blockedAthlete.deleteMany({
      where: {
        professionnelId: session.id,
        athleteUserId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[unblock-athlete] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
