"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";
import LegalFooter from "../components/LegalFooter";

// ── YouTube helpers ──
function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com/embed/") || url.includes("youtube.com/watch") || url.includes("youtu.be/");
}

function toYouTubeEmbed(url: string): string {
  if (url.includes("youtube.com/embed/")) return url;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch { /* ignore */ }
  return url;
}

// ── Types ──
interface ProConnection {
  id: string;
  status: string;
  professionnel: {
    id: string;
    nom: string;
    prenom: string;
    specialite: string;
    avatarUrl: string | null;
  };
}

interface VideoInfo {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  category: string;
  duration: number | null;
  description: string | null;
}

interface PlanExercise {
  id: string;
  position: number;
  sets: number | null;
  reps: string | null;
  duration: string | null;
  tempo: string | null;
  rest: string | null;
  frequency: string | null;
  painThreshold: number | null;
  consignes: string | null;
  equipment: string | null;
  alternative: string | null;
  video: VideoInfo;
  logsCount: number;
}

interface KinePlan {
  id: string;
  title: string;
  objective: string | null;
  pathology: string | null;
  phase: string | null;
  status: string;
  progress: number;
  globalProgress: number | null;
  notesPatient: string | null;
  startDate: string | null;
  endDate: string | null;
  frequency: string | null;
  nextRdvDate: string | null;
  nextRdvTime: string | null;
  nextRdvLocation: string | null;
  conclusion: string | null;
  outcomeScore: number | null;
  totalLogs: number;
  proName: string | null;
  exercises: PlanExercise[];
  createdAt: string;
  updatedAt: string;
}

