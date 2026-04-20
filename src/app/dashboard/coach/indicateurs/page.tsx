"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

/* ─── Types ─── */
interface AthleteOption { id: string; name: string; sport: string | null; status: string }

interface KPI {
  adherence: number | null;
  adherenceDelta: number | null;
  plannedCount: number;
  realizedCount: number;
  cancelledCount: number;
  totalSessions: number;
  totalExercises: number;
  avgRpe: number | null;
  prevAvgRpe: number | null;
  avgPain: number | null;
  topPainZone: string | null;
  riskLevel: "ok" | "watch" | "alert";
}

interface DailyPoint {
  date: string;
  planned: number;
  realized: number;
  avgRpe: number | null;
  avgPain: number | null;
}

interface Alert { level: "red" | "orange" | "yellow"; message: string }

interface FeedbackItem {
  id: string; name: string; date: string; feedback: string;
  rpe: number | null; pain: number | null; painZone: string | null;
}

interface SessionItem {
  id: string; name: string; date: string; status: string;
  rpeRessenti: number | null; douleur: number | null;
  tags: string[]; exerciseCount: number;
}

interface IndicData {
  kpi: KPI;
  daily: DailyPoint[];
  alerts: Alert[];
  recentFeedback: FeedbackItem[];
  sessions: SessionItem[];
}

/* ─── Constants ─── */
const PERIOD_OPTIONS = [
  { label: "7 jours", value: 7 },
  { label: "30 jours", value: 30 },
  { label: "90 jours", value: 90 },
];

const TAG_FILTERS = ["Renfo", "Cardio", "Technique", "Rehab", "WOD", "Natation", "Endurance", "Force", "Mobilité"];
const STATUS_FILTERS = ["planifiee", "realisee", "annulee"];
const LIEU_FILTERS = ["Salle", "Extérieur", "À domicile", "Centre aquatique", "Cabinet"];

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon", planifiee: "Planifiée", en_cours: "En cours",
  realisee: "Réalisée", annulee: "Annulée",
};

const TEMPLATES = [
  { name: "Semaine charge", desc: "Volume et intensité progressifs, 4-5 séances/sem" },
  { name: "Semaine récup", desc: "Intensité basse, mobilité, 2-3 séances légères" },
  { name: "Reprise après blessure", desc: "Progressivité, focus ROM et proprio, RPE < 4" },
];

