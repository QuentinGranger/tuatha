// ─── Conversation Access Control ───
//
// Verifies that two professionals share at least one active ProConnection
// before allowing them to exchange messages or view conversation threads.
//
// Rule: seules les personnes autorisées sur l'athlète voient le fil.
//
// Usage:
//   const check = await verifyConversationAccess(myProId, otherProId, athleteId?);
//   if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

import { prisma } from "@/lib/prisma";

export type ConversationAccessResult =
  | { allowed: true; sharedAthleteIds: string[] }
  | { allowed: false; reason: string };

/**
 * Verify that two professionals share at least one active connection (status = "connecte").
 *
 * @param proId1    - First professional's ID (the requesting user)
 * @param proId2    - Second professional's ID (the conversation partner)
 * @param athleteId - Optional: if provided, verifies connection exists for this specific athlete
 * @returns { allowed: true, sharedAthleteIds } or { allowed: false, reason }
 */
export async function verifyConversationAccess(
  proId1: string,
  proId2: string,
  athleteId?: string | null,
): Promise<ConversationAccessResult> {
  if (proId1 === proId2) {
    return { allowed: false, reason: "Impossible de converser avec soi-même." };
  }

  try {
    // Build the query: find active connections between these two pros
    const where: any = {
      status: "connecte",
      OR: [
        { ownerProId: proId1, connectedProId: proId2 },
        { ownerProId: proId2, connectedProId: proId1 },
      ],
    };

    // If a specific athlete is provided, restrict to that athlete
    if (athleteId) {
      where.athleteId = athleteId;
    }

    const connections = await (prisma as any).proConnection.findMany({
      where,
      select: { athleteId: true },
    });

    if (connections.length === 0) {
      if (athleteId) {
        return {
          allowed: false,
          reason: "Aucune connexion active avec ce professionnel pour cet athlète.",
        };
      }
      return {
        allowed: false,
        reason: "Aucune connexion active avec ce professionnel.",
      };
    }

    // Extract the list of shared athlete IDs
    const ids = connections.map((c: { athleteId: string }) => c.athleteId);
    const sharedAthleteIds: string[] = Array.from(new Set<string>(ids));

    return { allowed: true, sharedAthleteIds };
  } catch (error) {
    console.error("[ConversationAccess] Error:", error);
    return { allowed: false, reason: "Erreur de vérification d'accès." };
  }
}

/**
 * Get the set of pro IDs that the given pro has at least one active connection with.
 * Used to filter conversation listings to only show authorized conversations.
 */
export async function getConnectedProIds(proId: string): Promise<Set<string>> {
  try {
    const [asOwner, asConnected] = await Promise.all([
      (prisma as any).proConnection.findMany({
        where: { ownerProId: proId, status: "connecte" },
        select: { connectedProId: true },
      }),
      (prisma as any).proConnection.findMany({
        where: { connectedProId: proId, status: "connecte" },
        select: { ownerProId: true },
      }),
    ]);

    const ids = new Set<string>();
    for (const c of asOwner) ids.add(c.connectedProId);
    for (const c of asConnected) ids.add(c.ownerProId);
    return ids;
  } catch (error) {
    console.error("[ConversationAccess] getConnectedProIds error:", error);
    return new Set();
  }
}
