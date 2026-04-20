// ─── Taxonomie des prestations — Source unique de vérité ───
//
// 4 types de prestations standardisés.
// 4 labels de remboursement explicites (aucune promesse implicite).
//
// Chaque tarif créé par un professionnel DOIT porter :
//   1. Un `prestationType` parmi les 4 types
//   2. Un `remboursementLabel` parmi les 4 labels
//
// Le croisement type × spécialité × remboursementLabel est libre :
// c'est le professionnel qui choisit, mais les défauts sont guidés par sa spécialité.

// ─── Types de prestation ───

export type PrestationType =
  | "consultation_visio"
  | "consultation_presentielle"
  | "suivi_ponctuel"
  | "pack_non_remboursable";

export interface PrestationTypeInfo {
  value: PrestationType;
  label: string;
  shortLabel: string;
  description: string;
}

export const PRESTATION_TYPES: Record<PrestationType, PrestationTypeInfo> = {
  consultation_visio: {
    value: "consultation_visio",
    label: "Consultation visio",
    shortLabel: "Visio",
    description: "Téléconsultation en visioconférence via la plateforme",
  },
  consultation_presentielle: {
    value: "consultation_presentielle",
    label: "Consultation présentielle réservée via plateforme",
    shortLabel: "Présentiel",
    description: "Consultation en cabinet, réservée et gérée via Tuatha",
  },
  suivi_ponctuel: {
    value: "suivi_ponctuel",
    label: "Suivi ponctuel",
    shortLabel: "Suivi",
    description: "Séance de suivi individuelle (rééducation, bilan, contrôle)",
  },
  pack_non_remboursable: {
    value: "pack_non_remboursable",
    label: "Pack simple non remboursable",
    shortLabel: "Pack",
    description: "Forfait ou pack de séances non pris en charge par l'Assurance Maladie",
  },
};

export const PRESTATION_TYPE_LIST: PrestationTypeInfo[] = Object.values(PRESTATION_TYPES);

// ─── Labels de remboursement ───

export type RemboursementLabel =
  | "potentiellement_remboursable"
  | "hors_assurance_maladie"
  | "complementaire_possible"
  | "a_verifier_patient";

export interface RemboursementLabelInfo {
  value: RemboursementLabel;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}

export const REMBOURSEMENT_LABELS: Record<RemboursementLabel, RemboursementLabelInfo> = {
  potentiellement_remboursable: {
    value: "potentiellement_remboursable",
    label: "Potentiellement remboursable",
    shortLabel: "Remboursable*",
    description:
      "Cette prestation peut être prise en charge par l'Assurance Maladie sous conditions " +
      "(parcours de soins, prescription, conventionnement). Le montant et le taux dépendent " +
      "de la situation du patient et du professionnel.",
    color: "#10b981",
  },
  hors_assurance_maladie: {
    value: "hors_assurance_maladie",
    label: "Hors Assurance Maladie",
    shortLabel: "Non remboursé",
    description:
      "Cette prestation n'est pas prise en charge par l'Assurance Maladie obligatoire. " +
      "Le montant est intégralement à la charge du patient.",
    color: "#ef4444",
  },
  complementaire_possible: {
    value: "complementaire_possible",
    label: "Prise en charge complémentaire possible selon contrat",
    shortLabel: "Mutuelle possible",
    description:
      "Cette prestation n'est pas remboursée par l'Assurance Maladie, mais certaines " +
      "complémentaires santé (mutuelles) peuvent en couvrir une partie selon le contrat souscrit.",
    color: "#f59e0b",
  },
  a_verifier_patient: {
    value: "a_verifier_patient",
    label: "À vérifier par le patient",
    shortLabel: "À vérifier",
    description:
      "Le remboursement de cette prestation dépend de la situation individuelle du patient " +
      "(régime, complémentaire, prescription). Il appartient au patient de se renseigner " +
      "auprès de sa caisse et de sa mutuelle avant la consultation.",
    color: "#6b7280",
  },
};

export const REMBOURSEMENT_LABEL_LIST: RemboursementLabelInfo[] = Object.values(REMBOURSEMENT_LABELS);

// ─── Défauts par spécialité × type de prestation ───

/**
 * Returns the default remboursement label for a given specialité and prestation type.
 * The pro can override this, but the default avoids implicit promises.
 */
export function getDefaultRemboursementLabel(
  specialite: string,
  prestationType: PrestationType
): RemboursementLabel {
  // Packs are never reimbursed regardless of speciality
  if (prestationType === "pack_non_remboursable") {
    return "hors_assurance_maladie";
  }

  switch (specialite) {
    case "medecin":
      // Medical consultations are potentially reimbursable (depends on sector, parcours de soins)
      return "potentiellement_remboursable";

    case "kine":
      // Kiné sessions are potentially reimbursable IF prescription exists
      // suivi_ponctuel without prescription context → à vérifier
      if (prestationType === "suivi_ponctuel") return "a_verifier_patient";
      return "potentiellement_remboursable";

    case "dieteticien":
      // Diététicien ≠ médecin nutritionniste
      // Only "Mon bilan diététique" device is partially covered, rest is complementaire
      if (prestationType === "suivi_ponctuel") return "complementaire_possible";
      return "a_verifier_patient";

    case "autre":
    default:
      // Non-regulated professionals: never reimbursed by sécu
      return "complementaire_possible";
  }
}

// ─── Validation ───

const VALID_PRESTATION_TYPES = new Set<string>(Object.keys(PRESTATION_TYPES));
const VALID_REMBOURSEMENT_LABELS = new Set<string>(Object.keys(REMBOURSEMENT_LABELS));

export function isValidPrestationType(v: string): v is PrestationType {
  return VALID_PRESTATION_TYPES.has(v);
}

export function isValidRemboursementLabel(v: string): v is RemboursementLabel {
  return VALID_REMBOURSEMENT_LABELS.has(v);
}
