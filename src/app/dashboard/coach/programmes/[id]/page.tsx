"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./page.module.scss";

/* ─── Types ─── */
interface ExItem {
  id: string;
  name: string;
  sets: string | null;
  reps: string | null;
  duration: string | null;
  distance: string | null;
  intensity: string | null;
  tempo: string | null;
  repos: string | null;
  consignes: string | null;
  videoUrl: string | null;
  position: number;
}

interface BlockItem {
  id: string;
  name: string;
  position: number;
  exercises: ExItem[];
}

interface SessionDetail {
  id: string;
  name: string;
  date: string;
  time: string | null;
  lieu: string | null;
  status: string;
  visibleAthlete: boolean;
  visiblePros: boolean;
  objectif: string | null;
  tags: string[];
  notePro: string | null;
  rpeCible: string | null;
  zoneCardio: string | null;
  contraintes: string[];
  criteresArret: string[];
  focusTechnique: string[];
  rpeRessenti: number | null;
  douleur: number | null;
  douleurZone: string | null;
  feedbackAthlete: string | null;
  analysePro: string | null;
  recommandation: string | null;
  athlete: { id: string; name: string; sport: string | null; status: string } | null;
  blocks: BlockItem[];
}

interface AthleteOption {
  id: string;
  name: string;
}

/* ─── Constants ─── */
const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon", planifiee: "Planifiée", en_cours: "En cours",
  realisee: "Réalisée", annulee: "Annulée",
};

const STATUS_FLOW: Record<string, { label: string; next: string }> = {
  brouillon: { label: "Envoyer à l\u2019athlète", next: "planifiee" },
  planifiee: { label: "Démarrer", next: "en_cours" },
  en_cours: { label: "Marquer réalisée", next: "realisee" },
};

const TAG_OPTIONS = ["Rehab", "Technique", "Endurance", "Force", "Mobilité", "Cardio", "WOD", "Récup"];

const CONTRAINTE_OPTIONS = [
  "Pas d\u2019impact", "Pas d\u2019overhead", "Limiter ROM",
  "Éviter douleur > 3/10", "Pas de charge lourde", "Pas de rotation",
];

const BLOCK_PRESETS = ["Warm-up", "Main", "Accessory", "Cooldown"];

