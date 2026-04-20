"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./page.module.scss";

/* ═══════════════ TYPES ═══════════════ */
interface AthleteRef { id: string; name: string }
interface VideoRef { id: string; title: string; thumbnail: string | null; category: string; url: string }
interface PlanExercise {
  id: string; position: number; sets: number | null; reps: string | null;
  duration: string | null; tempo: string | null; rest: string | null;
  frequency: string | null; painThreshold: number | null; consignes: string | null;
  equipment: string | null; alternative: string | null;
  video: VideoRef;
}
interface Plan {
  id: string; title: string; objective: string | null; notesPro: string | null;
  notesPatient: string | null; startDate: string | null; endDate: string | null;
  frequency: string | null; status: string; isTemplate: boolean; templateName: string | null;
  athlete: AthleteRef | null; exercises: PlanExercise[];
  _count?: { logs: number }; createdAt: string; updatedAt: string;
}
interface Video {
  id: string; title: string; url: string; thumbnail: string | null;
  category: string; duration: number | null; description: string | null;
}

const CATEGORIES = [
  { value: "dos", label: "Dos" }, { value: "epaules", label: "Épaules" },
  { value: "genoux", label: "Genoux" }, { value: "cervicales", label: "Cervicales" },
  { value: "chevilles", label: "Chevilles" }, { value: "hanches", label: "Hanches" },
  { value: "poignet", label: "Poignet" }, { value: "global", label: "Global" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", active: "En cours", paused: "Pause", completed: "Terminé", archived: "Archivé",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", active: "#22c55e", paused: "#f59e0b", completed: "#3b82f6", archived: "#6b7280",
};

/* ═══════════════ PAGE ═══════════════ */
export default function KineProgrammesPage() {
  const [athletes, setAthletes] = useState<AthleteRef[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
  const [tab, setTab] = useState<"prescriptions" | "videos">("prescriptions");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [templates, setTemplates] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [videoCategory, setVideoCategory] = useState("");
  const [videoSearch, setVideoSearch] = useState("");

  // Plan detail
  const [openPlan, setOpenPlan] = useState<Plan | null>(null);
  // Modals
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null); // planId
  const [showEditExercise, setShowEditExercise] = useState<PlanExercise | null>(null);

  // Fetch athletes
  useEffect(() => {
    fetch("/api/athletes").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAthletes(d.map((a: any) => ({ id: a.id, name: a.name })));
    }).catch(() => {});
  }, []);

  // Fetch plans
  const fetchPlans = useCallback(() => {
    if (!selectedAthleteId) { setPlans([]); return; }
    setLoading(true);
    const p = new URLSearchParams({ athleteId: selectedAthleteId });
    if (statusFilter) p.set("status", statusFilter);
    fetch(`/api/kine/plans?${p}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPlans(d); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [selectedAthleteId, statusFilter]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // Fetch templates
  const fetchTemplates = useCallback(() => {
    fetch("/api/kine/plans?template=true").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTemplates(d); }).catch(() => {});
  }, []);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Fetch videos
  const fetchVideos = useCallback(() => {
    const p = new URLSearchParams();
    if (videoCategory) p.set("category", videoCategory);
    if (videoSearch.trim()) p.set("search", videoSearch.trim());
    fetch(`/api/kine/videos?${p}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setVideos(d); }).catch(() => {});
  }, [videoCategory, videoSearch]);

  useEffect(() => { if (tab === "videos") fetchVideos(); }, [tab, fetchVideos]);

  const refreshOpenPlan = (planId: string) => {
    const rp = new URLSearchParams({ athleteId: selectedAthleteId });
    if (statusFilter) rp.set("status", statusFilter);
    fetch(`/api/kine/plans?${rp}`)
      .then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          setPlans(d);
          const found = d.find((p: Plan) => p.id === planId);
          if (found) setOpenPlan(found);
        }
      }).catch(() => {});
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";

  /* ── Actions ── */
  const deletePlan = async (id: string) => {
    if (!confirm("Supprimer ce plan ?")) return;
    await fetch(`/api/kine/plans/${id}`, { method: "DELETE" });
    setOpenPlan(null); fetchPlans();
  };

  const updatePlanStatus = async (id: string, status: string) => {
    await fetch(`/api/kine/plans/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refreshOpenPlan(id);
  };

  const duplicatePlan = async (plan: Plan) => {
    await fetch("/api/kine/plans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${plan.title} (copie)`, duplicateFromId: plan.id, athleteId: selectedAthleteId }),
    });
    fetchPlans();
  };

  const deleteExercise = async (planId: string, exerciseId: string) => {
    await fetch(`/api/kine/plans/${planId}/exercises?exerciseId=${exerciseId}`, { method: "DELETE" });
    refreshOpenPlan(planId);
  };

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className={styles.page}>
      {/* ── Patient Selector ── */}
      <div className={styles.selector}>
        <div className={styles.selectorLeft}>
          <label className={styles.selectorLabel}>Patient</label>
          <select className={styles.selectorSelect} value={selectedAthleteId} onChange={e => setSelectedAthleteId(e.target.value)}>
            <option value="">— Sélectionner un patient —</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {selectedAthleteId && (
          <div className={styles.selectorRight}>
            <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}
      </div>

      {!selectedAthleteId ? (
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <p>Sélectionnez un patient pour gérer ses prescriptions</p>
        </div>
      ) : (
        <>
          {/* ── Tabs ── */}
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === "prescriptions" ? styles.tabActive : ""}`} onClick={() => setTab("prescriptions")}>
              Prescriptions ({plans.length})
            </button>
            <button className={`${styles.tab} ${tab === "videos" ? styles.tabActive : ""}`} onClick={() => setTab("videos")}>
              Bibliothèque vidéos ({videos.length})
            </button>
          </div>

          {/* ═══════ TAB: PRESCRIPTIONS ═══════ */}
          {tab === "prescriptions" && (
            <div className={styles.prescriptions}>
              <div className={styles.prescHeader}>
                <button className={styles.btnPrimary} onClick={() => setShowCreatePlan(true)}>+ Créer un plan</button>
                {templates.length > 0 && (
                  <select className={styles.filterSelect} onChange={e => {
                    if (!e.target.value) return;
                    const tpl = templates.find(t => t.id === e.target.value);
                    fetch("/api/kine/plans", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: tpl?.title || "Nouveau plan", duplicateFromId: e.target.value, athleteId: selectedAthleteId }),
                    }).then(() => fetchPlans());
                    e.target.value = "";
                  }}>
                    <option value="">Depuis un template...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.templateName || t.title}</option>)}
                  </select>
                )}
              </div>

              {loading ? <p className={styles.loadingText}>Chargement...</p> : plans.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>Aucun plan pour ce patient. Créez-en un !</p>
                </div>
              ) : (
                <div className={styles.planList}>
                  {plans.map(plan => (
                    <div key={plan.id} className={`${styles.planCard} ${openPlan?.id === plan.id ? styles.planCardActive : ""}`} onClick={() => setOpenPlan(openPlan?.id === plan.id ? null : plan)}>
                      <div className={styles.planCardTop}>
                        <span className={styles.planTitle}>{plan.title}</span>
                        <span className={styles.planBadge} style={{ background: `${STATUS_COLORS[plan.status]}20`, color: STATUS_COLORS[plan.status], borderColor: `${STATUS_COLORS[plan.status]}40` }}>
                          {STATUS_LABELS[plan.status] || plan.status}
                        </span>
                      </div>
                      {plan.objective && <p className={styles.planObj}>{plan.objective}</p>}
                      <div className={styles.planMeta}>
                        <span>{plan.exercises.length} exercice{plan.exercises.length !== 1 ? "s" : ""}</span>
                        {plan.frequency && <span>· {plan.frequency}</span>}
                        <span>· Modifié {formatDate(plan.updatedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Plan Detail ── */}
              {openPlan && (
                <div className={styles.planDetail}>
                  <div className={styles.detailHeader}>
                    <div>
                      <h3 className={styles.detailTitle}>{openPlan.title}</h3>
                      {openPlan.objective && <p className={styles.detailObj}>{openPlan.objective}</p>}
                    </div>
                    <button className={styles.detailClose} onClick={() => setOpenPlan(null)}>×</button>
                  </div>

                  {/* Info rows */}
                  <div className={styles.detailInfo}>
                    <div className={styles.infoRow}><span className={styles.infoLabel}>Statut</span>
                      <div className={styles.statusBtns}>
                        {(["draft", "active", "paused", "completed", "archived"] as const).map(s => (
                          <button key={s} className={`${styles.statusBtn} ${openPlan.status === s ? styles.statusBtnActive : ""}`}
                            style={openPlan.status === s ? { background: `${STATUS_COLORS[s]}20`, color: STATUS_COLORS[s], borderColor: `${STATUS_COLORS[s]}50` } : {}}
                            onClick={() => updatePlanStatus(openPlan.id, s)}>
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {openPlan.frequency && <div className={styles.infoRow}><span className={styles.infoLabel}>Fréquence</span><span>{openPlan.frequency}</span></div>}
                    {openPlan.startDate && <div className={styles.infoRow}><span className={styles.infoLabel}>Début</span><span>{formatDate(openPlan.startDate)}</span></div>}
                    {openPlan.endDate && <div className={styles.infoRow}><span className={styles.infoLabel}>Fin</span><span>{formatDate(openPlan.endDate)}</span></div>}
                    {openPlan.notesPro && <div className={styles.infoRow}><span className={styles.infoLabel}>Notes pro</span><span className={styles.infoNote}>{openPlan.notesPro}</span></div>}
                    {openPlan.notesPatient && <div className={styles.infoRow}><span className={styles.infoLabel}>Note patient</span><span className={styles.infoNote}>{openPlan.notesPatient}</span></div>}
                  </div>

                  {/* Exercises */}
                  <div className={styles.exSection}>
                    <div className={styles.exHeader}>
                      <h4>Exercices ({openPlan.exercises.length})</h4>
                      <button className={styles.btnSmall} onClick={() => setShowAddExercise(openPlan.id)}>+ Ajouter</button>
                    </div>
                    {openPlan.exercises.length === 0 ? (
                      <p className={styles.exEmpty}>Aucun exercice. Ajoutez des vidéos depuis la bibliothèque.</p>
                    ) : (
                      <div className={styles.exList}>
                        {openPlan.exercises.map((ex, i) => (
                          <div key={ex.id} className={styles.exCard}>
                            <div className={styles.exCardLeft}>
                              <span className={styles.exPos}>{i + 1}</span>
                              <div className={styles.exInfo}>
                                <span className={styles.exName}>{ex.video.title}</span>
                                <span className={styles.exCat}>{CATEGORIES.find(c => c.value === ex.video.category)?.label || ex.video.category}</span>
                              </div>
                            </div>
                            <div className={styles.exParams}>
                              {ex.sets && <span className={styles.exParam}>{ex.sets} séries</span>}
                              {ex.reps && <span className={styles.exParam}>{ex.reps} reps</span>}
                              {ex.duration && <span className={styles.exParam}>{ex.duration}</span>}
                              {ex.rest && <span className={styles.exParam}>Repos {ex.rest}</span>}
                              {ex.frequency && <span className={styles.exParam}>{ex.frequency}</span>}
                              {ex.painThreshold != null && <span className={styles.exParam}>Douleur max {ex.painThreshold}/10</span>}
                              {ex.equipment && <span className={styles.exParam}>{ex.equipment}</span>}
                            </div>
                            <div className={styles.exActions}>
                              <button className={styles.exBtn} onClick={(e) => { e.stopPropagation(); setShowEditExercise(ex); }} title="Modifier">✎</button>
                              <button className={styles.exBtn} onClick={(e) => { e.stopPropagation(); deleteExercise(openPlan.id, ex.id); }} title="Supprimer">×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className={styles.detailActions}>
                    {openPlan.status === "draft" && (
                      <button className={styles.btnPrimary} onClick={() => updatePlanStatus(openPlan.id, "active")}>
                        Envoyer au patient
                      </button>
                    )}
                    <button className={styles.btnOutline} onClick={() => duplicatePlan(openPlan)}>Dupliquer</button>
                    <button className={styles.btnDanger} onClick={() => deletePlan(openPlan.id)}>Supprimer</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ TAB: VIDEOS ═══════ */}
          {tab === "videos" && (
            <div className={styles.videosTab}>
              <div className={styles.videoFilters}>
                <input className={styles.videoSearch} type="text" placeholder="Rechercher une vidéo..." value={videoSearch} onChange={e => setVideoSearch(e.target.value)} />
                <div className={styles.catChips}>
                  <button className={`${styles.catChip} ${!videoCategory ? styles.catChipActive : ""}`} onClick={() => setVideoCategory("")}>Toutes</button>
                  {CATEGORIES.map(c => (
                    <button key={c.value} className={`${styles.catChip} ${videoCategory === c.value ? styles.catChipActive : ""}`} onClick={() => setVideoCategory(videoCategory === c.value ? "" : c.value)}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <button className={styles.btnPrimary} onClick={() => setShowAddVideo(true)}>+ Ajouter une vidéo</button>
              </div>

              {videos.length === 0 ? (
                <div className={styles.emptyState}><p>Aucune vidéo. Ajoutez votre première vidéo d&apos;exercice.</p></div>
              ) : (
                <div className={styles.videoGrid}>
                  {videos.map(v => (
                    <div key={v.id} className={styles.videoCard}>
                      <div className={styles.videoThumb}>
                        {v.thumbnail ? <img src={v.thumbnail} alt={v.title} /> : <div className={styles.videoThumbPlaceholder}>▶</div>}
                      </div>
                      <div className={styles.videoInfo}>
                        <span className={styles.videoTitle}>{v.title}</span>
                        <span className={styles.videoCat}>{CATEGORIES.find(c => c.value === v.category)?.label || v.category}</span>
                        {v.duration && <span className={styles.videoDur}>{Math.floor(v.duration / 60)}:{String(v.duration % 60).padStart(2, "0")}</span>}
                      </div>
                      {openPlan && (
                        <button className={styles.btnSmall} onClick={() => {
                          fetch(`/api/kine/plans/${openPlan.id}/exercises`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ videoId: v.id }),
                          }).then(() => { refreshOpenPlan(openPlan.id); setTab("prescriptions"); });
                        }}>Ajouter au plan</button>
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

      {/* Create Plan Modal */}
      {showCreatePlan && <CreatePlanModal athleteId={selectedAthleteId} onClose={() => setShowCreatePlan(false)} onCreated={() => { setShowCreatePlan(false); fetchPlans(); fetchTemplates(); }} />}

      {/* Add Video Modal */}
      {showAddVideo && <AddVideoModal onClose={() => setShowAddVideo(false)} onCreated={() => { setShowAddVideo(false); fetchVideos(); }} />}

      {/* Add Exercise to Plan Modal */}
      {showAddExercise && <AddExerciseModal planId={showAddExercise} videos={videos} onClose={() => setShowAddExercise(null)} onAdded={() => { setShowAddExercise(null); refreshOpenPlan(showAddExercise); }} onNeedVideos={() => { setTab("videos"); setShowAddExercise(null); }} />}

      {/* Edit Exercise Modal */}
      {showEditExercise && openPlan && <EditExerciseModal exercise={showEditExercise} planId={openPlan.id} onClose={() => setShowEditExercise(null)} onSaved={() => { setShowEditExercise(null); refreshOpenPlan(openPlan.id); }} />}
    </div>
  );
}

/* ═══════════════ CREATE PLAN MODAL ═══════════════ */
function CreatePlanModal({ athleteId, onClose, onCreated }: { athleteId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [notesPro, setNotesPro] = useState("");
  const [notesPatient, setNotesPatient] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await fetch("/api/kine/plans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, objective, notesPro, notesPatient, frequency, startDate: startDate || null, endDate: endDate || null, athleteId, isTemplate, templateName: isTemplate ? templateName : null }),
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Nouveau plan de prescription</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Titre *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Lombaires — Semaine 2" autoFocus /></div>
          <div className={styles.field}><label>Objectif</label><input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Réduction douleur + mobilité + gainage" /></div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Début</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div className={styles.field}><label>Fin</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>
          <div className={styles.field}><label>Fréquence</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value)}>
              <option value="">— Choisir —</option>
              <option value="1x/jour">1x / jour</option>
              <option value="2x/jour">2x / jour</option>
              <option value="3x/semaine">3x / semaine</option>
              <option value="5x/semaine">5x / semaine</option>
              <option value="quotidien">Quotidien</option>
            </select>
          </div>
          <div className={styles.field}><label>Notes pro (privées)</label><textarea value={notesPro} onChange={e => setNotesPro(e.target.value)} rows={2} placeholder="Notes visibles uniquement par vous..." /></div>
          <div className={styles.field}><label>Note patient (visible)</label><textarea value={notesPatient} onChange={e => setNotesPatient(e.target.value)} rows={2} placeholder="Instructions pour le patient..." /></div>
          <label className={styles.checkboxLabel}><input type="checkbox" checked={isTemplate} onChange={e => setIsTemplate(e.target.checked)} /> Sauvegarder aussi comme template</label>
          {isTemplate && <div className={styles.field}><label>Nom du template</label><input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Ex: Lombalgie début" /></div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={saving || !title.trim()}>{saving ? "Création..." : "Créer"}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ YouTube helpers ═══════════════ */
function extractYouTubeId(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch { /* not a valid URL yet */ }
  return null;
}

function youTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function toEmbedUrl(raw: string): string {
  const id = extractYouTubeId(raw);
  if (id) return `https://www.youtube.com/embed/${id}`;
  return raw;
}

/* ═══════════════ ADD VIDEO MODAL ═══════════════ */
function AddVideoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleUrlChange = (raw: string) => {
    setUrl(raw);
    const ytId = extractYouTubeId(raw);
    if (ytId && !thumbnail) {
      setThumbnail(youTubeThumbnail(ytId));
    }
  };

  const submit = async () => {
    if (!title.trim() || !url.trim() || !category) return;
    setError("");
    setSaving(true);
    try {
      const finalUrl = toEmbedUrl(url);
      const dur = duration ? parseInt(duration, 10) : null;
      const res = await fetch("/api/kine/videos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          url: finalUrl,
          thumbnail: thumbnail || null,
          category,
          duration: dur && !isNaN(dur) ? dur : null,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.errors?.map((e: any) => e.message).join(", ") || "Erreur lors de l'ajout");
        setSaving(false);
        return;
      }
      setSaving(false);
      onCreated();
    } catch {
      setError("Erreur réseau");
      setSaving(false);
    }
  };

  const ytId = extractYouTubeId(url);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><h3>Ajouter une vidéo</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Titre *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Étirement psoas" autoFocus /></div>
          <div className={styles.field}><label>URL vidéo (YouTube) *</label><input value={url} onChange={e => handleUrlChange(e.target.value)} placeholder="https://youtube.com/watch?v=... ou https://youtu.be/..." /></div>
          {ytId && (
            <div className={styles.ytPreview}>
              <img src={youTubeThumbnail(ytId)} alt="Aperçu" />
            </div>
          )}
          <div className={styles.field}><label>Catégorie *</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">— Choisir —</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Thumbnail URL</label><input value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="Auto-rempli pour YouTube" /></div>
            <div className={styles.field}><label>Durée (sec)</label><input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="120" /></div>
          </div>
          <div className={styles.field}><label>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Consignes générales..." /></div>
          {error && <p className={styles.formError}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={saving || !title.trim() || !url.trim() || !category}>{saving ? "Ajout..." : "Ajouter"}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ ADD EXERCISE TO PLAN ═══════════════ */
function AddExerciseModal({ planId, videos, onClose, onAdded, onNeedVideos }: {
  planId: string; videos: Video[]; onClose: () => void; onAdded: () => void; onNeedVideos: () => void;
}) {
  const [videoId, setVideoId] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [duration, setDuration] = useState("");
  const [tempo, setTempo] = useState("");
  const [rest, setRest] = useState("");
  const [frequency, setFrequency] = useState("");
  const [painThreshold, setPainThreshold] = useState("");
  const [consignes, setConsignes] = useState("");
  const [equipment, setEquipment] = useState("");
  const [alternative, setAlternative] = useState("");
  const [saving, setSaving] = useState(false);
  const [allVideos, setAllVideos] = useState<Video[]>(videos);

  useEffect(() => {
    if (allVideos.length === 0) {
      fetch("/api/kine/videos").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllVideos(d); }).catch(() => {});
    }
  }, [allVideos.length]);

  const [error, setError] = useState("");

  const submit = async () => {
    if (!videoId) return;
    setError("");
    setSaving(true);
    try {
      const setsNum = sets ? parseInt(sets, 10) : null;
      const ptNum = painThreshold ? parseInt(painThreshold, 10) : null;
      const res = await fetch(`/api/kine/plans/${planId}/exercises`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          sets: setsNum && !isNaN(setsNum) ? setsNum : null,
          reps: reps || null,
          duration: duration || null,
          tempo: tempo || null,
          rest: rest || null,
          frequency: frequency || null,
          painThreshold: ptNum != null && !isNaN(ptNum) ? ptNum : null,
          consignes: consignes || null,
          equipment: equipment || null,
          alternative: alternative || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.errors?.map((e: any) => e.message).join(", ") || "Erreur lors de l'ajout");
        setSaving(false);
        return;
      }
      setSaving(false);
      onAdded();
    } catch {
      setError("Erreur réseau");
      setSaving(false);
    }
  };

  if (allVideos.length === 0) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.modalHeader}><h3>Ajouter un exercice</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
          <div className={styles.modalBody}>
            <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "24px 0" }}>Aucune vidéo dans votre bibliothèque. Ajoutez-en d&apos;abord.</p>
          </div>
          <div className={styles.modalFooter}>
            <button className={styles.btnOutline} onClick={onClose}>Fermer</button>
            <button className={styles.btnPrimary} onClick={onNeedVideos}>Aller à la bibliothèque</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className={styles.modalHeader}><h3>Ajouter un exercice</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}><label>Vidéo *</label>
            <select value={videoId} onChange={e => setVideoId(e.target.value)}>
              <option value="">— Choisir —</option>
              {allVideos.map(v => <option key={v.id} value={v.id}>{v.title} ({CATEGORIES.find(c => c.value === v.category)?.label})</option>)}
            </select>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Séries</label><input type="number" value={sets} onChange={e => setSets(e.target.value)} placeholder="3" /></div>
            <div className={styles.field}><label>Répétitions</label><input value={reps} onChange={e => setReps(e.target.value)} placeholder="12 ou 30s" /></div>
            <div className={styles.field}><label>Durée</label><input value={duration} onChange={e => setDuration(e.target.value)} placeholder="45s" /></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Tempo</label><input value={tempo} onChange={e => setTempo(e.target.value)} placeholder="2-1-2" /></div>
            <div className={styles.field}><label>Repos</label><input value={rest} onChange={e => setRest(e.target.value)} placeholder="60s" /></div>
            <div className={styles.field}><label>Fréquence</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)}>
                <option value="">—</option>
                <option value="1x/jour">1x/jour</option>
                <option value="2x/jour">2x/jour</option>
                <option value="3x/semaine">3x/sem</option>
              </select>
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Douleur max (/10)</label><input type="number" min="0" max="10" value={painThreshold} onChange={e => setPainThreshold(e.target.value)} placeholder="3" /></div>
            <div className={styles.field}><label>Matériel</label><input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="Élastique, ballon..." /></div>
          </div>
          <div className={styles.field}><label>Consignes spécifiques</label><textarea value={consignes} onChange={e => setConsignes(e.target.value)} rows={2} placeholder="Instructions pour cet exercice..." /></div>
          <div className={styles.field}><label>Alternative / régression</label><input value={alternative} onChange={e => setAlternative(e.target.value)} placeholder="Si douleur : version allongée..." /></div>
          {error && <p className={styles.formError}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={saving || !videoId}>{saving ? "Ajout..." : "Ajouter"}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ EDIT EXERCISE MODAL ═══════════════ */
function EditExerciseModal({ exercise, planId, onClose, onSaved }: {
  exercise: PlanExercise; planId: string; onClose: () => void; onSaved: () => void;
}) {
  const [sets, setSets] = useState(exercise.sets?.toString() || "");
  const [reps, setReps] = useState(exercise.reps || "");
  const [duration, setDuration] = useState(exercise.duration || "");
  const [tempo, setTempo] = useState(exercise.tempo || "");
  const [rest, setRest] = useState(exercise.rest || "");
  const [frequency, setFrequency] = useState(exercise.frequency || "");
  const [painThreshold, setPainThreshold] = useState(exercise.painThreshold?.toString() || "");
  const [consignes, setConsignes] = useState(exercise.consignes || "");
  const [equipment, setEquipment] = useState(exercise.equipment || "");
  const [alternative, setAlternative] = useState(exercise.alternative || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      const setsNum = sets ? parseInt(sets, 10) : null;
      const ptNum = painThreshold ? parseInt(painThreshold, 10) : null;
      const res = await fetch(`/api/kine/plans/${planId}/exercises`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: exercise.id,
          sets: setsNum && !isNaN(setsNum) ? setsNum : null,
          reps: reps || null,
          duration: duration || null,
          tempo: tempo || null,
          rest: rest || null,
          frequency: frequency || null,
          painThreshold: ptNum != null && !isNaN(ptNum) ? ptNum : null,
          consignes: consignes || null,
          equipment: equipment || null,
          alternative: alternative || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.errors?.map((e: any) => e.message).join(", ") || "Erreur");
        setSaving(false);
        return;
      }
      setSaving(false);
      onSaved();
    } catch {
      setError("Erreur réseau");
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className={styles.modalHeader}><h3>Modifier — {exercise.video.title}</h3><button className={styles.modalClose} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Séries</label><input type="number" value={sets} onChange={e => setSets(e.target.value)} placeholder="3" /></div>
            <div className={styles.field}><label>Répétitions</label><input value={reps} onChange={e => setReps(e.target.value)} placeholder="12 ou 30s" /></div>
            <div className={styles.field}><label>Durée</label><input value={duration} onChange={e => setDuration(e.target.value)} placeholder="45s" /></div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Tempo</label><input value={tempo} onChange={e => setTempo(e.target.value)} placeholder="2-1-2" /></div>
            <div className={styles.field}><label>Repos</label><input value={rest} onChange={e => setRest(e.target.value)} placeholder="60s" /></div>
            <div className={styles.field}><label>Fréquence</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)}>
                <option value="">—</option>
                <option value="1x/jour">1x/jour</option>
                <option value="2x/jour">2x/jour</option>
                <option value="3x/semaine">3x/sem</option>
              </select>
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Douleur max (/10)</label><input type="number" min="0" max="10" value={painThreshold} onChange={e => setPainThreshold(e.target.value)} placeholder="3" /></div>
            <div className={styles.field}><label>Matériel</label><input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="Élastique, ballon..." /></div>
          </div>
          <div className={styles.field}><label>Consignes spécifiques</label><textarea value={consignes} onChange={e => setConsignes(e.target.value)} rows={2} /></div>
          <div className={styles.field}><label>Alternative / régression</label><input value={alternative} onChange={e => setAlternative(e.target.value)} /></div>
          {error && <p className={styles.formError}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={saving}>{saving ? "..." : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}