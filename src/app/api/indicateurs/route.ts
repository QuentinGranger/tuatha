import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

// GET /api/indicateurs?athleteId=xxx&days=30&tags=Renfo,Cardio&status=realisee,planifiee&lieu=Salle
export const GET = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const sp = request.nextUrl.searchParams;
    const athleteId = sp.get("athleteId");
    const days = parseInt(sp.get("days") || "30");
    const tagsFilter = sp.get("tags")?.split(",").filter(Boolean) || [];
    const statusFilter = sp.get("status")?.split(",").filter(Boolean) || [];
    const lieuFilter = sp.get("lieu")?.split(",").filter(Boolean) || [];

    if (!athleteId) {
      return NextResponse.json({ error: "athleteId requis" }, { status: 400 });
    }

    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

    // Current period sessions
    const where: Record<string, unknown> = {
      professionnelId: pro.id,
      athleteId,
      date: { gte: periodStart, lte: now },
    };
    if (statusFilter.length) where.status = { in: statusFilter };
    if (lieuFilter.length) where.lieu = { in: lieuFilter };

    const sessions = await prisma.session.findMany({
      where,
      include: {
        blocks: { include: { exercises: true } },
      },
      orderBy: { date: "asc" },
    });

    // Previous period for comparison
    const prevSessions = await prisma.session.findMany({
      where: {
        professionnelId: pro.id,
        athleteId,
        date: { gte: prevPeriodStart, lt: periodStart },
      },
    });

    // Filter by tags client-side (Prisma array overlap)
    const filtered = tagsFilter.length
      ? sessions.filter((s) => s.tags.some((t) => tagsFilter.includes(t)))
      : sessions;

    const prevFiltered = tagsFilter.length
      ? prevSessions.filter((s) => s.tags.some((t) => tagsFilter.includes(t)))
      : prevSessions;

    // ─── KPI Computations ───
    const planned = filtered.filter((s) => ["planifiee", "en_cours", "realisee", "annulee"].includes(s.status));
    const realized = filtered.filter((s) => s.status === "realisee");
    const cancelled = filtered.filter((s) => s.status === "annulee");

    const prevPlanned = prevFiltered.filter((s) => ["planifiee", "en_cours", "realisee", "annulee"].includes(s.status));
    const prevRealized = prevFiltered.filter((s) => s.status === "realisee");

    // Adherence
    const adherence = planned.length > 0 ? Math.round((realized.length / planned.length) * 100) : null;
    const prevAdherence = prevPlanned.length > 0 ? Math.round((prevRealized.length / prevPlanned.length) * 100) : null;
    const adherenceDelta = adherence !== null && prevAdherence !== null ? adherence - prevAdherence : null;

    // Volume: count total exercises, total duration parsed
    const totalExercises = filtered.reduce((acc, s) => acc + s.blocks.reduce((a, b) => a + b.exercises.length, 0), 0);
    const totalSessions = filtered.length;
    const realizedSessions = realized.length;

    // Intensity: average RPE
    const rpesRessenti = realized.filter((s) => s.rpeRessenti !== null).map((s) => s.rpeRessenti!);
    const avgRpe = rpesRessenti.length ? Math.round((rpesRessenti.reduce((a, b) => a + b, 0) / rpesRessenti.length) * 10) / 10 : null;

    const prevRpes = prevRealized.filter((s) => s.rpeRessenti !== null).map((s) => s.rpeRessenti!);
    const prevAvgRpe = prevRpes.length ? Math.round((prevRpes.reduce((a, b) => a + b, 0) / prevRpes.length) * 10) / 10 : null;

    // Risk: average pain
    const pains = realized.filter((s) => s.douleur !== null).map((s) => s.douleur!);
    const avgPain = pains.length ? Math.round((pains.reduce((a, b) => a + b, 0) / pains.length) * 10) / 10 : null;

    // Pain zones frequency
    const painZones: Record<string, number> = {};
    realized.forEach((s) => {
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
    filtered.forEach((s) => {
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

    // ─── Alerts ───
    const alerts: { level: "red" | "orange" | "yellow"; message: string }[] = [];

    // Pain > 3 on 2+ sessions
    const highPainSessions = realized.filter((s) => s.douleur !== null && s.douleur > 3);
    if (highPainSessions.length >= 2) {
      alerts.push({ level: "red", message: `Douleur > 3/10 sur ${highPainSessions.length} séances` });
    }

    // 2+ planned not realized
    const notRealized = filtered.filter((s) => s.status === "planifiee" && new Date(s.date) < now);
    if (notRealized.length >= 2) {
      alerts.push({ level: "orange", message: `${notRealized.length} séances planifiées non réalisées` });
    }

    // RPE too high vs target
    const sessionsWithRpeMismatch = realized.filter((s) => {
      if (!s.rpeCible || s.rpeRessenti === null) return false;
      const targetMax = parseInt(s.rpeCible.split(/[-–]/)[1] || s.rpeCible);
      return s.rpeRessenti > targetMax + 1;
    });
    if (sessionsWithRpeMismatch.length > 0) {
      alerts.push({ level: "yellow", message: `RPE ressenti supérieur à l'objectif sur ${sessionsWithRpeMismatch.length} séance(s)` });
    }

    // Volume rapid increase (compare half-periods)
    const mid = new Date((periodStart.getTime() + now.getTime()) / 2);
    const firstHalf = filtered.filter((s) => new Date(s.date) < mid).length;
    const secondHalf = filtered.filter((s) => new Date(s.date) >= mid).length;
    if (firstHalf > 0 && secondHalf > firstHalf * 1.3) {
      alerts.push({ level: "yellow", message: `Volume en hausse rapide (+${Math.round(((secondHalf - firstHalf) / firstHalf) * 100)}%)` });
    }

    // ─── Recent feedback ───
    const recentFeedback = realized
      .filter((s) => s.feedbackAthlete)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3)
      .map((s) => ({
        id: s.id,
        name: s.name,
        date: s.date,
        feedback: s.feedbackAthlete,
        rpe: s.rpeRessenti,
        pain: s.douleur,
        painZone: s.douleurZone,
      }));

    // ─── Sessions list (for drill-down) ───
    const sessionsList = filtered.map((s) => ({
      id: s.id,
      name: s.name,
      date: s.date,
      status: s.status,
      rpeRessenti: s.rpeRessenti,
      douleur: s.douleur,
      tags: s.tags,
      exerciseCount: s.blocks.reduce((a, b) => a + b.exercises.length, 0),
    }));

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
    console.error("GET /api/indicateurs error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "indicateurs" });
