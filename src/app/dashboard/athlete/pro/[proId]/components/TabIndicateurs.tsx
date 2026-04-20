"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import styles from "../page.module.scss";
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from "./types";

export default function TabIndicateurs({ proId, onSwitchTab }: { proId: string; onSwitchTab: (tab: string) => void }) {
  const [indicDays, setIndicDays] = useState(7);
  const [indicData, setIndicData] = useState<any>(null);
  const [indicLoading, setIndicLoading] = useState(false);
  const [indicTagFilters, setIndicTagFilters] = useState<string[]>([]);
  const [indicStatusFilters, setIndicStatusFilters] = useState<string[]>([]);
  const [indicChartMode, setIndicChartMode] = useState<"sessions" | "rpe">("sessions");
  const [indicDrillDate, setIndicDrillDate] = useState<string | null>(null);
  const [indicVideos, setIndicVideos] = useState<any[]>([]);
  const [indicVideosLoading, setIndicVideosLoading] = useState(false);
  const [indicPreviewVideo, setIndicPreviewVideo] = useState<any>(null);
  const [indicVideoFile, setIndicVideoFile] = useState<File | null>(null);
  const [indicVideoNote, setIndicVideoNote] = useState("");
  const [indicVideoUploading, setIndicVideoUploading] = useState(false);
  const [indicVideoError, setIndicVideoError] = useState("");
  const indicVideoRef = useRef<HTMLInputElement>(null);
  const indicCameraRef = useRef<HTMLInputElement>(null);

  const fetchIndicateurs = useCallback(() => {
    setIndicLoading(true);
    const params = new URLSearchParams({ proId, days: String(indicDays) });
    if (indicTagFilters.length) params.set("tags", indicTagFilters.join(","));
    if (indicStatusFilters.length) params.set("status", indicStatusFilters.join(","));
    fetch(`/api/athlete/indicateurs?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.kpi) setIndicData(d); })
      .catch(() => {})
      .finally(() => setIndicLoading(false));
  }, [proId, indicDays, indicTagFilters, indicStatusFilters]);

  const fetchIndicVideos = useCallback(() => {
    setIndicVideosLoading(true);
    fetch(`/api/athlete/videos?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (Array.isArray(d)) setIndicVideos(d); })
      .catch(() => {})
      .finally(() => setIndicVideosLoading(false));
  }, [proId]);

  useEffect(() => {
    fetchIndicateurs();
    fetchIndicVideos();
  }, [fetchIndicateurs, fetchIndicVideos]);

  const indicToggleFilter = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const indicDrillSessions = useMemo(() => {
    if (!indicDrillDate || !indicData) return [];
    return indicData.sessions.filter((s: any) => s.date?.slice(0, 10) === indicDrillDate);
  }, [indicDrillDate, indicData]);

  const handleIndicExport = () => {
    if (!indicData) return;
    const blob = new Blob([JSON.stringify(indicData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mes-indicateurs-${indicDays}j.json`;
    a.click();
  };

  const formatVideoSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} Ko` : `${(b / (1024 * 1024)).toFixed(1)} Mo`;
  const formatVideoDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handleShareVideo = async (v: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(v.filePath);
      const blob = await res.blob();
      const ext = v.mimeType?.split("/")?.[1] || "mp4";
      const file = new File([blob], v.originalName || `video.${ext}`, { type: v.mimeType || "video/mp4" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: v.originalName, text: v.note || undefined });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = v.originalName || `video.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("Share error:", err);
    }
  };

  const handleIndicVideoUpload = async () => {
    if (!indicVideoFile) return;
    setIndicVideoUploading(true);
    setIndicVideoError("");
    const fd = new FormData();
    fd.append("file", indicVideoFile);
    fd.append("proId", proId);
    if (indicVideoNote.trim()) fd.append("note", indicVideoNote.trim());
    try {
      const res = await fetch("/api/athlete/videos/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        setIndicVideoError(err.error || "Erreur lors de l'envoi");
        return;
      }
      setIndicVideoFile(null);
      setIndicVideoNote("");
      fetchIndicVideos();
    } catch {
      setIndicVideoError("Erreur réseau");
    } finally {
      setIndicVideoUploading(false);
    }
  };

  return (
    <section className={styles.tabContent}>
      {/* ── Filters bar ── */}
      <div className={styles.headerControls}>
        <select className={styles.periodSelect} value={indicDays} onChange={(e) => setIndicDays(Number(e.target.value))}>
          <option value={7}>7 jours</option>
          <option value={30}>30 jours</option>
          <option value={90}>90 jours</option>
        </select>
        <button className={styles.ctaSecondary} onClick={handleIndicExport}>Exporter JSON</button>
      </div>

      <div className={styles.filterChips}>
        {["Renfo", "Cardio", "Technique", "Rehab", "WOD", "Endurance", "Force", "Mobilité"].map((t) => (
          <button key={t} className={indicTagFilters.includes(t) ? styles.chipActive : styles.chip} onClick={() => indicToggleFilter(indicTagFilters, t, setIndicTagFilters)}>{t}</button>
        ))}
        <span className={styles.chipSep} />
        {(["planifiee", "realisee", "annulee"] as const).map((s) => (
          <button key={s} className={indicStatusFilters.includes(s) ? styles.chipActive : styles.chip} onClick={() => indicToggleFilter(indicStatusFilters, s, setIndicStatusFilters)}>
            {SESSION_STATUS_LABELS[s] || s}
          </button>
        ))}
      </div>

      {indicLoading && <p className={styles.loadingText}>Chargement des indicateurs…</p>}

      {!indicLoading && indicData && indicData.kpi.totalSessions === 0 && (
        <div className={styles.tabEmpty}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
          <span>Aucune séance pour cette période</span>
        </div>
      )}

      {!indicLoading && indicData && indicData.kpi.totalSessions > 0 && (
        <>
          {/* ── KPI Cards ── */}
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCard_adherence}`}>
              <div className={styles.kpiLabel}>Adhérence</div>
              {indicData.kpi.adherence !== null ? (
                <>
                  <div className={styles.kpiValue}>
                    {indicData.kpi.adherence}%
                    {indicData.kpi.adherenceDelta !== null && indicData.kpi.adherenceDelta !== 0 && (
                      <span className={`${styles.kpiDelta} ${indicData.kpi.adherenceDelta > 0 ? styles.kpiDeltaUp : styles.kpiDeltaDown}`}>
                        {indicData.kpi.adherenceDelta > 0 ? "+" : ""}{indicData.kpi.adherenceDelta}%
                      </span>
                    )}
                  </div>
                  <div className={styles.kpiSub}>{indicData.kpi.realizedCount} / {indicData.kpi.plannedCount} séances</div>
                </>
              ) : (
                <><div className={styles.kpiValue}>—</div><div className={styles.kpiHint}>Aucune séance planifiée</div></>
              )}
            </div>

            <div className={`${styles.kpiCard} ${styles.kpiCard_volume}`}>
              <div className={styles.kpiLabel}>Volume</div>
              <div className={styles.kpiValue}>{indicData.kpi.totalSessions}</div>
              <div className={styles.kpiSub}>séance{indicData.kpi.totalSessions !== 1 ? "s" : ""} · {indicData.kpi.totalExercises} exercice{indicData.kpi.totalExercises !== 1 ? "s" : ""}</div>
            </div>

            <div className={`${styles.kpiCard} ${styles.kpiCard_intensity}`}>
              <div className={styles.kpiLabel}>Intensité (RPE moy.)</div>
              {indicData.kpi.avgRpe !== null ? (
                <>
                  <div className={styles.kpiValue}>
                    {indicData.kpi.avgRpe}/10
                    {indicData.kpi.prevAvgRpe !== null && (
                      <span className={`${styles.kpiDelta} ${indicData.kpi.avgRpe <= indicData.kpi.prevAvgRpe ? styles.kpiDeltaUp : styles.kpiDeltaDown}`}>
                        {indicData.kpi.avgRpe > indicData.kpi.prevAvgRpe ? "↑" : "↓"} vs pér. préc.
                      </span>
                    )}
                  </div>
                  <div className={styles.kpiSub}>{indicData.kpi.avgRpe <= 3 ? "Basse" : indicData.kpi.avgRpe <= 6 ? "Modérée" : "Haute"}</div>
                </>
              ) : (
                <><div className={styles.kpiValue}>—</div><div className={styles.kpiHint}>Remplissez vos feedbacks</div></>
              )}
            </div>

            <div className={`${styles.kpiCard} ${indicData.kpi.riskLevel === "alert" ? styles.kpiCard_risk_alert : indicData.kpi.riskLevel === "watch" ? styles.kpiCard_risk_watch : styles.kpiCard_risk_ok}`}>
              <div className={styles.kpiLabel}>Risque / Alerte</div>
              <div className={styles.kpiValue}>
                {indicData.kpi.riskLevel === "ok" ? "OK" : indicData.kpi.riskLevel === "watch" ? "À surveiller" : "Alerte"}
              </div>
              {indicData.kpi.avgPain !== null ? (
                <div className={styles.kpiSub}>Douleur moy. {indicData.kpi.avgPain}/10{indicData.kpi.topPainZone && <> · {indicData.kpi.topPainZone}</>}</div>
              ) : (
                <div className={styles.kpiHint}>Remplissez vos feedbacks</div>
              )}
            </div>
          </div>

          {/* ── Charge & Tendance chart ── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              Charge &amp; Tendance
              <span className={styles.cardTitleRight}>Cliquer sur un jour pour détailler</span>
            </div>
            <div className={styles.chartToggles}>
              <button className={indicChartMode === "sessions" ? styles.chartToggleActive : styles.chartToggle} onClick={() => setIndicChartMode("sessions")}>Séances</button>
              <button className={indicChartMode === "rpe" ? styles.chartToggleActive : styles.chartToggle} onClick={() => setIndicChartMode("rpe")}>RPE</button>
            </div>
            <div className={styles.chartCanvas}>
              {(() => {
                const d = indicData.daily;
                if (!d || !d.length) return <div className={styles.chartNoData}>Pas de données</div>;
                const W = 800, H = 200, PL = 30, PR = 10, PT = 15, PB = 30;
                const cW = W - PL - PR, cH = H - PT - PB;

                if (indicChartMode === "sessions") {
                  const maxV = Math.max(...d.map((p: any) => Math.max(p.planned, p.realized)), 1);
                  const bW = Math.max(4, Math.min(20, cW / d.length / 2.5));
                  const gap = 2;
                  return (
                    <svg className={styles.chartSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                      {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} className={styles.chartGrid} x1={PL} x2={W - PR} y1={PT + cH * (1 - f)} y2={PT + cH * (1 - f)} />)}
                      {d.map((p: any, i: number) => {
                        const x = PL + (i / (d.length - 1 || 1)) * cW;
                        const hP = (p.planned / maxV) * cH, hR = (p.realized / maxV) * cH;
                        return (
                          <g key={p.date} onClick={() => setIndicDrillDate(p.date)} style={{ cursor: "pointer" }}>
                            <rect className={styles.chartBarPlanned} x={x - bW - gap / 2} y={PT + cH - hP} width={bW} height={hP} />
                            <rect className={styles.chartBarRealized} x={x + gap / 2} y={PT + cH - hR} width={bW} height={hR} />
                            {i % Math.max(1, Math.floor(d.length / 12)) === 0 && (
                              <text className={styles.chartLabel} x={x} y={H - 5}>{new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  );
                }

                // RPE mode
                const rpeP = d.filter((p: any) => p.avgRpe !== null);
                if (!rpeP.length) return <div className={styles.chartNoData}>Pas de données RPE</div>;
                const pts = rpeP.map((p: any, i: number) => ({ x: PL + (i / (rpeP.length - 1 || 1)) * cW, y: PT + cH - ((p.avgRpe / 10) * cH), ...p }));
                const linePath = pts.map((p: any, i: number) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                return (
                  <svg className={styles.chartSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                    {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} className={styles.chartGrid} x1={PL} x2={W - PR} y1={PT + cH * (1 - f)} y2={PT + cH * (1 - f)} />)}
                    <path className={styles.chartLineRealized} d={linePath} />
                    {pts.map((p: any, i: number) => (
                      <g key={p.date}>
                        <circle className={styles.chartDot} cx={p.x} cy={p.y} r={4} onClick={() => setIndicDrillDate(p.date)} style={{ cursor: "pointer" }} />
                        {i % Math.max(1, Math.floor(pts.length / 10)) === 0 && (
                          <text className={styles.chartLabel} x={p.x} y={H - 5}>{new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</text>
                        )}
                      </g>
                    ))}
                  </svg>
                );
              })()}
            </div>
          </div>

          {/* ── Qualité d'exécution ── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
              Qualité d&apos;exécution
            </div>
            <div className={styles.qualGrid}>
              <div className={styles.qualBox}>
                <div className={styles.qualLabel}>RPE ressenti (moyenne)</div>
                <div className={styles.qualValue}>{indicData.kpi.avgRpe !== null ? `${indicData.kpi.avgRpe}/10` : "—"}</div>
                <div className={styles.qualSub}>
                  {indicData.kpi.avgRpe !== null ? (indicData.kpi.avgRpe <= 3 ? "Intensité basse" : indicData.kpi.avgRpe <= 6 ? "Intensité modérée" : "Intensité haute") : "Aucun feedback RPE"}
                </div>
              </div>
              <div className={styles.qualBox}>
                <div className={styles.qualLabel}>Douleur (moyenne)</div>
                <div className={styles.qualValue}>{indicData.kpi.avgPain !== null ? `${indicData.kpi.avgPain}/10` : "—"}</div>
                <div className={styles.qualSub}>{indicData.kpi.topPainZone ? `Zone fréquente : ${indicData.kpi.topPainZone}` : "Aucune donnée douleur"}</div>
              </div>
            </div>

            {indicData.recentFeedback.length > 0 && (
              <>
                <div className={styles.commentsTitle}>Vos commentaires récents</div>
                <div className={styles.commentsList}>
                  {indicData.recentFeedback.map((fb: any) => (
                    <div key={fb.id} className={styles.commentItem}>
                      <div className={styles.commentMeta}>
                        <span>{fb.name} · {new Date(fb.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                        <span>{fb.rpe !== null && `RPE ${fb.rpe}`}{fb.pain !== null && ` · Douleur ${fb.pain}/10`}{fb.painZone && ` (${fb.painZone})`}</span>
                      </div>
                      <div className={styles.commentText}>&ldquo;{fb.feedback}&rdquo;</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {indicData.recentFeedback.length === 0 && indicData.kpi.realizedCount > 0 && (
              <div className={styles.noFeedback}>Aucun feedback enregistré — pensez à remplir vos retours après chaque séance</div>
            )}
          </div>

          {/* ── Alertes & Actions ── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              Alertes
            </div>
            {indicData.alerts.length > 0 ? (
              <div className={styles.alertsList}>
                {indicData.alerts.map((a: any, i: number) => (
                  <div key={i} className={styles.alertItem}>
                    <span className={`${styles.alertDot} ${a.level === "red" ? styles.alertDot_red : a.level === "orange" ? styles.alertDot_orange : styles.alertDot_yellow}`} />
                    <span>{a.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.alertEmpty}>Aucune alerte détectée pour cette période ✓</div>
            )}
            <div className={styles.alertActions}>
              <button className={styles.alertActionBtn} onClick={() => onSwitchTab("seances")}>Remplir mes feedbacks</button>
              <button className={styles.alertActionBtn} onClick={() => onSwitchTab("signalements")}>Signaler un problème</button>
            </div>
          </div>

          {/* ── Vidéos envoyées ── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
              Mes vidéos envoyées
              <span className={styles.cardTitleRight}>
                <button className={styles.videoUploadBtn} onClick={() => indicCameraRef.current?.click()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  Filmer
                </button>
                <button className={styles.videoUploadBtn} onClick={() => indicVideoRef.current?.click()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  Fichier
                </button>
              </span>
            </div>
            <input ref={indicVideoRef} type="file" accept="video/*" hidden onChange={(e) => { if (e.target.files?.[0]) setIndicVideoFile(e.target.files[0]); }} />
            <input ref={indicCameraRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { if (e.target.files?.[0]) setIndicVideoFile(e.target.files[0]); }} />

            {indicVideoFile && (
              <div className={styles.videoUploadZone}>
                <div className={styles.videoUploadPreview}>
                  <span className={styles.videoUploadIcon}>🎬</span>
                  <div className={styles.videoUploadFileInfo}>
                    <div className={styles.videoUploadFileName}>{indicVideoFile.name}</div>
                    <div className={styles.videoUploadFileSize}>{formatVideoSize(indicVideoFile.size)}</div>
                  </div>
                  <button className={styles.videoUploadRemove} onClick={() => { setIndicVideoFile(null); setIndicVideoNote(""); setIndicVideoError(""); }}>✕</button>
                </div>
                <textarea className={styles.videoUploadNote} value={indicVideoNote} onChange={(e) => setIndicVideoNote(e.target.value)} rows={2} placeholder="Note (optionnel) : ex. Vidéo de mon squat, gêne au genou droit..." />
                {indicVideoError && <div className={styles.videoUploadError}>{indicVideoError}</div>}
                <button className={styles.videoUploadSubmit} onClick={handleIndicVideoUpload} disabled={indicVideoUploading}>
                  {indicVideoUploading ? "Envoi en cours…" : "Envoyer"}
                </button>
              </div>
            )}

            {indicVideosLoading && <p className={styles.loadingText}>Chargement…</p>}
            {!indicVideosLoading && indicVideos.length === 0 && !indicVideoFile && (
              <div className={styles.videoEmptyState}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                <span>Aucune vidéo envoyée</span>
                <div className={styles.videoEmptyActions}>
                  <button className={styles.videoEmptyBtn} onClick={() => indicCameraRef.current?.click()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                    Filmer avec la caméra
                  </button>
                  <button className={styles.videoEmptyBtn} onClick={() => indicVideoRef.current?.click()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    Choisir un fichier
                  </button>
                </div>
              </div>
            )}
            {!indicVideosLoading && indicVideos.length > 0 && (
              <div className={styles.videosList}>
                {indicVideos.map((v: any) => (
                  <div key={v.id} className={styles.videoItem} onClick={() => setIndicPreviewVideo(v)}>
                    <div className={styles.videoThumb}>
                      <video src={v.filePath} muted preload="metadata" />
                      <div className={styles.videoPlay}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      </div>
                    </div>
                    <div className={styles.videoInfo}>
                      <div className={styles.videoName}>{v.originalName}</div>
                      <div className={styles.videoMeta}>
                        <span>{formatVideoSize(v.size)}</span>
                        <span>{formatVideoDate(v.createdAt)}</span>
                        {v.proName && <span>→ {v.proName}</span>}
                      </div>
                      {v.note && <div className={styles.videoNote}>{v.note}</div>}
                    </div>
                    <button className={styles.videoShareBtn} onClick={(e) => handleShareVideo(v, e)} title="Partager">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                    </button>
                    {v.viewed && <span className={styles.videoViewed} title="Vu par le pro">✓ Vu</span>}
                    {!v.viewed && <span className={styles.videoNotViewed} title="Pas encore visionné" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Video preview modal ── */}
      {indicPreviewVideo && (
        <div className={styles.drillOverlay} onClick={() => setIndicPreviewVideo(null)}>
          <div className={styles.videoModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.videoModalHeader}>
              <div>
                <div className={styles.videoModalTitle}>{indicPreviewVideo.originalName}</div>
                <div className={styles.videoModalMeta}>{formatVideoSize(indicPreviewVideo.size)} · {formatVideoDate(indicPreviewVideo.createdAt)}{indicPreviewVideo.note ? ` · ${indicPreviewVideo.note}` : ""}</div>
              </div>
              <div className={styles.videoModalActions}>
                <button className={styles.videoModalShareBtn} onClick={() => handleShareVideo(indicPreviewVideo)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                  Partager
                </button>
                <button className={styles.videoModalClose} onClick={() => setIndicPreviewVideo(null)}>✕</button>
              </div>
            </div>
            <div className={styles.videoModalBody}>
              <video src={indicPreviewVideo.filePath} controls autoPlay style={{ width: "100%", maxHeight: "calc(90vh - 80px)" }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Drill-down modal ── */}
      {indicDrillDate && (
        <div className={styles.drillOverlay} onClick={() => setIndicDrillDate(null)}>
          <div className={styles.drillPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drillTitle}>
              Séances du {new Date(indicDrillDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {indicDrillSessions.length === 0 ? (
              <div className={styles.noFeedback}>Aucune séance ce jour</div>
            ) : (
              indicDrillSessions.map((s: any) => (
                <div key={s.id} className={styles.drillItem}>
                  <div className={styles.drillItemInfo}>
                    <div className={styles.drillItemName}>{s.name}</div>
                    <div className={styles.drillItemMeta}>
                      {s.exerciseCount} exercice{s.exerciseCount !== 1 ? "s" : ""}
                      {s.rpeRessenti !== null && ` · RPE ${s.rpeRessenti}`}
                      {s.douleur !== null && ` · Douleur ${s.douleur}/10`}
                      {s.tags?.length > 0 && ` · ${s.tags.join(", ")}`}
                      {s.proName && ` · ${s.proName}`}
                    </div>
                  </div>
                  <span className={styles.drillItemStatus} style={{ color: SESSION_STATUS_COLORS[s.status] || "#6b7280" }}>
                    {SESSION_STATUS_LABELS[s.status] || s.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