/* ─── Athlete Preview Cards ─── */
function AthletePreview({ athletes, onSelect }: { athletes: AthleteOption[]; onSelect: (id: string) => void }) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/reseau/patients")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPatients(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getInitials = (name: string) => name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  const fixAvatar = (path: string | null) => path;

  const riskColors: Record<string, string> = { GOOD: "#22c55e", MODERATE: "#f59e0b", HIGH: "#ef4444" };
  const riskLabels: Record<string, string> = { GOOD: "Bon", MODERATE: "Modéré", HIGH: "Élevé" };
  const trendIcons: Record<string, string> = { IMPROVING: "↗", STAGNATING: "→", DECLINING: "↘" };

  const filtered = search
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sport?.toLowerCase().includes(search.toLowerCase()))
    : patients;

  return (
    <div className={styles.athletePreview}>
      <div className={styles.athletePreviewHeader}>
        <div className={styles.athletePreviewTitle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Mes athlètes
          <span className={styles.athletePreviewCount}>{patients.length}</span>
        </div>
        <div className={styles.athletePreviewSearch}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading && <div className={styles.loading}>Chargement...</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Aucun athlète trouvé</div>
      )}

      {!loading && filtered.length > 0 && (
        <div className={styles.athletePreviewGrid}>
          {filtered.map((p: any) => (
            <div key={p.id} className={styles.athletePreviewCard} onClick={() => onSelect(p.id)}>
              <div className={styles.athletePreviewCardTop}>
                <div className={styles.athletePreviewAvatar}>{getInitials(p.name)}</div>
                <div className={styles.athletePreviewInfo}>
                  <div className={styles.athletePreviewName}>{p.name}</div>
                  <div className={styles.athletePreviewMeta}>
                    {p.sport && <span>{p.sport}</span>}
                    {p.bodyZone && <span>· {p.bodyZone}</span>}
                  </div>
                </div>
                <div className={styles.athletePreviewBadges}>
                  {p.riskLevel && (
                    <span className={styles.athletePreviewRisk} style={{ color: riskColors[p.riskLevel] || "#94a3b8", borderColor: riskColors[p.riskLevel] || "#94a3b8" }}>
                      {riskLabels[p.riskLevel] || p.riskLevel}
                    </span>
                  )}
                  {p.trend && trendIcons[p.trend] && (
                    <span className={styles.athletePreviewTrend}>{trendIcons[p.trend]}</span>
                  )}
                </div>
              </div>
              {p.motif && <div className={styles.athletePreviewMotif}>{p.motif}</div>}
              {p.connectedPros?.length > 0 && (
                <div className={styles.athletePreviewPros}>
                  <span className={styles.athletePreviewProsLabel}>Équipe :</span>
                  {p.connectedPros.slice(0, 3).map((pro: any) => (
                    <div key={pro.id} className={styles.athletePreviewProChip}>
                      <div className={styles.athletePreviewProAvatar}>
                        {fixAvatar(pro.avatarPath)
                          ? <img src={fixAvatar(pro.avatarPath)!} alt="" />
                          : <span>{(pro.prenom?.[0] || "") + (pro.nom?.[0] || "")}</span>}
                      </div>
                      <span>{pro.prenom} {pro.nom}</span>
                      <span className={styles.athletePreviewProSpec}>{pro.specialite}</span>
                    </div>
                  ))}
                  {p.connectedPros.length > 3 && <span className={styles.athletePreviewProMore}>+{p.connectedPros.length - 3}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Component ─── */
export default function IndicateursPage() {
  const router = useRouter();

  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [days, setDays] = useState(30);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [lieuFilter, setLieuFilter] = useState("");
  const [data, setData] = useState<IndicData | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<"sessions" | "rpe">("sessions");
  const [drillDate, setDrillDate] = useState<string | null>(null);

  // Videos
  const [videos, setVideos] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [uploadLink, setUploadLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<any | null>(null);

  // Fetch athletes
  useEffect(() => {
    fetch("/api/athletes?status=active")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAthletes(d); })
      .catch(() => {});
  }, []);

  // Fetch indicators
  const fetchData = useCallback(() => {
    if (!athleteId) { setData(null); return; }
    setLoading(true);
    const params = new URLSearchParams({ athleteId, days: String(days) });
    if (tagFilters.length) params.set("tags", tagFilters.join(","));
    if (statusFilters.length) params.set("status", statusFilters.join(","));
    if (lieuFilter) params.set("lieu", lieuFilter);
    fetch(`/api/indicateurs?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.kpi) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [athleteId, days, tagFilters, statusFilters, lieuFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch videos for selected athlete
  const fetchVideos = useCallback(() => {
    if (!athleteId) { setVideos([]); return; }
    setVideosLoading(true);
    fetch(`/api/athlete-videos?athleteId=${athleteId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setVideos(d); })
      .catch(() => {})
      .finally(() => setVideosLoading(false));
  }, [athleteId]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const generateLink = async () => {
    if (!athleteId) return;
    try {
      const res = await fetch("/api/athlete-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId }),
      });
      const d = await res.json();
      if (d.uploadUrl) {
        const fullUrl = `${d.uploadUrl}?a=${d.athleteId}&p=${d.professionnelId}`;
        setUploadLink(fullUrl);
        navigator.clipboard.writeText(fullUrl).then(() => {
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 3000);
        });
      }
    } catch {}
  };

  const deleteVideo = async (id: string) => {
    if (!confirm("Supprimer cette vidéo ?")) return;
    await fetch(`/api/athlete-videos?id=${id}`, { method: "DELETE" });
    fetchVideos();
  };

  const formatVideoSize = (b: number) => b < 1024*1024 ? `${(b/1024).toFixed(1)} Ko` : `${(b/(1024*1024)).toFixed(1)} Mo`;
  const formatVideoDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const selectedAthlete = athletes.find((a) => a.id === athleteId);

  const toggleFilter = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  // Drill-down sessions for a specific date
  const drillSessions = useMemo(() => {
    if (!drillDate || !data) return [];
    return data.sessions.filter((s) => s.date.slice(0, 10) === drillDate);
  }, [drillDate, data]);

  // Export
  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indicateurs-${selectedAthlete?.name || "export"}-${days}j.json`;
    a.click();
  };

  /* ─── SVG Chart helpers ─── */
  const renderChart = () => {
    if (!data || !data.daily.length) return <div className={styles.chartNoData}>Pas de données pour cette période</div>;

    const d = data.daily;
    const W = 800, H = 200, PAD_L = 30, PAD_R = 10, PAD_T = 15, PAD_B = 30;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    if (chartMode === "sessions") {
      const maxVal = Math.max(...d.map((p) => Math.max(p.planned, p.realized)), 1);
      const barW = Math.max(4, Math.min(20, chartW / d.length / 2.5));
      const gap = 2;

      return (
        <svg className={styles.chartSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} className={styles.chartGrid} x1={PAD_L} x2={W - PAD_R} y1={PAD_T + chartH * (1 - f)} y2={PAD_T + chartH * (1 - f)} />
          ))}
          {d.map((p, i) => {
            const x = PAD_L + (i / (d.length - 1 || 1)) * chartW;
            const hP = (p.planned / maxVal) * chartH;
            const hR = (p.realized / maxVal) * chartH;
            return (
              <g key={p.date} onClick={() => setDrillDate(p.date)} style={{ cursor: "pointer" }}>
                <rect className={styles.chartBarPlanned} x={x - barW - gap / 2} y={PAD_T + chartH - hP} width={barW} height={hP} />
                <rect className={styles.chartBarRealized} x={x + gap / 2} y={PAD_T + chartH - hR} width={barW} height={hR} />
                {i % Math.max(1, Math.floor(d.length / 12)) === 0 && (
                  <text className={styles.chartLabel} x={x} y={H - 5}>
                    {new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      );
    }

    // RPE mode
    const rpePoints = d.filter((p) => p.avgRpe !== null);
    if (!rpePoints.length) return <div className={styles.chartNoData}>Pas de données RPE</div>;

    const maxRpe = 10;
    const points = rpePoints.map((p, i) => {
      const x = PAD_L + (i / (rpePoints.length - 1 || 1)) * chartW;
      const y = PAD_T + chartH - ((p.avgRpe! / maxRpe) * chartH);
      return { x, y, ...p };
    });
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

    return (
      <svg className={styles.chartSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} className={styles.chartGrid} x1={PAD_L} x2={W - PAD_R} y1={PAD_T + chartH * (1 - f)} y2={PAD_T + chartH * (1 - f)} />
        ))}
        <path className={styles.chartLineRealized} d={linePath} />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle className={styles.chartDot} cx={p.x} cy={p.y} r={4} onClick={() => setDrillDate(p.date)} />
            {i % Math.max(1, Math.floor(points.length / 10)) === 0 && (
              <text className={styles.chartLabel} x={p.x} y={H - 5}>
                {new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </text>
            )}
          </g>
        ))}
      </svg>
    );
  };

  /* ─── RENDER ─── */

  return (
    <div className={styles.page}>
      {/* ─── 1) Header ─── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Indicateurs</h1>
          {selectedAthlete && (
            <div className={styles.subtitle}>
              {selectedAthlete.name} · {selectedAthlete.sport || "—"} · Suivi {selectedAthlete.status === "active" ? "actif" : selectedAthlete.status}
            </div>
          )}
        </div>
        <div className={styles.headerControls}>
          <select className={styles.athleteSelect} value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            <option value="">Sélectionner un athlète</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.sport ? ` · ${a.sport}` : ""}</option>
            ))}
          </select>
          <select className={styles.periodSelect} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select className={styles.filterSelect} value={lieuFilter} onChange={(e) => setLieuFilter(e.target.value)}>
            <option value="">Tous les lieux</option>
            {LIEU_FILTERS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Chips filters */}
      <div className={styles.filterChips}>
        {TAG_FILTERS.map((t) => (
          <button key={t} className={tagFilters.includes(t) ? styles.chipActive : styles.chip} onClick={() => toggleFilter(tagFilters, t, setTagFilters)}>{t}</button>
        ))}
        <span style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
        {STATUS_FILTERS.map((s) => (
          <button key={s} className={statusFilters.includes(s) ? styles.chipActive : styles.chip} onClick={() => toggleFilter(statusFilters, s, setStatusFilters)}>{STATUS_LABELS[s]}</button>
        ))}
      </div>

      {/* CTAs */}
      {athleteId && (
        <div className={styles.ctaRow}>
          <button className={styles.ctaPrimary} onClick={() => router.push(`/dashboard/coach/programmes?athleteId=${athleteId}`)}>
            Voir / Ajuster le programme
          </button>
          <button className={styles.ctaSecondary} onClick={handleExport}>Exporter JSON</button>
        </div>
      )}

      {/* ─── Landing: athlete cards ─── */}
      {!athleteId && (
        <AthletePreview athletes={athletes} onSelect={(id) => setAthleteId(id)} />
      )}

      {/* Loading */}
      {athleteId && loading && <div className={styles.loading}>Chargement des indicateurs...</div>}

      {/* ─── Empty state: no sessions ─── */}
      {athleteId && !loading && data && data.kpi.totalSessions === 0 && (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" />
          </svg>
          <div className={styles.emptyTitle}>Aucune séance planifiée</div>
          <p className={styles.emptyText}>Aucune séance trouvée pour cette période et ces filtres.</p>
          <button className={styles.ctaPrimary} onClick={() => router.push("/dashboard/coach/programmes")}>Créer une séance</button>
        </div>
      )}

      {/* ─── Data sections ─── */}
      {athleteId && !loading && data && data.kpi.totalSessions > 0 && (
        <>
          {/* ─── 2) KPI Cards ─── */}
          <div className={styles.kpiGrid}>
            {/* Adherence */}
            <div className={`${styles.kpiCard} ${styles.kpiCard_adherence}`}>
              <div className={styles.kpiLabel}>Adhérence</div>
              {data.kpi.adherence !== null ? (
                <>
                  <div className={styles.kpiValue}>
                    {data.kpi.adherence}%
                    {data.kpi.adherenceDelta !== null && data.kpi.adherenceDelta !== 0 && (
                      <span className={`${styles.kpiDelta} ${data.kpi.adherenceDelta > 0 ? styles.kpiDeltaUp : styles.kpiDeltaDown}`}>
                        {data.kpi.adherenceDelta > 0 ? "+" : ""}{data.kpi.adherenceDelta}%
                      </span>
                    )}
                  </div>
                  <div className={styles.kpiSub}>{data.kpi.realizedCount} / {data.kpi.plannedCount} séances</div>
                </>
              ) : (
                <>
                  <div className={styles.kpiValue}>—</div>
                  <div className={styles.kpiHint}>Nécessite des séances planifiées</div>
                </>
              )}
            </div>

            {/* Volume */}
            <div className={`${styles.kpiCard} ${styles.kpiCard_volume}`}>
              <div className={styles.kpiLabel}>Volume</div>
              <div className={styles.kpiValue}>{data.kpi.totalSessions}</div>
              <div className={styles.kpiSub}>séance{data.kpi.totalSessions !== 1 ? "s" : ""} · {data.kpi.totalExercises} exercice{data.kpi.totalExercises !== 1 ? "s" : ""}</div>
            </div>

            {/* Intensity */}
            <div className={`${styles.kpiCard} ${styles.kpiCard_intensity}`}>
              <div className={styles.kpiLabel}>Intensité (RPE moy.)</div>
              {data.kpi.avgRpe !== null ? (
                <>
                  <div className={styles.kpiValue}>
                    {data.kpi.avgRpe}/10
                    {data.kpi.prevAvgRpe !== null && (
                      <span className={`${styles.kpiDelta} ${data.kpi.avgRpe <= data.kpi.prevAvgRpe ? styles.kpiDeltaUp : styles.kpiDeltaDown}`}>
                        {data.kpi.avgRpe > data.kpi.prevAvgRpe ? "↑" : "↓"} vs pér. préc.
                      </span>
                    )}
                  </div>
                  <div className={styles.kpiSub}>
                    {data.kpi.avgRpe <= 3 ? "Basse" : data.kpi.avgRpe <= 6 ? "Modérée" : "Haute"}
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.kpiValue}>—</div>
                  <div className={styles.kpiHint}>Nécessite le feedback post-séance</div>
                </>
              )}
            </div>

            {/* Risk */}
            <div className={`${styles.kpiCard} ${styles[`kpiCard_risk_${data.kpi.riskLevel}`]}`}>
              <div className={styles.kpiLabel}>Risque / Alerte</div>
              <div className={styles.kpiValue}>
                {data.kpi.riskLevel === "ok" ? "OK" : data.kpi.riskLevel === "watch" ? "À surveiller" : "Alerte"}
              </div>
              {data.kpi.avgPain !== null ? (
                <div className={styles.kpiSub}>
                  Douleur moy. {data.kpi.avgPain}/10
                  {data.kpi.topPainZone && <> · {data.kpi.topPainZone}</>}
                </div>
              ) : (
                <div className={styles.kpiHint}>Nécessite le feedback post-séance</div>
              )}
            </div>
          </div>

          {/* ─── 3) Charge & Tendance ─── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              Charge &amp; Tendance
              <span className={styles.cardTitleRight}>Cliquer sur un jour pour voir les séances</span>
            </div>
            <div className={styles.chartToggles}>
              <button className={chartMode === "sessions" ? styles.chartToggleActive : styles.chartToggle} onClick={() => setChartMode("sessions")}>Séances (prévu vs réalisé)</button>
              <button className={chartMode === "rpe" ? styles.chartToggleActive : styles.chartToggle} onClick={() => setChartMode("rpe")}>RPE</button>
            </div>
            <div className={styles.chartCanvas}>
              {renderChart()}
            </div>
          </div>

          {/* ─── 4) Qualité d'exécution ─── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
              Qualité d&apos;exécution
            </div>
            <div className={styles.feedbackGrid}>
              <div className={styles.feedbackBox}>
                <div className={styles.feedbackLabel}>RPE ressenti (moyenne)</div>
                <div className={styles.feedbackValue}>{data.kpi.avgRpe !== null ? `${data.kpi.avgRpe}/10` : "—"}</div>
                <div className={styles.feedbackSub}>
                  {data.kpi.avgRpe !== null
                    ? data.kpi.avgRpe <= 3 ? "Intensité basse" : data.kpi.avgRpe <= 6 ? "Intensité modérée" : "Intensité haute"
                    : "Aucun feedback RPE"}
                </div>
              </div>
              <div className={styles.feedbackBox}>
                <div className={styles.feedbackLabel}>Douleur (moyenne)</div>
                <div className={styles.feedbackValue}>{data.kpi.avgPain !== null ? `${data.kpi.avgPain}/10` : "—"}</div>
                <div className={styles.feedbackSub}>
                  {data.kpi.topPainZone ? `Zone fréquente : ${data.kpi.topPainZone}` : "Aucune donnée douleur"}
                </div>
              </div>
            </div>

            {data.recentFeedback.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 18, marginBottom: 8 }}>Commentaires récents</div>
                <div className={styles.commentsList}>
                  {data.recentFeedback.map((fb) => (
                    <div key={fb.id} className={styles.commentItem}>
                      <div className={styles.commentMeta}>
                        <span>{fb.name} · {new Date(fb.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                        <span>
                          {fb.rpe !== null && `RPE ${fb.rpe}`}
                          {fb.pain !== null && ` · Douleur ${fb.pain}/10`}
                          {fb.painZone && ` (${fb.painZone})`}
                        </span>
                      </div>
                      <div className={styles.commentText}>&ldquo;{fb.feedback}&rdquo;</div>
                      <span className={styles.commentLink} onClick={() => router.push(`/dashboard/coach/programmes/${fb.id}`)}>Voir la séance →</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {data.recentFeedback.length === 0 && data.kpi.realizedCount > 0 && (
              <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                Aucun feedback enregistré · <span style={{ color: "#f47b20", cursor: "pointer" }}>Demander le feedback</span>
              </div>
            )}
          </div>

          {/* ─── 5) Alertes & Actions ─── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Alertes &amp; Actions
            </div>

            {data.alerts.length > 0 ? (
              <div className={styles.alertsList}>
                {data.alerts.map((a, i) => (
                  <div key={i} className={styles.alertItem}>
                    <span className={`${styles.alertDot} ${styles[`alertDot_${a.level}`]}`} />
                    <span className={styles.alertMsg}>{a.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.alertEmpty}>Aucune alerte détectée pour cette période ✓</div>
            )}

            <div className={styles.alertActions}>
              <button className={styles.alertActionBtn} onClick={() => router.push(`/dashboard/coach/programmes?athleteId=${athleteId}`)}>
                Adapter la semaine
              </button>
              <button className={styles.alertActionBtn} onClick={() => {
                router.push("/dashboard/coach/programmes");
              }}>Convertir en récup active</button>
              <button className={styles.alertActionBtn}>Relancer l&apos;athlète</button>
              <button className={styles.alertActionBtn} onClick={() => router.push("/dashboard/coach/programmes")}>
                Dupliquer la semaine précédente
              </button>
            </div>
          </div>

          {/* ─── 6) Bibliothèque / Modèles ─── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Bibliothèque / Modèles
            </div>
            <div className={styles.templatesGrid}>
              {TEMPLATES.map((tpl) => (
                <div key={tpl.name} className={styles.templateCard}>
                  <div className={styles.templateName}>{tpl.name}</div>
                  <div className={styles.templateDesc}>{tpl.desc}</div>
                  <button className={styles.templateBtn} onClick={() => router.push("/dashboard/coach/programmes")}>
                    Appliquer au programme
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── Vidéos reçues ─── */}
      {athleteId && data && (
        <div className={styles.card} style={{ marginTop: 20 }}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: "-2px", marginRight: 6 }}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              Vidéos reçues
            </h3>
            <button className={styles.filterBtn} onClick={generateLink} style={{ background: "rgba(244,123,32,0.1)", color: "#f47b20", border: "1px solid rgba(244,123,32,0.2)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Générer un lien d{"'"}upload
            </button>
          </div>

          {uploadLink && (
            <div style={{ padding: "12px 16px", margin: "0 0 12px", background: "rgba(244,123,32,0.05)", borderRadius: 10, border: "1px solid rgba(244,123,32,0.15)" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Lien à partager avec {selectedAthlete?.name || "l'athlète"} :</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  readOnly
                  value={uploadLink}
                  style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "monospace" }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(uploadLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                  className={styles.filterBtn}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {linkCopied ? "✓ Copié" : "Copier"}
                </button>
              </div>
            </div>
          )}

          {videosLoading && <div style={{ textAlign: "center", padding: 20, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Chargement...</div>}

          {!videosLoading && videos.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 20px", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" style={{ marginBottom: 8, display: "block", margin: "0 auto 8px" }}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              Aucune vidéo reçue<br/>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>Générez un lien et partagez-le avec votre athlète</span>
            </div>
          )}

          {!videosLoading && videos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {videos.map((v: any) => (
                <div
                  key={v.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 10, cursor: "pointer", transition: "all .12s",
                  }}
                  onClick={() => setPreviewVideo(v)}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                >
                  <div style={{ width: 56, height: 42, borderRadius: 6, overflow: "hidden", background: "rgba(0,0,0,0.3)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <video src={v.filePath} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted preload="metadata" />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.originalName}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "flex", gap: 8 }}>
                      <span>{formatVideoSize(v.size)}</span>
                      <span>{formatVideoDate(v.createdAt)}</span>
                    </div>
                    {v.note && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontStyle: "italic", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.note}</div>}
                  </div>
                  {!v.viewed && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f47b20", flexShrink: 0 }} title="Non visionné" />}
                  <button
                    onClick={e => { e.stopPropagation(); deleteVideo(v.id); }}
                    style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                    title="Supprimer"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Video preview modal ─── */}
      {previewVideo && (
        <div className={styles.drillOverlay} onClick={() => setPreviewVideo(null)}>
          <div style={{ background: "rgba(14,20,32,0.98)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, width: "90vw", maxWidth: 800, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{previewVideo.originalName}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{formatVideoSize(previewVideo.size)} · {formatVideoDate(previewVideo.createdAt)}{previewVideo.note ? ` · ${previewVideo.note}` : ""}</div>
              </div>
              <button onClick={() => setPreviewVideo(null)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", padding: 0 }}>
              <video
                src={previewVideo.filePath}
                controls
                autoPlay
                style={{ width: "100%", maxHeight: "calc(90vh - 80px)" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Drill-down modal ─── */}
      {drillDate && (
        <div className={styles.drillOverlay} onClick={() => setDrillDate(null)}>
          <div className={styles.drillPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drillTitle}>
              Séances du {new Date(drillDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {drillSessions.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 20 }}>Aucune séance ce jour</div>
            ) : (
              drillSessions.map((s) => (
                <div key={s.id} className={styles.drillItem} onClick={() => router.push(`/dashboard/coach/programmes/${s.id}`)}>
                  <div className={styles.drillItemInfo}>
                    <div className={styles.drillItemName}>{s.name}</div>
                    <div className={styles.drillItemMeta}>
                      {s.exerciseCount} exercice{s.exerciseCount !== 1 ? "s" : ""}
                      {s.rpeRessenti !== null && ` · RPE ${s.rpeRessenti}`}
                      {s.douleur !== null && ` · Douleur ${s.douleur}/10`}
                      {s.tags.length > 0 && ` · ${s.tags.join(", ")}`}
                    </div>
                  </div>
                  <span className={styles.drillItemStatus}>{STATUS_LABELS[s.status] || s.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
