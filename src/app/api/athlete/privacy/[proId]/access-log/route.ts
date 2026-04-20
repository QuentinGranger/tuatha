import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/athlete/privacy/:proId/access-log?limit=50&before=ISO
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ proId: string }> },
) {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { proId } = await context.params;
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const before = searchParams.get("before");

    // Verify connection exists
    const conn = await (prisma as any).connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!conn) {
      return NextResponse.json({ error: "Connexion introuvable" }, { status: 404 });
    }

    const where: Record<string, unknown> = {
      athleteUserId: session.id,
      professionnelId: proId,
    };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const logs = await (prisma as any).proAccessLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      logs,
      hasMore: logs.length === limit,
    });
  } catch (error) {
    console.error("GET /api/athlete/privacy/:proId/access-log error:", error);
    return NextResponse.json(
      { error: "Erreur serveur", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
