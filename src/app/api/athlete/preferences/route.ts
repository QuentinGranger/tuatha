import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  DAY_MS, DAY_NAMES, MONTH_SEASONS,
  recencyWeight, parseDesc, bayesianConfidence, weightedTopN,
  detectRegularity, coeffOfVariation, detectTrend,
} from "@/lib/scoring";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const connections = await prisma.connectionRequest.findMany({
      where: { athleteUserId: session.id, status: "accepted" },
      select: { professionnelId: true },
    });
    if (connections.length === 0) return NextResponse.json({ preferences: null });

    const proIds = connections.map((c: any) => c.professionnelId);
    const athletes = await prisma.athlete.findMany({
      where: {
        professionnelId: { in: proIds },
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true, professionnelId: true },
    });
    const athleteIds = athletes.map((a: any) => a.id);
    if (athleteIds.length === 0) return NextResponse.json({ preferences: null });

    // Fetch ALL events including cancelled for cancellation analysis
    const allEventsRaw = await prisma.calendarEvent.findMany({
      where: { athleteId: { in: athleteIds }, type: "rdv" },
      orderBy: { date: "desc" },
      take: 400,
      select: {
        id: true, date: true, endDate: true, description: true,
        createdAt: true, deletedAt: true, professionnelId: true,
        professionnel: { select: { id: true, nom: true, prenom: true, specialite: true } },
      },
    });

    const keptEvents = allEventsRaw.filter((e: any) => !e.deletedAt);
    const cancelledEvents = allEventsRaw.filter((e: any) => e.deletedAt);

    if (keptEvents.length < 2) return NextResponse.json({ preferences: null });

    const now = new Date();
    const currentSeason = MONTH_SEASONS[now.getMonth()];
    let totalWeight = 0;

    // ═══ ACCUMULATORS ═══
    const wHour: Record<number, number> = {};
    const wDay: Record<number, number> = {};
    const wFormat: Record<string, number> = {};
    const wPro: Record<string, { w: number; nom: string; prenom: string; specialite: string }> = {};
    const wDayHour: Record<string, number> = {};
    const wMotifFormat: Record<string, Record<string, number>> = {};
    const wTimeSlot: Record<string, number> = {};
    const wSeason: Record<string, Record<string, number>> = {}; // season → { "matin": w, ... }
    const durations: { val: number; w: number }[] = [];
    const bookingDelays: { val: number; w: number }[] = [];
    const eventsByPro: Record<string, { date: Date; w: number; specialite: string }[]> = {};

    // Trend detection: recent third vs older third
    const thirdIdx = Math.floor(keptEvents.length / 3);
    const recentHourCounts: Record<number, number> = {};
    const olderHourCounts: Record<number, number> = {};
    const recentDayCounts: Record<number, number> = {};
    const olderDayCounts: Record<number, number> = {};

    // Sequential booking tracker: specialite sequences
    const eventTimeline: { date: Date; specialite: string; proId: string }[] = [];

    // Hour-range detection: raw hours for clustering
    const rawHours: number[] = [];

    // Preference stability tracking: per-quarter hour distributions
    const quarterHourDist: Record<string, Record<number, number>> = {};

    for (let i = 0; i < keptEvents.length; i++) {
      const ev = keptEvents[i];
      const d = new Date(ev.date);
      const w = recencyWeight(d, now);
      totalWeight += w;

      const hour = d.getHours();
      const day = d.getDay();
      const month = d.getMonth();
      const season = MONTH_SEASONS[month];
      const { format, motif } = parseDesc(ev.description);
      const pid = ev.professionnelId;

      rawHours.push(hour);

      // Weighted hour
      wHour[hour] = (wHour[hour] || 0) + w;

      // Weighted day
      wDay[day] = (wDay[day] || 0) + w;

      // Weighted format
      wFormat[format] = (wFormat[format] || 0) + w;

      // Day×Hour cross-analysis
      const dhKey = `${day}-${hour}`;
      wDayHour[dhKey] = (wDayHour[dhKey] || 0) + w;

      // Motif×Format correlation
      if (motif) {
        const mk = motif.toLowerCase();
        if (!wMotifFormat[mk]) wMotifFormat[mk] = {};
        wMotifFormat[mk][format] = (wMotifFormat[mk][format] || 0) + w;
      }

      // Weighted time slot
      const ts = hour < 12 ? "matin" : hour < 14 ? "midi" : hour < 18 ? "apresMidi" : "soir";
      wTimeSlot[ts] = (wTimeSlot[ts] || 0) + w;

      // Seasonal time slot preference
      if (!wSeason[season]) wSeason[season] = {};
      wSeason[season][ts] = (wSeason[season][ts] || 0) + w;

      // Pro frequency (weighted)
      if (!wPro[pid]) {
        wPro[pid] = { w: 0, nom: ev.professionnel.nom, prenom: ev.professionnel.prenom, specialite: ev.professionnel.specialite };
      }
      wPro[pid].w += w;

      // Duration (weighted)
      if (ev.endDate) {
        const dur = Math.round((new Date(ev.endDate).getTime() - d.getTime()) / 60000);
        if (dur > 0 && dur < 240) durations.push({ val: dur, w });
      }

      // Booking delay (weighted)
      if (ev.createdAt) {
        const delay = Math.round((d.getTime() - new Date(ev.createdAt).getTime()) / DAY_MS);
        if (delay >= 0 && delay < 365) bookingDelays.push({ val: delay, w });
      }

      // Per-pro intervals
      if (!eventsByPro[pid]) eventsByPro[pid] = [];
      eventsByPro[pid].push({ date: d, w, specialite: ev.professionnel.specialite });

      // Timeline for sequential analysis
      eventTimeline.push({ date: d, specialite: ev.professionnel.specialite, proId: pid });

      // Trend: recent third vs oldest third
      if (i < thirdIdx) {
        recentHourCounts[hour] = (recentHourCounts[hour] || 0) + 1;
        recentDayCounts[day] = (recentDayCounts[day] || 0) + 1;
      } else if (i >= keptEvents.length - thirdIdx) {
        olderHourCounts[hour] = (olderHourCounts[hour] || 0) + 1;
        olderDayCounts[day] = (olderDayCounts[day] || 0) + 1;
      }

      // Preference stability: per-quarter distributions
      const qKey = `${d.getFullYear()}-Q${Math.floor(month / 3)}`;
      if (!quarterHourDist[qKey]) quarterHourDist[qKey] = {};
      quarterHourDist[qKey][hour] = (quarterHourDist[qKey][hour] || 0) + 1;
    }

    // ═══ CANCELLATION PATTERNS ═══
    const cancelHourCounts: Record<number, number> = {};
    const cancelDayCounts: Record<number, number> = {};
    for (const ev of cancelledEvents) {
      const d = new Date(ev.date);
      cancelHourCounts[d.getHours()] = (cancelHourCounts[d.getHours()] || 0) + 1;
      cancelDayCounts[d.getDay()] = (cancelDayCounts[d.getDay()] || 0) + 1;
    }
    const cancelRiskHour: Record<number, number> = {};
    for (const [h, cnt] of Object.entries(cancelHourCounts)) {
      const hi = parseInt(h);
      const totalAtH = keptEvents.filter((e: any) => new Date(e.date).getHours() === hi).length + cnt;
      cancelRiskHour[hi] = totalAtH > 0 ? cnt / totalAtH : 0;
    }
    const cancelRiskDay: Record<number, number> = {};
    for (const [d, cnt] of Object.entries(cancelDayCounts)) {
      const di = parseInt(d);
      const totalAtD = keptEvents.filter((e: any) => new Date(e.date).getDay() === di).length + cnt;
      cancelRiskDay[di] = totalAtD > 0 ? cnt / totalAtD : 0;
    }

    // ═══ BUILD PREFERENCE PROFILE ═══

    const nUniqHours = Object.keys(wHour).length;
    const nUniqDays = Object.keys(wDay).length;

    // Top 3 preferred hours (Bayesian-smoothed confidence)
    const preferredHours = weightedTopN(wHour, 3, totalWeight)
      .map((h) => ({
        hour: parseInt(h.key),
        pct: h.pct,
        confidence: bayesianConfidence(h.weight, totalWeight, nUniqHours),
      }));

    // Top 3 preferred days (Bayesian-smoothed)
    const preferredDays = weightedTopN(wDay, 3, totalWeight)
      .map((d) => ({
        day: parseInt(d.key),
        name: DAY_NAMES[parseInt(d.key)],
        pct: d.pct,
        confidence: bayesianConfidence(d.weight, totalWeight, nUniqDays),
      }));

    // ─── Hour-range detection ───
    // Cluster consecutive hours that represent > 60% of bookings
    const sortedHourEntries = Object.entries(wHour)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([h, w]) => ({ hour: parseInt(h), w }));

    let bestRange = { start: 0, end: 23, weight: 0, span: 24 };
    for (let start = 0; start < 24; start++) {
      for (let span = 1; span <= 5; span++) {
        let rangeW = 0;
        for (let offset = 0; offset < span; offset++) {
          const h = (start + offset) % 24;
          rangeW += wHour[h] || 0;
        }
        const coverage = rangeW / totalWeight;
        if (coverage >= 0.55 && span < bestRange.span) {
          bestRange = { start, end: (start + span - 1) % 24, weight: rangeW, span };
        }
      }
    }
    const hourRange = bestRange.span <= 4 ? {
      start: bestRange.start,
      end: bestRange.end,
      pct: Math.round((bestRange.weight / totalWeight) * 100),
      label: `${bestRange.start}h–${bestRange.end + 1}h`,
    } : null;

    // Preferred format (Bayesian)
    const totalFmtW = (wFormat["presentiel"] || 0) + (wFormat["teleconsultation"] || 0);
    const presentielPct = totalFmtW > 0 ? Math.round(((wFormat["presentiel"] || 0) / totalFmtW) * 100) : 50;
    const preferredFormat = {
      format: presentielPct >= 50 ? "presentiel" : "teleconsultation",
      presentielPct,
      teleconsultationPct: 100 - presentielPct,
      confidence: bayesianConfidence(Math.max(wFormat["presentiel"] || 0, wFormat["teleconsultation"] || 0), totalFmtW, 2),
    };

    // Day×Hour combos
    const topDayHours = weightedTopN(wDayHour, 5, totalWeight)
      .filter((dh) => dh.pct >= 8)
      .map((dh) => {
        const [dayStr, hourStr] = dh.key.split("-");
        return {
          day: parseInt(dayStr), dayName: DAY_NAMES[parseInt(dayStr)],
          hour: parseInt(hourStr), pct: dh.pct,
          label: `${DAY_NAMES[parseInt(dayStr)]} ${parseInt(hourStr)}h`,
        };
      });

    // Motif→Format correlation
    const motifFormatPrefs: Record<string, { format: string; confidence: number }> = {};
    for (const [motif, fmts] of Object.entries(wMotifFormat)) {
      const totalMotifW = Object.values(fmts).reduce((s, v) => s + v, 0);
      if (totalMotifW > 0.5) {
        const best = Object.entries(fmts).sort((a, b) => b[1] - a[1])[0];
        motifFormatPrefs[motif] = { format: best[0], confidence: best[1] / totalMotifW };
      }
    }

    // Preferred time slot
    const preferredTimeSlot = weightedTopN(wTimeSlot, 1, totalWeight)[0]?.key || "matin";

    // ─── Seasonal awareness ───
    const currentSeasonPrefs = wSeason[currentSeason];
    const seasonalTimeSlot = currentSeasonPrefs
      ? Object.entries(currentSeasonPrefs).sort((a, b) => b[1] - a[1])[0]?.[0] || preferredTimeSlot
      : preferredTimeSlot;
    const seasonalShift = seasonalTimeSlot !== preferredTimeSlot ? {
      season: currentSeason,
      usualSlot: preferredTimeSlot,
      seasonalSlot: seasonalTimeSlot,
    } : null;

    // ─── Top pros with per-pro profiles ───
    const topPros = Object.entries(wPro)
      .sort((a, b) => b[1].w - a[1].w)
      .slice(0, 5)
      .map(([id, info]) => {
        const proEvents = keptEvents.filter((e: any) => e.professionnelId === id);
        const count = proEvents.length;
        const pct = Math.round((info.w / totalWeight) * 100);

        let profile = null;
        if (count >= 2) {
          const proHours: Record<number, number> = {};
          const proDays: Record<number, number> = {};
          for (const pe of proEvents) {
            const pd = new Date(pe.date);
            proHours[pd.getHours()] = (proHours[pd.getHours()] || 0) + 1;
            proDays[pd.getDay()] = (proDays[pd.getDay()] || 0) + 1;
          }
          const topHour = Object.entries(proHours).sort((a, b) => b[1] - a[1])[0];
          const topDay = Object.entries(proDays).sort((a, b) => b[1] - a[1])[0];

          // Per-pro interval regularity
          const proDates = proEvents.map((e: any) => new Date(e.date)).sort((a: Date, b: Date) => a.getTime() - b.getTime());
          const proIntervals: number[] = [];
          for (let i = 1; i < proDates.length; i++) {
            proIntervals.push(Math.round((proDates[i].getTime() - proDates[i - 1].getTime()) / DAY_MS));
          }
          const regularity = detectRegularity(proIntervals);
          regularity.lastDate = proDates[proDates.length - 1];
          if (regularity.isRegular && regularity.periodDays && regularity.lastDate) {
            const nextIdeal = new Date(regularity.lastDate.getTime() + regularity.periodDays * DAY_MS);
            if (nextIdeal > now) regularity.nextIdealDate = nextIdeal.toISOString();
          }

          profile = {
            preferredHour: topHour ? parseInt(topHour[0]) : null,
            preferredDay: topDay ? parseInt(topDay[0]) : null,
            preferredDayName: topDay ? DAY_NAMES[parseInt(topDay[0])] : null,
            avgIntervalDays: proIntervals.length > 0
              ? Math.round(proIntervals.reduce((s, v) => s + v, 0) / proIntervals.length) : null,
            regularity: {
              isRegular: regularity.isRegular,
              periodDays: regularity.periodDays,
              periodLabel: regularity.periodLabel,
              confidence: regularity.confidence,
              nextIdealDate: regularity.nextIdealDate,
            },
          };
        }

        return { id, nom: info.nom, prenom: info.prenom, specialite: info.specialite, count, pct, profile };
      });

    // ─── Sequential booking patterns ───
    // Sort timeline chronologically and detect "after spec A → spec B within X days"
    eventTimeline.sort((a, b) => a.date.getTime() - b.date.getTime());
    const seqPairs: Record<string, { count: number; avgDelay: number; delays: number[] }> = {};
    for (let i = 0; i < eventTimeline.length - 1; i++) {
      const a = eventTimeline[i];
      const b = eventTimeline[i + 1];
      if (a.specialite === b.specialite) continue; // skip same-spec consecutive
      const gap = (b.date.getTime() - a.date.getTime()) / DAY_MS;
      if (gap > 0 && gap <= 60) { // within 60 days
        const key = `${a.specialite}→${b.specialite}`;
        if (!seqPairs[key]) seqPairs[key] = { count: 0, avgDelay: 0, delays: [] };
        seqPairs[key].count++;
        seqPairs[key].delays.push(gap);
      }
    }
    const sequentialPatterns = Object.entries(seqPairs)
      .filter(([, v]) => v.count >= 2) // at least 2 occurrences
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([pair, v]) => {
        const [from, to] = pair.split("→");
        const avgDelay = Math.round(v.delays.reduce((s, d) => s + d, 0) / v.delays.length);
        return { from, to, count: v.count, avgDelayDays: avgDelay };
      });

    // ─── Booking velocity profile ───
    const delayValues = bookingDelays.map((d) => d.val);
    const totalDelayW = bookingDelays.reduce((s, d) => s + d.w, 0);
    const avgDelay = totalDelayW > 0
      ? Math.round(bookingDelays.reduce((s, d) => s + d.val * d.w, 0) / totalDelayW) : null;
    const bookingVelocity: "last-minute" | "spontane" | "planificateur" | "anticipateur" | null =
      avgDelay === null ? null :
      avgDelay <= 2 ? "last-minute" :
      avgDelay <= 7 ? "spontane" :
      avgDelay <= 21 ? "planificateur" : "anticipateur";

    // ─── Engagement / churn risk ───
    // Compare frequency of recent 90 days vs previous 90 days
    const d90 = new Date(now.getTime() - 90 * DAY_MS);
    const d180 = new Date(now.getTime() - 180 * DAY_MS);
    const recent90 = keptEvents.filter((e: any) => new Date(e.date) >= d90).length;
    const prev90 = keptEvents.filter((e: any) => {
      const ed = new Date(e.date);
      return ed >= d180 && ed < d90;
    }).length;
    const lastEventDate = keptEvents.length > 0 ? new Date(keptEvents[0].date) : null;
    const daysSinceLast = lastEventDate ? Math.round((now.getTime() - lastEventDate.getTime()) / DAY_MS) : null;

    let engagementLevel: "actif" | "regulier" | "en-baisse" | "inactif" | "nouveau" = "nouveau";
    if (keptEvents.length <= 3) {
      engagementLevel = "nouveau";
    } else if (daysSinceLast != null && daysSinceLast > 120) {
      engagementLevel = "inactif";
    } else if (prev90 > 0 && recent90 < prev90 * 0.5) {
      engagementLevel = "en-baisse";
    } else if (recent90 >= 2) {
      engagementLevel = "actif";
    } else {
      engagementLevel = "regulier";
    }

    // ─── Preference stability index ───
    // How much do hour preferences change quarter to quarter?
    const quarterKeys = Object.keys(quarterHourDist).sort();
    let stabilityScores: number[] = [];
    for (let q = 1; q < quarterKeys.length; q++) {
      const prev = quarterHourDist[quarterKeys[q - 1]];
      const curr = quarterHourDist[quarterKeys[q]];
      const prevTotal = Object.values(prev).reduce((s, v) => s + v, 0);
      const currTotal = Object.values(curr).reduce((s, v) => s + v, 0);
      if (prevTotal < 2 || currTotal < 2) continue;

      // Cosine similarity between distributions
      const allH = new Set([...Object.keys(prev), ...Object.keys(curr)].map(Number));
      let dotP = 0, magA = 0, magB = 0;
      for (const h of allH) {
        const a = (prev[h] || 0) / prevTotal;
        const b = (curr[h] || 0) / currTotal;
        dotP += a * b;
        magA += a * a;
        magB += b * b;
      }
      const cosSim = (magA > 0 && magB > 0) ? dotP / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
      stabilityScores.push(cosSim);
    }
    const preferenceStability = stabilityScores.length > 0
      ? Math.round((stabilityScores.reduce((s, v) => s + v, 0) / stabilityScores.length) * 100)
      : null; // 0-100: 100 = perfectly stable

    // ─── Global regularity detection ───
    const allDates = keptEvents.map((e: any) => new Date(e.date)).sort((a: Date, b: Date) => a.getTime() - b.getTime());
    const globalIntervals: number[] = [];
    for (let i = 1; i < allDates.length; i++) {
      const iv = Math.round((allDates[i].getTime() - allDates[i - 1].getTime()) / DAY_MS);
      if (iv > 0 && iv < 365) globalIntervals.push(iv);
    }
    const globalRegularity = detectRegularity(globalIntervals);
    globalRegularity.lastDate = allDates[allDates.length - 1];
    if (globalRegularity.isRegular && globalRegularity.periodDays && globalRegularity.lastDate) {
      const nextIdeal = new Date(globalRegularity.lastDate.getTime() + globalRegularity.periodDays * DAY_MS);
      if (nextIdeal > now) globalRegularity.nextIdealDate = nextIdeal.toISOString();
    }

    // Weighted average duration
    const totalDurW = durations.reduce((s, d) => s + d.w, 0);
    const avgDuration = totalDurW > 0
      ? Math.round(durations.reduce((s, d) => s + d.val * d.w, 0) / totalDurW) : null;

    // Weighted average follow-up interval
    const allWeightedIntervals: { val: number; w: number }[] = [];
    for (const entries of Object.values(eventsByPro)) {
      entries.sort((a, b) => a.date.getTime() - b.date.getTime());
      for (let i = 1; i < entries.length; i++) {
        const interval = (entries[i].date.getTime() - entries[i - 1].date.getTime()) / DAY_MS;
        if (interval > 0 && interval < 365) {
          allWeightedIntervals.push({ val: interval, w: (entries[i].w + entries[i - 1].w) / 2 });
        }
      }
    }
    const totalIntW = allWeightedIntervals.reduce((s, d) => s + d.w, 0);
    const avgInterval = totalIntW > 0
      ? Math.round(allWeightedIntervals.reduce((s, d) => s + d.val * d.w, 0) / totalIntW) : null;

    // ─── Trend detection (thirds instead of halves for better precision) ───
    const recentTotal = thirdIdx;
    const olderTotal = Math.min(thirdIdx, keptEvents.length - keptEvents.length + thirdIdx);

    const hourTrends = detectTrend(recentHourCounts, olderHourCounts, recentTotal, olderTotal)
      .map((t) => ({ hour: t.key, direction: t.direction, delta: t.delta }));
    const dayTrends = detectTrend(recentDayCounts, olderDayCounts, recentTotal, olderTotal)
      .map((t) => ({ day: t.key, dayName: DAY_NAMES[t.key], direction: t.direction, delta: t.delta }));

    // ─── Overall data confidence ───
    const dataConfidence = Math.min(keptEvents.length / 15, 1);

    // ─── Cancel-risk slots ───
    const avoidSlots = Object.entries(cancelRiskHour)
      .filter(([, risk]) => risk >= 0.3)
      .map(([h]) => ({ hour: parseInt(h), risk: Math.round(cancelRiskHour[parseInt(h)] * 100) }));
    const avoidDays = Object.entries(cancelRiskDay)
      .filter(([, risk]) => risk >= 0.3)
      .map(([d]) => ({ day: parseInt(d), dayName: DAY_NAMES[parseInt(d)], risk: Math.round(cancelRiskDay[parseInt(d)] * 100) }));

    // ═══ RESPONSE ═══
    return NextResponse.json({
      preferences: {
        totalAppointments: keptEvents.length,
        cancelledCount: cancelledEvents.length,
        dataConfidence: Math.round(dataConfidence * 100),
        preferredHours,
        preferredDays,
        preferredFormat,
        preferredTimeSlot,
        hourRange,
        topDayHours,
        motifFormatPrefs,
        topPros,
        avgDuration,
        avgBookingDelay: avgDelay,
        avgFollowUpInterval: avgInterval,
        trends: { hours: hourTrends, days: dayTrends },
        cancellationPatterns: { avoidSlots, avoidDays },
        // ─── NEW AI layers ───
        regularity: {
          isRegular: globalRegularity.isRegular,
          periodDays: globalRegularity.periodDays,
          periodLabel: globalRegularity.periodLabel,
          confidence: globalRegularity.confidence,
          nextIdealDate: globalRegularity.nextIdealDate,
        },
        seasonalAwareness: seasonalShift,
        sequentialPatterns,
        bookingVelocity,
        engagement: {
          level: engagementLevel,
          recent90,
          prev90,
          daysSinceLast,
        },
        preferenceStability,
        // Pre-computed scoring weights
        scoring: {
          hourBonus: preferredHours[0]?.hour ?? null,
          hourConf: preferredHours[0]?.confidence ?? 0,
          hourBonus2: preferredHours[1]?.hour ?? null,
          hourConf2: preferredHours[1]?.confidence ?? 0,
          dayBonus: preferredDays[0]?.day ?? null,
          dayConf: preferredDays[0]?.confidence ?? 0,
          dayBonus2: preferredDays[1]?.day ?? null,
          formatBonus: preferredFormat.format,
          formatConf: preferredFormat.confidence,
          topProIds: topPros.slice(0, 3).map((p) => p.id),
          durationTarget: avgDuration,
          timeSlot: preferredTimeSlot,
          seasonalTimeSlot: seasonalShift ? seasonalTimeSlot : null,
          hourRange,
          dayHourCombos: topDayHours.slice(0, 3).map((dh) => ({ day: dh.day, hour: dh.hour, pct: dh.pct })),
          cancelPenaltyHours: avoidSlots.map((s) => s.hour),
          cancelPenaltyDays: avoidDays.map((d) => d.day),
          trendingHour: hourTrends.find((t) => t.direction === "rising")?.hour ?? null,
          trendingDay: dayTrends.find((t) => t.direction === "rising")?.day ?? null,
          proProfiles: Object.fromEntries(
            topPros.filter((p) => p.profile).map((p) => [p.id, p.profile])
          ),
          regularity: globalRegularity.isRegular ? {
            periodDays: globalRegularity.periodDays,
            nextIdealDate: globalRegularity.nextIdealDate,
          } : null,
          sequentialPatterns: sequentialPatterns.slice(0, 2),
          confidence: dataConfidence,
          stability: preferenceStability,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/athlete/preferences error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
