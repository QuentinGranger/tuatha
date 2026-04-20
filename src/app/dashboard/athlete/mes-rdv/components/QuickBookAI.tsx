"use client";

import React, { useMemo } from "react";
import styles from "../page.module.scss";
import type { LearnedPreferences, SuggestedSlot } from "../types";
import { getSpecColor } from "../constants";
import { scoreSlot, quickBookBonus, type QuickBookContext } from "@/lib/scoring";
import { useBookingFlow, type QuickBookInsight } from "../hooks/useBookingFlow";

type Flow = ReturnType<typeof useBookingFlow>;

interface Props {
  flow: Flow;
  learnedPrefs: LearnedPreferences | null;
  appointments: { date: string }[];
}

const INSIGHT_ICONS: Record<QuickBookInsight["icon"], React.ReactNode> = {
  calendar: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  clock: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  shield: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  trending: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  repeat: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>,
  zap: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  alert: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  star: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  sun: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
};

export function QuickBookAI({ flow, learnedPrefs, appointments }: Props) {
  const {
    quickBookLoading, quickBookReason, quickBookInsights,
    selectedPro, selectedMotif, selectedFormat,
    availableSlots, selectedSlot,
    handleSlotSelect, confirmBooking,
    bookingLoading, bookingConfirmed, confirmedEventId,
    setStep, setBooking, setBookingConfirmed,
    startBooking,
    calendarPickerOpen, setCalendarPickerOpen,
    generateICS, getGoogleCalendarUrl, getOutlookCalendarUrl,
  } = flow;

  // ─── Enhanced scoring: base engine + quick-book-specific bonus layer ───
  const topSlots: SuggestedSlot[] = useMemo(() => {
    if (availableSlots.length === 0) return [];
    const existingDates = appointments.map((a) => new Date(a.date));
    const isVisio = selectedFormat === "teleconsultation";
    const motifDuration = selectedMotif?.duration
      ? parseInt(selectedMotif.duration.replace(/\D/g, ""), 10)
      : null;
    const sc = learnedPrefs?.scoring ?? null;
    const firstSlotId = availableSlots[0]?.id ?? "";

    // Build quick-book context for bonus scoring
    const qbCtx: QuickBookContext = {
      cancelRiskHours: new Set(learnedPrefs?.cancellationPatterns?.avoidSlots?.filter((s) => s.risk >= 0.3).map((s) => s.hour) ?? []),
      cancelRiskDays: new Set(learnedPrefs?.cancellationPatterns?.avoidDays?.filter((d) => d.risk >= 0.3).map((d) => d.day) ?? []),
      trendingHours: new Set(learnedPrefs?.trends?.hours?.filter((t) => t.direction === "rising").map((t) => t.hour) ?? []),
      trendingDays: new Set(learnedPrefs?.trends?.days?.filter((t) => t.direction === "rising").map((t) => t.day) ?? []),
      velocity: learnedPrefs?.bookingVelocity ?? null,
      idealDate: sc?.regularity?.nextIdealDate ? new Date(sc.regularity.nextIdealDate) : null,
      avgBookingDelay: learnedPrefs?.avgBookingDelay ?? null,
      hourRange: sc?.hourRange ? { start: sc.hourRange.start, end: sc.hourRange.end } : null,
      dayHourCombos: sc?.dayHourCombos ?? [],
    };

    // Compute fallback ideal date from avgFollowUpInterval
    if (!qbCtx.idealDate && learnedPrefs?.avgFollowUpInterval && learnedPrefs.avgFollowUpInterval > 0 && learnedPrefs.engagement?.daysSinceLast != null) {
      const lastDate = new Date(Date.now() - learnedPrefs.engagement.daysSinceLast * 86400000);
      const fallback = new Date(lastDate.getTime() + Math.round(learnedPrefs.avgFollowUpInterval) * 86400000);
      qbCtx.idealDate = fallback.getTime() < Date.now() ? new Date() : fallback;
    }

    const scored: SuggestedSlot[] = [];
    for (const slot of availableSlots) {
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

      const bonus = quickBookBonus({
        slotDate: slot.date,
        slotHour: slot.date.getHours(),
        slotDay: slot.date.getDay(),
        ctx: qbCtx,
      });

      const totalScore = result.score + bonus;
      const boostedPct = sc ? Math.min(Math.round((Math.max(totalScore, 0) / 145) * 100), 99) : result.matchPct;

      scored.push({ slot, badges: result.badges, score: totalScore, matchPct: boostedPct });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
  }, [availableSlots, appointments, selectedFormat, selectedMotif, selectedPro, learnedPrefs]);

  // Auto-select the top slot when available
  React.useEffect(() => {
    if (topSlots.length > 0 && !selectedSlot && !quickBookLoading) {
      handleSlotSelect(topSlots[0].slot);
    }
  }, [topSlots, selectedSlot, quickBookLoading]);

  const bestSlot = topSlots[0] ?? null;
  const matchPct = bestSlot?.matchPct ?? 0;
  const proColor = selectedPro ? getSpecColor(selectedPro.specialite) : "#e67e22";

  // Multi-step loading animation
  const [loadingStep, setLoadingStep] = React.useState(0);
  React.useEffect(() => {
    if (!quickBookLoading) { setLoadingStep(0); return; }
    const steps = [0, 1, 2, 3];
    let i = 0;
    const timer = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setLoadingStep(steps[i]);
    }, 600);
    return () => clearInterval(timer);
  }, [quickBookLoading]);

  const LOADING_MESSAGES = [
    { text: "Analyse de vos habitudes…", sub: "Historique de rendez-vous" },
    { text: "Sélection du professionnel…", sub: "Préférences & disponibilités" },
    { text: "Recherche des créneaux…", sub: "Filtrage intelligent" },
    { text: "Scoring des créneaux…", sub: "Algorithme de recommandation" },
  ];

  if (quickBookLoading) {
    const msg = LOADING_MESSAGES[loadingStep] ?? LOADING_MESSAGES[0];
    return (
      <div className={styles.quickBookContainer}>
        <div className={styles.quickBookLoading}>
          <div className={styles.quickBookPulse} />
          <span className={styles.quickBookLoadingText}>{msg.text}</span>
          <span className={styles.quickBookLoadingSubtext}>{msg.sub}</span>
          <div className={styles.quickBookLoadingSteps}>
            {LOADING_MESSAGES.map((_, i) => (
              <div key={i} className={`${styles.quickBookLoadingDot} ${i <= loadingStep ? styles.quickBookLoadingDotActive : ""}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error / no slots
  if (!selectedPro || availableSlots.length === 0 || !bestSlot) {
    return (
      <div className={styles.quickBookContainer}>
        <div className={styles.quickBookEmpty}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span>{quickBookReason || "Aucune recommandation disponible"}</span>
          <button className={styles.quickBookFallbackBtn} onClick={startBooking}>
            Réserver manuellement
          </button>
        </div>
      </div>
    );
  }

  // Confirmed state
  if (bookingConfirmed) {
    return (
      <div className={styles.quickBookContainer}>
        <div className={styles.quickBookConfirmed}>
          <div className={styles.quickBookConfirmedIcon}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          </div>
          <h2 className={styles.quickBookConfirmedTitle}>Rendez-vous confirmé !</h2>
          <p className={styles.quickBookConfirmedSub}>
            {selectedPro.prenom} {selectedPro.nom} · {bestSlot.slot.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à {bestSlot.slot.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>

          <div className={styles.quickBookCalendarActions}>
            <button onClick={() => setCalendarPickerOpen(!calendarPickerOpen)} className={styles.quickBookCalBtn}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Ajouter au calendrier
            </button>
            {calendarPickerOpen && (
              <div className={styles.quickBookCalDropdown}>
                <button onClick={generateICS}>Fichier .ics (Apple / Outlook)</button>
                <a href={getGoogleCalendarUrl()} target="_blank" rel="noreferrer">Google Calendar</a>
                <a href={getOutlookCalendarUrl()} target="_blank" rel="noreferrer">Outlook Web</a>
              </div>
            )}
          </div>

          <button className={styles.quickBookDoneBtn} onClick={() => { setBooking(false); setBookingConfirmed(false); }}>
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  // Main recommendation view
  const slotDate = bestSlot.slot.date;
  const dateLabel = slotDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = slotDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const endTime = new Date(slotDate.getTime() + (bestSlot.slot.duration || 30) * 60000);
  const endLabel = endTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={styles.quickBookContainer}>
      {/* AI Header */}
      <div className={styles.quickBookHeader}>
        <div className={styles.quickBookAiBadge}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          Recommandation IA
        </div>
        <h2 className={styles.quickBookTitle}>Votre prochain rendez-vous idéal</h2>
        <p className={styles.quickBookSubtitle}>Basé sur l'analyse de vos {learnedPrefs?.totalAppointments || 0} rendez-vous passés</p>
      </div>

      {/* Main recommendation card */}
      <div className={styles.quickBookCard}>
        {/* Match score ring */}
        {matchPct > 0 && (
          <div className={styles.quickBookMatchRing}>
            <svg viewBox="0 0 36 36" width="56" height="56">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={matchPct >= 70 ? "#10b981" : matchPct >= 40 ? "#f59e0b" : "#94a3b8"}
                strokeWidth="3"
                strokeDasharray={`${matchPct}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className={styles.quickBookMatchValue}>{matchPct}%</span>
            <span className={styles.quickBookMatchLabel}>match</span>
          </div>
        )}

        {/* Pro info */}
        <div className={styles.quickBookProRow}>
          <div className={styles.quickBookProAvatar} style={{ borderColor: proColor }}>
            {selectedPro.prenom[0]}{selectedPro.nom[0]}
          </div>
          <div className={styles.quickBookProInfo}>
            <span className={styles.quickBookProName}>{selectedPro.prenom} {selectedPro.nom}</span>
            <span className={styles.quickBookProSpec} style={{ color: proColor }}>{selectedPro.specialite}</span>
          </div>
        </div>

        {/* Slot details */}
        <div className={styles.quickBookDetails}>
          <div className={styles.quickBookDetailRow}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <span>{dateLabel}</span>
          </div>
          <div className={styles.quickBookDetailRow}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span>{timeLabel} – {endLabel} ({bestSlot.slot.duration || 30} min)</span>
          </div>
          <div className={styles.quickBookDetailRow}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <span>{selectedMotif?.label || "Consultation"}</span>
          </div>
          <div className={styles.quickBookDetailRow}>
            {selectedFormat === "teleconsultation" ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            )}
            <span>{selectedFormat === "teleconsultation" ? "Téléconsultation" : "En cabinet"}{selectedPro.adresseCabinet && selectedFormat === "presentiel" ? ` · ${selectedPro.adresseCabinet}` : ""}</span>
          </div>
        </div>

        {/* AI badges */}
        {bestSlot.badges.length > 0 && (
          <div className={styles.quickBookBadges}>
            {bestSlot.badges.slice(0, 3).map((b, i) => (
              <span key={i} className={styles.quickBookBadge} style={{ color: b.color, borderColor: `${b.color}30` }}>
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AI Insights */}
      {quickBookInsights.length > 0 && (
        <div className={styles.quickBookInsights}>
          <span className={styles.quickBookInsightsTitle}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            Analyse IA
          </span>
          {quickBookInsights.map((insight, i) => (
            <div key={i} className={styles.quickBookInsightRow} style={{ borderLeftColor: insight.color }}>
              <span className={styles.quickBookInsightIcon} style={{ color: insight.color }}>
                {INSIGHT_ICONS[insight.icon]}
              </span>
              <div className={styles.quickBookInsightContent}>
                <span className={styles.quickBookInsightLabel}>{insight.label}</span>
                {insight.detail && <span className={styles.quickBookInsightDetail}>{insight.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.quickBookActions}>
        <button
          className={styles.quickBookConfirmBtn}
          onClick={confirmBooking}
          disabled={bookingLoading}
        >
          {bookingLoading ? (
            <>
              <span className={styles.quickBookSpinner} />
              Réservation en cours…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Confirmer ce rendez-vous
            </>
          )}
        </button>

        <button className={styles.quickBookCustomizeBtn} onClick={startBooking}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          Personnaliser
        </button>
      </div>

      {/* Confidence breakdown */}
      {learnedPrefs && learnedPrefs.dataConfidence > 0 && (
        <div className={styles.quickBookConfidence}>
          <div className={styles.quickBookConfidenceBar}>
            <div
              className={styles.quickBookConfidenceFill}
              style={{
                width: `${Math.min(learnedPrefs.dataConfidence, 100)}%`,
                background: learnedPrefs.dataConfidence >= 60 ? "#10b981" : learnedPrefs.dataConfidence >= 30 ? "#f59e0b" : "#94a3b8",
              }}
            />
          </div>
          <span className={styles.quickBookConfidenceLabel}>
            Confiance IA : {learnedPrefs.dataConfidence}% · {learnedPrefs.totalAppointments} RDV analysés
            {learnedPrefs.preferenceStability != null && ` · Stabilité ${learnedPrefs.preferenceStability}%`}
          </span>
        </div>
      )}

      {/* Alternative slots */}
      {topSlots.length > 1 && (
        <div className={styles.quickBookAlternatives}>
          <span className={styles.quickBookAltTitle}>Autres créneaux recommandés</span>
          {topSlots.slice(1, 4).map((s, i) => {
            const daysAway = Math.ceil((s.slot.date.getTime() - Date.now()) / 86400000);
            const daysLabel = daysAway === 0 ? "Aujourd'hui" : daysAway === 1 ? "Demain" : `Dans ${daysAway}j`;
            const topBadge = s.badges[0];
            return (
              <button
                key={i}
                className={`${styles.quickBookAltSlot} ${selectedSlot?.id === s.slot.id ? styles.quickBookAltSlotActive : ""}`}
                onClick={() => handleSlotSelect(s.slot)}
              >
                <div className={styles.quickBookAltLeft}>
                  <span className={styles.quickBookAltDate}>
                    {s.slot.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className={styles.quickBookAltTime}>
                    {s.slot.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    <span className={styles.quickBookAltDays}>{daysLabel}</span>
                  </span>
                </div>
                <div className={styles.quickBookAltRight}>
                  {topBadge && (
                    <span className={styles.quickBookAltBadge} style={{ color: topBadge.color }}>
                      {topBadge.label}
                    </span>
                  )}
                  {(s.matchPct ?? 0) > 0 && (
                    <span className={styles.quickBookAltMatch} style={{
                      color: (s.matchPct ?? 0) >= 70 ? "#10b981" : (s.matchPct ?? 0) >= 40 ? "#f59e0b" : "#94a3b8",
                    }}>{s.matchPct}%</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Quick book reason summary */}
      {quickBookReason && (
        <div className={styles.quickBookReasonBar}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          <span>{quickBookReason}</span>
        </div>
      )}
    </div>
  );
}
