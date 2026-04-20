// ─── Politique d'annulation MVP ───
//
// Source unique de vérité pour la politique d'annulation.
// Identique dans : CGV (article 9), UX athlète, back-office pro, IA.
//
// Règles MVP :
//   1. Annulation > 24 h avant le RDV → remboursement total
//   2. Annulation < 24 h avant le RDV → remboursement selon politique du pro
//   3. No-show (absence non signalée) → pas de remboursement automatique
//   4. Incident technique majeur imputable à Tuatha → remboursement manuel total ou replanification
//
// Le remboursement est toujours effectué via le moyen de paiement initial (Stripe refund).
// Tuatha ne gère pas de système d'avoir ou de crédit interne au MVP.

// ─── Types ───

export type CancellationOutcome =
  | "full_refund"
  | "pro_policy"
  | "no_refund"
  | "manual_review";

export interface CancellationRule {
  id: string;
  outcome: CancellationOutcome;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  color: string;
}

export interface CancellationEligibility {
  outcome: CancellationOutcome;
  rule: CancellationRule;
  hoursUntilEvent: number;
  canCancelOnline: boolean;
  refundAutomatic: boolean;
}

// ─── Règles ───

export const CANCELLATION_RULES: Record<string, CancellationRule> = {
  more_than_24h: {
    id: "more_than_24h",
    outcome: "full_refund",
    label: "Annulation gratuite — remboursement intégral",
    shortLabel: "Annulation gratuite",
    description:
      "En cas d'annulation plus de 24 heures avant le rendez-vous, " +
      "vous êtes remboursé intégralement sur votre moyen de paiement initial.",
    icon: "✅",
    color: "#10b981",
  },
  less_than_24h: {
    id: "less_than_24h",
    outcome: "pro_policy",
    label: "Annulation tardive — remboursement selon politique du professionnel",
    shortLabel: "Selon politique du pro",
    description:
      "En cas d'annulation moins de 24 heures avant le rendez-vous, " +
      "le remboursement dépend de la politique du professionnel. " +
      "Des frais d'annulation peuvent s'appliquer.",
    icon: "⚠️",
    color: "#f59e0b",
  },
  no_show: {
    id: "no_show",
    outcome: "no_refund",
    label: "Absence non signalée — pas de remboursement automatique",
    shortLabel: "Pas de remboursement",
    description:
      "En cas d'absence non signalée (no-show), aucun remboursement automatique " +
      "n'est effectué. Le professionnel peut facturer l'intégralité de la consultation.",
    icon: "❌",
    color: "#ef4444",
  },
  platform_incident: {
    id: "platform_incident",
    outcome: "manual_review",
    label: "Incident technique — remboursement ou replanification",
    shortLabel: "Traitement manuel",
    description:
      "En cas d'incident technique majeur imputable à la plateforme Tuatha " +
      "(panne serveur, visioconférence inaccessible, etc.), un remboursement intégral " +
      "ou une replanification gratuite est proposé après examen par l'équipe support.",
    icon: "🔧",
    color: "#8b5cf6",
  },
};

// ─── Constante : seuil d'annulation gratuite (en heures) ───

export const FREE_CANCELLATION_HOURS = 24;

// ─── Helper : éligibilité au remboursement ───

/**
 * Détermine l'éligibilité au remboursement en fonction de la date du RDV.
 * Ne gère pas le cas "platform_incident" (traitement manuel support).
 */
