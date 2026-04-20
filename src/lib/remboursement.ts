// ─── Remboursement — Attributs de conventionnement par spécialité ───
//
// Structure les données de remboursement pour chaque catégorie de professionnel.
// Aucun calcul de montant ici : on stocke les métadonnées pour la suite.
//
// ⚠️  MVP TUATHA — EXCLUSIONS TÉLÉTRANSMISSION :
//   Tuatha MVP ne fait PAS de télétransmission santé. Les flux suivants sont
//   HORS PÉRIMÈTRE et ne doivent jamais être suggérés, promis ou implémentés :
//     - FSE  (Feuille de Soins Électronique)
//     - DRE  (Demande de Remboursement Électronique)
//     - NOEMIE (retours Assurance Maladie → complémentaire)
//     - Tiers payant (dispense d'avance de frais)
//   Ces flux relèvent de SESAM-Vitale et nécessitent un système métier de
//   facturation santé dédié (lecteur CPS, carte Vitale, homologation GIE).
//   Ce n'est PAS une extension du checkout Stripe.
//
// ATTENTION aux distinctions :
// - Médecin : tarifs et bases de remboursement évoluent (NGAP/CCAM), secteur 1 vs 2
// - Kiné : remboursement conditionné à une prescription médicale, nomenclature spécifique (NGAP kiné)
// - Diététicien : NE PAS confondre avec médecin nutritionniste (qui est remboursé comme médecin)
//   Le diététicien est remboursé uniquement dans le cadre du parcours "Mon bilan diététique" (3 séances/an)
//   ou via certaines mutuelles, sur présentation d'une prescription
// - Autre pro : aucun remboursement sécu, éventuellement mutuelle selon contrat

export type ConventionneStatus = "oui" | "non" | "secteur_1" | "secteur_2" | "a_verifier";
export type OrdonnanceStatus = "oui" | "non" | "selon_acte";
export type MutuelleStatus = "oui" | "non" | "a_verifier";

export interface RemboursementDefaults {
  professionAffichee: string;
  conventionne: ConventionneStatus;
  prestationRemboursableType: string | null;
  ordonnanceRequise: OrdonnanceStatus;
  mutuelleAcceptee: MutuelleStatus;
  remboursementNote: string | null;
}

/**
 * Returns sensible default reimbursement attributes for a given specialité.
 * These are starting values — the pro can override them from their profile.
 */
