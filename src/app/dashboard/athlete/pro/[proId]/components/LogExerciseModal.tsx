"use client";

import { useState } from "react";
import styles from "../page.module.scss";

function sliderColor(value: number, palette: "pain" | "difficulty"): string {
  if (palette === "pain") return value <= 3 ? "#22c55e" : value <= 6 ? "#f59e0b" : "#ef4444";
  return value <= 3 ? "#22c55e" : value <= 6 ? "#3b82f6" : "#a855f7";
}

export default function LogExerciseModal({ exerciseId, planId, videoTitle, onClose, onLogged }: {
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
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/athlete/exercise-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId,
          planId,
          done,
          pain,
          difficulty,
          comment: comment.trim() || null,
          date,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors de l'enregistrement");
        setSaving(false);
        return;
      }
      setSuccess(true);
      setSaving(false);
      setTimeout(onLogged, 600);
    } catch {
      setError("Erreur réseau");
      setSaving(false);
    }
  };

  return (
    <div className={styles.logOverlay} onClick={onClose}>
      <div className={styles.logModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.logHeader}>
          <h3>Logger un exercice</h3>
          <button className={styles.logClose} onClick={onClose}>×</button>
        </div>

        {success ? (
          <div className={styles.logSuccess}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Session enregistrée !</span>
          </div>
        ) : (
          <>
            <div className={styles.logBody}>
              <div className={styles.logExName}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                {videoTitle}
              </div>

              <div className={styles.logDoneToggle}>
                <button
                  className={`${styles.logDoneBtn} ${done ? styles.logDoneBtnActive : ""}`}
                  onClick={() => setDone(true)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  Fait
                </button>
                <button
                  className={`${styles.logDoneBtn} ${!done ? styles.logDoneBtnNotDone : ""}`}
                  onClick={() => setDone(false)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  Pas fait
                </button>
              </div>

              <div className={styles.logSlider}>
                <div className={styles.logSliderHeader}>
                  <label>Douleur ressentie</label>
                  <span className={styles.logSliderValue} style={{ color: sliderColor(pain, "pain") }}>{pain}/10</span>
                </div>
                <input
                  type="range" min="0" max="10" value={pain}
                  onChange={(e) => setPain(Number(e.target.value))}
                  className={styles.logRange}
                  style={{ accentColor: sliderColor(pain, "pain") }}
                />
                <div className={styles.logSliderLabels}>
                  <span>Aucune</span>
                  <span>Insupportable</span>
                </div>
              </div>

              <div className={styles.logSlider}>
                <div className={styles.logSliderHeader}>
                  <label>Difficulté perçue</label>
                  <span className={styles.logSliderValue} style={{ color: sliderColor(difficulty, "difficulty") }}>{difficulty}/10</span>
                </div>
                <input
                  type="range" min="0" max="10" value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className={styles.logRange}
                  style={{ accentColor: sliderColor(difficulty, "difficulty") }}
                />
                <div className={styles.logSliderLabels}>
                  <span>Facile</span>
                  <span>Très difficile</span>
                </div>
              </div>

              <div className={styles.logField}>
                <label>Commentaire libre (optionnel)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Sensation, remarque, progression..."
                />
              </div>

              <div className={styles.logField}>
                <label>Date</label>
                <input
                  type="date" value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={todayStr}
                  className={styles.logDateInput}
                />
              </div>

              {error && <p className={styles.logError}>{error}</p>}
            </div>
            <div className={styles.logFooter}>
              <button className={styles.logCancelBtn} onClick={onClose}>Annuler</button>
              <button className={styles.logSubmitBtn} onClick={submit} disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer la session"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