export function getCancellationEligibility(eventDate: Date | string): CancellationEligibility {
  const event = typeof eventDate === "string" ? new Date(eventDate) : eventDate;
  const now = new Date();
  const hoursUntilEvent = (event.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Event already passed → no-show scenario
  if (hoursUntilEvent <= 0) {
    return {
      outcome: "no_refund",
      rule: CANCELLATION_RULES.no_show,
      hoursUntilEvent: 0,
      canCancelOnline: false,
      refundAutomatic: false,
    };
  }

  // > 24h → full refund
  if (hoursUntilEvent > FREE_CANCELLATION_HOURS) {
    return {
      outcome: "full_refund",
      rule: CANCELLATION_RULES.more_than_24h,
      hoursUntilEvent,
      canCancelOnline: true,
      refundAutomatic: true,
    };
  }

  // < 24h → pro's policy
  return {
    outcome: "pro_policy",
    rule: CANCELLATION_RULES.less_than_24h,
    hoursUntilEvent,
    canCancelOnline: true,
    refundAutomatic: false,
  };
}

// ─── Textes pour affichage UI ───

export const CANCELLATION_POLICY_SUMMARY = {
  title: "Politique d'annulation",
  lines: [
    { icon: "✅", text: "Annulation gratuite jusqu'à 24h avant le rendez-vous", bold: true },
    { icon: "⚠️", text: "Annulation < 24h : remboursement selon politique du professionnel", bold: false },
    { icon: "❌", text: "Absence non signalée : pas de remboursement automatique", bold: false },
    { icon: "🔧", text: "Incident technique Tuatha : remboursement ou replanification", bold: false },
  ],
} as const;

// ─── Texte CGV (article 9) ───
//
// Ce texte est la source unique pour l'article 9 des CGV.
// Il doit être strictement identique à ce qui est affiché dans l'UX.

export const CANCELLATION_CGV_TEXT = `**9.1. Politique standard d'annulation**

Sauf conditions plus favorables clairement affichées avant la Commande pour une Prestation déterminée, la politique standard suivante s'applique :

• Annulation **plus de 24 heures** avant le rendez-vous : **remboursement intégral** du montant effectivement encaissé ;
• Annulation **moins de 24 heures** avant le rendez-vous : remboursement selon la **politique du Professionnel** concerné. Des frais d'annulation peuvent s'appliquer ;
• **Absence non signalée** (non-présentation sans annulation préalable) : **aucun remboursement automatique**. Le Professionnel peut facturer l'intégralité de la Prestation ;
• **Incident technique majeur** imputable à la Plateforme (panne serveur, visioconférence inaccessible, etc.) : remboursement intégral ou replanification gratuite, après examen par l'équipe support Tuatha.

**9.2. Annulation par le Professionnel**

En cas d'annulation imputable au Professionnel, l'Athlète peut obtenir, selon les cas :
• un report de la Prestation ;
• ou un remboursement total des sommes effectivement encaissées.

**9.3. Cas exceptionnels**

Les demandes liées à un cas de force majeure ou à une circonstance exceptionnelle peuvent être examinées au cas par cas, sans garantie automatique de remboursement.

**9.4. Modalités du remboursement**

Lorsqu'un remboursement est dû, celui-ci est effectué via le moyen de paiement initialement utilisé ou par tout autre moyen légalement autorisé.

Les délais effectifs de recrédit dépendent du Prestataire de paiement et de l'établissement bancaire concerné.

**9.5. Absence de remboursement en dehors des cas prévus**

En dehors des cas expressément prévus par les présentes CGV, par les conditions particulières affichées avant la Commande, par la loi ou par une décision discrétionnaire favorable de Tuatha ou du Professionnel, aucun remboursement n'est dû.`;

// ─── Règles pour injection IA ───

export const CANCELLATION_AI_RULES = `
POLITIQUE D'ANNULATION MVP TUATHA :

1. Annulation > 24h avant le RDV → remboursement intégral automatique (Stripe refund)
2. Annulation < 24h avant le RDV → remboursement selon politique du professionnel (frais possibles)
3. No-show (absence non signalée) → pas de remboursement automatique, le pro peut facturer
4. Incident technique majeur Tuatha → remboursement manuel total ou replanification (traité par support)

RÈGLES IA :
- Cette politique est IDENTIQUE dans les CGV, l'UX athlète et le back-office pro
- Ne jamais promettre un remboursement qui n'est pas prévu par cette politique
- Ne jamais inventer de délai de remboursement (dépend de Stripe + banque)
- Le remboursement se fait TOUJOURS sur le moyen de paiement initial
- Tuatha ne gère PAS d'avoir, de crédit interne ou de portefeuille
- En cas de litige, orienter vers support@tuatha.app
`.trim();
