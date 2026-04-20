// ═══════════════════════════════════════════════════════════════════════════════
// AI Scoring Engine — Pure functions extracted for testability
// ═══════════════════════════════════════════════════════════════════════════════

export const DAY_MS = 86400000;
export const DAY_NAMES = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
export const MONTH_SEASONS: Record<number, "hiver" | "printemps" | "ete" | "automne"> = {
  0: "hiver", 1: "hiver", 2: "printemps", 3: "printemps", 4: "printemps",
  5: "ete", 6: "ete", 7: "ete", 8: "automne", 9: "automne", 10: "automne", 11: "hiver",
};

// ─── Helpers ───

/** Exponential decay weight: half-life = 60 days */
export function recencyWeight(eventDate: Date, now: Date): number {
  const daysAgo = (now.getTime() - eventDate.getTime()) / DAY_MS;
  return Math.exp(-0.693 * daysAgo / 60);
}

/** Parse description fields */
export function parseDesc(desc: string | null) {
  const lines = (desc || "").split("\n");
  const get = (prefix: string) => {
    const l = lines.find((x: string) => x.toLowerCase().startsWith(prefix));
    return l ? l.replace(new RegExp(`^${prefix}\\s*:\\s*`, "i"), "").trim() : null;
  };
  const formatRaw = get("format");
  const format = formatRaw?.toLowerCase().includes("éléconsultation") ? "teleconsultation" : "presentiel";
  const motif = get("motif");
  return { format, motif };
}

/** Bayesian-smoothed confidence: Laplace smoothing + sample ramp */
export function bayesianConfidence(topWeight: number, totalWeight: number, uniqueVals: number): number {
  if (totalWeight < 0.5) return 0;
  const alpha = 0.5; // Laplace smoothing constant
  const smoothed = (topWeight + alpha) / (totalWeight + alpha * Math.max(uniqueVals, 1));
  const sampleRamp = Math.min(totalWeight / 5, 1); // ramp up confidence with more data
  return Math.min(smoothed * sampleRamp, 1);
}

/** Weighted top-N from a weighted map */
export function weightedTopN(map: Record<string, number>, n: number, total: number) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, w]) => ({ key, weight: w, pct: Math.round((w / Math.max(total, 1)) * 100) }));
}

/** Detect periodicity in a series of intervals using autocorrelation */
export function detectRegularity(intervalsDays: number[]): {
  isRegular: boolean; periodDays: number | null; periodLabel: string | null; confidence: number;
  nextIdealDate: string | null;
  lastDate: Date | null;
} {
  if (intervalsDays.length < 3) return { isRegular: false, periodDays: null, periodLabel: null, confidence: 0, nextIdealDate: null, lastDate: null };

  // Test candidate periods: 7, 14, 21, 28, 30, 60, 90
  const candidates = [7, 14, 21, 28, 30, 60, 90];
  let bestPeriod = 0;
  let bestScore = 0;

  for (const p of candidates) {
    // How many intervals are close to this period (within 20% tolerance)?
    const tolerance = p * 0.2;
    const matches = intervalsDays.filter((iv) => Math.abs(iv - p) <= tolerance).length;
    const score = matches / intervalsDays.length;
    if (score > bestScore) {
      bestScore = score;
      bestPeriod = p;
    }
  }

  // Also test the median interval as a custom period
  const sorted = [...intervalsDays].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const medianTol = median * 0.2;
  const medianMatches = intervalsDays.filter((iv) => Math.abs(iv - median) <= medianTol).length;
  const medianScore = medianMatches / intervalsDays.length;
  if (medianScore > bestScore) {
    bestScore = medianScore;
    bestPeriod = median;
  }

  const isRegular = bestScore >= 0.5 && intervalsDays.length >= 3;
  const periodLabel = bestPeriod <= 8 ? "hebdomadaire" :
    bestPeriod <= 16 ? "bimensuel" :
    bestPeriod <= 23 ? "toutes les 3 semaines" :
    bestPeriod <= 35 ? "mensuel" :
    bestPeriod <= 65 ? "bimestriel" :
    bestPeriod <= 100 ? "trimestriel" : `tous les ${bestPeriod}j`;

  return {
    isRegular,
    periodDays: isRegular ? bestPeriod : null,
    periodLabel: isRegular ? periodLabel : null,
    confidence: Math.round(bestScore * 100) / 100,
    nextIdealDate: null, // filled later
    lastDate: null, // filled later
  };
}

