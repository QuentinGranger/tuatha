import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";

// Mask email: m****@gmail.com
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local[0]}****@${domain}`;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const athleteId = searchParams.get("id");

  // ── Detail view for one athlete ──
  if (athleteId) {
    try {
      // Try Athlete model first (pro-created records)
      const athlete = await (prisma as any).athlete.findUnique({
        where: { id: athleteId },
        select: {
          id: true, name: true, contactEmail: true, contactPhone: true,
          status: true, riskLevel: true, sport: true,
          consentement: true, consentementDate: true,
          consentementPartage: true, consentementPartageDate: true,
          lastContactAt: true, createdAt: true, updatedAt: true,
          athleteUserId: true,
          professionnel: {
            select: { id: true, prenom: true, nom: true, specialite: true },
          },
          athleteUser: {
            select: {
              id: true, email: true, emailVerified: true,
              twoFactorEnabled: true, accountStatus: true,
              acceptedCguAt: true, acceptedPrivacyAt: true,
              acceptedHealthCharterAt: true,
              consentMarketing: true, consentMarketingAt: true,
              consentAI: true, consentAIAt: true,
              authSessions: {
                orderBy: { lastActiveAt: "desc" },
                take: 10,
                select: {
                  id: true, ip: true, deviceName: true, userAgent: true,
                  lastActiveAt: true, createdAt: true, revoked: true, expiresAt: true,
                },
              },
              accessLogs: {
                orderBy: { createdAt: "desc" },
                take: 20,
                select: { id: true, action: true, ip: true, createdAt: true },
              },
              payments: {
                orderBy: { createdAt: "desc" },
                take: 10,
                select: { id: true, amount: true, currency: true, status: true, createdAt: true },
              },
              invoices: {
                orderBy: { createdAt: "desc" },
                take: 10,
                select: { id: true, amount: true, status: true, createdAt: true, dueDate: true },
              },
            },
          },
          sharedDocs: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, originalName: true, category: true, createdAt: true, deletedAt: true },
          },
          consentLogs: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, action: true, createdAt: true },
          },
          proConnections: {
            select: {
              id: true, status: true, role: true,
              connectedPro: { select: { id: true, prenom: true, nom: true, specialite: true } },
            },
          },
        },
      });

      if (athlete) {
        // Build response from Athlete record
        const user = athlete.athleteUser;
        const allPros = [
          { id: `owner-${athlete.professionnel.id}`, professionnel: athlete.professionnel, status: "active", role: "Créateur" },
          ...(athlete.proConnections ?? []).map((pc: any) => ({
            id: pc.id,
            professionnel: pc.connectedPro,
            status: pc.status,
            role: pc.role || "Connexion",
          })),
        ];

        const tickets = await prisma.$queryRaw`
          SELECT id, subject, status, priority, "createdAt", "assignedToId" as "assignedTo"
          FROM "SupportTicket"
          WHERE "createdById" = ${athlete.athleteUserId ?? athleteId} AND "createdByRole" = 'athlete'
          ORDER BY "createdAt" DESC LIMIT 20
        `;

        return NextResponse.json({
          id: athlete.id,
          athleteUserId: athlete.athleteUserId,
          nom: athlete.name.split(" ").slice(-1)[0],
          prenom: athlete.name.split(" ")[0],
          email: user ? maskEmail(user.email) : (athlete.contactEmail ? maskEmail(athlete.contactEmail) : "—"),
          emailVerified: user?.emailVerified ?? false,
          twoFactorEnabled: user?.twoFactorEnabled ?? false,
          accountStatus: user?.accountStatus ?? "active",
          createdAt: athlete.createdAt,
          updatedAt: athlete.updatedAt,
          sport: athlete.sport,
          acceptedCguAt: user?.acceptedCguAt ?? null,
          acceptedPrivacyAt: user?.acceptedPrivacyAt ?? null,
          acceptedHealthCharterAt: user?.acceptedHealthCharterAt ?? null,
          consentMarketing: user?.consentMarketing ?? false,
          consentMarketingAt: user?.consentMarketingAt ?? null,
          consentAI: user?.consentAI ?? false,
          consentAIAt: user?.consentAIAt ?? null,
          consentement: athlete.consentement,
          consentementDate: athlete.consentementDate,
          consentementPartage: athlete.consentementPartage,
          consentementPartageDate: athlete.consentementPartageDate,
          authSessions: user?.authSessions ?? [],
          accessLogs: user?.accessLogs ?? [],
          athletes: allPros,
          athleteDocsSent: (athlete.sharedDocs ?? []).map((d: any) => ({
            id: d.id,
            documentType: d.category ?? d.originalName ?? "Document",
            createdAt: d.createdAt,
            deletedAt: d.deletedAt,
          })),
          athleteConsents: (athlete.consentLogs ?? []).map((c: any) => ({
            id: c.id,
            type: c.action,
            granted: c.action?.includes("accept") || c.action?.includes("granted"),
            createdAt: c.createdAt,
          })),
          payments: user?.payments ?? [],
          invoices: user?.invoices ?? [],
          tickets,
          hasAccount: !!athlete.athleteUserId,
        });
      }

      // Fall back to AthleteUser (standalone account)
      const userOnly = await (prisma as any).athleteUser.findUnique({
        where: { id: athleteId },
        select: {
          id: true, nom: true, prenom: true, email: true,
          emailVerified: true, createdAt: true, updatedAt: true,
          twoFactorEnabled: true, sport: true, accountStatus: true,
          acceptedCguAt: true, acceptedPrivacyAt: true,
          acceptedHealthCharterAt: true,
          consentMarketing: true, consentMarketingAt: true,
          consentAI: true, consentAIAt: true,
          authSessions: {
            orderBy: { lastActiveAt: "desc" },
            take: 10,
            select: {
              id: true, ip: true, deviceName: true, userAgent: true,
              lastActiveAt: true, createdAt: true, revoked: true, expiresAt: true,
            },
          },
          athletes: {
            select: {
              id: true,
              professionnel: { select: { id: true, prenom: true, nom: true, specialite: true } },
              status: true, riskLevel: true,
            },
          },
          athleteDocsSent: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, category: true, originalName: true, createdAt: true, deletedAt: true },
          },
          athleteConsents: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, consentType: true, granted: true, createdAt: true },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, amount: true, currency: true, status: true, createdAt: true },
          },
          invoices: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, amount: true, status: true, createdAt: true, dueDate: true },
          },
          accessLogs: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, action: true, ip: true, createdAt: true },
          },
        },
      });

      if (!userOnly) return NextResponse.json({ error: "Athlète introuvable." }, { status: 404 });

      const tickets = await prisma.$queryRaw`
        SELECT id, subject, status, priority, "createdAt", "assignedToId" as "assignedTo"
        FROM "SupportTicket"
        WHERE "createdById" = ${athleteId} AND "createdByRole" = 'athlete'
        ORDER BY "createdAt" DESC LIMIT 20
      `;

      return NextResponse.json({
        ...userOnly,
        athleteUserId: userOnly.id,
        email: maskEmail(userOnly.email),
        tickets,
        hasAccount: true,
      });
    } catch (error) {
      console.error("[ADMIN-ATHLETES-DETAIL]", error);
      return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
  }

  // ── List view ──
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch all Athlete records (pro-created) with their linked pro and optional user account
    const [allAthletes, totalUsers, unverifiedUsers, failedPayments, riskHigh, openTicketsCount, deletionRequests, exportRequests, failedPaymentUsers] = await Promise.all([
      (prisma as any).athlete.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true, name: true, contactEmail: true,
          status: true, riskLevel: true, lastContactAt: true,
          consentement: true, consentementPartage: true,
          createdAt: true,
          athleteUserId: true,
          professionnel: {
            select: { id: true, prenom: true, nom: true, specialite: true },
          },
          athleteUser: {
            select: {
              id: true, email: true, emailVerified: true, accountStatus: true,
              authSessions: { orderBy: { lastActiveAt: "desc" }, take: 1, select: { lastActiveAt: true } },
            },
          },
          sharedDocs: { select: { id: true } },
          proConnections: { select: { id: true, status: true } },
        },
      }),
      (prisma as any).athleteUser.count(),
      (prisma as any).athleteUser.count({ where: { emailVerified: false } }),
      (prisma as any).payment.count({ where: { status: "payment_failed" } }),
      (prisma as any).athlete.count({ where: { riskLevel: { in: ["HIGH", "CRITICAL"] }, deletedAt: null } }).catch(() => 0),
      (prisma as any).supportTicket.count({ where: { status: { in: ["open", "in_progress"] }, createdByRole: "athlete" } }),
      (prisma as any).athleteUser.count({ where: { accountStatus: "deleted" } }),
      (prisma as any).athleteUser.count({ where: { accountStatus: { in: ["export_requested", "deletion_requested"] } } }).catch(() => 0),
      // Get athlete user IDs with failed payments for per-athlete flag
      (prisma as any).payment.findMany({
        where: { status: "payment_failed" },
        select: { athleteUserId: true },
        distinct: ["athleteUserId"],
      }).then((ps: any[]) => new Set(ps.map((p: any) => p.athleteUserId).filter(Boolean))).catch(() => new Set()),
    ]);

    // Also get AthleteUser records that are NOT linked to any Athlete (standalone accounts)
    const standaloneUsers = await (prisma as any).athleteUser.findMany({
      where: {
        athletes: { none: {} },
      },
      select: {
        id: true, nom: true, prenom: true, email: true,
        emailVerified: true, createdAt: true,
        authSessions: { orderBy: { lastActiveAt: "desc" }, take: 1, select: { lastActiveAt: true } },
      },
    });

    // Support tickets count (raw)
    const ticketCounts: { createdById: string; c: number }[] = await prisma.$queryRaw`
      SELECT "createdById", COUNT(*)::int as c
      FROM "SupportTicket"
      WHERE status IN ('open','in_progress')
      GROUP BY "createdById"
    `;
    const ticketMap = new Map(ticketCounts.map((t) => [t.createdById, t.c]));

    // Build unified rows from Athlete model
    const rows: any[] = (allAthletes as any[]).map((a) => {
      const lastSession = a.athleteUser?.authSessions?.[0];
      const proCount = (a.proConnections?.filter((c: any) => c.status === "connecte").length ?? 0) + 1; // +1 for owner pro
      const riskLabel = a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL"
        ? "Élevé" : a.riskLevel === "MEDIUM" ? "Moyen" : "Normal";

      let statusKey = "Actif";
      if (a.status === "inactive" || a.status === "archived") statusKey = "Inactif";
      if (a.athleteUser && !a.athleteUser.emailVerified) statusKey = "Non vérifié";

      return {
        id: a.id,
        nom: a.name.split(" ").slice(-1)[0] || a.name,
        prenom: a.name.split(" ")[0] || "",
        email: a.athleteUser ? maskEmail(a.athleteUser.email) : (a.contactEmail ? maskEmail(a.contactEmail) : "—"),
        emailVerified: a.athleteUser?.emailVerified ?? false,
        createdAt: a.createdAt,
        lastLogin: lastSession?.lastActiveAt ?? a.lastContactAt ?? null,
        proCount,
        docCount: a.sharedDocs?.length ?? 0,
        consentCount: (a.consentement ? 1 : 0) + (a.consentementPartage ? 1 : 0),
        hasFailedPayment: a.athleteUserId ? (failedPaymentUsers as Set<string>).has(a.athleteUserId) : false,
        riskLevel: riskLabel,
        statusKey,
        openTickets: ticketMap.get(a.athleteUserId ?? a.id) ?? 0,
        proName: `${a.professionnel?.prenom ?? ""} ${a.professionnel?.nom ?? ""}`.trim(),
        proSpecialite: a.professionnel?.specialite ?? "",
        hasAccount: !!a.athleteUserId,
      };
    });

    // Add standalone AthleteUser accounts (no Athlete record linked)
    for (const u of standaloneUsers as any[]) {
      rows.push({
        id: u.id,
        nom: u.nom,
        prenom: u.prenom,
        email: maskEmail(u.email),
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        lastLogin: u.authSessions?.[0]?.lastActiveAt ?? null,
        proCount: 0,
        docCount: 0,
        consentCount: 0,
        hasFailedPayment: (failedPaymentUsers as Set<string>).has(u.id),
        riskLevel: "Normal",
        statusKey: u.emailVerified ? "Actif" : "Non vérifié",
        openTickets: ticketMap.get(u.id) ?? 0,
        proName: "—",
        proSpecialite: "",
        hasAccount: true,
      });
    }

    // Sort by createdAt desc
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = rows.length;
    const todayCount = rows.filter((r) => new Date(r.createdAt) >= todayStart).length;

    return NextResponse.json({
      stats: {
        total,
        todayCount,
        unverified: unverifiedUsers,
        failedPayments,
        openTickets: openTicketsCount,
        exportRequests,
        deletionRequests,
        riskHigh,
      },
      athletes: rows,
    });
  } catch (error) {
    console.error("[ADMIN-ATHLETES]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
