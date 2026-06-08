import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";

// Severity mapping based on alert type
function getSeverity(type: string): "critique" | "eleve" | "moyen" | "faible" {
  const critical = ["bruteforce", "mass_download", "idor_attempt", "login_blocked_repeated"];
  const high = ["suspicious_login", "unusual_admin_access", "suspicious_deletion", "password_changed"];
  const medium = ["unusual_pro_access", "unusual_export", "excessive_403", "new_country_login", "password_reset_requested"];
  if (critical.includes(type)) return "critique";
  if (high.includes(type)) return "eleve";
  if (medium.includes(type)) return "moyen";
  return "faible";
}

// Human-readable alert type labels
function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    suspicious_login: "Connexion suspecte",
    bruteforce: "Bruteforce",
    login_blocked: "Login bloqué",
    login_blocked_repeated: "Login bloqué (répété)",
    mass_download: "Téléchargement massif",
    unusual_pro_access: "Accès pro inhabituel",
    unusual_admin_access: "Accès admin inhabituel",
    idor_attempt: "Tentative IDOR",
    unusual_export: "Export inhabituel",
    suspicious_deletion: "Suppression suspecte",
    excessive_403: "Trop d'erreurs 403",
    new_country_login: "Nouveau pays connexion",
    password_reset_requested: "Reset mot de passe",
    password_changed: "Mot de passe modifié",
  };
  return map[type] || type;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const alertId = searchParams.get("id");

  try {
    // ── Detail view ──
    if (alertId) {
      const alert = await (prisma as any).securityAlert.findUnique({
        where: { id: alertId },
        select: {
          id: true, type: true, message: true, ip: true, userAgent: true,
          resolved: true, resolvedAt: true, resolvedBy: true,
          professionnelId: true, createdAt: true,
          professionnel: {
            select: { id: true, prenom: true, nom: true, email: true, specialite: true, accountStatus: true },
          },
        },
      });
      if (!alert) return NextResponse.json({ error: "Alerte introuvable." }, { status: 404 });

      // Get recent alerts from same pro (context)
      const relatedAlerts = await (prisma as any).securityAlert.findMany({
        where: { professionnelId: alert.professionnelId, id: { not: alertId } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, type: true, message: true, createdAt: true, resolved: true },
      });

      // Get recent sessions for this pro
      const recentSessions = await (prisma as any).authSession.findMany({
        where: { professionnelId: alert.professionnelId },
        orderBy: { lastActiveAt: "desc" },
        take: 5,
        select: { id: true, ip: true, deviceName: true, lastActiveAt: true, revoked: true },
      });

      return NextResponse.json({
        ...alert,
        severity: getSeverity(alert.type),
        typeLabel: getTypeLabel(alert.type),
        relatedAlerts: relatedAlerts.map((a: any) => ({
          ...a,
          severity: getSeverity(a.type),
          typeLabel: getTypeLabel(a.type),
        })),
        recentSessions,
      });
    }

    // ── List view ──
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [alerts, stats] = await Promise.all([
      (prisma as any).securityAlert.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true, type: true, message: true, ip: true,
          resolved: true, resolvedBy: true, resolvedAt: true, createdAt: true,
          professionnel: {
            select: { id: true, prenom: true, nom: true, specialite: true },
          },
        },
      }),
      Promise.all([
        // Alertes critiques (unresolved critical/high severity)
        (prisma as any).securityAlert.count({
          where: {
            resolved: false,
            type: { in: ["bruteforce", "mass_download", "idor_attempt", "login_blocked_repeated", "suspicious_login", "unusual_admin_access", "suspicious_deletion", "password_changed"] },
          },
        }),
        // Tentatives login échouées (24h)
        (prisma as any).securityAlert.count({
          where: {
            type: { in: ["login_blocked", "login_blocked_repeated", "bruteforce"] },
            createdAt: { gte: twentyFourHoursAgo },
          },
        }),
        // Comptes verrouillés (suspended pros + athletes)
        Promise.all([
          (prisma as any).professionnel.count({ where: { accountStatus: "suspended" } }),
          (prisma as any).athleteUser.count({ where: { accountStatus: "suspended" } }).catch(() => 0),
        ]).then(([a, b]) => a + b),
        // Accès refusés (403 errors in 24h)
        prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "ApiErrorLog" WHERE "statusCode" = 403 AND "createdAt" >= ${twentyFourHoursAgo}`.then((r: any) => r[0]?.c ?? 0).catch(() => 0),
        // Exports de données (24h)
        (prisma as any).athleteAccessLog.count({
          where: { action: "export_data", createdAt: { gte: twentyFourHoursAgo } },
        }).catch(() => 0),
        // Téléchargements massifs (alerts of that type, unresolved)
        (prisma as any).securityAlert.count({
          where: { type: "mass_download", resolved: false },
        }),
        // Actions admin sensibles (24h)
        (prisma as any).adminLog.count({
          where: { createdAt: { gte: twentyFourHoursAgo } },
        }).catch(() => 0),
        // Today's new critical alerts (for comparison)
        (prisma as any).securityAlert.count({
          where: {
            type: { in: ["bruteforce", "mass_download", "idor_attempt", "login_blocked_repeated", "suspicious_login", "unusual_admin_access", "suspicious_deletion", "password_changed"] },
            createdAt: { gte: twentyFourHoursAgo },
          },
        }),
        // Yesterday's critical alerts (same types, 24-48h ago)
        (prisma as any).securityAlert.count({
          where: {
            type: { in: ["bruteforce", "mass_download", "idor_attempt", "login_blocked_repeated", "suspicious_login", "unusual_admin_access", "suspicious_deletion", "password_changed"] },
            createdAt: { gte: yesterdayStart, lt: twentyFourHoursAgo },
          },
        }),
        (prisma as any).securityAlert.count({
          where: {
            type: { in: ["login_blocked", "login_blocked_repeated", "bruteforce"] },
            createdAt: { gte: yesterdayStart, lt: twentyFourHoursAgo },
          },
        }),
        // Total unresolved
        (prisma as any).securityAlert.count({ where: { resolved: false } }),
      ]),
    ]);

    const [criticalAlerts, failedLogins, lockedAccounts, accessDenied, dataExports, massDownloads, adminActions, todayCriticalNew, yesterdayCriticalNew, yesterdayLogins, totalUnresolved] = stats;

    // Enrich alerts with severity and label
    const enrichedAlerts = (alerts as any[]).map((a) => ({
      ...a,
      severity: getSeverity(a.type),
      typeLabel: getTypeLabel(a.type),
      userName: a.professionnel ? `${a.professionnel.prenom} ${a.professionnel.nom}` : "—",
      userRole: a.professionnel?.specialite ?? "—",
    }));

    return NextResponse.json({
      alerts: enrichedAlerts,
      stats: {
        criticalAlerts,
        failedLogins,
        lockedAccounts,
        accessDenied,
        dataExports,
        massDownloads,
        adminActions,
        totalUnresolved,
        // Change vs yesterday
        criticalChange: todayCriticalNew - (yesterdayCriticalNew || 0),
        loginsChange: failedLogins - (yesterdayLogins || 0),
      },
    });
  } catch (error) {
    console.error("[ADMIN-SECURITY]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

// ── Actions ──
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  try {
    const body = await req.json();
    const { action, alertId, proId, note } = body;

    switch (action) {
      case "resolve": {
        if (!alertId) return NextResponse.json({ error: "alertId requis." }, { status: 400 });
        await (prisma as any).securityAlert.update({
          where: { id: alertId },
          data: { resolved: true, resolvedAt: new Date(), resolvedBy: session.email },
        });
        return NextResponse.json({ success: true, message: "Alerte résolue." });
      }

      case "assign": {
        if (!alertId) return NextResponse.json({ error: "alertId requis." }, { status: 400 });
        await (prisma as any).securityAlert.update({
          where: { id: alertId },
          data: { resolvedBy: note || session.email },
        });
        return NextResponse.json({ success: true, message: "Alerte assignée." });
      }

      case "lock_account": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: { accountStatus: "suspended" },
        });
        // Revoke all sessions
        await (prisma as any).authSession.updateMany({
          where: { professionnelId: proId, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "security_lock" },
        });
        return NextResponse.json({ success: true, message: "Compte verrouillé. Sessions révoquées." });
      }

      case "unlock_account": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: { accountStatus: "active" },
        });
        // Log the unlock action
        await (prisma as any).securityAlert.create({
          data: {
            type: "unusual_admin_access",
            message: `Compte débloqué par l'administrateur.${note ? ` Raison: ${note}` : ""}`,
            professionnelId: proId,
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: session.email,
          },
        });
        return NextResponse.json({ success: true, message: "Compte réactivé (statut: actif)." });
      }

      case "disconnect_sessions": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        const result = await (prisma as any).authSession.updateMany({
          where: { professionnelId: proId, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "admin_security" },
        });
        return NextResponse.json({ success: true, message: `${result.count} session(s) déconnectée(s).` });
      }

      case "restrict_account": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: { accountStatus: "restricted" },
        });
        return NextResponse.json({ success: true, message: "Compte restreint. L'utilisateur a un accès limité." });
      }

      case "revoke_and_notify": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        // Revoke all sessions
        const revokeResult = await (prisma as any).authSession.updateMany({
          where: { professionnelId: proId, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "admin_security_review" },
        });
        // Create traceability alert
        await (prisma as any).securityAlert.create({
          data: {
            type: "unusual_admin_access",
            message: `Révocation administrative de ${revokeResult.count} session(s) et notification par l'admin.`,
            professionnelId: proId,
          },
        });
        return NextResponse.json({ success: true, message: `${revokeResult.count} session(s) révoquée(s). Alerte de traçabilité créée.` });
      }

      case "force_reset_password": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        // Revoke all sessions to force re-auth
        await (prisma as any).authSession.updateMany({
          where: { professionnelId: proId, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "forced_password_reset" },
        });
        // Create security alert
        await (prisma as any).securityAlert.create({
          data: {
            type: "password_reset_requested",
            message: "Reset de mot de passe forcé par l'administrateur.",
            professionnelId: proId,
          },
        });
        return NextResponse.json({ success: true, message: "Reset mot de passe forcé. Sessions révoquées." });
      }

      case "compliance_review": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: { accountStatus: "compliance_review" },
        });
        return NextResponse.json({ success: true, message: "Revue de conformité activée." });
      }

      case "open_incident": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        const investigation = await (prisma as any).investigation.create({
          data: {
            title: note ? `Incident sécurité: ${note}` : "Incident sécurité ouvert depuis le panneau sécurité",
            description: note ?? "Incident ouvert automatiquement suite à une alerte sécurité.",
            type: "security",
            severity: "critical",
            openedBy: session.email,
            assignedTo: session.email,
            professionnelId: proId,
            dpoNotifiedAt: new Date(),
            actionsTaken: ["incident_opened", "account_flagged"],
            userNotifiedAt: new Date(),
          },
        });
        return NextResponse.json({ success: true, message: "Incident ouvert.", investigationId: investigation.id });
      }

      default:
        return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[ADMIN-SECURITY-ACTION]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
