"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../page.module.scss";

const ORDO_TYPE_LABELS: Record<string, string> = {
  kine: "Rééducation / Kiné", imagerie: "Imagerie", biologie: "Examens biologiques",
  medicament: "Médicaments", arret: "Arrêt de travail", certificat: "Certificat médical",
  orientation: "Orientation spécialiste", dispositif: "Dispositif médical",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export default function TabMedIndicateurs({ proId }: { proId: string }) {
  const [medOrdonnances, setMedOrdonnances] = useState<any[]>([]);
  const [medPrescriptions, setMedPrescriptions] = useState<any[]>([]);
  const [medProtocols, setMedProtocols] = useState<any[]>([]);
  const [medAlerts, setMedAlerts] = useState<any[]>([]);
  const [medPlan, setMedPlan] = useState<{ episode: string; patientStatus: string; updatedAt: string; conduite: string[]; restrictions: string[]; nextSteps: { label: string; status: string }[] } | null>(null);
  const [vitals, setVitals] = useState<{ key: string; label: string; value: string | number; unit: string; trend: "up" | "down" | "stable" | null; color: string }[]>([]);
  const [vitalEntries, setVitalEntries] = useState<{ vitalKey: string; value: number; unit: string; recordedAt: string }[]>([]);
  const [vitalInput, setVitalInput] = useState<{ key: string; label: string; unit: string; color: string } | null>(null);
  const [viValue, setViValue] = useState(5);
  const [viNote, setViNote] = useState("");
  const [viSaving, setViSaving] = useState(false);
  const [maFilter, setMaFilter] = useState<"all" | "open" | "treated" | "closed">("all");
  const [maOpenId, setMaOpenId] = useState<string | null>(null);
  const [tlFilter, setTlFilter] = useState("all");
  const [graphTab, setGraphTab] = useState(0);

  useEffect(() => {
    fetch(`/api/athlete/med-ordonnances?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.ordonnances) setMedOrdonnances(data.ordonnances); })
      .catch(() => {});
    fetch(`/api/athlete/med-prescriptions?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.prescriptions) setMedPrescriptions(data.prescriptions); })
      .catch(() => {});
    fetch(`/api/athlete/med-protocols?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.protocols) setMedProtocols(data.protocols); })
      .catch(() => {});
    fetch(`/api/athlete/med-plan?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.plan) setMedPlan(data.plan); })
      .catch(() => {});
    fetch(`/api/athlete/med-alerts?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.alerts) setMedAlerts(data.alerts); })
      .catch(() => {});
    fetchVitals();
  }, [proId]);

  const VITAL_META: Record<string, { label: string; color: string; unit: string; min: number; max: number; step: number; def: number }> = {
    douleur: { label: "Douleur", color: "#ef4444", unit: "/10", min: 0, max: 10, step: 1, def: 5 },
    fatigue: { label: "Fatigue", color: "#f59e0b", unit: "/10", min: 0, max: 10, step: 1, def: 5 },
    sommeil: { label: "Sommeil", color: "#8b5cf6", unit: "h", min: 0, max: 14, step: 0.5, def: 7 },
    poids:   { label: "Poids",   color: "#3b82f6", unit: "kg", min: 30, max: 200, step: 0.1, def: 70 },
  };

  const fetchVitals = useCallback(() => {
    fetch(`/api/athlete/med-vitals?proId=${proId}&limit=20`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const entries: { vitalKey: string; value: number; unit: string; recordedAt: string }[] = data?.entries || [];
        const grouped = new Map<string, typeof entries>();
        entries.forEach((e) => {
          const arr = grouped.get(e.vitalKey) || [];
          arr.push(e);
          grouped.set(e.vitalKey, arr);
        });
        const tiles = ["douleur", "fatigue", "sommeil", "poids"].map((key) => {
          const meta = VITAL_META[key];
          const vals = grouped.get(key) || [];
          if (vals.length === 0) return { key, label: meta.label, value: "\u2014" as string | number, unit: meta.unit, trend: null as "up" | "down" | "stable" | null, color: meta.color };
          const latest = vals[0];
          let trend: "up" | "down" | "stable" | null = null;
          if (vals.length >= 2) {
            const diff = latest.value - vals[1].value;
            trend = diff > 0 ? "up" : diff < 0 ? "down" : "stable";
          }
          return { key, label: meta.label, value: latest.value, unit: latest.unit, trend, color: meta.color };
        });
        setVitals(tiles);
        setVitalEntries(entries);
      })
      .catch(() => {
        setVitals(["douleur", "fatigue", "sommeil", "poids"].map((key) => {
          const meta = VITAL_META[key];
          return { key, label: meta.label, value: "\u2014" as string | number, unit: meta.unit, trend: null, color: meta.color };
        }));
      });
  }, [proId]);

  const handleSaveVital = async () => {
    if (!vitalInput) return;
    setViSaving(true);
    try {
      await fetch("/api/athlete/med-vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proId, vitalKey: vitalInput.key, value: viValue, unit: vitalInput.unit, note: viNote || null }),
      });
      fetchVitals();
      setVitalInput(null); setViNote("");
    } catch { /* ignore */ }
    setViSaving(false);
  };

  const SEVERITY_MAP: Record<string, { label: string; color: string; icon: string }> = {
    critical: { label: "Critique", color: "#ef4444", icon: "\u26A0\uFE0F" },
    warning: { label: "\u00c0 surveiller", color: "#f59e0b", icon: "\u26A0\uFE0F" },
    info: { label: "Info", color: "#3b82f6", icon: "\u2139\uFE0F" },
  };
  const SOURCE_LABEL: Record<string, string> = { patient: "Patient", capteur: "Capteur", auto: "Auto", pro: "Pro" };
  const filteredMedAlerts = medAlerts.filter((a) => maFilter === "all" || a.status === maFilter);
  const openAlertCount = medAlerts.filter((a) => a.status === "open").length;

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    stable: { label: "Stable", color: "#22c55e" },
    surveiller: { label: "À surveiller", color: "#f59e0b" },
    alerte: { label: "Alerte", color: "#ef4444" },
  };

  const lastEvent = medOrdonnances.length > 0
    ? `Ordonnance ${ORDO_TYPE_LABELS[medOrdonnances[0].type] || medOrdonnances[0].type} — ${fmtDate(medOrdonnances[0].createdAt)}`
    : medPrescriptions.length > 0
      ? `${medPrescriptions[0].title} — ${fmtDate(medPrescriptions[0].dateStart)}`
      : null;

  const criticalAlerts = medAlerts.filter((a) => a.severity === "critical" && a.status === "open");

  const TL_TYPES: Record<string, { label: string; color: string }> = {
    ordonnance: { label: "Ordonnance", color: "#f97316" },
    prescription: { label: "Prescription", color: "#3b82f6" },
    alert: { label: "Alerte", color: "#ef4444" },
    protocole: { label: "Protocole", color: "#8b5cf6" },
  };
  const TL_FILTERS = [
    { value: "all", label: "Tout" },
    { value: "ordonnance", label: "Ordonnances" },
    { value: "prescription", label: "Prescriptions" },
    { value: "alert", label: "Alertes" },
    { value: "protocole", label: "Protocoles" },
  ];

  const timeline = (() => {
    const entries: { id: string; type: string; title: string; summary: string; date: string }[] = [];
    medOrdonnances.forEach((o) => entries.push({
      id: `o-${o.id}`, type: "ordonnance",
      title: `${ORDO_TYPE_LABELS[o.type] || o.type}${o.status === "signee" ? " (signée)" : ""}`,
      summary: o.diagnosis || "\u2014", date: o.createdAt,
    }));
    medPrescriptions.forEach((p) => entries.push({
      id: `p-${p.id}`, type: "prescription",
      title: p.title, summary: (p.content || []).slice(0, 2).join(", "), date: p.dateStart,
    }));
    medAlerts.forEach((a) => entries.push({
      id: `a-${a.id}`, type: "alert",
      title: a.title, summary: a.description?.slice(0, 100) || "\u2014", date: a.createdAt,
    }));
    medProtocols.forEach((p) => entries.push({
      id: `pr-${p.id}`, type: "protocole",
      title: p.name, summary: p.description?.slice(0, 100) || "\u2014", date: p.createdAt || p.updatedAt || new Date().toISOString(),
    }));
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  })();
  const filteredTimeline = timeline.filter((e) => tlFilter === "all" || e.type === tlFilter);

  return (
    <section className={styles.tabContent}>
      {/* Bandeau alerte critique */}
      {criticalAlerts.length > 0 && (
        <div className={styles.medCriticalBanner}>
          <span className={styles.medCriticalIcon}>⚠️</span>
          <span className={styles.medCriticalText}>
            {criticalAlerts.length} alerte{criticalAlerts.length > 1 ? "s" : ""} critique{criticalAlerts.length > 1 ? "s" : ""} — {criticalAlerts[0].title}
          </span>
        </div>
      )}

      {/* Résumé clinique */}
      {medPlan && (
        <div className={styles.medSummaryBanner}>
          <div className={styles.medSummaryLeft}>
            <div className={styles.medSummaryEpisode}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              {medPlan.episode || "Suivi général"}
            </div>
            <span className={styles.medSummaryDot} style={{ background: STATUS_MAP[medPlan.patientStatus]?.color || "#94a3b8" }} />
            <span className={styles.medSummaryStatus} style={{ color: STATUS_MAP[medPlan.patientStatus]?.color || "#94a3b8" }}>
              {STATUS_MAP[medPlan.patientStatus]?.label || medPlan.patientStatus}
            </span>
          </div>
          <div className={styles.medSummaryRight}>
            {lastEvent && <span className={styles.medSummaryEvent}>{lastEvent}</span>}
            <span className={styles.medSummaryUpdated}>Mis à jour {fmtDate(medPlan.updatedAt)}</span>
          </div>
        </div>
      )}

      {/* Signaux vitaux */}
      <div className={styles.medVitalsSection}>
        <h4 className={styles.medVitalsSectionTitle}>Signaux vitaux & symptômes</h4>
        {vitals.length === 0 ? (
          <div className={styles.tabEmpty}><span>Aucune donnée vitale</span></div>
        ) : (
          <div className={styles.medVitalsGrid}>
            {vitals.map((v) => (
              <div key={v.key} className={styles.medVitalTile} onClick={() => {
                const meta = VITAL_META[v.key];
                setVitalInput({ key: v.key, label: meta.label, unit: meta.unit, color: meta.color });
                setViValue(typeof v.value === "number" ? v.value : meta.def);
              }}>
                <div className={styles.medVitalHeader}>
                  <span className={styles.medVitalLabel}>{v.label}</span>
                  {v.trend && (
                    <span className={`${styles.medVitalTrend} ${v.trend === "down" ? styles.medVitalTrendDown : v.trend === "up" ? styles.medVitalTrendUp : ""}`}>
                      {v.trend === "up" ? "↗" : v.trend === "down" ? "↘" : "→"}
                    </span>
                  )}
                </div>
                <div className={styles.medVitalValue} style={{ color: v.value === "—" ? "rgba(255,255,255,0.2)" : v.color }}>
                  {v.value}<span className={styles.medVitalUnit}>{v.unit}</span>
                </div>
                <span className={styles.medVitalAction}>Cliquer pour saisir</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vital input modal */}
      {vitalInput && (
        <div className={styles.nutriMeasureOverlay} onClick={() => setVitalInput(null)}>
          <div className={styles.nutriMeasureModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.nutriMeasureModalHeader}>
              <h4>Saisir — {vitalInput.label}</h4>
              <button className={styles.nutriMeasureModalClose} onClick={() => setVitalInput(null)}>×</button>
            </div>
            <div className={styles.nutriMeasureModalBody}>
              <div className={styles.medVitalInputDisplay} style={{ color: vitalInput.color }}>
                <span className={styles.medVitalInputValue}>{viValue}</span>
                <span className={styles.medVitalInputUnit}>{vitalInput.unit}</span>
              </div>
              <div className={styles.nutriMeasureField}>
                <input
                  type="range"
                  min={VITAL_META[vitalInput.key].min} max={VITAL_META[vitalInput.key].max} step={VITAL_META[vitalInput.key].step}
                  value={viValue}
                  onChange={(e) => setViValue(parseFloat(e.target.value))}
                  className={styles.medVitalSlider}
                  style={{ accentColor: vitalInput.color }}
                />
                <div className={styles.medVitalRangeLabels}>
                  <span>{VITAL_META[vitalInput.key].min}{vitalInput.unit}</span>
                  <span>{VITAL_META[vitalInput.key].max}{vitalInput.unit}</span>
                </div>
              </div>
              <div className={styles.nutriMeasureField}>
                <label>Valeur exacte</label>
                <input type="number" min={VITAL_META[vitalInput.key].min} max={VITAL_META[vitalInput.key].max} step={VITAL_META[vitalInput.key].step}
                  value={viValue} onChange={(e) => setViValue(parseFloat(e.target.value) || 0)} />
              </div>
              <div className={styles.nutriMeasureField}>
                <label>Note (optionnel)</label>
                <input type="text" placeholder="Contexte, circonstances..." value={viNote} onChange={(e) => setViNote(e.target.value)} />
              </div>
            </div>
            <div className={styles.nutriMeasureModalFooter}>
              <button className={styles.nutriMeasureCancelBtn} onClick={() => setVitalInput(null)}>Annuler</button>
              <button className={styles.nutriMeasureSaveBtn} disabled={viSaving} onClick={handleSaveVital}>
                {viSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alertes médicales */}
      <div className={styles.medAlertsSection}>
        <div className={styles.medAlertsSectionHeader}>
          <h4 className={styles.medAlertsSectionTitle}>
            Alertes médicales
            {openAlertCount > 0 && <span className={styles.medAlertsCount}>{openAlertCount}</span>}
          </h4>
        </div>
        <div className={styles.medAlertsFilters}>
          {(["all", "open", "treated", "closed"] as const).map((f) => (
            <button key={f} className={`${styles.medAlertsFilterBtn} ${maFilter === f ? styles.medAlertsFilterActive : ""}`}
              onClick={() => setMaFilter(f)}>
              {f === "all" ? "Toutes" : f === "open" ? "À traiter" : f === "treated" ? "Traitées" : "Clôturées"}
            </button>
          ))}
        </div>
        {filteredMedAlerts.length === 0 ? (
          <div className={styles.medAlertsEmpty}>Aucune alerte{maFilter !== "all" ? ` (${maFilter === "open" ? "à traiter" : maFilter === "treated" ? "traitées" : "clôturées"})` : ""}</div>
        ) : (
          <div className={styles.medAlertsList}>
            {filteredMedAlerts.map((a) => {
              const sev = SEVERITY_MAP[a.severity] || SEVERITY_MAP.info;
              const isOpen = maOpenId === a.id;
              return (
                <div key={a.id} className={`${styles.medAlertItem} ${isOpen ? styles.medAlertItemOpen : ""}`}>
                  <div className={styles.medAlertRow} onClick={() => setMaOpenId(isOpen ? null : a.id)}>
                    <span className={styles.medAlertIcon} style={{ color: sev.color }}>{sev.icon}</span>
                    <div className={styles.medAlertInfo}>
                      <span className={styles.medAlertTitle}>{a.title}</span>
                      <span className={styles.medAlertMeta}>
                        {fmtDate(a.createdAt)} · <span style={{ color: sev.color }}>{sev.label}</span>
                        {a.source && <> · {SOURCE_LABEL[a.source] || a.source}</>}
                      </span>
                    </div>
                    <span className={styles.medAlertChevron}>{isOpen ? "▾" : "›"}</span>
                  </div>
                  {isOpen && (
                    <div className={styles.medAlertDetail}>
                      <p className={styles.medAlertDesc}>{a.description}</p>
                      {a.context && <p className={styles.medAlertContext}>Contexte : {a.context}</p>}
                      {a.commentMedecin && <p className={styles.medAlertComment}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        Commentaire médecin : {a.commentMedecin}
                      </p>}
                      <div className={styles.medAlertStatusBadge} style={{ color: a.status === "open" ? "#f59e0b" : a.status === "treated" ? "#3b82f6" : "#22c55e", borderColor: a.status === "open" ? "#f59e0b" : a.status === "treated" ? "#3b82f6" : "#22c55e" }}>
                        {a.status === "open" ? "En attente de traitement" : a.status === "treated" ? "Traitée par le médecin" : "Clôturée"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Timeline médicale */}
      <div className={styles.medTimelineSection}>
        <h4 className={styles.medTimelineSectionTitle}>Timeline médicale</h4>
        <div className={styles.medTimelineFilters}>
          {TL_FILTERS.map((f) => (
            <button key={f.value} className={`${styles.medAlertsFilterBtn} ${tlFilter === f.value ? styles.medAlertsFilterActive : ""}`}
              onClick={() => setTlFilter(f.value)}>{f.label}</button>
          ))}
        </div>
        {filteredTimeline.length === 0 ? (
          <div className={styles.medAlertsEmpty}>Aucun événement dans la timeline</div>
        ) : (
          <div className={styles.medTimeline}>
            {filteredTimeline.map((e, i) => {
              const tt = TL_TYPES[e.type] || TL_TYPES.ordonnance;
              return (
                <div key={e.id} className={styles.medTlEntry}>
                  <div className={styles.medTlDotCol}>
                    <span className={styles.medTlDot} style={{ background: tt.color }} />
                    {i < filteredTimeline.length - 1 && <span className={styles.medTlLine} />}
                  </div>
                  <div className={styles.medTlContent}>
                    <div className={styles.medTlHead}>
                      <span className={styles.medTlBadge} style={{ color: tt.color, borderColor: tt.color }}>{tt.label}</span>
                      <span className={styles.medTlDate}>{fmtDate(e.date)}</span>
                    </div>
                    <div className={styles.medTlTitle}>{e.title}</div>
                    <div className={styles.medTlSummary}>{e.summary}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tendances */}
      <div className={styles.medTrendsSection}>
        <div className={styles.medTrendsSectionHeader}>
          <h4 className={styles.medTrendsSectionTitle}>Tendances</h4>
          <div className={styles.medTrendsNav}>
            {["Douleur (7j)", "Fatigue", "Sommeil", "Poids"].map((g, i) => (
              <button key={i} className={`${styles.medAlertsFilterBtn} ${graphTab === i ? styles.medAlertsFilterActive : ""}`} onClick={() => setGraphTab(i)}>{g}</button>
            ))}
          </div>
        </div>
        {(() => {
          const keys = ["douleur", "fatigue", "sommeil", "poids"];
          const vk = keys[graphTab];
          const meta = VITAL_META[vk];
          const pts = vitalEntries.filter((e) => e.vitalKey === vk).slice(0, 10).reverse();
          if (pts.length < 2) return (
            <div className={styles.medTrendsEmpty}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              <span>Données insuffisantes pour afficher les tendances</span>
              <span className={styles.medTrendsHint}>Les graphiques s&apos;afficheront quand vous saisirez vos signaux vitaux</span>
            </div>
          );
          const minV = Math.min(...pts.map((p) => p.value));
          const maxV = Math.max(...pts.map((p) => p.value));
          const range = maxV - minV || 1;
          const W = 300, H = 100, PX = 10, PY = 10;
          const points = pts.map((p, i) => {
            const x = PX + (i / (pts.length - 1)) * (W - 2 * PX);
            const y = PY + (1 - (p.value - minV) / range) * (H - 2 * PY);
            return `${x},${y}`;
          }).join(" ");
          const lastPt = pts[pts.length - 1];
          const prevPt = pts[pts.length - 2];
          const diff = lastPt.value - prevPt.value;
          const fmtShort = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
          return (
            <div className={styles.medTrendsCard}>
              <svg viewBox={`0 0 ${W} ${H}`} className={styles.medTrendsSvg}>
                <polyline points={points} fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => {
                  const x = PX + (i / (pts.length - 1)) * (W - 2 * PX);
                  const y = PY + (1 - (p.value - minV) / range) * (H - 2 * PY);
                  return <circle key={i} cx={x} cy={y} r="3" fill={meta.color} />;
                })}
              </svg>
              <div className={styles.medTrendsMeta}>
                <span className={styles.medTrendsLast} style={{ color: meta.color }}>{lastPt.value}<small>{meta.unit}</small></span>
                <span className={styles.medTrendsDiff} style={{ color: diff > 0 ? "#ef4444" : diff < 0 ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                  {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                </span>
              </div>
              <div className={styles.medTrendsLabels}>
                <span>{fmtShort(pts[0].recordedAt)}</span>
                <span>{fmtShort(pts[pts.length - 1].recordedAt)}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Plan & décisions (lecture seule) */}
      {medPlan && (medPlan.conduite.length > 0 || medPlan.restrictions.length > 0 || medPlan.nextSteps.length > 0) && (
        <div className={styles.medPlanSection}>
          <h4 className={styles.medPlanSectionTitle}>Plan & décisions</h4>
          <div className={styles.medPlanCard}>
            {medPlan.conduite.length > 0 && (
              <div className={styles.medPlanBlock}>
                <h5 className={styles.medPlanBlockTitle}>Conduite à tenir</h5>
                <ul className={styles.medPlanList}>
                  {medPlan.conduite.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {medPlan.restrictions.length > 0 && (
              <div className={styles.medPlanBlock}>
                <h5 className={styles.medPlanBlockTitle}>Restrictions</h5>
                <div className={styles.medPlanChips}>
                  {medPlan.restrictions.map((r, i) => <span key={i} className={styles.medPlanChip}>{r}</span>)}
                </div>
              </div>
            )}
            {medPlan.nextSteps.length > 0 && (
              <div className={styles.medPlanBlock}>
                <h5 className={styles.medPlanBlockTitle}>Prochaines étapes</h5>
                <div className={styles.medPlanSteps}>
                  {medPlan.nextSteps.map((s, i) => (
                    <div key={i} className={styles.medPlanStep}>
                      <span className={`${styles.medPlanStepDot} ${s.status === "done" ? styles.medPlanStepDone : s.status === "in_progress" ? styles.medPlanStepProgress : styles.medPlanStepPending}`} />
                      <span className={styles.medPlanStepLabel}>{s.label}</span>
                      <span className={styles.medPlanStepStatus}>
                        {s.status === "done" ? "Fait" : s.status === "in_progress" ? "En cours" : "À planifier"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