/* ─── Component ─── */
export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [exModal, setExModal] = useState<{ blockId: string; exercise?: ExItem } | null>(null);

  // Exercise form
  const [exName, setExName] = useState("");
  const [exSets, setExSets] = useState("");
  const [exReps, setExReps] = useState("");
  const [exDuration, setExDuration] = useState("");
  const [exIntensity, setExIntensity] = useState("");
  const [exRepos, setExRepos] = useState("");
  const [exConsignes, setExConsignes] = useState("");
  const [exVideo, setExVideo] = useState("");

  const fetchSession = useCallback(() => {
    setLoading(true);
    fetch(`/api/programmes/${sessionId}`)
      .then((r) => r.json())
      .then((d) => { if (d.id) setSession(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);
  useEffect(() => {
    fetch("/api/athletes?status=active").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAthletes(d); }).catch(() => {});
  }, []);

  const patch = async (data: Record<string, unknown>) => {
    await fetch(`/api/programmes/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchSession();
  };

  const addBlock = async (name: string) => {
    await fetch(`/api/programmes/${sessionId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    fetchSession();
  };

  const deleteBlock = async (blockId: string) => {
    await fetch(`/api/programmes/${sessionId}/blocks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId }),
    });
    fetchSession();
  };

  const openExModal = (blockId: string, exercise?: ExItem) => {
    setExModal({ blockId, exercise });
    if (exercise) {
      setExName(exercise.name);
      setExSets(exercise.sets || "");
      setExReps(exercise.reps || "");
      setExDuration(exercise.duration || "");
      setExIntensity(exercise.intensity || "");
      setExRepos(exercise.repos || "");
      setExConsignes(exercise.consignes || "");
      setExVideo(exercise.videoUrl || "");
    } else {
      setExName(""); setExSets(""); setExReps(""); setExDuration("");
      setExIntensity(""); setExRepos(""); setExConsignes(""); setExVideo("");
    }
  };

  const saveExercise = async () => {
    if (!exModal || !exName.trim()) return;
    const payload = {
      name: exName, sets: exSets || null, reps: exReps || null,
      duration: exDuration || null, intensity: exIntensity || null,
      repos: exRepos || null, consignes: exConsignes || null,
      videoUrl: exVideo || null,
    };
    if (exModal.exercise) {
      await fetch(`/api/programmes/${sessionId}/exercises`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId: exModal.exercise.id, ...payload }),
      });
    } else {
      await fetch(`/api/programmes/${sessionId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: exModal.blockId, ...payload }),
      });
    }
    setExModal(null);
    fetchSession();
  };

  const deleteExercise = async (exerciseId: string) => {
    await fetch(`/api/programmes/${sessionId}/exercises`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId }),
    });
    fetchSession();
  };

  const duplicateSession = async () => {
    if (!session) return;
    const res = await fetch("/api/programmes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${session.name} (copie)`,
        date: new Date().toISOString(),
        time: session.time,
        lieu: session.lieu,
        athleteId: session.athlete?.id || null,
        objectif: session.objectif,
        tags: session.tags,
      }),
    });
    const created = await res.json();
    if (created.id) router.push(`/dashboard/coach/programmes/${created.id}`);
  };

  const deleteSession = async () => {
    await fetch(`/api/programmes/${sessionId}`, { method: "DELETE" });
    router.push("/dashboard/coach/programmes");
  };

  const toggleTag = (tag: string) => {
    if (!session) return;
    const tags = session.tags.includes(tag) ? session.tags.filter((t) => t !== tag) : [...session.tags, tag];
    patch({ tags });
  };

  const toggleContrainte = (c: string) => {
    if (!session) return;
    const arr = session.contraintes.includes(c) ? session.contraintes.filter((x) => x !== c) : [...session.contraintes, c];
    patch({ contraintes: arr });
  };

  const toggleFocus = (f: string) => {
    if (!session) return;
    const arr = session.focusTechnique.includes(f) ? session.focusTechnique.filter((x) => x !== f) : [...session.focusTechnique, f];
    patch({ focusTechnique: arr });
  };

  const getInitials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  if (loading) return <div className={styles.loading}>Chargement...</div>;
  if (!session) return <div className={styles.loading}>Séance introuvable</div>;

  const totalExercises = session.blocks.reduce((a, b) => a + b.exercises.length, 0);

  return (
    <div className={styles.page}>
      {/* ─── 1) Header ─── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push("/dashboard/coach/programmes")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
        </button>
        <div className={styles.headerInfo}>
          <h1 className={styles.headerTitle}>
            {session.name}
            <span className={`${styles.statusChip} ${styles[`status_${session.status}`]}`}>
              {STATUS_LABELS[session.status]}
            </span>
          </h1>
          <div className={styles.headerSub}>
            <span>{new Date(session.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            {session.time && <span>· {session.time}</span>}
            {session.lieu && <span>· {session.lieu}</span>}
            <span>· {totalExercises} exercice{totalExercises !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          {STATUS_FLOW[session.status] && (
            <button className={styles.actionBtnPrimary} onClick={() => patch({ status: STATUS_FLOW[session.status].next })}>
              {STATUS_FLOW[session.status].label}
            </button>
          )}
          {session.status === "planifiee" && (
            <button className={styles.actionBtn} onClick={() => patch({ status: "annulee" })}>Annuler</button>
          )}
          <button className={styles.actionBtn} onClick={duplicateSession}>Dupliquer</button>
          <button className={styles.actionBtnDanger} onClick={deleteSession}>Supprimer</button>
        </div>
      </div>

      {/* Athlete chip */}
      {session.athlete && (
        <div className={styles.athleteChip}>
          <span className={styles.athleteAv}>{getInitials(session.athlete.name)}</span>
          <span className={styles.athleteName}>{session.athlete.name}</span>
          {session.athlete.sport && <span className={styles.athleteMeta}>· {session.athlete.sport}</span>}
          <span className={styles.athleteMeta}>· Suivi {session.athlete.status === "active" ? "actif" : session.athlete.status}</span>
        </div>
      )}

      <div className={styles.sections}>
        {/* ─── 2) Carte Séance ─── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            Séance
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Nom</label>
              <input defaultValue={session.name} onBlur={(e) => e.target.value !== session.name && patch({ name: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>Date</label>
              <input type="date" defaultValue={session.date.slice(0, 10)} onBlur={(e) => patch({ date: e.target.value })} />
            </div>
          </div>
          <div className={styles.fieldRow3}>
            <div className={styles.field}>
              <label>Heure</label>
              <input type="time" defaultValue={session.time || ""} onBlur={(e) => patch({ time: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>Lieu</label>
              <select defaultValue={session.lieu || ""} onChange={(e) => patch({ lieu: e.target.value })}>
                <option value="">— Aucun —</option>
                <option value="Salle">Salle</option>
                <option value="Centre aquatique">Centre aquatique</option>
                <option value="Extérieur">Extérieur</option>
                <option value="À domicile">À domicile</option>
                <option value="Cabinet">Cabinet</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Athlète</label>
              <select defaultValue={session.athlete?.id || ""} onChange={(e) => patch({ athleteId: e.target.value || null })}>
                <option value="">— Aucun —</option>
                {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Visible par l&apos;athlète</span>
            <button className={`${styles.toggle} ${session.visibleAthlete ? styles.toggleOn : ""}`} onClick={() => patch({ visibleAthlete: !session.visibleAthlete })} />
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Visible par autres pros</span>
            <button className={`${styles.toggle} ${session.visiblePros ? styles.toggleOn : ""}`} onClick={() => patch({ visiblePros: !session.visiblePros })} />
          </div>
        </div>

        {/* ─── 3) Carte Objectif ─── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
            Objectif
          </div>
          <div className={styles.field}>
            <label>Objectif de la séance</label>
            <textarea defaultValue={session.objectif || ""} onBlur={(e) => patch({ objectif: e.target.value })} placeholder="Ex: Récupération active, travail technique..." rows={2} />
          </div>
          <div className={styles.field}>
            <label>Tags</label>
            <div className={styles.chipGroup}>
              {TAG_OPTIONS.map((t) => (
                <button key={t} className={session.tags.includes(t) ? styles.chipActive : styles.chip} onClick={() => toggleTag(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label>Note pro (privée)</label>
            <textarea defaultValue={session.notePro || ""} onBlur={(e) => patch({ notePro: e.target.value })} placeholder="Ex: RPE bas, focus amplitude épaule..." rows={2} />
          </div>
        </div>

        {/* ─── 4) Carte Prescription ─── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15h6" /></svg>
            Prescription
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>RPE cible</label>
              <input defaultValue={session.rpeCible || ""} onBlur={(e) => patch({ rpeCible: e.target.value })} placeholder="Ex: 3-4 /10" />
            </div>
            <div className={styles.field}>
              <label>Zone cardio</label>
              <input defaultValue={session.zoneCardio || ""} onBlur={(e) => patch({ zoneCardio: e.target.value })} placeholder="Ex: Z1-Z2, 60-70% FCmax" />
            </div>
          </div>
          <div className={styles.field}>
            <label>Contraintes / Restrictions</label>
            <div className={styles.chipGroup}>
              {CONTRAINTE_OPTIONS.map((c) => (
                <button key={c} className={session.contraintes.includes(c) ? styles.chipActive : styles.chip} onClick={() => toggleContrainte(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label>Critères d&apos;arrêt</label>
            <div className={styles.constraintList}>
              {session.criteresArret.map((c, i) => (
                <div key={i} className={styles.constraintItem}>
                  <span className={styles.constraintDot} />
                  {c}
                </div>
              ))}
            </div>
            <button className={styles.addConstraint} onClick={() => {
              const v = prompt("Critère d\u2019arrêt :");
              if (v) patch({ criteresArret: [...session.criteresArret, v] });
            }}>+ Ajouter un critère d&apos;arrêt</button>
          </div>
          <div className={styles.field}>
            <label>Focus technique (1-3 points max)</label>
            <div className={styles.chipGroup}>
              {["Respiration", "Alignement", "Gainage", "Amplitude", "Tempo", "Proprioception"].map((f) => (
                <button key={f} className={session.focusTechnique.includes(f) ? styles.chipActive : styles.chip} onClick={() => toggleFocus(f)}>{f}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── 5) Carte Exercices ─── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            Exercices
            <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{totalExercises} exercice{totalExercises !== 1 ? "s" : ""} · {session.blocks.length} bloc{session.blocks.length !== 1 ? "s" : ""}</span>
          </div>

          {session.blocks.length === 0 && totalExercises === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
              Aucun exercice ajouté
            </div>
          ) : null}

          {session.blocks.map((block) => (
            <div key={block.id} className={styles.blockSection}>
              <div className={styles.blockHeader}>
                <div className={styles.blockName}>
                  {block.name}
                  <span className={styles.blockBadge}>{block.exercises.length}</span>
                </div>
                <div className={styles.blockActions}>
                  <button className={styles.blockActionBtn} onClick={() => deleteBlock(block.id)} title="Supprimer le bloc">×</button>
                </div>
              </div>

              {block.exercises.map((ex) => (
                <div key={ex.id} className={styles.exerciseCard}>
                  <span className={styles.exerciseDrag}>⠿</span>
                  <div className={styles.exerciseInfo}>
                    <div className={styles.exerciseName}>{ex.name}</div>
                    <div className={styles.exerciseDetails}>
                      {ex.sets && <span className={styles.exerciseDetail}>{ex.sets} sets</span>}
                      {ex.reps && <span className={styles.exerciseDetail}>{ex.reps} reps</span>}
                      {ex.duration && <span className={styles.exerciseDetail}>{ex.duration}</span>}
                      {ex.intensity && <span className={styles.exerciseDetail}>RPE {ex.intensity}</span>}
                      {ex.repos && <span className={styles.exerciseDetail}>Repos {ex.repos}</span>}
                    </div>
                    {ex.consignes && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{ex.consignes}</div>}
                  </div>
                  <div className={styles.exerciseActions}>
                    <button className={styles.exActionBtn} onClick={() => openExModal(block.id, ex)} title="Modifier">✎</button>
                    <button className={styles.exActionBtn} onClick={() => deleteExercise(ex.id)} title="Supprimer">×</button>
                  </div>
                </div>
              ))}

              <button className={styles.addExerciseBtn} onClick={() => openExModal(block.id)}>+ Ajouter un exercice</button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {BLOCK_PRESETS.map((bp) => (
              <button key={bp} className={styles.addBlockBtn} onClick={() => addBlock(bp)} style={{ flex: "1 1 auto" }}>+ Bloc {bp}</button>
            ))}
          </div>
        </div>

        {/* ─── 6) Carte Données & Suivi ─── */}
        {(session.status === "realisee" || session.status === "en_cours") && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              Données &amp; Suivi
            </div>

            <div className={styles.feedbackGrid}>
              <div className={styles.feedbackBox}>
                <div className={styles.feedbackLabel}>RPE ressenti</div>
                <div className={styles.rpeBar}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      className={`${styles.rpeDot} ${session.rpeRessenti === n ? styles.rpeDotActive : ""}`}
                      onClick={() => patch({ rpeRessenti: session.rpeRessenti === n ? null : n })}
                    >{n}</button>
                  ))}
                </div>
              </div>

              <div className={styles.feedbackBox}>
                <div className={styles.feedbackLabel}>Douleur (0-10)</div>
                <div className={styles.rpeBar}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      className={`${styles.rpeDot} ${session.douleur === n ? styles.rpeDotPain : ""}`}
                      onClick={() => patch({ douleur: session.douleur === n ? null : n })}
                    >{n}</button>
                  ))}
                </div>
                <div className={styles.field} style={{ marginTop: 10, marginBottom: 0 }}>
                  <input defaultValue={session.douleurZone || ""} onBlur={(e) => patch({ douleurZone: e.target.value })} placeholder="Localisation douleur..." />
                </div>
              </div>
            </div>

            <div className={styles.field} style={{ marginTop: 16 }}>
              <label>Feedback athlète</label>
              <textarea defaultValue={session.feedbackAthlete || ""} onBlur={(e) => patch({ feedbackAthlete: e.target.value })} placeholder="Tout allait bien / douleur épaule / fatigue..." rows={2} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Analyse pro</label>
                <textarea defaultValue={session.analysePro || ""} onBlur={(e) => patch({ analysePro: e.target.value })} placeholder="OK / À ajuster..." rows={2} />
              </div>
              <div className={styles.field}>
                <label>Recommandation prochaine séance</label>
                <textarea defaultValue={session.recommandation || ""} onBlur={(e) => patch({ recommandation: e.target.value })} placeholder="Augmenter volume, garder intensité..." rows={2} />
              </div>
            </div>
          </div>
        )}

        {/* ─── 7) Actions Bar ─── */}
        <div className={styles.actionsBar}>
          <button className={styles.actionBtn} onClick={() => {
            const dataStr = JSON.stringify(session, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `${session.name}.json`; a.click();
          }}>
            Export JSON
          </button>
          <div className={styles.actionsBarSep} />
          {STATUS_FLOW[session.status] && (
            <button className={styles.actionBtnPrimary} onClick={() => patch({ status: STATUS_FLOW[session.status].next })}>
              {STATUS_FLOW[session.status].label}
            </button>
          )}
          {session.status === "planifiee" && (
            <button className={styles.actionBtn} onClick={() => patch({ status: "annulee" })}>Annuler séance</button>
          )}
          <button className={styles.actionBtn} onClick={duplicateSession}>Dupliquer</button>
          <div className={styles.actionsBarSep} />
          <button className={styles.actionBtnDanger} onClick={deleteSession}>Supprimer</button>
          <button className={styles.actionBtn} style={{ marginLeft: "auto" }} onClick={() => router.push("/dashboard/coach/programmes")}>Fermer</button>
        </div>
      </div>

      {/* ─── Exercise Modal ─── */}
      {exModal && (
        <div className={styles.modalOverlay} onClick={() => setExModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{exModal.exercise ? "Modifier l\u2019exercice" : "Ajouter un exercice"}</h2>
            <div className={styles.field}>
              <label>Nom *</label>
              <input value={exName} onChange={(e) => setExName(e.target.value)} placeholder="Ex: Squat, Crawl, Planche..." autoFocus />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Sets</label>
                <input value={exSets} onChange={(e) => setExSets(e.target.value)} placeholder="3" />
              </div>
              <div className={styles.field}>
                <label>Reps</label>
                <input value={exReps} onChange={(e) => setExReps(e.target.value)} placeholder="12" />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Durée</label>
                <input value={exDuration} onChange={(e) => setExDuration(e.target.value)} placeholder="30s / 5min" />
              </div>
              <div className={styles.field}>
                <label>Intensité (RPE/charge)</label>
                <input value={exIntensity} onChange={(e) => setExIntensity(e.target.value)} placeholder="RPE 6 / 60kg" />
              </div>
            </div>
            <div className={styles.field}>
              <label>Repos</label>
              <input value={exRepos} onChange={(e) => setExRepos(e.target.value)} placeholder="60s / 2min" />
            </div>
            <div className={styles.field}>
              <label>Consignes / tips</label>
              <textarea value={exConsignes} onChange={(e) => setExConsignes(e.target.value)} placeholder="Garder dos droit, respirer..." rows={2} />
            </div>
            <div className={styles.field}>
              <label>Vidéo / lien</label>
              <input value={exVideo} onChange={(e) => setExVideo(e.target.value)} placeholder="https://..." />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setExModal(null)}>Annuler</button>
              <button className={styles.submitBtn} onClick={saveExercise} disabled={!exName.trim()}>
                {exModal.exercise ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
