"use client";

import React from "react";
import styles from "../page.module.scss";
import type { SuggestedSlot, AvailableSlot } from "../types";
import { useBookingFlow } from "../hooks/useBookingFlow";
import { useAppointmentActions } from "../hooks/useAppointmentActions";

type Flow = ReturnType<typeof useBookingFlow>;
type Actions = ReturnType<typeof useAppointmentActions>;

interface Props {
  flow: Flow;
  suggestedSlots: SuggestedSlot[];
  actions: Actions;
}

export function StepChooseSlot({ flow, suggestedSlots, actions }: Props) {
  const {
    loadingSlots, slotsError, availableSlots, selectedSlot, selectedPro, calendarView, setCalendarView,
    selectedCalDate, setSelectedCalDate, slotsByDate, datesWithSlots, slotsForSelectedDate,
    getWeekDates, handleSlotSelect, setStep, confirmFilters,
  } = flow;

  const {
    showSlotAlert, setShowSlotAlert, slotAlertSaved, slotAlertDays, toggleSlotAlertDay,
    slotAlertTimeStart, setSlotAlertTimeStart, slotAlertTimeEnd, setSlotAlertTimeEnd,
    slotAlertFormat, setSlotAlertFormat, slotAlertPriority, setSlotAlertPriority,
    slotAlertSaving, submitSlotAlert,
  } = actions;

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Choisissez votre créneau</h2>
      <p className={styles.stepSubtitle}>
        {loadingSlots
          ? "Recherche des créneaux disponibles…"
          : <>
              {availableSlots.length} créneau{availableSlots.length > 1 ? "x" : ""} disponible{availableSlots.length > 1 ? "s" : ""}
              {selectedPro && <> avec <strong>{selectedPro.prenom} {selectedPro.nom}</strong></>}
            </>
        }
      </p>

      {loadingSlots ? (
        <div className={styles.slotsLoading}>
          <div className={styles.slotsSpinner} />
          <span>Chargement des disponibilités…</span>
        </div>
      ) : slotsError ? (
        <div className={styles.errorBlock}>
          <div className={styles.errorIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <p className={styles.errorTitle}>Impossible de charger les créneaux</p>
          <p className={styles.errorDetail}>Vérifiez votre connexion et réessayez.</p>
          <button className={styles.retryBtn} onClick={confirmFilters}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            Réessayer
          </button>
        </div>
      ) : (<>

      {/* Smart suggestions */}
      {suggestedSlots.length > 0 && (
        <div className={styles.suggestionsSection}>
          <div className={styles.suggestionsHeader}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            <span>Créneaux suggérés pour vous</span>
          </div>
          <div className={styles.suggestionsGrid}>
            {suggestedSlots.map((s) => {
              const isToday = s.slot.date.toDateString() === new Date().toDateString();
              const isTomorrow = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return s.slot.date.toDateString() === t.toDateString(); })();
              return (
                <button
                  key={s.slot.id}
                  className={`${styles.suggestionCard} ${selectedSlot?.id === s.slot.id ? styles.suggestionCardSelected : ""}`}
                  onClick={() => handleSlotSelect(s.slot)}
                >
                  <div className={styles.suggestionTime}>
                    <span className={styles.suggestionHour}>
                      {s.slot.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className={styles.suggestionDate}>
                      {isToday ? "Aujourd\u2019hui" : isTomorrow ? "Demain" : s.slot.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <div className={styles.suggestionBadges}>
                    {s.badges.map((b, i) => (
                      <span key={i} className={styles.suggestionBadge} style={{ background: `${b.color}15`, color: b.color, borderColor: `${b.color}30` }}>
                        {b.icon === "zap" && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>}
                        {b.icon === "star" && <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                        {b.icon === "calendar" && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
                        {b.icon === "arrow-right" && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>}
                        {b.icon === "monitor" && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>}
                        {b.icon === "user" && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                        {b.icon === "clock" && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                        {b.icon === "repeat" && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>}
                        {b.label}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {availableSlots.length > suggestedSlots.length && (
            <div className={styles.suggestionsDivider}>
              <span>Tous les créneaux</span>
            </div>
          )}
        </div>
      )}

      {/* View toggle */}
      <div className={styles.slotViewTabs}>
        <button className={`${styles.slotViewTab} ${calendarView === "list" ? styles.slotViewTabActive : ""}`} onClick={() => setCalendarView("list")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
          Liste
        </button>
        <button className={`${styles.slotViewTab} ${calendarView === "day" ? styles.slotViewTabActive : ""}`} onClick={() => setCalendarView("day")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          Jour
        </button>
        <button className={`${styles.slotViewTab} ${calendarView === "week" ? styles.slotViewTabActive : ""}`} onClick={() => setCalendarView("week")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="10" y1="4" x2="10" y2="22" /></svg>
          Semaine
        </button>
      </div>

      {/* Mini date strip */}
      {(calendarView === "day" || calendarView === "week") && (
        <div className={styles.dateStrip}>
          <button className={styles.dateStripArrow} onClick={() => { const d = new Date(selectedCalDate); d.setDate(d.getDate() - (calendarView === "week" ? 7 : 1)); setSelectedCalDate(d); }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className={styles.dateStripDays}>
            {(calendarView === "week" ? getWeekDates(selectedCalDate) : [selectedCalDate]).map((d) => {
              const hasSlots = availableSlots.some((s) => s.date.toDateString() === d.toDateString());
              const isSelected = d.toDateString() === selectedCalDate.toDateString();
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <button
                  key={d.toISOString()}
                  className={`${styles.dateStripDay} ${isSelected && calendarView === "week" ? styles.dateStripDaySelected : ""} ${!hasSlots ? styles.dateStripDayEmpty : ""}`}
                  onClick={() => setSelectedCalDate(d)}
                >
                  <span className={styles.dateStripDayName}>{d.toLocaleDateString("fr-FR", { weekday: "short" })}</span>
                  <span className={`${styles.dateStripDayNum} ${isToday ? styles.dateStripDayToday : ""}`}>{d.getDate()}</span>
                  {hasSlots && <span className={styles.dateStripDot} />}
                </button>
              );
            })}
          </div>
          <button className={styles.dateStripArrow} onClick={() => { const d = new Date(selectedCalDate); d.setDate(d.getDate() + (calendarView === "week" ? 7 : 1)); setSelectedCalDate(d); }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      )}

      {availableSlots.length === 0 ? (
        <div className={styles.noSlots}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="16" x2="15" y2="16" /></svg>
          <p>Aucun créneau disponible avec ces filtres</p>
          <button className={styles.linkBtn} onClick={() => setStep("choose-filters")}>Modifier les filtres</button>

          {!showSlotAlert && !slotAlertSaved && (
            <button className={styles.slotAlertTrigger} onClick={() => setShowSlotAlert(true)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              Me prévenir si un créneau se libère
            </button>
          )}

          {slotAlertSaved && (
            <div className={styles.slotAlertSuccess}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Alerte activée ! Vous serez notifié dès qu&apos;un créneau se libère.
            </div>
          )}

          {showSlotAlert && !slotAlertSaved && (
            <div className={styles.slotAlertForm}>
              <div className={styles.slotAlertTitle}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                Vos préférences de créneau
              </div>
              <div className={styles.slotAlertField}>
                <label className={styles.slotAlertLabel}>Jours préférés</label>
                <div className={styles.slotAlertDays}>
                  {[{ day: 1, label: "Lun" }, { day: 2, label: "Mar" }, { day: 3, label: "Mer" }, { day: 4, label: "Jeu" }, { day: 5, label: "Ven" }, { day: 6, label: "Sam" }].map(({ day, label }) => (
                    <button key={day} className={`${styles.slotAlertDayBtn} ${slotAlertDays.includes(day) ? styles.slotAlertDayActive : ""}`} onClick={() => toggleSlotAlertDay(day)}>
                      {label}
                    </button>
                  ))}
                </div>
                {slotAlertDays.length === 0 && <span className={styles.slotAlertHint}>Tous les jours si aucun sélectionné</span>}
              </div>
              <div className={styles.slotAlertField}>
                <label className={styles.slotAlertLabel}>Plage horaire</label>
                <div className={styles.slotAlertTimeRow}>
                  <select className={styles.slotAlertSelect} value={slotAlertTimeStart} onChange={(e) => setSlotAlertTimeStart(e.target.value)}>
                    {["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className={styles.slotAlertTimeSep}>à</span>
                  <select className={styles.slotAlertSelect} value={slotAlertTimeEnd} onChange={(e) => setSlotAlertTimeEnd(e.target.value)}>
                    {["12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.slotAlertField}>
                <label className={styles.slotAlertLabel}>Format</label>
                <div className={styles.slotAlertFormats}>
                  <button className={`${styles.slotAlertFormatBtn} ${slotAlertFormat === null ? styles.slotAlertFormatActive : ""}`} onClick={() => setSlotAlertFormat(null)}>Peu importe</button>
                  <button className={`${styles.slotAlertFormatBtn} ${slotAlertFormat === "presentiel" ? styles.slotAlertFormatActive : ""}`} onClick={() => setSlotAlertFormat("presentiel")}>Présentiel</button>
                  <button className={`${styles.slotAlertFormatBtn} ${slotAlertFormat === "teleconsultation" ? styles.slotAlertFormatActive : ""}`} onClick={() => setSlotAlertFormat("teleconsultation")}>Téléconsultation</button>
                </div>
              </div>
              <div className={styles.slotAlertField}>
                <label className={styles.slotAlertCheckRow} onClick={() => setSlotAlertPriority(!slotAlertPriority)}>
                  <span className={`${styles.slotAlertCheck} ${slotAlertPriority ? styles.slotAlertCheckActive : ""}`}>
                    {slotAlertPriority && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </span>
                  <div>
                    <span className={styles.slotAlertCheckLabel}>Prioritaire (SMS)</span>
                    <span className={styles.slotAlertCheckDesc}>Recevoir un SMS en plus de l&apos;email et de la notification</span>
                  </div>
                </label>
              </div>
              <div className={styles.slotAlertActions}>
                <button className={styles.slotAlertCancel} onClick={() => setShowSlotAlert(false)}>Annuler</button>
                <button className={styles.slotAlertSubmit} onClick={() => submitSlotAlert(flow.selectedPro?.id || null, flow.selectedMotif)} disabled={slotAlertSaving}>
                  {slotAlertSaving ? <span className={styles.btnSpinner} /> : (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                  )}
                  Activer l&apos;alerte
                </button>
              </div>
            </div>
          )}
        </div>
      ) : calendarView === "list" ? (
        <div className={styles.slotList}>
          {Object.entries(slotsByDate).map(([dateStr, slots]) => {
            const d = new Date(dateStr);
            const isToday = d.toDateString() === new Date().toDateString();
            const isTomorrow = (() => { const tom = new Date(); tom.setDate(tom.getDate() + 1); return d.toDateString() === tom.toDateString(); })();
            return (
              <div key={dateStr} className={styles.slotDateGroup}>
                <div className={styles.slotDateHeader}>
                  <span className={styles.slotDateLabel}>
                    {isToday ? "Aujourd'hui" : isTomorrow ? "Demain" : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <span className={styles.slotDateCount}>{slots.length} créneau{slots.length > 1 ? "x" : ""}</span>
                </div>
                <div className={styles.slotTimeGrid}>
                  {slots.map((slot) => (
                    <button key={slot.id} className={`${styles.slotTimeBtn} ${selectedSlot?.id === slot.id ? styles.slotTimeBtnSelected : ""}`} onClick={() => handleSlotSelect(slot)}>
                      {slot.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : calendarView === "day" ? (
        <div className={styles.slotList}>
          {slotsForSelectedDate.length === 0 ? (
            <div className={styles.noSlotsDay}>
              <p>Aucun créneau ce jour</p>
              {datesWithSlots.length > 0 && (
                <button className={styles.linkBtn} onClick={() => setSelectedCalDate(datesWithSlots[0])}>
                  Prochain : {datesWithSlots[0].toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </button>
              )}
            </div>
          ) : (
            <div className={styles.slotDateGroup}>
              <div className={styles.slotDateHeader}>
                <span className={styles.slotDateLabel}>{selectedCalDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
              </div>
              <div className={styles.slotTimeGrid}>
                {slotsForSelectedDate.map((slot) => (
                  <button key={slot.id} className={`${styles.slotTimeBtn} ${selectedSlot?.id === slot.id ? styles.slotTimeBtnSelected : ""}`} onClick={() => handleSlotSelect(slot)}>
                    {slot.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.weekGrid}>
          {getWeekDates(selectedCalDate).map((d) => {
            const daySlots = availableSlots.filter((s) => s.date.toDateString() === d.toDateString());
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={d.toISOString()} className={`${styles.weekDay} ${isWeekend ? styles.weekDayOff : ""}`}>
                <div className={styles.weekDayHeader}>
                  <span>{d.toLocaleDateString("fr-FR", { weekday: "short" })}</span>
                  <span>{d.getDate()}</span>
                </div>
                <div className={styles.weekDaySlots}>
                  {daySlots.length === 0 ? (
                    <span className={styles.weekDayEmpty}>—</span>
                  ) : (
                    daySlots.map((slot) => (
                      <button key={slot.id} className={`${styles.weekSlotBtn} ${selectedSlot?.id === slot.id ? styles.weekSlotBtnSelected : ""}`} onClick={() => handleSlotSelect(slot)}>
                        {slot.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}
    </div>
  );
}
