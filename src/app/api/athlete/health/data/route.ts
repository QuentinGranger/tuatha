import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

/**
 * GET /api/athlete/health/data?days=7&category=steps
 * Returns health data points for the authenticated athlete.
 * Query params:
 *   - days: number of past days to fetch (default 7, max 90)
 *   - category: optional filter (steps, heart_rate, sleep, calories, distance, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get("days")) || 7, 90);
    const category = searchParams.get("category") || undefined;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = {
      athleteUserId: session.id,
      date: { gte: startDate },
    };
    if (category) where.category = category;

    const dataPoints = await prisma.healthDataPoint.findMany({
      where,
      select: {
        id: true,
        category: true,
        value: true,
        unit: true,
        date: true,
        startTime: true,
        endTime: true,
        source: true,
        metadata: true,
        connection: {
          select: { provider: true },
        },
      },
      orderBy: { date: "desc" },
    });

    // Group by category for easier frontend consumption
    const grouped: Record<string, Array<{
      date: string;
      value: number;
      unit: string;
      provider: string;
      metadata?: unknown;
    }>> = {};

    for (const dp of dataPoints) {
      if (!grouped[dp.category]) grouped[dp.category] = [];
      grouped[dp.category].push({
        date: dp.date.toISOString(),
        value: dp.value,
        unit: dp.unit,
        provider: dp.connection.provider,
        metadata: dp.metadata || undefined,
      });
    }

    // Also compute latest values summary
    const latest: Record<string, { value: number; unit: string; date: string; provider: string }> = {};
    for (const [cat, points] of Object.entries(grouped)) {
      if (points.length > 0) {
        const newest = points[0]; // Already sorted desc
        latest[cat] = newest;
      }
    }

    return NextResponse.json({ data: grouped, latest, days });
  } catch (error) {
    console.error("GET /api/athlete/health/data error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
