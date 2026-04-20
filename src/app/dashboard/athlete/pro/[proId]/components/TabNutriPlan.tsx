"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.scss";

export default function TabNutriPlan({ proId }: { proId: string }) {
  const [nutriPlans, setNutriPlans] = useState<any[]>([]);
  const [nutriActivePlanId, setNutriActivePlanId] = useState<string | null>(null);
  const [nutriPlansLoading, setNutriPlansLoading] = useState(true);
  const [nutriJournal, setNutriJournal] = useState<any[]>([]);
  const [nutriJournalLoading, setNutriJournalLoading] = useState(true);
  const [nutriOpenMealId, setNutriOpenMealId] = useState<string | null>(null);
  const [nutriJournalForm, setNutriJournalForm] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0, water: 0, completed: false });
  const [nutriJournalSaving, setNutriJournalSaving] = useState(false);

  const fetchNutriPlans = () => {
    setNutriPlansLoading(true);
    fetch(`/api/athlete/nutri-plans?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.plans) {
          setNutriPlans(data.plans);
          if (data.plans.length > 0 && !nutriActivePlanId) setNutriActivePlanId(data.plans[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setNutriPlansLoading(false));
  };

  const fetchNutriJournal = () => {
    setNutriJournalLoading(true);
    fetch(`/api/athlete/nutri-journal?proId=${proId}&days=7`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.entries) setNutriJournal(data.entries); })
      .catch(() => {})
      .finally(() => setNutriJournalLoading(false));
  };

  useEffect(() => {
    fetchNutriPlans();
    fetchNutriJournal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proId]);

  const submitNutriJournal = async () => {
    setNutriJournalSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/athlete/nutri-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proId, date: today, ...nutriJournalForm }),
      });
      if (res.ok) {
        fetchNutriJournal();
        setNutriJournalForm({ kcal: 0, protein: 0, carbs: 0, fat: 0, water: 0, completed: false });
      }
    } catch { /* ignore */ }
    setNutriJournalSaving(false);
  };

  return (
    <section className={styles.tabContent}>
      {nutriPlansLoading ? (
        <p className={styles.loadingText}>Chargement…</p>
      ) : nutriPlans.length === 0 ? (
        <div className={styles.tabEmpty}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>
          <span>Aucun plan alimentaire pour le moment</span>
        </div>
      ) : (() => {
        const activePlan = nutriPlans.find((p: any) => p.id === nutriActivePlanId) || nutriPlans[0];
        if (!activePlan) return null;
        const planTotals = activePlan.meals.flatMap((m: any) => m.items).reduce((s: any, i: any) => ({
          kcal: s.kcal + i.kcal, protein: s.protein + i.protein, carbs: s.carbs + i.carbs, fat: s.fat + i.fat,
        }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
        return (
          <>
            {/* Plan selector if multiple */}
            {nutriPlans.length > 1 && (
              <div className={styles.nutriPlanSelector}>
                {nutriPlans.map((p: any) => (
                  <button
                    key={p.id}
                    className={`${styles.nutriPlanPill} ${nutriActivePlanId === p.id ? styles.nutriPlanPillActive : ""}`}
                    onClick={() => setNutriActivePlanId(p.id)}
                  >
                    {p.name} <span className={styles.nutriPlanVersion}>v{p.version}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Plan header */}
            <div className={styles.nutriPlanHeader}>
              <h3 className={styles.nutriPlanName}>{activePlan.name}</h3>
              <span className={styles.nutriPlanBadge}>v{activePlan.version}</span>
            </div>

            {/* Objectives grid */}
            <div className={styles.nutriObjGrid}>
              <div className={styles.nutriObjCard}>
                <div className={styles.nutriObjLabel}>Calories</div>
                <div className={styles.nutriObjValue}>{planTotals.kcal} <span>/ {activePlan.kcalTarget} kcal</span></div>
                <div className={styles.nutriObjBar}><div className={styles.nutriObjFill} style={{ width: `${Math.min((planTotals.kcal / activePlan.kcalTarget) * 100, 100)}%`, background: "#f97316" }} /></div>
              </div>
              {[
                { label: "Protéines", val: planTotals.protein, target: activePlan.proteinTarget, pct: activePlan.proteinPct, color: "#ef4444" },
                { label: "Glucides", val: planTotals.carbs, target: activePlan.carbsTarget, pct: activePlan.carbsPct, color: "#3b82f6" },
                { label: "Lipides", val: planTotals.fat, target: activePlan.fatTarget, pct: activePlan.fatPct, color: "#f59e0b" },
              ].map((m) => (
                <div key={m.label} className={styles.nutriObjCard}>
                  <div className={styles.nutriObjLabel}>{m.label} ({m.pct}%)</div>
                  <div className={styles.nutriObjValue}>{Math.round(m.val)}g <span>/ {m.target}g</span></div>
                  <div className={styles.nutriObjBar}><div className={styles.nutriObjFill} style={{ width: `${Math.min((m.val / m.target) * 100, 100)}%`, background: m.color }} /></div>
                </div>
              ))}
              {activePlan.waterTarget && (
                <div className={styles.nutriObjCard}>
                  <div className={styles.nutriObjLabel}>Eau</div>
                  <div className={styles.nutriObjValue}>{activePlan.waterTarget}L</div>
                </div>
              )}
            </div>

            {/* Note patient */}
            {activePlan.notePatient && (
              <div className={styles.nutriNote}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                {activePlan.notePatient}
              </div>
            )}

            {/* Meals */}
            {activePlan.meals.length === 0 ? (
              <div className={styles.tabEmpty} style={{ padding: "24px 0" }}>
                <span>Aucun repas dans ce plan</span>
              </div>
            ) : (
              <div className={styles.nutriMealList}>
                {activePlan.meals.map((meal: any) => {
                  const mt = meal.items.reduce((s: any, i: any) => ({
                    kcal: s.kcal + i.kcal, p: s.p + i.protein, g: s.g + i.carbs, l: s.l + i.fat,
                  }), { kcal: 0, p: 0, g: 0, l: 0 });
                  const isOpen = nutriOpenMealId === meal.id;
                  return (
                    <div key={meal.id} className={styles.nutriMealCard}>
                      <div className={styles.nutriMealHead} onClick={() => setNutriOpenMealId(isOpen ? null : meal.id)}>
                        <div className={styles.nutriMealInfo}>
                          <span className={styles.nutriMealName}>{meal.name}</span>
                          {meal.time && <span className={styles.nutriMealTime}>{meal.time}</span>}
                        </div>
                        <div className={styles.nutriMealTotals}>
                          <span className={styles.nutriMealKcal}>{mt.kcal} kcal</span>
                          <span className={styles.nutriMealMacro} style={{ color: "#ef4444" }}>P {Math.round(mt.p)}g</span>
                          <span className={styles.nutriMealMacro} style={{ color: "#3b82f6" }}>G {Math.round(mt.g)}g</span>
                          <span className={styles.nutriMealMacro} style={{ color: "#f59e0b" }}>L {Math.round(mt.l)}g</span>
                        </div>
                        <svg className={styles.nutriChevron} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      </div>
                      {isOpen && (
                        <div className={styles.nutriMealBody}>
                          {meal.items.length === 0 ? (
                            <div className={styles.nutriEmptyItems}>Aucun aliment</div>
                          ) : (
                            meal.items.map((item: any) => (
                              <div key={item.id} className={styles.nutriFoodItem}>
                                <div className={styles.nutriFoodMain}>
                                  <span className={styles.nutriFoodName}>{item.name}</span>
                                  <span className={styles.nutriFoodQty}>{item.quantity}{item.unit}</span>
                                  <span className={styles.nutriFoodKcal}>{item.kcal} kcal</span>
                                  <span className={styles.nutriFoodMacro}>P {Math.round(item.protein)}g</span>
                                  <span className={styles.nutriFoodMacro}>G {Math.round(item.carbs)}g</span>
                                  <span className={styles.nutriFoodMacro}>L {Math.round(item.fat)}g</span>
                                  {!item.mandatory && <span className={styles.nutriOptional}>optionnel</span>}
                                </div>
                                {item.alternatives.length > 0 && (
                                  <div className={styles.nutriAlts}>
                                    {item.alternatives.map((alt: any) => (
                                      <div key={alt.id} className={styles.nutriAltItem}>
                                        <span className={styles.nutriAltIcon}>↔</span>
                                        <span>{alt.name} ({alt.quantity}{alt.unit})</span>
                                        <span className={styles.nutriAltKcal}>{alt.kcal} kcal</span>
                                        {alt.constraint && <span className={styles.nutriAltConstraint}>{alt.constraint}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Journal section */}
            <div className={styles.nutriJournalSection}>
              <h3 className={styles.nutriJournalTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                Mon journal du jour
              </h3>
              <div className={styles.nutriJournalForm}>
                <div className={styles.nutriJournalRow}>
                  <label className={styles.nutriJournalField}>
                    <span>Kcal</span>
                    <input type="number" value={nutriJournalForm.kcal || ""} onChange={(e) => setNutriJournalForm(f => ({ ...f, kcal: +e.target.value }))} placeholder="0" />
                  </label>
                  <label className={styles.nutriJournalField}>
                    <span>Protéines (g)</span>
                    <input type="number" value={nutriJournalForm.protein || ""} onChange={(e) => setNutriJournalForm(f => ({ ...f, protein: +e.target.value }))} placeholder="0" />
                  </label>
                  <label className={styles.nutriJournalField}>
                    <span>Glucides (g)</span>
                    <input type="number" value={nutriJournalForm.carbs || ""} onChange={(e) => setNutriJournalForm(f => ({ ...f, carbs: +e.target.value }))} placeholder="0" />
                  </label>
                  <label className={styles.nutriJournalField}>
                    <span>Lipides (g)</span>
                    <input type="number" value={nutriJournalForm.fat || ""} onChange={(e) => setNutriJournalForm(f => ({ ...f, fat: +e.target.value }))} placeholder="0" />
                  </label>
                  <label className={styles.nutriJournalField}>
                    <span>Eau (L)</span>
                    <input type="number" step="0.1" value={nutriJournalForm.water || ""} onChange={(e) => setNutriJournalForm(f => ({ ...f, water: +e.target.value }))} placeholder="0" />
                  </label>
                </div>
                <div className={styles.nutriJournalActions}>
                  <label className={styles.nutriJournalCheck}>
                    <input type="checkbox" checked={nutriJournalForm.completed} onChange={(e) => setNutriJournalForm(f => ({ ...f, completed: e.target.checked }))} />
                    Journée complète
                  </label>
                  <button className={styles.nutriJournalSubmit} onClick={submitNutriJournal} disabled={nutriJournalSaving}>
                    {nutriJournalSaving ? "Envoi…" : "Enregistrer"}
                  </button>
                </div>
              </div>

              {/* Journal history */}
              {nutriJournalLoading ? (
                <p className={styles.loadingText}>Chargement…</p>
              ) : nutriJournal.length > 0 && (
                <div className={styles.nutriJournalHistory}>
                  <div className={styles.nutriJournalHistoryHeader}>
                    <span>Date</span><span>Kcal</span><span>P</span><span>G</span><span>L</span><span>Eau</span><span></span>
                  </div>
                  {nutriJournal.map((j: any) => {
                    const kcalDiff = j.kcal - activePlan.kcalTarget;
                    return (
                      <div key={j.id} className={styles.nutriJournalHistoryRow}>
                        <span>{new Date(j.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                        <span style={{ color: Math.abs(kcalDiff) > activePlan.kcalTarget * 0.15 ? "#ef4444" : "#22c55e" }}>{j.kcal}</span>
                        <span>{j.protein}g</span>
                        <span>{j.carbs}g</span>
                        <span>{j.fat}g</span>
                        <span>{j.water}L</span>
                        <span>{j.completed ? <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" width="14" height="14"><path d="M20 6L9 17l-5-5" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      })()}
    </section>
  );
}
