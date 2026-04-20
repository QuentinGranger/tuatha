"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

/* ═══════════════ TYPES ═══════════════ */
interface Athlete { id: string; name: string; sport: string | null; status: string; objectif: string | null; poids: number | null; taille: number | null; riskLevel: string; dateNaissance?: string }

interface Ordonnance {
  id: string; type: string; status: string; diagnosis: string;
  content: Record<string, any>; episode?: string; signedAt?: string;
  createdAt: string; validUntil?: string; signatureData?: string;
}

interface Prescription {
  id: string; type: string; title: string; content: string[];
  dateStart: string; dateEnd?: string; redFlags: string[];
  visiblePatient: boolean; status: string;
}

interface MedAlert {
  id: string; severity: "info" | "warning" | "critical";
  status: "open" | "treated" | "closed";
  source: "patient" | "capteur" | "auto" | "pro";
  title: string; description: string; context?: string;
  commentMedecin?: string; createdAt: string;
}

interface TimelineEntry {
  id: string; type: "consultation" | "ordonnance" | "prescription" | "exam" | "message" | "alert";
  title: string; author: string; summary: string; date: string;
  refId?: string;
}

interface PlanItem { label: string; status: "done" | "in_progress" | "pending" }

interface VitalTile {
  key: string; label: string; value: string | number; unit: string;
  trend: "up" | "down" | "stable" | null; trendLabel?: string;
  color: string;
}

/* ═══════════════ CONSTANTS ═══════════════ */

const SEVERITY_MAP: Record<string, { label: string; color: string; icon: string }> = {
  critical: { label: "Critique", color: "#ef4444", icon: "⚠️" },
  warning: { label: "À surveiller", color: "#f59e0b", icon: "⚠️" },
  info: { label: "Info", color: "#3b82f6", icon: "ℹ️" },
};

const SOURCE_MAP: Record<string, string> = { patient: "Patient", capteur: "Capteur", auto: "Auto", pro: "Pro" };

const TIMELINE_TYPES: Record<string, { label: string; color: string }> = {
  consultation: { label: "Consultation", color: "#8b5cf6" },
  ordonnance: { label: "Ordonnance", color: "#f97316" },
  prescription: { label: "Prescription", color: "#3b82f6" },
  exam: { label: "Examen", color: "#22c55e" },
  message: { label: "Message", color: "#64748b" },
  alert: { label: "Alerte", color: "#ef4444" },
};

const TIMELINE_FILTERS = [
  { value: "all", label: "Tout" },
  { value: "consultation", label: "Consultations" },
  { value: "ordonnance", label: "Ordonnances" },
  { value: "prescription", label: "Prescriptions" },
  { value: "exam", label: "Examens" },
  { value: "message", label: "Messages" },
];

const STATUS_OPTIONS = [
  { value: "stable", label: "Stable", color: "#22c55e" },
  { value: "surveiller", label: "À surveiller", color: "#f59e0b" },
  { value: "alerte", label: "Alerte", color: "#ef4444" },
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const getAge = (dob?: string | null) => { if (!dob) return null; return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000); };