interface AlertItem {
  id: string;
  type: string;
  status: string;
  origin: string;
  title: string;
  description: string | null;
  intensity: number | null;
  closedAt: string | null;
  planId: string | null;
  planTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ──
const CATEGORIES = [
  { value: "dos", label: "Dos" }, { value: "epaules", label: "Épaules" },
  { value: "genoux", label: "Genoux" }, { value: "cervicales", label: "Cervicales" },
  { value: "chevilles", label: "Chevilles" }, { value: "hanches", label: "Hanches" },
  { value: "poignet", label: "Poignet" }, { value: "global", label: "Global" },
];

function catLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label || value;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "En cours", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  paused: { label: "Pause", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  completed: { label: "Terminé", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  archived: { label: "Archivé", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

type Tab = "suivi" | "signalements" | "historique";

// ── Helpers ──
function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d: string | null, t: string | null): string {
  if (!d) return "—";
  const date = fmtDate(d);
  return t ? `${date} à ${t}` : date;
}
function weeksBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

// ══════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════
export default function AthleteSuiviPage() {
  const router = useRouter();

  // ── State: connections ──
  const [connections, setConnections] = useState<ProConnection[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [proId, setProId] = useState<string>("");

  // ── State: tab ──
  const [tab, setTab] = useState<Tab>("suivi");

  // ── State: plans & alerts ──
  const [plans, setPlans] = useState<KinePlan[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // ── State: exercise video player ──
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── State: exercise log modal ──
  const [logExercise, setLogExercise] = useState<{ exerciseId: string; planId: string; videoTitle: string } | null>(null);

  // ── State: alert modal ──
  const [showCreateAlert, setShowCreateAlert] = useState(false);

  // Selected pro info
  const selectedPro = connections.find(c => c.professionnel.id === proId);

  // Derived plan lists
  const activePlans = plans.filter(p => p.status === "active" || p.status === "paused");
  const historyPlans = plans.filter(p => p.status === "completed" || p.status === "archived");

  // Alert counts
  const openAlertsCount = alerts.filter(a => a.status !== "closed").length;

  // ── Fetch connections ──
  useEffect(() => {
    fetch("/api/athlete/my-connections")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.connections) return;
        const accepted = data.connections.filter((c: ProConnection) => c.status === "accepted");
        setConnections(accepted);
        // Auto-select first pro if only one
        if (accepted.length === 1) {
          setProId(accepted[0].professionnel.id);
        }
      })
      .catch(() => {})
      .finally(() => setConnLoading(false));
  }, []);

  // ── Fetch plans when proId changes ──
  const fetchPlans = useCallback(() => {
    if (!proId) { setPlans([]); return; }
    setPlansLoading(true);
    fetch(`/api/athlete/kine-plans?proId=${proId}`)
      .then(r => r.ok ? r.json() : { plans: [] })
      .then(data => setPlans(data.plans || []))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, [proId]);

  // ── Fetch alerts when proId changes ──
  const fetchAlerts = useCallback(() => {
    if (!proId) { setAlerts([]); return; }
    setAlertsLoading(true);
    fetch(`/api/athlete/alerts?proId=${proId}`)
      .then(r => r.ok ? r.json() : { alerts: [] })
      .then(data => setAlerts(data.alerts || []))
      .catch(() => setAlerts([]))
      .finally(() => setAlertsLoading(false));
  }, [proId]);

  useEffect(() => { fetchPlans(); fetchAlerts(); }, [fetchPlans, fetchAlerts]);

  // ── Loading ──
  if (connLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.loadingText}>Chargement…</p>
      </div>
    );
  }

  // ── No connections ──
  if (connections.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Mon Suivi</h1>
        </div>
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <p>Aucun professionnel connecté</p>
          <button className={styles.btnPrimary} onClick={() => router.push("/dashboard/athlete")}>
            Trouver un professionnel
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════
  return (
    <div className={styles.page}>
      {/* ── Header + Pro Selector ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Mon Suivi</h1>
        <div className={styles.headerControls}>
          <select
            className={styles.proSelect}
            value={proId}
            onChange={e => { setProId(e.target.value); setTab("suivi"); setPlayingVideo(null); }}
          >
            <option value="">Sélectionner un professionnel</option>
            {connections.map(c => (
              <option key={c.professionnel.id} value={c.professionnel.id}>
                {c.professionnel.prenom} {c.professionnel.nom} — {c.professionnel.specialite}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Pro banner ── */}
      {selectedPro && (
        <div className={styles.proBanner}>
          <div className={styles.proBannerAvatar}>
            {selectedPro.professionnel.prenom[0]}{selectedPro.professionnel.nom[0]}
          </div>
          <div>
            <div className={styles.proBannerName}>
              {selectedPro.professionnel.prenom} {selectedPro.professionnel.nom}
            </div>
            <div className={styles.proBannerSpec}>{selectedPro.professionnel.specialite}</div>
          </div>
        </div>
      )}

      {/* ── No pro selected ── */}
      {!proId && (
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          <p>Sélectionnez un professionnel pour voir votre suivi</p>
        </div>
      )}

      {/* ── Tabs + content when pro selected ── */}
      {proId && (
        <>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === "suivi" ? styles.tabActive : ""}`}
              onClick={() => setTab("suivi")}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              Mon Suivi
            </button>
            <button
              className={`${styles.tab} ${tab === "signalements" ? styles.tabActive : ""}`}
              onClick={() => setTab("signalements")}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              Mes Signalements
              {openAlertsCount > 0 && <span className={styles.tabBadge}>{openAlertsCount}</span>}
            </button>
            <button
              className={`${styles.tab} ${tab === "historique" ? styles.tabActive : ""}`}
              onClick={() => setTab("historique")}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg>
              Mon Historique
            </button>
          </div>

          {/* ═══════ TAB 1: MON SUIVI ═══════ */}
          {tab === "suivi" && (
            <div className={styles.section}>
              {plansLoading ? (
                <p className={styles.loadingText}>Chargement…</p>
              ) : activePlans.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <p>Aucun programme en cours</p>
                </div>
              ) : (
                <div className={styles.plansList}>
                  {activePlans.map(plan => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      playingVideo={playingVideo}
                      setPlayingVideo={setPlayingVideo}
                      videoRef={videoRef}
                      onLog={(exerciseId, planId, videoTitle) => setLogExercise({ exerciseId, planId, videoTitle })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ TAB 2: MES SIGNALEMENTS ═══════ */}
          {tab === "signalements" && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Mes signalements</h3>
                <button className={styles.btnPrimary} onClick={() => setShowCreateAlert(true)}>
                  + Signaler un problème
                </button>
              </div>

              {alertsLoading ? (
                <p className={styles.loadingText}>Chargement…</p>
              ) : alerts.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <p>Aucun signalement</p>
                </div>
              ) : (
                <AlertsList alerts={alerts} />
              )}
            </div>
          )}

          {/* ═══════ TAB 3: MON HISTORIQUE ═══════ */}
          {tab === "historique" && (
            <div className={styles.section}>
              {plansLoading ? (
                <p className={styles.loadingText}>Chargement…</p>
              ) : historyPlans.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg>
                  <p>Aucun historique de rééducation</p>
                </div>
              ) : (
                <HistoryList plans={historyPlans} />
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════ MODALS ═══════ */}

      {/* Log Exercise Modal */}
      {logExercise && (
        <LogExerciseModal
          exerciseId={logExercise.exerciseId}
          planId={logExercise.planId}
          videoTitle={logExercise.videoTitle}
          onClose={() => setLogExercise(null)}
          onLogged={() => { setLogExercise(null); fetchPlans(); }}
        />
      )}

      {/* Create Alert Modal */}
      {showCreateAlert && (
        <CreateAlertModal
          proId={proId}
          plans={activePlans}
          onClose={() => setShowCreateAlert(false)}
          onCreated={() => { setShowCreateAlert(false); fetchAlerts(); }}
        />
      )}

      <LegalFooter />
    </div>
  );
}

// ══════════════════════════════════════════════
// PLAN CARD (Mon Suivi tab)
// ══════════════════════════════════════════════
function PlanCard({ plan, playingVideo, setPlayingVideo, videoRef, onLog }: {
  plan: KinePlan;
  playingVideo: string | null;
  setPlayingVideo: (id: string | null) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onLog: (exerciseId: string, planId: string, videoTitle: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const status = STATUS_MAP[plan.status];

  return (
    <div className={styles.planCard}>
      {/* Header */}
      <div className={styles.planCardHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.planCardLeft}>
          <h3 className={styles.planCardTitle}>{plan.title}</h3>
          <div className={styles.planCardMeta}>
            {plan.pathology && <span className={styles.chipOrange}>{plan.pathology}</span>}
            {status && (
              <span className={styles.badge} style={{ color: status.color, borderColor: status.color, background: status.bg }}>
                {status.label}
              </span>
            )}
            {plan.phase && <span className={styles.chipPhase}>{plan.phase}</span>}
          </div>
        </div>
        <div className={styles.planCardRight}>
          <div className={styles.progressBlock}>
            <span className={styles.progressValue}>{plan.progress}%</span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${plan.progress}%` }} />
            </div>
          </div>
          <span className={styles.expandIcon}>{expanded ? "▾" : "▸"}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.planCardBody}>
          {/* Info grid */}
          <div className={styles.infoGrid}>
            {plan.objective && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Objectif</span>
                <span className={styles.infoValue}>{plan.objective}</span>
              </div>
            )}
            {plan.frequency && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Fréquence</span>
                <span className={styles.infoValue}>{plan.frequency}</span>
              </div>
            )}
            {plan.startDate && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Début</span>
                <span className={styles.infoValue}>{fmtDate(plan.startDate)}</span>
              </div>
            )}
            {plan.endDate && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Fin prévue</span>
                <span className={styles.infoValue}>
                  {fmtDate(plan.endDate)}
                  {plan.startDate && plan.endDate && (() => { const w = weeksBetween(plan.startDate, plan.endDate); return w ? ` (${w} sem.)` : ""; })()}
                </span>
              </div>
            )}
          </div>

          {/* Next RDV */}
          {plan.nextRdvDate && (
            <div className={styles.rdvCard}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              <div>
                <span className={styles.rdvLabel}>Prochain RDV</span>
                <span className={styles.rdvValue}>{fmtDateTime(plan.nextRdvDate, plan.nextRdvTime)}</span>
                {plan.nextRdvLocation && <span className={styles.rdvLocation}>{plan.nextRdvLocation}</span>}
              </div>
            </div>
          )}

          {/* Notes patient */}
          {plan.notesPatient && (
            <div className={styles.notesBlock}>
              <span className={styles.notesLabel}>Instructions de votre kiné</span>
              <p className={styles.notesText}>{plan.notesPatient}</p>
            </div>
          )}

          {/* Exercises */}
          {plan.exercises.length > 0 && (
            <div className={styles.exercisesSection}>
              <h4 className={styles.exercisesTitle}>Exercices prescrits ({plan.exercises.length})</h4>
              <div className={styles.exercisesList}>
                {plan.exercises.map((ex, i) => (
                  <div key={ex.id} className={styles.exCard}>
                    <div className={styles.exCardTop}>
                      <div className={styles.exCardLeft}>
                        <span className={styles.exPos}>{i + 1}</span>
                        <div className={styles.exCardInfo}>
                          <span className={styles.exName}>{ex.video.title}</span>
                          <span className={styles.exCat}>{catLabel(ex.video.category)}</span>
                        </div>
                      </div>
                      <div className={styles.exCardActions}>
                        <button
                          className={`${styles.exActionBtn} ${styles.exPlayBtn}`}
                          onClick={() => setPlayingVideo(playingVideo === ex.video.id ? null : ex.video.id)}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          Vidéo
                        </button>
                        {(plan.status === "active" || plan.status === "paused") && (
                          <button
                            className={`${styles.exActionBtn} ${styles.exLogBtn}`}
                            onClick={() => onLog(ex.id, plan.id, ex.video.title)}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                            Logger
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Params pills */}
                    <div className={styles.exParams}>
                      {ex.sets && <span className={styles.exParam}>{ex.sets} séries</span>}
                      {ex.reps && <span className={styles.exParam}>{ex.reps} reps</span>}
                      {ex.duration && <span className={styles.exParam}>{ex.duration}</span>}
                      {ex.tempo && <span className={styles.exParam}>Tempo {ex.tempo}</span>}
                      {ex.rest && <span className={styles.exParam}>Repos {ex.rest}</span>}
                      {ex.frequency && <span className={styles.exParam}>{ex.frequency}</span>}
                      {ex.painThreshold !== null && <span className={styles.exParam}>Douleur max {ex.painThreshold}/10</span>}
                      {ex.equipment && <span className={styles.exParam}>{ex.equipment}</span>}
                    </div>

                    {/* Consignes */}
                    {ex.consignes && (
                      <div className={styles.exConsignes}>
                        <strong>CONSIGNES</strong>
                        <p>{ex.consignes}</p>
                      </div>
                    )}

                    {/* Alternative */}
                    {ex.alternative && (
                      <div className={styles.exAlternative}>
                        <strong>ALTERNATIVE / RÉGRESSION</strong>
                        <p>{ex.alternative}</p>
                      </div>
                    )}

                    {/* Inline video player */}
                    {playingVideo === ex.video.id && (
                      <div className={styles.exPlayerWrap}>
                        {isYouTubeUrl(ex.video.url) ? (
                          <iframe
                            src={`${toYouTubeEmbed(ex.video.url)}?autoplay=1`}
                            className={styles.exIframe}
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                            style={{ border: "none" }}
                          />
                        ) : (
                          <video ref={videoRef} src={ex.video.url} controls autoPlay className={styles.exIframe} />
                        )}
                        <button className={styles.exClosePlayer} onClick={() => setPlayingVideo(null)}>×</button>
                      </div>
                    )}

                    {/* Log badge */}
                    {ex.logsCount > 0 && (
                      <span className={styles.exLogBadge}>{ex.logsCount} session{ex.logsCount > 1 ? "s" : ""} effectuée{ex.logsCount > 1 ? "s" : ""}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// ALERTS LIST (Mes Signalements tab)
// ══════════════════════════════════════════════
function AlertsList({ alerts }: { alerts: AlertItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const statusLabel = (s: string) => {
    if (s === "closed") return "Traité";
    if (s === "to_treat") return "En cours";
    return "En attente";
  };

  return (
    <div className={styles.alertList}>
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`${styles.alertItem} ${openId === alert.id ? styles.alertItemOpen : ""}`}
          onClick={() => setOpenId(openId === alert.id ? null : alert.id)}
        >
          <div className={styles.alertItemHead}>
            <span
              className={styles.alertDot}
              style={{ background: alert.status === "closed" ? "#22c55e" : alert.type === "alert" ? "#ef4444" : "#3b82f6" }}
            />
            <div className={styles.alertItemInfo}>
              <div className={styles.alertItemTitle}>{alert.title}</div>
              <div className={styles.alertItemMeta}>
                {statusLabel(alert.status)} · {fmtDate(alert.createdAt)}
                {alert.intensity !== null && ` · Intensité ${alert.intensity}/10`}
              </div>
            </div>
            <span
              className={styles.alertStatusBadge}
              style={{
                color: alert.status === "closed" ? "#22c55e" : "#f59e0b",
                borderColor: alert.status === "closed" ? "#22c55e" : "#f59e0b",
              }}
            >
              {statusLabel(alert.status)}
            </span>
          </div>

          {openId === alert.id && (
            <div className={styles.alertDetail} onClick={e => e.stopPropagation()}>
              {alert.description && <p className={styles.alertDesc}>{alert.description}</p>}
              {alert.planTitle && <div className={styles.alertPlan}>Programme lié : {alert.planTitle}</div>}
              {alert.closedAt && <div className={styles.alertClosed}>Traité le {fmtDate(alert.closedAt)}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// HISTORY LIST (Mon Historique tab)
// ══════════════════════════════════════════════
function HistoryList({ plans }: { plans: KinePlan[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className={styles.histGrid}>
      {plans.map(plan => {
        const status = STATUS_MAP[plan.status];
        const open = openId === plan.id;
        return (
          <div
            key={plan.id}
            className={`${styles.histCard} ${open ? styles.histCardOpen : ""}`}
            onClick={() => setOpenId(open ? null : plan.id)}
          >
            <div className={styles.histCardTop}>
              <div>
                <div className={styles.histTitle}>{plan.title}</div>
                {plan.pathology && <div className={styles.histPathology}>{plan.pathology}</div>}
              </div>
              {status && (
                <span className={styles.badge} style={{ color: status.color, borderColor: status.color, background: status.bg }}>
                  {status.label}
                </span>
              )}
            </div>
            <div className={styles.histMeta}>
              <span>{fmtDate(plan.startDate)} → {fmtDate(plan.endDate)}</span>
              {plan.startDate && plan.endDate && (() => { const w = weeksBetween(plan.startDate, plan.endDate); return w ? <span>{w} sem.</span> : null; })()}
              {plan.outcomeScore !== null && <span className={styles.histScore}>{plan.outcomeScore}% succès</span>}
            </div>

            {open && (
              <div className={styles.histDetail} onClick={e => e.stopPropagation()}>
                {plan.phase && <div className={styles.histRow}><strong>Phase finale :</strong> {plan.phase}</div>}
                {plan.progress > 0 && <div className={styles.histRow}><strong>Progression :</strong> {plan.progress}%</div>}
                {plan.objective && <div className={styles.histRow}><strong>Objectif :</strong> {plan.objective}</div>}
                {plan.conclusion && <div className={styles.histRow}><strong>Conclusion :</strong> {plan.conclusion}</div>}

                {plan.exercises.length > 0 && (
                  <>
                    <div className={styles.histRow}><strong>Exercices prescrits :</strong> {plan.exercises.length}</div>
                    <div className={styles.histExList}>
                      {plan.exercises.map(ex => (
                        <div key={ex.id} className={styles.histExItem}>
                          <span>{ex.video.title}</span>
                          <span className={styles.muted}>{catLabel(ex.video.category)} · {ex.sets || "—"}×{ex.reps || ex.duration || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════
// LOG EXERCISE MODAL
// ══════════════════════════════════════════════
function sliderColor(value: number, palette: "pain" | "difficulty"): string {
  if (palette === "pain") return value <= 3 ? "#22c55e" : value <= 6 ? "#f59e0b" : "#ef4444";
  return value <= 3 ? "#22c55e" : value <= 6 ? "#3b82f6" : "#a855f7";
}

function LogExerciseModal({ exerciseId, planId, videoTitle, onClose, onLogged }: {
  exerciseId: string; planId: string; videoTitle: string; onClose: () => void; onLogged: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [done, setDone] = useState(true);
  const [pain, setPain] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      const res = await fetch("/api/athlete/exercise-log", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId, planId, done, pain, difficulty, comment: comment.trim() || null, date }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur"); setSaving(false); return;
      }
      setSuccess(true); setSaving(false);
      setTimeout(onLogged, 600);
    } catch { setError("Erreur réseau"); setSaving(false); }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Logger un exercice</h3>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        {success ? (
          <div className={styles.modalSuccess}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Session enregistrée !</span>
          </div>
        ) : (
          <>
            <div className={styles.modalBody}>
              <div className={styles.logExName}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                {videoTitle}
              </div>
              <div className={styles.logDoneToggle}>
                <button className={`${styles.logDoneBtn} ${done ? styles.logDoneBtnActive : ""}`} onClick={() => setDone(true)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg> Fait
                </button>
                <button className={`${styles.logDoneBtn} ${!done ? styles.logDoneBtnNotDone : ""}`} onClick={() => setDone(false)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> Pas fait
                </button>
              </div>
              <div className={styles.logSlider}>
                <div className={styles.logSliderHeader}><label>Douleur ressentie</label><span className={styles.logSliderValue} style={{ color: sliderColor(pain, "pain") }}>{pain}/10</span></div>
                <input type="range" min="0" max="10" value={pain} onChange={e => setPain(Number(e.target.value))} className={styles.logRange} style={{ accentColor: sliderColor(pain, "pain") }} />
                <div className={styles.logSliderLabels}><span>Aucune</span><span>Insupportable</span></div>
              </div>
              <div className={styles.logSlider}>
                <div className={styles.logSliderHeader}><label>Difficulté perçue</label><span className={styles.logSliderValue} style={{ color: sliderColor(difficulty, "difficulty") }}>{difficulty}/10</span></div>
                <input type="range" min="0" max="10" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} className={styles.logRange} style={{ accentColor: sliderColor(difficulty, "difficulty") }} />
                <div className={styles.logSliderLabels}><span>Facile</span><span>Très difficile</span></div>
              </div>
              <div className={styles.field}><label>Commentaire libre (optionnel)</label><textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Sensation, remarque, progression..." /></div>
              <div className={styles.field}><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayStr} /></div>
              {error && <p className={styles.fieldError}>{error}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
              <button className={styles.btnPrimary} onClick={submit} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer la session"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// CREATE ALERT MODAL
// ══════════════════════════════════════════════
function CreateAlertModal({ proId, plans, onClose, onCreated }: {
  proId: string; plans: KinePlan[]; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [intensity, setIntensity] = useState(0);
  const [planId, setPlanId] = useState(plans.length === 1 ? plans[0].id : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!title.trim()) { setError("Titre requis"); return; }
    setError(""); setSaving(true);
    try {
      const res = await fetch("/api/athlete/alerts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proId, title: title.trim(), description: description.trim() || null, intensity, planId: planId || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur"); setSaving(false); return;
      }
      setSuccess(true); setSaving(false);
      setTimeout(onCreated, 600);
    } catch { setError("Erreur réseau"); setSaving(false); }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Signaler un problème</h3>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        {success ? (
          <div className={styles.modalSuccess}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Signalement envoyé !</span>
          </div>
        ) : (
          <>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>Titre *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Douleur au genou pendant l'exercice..." />
              </div>
              <div className={styles.field}>
                <label>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Décrivez le problème en détail..." />
              </div>
              <div className={styles.logSlider}>
                <div className={styles.logSliderHeader}><label>Intensité de la douleur</label><span className={styles.logSliderValue} style={{ color: sliderColor(intensity, "pain") }}>{intensity}/10</span></div>
                <input type="range" min="0" max="10" value={intensity} onChange={e => setIntensity(Number(e.target.value))} className={styles.logRange} style={{ accentColor: sliderColor(intensity, "pain") }} />
                <div className={styles.logSliderLabels}><span>Aucune</span><span>Insupportable</span></div>
              </div>
              {plans.length > 0 && (
                <div className={styles.field}>
                  <label>Programme lié</label>
                  <select value={planId} onChange={e => setPlanId(e.target.value)}>
                    <option value="">Aucun</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              )}
              {error && <p className={styles.fieldError}>{error}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
              <button className={styles.btnPrimary} onClick={submit} disabled={saving || !title.trim()}>{saving ? "Envoi..." : "Envoyer le signalement"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
