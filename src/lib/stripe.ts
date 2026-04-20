// ─── Stripe Connect — Server-side SDK ───
// Singleton instance for all Stripe API calls.
// NEVER import this file from client components.

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Map internal specialite values to Stripe-compatible MCC codes.
 * MCC 8011 = Doctors / Health practitioners
 * MCC 7941 = Sports / Athletic services
 */
export function getMccForSpecialite(specialite: string): string {
  switch (specialite) {
    case "medecin":
    case "kine":
    case "dieteticien":
      return "8011"; // Doctors, Health Practitioners
    case "autre":
    default:
      return "7941"; // Athletic Services
  }
}

/**
 * Map internal specialite values to a Stripe business_type.
 * Express accounts support "individual" and "company".
 */
export function getBusinessType(statutExercice: string): "individual" | "company" {
  switch (statutExercice) {
    case "liberal":
    case "remplacant":
      return "individual";
    case "salarie":
    case "mixte":
    case "autre":
    default:
      return "individual";
  }
}