/* ═══════════════ PAGE ═══════════════ */
export default function SuiviMedicalPage() {
  const router = useRouter();

  /* ── Patient selection ── */
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [showAthleteList, setShowAthleteList] = useState(false);

  /* ── Episode & status ── */
  const [episode, setEpisode] = useState("Suivi général");
  const [editEpisode, setEditEpisode] = useState(false);
  const [patientStatus, setPatientStatus] = useState<"stable" | "surveiller" | "alerte">("stable");

  /* ── Data from API ── */
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [alerts, setAlerts] = useState<MedAlert[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<{ id: string; focus: string; notePro: string; notePatient?: string; createdAt: string }[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [vitals, setVitals] = useState<VitalTile[]>([]);
  const [plan, setPlan] = useState<{ conduite: string[]; restrictions: string[]; nextSteps: PlanItem[] }>({
    conduite: [], restrictions: [], nextSteps: [],
  });

  /* ── UI state ── */
  const [alertFilter, setAlertFilter] = useState<"all" | "open" | "treated" | "closed">("all");
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);
  const [graphSlide, setGraphSlide] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showPlanEdit, setShowPlanEdit] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [vitalInput, setVitalInput] = useState<{ key: string; label: string; unit: string; color: string } | null>(null);

  const selectedAthlete = athletes.find(a => a.id === athleteId);

  /* ── Fetch athletes ── */
  useEffect(() => {
    fetch("/api/athletes?status=active").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAthletes(d); }).catch(() => {});
  }, []);

  /* ── Fetch ordonnances ── */
  const fetchOrdonnances = useCallback(() => {
    if (!athleteId) { setOrdonnances([]); return; }
    fetch(`/api/medecin/ordonnances?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setOrdonnances(d); }).catch(() => setOrdonnances([]));
  }, [athleteId]);

  /* ── Fetch prescriptions ── */
  const fetchPrescriptions = useCallback(() => {
    if (!athleteId) { setPrescriptions([]); return; }
    fetch(`/api/medecin/prescriptions?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPrescriptions(d); }).catch(() => setPrescriptions([]));
  }, [athleteId]);

  /* ── Fetch alerts ── */
  const fetchAlerts = useCallback(() => {
    if (!athleteId) { setAlerts([]); return; }
    fetch(`/api/medecin/alerts?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAlerts(d); }).catch(() => setAlerts([]));
  }, [athleteId]);

  /* ── Fetch clinical notes ── */
  const fetchNotes = useCallback(() => {
    if (!athleteId) { setClinicalNotes([]); return; }
    fetch(`/api/medecin/notes?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setClinicalNotes(d); }).catch(() => setClinicalNotes([]));
  }, [athleteId]);

  /* ── Fetch plan ── */
  const fetchPlan = useCallback(() => {
    if (!athleteId) { setPlan({ conduite: [], restrictions: [], nextSteps: [] }); setEpisode("Suivi général"); setPatientStatus("stable"); return; }
    fetch(`/api/medecin/plans?athleteId=${athleteId}`).then(r => r.json())
      .then(d => {
        if (d && d.id) {
          setPlan({ conduite: d.conduite || [], restrictions: d.restrictions || [], nextSteps: d.nextSteps || [] });
          if (d.episode) setEpisode(d.episode);
          if (d.patientStatus) setPatientStatus(d.patientStatus);
        } else {
          setPlan({ conduite: [], restrictions: [], nextSteps: [] });
        }
      }).catch(() => {});
  }, [athleteId]);

  /* ── Fetch vitals ── */
  const fetchVitals = useCallback(() => {
    if (!athleteId) { setVitals([]); return; }
    fetch(`/api/medecin/vitals?athleteId=${athleteId}&limit=20`).then(r => r.json())
      .then((entries: { vitalKey: string; value: number; unit: string; recordedAt: string }[]) => {
        if (!Array.isArray(entries)) { setVitals([]); return; }
        const VITAL_META: Record<string, { label: string; color: string }> = {
          douleur: { label: "Douleur", color: "#ef4444" },
          fatigue: { label: "Fatigue", color: "#f59e0b" },
          sommeil: { label: "Sommeil", color: "#8b5cf6" },
          poids: { label: "Poids", color: "#3b82f6" },
        };
        const grouped = new Map<string, { vitalKey: string; value: number; unit: string; recordedAt: string }[]>();
        entries.forEach(e => {
          const arr = grouped.get(e.vitalKey) || [];
          arr.push(e);
          grouped.set(e.vitalKey, arr);
        });
        const tiles: VitalTile[] = ["douleur", "fatigue", "sommeil", "poids"].map(key => {
          const meta = VITAL_META[key] || { label: key, color: "#64748b" };
          const vals = grouped.get(key) || [];
          if (vals.length === 0) {
            const fallback = key === "poids" ? (selectedAthlete?.poids ?? "—") : "—";
            const unitMap: Record<string, string> = { douleur: "/10", fatigue: "/10", sommeil: "h", poids: "kg" };
            return { key, label: meta.label, value: fallback, unit: unitMap[key] || "/10", trend: null, color: meta.color };
          }
          const latest = vals[0];
          let trend: VitalTile["trend"] = null;
          if (vals.length >= 2) {
            const diff = latest.value - vals[1].value;
            trend = diff > 0 ? "up" : diff < 0 ? "down" : "stable";
          }
          return { key, label: meta.label, value: latest.value, unit: latest.unit, trend, trendLabel: "7j", color: meta.color };
        });
        setVitals(tiles);
      }).catch(() => {
        setVitals(["douleur", "fatigue", "sommeil", "poids"].map(key => ({
          key, label: key.charAt(0).toUpperCase() + key.slice(1), value: "—",
          unit: key === "poids" ? "kg" : key === "sommeil" ? "h" : "/10",
          trend: null, color: "#64748b",
        })));
      });
  }, [athleteId, selectedAthlete]);

  useEffect(() => { fetchOrdonnances(); fetchPrescriptions(); fetchAlerts(); fetchNotes(); fetchPlan(); fetchVitals(); }, [fetchOrdonnances, fetchPrescriptions, fetchAlerts, fetchNotes, fetchPlan, fetchVitals]);

  /* ── Save episode/status to plan API ── */
  const savePlanMeta = useCallback((ep: string, st: string) => {
    if (!athleteId) return;
    fetch("/api/medecin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId, episode: ep, patientStatus: st, conduite: plan.conduite, restrictions: plan.restrictions, nextSteps: plan.nextSteps }),
    }).catch(() => {});
  }, [athleteId, plan]);

  /* ── Build timeline from real data ── */
  useEffect(() => {
    const entries: TimelineEntry[] = [];
    ordonnances.forEach(o => {
      entries.push({
        id: `ordo-${o.id}`, type: "ordonnance",
        title: `Ordonnance ${o.type}${o.status === "signee" ? " (signée)" : ""}`,
        author: "Médecin", summary: o.diagnosis, date: o.createdAt, refId: o.id,
      });
    });
    prescriptions.forEach(p => {
      entries.push({
        id: `presc-${p.id}`, type: "prescription",
        title: p.title, author: "Médecin",
        summary: p.content.slice(0, 2).join(", "), date: p.dateStart, refId: p.id,
      });
    });
    alerts.forEach(a => {
      entries.push({
        id: `alert-${a.id}`, type: "alert",
        title: a.title, author: SOURCE_MAP[a.source] || a.source,
        summary: a.description, date: a.createdAt,
      });
    });
    clinicalNotes.forEach(n => {
      entries.push({
        id: `note-${n.id}`, type: "consultation",
        title: `Note clinique — ${n.focus}`, author: "Médecin",
        summary: n.notePro.slice(0, 120), date: n.createdAt,
      });
    });
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTimeline(entries);
  }, [ordonnances, prescriptions, alerts, clinicalNotes]);

  /* ── Critical alert banner ── */
  const criticalAlerts = alerts.filter(a => a.severity === "critical" && a.status === "open");
  const lastOrdonnance = ordonnances[0];
  const lastEvent = ordonnances.length > 0
    ? `Ordonnance ${ordonnances[0].type} — ${fmtDateTime(ordonnances[0].createdAt)}`
    : prescriptions.length > 0 ? `${prescriptions[0].title} — ${fmtDateTime(prescriptions[0].dateStart)}` : null;

  const filteredAlerts = alerts.filter(a => alertFilter === "all" || a.status === alertFilter);
  const filteredTimeline = timeline.filter(e => timelineFilter === "all" || e.type === timelineFilter);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className={styles.page}>

      {/* ── A) CRITICAL ALERT BANNER ── */}
      {criticalAlerts.length > 0 && (
        <div className={styles.criticalBanner}>
          <span className={styles.criticalIcon}>⚠️</span>
          <span className={styles.criticalText}>{criticalAlerts.length} alerte{criticalAlerts.length > 1 ? "s" : ""} critique{criticalAlerts.length > 1 ? "s" : ""} — {criticalAlerts[0].title}</span>
          <button className={styles.criticalBtn} onClick={() => { setAlertFilter("all"); document.getElementById("alerts-section")?.scrollIntoView({ behavior: "smooth" }); }}>Voir l&apos;alerte</button>
        </div>
      )}

      {/* ── 1) HEADER ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Suivi médical</h1>
          <div className={styles.athletePicker}>
            <input className={styles.athleteSearch} placeholder="Rechercher un patient..." value={athleteSearch}
              onChange={e => { setAthleteSearch(e.target.value); setShowAthleteList(true); }}
              onFocus={() => setShowAthleteList(true)} />
            {showAthleteList && (
              <div className={styles.athleteDropdown}>
                {athletes.filter(a => a.name.toLowerCase().includes(athleteSearch.toLowerCase())).length === 0
                  ? <div className={styles.athleteEmpty}>Aucun patient trouvé</div>
                  : athletes.filter(a => a.name.toLowerCase().includes(athleteSearch.toLowerCase())).map(a => (
                    <div key={a.id} className={`${styles.athleteCard} ${athleteId === a.id ? styles.athleteCardActive : ""}`}
                      onClick={() => { setAthleteId(a.id); setAthleteSearch(a.name); setShowAthleteList(false); }}>
                      <div className={styles.athleteAvatar}>{a.name.charAt(0).toUpperCase()}</div>
                      <div className={styles.athleteInfo}>
                        <div className={styles.athleteName}>{a.name}</div>
                        <div className={styles.athleteMeta}>
                          {a.sport && <span>{a.sport}</span>}
                          {a.dateNaissance && <span>{getAge(a.dateNaissance)} ans</span>}
                          {a.poids && <span>{a.poids} kg</span>}
                        </div>
                      </div>
                      <span className={styles.athleteRisk} style={{ background: a.riskLevel === "GOOD" ? "#22c55e" : a.riskLevel === "MODERATE" ? "#f59e0b" : "#ef4444" }} />
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {athleteId && (
          <div className={styles.headerRight}>
            <div className={styles.headerChips}>
              {/* Episode chip */}
              {editEpisode ? (
                <input className={styles.episodeInput} autoFocus value={episode}
                  onChange={e => setEpisode(e.target.value)}
                  onBlur={() => { setEditEpisode(false); savePlanMeta(episode, patientStatus); }}
                  onKeyDown={e => { if (e.key === "Enter") { setEditEpisode(false); savePlanMeta(episode, patientStatus); } }} />
              ) : (
                <button className={styles.chipEpisode} onClick={() => setEditEpisode(true)}>{episode}</button>
              )}
              {/* Status chip */}
              <select className={styles.chipStatus} value={patientStatus}
                style={{ color: STATUS_OPTIONS.find(s => s.value === patientStatus)?.color, borderColor: STATUS_OPTIONS.find(s => s.value === patientStatus)?.color }}
                onChange={e => { const v = e.target.value as "stable" | "surveiller" | "alerte"; setPatientStatus(v); savePlanMeta(episode, v); }}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className={styles.quickIcons}>
              <button className={styles.iconBtn} title="Nouvelle note" onClick={() => setShowNoteModal(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button className={styles.iconBtn} title="Nouvelle ordonnance" onClick={() => router.push("/dashboard/medecin/programmes")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </button>
              <button className={styles.iconBtn} title="Planifier RDV">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </button>
              <button className={styles.iconBtn} title="Partager" onClick={() => router.push("/dashboard/medecin/messagerie")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </button>
              <div style={{ position: "relative" }}>
                <button className={styles.iconBtn} title="Plus" onClick={() => setShowMoreMenu(!showMoreMenu)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
                {showMoreMenu && (
                  <div className={styles.moreMenu}>
                    <button onClick={() => { window.print(); setShowMoreMenu(false); }}>Exporter PDF</button>
                    <button onClick={() => setShowMoreMenu(false)}>Archiver épisode</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── B) NO PATIENT SELECTED ── */}
      {!athleteId && (
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <h2>Sélectionnez un patient pour voir son suivi</h2>
          <p>Utilisez la barre de recherche ci-dessus pour trouver un patient</p>
        </div>
      )}

      {athleteId && selectedAthlete && (
        <>
          {/* ── 2) RÉSUMÉ CLINIQUE ── */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryLeft}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Diagnostic / suspicion</span>
                <span className={styles.summaryValue}>{lastOrdonnance?.diagnosis || "Aucun diagnostic récent"}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Objectif</span>
                <span className={styles.summaryValue}>{selectedAthlete.objectif || "Non défini"}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Dernier événement</span>
                <span className={styles.summaryValue}>{lastEvent || "Aucun événement"}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Prochain RDV</span>
                <span className={styles.summaryValueMuted}>Non planifié</span>
              </div>
            </div>
            <div className={styles.summaryRight}>
              <div className={styles.summaryBadge} style={{ borderColor: STATUS_OPTIONS.find(s => s.value === patientStatus)?.color }}>
                <span style={{ color: STATUS_OPTIONS.find(s => s.value === patientStatus)?.color }}>{STATUS_OPTIONS.find(s => s.value === patientStatus)?.label}</span>
              </div>
              <button className={styles.btnOutlineSm} onClick={() => router.push("/dashboard/medecin/programmes")}>
                Voir l&apos;épisode →
              </button>
            </div>
          </div>

          {/* ── 3) SIGNAUX VITAUX & SYMPTÔMES ── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Signaux vitaux & symptômes</h2>
            {vitals.length === 0 ? (
              <div className={styles.emptyMini}>Certaines données nécessitent l&apos;activation du suivi (symptômes / capteurs / journal).</div>
            ) : (
              <div className={styles.vitalsGrid}>
                {vitals.map(v => (
                  <div key={v.key} className={styles.vitalTile} onClick={() => setVitalInput({ key: v.key, label: v.label, unit: v.unit, color: v.color })}>
                    <div className={styles.vitalHeader}>
                      <span className={styles.vitalLabel}>{v.label}</span>
                      {v.trend && (
                        <span className={`${styles.vitalTrend} ${v.trend === "down" ? styles.trendDown : v.trend === "up" ? styles.trendUp : ""}`}>
                          {v.trend === "up" ? "↗" : v.trend === "down" ? "↘" : "→"} {v.trendLabel}
                        </span>
                      )}
                    </div>
                    <div className={styles.vitalValue} style={{ color: v.value === "—" ? "rgba(255,255,255,0.2)" : v.color }}>
                      {v.value}<span className={styles.vitalUnit}>{v.unit}</span>
                    </div>
                    <span className={styles.vitalAction}>Cliquer pour saisir</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 4) ALERTES MÉDICALES ── */}
          <div className={styles.section} id="alerts-section">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Alertes médicales <span className={styles.alertCount}>{alerts.filter(a => a.status === "open").length}</span></h2>
            </div>
            <div className={styles.filterChips}>
              {(["all", "open", "treated", "closed"] as const).map(f => (
                <button key={f} className={`${styles.filterChip} ${alertFilter === f ? styles.filterChipActive : ""}`}
                  onClick={() => setAlertFilter(f)}>
                  {f === "all" ? "Toutes" : f === "open" ? "À traiter" : f === "treated" ? "Traitées" : "Clôturées"}
                </button>
              ))}
            </div>
            {filteredAlerts.length === 0 ? (
              <div className={styles.emptyMini}>Aucune alerte{alertFilter !== "all" ? ` (${alertFilter})` : ""}</div>
            ) : (
              <div className={styles.alertList}>
                {filteredAlerts.map(a => {
                  const sev = SEVERITY_MAP[a.severity] || SEVERITY_MAP.info;
                  const isOpen = openAlertId === a.id;
                  return (
                    <div key={a.id} className={`${styles.alertItem} ${isOpen ? styles.alertItemOpen : ""}`}>
                      <div className={styles.alertRow} onClick={() => setOpenAlertId(isOpen ? null : a.id)}>
                        <span className={styles.alertIcon} style={{ color: sev.color }}>{sev.icon}</span>
                        <div className={styles.alertInfo}>
                          <span className={styles.alertTitle}>{a.title}</span>
                          <span className={styles.alertMeta}>{fmtDateTime(a.createdAt)} · <span className={styles.alertSource}>{SOURCE_MAP[a.source]}</span></span>
                        </div>
                        <span className={styles.alertChevron}>{isOpen ? "▾" : "›"}</span>
                      </div>
                      {isOpen && (
                        <div className={styles.alertDetail}>
                          <p className={styles.alertDesc}>{a.description}</p>
                          {a.context && <p className={styles.alertContext}>Contexte : {a.context}</p>}
                          {a.commentMedecin && <p className={styles.alertComment}>Commentaire : {a.commentMedecin}</p>}
                          <div className={styles.alertActions}>
                            <button className={styles.btnSm} onClick={() => {
                              fetch(`/api/medecin/alerts/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "closed" }) })
                                .then(() => fetchAlerts()).catch(() => {});
                            }}>Clôturer</button>
                            <button className={styles.btnSm} onClick={() => router.push("/dashboard/medecin/programmes")}>Adapter protocole</button>
                            <button className={styles.btnSm} onClick={() => router.push("/dashboard/medecin/programmes")}>Prescrire examen</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 5) TENDANCES / GRAPHS ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Tendances</h2>
              <div className={styles.graphNav}>
                {["Douleur (7j)", "Adhérence", "Poids / IMC"].map((g, i) => (
                  <button key={i} className={`${styles.graphNavBtn} ${graphSlide === i ? styles.graphNavActive : ""}`} onClick={() => setGraphSlide(i)}>{g}</button>
                ))}
              </div>
            </div>
            <div className={styles.graphCard}>
              <div className={styles.graphEmpty}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <span>Données insuffisantes pour afficher les tendances</span>
                <span className={styles.graphHint}>Les graphiques s&apos;afficheront quand le patient remplira son journal de suivi</span>
              </div>
            </div>
          </div>

          {/* ── 6) TIMELINE MÉDICALE ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Timeline médicale</h2>
            </div>
            <div className={styles.filterChips}>
              {TIMELINE_FILTERS.map(f => (
                <button key={f.value} className={`${styles.filterChip} ${timelineFilter === f.value ? styles.filterChipActive : ""}`}
                  onClick={() => setTimelineFilter(f.value)}>{f.label}</button>
              ))}
            </div>
            {filteredTimeline.length === 0 ? (
              <div className={styles.emptyMini}>Aucun événement dans la timeline</div>
            ) : (
              <div className={styles.timeline}>
                {filteredTimeline.map((e, i) => {
                  const tt = TIMELINE_TYPES[e.type] || TIMELINE_TYPES.consultation;
                  return (
                    <div key={e.id} className={styles.tlEntry} onClick={() => {
                      if (e.type === "ordonnance" || e.type === "prescription") router.push("/dashboard/medecin/programmes");
                    }}>
                      <div className={styles.tlDot} style={{ background: tt.color }} />
                      {i < filteredTimeline.length - 1 && <div className={styles.tlLine} />}
                      <div className={styles.tlContent}>
                        <div className={styles.tlHeader}>
                          <span className={styles.tlBadge} style={{ color: tt.color, borderColor: tt.color }}>{tt.label}</span>
                          <span className={styles.tlDate}>{fmtDateTime(e.date)}</span>
                        </div>
                        <div className={styles.tlTitle}>{e.title}</div>
                        <div className={styles.tlSummary}>{e.summary}</div>
                        <div className={styles.tlAuthor}>{e.author}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 7) PLAN & DÉCISIONS ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Plan & décisions</h2>
              <button className={styles.btnOutlineSm} onClick={() => setShowPlanEdit(true)}>Modifier le plan</button>
            </div>
            <div className={styles.planCard}>
              <div className={styles.planBlock}>
                <h3 className={styles.planBlockTitle}>Conduite à tenir</h3>
                {plan.conduite.length === 0
                  ? <p className={styles.planEmpty}>Aucune consigne définie</p>
                  : <ul className={styles.planList}>{plan.conduite.map((c, i) => <li key={i}>{c}</li>)}</ul>}
              </div>
              <div className={styles.planBlock}>
                <h3 className={styles.planBlockTitle}>Restrictions</h3>
                {plan.restrictions.length === 0
                  ? <p className={styles.planEmpty}>Aucune restriction</p>
                  : <div className={styles.planChips}>{plan.restrictions.map((r, i) => <span key={i} className={styles.planChip}>{r}</span>)}</div>}
              </div>
              <div className={styles.planBlock}>
                <h3 className={styles.planBlockTitle}>Prochaines étapes</h3>
                {plan.nextSteps.length === 0
                  ? <p className={styles.planEmpty}>Aucune étape planifiée</p>
                  : <div className={styles.planSteps}>
                    {plan.nextSteps.map((s, i) => (
                      <div key={i} className={styles.planStep}>
                        <span className={`${styles.planStepDot} ${styles[`planStep_${s.status}`]}`} />
                        <span className={styles.planStepLabel}>{s.label}</span>
                        <span className={styles.planStepStatus}>
                          {s.status === "done" ? "Fait" : s.status === "in_progress" ? "En cours" : "À planifier"}
                        </span>
                      </div>
                    ))}
                  </div>}
              </div>
            </div>
          </div>

          {/* ── 8) FIXED ACTION BAR ── */}
          <div className={styles.actionBar}>
            <button className={styles.btnPrimary} onClick={() => router.push("/dashboard/medecin/programmes")}>
              + Nouvelle ordonnance
            </button>
            <button className={styles.btnOutline} onClick={() => setShowNoteModal(true)}>+ Note clinique</button>
            <button className={styles.btnOutline}>Planifier RDV</button>
            <div style={{ flex: 1 }} />
            <button className={styles.btnGhost} onClick={() => window.print()}>Exporter PDF</button>
          </div>
        </>
      )}

      {/* ── MODALS ── */}
      {showNoteModal && <NoteModal onClose={() => setShowNoteModal(false)} onSave={(note) => {
        fetch("/api/medecin/notes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ athleteId, focus: note.focus, notePro: note.notePro, notePatient: note.notePatient }),
        }).then(() => fetchNotes()).catch(() => {});
        setShowNoteModal(false);
      }} />}

      {vitalInput && <VitalInputModal
        vitalKey={vitalInput.key} label={vitalInput.label} unit={vitalInput.unit} color={vitalInput.color}
        onClose={() => setVitalInput(null)}
        onSave={(value: number, note: string) => {
          fetch("/api/medecin/vitals", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ athleteId, vitalKey: vitalInput.key, value, unit: vitalInput.unit, note: note || null }),
          }).then(() => fetchVitals()).catch(() => {});
          setVitalInput(null);
        }}
      />}

      {showPlanEdit && <PlanEditModal plan={plan} onClose={() => setShowPlanEdit(false)} onSave={(p) => {
        setPlan(p);
        fetch("/api/medecin/plans", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ athleteId, episode, patientStatus, conduite: p.conduite, restrictions: p.restrictions, nextSteps: p.nextSteps }),
        }).catch(() => {});
        setShowPlanEdit(false);
      }} />}
    </div>
  );
}

/* ═══════════════ NOTE MODAL ═══════════════ */

function NoteModal({ onClose, onSave }: { onClose: () => void; onSave: (n: { notePro: string; notePatient: string; focus: string }) => void }) {
  const [focus, setFocus] = useState("Consultation");
  const [notePro, setNotePro] = useState("");
  const [notePatient, setNotePatient] = useState("");
  const FOCUS_OPTIONS = ["Consultation", "Sommeil", "Douleurs", "Récupération", "Traitement", "Activité physique", "Examens complémentaires"];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h2>Nouvelle note clinique</h2><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label>Focus</label>
            <div className={styles.focusChips}>
              {FOCUS_OPTIONS.map(f => (
                <button key={f} type="button" className={`${styles.focusChip} ${focus === f ? styles.focusChipActive : ""}`} onClick={() => setFocus(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div className={styles.field}><label>Note professionnelle</label><textarea value={notePro} onChange={e => setNotePro(e.target.value)} rows={4} placeholder="Observations, examen clinique, décisions..." /></div>
          <div className={styles.field}><label>Note patient (visible)</label><textarea value={notePatient} onChange={e => setNotePatient(e.target.value)} rows={2} placeholder="Message pour le patient (optionnel)" /></div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} disabled={!notePro.trim()} onClick={() => onSave({ notePro, notePatient, focus })}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ PLAN EDIT MODAL ═══════════════ */

function PlanEditModal({ plan, onClose, onSave }: { plan: { conduite: string[]; restrictions: string[]; nextSteps: PlanItem[] }; onClose: () => void; onSave: (p: { conduite: string[]; restrictions: string[]; nextSteps: PlanItem[] }) => void }) {
  const [conduite, setConduite] = useState(plan.conduite.length ? plan.conduite : [""]);
  const [restrictions, setRestrictions] = useState(plan.restrictions.length ? plan.restrictions : [""]);
  const [steps, setSteps] = useState<PlanItem[]>(plan.nextSteps.length ? plan.nextSteps : [{ label: "", status: "pending" }]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className={styles.modalHeader}><h2>Modifier le plan</h2><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label>Conduite à tenir</label>
            {conduite.map((c, i) => (
              <div key={i} className={styles.fieldRow}>
                <input value={c} onChange={e => { const n = [...conduite]; n[i] = e.target.value; setConduite(n); }} placeholder={`Consigne ${i + 1}`} />
                {conduite.length > 1 && <button type="button" className={styles.fieldRemove} onClick={() => setConduite(conduite.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            <button type="button" className={styles.btnGhostSm} onClick={() => setConduite([...conduite, ""])}>+ Ajouter</button>
          </div>
          <div className={styles.field}>
            <label>Restrictions</label>
            {restrictions.map((r, i) => (
              <div key={i} className={styles.fieldRow}>
                <input value={r} onChange={e => { const n = [...restrictions]; n[i] = e.target.value; setRestrictions(n); }} placeholder={`Restriction ${i + 1}`} />
                {restrictions.length > 1 && <button type="button" className={styles.fieldRemove} onClick={() => setRestrictions(restrictions.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            <button type="button" className={styles.btnGhostSm} onClick={() => setRestrictions([...restrictions, ""])}>+ Ajouter</button>
          </div>
          <div className={styles.field}>
            <label>Prochaines étapes</label>
            {steps.map((s, i) => (
              <div key={i} className={styles.fieldRow}>
                <input value={s.label} onChange={e => { const n = [...steps]; n[i] = { ...n[i], label: e.target.value }; setSteps(n); }} placeholder={`Étape ${i + 1}`} />
                <select value={s.status} onChange={e => { const n = [...steps]; n[i] = { ...n[i], status: e.target.value as PlanItem["status"] }; setSteps(n); }}>
                  <option value="pending">À planifier</option>
                  <option value="in_progress">En cours</option>
                  <option value="done">Fait</option>
                </select>
                {steps.length > 1 && <button type="button" className={styles.fieldRemove} onClick={() => setSteps(steps.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            <button type="button" className={styles.btnGhostSm} onClick={() => setSteps([...steps, { label: "", status: "pending" }])}>+ Ajouter</button>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={() => onSave({
            conduite: conduite.filter(c => c.trim()),
            restrictions: restrictions.filter(r => r.trim()),
            nextSteps: steps.filter(s => s.label.trim()),
          })}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ VITAL INPUT MODAL ═══════════════ */

const VITAL_RANGES: Record<string, { min: number; max: number; step: number; defaultVal: number }> = {
  douleur: { min: 0, max: 10, step: 1, defaultVal: 5 },
  fatigue: { min: 0, max: 10, step: 1, defaultVal: 5 },
  sommeil: { min: 0, max: 14, step: 0.5, defaultVal: 7 },
  poids: { min: 30, max: 200, step: 0.1, defaultVal: 70 },
};

function VitalInputModal({ vitalKey, label, unit, color, onClose, onSave }: {
  vitalKey: string; label: string; unit: string; color: string;
  onClose: () => void; onSave: (value: number, note: string) => void;
}) {
  const range = VITAL_RANGES[vitalKey] || { min: 0, max: 100, step: 1, defaultVal: 50 };
  const [value, setValue] = useState(range.defaultVal);
  const [note, setNote] = useState("");

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className={styles.modalHeader}>
          <h2>Saisir — {label}</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.vitalInputDisplay} style={{ color }}>
            <span className={styles.vitalInputValue}>{value}</span>
            <span className={styles.vitalInputUnit}>{unit}</span>
          </div>
          <div className={styles.field}>
            <input
              type="range"
              min={range.min} max={range.max} step={range.step}
              value={value}
              onChange={e => setValue(parseFloat(e.target.value))}
              className={styles.vitalSlider}
              style={{ accentColor: color }}
            />
            <div className={styles.vitalRangeLabels}>
              <span>{range.min}{unit}</span>
              <span>{range.max}{unit}</span>
            </div>
          </div>
          <div className={styles.field}>
            <label>Valeur exacte</label>
            <input
              type="number"
              min={range.min} max={range.max} step={range.step}
              value={value}
              onChange={e => setValue(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className={styles.field}>
            <label>Note (optionnel)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Contexte, circonstances..." />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={() => onSave(value, note)}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}