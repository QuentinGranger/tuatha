// ─── Account Status — Professional Lifecycle ───
//
// Statuses:
//   draft              → Compte créé, onboarding en cours
//   stripe_pending     → Stripe Connect soumis mais pas encore vérifié par Stripe
//   profile_pending    → Profil configuré, en attente vérification email
//   compliance_review  → Tout soumis, en attente validation admin (docs/credentials)
//   active             → Pleinement opérationnel, peut recevoir réservations et paiements
//   suspended          → Bloqué par l'admin
//
// Transitions:
//   inscription            → draft
//   stripe onboarding done → stripe_pending
//   configuration done     → profile_pending
//   email verified         → compliance_review
//   admin validates        → active
//   admin suspends         → suspended

export type AccountStatus =
  | "draft"
  | "stripe_pending"
  | "profile_pending"
  | "compliance_review"
  | "active"
  | "suspended";

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  draft: "Brouillon",
  stripe_pending: "Vérification paiement en cours",
  profile_pending: "Profil en attente",
  compliance_review: "En cours de vérification",
  active: "Actif",
  suspended: "Suspendu",
};

export const ACCOUNT_STATUS_COLORS: Record<AccountStatus, string> = {
  draft: "#6b7280",
  stripe_pending: "#8b5cf6",
  profile_pending: "#f59e0b",
  compliance_review: "#3b82f6",
  active: "#10b981",
  suspended: "#ef4444",
};

/** The professional can receive bookings and payments */
export function isPaymentReady(accountStatus: string): boolean {
  return accountStatus === "active";
}

/** The professional is visible in search but NOT bookable */
export function isVisibleButNotBookable(accountStatus: string): boolean {
  return (
    accountStatus === "profile_pending" ||
    accountStatus === "compliance_review" ||
    accountStatus === "stripe_pending"
  );
}

/** The professional is completely blocked */
export function isBlocked(accountStatus: string): boolean {
  return accountStatus === "suspended";
}

/**
 * Compute the next accountStatus based on what the pro has completed.
 * Called after each onboarding step to advance the status.
 * Never downgrades from 'active' or 'suspended' (admin-controlled).
 */
export function computeAccountStatus(pro: {
  accountStatus: string;
  emailVerified: boolean;
  stripeDetailsSubmitted: boolean;
  stripeOnboardingComplete: boolean;
  verificationStatus: string;
  adresseCabinet?: string | null;
}): AccountStatus {
  // Never auto-change admin-controlled statuses
  if (pro.accountStatus === "active") return "active";
  if (pro.accountStatus === "suspended") return "suspended";

  // Auto-activate if admin already verified documents AND everything else is done
  if (
    pro.verificationStatus === "verified" &&
    pro.emailVerified &&
    pro.stripeDetailsSubmitted
  ) {
    return "active";
  }

  // Email verified + Stripe done + profile done → compliance_review
  if (pro.emailVerified && pro.stripeDetailsSubmitted && pro.adresseCabinet) {
    return "compliance_review";
  }

  // Stripe done + profile done but email not yet → profile_pending
  if (pro.stripeDetailsSubmitted && pro.adresseCabinet) {
    return "profile_pending";
  }

  // Stripe submitted but not yet fully verified or profile not done
  if (pro.stripeDetailsSubmitted) {
    return "stripe_pending";
  }

  return "draft";
}
