"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

/* ═══════════════ TYPES ═══════════════ */
interface AthleteOption { id: string; name: string; sport: string | null; status: string; objectif: string | null; poids: number | null; taille: number | null; riskLevel: string }

interface NutriDay {
  id: string; date: string; kcal: number; protein: number; carbs: number; fat: number;
  water: number; completed: boolean;
}

interface BodyMeasure {
  id: string; date: string; weight: number | null; bmi: number | null;
  bodyFat: number | null; waist: number | null; hydration: number | null;
  source: string;
}

interface NutriObjectives {
  id?: string; goal: string; kcal: number; protein: number; carbs: number; fat: number;
  water: number; weeklyRate: number;
}

interface NutriAlertT {
  id: string; type: string; severity: string; status: string; origin: string;
  title: string; description: string | null; action: string | null; closedNote: string | null;
  createdAt: string;
}

interface NutriRuleT {
  id: string; label: string; condition: string; active: boolean;
}

interface ConsultNote {
  id: string; date: string; notePro: string; notePatient: string; focus: string;
}

/* ═══════════════ CONSTANTS ═══════════════ */
const GOAL_OPTIONS = [
  { value: "seche", label: "Sèche" },
  { value: "prise_masse", label: "Prise de masse" },
  { value: "recomposition", label: "Recomposition" },
  { value: "sante", label: "Santé / équilibre" },
];

const PERIODS = [
  { value: "7", label: "7j" },
  { value: "30", label: "30j" },
  { value: "90", label: "90j" },
];

const SEVERITY_MAP: Record<string, { label: string; color: string }> = {
  leger: { label: "Léger", color: "#f59e0b" },
  modere: { label: "Modéré", color: "#f97316" },
  critique: { label: "Critique", color: "#ef4444" },
};

const ALERT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  alert: { label: "Alerte", color: "#ef4444" },
  info: { label: "Info", color: "#3b82f6" },
  success: { label: "Succès", color: "#22c55e" },
};

const FOCUS_OPTIONS = ["Sommeil", "Fibres", "Timing repas", "Hydratation", "Protéines", "Collations", "Compléments"];

const defaultObjectives: NutriObjectives = {
  goal: "sante", kcal: 2000, protein: 120, carbs: 250, fat: 65, water: 2.0, weeklyRate: 0,
};

const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
const pct = (val: number, target: number) => target > 0 ? Math.round((val / target) * 100) : 0;

