import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DAY_MS,
  quickBookBonus,
  type QuickBookContext,
  buildEngagementInsight,
  buildCancelRateInsight,
  buildBookingDelayInsight,
  computeFallbackIdealDate,
  motifToComplaint,
  scoreSlot,
  type ScoringWeights,
  type ProProfile,
} from "./scoring";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeCtx(overrides: Partial<QuickBookContext> = {}): QuickBookContext {
  return {
    cancelRiskHours: new Set(),
    cancelRiskDays: new Set(),
    trendingHours: new Set(),
    trendingDays: new Set(),
    velocity: null,
    idealDate: null,
    avgBookingDelay: null,
    hourRange: null,
    dayHourCombos: [],
    ...overrides,
  };
}

function futureDate(daysFromNow: number, hour = 10): Date {
  const d = new Date(Date.now() + daysFromNow * DAY_MS);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function makeScoring(overrides: Partial<ScoringWeights> = {}): ScoringWeights {
  return {
    hourBonus: null, hourConf: 0, hourBonus2: null, hourConf2: 0,
    dayBonus: null, dayConf: 0, dayBonus2: null,
    formatBonus: null, formatConf: 0, topProIds: [],
    durationTarget: null, timeSlot: "matin", seasonalTimeSlot: null,
    hourRange: null, dayHourCombos: [], cancelPenaltyHours: [],
    cancelPenaltyDays: [], trendingHour: null, trendingDay: null,
    proProfiles: {}, regularity: null, sequentialPatterns: [],
    confidence: 0.8, stability: 80,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// quickBookBonus — Cancel-risk avoidance
// ═══════════════════════════════════════════════════════════════════════════════

describe("quickBookBonus — cancel-risk avoidance", () => {
  it("penalizes cancel-risk hour by -20", () => {
    const slot = futureDate(3, 14);
    const ctx = makeCtx({ cancelRiskHours: new Set([14]) });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 14, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(-20);
  });

  it("penalizes cancel-risk day by -15", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ cancelRiskDays: new Set([slot.getDay()]) });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(-15);
  });

  it("cumulates hour + day cancel penalties", () => {
    const slot = futureDate(3, 14);
    const ctx = makeCtx({
      cancelRiskHours: new Set([14]),
      cancelRiskDays: new Set([slot.getDay()]),
    });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 14, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(-35);
  });

  it("does not penalize non-risky hour/day", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ cancelRiskHours: new Set([18]), cancelRiskDays: new Set([0]) });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    // No penalty applied (only trending/combo/etc could add, but ctx is minimal)
    expect(bonus).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// quickBookBonus — Trending hour/day
// ═══════════════════════════════════════════════════════════════════════════════

describe("quickBookBonus — trending", () => {
  it("awards +12 for trending hour", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ trendingHours: new Set([10]) });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(12);
  });

  it("awards +8 for trending day", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ trendingDays: new Set([slot.getDay()]) });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(8);
  });

  it("cumulates trending hour + day", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({
      trendingHours: new Set([10]),
      trendingDays: new Set([slot.getDay()]),
    });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(20);
  });

  it("does not award trending for non-matching hour/day", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ trendingHours: new Set([18]), trendingDays: new Set([0]) });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// quickBookBonus — Velocity urgency
// ═══════════════════════════════════════════════════════════════════════════════

