"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import styles from "../page.module.scss";
import { getSpecColor, formatTime } from "../constants";
import type { NextRdv, PastRdv } from "../types";

/* ── Types ── */

type CalView = "month" | "week" | "day";

interface CalEvent {
  id: string;
  title: string;
  date: Date;
  endDate: Date | null;
  proName: string;
  proSpec: string;
  specColor: string;
  format: string;
  status: "upcoming" | "past";
  raw: NextRdv | PastRdv;
}

interface Props {
  appointments: NextRdv[];
  pastAppointments: PastRdv[];
  onSelectRdv?: (id: string) => void;
  onBook?: () => void;
}

/* ── Helpers ── */

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_MINI = ["L", "M", "M", "J", "V", "S", "D"];
const DAYS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const SPEC_LABELS: Record<string, string> = {
  kinesitherapeute: "Kiné", kine: "Kiné", "kinésithérapeute": "Kiné",
  medecin: "Médecin", "médecin": "Médecin",
  dieteticien: "Diététicien", "diététicien": "Diététicien",
  nutritionniste: "Diététicien", nutri: "Diététicien",
  autre: "Autre pro", coach: "Autre pro",
};

function specLabel(s: string): string {
  const k = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [key, label] of Object.entries(SPEC_LABELS)) {
    if (k.includes(key)) return label;
  }
  return s;
}

function startOfWeek(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const start = new Date(first);
  start.setDate(start.getDate() - firstDow);
  const weeks: Date[][] = [];
  const cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur.getMonth() !== month && w >= 4) break;
  }
  return weeks;
}