export function getRemboursementDefaults(specialite: string): RemboursementDefaults {
  switch (specialite) {
    case "medecin":
      return {
        professionAffichee: "Médecin",
        conventionne: "a_verifier", // secteur 1, 2 ou non conventionné — le pro doit préciser
        prestationRemboursableType: "Consultation médicale",
        ordonnanceRequise: "non", // pas besoin d'ordonnance pour consulter un médecin
        mutuelleAcceptee: "a_verifier",
        remboursementNote:
          "Le remboursement dépend du secteur de conventionnement (1 ou 2) et du respect du parcours de soins coordonnés. " +
          "Les tarifs et bases de remboursement sont fixés par la convention nationale et peuvent évoluer. " +
          "Les dépassements d'honoraires (secteur 2) restent à la charge du patient ou de sa complémentaire.",
      };

    case "kine":
      return {
        professionAffichee: "Kinésithérapeute",
        conventionne: "a_verifier",
        prestationRemboursableType: "Actes de rééducation (NGAP kiné)",
        ordonnanceRequise: "oui", // prescription médicale obligatoire pour le remboursement
        mutuelleAcceptee: "a_verifier",
        remboursementNote:
          "Le remboursement des séances de kinésithérapie est conditionné à la présentation d'une prescription médicale " +
          "mentionnant le diagnostic et le nombre de séances. Certains actes hors nomenclature (bien-être, massage sportif) " +
          "ne sont pas pris en charge par l'Assurance Maladie. Le nombre de séances remboursées peut être limité selon la pathologie.",
      };

    case "dieteticien":
      return {
        professionAffichee: "Diététicien",
        conventionne: "non", // le diététicien n'est PAS conventionné au sens classique
        prestationRemboursableType: "Bilan diététique et séances de suivi (dispositif « Mon bilan diététique »)",
        ordonnanceRequise: "selon_acte", // prescription requise pour le dispositif sécu, pas pour les mutuelles
        mutuelleAcceptee: "a_verifier",
        remboursementNote:
          "Le diététicien n'est pas un médecin nutritionniste et ne bénéficie pas du même cadre de remboursement. " +
          "Depuis 2024, le dispositif « Mon bilan diététique » permet la prise en charge de 3 séances par an " +
          "sur adressage médical, pour les patients de 16 à 25 ans en situation d'obésité ou de surpoids. " +
          "En dehors de ce dispositif, le remboursement dépend exclusivement de la complémentaire santé du patient.",
      };

    case "autre":
    default:
      return {
        professionAffichee: "Professionnel du sport et du bien-être",
        conventionne: "non",
        prestationRemboursableType: null,
        ordonnanceRequise: "non",
        mutuelleAcceptee: "a_verifier",
        remboursementNote:
          "Les prestations de ce professionnel ne sont pas prises en charge par l'Assurance Maladie obligatoire. " +
          "Certaines mutuelles ou complémentaires santé peuvent proposer un forfait « médecines douces » ou « bien-être » " +
          "couvrant partiellement ces séances. Renseignez-vous auprès de votre complémentaire.",
      };
  }
}

// ─── Labels for UI display ───

export const CONVENTIONNE_LABELS: Record<ConventionneStatus, string> = {
  oui: "Conventionné",
  non: "Non conventionné",
  secteur_1: "Conventionné secteur 1",
  secteur_2: "Conventionné secteur 2 (honoraires libres)",
  a_verifier: "À vérifier",
};

export const ORDONNANCE_LABELS: Record<OrdonnanceStatus, string> = {
  oui: "Ordonnance requise",
  non: "Sans ordonnance",
  selon_acte: "Selon l'acte / le dispositif",
};

export const MUTUELLE_LABELS: Record<MutuelleStatus, string> = {
  oui: "Prise en charge mutuelle possible",
  non: "Non pris en charge par les mutuelles",
  a_verifier: "À vérifier auprès de votre mutuelle",
};

// ─── 3 niveaux de messages remboursement côté athlète ───
//
// Pour chaque prestation, on affiche l'un de ces 3 statuts
// avec un message adapté à la profession exacte du praticien.
//
// On ne promet JAMAIS :
//   - "remboursé par la Sécu"
//   - "mutuelle prise en charge automatiquement"
//   - "reste à charge calculé"
// tant qu'on n'a pas la vraie brique métier.
//
// DISTINCTION ESSENTIELLE (source : ameli.fr) :
//   - Médecin (y compris médecin nutritionniste) → parcours potentiellement remboursable
//   - Kinésithérapeute → potentiellement remboursable selon cadre médical (ordonnance)
//   - Diététicien ≠ médecin nutritionniste → généralement hors AM, mutuelle possible
//   - Autre professionnel (coach, etc.) → non remboursable

export type RemboursementLevel = "am_possible" | "mutuelle_uniquement" | "non_remboursable";

export interface RemboursementMessage {
  level: RemboursementLevel;
  label: string;
  shortLabel: string;
  description: string;
  disclaimer: string;
  icon: string;
  color: string;
  bgColor: string;
}

// ─── Messages par niveau (génériques, utilisés quand pas de spécialité connue) ───