/* ═══════════════ PAGE ═══════════════ */
export default function BilanNutritionnelPage() {
  const router = useRouter();

  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [period, setPeriod] = useState("7");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [showAthleteList, setShowAthleteList] = useState(false);

  const [objectives, setObjectives] = useState<NutriObjectives>({ ...defaultObjectives });
  const [days, setDays] = useState<NutriDay[]>([]);
  const [measures, setMeasures] = useState<BodyMeasure[]>([]);
  const [alerts, setAlerts] = useState<NutriAlertT[]>([]);
  const [rules, setRules] = useState<NutriRuleT[]>([]);
  const [notes, setNotes] = useState<ConsultNote[]>([]);
  const [activePlan, setActivePlan] = useState<{ id: string; name: string; status: string; version: number } | null>(null);

  const [macroUnit, setMacroUnit] = useState<"g" | "%">("g");
  const [evoSlide, setEvoSlide] = useState(0);
  const [editObjectives, setEditObjectives] = useState(false);
  const [showAddMeasure, setShowAddMeasure] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<"all" | "alert" | "info" | "success">("all");
  const [alertStatusFilter, setAlertStatusFilter] = useState<"all" | "unread" | "to_treat" | "closed">("all");

  /* ──── Fetch athletes ──── */
  useEffect(() => {
    fetch("/api/athletes?status=active").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAthletes(d); }).catch(() => {});
  }, []);

  /* ──── Fetch active plan info + sync objectives from plan ──── */
  const fetchActivePlan = useCallback(() => {
    if (!athleteId) { setActivePlan(null); return; }
    fetch(`/api/nutri/plans?athleteId=${athleteId}`).then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          const plan = d.find((p: any) => p.status === "publie" || p.status === "en_cours") || d[0];
          setActivePlan({ id: plan.id, name: plan.name, status: plan.status, version: plan.version });
          // Always use plan targets as source of truth for objectives
          setObjectives(prev => ({
            ...prev,
            kcal: plan.kcalTarget,
            protein: plan.proteinTarget,
            carbs: plan.carbsTarget,
            fat: plan.fatTarget,
            water: plan.waterTarget ?? prev.water,
          }));
        } else { setActivePlan(null); }
      }).catch(() => setActivePlan(null));
  }, [athleteId]);

  /* ──── Fetch objectives (NutriObjective = manual overrides when no plan) ──── */
  const fetchObjectives = useCallback(() => {
    if (!athleteId) { setObjectives({ ...defaultObjectives }); return; }
    fetch(`/api/nutri/objectives?athleteId=${athleteId}`).then(r => r.json())
      .then(d => {
        if (d && d.id) setObjectives(d);
        else setObjectives({ ...defaultObjectives });
      })
      .catch(() => setObjectives({ ...defaultObjectives }));
  }, [athleteId]);

  /* ──── Fetch journal ──── */
  const fetchJournal = useCallback(() => {
    if (!athleteId) { setDays([]); return; }
    fetch(`/api/nutri/journal?athleteId=${athleteId}&days=${period}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDays(d); else setDays([]); })
      .catch(() => setDays([]));
  }, [athleteId, period]);

  /* ──── Fetch measures ──── */
  const fetchMeasures = useCallback(() => {
    if (!athleteId) { setMeasures([]); return; }
    fetch(`/api/nutri/measures?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMeasures(d); else setMeasures([]); })
      .catch(() => setMeasures([]));
  }, [athleteId]);

  /* ──── Fetch alerts ──── */
  const fetchAlerts = useCallback(() => {
    if (!athleteId) { setAlerts([]); return; }
    fetch(`/api/nutri/alerts?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAlerts(d); else setAlerts([]); })
      .catch(() => setAlerts([]));
  }, [athleteId]);

  /* ──── Fetch rules ──── */
  const fetchRules = useCallback(() => {
    fetch("/api/nutri/rules").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRules(d); else setRules([]); })
      .catch(() => setRules([]));
  }, []);

  /* ──── Fetch notes ──── */
  const fetchNotes = useCallback(() => {
    if (!athleteId) { setNotes([]); return; }
    fetch(`/api/nutri/notes?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNotes(d); else setNotes([]); })
      .catch(() => setNotes([]));
  }, [athleteId]);

  useEffect(() => { fetchObjectives(); fetchMeasures(); fetchAlerts(); fetchNotes(); fetchActivePlan(); }, [fetchObjectives, fetchMeasures, fetchAlerts, fetchNotes, fetchActivePlan]);
  useEffect(() => { fetchJournal(); }, [fetchJournal]);
  useEffect(() => { fetchRules(); }, [fetchRules]);

  const selectedAthlete = athletes.find(a => a.id === athleteId);

  /* ──── Computed KPIs ──── */
  const completedDays = days.filter(d => d.completed);
  const totalDays = parseInt(period);
  const adherencePct = totalDays > 0 ? Math.round((completedDays.length / totalDays) * 100) : 0;

  const avgKcal = avg(completedDays.map(d => d.kcal));
  const kcalDiff = avgKcal - objectives.kcal;

  const avgProt = avg(completedDays.map(d => d.protein));
  const avgCarbs = avg(completedDays.map(d => d.carbs));
  const avgFat = avg(completedDays.map(d => d.fat));
  const protPct = pct(avgProt, objectives.protein);
  const carbsPct = pct(avgCarbs, objectives.carbs);
  const fatPct = pct(avgFat, objectives.fat);

  const lowProtDays = completedDays.filter(d => d.protein < objectives.protein * 0.8).length;

  const latestMeasure = measures.length > 0 ? measures[measures.length - 1] : null;
  const prevMeasure = measures.length > 1 ? measures[0] : null;
  const weightDiff = latestMeasure && prevMeasure && latestMeasure.weight && prevMeasure.weight
    ? +(latestMeasure.weight - prevMeasure.weight).toFixed(1) : null;
  const bfDiff = latestMeasure && prevMeasure && latestMeasure.bodyFat && prevMeasure.bodyFat
    ? +(latestMeasure.bodyFat - prevMeasure.bodyFat).toFixed(1) : null;
  const waistDiff = latestMeasure && prevMeasure && latestMeasure.waist && prevMeasure.waist
    ? +(latestMeasure.waist - prevMeasure.waist).toFixed(1) : null;

  const maxKcal = Math.max(...completedDays.map(d => d.kcal), objectives.kcal * 1.2, 1);

  const evoGraphs = [
    { title: "Poids (kg)", key: "weight" as const, unit: "kg" },
    { title: "Masse grasse (%)", key: "bodyFat" as const, unit: "%" },
    { title: "Tour de taille (cm)", key: "waist" as const, unit: "cm" },
  ];

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const fmtDateShort = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  /* ──── Handlers ──── */
  const handleSaveObjectives = async (newObj: NutriObjectives) => {
    try {
      const res = await fetch("/api/nutri/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...newObj }),
      });
      const data = await res.json();
      if (data && data.id) setObjectives(data);

      // Also sync to the active plan if one exists
      if (activePlan) {
        await fetch(`/api/nutri/plans/${activePlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kcalTarget: newObj.kcal,
            proteinTarget: newObj.protein,
            carbsTarget: newObj.carbs,
            fatTarget: newObj.fat,
            waterTarget: newObj.water,
          }),
        });
      }
    } catch { /* ignore */ }
    setEditObjectives(false);
  };

  const handleAddMeasure = async (m: { date: string; weight: number | null; bmi: number | null; bodyFat: number | null; waist: number | null; hydration: number | null; source: string }) => {
    try {
      await fetch("/api/nutri/measures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...m }),
      });
      fetchMeasures();
    } catch { /* ignore */ }
    setShowAddMeasure(false);
  };

  const handleCreateAlert = async (a: { type: string; severity: string; title: string; description: string | null }) => {
    try {
      await fetch("/api/nutri/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...a }),
      });
      fetchAlerts();
    } catch { /* ignore */ }
    setShowCreateAlert(false);
  };

  const handleUpdateAlert = async (id: string, data: Record<string, unknown>) => {
    try {
      await fetch(`/api/nutri/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      fetchAlerts();
    } catch { /* ignore */ }
  };

  const handleAddRule = async (rule: { label: string; condition: string }) => {
    try {
      await fetch("/api/nutri/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      fetchRules();
    } catch { /* ignore */ }
    setShowAddRule(false);
  };

  const handleToggleRule = async (rule: NutriRuleT) => {
    try {
      await fetch("/api/nutri/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, active: !rule.active }),
      });
      fetchRules();
    } catch { /* ignore */ }
  };

  const handleAddNote = async (note: { date: string; notePro: string; notePatient: string; focus: string }) => {
    try {
      await fetch("/api/nutri/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...note }),
      });
      fetchNotes();
    } catch { /* ignore */ }
    setShowAddNote(false);
  };

  const filteredAlerts = alerts
    .filter(a => alertFilter === "all" || a.type === alertFilter)
    .filter(a => alertStatusFilter === "all" || a.status === alertStatusFilter);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className={styles.page}>
      {/* ──── 1) HEADER ──── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Bilans Nutritionnels</h1>
          <div className={styles.athletePicker}>
            <input
              className={styles.athleteSearch}
              placeholder="Rechercher un patient..."
              value={athleteSearch}
              onChange={e => { setAthleteSearch(e.target.value); setShowAthleteList(true); }}
              onFocus={() => setShowAthleteList(true)}
            />
            {showAthleteList && (
              <div className={styles.athleteDropdown}>
                {athletes.filter(a => a.name.toLowerCase().includes(athleteSearch.toLowerCase())).length === 0 ? (
                  <div className={styles.athleteEmpty}>Aucun patient trouvé</div>
                ) : (
                  athletes.filter(a => a.name.toLowerCase().includes(athleteSearch.toLowerCase())).map(a => (
                    <div key={a.id} className={`${styles.athleteCard} ${athleteId === a.id ? styles.athleteCardActive : ""}`}
                      onClick={() => { setAthleteId(a.id); setAthleteSearch(a.name); setShowAthleteList(false); }}>
                      <div className={styles.athleteAvatar}>{a.name.charAt(0).toUpperCase()}</div>
                      <div className={styles.athleteInfo}>
                        <div className={styles.athleteName}>{a.name}</div>
                        <div className={styles.athleteMeta}>
                          {a.sport && <span>{a.sport}</span>}
                          {a.poids && <span>{a.poids} kg</span>}
                          {a.objectif && <span>{a.objectif}</span>}
                        </div>
                      </div>
                      <span className={styles.athleteRisk} style={{ background: a.riskLevel === "GOOD" ? "#22c55e" : a.riskLevel === "MODERATE" ? "#f59e0b" : "#ef4444" }} />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        {athleteId && (
          <div className={styles.headerRight}>
            <div className={styles.headerMeta}>
              <span className={styles.goalBadge}>{GOAL_OPTIONS.find(g => g.value === objectives.goal)?.label || objectives.goal}</span>
              <div className={styles.periodTabs}>
                {PERIODS.map(p => (
                  <button key={p.value} className={`${styles.periodTab} ${period === p.value ? styles.periodTabActive : ""}`} onClick={() => setPeriod(p.value)}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className={styles.quickActions}>
              <button className={styles.qBtn} onClick={() => setEditObjectives(true)}>Ajuster objectifs</button>
              <button className={styles.qBtn} onClick={() => setShowCreateAlert(true)}>Créer alerte</button>
              <button className={styles.qBtn} onClick={() => router.push("/dashboard/nutri/messagerie")}>Message</button>
              <button className={styles.qBtn} onClick={() => window.print()}>PDF</button>
            </div>
          </div>
        )}
      </div>

      {selectedAthlete && (
        <div className={styles.patientBanner}>
          <div className={styles.patientBannerLeft}>
            <div className={styles.patientName}>{selectedAthlete.name}</div>
            <div className={styles.patientMeta}>{selectedAthlete.sport || "Nutrition"} · Suivi actif · Objectif : {GOAL_OPTIONS.find(g => g.value === objectives.goal)?.label || objectives.goal}</div>
          </div>
          {activePlan ? (
            <div className={styles.planLink} onClick={() => router.push("/dashboard/nutri/programmes")}>
              <div className={styles.planLinkName}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{marginRight: 4, verticalAlign: 'middle'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>{activePlan.name} <span className={styles.planLinkVersion}>v{activePlan.version}</span></div>
              <div className={styles.planLinkStatus}>
                <span className={styles.planDot} style={{ background: activePlan.status === "publie" ? "#22c55e" : activePlan.status === "en_cours" ? "#3b82f6" : "#94a3b8" }} />
                {activePlan.status === "publie" ? "Publié" : activePlan.status === "en_cours" ? "En cours" : activePlan.status === "brouillon" ? "Brouillon" : "Archivé"}
                <span className={styles.planLinkArrow}>→ Voir le plan</span>
              </div>
            </div>
          ) : (
            <button className={styles.btnOutline} onClick={() => router.push("/dashboard/nutri/programmes")}>+ Créer un plan</button>
          )}
        </div>
      )}

      {!athleteId && (
        <div className={styles.patientGrid}>
          {athletes.length === 0 ? (
            <div className={styles.emptyState}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <p>Aucun patient pour le moment</p>
            </div>
          ) : (
            athletes.map(a => (
              <div key={a.id} className={styles.patientCardGrid} onClick={() => { setAthleteId(a.id); setAthleteSearch(a.name); }}>
                <div className={styles.patientCardAvatar}>{a.name.charAt(0).toUpperCase()}</div>
                <div className={styles.patientCardBody}>
                  <div className={styles.patientCardName}>{a.name}</div>
                  <div className={styles.patientCardDetails}>
                    {a.sport && <span>{a.sport}</span>}
                    {a.poids && <span>{a.poids} kg</span>}
                    {a.taille && <span>{a.taille} cm</span>}
                  </div>
                  {a.objectif && <div className={styles.patientCardObj}>{a.objectif}</div>}
                </div>
                <span className={styles.patientCardRisk} style={{ background: a.riskLevel === "GOOD" ? "#22c55e" : a.riskLevel === "MODERATE" ? "#f59e0b" : "#ef4444" }} />
              </div>
            ))
          )}
        </div>
      )}

      {athleteId && (
        <>
          {/* ──── 2) KPI CARDS ──── */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon} style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div className={styles.kpiContent}>
                <div className={styles.kpiLabel}>Adhérence</div>
                <div className={styles.kpiValue}>{adherencePct}%</div>
                <div className={styles.kpiSub}>{completedDays.length}/{totalDays} jours remplis</div>
              </div>
              <div className={styles.kpiBar}><div className={styles.kpiFill} style={{ width: `${adherencePct}%`, background: adherencePct >= 80 ? "#22c55e" : adherencePct >= 50 ? "#f59e0b" : "#ef4444" }} /></div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon} style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
              </div>
              <div className={styles.kpiContent}>
                <div className={styles.kpiLabel}>Apports moyens</div>
                <div className={styles.kpiValue}>{avgKcal} <span className={styles.kpiUnit}>kcal/j</span></div>
                <div className={`${styles.kpiSub} ${completedDays.length === 0 ? "" : kcalDiff > 0 ? styles.kpiWarn : styles.kpiOk}`}>
                  {completedDays.length === 0 ? "Aucune donnée" : `${kcalDiff > 0 ? "+" : ""}${kcalDiff} kcal vs objectif`}
                </div>
              </div>
              <div className={styles.kpiBar}><div className={styles.kpiFill} style={{ width: `${Math.min(pct(avgKcal, objectives.kcal), 100)}%`, background: "#f97316" }} /></div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon} style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2a7 7 0 0 1 0 14" /></svg>
              </div>
              <div className={styles.kpiContent}>
                <div className={styles.kpiLabel}>Macros</div>
                {completedDays.length === 0 ? (
                  <div className={styles.kpiSub}>Aucune donnée</div>
                ) : (
                  <>
                    <div className={styles.kpiMacros}>
                      <span><b>P</b> {avgProt}g ({protPct}%)</span>
                      <span><b>G</b> {avgCarbs}g ({carbsPct}%)</span>
                      <span><b>L</b> {avgFat}g ({fatPct}%)</span>
                    </div>
                    {lowProtDays > 0 && <div className={`${styles.kpiSub} ${styles.kpiWarn}`}>Prot. insuffisantes {lowProtDays}/{completedDays.length}j</div>}
                  </>
                )}
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon} style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div className={styles.kpiContent}>
                <div className={styles.kpiLabel}>Tendance</div>
                {measures.length < 2 ? (
                  <div className={styles.kpiSub}>Pas assez de mesures</div>
                ) : (
                  <div className={styles.kpiTrends}>
                    {weightDiff !== null && <span>Poids : {weightDiff > 0 ? "+" : ""}{weightDiff} kg</span>}
                    {bfDiff !== null && <span>MG : {bfDiff > 0 ? "+" : ""}{bfDiff} pts</span>}
                    {waistDiff !== null && <span>Taille : {waistDiff > 0 ? "+" : ""}{waistDiff} cm</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ──── 3) APPORTS ──── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Apports</h2>
              <div className={styles.sectionControls}>
                <div className={styles.macroToggle}>
                  <button className={`${styles.toggleBtn} ${macroUnit === "g" ? styles.toggleActive : ""}`} onClick={() => setMacroUnit("g")}>g</button>
                  <button className={`${styles.toggleBtn} ${macroUnit === "%" ? styles.toggleActive : ""}`} onClick={() => setMacroUnit("%")}>%</button>
                </div>
              </div>
            </div>

            {completedDays.length === 0 ? (
              <div className={styles.emptyMini}>Aucune entrée dans le journal alimentaire sur cette période</div>
            ) : (
              <>
                <div className={styles.card}>
                  <h3 className={styles.cardLabel}>Calories / jour</h3>
                  <div className={styles.kcalChart}>
                    <div className={styles.kcalTarget} style={{ bottom: `${(objectives.kcal / maxKcal) * 100}%` }}>
                      <span className={styles.kcalTargetLabel}>{objectives.kcal} kcal</span>
                    </div>
                    <div className={styles.kcalBars}>
                      {days.map((d, i) => {
                        const h = d.completed ? (d.kcal / maxKcal) * 100 : 0;
                        const isLow = d.completed && d.kcal < objectives.kcal * 0.7;
                        const isHigh = d.completed && d.kcal > objectives.kcal * 1.2;
                        return (
                          <div key={i} className={styles.kcalBarWrap} title={`${fmtDate(d.date)}: ${d.kcal} kcal`}>
                            <div className={`${styles.kcalBar} ${isLow ? styles.kcalBarLow : isHigh ? styles.kcalBarHigh : ""}`} style={{ height: `${h}%` }} />
                            <span className={styles.kcalBarLabel}>{fmtDateShort(d.date).slice(0, 5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={styles.macrosGrid}>
                  {[
                    { label: "Protéines", avg: avgProt, target: objectives.protein, color: "#ef4444", pctVal: protPct },
                    { label: "Glucides", avg: avgCarbs, target: objectives.carbs, color: "#3b82f6", pctVal: carbsPct },
                    { label: "Lipides", avg: avgFat, target: objectives.fat, color: "#f59e0b", pctVal: fatPct },
                  ].map(m => (
                    <div key={m.label} className={styles.macroCard}>
                      <div className={styles.macroHeader}>
                        <span className={styles.macroName}>{m.label}</span>
                        <span className={styles.macroPct} style={{ color: m.pctVal >= 80 && m.pctVal <= 120 ? "#22c55e" : m.color }}>{m.pctVal}%</span>
                      </div>
                      <div className={styles.macroBarOuter}>
                        <div className={styles.macroBarInner} style={{ width: `${Math.min(m.pctVal, 100)}%`, background: m.color }} />
                      </div>
                      <div className={styles.macroValues}>
                        <span>{macroUnit === "g" ? `${m.avg}g` : `${m.pctVal}%`} moy.</span>
                        <span className={styles.macroTarget}>obj. {macroUnit === "g" ? `${m.target}g` : "100%"}</span>
                      </div>
                      {m.label === "Protéines" && lowProtDays > 0 && (
                        <div className={styles.macroInsight}>⚠ &lt; 80% de l&apos;obj. sur {Math.round(lowProtDays / completedDays.length * 100)}% des jours</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ──── 4) COMPOSITION CORPORELLE ──── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Composition corporelle</h2>
              <button className={styles.btnPrimary} onClick={() => setShowAddMeasure(true)}>+ Ajouter mesure</button>
            </div>
            {latestMeasure ? (
              <div className={styles.bodyCompGrid}>
                {[
                  { label: "Poids", value: latestMeasure.weight, unit: "kg", diff: weightDiff, tag: weightDiff !== null ? (Math.abs(weightDiff) < 0.5 ? "stable" : weightDiff < 0 && objectives.goal === "seche" ? "tendance favorable" : "signal à surveiller") : null },
                  { label: "IMC", value: latestMeasure.bmi, unit: "", diff: null, tag: latestMeasure.bmi ? (latestMeasure.bmi < 25 ? "normal" : "surpoids") : null },
                  { label: "Tour de taille", value: latestMeasure.waist, unit: "cm", diff: waistDiff, tag: waistDiff !== null ? (waistDiff <= 0 ? "tendance favorable" : "signal à surveiller") : null },
                  { label: "Hydratation", value: latestMeasure.hydration, unit: "%", diff: null, tag: latestMeasure.hydration ? (latestMeasure.hydration >= 55 ? "correct" : "insuffisant") : null },
                  { label: "Masse grasse", value: latestMeasure.bodyFat, unit: "%", diff: bfDiff, tag: bfDiff !== null ? (bfDiff <= 0 ? "tendance favorable" : "signal à surveiller") : null },
                ].map(item => (
                  <div key={item.label} className={styles.bodyCard}>
                    <div className={styles.bodyLabel}>{item.label}</div>
                    <div className={styles.bodyValue}>{item.value ?? "—"}<span className={styles.bodyUnit}>{item.unit}</span></div>
                    {item.diff !== null && <div className={`${styles.bodyDiff} ${item.diff <= 0 ? styles.bodyDiffGood : styles.bodyDiffWarn}`}>{item.diff > 0 ? "+" : ""}{item.diff}{item.unit}</div>}
                    {item.tag && <span className={`${styles.bodyTag} ${item.tag === "tendance favorable" || item.tag === "normal" || item.tag === "correct" || item.tag === "stable" ? styles.bodyTagGood : styles.bodyTagWarn}`}>{item.tag}</span>}
                  </div>
                ))}
                <div className={styles.bodyMeta}>
                  Dernière mise à jour : {fmtDate(latestMeasure.date)} · Source : {latestMeasure.source}
                </div>
              </div>
            ) : (
              <div className={styles.emptyMini}>Aucune mesure enregistrée — cliquez &quot;+ Ajouter mesure&quot;</div>
            )}
          </div>

          {/* ──── 5) ÉVOLUTIONS ──── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Évolutions</h2>
              <div className={styles.evoNav}>
                {evoGraphs.map((g, i) => (
                  <button key={i} className={`${styles.evoNavBtn} ${evoSlide === i ? styles.evoNavActive : ""}`} onClick={() => setEvoSlide(i)}>{g.title}</button>
                ))}
              </div>
            </div>
            <div className={styles.evoCard}>
              {(() => {
                const g = evoGraphs[evoSlide];
                const vals = measures.map(m => ({ date: m.date, val: m[g.key] as number | null })).filter(v => v.val !== null);
                if (vals.length < 2) return <div className={styles.emptyMini}>Pas assez de mesures pour afficher le graphique</div>;
                const minV = Math.min(...vals.map(v => v.val!)) * 0.98;
                const maxV = Math.max(...vals.map(v => v.val!)) * 1.02;
                const range = maxV - minV || 1;
                const points = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - ((v.val! - minV) / range) * 80}`).join(" ");
                const first = vals[0].val!;
                const last = vals[vals.length - 1].val!;
                const diff = +(last - first).toFixed(1);
                return (
                  <>
                    <div className={styles.evoMeta}>
                      <span className={styles.evoLast}>{last} {g.unit}</span>
                      <span className={`${styles.evoDiff} ${diff <= 0 ? styles.evoDiffGood : styles.evoDiffWarn}`}>{diff > 0 ? "+" : ""}{diff} {g.unit}</span>
                      <span className={styles.evoPeriod}>sur {vals.length} mesures</span>
                    </div>
                    <svg className={styles.evoSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline points={points} fill="none" stroke="#f97316" strokeWidth="1.5" />
                      {vals.map((v, i) => (
                        <circle key={i} cx={(i / (vals.length - 1)) * 100} cy={100 - ((v.val! - minV) / range) * 80} r="1.5" fill="#f97316" />
                      ))}
                    </svg>
                    <div className={styles.evoLabels}>
                      <span>{fmtDate(vals[0].date)}</span>
                      <span>{fmtDate(vals[vals.length - 1].date)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* ──── 6) ALERTES NUTRITION ──── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Alertes nutrition</h2>
              <button className={styles.btnPrimary} onClick={() => setShowCreateAlert(true)}>+ Nouvelle alerte</button>
            </div>
            <div className={styles.alertFilters}>
              <div className={styles.filterGroup}>
                {(["all", "alert", "info", "success"] as const).map(f => (
                  <button key={f} className={`${styles.filterBtn} ${alertFilter === f ? styles.filterActive : ""}`} onClick={() => setAlertFilter(f)}>
                    {f === "all" ? "Toutes" : ALERT_TYPE_MAP[f]?.label}
                  </button>
                ))}
              </div>
              <div className={styles.filterGroup}>
                {(["all", "unread", "to_treat", "closed"] as const).map(f => (
                  <button key={f} className={`${styles.filterBtn} ${alertStatusFilter === f ? styles.filterActive : ""}`} onClick={() => setAlertStatusFilter(f)}>
                    {f === "all" ? "Tous" : f === "unread" ? "Non lues" : f === "to_treat" ? "À traiter" : "Clôturées"}
                  </button>
                ))}
              </div>
            </div>
            {filteredAlerts.length === 0 ? (
              <div className={styles.emptyMini}>Aucune alerte</div>
            ) : (
              <div className={styles.alertList}>
                {filteredAlerts.map(alert => (
                  <div key={alert.id} className={`${styles.alertItem} ${openAlertId === alert.id ? styles.alertItemOpen : ""}`} onClick={() => setOpenAlertId(openAlertId === alert.id ? null : alert.id)}>
                    <div className={styles.alertHead}>
                      <span className={styles.alertDot} style={{ background: ALERT_TYPE_MAP[alert.type]?.color || "#94a3b8" }} />
                      <div className={styles.alertInfo}>
                        <div className={styles.alertTitle}>{alert.title}</div>
                        <div className={styles.alertMeta}>
                          {alert.status === "unread" ? "Non lue" : alert.status === "to_treat" ? "À traiter" : "Clôturée"} · {alert.origin === "auto" ? "Auto" : "Manuel"} · {fmtDate(alert.createdAt)}
                        </div>
                      </div>
                      <span className={styles.severityBadge} style={{ color: SEVERITY_MAP[alert.severity]?.color || "#94a3b8", borderColor: SEVERITY_MAP[alert.severity]?.color || "#94a3b8" }}>{SEVERITY_MAP[alert.severity]?.label || alert.severity}</span>
                    </div>
                    {openAlertId === alert.id && (
                      <div className={styles.alertDetail} onClick={e => e.stopPropagation()}>
                        {alert.description && <p className={styles.alertDesc}>{alert.description}</p>}
                        {alert.action && <div className={styles.alertAction}>Action : {alert.action}</div>}
                        {alert.closedNote && <div className={styles.alertClosed}>Clôturé : {alert.closedNote}</div>}
                        {alert.status !== "closed" && (
                          <div className={styles.alertActions}>
                            <div className={styles.alertQualify}>
                              <span>Qualifier :</span>
                              {(["leger", "modere", "critique"] as const).map(s => (
                                <button key={s} className={`${styles.qualifyBtn} ${alert.severity === s ? styles.qualifyActive : ""}`} style={alert.severity === s ? { background: SEVERITY_MAP[s].color, color: "#fff" } : {}} onClick={() => handleUpdateAlert(alert.id, { severity: s })}>{SEVERITY_MAP[s].label}</button>
                              ))}
                            </div>
                            <div className={styles.alertActionBtns}>
                              <button className={styles.actionBtn} onClick={() => handleUpdateAlert(alert.id, { action: "Augmenter prot +20g/j" })}>+20g prot</button>
                              <button className={styles.actionBtn} onClick={() => handleUpdateAlert(alert.id, { action: "Ajouter collation" })}>+ Collation</button>
                              <button className={styles.actionBtn} onClick={() => router.push("/dashboard/nutri/messagerie")}>Relancer patient</button>
                              <button className={styles.actionBtnClose} onClick={() => {
                                const note = prompt("Note de clôture :");
                                if (note !== null) handleUpdateAlert(alert.id, { status: "closed", closedNote: note });
                              }}>Clôturer</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ──── 7) PRESCRIPTION / OBJECTIFS ──── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Prescription &amp; Objectifs</h2>
              <button className={styles.btnPrimary} onClick={() => setEditObjectives(true)}>Ajuster objectifs</button>
            </div>

            {/* Plan actif lié */}
            {activePlan ? (
              <div className={styles.planBanner} onClick={() => router.push("/dashboard/nutri/programmes")}>
                <div className={styles.planBannerIcon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
                <div className={styles.planBannerInfo}>
                  <div className={styles.planBannerName}>{activePlan.name} <span className={styles.planBannerVersion}>v{activePlan.version}</span></div>
                  <div className={styles.planBannerMeta}>
                    <span className={styles.planDot} style={{ background: activePlan.status === "publie" ? "#22c55e" : activePlan.status === "en_cours" ? "#3b82f6" : "#94a3b8" }} />
                    {activePlan.status === "publie" ? "Publié" : activePlan.status === "en_cours" ? "En cours" : "Brouillon"} · Les objectifs ci-dessous sont issus de ce plan
                  </div>
                </div>
                <span className={styles.planBannerArrow}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></span>
              </div>
            ) : (
              <div className={styles.planBannerEmpty}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>Aucun plan alimentaire — les objectifs sont manuels</span>
                <button className={styles.btnOutline} onClick={() => router.push("/dashboard/nutri/programmes")}>Créer un plan</button>
              </div>
            )}

            <div className={styles.objGrid}>
              {[
                { label: "Kcal cible", value: `${objectives.kcal} kcal/j`, iconSvg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 12c-2-2.67-4-4-4-6a4 4 0 0 1 8 0c0 2-2 3.33-4 6z"/><path d="M12 21a8 8 0 0 0 4-14.93"/><path d="M12 21a8 8 0 0 1-4-14.93"/></svg>, color: "#f97316" },
                { label: "Protéines", value: `${objectives.protein}g/j`, iconSvg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 0 1 0 14"/></svg>, color: "#ef4444" },
                { label: "Glucides", value: `${objectives.carbs}g/j`, iconSvg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20"/><path d="M12 2v20"/><rect x="6" y="6" width="12" height="12" rx="2"/></svg>, color: "#3b82f6" },
                { label: "Lipides", value: `${objectives.fat}g/j`, iconSvg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>, color: "#f59e0b" },
                { label: "Hydratation", value: `${objectives.water}L/j`, iconSvg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>, color: "#06b6d4" },
                { label: "Rythme", value: `${objectives.weeklyRate > 0 ? "+" : ""}${objectives.weeklyRate} kg/sem`, iconSvg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, color: "#8b5cf6" },
              ].map(o => (
                <div key={o.label} className={styles.objCard}>
                  <span className={styles.objIconSvg} style={{ background: `${o.color}15`, color: o.color }}>{o.iconSvg}</span>
                  <div>
                    <div className={styles.objLabel}>{o.label}</div>
                    <div className={styles.objValue}>{o.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.card} style={{ marginTop: 16 }}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardLabel}>Règles d&apos;alertes</h3>
                <button className={styles.btnOutline} onClick={() => setShowAddRule(true)}>+ Ajouter une règle</button>
              </div>
              {rules.length === 0 ? (
                <div className={styles.emptyMini}>Aucune règle configurée — ajoutez-en pour automatiser les alertes</div>
              ) : (
                <div className={styles.rulesList}>
                  {rules.map(rule => (
                    <div key={rule.id} className={styles.ruleItem}>
                      <div>
                        <div className={styles.ruleName}>{rule.label}</div>
                        <div className={styles.ruleCondition}>{rule.condition}</div>
                      </div>
                      <button className={`${styles.ruleToggle} ${rule.active ? styles.ruleOn : ""}`} onClick={() => handleToggleRule(rule)}>
                        {rule.active ? "Activé" : "Désactivé"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.quickBar}>
              <button className={styles.btnOutline} onClick={() => setEditObjectives(true)}>Ajuster objectifs</button>
              <button className={styles.btnOutline} onClick={() => router.push("/dashboard/nutri/programmes")}>
                {activePlan ? "Modifier le plan" : "Créer un plan"}
              </button>
              <button className={styles.btnOutline} onClick={() => router.push("/dashboard/nutri/messagerie")}>Envoyer consignes</button>
            </div>
          </div>

          {/* ──── 8) NOTES DE CONSULTATION ──── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Notes de consultation</h2>
              <button className={styles.btnPrimary} onClick={() => setShowAddNote(true)}>+ Nouvelle note</button>
            </div>
            {notes.length === 0 ? (
              <div className={styles.emptyMini}>Aucune note de consultation</div>
            ) : (
              <div className={styles.notesList}>
                {notes.map(n => (
                  <div key={n.id} className={styles.noteCard}>
                    <div className={styles.noteDate}>{fmtDate(n.date)}</div>
                    <div className={styles.noteBody}>
                      <div className={styles.noteSection}>
                        <span className={styles.noteSectionLabel}>Note pro (privée)</span>
                        <p>{n.notePro}</p>
                      </div>
                      {n.notePatient && (
                        <div className={styles.noteSection}>
                          <span className={styles.noteSectionLabel}>Visible patient</span>
                          <p>{n.notePatient}</p>
                        </div>
                      )}
                      {n.focus && (
                        <div className={styles.noteFocus}>
                          <span className={styles.noteFocusLabel}>Prochain focus : </span>{n.focus}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════ MODALS ═══════ */}

      {editObjectives && (
        <ObjectivesModal
          initial={objectives}
          onClose={() => setEditObjectives(false)}
          onSave={handleSaveObjectives}
        />
      )}

      {showAddMeasure && (
        <AddMeasureModal
          onClose={() => setShowAddMeasure(false)}
          onSave={handleAddMeasure}
        />
      )}

      {showCreateAlert && (
        <CreateAlertModal
          onClose={() => setShowCreateAlert(false)}
          onCreate={handleCreateAlert}
        />
      )}

      {showAddNote && (
        <AddNoteModal
          onClose={() => setShowAddNote(false)}
          onSave={handleAddNote}
        />
      )}

      {showAddRule && (
        <AddRuleModal
          onClose={() => setShowAddRule(false)}
          onSave={handleAddRule}
        />
      )}
    </div>
  );
}

/* ═══════════════ MODALS ═══════════════ */

function ObjectivesModal({ initial, onClose, onSave }: { initial: NutriObjectives; onClose: () => void; onSave: (o: NutriObjectives) => void }) {
  const [obj, setObj] = useState({ ...initial });
  const set = (k: keyof NutriObjectives, v: string | number) => setObj(prev => ({ ...prev, [k]: v }));
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Objectifs nutritionnels</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label>Objectif</label>
            <select value={obj.goal} onChange={e => set("goal", e.target.value)}>
              {GOAL_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Kcal / jour</label><input type="number" value={obj.kcal} onChange={e => set("kcal", +e.target.value)} /></div>
            <div className={styles.field}><label>Rythme (kg/sem)</label><input type="number" step="0.1" value={obj.weeklyRate} onChange={e => set("weeklyRate", +e.target.value)} /></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Protéines (g/j)</label><input type="number" value={obj.protein} onChange={e => set("protein", +e.target.value)} /></div>
            <div className={styles.field}><label>Glucides (g/j)</label><input type="number" value={obj.carbs} onChange={e => set("carbs", +e.target.value)} /></div>
            <div className={styles.field}><label>Lipides (g/j)</label><input type="number" value={obj.fat} onChange={e => set("fat", +e.target.value)} /></div>
          </div>
          <div className={styles.field}><label>Hydratation (L/j)</label><input type="number" step="0.1" value={obj.water} onChange={e => set("water", +e.target.value)} /></div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={() => onSave(obj)}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function AddMeasureModal({ onClose, onSave }: { onClose: () => void; onSave: (m: { date: string; weight: number | null; bmi: number | null; bodyFat: number | null; waist: number | null; hydration: number | null; source: string }) => void }) {
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [waist, setWaist] = useState("");
  const [hydration, setHydration] = useState("");
  const [source, setSource] = useState("manual");
  const bmi = weight ? +((+weight) / (1.75 * 1.75)).toFixed(1) : null;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Nouvelle mesure</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Poids (kg)</label><input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} /></div>
            <div className={styles.field}><label>Masse grasse (%)</label><input type="number" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value)} /></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Tour de taille (cm)</label><input type="number" step="0.1" value={waist} onChange={e => setWaist(e.target.value)} /></div>
            <div className={styles.field}><label>Hydratation (%)</label><input type="number" step="0.1" value={hydration} onChange={e => setHydration(e.target.value)} /></div>
          </div>
          <div className={styles.field}><label>Source</label>
            <select value={source} onChange={e => setSource(e.target.value)}>
              <option value="manual">Manuelle</option><option value="balance">Balance connectée</option><option value="import">Import</option>
            </select>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={() => onSave({
            date: new Date().toISOString().slice(0, 10),
            weight: weight ? +weight : null, bmi,
            bodyFat: bodyFat ? +bodyFat : null,
            waist: waist ? +waist : null,
            hydration: hydration ? +hydration : null, source,
          })}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function CreateAlertModal({ onClose, onCreate }: { onClose: () => void; onCreate: (a: { type: string; severity: string; title: string; description: string | null }) => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("alert");
  const [severity, setSeverity] = useState("modere");
  const [description, setDescription] = useState("");
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Nouvelle alerte</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Titre *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Baisse du taux de protéines" /></div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="alert">Alerte</option><option value="info">Info</option><option value="success">Succès</option>
              </select>
            </div>
            <div className={styles.field}><label>Sévérité</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)}>
                <option value="leger">Léger</option><option value="modere">Modéré</option><option value="critique">Critique</option>
              </select>
            </div>
          </div>
          <div className={styles.field}><label>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} /></div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} disabled={!title.trim()} onClick={() => onCreate({
            type, severity, title, description: description || null,
          })}>Créer</button>
        </div>
      </div>
    </div>
  );
}

function AddNoteModal({ onClose, onSave }: { onClose: () => void; onSave: (n: { date: string; notePro: string; notePatient: string; focus: string }) => void }) {
  const [notePro, setNotePro] = useState("");
  const [notePatient, setNotePatient] = useState("");
  const [focus, setFocus] = useState("");
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Note de consultation</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Note pro (privée)</label><textarea value={notePro} onChange={e => setNotePro(e.target.value)} rows={3} placeholder="Observations cliniques..." /></div>
          <div className={styles.field}><label>Note visible patient</label><textarea value={notePatient} onChange={e => setNotePatient(e.target.value)} rows={2} placeholder="1-2 phrases pour le patient..." /></div>
          <div className={styles.field}><label>Prochain focus</label>
            <select value={focus} onChange={e => setFocus(e.target.value)}>
              <option value="">— Choisir —</option>
              {FOCUS_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} disabled={!notePro.trim()} onClick={() => onSave({
            date: new Date().toISOString().slice(0, 10),
            notePro, notePatient, focus,
          })}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

const RULE_PRESETS = [
  { label: "Protéines < objectif", condition: "protein < objectif 3 jours consécutifs" },
  { label: "Kcal très bas", condition: "kcal < 70% objectif" },
  { label: "Lipides trop hauts", condition: "fat > 120% objectif" },
  { label: "Petit déjeuner non consommé", condition: "petit déjeuner manqué 3x/semaine" },
  { label: "Hydratation insuffisante", condition: "eau < 1.5L/j pendant 3 jours" },
  { label: "Pas de saisie journal", condition: "aucune saisie depuis 2 jours" },
];

function AddRuleModal({ onClose, onSave }: { onClose: () => void; onSave: (r: { label: string; condition: string }) => void }) {
  const [label, setLabel] = useState("");
  const [condition, setCondition] = useState("");
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Ajouter une règle d&apos;alerte</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label>Règles prédéfinies</label>
            <div className={styles.presetGrid}>
              {RULE_PRESETS.map(p => (
                <button key={p.label} className={`${styles.presetBtn} ${label === p.label ? styles.presetActive : ""}`}
                  onClick={() => { setLabel(p.label); setCondition(p.condition); }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}><label>Nom de la règle</label><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Protéines < objectif" /></div>
          <div className={styles.field}><label>Condition</label><input value={condition} onChange={e => setCondition(e.target.value)} placeholder="Ex: protein < objectif 3 jours consécutifs" /></div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} disabled={!label.trim() || !condition.trim()} onClick={() => onSave({ label, condition })}>Créer la règle</button>
        </div>
      </div>
    </div>
  );
}
