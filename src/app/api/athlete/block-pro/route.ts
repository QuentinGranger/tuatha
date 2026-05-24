// ─── Blocage d'un professionnel par l'athlète ───
//
// POST /api/athlete/block-pro   — Bloquer un pro
// DELETE /api/athlete/block-pro — Débloquer un pro
//
// Bloquer un pro :
//   1. Révoque la connexion existante (comme disconnect)
//   2. Crée un enregistrement AthleteBlockedPro
//   3. Empêche le pro de renvoyer une demande de connexion
//   4. Empêche le pro d'envoyer des messages
//
// Body: { professionnelId: string, reason?: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST — Block a pro
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await request.json();
    const { professionnelId, reason } = body;

    if (!professionnelId || typeof professionnelId !== "string") {
      return NextResponse.json({ error: "professionnelId requis." }, { status: 400 });
    }

    // Verify the pro exists
    const pro = await prisma.professionnel.findUnique({
      where: { id: professionnelId },
      select: { id: true, nom: true, prenom: true },
    });
    if (!pro) {
      return NextResponse.json({ error: "Professionnel introuvable." }, { status: 404 });
    }

    // Check if already blocked
    const existing = await (prisma as any).athleteBlockedPro.findUnique({
      where: {
        athleteUserId_professionnelId: {
          athleteUserId: session.id,
          professionnelId,
        },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Ce professionnel est déjà bloqué." }, { status: 409 });
    }

    // 1. Block the pro
    await (prisma as any).athleteBlockedPro.create({
      data: {
        athleteUserId: session.id,
        professionnelId,
        reason: reason?.slice(0, 500) || null,
      },
    });

    // 2. Revoke any active connection
    const activeConn = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId, status: "accepted" },
    });
    if (activeConn) {
      await prisma.connectionRequest.update({
        where: { id: activeConn.id },
        data: { status: "rejected", respondedAt: new Date() },
      });

      // Delete privacy settings
      await (prisma as any).athletePrivacySettings.deleteMany({
        where: { athleteUserId: session.id, professionnelId },
      });
    }

    // Also reject any pending requests
    await prisma.connectionRequest.updateMany({
      where: { athleteUserId: session.id, professionnelId, status: "pending" },
      data: { status: "rejected", respondedAt: new Date() },
    });

    // 3. Log consent revocation
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;
    await (prisma as any).athleteConsent.create({
      data: {
        athleteUserId: session.id,
        consentType: "pro_blocked",
        action: "blocked",
        granted: false,
        documentVersion: null,
        ip,
        userAgent,
        method: "digital",
      },
    });

    // 4. Audit log
    await (prisma as any).athleteAccessLog.create({
      data: {
        athleteUserId: session.id,
        action: "block_pro",
        resource: JSON.stringify({ professionnelId, reason: reason?.slice(0, 200) }),
        ip,
        userAgent,
      },
    });

    console.warn(
      `[SECURITY-AUDIT] ATHLETE_BLOCK_PRO userId=${session.id} proId=${professionnelId}`,
    );

    return NextResponse.json({
      ok: true,
      message: `${pro.prenom} ${pro.nom} a été bloqué. Il ne pourra plus vous contacter ni accéder à vos données.`,
    });
  } catch (error) {
    console.error("POST /api/athlete/block-pro error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — Unblock a pro
export async function DELETE(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await request.json();
    const { professionnelId } = body;

    if (!professionnelId || typeof professionnelId !== "string") {
      return NextResponse.json({ error: "professionnelId requis." }, { status: 400 });
    }

    const deleted = await (prisma as any).athleteBlockedPro.deleteMany({
      where: { athleteUserId: session.id, professionnelId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Ce professionnel n'est pas bloqué." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: "Professionnel débloqué. Vous pouvez à nouveau recevoir des demandes de connexion.",
    });
  } catch (error) {
    console.error("DELETE /api/athlete/block-pro error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