describe("quickBookBonus — velocity urgency", () => {
  it("awards +18 for last-minute booker with slot ≤2 days away", () => {
    const slot = futureDate(1, 10);
    const ctx = makeCtx({ velocity: "last-minute" });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(18);
  });

  it("awards +10 for spontane booker with slot 3-5 days away", () => {
    const slot = futureDate(4, 10);
    const ctx = makeCtx({ velocity: "spontane" });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(10);
  });

  it("awards 0 for last-minute booker with slot >5 days away", () => {
    const slot = futureDate(10, 10);
    const ctx = makeCtx({ velocity: "last-minute" });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });

  it("awards +12 for anticipateur with slot 7-21 days away", () => {
    const slot = futureDate(14, 10);
    const ctx = makeCtx({ velocity: "anticipateur" });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(12);
  });

  it("awards 0 for anticipateur with slot <7 days away", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ velocity: "anticipateur" });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });

  it("awards 0 for anticipateur with slot >21 days away", () => {
    const slot = futureDate(25, 10);
    const ctx = makeCtx({ velocity: "anticipateur" });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });

  it("awards 0 for planificateur (neutral velocity)", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ velocity: "planificateur" });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });

  it("awards 0 for null velocity", () => {
    const slot = futureDate(1, 10);
    const ctx = makeCtx({ velocity: null });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// quickBookBonus — Regularity proximity
// ═══════════════════════════════════════════════════════════════════════════════

describe("quickBookBonus — regularity proximity", () => {
  it("awards +25 for slot within 1 day of ideal date", () => {
    const ideal = futureDate(5, 10);
    const slot = futureDate(5, 14);
    const ctx = makeCtx({ idealDate: ideal });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 14, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(25);
  });

  it("awards +15 for slot 2-3 days from ideal date", () => {
    const ideal = futureDate(5, 10);
    const slot = futureDate(7, 10);
    const ctx = makeCtx({ idealDate: ideal });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(15);
  });

  it("awards +5 for slot 4-7 days from ideal date", () => {
    const ideal = futureDate(5, 10);
    const slot = futureDate(10, 10);
    const ctx = makeCtx({ idealDate: ideal });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(5);
  });

  it("penalizes -10 for slot >14 days from ideal date", () => {
    const ideal = futureDate(5, 10);
    const slot = futureDate(25, 10);
    const ctx = makeCtx({ idealDate: ideal });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(-10);
  });

  it("awards 0 when no ideal date", () => {
    const slot = futureDate(5, 10);
    const ctx = makeCtx({ idealDate: null });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// quickBookBonus — Day×Hour combo
// ═══════════════════════════════════════════════════════════════════════════════

describe("quickBookBonus — day×hour combo", () => {
  it("awards +15 for matching day×hour combo", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ dayHourCombos: [{ day: slot.getDay(), hour: 10, pct: 40 }] });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(15);
  });

  it("does not award for non-matching combo", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ dayHourCombos: [{ day: 0, hour: 18, pct: 40 }] });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });

  it("matches day but not hour → no bonus", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ dayHourCombos: [{ day: slot.getDay(), hour: 16, pct: 40 }] });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// quickBookBonus — Hour range
// ═══════════════════════════════════════════════════════════════════════════════

describe("quickBookBonus — hour range", () => {
  it("awards +6 for slot within hour range", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ hourRange: { start: 9, end: 12 } });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(6);
  });

  it("does not award for slot outside hour range", () => {
    const slot = futureDate(3, 16);
    const ctx = makeCtx({ hourRange: { start: 9, end: 12 } });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 16, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });

  it("awards at range boundaries (start)", () => {
    const slot = futureDate(3, 9);
    const ctx = makeCtx({ hourRange: { start: 9, end: 12 } });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 9, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(6);
  });

  it("awards at range boundaries (end)", () => {
    const slot = futureDate(3, 12);
    const ctx = makeCtx({ hourRange: { start: 9, end: 12 } });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 12, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(6);
  });

  it("awards 0 when no hour range", () => {
    const slot = futureDate(3, 10);
    const ctx = makeCtx({ hourRange: null });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// quickBookBonus — Booking delay alignment
// ═══════════════════════════════════════════════════════════════════════════════

describe("quickBookBonus — booking delay alignment", () => {
  it("awards +10 when slot is within 2 days of avg delay", () => {
    const slot = futureDate(5, 10);
    const ctx = makeCtx({ avgBookingDelay: 5 });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(10);
  });

  it("awards +4 when slot is within 3-5 days of avg delay", () => {
    const slot = futureDate(9, 10);
    const ctx = makeCtx({ avgBookingDelay: 5 });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(4);
  });

  it("awards 0 when slot is >5 days from avg delay", () => {
    const slot = futureDate(20, 10);
    const ctx = makeCtx({ avgBookingDelay: 5 });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });

  it("awards 0 when no avgBookingDelay", () => {
    const slot = futureDate(5, 10);
    const ctx = makeCtx({ avgBookingDelay: null });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// quickBookBonus — Combined signals
// ═══════════════════════════════════════════════════════════════════════════════

describe("quickBookBonus — combined signals", () => {
  it("stacks all positive signals", () => {
    const slot = futureDate(1, 10);
    const ctx = makeCtx({
      trendingHours: new Set([10]),
      trendingDays: new Set([slot.getDay()]),
      velocity: "last-minute",
      idealDate: futureDate(1, 10),
      dayHourCombos: [{ day: slot.getDay(), hour: 10, pct: 50 }],
      hourRange: { start: 9, end: 12 },
      avgBookingDelay: 1,
    });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    // trending hour (12) + trending day (8) + velocity (18) + ideal ≤1d (25) + combo (15) + range (6) + delay (10)
    expect(bonus).toBe(94);
  });

  it("cancel risk negates positive signals", () => {
    const slot = futureDate(3, 14);
    const ctx = makeCtx({
      cancelRiskHours: new Set([14]),
      cancelRiskDays: new Set([slot.getDay()]),
      trendingHours: new Set([14]),
    });
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 14, slotDay: slot.getDay(), ctx });
    // cancel hour (-20) + cancel day (-15) + trending hour (12) = -23
    expect(bonus).toBe(-23);
  });

  it("empty context yields 0 bonus", () => {
    const slot = futureDate(8, 10);
    const ctx = makeCtx();
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 10, slotDay: slot.getDay(), ctx });
    expect(bonus).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildEngagementInsight
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildEngagementInsight", () => {
  it("returns alert for >60 days since last RDV", () => {
    const ins = buildEngagementInsight({ level: "inactif", recent90: 0, prev90: 2, daysSinceLast: 90 });
    expect(ins).not.toBeNull();
    expect(ins!.icon).toBe("alert");
    expect(ins!.label).toContain("90 jours");
  });

  it("returns star for active patient with >3 recent RDV", () => {
    const ins = buildEngagementInsight({ level: "actif", recent90: 5, prev90: 3, daysSinceLast: 10 });
    expect(ins).not.toBeNull();
    expect(ins!.icon).toBe("star");
    expect(ins!.label).toContain("5 RDV");
  });

  it("returns null for moderate engagement", () => {
    const ins = buildEngagementInsight({ level: "regulier", recent90: 2, prev90: 2, daysSinceLast: 30 });
    expect(ins).toBeNull();
  });

  it("returns null for active with exactly 3 recent", () => {
    const ins = buildEngagementInsight({ level: "actif", recent90: 3, prev90: 2, daysSinceLast: 10 });
    expect(ins).toBeNull();
  });

  it("prioritizes alert over star for inactive + high recent", () => {
    // daysSinceLast > 60 should trigger alert even with high recent90
    const ins = buildEngagementInsight({ level: "actif", recent90: 10, prev90: 5, daysSinceLast: 100 });
    expect(ins!.icon).toBe("alert");
  });

  it("returns null when daysSinceLast is null", () => {
    const ins = buildEngagementInsight({ level: "inactif", recent90: 0, prev90: 0, daysSinceLast: null });
    expect(ins).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildCancelRateInsight
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildCancelRateInsight", () => {
  it("returns shield insight for ≥20% cancel rate", () => {
    const ins = buildCancelRateInsight(5, 20); // 25%
    expect(ins).not.toBeNull();
    expect(ins!.icon).toBe("shield");
    expect(ins!.label).toContain("25%");
    expect(ins!.label).toContain("5/20");
  });

  it("returns null for <20% cancel rate", () => {
    const ins = buildCancelRateInsight(1, 20); // 5%
    expect(ins).toBeNull();
  });

  it("returns null for ≤3 total appointments", () => {
    const ins = buildCancelRateInsight(2, 3);
    expect(ins).toBeNull();
  });

  it("returns null for 0 cancellations", () => {
    const ins = buildCancelRateInsight(0, 10);
    expect(ins).toBeNull();
  });

  it("handles exact 20% threshold", () => {
    const ins = buildCancelRateInsight(2, 10); // 20%
    expect(ins).not.toBeNull();
    expect(ins!.label).toContain("20%");
  });

  it("handles 100% cancel rate", () => {
    const ins = buildCancelRateInsight(10, 10);
    expect(ins).not.toBeNull();
    expect(ins!.label).toContain("100%");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildBookingDelayInsight
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildBookingDelayInsight", () => {
  it("returns zap for ≤3 day delay (last-minute booker)", () => {
    const ins = buildBookingDelayInsight(2);
    expect(ins).not.toBeNull();
    expect(ins!.icon).toBe("zap");
    expect(ins!.label).toContain("2j");
  });

  it("returns calendar for ≥14 day delay (planner)", () => {
    const ins = buildBookingDelayInsight(21);
    expect(ins).not.toBeNull();
    expect(ins!.icon).toBe("calendar");
    expect(ins!.label).toContain("21j");
  });

  it("returns null for moderate delay (4-13 days)", () => {
    expect(buildBookingDelayInsight(7)).toBeNull();
    expect(buildBookingDelayInsight(10)).toBeNull();
  });

  it("returns null for null delay", () => {
    expect(buildBookingDelayInsight(null)).toBeNull();
  });

  it("returns null for 0 delay", () => {
    expect(buildBookingDelayInsight(0)).toBeNull();
  });

  it("returns null for negative delay", () => {
    expect(buildBookingDelayInsight(-5)).toBeNull();
  });

  it("rounds delay to nearest integer", () => {
    const ins = buildBookingDelayInsight(2.7);
    expect(ins!.label).toContain("3j");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeFallbackIdealDate
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeFallbackIdealDate", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns future ideal date based on interval", () => {
    const now = new Date("2025-06-01T12:00:00Z");
    vi.setSystemTime(now);
    // Last visit 10 days ago, avg interval 30 days → ideal = 20 days from now
    const ideal = computeFallbackIdealDate(30, 10);
    expect(ideal).not.toBeNull();
    const expectedIdeal = new Date(now.getTime() + 20 * DAY_MS);
    expect(Math.abs(ideal!.getTime() - expectedIdeal.getTime())).toBeLessThan(DAY_MS);
  });

  it("clamps to now when ideal date is in the past", () => {
    const now = new Date("2025-06-01T12:00:00Z");
    vi.setSystemTime(now);
    // Last visit 60 days ago, avg interval 30 days → ideal = 30 days ago → clamp to now
    const ideal = computeFallbackIdealDate(30, 60);
    expect(ideal).not.toBeNull();
    expect(ideal!.getTime()).toBeCloseTo(now.getTime(), -3);
  });

  it("returns null for zero interval", () => {
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    expect(computeFallbackIdealDate(0, 10)).toBeNull();
  });

  it("returns null for negative interval", () => {
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    expect(computeFallbackIdealDate(-10, 10)).toBeNull();
  });

  it("rounds interval to nearest day", () => {
    const now = new Date("2025-06-01T12:00:00Z");
    vi.setSystemTime(now);
    const ideal = computeFallbackIdealDate(14.7, 5); // rounds to 15
    expect(ideal).not.toBeNull();
    const expectedIdeal = new Date(now.getTime() + 10 * DAY_MS);
    expect(Math.abs(ideal!.getTime() - expectedIdeal.getTime())).toBeLessThan(DAY_MS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// motifToComplaint
// ═══════════════════════════════════════════════════════════════════════════════

describe("motifToComplaint", () => {
  it("maps known motif IDs to complaints", () => {
    expect(motifToComplaint("suivi", "Suivi")).toBe("Consultation de suivi");
    expect(motifToComplaint("bilan-initial", "Bilan Initial")).toBe("Bilan initial");
    expect(motifToComplaint("douleur", "Douleur")).toBe("Douleur à préciser");
    expect(motifToComplaint("urgence", "Urgence")).toBe("Consultation urgente");
    expect(motifToComplaint("nutrition", "Nutrition")).toBe("Consultation nutrition");
    expect(motifToComplaint("recuperation", "Récup")).toBe("Récupération");
    expect(motifToComplaint("performance", "Perf")).toBe("Optimisation performance");
    expect(motifToComplaint("preparation-physique", "Prep")).toBe("Préparation physique");
  });

  it("falls back to motifLabel for unknown motif ID", () => {
    expect(motifToComplaint("unknown-motif", "Mon motif custom")).toBe("Mon motif custom");
  });

  it("falls back to motifLabel for empty string motif ID", () => {
    expect(motifToComplaint("", "Label")).toBe("Label");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Integration: scoreSlot + quickBookBonus combined scoring
// ═══════════════════════════════════════════════════════════════════════════════

describe("Integration: scoreSlot + quickBookBonus", () => {
  it("quick-book bonus boosts score beyond base scoring alone", () => {
    const slotDate = new Date("2025-03-10T10:00:00"); // Monday 10h
    const sc = makeScoring({ hourBonus: 10, hourConf: 0.9, timeSlot: "matin" });

    const base = scoreSlot({
      slotHour: 10, slotDay: 1, slotDate, slotDuration: 30,
      slotId: "s1", firstSlotId: "s0", isVisio: false,
      motifDuration: null, existingDates: [], sc, selectedProId: null,
    });

    const ctx = makeCtx({
      trendingHours: new Set([10]),
      hourRange: { start: 9, end: 12 },
      dayHourCombos: [{ day: 1, hour: 10, pct: 50 }],
    });
    const bonus = quickBookBonus({ slotDate, slotHour: 10, slotDay: 1, ctx });

    expect(bonus).toBeGreaterThan(0);
    expect(base.score + bonus).toBeGreaterThan(base.score);
  });

  it("cancel-risk bonus can make a top-scoring slot score lower", () => {
    const slotDate = new Date("2025-03-10T14:00:00"); // Monday 14h
    const sc = makeScoring({
      hourBonus: 14, hourConf: 0.9,
      dayBonus: 1, dayConf: 0.8,
      timeSlot: "apresMidi",
    });

    const base = scoreSlot({
      slotHour: 14, slotDay: 1, slotDate, slotDuration: 30,
      slotId: "s1", firstSlotId: "s0", isVisio: false,
      motifDuration: null, existingDates: [], sc, selectedProId: null,
    });

    const ctxRisky = makeCtx({
      cancelRiskHours: new Set([14]),
      cancelRiskDays: new Set([1]),
    });
    const bonusRisky = quickBookBonus({ slotDate, slotHour: 14, slotDay: 1, ctx: ctxRisky });

    const ctxSafe = makeCtx();
    const bonusSafe = quickBookBonus({ slotDate, slotHour: 14, slotDay: 1, ctx: ctxSafe });

    expect(base.score + bonusRisky).toBeLessThan(base.score + bonusSafe);
  });

  it("slot ranking changes with quick-book context", () => {
    const sc = makeScoring({ timeSlot: "soir" });

    // Slot A: Monday 10h, near ideal date
    const slotA = new Date("2025-03-10T10:00:00");
    const baseA = scoreSlot({
      slotHour: 10, slotDay: 1, slotDate: slotA, slotDuration: 30,
      slotId: "a", firstSlotId: "a", isVisio: false,
      motifDuration: null, existingDates: [], sc, selectedProId: null,
    });

    // Slot B: Tuesday 14h, far from ideal, cancel risk
    const slotB = new Date("2025-03-11T14:00:00");
    const baseB = scoreSlot({
      slotHour: 14, slotDay: 2, slotDate: slotB, slotDuration: 30,
      slotId: "b", firstSlotId: "a", isVisio: false,
      motifDuration: null, existingDates: [], sc, selectedProId: null,
    });

    // Without bonus: A wins because it's the first slot
    expect(baseA.score).toBeGreaterThan(baseB.score);

    // With bonus: A should win even more
    const ctx = makeCtx({
      idealDate: new Date("2025-03-10T12:00:00"),
      cancelRiskHours: new Set([14]),
      trendingHours: new Set([10]),
    });

    const bonusA = quickBookBonus({ slotDate: slotA, slotHour: 10, slotDay: 1, ctx });
    const bonusB = quickBookBonus({ slotDate: slotB, slotHour: 14, slotDay: 2, ctx });

    expect(baseA.score + bonusA).toBeGreaterThan(baseB.score + bonusB);
    // B should be penalized by cancel risk
    expect(bonusB).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Realistic patient scenarios
// ═══════════════════════════════════════════════════════════════════════════════

describe("Realistic patient scenarios", () => {
  it("Scenario: régulier mensuel qui consulte le mercredi matin", () => {
    const sc = makeScoring({
      hourBonus: 10, hourConf: 0.85,
      dayBonus: 3, dayConf: 0.8, // Wednesday
      dayHourCombos: [{ day: 3, hour: 10, pct: 45 }],
      timeSlot: "matin",
      regularity: { periodDays: 28, nextIdealDate: "2025-03-12T10:00:00" },
      confidence: 0.85,
      stability: 75,
    });

    // Perfect slot: Wed 10h near ideal date
    const perfect = new Date("2025-03-12T10:00:00");
    const rPerfect = scoreSlot({
      slotHour: 10, slotDay: 3, slotDate: perfect, slotDuration: 30,
      slotId: "p", firstSlotId: "x", isVisio: false,
      motifDuration: null, existingDates: [], sc, selectedProId: null,
    });

    // Mediocre slot: Fri 16h far from ideal
    const mediocre = new Date("2025-03-28T16:00:00");
    const rMediocre = scoreSlot({
      slotHour: 16, slotDay: 5, slotDate: mediocre, slotDuration: 30,
      slotId: "m", firstSlotId: "x", isVisio: false,
      motifDuration: null, existingDates: [], sc, selectedProId: null,
    });

    // Perfect slot should score much higher
    expect(rPerfect.score).toBeGreaterThan(rMediocre.score);
    expect(rPerfect.score).toBeGreaterThan(50);
    expect(rPerfect.badges.length).toBeGreaterThanOrEqual(1);

    // With quick-book bonus, the gap should widen
    const ctx = makeCtx({
      idealDate: new Date("2025-03-12T10:00:00"),
      dayHourCombos: [{ day: 3, hour: 10, pct: 45 }],
      hourRange: { start: 9, end: 12 },
    });
    const bPerfect = quickBookBonus({ slotDate: perfect, slotHour: 10, slotDay: 3, ctx });
    const bMediocre = quickBookBonus({ slotDate: mediocre, slotHour: 16, slotDay: 5, ctx });

    expect(bPerfect).toBeGreaterThan(bMediocre);
    expect(rPerfect.score + bPerfect).toBeGreaterThan(rMediocre.score + bMediocre + 30);
  });

  it("Scenario: patient spontané qui annule souvent le vendredi soir", () => {
    const sc = makeScoring({
      cancelPenaltyHours: [18, 19],
      cancelPenaltyDays: [5], // Friday
      timeSlot: "matin",
      confidence: 0.7,
      stability: 50,
    });

    // Risky slot: Friday 18h
    const risky = new Date("2025-03-14T18:00:00"); // Friday
    const rRisky = scoreSlot({
      slotHour: 18, slotDay: 5, slotDate: risky, slotDuration: 30,
      slotId: "r", firstSlotId: "x", isVisio: false,
      motifDuration: null, existingDates: [], sc, selectedProId: null,
    });

    // Safe slot: Tuesday 10h
    const safe = new Date("2025-03-11T10:00:00"); // Tuesday
    const rSafe = scoreSlot({
      slotHour: 10, slotDay: 2, slotDate: safe, slotDuration: 30,
      slotId: "s", firstSlotId: "x", isVisio: false,
      motifDuration: null, existingDates: [], sc, selectedProId: null,
    });

    // Risky should score negative, safe should score positive
    expect(rRisky.score).toBeLessThan(0);
    expect(rSafe.score).toBeGreaterThan(rRisky.score);

    // Quick-book layer amplifies the gap
    const ctx = makeCtx({
      cancelRiskHours: new Set([18, 19]),
      cancelRiskDays: new Set([5]),
      velocity: "spontane",
    });
    const bRisky = quickBookBonus({ slotDate: risky, slotHour: 18, slotDay: 5, ctx });
    const bSafe = quickBookBonus({ slotDate: safe, slotHour: 10, slotDay: 2, ctx });

    expect(bRisky).toBeLessThan(0);
    expect(bSafe).toBeGreaterThanOrEqual(0);
  });

  it("Scenario: pro-specific patient with per-pro regularity", () => {
    const proProfile: ProProfile = {
      preferredHour: 9,
      preferredDay: 2, // Tuesday
      preferredDayName: "mar",
      avgIntervalDays: 14,
      regularity: {
        isRegular: true, periodDays: 14, periodLabel: "bimensuel",
        confidence: 0.85, nextIdealDate: "2025-03-18T09:00:00",
      },
    };
    const sc = makeScoring({
      proProfiles: { "pro-abc": proProfile },
      topProIds: ["pro-abc"],
      timeSlot: "matin",
      confidence: 0.85,
      stability: 80,
    });

    // Perfect: Tuesday 9h near ideal date with this pro
    const perfect = new Date("2025-03-18T09:00:00");
    const rPerfect = scoreSlot({
      slotHour: 9, slotDay: 2, slotDate: perfect, slotDuration: 30,
      slotId: "p", firstSlotId: "x", isVisio: false,
      motifDuration: null, existingDates: [], sc, selectedProId: "pro-abc",
    });

    // Should get pro hour (15) + pro day (12) + pro regularity (20) + top pro (18) + timeSlot (10)
    expect(rPerfect.score).toBeGreaterThanOrEqual(70);
    expect(rPerfect.badges.some(b => b.label.includes("Rythme"))).toBe(true);
  });

  it("Scenario: new patient with no learned preferences", () => {
    // No scoring weights → fallback morning convenience only
    const slot = new Date("2025-03-10T09:00:00");
    const r = scoreSlot({
      slotHour: 9, slotDay: 1, slotDate: slot, slotDuration: 30,
      slotId: "s1", firstSlotId: "s1", isVisio: false,
      motifDuration: null, existingDates: [], sc: null, selectedProId: null,
    });
    // First slot (25) + morning fallback (5) = 30
    expect(r.score).toBe(30);
    expect(r.matchPct).toBe(0); // No scoring weights → 0%
    expect(r.badges.some(b => b.label === "Le plus rapide")).toBe(true);

    // Quick-book bonus with empty context
    const bonus = quickBookBonus({ slotDate: slot, slotHour: 9, slotDay: 1, ctx: makeCtx() });
    expect(bonus).toBe(0);
  });

  it("Scenario: patient who groups appointments on same day", () => {
    const existingRdv = new Date("2025-03-10T14:00:00");
    const slotAfter = new Date("2025-03-10T16:00:00"); // 2h after
    const slotOtherDay = new Date("2025-03-11T10:00:00");

    const rAfter = scoreSlot({
      slotHour: 16, slotDay: 1, slotDate: slotAfter, slotDuration: 30,
      slotId: "a", firstSlotId: "x", isVisio: false,
      motifDuration: null, existingDates: [existingRdv], sc: null, selectedProId: null,
    });

    const rOther = scoreSlot({
      slotHour: 10, slotDay: 2, slotDate: slotOtherDay, slotDuration: 30,
      slotId: "b", firstSlotId: "x", isVisio: false,
      motifDuration: null, existingDates: [existingRdv], sc: null, selectedProId: null,
    });

    // Same day + after existing → higher score
    expect(rAfter.score).toBeGreaterThan(rOther.score);
    expect(rAfter.badges.some(b => b.label === "Même jour qu'un autre RDV")).toBe(true);
    expect(rAfter.badges.some(b => b.label === "Après votre RDV précédent")).toBe(true);
  });
});
