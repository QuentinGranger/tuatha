"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "../page.module.scss";
import { getSpecColor, formatDate, formatTime } from "../constants";
import { useBookingData } from "../hooks/useBookingData";
import { useBookingFlow } from "../hooks/useBookingFlow";
import { useAppointmentActions } from "../hooks/useAppointmentActions";
import { openVisioRoom } from "@/lib/visio";
import { getRemboursementMessage } from "@/lib/remboursement";
import type { HistoryTab, HistoryPeriod } from "../types";

type Data = ReturnType<typeof useBookingData>;
type Flow = ReturnType<typeof useBookingFlow>;
type Actions = ReturnType<typeof useAppointmentActions>;

interface Props {
  data: Data;
  flow: Flow;
  actions: Actions;
}

// Reusable inline components
function ErrorRetry({ title, detail, onRetry }: { title: string; detail?: string; onRetry: () => void }) {
  return (
    <div className={styles.errorBlock}>
      <div className={styles.errorIcon}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      </div>
      <p className={styles.errorTitle}>{title}</p>
      {detail && <p className={styles.errorDetail}>{detail}</p>}
      <button className={styles.retryBtn} onClick={onRetry}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
        Réessayer
      </button>
    </div>
  );
}

function RdvSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.skeletonRdvCard}>
          <div className={styles.skeletonRow}>
            <div className={styles.skeletonCircle} style={{ width: 40, height: 40 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className={`${styles.skeletonLine} ${styles['skeletonLine--medium']}`} />
              <div className={`${styles.skeletonLine} ${styles['skeletonLine--short']}`} />
            </div>
          </div>
          <div className={`${styles.skeletonLine} ${styles['skeletonLine--long']}`} />
        </div>
      ))}
    </>
  );
}

