"use client";

import { useMemo } from "react";
import type {
  BookingWarning, BookingStep, AvailableSlot, Motif, ProInfo,
  NextRdv, MyConnection, AthleteProfile,
} from "../types";
import { getMatchScore, ALL_MOTIFS } from "../constants";

interface UseBookingWarningsParams {
  step: BookingStep;
  selectedSlot: AvailableSlot | null;
  selectedPro: ProInfo | null;
  selectedMotif: Motif | null;
  selectedNeed: string | null;
  selectedFormat: "presentiel" | "teleconsultation" | null;
  appointments: NextRdv[];
  connections: MyConnection[];
  athleteProfile: AthleteProfile | null;
  formDocs: Set<string>;
  setStep: (s: BookingStep) => void;
  setSelectedPro: (p: ProInfo | null) => void;
}

export function useBookingWarnings({
  step, selectedSlot, selectedPro, selectedMotif, selectedNeed,
  appointments, connections, athleteProfile, formDocs,
  setStep, setSelectedPro,
}: UseBookingWarningsParams): BookingWarning[] {
  return useMemo(() => {
    if (step !== "summary" || !selectedSlot || !selectedPro || !selectedMotif) return [];

    const warnings: BookingWarning[] = [];
    const slotStart = selectedSlot.date.getTime();
    const slotEnd = slotStart + (selectedSlot.duration || 30) * 60 * 1000;

    // 1. Exact conflict with existing appointment
    for (const rdv of appointments) {
      const rdvStart = new Date(rdv.date).getTime();
      const rdvEnd = rdv.endDate
        ? new Date(rdv.endDate).getTime()
        : rdvStart + 30 * 60 * 1000;

      if (slotStart < rdvEnd && slotEnd > rdvStart) {
        warnings.push({
          id: "conflict",
          level: "error",
          message: "Conflit avec un rendez-vous existant",
          detail: `Vous avez déjà un rendez-vous avec ${rdv.pro.prenom} ${rdv.pro.nom} le ${new Date(rdv.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${new Date(rdv.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`,
          action: { label: "Changer de créneau", onClick: () => setStep("choose-slot") },
        });
        break;
      }
    }

    // 2. Too close to another appointment (< 1h gap)
    if (!warnings.some((w) => w.id === "conflict")) {
      for (const rdv of appointments) {
        const rdvStart = new Date(rdv.date).getTime();
        const rdvEnd = rdv.endDate
          ? new Date(rdv.endDate).getTime()
          : rdvStart + 30 * 60 * 1000;

        const gapBefore = slotStart - rdvEnd;
        const gapAfter = rdvStart - slotEnd;
        const minGap = Math.min(
          gapBefore > 0 ? gapBefore : Infinity,
          gapAfter > 0 ? gapAfter : Infinity
        );

        if (minGap < 60 * 60 * 1000 && minGap > 0) {
          const minutes = Math.round(minGap / 60000);
          warnings.push({
            id: "close-rdv",
            level: "warning",
            message: `Vous avez déjà un rendez-vous ${minutes} min ${gapBefore > 0 && gapBefore < 60 * 60 * 1000 ? "avant" : "après"}`,
            detail: `Rendez-vous avec ${rdv.pro.prenom} ${rdv.pro.nom}. Continuer quand même ?`,
          });
          break;
        }
      }
    }

    // 3. Pro speciality mismatch for the selected need
    if (selectedNeed) {
      const matchScore = getMatchScore(selectedNeed, selectedPro.specialite);
      if (matchScore < 50) {
        const idealNeed = ALL_MOTIFS.find((m) => m.id === selectedNeed);
        const idealSpecs = idealNeed?.specs || [];
        const idealSpecLabel = idealSpecs[0] === "medecin" ? "un médecin du sport"
          : idealSpecs[0] === "kine" ? "un kinésithérapeute"
          : idealSpecs[0] === "dieteticien" ? "un diététicien"
          : idealSpecs[0] === "nutri" ? "un diététicien"
          : idealSpecs[0] === "autre" ? "un autre professionnel"
          : idealSpecs[0] === "coach" ? "un autre professionnel"
          : "un autre professionnel";

        // Find a better-matched connected pro
        const betterPro = connections.find((c) =>
          c.professionnel.id !== selectedPro.id && getMatchScore(selectedNeed, c.professionnel.specialite) >= 80
        );

        warnings.push({
          id: "spec-mismatch",
          level: "warning",
          message: `Ce motif semble mieux correspondre à ${idealSpecLabel}`,
          detail: betterPro
            ? `${betterPro.professionnel.prenom} ${betterPro.professionnel.nom} (${betterPro.professionnel.specialite}) serait peut-être plus adapté.`
            : "Voulez-vous continuer avec ce professionnel ?",
          action: betterPro
            ? { label: "Voir ses disponibilités", onClick: () => { setSelectedPro(betterPro.professionnel); setStep("choose-motif"); } }
            : undefined,
        });
      }
    }

    // 4. Documents suggestion for certain motifs
    if (["bilan", "reeducation", "douleur", "suivi"].includes(selectedMotif.id) && formDocs.size === 0) {
      warnings.push({
        id: "docs-suggest",
        level: "info",
        message: "Pour ce type de consultation, ajoutez vos examens si vous en avez",
        detail: "Ordonnance, radios, IRM ou bilans récents aideront le professionnel.",
      });
    }

    // 5. Duration mismatch
    if (selectedMotif.duration) {
      const motifMinutes = parseInt(selectedMotif.duration.replace(/\D/g, ""), 10);
      if (motifMinutes && selectedSlot.duration < motifMinutes * 0.8) {
        warnings.push({
          id: "duration-short",
          level: "warning",
          message: `Ce créneau (${selectedSlot.duration} min) est plus court que la durée recommandée (${selectedMotif.duration})`,
          detail: "Le professionnel pourrait manquer de temps. Vous pouvez choisir un créneau plus long.",
          action: { label: "Changer de créneau", onClick: () => setStep("choose-filters") },
        });
      }
    }

    // 6. First consultation detection
    const hasExistingWithThisPro = appointments.some((a) => a.pro.id === selectedPro.id);
    if (!hasExistingWithThisPro && selectedMotif.id === "suivi") {
      warnings.push({
        id: "first-visit-suivi",
        level: "info",
        message: "C\u2019est votre première consultation avec ce professionnel",
        detail: "Vous avez sélectionné « Suivi » mais vous n\u2019avez pas encore de rendez-vous passé avec ce professionnel. Souhaitez-vous plutôt une première consultation ?",
        action: { label: "Changer le motif", onClick: () => setStep("choose-motif") },
      });
    } else if (!hasExistingWithThisPro) {
      warnings.push({
        id: "first-visit",
        level: "info",
        message: "Première consultation avec ce professionnel",
        detail: "Pensez à préparer vos antécédents médicaux et examens récents.",
      });
    }

    // 7. Minor / age check
    if (athleteProfile) {
      // We don't have dateNaissance in the profile fetch yet, but the interface could be extended
    }

    return warnings;
  }, [step, selectedSlot, selectedPro, selectedMotif, selectedNeed, appointments, connections, athleteProfile, formDocs, setStep, setSelectedPro]);
}
