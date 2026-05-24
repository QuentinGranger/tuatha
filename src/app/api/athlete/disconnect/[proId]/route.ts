import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

// DELETE /api/athlete/disconnect/:proId — athlete revokes connection with a pro
// Immediate effect: connection set to "rejected", privacy settings deleted,
// any ProConnection shared by this pro for this athlete is also revoked.
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ proId: string }> },
) {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { proId } = await context.params;

    // Find the active connection
    const connection = await prisma.connectionRequest.findFirst({
      where: {
        athleteUserId: session.id,
        professionnelId: proId,
        status: "accepted",
      },
    });

    if (!connection) {
      return NextResponse.json({ error: "Connexion introuvable." }, { status: 404 });
    }

    // 1. Revoke the ConnectionRequest
    await prisma.connectionRequest.update({
      where: { id: connection.id },
      data: { status: "rejected", respondedAt: new Date() },
    });

    // 2. Delete granular privacy settings (no longer needed)
    await (prisma as any).athletePrivacySettings.deleteMany({
      where: { athleteUserId: session.id, professionnelId: proId },
    });

    // 3. Find the Athlete record linked to this athlete user for this pro
    const athleteRecord = await prisma.athlete.findFirst({
      where: {
        athleteUserId: session.id,
        professionnelId: proId,
      },
      select: { id: true },
    });

    // 4. Revoke any ProConnections shared by this pro for this athlete
    if (athleteRecord) {
      await (prisma as any).proConnection.updateMany({
        where: {
          athleteId: athleteRecord.id,
          ownerProId: proId,
          status: "connecte",
        },
        data: { status: "refuse" },
      });
    }

    // 5. Log the revocation in AthleteConsent
    const ip = _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = _request.headers.get("user-agent") || null;
    await (prisma as any).athleteConsent.create({
      data: {
        athleteUserId: session.id,
        consentType: "pro_sharing",
        action: "revoked",
        granted: false,
        documentVersion: null,
        ip,
        userAgent,
        method: "digital",
      },
    });

    console.log(`[Disconnect] Athlete ${session.id} revoked connection with pro ${proId}`);

    return NextResponse.json({
      ok: true,
      message: "Connexion révoquée. Le professionnel n'a plus accès à vos données.",
    });
  } catch (error) {
    console.error("DELETE /api/athlete/disconnect/:proId error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
