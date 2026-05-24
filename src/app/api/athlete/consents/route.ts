import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// ─── Consent types the athlete can manage ───
const CONSENT_TYPES = ["cgu", "privacy", "health_data", "pro_sharing", "ai", "marketing"] as const;
type AthleteConsentType = (typeof CONSENT_TYPES)[number];

// ─── Field mapping: consent type → AthleteUser fields ───
const CONSENT_FIELD_MAP: Record<AthleteConsentType, { versionField?: string; dateField: string; boolField?: string }> = {
  cgu:          { versionField: "acceptedCguVersion",           dateField: "acceptedCguAt" },
  privacy:      { versionField: "acceptedPrivacyVersion",       dateField: "acceptedPrivacyAt" },
  health_data:  { versionField: "acceptedHealthCharterVersion", dateField: "acceptedHealthCharterAt" },
  pro_sharing:  { dateField: "acceptedCguAt" },  // tracked via AthleteConsent log only
  ai:           { boolField: "consentAI",          dateField: "consentAIAt" },
  marketing:    { boolField: "consentMarketing",   dateField: "consentMarketingAt" },
};

// GET /api/athlete/consents — current consent status + history
export async function GET() {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const user = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: {
        acceptedCguVersion: true,
        acceptedCguAt: true,
        acceptedPrivacyVersion: true,
        acceptedPrivacyAt: true,
        acceptedHealthCharterVersion: true,
        acceptedHealthCharterAt: true,
        consentMarketing: true,
        consentMarketingAt: true,
        consentAI: true,
        consentAIAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Build status for each consent type
    const status = {
      cgu: {
        granted: !!user.acceptedCguVersion,
        version: user.acceptedCguVersion,
        grantedAt: user.acceptedCguAt,
      },
      privacy: {
        granted: !!user.acceptedPrivacyVersion,
        version: user.acceptedPrivacyVersion,
        grantedAt: user.acceptedPrivacyAt,
      },
      health_data: {
        granted: !!user.acceptedHealthCharterVersion,
        version: user.acceptedHealthCharterVersion,
        grantedAt: user.acceptedHealthCharterAt,
      },
      ai: {
        granted: user.consentAI,
        grantedAt: user.consentAIAt,
      },
      marketing: {
        granted: user.consentMarketing,
        grantedAt: user.consentMarketingAt,
      },
    };

    // Fetch pro_sharing from latest consent log
    const latestSharing = await (prisma as any).athleteConsent.findFirst({
      where: { athleteUserId: session.id, consentType: "pro_sharing" },
      orderBy: { createdAt: "desc" },
      select: { granted: true, createdAt: true },
    });

    (status as any).pro_sharing = {
      granted: latestSharing?.granted ?? false,
      grantedAt: latestSharing?.createdAt ?? null,
    };

    // Full audit trail
    const history = await (prisma as any).athleteConsent.findMany({
      where: { athleteUserId: session.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        consentType: true,
        action: true,
        granted: true,
        documentVersion: true,
        method: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ status, history });
  } catch (error) {
    console.error("GET /api/athlete/consents error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/athlete/consents — grant or revoke a consent
// Body: { type: AthleteConsentType, granted: boolean, documentVersion?: string }
export async function PUT(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, granted, documentVersion } = body;

    if (!type || !CONSENT_TYPES.includes(type)) {
      return NextResponse.json({
        error: `Type invalide. Types valides: ${CONSENT_TYPES.join(", ")}`,
      }, { status: 400 });
    }

    if (typeof granted !== "boolean") {
      return NextResponse.json({ error: "Le champ 'granted' (boolean) est requis." }, { status: 400 });
    }

    // CGU and privacy cannot be revoked — they're mandatory for using the platform
    if (!granted && (type === "cgu" || type === "privacy" || type === "health_data")) {
      return NextResponse.json({
        error: "Ce consentement est obligatoire pour utiliser la plateforme. Vous pouvez supprimer votre compte si vous souhaitez retirer ce consentement.",
      }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;

    // Write immutable consent log
    await (prisma as any).athleteConsent.create({
      data: {
        athleteUserId: session.id,
        consentType: type,
        action: granted ? "granted" : "revoked",
        granted,
        documentVersion: documentVersion || null,
        ip,
        userAgent,
        method: "digital",
      },
    });

    // Update AthleteUser fields
    const fieldMap = CONSENT_FIELD_MAP[type as AthleteConsentType];
    const updateData: Record<string, unknown> = {};

    if (fieldMap.boolField) {
      updateData[fieldMap.boolField] = granted;
      updateData[fieldMap.dateField] = granted ? new Date() : null;
    } else if (fieldMap.versionField && granted) {
      updateData[fieldMap.versionField] = documentVersion || `${type.toUpperCase()}-${new Date().toISOString().slice(0, 7)}`;
      updateData[fieldMap.dateField] = new Date();
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.athleteUser.update({
        where: { id: session.id },
        data: updateData,
      });
    }

    return NextResponse.json({
      message: granted
        ? `Consentement "${type}" enregistré.`
        : `Consentement "${type}" retiré.`,
      type,
      granted,
    });
  } catch (error) {
    console.error("PUT /api/athlete/consents error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
