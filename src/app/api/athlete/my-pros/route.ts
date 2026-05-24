// ─── Gestion avancée des professionnels (P1.13) ───
//
// GET /api/athlete/my-pros
//
// Retourne la liste complète des pros connectés avec :
//   - Statut "pro vérifié" + date de vérification
//   - Spécialité visible + profession affichée
//   - Numéro RPPS/ADELI/carte pro
//   - Historique du lien (date début, fin, statut)
//   - Expiration automatique si configurée
//   - Permissions détaillées par pro
//   - Résumé clair "Ce pro peut voir…"
//   - Différence claire par spécialité

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

export const dynamic = "force-dynamic";

// ─── Human-readable permission labels ───

const PERMISSION_LABELS: Record<string, string> = {
  shareSport: "Sport pratiqué",
  sharePhysical: "Données physiques (taille, poids)",
  shareAntecedents: "Antécédents médicaux",
  shareTraitements: "Traitements en cours",
  shareContraindic: "Contre-indications",
  shareVitals: "Données de santé connectées (Garmin, Polar…)",
  shareConsultPrep: "Préparations de consultation",
  sharePhoto: "Photo de profil",
  shareMessaging: "Messagerie",
};

const DEFAULT_SETTINGS: Record<string, boolean> = {
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

// ─── Speciality categorization ───

const SPECIALITY_CATEGORIES: Record<string, string> = {
  kinesitherapeute: "Kinésithérapeute",
  osteopathe: "Ostéopathe",
  medecin_sport: "Médecin du sport",
  medecin_generaliste: "Médecin généraliste",
  nutritionniste: "Nutritionniste / Diététicien",
  dieteticien: "Nutritionniste / Diététicien",
  psychologue: "Psychologue du sport",
  preparateur_physique: "Préparateur physique",
  coach_sportif: "Coach sportif",
  podologue: "Podologue",
  sophrologue: "Sophrologue",
  chiropracteur: "Chiropracteur",
  autre: "Autre professionnel de santé",
};

function categorizeSpeciality(specialite: string): string {
  const key = specialite.toLowerCase().replace(/[^a-z_]/g, "_");
  return SPECIALITY_CATEGORIES[key] || specialite;
}

function buildPermissionSummary(settings: Record<string, boolean>): string[] {
  const allowed: string[] = [];
  for (const [key, label] of Object.entries(PERMISSION_LABELS)) {
    if (settings[key]) {
      allowed.push(label);
    }
  }
  return allowed;
}

export async function GET() {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    // All connection requests (full history)
    const connections = await prisma.connectionRequest.findMany({
      where: { athleteUserId: session.id },
      include: {
        professionnel: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
            professionAffichee: true,
            specialiteAffichee: true,
            avatarPath: true,
            verificationStatus: true,
            verifiedAt: true,
            numeroVerification: true,
            adresseCabinet: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Privacy settings per pro
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

    // Check for expired connections
    const now = new Date();

    const result = connections.map((conn) => {
      const pro = conn.professionnel;
      const settings = privacyMap.get(pro.id) || { ...DEFAULT_SETTINGS };
      const isActive = conn.status === "accepted";

      // Expiration check (if expiresAt is set on privacy settings)
      const pSettings = privacySettings.find((s: any) => s.professionnelId === pro.id);
      const expiresAt = pSettings?.expiresAt || null;
      const isExpired = expiresAt ? new Date(expiresAt) < now : false;

      return {
        connectionId: conn.id,
        status: isExpired && isActive ? "expired" : conn.status,
        requestedBy: conn.requestedBy,

        // ── Dates du lien ──
        dateDebutAcces: conn.respondedAt || (conn.status === "accepted" ? conn.createdAt : null),
        dateFinAcces: conn.status === "rejected" ? conn.respondedAt : (isExpired ? expiresAt : null),
        createdAt: conn.createdAt,
        expiresAt,
        isExpired,

        // ── Pro identity ──
        professionnel: {
          id: pro.id,
          nom: pro.nom,
          prenom: pro.prenom,
          specialite: pro.specialite,
          specialiteAffichee: pro.specialiteAffichee || categorizeSpeciality(pro.specialite),
          professionAffichee: pro.professionAffichee,
          categorie: categorizeSpeciality(pro.specialite),
          avatarUrl: signAvatarUrl(pro.avatarPath),
          adresseCabinet: pro.adresseCabinet,

          // ── Vérification ──
          isVerified: pro.verificationStatus === "verified",
          verificationStatus: pro.verificationStatus,
          verifiedAt: pro.verifiedAt,
          numeroVerification: pro.verificationStatus === "verified" ? pro.numeroVerification : null,
        },

        // ── Permissions actuelles ──
        permissions: isActive && !isExpired ? settings : null,

        // ── Résumé clair "Ce pro peut voir…" ──
        resumePermissions: isActive && !isExpired
          ? buildPermissionSummary(settings)
          : [],

        // ── Éditable ──
        canEditPermissions: isActive && !isExpired,
        canDisconnect: isActive,
      };
    });

    return NextResponse.json({
      professionals: result,
      meta: {
        total: result.length,
        active: result.filter((r) => r.status === "accepted").length,
        pending: result.filter((r) => r.status === "pending").length,
        revoked: result.filter((r) => r.status === "rejected").length,
        expired: result.filter((r) => r.isExpired).length,
      },
    });
  } catch (error) {
    console.error("GET /api/athlete/my-pros error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
