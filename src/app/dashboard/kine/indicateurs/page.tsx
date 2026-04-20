"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

/* ─── Types ─── */
interface AthleteOption { id: string; name: string; sport: string | null; status: string }
interface VideoRef { id: string; title: string; thumbnail: string | null; category: string; url: string }
interface PlanExercise {
  id: string; position: number; sets: number | null; reps: string | null;
  duration: string | null; tempo: string | null; rest: string | null;
  frequency: string | null; painThreshold: number | null; consignes: string | null;
  equipment: string | null; alternative: string | null; video: VideoRef;
}
interface Plan {
  id: string; title: string; objective: string | null; pathology: string | null;
  phase: string | null; globalProgress: number | null;
  notesPro: string | null; notesPatient: string | null;
  startDate: string | null; endDate: string | null; frequency: string | null;
  nextRdvDate: string | null; nextRdvTime: string | null; nextRdvLocation: string | null;
  status: string; isTemplate: boolean; templateName: string | null;
  conclusion: string | null; outcomeScore: number | null;
  athlete: { id: string; name: string } | null;
  exercises: PlanExercise[];
  _count?: { logs: number };
  createdAt: string; updatedAt: string;
}
interface Alert {
  id: string; type: string; status: string; origin: string;
  title: string; description: string | null; detail: string | null;
  intensity: number | null; clinicalNote: string | null; closedAt: string | null;
  athlete: { id: string; name: string }; plan: { id: string; title: string } | null;
  createdAt: string; updatedAt: string;
}
interface AlertRule {
  id: string; ruleType: string; threshold: number; thresholdDays: number | null;
  active: boolean;
}

