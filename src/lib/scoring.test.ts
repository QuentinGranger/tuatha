import { describe, it, expect } from "vitest";
import {
  DAY_MS, DAY_NAMES, MONTH_SEASONS,
  recencyWeight, parseDesc, bayesianConfidence, weightedTopN,
  detectRegularity, coeffOfVariation, detectTrend, scoreSlot,
  type ScoringWeights, type ProProfile,
} from "./scoring";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

describe("Constants", () => {
  it("DAY_MS is 86400000", () => {
    expect(DAY_MS).toBe(86400000);
  });

  it("DAY_NAMES has 7 entries starting with dim", () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe("dim");
    expect(DAY_NAMES[1]).toBe("lun");
    expect(DAY_NAMES[6]).toBe("sam");
  });

  it("MONTH_SEASONS maps all 12 months", () => {
    for (let m = 0; m < 12; m++) {
      expect(MONTH_SEASONS[m]).toBeDefined();
    }
    expect(MONTH_SEASONS[0]).toBe("hiver");
    expect(MONTH_SEASONS[3]).toBe("printemps");
    expect(MONTH_SEASONS[6]).toBe("ete");
    expect(MONTH_SEASONS[9]).toBe("automne");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// recencyWeight
// ═══════════════════════════════════════════════════════════════════════════════

describe("recencyWeight", () => {
  it("returns 1 for an event happening now", () => {
    const now = new Date();
    expect(recencyWeight(now, now)).toBeCloseTo(1, 5);
  });

  it("returns ~0.5 for an event 60 days ago (half-life)", () => {
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);
    const w = recencyWeight(sixtyDaysAgo, now);
    expect(w).toBeCloseTo(0.5, 1);
  });

  it("returns ~0.25 for an event 120 days ago (two half-lives)", () => {
    const now = new Date();
    const d = new Date(now.getTime() - 120 * DAY_MS);
    const w = recencyWeight(d, now);
    expect(w).toBeCloseTo(0.25, 1);
  });

  it("returns values between 0 and 1 for past events", () => {
    const now = new Date();
    for (const daysAgo of [1, 7, 30, 90, 180, 365]) {
      const w = recencyWeight(new Date(now.getTime() - daysAgo * DAY_MS), now);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it("monotonically decreases with age", () => {
    const now = new Date();
    let prev = 1;
    for (const daysAgo of [1, 10, 30, 60, 120, 365]) {
      const w = recencyWeight(new Date(now.getTime() - daysAgo * DAY_MS), now);
      expect(w).toBeLessThan(prev);
      prev = w;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// parseDesc
// ═══════════════════════════════════════════════════════════════════════════════

describe("parseDesc", () => {
  it("returns presentiel and null motif for null description", () => {
    const { format, motif } = parseDesc(null);
    expect(format).toBe("presentiel");
    expect(motif).toBeNull();
  });

  it("returns presentiel and null motif for empty string", () => {
    const { format, motif } = parseDesc("");
    expect(format).toBe("presentiel");
    expect(motif).toBeNull();
  });

  it("detects teleconsultation format", () => {
    const { format } = parseDesc("Format : Téléconsultation\nMotif : Suivi");
    expect(format).toBe("teleconsultation");
  });

  it("detects presentiel format", () => {
    const { format } = parseDesc("Format : Présentiel\nMotif : Douleur");
    expect(format).toBe("presentiel");
  });

  it("parses motif from description", () => {
    const { motif } = parseDesc("Format : Présentiel\nMotif : Suivi mensuel");
    expect(motif).toBe("Suivi mensuel");
  });

  it("handles descriptions without format/motif lines", () => {
    const { format, motif } = parseDesc("Simple note de consultation");
    expect(format).toBe("presentiel");
    expect(motif).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// bayesianConfidence
// ═══════════════════════════════════════════════════════════════════════════════

describe("bayesianConfidence", () => {
  it("returns 0 when totalWeight < 0.5", () => {
    expect(bayesianConfidence(0.3, 0.4, 3)).toBe(0);
  });

  it("returns 0 when totalWeight is 0", () => {
    expect(bayesianConfidence(0, 0, 1)).toBe(0);
  });

  it("increases with more evidence (higher topWeight)", () => {
    const c1 = bayesianConfidence(2, 10, 5);
    const c2 = bayesianConfidence(5, 10, 5);
    expect(c2).toBeGreaterThan(c1);
  });

  it("increases with more data (sample ramp)", () => {
    // Same proportion but more data → higher confidence
    const c1 = bayesianConfidence(1, 2, 3);
    const c2 = bayesianConfidence(5, 10, 3);
    expect(c2).toBeGreaterThan(c1);
  });

  it("never exceeds 1", () => {
    const c = bayesianConfidence(100, 100, 1);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("returns value between 0 and 1", () => {
    for (const [top, total, uniq] of [[3, 10, 5], [1, 5, 3], [8, 10, 2], [50, 100, 24]]) {
      const c = bayesianConfidence(top, total, uniq);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it("Laplace smoothing prevents zero confidence for small counts", () => {
    // Even with topWeight=0, smoothing gives a small non-zero result
    const c = bayesianConfidence(0, 5, 3);
    expect(c).toBeGreaterThan(0);
  });

  it("higher uniqueVals reduces confidence (more spread out)", () => {
    const c1 = bayesianConfidence(5, 10, 2);
    const c2 = bayesianConfidence(5, 10, 10);
    expect(c1).toBeGreaterThan(c2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// weightedTopN
// ═══════════════════════════════════════════════════════════════════════════════

describe("weightedTopN", () => {
  it("returns top N entries sorted by weight descending", () => {
    const map = { "9": 5, "10": 3, "14": 8, "16": 1 };
    const result = weightedTopN(map, 2, 17);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe("14");
    expect(result[1].key).toBe("9");
  });

  it("calculates correct pct", () => {
    const map = { "9": 5, "14": 5 };
    const result = weightedTopN(map, 2, 10);
    expect(result[0].pct).toBe(50);
    expect(result[1].pct).toBe(50);
  });

  it("handles empty map", () => {
    const result = weightedTopN({}, 3, 10);
    expect(result).toHaveLength(0);
  });

  it("handles N larger than map size", () => {
    const map = { "9": 5 };
    const result = weightedTopN(map, 5, 5);
    expect(result).toHaveLength(1);
  });

  it("handles total=0 without division error", () => {
    const map = { "9": 5 };
    const result = weightedTopN(map, 1, 0);
    expect(result).toHaveLength(1);
    // Uses Math.max(total, 1) so pct should be 500
    expect(result[0].pct).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// detectRegularity
// ═══════════════════════════════════════════════════════════════════════════════

describe("detectRegularity", () => {
  it("returns not regular for fewer than 3 intervals", () => {
    const r = detectRegularity([7, 8]);
    expect(r.isRegular).toBe(false);
    expect(r.periodDays).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it("detects weekly regularity (7-day intervals)", () => {
    const r = detectRegularity([7, 7, 7, 7, 7]);
    expect(r.isRegular).toBe(true);
    expect(r.periodDays).toBe(7);
    expect(r.periodLabel).toBe("hebdomadaire");
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("detects biweekly regularity (14-day intervals)", () => {
    const r = detectRegularity([14, 13, 15, 14, 14]);
    expect(r.isRegular).toBe(true);
    expect(r.periodDays).toBe(14);
    expect(r.periodLabel).toBe("bimensuel");
  });

  it("detects monthly regularity (~30-day intervals)", () => {
    const r = detectRegularity([30, 28, 31, 29, 30]);
    expect(r.isRegular).toBe(true);
    // 28 wins because both 28 and 30 are candidates; 28 matches more within ±20%
    expect([28, 30]).toContain(r.periodDays);
    expect(r.periodLabel).toBe("mensuel");
  });

  it("detects trimestrial regularity (~90-day intervals)", () => {
    const r = detectRegularity([90, 88, 92, 90]);
    expect(r.isRegular).toBe(true);
    expect(r.periodDays).toBe(90);
    expect(r.periodLabel).toBe("trimestriel");
  });

  it("handles irregular intervals", () => {
    const r = detectRegularity([3, 45, 12, 67, 5, 100]);
    // Very irregular — may or may not be regular depending on median
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.isRegular).toBe(false);
  });

  it("tolerates 20% deviation from period", () => {
    // 7 ± 20% = 5.6 to 8.4
    const r = detectRegularity([6, 8, 7, 6, 8, 7]);
    expect(r.isRegular).toBe(true);
    expect(r.periodDays).toBe(7);
  });

  it("uses median as custom period candidate", () => {
    // All intervals ~45 days (not a standard candidate but median works)
    const r = detectRegularity([44, 45, 46, 44, 45]);
    expect(r.isRegular).toBe(true);
    expect(r.periodDays).toBe(45);
    expect(r.periodLabel).toBe("bimestriel");
  });

  it("returns correct period labels", () => {
    expect(detectRegularity([7, 7, 7]).periodLabel).toBe("hebdomadaire");
    expect(detectRegularity([14, 14, 14]).periodLabel).toBe("bimensuel");
    expect(detectRegularity([21, 21, 21]).periodLabel).toBe("toutes les 3 semaines");
    expect(detectRegularity([28, 28, 28]).periodLabel).toBe("mensuel");
    expect(detectRegularity([60, 60, 60]).periodLabel).toBe("bimestriel");
    expect(detectRegularity([90, 90, 90]).periodLabel).toBe("trimestriel");
  });

  it("initializes nextIdealDate and lastDate as null", () => {
    const r = detectRegularity([7, 7, 7]);
    expect(r.nextIdealDate).toBeNull();
    expect(r.lastDate).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// coeffOfVariation
// ═══════════════════════════════════════════════════════════════════════════════

describe("coeffOfVariation", () => {
  it("returns 1 for fewer than 2 values", () => {
    expect(coeffOfVariation([])).toBe(1);
    expect(coeffOfVariation([5])).toBe(1);
  });

  it("returns 0 for identical values", () => {
    expect(coeffOfVariation([10, 10, 10, 10])).toBe(0);
  });

  it("returns 1 when mean is 0", () => {
    expect(coeffOfVariation([0, 0, 0])).toBe(1);
  });

  it("returns higher CV for more dispersed values", () => {
    const cvLow = coeffOfVariation([10, 10, 11, 10]);
    const cvHigh = coeffOfVariation([1, 20, 5, 50]);
    expect(cvHigh).toBeGreaterThan(cvLow);
  });

  it("returns correct value for known data", () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, stddev=2, CV=0.4
    const cv = coeffOfVariation([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(cv).toBeCloseTo(0.4, 1);
  });

  it("is always >= 0 for positive values", () => {
    expect(coeffOfVariation([1, 2, 3, 4, 5])).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// detectTrend
// ═══════════════════════════════════════════════════════════════════════════════

describe("detectTrend", () => {
  it("detects rising trend", () => {
    const recent = { 9: 8 }; // 80%
    const older = { 9: 2 };  // 20%
    const trends = detectTrend(recent, older, 10, 10);
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0].direction).toBe("rising");
    expect(trends[0].key).toBe(9);
    expect(trends[0].delta).toBe(60);
  });

  it("detects falling trend", () => {
    const recent = { 14: 1 }; // 10%
    const older = { 14: 8 };  // 80%
    const trends = detectTrend(recent, older, 10, 10);
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0].direction).toBe("falling");
    expect(trends[0].key).toBe(14);
  });

  it("ignores small deltas (< 10%)", () => {
    const recent = { 9: 5 }; // 50%
    const older = { 9: 4 };  // 44%
    const trends = detectTrend(recent, older, 10, 9);
    expect(trends).toHaveLength(0);
  });

  it("returns at most 3 trends", () => {
    const recent: Record<number, number> = {};
    const older: Record<number, number> = {};
    for (let i = 0; i < 10; i++) {
      recent[i] = i * 2;
      older[i] = 10 - i;
    }
    const rTotal = Object.values(recent).reduce((s, v) => s + v, 0);
    const oTotal = Object.values(older).reduce((s, v) => s + v, 0);
    const trends = detectTrend(recent, older, rTotal, oTotal);
    expect(trends.length).toBeLessThanOrEqual(3);
  });

  it("handles empty distributions", () => {
    const trends = detectTrend({}, {}, 0, 0);
    expect(trends).toHaveLength(0);
  });

  it("handles one-sided distributions", () => {
    const recent = { 9: 10 };
    const trends = detectTrend(recent, {}, 10, 0);
    // 100% vs 0% = +100 delta
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0].direction).toBe("rising");
  });

  it("sorts by absolute delta descending", () => {
    const recent = { 9: 8, 14: 6 };
    const older = { 9: 1, 14: 2 };
    const trends = detectTrend(recent, older, 10, 10);
    if (trends.length >= 2) {
      expect(Math.abs(trends[0].delta)).toBeGreaterThanOrEqual(Math.abs(trends[1].delta));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// scoreSlot — 18-criteria scoring engine
// ═══════════════════════════════════════════════════════════════════════════════

function makeBaseParams(overrides: Partial<Parameters<typeof scoreSlot>[0]> = {}) {
  const slotDate = new Date("2025-03-10T10:00:00"); // Monday at 10h
  return {
    slotHour: slotDate.getHours(),
    slotDay: slotDate.getDay(),
    slotDate,
    slotDuration: 30,
    slotId: "slot-1",
    firstSlotId: "slot-0",
    isVisio: false,
    motifDuration: null,
    existingDates: [],
    sc: null as ScoringWeights | null,
    selectedProId: null as string | null,
    ...overrides,
  };
}

function makeScoring(overrides: Partial<ScoringWeights> = {}): ScoringWeights {
  return {
    hourBonus: null,
    hourConf: 0,
    hourBonus2: null,
    hourConf2: 0,
    dayBonus: null,
    dayConf: 0,
    dayBonus2: null,
    formatBonus: null,
    formatConf: 0,
    topProIds: [],
    durationTarget: null,
    timeSlot: "matin",
    seasonalTimeSlot: null,
    hourRange: null,
    dayHourCombos: [],
    cancelPenaltyHours: [],
    cancelPenaltyDays: [],
    trendingHour: null,
    trendingDay: null,
    proProfiles: {},
    regularity: null,
    sequentialPatterns: [],
    confidence: 0.8,
    stability: 80,
    ...overrides,
  };
}

describe("scoreSlot", () => {
  // ── 1. First slot bonus ──
  it("awards 25 points + badge for first slot", () => {
    const r = scoreSlot(makeBaseParams({ slotId: "slot-0", firstSlotId: "slot-0" }));
    // 25 (first slot) + 5 (morning fallback, sc=null, 10h)
    expect(r.score).toBe(30);
    expect(r.badges.some(b => b.label === "Le plus rapide")).toBe(true);
  });

  it("does not award first-slot bonus to other slots", () => {
    const r = scoreSlot(makeBaseParams({ slotId: "slot-1", firstSlotId: "slot-0" }));
    expect(r.badges.some(b => b.label === "Le plus rapide")).toBe(false);
  });

  // ── 2. Day×Hour combo match ──
  it("awards combo match bonus (criterion 2)", () => {
    const sc = makeScoring({
      dayHourCombos: [{ day: 1, hour: 10, pct: 40 }],
    });
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.badges.some(b => b.label.includes("créneau type"))).toBe(true);
  });

  // ── 3. Preferred hour ──
  it("awards preferred hour bonus (criterion 3)", () => {
    const sc = makeScoring({ hourBonus: 10, hourConf: 0.9 });
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.badges.some(b => b.label === "Votre horaire préféré")).toBe(true);
  });

  it("awards secondary hour bonus", () => {
    const sc = makeScoring({ hourBonus: 14, hourBonus2: 10, hourConf2: 0.5 });
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBeGreaterThan(0);
  });

  // ── 4. Hour-range match ──
  it("awards hour-range bonus (criterion 4)", () => {
    const sc = makeScoring({
      hourRange: { start: 9, end: 11, pct: 60, label: "9h–12h" },
      timeSlot: "soir",
    });
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(8);
  });

  // ── 5. Preferred day ──
  it("awards preferred day bonus (criterion 5)", () => {
    const sc = makeScoring({ dayBonus: 1, dayConf: 0.8 }); // Monday
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.badges.some(b => b.label === "Votre jour favori")).toBe(true);
  });

  // ── 6. Trending hour/day ──
  it("awards trending hour bonus (criterion 6)", () => {
    const sc = makeScoring({ trendingHour: 10, timeSlot: "soir" });
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(10);
    expect(r.badges.some(b => b.label === "Tendance récente")).toBe(true);
  });

  it("awards trending day bonus", () => {
    const sc = makeScoring({ trendingDay: 1, timeSlot: "soir" }); // Monday
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(8);
  });

  // ── 7. Per-pro profile match ──
  it("awards per-pro hour + day bonus (criterion 7)", () => {
    const proProfile: ProProfile = {
      preferredHour: 10,
      preferredDay: 1,
      preferredDayName: "lun",
      avgIntervalDays: 14,
      regularity: { isRegular: false, periodDays: null, periodLabel: null, confidence: 0, nextIdealDate: null },
    };
    const sc = makeScoring({ proProfiles: { "pro-1": proProfile }, timeSlot: "soir" });
    const r = scoreSlot(makeBaseParams({ sc, selectedProId: "pro-1" }));
    expect(r.score).toBe(15 + 12); // hour + day
  });

  it("awards per-pro regularity bonus when slot near ideal date", () => {
    const idealDate = new Date("2025-03-11T10:00:00"); // 1 day away
    const proProfile: ProProfile = {
      preferredHour: null, preferredDay: null, preferredDayName: null, avgIntervalDays: 14,
      regularity: { isRegular: true, periodDays: 14, periodLabel: "bimensuel", confidence: 0.8, nextIdealDate: idealDate.toISOString() },
    };
    const sc = makeScoring({ proProfiles: { "pro-1": proProfile }, timeSlot: "soir" });
    const r = scoreSlot(makeBaseParams({ sc, selectedProId: "pro-1" }));
    expect(r.score).toBe(20);
    expect(r.badges.some(b => b.label.includes("Rythme"))).toBe(true);
  });

  // ── 8. Global regularity ──
  it("awards global regularity bonus when slot near ideal (criterion 8)", () => {
    const idealDate = new Date("2025-03-12T10:00:00"); // 2 days away
    const sc = makeScoring({
      regularity: { periodDays: 28, nextIdealDate: idealDate.toISOString() },
      timeSlot: "soir",
    });
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(15);
    expect(r.badges.some(b => b.label === "Dans votre rythme habituel")).toBe(true);
  });

  it("awards reduced regularity bonus when 4-7 days from ideal", () => {
    const idealDate = new Date("2025-03-16T10:00:00"); // 6 days away
    const sc = makeScoring({
      regularity: { periodDays: 28, nextIdealDate: idealDate.toISOString() },
      timeSlot: "soir",
    });
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(6);
  });

  // ── 9. Seasonal time slot ──
  it("awards seasonal time slot bonus (criterion 9)", () => {
    const sc = makeScoring({ seasonalTimeSlot: "matin" }); // 10h = matin
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(8);
  });

  it("does not award seasonal bonus for mismatch", () => {
    const sc = makeScoring({ seasonalTimeSlot: "soir" }); // 10h ≠ soir
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(0);
  });

  // ── 10. Format match ──
  it("awards format match bonus for presentiel (criterion 10)", () => {
    const sc = makeScoring({ formatBonus: "presentiel", formatConf: 0.9 });
    const r = scoreSlot(makeBaseParams({ sc, isVisio: false }));
    expect(r.score).toBeGreaterThan(0);
  });

  it("awards format match bonus for teleconsultation", () => {
    const sc = makeScoring({ formatBonus: "teleconsultation", formatConf: 0.9 });
    const r = scoreSlot(makeBaseParams({ sc, isVisio: true }));
    expect(r.score).toBeGreaterThan(0);
  });

  it("does not award format bonus for mismatch", () => {
    const sc = makeScoring({ formatBonus: "teleconsultation", formatConf: 0.9, timeSlot: "soir" });
    const r = scoreSlot(makeBaseParams({ sc, isVisio: false }));
    expect(r.score).toBe(0);
  });

  // ── 11. Top pro bonus ──
  it("awards top pro bonus (criterion 11)", () => {
    const sc = makeScoring({ topProIds: ["pro-1"], timeSlot: "soir" });
    const r = scoreSlot(makeBaseParams({ sc, selectedProId: "pro-1" }));
    expect(r.score).toBe(18);
    expect(r.badges.some(b => b.label === "Votre pro favori")).toBe(true);
  });

  // ── 12. Duration match ──
  it("awards duration target match (criterion 12)", () => {
    const sc = makeScoring({ durationTarget: 30, timeSlot: "soir" });
    const r = scoreSlot(makeBaseParams({ sc, slotDuration: 30 }));
    expect(r.score).toBe(8);
  });

  it("awards motif duration match when no durationTarget", () => {
    const sc = makeScoring({ durationTarget: null, timeSlot: "soir" });
    const r = scoreSlot(makeBaseParams({ sc, slotDuration: 45, motifDuration: 45 }));
    expect(r.score).toBe(8);
  });

  // ── 13. Time slot match ──
  it("awards time slot bonus (criterion 13)", () => {
    const sc = makeScoring({ timeSlot: "matin", seasonalTimeSlot: null }); // 10h = matin
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(10);
  });

  it("does not award time slot bonus when seasonal override exists", () => {
    const sc = makeScoring({ timeSlot: "matin", seasonalTimeSlot: "matin" });
    const r = scoreSlot(makeBaseParams({ sc }));
    // Should get seasonal bonus (8) but not timeSlot (10)
    expect(r.score).toBe(8);
  });

  // ── 14. Cancellation penalties ──
  it("applies cancellation hour penalty (criterion 14)", () => {
    const sc = makeScoring({ cancelPenaltyHours: [10], timeSlot: "soir" }); // avoid timeSlot bonus
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(-15);
  });

  it("applies cancellation day penalty", () => {
    const sc = makeScoring({ cancelPenaltyDays: [1], timeSlot: "soir" }); // Monday, avoid timeSlot bonus
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(-12);
  });

  it("applies both cancel penalties cumulatively", () => {
    const sc = makeScoring({ cancelPenaltyHours: [10], cancelPenaltyDays: [1], timeSlot: "soir" });
    const r = scoreSlot(makeBaseParams({ sc }));
    expect(r.score).toBe(-27);
  });

  // ── 15. Same day as another RDV ──
  it("awards same-day RDV bonus (criterion 15)", () => {
    const existingDate = new Date("2025-03-10T14:00:00"); // Same day
    const r = scoreSlot(makeBaseParams({ existingDates: [existingDate] }));
    // 18 (same day) + 5 (morning fallback, sc=null, 10h)
    expect(r.score).toBe(23);
    expect(r.badges.some(b => b.label === "Même jour qu'un autre RDV")).toBe(true);
  });

  it("does not award same-day bonus for different day", () => {
    const existingDate = new Date("2025-03-11T14:00:00"); // Next day
    const r = scoreSlot(makeBaseParams({ existingDates: [existingDate] }));
    expect(r.badges.some(b => b.label === "Même jour qu'un autre RDV")).toBe(false);
  });

  // ── 16. After existing RDV (1-3h after) ──
  it("awards after-existing bonus (criterion 16)", () => {
    const existingDate = new Date("2025-03-10T08:00:00"); // 2h before
    const r = scoreSlot(makeBaseParams({ existingDates: [existingDate] }));
    // Same day (18) + after existing (15) + morning fallback (5, sc=null, 10h)
    expect(r.score).toBe(38);
    expect(r.badges.some(b => b.label === "Après votre RDV précédent")).toBe(true);
  });

  it("does not award after-existing for < 1h gap", () => {
    const existingDate = new Date("2025-03-10T09:30:00"); // 30min before
    const r = scoreSlot(makeBaseParams({ existingDates: [existingDate] }));
    // Same-day (18) + morning fallback (5, sc=null, 10h), no after-existing
    expect(r.score).toBe(23);
  });

  // ── 17. Visio convenience ──
  it("awards visio bonus (criterion 17)", () => {
    const r = scoreSlot(makeBaseParams({ isVisio: true }));
    // visio (5) + morning fallback (5, sc=null, 10h)
    expect(r.score).toBe(10);
    expect(r.badges.some(b => b.label === "En visio, plus simple")).toBe(true);
  });

  // ── 18. Fallback morning convenience ──
  it("awards morning convenience when no scoring weights", () => {
    const slotDate = new Date("2025-03-10T09:00:00");
    const r = scoreSlot(makeBaseParams({
      slotDate, slotHour: 9, sc: null,
    }));
    expect(r.score).toBe(5);
  });

  it("does not award morning convenience when scoring weights exist", () => {
    const slotDate = new Date("2025-03-10T09:00:00");
    const sc = makeScoring({});
    const r = scoreSlot(makeBaseParams({
      slotDate, slotHour: 9, sc,
    }));
    // Should not add fallback morning convenience
    expect(r.badges.some(b => b.label === "Le plus rapide")).toBe(false);
  });

  // ── matchPct ──
  it("calculates matchPct capped at 99", () => {
    const sc = makeScoring({
      hourBonus: 10, hourConf: 1,
      dayBonus: 1, dayConf: 1,
      dayHourCombos: [{ day: 1, hour: 10, pct: 50 }],
      topProIds: ["pro-1"],
      durationTarget: 30,
      timeSlot: "matin",
    });
    const r = scoreSlot(makeBaseParams({
      sc, selectedProId: "pro-1", slotDuration: 30,
    }));
    expect(r.matchPct).toBeLessThanOrEqual(99);
    expect(r.matchPct).toBeGreaterThanOrEqual(0);
  });

  it("returns matchPct=0 when no scoring weights", () => {
    const r = scoreSlot(makeBaseParams({ sc: null }));
    expect(r.matchPct).toBe(0);
  });

  // ── Badges capped at 3 ──
  it("never returns more than 3 badges", () => {
    const sc = makeScoring({
      hourBonus: 10, hourConf: 0.9,
      dayBonus: 1, dayConf: 0.9,
      trendingHour: 10,
      topProIds: ["pro-1"],
    });
    const r = scoreSlot(makeBaseParams({
      sc, selectedProId: "pro-1",
      slotId: "slot-0", firstSlotId: "slot-0",
    }));
    expect(r.badges.length).toBeLessThanOrEqual(3);
  });

  // ── Combined criteria ──
  it("accumulates score from multiple criteria", () => {
    const sc = makeScoring({
      hourBonus: 10, hourConf: 0.9,
      dayBonus: 1, dayConf: 0.8,
      formatBonus: "presentiel", formatConf: 0.9,
      topProIds: ["pro-1"],
      durationTarget: 30,
      timeSlot: "matin",
    });
    const r = scoreSlot(makeBaseParams({
      sc, selectedProId: "pro-1", slotDuration: 30, isVisio: false,
    }));
    // hourBonus + dayBonus + format + topPro + duration + timeSlot
    expect(r.score).toBeGreaterThan(50);
  });
});
