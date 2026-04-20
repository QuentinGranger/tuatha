"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./page.module.scss";

interface Athlete {
  id: string;
  name: string;
  sport: string | null;
  injuryNote: string | null;
  latestNote: string | null;
  lastContactAt: string | null;
  riskLevel: "GOOD" | "AVERAGE" | "CRITICAL";
  trend: "IMPROVING" | "STAGNATING" | "DECLINING";
  status: "active" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
  _count: { notes: number };
  avatarUrl?: string | null;
}

interface AthleteDetail extends Athlete {
  objectif: string | null;
  motif: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  consentement: boolean;
  consentementDate: string | null;
  dateNaissance: string | null;
  taille: number | null;
  poids: number | null;
  bodyZone: string | null;
  frequence: string | null;
  antecedents: string[];
  traitements: string | null;
  contreIndications: string | null;
  dataTracking: string[];
  canalCommunication: string | null;
  notes: { id: string; note: string; createdAt: string }[];
  _privacyRedacted?: string[];
  _athleteUserId?: string;
}

const PRIVACY_KEY_LABELS: Record<string, string> = {
  shareSport: "Sport & Objectif",
  sharePhysical: "Données physiques (taille, poids, âge)",
  shareAntecedents: "Antécédents médicaux",
  shareTraitements: "Traitements en cours",
  shareContraindic: "Contre-indications",
  shareVitals: "Constantes vitales",
  shareMessaging: "Messagerie",
  sharePhoto: "Photo de profil",
};

type StatusFilter = "active" | "paused" | "archived" | "";

const riskLabels: Record<string, { label: string; className: string }> = {
  GOOD: { label: "Bon", className: "badgeGood" },
  AVERAGE: { label: "Moyen", className: "badgeAverage" },
  CRITICAL: { label: "Critique", className: "badgeCritical" },
};

const trendLabels: Record<string, { label: string; className: string }> = {
  IMPROVING: { label: "En progrès", className: "trendUp" },
  STAGNATING: { label: "Stagne", className: "trendFlat" },
  DECLINING: { label: "En baisse", className: "trendDown" },
};

const statusLabels: Record<string, string> = {
  active: "Actif",
  paused: "En pause",
  archived: "Archivé",
};

