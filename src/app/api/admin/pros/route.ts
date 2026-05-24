import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  try {
    // ── Detail view ──────────────────────────────────────────────────
    if (id) {
      const pro = await (prisma as any).professionnel.findUnique({
        where: { id },
        select: {
          id: true, nom: true, prenom: true, email: true, telephone: true,
          specialite: true, specialiteAffichee: true, professionAffichee: true,
          statutExercice: true, numeroVerification: true, adresseCabinet: true,
          avatarPath: true, accountStatus: true, verificationStatus: true,
          verifiedAt: true, verificationNote: true, createdAt: true, updatedAt: true,
          twoFactorEnabled: true, searchable: true,
          // Connections as pro (athletes linked)
          connectionsAsPro: {
            select: {
              id: true, status: true, role: true, createdAt: true, updatedAt: true,
              athlete: {
                select: {
                  id: true, name: true,
                  athleteUser: { select: { id: true, prenom: true, nom: true, email: true } },
                },
              },
            },
          },
          // Verification documents
          verificationDocs: {
            select: { id: true, type: true, label: true, status: true, note: true, aiVerified: true, aiConfidence: true, createdAt: true, updatedAt: true },
          },
          // Security alerts
          securityAlerts: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, type: true, message: true, resolved: true, createdAt: true, ip: true },
          },
          // Auth sessions
          authSessions: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, deviceName: true, ip: true, lastActiveAt: true, createdAt: true, revoked: true, expiresAt: true },
          },
          // Documents sent
          docsSent: {
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { id: true, originalName: true, mimeType: true, size: true, category: true, createdAt: true, readAt: true, deletedAt: true },
          },
        },
      });
      if (!pro) return NextResponse.json({ error: "Professionnel introuvable." }, { status: 404 });
      return NextResponse.json(pro);
    }

    // ── List view ────────────────────────────────────────────────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [pros, stats] = await Promise.all([
      (prisma as any).professionnel.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true, nom: true, prenom: true, email: true,
          specialite: true, professionAffichee: true,
          accountStatus: true, verificationStatus: true,
          verifiedAt: true, createdAt: true, updatedAt: true,
          _count: {
            select: {
              connectionsAsPro: true,
              securityAlerts: true,
              docsSent: true,
            },
          },
          authSessions: {
            where: { revoked: false },
            orderBy: { lastActiveAt: "desc" },
            take: 1,
            select: { lastActiveAt: true },
          },
        },
      }),
      Promise.all([
        (prisma as any).professionnel.count(),
        (prisma as any).professionnel.count({ where: { verificationStatus: "pending" } }),
        (prisma as any).professionnel.count({ where: { accountStatus: "suspended" } }),
        (prisma as any).securityAlert.count(),
        (prisma as any).professionnel.count({ where: { verificationStatus: "verified" } }),
        (prisma as any).professionnel.count({ where: { verificationStatus: "rejected" } }),
      ]),
    ]);

    const [total, pending, suspended, alerts, verified, rejected] = stats;

    return NextResponse.json({ pros, stats: { total, pending, suspended, alerts, verified, rejected } });
  } catch (error) {
    console.error("[ADMIN-PROS]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
