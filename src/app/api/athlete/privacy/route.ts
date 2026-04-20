import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS = {
  shareSport: true,
  sharePhysical: true,
  shareAntecedents: false,
  shareTraitements: false,
  shareContraindic: false,
  shareVitals: false,
  shareConsultPrep: true,
  sharePhoto: true,
  shareMessaging: true,
};

// GET /api/athlete/privacy — list all privacy settings for connected pros
export async function GET() {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Get all accepted connections with pro info
    const connections = await (prisma as any).connectionRequest.findMany({
      where: { athleteUserId: session.id, status: "accepted" },
      select: {
        respondedAt: true,
        createdAt: true,
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

    // Get existing privacy settings for this athlete
    let settings: any[] = [];
    try {
      settings = await (prisma as any).athletePrivacySettings.findMany({
        where: { athleteUserId: session.id },
      });
    } catch (e) {
      console.warn("[privacy] athletePrivacySettings query failed, using defaults:", e);
    }

    const settingsMap = new Map<string, any>();
    for (const s of settings) {
      settingsMap.set(s.professionnelId, s);
    }

    const result = connections.map((conn: any) => {
      const pro = conn.professionnel;
      const existing = settingsMap.get(pro.id);
      return {
        professionnel: { ...pro, avatarPath: signAvatarUrl(pro.avatarPath) },
        connectedAt: conn.respondedAt || conn.createdAt,
        settings: existing
          ? {
              shareSport: existing.shareSport,
              sharePhysical: existing.sharePhysical,
              shareAntecedents: existing.shareAntecedents,
              shareTraitements: existing.shareTraitements,
              shareContraindic: existing.shareContraindic,
              shareVitals: existing.shareVitals,
              shareConsultPrep: existing.shareConsultPrep,
              sharePhoto: existing.sharePhoto,
              shareMessaging: existing.shareMessaging,
            }
          : { ...DEFAULT_SETTINGS },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/athlete/privacy error:", error);
    return NextResponse.json(
      { error: "Erreur serveur", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
