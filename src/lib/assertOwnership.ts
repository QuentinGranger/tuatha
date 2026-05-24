// ─── Reusable Ownership Guard ───
// Prevents IDOR by asserting that a resource belongs to the authenticated user.
// Use this in any route that takes an external ID to access a specific record.

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type OwnerField = "athleteUserId" | "professionnelId";

interface OwnershipResult {
  granted: boolean;
  record?: Record<string, unknown>;
  response?: NextResponse;
}

/**
 * Assert direct ownership of a record by checking a field value.
 *
 * @param model   Prisma model name (e.g. "athleteProMessage")
 * @param id      Record ID to check
 * @param field   Field to check ownership against (e.g. "athleteUserId")
 * @param userId  Expected value of the ownership field (session.id)
 * @param select  Optional fields to select (returns full record if omitted)
 */
export async function assertOwnership(
  model: string,
  id: string,
  field: OwnerField,
  userId: string,
  select?: Record<string, boolean>,
): Promise<OwnershipResult> {
  const record = await (prisma as any)[model].findUnique({
    where: { id },
    ...(select ? { select: { ...select, [field]: true } } : {}),
  });

  if (!record) {
    return {
      granted: false,
      response: NextResponse.json({ error: "Ressource introuvable" }, { status: 404 }),
    };
  }

  if (record[field] !== userId) {
    return {
      granted: false,
      response: NextResponse.json({ error: "Accès non autorisé" }, { status: 403 }),
    };
  }

  return { granted: true, record };
}

/**
 * Assert ownership through a connection chain (athlete → email → athlete fiche → resource).
 * Used when the athlete's data is linked via a pro-side Athlete fiche.
 */
export async function assertAthleteOwnershipViaEmail(
  athleteUserId: string,
  proId: string,
): Promise<{ granted: boolean; athleteId?: string; response?: NextResponse }> {
  // Get athlete user email
  const athleteUser = await prisma.athleteUser.findUnique({
    where: { id: athleteUserId },
    select: { email: true },
  });
  if (!athleteUser) {
    return {
      granted: false,
      response: NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 }),
    };
  }

  // Verify accepted connection
  const connection = await prisma.connectionRequest.findFirst({
    where: { athleteUserId, professionnelId: proId, status: "accepted" },
  });
  if (!connection) {
    return {
      granted: false,
      response: NextResponse.json({ error: "Non connecté à ce professionnel" }, { status: 403 }),
    };
  }

  // Resolve athlete fiche
  const athlete = await (prisma as any).athlete.findFirst({
    where: {
      professionnelId: proId,
      contactEmail: { equals: athleteUser.email, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (!athlete) {
    return {
      granted: false,
      response: NextResponse.json({ error: "Fiche athlète introuvable" }, { status: 404 }),
    };
  }

  return { granted: true, athleteId: athlete.id };
}