/** Calculate coefficient of variation (stability measure: lower = more stable) */
export function coeffOfVariation(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 1;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** Trend detection: compare recent vs older distributions */
export function detectTrend(
  recentCounts: Record<number, number>,
  olderCounts: Record<number, number>,
  recentTotal: number,
  olderTotal: number,
) {
  const trends: { key: number; direction: "rising" | "falling"; delta: number }[] = [];
  const allKeys = new Set([...Object.keys(recentCounts), ...Object.keys(olderCounts)].map(Number));
  for (const k of allKeys) {
    const rPct = recentTotal > 0 ? ((recentCounts[k] || 0) / recentTotal) * 100 : 0;
    const oPct = olderTotal > 0 ? ((olderCounts[k] || 0) / olderTotal) * 100 : 0;
    const delta = rPct - oPct;
    if (Math.abs(delta) >= 10) trends.push({ key: k, direction: delta > 0 ? "rising" : "falling", delta: Math.round(delta) });
  }
  return trends.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
}

// ─── Slot scoring types ───

export interface ScoringWeights {
  hourBonus: number | null;
  hourConf: number;
  hourBonus2: number | null;
  hourConf2: number;
  dayBonus: number | null;
  dayConf: number;
  dayBonus2: number | null;
  formatBonus: string | null;
  formatConf: number;
  topProIds: string[];
  durationTarget: number | null;
  timeSlot: string;
  seasonalTimeSlot: string | null;
  hourRange: { start: number; end: number; pct: number; label: string } | null;
  dayHourCombos: { day: number; hour: number; pct: number }[];
  cancelPenaltyHours: number[];
  cancelPenaltyDays: number[];
  trendingHour: number | null;
  trendingDay: number | null;
  proProfiles: Record<string, ProProfile>;
  regularity: { periodDays: number | null; nextIdealDate: string | null } | null;
  sequentialPatterns: { from: string; to: string; count: number; avgDelayDays: number }[];
  confidence: number;
  stability: number | null;
}

export interface ProProfile {
  preferredHour: number | null;
  preferredDay: number | null;
  preferredDayName: string | null;
  avgIntervalDays: number | null;
  regularity: {
    isRegular: boolean;
    periodDays: number | null;
    periodLabel: string | null;
    confidence: number;
    nextIdealDate: string | null;
  };
}

export interface SlotBadge {
  label: string;
  icon: string;
  color: string;
}

export interface SlotScoreResult {
  score: number;
  badges: SlotBadge[];
  matchPct: number;
}

/** Pure slot scoring function — scores a single slot against learned preferences */
export function scoreSlot(params: {
  slotHour: number;
  slotDay: number;
  slotDate: Date;
  slotDuration?: number;
  slotId: string;
  firstSlotId: string;
  isVisio: boolean;
  motifDuration: number | null;
  existingDates: Date[];
  sc: ScoringWeights | null;
  selectedProId: string | null;
}): SlotScoreResult {
  const { slotHour: h, slotDay: day, slotDate, slotDuration, slotId, firstSlotId, isVisio, motifDuration, existingDates, sc, selectedProId } = params;
  const badges: SlotBadge[] = [];
  let score = 0;
  const conf = sc?.confidence ?? 0;
  const stabilityMul = sc?.stability != null ? Math.max(sc.stability / 100, 0.3) : 0.6;
  const MAX_SCORE = 120;

  const proProfile: ProProfile | undefined = selectedProId && sc?.proProfiles?.[selectedProId] ? sc.proProfiles[selectedProId] : undefined;
  const isTopPro = selectedProId && sc?.topProIds?.includes(selectedProId);
  const nextIdealDate = sc?.regularity?.nextIdealDate ? new Date(sc.regularity.nextIdealDate) : null;

  // 1. Le plus rapide (first slot)
  if (slotId === firstSlotId) {
    badges.push({ label: "Le plus rapide", icon: "zap", color: "#f59e0b" });
    score += 25;
  }

  // 2. Day×Hour combo match
  const comboMatch = sc?.dayHourCombos?.find((c) => c.day === day && c.hour === h);
  if (comboMatch) {
    badges.push({ label: `Votre créneau type (${comboMatch.pct}%)`, icon: "target", color: "#ec4899" });
    score += 40 * conf * stabilityMul;
  }

  // 3. Preferred hour
  if (!comboMatch && sc?.hourBonus != null && h === sc.hourBonus) {
    badges.push({ label: "Votre horaire préféré", icon: "clock", color: "#ec4899" });
    score += 35 * Math.max(sc.hourConf, 0.4) * stabilityMul;
  } else if (sc?.hourBonus2 != null && h === sc.hourBonus2) {
    score += 18 * Math.max(sc.hourConf2, 0.3);
  }

  // 4. Hour-range match
  if (!comboMatch && sc?.hourRange && h >= sc.hourRange.start && h <= sc.hourRange.end) {
    score += 8;
  }

  // 5. Preferred day
  if (!comboMatch && sc?.dayBonus != null && day === sc.dayBonus) {
    if (!badges.some((b) => b.label.includes("horaire") || b.label.includes("créneau"))) {
      badges.push({ label: "Votre jour favori", icon: "repeat", color: "#14b8a6" });
    }
    score += 28 * Math.max(sc.dayConf, 0.4) * stabilityMul;
  } else if (sc?.dayBonus2 != null && day === sc.dayBonus2) {
    score += 12;
  }

  // 6. Trending hour/day bonus
  if (sc?.trendingHour != null && h === sc.trendingHour) {
    score += 10;
    if (badges.length < 3) {
      badges.push({ label: "Tendance récente", icon: "trending-up", color: "#22d3ee" });
    }
  }
  if (sc?.trendingDay != null && day === sc.trendingDay) {
    score += 8;
  }

  // 7. Per-pro profile match
  if (proProfile) {
    if (proProfile.preferredHour != null && h === proProfile.preferredHour) {
      score += 15;
      if (badges.length < 3 && !badges.some((b) => b.label.includes("horaire") || b.label.includes("créneau"))) {
        badges.push({ label: "Horaire habituel avec ce pro", icon: "clock", color: "#a78bfa" });
      }
    }
    if (proProfile.preferredDay != null && day === proProfile.preferredDay) {
      score += 12;
    }
    if (proProfile.regularity?.nextIdealDate) {
      const idealDate = new Date(proProfile.regularity.nextIdealDate);
      const daysToIdeal = Math.abs((slotDate.getTime() - idealDate.getTime()) / DAY_MS);
      if (daysToIdeal <= 3) {
        score += 20;
        if (badges.length < 3) {
          badges.push({ label: `Rythme ${proProfile.regularity.periodLabel}`, icon: "refresh-cw", color: "#f472b6" });
        }
      } else if (daysToIdeal <= 7) {
        score += 10;
      }
    }
  }

  // 8. Global regularity
  if (!proProfile?.regularity?.nextIdealDate && nextIdealDate) {
    const daysToIdeal = Math.abs((slotDate.getTime() - nextIdealDate.getTime()) / DAY_MS);
    if (daysToIdeal <= 3) {
      score += 15;
      if (badges.length < 3) {
        badges.push({ label: "Dans votre rythme habituel", icon: "refresh-cw", color: "#f472b6" });
      }
    } else if (daysToIdeal <= 7) {
      score += 6;
    }
  }

  // 9. Seasonal time slot adjustment
  if (sc?.seasonalTimeSlot) {
    const slotTimeSlot = h < 12 ? "matin" : h < 14 ? "midi" : h < 18 ? "apresMidi" : "soir";
    if (slotTimeSlot === sc.seasonalTimeSlot) {
      score += 8;
    }
  }

  // 10. Format match
  if (sc?.formatBonus) {
    const slotFormat = isVisio ? "teleconsultation" : "presentiel";
    if (slotFormat === sc.formatBonus) {
      score += 12 * Math.max(sc.formatConf, 0.3);
    }
  }

  // 11. Top pro bonus
  if (isTopPro) {
    if (badges.length < 3) {
      badges.push({ label: "Votre pro favori", icon: "user", color: "#6366f1" });
    }
    score += 18;
  }

  // 12. Duration match
  if (sc?.durationTarget && slotDuration === sc.durationTarget) {
    score += 8;
  } else if (motifDuration && slotDuration === motifDuration) {
    score += 8;
  }

  // 13. Time slot match
  if (sc?.timeSlot && !sc?.seasonalTimeSlot) {
    const slotTimeSlot = h < 12 ? "matin" : h < 14 ? "midi" : h < 18 ? "apresMidi" : "soir";
    if (slotTimeSlot === sc.timeSlot) {
      score += 10;
    }
  }

  // 14. Cancellation penalty
  if (sc?.cancelPenaltyHours?.includes(h)) {
    score -= 15;
  }
  if (sc?.cancelPenaltyDays?.includes(day)) {
    score -= 12;
  }

  // 15. Same day as another RDV
  const sameDayRdv = existingDates.some(
    (ed) => ed.toDateString() === slotDate.toDateString()
  );
  if (sameDayRdv) {
    if (badges.length < 3) {
      badges.push({ label: "Même jour qu'un autre RDV", icon: "calendar", color: "#3b82f6" });
    }
    score += 18;
  }

  // 16. After an existing RDV (1-3h after)
  const afterExisting = existingDates.some((ed) => {
    const diff = slotDate.getTime() - ed.getTime();
    return diff > 0 && diff <= 3 * 60 * 60 * 1000 && diff >= 1 * 60 * 60 * 1000;
  });
  if (afterExisting) {
    if (badges.length < 3) {
      badges.push({ label: "Après votre RDV précédent", icon: "arrow-right", color: "#8b5cf6" });
    }
    score += 15;
  }

  // 17. Visio convenience
  if (isVisio && badges.length < 3) {
    badges.push({ label: "En visio, plus simple", icon: "monitor", color: "#10b981" });
    score += 5;
  }

  // 18. Fallback: morning convenience (no learned prefs)
  if (!sc) {
    if (h >= 8 && h <= 10) score += 5;
  }

  const matchPct = sc ? Math.min(Math.round((Math.max(score, 0) / MAX_SCORE) * 100), 99) : 0;
  return { score, badges: badges.slice(0, 3), matchPct };
}

// ─── Quick-Book Bonus Scoring ───

export interface QuickBookContext {
  cancelRiskHours: Set<number>;
  cancelRiskDays: Set<number>;
  trendingHours: Set<number>;
  trendingDays: Set<number>;
  velocity: "last-minute" | "spontane" | "planificateur" | "anticipateur" | null;
  idealDate: Date | null;
  avgBookingDelay: number | null;
  hourRange: { start: number; end: number } | null;
  dayHourCombos: { day: number; hour: number; pct: number }[];
}

/** Quick-book-specific bonus scoring layer — pure function */
export function quickBookBonus(params: {
  slotDate: Date;
  slotHour: number;
  slotDay: number;
  ctx: QuickBookContext;
}): number {
  const { slotDate, slotHour: h, slotDay: d, ctx } = params;
  let bonus = 0;

  // Cancel-risk avoidance
  if (ctx.cancelRiskHours.has(h)) bonus -= 20;
  if (ctx.cancelRiskDays.has(d)) bonus -= 15;

  // Trending hour/day
  if (ctx.trendingHours.has(h)) bonus += 12;
  if (ctx.trendingDays.has(d)) bonus += 8;

  // Velocity urgency
  const daysAway = (slotDate.getTime() - Date.now()) / DAY_MS;
  if (ctx.velocity === "last-minute" || ctx.velocity === "spontane") {
    if (daysAway <= 2) bonus += 18;
    else if (daysAway <= 5) bonus += 10;
  } else if (ctx.velocity === "anticipateur") {
    if (daysAway >= 7 && daysAway <= 21) bonus += 12;
  }

  // Regularity proximity
  if (ctx.idealDate) {
    const daysToIdeal = Math.abs((slotDate.getTime() - ctx.idealDate.getTime()) / DAY_MS);
    if (daysToIdeal <= 1) bonus += 25;
    else if (daysToIdeal <= 3) bonus += 15;
    else if (daysToIdeal <= 7) bonus += 5;
    else if (daysToIdeal > 14) bonus -= 10;
  }

  // Day×hour combo
  if (ctx.dayHourCombos.some((c) => c.day === d && c.hour === h)) bonus += 15;

  // Hour range
  if (ctx.hourRange && h >= ctx.hourRange.start && h <= ctx.hourRange.end) bonus += 6;

  // Booking delay alignment
  if (ctx.avgBookingDelay != null) {
    const delayDiff = Math.abs(daysAway - ctx.avgBookingDelay);
    if (delayDiff <= 2) bonus += 10;
    else if (delayDiff <= 5) bonus += 4;
  }

  return bonus;
}

// ─── Insight Builder Helpers ───

export interface QuickBookInsightInput {
  icon: "calendar" | "clock" | "shield" | "trending" | "repeat" | "zap" | "alert" | "star" | "sun";
  label: string;
  detail?: string;
  color: string;
}

/** Build engagement insight */
export function buildEngagementInsight(engagement: {
  level: string; recent90: number; prev90: number; daysSinceLast: number | null;
}): QuickBookInsightInput | null {
  if (engagement.daysSinceLast != null && engagement.daysSinceLast > 60) {
    return { icon: "alert", label: `${engagement.daysSinceLast} jours depuis votre dernier RDV`, detail: "Il est peut-être temps de reprendre un suivi", color: "#f59e0b" };
  }
  if (engagement.level === "actif" && engagement.recent90 > 3) {
    return { icon: "star", label: `${engagement.recent90} RDV ces 3 derniers mois`, detail: "Vous êtes un patient actif", color: "#10b981" };
  }
  return null;
}

/** Build cancellation rate insight */
export function buildCancelRateInsight(cancelledCount: number, totalAppointments: number): QuickBookInsightInput | null {
  if (cancelledCount <= 0 || totalAppointments <= 3) return null;
  const rate = Math.round((cancelledCount / totalAppointments) * 100);
  if (rate < 20) return null;
  return { icon: "shield", label: `${rate}% de RDV annulés (${cancelledCount}/${totalAppointments})`, detail: "Les créneaux à risque sont évités pour vous", color: "#ef4444" };
}

/** Build booking delay insight */
export function buildBookingDelayInsight(avgBookingDelay: number | null): QuickBookInsightInput | null {
  if (avgBookingDelay == null || avgBookingDelay <= 0) return null;
  const d = Math.round(avgBookingDelay);
  if (d <= 3) return { icon: "zap", label: `Délai moyen de réservation : ${d}j`, detail: "Créneaux proches priorisés", color: "#f59e0b" };
  if (d >= 14) return { icon: "calendar", label: `Vous réservez ~${d}j à l'avance`, detail: "Créneaux éloignés priorisés", color: "#6366f1" };
  return null;
}

/** Compute ideal date from avgFollowUpInterval */
export function computeFallbackIdealDate(avgFollowUpInterval: number, daysSinceLast: number): Date | null {
  if (avgFollowUpInterval <= 0) return null;
  const avgDays = Math.round(avgFollowUpInterval);
  const lastDate = new Date(Date.now() - daysSinceLast * DAY_MS);
  const ideal = new Date(lastDate.getTime() + avgDays * DAY_MS);
  return ideal.getTime() < Date.now() ? new Date() : ideal;
}

/** Map motif ID to auto-fill complaint */
export function motifToComplaint(motifId: string, motifLabel: string): string {
  const MAP: Record<string, string> = {
    suivi: "Consultation de suivi",
    "bilan-initial": "Bilan initial",
    bilan: "Bilan",
    douleur: "Douleur à préciser",
    "remise-en-forme": "Remise en forme",
    urgence: "Consultation urgente",
    prevention: "Prévention",
    nutrition: "Consultation nutrition",
    "plan-alimentaire": "Plan alimentaire",
    performance: "Optimisation performance",
    recuperation: "Récupération",
    "preparation-physique": "Préparation physique",
  };
  return MAP[motifId] || motifLabel;
}
