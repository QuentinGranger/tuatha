"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

/* ═══════════════ TYPES ═══════════════ */
interface Athlete { id: string; name: string; sport: string | null; objectif: string | null; poids: number | null; taille: number | null; riskLevel: string }

interface Alternative {
  id: string; name: string; quantity: number; unit: string;
  kcal: number; protein: number; carbs: number; fat: number; constraint: string | null;
}

interface FoodItem {
  id: string; name: string; quantity: number; unit: string;
  kcal: number; protein: number; carbs: number; fat: number;
  category: string; mandatory: boolean; position: number;
  alternatives: Alternative[];
}

interface Meal {
  id: string; name: string; time: string | null; position: number;
  rule: string | null; items: FoodItem[];
}

interface PlanVersion { id: string; version: number; publishedAt: string }

interface Plan {
  id: string; name: string; status: string;
  kcalTarget: number; proteinTarget: number; carbsTarget: number; fatTarget: number;
  fiberTarget: number | null; saltTarget: number | null; waterTarget: number | null;
  proteinPct: number; carbsPct: number; fatPct: number;
  notePatient: string; notePro: string; startDate: string | null;
  version: number; meals: Meal[]; versions?: PlanVersion[];
  athleteId: string; createdAt: string; updatedAt: string;
}

interface MealTemplate { id: string; name: string; items: string }
interface DayTemplate { id: string; name: string; meals: string }

interface JournalDay {
  id: string; date: string; kcal: number; protein: number; carbs: number; fat: number;
  water: number; completed: boolean;
}

/* ═══════════════ CONSTANTS ═══════════════ */
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "#94a3b8" },
  publie: { label: "Publié", color: "#22c55e" },
  en_cours: { label: "En cours", color: "#3b82f6" },
  archive: { label: "Archivé", color: "#a855f7" },
};

const CATEGORIES = ["protéine", "féculent", "légume", "fruit", "lipides", "laitage", "boisson", "autre"];

const DEFAULT_MEALS = [
  { name: "Petit déjeuner", time: "07:30", position: 0 },
  { name: "Déjeuner", time: "12:30", position: 1 },
  { name: "Collation", time: "16:00", position: 2 },
  { name: "Dîner", time: "19:30", position: 3 },
];

const sumMeal = (items: FoodItem[]) => ({
  kcal: items.reduce((s, i) => s + i.kcal, 0),
  protein: items.reduce((s, i) => s + i.protein, 0),
  carbs: items.reduce((s, i) => s + i.carbs, 0),
  fat: items.reduce((s, i) => s + i.fat, 0),
});

