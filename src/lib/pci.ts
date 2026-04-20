// ─── PCI DSS / CNIL — Politique de non-stockage des données carte ───
//
// RÈGLE ABSOLUE : Tuatha ne stocke AUCUNE donnée de carte bancaire.
//
// Ce fichier documente et applique les garde-fous techniques conformément
// aux exigences PCI DSS (SAQ-A via Stripe Checkout) et aux recommandations
// de la CNIL sur la conservation des données carte.
//
// Ce qui est INTERDIT dans notre base de données et nos logs :
//   - PAN complet ou partiel (numéro de carte)
//   - Cryptogramme visuel (CVV/CVC)
//   - Date d'expiration
//   - Empreinte carte (fingerprint maison)
//   - Stripe PaymentMethod ID sauvegardé pour réutilisation future
//   - Stripe Customer ID associé à une carte sauvegardée
//
// Ce qui est AUTORISÉ (IDs Stripe utiles uniquement) :
//   - stripeAccountId (acct_xxx) → compte Connect du professionnel
//   - stripeCheckoutSessionId (cs_xxx) → session de paiement ponctuelle
//   - stripePaymentIntentId (pi_xxx) → traçabilité comptable
//
// La CNIL rappelle que la conservation des données carte au-delà de la
// transaction est strictement encadrée, et que le consentement doit être
// explicite lorsqu'une conservation est proposée pour de futurs achats.
// Nous ne proposons PAS de sauvegarde de carte : chaque paiement passe
// par Stripe Checkout hébergé, et les données sensibles ne transitent
// jamais par nos serveurs.

/**
 * List of field name patterns that MUST NEVER appear in our database
 * or be stored in any log/JSON/metadata field.
 */
const FORBIDDEN_PATTERNS = [
  /card.?number/i,
  /card.?pan/i,
  /\bpan\b/,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /\bcryptogramme\b/i,
  /exp.?month/i,
  /exp.?year/i,
  /card.?fingerprint/i,
  /empreinte.?carte/i,
  /\blast4\b/i,
  /card.?brand/i,
  /payment.?method.?id/i,
  /pm_/,
];

/**
 * Sanitizes an object by stripping any key that matches a forbidden pattern.
 * Use this as a safety net when storing metadata from external sources.
 *
 * Returns a shallow copy with offending keys removed.
 * Logs a warning if any key was stripped (for audit trail).
 */
export function stripCardData<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const clean = { ...obj };
  let stripped = false;

  for (const key of Object.keys(clean)) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(key)) {
        delete clean[key as keyof T];
        console.warn(`[PCI] Stripped forbidden field "${key}" — card data must NEVER be stored.`);
        stripped = true;
        break;
      }
    }
  }

  if (stripped) {
    console.warn("[PCI] One or more card data fields were stripped. Review the calling code.");
  }

  return clean;
}

/**
 * Asserts that a metadata object does not contain card data.
 * Throws an error if any forbidden pattern is found.
 * Use this in tests and critical paths.
 */
export function assertNoCardData(obj: Record<string, unknown>, context: string): void {
  for (const key of Object.keys(obj)) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(key)) {
        throw new Error(
          `[PCI VIOLATION] Field "${key}" detected in ${context}. ` +
            `Storing card data is FORBIDDEN. See src/lib/pci.ts for policy.`
        );
      }
    }
  }
}

/**
 * Validates that a Stripe-related ID is only an allowed type.
 * Rejects PaymentMethod IDs (pm_xxx) which could enable card reuse.
 */
export function isAllowedStripeId(id: string): boolean {
  // Allowed prefixes: acct_, cs_, pi_, ch_, re_, sub_ (if needed later)
  const ALLOWED_PREFIXES = ["acct_", "cs_", "pi_", "ch_", "re_", "evt_", "whsec_"];
  // Explicitly forbidden: pm_ (PaymentMethod — implies saved card)
  if (id.startsWith("pm_")) return false;
  return ALLOWED_PREFIXES.some((p) => id.startsWith(p));
}
