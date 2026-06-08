import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GET: List shares/consents with KPIs ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shareId = searchParams.get("id");

  // ── Single share detail ──
  if (shareId) {
    // Try ConnectionRequest first (athlete↔pro sharing)
    const cr = await (prisma as any).connectionRequest.findUnique({
      where: { id: shareId },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, email: true } },
        professionnel: { select: { id: true, prenom: true, nom: true, email: true, specialite: true } },
      },
    });
    if (!cr) return NextResponse.json({ error: "Partage introuvable." }, { status: 404 });

    // Find the Athlete record linked to this pro + athleteUser
    const athlete = await (prisma as any).athlete.findFirst({
      where: { professionnelId: cr.professionnelId, athleteUserId: cr.athleteUserId },
      select: {
        id: true, name: true, sport: true, contactEmail: true,
        consentement: true, consentementDate: true,
        consentementPartage: true, consentementPartageDate: true,
      },
    });

    // Fallback: find by professionnelId + name match
    const athleteFallback = athlete ?? await (prisma as any).athlete.findFirst({
      where: { professionnelId: cr.professionnelId },
      select: {
        id: true, name: true, sport: true, contactEmail: true,
        consentement: true, consentementDate: true,
        consentementPartage: true, consentementPartageDate: true,
      },
    });

    // Get consent logs for this athlete (if we found one)
    const consentLogs = athleteFallback?.id
      ? await (prisma as any).consentLog.findMany({
          where: { athleteId: athleteFallback.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, consentType: true, action: true, method: true, purpose: true, createdAt: true, newValue: true },
        })
      : [];

    // Get AthleteConsent records
    const athleteConsents = cr.athleteUserId
      ? await (prisma as any).athleteConsent.findMany({
          where: { athleteUserId: cr.athleteUserId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, consentType: true, action: true, granted: true, documentVersion: true, method: true, createdAt: true },
        })
      : [];

    return NextResponse.json({
      ...cr,
      athlete: athleteFallback,
      consentLogs,
      athleteConsents,
    });
  }

  // ── List view with KPIs ──
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);

  // Fetch all ConnectionRequest (athlete↔pro links = real shares)
  const connectionRequests = await (prisma as any).connectionRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      athleteUser: { select: { id: true, prenom: true, nom: true, email: true } },
      professionnel: { select: { id: true, prenom: true, nom: true, email: true, specialite: true } },
    },
  });

  // For each ConnectionRequest, find the Athlete record with consent info
  const athleteRecords = await (prisma as any).athlete.findMany({
    where: { professionnelId: { in: connectionRequests.map((c: any) => c.professionnelId) } },
    select: {
      id: true, name: true, professionnelId: true, athleteUserId: true,
      consentement: true, consentementDate: true,
      consentementPartage: true, consentementPartageDate: true,
    },
  });

  // Map athlete records by professionnelId for quick lookup
  const athleteByPro = new Map<string, any>();
  for (const a of athleteRecords) {
    athleteByPro.set(`${a.professionnelId}:${a.athleteUserId ?? ""}`, a);
    if (!athleteByPro.has(a.professionnelId)) athleteByPro.set(a.professionnelId, a);
  }

  // Build share list
  const shares = connectionRequests.map((cr: any) => {
    const ath = athleteByPro.get(`${cr.professionnelId}:${cr.athleteUserId}`) ?? athleteByPro.get(cr.professionnelId);
    return {
      id: cr.id,
      status: cr.status, // "pending" | "accepted" | "rejected"
      requestedBy: cr.requestedBy,
      createdAt: cr.createdAt,
      respondedAt: cr.respondedAt,
      athleteUser: cr.athleteUser,
      professionnel: cr.professionnel,
      athlete: ath ?? null,
      consentement: ath?.consentement ?? false,
      consentementPartage: ath?.consentementPartage ?? false,
      consentementDate: ath?.consentementDate ?? null,
    };
  });

  // KPIs
  const active = shares.filter((s: any) => s.status === "accepted").length;
  const rejected = shares.filter((s: any) => s.status === "rejected").length;
  const pending = shares.filter((s: any) => s.status === "pending").length;

  // Count health/marketing consents from AthleteConsent table
  const [healthConsents, marketingConsents, revokedConsents, revokedLogs, revokedConnections] = await Promise.all([
    (prisma as any).athleteConsent.count({ where: { consentType: "health_data", granted: true } }).catch(() => 0),
    (prisma as any).athleteConsent.count({ where: { consentType: "marketing", granted: true } }).catch(() => 0),
    (prisma as any).athleteConsent.count({ where: { action: "revoked", createdAt: { gte: yesterday } } }).catch(() => 0),
    (prisma as any).consentLog.count({ where: { action: "revoked", createdAt: { gte: yesterday } } }).catch(() => 0),
    (prisma as any).connectionRequest.count({ where: { status: "rejected", respondedAt: { gte: yesterday } } }).catch(() => 0),
  ]);
  const recentRevocations = revokedConsents + revokedLogs + revokedConnections;

  // Health consents from Athlete table (consentement = health data consent)
  const healthFromAthletes = athleteRecords.filter((a: any) => a.consentement === true).length;

  return NextResponse.json({
    shares,
    kpis: {
      active,
      rejected,
      pending,
      healthConsents: healthConsents + healthFromAthletes,
      marketingConsents,
      recentRevocations,
    },
  });
}

// ─── POST: Actions on shares ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "suspend_share": {
        const { shareId } = body;
        if (!shareId) return NextResponse.json({ error: "shareId requis." }, { status: 400 });
        await (prisma as any).connectionRequest.update({
          where: { id: shareId },
          data: { status: "pending" },
        });
        return NextResponse.json({ success: true, message: "Partage suspendu (mis en attente)." });
      }

      case "revoke_share": {
        const { shareId, reason } = body;
        if (!shareId) return NextResponse.json({ error: "shareId requis." }, { status: 400 });
        const cr = await (prisma as any).connectionRequest.findUnique({
          where: { id: shareId },
          select: { athleteUserId: true, professionnelId: true },
        });
        await (prisma as any).connectionRequest.update({
          where: { id: shareId },
          data: { status: "rejected" },
        });
        // Try to log the revocation in ConsentLog
        if (cr) {
          const ath = await (prisma as any).athlete.findFirst({
            where: { professionnelId: cr.professionnelId },
            select: { id: true },
          });
          if (ath) {
            try {
              await (prisma as any).consentLog.create({
                data: {
                  consentType: "partage",
                  action: "revoked",
                  newValue: false,
                  previousValue: true,
                  method: "digital",
                  purpose: reason ?? "Révocation admin sur demande vérifiée de l'athlète",
                  athleteId: ath.id,
                  actorProId: cr.professionnelId,
                },
              });
            } catch { /* ConsentLog creation optional */ }
          }
        }
        return NextResponse.json({ success: true, message: "Partage révoqué." });
      }

      case "reactivate_share": {
        const { shareId } = body;
        if (!shareId) return NextResponse.json({ error: "shareId requis." }, { status: 400 });
        await (prisma as any).connectionRequest.update({
          where: { id: shareId },
          data: { status: "accepted" },
        });
        return NextResponse.json({ success: true, message: "Partage réactivé." });
      }

      default:
        return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[ADMIN-CONSENTS]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