export const REMBOURSEMENT_MESSAGES: Record<RemboursementLevel, RemboursementMessage> = {
  am_possible: {
    level: "am_possible",
    label: "Remboursement Assurance Maladie possible selon votre situation",
    shortLabel: "AM possible*",
    description:
      "Cette prestation peut faire l'objet d'un remboursement par l'Assurance Maladie " +
      "sous certaines conditions (parcours de soins, prescription, conventionnement du praticien). " +
      "Le taux et le montant dépendent de votre situation personnelle.",
    disclaimer:
      "Tuatha ne calcule pas les montants de remboursement. " +
      "Renseignez-vous auprès de votre caisse d'Assurance Maladie (ameli.fr) pour connaître vos droits exacts.",
    icon: "🏥",
    color: "#10b981",
    bgColor: "rgba(16, 185, 129, 0.08)",
  },
  mutuelle_uniquement: {
    level: "mutuelle_uniquement",
    label: "Prise en charge éventuelle par votre mutuelle uniquement",
    shortLabel: "Mutuelle possible*",
    description:
      "Cette prestation n'est généralement pas prise en charge par l'Assurance Maladie obligatoire. " +
      "En revanche, certaines complémentaires santé (mutuelles) peuvent couvrir tout ou partie " +
      "du montant selon votre contrat.",
    disclaimer:
      "Tuatha ne vérifie pas votre couverture mutuelle. " +
      "Consultez votre contrat ou contactez votre complémentaire santé avant la consultation.",
    icon: "🛡️",
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.08)",
  },
  non_remboursable: {
    level: "non_remboursable",
    label: "Prestation non remboursable",
    shortLabel: "Non remboursable",
    description:
      "Cette prestation n'est prise en charge ni par l'Assurance Maladie, " +
      "ni habituellement par les complémentaires santé. " +
      "Le montant est intégralement à votre charge.",
    disclaimer:
      "Vérifiez toutefois auprès de votre mutuelle : certains contrats prévoient des forfaits spécifiques.",
    icon: "💳",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.08)",
  },
};

// ─── Messages spécifiques par profession ───
//
// Chaque profession a un label, description et disclaimer adapté
// à son cadre réglementaire exact (source : ameli.fr).

const PROFESSION_MESSAGES: Record<string, RemboursementMessage> = {
  medecin: {
    level: "am_possible",
    label: "Remboursement Assurance Maladie possible selon votre situation",
    shortLabel: "AM possible*",
    description:
      "Les consultations médicales sont potentiellement remboursables par l'Assurance Maladie " +
      "dans le cadre du parcours de soins coordonnés (médecin traitant déclaré). " +
      "Le taux de remboursement dépend du secteur de conventionnement du médecin (secteur 1 ou 2) " +
      "et du respect du parcours de soins. Les dépassements d'honoraires éventuels restent à votre charge " +
      "ou celle de votre complémentaire.",
    disclaimer:
      "Tuatha ne calcule pas les montants de remboursement ni les dépassements d'honoraires. " +
      "Renseignez-vous auprès de votre caisse d'Assurance Maladie (ameli.fr) pour connaître vos droits exacts.",
    icon: "🏥",
    color: "#10b981",
    bgColor: "rgba(16, 185, 129, 0.08)",
  },
  kine: {
    level: "am_possible",
    label: "Potentiellement remboursable selon cadre médical",
    shortLabel: "AM possible*",
    description:
      "Les séances de kinésithérapie sont potentiellement remboursables par l'Assurance Maladie, " +
      "à condition de disposer d'une prescription médicale (ordonnance) précisant le diagnostic " +
      "et le nombre de séances. Certains actes hors nomenclature (massage de confort, bien-être sportif) " +
      "ne sont pas pris en charge. Le nombre de séances remboursées peut être limité selon la pathologie.",
    disclaimer:
      "Tuatha ne vérifie pas si vous disposez d'une ordonnance valide. " +
      "Renseignez-vous auprès de votre médecin et de votre caisse d'Assurance Maladie (ameli.fr).",
    icon: "🏥",
    color: "#10b981",
    bgColor: "rgba(16, 185, 129, 0.08)",
  },
  dieteticien: {
    level: "mutuelle_uniquement",
    label: "Généralement hors Assurance Maladie — mutuelle possible selon contrat",
    shortLabel: "Mutuelle possible*",
    description:
      "Le diététicien n'est pas un médecin nutritionniste : ses consultations ne sont généralement " +
      "pas prises en charge par l'Assurance Maladie obligatoire. " +
      "Certaines mutuelles proposent un forfait « diététique » ou « médecines douces » couvrant " +
      "tout ou partie des séances selon votre contrat. " +
      "Le dispositif « Mon bilan diététique » (Assurance Maladie) peut prendre en charge jusqu'à 3 séances/an " +
      "sur adressage médical, mais uniquement pour certains profils (16-25 ans, surpoids/obésité).",
    disclaimer:
      "Tuatha ne vérifie pas votre éligibilité au dispositif « Mon bilan diététique » ni votre couverture mutuelle. " +
      "Consultez votre contrat de complémentaire santé ou contactez votre mutuelle avant la consultation.",
    icon: "🛡️",
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.08)",
  },
  autre: {
    level: "non_remboursable",
    label: "Prestation non remboursable",
    shortLabel: "Non remboursable",
    description:
      "Les prestations de ce professionnel (coach sportif, préparateur physique, etc.) ne sont pas " +
      "prises en charge par l'Assurance Maladie obligatoire. " +
      "Certaines mutuelles ou complémentaires santé proposent un forfait « bien-être » ou « médecines douces » " +
      "couvrant partiellement ce type de séances selon votre contrat.",
    disclaimer:
      "Vérifiez auprès de votre mutuelle : certains contrats prévoient des forfaits spécifiques " +
      "pour les prestations de bien-être ou de coaching sportif.",
    icon: "💳",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.08)",
  },
};