/* ─── Constants ─── */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  active: { label: "En cours", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  paused: { label: "Pause", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  completed: { label: "Terminé", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  archived: { label: "Archivé", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};
const ALERT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  alert: { label: "Alerte", color: "#ef4444" },
  info: { label: "Info", color: "#3b82f6" },
  success: { label: "Succès", color: "#22c55e" },
};
const ALERT_STATUS_MAP: Record<string, string> = { unread: "Non lue", to_treat: "À traiter", closed: "Clôturée" };
const ORIGIN_MAP: Record<string, string> = { patient: "Patient", sensor: "Capteur", kine: "Kiné", auto: "Règle auto" };
const RULE_TYPE_MAP: Record<string, string> = {
  pain_threshold: "Douleur > seuil sur X jours",
  adherence_low: "Adhérence < seuil %",
  no_feedback: "Aucun retour depuis X jours",
  stagnation: "Progression stagnante",
};

/* ─── Component ─── */
export default function SuiviPage() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [tab, setTab] = useState<"programme" | "alertes" | "historique">("programme");
  const [loading, setLoading] = useState(false);

  // Section 1: Programme actuel
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localProgress, setLocalProgress] = useState<number | null>(null);

  // Section 2: Alertes
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertFilter, setAlertFilter] = useState<string>("");
  const [alertTypeFilter, setAlertTypeFilter] = useState<string>("");
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>("");
  const [openAlert, setOpenAlert] = useState<Alert | null>(null);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [showRules, setShowRules] = useState(false);

  // Section 3: Historique
  const [history, setHistory] = useState<Plan[]>([]);
  const [openHistory, setOpenHistory] = useState<Plan | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeConclusion, setCloseConclusion] = useState("");
  const [closeScore, setCloseScore] = useState("");

  const selectedAthlete = athletes.find(a => a.id === athleteId);

  // Fetch athletes
  useEffect(() => {
    fetch("/api/athletes?status=active").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAthletes(d); }).catch(() => {});
  }, []);

  // Fetch active plans for athlete
  const fetchPlans = useCallback(() => {
    if (!athleteId) { setPlans([]); setActivePlan(null); return; }
    setLoading(true);
    fetch(`/api/kine/plans?athleteId=${athleteId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          const active = d.filter((p: Plan) => p.status === "active" || p.status === "draft" || p.status === "paused");
          setPlans(active);
          if (active.length > 0 && (!activePlan || !active.find((p: Plan) => p.id === activePlan.id))) {
            setActivePlan(active[0]);
          } else if (activePlan) {
            const updated = active.find((p: Plan) => p.id === activePlan.id);
            if (updated) setActivePlan(updated);
          }
        }
      }).catch(() => {}).finally(() => setLoading(false));
  }, [athleteId]);

  // Fetch history (completed/archived)
  const fetchHistory = useCallback(() => {
    if (!athleteId) { setHistory([]); return; }
    fetch(`/api/kine/plans?athleteId=${athleteId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setHistory(d.filter((p: Plan) => p.status === "completed" || p.status === "archived"));
        }
      }).catch(() => {});
  }, [athleteId]);

  // Fetch alerts
  const fetchAlerts = useCallback(() => {
    if (!athleteId) { setAlerts([]); return; }
    const p = new URLSearchParams({ athleteId });
    if (alertTypeFilter) p.set("type", alertTypeFilter);
    if (alertStatusFilter) p.set("status", alertStatusFilter);
    fetch(`/api/kine/alerts?${p}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAlerts(d); }).catch(() => {});
  }, [athleteId, alertTypeFilter, alertStatusFilter]);

  // Fetch alert rules
  const fetchRules = useCallback(() => {
    fetch("/api/kine/alert-rules").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAlertRules(d); }).catch(() => {});
  }, []);

  useEffect(() => { fetchPlans(); fetchHistory(); }, [fetchPlans, fetchHistory]);
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => { fetchRules(); }, [fetchRules]);

  /* ─── Helpers ─── */
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const fmtDateTime = (d: string | null, t: string | null) => {
    if (!d) return "—";
    const date = fmtDate(d);
    return t ? `${date} à ${t}` : date;
  };
  const weeksBetween = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  };

  /* ─── Plan Actions ─── */
  const updatePlan = async (planId: string, data: Record<string, unknown>) => {
    await fetch(`/api/kine/plans/${planId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchPlans(); fetchHistory();
  };

  const saveField = async (field: string) => {
    if (!activePlan) return;
    await updatePlan(activePlan.id, { [field]: editValue });
    setEditField(null);
  };

  const closePlan = async () => {
    if (!activePlan) return;
    await updatePlan(activePlan.id, {
      status: "completed",
      conclusion: closeConclusion || null,
      outcomeScore: closeScore ? parseInt(closeScore) : null,
    });
    setShowCloseModal(false);
    setCloseConclusion("");
    setCloseScore("");
    setActivePlan(null);
  };

  /* ─── Alert Actions ─── */
  const updateAlert = async (alertId: string, data: Record<string, unknown>) => {
    await fetch(`/api/kine/alerts/${alertId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchAlerts();
  };

  const createAlert = async (data: Record<string, unknown>) => {
    await fetch("/api/kine/alerts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, athleteId }),
    });
    fetchAlerts();
  };

  const deleteAlert = async (alertId: string) => {
    await fetch(`/api/kine/alerts/${alertId}`, { method: "DELETE" });
    fetchAlerts();
  };

  /* ─── Rule Actions ─── */
  const toggleRule = async (rule: AlertRule) => {
    await fetch("/api/kine/alert-rules", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, active: !rule.active }),
    });
    fetchRules();
  };

  const upsertRule = async (ruleType: string, threshold: number, thresholdDays: number) => {
    await fetch("/api/kine/alert-rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleType, threshold, thresholdDays }),
    });
    fetchRules();
  };

  const reuseAsTemplate = async (plan: Plan) => {
    await fetch("/api/kine/plans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: plan.title, duplicateFromId: plan.id, isTemplate: true, templateName: plan.title }),
    });
  };

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Bilans &amp; Suivi</h1>
        <div className={styles.headerControls}>
          <select className={styles.selectField} value={athleteId} onChange={e => { setAthleteId(e.target.value); setActivePlan(null); setOpenHistory(null); setOpenAlert(null); }}>
            <option value="">Sélectionner un patient</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {selectedAthlete && (
        <div className={styles.patientBanner}>
          <div className={styles.patientName}>{selectedAthlete.name}</div>
          <div className={styles.patientMeta}>{selectedAthlete.sport || "Kinésithérapie"} · {selectedAthlete.status === "active" ? "Suivi actif" : selectedAthlete.status}</div>
        </div>
      )}

      {!athleteId && (
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <p>Sélectionnez un patient pour voir son suivi</p>
        </div>
      )}

      {athleteId && (
        <>
          {/* ── Tabs ── */}
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === "programme" ? styles.tabActive : ""}`} onClick={() => setTab("programme")}>Programme actuel</button>
            <button className={`${styles.tab} ${tab === "alertes" ? styles.tabActive : ""}`} onClick={() => setTab("alertes")}>Journal d&apos;alertes {alerts.filter(a => a.status !== "closed").length > 0 && <span className={styles.tabBadge}>{alerts.filter(a => a.status !== "closed").length}</span>}</button>
            <button className={`${styles.tab} ${tab === "historique" ? styles.tabActive : ""}`} onClick={() => setTab("historique")}>Historique</button>
          </div>

          {/* ═══════ TAB 1: PROGRAMME ACTUEL ═══════ */}
          {tab === "programme" && (
            <div className={styles.section}>
              {loading ? <p className={styles.loadingText}>Chargement...</p> : plans.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>
                  <p>Aucun programme en cours pour ce patient</p>
                  <button className={styles.btnPrimary} onClick={() => router.push(`/dashboard/kine/programmes`)}>Créer un programme</button>
                </div>
              ) : (
                <>
                  {/* Plan selector if multiple */}
                  {plans.length > 1 && (
                    <div className={styles.planSelector}>
                      {plans.map(p => (
                        <button key={p.id} className={`${styles.planSelectorBtn} ${activePlan?.id === p.id ? styles.planSelectorActive : ""}`} onClick={() => setActivePlan(p)}>
                          {p.title}
                          <span className={styles.badge} style={{ color: STATUS_MAP[p.status]?.color, borderColor: STATUS_MAP[p.status]?.color, background: STATUS_MAP[p.status]?.bg }}>{STATUS_MAP[p.status]?.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {activePlan && (
                    <>
                      {/* A) Header patient + contexte */}
                      <div className={styles.card}>
                        <div className={styles.cardHeader}>
                          <div>
                            <h2 className={styles.cardTitle}>{activePlan.title}</h2>
                            <div className={styles.cardSubtitle}>
                              {activePlan.pathology && <span className={styles.chipOrange}>{activePlan.pathology}</span>}
                              <span className={styles.badge} style={{ color: STATUS_MAP[activePlan.status]?.color, borderColor: STATUS_MAP[activePlan.status]?.color, background: STATUS_MAP[activePlan.status]?.bg }}>{STATUS_MAP[activePlan.status]?.label}</span>
                              {activePlan.phase && <span className={styles.chipPhase}>{activePlan.phase}</span>}
                            </div>
                          </div>
                          <div className={styles.progressBlock}>
                            <div className={styles.progressLabel}>Progression</div>
                            <div className={styles.progressBar}>
                              <div className={styles.progressFill} style={{ width: `${localProgress !== null ? localProgress : (activePlan.globalProgress || 0)}%` }} />
                            </div>
                            <div className={styles.progressValue}>{localProgress !== null ? localProgress : (activePlan.globalProgress || 0)}%</div>
                            <div className={styles.progressActions}>
                              <input type="range" min="0" max="100" value={localProgress !== null ? localProgress : (activePlan.globalProgress || 0)} onChange={e => setLocalProgress(parseInt(e.target.value))} onPointerUp={() => { if (localProgress !== null) { updatePlan(activePlan.id, { globalProgress: localProgress }); setLocalProgress(null); } }} onTouchEnd={() => { if (localProgress !== null) { updatePlan(activePlan.id, { globalProgress: localProgress }); setLocalProgress(null); } }} className={styles.rangeInput} />
                            </div>
                          </div>
                        </div>

                        {/* Editable fields row */}
                        <div className={styles.infoGrid}>
                          {[
                            { key: "pathology", label: "Pathologie / motif", value: activePlan.pathology },
                            { key: "phase", label: "Phase actuelle", value: activePlan.phase },
                            { key: "objective", label: "Objectif", value: activePlan.objective },
                            { key: "frequency", label: "Fréquence", value: activePlan.frequency },
                          ].map(f => (
                            <div key={f.key} className={styles.infoItem}>
                              <div className={styles.infoLabel}>{f.label}</div>
                              {editField === f.key ? (
                                <div className={styles.inlineEdit}>
                                  <input value={editValue} onChange={e => setEditValue(e.target.value)} className={styles.inlineInput} autoFocus onKeyDown={e => e.key === "Enter" && saveField(f.key)} />
                                  <button className={styles.btnSmall} onClick={() => saveField(f.key)}>✓</button>
                                  <button className={styles.btnSmallMuted} onClick={() => setEditField(null)}>✕</button>
                                </div>
                              ) : (
                                <div className={styles.infoValue} onClick={() => { setEditField(f.key); setEditValue(f.value || ""); }}>
                                  {f.value || <span className={styles.muted}>Cliquer pour définir</span>}
                                  <span className={styles.editIcon}>✎</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* B) Cartes cadre du programme */}
                      <div className={styles.frameGrid}>
                        <div className={styles.frameCard}>
                          <div className={styles.frameLabel}>Début programme</div>
                          <div className={styles.frameValue}>{fmtDate(activePlan.startDate)}</div>
                        </div>
                        <div className={styles.frameCard}>
                          <div className={styles.frameLabel}>Fin prévue</div>
                          <div className={styles.frameValue}>{fmtDate(activePlan.endDate)}</div>
                          {activePlan.startDate && activePlan.endDate && (
                            <div className={styles.frameSub}>{weeksBetween(activePlan.startDate, activePlan.endDate)} semaines</div>
                          )}
                        </div>
                        <div className={styles.frameCard}>
                          <div className={styles.frameLabel}>Prochain RDV</div>
                          <div className={styles.frameValue}>{fmtDateTime(activePlan.nextRdvDate, activePlan.nextRdvTime)}</div>
                          {activePlan.nextRdvLocation && <div className={styles.frameSub}>{activePlan.nextRdvLocation}</div>}
                          <button className={styles.btnSmall} style={{ marginTop: 8 }} onClick={() => { setEditField("nextRdv"); setEditValue(""); }}>Planifier / modifier</button>
                        </div>
                      </div>

                      {/* RDV Edit inline */}
                      {editField === "nextRdv" && (
                        <div className={styles.card}>
                          <h3 className={styles.sectionTitle}>Modifier le prochain RDV</h3>
                          <div className={styles.fieldRow}>
                            <div className={styles.field}><label>Date</label><input type="date" defaultValue={activePlan.nextRdvDate?.slice(0, 10) || ""} id="rdv-date" /></div>
                            <div className={styles.field}><label>Heure</label><input type="time" defaultValue={activePlan.nextRdvTime || ""} id="rdv-time" /></div>
                            <div className={styles.field}><label>Lieu</label><input defaultValue={activePlan.nextRdvLocation || ""} placeholder="Cabinet, domicile..." id="rdv-location" /></div>
                          </div>
                          <div className={styles.fieldActions}>
                            <button className={styles.btnPrimary} onClick={() => {
                              const d = (document.getElementById("rdv-date") as HTMLInputElement).value;
                              const t = (document.getElementById("rdv-time") as HTMLInputElement).value;
                              const l = (document.getElementById("rdv-location") as HTMLInputElement).value;
                              updatePlan(activePlan.id, { nextRdvDate: d || null, nextRdvTime: t || null, nextRdvLocation: l || null });
                              setEditField(null);
                            }}>Enregistrer</button>
                            <button className={styles.btnOutline} onClick={() => setEditField(null)}>Annuler</button>
                          </div>
                        </div>
                      )}

                      {/* C) Table exercices prescrits */}
                      <div className={styles.card}>
                        <div className={styles.cardHeader}>
                          <h3 className={styles.sectionTitle}>Exercices prescrits</h3>
                          <button className={styles.btnPrimary} onClick={() => router.push("/dashboard/kine/programmes")}>+ Ajouter exercice</button>
                        </div>
                        {activePlan.exercises.length === 0 ? (
                          <p className={styles.muted} style={{ textAlign: "center", padding: 20 }}>Aucun exercice prescrit. Ajoutez-en depuis la page Programmes.</p>
                        ) : (
                          <div className={styles.exTable}>
                            <div className={styles.exTableHead}>
                              <span>#</span><span>Exercice</span><span>Zone</span><span>Séries</span><span>Reps/Durée</span><span>Fréq.</span><span>Douleur max</span><span>Consignes</span><span>Variante</span>
                            </div>
                            {activePlan.exercises.map(ex => (
                              <div key={ex.id} className={styles.exTableRow}>
                                <span className={styles.exPos}>{ex.position + 1}</span>
                                <span className={styles.exName}>{ex.video.title}</span>
                                <span className={styles.exZone}>{ex.video.category}</span>
                                <span>{ex.sets || "—"}</span>
                                <span>{ex.reps || ex.duration || "—"}</span>
                                <span>{ex.frequency || "—"}</span>
                                <span>{ex.painThreshold !== null ? `${ex.painThreshold}/10` : "—"}</span>
                                <span className={styles.exConsigne}>{ex.consignes || "—"}</span>
                                <span>{ex.alternative || "—"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      <div className={styles.notesGrid}>
                        <div className={styles.card}>
                          <h3 className={styles.sectionTitle}>Notes pro (privées)</h3>
                          <textarea className={styles.textarea} value={activePlan.notesPro || ""} onChange={e => updatePlan(activePlan.id, { notesPro: e.target.value })} placeholder="Notes cliniques privées..." rows={3} />
                        </div>
                        <div className={styles.card}>
                          <h3 className={styles.sectionTitle}>Notes patient (visibles)</h3>
                          <textarea className={styles.textarea} value={activePlan.notesPatient || ""} onChange={e => updatePlan(activePlan.id, { notesPatient: e.target.value })} placeholder="Consignes pour le patient..." rows={3} />
                        </div>
                      </div>

                      {/* D) Boutons d'action pro */}
                      <div className={styles.actionBar}>
                        {activePlan.status === "draft" && (
                          <button className={styles.btnPrimary} onClick={() => updatePlan(activePlan.id, { status: "active" })}>Envoyer / Publier au patient</button>
                        )}
                        <button className={styles.btnOutline} onClick={() => router.push("/dashboard/kine/programmes")}>Modifier le programme</button>
                        <button className={styles.btnOutline} onClick={() => {
                          fetch("/api/kine/plans", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ title: `${activePlan.title} (copie)`, duplicateFromId: activePlan.id, athleteId }),
                          }).then(() => fetchPlans());
                        }}>Dupliquer</button>
                        <button className={styles.btnOutline} onClick={() => {/* PDF export placeholder */ window.print(); }}>Télécharger PDF</button>
                        <button className={styles.btnDanger} onClick={() => { setShowCloseModal(true); setCloseConclusion(""); setCloseScore(""); }}>Clôturer la rééducation</button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════ TAB 2: JOURNAL D'ALERTES ═══════ */}
          {tab === "alertes" && (
            <div className={styles.section}>
              <div className={styles.alertHeader}>
                <div className={styles.alertFilters}>
                  <select className={styles.selectField} value={alertTypeFilter} onChange={e => setAlertTypeFilter(e.target.value)}>
                    <option value="">Tous types</option>
                    {Object.entries(ALERT_TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <select className={styles.selectField} value={alertStatusFilter} onChange={e => setAlertStatusFilter(e.target.value)}>
                    <option value="">Tous statuts</option>
                    {Object.entries(ALERT_STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input className={styles.searchInput} placeholder="Rechercher..." value={alertFilter} onChange={e => setAlertFilter(e.target.value)} />
                </div>
                <div className={styles.alertActions2}>
                  <button className={styles.btnPrimary} onClick={() => setShowCreateAlert(true)}>+ Nouvelle alerte</button>
                  <button className={styles.btnOutline} onClick={() => setShowRules(!showRules)}>{showRules ? "Masquer règles" : "Règles d'alertes"}</button>
                </div>
              </div>

              {/* Rules panel */}
              {showRules && (
                <div className={styles.card}>
                  <h3 className={styles.sectionTitle}>Règles d&apos;alertes automatiques</h3>
                  <div className={styles.rulesList}>
                    {Object.entries(RULE_TYPE_MAP).map(([ruleType, label]) => {
                      const existing = alertRules.find(r => r.ruleType === ruleType);
                      return (
                        <div key={ruleType} className={styles.ruleItem}>
                          <div className={styles.ruleInfo}>
                            <div className={styles.ruleName}>{label}</div>
                            <div className={styles.ruleMeta}>
                              Seuil: <input type="number" className={styles.ruleInput} value={existing?.threshold || 5} onChange={e => upsertRule(ruleType, parseInt(e.target.value) || 5, existing?.thresholdDays || 3)} />
                              {(ruleType === "pain_threshold" || ruleType === "no_feedback") && (
                                <> Jours: <input type="number" className={styles.ruleInput} value={existing?.thresholdDays || 3} onChange={e => upsertRule(ruleType, existing?.threshold || 5, parseInt(e.target.value) || 3)} /></>
                              )}
                            </div>
                          </div>
                          <button className={`${styles.ruleToggle} ${existing?.active ? styles.ruleToggleOn : ""}`} onClick={() => existing ? toggleRule(existing) : upsertRule(ruleType, 5, 3)}>
                            {existing?.active ? "Activé" : "Désactivé"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Alert list */}
              {alerts.filter(a => !alertFilter || a.title.toLowerCase().includes(alertFilter.toLowerCase())).length === 0 ? (
                <div className={styles.emptyState}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <p>Aucune alerte pour ce patient</p>
                </div>
              ) : (
                <div className={styles.alertList}>
                  {alerts.filter(a => !alertFilter || a.title.toLowerCase().includes(alertFilter.toLowerCase())).map(alert => (
                    <div key={alert.id} className={`${styles.alertItem} ${openAlert?.id === alert.id ? styles.alertItemOpen : ""}`} onClick={() => setOpenAlert(openAlert?.id === alert.id ? null : alert)}>
                      <div className={styles.alertItemHead}>
                        <span className={styles.alertDot} style={{ background: ALERT_TYPE_MAP[alert.type]?.color || "#94a3b8" }} />
                        <div className={styles.alertItemInfo}>
                          <div className={styles.alertItemTitle}>{alert.title}</div>
                          <div className={styles.alertItemMeta}>
                            {ALERT_STATUS_MAP[alert.status] || alert.status} · {ORIGIN_MAP[alert.origin] || alert.origin} · {fmtDate(alert.createdAt)}
                            {alert.intensity !== null && ` · Intensité ${alert.intensity}/10`}
                          </div>
                        </div>
                        <span className={styles.badge} style={{ color: ALERT_TYPE_MAP[alert.type]?.color, borderColor: ALERT_TYPE_MAP[alert.type]?.color }}>{ALERT_TYPE_MAP[alert.type]?.label}</span>
                      </div>

                      {openAlert?.id === alert.id && (
                        <div className={styles.alertDetail} onClick={e => e.stopPropagation()}>
                          {alert.description && <p className={styles.alertDesc}>{alert.description}</p>}
                          {alert.detail && <div className={styles.alertDetailBlock}><strong>Détail :</strong> {alert.detail}</div>}
                          {alert.plan && <div className={styles.alertDetailBlock}><strong>Programme lié :</strong> {alert.plan.title}</div>}
                          {alert.clinicalNote && <div className={styles.alertDetailBlock}><strong>Note clinique :</strong> {alert.clinicalNote}</div>}

                          <div className={styles.alertDetailActions}>
                            {alert.status !== "closed" && (
                              <>
                                <button className={styles.btnSmall} onClick={() => updateAlert(alert.id, { status: "closed" })}>Marquer comme traité</button>
                                <button className={styles.btnSmall} onClick={() => {
                                  const note = prompt("Note clinique :");
                                  if (note !== null) updateAlert(alert.id, { clinicalNote: note });
                                }}>Ajouter note clinique</button>
                                {alert.plan && (
                                  <button className={styles.btnSmall} onClick={() => router.push("/dashboard/kine/programmes")}>Adapter le programme</button>
                                )}
                                <button className={styles.btnSmall} onClick={() => router.push("/dashboard/kine/messagerie")}>Relancer patient</button>
                              </>
                            )}
                            <button className={styles.btnDangerSmall} onClick={() => { if (confirm("Supprimer cette alerte ?")) deleteAlert(alert.id); }}>Supprimer</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ TAB 3: HISTORIQUE ═══════ */}
          {tab === "historique" && (
            <div className={styles.section}>
              <div className={styles.histHeader}>
                <h3 className={styles.sectionTitle}>Prises en charge passées</h3>
                <button className={styles.btnPrimary} onClick={() => router.push("/dashboard/kine/programmes")}>+ Nouvelle rééducation</button>
              </div>

              {history.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg>
                  <p>Aucun historique de rééducation</p>
                </div>
              ) : (
                <div className={styles.histGrid}>
                  {history.map(plan => (
                    <div key={plan.id} className={`${styles.histCard} ${openHistory?.id === plan.id ? styles.histCardOpen : ""}`} onClick={() => setOpenHistory(openHistory?.id === plan.id ? null : plan)}>
                      <div className={styles.histCardTop}>
                        <div>
                          <div className={styles.histTitle}>{plan.title}</div>
                          {plan.pathology && <div className={styles.histPathology}>{plan.pathology}</div>}
                        </div>
                        <span className={styles.badge} style={{ color: STATUS_MAP[plan.status]?.color, borderColor: STATUS_MAP[plan.status]?.color, background: STATUS_MAP[plan.status]?.bg }}>{STATUS_MAP[plan.status]?.label}</span>
                      </div>
                      <div className={styles.histMeta}>
                        <span>{fmtDate(plan.startDate)} → {fmtDate(plan.endDate)}</span>
                        {plan.startDate && plan.endDate && <span>{weeksBetween(plan.startDate, plan.endDate)} sem.</span>}
                        {plan.outcomeScore !== null && <span className={styles.histScore}>{plan.outcomeScore}% succès</span>}
                      </div>

                      {openHistory?.id === plan.id && (
                        <div className={styles.histDetail} onClick={e => e.stopPropagation()}>
                          {plan.phase && <div className={styles.histRow}><strong>Phase finale :</strong> {plan.phase}</div>}
                          {plan.globalProgress !== null && <div className={styles.histRow}><strong>Progression :</strong> {plan.globalProgress}%</div>}
                          {plan.objective && <div className={styles.histRow}><strong>Objectif :</strong> {plan.objective}</div>}
                          {plan.conclusion && <div className={styles.histRow}><strong>Conclusion :</strong> {plan.conclusion}</div>}

                          <div className={styles.histRow}><strong>Exercices prescrits :</strong> {plan.exercises.length}</div>
                          {plan.exercises.length > 0 && (
                            <div className={styles.histExList}>
                              {plan.exercises.map(ex => (
                                <div key={ex.id} className={styles.histExItem}>
                                  <span>{ex.video.title}</span>
                                  <span className={styles.muted}>{ex.video.category} · {ex.sets || "—"}×{ex.reps || ex.duration || "—"}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {plan.notesPro && <div className={styles.histRow}><strong>Notes pro :</strong> <span className={styles.histNote}>{plan.notesPro}</span></div>}

                          <div className={styles.histActions}>
                            <button className={styles.btnPrimary} onClick={() => reuseAsTemplate(plan)}>Réutiliser comme template</button>
                            <button className={styles.btnOutline} onClick={() => window.print()}>Exporter bilan PDF</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════ MODALS ═══════ */}

      {/* Close plan modal */}
      {showCloseModal && activePlan && (
        <div className={styles.overlay} onClick={() => setShowCloseModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h3>Clôturer la rééducation</h3><button className={styles.modalClose} onClick={() => setShowCloseModal(false)}>×</button></div>
            <div className={styles.modalBody}>
              <p className={styles.muted}>Vous allez clôturer &quot;{activePlan.title}&quot;. Le plan passera en statut Terminé.</p>
              <div className={styles.field}><label>Conclusion / bilan final</label><textarea value={closeConclusion} onChange={e => setCloseConclusion(e.target.value)} rows={4} placeholder="Notes de fin de rééducation..." /></div>
              <div className={styles.field}><label>Score de résultat (%)</label><input type="number" min="0" max="100" value={closeScore} onChange={e => setCloseScore(e.target.value)} placeholder="75" /></div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutline} onClick={() => setShowCloseModal(false)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={closePlan}>Clôturer</button>
            </div>
          </div>
        </div>
      )}

      {/* Create alert modal */}
      {showCreateAlert && (
        <CreateAlertModal
          athleteId={athleteId}
          plans={plans}
          onClose={() => setShowCreateAlert(false)}
          onCreated={(data) => { createAlert(data); setShowCreateAlert(false); }}
        />
      )}
    </div>
  );
}

/* ─── Create Alert Modal ─── */
function CreateAlertModal({ athleteId, plans, onClose, onCreated }: {
  athleteId: string; plans: Plan[];
  onClose: () => void; onCreated: (data: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("alert");
  const [origin, setOrigin] = useState("kine");
  const [description, setDescription] = useState("");
  const [detail, setDetail] = useState("");
  const [intensity, setIntensity] = useState("");
  const [planId, setPlanId] = useState("");

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Nouvelle alerte</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Titre *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Douleur genou signalée..." /></div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="alert">Alerte</option><option value="info">Info</option><option value="success">Succès</option>
              </select>
            </div>
            <div className={styles.field}><label>Origine</label>
              <select value={origin} onChange={e => setOrigin(e.target.value)}>
                <option value="kine">Kiné</option><option value="patient">Patient</option><option value="sensor">Capteur</option><option value="auto">Auto</option>
              </select>
            </div>
          </div>
          <div className={styles.field}><label>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
          <div className={styles.field}><label>Détail (contexte, intensité...)</label><textarea value={detail} onChange={e => setDetail(e.target.value)} rows={2} /></div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Intensité (/10)</label><input type="number" min="0" max="10" value={intensity} onChange={e => setIntensity(e.target.value)} /></div>
            <div className={styles.field}><label>Programme lié</label>
              <select value={planId} onChange={e => setPlanId(e.target.value)}>
                <option value="">Aucun</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} disabled={!title.trim()} onClick={() => onCreated({ title, type, origin, description: description || null, detail: detail || null, intensity: intensity || null, planId: planId || null })}>Créer</button>
        </div>
      </div>
    </div>
  );
}
