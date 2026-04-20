"use client";

import { useState } from "react";
import styles from "../page.module.scss";
import type { KinePlan } from "./types";

export default function CreateAlertModal({ proId, plans, onClose, onCreated }: {
  proId: string;
  plans: KinePlan[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [planId, setPlanId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!title.trim()) { setError("Le titre est obligatoire"); return; }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/athlete/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proId,
          title: title.trim(),
          description: description.trim() || null,
          intensity,
          planId: planId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors de l'envoi");
        setSaving(false);
        return;
      }
      setSuccess(true);
      setSaving(false);
      setTimeout(onCreated, 600);
    } catch {
      setError("Erreur réseau");
      setSaving(false);
    }
  };

  const painColor = intensity <= 3 ? "#22c55e" : intensity <= 6 ? "#f59e0b" : "#ef4444";

  return (
    <div className={styles.logOverlay} onClick={onClose}>
      <div className={styles.logModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.logHeader}>
          <h3>Signaler un problème</h3>
          <button className={styles.logClose} onClick={onClose}>×</button>
        </div>

        {success ? (
          <div className={styles.logSuccess}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Signalement envoyé !</span>
          </div>
        ) : (
          <>
            <div className={styles.logBody}>
              <div className={styles.logField}>
                <label>Titre *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Douleur au genou droit"
                  maxLength={200}
                />
              </div>

              <div className={styles.logField}>
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Décrivez le problème rencontré..."
                />
              </div>

              <div className={styles.logSlider}>
                <div className={styles.logSliderHeader}>
                  <label>Intensité de la douleur</label>
                  <span className={styles.logSliderValue} style={{ color: painColor }}>{intensity}/10</span>
                </div>
                <input
                  type="range" min="0" max="10" value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className={styles.logRange}
                  style={{ accentColor: painColor }}
                />
                <div className={styles.logSliderLabels}>
                  <span>Aucune</span>
                  <span>Insupportable</span>
                </div>
              </div>

              {plans.length > 0 && (
                <div className={styles.logField}>
                  <label>Programme concerné (optionnel)</label>
                  <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                    <option value="">— Aucun —</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {error && <p className={styles.logError}>{error}</p>}
            </div>
            <div className={styles.logFooter}>
              <button className={styles.logCancelBtn} onClick={onClose}>Annuler</button>
              <button className={styles.logSubmitBtn} onClick={submit} disabled={saving}>
                {saving ? "Envoi..." : "Envoyer le signalement"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