const sumPlan = (meals: Meal[]) => {
  const all = meals.flatMap(m => m.items);
  return sumMeal(all);
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/* ═══════════════ PAGE ═══════════════ */
export default function ProgrammesNutriPage() {
  const router = useRouter();

  /* State */
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [showAthleteList, setShowAthleteList] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [journal, setJournal] = useState<JournalDay[]>([]);
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>([]);
  const [dayTemplates, setDayTemplates] = useState<DayTemplate[]>([]);

  /* UI State */
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [showObjModal, setShowObjModal] = useState(false);
  const [showAddFood, setShowAddFood] = useState<string | null>(null);
  const [showAddAlt, setShowAddAlt] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState<{ type: "meal" | "day"; data: any } | null>(null);
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [tab, setTab] = useState<"edit" | "tracking" | "templates" | "versions">("edit");

  const plan = plans.find(p => p.id === activePlanId) || null;

  /* ──── Fetchers ──── */
  useEffect(() => {
    fetch("/api/athletes?status=active").then(r => r.json()).then(d => { if (Array.isArray(d)) setAthletes(d); }).catch(() => {});
    fetch("/api/nutri/templates?type=meal").then(r => r.json()).then(d => { if (Array.isArray(d)) setMealTemplates(d); }).catch(() => {});
    fetch("/api/nutri/templates?type=day").then(r => r.json()).then(d => { if (Array.isArray(d)) setDayTemplates(d); }).catch(() => {});
  }, []);

  const fetchPlans = useCallback(() => {
    if (!athleteId) { setPlans([]); setActivePlanId(null); return; }
    fetch(`/api/nutri/plans?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) { setPlans(d); if (d.length > 0) setActivePlanId(d[0].id); else setActivePlanId(null); } })
      .catch(() => { setPlans([]); setActivePlanId(null); });
  }, [athleteId]);

  const fetchJournal = useCallback(() => {
    if (!athleteId) { setJournal([]); return; }
    fetch(`/api/nutri/journal?athleteId=${athleteId}&days=7`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setJournal(d); }).catch(() => setJournal([]));
  }, [athleteId]);

  useEffect(() => { fetchPlans(); fetchJournal(); }, [fetchPlans, fetchJournal]);

  const refetchPlan = async () => {
    if (!activePlanId) return;
    try {
      const r = await fetch(`/api/nutri/plans/${activePlanId}`);
      const d = await r.json();
      if (d && d.id) setPlans(prev => prev.map(p => p.id === d.id ? d : p));
    } catch { /* ignore */ }
  };

  /* ──── Plan Actions ──── */
  const createPlan = async (data: Partial<Plan>) => {
    try {
      const r = await fetch("/api/nutri/plans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...data }),
      });
      const d = await r.json();
      if (d && d.id) { setPlans(prev => [d, ...prev]); setActivePlanId(d.id); }
    } catch { /* ignore */ }
    setShowNewPlan(false);
  };

  const updatePlan = async (data: Record<string, unknown>) => {
    if (!activePlanId) return;
    try {
      const r = await fetch(`/api/nutri/plans/${activePlanId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (d && d.id) {
        setPlans(prev => prev.map(p => p.id === d.id ? d : p));
        // Sync objectives to NutriObjective if targets were changed
        const targetKeys = ["kcalTarget", "proteinTarget", "carbsTarget", "fatTarget", "waterTarget"];
        if (targetKeys.some(k => data[k] !== undefined)) {
          fetch("/api/nutri/objectives", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              athleteId: d.athleteId,
              kcal: d.kcalTarget, protein: d.proteinTarget,
              carbs: d.carbsTarget, fat: d.fatTarget,
              water: d.waterTarget ?? 2.0,
            }),
          }).catch(() => {});
        }
      }
    } catch { /* ignore */ }
  };

  const publishPlan = async (startDate?: string) => {
    if (!activePlanId) return;
    try {
      const r = await fetch(`/api/nutri/plans/${activePlanId}/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate }),
      });
      const d = await r.json();
      if (d && d.id) setPlans(prev => prev.map(p => p.id === d.id ? d : p));
    } catch { /* ignore */ }
    setShowPublish(false);
  };

  const deletePlan = async () => {
    if (!activePlanId || !confirm("Supprimer ce plan ?")) return;
    try {
      await fetch(`/api/nutri/plans/${activePlanId}`, { method: "DELETE" });
      setPlans(prev => prev.filter(p => p.id !== activePlanId));
      setActivePlanId(null);
    } catch { /* ignore */ }
  };

  /* ──── Meal Actions ──── */
  const addMeal = async (name?: string, time?: string) => {
    if (!activePlanId) return;
    const pos = plan ? plan.meals.length : 0;
    try {
      await fetch("/api/nutri/meals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: activePlanId, name: name || "Repas", time: time || null, position: pos }),
      });
      await refetchPlan();
    } catch { /* ignore */ }
  };

  const updateMeal = async (mealId: string, data: Record<string, unknown>) => {
    try {
      await fetch(`/api/nutri/meals/${mealId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      await refetchPlan();
    } catch { /* ignore */ }
  };

  const deleteMeal = async (mealId: string) => {
    if (!confirm("Supprimer ce repas ?")) return;
    try {
      await fetch(`/api/nutri/meals/${mealId}`, { method: "DELETE" });
      await refetchPlan();
    } catch { /* ignore */ }
  };

  const duplicateMeal = async (mealId: string) => {
    try {
      await fetch(`/api/nutri/meals/${mealId}/duplicate`, { method: "POST" });
      await refetchPlan();
    } catch { /* ignore */ }
  };

  /* ──── Food Item Actions ──── */
  const addFoodItem = async (mealId: string, data: Partial<FoodItem>) => {
    try {
      await fetch("/api/nutri/food-items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId, ...data }),
      });
      await refetchPlan();
    } catch { /* ignore */ }
    setShowAddFood(null);
  };

  const updateFoodItem = async (itemId: string, data: Record<string, unknown>) => {
    try {
      await fetch(`/api/nutri/food-items/${itemId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      await refetchPlan();
    } catch { /* ignore */ }
  };

  const deleteFoodItem = async (itemId: string) => {
    try {
      await fetch(`/api/nutri/food-items/${itemId}`, { method: "DELETE" });
      await refetchPlan();
    } catch { /* ignore */ }
  };

  /* ──── Alternative Actions ──── */
  const addAlternative = async (foodItemId: string, data: Partial<Alternative>) => {
    try {
      await fetch("/api/nutri/alternatives", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodItemId, ...data }),
      });
      await refetchPlan();
    } catch { /* ignore */ }
    setShowAddAlt(null);
  };

  const deleteAlternative = async (altId: string) => {
    try {
      await fetch(`/api/nutri/alternatives/${altId}`, { method: "DELETE" });
      await refetchPlan();
    } catch { /* ignore */ }
  };

  /* ──── Template Actions ──── */
  const saveTemplate = async (type: "meal" | "day", name: string, data: any) => {
    try {
      await fetch("/api/nutri/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, data }),
      });
      const r = await fetch(`/api/nutri/templates?type=${type}`);
      const d = await r.json();
      if (Array.isArray(d)) { type === "meal" ? setMealTemplates(d) : setDayTemplates(d); }
    } catch { /* ignore */ }
    setShowSaveTemplate(null);
  };

  const selectedAthlete = athletes.find(a => a.id === athleteId);
  const planTotals = plan ? sumPlan(plan.meals) : { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  /* ──── Tracking data ──── */
  const completedJournal = journal.filter(j => j.completed);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className={styles.page}>
      {/* ──── 1) HEADER ──── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Plan alimentaire</h1>
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
                      onClick={() => { setAthleteId(a.id); setAthleteSearch(a.name); setShowAthleteList(false); setActivePlanId(null); }}>
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
        {plan && (
          <div className={styles.headerRight}>
            <span className={styles.statusBadge} style={{ color: STATUS_LABELS[plan.status]?.color, borderColor: STATUS_LABELS[plan.status]?.color }}>
              {STATUS_LABELS[plan.status]?.label || plan.status}
            </span>
            <span className={styles.versionBadge}>v{plan.version}</span>
            <div className={styles.headerActions}>
              <button className={styles.btnPrimary} onClick={() => setShowPublish(true)}>
                {plan.status === "publie" || plan.status === "en_cours" ? "Mettre à jour" : "Publier"}
              </button>
              <button className={styles.btnOutline} onClick={() => setShowPreview(true)}>Prévisualiser</button>
              <button className={styles.btnOutline} onClick={() => createPlan({ ...plan, name: `${plan.name} (copie)` })}>Dupliquer</button>
            </div>
          </div>
        )}
      </div>

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
          {/* Plan selector + create */}
          <div className={styles.planBar}>
            <select className={styles.select} value={activePlanId || ""} onChange={e => setActivePlanId(e.target.value || null)}>
              <option value="">— Choisir un plan —</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({STATUS_LABELS[p.status]?.label}) — v{p.version}</option>
              ))}
            </select>
            <button className={styles.btnPrimary} onClick={() => setShowNewPlan(true)}>+ Nouveau plan</button>
            {plan && <button className={styles.btnDanger} onClick={deletePlan}>Supprimer</button>}
          </div>

          {/* Tabs */}
          {plan && (
            <div className={styles.tabs}>
              {(["edit", "tracking", "templates", "versions"] as const).map(t => (
                <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`} onClick={() => setTab(t)}>
                  {t === "edit" ? "Éditeur" : t === "tracking" ? "Suivi" : t === "templates" ? "Templates" : "Versions"}
                </button>
              ))}
            </div>
          )}

          {plan && tab === "edit" && (
            <>
              {/* ──── 2) OBJECTIFS DU PLAN ──── */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Objectifs du plan</h2>
                  <button className={styles.btnOutline} onClick={() => setShowObjModal(true)}>Modifier</button>
                </div>
                <div className={styles.objGrid}>
                  <div className={styles.objCard}>
                    <div className={styles.objLabel}>Kcal cible</div>
                    <div className={styles.objValue}>{plan.kcalTarget} <span>kcal/j</span></div>
                    <div className={styles.objBar}><div className={styles.objFill} style={{ width: `${Math.min((planTotals.kcal / plan.kcalTarget) * 100, 100)}%`, background: "#f97316" }} /></div>
                    <div className={styles.objSub}>{planTotals.kcal} / {plan.kcalTarget} kcal planifiés</div>
                  </div>
                  {[
                    { label: "Protéines", val: planTotals.protein, target: plan.proteinTarget, pct: plan.proteinPct, color: "#ef4444" },
                    { label: "Glucides", val: planTotals.carbs, target: plan.carbsTarget, pct: plan.carbsPct, color: "#3b82f6" },
                    { label: "Lipides", val: planTotals.fat, target: plan.fatTarget, pct: plan.fatPct, color: "#f59e0b" },
                  ].map(m => (
                    <div key={m.label} className={styles.objCard}>
                      <div className={styles.objLabel}>{m.label} ({m.pct}%)</div>
                      <div className={styles.objValue}>{m.val}g <span>/ {m.target}g</span></div>
                      <div className={styles.objBar}><div className={styles.objFill} style={{ width: `${Math.min((m.val / m.target) * 100, 100)}%`, background: m.color }} /></div>
                    </div>
                  ))}
                  {plan.fiberTarget && (
                    <div className={styles.objCard}><div className={styles.objLabel}>Fibres</div><div className={styles.objValue}>{plan.fiberTarget}g</div></div>
                  )}
                  {plan.waterTarget && (
                    <div className={styles.objCard}><div className={styles.objLabel}>Eau</div><div className={styles.objValue}>{plan.waterTarget}L</div></div>
                  )}
                </div>
                {(plan.notePatient || plan.notePro) && (
                  <div className={styles.notesRow}>
                    {plan.notePatient && <div className={styles.noteBox}><span className={styles.noteTag}>Visible patient</span><p>{plan.notePatient}</p></div>}
                    {plan.notePro && <div className={styles.noteBox}><span className={styles.noteTag}>Note privée</span><p>{plan.notePro}</p></div>}
                  </div>
                )}
              </div>

              {/* ──── 3) ÉDITEUR JOURNÉE TYPE ──── */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Journée type</h2>
                  <div className={styles.sectionActions}>
                    <button className={styles.btnOutline} onClick={() => {
                      if (plan.meals.length > 0) setShowSaveTemplate({ type: "day", data: plan.meals.map(m => ({ name: m.name, time: m.time, rule: m.rule, items: m.items })) });
                    }}>Sauver template journée</button>
                    <button className={styles.btnPrimary} onClick={() => addMeal()}>+ Ajouter un repas</button>
                  </div>
                </div>

                {plan.meals.length === 0 ? (
                  <div className={styles.emptyMini}>
                    <p>Aucun repas dans ce plan</p>
                    <button className={styles.btnPrimary} onClick={async () => { for (const m of DEFAULT_MEALS) await addMeal(m.name, m.time); }}>
                      Ajouter 4 repas standards
                    </button>
                  </div>
                ) : (
                  <div className={styles.mealList}>
                    {plan.meals.map(meal => {
                      const totals = sumMeal(meal.items);
                      const isEditing = editingMealId === meal.id;
                      return (
                        <div key={meal.id} className={`${styles.mealCard} ${isEditing ? styles.mealCardOpen : ""}`}>
                          <div className={styles.mealHead} onClick={() => setEditingMealId(isEditing ? null : meal.id)}>
                            <div className={styles.mealInfo}>
                              <span className={styles.mealName}>{meal.name}</span>
                              {meal.time && <span className={styles.mealTime}>{meal.time}</span>}
                            </div>
                            <div className={styles.mealTotals}>
                              <span className={styles.mealKcal}>{totals.kcal} kcal</span>
                              <span className={styles.mealMacro}>P {totals.protein}g</span>
                              <span className={styles.mealMacro}>G {totals.carbs}g</span>
                              <span className={styles.mealMacro}>L {totals.fat}g</span>
                            </div>
                            {meal.rule && <span className={styles.mealRule}>{meal.rule}</span>}
                            <div className={styles.mealActions} onClick={e => e.stopPropagation()}>
                              <button className={styles.iconBtn} title="Dupliquer" onClick={() => duplicateMeal(meal.id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                              <button className={styles.iconBtn} title="Template" onClick={() => setShowSaveTemplate({ type: "meal", data: meal.items })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
                              <button className={styles.iconBtn} title="Supprimer" onClick={() => deleteMeal(meal.id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                            </div>
                          </div>

                          {isEditing && (
                            <div className={styles.mealBody} onClick={e => e.stopPropagation()}>
                              {/* Meal meta edit */}
                              <div className={styles.mealMetaRow}>
                                <input className={styles.inputSm} value={meal.name} onChange={e => updateMeal(meal.id, { name: e.target.value })} placeholder="Nom du repas" />
                                <input className={styles.inputSm} type="time" value={meal.time || ""} onChange={e => updateMeal(meal.id, { time: e.target.value })} />
                                <input className={styles.inputSm} value={meal.rule || ""} onChange={e => updateMeal(meal.id, { rule: e.target.value || null })} placeholder="Règle (ex: 30g prot min)" />
                              </div>

                              {/* Food items list */}
                              {meal.items.length === 0 ? (
                                <div className={styles.emptyItems}>Aucun aliment — ajoutez-en ci-dessous</div>
                              ) : (
                                <table className={styles.foodTable}>
                                  <thead><tr><th>Aliment</th><th>Qté</th><th>Unité</th><th>Kcal</th><th>P</th><th>G</th><th>L</th><th>Cat.</th><th>Oblig.</th><th></th></tr></thead>
                                  <tbody>
                                    {meal.items.map(item => (
                                      <React.Fragment key={item.id}>
                                        <tr className={styles.foodRow}>
                                          <td><input className={styles.inputCell} value={item.name} onChange={e => updateFoodItem(item.id, { name: e.target.value })} /></td>
                                          <td><input className={styles.inputCell} type="number" value={item.quantity} onChange={e => updateFoodItem(item.id, { quantity: +e.target.value })} /></td>
                                          <td><select className={styles.inputCell} value={item.unit} onChange={e => updateFoodItem(item.id, { unit: e.target.value })}><option>g</option><option>ml</option><option>unité</option></select></td>
                                          <td><input className={styles.inputCell} type="number" value={item.kcal} onChange={e => updateFoodItem(item.id, { kcal: +e.target.value })} /></td>
                                          <td><input className={styles.inputCell} type="number" value={item.protein} onChange={e => updateFoodItem(item.id, { protein: +e.target.value })} /></td>
                                          <td><input className={styles.inputCell} type="number" value={item.carbs} onChange={e => updateFoodItem(item.id, { carbs: +e.target.value })} /></td>
                                          <td><input className={styles.inputCell} type="number" value={item.fat} onChange={e => updateFoodItem(item.id, { fat: +e.target.value })} /></td>
                                          <td><select className={styles.inputCell} value={item.category} onChange={e => updateFoodItem(item.id, { category: e.target.value })}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                                          <td><button className={`${styles.toggleSmall} ${item.mandatory ? styles.toggleOn : ""}`} onClick={() => updateFoodItem(item.id, { mandatory: !item.mandatory })}>{item.mandatory ? "Obl." : "Opt."}</button></td>
                                          <td>
                                            <button className={styles.iconBtnSm} title="Alternative" onClick={() => setShowAddAlt(item.id)}>↔</button>
                                            <button className={styles.iconBtnSm} title="Supprimer" onClick={() => deleteFoodItem(item.id)}>✕</button>
                                          </td>
                                        </tr>
                                        {/* ──── 4) ALTERNATIVES ──── */}
                                        {item.alternatives.length > 0 && item.alternatives.map(alt => (
                                          <tr key={alt.id} className={styles.altRow}>
                                            <td><span className={styles.altIcon}>↔</span> {alt.name}</td>
                                            <td>{alt.quantity}</td>
                                            <td>{alt.unit}</td>
                                            <td>{alt.kcal}</td>
                                            <td>{alt.protein}</td>
                                            <td>{alt.carbs}</td>
                                            <td>{alt.fat}</td>
                                            <td>{alt.constraint || "—"}</td>
                                            <td></td>
                                            <td><button className={styles.iconBtnSm} onClick={() => deleteAlternative(alt.id)}>✕</button></td>
                                          </tr>
                                        ))}
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              <button className={styles.btnOutline} onClick={() => setShowAddFood(meal.id)}>+ Ajouter aliment</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ──── 5) SUIVI D'EXÉCUTION ──── */}
          {plan && tab === "tracking" && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Suivi d&apos;exécution — Plan vs Réalité</h2>
                <button className={styles.btnOutline} onClick={() => router.push("/dashboard/nutri/indicateurs")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{marginRight: 4, verticalAlign: 'middle'}}><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>Voir le bilan complet</button>
              </div>
              {completedJournal.length === 0 ? (
                <div className={styles.emptyMini}>Aucune donnée de journal sur les 7 derniers jours</div>
              ) : (
                <>
                  <div className={styles.trackingGrid}>
                    <div className={styles.trackHeader}><span>Date</span><span>Kcal</span><span>Prot</span><span>Glu</span><span>Lip</span><span>Statut</span></div>
                    {journal.map(j => {
                      const kcalDiff = j.kcal - plan.kcalTarget;
                      const protDiff = j.protein - plan.proteinTarget;
                      return (
                        <div key={j.id} className={styles.trackRow}>
                          <span>{fmtDate(j.date)}</span>
                          <span className={kcalDiff > plan.kcalTarget * 0.1 ? styles.trackWarn : kcalDiff < -plan.kcalTarget * 0.2 ? styles.trackBad : styles.trackOk}>{j.kcal} ({kcalDiff > 0 ? "+" : ""}{kcalDiff})</span>
                          <span className={protDiff < -20 ? styles.trackBad : styles.trackOk}>{j.protein}g</span>
                          <span>{j.carbs}g</span>
                          <span>{j.fat}g</span>
                          <span>{j.completed ? <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Détections MVP */}
                  <div className={styles.detectionBlock}>
                    <h3 className={styles.detectionTitle}>Détections automatiques</h3>
                    {(() => {
                      const detections: string[] = [];
                      const lowProt = completedJournal.filter(j => j.protein < plan.proteinTarget * 0.8).length;
                      if (lowProt > 0) detections.push(`Protéines < objectif ${lowProt}/${completedJournal.length} jours`);
                      const highFat = completedJournal.filter(j => j.fat > plan.fatTarget * 1.2).length;
                      if (highFat > 0) detections.push(`Lipides trop hauts ${highFat}/${completedJournal.length} jours`);
                      const lowKcal = completedJournal.filter(j => j.kcal < plan.kcalTarget * 0.7).length;
                      if (lowKcal > 0) detections.push(`Kcal très bas ${lowKcal}/${completedJournal.length} jours`);
                      const noEntry = parseInt("7") - journal.length;
                      if (noEntry >= 3) detections.push(`Aucune saisie ${noEntry}/7 jours`);
                      if (detections.length === 0) detections.push("Aucune anomalie détectée — bon suivi");
                      return detections.map((d, i) => <div key={i} className={styles.detectionItem}>{d}</div>);
                    })()}
                  </div>

                  <div className={styles.quickBar}>
                    <button className={styles.btnOutline} onClick={() => setTab("edit")}>Ajuster le plan</button>
                    <button className={styles.btnOutline} onClick={() => router.push("/dashboard/nutri/messagerie")}>Envoyer un message</button>
                    <button className={styles.btnOutline} onClick={() => router.push("/dashboard/nutri/indicateurs")}>Créer une alerte</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ──── 6) TEMPLATES ──── */}
          {plan && tab === "templates" && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Templates</h2>
              </div>

              <div className={styles.tplSection}>
                <h3 className={styles.tplSectionTitle}>Templates de repas</h3>
                {mealTemplates.length === 0 ? (
                  <div className={styles.emptyMini}>Aucun template de repas — sauvegardez un repas depuis l&apos;éditeur</div>
                ) : (
                  <div className={styles.tplGrid}>
                    {mealTemplates.map(t => (
                      <div key={t.id} className={styles.tplCard}>
                        <div className={styles.tplName}>{t.name}</div>
                        <div className={styles.tplMeta}>{(() => { try { return JSON.parse(t.items).length + " aliments"; } catch { return "—"; } })()}</div>
                        <button className={styles.btnOutline} onClick={async () => {
                          try {
                            const items = JSON.parse(t.items);
                            const r = await fetch("/api/nutri/meals", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ planId: activePlanId, name: t.name, position: plan.meals.length }),
                            });
                            const meal = await r.json();
                            if (meal && meal.id) {
                              for (const item of items) {
                                await fetch("/api/nutri/food-items", {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ mealId: meal.id, ...item }),
                                });
                              }
                              await refetchPlan();
                              setTab("edit");
                            }
                          } catch { /* ignore */ }
                        }}>Appliquer</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.tplSection}>
                <h3 className={styles.tplSectionTitle}>Templates de journée</h3>
                {dayTemplates.length === 0 ? (
                  <div className={styles.emptyMini}>Aucun template de journée — sauvegardez une journée depuis l&apos;éditeur</div>
                ) : (
                  <div className={styles.tplGrid}>
                    {dayTemplates.map(t => (
                      <div key={t.id} className={styles.tplCard}>
                        <div className={styles.tplName}>{t.name}</div>
                        <div className={styles.tplMeta}>{(() => { try { return JSON.parse(t.meals).length + " repas"; } catch { return "—"; } })()}</div>
                        <button className={styles.btnOutline} onClick={() => setShowApplyTemplate(true)}>Appliquer</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──── 7) VERSIONS ──── */}
          {plan && tab === "versions" && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Historique des versions</h2>
              </div>
              {!plan.versions || plan.versions.length === 0 ? (
                <div className={styles.emptyMini}>Aucune version publiée — publiez le plan pour créer une version</div>
              ) : (
                <div className={styles.versionList}>
                  {plan.versions.map(v => (
                    <div key={v.id} className={styles.versionCard}>
                      <span className={styles.versionNum}>Version {v.version}</span>
                      <span className={styles.versionDate}>{fmtDate(v.publishedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!plan && athleteId && (
            <div className={styles.emptyMini}>
              <p>Aucun plan sélectionné</p>
              <button className={styles.btnPrimary} onClick={() => setShowNewPlan(true)}>+ Créer un plan</button>
            </div>
          )}
        </>
      )}

      {/* ═══════ MODALS ═══════ */}

      {showNewPlan && (
        <NewPlanModal
          onClose={() => setShowNewPlan(false)}
          onCreate={createPlan}
        />
      )}

      {showObjModal && plan && (
        <ObjectivesModal
          plan={plan}
          onClose={() => setShowObjModal(false)}
          onSave={updatePlan}
        />
      )}

      {showAddFood && (
        <AddFoodModal
          onClose={() => setShowAddFood(null)}
          onSave={(data) => addFoodItem(showAddFood, data)}
        />
      )}

      {showAddAlt && (
        <AddAlternativeModal
          onClose={() => setShowAddAlt(null)}
          onSave={(data) => addAlternative(showAddAlt, data)}
        />
      )}

      {showPublish && plan && (
        <PublishModal
          plan={plan}
          onClose={() => setShowPublish(false)}
          onPublish={publishPlan}
        />
      )}

      {showPreview && plan && (
        <PreviewModal plan={plan} onClose={() => setShowPreview(false)} />
      )}

      {showSaveTemplate && (
        <SaveTemplateModal
          type={showSaveTemplate.type}
          onClose={() => setShowSaveTemplate(null)}
          onSave={(name) => saveTemplate(showSaveTemplate.type, name, showSaveTemplate.data)}
        />
      )}
    </div>
  );
}

/* ═══════════════ MODALS ═══════════════ */

function NewPlanModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const [name, setName] = useState("Plan alimentaire");
  const [kcal, setKcal] = useState(2000);
  const [prot, setProt] = useState(120);
  const [carbs, setCarbs] = useState(250);
  const [fat, setFat] = useState(65);
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Nouveau plan</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Nom</label><input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Kcal/j</label><input type="number" value={kcal} onChange={e => setKcal(+e.target.value)} /></div>
            <div className={styles.field}><label>Prot (g)</label><input type="number" value={prot} onChange={e => setProt(+e.target.value)} /></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Glu (g)</label><input type="number" value={carbs} onChange={e => setCarbs(+e.target.value)} /></div>
            <div className={styles.field}><label>Lip (g)</label><input type="number" value={fat} onChange={e => setFat(+e.target.value)} /></div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={() => onCreate({ name, kcalTarget: kcal, proteinTarget: prot, carbsTarget: carbs, fatTarget: fat })}>Créer</button>
        </div>
      </div>
    </div>
  );
}

function ObjectivesModal({ plan, onClose, onSave }: { plan: Plan; onClose: () => void; onSave: (d: any) => void }) {
  const [kcal, setKcal] = useState(plan.kcalTarget);
  const [prot, setProt] = useState(plan.proteinTarget);
  const [carbs, setCarbs] = useState(plan.carbsTarget);
  const [fat, setFat] = useState(plan.fatTarget);
  const [fiber, setFiber] = useState(plan.fiberTarget ?? 0);
  const [water, setWater] = useState(plan.waterTarget ?? 0);
  const [protPct, setProtPct] = useState(plan.proteinPct);
  const [carbsPct, setCarbsPct] = useState(plan.carbsPct);
  const [fatPct, setFatPct] = useState(plan.fatPct);
  const [noteP, setNoteP] = useState(plan.notePatient);
  const [notePr, setNotePr] = useState(plan.notePro);
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Objectifs du plan</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Kcal/j</label><input type="number" value={kcal} onChange={e => setKcal(+e.target.value)} /></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Prot (g)</label><input type="number" value={prot} onChange={e => setProt(+e.target.value)} /></div>
            <div className={styles.field}><label>Glu (g)</label><input type="number" value={carbs} onChange={e => setCarbs(+e.target.value)} /></div>
            <div className={styles.field}><label>Lip (g)</label><input type="number" value={fat} onChange={e => setFat(+e.target.value)} /></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>% Prot</label><input type="number" value={protPct} onChange={e => setProtPct(+e.target.value)} /></div>
            <div className={styles.field}><label>% Glu</label><input type="number" value={carbsPct} onChange={e => setCarbsPct(+e.target.value)} /></div>
            <div className={styles.field}><label>% Lip</label><input type="number" value={fatPct} onChange={e => setFatPct(+e.target.value)} /></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Fibres (g)</label><input type="number" value={fiber} onChange={e => setFiber(+e.target.value)} /></div>
            <div className={styles.field}><label>Eau (L)</label><input type="number" step="0.1" value={water} onChange={e => setWater(+e.target.value)} /></div>
          </div>
          <div className={styles.field}><label>Note patient</label><textarea value={noteP} onChange={e => setNoteP(e.target.value)} rows={2} /></div>
          <div className={styles.field}><label>Note privée (pro)</label><textarea value={notePr} onChange={e => setNotePr(e.target.value)} rows={2} /></div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={() => {
            onSave({
              kcalTarget: kcal, proteinTarget: prot, carbsTarget: carbs, fatTarget: fat,
              fiberTarget: fiber || null, waterTarget: water || null,
              proteinPct: protPct, carbsPct: carbsPct, fatPct: fatPct,
              notePatient: noteP, notePro: notePr,
            });
            onClose();
          }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function AddFoodModal({ onClose, onSave }: { onClose: () => void; onSave: (d: any) => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(100);
  const [unit, setUnit] = useState("g");
  const [kcal, setKcal] = useState(0);
  const [prot, setProt] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [cat, setCat] = useState("autre");
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Ajouter un aliment</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Nom *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Blanc de poulet" /></div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Quantité</label><input type="number" value={qty} onChange={e => setQty(+e.target.value)} /></div>
            <div className={styles.field}><label>Unité</label><select value={unit} onChange={e => setUnit(e.target.value)}><option>g</option><option>ml</option><option>unité</option></select></div>
            <div className={styles.field}><label>Catégorie</label><select value={cat} onChange={e => setCat(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Kcal</label><input type="number" value={kcal} onChange={e => setKcal(+e.target.value)} /></div>
            <div className={styles.field}><label>P (g)</label><input type="number" value={prot} onChange={e => setProt(+e.target.value)} /></div>
            <div className={styles.field}><label>G (g)</label><input type="number" value={carbs} onChange={e => setCarbs(+e.target.value)} /></div>
            <div className={styles.field}><label>L (g)</label><input type="number" value={fat} onChange={e => setFat(+e.target.value)} /></div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} disabled={!name.trim()} onClick={() => onSave({ name, quantity: qty, unit, kcal, protein: prot, carbs, fat, category: cat })}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

function AddAlternativeModal({ onClose, onSave }: { onClose: () => void; onSave: (d: any) => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(0);
  const [unit, setUnit] = useState("g");
  const [kcal, setKcal] = useState(0);
  const [prot, setProt] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [constraint, setConstraint] = useState("");
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Ajouter une alternative</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Nom *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: 30g whey + yaourt" /></div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Quantité</label><input type="number" value={qty} onChange={e => setQty(+e.target.value)} /></div>
            <div className={styles.field}><label>Unité</label><select value={unit} onChange={e => setUnit(e.target.value)}><option>g</option><option>ml</option><option>unité</option></select></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Kcal</label><input type="number" value={kcal} onChange={e => setKcal(+e.target.value)} /></div>
            <div className={styles.field}><label>P</label><input type="number" value={prot} onChange={e => setProt(+e.target.value)} /></div>
            <div className={styles.field}><label>G</label><input type="number" value={carbs} onChange={e => setCarbs(+e.target.value)} /></div>
            <div className={styles.field}><label>L</label><input type="number" value={fat} onChange={e => setFat(+e.target.value)} /></div>
          </div>
          <div className={styles.field}><label>Contrainte</label><input value={constraint} onChange={e => setConstraint(e.target.value)} placeholder="Ex: sans lactose, végétarien..." /></div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} disabled={!name.trim()} onClick={() => onSave({ name, quantity: qty, unit, kcal, protein: prot, carbs, fat, constraint: constraint || null })}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

function PublishModal({ plan, onClose, onPublish }: { plan: Plan; onClose: () => void; onPublish: (startDate?: string) => void }) {
  const [startDate, setStartDate] = useState("");
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Publier le plan</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <p className={styles.publishInfo}>
            Le patient recevra la <b>version {plan.version + 1}</b> de ce plan.
          </p>
          <div className={styles.field}>
            <label>Appliquer à partir de (optionnel)</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={() => onPublish(startDate || undefined)}>Publier</button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const totals = plan.meals.flatMap(m => m.items).reduce((s, i) => ({ kcal: s.kcal + i.kcal, protein: s.protein + i.protein, carbs: s.carbs + i.carbs, fat: s.fat + i.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.previewModal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Vue patient — {plan.name}</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.previewBody}>
          {/* Objectives summary */}
          <div className={styles.previewObj}>
            <div className={styles.previewKcal}>
              <span className={styles.previewKcalVal}>{totals.kcal}</span>
              <span className={styles.previewKcalTarget}>/ {plan.kcalTarget} kcal</span>
            </div>
            <div className={styles.previewMacros}>
              <span style={{ color: "#ef4444" }}>P {totals.protein}g</span>
              <span style={{ color: "#3b82f6" }}>G {totals.carbs}g</span>
              <span style={{ color: "#f59e0b" }}>L {totals.fat}g</span>
            </div>
          </div>
          {plan.notePatient && <div className={styles.previewNote}>{plan.notePatient}</div>}

          {/* Meals */}
          {plan.meals.length === 0 ? (
            <div className={styles.emptyMini}>Aucun repas dans ce plan</div>
          ) : (
            plan.meals.map(meal => {
              const mt = meal.items.reduce((s, i) => ({ kcal: s.kcal + i.kcal, p: s.p + i.protein, g: s.g + i.carbs, l: s.l + i.fat }), { kcal: 0, p: 0, g: 0, l: 0 });
              return (
                <div key={meal.id} className={styles.previewMeal}>
                  <div className={styles.previewMealHead}>
                    <div>
                      <div className={styles.previewMealName}>{meal.name}</div>
                      {meal.time && <div className={styles.previewMealTime}>{meal.time}</div>}
                    </div>
                    <div className={styles.previewMealTotals}>{mt.kcal} kcal · P {mt.p}g · G {mt.g}g · L {mt.l}g</div>
                  </div>
                  {meal.items.map(item => (
                    <div key={item.id} className={styles.previewItem}>
                      <div className={styles.previewItemMain}>
                        <span className={styles.previewItemName}>{item.name}</span>
                        <span className={styles.previewItemQty}>{item.quantity}{item.unit}</span>
                        <span className={styles.previewItemKcal}>{item.kcal} kcal</span>
                        {!item.mandatory && <span className={styles.previewOptional}>optionnel</span>}
                      </div>
                      {item.alternatives.length > 0 && (
                        <div className={styles.previewAlts}>
                          {item.alternatives.map(alt => (
                            <span key={alt.id} className={styles.previewAlt}>↔ {alt.name} ({alt.quantity}{alt.unit}){alt.constraint ? ` · ${alt.constraint}` : ""}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function SaveTemplateModal({ type, onClose, onSave }: { type: "meal" | "day"; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Sauver comme template {type === "meal" ? "de repas" : "de journée"}</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Nom du template</label><input value={name} onChange={e => setName(e.target.value)} placeholder={type === "meal" ? "Ex: Petit déj rapide" : "Ex: Jour sèche"} /></div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} disabled={!name.trim()} onClick={() => onSave(name)}>Sauver</button>
        </div>
      </div>
    </div>
  );
}
