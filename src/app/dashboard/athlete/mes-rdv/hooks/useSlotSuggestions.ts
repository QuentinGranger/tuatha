"use client";

import { useMemo } from "react";
import { scoreSlot } from "@/lib/scoring";
import type {
  AvailableSlot, SuggestedSlot, NextRdv, Motif, ProInfo, LearnedPreferences,
} from "../types";

interface UseSlotSuggestionsParams {
  availableSlots: AvailableSlot[];
  appointments: NextRdv[];
  selectedFormat: "presentiel" | "teleconsultation" | null;
  selectedMotif: Motif | null;
  selectedPro: ProInfo | null;
  learnedPrefs: LearnedPreferences | null;
}

export function useSlotSuggestions({
  availableSlots, appointments, selectedFormat, selectedMotif, selectedPro, learnedPrefs,
}: UseSlotSuggestionsParams): SuggestedSlot[] {
  return useMemo(() => {
    if (availableSlots.length === 0) return [];

    const suggestions: SuggestedSlot[] = [];
    const existingDates = appointments.map((a) => new Date(a.date));
    const isVisio = selectedFormat === "teleconsultation";
    const motifDuration = selectedMotif?.duration
      ? parseInt(selectedMotif.duration.replace(/\D/g, ""), 10)
      : null;
    const sc = learnedPrefs?.scoring ?? null;
    const conf = sc?.confidence ?? 0;
    const firstSlotId = availableSlots[0]?.id ?? "";

    for (const slot of availableSlots) {
      // ── Criteria 1-18: delegate to the pure scoring engine ──
      const result = scoreSlot({
        slotHour: slot.date.getHours(),
        slotDay: slot.date.getDay(),
        slotDate: slot.date,
        slotDuration: slot.duration,
        slotId: slot.id,
        firstSlotId,
        isVisio,
        motifDuration,
        existingDates,
        sc,
        selectedProId: selectedPro?.id ?? null,
      });

      let { score } = result;
      const badges = [...result.badges];

      // ── 19. Engagement boost: re-engage inactive/declining users ──
      if (learnedPrefs?.engagement) {
        const eng = learnedPrefs.engagement;
        if (eng.level === "inactif") {
          if (slot.id === availableSlots[0]?.id) score += 20;
          else if (slot.id === availableSlots[1]?.id) score += 12;
          else if (slot.id === availableSlots[2]?.id) score += 6;
        } else if (eng.level === "en-baisse") {
          if (slot.id === availableSlots[0]?.id) score += 10;
          else if (slot.id === availableSlots[1]?.id) score += 5;
        }
      }

      if (badges.length > 0 || score > 15) {
        const matchPct = result.matchPct;
        suggestions.push({ slot, badges: badges.slice(0, 3), score, matchPct });
      }
    }

    // Sort by score descending, take top 4
    suggestions.sort((a, b) => b.score - a.score);

    // Mark the top-scoring one as "Recommandé" with confidence label
    if (suggestions.length > 0 && !suggestions[0].badges.some((b) => b.label === "Le plus rapide")) {
      const matchPct = suggestions[0].matchPct || 0;
      const confLabel = matchPct >= 80 ? `${matchPct}% match · Fortement recommandé`
        : matchPct >= 50 ? `${matchPct}% match · Recommandé`
        : conf >= 0.3 ? "Suggestion" : "Suggestion";
      suggestions[0].badges.unshift({
        label: confLabel, icon: "star",
        color: matchPct >= 80 ? "#10b981" : matchPct >= 50 ? "#f59e0b" : "#94a3b8",
      });
      if (suggestions[0].badges.length > 3) suggestions[0].badges.pop();
    }

    return suggestions.slice(0, 4);
  }, [availableSlots, appointments, selectedFormat, selectedMotif, selectedPro, learnedPrefs]);
}
