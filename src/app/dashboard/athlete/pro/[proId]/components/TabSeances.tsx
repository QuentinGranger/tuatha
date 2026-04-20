"use client";

import { useState, useEffect, useRef } from "react";
import styles from "../page.module.scss";
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS, isYouTubeUrl, toYouTubeEmbed, formatDate } from "./types";

export default function TabSeances({ proId }: { proId: string }) {
  const [coachSessions, setCoachSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionVideoUrl, setSessionVideoUrl] = useState<string | null>(null);
  const [feedbackEditing, setFeedbackEditing] = useState<string | null>(null);
  const [feedbackData, setFeedbackData] = useState({ rpeRessenti: null as number | null, douleur: null as number | null, douleurZone: "", feedbackAthlete: "" });
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const sessionVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch(`/api/athlete/coach-sessions?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.sessions) setCoachSessions(data.sessions); })
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, [proId]);

  const filteredSessions = coachSessions.filter((s) =>
    sessionFilter === "all" ? true : s.status === sessionFilter
  );
  const totalExercisesInSession = (s: any) =>
    (s.blocks || []).reduce((acc: number, b: any) => acc + (b.exercises?.length || 0), 0);

  const startEditFeedback = (s: any) => {
    setFeedbackEditing(s.id);
    setFeedbackData({
      rpeRessenti: s.rpeRessenti ?? null,
      douleur: s.douleur ?? null,
      douleurZone: s.douleurZone || "",
      feedbackAthlete: s.feedbackAthlete || "",
    });
  };

  const saveFeedback = async (sessionId: string) => {
    setFeedbackSaving(true);
    try {
      const res = await fetch(`/api/athlete/coach-sessions/${sessionId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });
      if (res.ok) {
        const updated = await res.json();
        setCoachSessions((prev) =>
          prev.map((s) => s.id === sessionId ? { ...s, ...updated } : s)
        );
        setFeedbackEditing(null);
      }
    } catch {}
    setFeedbackSaving(false);
  };

  return (
    <section className={styles.tabContent}>
      {sessionsLoading ? (
        <p className={styles.loadingText}>Chargement des séances…</p>
      ) : coachSessions.length === 0 ? (
        <div className={styles.tabEmpty}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <span>Aucune séance pour le moment</span>
        </div>
      ) : (
        <>
          {/* Status filter */}
          <div className={styles.sessionFilters}>
            {(["all", "planifiee", "en_cours", "realisee"] as const).map((f) => {
              const label = f === "all" ? "Toutes" : SESSION_STATUS_LABELS[f];
              const count = f === "all" ? coachSessions.length : coachSessions.filter(s => s.status === f).length;
              return (
                <button
                  key={f}
                  className={`${styles.sessionFilterBtn} ${sessionFilter === f ? styles.sessionFilterActive : ""}`}
                  onClick={() => setSessionFilter(f)}
                >
                  {label}
                  {count > 0 && <span className={styles.sessionFilterCount}>{count}</span>}
                </button>
              );
            })}
          </div>

          {filteredSessions.length === 0 ? (
            <div className={styles.tabEmpty}>
              <span>Aucune séance avec ce statut</span>
            </div>
          ) : (
            <div className={styles.sessionList}>
              {filteredSessions.map((s: any) => {
                const color = SESSION_STATUS_COLORS[s.status] || "#6b7280";
                const label = SESSION_STATUS_LABELS[s.status] || s.status;
                const exCount = totalExercisesInSession(s);
                const blockCount = (s.blocks || []).length;
                const isOpen = expandedSession === s.id;

                return (
                  <div key={s.id} className={styles.sessionCard}>
                    <div className={styles.planCardHeader} onClick={() => setExpandedSession(isOpen ? null : s.id)}>
                      <div className={styles.planCardLeft}>
                        <div className={styles.planCardTop}>
                          <span className={styles.planTitle}>{s.name}</span>
                          <span className={styles.planBadge} style={{ background: `${color}20`, color, borderColor: `${color}40` }}>{label}</span>
                        </div>
                        {s.objectif && <p className={styles.planObj}>{s.objectif}</p>}
                        <div className={styles.planMeta}>
                          <span>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: "middle", marginRight: 3 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            {formatDate(s.date)}
                          </span>
                          {s.time && <span>· {s.time}</span>}
                          {s.lieu && <span>· {s.lieu}</span>}
                          <span>· {blockCount} bloc{blockCount !== 1 ? "s" : ""}, {exCount} exercice{exCount !== 1 ? "s" : ""}</span>
                        </div>
                        {s.tags && s.tags.length > 0 && (
                          <div className={styles.sessionTags}>
                            {s.tags.map((tag: string, i: number) => (
                              <span key={i} className={styles.sessionTag}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <svg className={`${styles.planChevron} ${isOpen ? styles.planChevronOpen : ""}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className={styles.planBody}>
                        {/* ── Section Info ── */}
                        <div className={styles.sessionSection}>
                          <div className={styles.sessionSectionTitle}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                            Informations
                          </div>
                          <div className={styles.planDetailInfo}>
                            <div className={styles.planInfoRow}>
                              <span className={styles.planInfoLabel}>Statut</span>
                              <span className={styles.planBadge} style={{ background: `${color}20`, color, borderColor: `${color}40` }}>{label}</span>
                            </div>
                            <div className={styles.planInfoRow}>
                              <span className={styles.planInfoLabel}>Date</span>
                              <span>{formatDate(s.date)}{s.time ? ` à ${s.time}` : ""}</span>
                            </div>
                            {s.lieu && (
                              <div className={styles.planInfoRow}>
                                <span className={styles.planInfoLabel}>Lieu</span>
                                <span>{s.lieu}</span>
                              </div>
                            )}
                            {s.objectif && (
                              <div className={styles.planInfoRow}>
                                <span className={styles.planInfoLabel}>Objectif</span>
                                <span>{s.objectif}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ── Section Prescription ── */}
                        {(s.rpeCible || s.zoneCardio || (s.contraintes?.length > 0) || (s.criteresArret?.length > 0) || (s.focusTechnique?.length > 0)) && (
                          <div className={`${styles.sessionSection} ${styles.sessionPrescription}`}>
                            <div className={styles.sessionSectionTitle}>
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                              Prescription
                            </div>
                            <div className={styles.planDetailInfo}>
                              {s.rpeCible && (
                                <div className={styles.planInfoRow}>
                                  <span className={styles.planInfoLabel}>RPE cible</span>
                                  <span>{s.rpeCible}</span>
                                </div>
                              )}
                              {s.zoneCardio && (
                                <div className={styles.planInfoRow}>
                                  <span className={styles.planInfoLabel}>Zone cardio</span>
                                  <span>{s.zoneCardio}</span>
                                </div>
                              )}
                              {s.contraintes && s.contraintes.length > 0 && (
                                <div className={styles.planInfoRow}>
                                  <span className={styles.planInfoLabel}>Contraintes</span>
                                  <span>{s.contraintes.join(", ")}</span>
                                </div>
                              )}
                              {s.criteresArret && s.criteresArret.length > 0 && (
                                <div className={styles.planInfoRow}>
                                  <span className={styles.planInfoLabel}>Critères d&apos;arrêt</span>
                                  <span>{s.criteresArret.join(", ")}</span>
                                </div>
                              )}
                              {s.focusTechnique && s.focusTechnique.length > 0 && (
                                <div className={styles.planInfoRow}>
                                  <span className={styles.planInfoLabel}>Focus technique</span>
                                  <span>{s.focusTechnique.join(", ")}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ── Section Exercices ── */}
                        {(s.blocks || []).length > 0 && (
                          <div className={styles.sessionSection}>
                            <div className={styles.sessionSectionTitle}>
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                              Exercices ({exCount})
                            </div>
                            {s.blocks.map((block: any) => (
                              <div key={block.id} className={styles.sessionBlock}>
                                {blockCount > 1 && (
                                  <div className={styles.sessionBlockName}>{block.name || `Bloc ${block.position + 1}`}</div>
                                )}
                                <div className={styles.sessionBlocks}>
                                  {(block.exercises || []).map((ex: any) => (
                                    <div key={ex.id} className={styles.sessionExercise}>
                                      <div className={styles.exCardTop}>
                                        <div className={styles.exCardLeft}>
                                          <span className={styles.exPos}>{ex.position + 1}</span>
                                          <div className={styles.exCardInfo}>
                                            <span className={styles.exName}>{ex.name}</span>
                                          </div>
                                        </div>
                                        {ex.videoUrl && (
                                          <button
                                            className={`${styles.exActionBtn} ${styles.exPlayBtn}`}
                                            onClick={(e) => { e.stopPropagation(); setSessionVideoUrl(sessionVideoUrl === ex.videoUrl ? null : ex.videoUrl); }}
                                            title="Voir la vidéo"
                                          >
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                            Vidéo
                                          </button>
                                        )}
                                      </div>
                                      {sessionVideoUrl === ex.videoUrl && ex.videoUrl && (
                                        <div className={styles.exPlayerWrap}>
                                          {isYouTubeUrl(ex.videoUrl) ? (
                                            <iframe
                                              src={`${toYouTubeEmbed(ex.videoUrl)}?autoplay=1`}
                                              className={styles.exPlayerIframe}
                                              allow="autoplay; encrypted-media"
                                              allowFullScreen
                                            />
                                          ) : (
                                            <video ref={sessionVideoRef} src={ex.videoUrl} controls autoPlay className={styles.exPlayerVideo} />
                                          )}
                                        </div>
                                      )}
                                      <div className={styles.sessionExDetails}>
                                        {ex.sets && <span>{ex.sets} séries</span>}
                                        {ex.reps && <span>{ex.reps} reps</span>}
                                        {ex.duration && <span>{ex.duration}</span>}
                                        {ex.distance && <span>{ex.distance}</span>}
                                        {ex.intensity && <span>Int: {ex.intensity}</span>}
                                        {ex.tempo && <span>Tempo: {ex.tempo}</span>}
                                        {ex.repos && <span>Repos: {ex.repos}</span>}
                                      </div>
                                      {ex.consignes && (
                                        <div className={styles.exConsignes}>
                                          <strong>Consignes</strong>
                                          <p>{ex.consignes}</p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── Section Feedback (editable, visible if en_cours or realisee) ── */}
                        {(s.status === "en_cours" || s.status === "realisee") && (
                          <div className={`${styles.sessionSection} ${styles.sessionFeedback}`}>
                            <div className={styles.sessionSectionTitle}>
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                              Mon feedback
                            </div>
                            {feedbackEditing === s.id ? (
                              <div className={styles.feedbackForm}>
                                <div className={styles.feedbackField}>
                                  <label className={styles.feedbackLabel}>RPE ressenti <span className={styles.feedbackValue}>{feedbackData.rpeRessenti ?? "—"}/10</span></label>
                                  <input
                                    type="range" min="1" max="10" step="1"
                                    value={feedbackData.rpeRessenti ?? 5}
                                    onChange={(e) => setFeedbackData({ ...feedbackData, rpeRessenti: Number(e.target.value) })}
                                    className={styles.feedbackSlider}
                                  />
                                  <div className={styles.feedbackSliderLabels}>
                                    <span>1</span><span>5</span><span>10</span>
                                  </div>
                                </div>
                                <div className={styles.feedbackField}>
                                  <label className={styles.feedbackLabel}>Douleur <span className={styles.feedbackValue}>{feedbackData.douleur ?? "—"}/10</span></label>
                                  <input
                                    type="range" min="0" max="10" step="1"
                                    value={feedbackData.douleur ?? 0}
                                    onChange={(e) => setFeedbackData({ ...feedbackData, douleur: Number(e.target.value) })}
                                    className={styles.feedbackSlider}
                                  />
                                  <div className={styles.feedbackSliderLabels}>
                                    <span>0</span><span>5</span><span>10</span>
                                  </div>
                                </div>
                                <div className={styles.feedbackField}>
                                  <label className={styles.feedbackLabel}>Zone de douleur</label>
                                  <input
                                    type="text"
                                    placeholder="Ex: genou droit, épaule gauche…"
                                    value={feedbackData.douleurZone}
                                    onChange={(e) => setFeedbackData({ ...feedbackData, douleurZone: e.target.value })}
                                    className={styles.feedbackInput}
                                  />
                                </div>
                                <div className={styles.feedbackField}>
                                  <label className={styles.feedbackLabel}>Commentaire</label>
                                  <textarea
                                    placeholder="Comment vous êtes-vous senti pendant la séance ?"
                                    value={feedbackData.feedbackAthlete}
                                    onChange={(e) => setFeedbackData({ ...feedbackData, feedbackAthlete: e.target.value })}
                                    className={styles.feedbackTextarea}
                                    rows={3}
                                  />
                                </div>
                                <div className={styles.feedbackActions}>
                                  <button className={styles.feedbackCancel} onClick={() => setFeedbackEditing(null)}>Annuler</button>
                                  <button className={styles.feedbackSave} onClick={() => saveFeedback(s.id)} disabled={feedbackSaving}>
                                    {feedbackSaving ? "Envoi…" : "Enregistrer"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={styles.feedbackReadonly}>
                                {(s.rpeRessenti != null || s.douleur != null || s.douleurZone || s.feedbackAthlete) ? (
                                  <div className={styles.planDetailInfo}>
                                    {s.rpeRessenti != null && (
                                      <div className={styles.planInfoRow}>
                                        <span className={styles.planInfoLabel}>RPE ressenti</span>
                                        <span>{s.rpeRessenti}/10</span>
                                      </div>
                                    )}
                                    {s.douleur != null && (
                                      <div className={styles.planInfoRow}>
                                        <span className={styles.planInfoLabel}>Douleur</span>
                                        <span>{s.douleur}/10</span>
                                      </div>
                                    )}
                                    {s.douleurZone && (
                                      <div className={styles.planInfoRow}>
                                        <span className={styles.planInfoLabel}>Zone</span>
                                        <span>{s.douleurZone}</span>
                                      </div>
                                    )}
                                    {s.feedbackAthlete && (
                                      <div className={styles.planInfoRow}>
                                        <span className={styles.planInfoLabel}>Commentaire</span>
                                        <span>{s.feedbackAthlete}</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className={styles.feedbackEmpty}>Aucun feedback pour cette séance.</p>
                                )}
                                <button className={styles.feedbackEditBtn} onClick={() => startEditFeedback(s)}>
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                  {(s.rpeRessenti != null || s.douleur != null || s.feedbackAthlete) ? "Modifier mon feedback" : "Donner mon feedback"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