export function AppointmentView({ data, flow, actions }: Props) {
  const {
    appointments, loadingRdvs, rdvStatus, fetchAppointments,
    pastAppointments, loadingPast, pastStatus, fetchPastAppointments,
    activeReminders, dismissReminder, connections,
    followUpBooked, followUpLoading, scheduleFollowUp,
    learnedPrefs,
  } = data;

  const { startBooking, setSelectedPro } = flow;

  const {
    openModifyModal, prepData, openPrepId, togglePrep, updatePrepField,
    savePrep, prepSaving,
    delaySent, delayRdvId, setDelayRdvId, delayMinutes, setDelayMinutes,
    delayMessage, setDelayMessage, delaySending, sendDelayNotification,
    showHistory, setShowHistory, openHistory,
    historyRdvs, historyPros, historyStats,
    historyTab, setHistoryTab, historyProFilter, setHistoryProFilter,
    historySpecFilter, setHistorySpecFilter, historyPeriod, setHistoryPeriod,
    historyMotifFilter, setHistoryMotifFilter, historyLoading, fetchHistory,
  } = actions;

  // ─── Visio modal state ───
  const [visioModalRdv, setVisioModalRdv] = useState<{ id: string; title: string; date: string; proName: string; proSpec: string; visioRoomId: string } | null>(null);
  const [visioModalDismissed, setVisioModalDismissed] = useState<Set<string>>(new Set());
  const [visioCountdown, setVisioCountdown] = useState("");

  // Auto-show modal for teleconsultation RDVs within 5 min of start
  useEffect(() => {
    if (visioModalRdv) return; // already showing
    const visioRdv = appointments.find((rdv) => {
      if (rdv.format !== "teleconsultation" || !rdv.visioRoomId) return false;
      if (visioModalDismissed.has(rdv.id)) return false;
      const diff = new Date(rdv.date).getTime() - Date.now();
      return diff <= 5 * 60 * 1000 && diff > -30 * 60 * 1000; // 5min before → 30min after
    });
    if (visioRdv) {
      setVisioModalRdv({
        id: visioRdv.id,
        title: visioRdv.title,
        date: visioRdv.date,
        proName: `${visioRdv.pro.prenom} ${visioRdv.pro.nom}`,
        proSpec: visioRdv.pro.specialite,
        visioRoomId: visioRdv.visioRoomId!,
      });
    }
  }, [appointments, visioModalRdv, visioModalDismissed]);

  // Countdown timer for modal
  useEffect(() => {
    if (!visioModalRdv) return;
    const update = () => {
      const diff = new Date(visioModalRdv.date).getTime() - Date.now();
      if (diff <= 0) { setVisioCountdown("Maintenant"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setVisioCountdown(`${m}:${String(s).padStart(2, "0")}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [visioModalRdv]);

  const dismissVisioModal = useCallback(() => {
    if (visioModalRdv) {
      setVisioModalDismissed((prev) => new Set(prev).add(visioModalRdv.id));
    }
    setVisioModalRdv(null);
  }, [visioModalRdv]);

  const joinVisio = useCallback((roomId: string) => {
    openVisioRoom(roomId);
  }, []);

  return (
    <>
      {/* Full-screen visio modal */}
      {visioModalRdv && (
        <div className={styles.visioModalOverlay}>
          <div className={styles.visioModalCard}>
            <div className={styles.visioModalIcon}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            </div>
            <div className={styles.visioModalTitle}>Téléconsultation</div>
            <div className={styles.visioModalSub}>{visioModalRdv.title}</div>
            <div className={styles.visioModalPro}>{visioModalRdv.proName}</div>
            <div className={styles.visioModalSpec}>{visioModalRdv.proSpec}</div>
            <div className={styles.visioModalCountdown}>{visioCountdown}</div>
            <button className={styles.visioModalJoinBtn} onClick={() => { joinVisio(visioModalRdv.visioRoomId); dismissVisioModal(); }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
              Rejoindre la téléconsultation
            </button>
            <button className={styles.visioModalDismiss} onClick={dismissVisioModal}>Plus tard</button>
          </div>
        </div>
      )}

      {/* In-app reminder banners */}
      {activeReminders.length > 0 && (
        <div className={styles.reminderBanners}>
          {activeReminders.map((rem) => {
            const isNow = rem.type === "now_visio";
            const isVisio = rem.type === "h1_visio" || rem.type === "now_visio";
            const isUrgent = rem.type === "h2" || isVisio || isNow;
            const evDate = new Date(rem.eventDate);
            const heureStr = evDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const dateStr = evDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

            const labelMap: Record<string, string> = {
              j2: "Dans 2 jours", j1: "Demain", h2: "Dans 2 heures",
              h1_visio: "Dans 1 heure", now_visio: "C\u2019est maintenant",
            };
            const label = labelMap[rem.type] || "Rappel";

            const colorMap: Record<string, string> = {
              j2: "#3b82f6", j1: "#f59e0b", h2: "#f47b20",
              h1_visio: "#10b981", now_visio: "#10b981",
            };
            const accentColor = colorMap[rem.type] || "#f47b20";

            return (
              <div key={rem.id} className={`${styles.reminderCard} ${isNow ? styles.reminderCardNow : ""}`} style={{ borderColor: `${accentColor}33` }}>
                <button className={styles.reminderDismiss} onClick={() => dismissReminder(rem.id)} title="Fermer">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
                <div className={styles.reminderHeader}>
                  <span className={styles.reminderBadge} style={{ background: `${accentColor}18`, color: accentColor }}>
                    {isNow ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                    {label}
                  </span>
                  <span className={styles.reminderTime}>{heureStr}</span>
                </div>
                <div className={styles.reminderTitle}>{rem.eventTitle}</div>
                <div className={styles.reminderMeta}>
                  <span>{rem.professionnel.prenom} {rem.professionnel.nom}</span>
                  <span style={{ color: accentColor }}>{rem.professionnel.specialite}</span>
                </div>
                <div className={styles.reminderMeta}>
                  <span>{dateStr} à {heureStr}</span>
                  {rem.eventFormat === "presentiel" && rem.eventAddress && <span>{rem.eventAddress}</span>}
                  {rem.eventFormat === "teleconsultation" && <span>Téléconsultation</span>}
                </div>
                {rem.eventDocuments && (
                  <div className={styles.reminderDocs}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                    {rem.eventDocuments}
                  </div>
                )}
                <div className={styles.reminderActions}>
                  {isVisio && rem.eventVisioRoomId && (
                    <button className={styles.reminderVisioJoin} onClick={() => joinVisio(rem.eventVisioRoomId!)}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      Rejoindre la visio
                    </button>
                  )}
                  {rem.eventFormat === "presentiel" && rem.eventAddress && (
                    <a className={styles.reminderActionLink} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rem.eventAddress)}`} target="_blank" rel="noopener noreferrer">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                      Itinéraire
                    </a>
                  )}
                  {rem.professionnel.telephone && (
                    <a className={styles.reminderActionLink} href={`tel:${rem.professionnel.telephone}`}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                      Appeler
                    </a>
                  )}
                  {rem.professionnel.email && (
                    <a className={styles.reminderActionLink} href={`mailto:${rem.professionnel.email}`}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                      Contacter
                    </a>
                  )}
                  <button className={styles.reminderActionLink} style={{ color: "rgba(239,68,68,0.6)" }} onClick={() => dismissReminder(rem.id)}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    Annuler
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Engagement re-engagement nudge */}
      {learnedPrefs && (learnedPrefs.engagement.level === "en-baisse" || learnedPrefs.engagement.level === "inactif") && (
        <div className={styles.engagementNudge}>
          <div className={styles.engagementNudgeIcon}>
            {learnedPrefs.engagement.level === "inactif"
              ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>}
          </div>
          <div className={styles.engagementNudgeContent}>
            <span className={styles.engagementNudgeTitle}>
              {learnedPrefs.engagement.level === "inactif"
                ? "Cela fait un moment !"
                : "Vos consultations sont en baisse"}
            </span>
            <span className={styles.engagementNudgeText}>
              {learnedPrefs.engagement.level === "inactif"
                ? `Votre dernière consultation remonte à ${learnedPrefs.engagement.daysSinceLast ?? "plus de 120"}j. Reprenez le suivi pour rester en forme.`
                : `${learnedPrefs.engagement.recent90} consultation${learnedPrefs.engagement.recent90 > 1 ? "s" : ""} ces 90 derniers jours vs ${learnedPrefs.engagement.prev90} les 90 jours précédents.`}
            </span>
            <button className={styles.engagementNudgeBtn} onClick={startBooking}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Prendre rendez-vous
            </button>
          </div>
        </div>
      )}

      {/* Sequential pattern suggestions */}
      {learnedPrefs && learnedPrefs.sequentialPatterns.length > 0 && appointments.length === 0 && (
        <div className={styles.seqSuggestionBanner}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          <span>
            {learnedPrefs.sequentialPatterns.slice(0, 1).map((sp, i) => (
              <span key={i}>
                Après votre <strong>{sp.from}</strong>, vous consultez souvent un <strong>{sp.to}</strong>
                <span className={styles.seqPatternMeta}> (~{sp.avgDelayDays}j après)</span>
              </span>
            ))}
          </span>
          {(() => {
            const sp = learnedPrefs.sequentialPatterns[0];
            const matchingConn = connections.find((c) => c.professionnel.specialite.toLowerCase().includes(sp.to.toLowerCase()));
            if (!matchingConn) return null;
            return (
              <button className={styles.seqSuggestionBtn} onClick={() => { setSelectedPro(matchingConn.professionnel); startBooking(); }}>
                Réserver avec {matchingConn.professionnel.prenom}
              </button>
            );
          })()}
        </div>
      )}

      {/* Appointments list */}
      {rdvStatus === "loading" ? (
        <RdvSkeleton count={3} />
      ) : rdvStatus === "error" ? (
        <ErrorRetry title="Impossible de charger vos rendez-vous" detail="Vérifiez votre connexion et réessayez." onRetry={fetchAppointments} />
      ) : appointments.length === 0 ? (
        <div className={styles.emptyRdv}>
          <div className={styles.emptyRdvIcon}>
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          </div>
          <h2>Aucun rendez-vous à venir</h2>
          <p>Réservez votre premier rendez-vous avec un professionnel de santé</p>
          <button className={styles.emptyRdvBtn} onClick={startBooking}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Prendre rendez-vous
          </button>
        </div>
      ) : (
        <div className={styles.rdvList}>
          {appointments.map((rdv) => {
            const prep = prepData[rdv.id];
            const isOpen = openPrepId === rdv.id;
            const isCompleted = prep?.completedAt != null;
            const filledCount = prep ? [prep.motifDetail, prep.symptoms, prep.painLevel != null ? "x" : "", prep.evolution].filter(Boolean).length : 0;
            const rdvDate = new Date(rdv.date);
            const isToday = rdvDate.toDateString() === new Date().toDateString();
            const isPresentiel = rdv.format !== "teleconsultation";
            const mapsUrl = rdv.pro.adresseCabinet ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rdv.pro.adresseCabinet)}` : null;
            const diffMs = rdvDate.getTime() - Date.now();
            const diffH = Math.floor(diffMs / 3600000);
            const diffM = Math.floor((diffMs % 3600000) / 60000);
            const countdownLabel = diffMs <= 0 ? "Maintenant" : diffH > 0 ? `Dans ${diffH}h${diffM > 0 ? `${String(diffM).padStart(2, "0")}` : ""}` : `Dans ${diffM} min`;

            return (
              <div key={rdv.id} className={`${styles.rdvCard} ${isToday ? styles.rdvCardToday : ""}`}>
                <div className={styles.rdvCardDate}>
                  <span className={styles.rdvCardDay}>{formatDate(rdv.date)}</span>
                  <span className={styles.rdvCardTime}>{formatTime(rdv.date)}{rdv.endDate ? ` – ${formatTime(rdv.endDate)}` : ""}</span>
                </div>
                <div className={styles.rdvCardInfo}>
                  <span className={styles.rdvCardTitle}>{rdv.title}</span>
                  <span className={styles.rdvCardPro}>{rdv.pro.prenom} {rdv.pro.nom} · {rdv.pro.specialite}</span>
                  {(() => { const rm = getRemboursementMessage(rdv.pro.specialite); return (
                    <span className={styles.reimbBadge} style={{ color: rm.color, background: rm.bgColor }}>
                      <span className={styles.reimbBadgeIcon}>{rm.icon}</span>
                      {rm.shortLabel}
                    </span>
                  ); })()}
                </div>
                <button className={styles.rdvModifyBtn} onClick={() => openModifyModal(rdv)}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                </button>

                {/* Day-of assistance — Teleconsultation */}
                {isToday && !isPresentiel && rdv.visioRoomId && (
                  <div className={styles.dayOfSection}>
                    <div className={styles.dayOfBadge} style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      {countdownLabel} · Téléconsultation
                    </div>
                    <div className={styles.dayOfRow}>
                      <div className={styles.dayOfIcon} style={{ color: "#10b981" }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      </div>
                      <div className={styles.dayOfContent}>
                        <span className={styles.dayOfLabel}>Heure</span>
                        <span className={styles.dayOfValue}>
                          {rdvDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          {rdv.endDate && ` – ${new Date(rdv.endDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      </div>
                    </div>
                    {rdv.consignes && (
                      <div className={styles.dayOfRow}>
                        <div className={styles.dayOfIcon} style={{ color: "#8b5cf6" }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                        </div>
                        <div className={styles.dayOfContent}>
                          <span className={styles.dayOfLabel}>Consignes</span>
                          <span className={styles.dayOfValue}>{rdv.consignes}</span>
                        </div>
                      </div>
                    )}
                    <button className={styles.dayOfVisioJoin} onClick={() => joinVisio(rdv.visioRoomId!)}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      Rejoindre la téléconsultation
                    </button>
                    <div className={styles.dayOfVisioHint}>S&apos;ouvre dans un nouvel onglet</div>
                  </div>
                )}

                {/* Day-of assistance — Presentiel */}
                {isToday && isPresentiel && (
                  <div className={styles.dayOfSection}>
                    <div className={styles.dayOfBadge}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      {countdownLabel}
                    </div>
                    {rdv.pro.adresseCabinet && (
                      <div className={styles.dayOfRow}>
                        <div className={styles.dayOfIcon} style={{ color: "#3b82f6" }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        </div>
                        <div className={styles.dayOfContent}>
                          <span className={styles.dayOfLabel}>Adresse</span>
                          <span className={styles.dayOfValue}>{rdv.pro.adresseCabinet}</span>
                        </div>
                        {mapsUrl && (
                          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.dayOfAction}>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                            Itinéraire
                          </a>
                        )}
                      </div>
                    )}
                    <div className={styles.dayOfRow}>
                      <div className={styles.dayOfIcon} style={{ color: "#f59e0b" }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      </div>
                      <div className={styles.dayOfContent}>
                        <span className={styles.dayOfLabel}>Heure exacte</span>
                        <span className={styles.dayOfValue}>
                          {rdvDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          {rdv.endDate && ` – ${new Date(rdv.endDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      </div>
                    </div>
                    {rdv.consignes && (
                      <div className={styles.dayOfRow}>
                        <div className={styles.dayOfIcon} style={{ color: "#8b5cf6" }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                        </div>
                        <div className={styles.dayOfContent}>
                          <span className={styles.dayOfLabel}>Consignes</span>
                          <span className={styles.dayOfValue}>{rdv.consignes}</span>
                        </div>
                      </div>
                    )}
                    <div className={styles.dayOfDelaySection}>
                      {delaySent.has(rdv.id) ? (
                        <div className={styles.dayOfDelaySent}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          Retard signalé au praticien
                        </div>
                      ) : delayRdvId === rdv.id ? (
                        <div className={styles.dayOfDelayForm}>
                          <div className={styles.dayOfDelayHeader}>Prévenir d&apos;un retard</div>
                          <div className={styles.dayOfDelayOptions}>
                            {[5, 10, 15, 20, 30].map((m) => (
                              <button key={m} className={`${styles.dayOfDelayOption} ${delayMinutes === m ? styles.dayOfDelayOptionActive : ""}`} onClick={() => setDelayMinutes(m)}>
                                {m} min
                              </button>
                            ))}
                          </div>
                          <input className={styles.dayOfDelayInput} placeholder="Message facultatif…" value={delayMessage} onChange={(e) => setDelayMessage(e.target.value)} />
                          <div className={styles.dayOfDelayActions}>
                            <button className={styles.dayOfDelayCancel} onClick={() => { setDelayRdvId(null); setDelayMessage(""); }}>Annuler</button>
                            <button className={styles.dayOfDelaySubmit} onClick={() => sendDelayNotification(rdv.id)} disabled={delaySending}>
                              {delaySending ? <span className={styles.btnSpinner} /> : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>}
                              Envoyer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className={styles.dayOfDelayBtn} onClick={() => setDelayRdvId(rdv.id)}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          Prévenir d&apos;un retard
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Prep checklist toggle */}
                <button className={`${styles.prepToggle} ${isCompleted ? styles.prepToggleDone : ""}`} onClick={() => togglePrep(rdv.id)}>
                  {isCompleted ? (
                    <><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Préparation complétée</>
                  ) : (
                    <><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>Préparer en 1 min{filledCount > 0 && <span className={styles.prepBadgeCount}>{filledCount}/4</span>}</>
                  )}
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9" /></svg>
                </button>

                {/* Expandable prep form */}
                {isOpen && prep && (
                  <div className={styles.prepForm}>
                    <div className={styles.prepHeader}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      <span>Préparez votre rendez-vous</span>
                    </div>
                    <div className={styles.prepField}>
                      <label className={styles.prepLabel}><span className={styles.prepStep}>1</span>Complétez le motif de consultation</label>
                      <textarea className={styles.prepTextarea} placeholder="Précisez votre motif (ex: douleur au genou gauche depuis 2 semaines)" value={prep.motifDetail || ""} onChange={(e) => updatePrepField(rdv.id, "motifDetail", e.target.value)} rows={2} />
                    </div>
                    <div className={styles.prepField}>
                      <label className={styles.prepLabel}><span className={styles.prepStep}>2</span>Décrivez vos symptômes</label>
                      <textarea className={styles.prepTextarea} placeholder="Localisation, intensité, quand ça se déclenche…" value={prep.symptoms || ""} onChange={(e) => updatePrepField(rdv.id, "symptoms", e.target.value)} rows={2} />
                    </div>
                    <div className={styles.prepField}>
                      <label className={styles.prepLabel}><span className={styles.prepStep}>3</span>Niveau de douleur & fatigue</label>
                      <div className={styles.prepSliders}>
                        <div className={styles.prepSliderRow}>
                          <span className={styles.prepSliderLabel}>Douleur</span>
                          <input type="range" min="0" max="10" value={prep.painLevel ?? 0} onChange={(e) => updatePrepField(rdv.id, "painLevel", parseInt(e.target.value, 10))} className={styles.prepSlider} />
                          <span className={styles.prepSliderValue} style={{ color: (prep.painLevel ?? 0) > 6 ? "#ef4444" : (prep.painLevel ?? 0) > 3 ? "#f59e0b" : "#10b981" }}>{prep.painLevel ?? 0}/10</span>
                        </div>
                        <div className={styles.prepSliderRow}>
                          <span className={styles.prepSliderLabel}>Fatigue</span>
                          <input type="range" min="0" max="10" value={prep.fatigueLevel ?? 0} onChange={(e) => updatePrepField(rdv.id, "fatigueLevel", parseInt(e.target.value, 10))} className={styles.prepSlider} />
                          <span className={styles.prepSliderValue} style={{ color: (prep.fatigueLevel ?? 0) > 6 ? "#ef4444" : (prep.fatigueLevel ?? 0) > 3 ? "#f59e0b" : "#10b981" }}>{prep.fatigueLevel ?? 0}/10</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.prepField}>
                      <label className={styles.prepLabel}><span className={styles.prepStep}>4</span>Évolution depuis la dernière séance</label>
                      <textarea className={styles.prepTextarea} placeholder="Amélioration, stagnation, aggravation, nouveaux symptômes…" value={prep.evolution || ""} onChange={(e) => updatePrepField(rdv.id, "evolution", e.target.value)} rows={2} />
                    </div>
                    <div className={styles.prepDocReminder}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      <div>
                        <div className={styles.prepDocTitle}>Pensez à apporter</div>
                        <div className={styles.prepDocList}>Carte Vitale · Ordonnance · Imagerie / bilans récents</div>
                      </div>
                    </div>
                    <div className={styles.prepActions}>
                      <button className={styles.prepSaveBtn} onClick={() => savePrep(rdv.id, false)} disabled={prepSaving}>
                        {prepSaving ? <span className={styles.btnSpinner} /> : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>}
                        Sauvegarder
                      </button>
                      <button className={styles.prepCompleteBtn} onClick={() => savePrep(rdv.id, true)} disabled={prepSaving || isCompleted}>
                        {isCompleted ? <><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Complétée</> : <><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Terminer la préparation</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Post-consultation follow-up */}
      {pastStatus === "loading" && (
        <div style={{ marginTop: 16 }}>
          <RdvSkeleton count={2} />
        </div>
      )}
      {pastStatus === "error" && (
        <ErrorRetry title="Impossible de charger les consultations passées" onRetry={fetchPastAppointments} />
      )}
      {pastStatus === "success" && pastAppointments.length > 0 && (
        <div className={styles.postSection}>
          <div className={styles.postSectionHeader}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Consultations terminées
          </div>
          {pastAppointments.map((past) => {
            const pastDate = new Date(past.date);
            const daysAgo = Math.floor((Date.now() - pastDate.getTime()) / 86400000);
            const daysAgoLabel = daysAgo === 0 ? "Aujourd'hui" : daysAgo === 1 ? "Hier" : `Il y a ${daysAgo} jours`;
            const hasDocuments = past.documents.length > 0 || past.ordonnances.length > 0;
            const isBooked = followUpBooked.has(past.id);
            const hasUpcomingWithSamePro = appointments.some((a) => a.pro.id === past.pro.id);
            const categoryLabels: Record<string, string> = { ordonnance: "Ordonnance", compte_rendu: "Compte rendu", courrier: "Courrier", imagerie: "Imagerie", biologie: "Biologie", autre: "Document", certificat: "Certificat" };
            const ordTypeLabels: Record<string, string> = { kine: "Ordonnance kiné", imagerie: "Ordonnance imagerie", biologie: "Ordonnance biologie", medicament: "Ordonnance médicament", arret: "Arrêt de travail", certificat: "Certificat médical", orientation: "Orientation", dispositif: "Dispositif médical" };

            return (
              <div key={past.id} className={styles.postCard}>
                <div className={styles.postCardHeader}>
                  <div className={styles.postCardBadge}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Terminée
                  </div>
                  <span className={styles.postCardAgo}>{daysAgoLabel}</span>
                </div>
                <div className={styles.postCardTitle}>{past.title}</div>
                <div className={styles.postCardMeta}>
                  {past.pro.prenom} {past.pro.nom} · {pastDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à {pastDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                {(() => { const rm = getRemboursementMessage(past.pro.specialite); return (
                  <span className={styles.reimbBadge} style={{ color: rm.color, background: rm.bgColor }}>
                    <span className={styles.reimbBadgeIcon}>{rm.icon}</span>
                    {rm.shortLabel}
                  </span>
                ); })()}
                {hasDocuments && (
                  <div className={styles.postDocs}>
                    <div className={styles.postDocsTitle}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      Documents reçus
                    </div>
                    {past.ordonnances.map((ord) => (
                      <div key={ord.id} className={styles.postDocItem}>
                        <div className={styles.postDocIcon} style={{ color: "#a855f7" }}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></div>
                        <div className={styles.postDocInfo}><span className={styles.postDocName}>{ordTypeLabels[ord.type] || "Ordonnance"}</span><span className={styles.postDocDetail}>{ord.diagnosis}</span></div>
                      </div>
                    ))}
                    {past.documents.map((doc) => (
                      <div key={doc.id} className={styles.postDocItem}>
                        <div className={styles.postDocIcon} style={{ color: "#3b82f6" }}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></div>
                        <div className={styles.postDocInfo}><span className={styles.postDocName}>{categoryLabels[doc.category] || doc.category}</span><span className={styles.postDocDetail}>{doc.name}</span></div>
                      </div>
                    ))}
                  </div>
                )}
                {!isBooked && !hasUpcomingWithSamePro ? (
                  <div className={styles.postFollowUp}>
                    <div className={styles.postFollowUpTitle}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      Programmer le prochain suivi
                    </div>
                    <div className={styles.postFollowUpHint}>Suivi recommandé avec {past.pro.prenom} {past.pro.nom}</div>
                    <div className={styles.postFollowUpGrid}>
                      {past.followUpSuggestions.map((s) => (
                        <button key={s.days} className={styles.postFollowUpBtn} onClick={() => scheduleFollowUp(past, s.days)} disabled={followUpLoading !== null}>
                          {followUpLoading === `${past.id}-${s.days}` ? <span className={styles.btnSpinner} /> : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <button className={styles.postRebookBtn} onClick={() => { setSelectedPro(connections.find((c) => c.professionnel.id === past.pro.id)?.professionnel || null); startBooking(); }}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Reprendre rendez-vous (choisir un créneau)
                    </button>
                  </div>
                ) : isBooked ? (
                  <div className={styles.postFollowUpDone}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Prochain suivi programmé
                  </div>
                ) : (
                  <div className={styles.postFollowUpDone}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    Un suivi est déjà prévu avec ce praticien
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* History toggle */}
      {!showHistory && (
        <button className={styles.historyToggle} onClick={openHistory}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          Voir tout l&apos;historique
        </button>
      )}

      {/* Full History View */}
      {showHistory && (
        <div className={styles.historySection}>
          <div className={styles.historySectionHeader}>
            <div className={styles.historySectionTitle}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Historique complet
            </div>
            <button className={styles.historyClose} onClick={() => setShowHistory(false)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div className={styles.historyStats}>
            <div className={styles.historyStat}><span className={styles.historyStatNum}>{historyStats.total}</span><span className={styles.historyStatLabel}>Total</span></div>
            <div className={styles.historyStat}><span className={styles.historyStatNum} style={{ color: "#3b82f6" }}>{historyStats.upcoming}</span><span className={styles.historyStatLabel}>À venir</span></div>
            <div className={styles.historyStat}><span className={styles.historyStatNum} style={{ color: "#10b981" }}>{historyStats.past}</span><span className={styles.historyStatLabel}>Passés</span></div>
            <div className={styles.historyStat}><span className={styles.historyStatNum} style={{ color: "#ef4444" }}>{historyStats.cancelled}</span><span className={styles.historyStatLabel}>Annulés</span></div>
          </div>
          <div className={styles.historyTabs}>
            {([["all", "Tous"], ["upcoming", "À venir"], ["past", "Passés"], ["cancelled", "Annulés"]] as [HistoryTab, string][]).map(([tab, label]) => (
              <button key={tab} className={`${styles.historyTab} ${historyTab === tab ? styles.historyTabActive : ""}`} onClick={() => { setHistoryTab(tab); fetchHistory(tab); }}>
                {label}
              </button>
            ))}
          </div>
          <div className={styles.historyFilters}>
            <select className={styles.historyFilter} value={historyProFilter} onChange={(e) => { setHistoryProFilter(e.target.value); fetchHistory(undefined, e.target.value); }}>
              <option value="">Tous les pros</option>
              {historyPros.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
            </select>
            <select className={styles.historyFilter} value={historySpecFilter} onChange={(e) => { setHistorySpecFilter(e.target.value); fetchHistory(undefined, undefined, e.target.value); }}>
              <option value="">Toutes spécialités</option>
              <option value="medecin">Médecin</option>
              <option value="kine">Kinésithérapeute</option>
              <option value="dieteticien">Diététicien</option>
              <option value="autre">Autre professionnel</option>
            </select>
            <select className={styles.historyFilter} value={historyPeriod} onChange={(e) => { setHistoryPeriod(e.target.value as HistoryPeriod); fetchHistory(undefined, undefined, undefined, e.target.value as HistoryPeriod); }}>
              <option value="all">Toutes périodes</option>
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">3 mois</option>
              <option value="6m">6 mois</option>
              <option value="1y">1 an</option>
            </select>
            <input className={styles.historyFilterInput} placeholder="Filtrer par motif…" value={historyMotifFilter} onChange={(e) => setHistoryMotifFilter(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") fetchHistory(undefined, undefined, undefined, undefined, historyMotifFilter); }} />
          </div>
          {historyLoading ? (
            <RdvSkeleton count={4} />
          ) : historyRdvs.length === 0 ? (
            <div className={styles.historyEmpty}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <p>Aucun rendez-vous trouvé</p>
            </div>
          ) : (
            <div className={styles.historyList}>
              {historyRdvs.map((rdv) => {
                const rdvDate = new Date(rdv.date);
                const statusConfig = {
                  upcoming: { label: "À venir", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
                  past: { label: "Terminé", color: "#10b981", bg: "rgba(16,185,129,0.08)" },
                  cancelled: { label: "Annulé", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
                };
                const sc = statusConfig[rdv.status];
                const specColor = getSpecColor(rdv.pro.specialite);
                const hasDocs = rdv.documents.length > 0 || rdv.ordonnances.length > 0;
                const ordTypeLabels: Record<string, string> = { kine: "Ord. kiné", imagerie: "Ord. imagerie", biologie: "Ord. biologie", medicament: "Ord. médicament", arret: "Arrêt", certificat: "Certificat", orientation: "Orientation", dispositif: "Dispositif" };
                const catLabels: Record<string, string> = { ordonnance: "Ordonnance", compte_rendu: "Compte rendu", courrier: "Courrier", imagerie: "Imagerie", biologie: "Biologie", certificat: "Certificat", autre: "Document" };

                return (
                  <div key={rdv.id} className={`${styles.historyCard} ${rdv.status === "cancelled" ? styles.historyCardCancelled : ""}`}>
                    <div className={styles.historyCardLeft}>
                      <div className={styles.historyCardDate}>
                        <span className={styles.historyCardDay}>{rdvDate.toLocaleDateString("fr-FR", { day: "numeric" })}</span>
                        <span className={styles.historyCardMonth}>{rdvDate.toLocaleDateString("fr-FR", { month: "short" })}</span>
                        <span className={styles.historyCardYear}>{rdvDate.getFullYear()}</span>
                      </div>
                    </div>
                    <div className={styles.historyCardBody}>
                      <div className={styles.historyCardTop}>
                        <span className={styles.historyCardBadge} style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        <span className={styles.historyCardTime}>{rdvDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}{rdv.endDate && ` – ${new Date(rdv.endDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}</span>
                        <span className={styles.historyCardFormat}>{rdv.format === "teleconsultation" ? "Visio" : "Cabinet"}</span>
                      </div>
                      <div className={styles.historyCardTitle}>{rdv.title}</div>
                      <div className={styles.historyCardPro}>
                        <span className={styles.historyCardProDot} style={{ background: specColor }} />
                        {rdv.pro.prenom} {rdv.pro.nom}
                        <span className={styles.historyCardSpec}>{rdv.pro.specialite}</span>
                      </div>
                      {rdv.motif && (
                        <div className={styles.historyCardMotif}>
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                          {rdv.motif}
                        </div>
                      )}
                      {hasDocs && (
                        <div className={styles.historyCardDocs}>
                          {rdv.ordonnances.map((o) => <span key={o.id} className={styles.historyDocTag} style={{ color: "#a855f7", background: "rgba(168,85,247,0.06)" }}>{ordTypeLabels[o.type] || "Ordonnance"}</span>)}
                          {rdv.documents.map((d) => <span key={d.id} className={styles.historyDocTag} style={{ color: "#3b82f6", background: "rgba(59,130,246,0.06)" }}>{catLabels[d.category] || d.category}</span>)}
                        </div>
                      )}
                      {rdv.status === "cancelled" && rdv.cancelledAt && (
                        <div className={styles.historyCardCancelInfo}>Annulé le {new Date(rdv.cancelledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
