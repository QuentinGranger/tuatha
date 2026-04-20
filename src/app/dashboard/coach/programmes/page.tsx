"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

interface SessionAthlete {
  id: string;
  name: string;
  sport: string | null;
  status: string;
}

interface ExerciseItem {
  id: string;
  name: string;
}

interface Block {
  id: string;
  name: string;
  exercises: ExerciseItem[];
}

interface SessionItem {
  id: string;
  name: string;
  date: string;
  time: string | null;
  lieu: string | null;
  status: string;
  objectif: string | null;
  tags: string[];
  athlete: SessionAthlete | null;
  blocks: Block[];
}

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
};

const STATUS_FILTERS = ["all", "brouillon", "planifiee", "en_cours", "realisee", "annulee"];

export default function ProgrammesPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [athleteFilter, setAthleteFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [athletes, setAthletes] = useState<SessionAthlete[]>([]);

  // Create form
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newLieu, setNewLieu] = useState("");
  const [newAthleteId, setNewAthleteId] = useState("");
  const [newObjectif, setNewObjectif] = useState("");

  const fetchSessions = useCallback(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (athleteFilter) params.set("athleteId", athleteFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";
    setLoading(true);
    setError(null);
    fetch(`/api/programmes${qs}`)
      .then((r) => {
        if (!r.ok) {
          return r.json().catch(() => ({})).then((b: any) => { throw new Error(`GET ${r.status}: ${b.error || b.code || 'Unknown'}`) });
        }
        return r.json();
      })
      .then((d) => { if (Array.isArray(d)) setSessions(d); else setError('Réponse inattendue du serveur'); })
      .catch((err) => { console.error('[programmes] fetch error:', err); setError(String(err.message || err)); })
      .finally(() => setLoading(false));
  }, [filter, athleteFilter]);

  const fetchAthletes = useCallback(() => {
    fetch("/api/athletes?status=active")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAthletes(d); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchAthletes(); }, [fetchAthletes]);

  const createSession = async () => {
    if (!newName.trim() || !newDate) return;
    try {
      const res = await fetch("/api/programmes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          date: newDate,
          time: newTime || null,
          lieu: newLieu || null,
          athleteId: newAthleteId || null,
          objectif: newObjectif || null,
        }),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        let msg = `Erreur ${res.status}`;
        try { const j = JSON.parse(raw); msg = j.error || j.code || msg; } catch { msg = raw.slice(0, 200) || msg; }
        console.error("[programmes] POST failed:", res.status, raw.slice(0, 500));
        setError(`Création échouée : ${msg}`);
        return;
      }
    } catch (err) {
      console.error("[programmes] POST error:", err);
      setError(`Création échouée : ${(err as Error).message || err}`);
      return;
    }
    setShowCreate(false);
    setNewName(""); setNewDate(""); setNewTime(""); setNewLieu(""); setNewAthleteId(""); setNewObjectif("");
    fetchSessions();
  };

  const deleteSession = async (id: string) => {
    await fetch(`/api/programmes/${id}`, { method: "DELETE" });
    fetchSessions();
  };

  const duplicateSession = async (s: SessionItem) => {
    await fetch("/api/programmes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${s.name} (copie)`,
        date: new Date().toISOString(),
        time: s.time,
        lieu: s.lieu,
        athleteId: s.athlete?.id || null,
        objectif: s.objectif,
        tags: s.tags,
      }),
    });
    fetchSessions();
  };

  const getInitials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const exerciseCount = (s: SessionItem) => s.blocks.reduce((acc, b) => acc + b.exercises.length, 0);

  const filtered = sessions;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Programmes</h1>
          <span className={styles.count}>{sessions.length} séance{sessions.length !== 1 ? "s" : ""}</span>
        </div>
        <div className={styles.headerActions}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Toutes" : STATUS_LABELS[f]}
            </button>
          ))}
          <select
            className={styles.filterBtn}
            value={athleteFilter}
            onChange={(e) => setAthleteFilter(e.target.value)}
          >
            <option value="">Tous les athlètes</option>
            {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>+ Nouvelle séance</button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "14px 18px", marginBottom: 18, color: "#f87171", fontSize: 13 }}>
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <div className={styles.emptyTitle}>Aucune séance</div>
          <p className={styles.emptyText}>Créez votre première séance pour commencer à planifier.</p>
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>+ Nouvelle séance</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((s) => (
            <div key={s.id} className={styles.card} onClick={() => router.push(`/dashboard/coach/programmes/${s.id}`)}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardName}>{s.name}</h3>
                <span className={`${styles.statusChip} ${styles[`status_${s.status}`]}`}>
                  {STATUS_LABELS[s.status] || s.status}
                </span>
              </div>

              <div className={styles.cardMeta}>
                <span className={styles.metaItem}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  {new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                {s.time && (
                  <span className={styles.metaItem}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                    {s.time}
                  </span>
                )}
                {s.lieu && (
                  <span className={styles.metaItem}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {s.lieu}
                  </span>
                )}
              </div>

              {s.athlete && (
                <div className={styles.cardAthlete}>
                  <span className={styles.athleteAvatar}>{getInitials(s.athlete.name)}</span>
                  {s.athlete.name}
                  {s.athlete.sport && <span style={{ opacity: 0.5 }}>· {s.athlete.sport}</span>}
                </div>
              )}

              {s.tags.length > 0 && (
                <div className={styles.cardTags}>
                  {s.tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}
                </div>
              )}

              <div className={styles.cardExCount}>
                {exerciseCount(s)} exercice{exerciseCount(s) !== 1 ? "s" : ""} · {s.blocks.length} bloc{s.blocks.length !== 1 ? "s" : ""}
              </div>

              <div className={styles.cardActions}>
                <button className={styles.cardActionBtn} onClick={(e) => { e.stopPropagation(); duplicateSession(s); }} title="Dupliquer">⧉</button>
                <button className={styles.cardActionBtn} onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} title="Supprimer">×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Nouvelle séance</h2>

            <div className={styles.field}>
              <label>Nom de la séance *</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Natation / Renfo / Rehab..." autoFocus />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Date *</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>Heure</label>
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Lieu</label>
                <select value={newLieu} onChange={(e) => setNewLieu(e.target.value)}>
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
                <select value={newAthleteId} onChange={(e) => setNewAthleteId(e.target.value)}>
                  <option value="">— Aucun —</option>
                  {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label>Objectif</label>
              <textarea value={newObjectif} onChange={(e) => setNewObjectif(e.target.value)} placeholder="Ex: Récupération active, renforcement épaule..." rows={2} />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Annuler</button>
              <button className={styles.submitBtn} onClick={createSession} disabled={!newName.trim() || !newDate}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
