// ─── Admin Dashboard Stats ───
// GET /api/admin/stats — Aggregate platform metrics for Command Center
// No medical data exposed — only counts, statuses, and metadata.

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const results = await Promise.all([
      // Users
      (prisma as any).professionnel.count(),
      (prisma as any).athlete.count(),
      (prisma as any).athleteUser.count(),
      (prisma as any).professionnel.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      (prisma as any).athleteUser.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      (prisma as any).professionnel.count({ where: { createdAt: { gte: todayStart } } }),
      (prisma as any).athleteUser.count({ where: { createdAt: { gte: todayStart } } }),
      (prisma as any).professionnel.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
      (prisma as any).athleteUser.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),

      // Verification
      (prisma as any).professionnel.count({ where: { verifiedAt: { not: null } } }),
      (prisma as any).verificationDocument.count({ where: { status: "pending" } }),

      // Connections
      (prisma as any).proConnection.count(),
      (prisma as any).proConnection.count({ where: { status: "connecte" } }),

      // Messaging (count only, no content)
      (prisma as any).proMessage.count(),
      (prisma as any).proMessage.count({ where: { createdAt: { gte: sevenDaysAgo } } }),

      // Documents (count only)
      (prisma as any).sharedDocument.count(),
      (prisma as any).sharedDocument.count({ where: { createdAt: { gte: sevenDaysAgo } } }),

      // Billing
      (prisma as any).invoice.count(),
      (prisma as any).payment.count(),
      (prisma as any).payment.count({ where: { status: "paid" } }),
      (prisma as any).payment.count({ where: { status: "payment_failed" } }),
      (prisma as any).payment.aggregate({ _sum: { amount: true }, where: { status: "paid" } }),

      // Calendar
      (prisma as any).calendarEvent.count(),
      (prisma as any).calendarEvent.count({ where: { date: { gte: now } } }),

      // Sessions
      (prisma as any).authSession.count(),
      (prisma as any).authSession.count({ where: { expiresAt: { gte: now } } }),

      // Consents
      (prisma as any).athleteConsent.count(),

      // Security
      (prisma as any).securityAlert.count(),
      (prisma as any).securityAlert.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "SecurityAlert" WHERE resolved = false`.then((r: any) => r[0]?.c ?? 0),
      (prisma as any).athleteAccessLog.count(),

      // Admin logs
      (prisma as any).adminLog.count(),
      (prisma as any).adminLog.count({ where: { createdAt: { gte: todayStart } } }),

      // Deleted accounts (using Athlete model which has deletedAt)
      (prisma as any).athlete.count({ where: { deletedAt: { not: null } } }),

      // Support Tickets (raw SQL — new models not in generated client)
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "SupportTicket"`.then((r: any) => r[0]?.c ?? 0),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "SupportTicket" WHERE status IN ('open','in_progress')`.then((r: any) => r[0]?.c ?? 0),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "SupportTicket" WHERE status = 'blocked'`.then((r: any) => r[0]?.c ?? 0),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "SupportTicket" WHERE priority = 'urgent' AND status != 'resolved'`.then((r: any) => r[0]?.c ?? 0),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "SupportTicket" WHERE category = 'security'`.then((r: any) => r[0]?.c ?? 0),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "SupportTicket" WHERE category = 'payment'`.then((r: any) => r[0]?.c ?? 0),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "SupportTicket" WHERE category = 'pro'`.then((r: any) => r[0]?.c ?? 0),

      // Investigations (43-44)
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "Investigation" WHERE status IN ('open','in_progress','pending_info')`.then((r: any) => r[0]?.c ?? 0),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "Investigation"`.then((r: any) => r[0]?.c ?? 0),

      // API Errors (45-46)
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "ApiErrorLog" WHERE "createdAt" >= ${twentyFourHoursAgo}`.then((r: any) => r[0]?.c ?? 0).catch(() => 0),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "ApiErrorLog" WHERE "statusCode" = 403 AND "createdAt" >= ${twentyFourHoursAgo}`.then((r: any) => r[0]?.c ?? 0).catch(() => 0),

      // Request Performance (24h avg)
      prisma.$queryRaw`SELECT AVG(duration) as avg FROM "RequestLog" WHERE "createdAt" >= ${twentyFourHoursAgo}`.then((r: any) => ({ _avg: { duration: Number(r[0]?.avg) || 0 } })).catch(() => ({ _avg: { duration: 0 } })),

      // Backup status (last 24h)
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "BackupLog" WHERE "createdAt" >= ${twentyFourHoursAgo} AND status = 'success'`.then((r: any) => r[0]?.c ?? 0).catch(() => 0),

      // Email status (24h)
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "EmailLog" WHERE "createdAt" >= ${twentyFourHoursAgo}`.then((r: any) => r[0]?.c ?? 0).catch(() => 0),
      prisma.$queryRaw`SELECT COUNT(*)::int as c FROM "EmailLog" WHERE "createdAt" >= ${twentyFourHoursAgo} AND status IN ('bounced','failed')`.then((r: any) => r[0]?.c ?? 0).catch(() => 0),

      // Health checks (latest per service)
      prisma.$queryRaw`SELECT DISTINCT ON (service) service, status, "responseTime" FROM "HealthCheckLog" WHERE "checkedAt" >= ${twentyFourHoursAgo} ORDER BY service, "checkedAt" DESC`.then((r: any) => r || []).catch(() => []),
    ]) as any[];

    // Unpack all metrics from results array
    const [
      // Users (0-9)
      totalPros, totalAthletes, totalAthleteUsers, recentPros, recentAthletes,
      prosToday, athletesToday, prosYesterday, athletesYesterday,
      // Verification (10-11)
      verifiedPros, pendingVerification,
      // Connections (12-13)
      totalConnections, activeConnections,
      // Messaging (14-15)
      totalMessages, recentMessages,
      // Documents (16-17)
      totalDocuments, docsThisWeek,
      // Billing (18-22)
      totalInvoices, totalPayments, paidPayments, failedPayments, totalRevenue,
      // Calendar (23-24)
      totalEvents, upcomingEvents,
      // Sessions (25-26)
      totalSessions, activeSessions,
      // Consents (27)
      totalConsents,
      // Security (28-32)
      totalSecurityAlerts, recentSecurityAlerts, unresolvedAlerts, totalAccessLogs,
      // Admin logs (33-34)
      totalAdminLogs, adminLogsToday,
      // Deleted accounts (35)
      deletedAccounts,
      // Support Tickets (36-42)
      totalTickets, openTickets, blockedTickets, urgentTickets,
      securityTickets, paymentTickets, proTickets,
      // Investigations (43-44)
      activeInvestigations, totalInvestigations,
      // API Errors (45-46)
      apiErrors24h, errors403,
      // Performance (47)
      avgResponseTime,
      // Backup (48)
      backups24h,
      // Email (49-50)
      emails24h, failedEmails24h,
      // Health checks (51)
      healthChecks,
    ] = results;

    // Revenue in cents → euros
    const revenueEuros = ((totalRevenue?._sum?.amount ?? 0) / 100).toFixed(0);

    // Specialties breakdown
    const specialties = await (prisma as any).professionnel.groupBy({
      by: ["specialite"],
      _count: true,
    });

    // Recent activity (last 5 events from multiple tables)
    const [recentSignups, recentDocs, recentConsentsLog] = await Promise.all([
      (prisma as any).athleteUser.findMany({ take: 3, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      (prisma as any).sharedDocument.findMany({ take: 3, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      (prisma as any).consentLog.findMany({ take: 3, orderBy: { createdAt: "desc" }, select: { action: true, createdAt: true } }),
    ]);

    // Compute changes vs yesterday
    const athleteChange = (athletesToday || 0) - (athletesYesterday || 0);
    const prosChange = (prosToday || 0) - (prosYesterday || 0);

    // Build health status from checks
    const dbHealth = healthChecks?.find((h: any) => h.service === "database")?.status || "unknown";
    const stripeHealth = healthChecks?.find((h: any) => h.service === "stripe")?.status || "unknown";
    const emailHealth = healthChecks?.find((h: any) => h.service === "email")?.status || "unknown";
    const avgResponseMs = Math.round(avgResponseTime?._avg?.duration || 0);
    const backupStatus = backups24h > 0 ? "OK" : "Aucun";

    // Calculate growth metrics
    const activationRate = totalAthleteUsers > 0 ? Math.round((activeConnections / totalAthleteUsers) * 100) : 0;
    const docsRate = totalAthleteUsers > 0 ? Math.round((totalDocuments / totalAthleteUsers) * 100) : 0;

    return NextResponse.json({
      timestamp: now.toISOString(),
      users: {
        totalPros,
        totalAthletes,
        totalAthleteUsers,
        recentPros,
        recentAthletes,
        prosToday,
        athletesToday,
        athleteChange,
        prosChange,
        verifiedPros,
        unverifiedPros: totalPros - verifiedPros,
        pendingVerification,
      },
      connections: {
        total: totalConnections,
        active: activeConnections,
      },
      messaging: {
        totalMessages,
        recentMessages,
      },
      documents: {
        total: totalDocuments,
        thisWeek: docsThisWeek,
      },
      billing: {
        totalInvoices,
        totalPayments,
        paidPayments,
        failedPayments,
        revenueEuros,
      },
      calendar: {
        totalEvents,
        upcomingEvents,
      },
      sessions: {
        total: totalSessions,
        active: activeSessions,
      },
      consents: {
        total: totalConsents,
      },
      security: {
        totalAlerts: totalSecurityAlerts,
        recentAlerts: recentSecurityAlerts,
        unresolvedAlerts,
        totalAccessLogs,
        totalAdminLogs,
        adminLogsToday,
        deletedAccounts,
        apiErrors24h,
        errors403,
      },
      support: {
        totalTickets,
        openTickets,
        blockedTickets,
        urgentTickets,
        securityTickets,
        paymentTickets,
        proTickets,
        activeInvestigations,
        totalInvestigations,
      },
      health: {
        dbStatus: dbHealth,
        stripeStatus: stripeHealth,
        emailStatus: emailHealth,
        avgResponseTime: avgResponseMs,
        backupStatus,
        emails24h,
        failedEmails24h,
      },
      growth: {
        activationRate,
        docsRate,
      },
      specialties: specialties.map((s: any) => ({
        name: s.specialite,
        count: s._count,
      })),
      activity: {
        recentSignups: recentSignups.map((r: any) => ({ type: "inscription_athlete", at: r.createdAt })),
        recentDocs: recentDocs.map((r: any) => ({ type: "document_upload", at: r.createdAt })),
        recentConsents: recentConsentsLog.map((r: any) => ({ type: r.action, at: r.createdAt })),
      },
    });
  } catch (error) {
    console.error("[ADMIN-STATS] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