export default function KineDashboardPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [noteModal, setNoteModal] = useState<{ athleteId: string; name: string } | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const fetchAthletes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());

    try {
      const res = await fetch(`/api/athletes?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setAthletes(data);
    } catch {
      console.error("Erreur chargement patients");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchAthletes();
  }, [fetchAthletes]);

  // Auto-refresh when a connection is accepted (event from layout SSE)
  useEffect(() => {
    const handler = () => fetchAthletes();
    window.addEventListener("tuatha:connection-accepted", handler);
    return () => window.removeEventListener("tuatha:connection-accepted", handler);
  }, [fetchAthletes]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuickAction = async (athleteId: string, data: Record<string, unknown>) => {
    try {
      await fetch(`/api/athletes/${athleteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      fetchAthletes();
    } catch {
      console.error("Erreur mise à jour");
    }
    setActionMenu(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Hier";
    if (diff < 7) return `Il y a ${diff}j`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const activeCount = athletes.length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tableau de Bord</h1>
          <p className={styles.subtitle}>
            {loading ? "Chargement..." : `${activeCount} patient${activeCount !== 1 ? "s" : ""} ${statusFilter ? statusLabels[statusFilter]?.toLowerCase() + "s" : ""}`}
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Ajouter un patient
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrapper}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Rechercher par nom ou pathologie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.statusTabs}>
          {(["active", "paused", "archived", ""] as StatusFilter[]).map((s) => (
            <button
              key={s}
              className={`${styles.statusTab} ${statusFilter === s ? styles.statusTabActive : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s ? statusLabels[s] : "Tous"}
            </button>
          ))}
        </div>
      </div>

      {/* Table or empty state */}
      {!loading && athletes.length === 0 ? (
        <div className={styles.emptyState}>
          {search ? (
            <>
              <p className={styles.emptyTitle}>Aucun résultat pour &quot;{search}&quot;</p>
              <p className={styles.emptyDesc}>Essayez un autre terme de recherche.</p>
            </>
          ) : (
            <>
              <div className={styles.emptyIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <p className={styles.emptyTitle}>Aucun patient pour le moment</p>
              <p className={styles.emptyDesc}>Commencez par ajouter votre premier patient pour gérer son suivi.</p>
              <div className={styles.emptyChecklist}>
                <div className={styles.checkItem}>✓ Ajoutez un patient avec sa pathologie</div>
                <div className={styles.checkItem}>✓ Notez le diagnostic et l&apos;état de santé</div>
                <div className={styles.checkItem}>✓ Suivez la rééducation au fil du temps</div>
              </div>
              <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Ajouter un patient
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Pathologie</th>
                <th>Diagnostic</th>
                <th>Dernier contact</th>
                <th>État</th>
                <th>Progression</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {athletes.map((a) => (
                <tr key={a.id} className={styles.row}>
                  <td>
                    <div className={styles.athleteCell}>
                      <div className={styles.athleteAvatar}>{a.avatarUrl ? <img src={a.avatarUrl} alt="" width={32} height={32} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} /> : getInitials(a.name)}</div>
                      <div>
                        <span className={styles.athleteNameLink} onClick={() => setSelectedAthleteId(a.id)}>{a.name}</span>
                        {a.status !== "active" && (
                          <span className={`${styles.statusBadge} ${styles[`status_${a.status}`]}`}>
                            {statusLabels[a.status]}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={styles.sportCell}>{a.sport || "—"}</td>
                  <td className={styles.injuryCell}>
                    <span className={styles.injuryText}>{a.injuryNote || "Aucune"}</span>
                  </td>
                  <td className={styles.dateCell}>{formatDate(a.lastContactAt)}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[riskLabels[a.riskLevel].className]}`}>
                      {riskLabels[a.riskLevel].label}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.trendBadge} ${styles[trendLabels[a.trend].className]}`}>
                      {a.trend === "IMPROVING" && "↑ "}
                      {a.trend === "DECLINING" && "↓ "}
                      {a.trend === "STAGNATING" && "→ "}
                      {trendLabels[a.trend].label}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.noteBtn}
                        onClick={() => setNoteModal({ athleteId: a.id, name: a.name })}
                        title="Note rapide"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <div className={styles.menuWrapper}>
                        <button
                          className={styles.menuBtn}
                          onClick={(e) => {
                            if (actionMenu === a.id) { setActionMenu(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 6, left: rect.right - 200 });
                            setActionMenu(a.id);
                          }}
                        >
                          ⋯
                        </button>
                        {actionMenu === a.id && (
                          <div ref={actionMenuRef} className={styles.menuDropdown} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, right: 'auto' }}>
                            <button className={styles.menuItem} onClick={() => handleQuickAction(a.id, { lastContactAt: new Date().toISOString() })}>
                              📅 Contacté aujourd&apos;hui
                            </button>
                            <div className={styles.menuDivider} />
                            <p className={styles.menuLabel}>Statut</p>
                            {(["active", "paused", "archived"] as const).map((s) => (
                              <button key={s} className={`${styles.menuItem} ${a.status === s ? styles.menuItemActive : ""}`} onClick={() => handleQuickAction(a.id, { status: s })}>
                                {statusLabels[s]}
                              </button>
                            ))}
                            <div className={styles.menuDivider} />
                            <p className={styles.menuLabel}>État santé</p>
                            {(["GOOD", "AVERAGE", "CRITICAL"] as const).map((r) => (
                              <button key={r} className={`${styles.menuItem} ${a.riskLevel === r ? styles.menuItemActive : ""}`} onClick={() => handleQuickAction(a.id, { riskLevel: r })}>
                                {riskLabels[r].label}
                              </button>
                            ))}
                            <div className={styles.menuDivider} />
                            <p className={styles.menuLabel}>Progression</p>
                            {(["IMPROVING", "STAGNATING", "DECLINING"] as const).map((t) => (
                              <button key={t} className={`${styles.menuItem} ${a.trend === t ? styles.menuItemActive : ""}`} onClick={() => handleQuickAction(a.id, { trend: t })}>
                                {trendLabels[t].label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendar */}
      <CalendarWidget athletes={athletes} />

      {/* Kanban */}
      <KanbanBoard athletes={athletes} />

      {/* Add Athlete Modal */}
      {showAddModal && (
        <AddAthleteModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); fetchAthletes(); }}
        />
      )}

      {/* Athlete Detail Sidebar */}
      {selectedAthleteId && (
        <AthletePanel
          athleteId={selectedAthleteId}
          onClose={() => setSelectedAthleteId(null)}
          onUpdated={fetchAthletes}
          formatDate={formatDate}
          getInitials={getInitials}
        />
      )}

      {/* Note Modal */}
      {noteModal && (
        <NoteModal
          athleteId={noteModal.athleteId}
          athleteName={noteModal.name}
          onClose={() => setNoteModal(null)}
          onSaved={() => { setNoteModal(null); fetchAthletes(); }}
        />
      )}
    </div>
  );
}

/* ─────── Calendar Types ─────── */
interface CalEvent {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  allDay: boolean;
  type: string;
  color: string;
  description: string | null;
  reminderMinutes: number | null;
  athleteId: string | null;
  athlete: { id: string; name: string } | null;
}

const EVENT_TYPES = [
  { value: "rdv", label: "Rendez-vous", color: "orange" },
  { value: "note", label: "Note", color: "blue" },
  { value: "bilan", label: "Bilan", color: "green" },
  { value: "rappel", label: "Rappel", color: "purple" },
  { value: "perso", label: "Personnel", color: "gray" },
];

const EVENT_COLORS: Record<string, string> = {
  orange: "#f97316", blue: "#3b82f6", green: "#22c55e",
  purple: "#a855f7", gray: "#94a3b8", red: "#ef4444",
};

/* ─────── Calendar Widget (iCal-inspired) ─────── */
function CalendarWidget({ athletes }: { athletes: Athlete[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [view, setView] = useState<"month" | "week">("month");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [kanbanDueTasks, setKanbanDueTasks] = useState<KTask[]>([]);
  const [eventModal, setEventModal] = useState<{ mode: "add" | "edit"; event?: CalEvent; prefillDate?: string } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const fetchEvents = useCallback(() => {
    fetch(`/api/events?month=${monthKey}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEvents(data); })
      .catch(() => {});
    fetch("/api/kanban")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setKanbanDueTasks(data.filter((t: KTask) => t.dueDate)); })
      .catch(() => {});
  }, [monthKey]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date().getDate()); };

  const monthLabel = currentDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Group events by day
  const eventsByDay = new Map<number, CalEvent[]>();
  events.forEach((ev) => {
    const d = new Date(ev.date).getDate();
    const arr = eventsByDay.get(d) || [];
    arr.push(ev);
    eventsByDay.set(d, arr);
  });

  // Adjust for Monday start
  const startOffset = (firstDayOfMonth + 6) % 7;

  const cells: { day: number; inMonth: boolean; isToday: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: daysInPrevMonth - startOffset + 1 + i, inMonth: false, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, isToday: isCurrentMonth && d === today.getDate() });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, inMonth: false, isToday: false });
    }
  }

  // Week view
  const getWeekDays = () => {
    const sel = selectedDay || today.getDate();
    const date = new Date(year, month, sel);
    const dayOfWeek = (date.getDay() + 6) % 7;
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - dayOfWeek);
    const days: { date: Date; label: string; dayNum: number; isToday: boolean; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push({ date: d, label: d.toLocaleDateString("fr-FR", { weekday: "short" }), dayNum: d.getDate(), isToday: d.toDateString() === today.toDateString(), inMonth: d.getMonth() === month });
    }
    return days;
  };

  const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) || []) : [];

  const selectedDayTasks = selectedDay ? kanbanDueTasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay;
  }) : [];

  const openAddForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T09:00`;
    setEventModal({ mode: "add", prefillDate: dateStr });
  };

  const handleDeleteEvent = async (id: string) => {
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    fetchEvents();
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
    <div className={styles.calendar}>
      {/* Header */}
      <div className={styles.calHeader}>
        <div className={styles.calTitle}>
          <h3>{monthLabel}</h3>
        </div>
        <div className={styles.calActions}>
          <button className={styles.calAddBtn} onClick={() => openAddForDay(selectedDay || today.getDate())}>
            + Événement
          </button>
          <button className={styles.calTodayBtn} onClick={goToday}>Aujourd&apos;hui</button>
          <div className={styles.calViewToggle}>
            <button className={`${styles.calViewBtn} ${view === "month" ? styles.calViewActive : ""}`} onClick={() => setView("month")}>Mois</button>
            <button className={`${styles.calViewBtn} ${view === "week" ? styles.calViewActive : ""}`} onClick={() => setView("week")}>Sem.</button>
          </div>
          <div className={styles.calNav}>
            <button onClick={prevMonth} className={styles.calNavBtn}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button onClick={nextMonth} className={styles.calNavBtn}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Day headers */}
      <div className={styles.calDayHeaders}>
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className={styles.calDayHeader}>{d}</div>
        ))}
      </div>

      {/* Month grid */}
      {view === "month" && (
        <div className={styles.calGrid}>
          {cells.map((c, i) => {
            const dayEvents = c.inMonth ? (eventsByDay.get(c.day) || []) : [];
            const isSelected = c.inMonth && selectedDay === c.day;
            return (
              <div
                key={i}
                className={`${styles.calCell} ${!c.inMonth ? styles.calCellOut : ""} ${c.isToday ? styles.calCellToday : ""} ${isSelected ? styles.calCellSelected : ""}`}
                onClick={() => c.inMonth && setSelectedDay(c.day)}
                onDoubleClick={() => c.inMonth && openAddForDay(c.day)}
              >
                <span className={styles.calCellDay}>{c.day}</span>
                {dayEvents.length > 0 && (
                  <div className={styles.calCellEvents}>
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div key={ev.id} className={styles.calPill} style={{ borderLeftColor: EVENT_COLORS[ev.color] || EVENT_COLORS.orange }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <span className={styles.calMore}>+{dayEvents.length - 3}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Week view */}
      {view === "week" && (
        <div className={styles.calWeek}>
          {getWeekDays().map((d, i) => {
            const dayEvents = d.inMonth ? (eventsByDay.get(d.dayNum) || []) : [];
            const isSelected = d.inMonth && selectedDay === d.dayNum;
            return (
              <div
                key={i}
                className={`${styles.calWeekDay} ${d.isToday ? styles.calCellToday : ""} ${isSelected ? styles.calCellSelected : ""} ${!d.inMonth ? styles.calCellOut : ""}`}
                onClick={() => d.inMonth && setSelectedDay(d.dayNum)}
                onDoubleClick={() => d.inMonth && openAddForDay(d.dayNum)}
              >
                <span className={styles.calWeekLabel}>{d.label}</span>
                <span className={styles.calWeekNum}>{d.dayNum}</span>
                <div className={styles.calWeekEvents}>
                  {dayEvents.map((ev) => (
                    <div key={ev.id} className={styles.calEventPill} style={{ background: `${EVENT_COLORS[ev.color] || EVENT_COLORS.orange}18`, borderLeftColor: EVENT_COLORS[ev.color] || EVENT_COLORS.orange, color: EVENT_COLORS[ev.color] || EVENT_COLORS.orange }}>
                      {!ev.allDay && <span className={styles.calEventTime}>{formatTime(ev.date)}</span>}
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected day details */}
      {selectedDay && (
        <div className={styles.calDetails}>
          <div className={styles.calDetailsHeader}>
            <div className={styles.calDetailsTitle}>{selectedDay} {currentDate.toLocaleDateString("fr-FR", { month: "long" })}</div>
            <button className={styles.calDetailsAdd} onClick={() => openAddForDay(selectedDay)}>+ Ajouter</button>
          </div>
          {selectedEvents.length === 0 && selectedDayTasks.length === 0 ? (
            <p className={styles.calDetailsEmpty}>Aucun événement — double-cliquez sur un jour ou cliquez &quot;+ Ajouter&quot;</p>
          ) : (
            <>
              {selectedEvents.map((ev) => (
                <div key={ev.id} className={styles.calDetailItem} onClick={() => setEventModal({ mode: "edit", event: ev })}>
                  <span className={styles.calDetailDot} style={{ background: EVENT_COLORS[ev.color] || EVENT_COLORS.orange }} />
                  <div className={styles.calDetailContent}>
                    <span className={styles.calDetailTitle}>{ev.title}</span>
                    <span className={styles.calDetailMeta}>
                      {!ev.allDay && formatTime(ev.date)}
                      {ev.athlete && ` · ${ev.athlete.name}`}
                      {ev.description && ` · ${ev.description}`}
                    </span>
                  </div>
                  <button className={styles.calDetailDelete} onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }} title="Supprimer">×</button>
                </div>
              ))}
              {selectedDayTasks.length > 0 && (
                <>
                  <div className={styles.calDetailSep}>Tâches dues</div>
                  {selectedDayTasks.map((t) => (
                    <div key={t.id} className={styles.calDetailItem}>
                      <span className={styles.calDetailDot} style={{ background: t.priority === "high" ? "#ef4444" : t.priority === "medium" ? "#f97316" : "#94a3b8" }} />
                      <div className={styles.calDetailContent}>
                        <span className={styles.calDetailTitle}>{t.title}</span>
                        <span className={styles.calDetailMeta}>
                          {KANBAN_COLS.find(c => c.id === t.column)?.label}
                          {t.athlete && ` · ${t.athlete.name}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

    </div>

    {/* Event Modal — rendered outside calendar container */}
    {eventModal && (
      <EventModal
        mode={eventModal.mode}
        event={eventModal.event}
        prefillDate={eventModal.prefillDate}
        athletes={athletes}
        onClose={() => setEventModal(null)}
        onSaved={() => { setEventModal(null); fetchEvents(); }}
      />
    )}
    </>
  );
}

