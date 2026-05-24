import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

// GET /api/athlete/privacy/:proId — get privacy settings for a specific pro
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ proId: string }> },
) {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { proId } = await context.params;

    // Verify connection exists
    const conn = await (prisma as any).connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
      include: {
        professionnel: {
          select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true },
        },
      },
    });
    if (!conn) {
      return NextResponse.json({ error: "Connexion introuvable" }, { status: 404 });
    }

    const existing = await (prisma as any).athletePrivacySettings.findUnique({
      where: { athleteUserId_professionnelId: { athleteUserId: session.id, professionnelId: proId } },
    });

    const defaults = {
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

    const pro = conn.professionnel;
    return NextResponse.json({
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
        : defaults,
    });
  } catch (error) {
    console.error("GET /api/athlete/privacy/:proId error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/athlete/privacy/:proId — update privacy settings for a specific pro
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ proId: string }> },
) {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { proId } = await context.params;

    // Verify connection exists
    const conn = await (prisma as any).connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!conn) {
      return NextResponse.json({ error: "Connexion introuvable" }, { status: 404 });
    }

    const body = await request.json();

    const ALLOWED_FIELDS = [
      "shareSport", "sharePhysical", "shareAntecedents",
      "shareTraitements", "shareContraindic", "shareVitals",
      "shareConsultPrep", "sharePhoto", "shareMessaging",
    ];

    const data: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (typeof body[field] === "boolean") {
        data[field] = body[field];
      }
    }

    // Optional access expiration
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 });
    }

    const settings = await (prisma as any).athletePrivacySettings.upsert({
      where: {
        athleteUserId_professionnelId: {
          athleteUserId: session.id,
          professionnelId: proId,
        },
      },
      create: {
        athleteUserId: session.id,
        professionnelId: proId,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error("PUT /api/athlete/privacy/:proId error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
