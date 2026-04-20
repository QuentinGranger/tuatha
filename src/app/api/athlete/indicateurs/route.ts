import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/indicateurs?proId=xxx&days=30&tags=Renfo,Cardio&status=realisee,planifiee
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-indicateurs:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const sp = request.nextUrl.searchParams;
    const proId = sp.get("proId");
    const days = parseInt(sp.get("days") || "30");
    const tagsFilter = sp.get("tags")?.split(",").filter(Boolean) || [];
    const statusFilter = sp.get("status")?.split(",").filter(Boolean) || [];

    // 1. Get athlete user email
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // 2. Find Athlete records via contactEmail
    const athleteWhere: Record<string, unknown> = {
      contactEmail: { equals: athleteUser.email, mode: "insensitive" },
    };

    if (proId) {
      // Verify accepted connection
      const connection = await prisma.connectionRequest.findFirst({
        where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
      });
      if (!connection) {
        return NextResponse.json({ error: "Non connecté à ce professionnel" }, { status: 403 });
      }
      athleteWhere.professionnelId = proId;
    } else {
      // All accepted connections
      const connections = await prisma.connectionRequest.findMany({
        where: { athleteUserId: session.id, status: "accepted" },
        select: { professionnelId: true },
      });
      const connectedProIds = connections.map((c) => c.professionnelId);
      if (connectedProIds.length === 0) {
        return NextResponse.json(emptyResponse());
      }
      athleteWhere.professionnelId = { in: connectedProIds };
    }

    const athletes = await prisma.athlete.findMany({
      where: athleteWhere,
      select: { id: true, professionnelId: true },
    });

    const athleteIds = athletes.map((a) => a.id);
    if (athleteIds.length === 0) {
      return NextResponse.json(emptyResponse());
    }

    // Build athleteId -> professionnelId map
    const athleteProMap = new Map<string, string>();
    for (const a of athletes) {
      athleteProMap.set(a.id, a.professionnelId);
    }

    // Fetch pro names
    const proIds = [...new Set(athletes.map((a) => a.professionnelId))];
    const pros = await prisma.professionnel.findMany({
      where: { id: { in: proIds } },
      select: { id: true, nom: true, prenom: true, specialite: true },
    });
    const proMap = new Map(pros.map((p) => [p.id, p]));

    // 3. Fetch sessions: visible, not deleted, not draft
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

    const baseWhere: Record<string, unknown> = {
      athleteId: { in: athleteIds },
      visibleAthlete: true,
      deletedAt: null,
      status: { not: "brouillon" },
    };

    const sessionWhere: Record<string, unknown> = {
      ...baseWhere,
      date: { gte: periodStart, lte: now },
    };
    if (statusFilter.length) sessionWhere.status = { in: statusFilter };

    const sessions = await (prisma as any).session.findMany({
      where: sessionWhere,
      include: {
        blocks: { include: { exercises: true } },
      },
      orderBy: { date: "asc" },
    });

    // Previous period for comparison
    const prevSessions = await (prisma as any).session.findMany({
      where: {
        ...baseWhere,
        date: { gte: prevPeriodStart, lt: periodStart },
      },
    });

    // Filter by tags
    const filtered = tagsFilter.length
      ? sessions.filter((s: any) => s.tags?.some((t: string) => tagsFilter.includes(t)))
      : sessions;

    const prevFiltered = tagsFilter.length
      ? prevSessions.filter((s: any) => s.tags?.some((t: string) => tagsFilter.includes(t)))
      : prevSessions;

    // ─── KPI Computations ───
    const planned = filtered.filter((s: any) => ["planifiee", "en_cours", "realisee", "annulee"].includes(s.status));
    const realized = filtered.filter((s: any) => s.status === "realisee");
    const cancelled = filtered.filter((s: any) => s.status === "annulee");

    const prevPlanned = prevFiltered.filter((s: any) => ["planifiee", "en_cours", "realisee", "annulee"].includes(s.status));
    const prevRealized = prevFiltered.filter((s: any) => s.status === "realisee");

    // Adherence
    const adherence = planned.length > 0 ? Math.round((realized.length / planned.length) * 100) : null;
    const prevAdherence = prevPlanned.length > 0 ? Math.round((prevRealized.length / prevPlanned.length) * 100) : null;
    const adherenceDelta = adherence !== null && prevAdherence !== null ? adherence - prevAdherence : null;

    // Volume
    const totalExercises = filtered.reduce((acc: number, s: any) =>
      acc + s.blocks.reduce((a: number, b: any) => a + b.exercises.length, 0), 0);
    const totalSessions = filtered.length;

    // Intensity: average RPE
    const rpesRessenti = realized.filter((s: any) => s.rpeRessenti !== null).map((s: any) => s.rpeRessenti);
    const avgRpe = rpesRessenti.length
      ? Math.round((rpesRessenti.reduce((a: number, b: number) => a + b, 0) / rpesRessenti.length) * 10) / 10
      : null;

    const prevRpes = prevRealized.filter((s: any) => s.rpeRessenti !== null).map((s: any) => s.rpeRessenti);
    const prevAvgRpe = prevRpes.length
      ? Math.round((prevRpes.reduce((a: number, b: number) => a + b, 0) / prevRpes.length) * 10) / 10
      : null;

    // Risk: average pain
    const pains = realized.filter((s: any) => s.douleur !== null).map((s: any) => s.douleur);
    const avgPain = pains.length
      ? Math.round((pains.reduce((a: number, b: number) => a + b, 0) / pains.length) * 10) / 10
      : null;

    // Pain zones frequency
    const painZones: Record<string, number> = {};
    realized.forEach((s: any) => {
      if (s.douleurZone) {
        painZones[s.douleurZone] = (painZones[s.douleurZone] || 0) + 1;
      }
    });
    const topPainZone = Object.entries(painZones).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Risk level
    let riskLevel: "ok" | "watch" | "alert" = "ok";
    if (avgPain !== null && avgPain > 3) riskLevel = "alert";
    else if (avgPain !== null && avgPain > 1.5) riskLevel = "watch";
    else if (cancelled.length >= 2) riskLevel = "watch";

    // ─── Daily breakdown for chart ───
    const dailyMap: Record<string, { planned: number; realized: number; rpe: number[]; pain: number[] }> = {};
    for (let d = new Date(periodStart); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { planned: 0, realized: 0, rpe: [], pain: [] };
    }
    filtered.forEach((s: any) => {
      const key = new Date(s.date).toISOString().slice(0, 10);
      if (!dailyMap[key]) dailyMap[key] = { planned: 0, realized: 0, rpe: [], pain: [] };
      if (["planifiee", "en_cours", "realisee", "annulee"].includes(s.status)) dailyMap[key].planned++;
      if (s.status === "realisee") {
        dailyMap[key].realized++;
        if (s.rpeRessenti !== null) dailyMap[key].rpe.push(s.rpeRessenti);
        if (s.douleur !== null) dailyMap[key].pain.push(s.douleur);
      }
    });

    const daily = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        planned: v.planned,
        realized: v.realized,
        avgRpe: v.rpe.length ? Math.round((v.rpe.reduce((a, b) => a + b, 0) / v.rpe.length) * 10) / 10 : null,
        avgPain: v.pain.length ? Math.round((v.pain.reduce((a, b) => a + b, 0) / v.pain.length) * 10) / 10 : null,
      }));

    // ─── Alerts (wording athlète) ───
    const alerts: { level: "red" | "orange" | "yellow"; message: string }[] = [];

    const highPainSessions = realized.filter((s: any) => s.douleur !== null && s.douleur > 3);
    if (highPainSessions.length >= 2) {
      alerts.push({ level: "red", message: `Votre douleur est > 3/10 sur ${highPainSessions.length} séances — pensez à en parler à votre coach` });
    }

    const notRealized = filtered.filter((s: any) => s.status === "planifiee" && new Date(s.date) < now);
    if (notRealized.length >= 2) {
      alerts.push({ level: "orange", message: `${notRealized.length} séances planifiées non réalisées` });
    }

    const sessionsWithRpeMismatch = realized.filter((s: any) => {
      if (!s.rpeCible || s.rpeRessenti === null) return false;
      const targetMax = parseInt(s.rpeCible.split(/[-–]/)[1] || s.rpeCible);
      return s.rpeRessenti > targetMax + 1;
    });
    if (sessionsWithRpeMismatch.length > 0) {
      alerts.push({ level: "yellow", message: `Votre RPE ressenti dépasse l'objectif sur ${sessionsWithRpeMismatch.length} séance(s)` });
    }

    const mid = new Date((periodStart.getTime() + now.getTime()) / 2);
    const firstHalf = filtered.filter((s: any) => new Date(s.date) < mid).length;
    const secondHalf = filtered.filter((s: any) => new Date(s.date) >= mid).length;
    if (firstHalf > 0 && secondHalf > firstHalf * 1.3) {
      alerts.push({ level: "yellow", message: `Volume en hausse rapide (+${Math.round(((secondHalf - firstHalf) / firstHalf) * 100)}%)` });
    }

    // ─── Recent feedback ───
    const recentFeedback = realized
      .filter((s: any) => s.feedbackAthlete)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((s: any) => {
        const pro = proMap.get(athleteProMap.get(s.athleteId) || "");
        return {
          id: s.id,
          name: s.name,
          date: s.date,
          feedback: s.feedbackAthlete,
          rpe: s.rpeRessenti,
          pain: s.douleur,
          painZone: s.douleurZone,
          proName: pro ? `${pro.prenom} ${pro.nom}` : null,
        };
      });

    // ─── Sessions list (for drill-down) ───
    const sessionsList = filtered.map((s: any) => {
      const pro = proMap.get(athleteProMap.get(s.athleteId) || "");
      return {
        id: s.id,
        name: s.name,
        date: s.date,
        status: s.status,
        rpeRessenti: s.rpeRessenti,
        douleur: s.douleur,
        tags: s.tags || [],
        exerciseCount: s.blocks.reduce((a: number, b: any) => a + b.exercises.length, 0),
        proName: pro ? `${pro.prenom} ${pro.nom}` : null,
      };
    });

    return NextResponse.json({
      kpi: {
        adherence,
        adherenceDelta,
        plannedCount: planned.length,
        realizedCount: realized.length,
        cancelledCount: cancelled.length,
        totalSessions,
        totalExercises,
        avgRpe,
        prevAvgRpe,
        avgPain,
        topPainZone,
        riskLevel,
      },
      daily,
      alerts,
      recentFeedback,
      sessions: sessionsList,
    });
  } catch (error) {
    console.error("[athlete/indicateurs] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** Empty response when no athletes/connections found */
function emptyResponse() {
  return {
    kpi: {
      adherence: null, adherenceDelta: null,
      plannedCount: 0, realizedCount: 0, cancelledCount: 0,
      totalSessions: 0, totalExercises: 0,
      avgRpe: null, prevAvgRpe: null,
      avgPain: null, topPainZone: null,
      riskLevel: "ok",
    },
    daily: [],
    alerts: [],
    recentFeedback: [],
    sessions: [],
  };
}
