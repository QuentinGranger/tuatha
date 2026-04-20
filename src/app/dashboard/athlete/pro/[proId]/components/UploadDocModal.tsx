"use client";

import { useState, useRef } from "react";
import styles from "../page.module.scss";
import { docIcon, fmtSize, UPLOAD_CATEGORIES } from "./types";

export default function UploadDocModal({ proId, onClose, onUploaded }: {
  proId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("autre");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!file) { setError("Choisissez un fichier"); return; }
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("proId", proId);
      fd.append("category", category);
      if (note.trim()) fd.append("note", note.trim());

      const res = await fetch("/api/athlete/documents", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors de l'envoi");
        setUploading(false);
        return;
      }
      setSuccess(true);
      setUploading(false);
      setTimeout(onUploaded, 600);
    } catch {
      setError("Erreur réseau");
      setUploading(false);
    }
  };

  return (
    <div className={styles.logOverlay} onClick={onClose}>
      <div className={styles.logModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.logHeader}>
          <h3>Envoyer un document</h3>
          <button className={styles.logClose} onClick={onClose}>×</button>
        </div>

        {success ? (
          <div className={styles.logSuccess}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Document envoyé !</span>
          </div>
        ) : (
          <>
            <div className={styles.logBody}>
              <div
                className={styles.docDropZone}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              >
                {file ? (
                  <div className={styles.docDropPreview}>
                    <span className={styles.docEmoji}>{docIcon(file.type)}</span>
                    <span className={styles.docDropName}>{file.name}</span>
                    <span className={styles.docDropSize}>{fmtSize(file.size)}</span>
                  </div>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "rgba(255,255,255,0.3)" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Cliquer ou glisser un fichier</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>PDF, Image, Word, Excel — Max 10 Mo</span>
                  </>
                )}
                <input ref={fileRef} type="file" hidden onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
              </div>

              <div className={styles.logField}>
                <label>Catégorie</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {UPLOAD_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.logField}>
                <label>Note (optionnel)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Ajouter un commentaire..."
                />
              </div>

              {error && <p className={styles.logError}>{error}</p>}
            </div>
            <div className={styles.logFooter}>
              <button className={styles.logCancelBtn} onClick={onClose}>Annuler</button>
              <button className={styles.logSubmitBtn} onClick={submit} disabled={!file || uploading}>
                {uploading ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
