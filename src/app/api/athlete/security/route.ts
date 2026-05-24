// ─── Espace sécurité athlète ───
//
// GET /api/athlete/security
//
// Retourne toutes les données de sécurité visibles par l'athlète :
//   - Sessions actives (dernières connexions, appareils)
//   - Historique des professionnels connectés
//   - Historique des documents consultés (via access logs)
//   - Historique des consentements
//   - Historique des exports
//   - Intégrations externes (HealthApp connections)
//
// Filtrage par catégorie via ?filter=sessions|pros|documents|consents|exports|integrations

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const filter = request.nextUrl.searchParams.get("filter");

  try {
    const result: Record<string, unknown> = {};

    // ── 1. Sessions actives (dernières connexions + appareils) ──
    if (!filter || filter === "sessions") {
      const sessions = await prisma.authSession.findMany({
        where: { athleteUserId: session.id, revoked: false },
        orderBy: { lastActiveAt: "desc" },
        select: {
          id: true,
          deviceName: true,
          ip: true,
          userAgent: true,
          lastActiveAt: true,
          createdAt: true,
        },
      });

      const currentSessionId = (session as any).sessionId;
      result.sessions = sessions.map((s) => ({
        ...s,
        isCurrent: s.id === currentSessionId,
      }));

      // Recent login history (last 20, including revoked)
      const loginHistory = await prisma.authSession.findMany({
        where: { athleteUserId: session.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          deviceName: true,
          ip: true,
          revoked: true,
          revokedReason: true,
          createdAt: true,
          lastActiveAt: true,
        },
      });
      result.loginHistory = loginHistory;
    }

    // ── 2. Historique des professionnels connectés ──
    if (!filter || filter === "pros") {
      const connections = await prisma.connectionRequest.findMany({
        where: { athleteUserId: session.id },
        orderBy: { createdAt: "desc" },
        include: {
          professionnel: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              specialite: true,
            },
          },
        },
      });

      result.proConnections = connections.map((c) => ({
        id: c.id,
        status: c.status,
        requestedBy: c.requestedBy,
        createdAt: c.createdAt,
        respondedAt: c.respondedAt,
        professionnel: {
          id: c.professionnel.id,
          nom: c.professionnel.nom,
          prenom: c.professionnel.prenom,
          specialite: c.professionnel.specialite,
        },
      }));

      // Pro access logs (who accessed what)
      const proAccessLogs = await (prisma as any).proAccessLog.findMany({
        where: { athleteUserId: session.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          professionnelId: true,
          action: true,
          resource: true,
          blocked: true,
          createdAt: true,
        },
      });
      result.proAccessLogs = proAccessLogs;
    }

    // ── 3. Historique des documents consultés ──
    if (!filter || filter === "documents") {
      const documentLogs = await (prisma as any).athleteAccessLog.findMany({
        where: {
          athleteUserId: session.id,
          action: { in: ["view_documents", "delete_document"] },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          resource: true,
          createdAt: true,
        },
      });
      result.documentActivity = documentLogs;

      // Pro-side document access
      const proDocLogs = await (prisma as any).proAccessLog.findMany({
        where: {
          athleteUserId: session.id,
          resource: { startsWith: "document" },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          professionnelId: true,
          action: true,
          resource: true,
          createdAt: true,
        },
      });
      result.proDocumentAccess = proDocLogs;
    }

    // ── 4. Historique des consentements ──
    if (!filter || filter === "consents") {
      const consentHistory = await (prisma as any).athleteConsent.findMany({
        where: { athleteUserId: session.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          consentType: true,
          action: true,
          granted: true,
          documentVersion: true,
          method: true,
          createdAt: true,
        },
      });
      result.consentHistory = consentHistory;
    }

    // ── 5. Historique des exports ──
    if (!filter || filter === "exports") {
      const exportLogs = await (prisma as any).athleteAccessLog.findMany({
        where: {
          athleteUserId: session.id,
          action: "export_data",
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          ip: true,
          createdAt: true,
        },
      });
      result.exportHistory = exportLogs;
    }

    // ── 6. Intégrations externes (HealthApp connections) ──
    if (!filter || filter === "integrations") {
      const integrations = await (prisma as any).healthAppConnection.findMany({
        where: { athleteUserId: session.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          provider: true,
          status: true,
          lastSyncAt: true,
          lastSyncError: true,
          scopes: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      result.integrations = integrations;

      // Wearable connect/disconnect logs
      const wearableLogs = await (prisma as any).athleteAccessLog.findMany({
        where: {
          athleteUserId: session.id,
          action: { in: ["connect_wearable", "disconnect_wearable", "sync_health_data"] },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          resource: true,
          createdAt: true,
        },
      });
      result.integrationActivity = wearableLogs;
    }

    // ── 2FA status ──
    const mfaStatus = await (prisma as any).athleteUser.findUnique({
      where: { id: session.id },
      select: { twoFactorEnabled: true },
    });
    result.mfaEnabled = mfaStatus?.twoFactorEnabled ?? false;

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/athlete/security error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
