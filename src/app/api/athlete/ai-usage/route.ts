// ─── Utilisation de l'IA — Information & Contrôle Athlète ───
//
// GET  /api/athlete/ai-usage — Écran "Utilisation de l'IA" : informations, statut, historique
// POST /api/athlete/ai-usage — Supprimer les résumés IA générés pour cet athlète
//
// L'athlète peut :
//   1. Voir quels usages IA existent et lesquels le concernent
//   2. Opt-out via PUT /api/athlete/consents { type: "ai", granted: false }
//   3. Supprimer les résumés IA générés à partir de ses données

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// ─── Catalogue des usages IA ───
const AI_USAGES = [
  {
    id: "redaction_summary",
    name: "Résumés automatiques de champs médicaux",
    description:
      "Lorsqu'un professionnel n'a pas accès à certaines données médicales, un résumé anonymisé peut être généré par IA pour indiquer la nature de l'information sans révéler le contenu exact.",
    dataMinimization:
      "Seul un extrait de 2000 caractères maximum est envoyé. Aucun nom, date, numéro ou identifiant n'est transmis. Le prompt interdit la reproduction du contenu original.",
    concernsAthlete: true,
    canOptOut: true,
    legalBasis: "Consentement explicite (RGPD Art. 6(1)(a) + Art. 9(2)(a))",
  },
  {
    id: "document_verification",
    name: "Vérification automatique de documents professionnels",
    description:
      "Les documents d'identité professionnelle (diplômes, cartes pro) soumis par les professionnels sont analysés par IA pour vérifier leur authenticité.",
    dataMinimization:
      "Seul le document du professionnel est envoyé. Aucune donnée athlète n'est impliquée.",
    concernsAthlete: false,
    canOptOut: false,
    legalBasis: "Intérêt légitime (RGPD Art. 6(1)(f)) — sécurité de la plateforme",
  },
  {
    id: "facturation_insights",
    name: "Analyse et insights de facturation",
    description:
      "L'assistant IA aide les professionnels à analyser leurs données de facturation (tendances, impayés, optimisations). Réservé au professionnel.",
    dataMinimization:
      "Seules des statistiques agrégées sont envoyées (montants, nombres, dates). Aucune donnée de santé n'est transmise.",
    concernsAthlete: false,
    canOptOut: false,
    legalBasis: "Exécution du contrat (RGPD Art. 6(1)(b))",
  },
];

const AI_PROVIDER = {
  name: "OpenAI",
  models: ["gpt-4o-mini (résumés)", "gpt-4o (vérification, facturation)"],
  location: "États-Unis — transfert encadré par les clauses contractuelles types (CCT) de la Commission européenne",
  dpa: "Data Processing Addendum OpenAI signé, conforme RGPD Art. 28",
  dataRetention:
    "OpenAI s'engage à ne pas utiliser les données API pour l'entraînement de modèles (opt-out API). Les données sont supprimées après 30 jours maximum.",
  securityMeasures: [
    "Chiffrement en transit (TLS 1.2+)",
    "Aucune donnée stockée côté OpenAI au-delà du traitement",
    "Kill switch disponible pour couper l'intégration en urgence",
  ],
};

const AI_GUARDRAILS = {
  noDiagnosis:
    "L'IA ne génère JAMAIS de diagnostic médical, de prescription, de pronostic ou de recommandation thérapeutique. Tout résumé est purement descriptif.",
  noIdentification:
    "Aucun nom, prénom, date de naissance, numéro de sécurité sociale ou identifiant patient n'est envoyé à l'IA.",
  humanReview:
    "Les résumés IA sont toujours marqués comme générés automatiquement. Ils ne remplacent pas le jugement clinique du professionnel.",
  minimization:
    "Seul le minimum de données nécessaire est envoyé. Un extrait de 2000 caractères maximum est utilisé pour les résumés.",
};

// GET — Information screen "Utilisation de l'IA"
export async function GET() {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const user = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { consentAI: true, consentAIAt: true },
    });

    // Get AI consent history
    const aiConsentHistory = await (prisma as any).athleteConsent.findMany({
      where: { athleteUserId: session.id, consentType: "ai" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        action: true,
        granted: true,
        createdAt: true,
        method: true,
      },
    });

    return NextResponse.json({
      consentAI: user?.consentAI ?? false,
      consentAIAt: user?.consentAIAt ?? null,

      usages: AI_USAGES,
      provider: AI_PROVIDER,
      guardrails: AI_GUARDRAILS,

      consentHistory: aiConsentHistory,

      disclaimer:
        "Les fonctionnalités IA de Tuatha sont conçues pour assister, jamais pour remplacer le jugement clinique. Aucun diagnostic, prescription ou recommandation thérapeutique n'est généré par l'IA. Vous pouvez désactiver l'usage de l'IA à tout moment via vos paramètres de consentement.",
    });
  } catch (error) {
    console.error("GET /api/athlete/ai-usage error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — Delete AI-generated summaries for this athlete
// Body: { action: "delete_summaries" }
export async function POST(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await request.json();

    if (body.action !== "delete_summaries") {
      return NextResponse.json({ error: "Action invalide." }, { status: 400 });
    }

    // Log the deletion request
    await (prisma as any).athleteAccessLog.create({
      data: {
        athleteUserId: session.id,
        action: "delete_ai_summaries",
        resource: "ai_generated_content",
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    // Note: AI summaries in the redaction engine are generated on-the-fly and
    // not stored permanently. This endpoint serves as an audit trail and will
    // clear any cached summaries if caching is added in the future.

    return NextResponse.json({
      ok: true,
      message:
        "Demande de suppression enregistrée. Les résumés IA sont générés à la volée et ne sont pas stockés de manière permanente. Aucun résumé ne sera généré tant que votre consentement IA est désactivé.",
    });
  } catch (error) {
    console.error("POST /api/athlete/ai-usage error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
