"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.scss";

export default function TabNutriBilan({ proId }: { proId: string }) {
  const [nutriObjectives, setNutriObjectives] = useState<any>(null);
  const [nutriJournal, setNutriJournal] = useState<any[]>([]);
  const [nutriMeasures, setNutriMeasures] = useState<any[]>([]);
  const [nutriAlerts, setNutriAlerts] = useState<any[]>([]);
  const [nutriNotes, setNutriNotes] = useState<any[]>([]);
  const [nutriBilanPeriod, setNutriBilanPeriod] = useState("7");
  const [evoSlide, setEvoSlide] = useState(0);
  const [activePlan, setActivePlan] = useState<{ name: string; status: string; version: number } | null>(null);
  const [alertTypeFilter, setAlertTypeFilter] = useState<"all" | "alert" | "info" | "success">("all");
  const [alertStatusFilter, setAlertStatusFilter] = useState<"all" | "unread" | "to_treat" | "closed">("all");
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);
  const [showAddMeasure, setShowAddMeasure] = useState(false);
  const [mWeight, setMWeight] = useState("");
  const [mWaist, setMWaist] = useState("");
  const [mHydration, setMHydration] = useState("");
  const [mSaving, setMSaving] = useState(false);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [jKcal, setJKcal] = useState("");
  const [jProt, setJProt] = useState("");
  const [jCarbs, setJCarbs] = useState("");
  const [jFat, setJFat] = useState("");
  const [jWater, setJWater] = useState("");
  const [jCompleted, setJCompleted] = useState(false);
  const [jSaving, setJSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/athlete/nutri-objectives?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setNutriObjectives(data); })
      .catch(() => {});
    fetchJournal();
    fetchMeasures();
    fetch(`/api/athlete/nutri-alerts?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.alerts) setNutriAlerts(data.alerts); })
      .catch(() => {});
    fetch(`/api/athlete/nutri-notes?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.notes) setNutriNotes(data.notes); })
      .catch(() => {});
    fetch(`/api/athlete/nutri-plans?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.plans?.length) {
          const p = data.plans[0];
          setActivePlan({ name: p.name, status: p.status, version: p.versions?.[0]?.version ?? 1 });
        } else { setActivePlan(null); }
      })
      .catch(() => setActivePlan(null));
  }, [proId, nutriBilanPeriod]);

  const fetchJournal = () => {
    fetch(`/api/athlete/nutri-journal?proId=${proId}&days=${nutriBilanPeriod}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.entries) setNutriJournal(data.entries); })
      .catch(() => {});
  };

  const handleSaveEntry = async () => {
    setJSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await fetch("/api/athlete/nutri-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proId, date: today, kcal: +jKcal || 0, protein: +jProt || 0, carbs: +jCarbs || 0, fat: +jFat || 0, water: +jWater || 0, completed: jCompleted }),
      });
      fetchJournal();
      setShowJournalForm(false);
      setJKcal(""); setJProt(""); setJCarbs(""); setJFat(""); setJWater(""); setJCompleted(false);
    } catch { /* ignore */ }
    setJSaving(false);
  };

  const fetchMeasures = () => {
    fetch(`/api/athlete/nutri-measures?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.measures) setNutriMeasures(data.measures); })
      .catch(() => {});
  };

  const handleAddMeasure = async () => {
    if (!mWeight && !mWaist && !mHydration) return;
    setMSaving(true);
    try {
      await fetch("/api/athlete/nutri-measures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proId, weight: mWeight ? +mWeight : null, waist: mWaist ? +mWaist : null, hydration: mHydration ? +mHydration : null }),
      });
      fetchMeasures();
      setMWeight(""); setMWaist(""); setMHydration("");
      setShowAddMeasure(false);
    } catch { /* ignore */ }
    setMSaving(false);
  };

  const obj = nutriObjectives;
  if (!obj) return (
    <section className={styles.tabContent}>
      <div className={styles.tabEmpty}>
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        <span>Aucun objectif nutritionnel défini</span>
      </div>
    </section>
  );

  const completedDays = nutriJournal.filter((d: any) => d.completed);
  const totalDays = parseInt(nutriBilanPeriod);
  const adherencePct = totalDays > 0 ? Math.round((completedDays.length / totalDays) * 100) : 0;
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const pctFn = (val: number, target: number) => target > 0 ? Math.round((val / target) * 100) : 0;
  const avgKcal = avg(completedDays.map((d: any) => d.kcal));
  const kcalDiff = avgKcal - obj.kcal;
  const avgProt = avg(completedDays.map((d: any) => d.protein));
  const avgCarbs = avg(completedDays.map((d: any) => d.carbs));
  const avgFat = avg(completedDays.map((d: any) => d.fat));
  const protPct = pctFn(avgProt, obj.protein);
  const carbsPct = pctFn(avgCarbs, obj.carbs);
  const fatPct = pctFn(avgFat, obj.fat);
  const lowProtDays = completedDays.filter((d: any) => d.protein < obj.protein * 0.8).length;
  const maxKcal = Math.max(...completedDays.map((d: any) => d.kcal), obj.kcal * 1.2, 1);
  const fmtD = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const fmtDs = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }).slice(0, 5);
  const latestM = nutriMeasures.length > 0 ? nutriMeasures[nutriMeasures.length - 1] : null;
  const prevM = nutriMeasures.length > 1 ? nutriMeasures[0] : null;
  const wDiff = latestM && prevM && latestM.weight && prevM.weight ? +((latestM.weight - prevM.weight).toFixed(1)) : null;
  const bfDiff = latestM && prevM && latestM.bodyFat && prevM.bodyFat ? +((latestM.bodyFat - prevM.bodyFat).toFixed(1)) : null;
  const waDiff = latestM && prevM && latestM.waist && prevM.waist ? +((latestM.waist - prevM.waist).toFixed(1)) : null;
  const GOAL_LABELS: Record<string, string> = { seche: "Sèche", prise_masse: "Prise de masse", recomposition: "Recomposition", sante: "Santé / équilibre" };
  const SEV_MAP: Record<string, { label: string; color: string }> = { leger: { label: "Léger", color: "#f59e0b" }, modere: { label: "Modéré", color: "#f97316" }, critique: { label: "Critique", color: "#ef4444" } };
  const ALERT_TYPE_MAP: Record<string, { label: string; color: string }> = { alert: { label: "Alerte", color: "#ef4444" }, info: { label: "Info", color: "#3b82f6" }, success: { label: "Succès", color: "#22c55e" } };
  const filteredAlerts = nutriAlerts
    .filter((a: any) => alertTypeFilter === "all" || a.type === alertTypeFilter)
    .filter((a: any) => alertStatusFilter === "all" || a.status === alertStatusFilter);

  return (
    <section className={styles.tabContent}>
      <div className={styles.nutriBilanSection} style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
        <div className={styles.nutriBilanHeader}>
          <h3 className={styles.nutriBilanTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            Mon Bilan
          </h3>
          <div className={styles.nutriBilanPeriods}>
            {[{ v: "7", l: "7j" }, { v: "30", l: "30j" }, { v: "90", l: "90j" }].map((p) => (
              <button key={p.v} className={`${styles.nutriBilanPeriodBtn} ${nutriBilanPeriod === p.v ? styles.nutriBilanPeriodActive : ""}`} onClick={() => setNutriBilanPeriod(p.v)}>{p.l}</button>
            ))}
          </div>
        </div>

        <div className={styles.nutriGoalBadge}>{GOAL_LABELS[obj.goal] || obj.goal}</div>

        {activePlan && (
          <div className={styles.nutriPlanBanner}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <div className={styles.nutriPlanBannerInfo}>
              <div className={styles.nutriPlanBannerName}>{activePlan.name} <span className={styles.nutriPlanBannerVersion}>v{activePlan.version}</span></div>
              <div className={styles.nutriPlanBannerMeta}>
                <span className={styles.nutriPlanDot} style={{ background: activePlan.status === "publie" ? "#22c55e" : "#3b82f6" }} />
                {activePlan.status === "publie" ? "Publié" : "En cours"}
              </div>
            </div>
          </div>
        )}

        <div className={styles.nutriObjGrid}>
          {[
            { label: "Kcal cible", value: `${obj.kcal} kcal/j`, icon: "M12 12c-2-2.67-4-4-4-6a4 4 0 0 1 8 0c0 2-2 3.33-4 6z M12 21a8 8 0 0 0 4-14.93 M12 21a8 8 0 0 1-4-14.93", color: "#f97316" },
            { label: "Protéines", value: `${obj.protein}g/j`, icon: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z M12 2a7 7 0 0 1 0 14", color: "#ef4444" },
            { label: "Glucides", value: `${obj.carbs}g/j`, icon: "M2 12h20 M12 2v20 M6 6h12v12H6z", color: "#3b82f6" },
            { label: "Lipides", value: `${obj.fat}g/j`, icon: "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z", color: "#f59e0b" },
            { label: "Hydratation", value: `${obj.water}L/j`, icon: "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z", color: "#06b6d4" },
            { label: "Rythme", value: `${obj.weeklyRate > 0 ? "+" : ""}${obj.weeklyRate} kg/sem`, icon: "M22 12h-4l-3 9L9 3l-3 9H2", color: "#8b5cf6" },
          ].map((o) => (
            <div key={o.label} className={styles.nutriObjCardAthlete}>
              <span className={styles.nutriObjIconSvg} style={{ background: `${o.color}15`, color: o.color }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={o.icon} /></svg>
              </span>
              <div>
                <div className={styles.nutriObjLabelAthlete}>{o.label}</div>
                <div className={styles.nutriObjValueAthlete}>{o.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.nutriKpiGrid}>
          <div className={styles.nutriKpiCard}>
            <div className={styles.nutriKpiIcon} style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className={styles.nutriKpiContent}>
              <div className={styles.nutriKpiLabel}>Adhérence</div>
              <div className={styles.nutriKpiValue}>{adherencePct}%</div>
              <div className={styles.nutriKpiSub}>{completedDays.length}/{totalDays} jours remplis</div>
            </div>
            <div className={styles.nutriKpiBar}><div className={styles.nutriKpiFill} style={{ width: `${adherencePct}%`, background: adherencePct >= 80 ? "#22c55e" : adherencePct >= 50 ? "#f59e0b" : "#ef4444" }} /></div>
          </div>

          <div className={styles.nutriKpiCard}>
            <div className={styles.nutriKpiIcon} style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
            </div>
            <div className={styles.nutriKpiContent}>
              <div className={styles.nutriKpiLabel}>Apports moyens</div>
              <div className={styles.nutriKpiValue}>{avgKcal} <span>kcal/j</span></div>
              <div className={styles.nutriKpiSub} style={{ color: completedDays.length === 0 ? undefined : kcalDiff > 0 ? "#f59e0b" : "#22c55e" }}>
                {completedDays.length === 0 ? "Aucune donnée" : `${kcalDiff > 0 ? "+" : ""}${kcalDiff} kcal vs objectif`}
              </div>
            </div>
            <div className={styles.nutriKpiBar}><div className={styles.nutriKpiFill} style={{ width: `${Math.min(pctFn(avgKcal, obj.kcal), 100)}%`, background: "#f97316" }} /></div>
          </div>

          <div className={styles.nutriKpiCard}>
            <div className={styles.nutriKpiIcon} style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="10" /><path d="M12 2a7 7 0 0 1 0 14" /></svg>
            </div>
            <div className={styles.nutriKpiContent}>
              <div className={styles.nutriKpiLabel}>Macros</div>
              {completedDays.length === 0 ? (
                <div className={styles.nutriKpiSub}>Aucune donnée</div>
              ) : (
                <>
                  <div className={styles.nutriKpiMacros}>
                    <span><b>P</b> {avgProt}g ({protPct}%)</span>
                    <span><b>G</b> {avgCarbs}g ({carbsPct}%)</span>
                    <span><b>L</b> {avgFat}g ({fatPct}%)</span>
                  </div>
                  {lowProtDays > 0 && <div className={styles.nutriKpiSub} style={{ color: "#f59e0b" }}>Prot. insuffisantes {lowProtDays}/{completedDays.length}j</div>}
                </>
              )}
            </div>
          </div>

          <div className={styles.nutriKpiCard}>
            <div className={styles.nutriKpiIcon} style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <div className={styles.nutriKpiContent}>
              <div className={styles.nutriKpiLabel}>Tendance</div>
              {nutriMeasures.length < 2 ? (
                <div className={styles.nutriKpiSub}>Pas assez de mesures</div>
              ) : (
                <div className={styles.nutriKpiTrends}>
                  {wDiff !== null && <span>Poids : {wDiff > 0 ? "+" : ""}{wDiff} kg</span>}
                  {bfDiff !== null && <span>MG : {bfDiff > 0 ? "+" : ""}{bfDiff} pts</span>}
                  {waDiff !== null && <span>Taille : {waDiff > 0 ? "+" : ""}{waDiff} cm</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {completedDays.length > 0 && (
          <div className={styles.nutriChartCard}>
            <h4 className={styles.nutriChartLabel}>Calories / jour</h4>
            <div className={styles.nutriKcalChart}>
              <div className={styles.nutriKcalTarget} style={{ bottom: `${(obj.kcal / maxKcal) * 100}%` }}>
                <span className={styles.nutriKcalTargetLabel}>{obj.kcal} kcal</span>
              </div>
              <div className={styles.nutriKcalBars}>
                {nutriJournal.map((d: any, i: number) => {
                  const h = d.completed ? (d.kcal / maxKcal) * 100 : 0;
                  const isLow = d.completed && d.kcal < obj.kcal * 0.7;
                  const isHigh = d.completed && d.kcal > obj.kcal * 1.2;
                  return (
                    <div key={i} className={styles.nutriKcalBarWrap} title={`${fmtD(d.date)}: ${d.kcal} kcal`}>
                      <div className={`${styles.nutriKcalBar} ${isLow ? styles.nutriKcalBarLow : isHigh ? styles.nutriKcalBarHigh : ""}`} style={{ height: `${h}%` }} />
                      <span className={styles.nutriKcalBarLabel}>{fmtDs(d.date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {completedDays.length > 0 && (
          <div className={styles.nutriMacrosGrid}>
            {[
              { label: "Protéines", avg: avgProt, target: obj.protein, color: "#ef4444", pv: protPct },
              { label: "Glucides", avg: avgCarbs, target: obj.carbs, color: "#3b82f6", pv: carbsPct },
              { label: "Lipides", avg: avgFat, target: obj.fat, color: "#f59e0b", pv: fatPct },
            ].map((m) => (
              <div key={m.label} className={styles.nutriMacroCard}>
                <div className={styles.nutriMacroHeader}>
                  <span className={styles.nutriMacroName}>{m.label}</span>
                  <span className={styles.nutriMacroPct} style={{ color: m.pv >= 80 && m.pv <= 120 ? "#22c55e" : m.color }}>{m.pv}%</span>
                </div>
                <div className={styles.nutriMacroBarOuter}>
                  <div className={styles.nutriMacroBarInner} style={{ width: `${Math.min(m.pv, 100)}%`, background: m.color }} />
                </div>
                <div className={styles.nutriMacroValues}>
                  <span>{m.avg}g moy.</span>
                  <span className={styles.nutriMacroTarget}>obj. {m.target}g</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.nutriBodySection}>
          <div className={styles.nutriBodyHeader}>
            <h4 className={styles.nutriChartLabel}>Composition corporelle</h4>
            <button className={styles.nutriBodyAddBtn} onClick={() => setShowAddMeasure(true)}>+ Ajouter mesure</button>
          </div>
          {latestM ? (
            <>
              <div className={styles.nutriBodyGrid}>
                {[
                  { label: "Poids", value: latestM.weight, unit: "kg", diff: wDiff, tag: wDiff !== null ? (Math.abs(wDiff) < 0.5 ? "stable" : wDiff < 0 && obj.goal === "seche" ? "tendance favorable" : wDiff > 0 && obj.goal === "prise_masse" ? "tendance favorable" : "signal à surveiller") : null },
                  { label: "IMC", value: latestM.bmi, unit: "", diff: null, tag: latestM.bmi ? (latestM.bmi < 25 ? "normal" : "surpoids") : null },
                  { label: "Tour de taille", value: latestM.waist, unit: "cm", diff: waDiff, tag: waDiff !== null ? (waDiff <= 0 ? "tendance favorable" : "signal à surveiller") : null },
                  { label: "Hydratation", value: latestM.hydration, unit: "%", diff: null, tag: latestM.hydration ? (latestM.hydration >= 55 ? "correct" : "insuffisant") : null },
                  { label: "Masse grasse", value: latestM.bodyFat, unit: "%", diff: bfDiff, tag: bfDiff !== null ? (bfDiff <= 0 ? "tendance favorable" : "signal à surveiller") : null },
                ].map((item) => (
                  <div key={item.label} className={styles.nutriBodyCard}>
                    <div className={styles.nutriBodyLabel}>{item.label}</div>
                    <div className={styles.nutriBodyValue}>{item.value ?? "—"}<span>{item.unit}</span></div>
                    {item.diff !== null && (
                      <div className={styles.nutriBodyDiff} style={{ color: item.diff <= 0 ? "#22c55e" : "#f59e0b" }}>
                        {item.diff > 0 ? "+" : ""}{item.diff}{item.unit}
                      </div>
                    )}
                    {item.tag && (
                      <span className={`${styles.nutriBodyTag} ${item.tag === "tendance favorable" || item.tag === "normal" || item.tag === "correct" || item.tag === "stable" ? styles.nutriBodyTagGood : styles.nutriBodyTagWarn}`}>
                        {item.tag}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles.nutriBodyMeta}>
                Dernière mesure : {fmtD(latestM.date)} · Source : {latestM.source === "athlete" ? "Auto-saisie" : latestM.source === "balance" ? "Balance connectée" : latestM.source === "manual" ? "Pro" : latestM.source}
              </div>
            </>
          ) : (
            <div className={styles.nutriEvoEmpty}>Aucune mesure — cliquez « + Ajouter mesure » pour commencer</div>
          )}
        </div>

        {showAddMeasure && (
          <div className={styles.nutriMeasureOverlay} onClick={() => setShowAddMeasure(false)}>
            <div className={styles.nutriMeasureModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.nutriMeasureModalHeader}>
                <h4>Ajouter une mesure</h4>
                <button className={styles.nutriMeasureModalClose} onClick={() => setShowAddMeasure(false)}>×</button>
              </div>
              <div className={styles.nutriMeasureModalBody}>
                <div className={styles.nutriMeasureField}>
                  <label>Poids (kg)</label>
                  <input type="number" step="0.1" placeholder="Ex: 72.5" value={mWeight} onChange={(e) => setMWeight(e.target.value)} />
                </div>
                <div className={styles.nutriMeasureField}>
                  <label>Tour de taille (cm)</label>
                  <input type="number" step="0.1" placeholder="Ex: 82" value={mWaist} onChange={(e) => setMWaist(e.target.value)} />
                </div>
                <div className={styles.nutriMeasureField}>
                  <label>Hydratation (%)</label>
                  <input type="number" step="0.1" placeholder="Ex: 58" value={mHydration} onChange={(e) => setMHydration(e.target.value)} />
                </div>
              </div>
              <div className={styles.nutriMeasureModalFooter}>
                <button className={styles.nutriMeasureCancelBtn} onClick={() => setShowAddMeasure(false)}>Annuler</button>
                <button className={styles.nutriMeasureSaveBtn} disabled={mSaving || (!mWeight && !mWaist && !mHydration)} onClick={handleAddMeasure}>
                  {mSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Évolutions ── */}
        {nutriMeasures.length >= 2 && (() => {
          const evoGraphs = [
            { title: "Poids (kg)", key: "weight" as const, unit: "kg" },
            { title: "Masse grasse (%)", key: "bodyFat" as const, unit: "%" },
            { title: "Tour de taille (cm)", key: "waist" as const, unit: "cm" },
          ];
          const g = evoGraphs[evoSlide];
          const vals = nutriMeasures
            .map((m: any) => ({ date: m.date, val: m[g.key] as number | null }))
            .filter((v): v is { date: string; val: number } => v.val !== null);
          return (
            <div className={styles.nutriEvoSection}>
              <div className={styles.nutriEvoHeader}>
                <h4 className={styles.nutriChartLabel}>Évolutions</h4>
                <div className={styles.nutriEvoNav}>
                  {evoGraphs.map((eg, i) => (
                    <button key={i} className={`${styles.nutriEvoNavBtn} ${evoSlide === i ? styles.nutriEvoNavActive : ""}`} onClick={() => setEvoSlide(i)}>{eg.title}</button>
                  ))}
                </div>
              </div>
              {vals.length < 2 ? (
                <div className={styles.nutriEvoEmpty}>Pas assez de mesures pour {g.title.toLowerCase()}</div>
              ) : (() => {
                const minV = Math.min(...vals.map(v => v.val)) * 0.98;
                const maxV = Math.max(...vals.map(v => v.val)) * 1.02;
                const range = maxV - minV || 1;
                const points = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - ((v.val - minV) / range) * 80}`).join(" ");
                const first = vals[0].val;
                const last = vals[vals.length - 1].val;
                const diff = +(last - first).toFixed(1);
                return (
                  <div className={styles.nutriEvoCard}>
                    <div className={styles.nutriEvoMeta}>
                      <span className={styles.nutriEvoLast}>{last} {g.unit}</span>
                      <span className={styles.nutriEvoDiff} style={{ color: diff <= 0 ? "#22c55e" : "#f59e0b" }}>{diff > 0 ? "+" : ""}{diff} {g.unit}</span>
                      <span className={styles.nutriEvoPeriod}>sur {vals.length} mesures</span>
                    </div>
                    <svg className={styles.nutriEvoSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline points={points} fill="none" stroke="#f97316" strokeWidth="1.5" />
                      {vals.map((v, i) => (
                        <circle key={i} cx={(i / (vals.length - 1)) * 100} cy={100 - ((v.val - minV) / range) * 80} r="1.5" fill="#f97316" />
                      ))}
                    </svg>
                    <div className={styles.nutriEvoLabels}>
                      <span>{fmtD(vals[0].date)}</span>
                      <span>{fmtD(vals[vals.length - 1].date)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {nutriAlerts.length > 0 && (
          <div className={styles.nutriAlertSection}>
            <h4 className={styles.nutriChartLabel}>Alertes</h4>
            <div className={styles.nutriAlertFilters}>
              <div className={styles.nutriAlertFilterGroup}>
                {(["all", "alert", "info", "success"] as const).map((f) => (
                  <button key={f} className={`${styles.nutriAlertFilterBtn} ${alertTypeFilter === f ? styles.nutriAlertFilterActive : ""}`} onClick={() => setAlertTypeFilter(f)}>
                    {f === "all" ? "Toutes" : ALERT_TYPE_MAP[f]?.label}
                  </button>
                ))}
              </div>
              <div className={styles.nutriAlertFilterGroup}>
                {(["all", "unread", "to_treat", "closed"] as const).map((f) => (
                  <button key={f} className={`${styles.nutriAlertFilterBtn} ${alertStatusFilter === f ? styles.nutriAlertFilterActive : ""}`} onClick={() => setAlertStatusFilter(f)}>
                    {f === "all" ? "Tous" : f === "unread" ? "Non lues" : f === "to_treat" ? "À traiter" : "Clôturées"}
                  </button>
                ))}
              </div>
            </div>
            {filteredAlerts.length === 0 ? (
              <div className={styles.nutriEvoEmpty}>Aucune alerte pour ces filtres</div>
            ) : (
              <div className={styles.nutriAlertList}>
                {filteredAlerts.map((a: any) => (
                  <div key={a.id} className={`${styles.nutriAlertItem} ${openAlertId === a.id ? styles.nutriAlertItemOpen : ""}`} onClick={() => setOpenAlertId(openAlertId === a.id ? null : a.id)}>
                    <div className={styles.nutriAlertHead}>
                      <span className={styles.nutriAlertDot} style={{ background: ALERT_TYPE_MAP[a.type]?.color || "#94a3b8" }} />
                      <div className={styles.nutriAlertInfo}>
                        <div className={styles.nutriAlertTitle}>{a.title}</div>
                        <div className={styles.nutriAlertMeta}>
                          {a.status === "unread" ? "Non lue" : a.status === "to_treat" ? "À traiter" : "Clôturée"} · {a.origin === "auto" ? "Auto" : "Manuel"} · {fmtD(a.createdAt)}
                        </div>
                      </div>
                      <span className={styles.nutriAlertSeverityBadge} style={{ background: `${SEV_MAP[a.severity]?.color || "#94a3b8"}18`, color: SEV_MAP[a.severity]?.color || "#94a3b8", borderColor: `${SEV_MAP[a.severity]?.color || "#94a3b8"}40` }}>
                        {SEV_MAP[a.severity]?.label || a.severity}
                      </span>
                    </div>
                    {openAlertId === a.id && (
                      <div className={styles.nutriAlertDetail} onClick={(e) => e.stopPropagation()}>
                        {a.description && <p className={styles.nutriAlertDesc}>{a.description}</p>}
                        {a.action && <div className={styles.nutriAlertAction}>Action recommandée : {a.action}</div>}
                        {a.closedNote && <div className={styles.nutriAlertClosed}>Clôturé : {a.closedNote}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {nutriNotes.length > 0 && (
          <div className={styles.nutriNotesSection}>
            <h4 className={styles.nutriChartLabel}>Notes de consultation <span className={styles.nutriNotesCount}>{nutriNotes.length}</span></h4>
            <div className={styles.nutriNotesList}>
              {nutriNotes.map((n: any, i: number) => {
                const prev = i > 0 ? nutriNotes[i - 1] : null;
                const showSep = !prev || new Date(prev.date).getMonth() !== new Date(n.date).getMonth();
                return (
                  <div key={n.id}>
                    {showSep && <div className={styles.nutriNoteSeparator}>{new Date(n.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</div>}
                    <div className={styles.nutriNoteCard}>
                      <div className={styles.nutriNoteDate}>{fmtD(n.date)}</div>
                      <div className={styles.nutriNoteBody}>
                        {n.notePatient && <p>{n.notePatient}</p>}
                        {!n.notePatient && <p className={styles.nutriNoteEmpty}>Aucune note visible</p>}
                        {n.focus && <span className={styles.nutriNoteFocusBadge}>{n.focus}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* ── Journal alimentaire ── */}
        <div className={styles.nutriJournalSection}>
          <div className={styles.nutriJournalHeader}>
            <h4 className={styles.nutriChartLabel}>Journal alimentaire</h4>
            <button className={styles.nutriBodyAddBtn} onClick={() => setShowJournalForm(true)}>+ Saisir aujourd&apos;hui</button>
          </div>
          {nutriJournal.length === 0 ? (
            <div className={styles.nutriEvoEmpty}>Aucune saisie sur cette période</div>
          ) : (
            <div className={styles.nutriJournalTable}>
              <div className={styles.nutriJournalRow + " " + styles.nutriJournalRowHead}>
                <span>Date</span><span>Kcal</span><span>Prot</span><span>Gluc</span><span>Lip</span><span>Eau</span><span></span>
              </div>
              {nutriJournal.map((d: any) => (
                <div key={d.date} className={`${styles.nutriJournalRow} ${d.completed ? styles.nutriJournalRowDone : ""}`}>
                  <span>{fmtD(d.date)}</span>
                  <span>{d.kcal}</span>
                  <span>{d.protein}g</span>
                  <span>{d.carbs}g</span>
                  <span>{d.fat}g</span>
                  <span>{d.water}L</span>
                  <span className={styles.nutriJournalCheck}>{d.completed ? "\u2713" : "\u2014"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {showJournalForm && (
          <div className={styles.nutriMeasureOverlay} onClick={() => setShowJournalForm(false)}>
            <div className={styles.nutriMeasureModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.nutriMeasureModalHeader}>
                <h4>Saisie du jour</h4>
                <button className={styles.nutriMeasureModalClose} onClick={() => setShowJournalForm(false)}>\u00d7</button>
              </div>
              <div className={styles.nutriMeasureModalBody}>
                <div className={styles.nutriJournalFormGrid}>
                  <div className={styles.nutriMeasureField}>
                    <label>Kcal</label>
                    <input type="number" placeholder="Ex: 2100" value={jKcal} onChange={(e) => setJKcal(e.target.value)} />
                  </div>
                  <div className={styles.nutriMeasureField}>
                    <label>Protéines (g)</label>
                    <input type="number" placeholder="Ex: 120" value={jProt} onChange={(e) => setJProt(e.target.value)} />
                  </div>
                  <div className={styles.nutriMeasureField}>
                    <label>Glucides (g)</label>
                    <input type="number" placeholder="Ex: 250" value={jCarbs} onChange={(e) => setJCarbs(e.target.value)} />
                  </div>
                  <div className={styles.nutriMeasureField}>
                    <label>Lipides (g)</label>
                    <input type="number" placeholder="Ex: 70" value={jFat} onChange={(e) => setJFat(e.target.value)} />
                  </div>
                  <div className={styles.nutriMeasureField}>
                    <label>Eau (L)</label>
                    <input type="number" step="0.1" placeholder="Ex: 2.0" value={jWater} onChange={(e) => setJWater(e.target.value)} />
                  </div>
                </div>
                <label className={styles.nutriJournalCheck}>
                  <input type="checkbox" checked={jCompleted} onChange={(e) => setJCompleted(e.target.checked)} />
                  Journée complétée
                </label>
              </div>
              <div className={styles.nutriMeasureModalFooter}>
                <button className={styles.nutriMeasureCancelBtn} onClick={() => setShowJournalForm(false)}>Annuler</button>
                <button className={styles.nutriMeasureSaveBtn} disabled={jSaving} onClick={handleSaveEntry}>
                  {jSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
