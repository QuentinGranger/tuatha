// ─── Athlete Sharing Consent Check ───
//
// Ensures no athlete data is forwarded/shared externally without explicit consent.
//
// Two levels of consent on Athlete model:
//   - consentement: general data processing consent (GDPR baseline)
//   - consentementPartage: specific consent to share data with other professionals
//
// Every action that exposes athlete data to a NEW external party must check
// consentementPartage BEFORE proceeding:
//   - Sending an invitation to another pro
//   - Accepting an invitation (creating a ProConnection)
//   - Accessing shared data via /api/reseau/shared
//   - Exporting athlete data

import { prisma } from "@/lib/prisma";
import { consent, type ConsentContext } from "@/lib/consent";

// ─── Types ───

export interface ConsentResult {
  granted: boolean;
  reason?: string;
  athleteName?: string;
}

// ─── Core Check ───

/**
 * Verify that an athlete has consented to having their data shared externally.
 * Must be called before any action that forwards data to a non-owner professional.
 */
export async function checkSharingConsent(athleteId: string): Promise<ConsentResult> {
  const athlete = await (prisma as any).athlete.findUnique({
    where: { id: athleteId },
    select: {
      name: true,
      consentement: true,
      consentementPartage: true,
      consentementPartageDate: true,
    },
  });

  if (!athlete) {
    return { granted: false, reason: "Athlète introuvable." };
  }

  // General consent must also be granted
  if (!athlete.consentement) {
    return {
      granted: false,
      reason: `Le consentement général de ${athlete.name} n'a pas été recueilli. Veuillez d'abord obtenir le consentement de l'athlète.`,
      athleteName: athlete.name,
    };
  }

  // Sharing-specific consent
  if (!athlete.consentementPartage) {
    return {
      granted: false,
      reason: `${athlete.name} n'a pas consenti au partage de ses données avec d'autres professionnels. Veuillez recueillir son consentement avant de partager.`,
      athleteName: athlete.name,
    };
  }

  return { granted: true, athleteName: athlete.name };
}

// ─── Grant / Revoke Consent (with full traceability) ───

/**
 * Record that an athlete has consented to external data sharing.
 * Writes an immutable ConsentLog entry for audit trail.
 */
export async function grantSharingConsent(
  athleteId: string,
  proId: string,
  ctx: ConsentContext = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    await consent.grant("partage", athleteId, proId, {
      ...ctx,
      purpose: ctx.purpose || "Partage de données avec un confrère",
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Erreur lors de l'enregistrement du consentement." };
  }
}

/**
 * Revoke an athlete's sharing consent.
 * This does NOT automatically revoke existing connections — those remain
 * until manually deleted or expired. But it blocks NEW sharing actions.
 * Writes an immutable ConsentLog entry for audit trail.
 */
export async function revokeSharingConsent(
  athleteId: string,
  proId: string,
  ctx: ConsentContext = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    await consent.revoke("partage", athleteId, proId, ctx);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erreur lors de la révocation du consentement." };
  }
}