function getWeekDays(base: Date): Date[] {
  const mon = startOfWeek(base);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function durationLabel(start: Date, end: Date | null): string {
  if (!end) return "";
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function relativeDay(d: Date): string {
  const today = new Date();
  const diff = Math.floor((d.getTime() - today.setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return "Aujourd\u2019hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  if (diff > 1 && diff <= 6) return `Dans ${diff}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function countdownLabel(d: Date): string {
  const now = Date.now();
  const diff = d.getTime() - now;
  if (diff <= 0) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `dans ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `dans ${hours}h${mins % 60 > 0 ? String(mins % 60).padStart(2, "0") : ""}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "demain";
  return `dans ${days} jours`;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7h → 22h

/* ── SVG Icons (inline) ── */
const IconChevronLeft = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>;
const IconChevronRight = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>;
const IconPlus = <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const IconClock = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const IconCalendar = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const IconUser = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const IconVideo = <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>;
const IconMapPin = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const IconX = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const IconRefresh = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>;
const IconSearch = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;

/* ── Component ── */

export function CalendarAgenda({ appointments, pastAppointments, onSelectRdv, onBook }: Props) {
  const [view, setView] = useState<CalView>("month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const weekGridRef = useRef<HTMLDivElement>(null);
  const dayGridRef = useRef<HTMLDivElement>(null);
  const agendaRef = useRef<HTMLDivElement>(null);

  // Merge all events
  const allEvents: CalEvent[] = useMemo(() => {
    const list: CalEvent[] = [];
    appointments.forEach((rdv) => {
      list.push({
        id: rdv.id, title: rdv.title,
        date: new Date(rdv.date), endDate: rdv.endDate ? new Date(rdv.endDate) : null,
        proName: `${rdv.pro.prenom} ${rdv.pro.nom}`, proSpec: rdv.pro.specialite,
        specColor: getSpecColor(rdv.pro.specialite),
        format: rdv.format || "presentiel", status: "upcoming", raw: rdv,
      });
    });
    pastAppointments.forEach((rdv) => {
      list.push({
        id: rdv.id, title: rdv.title,
        date: new Date(rdv.date), endDate: rdv.endDate ? new Date(rdv.endDate) : null,
        proName: `${rdv.pro.prenom} ${rdv.pro.nom}`, proSpec: rdv.pro.specialite,
        specColor: getSpecColor(rdv.pro.specialite),
        format: rdv.format || "presentiel", status: "past", raw: rdv,
      });
    });
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    return list;
  }, [appointments, pastAppointments]);

  // Unique specialties for filter
  const specList = useMemo(() => {
    const map = new Map<string, { label: string; color: string; count: number }>();
    allEvents.forEach((e) => {
      const key = e.proSpec.toLowerCase();
      if (!map.has(key)) map.set(key, { label: specLabel(e.proSpec), color: e.specColor, count: 0 });
      map.get(key)!.count++;
    });
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [allEvents]);

  // Filtered events
  const events = useMemo(() => {
    let filtered = allEvents;
    if (specFilter) filtered = filtered.filter((e) => e.proSpec.toLowerCase() === specFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((e) => e.title.toLowerCase().includes(q) || e.proName.toLowerCase().includes(q) || e.proSpec.toLowerCase().includes(q));
    }
    return filtered;
  }, [allEvents, specFilter, searchQuery]);

  const eventsForDay = useCallback(
    (d: Date) => events.filter((e) => isSameDay(e.date, d)),
    [events],
  );

  // Next upcoming events
  const nextUpcoming = useMemo(() => {
    const now = new Date();
    return allEvents.filter((e) => e.status === "upcoming" && e.date >= now).slice(0, 4);
  }, [allEvents]);

  // Month event count for mini-cal badges
  const monthEventCounts = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((e) => {
      const key = `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [events]);

  const dayEventCount = (d: Date) => monthEventCounts.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) || 0;

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = allEvents.filter((e) => e.status === "upcoming" && e.date >= now).length;
    const thisMonth = allEvents.filter((e) => e.date.getMonth() === cursor.getMonth() && e.date.getFullYear() === cursor.getFullYear()).length;
    return { upcoming, thisMonth };
  }, [allEvents, cursor]);

  // Auto-scroll week/day grids to current time
  useEffect(() => {
    const ref = view === "week" ? weekGridRef.current : view === "day" ? dayGridRef.current : null;
    if (!ref) return;
    const now = new Date();
    const h = now.getHours();
    if (h >= 7 && h <= 22) {
      const pct = Math.max((h - 8) / 16, 0);
      ref.scrollTop = pct * ref.scrollHeight;
    }
  }, [view]);

  /* Keyboard navigation */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (selectedEvent) { if (e.key === "Escape") setSelectedEvent(null); return; }
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); goPrev(); break;
        case "ArrowRight": e.preventDefault(); goNext(); break;
        case "t": case "T": e.preventDefault(); goToday(); break;
        case "m": case "M": e.preventDefault(); setView("month"); break;
        case "w": case "W": e.preventDefault(); setView("week"); break;
        case "d": case "D": e.preventDefault(); setView("day"); break;
        case "Escape": if (searchOpen) { setSearchOpen(false); setSearchQuery(""); } break;
        case "/": case "f": if (!searchOpen) { e.preventDefault(); setSearchOpen(true); } break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedEvent, searchOpen]);

  /* Navigation */
  const goToday = useCallback(() => { setCursor(new Date()); setSelectedDate(new Date()); }, []);
  const goPrev = useCallback(() => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() - 1);
      else if (view === "week") d.setDate(d.getDate() - 7);
      else d.setDate(d.getDate() - 1);
      return d;
    });
  }, [view]);
  const goNext = useCallback(() => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + 1);
      else if (view === "week") d.setDate(d.getDate() + 7);
      else d.setDate(d.getDate() + 1);
      return d;
    });
  }, [view]);

  const handleDayClick = (d: Date) => { setSelectedDate(d); setSelectedEvent(null); };
  const openDay = (d: Date) => { setCursor(d); setSelectedDate(d); setView("day"); };

  /* Touch swipe navigation (Apple-like) */
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  useEffect(() => {
    const el = agendaRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      if (!touchRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchRef.current.x;
      const dy = touch.clientY - touchRef.current.y;
      const dt = Date.now() - touchRef.current.t;
      touchRef.current = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 300) {
        if (dx > 0) goPrev();
        else goNext();
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [goPrev, goNext]);

  /* Title */
  const viewTitle = useMemo(() => {
    if (view === "month") return `${MONTHS_FR[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "week") {
      const days = getWeekDays(cursor);
      const f = days[0], l = days[6];
      if (f.getMonth() === l.getMonth()) return `${f.getDate()} – ${l.getDate()} ${MONTHS_FR[f.getMonth()]} ${f.getFullYear()}`;
      return `${f.getDate()} ${MONTHS_FR[f.getMonth()].slice(0, 3)} – ${l.getDate()} ${MONTHS_FR[l.getMonth()].slice(0, 3)} ${l.getFullYear()}`;
    }
    return cursor.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [view, cursor]);

  const viewTitleShort = useMemo(() => {
    if (view === "month") return `${MONTHS_FR[cursor.getMonth()].slice(0, 3)} ${cursor.getFullYear()}`;
    if (view === "week") {
      const days = getWeekDays(cursor);
      const f = days[0], l = days[6];
      return `${f.getDate()} – ${l.getDate()} ${MONTHS_FR[f.getMonth()].slice(0, 3)}`;
    }
    return cursor.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  }, [view, cursor]);

  /* Side panel */
  const sideDate = selectedDate || new Date();
  const sideEvents = eventsForDay(sideDate);

  /* Now-line tick */
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);
  const nowH = useMemo(() => {
    const n = new Date(nowTick);
    return n.getHours() + n.getMinutes() / 60;
  }, [nowTick]);

  /* ═══ RENDER ═══ */

  return (
    <div className={styles.calAgenda} ref={agendaRef} tabIndex={-1}>
      {/* ── Upcoming banner ── */}
      {nextUpcoming.length > 0 && view === "month" && (
        <div className={styles.calUpcoming}>
          <div className={styles.calUpcomingLabel}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            À venir
            <span className={styles.calUpcomingCount}>{stats.upcoming}</span>
          </div>
          <div className={styles.calUpcomingList}>
            {nextUpcoming.map((ev) => (
              <button key={ev.id} className={styles.calUpcomingChip} onClick={() => setSelectedEvent(ev)} style={{ borderColor: `${ev.specColor}40` }}>
                <span className={styles.calUpcomingDot} style={{ background: ev.specColor }} />
                <span className={styles.calUpcomingWhen}>{relativeDay(ev.date)}</span>
                <span className={styles.calUpcomingTime}>{formatTime(ev.date.toISOString())}</span>
                <span className={styles.calUpcomingName}>{ev.proName}</span>
              </button>
            ))}
          </div>
          {onBook && (
            <button className={styles.calUpcomingBookBtn} onClick={onBook}>
              {IconPlus} Nouveau RDV
            </button>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className={styles.calToolbar}>
        <div className={styles.calToolbarLeft}>
          <button className={styles.calTodayBtn} onClick={goToday}>Aujourd&apos;hui</button>
          <div className={styles.calNavBtns}>
            <button className={styles.calNavBtn} onClick={goPrev}>{IconChevronLeft}</button>
            <button className={styles.calNavBtn} onClick={goNext}>{IconChevronRight}</button>
          </div>
          <h2 className={styles.calTitle}><span className={styles.calTitleLong}>{viewTitle}</span><span className={styles.calTitleShort}>{viewTitleShort}</span></h2>
        </div>
        <div className={styles.calToolbarRight}>
          {/* Search toggle */}
          {searchOpen ? (
            <div className={styles.calSearch}>
              <span className={styles.calSearchIcon}>{IconSearch}</span>
              <input
                className={styles.calSearchInput}
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button className={styles.calSearchClose} onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>{IconX}</button>
            </div>
          ) : (
            <button className={styles.calSearchBtn} onClick={() => setSearchOpen(true)} title="Rechercher (/)">
              {IconSearch}
            </button>
          )}
          <div className={styles.calViewTabs}>
            {(["month", "week", "day"] as CalView[]).map((v) => (
              <button key={v} className={`${styles.calViewTab} ${view === v ? styles.calViewTabActive : ""}`} onClick={() => setView(v)}>
                {v === "month" ? "Mois" : v === "week" ? "Sem" : "Jour"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Specialty filter bar ── */}
      {specList.length > 1 && (
        <div className={styles.calFilterBar}>
          <button
            className={`${styles.calFilterChip} ${!specFilter ? styles.calFilterChipActive : ""}`}
            onClick={() => setSpecFilter(null)}
          >
            Tous <span className={styles.calFilterCount}>{allEvents.length}</span>
          </button>
          {specList.map((s) => (
            <button
              key={s.key}
              className={`${styles.calFilterChip} ${specFilter === s.key ? styles.calFilterChipActive : ""}`}
              onClick={() => setSpecFilter(specFilter === s.key ? null : s.key)}
              style={specFilter === s.key ? { background: `${s.color}20`, borderColor: `${s.color}40`, color: s.color } : {}}
            >
              <span className={styles.calFilterDot} style={{ background: s.color }} />
              {s.label}
              <span className={styles.calFilterCount}>{s.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.calBody} key={view}>
        {/* ── MONTH VIEW ── */}
        {view === "month" && (
          <div className={styles.calMonth}>
            <div className={styles.calWeekHeader}>
              {DAYS_FR.map((d) => <div key={d} className={styles.calWeekHeaderCell}>{d}</div>)}
            </div>
            {getMonthGrid(cursor.getFullYear(), cursor.getMonth()).map((week, wi) => (
              <div key={wi} className={styles.calWeekRow}>
                {week.map((day) => {
                  const dayEvents = eventsForDay(day);
                  const isCurrentMonth = day.getMonth() === cursor.getMonth();
                  const isTd = isToday(day);
                  const isSel = selectedDate && isSameDay(day, selectedDate);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`${styles.calDayCell} ${!isCurrentMonth ? styles.calDayCellOther : ""} ${isTd ? styles.calDayCellToday : ""} ${isSel ? styles.calDayCellSelected : ""}`}
                      onClick={() => handleDayClick(day)}
                      onDoubleClick={() => openDay(day)}
                    >
                      <div className={styles.calDayCellHead}>
                        <span className={styles.calDayNum}>{day.getDate()}</span>
                        {dayEvents.length > 3 && (
                          <span className={styles.calDayBadge}>{dayEvents.length}</span>
                        )}
                      </div>
                      {dayEvents.length > 0 && (
                        <div className={styles.calDayEvents}>
                          {dayEvents.slice(0, 3).map((ev) => (
                            <div
                              key={ev.id}
                              className={`${styles.calEventChip} ${ev.status === "past" ? styles.calEventChipPast : ""}`}
                              style={{ background: `${ev.specColor}18`, color: ev.specColor, borderColor: `${ev.specColor}25` }}
                              onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                            >
                              <span className={styles.calEventChipTime}>{formatTime(ev.date.toISOString())}</span>
                              <span className={styles.calEventChipTitle}>{ev.title}</span>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <span className={styles.calEventMore} onClick={(e) => { e.stopPropagation(); openDay(day); }}>+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── WEEK VIEW ── */}
        {view === "week" && (() => {
          const weekDays = getWeekDays(cursor);
          return (
            <div className={styles.calWeek}>
              <div className={styles.calWeekGrid}>
                <div className={styles.calWeekGutter} />
                {weekDays.map((day) => {
                  const isTd = isToday(day);
                  const evCount = dayEventCount(day);
                  return (
                    <div key={day.toISOString()} className={`${styles.calWeekColHeader} ${isTd ? styles.calWeekColHeaderToday : ""}`} onClick={() => openDay(day)}>
                      <span className={styles.calWeekColDay}>{DAYS_FR[day.getDay() === 0 ? 6 : day.getDay() - 1]}</span>
                      <span className={`${styles.calWeekColNum} ${isTd ? styles.calWeekColNumToday : ""}`}>{day.getDate()}</span>
                      {evCount > 0 && <span className={styles.calWeekColBadge} style={{ background: isTd ? "#e67e22" : "rgba(255,255,255,0.12)" }}>{evCount}</span>}
                    </div>
                  );
                })}
              </div>
              <div className={styles.calWeekTimeGrid} ref={weekGridRef}>
                <div className={styles.calWeekGutter}>
                  {HOURS.map((h) => <div key={h} className={styles.calWeekHourLabel}>{String(h).padStart(2, "0")}:00</div>)}
                </div>
                {weekDays.map((day) => {
                  const dayEv = eventsForDay(day);
                  const isTd = isToday(day);
                  return (
                    <div key={day.toISOString()} className={`${styles.calWeekCol} ${isTd ? styles.calWeekColToday : ""}`}>
                      {HOURS.map((h) => (
                        <div key={h} className={styles.calWeekHourSlot} onClick={() => onBook && onBook()}>
                          <div className={styles.calWeekHalfLine} />
                        </div>
                      ))}
                      {/* Now line */}
                      {isTd && nowH >= 7 && nowH <= 22 && (
                        <div className={styles.calNowLine} style={{ top: `${((nowH - 7) / 16) * 100}%` }}>
                          <div className={styles.calNowDot} />
                        </div>
                      )}
                      {dayEv.map((ev, idx) => {
                        const startH = ev.date.getHours() + ev.date.getMinutes() / 60;
                        const endH = ev.endDate ? ev.endDate.getHours() + ev.endDate.getMinutes() / 60 : startH + 0.5;
                        const top = ((startH - 7) / 16) * 100;
                        const height = Math.max(((endH - startH) / 16) * 100, 2);
                        const overlapping = dayEv.filter((o, oi) => {
                          if (oi >= idx) return false;
                          const oS = o.date.getHours() + o.date.getMinutes() / 60;
                          const oE = o.endDate ? o.endDate.getHours() + o.endDate.getMinutes() / 60 : oS + 0.5;
                          return startH < oE && endH > oS;
                        });
                        const totalOverlap = dayEv.filter((o) => {
                          const oS = o.date.getHours() + o.date.getMinutes() / 60;
                          const oE = o.endDate ? o.endDate.getHours() + o.endDate.getMinutes() / 60 : oS + 0.5;
                          return startH < oE && endH > oS;
                        }).length;
                        const colWidth = totalOverlap > 1 ? (100 / totalOverlap) : 100;
                        const colIdx = overlapping.length;
                        return (
                          <div
                            key={ev.id}
                            className={`${styles.calWeekEvent} ${ev.status === "past" ? styles.calWeekEventPast : ""}`}
                            style={{
                              top: `${Math.max(top, 0)}%`, height: `${height}%`,
                              borderLeftColor: ev.specColor, background: `${ev.specColor}18`,
                              left: `${colIdx * colWidth}%`, width: `${colWidth}%`,
                            }}
                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                            title={`${ev.title} – ${ev.proName}\n${formatTime(ev.date.toISOString())}${ev.endDate ? ` – ${formatTime(ev.endDate.toISOString())}` : ""}`}
                          >
                            <span className={styles.calWeekEventTime}>{formatTime(ev.date.toISOString())}</span>
                            <span className={styles.calWeekEventTitle}>{ev.title}</span>
                            <span className={styles.calWeekEventPro}>{ev.proName}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── DAY VIEW ── */}
        {view === "day" && (() => {
          const dayEv = eventsForDay(cursor);
          const isTd = isToday(cursor);
          return (
            <div className={styles.calDay}>
              <div className={styles.calDayHeader}>
                <div className={styles.calDayHeaderInfo}>
                  <span className={styles.calDayHeaderDay}>{DAYS_FULL[cursor.getDay() === 0 ? 6 : cursor.getDay() - 1]}</span>
                  <span className={`${styles.calDayHeaderNum} ${isTd ? styles.calDayHeaderNumToday : ""}`}>{cursor.getDate()}</span>
                  <span className={styles.calDayHeaderMonth}>{MONTHS_FR[cursor.getMonth()]}</span>
                </div>
                <div className={styles.calDayHeaderStats}>
                  <span className={styles.calDayHeaderCount}>
                    {dayEv.length === 0 ? "Aucun rendez-vous" : `${dayEv.length} rendez-vous`}
                  </span>
                  {onBook && (
                    <button className={styles.calDayQuickBook} onClick={onBook}>
                      {IconPlus} Réserver
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.calDayTimeGrid} ref={dayGridRef}>
                <div className={styles.calDayGutter}>
                  {HOURS.map((h) => <div key={h} className={styles.calDayHourLabel}>{String(h).padStart(2, "0")}:00</div>)}
                </div>
                <div className={styles.calDaySlots}>
                  {HOURS.map((h) => (
                    <div key={h} className={styles.calDayHourSlot} onClick={() => onBook && onBook()}>
                      <div className={styles.calDayHalfLine} />
                    </div>
                  ))}
                  {/* Now indicator */}
                  {isTd && nowH >= 7 && nowH <= 22 && (
                    <div className={styles.calNowLine} style={{ top: `${((nowH - 7) / 16) * 100}%` }}>
                      <div className={styles.calNowDot} />
                      <span className={styles.calNowLabel}>{new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  )}
                  {dayEv.map((ev) => {
                    const startH = ev.date.getHours() + ev.date.getMinutes() / 60;
                    const endH = ev.endDate ? ev.endDate.getHours() + ev.endDate.getMinutes() / 60 : startH + 0.75;
                    const top = ((startH - 7) / 16) * 100;
                    const height = Math.max(((endH - startH) / 16) * 100, 3);
                    const dur = durationLabel(ev.date, ev.endDate);
                    return (
                      <div
                        key={ev.id}
                        className={`${styles.calDayEvent} ${ev.status === "past" ? styles.calDayEventPast : ""}`}
                        style={{ top: `${Math.max(top, 0)}%`, height: `${height}%`, borderLeftColor: ev.specColor, background: `${ev.specColor}18` }}
                        onClick={() => setSelectedEvent(ev)}
                      >
                        <div className={styles.calDayEventTop}>
                          <div className={styles.calDayEventTime}>
                            {formatTime(ev.date.toISOString())}
                            {ev.endDate && ` – ${formatTime(ev.endDate.toISOString())}`}
                          </div>
                          {dur && <span className={styles.calDayEventDur}>{dur}</span>}
                        </div>
                        <div className={styles.calDayEventTitle}>{ev.title}</div>
                        <div className={styles.calDayEventPro}>
                          <span className={styles.calDayEventDot} style={{ background: ev.specColor }} />
                          {ev.proName} · {specLabel(ev.proSpec)}
                        </div>
                        {ev.format === "teleconsultation" && (
                          <div className={styles.calDayEventFormat}>
                            {IconVideo} Téléconsultation
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dayEv.length === 0 && (
                    <div className={styles.calDayEmpty}>
                      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      <span>Journée libre</span>
                      <span className={styles.calDayEmptyHint}>Cliquez sur un créneau horaire pour réserver</span>
                      {onBook && (
                        <button className={styles.calDayEmptyBtn} onClick={onBook}>
                          {IconPlus} Prendre rendez-vous
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Side panel ── */}
        {view === "month" && (
          <div className={styles.calSide}>
            {/* Mini-month calendar */}
            <div className={styles.calMiniMonth}>
              <div className={styles.calMiniMonthHeader}>
                <button className={styles.calMiniNavBtn} onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <span className={styles.calMiniMonthTitle}>{MONTHS_FR[cursor.getMonth()].slice(0, 3)} {cursor.getFullYear()}</span>
                <button className={styles.calMiniNavBtn} onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18" /></svg>
                </button>
              </div>
              <div className={styles.calMiniGrid}>
                {DAYS_MINI.map((d, i) => <span key={i} className={styles.calMiniDayLabel}>{d}</span>)}
                {getMonthGrid(cursor.getFullYear(), cursor.getMonth()).flat().map((day) => {
                  const isOther = day.getMonth() !== cursor.getMonth();
                  const isTd = isToday(day);
                  const isSel = selectedDate && isSameDay(day, selectedDate);
                  const hasEv = dayEventCount(day) > 0;
                  return (
                    <button
                      key={day.toISOString()}
                      className={`${styles.calMiniDay} ${isOther ? styles.calMiniDayOther : ""} ${isTd ? styles.calMiniDayToday : ""} ${isSel ? styles.calMiniDaySel : ""}`}
                      onClick={() => handleDayClick(day)}
                    >
                      {day.getDate()}
                      {hasEv && <span className={styles.calMiniDayDot} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div className={styles.calSideStats}>
              <div className={styles.calSideStat}>
                <span className={styles.calSideStatNum}>{stats.upcoming}</span>
                <span className={styles.calSideStatLabel}>à venir</span>
              </div>
              <div className={styles.calSideStat}>
                <span className={styles.calSideStatNum}>{stats.thisMonth}</span>
                <span className={styles.calSideStatLabel}>ce mois</span>
              </div>
            </div>

            {/* Selected day events */}
            <div className={styles.calSideDivider} />
            <div className={styles.calSideTitle}>
              {isToday(sideDate) ? "Aujourd\u2019hui" : sideDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {sideEvents.length === 0 ? (
              <div className={styles.calSideEmpty}>
                <span>Rien de prévu</span>
                {onBook && (
                  <button className={styles.calSideBookBtn} onClick={onBook}>
                    {IconPlus} Réserver
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.calSideList}>
                {sideEvents.map((ev) => {
                  const dur = durationLabel(ev.date, ev.endDate);
                  const cd = ev.status === "upcoming" ? countdownLabel(ev.date) : "";
                  return (
                    <div key={ev.id} className={`${styles.calSideCard} ${ev.status === "past" ? styles.calSideCardPast : ""}`} style={{ borderLeftColor: ev.specColor }} onClick={() => setSelectedEvent(ev)}>
                      <div className={styles.calSideCardTime}>
                        {formatTime(ev.date.toISOString())}{ev.endDate && ` – ${formatTime(ev.endDate.toISOString())}`}
                        {dur && <span className={styles.calSideCardDur}>{dur}</span>}
                      </div>
                      <div className={styles.calSideCardTitle}>{ev.title}</div>
                      <div className={styles.calSideCardPro}>
                        <span className={styles.calSideCardDot} style={{ background: ev.specColor }} />
                        {ev.proName}
                      </div>
                      {cd && <span className={styles.calSideCardCountdown}>{cd}</span>}
                      {ev.format === "teleconsultation" && (
                        <span className={styles.calSideCardVisio}>
                          {IconVideo} Visio
                        </span>
                      )}
                    </div>
                  );
                })}
                {onBook && (
                  <button className={styles.calSideAddBtn} onClick={onBook}>
                    {IconPlus} Ajouter un rendez-vous
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Event detail modal ── */}
      {selectedEvent && (
        <div className={styles.calEventOverlay} onClick={() => setSelectedEvent(null)}>
          <div className={styles.calEventModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.calEventClose} onClick={() => setSelectedEvent(null)}>{IconX}</button>
            <div className={styles.calEventModalBar} style={{ background: `linear-gradient(90deg, ${selectedEvent.specColor}, ${selectedEvent.specColor}88)` }} />
            <div className={styles.calEventModalBody}>
              <div className={styles.calEventModalStatus}>
                <span className={`${styles.calEventModalBadge} ${selectedEvent.status === "upcoming" ? styles.calEventModalBadgeUp : styles.calEventModalBadgePast}`}>
                  {selectedEvent.status === "upcoming" ? "À venir" : "Terminé"}
                </span>
                {selectedEvent.format === "teleconsultation" && (
                  <span className={styles.calEventModalVisioBadge}>{IconVideo} Téléconsultation</span>
                )}
                {selectedEvent.status === "upcoming" && (() => {
                  const cd = countdownLabel(selectedEvent.date);
                  return cd ? <span className={styles.calEventModalCountdown}>{cd}</span> : null;
                })()}
              </div>
              <h3 className={styles.calEventModalTitle}>{selectedEvent.title}</h3>
              <div className={styles.calEventModalRow}>
                {IconCalendar}
                <span>{selectedEvent.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              <div className={styles.calEventModalRow}>
                {IconClock}
                <span>
                  {formatTime(selectedEvent.date.toISOString())}
                  {selectedEvent.endDate && ` – ${formatTime(selectedEvent.endDate.toISOString())}`}
                  {selectedEvent.endDate && <span className={styles.calEventModalDur}> ({durationLabel(selectedEvent.date, selectedEvent.endDate)})</span>}
                </span>
              </div>
              <div className={styles.calEventModalRow}>
                {IconUser}
                <span>{selectedEvent.proName}<span className={styles.calEventModalSpec} style={{ color: selectedEvent.specColor }}> · {specLabel(selectedEvent.proSpec)}</span></span>
              </div>
              <div className={styles.calEventModalRow}>
                {selectedEvent.format === "teleconsultation" ? (
                  <>{IconVideo}<span>Téléconsultation</span></>
                ) : (
                  <>{IconMapPin}<span>En cabinet</span></>
                )}
              </div>
              {/* Actions */}
              <div className={styles.calEventModalActions}>
                {selectedEvent.status === "upcoming" && (
                  <>
                    <button className={styles.calEventModalActionBtn} onClick={() => { setSelectedEvent(null); openDay(selectedEvent.date); }}>
                      {IconCalendar} Voir la journée
                    </button>
                    {selectedEvent.format === "teleconsultation" && (
                      <button className={styles.calEventModalVisioBtn}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                        Rejoindre la visio
                      </button>
                    )}
                    {onBook && (
                      <button className={styles.calEventModalCancelBtn} onClick={() => { setSelectedEvent(null); }}>
                        {IconX} Annuler le RDV
                      </button>
                    )}
                  </>
                )}
                {selectedEvent.status === "past" && onBook && (
                  <button className={styles.calEventModalRebookBtn} onClick={() => { setSelectedEvent(null); onBook(); }}>
                    {IconRefresh} Reprendre rendez-vous
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard hints */}
      <div className={styles.calKeyHints}>
        <span>← → naviguer</span>
        <span>M mois</span>
        <span>W sem</span>
        <span>D jour</span>
        <span>T aujourd&apos;hui</span>
        <span>/ chercher</span>
      </div>
    </div>
  );
}
