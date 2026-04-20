import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";

// POST /api/pro/connect-athlete — pro initiates a connection request to an athlete
export async function POST(request: NextRequest) {
  const session = await getSessionPro();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: { athleteUserId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { athleteUserId } = body;
  if (!athleteUserId || typeof athleteUserId !== "string") {
    return NextResponse.json({ error: "athleteUserId requis." }, { status: 400 });
  }

  try {
    // Verify athlete exists
    const athlete = await (prisma as any).athleteUser.findUnique({
      where: { id: athleteUserId },
      select: { id: true, emailVerified: true },
    });
    if (!athlete || !athlete.emailVerified) {
      return NextResponse.json({ error: "Athlète introuvable." }, { status: 404 });
    }

    // Check if already blocked
    const blocked = await (prisma as any).blockedAthlete.findUnique({
      where: {
        professionnelId_athleteUserId: {
          professionnelId: session.id,
          athleteUserId,
        },
      },
    });
    if (blocked) {
      return NextResponse.json({ error: "Athlète bloqué." }, { status: 400 });
    }

    // Check existing request
    const existing = await (prisma as any).connectionRequest.findUnique({
      where: {
        athleteUserId_professionnelId: {
          athleteUserId,
          professionnelId: session.id,
        },
      },
    });

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json({ error: "Déjà connecté.", status: "accepted" }, { status: 409 });
      }
      if (existing.status === "pending") {
        return NextResponse.json({ error: "Demande déjà en attente.", status: "pending" }, { status: 409 });
      }
      // Rejected → re-send as pro-initiated
      await (prisma as any).connectionRequest.update({
        where: { id: existing.id },
        data: { status: "pending", requestedBy: "pro", respondedAt: null, createdAt: new Date() },
      });
      return NextResponse.json({ success: true, status: "pending", resent: true });
    }

    // Create new pro-initiated request
    await (prisma as any).connectionRequest.create({
      data: {
        athleteUserId,
        professionnelId: session.id,
        requestedBy: "pro",
      },
    });

    return NextResponse.json({ success: true, status: "pending" });
  } catch (error) {
    console.error("[pro/connect-athlete] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
