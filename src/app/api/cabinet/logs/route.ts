import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

// ─── GET /api/cabinet/logs — query persistent admin activity logs ───
// Admin-only: returns logs for a specific cabinet
// Query params: cabinetId (required), limit, offset, action, targetProId
export const GET = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;
    const url = new URL(request.url);
    const cabinetId = url.searchParams.get("cabinetId");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const actionFilter = url.searchParams.get("action");
    const targetProId = url.searchParams.get("targetProId");

    if (!cabinetId) {
      return NextResponse.json({ error: "cabinetId requis" }, { status: 400 });
    }

    // Verify caller is a member of this cabinet (any role can read logs)
    const membership = await (prisma as any).cabinetMember.findUnique({
      where: { cabinetId_proId: { cabinetId, proId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Vous n'êtes pas membre de ce cabinet" }, { status: 403 });
    }

    // Build where clause
    const where: Record<string, unknown> = { cabinetId };
    if (actionFilter) where.action = actionFilter;
    if (targetProId) where.targetProId = targetProId;

    const [logs, total] = await Promise.all([
      (prisma as any).adminLog.findMany({
        where,
        include: {
          actorPro: {
            select: { id: true, nom: true, prenom: true, specialite: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      (prisma as any).adminLog.count({ where }),
    ]);

    // Enrich with target pro info if targetProId is set
    const targetProIds = [...new Set(logs.filter((l: any) => l.targetProId).map((l: any) => l.targetProId))] as string[];
    let targetProsMap: Record<string, any> = {};
    if (targetProIds.length > 0) {
      const targetPros = await prisma.professionnel.findMany({
        where: { id: { in: targetProIds } },
        select: { id: true, nom: true, prenom: true, specialite: true },
      });
      targetProsMap = Object.fromEntries(targetPros.map((p) => [p.id, p]));
    }

    const enrichedLogs = logs.map((log: any) => ({
      id: log.id,
      action: log.action,
      actorPro: log.actorPro,
      targetPro: log.targetProId ? targetProsMap[log.targetProId] || { id: log.targetProId } : null,
      details: log.details,
      ip: membership.role === "admin" ? log.ip : undefined, // only admins see IPs
      createdAt: log.createdAt,
    }));

    return NextResponse.json({
      logs: enrichedLogs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /api/cabinet/logs error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "cabinet" });