/**
 * Returns the athlete-facing reimbursement level for a given pro specialité.
 * Supports legacy values ("coach", "nutri").
 *
 * Rules (source : ameli.fr) :
 * - medecin (y compris médecin nutritionniste) → AM possible (parcours de soins)
 * - kine → AM possible (sous ordonnance médicale)
 * - dieteticien (≠ médecin nutritionniste) → mutuelle uniquement
 * - autre / coach / unknown → non remboursable
 */
export function getRemboursementLevel(specialite: string): RemboursementLevel {
  switch (specialite) {
    case "medecin":
    case "kine":
      return "am_possible";
    case "dieteticien":
    case "nutri":
      return "mutuelle_uniquement";
    case "autre":
    case "coach":
    default:
      return "non_remboursable";
  }
}

/**
 * Get the full profession-specific reimbursement message for a specialité.
 * Returns a message tailored to the exact profession (médecin ≠ kiné ≠ diététicien).
 * Supports legacy values ("coach" → autre, "nutri" → dieteticien).
 */
export function getRemboursementMessage(specialite: string): RemboursementMessage {
  // Map legacy values to canonical keys
  const canonical: Record<string, string> = { coach: "autre", nutri: "dieteticien" };
  const key = canonical[specialite] || specialite;
  return PROFESSION_MESSAGES[key] || PROFESSION_MESSAGES.autre;
}

// ─── Règles remboursement pour injection IA ───
//
// Bloc de texte injecté dans les system prompts des API IA
// pour que l'assistant ne fasse JAMAIS de fausse promesse.

