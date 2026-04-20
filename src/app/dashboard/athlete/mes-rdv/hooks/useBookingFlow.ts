"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  Motif, ProInfo, MyConnection, AvailableSlot, LearnedPreferences, AthleteProfile,
  BookingStep, ProFilterMode, PeriodFilter, TimeSlot, CalendarView,
} from "../types";
import { ALL_MOTIFS, getMotifsForSpec } from "../constants";

type ShowToast = (message: string, type?: "success" | "error" | "info") => void;

export interface QuickBookInsight {
  icon: "calendar" | "clock" | "shield" | "trending" | "repeat" | "zap" | "alert" | "star" | "sun";
  label: string;
  detail?: string;
  color: string;
}

interface UseBookingFlowParams {
  connections: MyConnection[];
  learnedPrefs: LearnedPreferences | null;
  showToast: ShowToast;
}

export function useBookingFlow({ connections, learnedPrefs, showToast }: UseBookingFlowParams) {
  const [booking, setBooking] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"presentiel" | "teleconsultation" | null>(null);
  const [step, setStep] = useState<BookingStep>("choose-need");
  const [selectedNeed, setSelectedNeed] = useState<string | null>(null);
  const [selectedPro, setSelectedPro] = useState<ProInfo | null>(null);
  const [selectedMotif, setSelectedMotif] = useState<Motif | null>(null);
  const [proFilter, setProFilter] = useState<ProFilterMode>("recommended");

  // Filters state
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>("any");
  const [filterTimeSlots, setFilterTimeSlots] = useState<Set<TimeSlot>>(new Set());
  const [filterFirstAvailable, setFilterFirstAvailable] = useState(false);
  const [filterDuration, setFilterDuration] = useState<string | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Slot selection state
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>("list");
  const [selectedCalDate, setSelectedCalDate] = useState<Date>(new Date());

  // Pre-confirmation form
  const [formComplaint, setFormComplaint] = useState("");
  const [formComment, setFormComment] = useState("");
  const [formAltAvailability, setFormAltAvailability] = useState("");
  const [formDocs, setFormDocs] = useState<Set<string>>(new Set());
  const [formConsent, setFormConsent] = useState(false);
  const [formConsentData, setFormConsentData] = useState(false);
  const [formConsentCgv, setFormConsentCgv] = useState(false);
  const [formAttachAntecedents, setFormAttachAntecedents] = useState(false);

  // Booking confirmation
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmedEventId, setConfirmedEventId] = useState<string | null>(null);

  // Quick book AI state
  const [quickBookLoading, setQuickBookLoading] = useState(false);
  const [quickBookReason, setQuickBookReason] = useState<string>("");
  const [quickBookInsights, setQuickBookInsights] = useState<QuickBookInsight[]>([]);

  // Calendar picker
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);

  // ─── Pro availability (next slot per pro) ───
  const [proAvailability, setProAvailability] = useState<Record<string, { nextSlot: Date | null; loading: boolean }>>({});
  const availFetchedRef = useRef<Set<string>>(new Set());

  // Fetch next available slot for each connected pro
  useEffect(() => {
    if (!booking || connections.length === 0) return;

    connections.forEach((c) => {
      const proId = c.professionnel.id;
      if (availFetchedRef.current.has(proId)) return;
      availFetchedRef.current.add(proId);

      setProAvailability((prev) => ({ ...prev, [proId]: { nextSlot: null, loading: true } }));

      fetch(`/api/athlete/available-slots?proId=${proId}&firstAvailable=true`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          const first = data?.slots?.[0];
          setProAvailability((prev) => ({
            ...prev,
            [proId]: { nextSlot: first ? new Date(first.date) : null, loading: false },
          }));
        })
        .catch(() => {
          setProAvailability((prev) => ({ ...prev, [proId]: { nextSlot: null, loading: false } }));
        });
    });
  }, [booking, connections]);

  // Start booking
  const startBooking = useCallback(() => {
    setBooking(true);
    availFetchedRef.current = new Set();
    setProAvailability({});
    setStep("choose-need");
    setSelectedNeed(null);
    setSelectedPro(null);
    setSelectedMotif(null);
    setSelectedFormat(null);
    setProFilter("recommended");
    setFilterPeriod("any");
    setFilterTimeSlots(new Set());
    setFilterFirstAvailable(false);
    setFilterDuration(null);
    setShowMoreFilters(false);
    setLoadingSlots(false);
    setAvailableSlots([]);
    setSelectedSlot(null);
    setCalendarView("list");
    setSelectedCalDate(new Date());
    setFormComplaint("");
    setFormComment("");
    setFormAltAvailability("");
    setFormDocs(new Set());
    setFormConsent(false);
    setFormConsentData(false);
    setFormConsentCgv(false);
    setFormAttachAntecedents(false);
    setBookingLoading(false);
    setBookingConfirmed(false);
    setConfirmedEventId(null);
  }, []);

  // ─── AI Quick Book ───
  const startQuickBook = useCallback(async (forceProId?: string) => {
    setBooking(true);
    setStep("quick-book");
    setQuickBookLoading(true);
    setQuickBookReason("");
    setQuickBookInsights([]);
    availFetchedRef.current = new Set();
    setProAvailability({});
    setSelectedNeed(null);
    setSelectedSlot(null);
    setAvailableSlots([]);
    setBookingLoading(false);
    setBookingConfirmed(false);
    setConfirmedEventId(null);
    setFormComplaint("");
    setFormComment("");
    setFormAltAvailability("");
    setFormDocs(new Set());
    setFormConsent(false);
    setFormConsentData(false);
    setFormConsentCgv(false);
    setFormAttachAntecedents(false);

    try {
      const insights: QuickBookInsight[] = [];

      // ══════════════════════════════════════════════
      // 1. SELECT PRO
      // Priority: forceProId (from card) > topPro > first connection
      // ══════════════════════════════════════════════
      let bestPro: ProInfo | null = null;
      let proRdvCount: number | null = null;

      if (forceProId) {
        const match = connections.find((c) => c.professionnel.id === forceProId);
        if (match) {
          bestPro = match.professionnel;
          const proPref = learnedPrefs?.topPros.find((p) => p.id === forceProId);
          proRdvCount = proPref?.count ?? null;
        }
      }
      if (!bestPro && learnedPrefs && learnedPrefs.topPros.length > 0) {
        const topProPref = learnedPrefs.topPros[0];
        const match = connections.find((c) => c.professionnel.id === topProPref.id);
        if (match) {
          bestPro = match.professionnel;
          proRdvCount = topProPref.count;
        }
      }
      if (!bestPro && connections.length > 0) {
        bestPro = connections[0].professionnel;
      }
      if (!bestPro) {
        setQuickBookLoading(false);
        setQuickBookReason("Aucun professionnel connecté. Connectez-vous à un pro pour utiliser la réservation rapide.");
        return;
      }
      setSelectedPro(bestPro);

      if (proRdvCount && proRdvCount > 1) {
        insights.push({ icon: "star", label: `${proRdvCount} consultations passées`, detail: `Avec ${bestPro.prenom} ${bestPro.nom}`, color: "#a855f7" });
      }

      // ══════════════════════════════════════════════
      // 2. REGULARITY ANALYSIS
      // If the athlete is regular, target the next ideal date
      // ══════════════════════════════════════════════
      const proProfile = learnedPrefs?.scoring?.proProfiles?.[bestPro.id];
      const regularity = learnedPrefs?.regularity;
      let targetIdealDate: Date | null = null;

      if (regularity?.isRegular && regularity.nextIdealDate && regularity.confidence >= 0.5) {
        targetIdealDate = new Date(regularity.nextIdealDate);
        insights.push({
          icon: "repeat",
          label: `Vous consultez ${regularity.periodLabel || "régulièrement"}`,
          detail: `Prochaine date idéale : ${targetIdealDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`,
          color: "#3b82f6",
        });
      } else if (proProfile?.regularity?.isRegular && proProfile.regularity.nextIdealDate) {
        targetIdealDate = new Date(proProfile.regularity.nextIdealDate);
        insights.push({
          icon: "repeat",
          label: `Suivi ${proProfile.regularity.periodLabel || "régulier"} avec ce pro`,
          detail: `Date idéale : ${targetIdealDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`,
          color: "#3b82f6",
        });
      } else if (learnedPrefs?.avgFollowUpInterval && learnedPrefs.avgFollowUpInterval > 0) {
        // Fallback: use average follow-up interval to estimate ideal date
        const avgDays = Math.round(learnedPrefs.avgFollowUpInterval);
        const lastDate = learnedPrefs.engagement?.daysSinceLast != null
          ? new Date(Date.now() - learnedPrefs.engagement.daysSinceLast * 86400000)
          : null;
        if (lastDate) {
          targetIdealDate = new Date(lastDate.getTime() + avgDays * 86400000);
          if (targetIdealDate.getTime() < Date.now()) targetIdealDate = new Date(); // past ideal → now
          insights.push({
            icon: "calendar",
            label: `Intervalle moyen entre RDV : ${avgDays}j`,
            detail: `Date cible estimée : ${targetIdealDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`,
            color: "#6366f1",
          });
        }
      }

      // ══════════════════════════════════════════════
      // 3. SMART MOTIF SELECTION
      // Sequential patterns > suivi default
      // ══════════════════════════════════════════════
      const proMotifs = getMotifsForSpec(bestPro.specialite);
      let bestMotif = proMotifs.find((m) => m.id === "suivi") || proMotifs[0];

      if (learnedPrefs?.sequentialPatterns && learnedPrefs.sequentialPatterns.length > 0) {
        const topPattern = learnedPrefs.sequentialPatterns[0];
        const nextMotif = proMotifs.find((m) =>
          m.label.toLowerCase() === topPattern.to.toLowerCase() ||
          m.id === topPattern.to.toLowerCase()
        );
        if (nextMotif) {
          bestMotif = nextMotif;
          insights.push({
            icon: "trending",
            label: `Motif prédit : ${nextMotif.label}`,
            detail: `Après "${topPattern.from}" vous prenez souvent "${topPattern.to}"`,
            color: "#f59e0b",
          });
        }
      }
      setSelectedMotif(bestMotif);

      // ══════════════════════════════════════════════
      // 4. SMART FORMAT SELECTION
      // motif×format > global pref > default
      // ══════════════════════════════════════════════
      let bestFormat: "presentiel" | "teleconsultation" = "presentiel";
      const motifKey = bestMotif.label.toLowerCase();
      const motifFormatPref = learnedPrefs?.motifFormatPrefs?.[motifKey];

      if (motifFormatPref && motifFormatPref.confidence >= 0.5) {
        bestFormat = motifFormatPref.format as "presentiel" | "teleconsultation";
      } else if (learnedPrefs?.preferredFormat && learnedPrefs.preferredFormat.confidence >= 0.4) {
        bestFormat = learnedPrefs.preferredFormat.format as "presentiel" | "teleconsultation";
      }
      if (bestMotif.id === "teleconsultation" || bestMotif.id === "visio") {
        bestFormat = "teleconsultation";
      }
      setSelectedFormat(bestFormat);

      // ══════════════════════════════════════════════
      // 5. CANCELLATION RISK ANALYSIS
      // Build sets of high-risk hours/days to penalize
      // ══════════════════════════════════════════════
      const cancelRiskHours = new Set<number>();
      const cancelRiskDays = new Set<number>();
      if (learnedPrefs?.cancellationPatterns) {
        for (const s of learnedPrefs.cancellationPatterns.avoidSlots) {
          if (s.risk >= 0.3) cancelRiskHours.add(s.hour);
        }
        for (const d of learnedPrefs.cancellationPatterns.avoidDays) {
          if (d.risk >= 0.3) cancelRiskDays.add(d.day);
        }
        if (cancelRiskHours.size > 0 || cancelRiskDays.size > 0) {
          const parts: string[] = [];
          if (cancelRiskDays.size > 0) {
            const dayNames = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
            parts.push(Array.from(cancelRiskDays).map((d) => dayNames[d]).join(", "));
          }
          if (cancelRiskHours.size > 0) {
            parts.push(Array.from(cancelRiskHours).map((h) => `${h}h`).join(", "));
          }
          insights.push({
            icon: "shield",
            label: "Créneaux à risque évités",
            detail: `Vous annulez souvent : ${parts.join(" · ")}`,
            color: "#ef4444",
          });
        }
      }

      // ══════════════════════════════════════════════
      // 6. BOOKING VELOCITY → PERIOD ADAPTATION
      // ══════════════════════════════════════════════
      let period = "any";
      if (learnedPrefs?.bookingVelocity) {
        const velocityMap: Record<string, { period: string; label: string }> = {
          "last-minute": { period: "this-week", label: "Vous réservez au dernier moment" },
          "spontane": { period: "this-week", label: "Réservation spontanée" },
          "planificateur": { period: "next-week", label: "Vous planifiez à l'avance" },
          "anticipateur": { period: "this-month", label: "Vous anticipez vos RDV" },
        };
        const v = velocityMap[learnedPrefs.bookingVelocity];
        if (v) {
          period = v.period;
          insights.push({ icon: "zap", label: v.label, color: "#f59e0b" });
        }
      }

      // ══════════════════════════════════════════════
      // 7. TREND AWARENESS
      // Prefer rising hours/days over falling ones
      // ══════════════════════════════════════════════
      if (learnedPrefs?.trends) {
        const risingHours = learnedPrefs.trends.hours.filter((t) => t.direction === "rising");
        const risingDays = learnedPrefs.trends.days.filter((t) => t.direction === "rising");
        if (risingHours.length > 0) {
          insights.push({
            icon: "trending",
            label: `Tendance : vous consultez de plus en plus à ${risingHours[0].hour}h`,
            color: "#10b981",
          });
        }
        if (risingDays.length > 0) {
          insights.push({
            icon: "trending",
            label: `Tendance : le ${risingDays[0].dayName} monte`,
            color: "#10b981",
          });
        }
      }

      // ══════════════════════════════════════════════
      // 8. SEASONAL AWARENESS
      // ══════════════════════════════════════════════
      if (learnedPrefs?.seasonalAwareness) {
        const sa = learnedPrefs.seasonalAwareness;
        if (sa.usualSlot !== sa.seasonalSlot) {
          insights.push({
            icon: "sun",
            label: `Ajustement ${sa.season}`,
            detail: `Créneau adapté : ${sa.seasonalSlot} (habituellement ${sa.usualSlot})`,
            color: "#f59e0b",
          });
        }
      }

      // ══════════════════════════════════════════════
      // 9. PREFERRED TIME COMPUTATION
      // Use topDayHours for ultra-precise preference
      // ══════════════════════════════════════════════
      let preferredTimeSlots: string[] = [];

      // Pro-specific profile takes priority
      if (proProfile?.preferredHour != null) {
        const h = proProfile.preferredHour;
        preferredTimeSlots = [h < 12 ? "matin" : h < 14 ? "midi" : h < 18 ? "apres-midi" : "soir"];
        insights.push({
          icon: "clock",
          label: `Horaire favori avec ce pro : ${h}h`,
          detail: proProfile.preferredDayName ? `Jour favori : ${proProfile.preferredDayName}` : undefined,
          color: "#ec4899",
        });
      } else if (learnedPrefs?.topDayHours && learnedPrefs.topDayHours.length > 0) {
        // Use top day×hour combo
        const topCombo = learnedPrefs.topDayHours[0];
        const h = topCombo.hour;
        preferredTimeSlots = [h < 12 ? "matin" : h < 14 ? "midi" : h < 18 ? "apres-midi" : "soir"];
        insights.push({
          icon: "clock",
          label: `Créneau type : ${topCombo.dayName} ${topCombo.label}`,
          detail: `${topCombo.pct}% de vos RDV`,
          color: "#ec4899",
        });
      } else if (learnedPrefs?.preferredTimeSlot) {
        preferredTimeSlots = [learnedPrefs.preferredTimeSlot];
      }

      // Also consider seasonal slot
      if (learnedPrefs?.seasonalAwareness?.seasonalSlot) {
        const seasonal = learnedPrefs.seasonalAwareness.seasonalSlot;
        if (!preferredTimeSlots.includes(seasonal)) {
          preferredTimeSlots.push(seasonal);
        }
      }

      // ══════════════════════════════════════════════
      // 10. FETCH AVAILABLE SLOTS
      // ══════════════════════════════════════════════
      const params = new URLSearchParams({ proId: bestPro.id, period });

      if (preferredTimeSlots.length > 0) {
        params.set("timeSlots", preferredTimeSlots.join(","));
      }
      if (learnedPrefs?.avgDuration) {
        params.set("duration", String(Math.round(learnedPrefs.avgDuration)));
      }

      const res = await fetch(`/api/athlete/available-slots?${params.toString()}`);
      if (!res.ok) {
        setQuickBookLoading(false);
        setQuickBookReason("Impossible de charger les créneaux disponibles.");
        return;
      }
      const data = await res.json();
      let slots: AvailableSlot[] = (data.slots || []).map((s: { id: string; date: string; duration: number }) => ({
        id: s.id,
        date: new Date(s.date),
        duration: s.duration,
      }));

      // ── Retry without filters if empty ──
      if (slots.length === 0) {
        const retryParams = new URLSearchParams({ proId: bestPro.id, period: "any" });
        const retryRes = await fetch(`/api/athlete/available-slots?${retryParams.toString()}`);
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          slots = (retryData.slots || []).map((s: { id: string; date: string; duration: number }) => ({
            id: s.id,
            date: new Date(s.date),
            duration: s.duration,
          }));
        }
        if (slots.length === 0) {
          setQuickBookLoading(false);
          setQuickBookReason("Aucun créneau disponible pour ce professionnel.");
          return;
        }
      }

      // ══════════════════════════════════════════════
      // 11. POST-FILTER: remove high cancel-risk slots
      // Keep at least 5 slots after filtering
      // ══════════════════════════════════════════════
      if (cancelRiskHours.size > 0 || cancelRiskDays.size > 0) {
        const filtered = slots.filter((s) => {
          const h = s.date.getHours();
          const d = s.date.getDay();
          return !cancelRiskHours.has(h) && !cancelRiskDays.has(d);
        });
        if (filtered.length >= 5) {
          slots = filtered;
        }
      }

      // ══════════════════════════════════════════════
      // 12. POST-SORT: boost slots near ideal regularity date
      // ══════════════════════════════════════════════
      if (targetIdealDate) {
        const idealTs = targetIdealDate.getTime();
        slots.sort((a, b) => {
          const distA = Math.abs(a.date.getTime() - idealTs);
          const distB = Math.abs(b.date.getTime() - idealTs);
          return distA - distB;
        });
        // Move the closest-to-ideal slots to the front, but keep scoring in QuickBookAI
        // We just pre-sort so the scoring engine has a hint
      }

      setAvailableSlots(slots);

      // ══════════════════════════════════════════════
      // 13. ENGAGEMENT INSIGHT
      // ══════════════════════════════════════════════
      if (learnedPrefs?.engagement) {
        const eng = learnedPrefs.engagement;
        if (eng.daysSinceLast != null && eng.daysSinceLast > 60) {
          insights.push({
            icon: "alert",
            label: `${eng.daysSinceLast} jours depuis votre dernier RDV`,
            detail: "Il est peut-être temps de reprendre un suivi",
            color: "#f59e0b",
          });
        } else if (eng.level === "actif" && eng.recent90 > 3) {
          insights.push({
            icon: "star",
            label: `${eng.recent90} RDV ces 3 derniers mois`,
            detail: "Vous êtes un patient actif",
            color: "#10b981",
          });
        }
      }

      // ══════════════════════════════════════════════
      // 13b. CANCELLATION RATE INSIGHT
      // ══════════════════════════════════════════════
      if (learnedPrefs && learnedPrefs.cancelledCount > 0 && learnedPrefs.totalAppointments > 3) {
        const cancelRate = Math.round((learnedPrefs.cancelledCount / learnedPrefs.totalAppointments) * 100);
        if (cancelRate >= 20) {
          insights.push({
            icon: "shield",
            label: `${cancelRate}% de RDV annulés (${learnedPrefs.cancelledCount}/${learnedPrefs.totalAppointments})`,
            detail: "Les créneaux à risque sont évités pour vous",
            color: "#ef4444",
          });
        }
      }

      // ══════════════════════════════════════════════
      // 13c. BOOKING DELAY INSIGHT
      // ══════════════════════════════════════════════
      if (learnedPrefs?.avgBookingDelay != null && learnedPrefs.avgBookingDelay > 0) {
        const delayDays = Math.round(learnedPrefs.avgBookingDelay);
        if (delayDays <= 3) {
          insights.push({ icon: "zap", label: `Délai moyen de réservation : ${delayDays}j`, detail: "Créneaux proches priorisés", color: "#f59e0b" });
        } else if (delayDays >= 14) {
          insights.push({ icon: "calendar", label: `Vous réservez ~${delayDays}j à l'avance`, detail: "Créneaux éloignés priorisés", color: "#6366f1" });
        }
      }

      // ══════════════════════════════════════════════
      // 14. BUILD REASON SUMMARY
      // ══════════════════════════════════════════════
      const reasons: string[] = [
        `${bestPro.prenom} ${bestPro.nom}`,
        bestMotif.label,
        bestFormat === "presentiel" ? "En cabinet" : "Téléconsultation",
      ];
      if (learnedPrefs && learnedPrefs.dataConfidence >= 20) {
        reasons.push(`Confiance : ${learnedPrefs.dataConfidence}%`);
      }

      // ══════════════════════════════════════════════
      // 15. SMART FORM PRE-FILL
      // Auto-suggest complaint based on motif
      // ══════════════════════════════════════════════
      const motifComplaints: Record<string, string> = {
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
      const autoComplaint = motifComplaints[bestMotif.id] || bestMotif.label;
      setFormComplaint(autoComplaint);

      // Cap insights at 6 most relevant
      setQuickBookInsights(insights.slice(0, 6));
      setQuickBookReason(reasons.join(" · "));
    } catch {
      setQuickBookReason("Erreur lors du chargement de la recommandation.");
    } finally {
      setQuickBookLoading(false);
    }
  }, [connections, learnedPrefs]);

  // Handle need selection → find matching pros
  const handleNeedSelect = (needId: string) => {
    setSelectedNeed(needId);
    const need = ALL_MOTIFS.find((m) => m.id === needId);
    if (!need) return;

    const matchingPros = connections.filter((c) => {
      const specKey = c.professionnel.specialite.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return need.specs.some((s) => specKey.includes(s));
    });

    if (matchingPros.length === 1) {
      setSelectedPro(matchingPros[0].professionnel);
      setStep("choose-motif");
    } else {
      setStep("choose-pro");
    }
  };

  // Handle pro selection → show motifs
  const handleProSelect = (pro: ProInfo) => {
    setSelectedPro(pro);
    setStep("choose-motif");
  };

  // Handle motif selection → filters
  const handleMotifSelect = (motif: Motif) => {
    setSelectedMotif(motif);
    if (motif.id === "teleconsultation" || motif.id === "visio") {
      setSelectedFormat("teleconsultation");
    } else if (!selectedFormat && learnedPrefs) {
      // LEARNED: motif×format correlation — use per-motif learned format if confident enough
      const motifPref = learnedPrefs.motifFormatPrefs[motif.label.toLowerCase()];
      if (motifPref && motifPref.confidence >= 0.6) {
        setSelectedFormat(motifPref.format as "presentiel" | "teleconsultation");
      } else if (learnedPrefs.preferredFormat && learnedPrefs.preferredFormat.confidence >= 0.5) {
        setSelectedFormat(learnedPrefs.preferredFormat.format as "presentiel" | "teleconsultation");
      }
    }
    setStep("choose-filters");
  };

  // Toggle time slot filter
  const toggleTimeSlot = (slot: TimeSlot) => {
    setFilterTimeSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  };

  // Confirm filters → fetch real slots from API
  const confirmFilters = async () => {
    if (!selectedFormat) setSelectedFormat("presentiel");
    if (!selectedPro) return;

    setLoadingSlots(true);
    setSlotsError(false);
    setSelectedSlot(null);
    setStep("choose-slot");

    try {
      const params = new URLSearchParams({ proId: selectedPro.id, period: filterPeriod });
      if (filterTimeSlots.size > 0) {
        params.set("timeSlots", Array.from(filterTimeSlots).join(","));
      }
      if (filterDuration) {
        params.set("duration", filterDuration.replace(/\D/g, ""));
      }
      if (filterFirstAvailable) {
        params.set("firstAvailable", "true");
      }

      const res = await fetch(`/api/athlete/available-slots?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const slots: AvailableSlot[] = (data.slots || []).map((s: { id: string; date: string; duration: number }) => ({
          id: s.id,
          date: new Date(s.date),
          duration: s.duration,
        }));
        setAvailableSlots(slots);
      } else {
        setAvailableSlots([]);
      }
    } catch {
      setAvailableSlots([]);
      setSlotsError(true);
      showToast("Impossible de charger les créneaux disponibles", "error");
    } finally {
      setLoadingSlots(false);
    }
  };

  // Select slot → summary
  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setStep("summary");
  };

  // Confirm booking → POST to API → Stripe Checkout
  const confirmBooking = async () => {
    if (!selectedPro || !selectedSlot || !selectedMotif || !selectedFormat) return;
    setBookingLoading(true);
    try {
      // 1. Create the calendar event (booking)
      const res = await fetch("/api/athlete/book-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proId: selectedPro.id,
          date: selectedSlot.date.toISOString(),
          duration: selectedSlot.duration || 30,
          motif: selectedMotif.label,
          format: selectedFormat,
          complaint: formComplaint || null,
          comment: formComment || null,
          altAvailability: formAltAvailability || null,
          documents: Array.from(formDocs),
          attachAntecedents: formAttachAntecedents,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || "Erreur lors de la réservation", "error");
        return;
      }

      setConfirmedEventId(data.eventId);

      // 2. Create Stripe Checkout session for payment
      // Find matching tarif ID if available
      const tarifs = selectedPro.tarifs ?? [];
      const matchingTarif = tarifs.find((t) =>
        (!t.format || t.format === selectedFormat)
      );

      try {
        const checkoutRes = await fetch("/api/payments/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calendarEventId: data.eventId,
            tarifId: matchingTarif?.id || null,
          }),
        });
        const checkoutData = await checkoutRes.json();

        if (checkoutRes.ok && checkoutData.checkoutUrl) {
          // Redirect to Stripe Checkout
          showToast("Redirection vers le paiement…", "success");
          window.location.href = checkoutData.checkoutUrl;
          return;
        }
      } catch {
        // Checkout creation failed — still show booking confirmed
        console.error("Stripe Checkout creation failed, booking was still created");
      }

      // Fallback: if Checkout fails (pro not payment-ready, no tarif, etc.), show confirmation without payment
      setBookingConfirmed(true);
      showToast("Rendez-vous confirmé !", "success");
    } catch {
      showToast("Erreur de connexion — veuillez réessayer", "error");
    } finally {
      setBookingLoading(false);
    }
  };

  // Count active filters
  const activeFilterCount = (
    (filterPeriod !== "any" ? 1 : 0) +
    filterTimeSlots.size +
    (filterFirstAvailable ? 1 : 0) +
    (filterDuration ? 1 : 0)
  );

  // Go back
  const goBack = () => {
    if (step === "summary") {
      setStep("choose-slot");
    } else if (step === "choose-slot") {
      setStep("choose-filters");
    } else if (step === "choose-filters") {
      setStep("choose-motif");
    } else if (step === "choose-motif") {
      if (selectedNeed) setStep("choose-pro");
      else setStep("choose-need");
    } else if (step === "choose-pro") {
      setStep("choose-need");
    } else if (step === "quick-book") {
      setBooking(false);
    } else {
      setBooking(false);
    }
  };

  // ─── Calendar helpers ───

  const buildCalendarDescription = (plain?: boolean): string => {
    if (!selectedSlot || !selectedPro || !selectedMotif || !selectedFormat) return "";
    const sep = plain ? "\n" : "\\n";
    const parts: string[] = [];

    parts.push(`Motif : ${selectedMotif.label}`);
    parts.push(`Professionnel : ${selectedPro.prenom} ${selectedPro.nom} (${selectedPro.specialite})`);
    parts.push(`Durée : ${selectedSlot.duration || 30} min`);
    parts.push(`Format : ${selectedFormat === "presentiel" ? "En cabinet" : "Téléconsultation"}`);

    if (selectedFormat === "presentiel" && selectedPro.adresseCabinet) {
      parts.push(`Adresse : ${selectedPro.adresseCabinet}`);
    }

    if (formComplaint) parts.push(`${sep}Problème : ${formComplaint}`);
    if (formComment) parts.push(`Note : ${formComment}`);

    if (formDocs.size > 0) {
      parts.push(`${sep}Documents à transmettre : ${Array.from(formDocs).join(", ")}`);
    }

    parts.push(`${sep}--- Pièces à prévoir ---`);
    parts.push("• Carte Vitale ou attestation");
    parts.push("• Ordonnance ou lettre du médecin (si disponible)");
    parts.push("• Examens récents (radio, IRM, bilans)");

    if (formAltAvailability) {
      parts.push(`${sep}Disponibilité alternative : ${formAltAvailability}`);
    }

    parts.push(`${sep}Réservé via Tuatha`);
    return parts.join(sep);
  };

  const calFmtICS = (d: Date) => {
    const p = (n: number) => n.toString().padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
  };

  const getCalendarData = () => {
    if (!selectedSlot || !selectedPro || !selectedMotif) return null;
    const start = selectedSlot.date;
    const end = new Date(start.getTime() + (selectedSlot.duration || 30) * 60 * 1000);
    const title = `RDV ${selectedMotif.label} — ${selectedPro.prenom} ${selectedPro.nom}`;
    const location = selectedFormat === "presentiel" && selectedPro.adresseCabinet
      ? selectedPro.adresseCabinet
      : selectedFormat === "teleconsultation" ? "Téléconsultation" : "";
    return { start, end, title, location };
  };

  const generateICS = () => {
    const data = getCalendarData();
    if (!data) return;
    const { start, end, title, location } = data;
    const description = buildCalendarDescription();

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Tuatha//RDV//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `DTSTART:${calFmtICS(start)}`,
      `DTEND:${calFmtICS(end)}`,
      `SUMMARY:${title}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      "STATUS:CONFIRMED",
      `UID:${confirmedEventId || Date.now()}@tuatha`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:Rappel : ${title}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rdv-tuatha-${start.toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setCalendarPickerOpen(false);
  };

  const getGoogleCalendarUrl = (): string => {
    const data = getCalendarData();
    if (!data) return "#";
    const { start, end, title, location } = data;
    const desc = buildCalendarDescription(true);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${calFmtICS(start)}/${calFmtICS(end)}`,
      details: desc,
      location,
      trp: "false",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const getOutlookCalendarUrl = (): string => {
    const data = getCalendarData();
    if (!data) return "#";
    const { start, end, title, location } = data;
    const desc = buildCalendarDescription(true);
    const params = new URLSearchParams({
      rru: "addevent",
      subject: title,
      startdt: start.toISOString(),
      enddt: end.toISOString(),
      body: desc,
      location,
      path: "/calendar/action/compose",
    });
    return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
  };

  // Group slots by date for display
  const slotsByDate = availableSlots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    const key = slot.date.toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  const datesWithSlots = [...new Set(availableSlots.map((s) => s.date.toDateString()))].map((d) => new Date(d));

  const slotsForSelectedDate = availableSlots.filter(
    (s) => s.date.toDateString() === selectedCalDate.toDateString()
  );

  const getWeekDates = (d: Date): Date[] => {
    const start = new Date(d);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  };

  return {
    // Core state
    booking, setBooking,
    step, setStep,
    selectedNeed,
    selectedPro, setSelectedPro,
    selectedMotif,
    selectedFormat, setSelectedFormat,
    proFilter, setProFilter,

    // Filters
    filterPeriod, setFilterPeriod,
    filterTimeSlots,
    filterFirstAvailable, setFilterFirstAvailable,
    filterDuration, setFilterDuration,
    showMoreFilters, setShowMoreFilters,
    activeFilterCount,

    // Slots
    loadingSlots, slotsError,
    availableSlots,
    selectedSlot,
    calendarView, setCalendarView,
    selectedCalDate, setSelectedCalDate,
    slotsByDate, datesWithSlots, slotsForSelectedDate, getWeekDates,

    // Form
    formComplaint, setFormComplaint,
    formComment, setFormComment,
    formAltAvailability, setFormAltAvailability,
    formDocs, setFormDocs,
    formConsent, setFormConsent,
    formConsentData, setFormConsentData,
    formConsentCgv, setFormConsentCgv,
    formAttachAntecedents, setFormAttachAntecedents,

    // Booking confirmation
    bookingLoading,
    bookingConfirmed, setBookingConfirmed,
    confirmedEventId,
    calendarPickerOpen, setCalendarPickerOpen,

    // Pro availability
    proAvailability,

    // Quick book AI
    quickBookLoading,
    quickBookReason,
    quickBookInsights,
    startQuickBook,

    // Actions
    startBooking,
    handleNeedSelect,
    handleProSelect,
    handleMotifSelect,
    toggleTimeSlot,
    confirmFilters,
    handleSlotSelect,
    confirmBooking,
    goBack,

    // Calendar
    generateICS,
    getGoogleCalendarUrl,
    getOutlookCalendarUrl,
  };
}