/* ─────── Event Modal ─────── */
function EventModal({ mode, event, prefillDate, athletes, onClose, onSaved }: {
  mode: "add" | "edit";
  event?: CalEvent;
  prefillDate?: string;
  athletes: Athlete[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(event?.title || "");
  const [date, setDate] = useState(event ? event.date.slice(0, 16) : prefillDate || "");
  const [endDate, setEndDate] = useState(event?.endDate ? event.endDate.slice(0, 16) : "");
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [type, setType] = useState(event?.type || "rdv");
  const [color, setColor] = useState(event?.color || "orange");
  const [description, setDescription] = useState(event?.description || "");
  const [athleteId, setAthleteId] = useState(event?.athleteId || "");
  const [reminderMinutes, setReminderMinutes] = useState<string>(event?.reminderMinutes != null ? String(event.reminderMinutes) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Le titre est requis"); return; }
    if (!date) { setError("La date est requise"); return; }
    setLoading(true);
    setError("");

    const body = { title, date, endDate: endDate || null, allDay, type, color, description, athleteId: athleteId || null, reminderMinutes: reminderMinutes !== "" ? parseInt(reminderMinutes) : null };

    try {
      const url = mode === "edit" && event ? `/api/events/${event.id}` : "/api/events";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else onSaved();
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <div className={styles.modalHeader}>
          <h2>{mode === "edit" ? "Modifier" : "Nouvel événement"}</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.field}>
            <label>Titre *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="RDV, Note, Bilan..." autoFocus />
          </div>
          <div className={styles.field}>
            <label>Type</label>
            <div className={styles.chipGroup}>
              {EVENT_TYPES.map((t) => (
                <button key={t.value} type="button" className={`${styles.chip} ${type === t.value ? styles.chipActive : ""}`} style={type === t.value ? { borderColor: EVENT_COLORS[t.color], color: EVENT_COLORS[t.color], background: `${EVENT_COLORS[t.color]}15` } : {}} onClick={() => { setType(t.value); setColor(t.color); }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <span>Journée entière</span>
          </label>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>{allDay ? "Date" : "Début"} *</label>
              <input type={allDay ? "date" : "datetime-local"} value={allDay ? date.slice(0, 10) : date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {!allDay && (
              <div className={styles.field}>
                <label>Fin</label>
                <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
          </div>
          <div className={styles.field}>
            <label>Patient lié</label>
            <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
              <option value="">— Aucun —</option>
              {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label>Rappel</label>
            <select value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)}>
              <option value="">Aucun rappel</option>
              <option value="0">Au moment de l&apos;événement</option>
              <option value="5">5 minutes avant</option>
              <option value="15">15 minutes avant</option>
              <option value="30">30 minutes avant</option>
              <option value="60">1 heure avant</option>
              <option value="1440">1 jour avant</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Détails, notes..." rows={2} />
          </div>
          {error && <p className={styles.formError}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "..." : mode === "edit" ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────── Kanban Board ─────── */
interface KTask {
  id: string;
  title: string;
  description: string | null;
  column: string;
  position: number;
  priority: string;
  dueDate: string | null;
  reminderMinutes: number | null;
  athleteId: string | null;
  athlete: { id: string; name: string } | null;
  isRdv?: boolean;
  rdvFormat?: string;
  rdvEndDate?: string | null;
}

const KANBAN_COLS = [
  { id: "todo", label: "À faire", color: "#3b82f6" },
  { id: "doing", label: "En cours", color: "#f97316" },
  { id: "done", label: "Terminé", color: "#22c55e" },
];

const PRIORITIES = [
  { value: "low", label: "Basse", color: "#94a3b8" },
  { value: "medium", label: "Moyenne", color: "#f97316" },
  { value: "high", label: "Haute", color: "#ef4444" },
];

function KanbanBoard({ athletes }: { athletes: Athlete[] }) {
  const [tasks, setTasks] = useState<KTask[]>([]);
  const [addingCol, setAddingCol] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newAthleteId, setNewAthleteId] = useState("");
  const [editTask, setEditTask] = useState<KTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editAthleteId, setEditAthleteId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editReminder, setEditReminder] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    fetch("/api/kanban").then(r => r.json()).then(d => { if (Array.isArray(d)) setTasks(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchTasks();
    // Refresh every 60s so RDV cards move between columns in real-time
    const interval = setInterval(fetchTasks, 60_000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const addTask = async (col: string) => {
    if (!newTitle.trim()) return;
    await fetch("/api/kanban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, column: col, priority: newPriority, athleteId: newAthleteId || null, dueDate: null, reminderMinutes: null }),
    });
    setNewTitle(""); setNewPriority("medium"); setNewAthleteId(""); setAddingCol(null);
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/kanban/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  const moveTask = async (taskId: string, toCol: string) => {
    const maxPos = tasks.filter(t => t.column === toCol).length;
    await fetch(`/api/kanban/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column: toCol, position: maxPos }),
    });
    fetchTasks();
  };

  const saveEdit = async () => {
    if (!editTask || !editTitle.trim()) return;
    await fetch(`/api/kanban/${editTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, description: editDesc, priority: editPriority, athleteId: editAthleteId || null, dueDate: editDueDate || null, reminderMinutes: editReminder !== "" ? parseInt(editReminder) : null }),
    });
    setEditTask(null);
    fetchTasks();
  };

  const openEdit = (t: KTask) => {
    setEditTask(t);
    setEditTitle(t.title);
    setEditDesc(t.description || "");
    setEditPriority(t.priority);
    setEditAthleteId(t.athleteId || "");
    setEditDueDate(t.dueDate ? t.dueDate.slice(0, 16) : "");
    setEditReminder(t.reminderMinutes != null ? String(t.reminderMinutes) : "");
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (colId: string) => {
    if (dragId) { moveTask(dragId, colId); setDragId(null); }
  };

  return (
    <>
    <div className={styles.kanban}>
      <div className={styles.kanbanHeader}>
        <h3>Kanban</h3>
      </div>
      <div className={styles.kanbanBoard}>
        {KANBAN_COLS.map(col => {
          const colTasks = tasks.filter(t => t.column === col.id);
          return (
            <div
              key={col.id}
              className={styles.kanbanCol}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.id)}
            >
              <div className={styles.kanbanColHeader}>
                <span className={styles.kanbanColDot} style={{ background: col.color }} />
                <span className={styles.kanbanColTitle}>{col.label}</span>
                <span className={styles.kanbanColCount}>{colTasks.length}</span>
                <button className={styles.kanbanColAdd} onClick={() => { setAddingCol(addingCol === col.id ? null : col.id); setNewTitle(""); }}>+</button>
              </div>

              {addingCol === col.id && (
                <div className={styles.kanbanAddForm}>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Titre de la tâche..."
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") addTask(col.id); if (e.key === "Escape") setAddingCol(null); }}
                  />
                  <div className={styles.kanbanAddRow}>
                    <select value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                      {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <select value={newAthleteId} onChange={e => setNewAthleteId(e.target.value)}>
                      <option value="">Aucun patient</option>
                      {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className={styles.kanbanAddActions}>
                    <button onClick={() => addTask(col.id)} className={styles.kanbanAddSave}>Ajouter</button>
                    <button onClick={() => setAddingCol(null)} className={styles.kanbanAddCancel}>Annuler</button>
                  </div>
                </div>
              )}

              <div className={styles.kanbanCards}>
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    className={`${styles.kanbanCard} ${task.isRdv ? styles.kanbanCardRdv : ""}`}
                    draggable={!task.isRdv}
                    onDragStart={() => !task.isRdv && handleDragStart(task.id)}
                    onClick={() => !task.isRdv && openEdit(task)}
                  >
                    <div className={styles.kanbanCardTop}>
                      {task.isRdv ? (
                        <span className={styles.kanbanRdvBadge}>
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          RDV
                        </span>
                      ) : (
                        <span className={styles.kanbanPriority} style={{ background: PRIORITIES.find(p => p.value === task.priority)?.color || "#94a3b8" }} />
                      )}
                      <span className={styles.kanbanCardTitle}>{task.isRdv ? task.title.replace(/^RDV\s+/, "").split(" — ")[0] : task.title}</span>
                      {!task.isRdv && <button className={styles.kanbanCardDel} onClick={e => { e.stopPropagation(); deleteTask(task.id); }}>×</button>}
                    </div>
                    {task.isRdv && task.dueDate && (
                      <div className={styles.kanbanRdvTime}>
                        {new Date(task.dueDate).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                        {" · "}
                        {new Date(task.dueDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {task.rdvEndDate && ` – ${new Date(task.rdvEndDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                      </div>
                    )}
                    {!task.isRdv && task.description && <p className={styles.kanbanCardDesc}>{task.description}</p>}
                    <div className={styles.kanbanCardMeta}>
                      {task.isRdv && task.rdvFormat && (
                        <span className={styles.kanbanRdvFormat} style={{ color: task.rdvFormat === "teleconsultation" ? "#10b981" : "#3b82f6" }}>
                          {task.rdvFormat === "teleconsultation" ? "📹 Visio" : "🏥 Cabinet"}
                        </span>
                      )}
                      {!task.isRdv && task.dueDate && <span className={styles.kanbanCardDue}>{new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                      {task.athlete && <span className={styles.kanbanCardAthlete}>{task.athlete.name}</span>}
                      {task.isRdv && !task.athlete && task.title.includes(" — ") && <span className={styles.kanbanCardAthlete}>{task.title.split(" — ")[1]}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {editTask && (
      <div className={styles.overlay} onClick={() => setEditTask(null)}>
        <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ width: 420 }}>
          <div className={styles.modalHeader}>
            <h2>Modifier la tâche</h2>
            <button className={styles.modalClose} onClick={() => setEditTask(null)}>×</button>
          </div>
          <div className={styles.modalForm}>
            <div className={styles.field}>
              <label>Titre *</label>
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus />
            </div>
            <div className={styles.field}>
              <label>Priorité</label>
              <select value={editPriority} onChange={e => setEditPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Patient lié</label>
              <select value={editAthleteId} onChange={e => setEditAthleteId(e.target.value)}>
                <option value="">— Aucun —</option>
                {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Échéance</label>
              <input type="datetime-local" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Rappel</label>
              <select value={editReminder} onChange={e => setEditReminder(e.target.value)}>
                <option value="">Aucun rappel</option>
                <option value="0">Au moment de l&apos;échéance</option>
                <option value="5">5 minutes avant</option>
                <option value="15">15 minutes avant</option>
                <option value="30">30 minutes avant</option>
                <option value="60">1 heure avant</option>
                <option value="1440">1 jour avant</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Description</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} placeholder="Notes..." />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setEditTask(null)}>Annuler</button>
              <button className={styles.submitBtn} onClick={saveEdit}>Enregistrer</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* ─────── Constants for wizard ─────── */
const PATHOLOGIES_LIST = [
  "Lombalgie", "Cervicalgie", "Entorse", "Tendinite", "Fracture",
  "Hernie discale", "Sciatique", "Prothèse (genou/hanche)", "Rupture LCA",
  "Capsulite", "Syndrome rotulien", "Pubalgie", "Fasciite plantaire",
  "Scoliose", "Post-opératoire", "Rééducation neurologique", "Périnée",
  "Arthrose", "Fibromyalgie", "Syndrome du canal carpien",
];

const MOTIFS = [
  { value: "douleur", label: "Douleur / blessure" },
  { value: "reeduc", label: "Rééducation" },
  { value: "postop", label: "Post-opératoire" },
  { value: "prevention", label: "Prévention" },
];

const ANTECEDENTS_LIST = [
  "Opération chirurgicale", "Fracture", "Entorse récurrente", "Tendinite chronique",
  "Lombalgie", "Hernie discale", "Problème cardiaque", "Asthme",
  "Diabète", "Trouble hormonal", "Dépression / burn-out",
];

const DATA_TRACKING_OPTIONS = [
  { value: "douleur", label: "Douleur (EVA)" },
  { value: "mobilite", label: "Mobilité articulaire" },
  { value: "force", label: "Force musculaire" },
  { value: "amplitude", label: "Amplitude de mouvement" },
  { value: "sommeil", label: "Sommeil" },
  { value: "poids", label: "Poids" },
  { value: "humeur", label: "Humeur / bien-être" },
];

const CANAUX = [
  { value: "in-app", label: "In-app" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

/* ─────── Add Athlete Modal (3-step wizard) ─────── */
function AddAthleteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Page 1
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [sportAutre, setSportAutre] = useState("");
  const [objectif, setObjectif] = useState("");
  const [motif, setMotif] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [consentement, setConsentement] = useState(false);

  // Page 2
  const [dateNaissance, setDateNaissance] = useState("");
  const [taille, setTaille] = useState("");
  const [poids, setPoids] = useState("");
  const [injuryNote, setInjuryNote] = useState("");
  const [bodyZone, setBodyZone] = useState("");
  const [frequence, setFrequence] = useState("");

  // Page 3
  const [antecedents, setAntecedents] = useState<string[]>([]);
  const [traitements, setTraitements] = useState("");
  const [contreIndications, setContreIndications] = useState("");
  const [dataTracking, setDataTracking] = useState<string[]>([]);
  const [canalCommunication, setCanalCommunication] = useState("");

  const stepTitles = ["Informations", "Profil physique", "Historique & suivi"];

  const toggleArrayItem = (arr: string[], item: string, setter: (v: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  };

  const validateStep = () => {
    setError("");
    if (step === 1) {
      if (!name.trim()) { setError("Le nom est requis"); return false; }
      if (!contactEmail.trim() && !contactPhone.trim()) { setError("Email ou téléphone requis"); return false; }
    }
    return true;
  };

  const nextStep = () => { if (validateStep()) setStep(step + 1); };
  const prevStep = () => { setError(""); setStep(step - 1); };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setError("");

    const finalSport = sport === "__autre__" ? sportAutre : sport;

    try {
      const res = await fetch("/api/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sport: finalSport || null,
          objectif, motif,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          consentement,
          dateNaissance: dateNaissance || null,
          taille: taille || null,
          poids: poids || null,
          injuryNote: injuryNote || null,
          bodyZone: bodyZone || null,
          frequence: frequence || null,
          antecedents, traitements, contreIndications,
          dataTracking, canalCommunication,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else onCreated();
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalWizard} onClick={(e) => e.stopPropagation()}>
        {/* Header + stepper */}
        <div className={styles.modalHeader}>
          <h2>Ajouter un patient</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.stepper}>
          {stepTitles.map((title, i) => (
            <div key={i} className={`${styles.stepItem} ${step === i + 1 ? styles.stepActive : ""} ${step > i + 1 ? styles.stepDone : ""}`}>
              <div className={styles.stepCircle}>{step > i + 1 ? "✓" : i + 1}</div>
              <span className={styles.stepLabel}>{title}</span>
            </div>
          ))}
        </div>

        {/* Page 1 */}
        {step === 1 && (
          <div className={styles.modalForm}>
            <div className={styles.field}>
              <label>Nom / Prénom *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom ou pseudonyme" autoFocus />
            </div>
            <div className={styles.field}>
              <label>Pathologie / motif de consultation</label>
              <select value={sport} onChange={(e) => setSport(e.target.value)}>
                <option value="">— Choisir —</option>
                {PATHOLOGIES_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="__autre__">Autre...</option>
              </select>
              {sport === "__autre__" && (
                <input type="text" value={sportAutre} onChange={(e) => setSportAutre(e.target.value)} placeholder="Précisez la pathologie..." style={{ marginTop: 6 }} />
              )}
            </div>
            <div className={styles.field}>
              <label>Objectif principal</label>
              <input type="text" value={objectif} onChange={(e) => setObjectif(e.target.value)} placeholder="Ex: rééducation post-opératoire, renforcement musculaire..." />
            </div>
            <div className={styles.field}>
              <label>Motif de suivi</label>
              <div className={styles.chipGroup}>
                {MOTIFS.map((m) => (
                  <button key={m.value} type="button" className={`${styles.chip} ${motif === m.value ? styles.chipActive : ""}`} onClick={() => setMotif(motif === m.value ? "" : m.value)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Email</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="patient@email.com" />
              </div>
              <div className={styles.field}>
                <label>Téléphone</label>
                <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="06 12 34 56 78" />
              </div>
            </div>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} />
              <span>Consentement au partage de données recueilli</span>
            </label>
          </div>
        )}

        {/* Page 2 */}
        {step === 2 && (
          <div className={styles.modalForm}>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Date de naissance</label>
                <input type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>Taille (cm)</label>
                <input type="number" value={taille} onChange={(e) => setTaille(e.target.value)} placeholder="175" />
              </div>
              <div className={styles.field}>
                <label>Poids (kg)</label>
                <input type="number" value={poids} onChange={(e) => setPoids(e.target.value)} placeholder="70" />
              </div>
            </div>
            <div className={styles.field}>
              <label>Diagnostic / zone douloureuse</label>
              <input type="text" value={injuryNote} onChange={(e) => setInjuryNote(e.target.value)} placeholder="Ex: tendinite épaule droite, lombalgie chronique..." />
            </div>
            <div className={styles.field}>
              <label>Zone du corps concernée</label>
              <input type="text" value={bodyZone} onChange={(e) => setBodyZone(e.target.value)} placeholder="Ex: épaule, genou, dos, cheville..." />
            </div>
            <div className={styles.field}>
              <label>Disponibilités / fréquence</label>
              <input type="text" value={frequence} onChange={(e) => setFrequence(e.target.value)} placeholder="Ex: 3x / semaine, mardi et jeudi soir..." />
            </div>
          </div>
        )}

        {/* Page 3 */}
        {step === 3 && (
          <div className={styles.modalForm}>
            <div className={styles.field}>
              <label>Antécédents pertinents</label>
              <div className={styles.chipGroup}>
                {ANTECEDENTS_LIST.map((a) => (
                  <button key={a} type="button" className={`${styles.chip} ${antecedents.includes(a) ? styles.chipActive : ""}`} onClick={() => toggleArrayItem(antecedents, a, setAntecedents)}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <label>Traitements en cours</label>
              <textarea value={traitements} onChange={(e) => setTraitements(e.target.value)} placeholder="Médicaments, thérapies..." rows={2} />
            </div>
            <div className={styles.field}>
              <label>Contre-indications</label>
              <textarea value={contreIndications} onChange={(e) => setContreIndications(e.target.value)} placeholder="Mouvements ou activités à éviter..." rows={2} />
            </div>
            <div className={styles.field}>
              <label>Données à suivre</label>
              <div className={styles.toggleGroup}>
                {DATA_TRACKING_OPTIONS.map((d) => (
                  <label key={d.value} className={styles.toggleItem}>
                    <div className={`${styles.toggle} ${dataTracking.includes(d.value) ? styles.toggleOn : ""}`} onClick={() => toggleArrayItem(dataTracking, d.value, setDataTracking)}>
                      <div className={styles.toggleThumb} />
                    </div>
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <label>Canal de communication préféré</label>
              <div className={styles.chipGroup}>
                {CANAUX.map((c) => (
                  <button key={c.value} type="button" className={`${styles.chip} ${canalCommunication === c.value ? styles.chipActive : ""}`} onClick={() => setCanalCommunication(canalCommunication === c.value ? "" : c.value)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error + nav */}
        {error && <p className={styles.formError} style={{ margin: "0 24px" }}>{error}</p>}
        <div className={styles.wizardNav}>
          {step > 1 ? (
            <button type="button" className={styles.cancelBtn} onClick={prevStep}>
              ← Retour
            </button>
          ) : (
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Annuler</button>
          )}
          <div className={styles.stepIndicator}>{step} / 3</div>
          {step < 3 ? (
            <button type="button" className={styles.submitBtn} onClick={nextStep}>
              Suivant →
            </button>
          ) : (
            <button type="button" className={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
              {loading ? "Création..." : "Créer le patient"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────── Note Modal ─────── */
function NoteModal({ athleteId, athleteName, onClose, onSaved }: {
  athleteId: string;
  athleteName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState("");
  const [updateContact, setUpdateContact] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/athletes/${athleteId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, updateContact }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        onSaved();
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Note rapide — {athleteName}</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.field}>
            <label>Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observation, suivi, remarque..." rows={4} required autoFocus />
          </div>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={updateContact} onChange={(e) => setUpdateContact(e.target.checked)} />
            <span>Marquer comme contacté aujourd&apos;hui</span>
          </label>
          {error && <p className={styles.formError}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────── Athlete Detail Panel (Sidebar) ─────── */
const MOTIF_LABELS: Record<string, string> = {
  douleur: "Douleur / blessure",
  reeduc: "Rééducation",
  postop: "Post-opératoire",
  prevention: "Prévention",
};

const CANAL_LABELS: Record<string, string> = {
  "in-app": "In-app",
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
};

function AthletePanel({ athleteId, onClose, onUpdated, formatDate, getInitials }: {
  athleteId: string;
  onClose: () => void;
  onUpdated: () => void;
  formatDate: (d: string | null) => string;
  getInitials: (n: string) => string;
}) {
  const [athlete, setAthlete] = useState<AthleteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"infos" | "notes" | "activity">("infos");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newNote, setNewNote] = useState("");
  const [athleteEvents, setAthleteEvents] = useState<{ id: string; title: string; date: string; type: string; color: string }[]>([]);
  const [athleteTasks, setAthleteTasks] = useState<{ id: string; title: string; column: string; priority: string; dueDate: string | null }[]>([]);
  const [requestingAccess, setRequestingAccess] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState<Set<string>>(new Set());
  const [requestReason, setRequestReason] = useState("");

  const requestAccess = async (dataKey: string) => {
    if (!athlete?._athleteUserId) return;
    setRequestingAccess(dataKey);
    try {
      const res = await fetch("/api/pro/data-access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteUserId: athlete._athleteUserId, dataKey, reason: requestReason || undefined }),
      });
      if (res.ok || res.status === 409) {
        setRequestSent((prev) => new Set(prev).add(dataKey));
      }
    } catch { /* ignore */ }
    setRequestingAccess(null);
    setRequestReason("");
  };

  const fetchAthlete = useCallback(() => {
    setLoading(true);
    fetch(`/api/athletes/${athleteId}`)
      .then((r) => r.json())
      .then((data) => { if (data.id) setAthlete(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [athleteId]);

  useEffect(() => { fetchAthlete(); }, [fetchAthlete]);

  useEffect(() => {
    if (tab === "activity") {
      fetch(`/api/events?athleteId=${athleteId}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setAthleteEvents(d); }).catch(() => {});
      fetch(`/api/kanban?athleteId=${athleteId}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setAthleteTasks(d); }).catch(() => {});
    }
  }, [tab, athleteId]);

  const patchField = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/athletes/${athleteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) { fetchAthlete(); onUpdated(); }
    } catch { /* ignore */ }
    setSaving(false);
    setEditing(null);
  };

  const saveEdit = (field: string) => {
    patchField({ [field]: editValue || null });
  };

  const startEdit = (field: string, current: string | number | null) => {
    setEditing(field);
    setEditValue(current?.toString() || "");
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/athletes/${athleteId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote, updateContact: true }),
      });
      if (res.ok) { setNewNote(""); fetchAthlete(); onUpdated(); }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const age = (dateStr: string | null) => {
    if (!dateStr) return null;
    const birth = new Date(dateStr);
    const now = new Date();
    let a = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) a--;
    return a;
  };

  const EditableRow = ({ label, field, value, placeholder }: { label: string; field: string; value: string | number | null; placeholder?: string }) => (
    <div className={styles.panelRow}>
      <span className={styles.panelLabel}>{label}</span>
      {editing === field ? (
        <div className={styles.editInline}>
          <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(field); if (e.key === "Escape") setEditing(null); }} placeholder={placeholder} />
          <button onClick={() => saveEdit(field)} className={styles.editSave}>✓</button>
          <button onClick={() => setEditing(null)} className={styles.editCancel}>✗</button>
        </div>
      ) : (
        <span className={styles.editableValue} onClick={() => startEdit(field, value)}>
          {value || <em className={styles.emptyValue}>—</em>}
          <svg className={styles.editIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </span>
      )}
    </div>
  );

  return (
    <>
      <div className={styles.panelOverlay} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <button className={styles.panelClose} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <span className={styles.panelTitle}>Dossier patient</span>
          {saving && <span className={styles.panelSaving}>Sauvegarde...</span>}
        </div>

        {loading ? (
          <div className={styles.panelLoading}>Chargement...</div>
        ) : !athlete ? (
          <div className={styles.panelLoading}>Patient introuvable</div>
        ) : (
          <>
            {/* Identity */}
            <div className={styles.panelIdentity}>
              <div className={styles.panelAvatar}>{athlete.avatarUrl ? <img src={athlete.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} /> : getInitials(athlete.name)}</div>
              <div className={styles.panelIdentityInfo}>
                <h3 className={styles.panelName}>{athlete.name}</h3>
                <p className={styles.panelMeta}>
                  {athlete.sport || "—"}
                  {age(athlete.dateNaissance) !== null && ` · ${age(athlete.dateNaissance)} ans`}
                </p>
              </div>
              <span className={`${styles.badge} ${styles[riskLabels[athlete.riskLevel].className]}`}>
                {riskLabels[athlete.riskLevel].label}
              </span>
            </div>

            {/* Privacy restricted banner */}
            {athlete._privacyRedacted && athlete._privacyRedacted.length > 0 && (
              <div className={styles.privacyBanner}>
                <div className={styles.privacyBannerHeader}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  <span>Données restreintes par l&apos;athlète</span>
                </div>
                <div className={styles.privacyList}>
                  {athlete._privacyRedacted.map((key) => (
                    <div key={key} className={styles.privacyItem}>
                      <span className={styles.privacyItemLabel}>{PRIVACY_KEY_LABELS[key] || key}</span>
                      {requestSent.has(key) ? (
                        <span className={styles.privacyRequested}>Demande envoyée</span>
                      ) : (
                        <button
                          className={styles.privacyRequestBtn}
                          onClick={() => requestAccess(key)}
                          disabled={requestingAccess === key}
                        >
                          {requestingAccess === key ? "..." : "Demander"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status buttons */}
            <div className={styles.statusBar}>
              {(["active", "paused", "archived"] as const).map((s) => (
                <button
                  key={s}
                  className={`${styles.statusBtn} ${athlete.status === s ? styles[`statusBtn_${s}`] : ""}`}
                  onClick={() => athlete.status !== s && patchField({ status: s })}
                >
                  {s === "active" && "● "}
                  {s === "paused" && "❚❚ "}
                  {s === "archived" && "▪ "}
                  {statusLabels[s]}
                </button>
              ))}
            </div>

            {/* Risk + Trend quick edit */}
            <div className={styles.quickEdits}>
              <div className={styles.quickEditGroup}>
                <span className={styles.quickEditLabel}>État santé</span>
                <div className={styles.quickEditBtns}>
                  {(["GOOD", "AVERAGE", "CRITICAL"] as const).map((r) => (
                    <button key={r} className={`${styles.qBadge} ${styles[riskLabels[r].className]} ${athlete.riskLevel === r ? styles.qBadgeActive : ""}`} onClick={() => athlete.riskLevel !== r && patchField({ riskLevel: r })}>
                      {riskLabels[r].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.quickEditGroup}>
                <span className={styles.quickEditLabel}>Progression</span>
                <div className={styles.quickEditBtns}>
                  {(["IMPROVING", "STAGNATING", "DECLINING"] as const).map((t) => (
                    <button key={t} className={`${styles.qTrend} ${styles[trendLabels[t].className]} ${athlete.trend === t ? styles.qBadgeActive : ""}`} onClick={() => athlete.trend !== t && patchField({ trend: t })}>
                      {t === "IMPROVING" && "↑"}{t === "STAGNATING" && "→"}{t === "DECLINING" && "↓"} {trendLabels[t].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className={styles.panelTabs}>
              <button className={`${styles.panelTab} ${tab === "infos" ? styles.panelTabActive : ""}`} onClick={() => setTab("infos")}>Infos</button>
              <button className={`${styles.panelTab} ${tab === "notes" ? styles.panelTabActive : ""}`} onClick={() => setTab("notes")}>Notes ({athlete.notes.length})</button>
              <button className={`${styles.panelTab} ${tab === "activity" ? styles.panelTabActive : ""}`} onClick={() => setTab("activity")}>Activité</button>
            </div>

            <div className={styles.panelBody}>
              {tab === "infos" && (
                <>
                  <div className={styles.panelSection}>
                    <h4 className={styles.panelSectionTitle}>Contact</h4>
                    <EditableRow label="Email" field="contactEmail" value={athlete.contactEmail} placeholder="patient@email.com" />
                    <EditableRow label="Téléphone" field="contactPhone" value={athlete.contactPhone} placeholder="06 12 34 56 78" />
                    <div className={styles.panelRow}>
                      <span className={styles.panelLabel}>Canal préféré</span>
                      <div className={styles.miniChips}>
                        {(["in-app", "whatsapp", "email", "sms"] as const).map((c) => (
                          <button key={c} className={`${styles.miniChip} ${athlete.canalCommunication === c ? styles.miniChipActive : ""}`} onClick={() => patchField({ canalCommunication: athlete.canalCommunication === c ? null : c })}>
                            {CANAL_LABELS[c]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.panelRow}>
                      <span className={styles.panelLabel}>Dernier contact</span>
                      <button className={styles.contactTodayBtn} onClick={() => patchField({ lastContactAt: new Date().toISOString() })}>
                        {formatDate(athlete.lastContactAt)} — 📅 Marquer aujourd&apos;hui
                      </button>
                    </div>
                  </div>

                  <div className={styles.panelSection}>
                    <h4 className={styles.panelSectionTitle}>Suivi</h4>
                    <EditableRow label="Objectif" field="objectif" value={athlete.objectif} placeholder="Ex: reprendre après blessure..." />
                    <div className={styles.panelRow}>
                      <span className={styles.panelLabel}>Motif</span>
                      <div className={styles.miniChips}>
                        {(["douleur", "reeduc", "postop", "prevention"] as const).map((m) => (
                          <button key={m} className={`${styles.miniChip} ${athlete.motif === m ? styles.miniChipActive : ""}`} onClick={() => patchField({ motif: athlete.motif === m ? null : m })}>
                            {MOTIF_LABELS[m]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <EditableRow label="Fréquence" field="frequence" value={athlete.frequence} placeholder="Ex: 3x / semaine" />
                  </div>

                  <div className={styles.panelSection}>
                    <h4 className={styles.panelSectionTitle}>Bilan physique</h4>
                    <EditableRow label="Pathologie" field="sport" value={athlete.sport} placeholder="Lombalgie, Entorse..." />
                    <EditableRow label="Taille (cm)" field="taille" value={athlete.taille} placeholder="175" />
                    <EditableRow label="Poids (kg)" field="poids" value={athlete.poids} placeholder="70" />
                    <EditableRow label="Diagnostic" field="injuryNote" value={athlete.injuryNote} placeholder="Tendinite épaule..." />
                    <EditableRow label="Zone" field="bodyZone" value={athlete.bodyZone} placeholder="Épaule, genou..." />
                  </div>

                  <div className={styles.panelSection}>
                    <h4 className={styles.panelSectionTitle}>Historique médical</h4>
                    <EditableRow label="Traitements" field="traitements" value={athlete.traitements} placeholder="Médicaments, thérapies..." />
                    <EditableRow label="Contre-ind." field="contreIndications" value={athlete.contreIndications} placeholder="Activités à éviter..." />
                    {athlete.antecedents.length > 0 && (
                      <div className={styles.panelChips}>
                        {athlete.antecedents.map((a) => <span key={a} className={styles.panelChip}>{a}</span>)}
                      </div>
                    )}
                  </div>

                  {athlete.dataTracking.length > 0 && (
                    <div className={styles.panelSection}>
                      <h4 className={styles.panelSectionTitle}>Données suivies</h4>
                      <div className={styles.panelChips}>
                        {athlete.dataTracking.map((d) => <span key={d} className={styles.panelChipActive}>{d}</span>)}
                      </div>
                    </div>
                  )}

                  <div className={styles.panelSection}>
                    <div className={styles.panelRow}>
                      <span className={styles.panelLabel}>Consentement</span>
                      <label className={styles.miniCheckbox}>
                        <input type="checkbox" checked={athlete.consentement} onChange={(e) => patchField({ consentement: e.target.checked })} />
                        <span>{athlete.consentement ? "Oui" : "Non"}</span>
                      </label>
                    </div>
                    <div className={styles.panelRow}><span className={styles.panelLabel}>Créé le</span><span>{new Date(athlete.createdAt).toLocaleDateString("fr-FR")}</span></div>
                  </div>
                </>
              )}

              {tab === "notes" && (
                <div className={styles.panelNotes}>
                  <div className={styles.addNoteBox}>
                    <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Ajouter une note..." rows={3} />
                    <button className={styles.addNoteBtn} onClick={addNote} disabled={!newNote.trim() || saving}>
                      {saving ? "..." : "Ajouter"}
                    </button>
                  </div>
                  {athlete.notes.length === 0 ? (
                    <p className={styles.panelEmpty}>Aucune note pour le moment.</p>
                  ) : (
                    athlete.notes.map((n) => (
                      <div key={n.id} className={styles.noteCard}>
                        <p className={styles.noteText}>{n.note}</p>
                        <span className={styles.noteDate}>{new Date(n.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === "activity" && (
                <div className={styles.panelNotes}>
                  <div className={styles.panelSection}>
                    <h4 className={styles.panelSectionTitle}>Événements calendrier ({athleteEvents.length})</h4>
                    {athleteEvents.length === 0 ? (
                      <p className={styles.panelEmpty}>Aucun événement lié.</p>
                    ) : (
                      athleteEvents.slice(0, 10).map((ev) => (
                        <div key={ev.id} className={styles.panelRow}>
                          <span className={styles.kanbanPriority} style={{ background: ev.color === "orange" ? "#f97316" : ev.color === "blue" ? "#3b82f6" : ev.color === "green" ? "#22c55e" : "#a855f7" }} />
                          <span style={{ flex: 1, fontSize: 13, color: "#fff" }}>{ev.title}</span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{new Date(ev.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className={styles.panelSection}>
                    <h4 className={styles.panelSectionTitle}>Tâches kanban ({athleteTasks.length})</h4>
                    {athleteTasks.length === 0 ? (
                      <p className={styles.panelEmpty}>Aucune tâche liée.</p>
                    ) : (
                      athleteTasks.map((t) => (
                        <div key={t.id} className={styles.panelRow}>
                          <span className={styles.kanbanPriority} style={{ background: t.priority === "high" ? "#ef4444" : t.priority === "medium" ? "#f97316" : "#94a3b8" }} />
                          <span style={{ flex: 1, fontSize: 13, color: "#fff" }}>{t.title}</span>
                          <span className={styles.panelChipActive} style={{ fontSize: 10, padding: "2px 8px" }}>
                            {KANBAN_COLS.find(c => c.id === t.column)?.label || t.column}
                          </span>
                          {t.dueDate && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>{new Date(t.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