export const REMBOURSEMENT_AI_RULES = `
RÈGLES REMBOURSEMENT — NE JAMAIS CONTREDIRE :

1. MÉDECIN (y compris médecin nutritionniste) :
   → Parcours potentiellement remboursable par l'Assurance Maladie
   → Conditions : parcours de soins coordonnés, secteur de conventionnement (1 ou 2)
   → Un médecin nutritionniste est un MÉDECIN, pas un diététicien → remboursement identique

2. KINÉSITHÉRAPEUTE :
   → Potentiellement remboursable selon cadre médical
   → Conditions : ordonnance médicale obligatoire, actes inscrits à la nomenclature
   → Les actes hors nomenclature (massage bien-être, sport) ne sont PAS remboursés

3. DIÉTÉTICIEN (≠ médecin nutritionniste) :
   → Généralement HORS Assurance Maladie standard
   → Mutuelle possible selon le contrat du patient (forfait « diététique », « médecines douces »)
   → Exception : dispositif « Mon bilan diététique » (3 séances/an, 16-25 ans, surpoids/obésité, sur adressage médical)
   → NE JAMAIS confondre diététicien et médecin nutritionniste

4. AUTRE PROFESSIONNEL (coach sportif, préparateur physique, etc.) :
   → Prestation NON remboursable par l'Assurance Maladie
   → Certaines mutuelles prévoient un forfait « bien-être »

INTERDICTIONS ABSOLUES — NE JAMAIS DIRE :
- « remboursé par la Sécu » (dire « potentiellement remboursable selon votre situation »)
- « mutuelle prise en charge automatiquement » (dire « prise en charge éventuelle selon votre contrat »)
- « reste à charge de X€ » (Tuatha ne calcule PAS les montants de remboursement)
- « vous serez remboursé » sans conditionnel
- Confondre diététicien et médecin nutritionniste

EXCLUSIONS MVP — TUATHA NE FAIT PAS :
- FSE (Feuille de Soins Électronique) — flux SESAM-Vitale, hors périmètre
- DRE (Demande de Remboursement Électronique) — idem
- NOEMIE (retours AM → complémentaire) — idem
- Tiers payant (dispense d'avance de frais) — idem
- Calcul de remboursement ou de reste à charge
- Lecture de carte Vitale ou de carte CPS
Tuatha est une plateforme de prise de rendez-vous et de paiement (Stripe Checkout).
Le paiement est un acte COMMERCIAL (checkout), pas un acte de TÉLÉTRANSMISSION santé.
Ne jamais suggérer que Tuatha peut émettre des FSE, gérer le tiers payant, ou transmettre
à l'Assurance Maladie. Orienter le patient vers son praticien ou sa caisse AM pour ces sujets.
`.trim();

// ─── MVP exclusions — exported for UI disclaimers ───

export const MVP_EXCLUSIONS = {
  noFSE: true,
  noDRE: true,
  noNOEMIE: true,
  noTiersPayant: true,
  noCarteVitale: true,
  noRemboursementCalcul: true,
  disclaimer:
    "Tuatha est une plateforme de prise de rendez-vous et de paiement en ligne. " +
    "Tuatha ne réalise pas de télétransmission (FSE, DRE), ne gère pas le tiers payant, " +
    "et ne transmet pas de données à l'Assurance Maladie (NOEMIE). " +
    "Pour vos démarches de remboursement, adressez-vous directement à votre caisse d'Assurance Maladie " +
    "ou à votre mutuelle avec le justificatif de paiement.",
  shortDisclaimer:
    "Tuatha ne réalise pas de télétransmission santé (FSE, tiers payant). " +
    "Conservez votre reçu pour vos démarches de remboursement.",
} as const;

// ─── Validation ───

const VALID_CONVENTIONNE: string[] = ["oui", "non", "secteur_1", "secteur_2", "a_verifier"];
const VALID_ORDONNANCE: string[] = ["oui", "non", "selon_acte"];
const VALID_MUTUELLE: string[] = ["oui", "non", "a_verifier"];

export function isValidConventionne(v: string): v is ConventionneStatus {
  return VALID_CONVENTIONNE.includes(v);
}
export function isValidOrdonnance(v: string): v is OrdonnanceStatus {
  return VALID_ORDONNANCE.includes(v);
}
export function isValidMutuelle(v: string): v is MutuelleStatus {
  return VALID_MUTUELLE.includes(v);
}
