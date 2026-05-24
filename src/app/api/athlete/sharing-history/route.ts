import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

export const dynamic = "force-dynamic";

// GET /api/athlete/sharing-history — full sharing audit trail for the athlete
// Returns: all connections (active + revoked), privacy settings per pro, pro access logs
export async function GET() {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // 1. All connection requests (full history)
    const connections = await prisma.connectionRequest.findMany({
      where: { athleteUserId: session.id },
      include: {
        professionnel: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
            avatarPath: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Privacy settings per pro
    const privacySettings = await (prisma as any).athletePrivacySettings.findMany({
      where: { athleteUserId: session.id },
    });
    const privacyMap = new Map<string, Record<string, boolean>>();
    for (const s of privacySettings) {
      privacyMap.set(s.professionnelId, {
        shareSport: s.shareSport,
        sharePhysical: s.sharePhysical,
        shareAntecedents: s.shareAntecedents,
        shareTraitements: s.shareTraitements,
        shareContraindic: s.shareContraindic,
        shareVitals: s.shareVitals,
        shareConsultPrep: s.shareConsultPrep,
        sharePhoto: s.sharePhoto,
        shareMessaging: s.shareMessaging,
      });
    }

    // 3. Recent pro access logs (last 100)
    const accessLogs = await (prisma as any).proAccessLog.findMany({
      where: { athleteUserId: session.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        professionnelId: true,
        action: true,
        resource: true,
        blocked: true,
        createdAt: true,
      },
    });

    // 4. Consent history related to sharing
    const consentHistory = await (prisma as any).athleteConsent.findMany({
      where: {
        athleteUserId: session.id,
        consentType: "pro_sharing",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        granted: true,
        createdAt: true,
      },
    });

    // Build result
    const result = connections.map((conn: any) => {
      const pro = conn.professionnel;
      return {
        connectionId: conn.id,
        status: conn.status,
        requestedBy: conn.requestedBy,
        createdAt: conn.createdAt,
        respondedAt: conn.respondedAt,
        professionnel: {
          id: pro.id,
          nom: pro.nom,
          prenom: pro.prenom,
          specialite: pro.specialite,
          avatarPath: signAvatarUrl(pro.avatarPath),
        },
        privacySettings: privacyMap.get(pro.id) || null,
      };
    });

    return NextResponse.json({
      connections: result,
      accessLogs,
      consentHistory,
    });
  } catch (error) {
    console.error("GET /api/athlete/sharing-history error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
