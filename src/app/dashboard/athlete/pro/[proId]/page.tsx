"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "./page.module.scss";
import LegalFooter from "../../components/LegalFooter";

import type { ProInfo, Rdv, KinePlan, DocItem, AlertItem, PlanExercise, Tab } from "./components/types";
import {
  getSpecConfig, CATEGORIES, catLabel,
  isYouTubeUrl, toYouTubeEmbed,
  STATUS_LABELS, STATUS_COLORS,
  formatDate, formatTime, formatShort, formatRelative,
} from "./components/types";

import {
  TabSeances, TabIndicateurs, TabNutriPlan, TabNutriBilan, TabMedSuivi, TabMedIndicateurs,
  LogExerciseModal, CreateAlertModal, UploadDocModal,
  AlertsList, HistoryList, DocumentsList,
} from "./components";

export default function AthleteProPage() {
  const router = useRouter();
  const params = useParams();
  const proId = params.proId as string;

  const [pro, setPro] = useState<ProInfo | null>(null);
  const [connectedSince, setConnectedSince] = useState<string | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [loading, setLoading] = useState(true);
  const [rdvLoading, setRdvLoading] = useState(true);

  const specConfig = pro ? getSpecConfig(pro.specialite) : null;

  const [plans, setPlans] = useState<KinePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("programmes");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [logExercise, setLogExercise] = useState<{ exerciseId: string; planId: string; videoTitle: string } | null>(null);
  const [videoSearch, setVideoSearch] = useState("");
  const [videoCategory, setVideoCategory] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Suivi: alerts
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [showCreateAlert, setShowCreateAlert] = useState(false);

  // Documents
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [showUploadDoc, setShowUploadDoc] = useState(false);

  // Fetch pro info from connections
  useEffect(() => {
    fetch("/api/athlete/my-connections")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.connections) return;
        const conn = data.connections.find((c: any) => c.status === "accepted" && c.professionnel.id === proId);
        if (conn) {
          setPro(conn.professionnel);
          setConnectedSince(conn.respondedAt || conn.createdAt);
          // Set default tab based on specialty
          const cfg = getSpecConfig(conn.professionnel.specialite);
          if (cfg.hasNutriPlan) setActiveTab("nutriplan");
          else if (cfg.hasIndicateurs) setActiveTab("indicateurs");
          else if (cfg.hasSeances) setActiveTab("seances");
          else if (cfg.hasMedSuivi) setActiveTab("medsuivi");
          else if (!cfg.hasProgrammes) setActiveTab("suivi");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proId]);

  // Fetch RDVs filtered for this pro
  useEffect(() => {
    fetch("/api/athlete/next-rdv")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.appointments) {
          const filtered = data.appointments.filter((a: Rdv) => a.pro.id === proId);
          setRdvs(filtered);
        }
      })
      .catch(() => {})
      .finally(() => setRdvLoading(false));
  }, [proId]);

  // Fetch kine plans for this pro
  const refreshPlans = () => {
    fetch(`/api/athlete/kine-plans?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.plans) setPlans(data.plans);
      })
      .catch(() => {});
  };

  const refreshAlerts = () => {
    fetch(`/api/athlete/alerts?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.alerts) setAlerts(data.alerts); })
      .catch(() => {})
      .finally(() => setAlertsLoading(false));
  };

  const refreshDocs = () => {
    fetch(`/api/athlete/documents?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.documents) setDocs(data.documents); })
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  };

  useEffect(() => {
    refreshPlans();
    setPlansLoading(false);
    refreshAlerts();
    refreshDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proId]);

  // Collect all exercises from all plans for the "Mes Exercices" tab
  const allExercises: (PlanExercise & { planTitle: string; planId: string })[] = [];
  plans.forEach((p) => {
    p.exercises.forEach((ex) => {
      allExercises.push({ ...ex, planTitle: p.title, planId: p.id });
    });
  });

  // Deduplicate videos by video id (show unique videos)
  const uniqueVideos = new Map<string, (typeof allExercises)[0]>();
  allExercises.forEach((ex) => {
    if (!uniqueVideos.has(ex.video.id)) {
      uniqueVideos.set(ex.video.id, ex);
    }
  });
  // Apply search + category filters
  const videoList = Array.from(uniqueVideos.values()).filter((ex) => {
    if (videoCategory && ex.video.category !== videoCategory) return false;
    if (videoSearch.trim()) {
      const q = videoSearch.trim().toLowerCase();
      if (!ex.video.title.toLowerCase().includes(q) && !ex.video.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activePlans = plans.filter((p) => p.status === "active" || p.status === "paused");
  const completedPlans = plans.filter((p) => p.status === "completed" || p.status === "archived");

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.loadingText}>Chargement…</p>
        </div>
      </div>
    );
  }

  if (!pro) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <button className={styles.backBtn} onClick={() => router.push("/dashboard/athlete")}>← Retour</button>
          <div className={styles.emptyState}>
            <p>Professionnel introuvable ou connexion non active.</p>
          </div>
        </div>
      </div>
    );
  }

  const initials = `${pro.prenom[0]}${pro.nom[0]}`.toUpperCase();
  const sc = specConfig!;

  // ── Render a plan card (used by both active & completed groups) ──
  const renderPlanCard = (plan: KinePlan, isCompleted = false) => {
    const color = STATUS_COLORS[plan.status] || "#6b7280";
    const label = STATUS_LABELS[plan.status] || plan.status;
    const isOpen = expandedPlan === plan.id;

    return (
      <div key={plan.id} className={`${styles.planCard} ${isCompleted ? styles.planCardCompleted : ""}`}>
        {/* ── Card header (always visible) ── */}
        <div className={styles.planCardHeader} onClick={() => setExpandedPlan(isOpen ? null : plan.id)}>
          <div className={styles.planCardLeft}>
            <div className={styles.planCardTop}>
              <span className={styles.planTitle}>{plan.title}</span>
              <span className={styles.planBadge} style={{ background: `${color}20`, color, borderColor: `${color}40` }}>{label}</span>
            </div>
            {plan.objective && <p className={styles.planObj}>{plan.objective}</p>}
            <div className={styles.planMeta}>
              <span>{plan.exercises.length} exercice{plan.exercises.length !== 1 ? "s" : ""}</span>
              {plan.frequency && <span>· {plan.frequency}</span>}
              <span>· Modifié {formatRelative(plan.updatedAt)}</span>
              {plan.proName && <span>· {plan.proName}</span>}
            </div>
          </div>
          {plan.progress > 0 && (
            <div className={styles.planProgress}>
              <div className={styles.planProgressBar}>
                <div className={styles.planProgressFill} style={{ width: `${plan.progress}%` }} />
              </div>
              <span className={styles.planProgressLabel}>{plan.progress}%</span>
            </div>
          )}
          <svg className={`${styles.planChevron} ${isOpen ? styles.planChevronOpen : ""}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </div>

        {/* ── Detail panel (expanded) ── */}
        {isOpen && (
          <div className={styles.planBody}>
            {/* Info rows */}
            <div className={styles.planDetailInfo}>
              {plan.objective && (
                <div className={styles.planInfoRow}>
                  <span className={styles.planInfoLabel}>Objectif</span>
                  <span>{plan.objective}</span>
                </div>
              )}
              <div className={styles.planInfoRow}>
                <span className={styles.planInfoLabel}>Statut</span>
                <span className={styles.planBadge} style={{ background: `${color}20`, color, borderColor: `${color}40` }}>{label}</span>
              </div>
              {plan.frequency && (
                <div className={styles.planInfoRow}>
                  <span className={styles.planInfoLabel}>Fréquence</span>
                  <span>{plan.frequency}</span>
                </div>
              )}
              {plan.startDate && (
                <div className={styles.planInfoRow}>
                  <span className={styles.planInfoLabel}>Début</span>
                  <span>{formatShort(plan.startDate)}</span>
                </div>
              )}
              {plan.endDate && (
                <div className={styles.planInfoRow}>
                  <span className={styles.planInfoLabel}>Fin</span>
                  <span>{formatShort(plan.endDate)}</span>
                </div>
              )}
              {plan.proName && (
                <div className={styles.planInfoRow}>
                  <span className={styles.planInfoLabel}>Prescrit par</span>
                  <span>{plan.proName}</span>
                </div>
              )}
            </div>

            {/* notesPatient → dynamic instructions label */}
            {plan.notesPatient && (
              <div className={styles.planInstructions}>
                <strong>{sc.instructionsLabel}</strong>
                <p>{plan.notesPatient}</p>
              </div>
            )}

            {/* Conclusion (for completed plans) */}
            {plan.conclusion && (
              <div className={styles.planConclusion}>
                <strong>Conclusion</strong>
                <p>{plan.conclusion}</p>
              </div>
            )}

            {/* Exercise list */}
            <div className={styles.planExSection}>
              <h4 className={styles.planExHeader}>Exercices ({plan.exercises.length})</h4>
              {plan.exercises.length === 0 ? (
                <p className={styles.planExEmpty}>Aucun exercice dans ce programme.</p>
              ) : (
                <div className={styles.planExercises}>
                  {plan.exercises.map((ex, i) => (
                    <div key={ex.id} className={styles.exCard}>
                      {/* ── Row 1: position + name + category + play/log buttons ── */}
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
                            title="Lire la vidéo"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            Vidéo
                          </button>
                          {plan.status === "active" && (
                            <button
                              className={`${styles.exActionBtn} ${styles.exLogBtn}`}
                              onClick={() => setLogExercise({ exerciseId: ex.id, planId: plan.id, videoTitle: ex.video.title })}
                              title="Logger cet exercice"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                              Logger
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ── Inline video player ── */}
                      {playingVideo === ex.video.id && (
                        <div className={styles.exPlayerWrap}>
                          {isYouTubeUrl(ex.video.url) ? (
                            <iframe
                              src={`${toYouTubeEmbed(ex.video.url)}?autoplay=1`}
                              className={styles.exPlayerIframe}
                              allow="autoplay; encrypted-media"
                              allowFullScreen
                            />
                          ) : (
                            <video ref={videoRef} src={ex.video.url} controls autoPlay className={styles.exPlayerVideo} />
                          )}
                          <button className={styles.exPlayerClose} onClick={() => setPlayingVideo(null)}>×</button>
                        </div>
                      )}

                      {/* ── Row 2: exercise parameters ── */}
                      <div className={styles.exParams}>
                        {ex.sets && <span className={styles.exParam}>{ex.sets} séries</span>}
                        {ex.reps && <span className={styles.exParam}>{ex.reps} reps</span>}
                        {ex.duration && <span className={styles.exParam}>{ex.duration}</span>}
                        {ex.tempo && <span className={styles.exParam}>Tempo {ex.tempo}</span>}
                        {ex.rest && <span className={styles.exParam}>Repos {ex.rest}</span>}
                        {ex.frequency && <span className={styles.exParam}>{ex.frequency}</span>}
                        {ex.painThreshold != null && <span className={styles.exParam}>Douleur max {ex.painThreshold}/10</span>}
                        {ex.equipment && <span className={styles.exParam}>{ex.equipment}</span>}
                      </div>

                      {/* ── Consignes spécifiques ── */}
                      {ex.consignes && (
                        <div className={styles.exConsignes}>
                          <strong>Consignes</strong>
                          <p>{ex.consignes}</p>
                        </div>
                      )}

                      {/* ── Alternative / régression ── */}
                      {ex.alternative && (
                        <div className={styles.exAlternative}>
                          <strong>Alternative / Régression</strong>
                          <p>{ex.alternative}</p>
                        </div>
                      )}

                      {/* ── Session log badge ── */}
                      {ex.logsCount > 0 && (
                        <div className={styles.exLogBadge}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                          {ex.logsCount} session{ex.logsCount > 1 ? "s" : ""} effectuée{ex.logsCount > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {/* ── Banner ── */}
      <div className={styles.banner}>
        {pro.avatarUrl ? (
          <img src={pro.avatarUrl} alt={`${pro.prenom} ${pro.nom}`} className={styles.bannerImg} />
        ) : (
          <div className={styles.bannerFallback}>
            <span>{initials}</span>
          </div>
        )}
        <div className={styles.bannerFade} />
        <button className={styles.backBtn} onClick={() => router.push("/dashboard/athlete")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Mes Professionnels
        </button>
        <div className={styles.bannerInfo}>
          <h1 className={styles.proName}>{pro.prenom} {pro.nom}</h1>
          <span className={styles.proSpec}>{sc.label}</span>
          {connectedSince && (
            <span className={styles.proSince}>
              Connecté depuis le {new Date(connectedSince).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
        </div>
      </div>

      <div className={styles.container}>
        {/* ── Prochains RDV ── */}
        <section className={styles.rdvSection}>
          <h2 className={styles.sectionTitle}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            {sc.rdvLabel}
          </h2>

          {rdvLoading ? (
            <p className={styles.loadingText}>Chargement…</p>
          ) : rdvs.length > 0 ? (
            <div className={styles.rdvList}>
              {rdvs.map((rdv, i) => (
                <div key={rdv.id} className={`${styles.nextRdvCard} ${i === 0 ? styles.nextRdvCardFirst : ""}`}>
                  <div className={styles.nextRdvContent}>
                    <div className={styles.nextRdvDate}>
                      <span className={styles.nextRdvDay}>{formatDate(rdv.date)}</span>
                      <span className={styles.nextRdvTime}>
                        {formatTime(rdv.date)}
                        {rdv.endDate ? ` – ${formatTime(rdv.endDate)}` : ""}
                      </span>
                    </div>
                    <div className={styles.nextRdvInfo}>
                      <span className={styles.nextRdvTitle}>{rdv.title}</span>
                      {rdv.format && (
                        <span className={styles.nextRdvFormat}>
                          {rdv.format === "teleconsultation" ? "Téléconsultation" : "Présentiel"}
                        </span>
                      )}
                      {rdv.description && <span className={styles.nextRdvDesc}>{rdv.description}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.rdvEmpty}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              <span>Aucun rendez-vous à venir</span>
              <button className={styles.rdvBookBtn} onClick={() => router.push(`/dashboard/athlete/mes-rdv?action=quick-book&proId=${proId}`)}>
                Prendre rendez-vous
              </button>
            </div>
          )}
        </section>

        {/* ── Tabs (conditional based on specialty) ── */}
        <div className={`${styles.tabs} ${sc.hasIndicateurs || sc.hasNutriPlan ? styles.tabsCompact : ""}`}>
          {sc.hasProgrammes && (
            <button
              className={`${styles.tab} ${activeTab === "programmes" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("programmes")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              {sc.tabProgrammes}
            </button>
          )}
          {sc.hasExercices && (
            <button
              className={`${styles.tab} ${activeTab === "exercices" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("exercices")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              {sc.tabExercices}
            </button>
          )}
          {sc.hasSeances && (
            <button
              className={`${styles.tab} ${activeTab === "seances" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("seances")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              {sc.tabSeances}
            </button>
          )}
          {sc.hasIndicateurs && (
            <button
              className={`${styles.tab} ${activeTab === "indicateurs" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("indicateurs")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
              Mes Indicateurs
            </button>
          )}
          {sc.hasNutriPlan && (
            <button
              className={`${styles.tab} ${activeTab === "nutriplan" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("nutriplan")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>
              Mon Plan Alimentaire
            </button>
          )}
          {sc.hasNutriPlan && (
            <button
              className={`${styles.tab} ${activeTab === "nutribilan" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("nutribilan")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              Bilan Nutritionnel
            </button>
          )}
          {sc.hasMedSuivi && (
            <button
              className={`${styles.tab} ${activeTab === "medsuivi" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("medsuivi")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>
              Suivi Médical
            </button>
          )}
          {sc.hasMedIndicateurs && (
            <button
              className={`${styles.tab} ${activeTab === "medindicateurs" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("medindicateurs")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              Indicateurs Médicaux
            </button>
          )}
          {!sc.hasIndicateurs && !sc.hasNutriPlan && !sc.hasMedSuivi && (
            <button
              className={`${styles.tab} ${activeTab === "suivi" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("suivi")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              Mon Suivi
            </button>
          )}
          <button
            className={`${styles.tab} ${activeTab === "signalements" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("signalements")}
          >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            Signalements
            {alerts.filter(a => a.status !== "closed").length > 0 && (
              <span className={styles.tabBadge}>{alerts.filter(a => a.status !== "closed").length}</span>
            )}
          </button>
          <button
            className={`${styles.tab} ${activeTab === "historique" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("historique")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg>
            Historique
          </button>
        </div>

        {/* ── Tab: Mes Programmes ── */}
        {activeTab === "programmes" && sc.hasProgrammes && (
          <section className={styles.tabContent}>
            {plansLoading ? (
              <p className={styles.loadingText}>Chargement…</p>
            ) : plans.length === 0 ? (
              <div className={styles.tabEmpty}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                <span>Aucun programme pour le moment</span>
              </div>
            ) : (
              <>
                {/* ── Plan list (cards) ── */}
                {activePlans.length > 0 && (
                  <div className={styles.planGroup}>
                    <h3 className={styles.planGroupTitle}>Programmes en cours</h3>
                    {activePlans.map((plan) => renderPlanCard(plan))}
                  </div>
                )}
                {completedPlans.length > 0 && (
                  <div className={styles.planGroup}>
                    <h3 className={styles.planGroupTitle}>Programmes terminés</h3>
                    {completedPlans.map((plan) => renderPlanCard(plan, true))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ── Tab: Mes Exercices (bibliothèque) ── */}
        {activeTab === "exercices" && sc.hasExercices && (
          <section className={styles.tabContent}>
            {plansLoading ? (
              <p className={styles.loadingText}>Chargement…</p>
            ) : (
              <>
                {/* ── Search + category filters ── */}
                <div className={styles.videoFilters}>
                  <input
                    className={styles.videoSearchInput}
                    type="text"
                    placeholder="Rechercher une vidéo..."
                    value={videoSearch}
                    onChange={(e) => setVideoSearch(e.target.value)}
                  />
                  <div className={styles.catChips}>
                    <button
                      className={`${styles.catChip} ${!videoCategory ? styles.catChipActive : ""}`}
                      onClick={() => setVideoCategory("")}
                    >
                      Toutes
                    </button>
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        className={`${styles.catChip} ${videoCategory === c.value ? styles.catChipActive : ""}`}
                        onClick={() => setVideoCategory(videoCategory === c.value ? "" : c.value)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {videoList.length === 0 ? (
                  <div className={styles.tabEmpty}>
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    <span>{videoSearch || videoCategory ? "Aucune vidéo ne correspond à votre recherche" : "Aucun exercice pour le moment"}</span>
                  </div>
                ) : (
                  <div className={styles.videoGrid}>
                    {videoList.map((ex) => (
                      <div key={ex.video.id} className={styles.videoCard}>
                        {playingVideo === ex.video.id ? (
                          <div className={styles.videoPlayer}>
                            {isYouTubeUrl(ex.video.url) ? (
                              <iframe
                                src={`${toYouTubeEmbed(ex.video.url)}?autoplay=1`}
                                className={styles.videoElement}
                                allow="autoplay; encrypted-media"
                                allowFullScreen
                                style={{ border: "none" }}
                              />
                            ) : (
                              <video ref={videoRef} src={ex.video.url} controls autoPlay className={styles.videoElement} />
                            )}
                            <button className={styles.videoClose} onClick={() => setPlayingVideo(null)}>×</button>
                          </div>
                        ) : (
                          <div className={styles.videoThumb} onClick={() => setPlayingVideo(ex.video.id)}>
                            {ex.video.thumbnail ? (
                              <img src={ex.video.thumbnail} alt={ex.video.title} />
                            ) : (
                              <div className={styles.videoThumbPlaceholder}>
                                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                              </div>
                            )}
                            <div className={styles.videoPlayBtn}>
                              <svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            </div>
                            {ex.video.duration && (
                              <span className={styles.videoDuration}>
                                {Math.floor(ex.video.duration / 60)}:{(ex.video.duration % 60).toString().padStart(2, "0")}
                              </span>
                            )}
                          </div>
                        )}
                        <div className={styles.videoInfo}>
                          <span className={styles.videoTitle}>{ex.video.title}</span>
                          <span className={styles.videoCat}>{catLabel(ex.video.category)}</span>
                          {ex.video.duration && <span className={styles.videoDur}>{Math.floor(ex.video.duration / 60)}:{(ex.video.duration % 60).toString().padStart(2, "0")}</span>}
                          {ex.video.description && <p className={styles.videoDesc}>{ex.video.description}</p>}
                          <span className={styles.videoPlanLink}>Programme : {ex.planTitle}</span>
                        </div>
                        <div className={styles.videoCardFooter}>
                          <button
                            className={styles.videoWatchBtn}
                            onClick={() => setPlayingVideo(playingVideo === ex.video.id ? null : ex.video.id)}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            {playingVideo === ex.video.id ? "Fermer" : "Regarder"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ── Tab: Mes Séances (coach only) ── */}
        {activeTab === "seances" && sc.hasSeances && <TabSeances proId={proId} />}

        {/* ── REMOVED INLINE: indicateurs, nutriplan, nutribilan, medsuivi — now use components ── */}
        {activeTab === "indicateurs" && sc.hasIndicateurs && <TabIndicateurs proId={proId} onSwitchTab={(tab) => setActiveTab(tab as Tab)} />}
        {activeTab === "nutriplan" && sc.hasNutriPlan && <TabNutriPlan proId={proId} />}
        {activeTab === "nutribilan" && sc.hasNutriPlan && <TabNutriBilan proId={proId} />}
        {activeTab === "medsuivi" && sc.hasMedSuivi && <TabMedSuivi proId={proId} />}
        {activeTab === "medindicateurs" && sc.hasMedIndicateurs && <TabMedIndicateurs proId={proId} />}

        {/* ── Tab: Mon Suivi ── */}
        {activeTab === "suivi" && (
          <section className={styles.tabContent}>
            {plansLoading ? (
              <p className={styles.loadingText}>Chargement…</p>
            ) : activePlans.length === 0 ? (
              <div className={styles.tabEmpty}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                <span>Aucun programme en cours</span>
              </div>
            ) : (
              <div className={styles.suiviPlans}>
                {activePlans.map((plan) => {
                  const color = STATUS_COLORS[plan.status] || "#6b7280";
                  const label = STATUS_LABELS[plan.status] || plan.status;
                  return (
                    <div key={plan.id} className={styles.suiviCard}>
                      <div className={styles.suiviCardHeader}>
                        <div>
                          <h3 className={styles.suiviTitle}>{plan.title}</h3>
                          <div className={styles.suiviMeta}>
                            {plan.pathology && <span className={styles.suiviChip}>{plan.pathology}</span>}
                            <span className={styles.planBadge} style={{ background: `${color}20`, color, borderColor: `${color}40` }}>{label}</span>
                            {plan.phase && <span className={styles.suiviPhase}>{plan.phase}</span>}
                          </div>
                        </div>
                        <div className={styles.suiviProgress}>
                          <span className={styles.suiviProgressVal}>{plan.progress}%</span>
                          <div className={styles.suiviProgressBar}>
                            <div className={styles.suiviProgressFill} style={{ width: `${plan.progress}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Info grid */}
                      <div className={styles.suiviInfoGrid}>
                        {plan.objective && <div className={styles.suiviInfoItem}><span className={styles.suiviInfoLabel}>Objectif</span><span>{plan.objective}</span></div>}
                        {plan.frequency && <div className={styles.suiviInfoItem}><span className={styles.suiviInfoLabel}>Fréquence</span><span>{plan.frequency}</span></div>}
                        {plan.startDate && <div className={styles.suiviInfoItem}><span className={styles.suiviInfoLabel}>Début</span><span>{formatShort(plan.startDate)}</span></div>}
                        {plan.endDate && <div className={styles.suiviInfoItem}><span className={styles.suiviInfoLabel}>Fin prévue</span><span>{formatShort(plan.endDate)}</span></div>}
                      </div>

                      {/* Next RDV */}
                      {plan.nextRdvDate && (
                        <div className={styles.suiviRdv}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          <div>
                            <span className={styles.suiviRdvLabel}>Prochain RDV</span>
                            <span className={styles.suiviRdvValue}>
                              {formatShort(plan.nextRdvDate)}
                              {plan.nextRdvTime ? ` à ${plan.nextRdvTime}` : ""}
                            </span>
                            {plan.nextRdvLocation && <span className={styles.suiviRdvLoc}>{plan.nextRdvLocation}</span>}
                          </div>
                        </div>
                      )}

                      {/* Notes patient */}
                      {plan.notesPatient && (
                        <div className={styles.suiviNotes}>
                          <strong>{sc.instructionsLabel}</strong>
                          <p>{plan.notesPatient}</p>
                        </div>
                      )}

                      {/* Exercises */}
                      {plan.exercises.length > 0 && (
                        <div className={styles.suiviExSection}>
                          <h4 className={styles.suiviExTitle}>Exercices prescrits ({plan.exercises.length})</h4>
                          <div className={styles.planExercises}>
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
                                    {plan.status === "active" && (
                                      <button
                                        className={`${styles.exActionBtn} ${styles.exLogBtn}`}
                                        onClick={() => setLogExercise({ exerciseId: ex.id, planId: plan.id, videoTitle: ex.video.title })}
                                      >
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                        Logger
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {playingVideo === ex.video.id && (
                                  <div className={styles.exPlayerWrap}>
                                    {isYouTubeUrl(ex.video.url) ? (
                                      <iframe src={`${toYouTubeEmbed(ex.video.url)}?autoplay=1`} className={styles.exPlayerIframe} allow="autoplay; encrypted-media" allowFullScreen />
                                    ) : (
                                      <video ref={videoRef} src={ex.video.url} controls autoPlay className={styles.exPlayerVideo} />
                                    )}
                                    <button className={styles.exPlayerClose} onClick={() => setPlayingVideo(null)}>×</button>
                                  </div>
                                )}
                                <div className={styles.exParams}>
                                  {ex.sets && <span className={styles.exParam}>{ex.sets} séries</span>}
                                  {ex.reps && <span className={styles.exParam}>{ex.reps} reps</span>}
                                  {ex.duration && <span className={styles.exParam}>{ex.duration}</span>}
                                  {ex.tempo && <span className={styles.exParam}>Tempo {ex.tempo}</span>}
                                  {ex.rest && <span className={styles.exParam}>Repos {ex.rest}</span>}
                                  {ex.frequency && <span className={styles.exParam}>{ex.frequency}</span>}
                                  {ex.painThreshold != null && <span className={styles.exParam}>Douleur max {ex.painThreshold}/10</span>}
                                  {ex.equipment && <span className={styles.exParam}>{ex.equipment}</span>}
                                </div>
                                {ex.consignes && <div className={styles.exConsignes}><strong>Consignes</strong><p>{ex.consignes}</p></div>}
                                {ex.alternative && <div className={styles.exAlternative}><strong>Alternative / Régression</strong><p>{ex.alternative}</p></div>}
                                {ex.logsCount > 0 && (
                                  <div className={styles.exLogBadge}>
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                    {ex.logsCount} session{ex.logsCount > 1 ? "s" : ""} effectuée{ex.logsCount > 1 ? "s" : ""}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Tab: Mes Signalements ── */}
        {activeTab === "signalements" && (
          <section className={styles.tabContent}>
            <div className={styles.suiviSectionHeader}>
              <h3 className={styles.suiviSectionTitle}>Mes signalements</h3>
              <button className={styles.suiviBtnPrimary} onClick={() => setShowCreateAlert(true)}>
                + Signaler un problème
              </button>
            </div>

            {alertsLoading ? (
              <p className={styles.loadingText}>Chargement…</p>
            ) : alerts.length === 0 ? (
              <div className={styles.tabEmpty}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <span>Aucun signalement</span>
              </div>
            ) : (
              <AlertsList alerts={alerts} />
            )}
          </section>
        )}

        {/* ── Tab: Historique ── */}
        {activeTab === "historique" && (
          <section className={styles.tabContent}>
            {plansLoading ? (
              <p className={styles.loadingText}>Chargement…</p>
            ) : completedPlans.length === 0 ? (
              <div className={styles.tabEmpty}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg>
                <span>{sc.emptyHistoryLabel}</span>
              </div>
            ) : (
              <HistoryList plans={completedPlans} />
            )}
          </section>
        )}

      </div>

      {/* ── Documents Section (standalone, below tabs) ── */}
      <section className={styles.docSection}>
          <div className={styles.suiviSectionHeader} style={{ marginBottom: 16 }}>
            <h3 className={styles.suiviSectionTitle}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: -3 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
              Documents partagés
            </h3>
            <button className={styles.suiviBtnPrimary} onClick={() => setShowUploadDoc(true)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: -2 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Envoyer un document
            </button>
          </div>
          {docsLoading ? (
            <p className={styles.loadingText}>Chargement…</p>
          ) : docs.length === 0 ? (
            <div className={styles.tabEmpty}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
              <span>Aucun document échangé</span>
            </div>
          ) : (
            <DocumentsList docs={docs} />
          )}
        </section>

      {/* ── Upload Document Modal ── */}
      {showUploadDoc && (
        <UploadDocModal
          proId={proId}
          onClose={() => setShowUploadDoc(false)}
          onUploaded={() => { setShowUploadDoc(false); refreshDocs(); }}
        />
      )}

      {/* ── Log Exercise Modal ── */}
      {logExercise && (
        <LogExerciseModal
          exerciseId={logExercise.exerciseId}
          planId={logExercise.planId}
          videoTitle={logExercise.videoTitle}
          onClose={() => setLogExercise(null)}
          onLogged={() => { setLogExercise(null); refreshPlans(); }}
        />
      )}

      {/* ── Create Alert Modal ── */}
      {showCreateAlert && (
        <CreateAlertModal
          proId={proId}
          plans={activePlans}
          onClose={() => setShowCreateAlert(false)}
          onCreated={() => { setShowCreateAlert(false); refreshAlerts(); }}
        />
      )}

      <LegalFooter />
    </div>
  );
}
