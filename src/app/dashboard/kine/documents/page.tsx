"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./page.module.scss";

interface Doc {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
  category: string;
  note: string | null;
  senderProId: string;
  senderPro: { id: string; nom: string; prenom: string; specialite: string };
  receiverPro: { id: string; nom: string; prenom: string; specialite: string } | null;
  receiverAthlete: { id: string; name: string } | null;
  athlete: { id: string; name: string } | null;
  readAt: string | null;
  createdAt: string;
}

interface ProOption { id: string; nom: string; prenom: string; specialite: string | null }
interface AthleteOption { id: string; name: string; contactEmail: string | null }

const CATEGORIES = [
  { value: "bilan", label: "Bilan" },
  { value: "ordonnance", label: "Ordonnance" },
  { value: "imagerie", label: "Imagerie" },
  { value: "compte-rendu", label: "Compte-rendu" },
  { value: "programme", label: "Programme" },
  { value: "administratif", label: "Administratif" },
  { value: "autre", label: "Autre" },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return "📊";
  return "📎";
}

export default function DocumentsPage() {
  const [tab, setTab] = useState<"pro" | "athlete">("pro");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [myProId, setMyProId] = useState("");

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("autre");
  const [uploadNote, setUploadNote] = useState("");
  const [uploadReceiver, setUploadReceiver] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Receiver options
  const [pros, setPros] = useState<ProOption[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);

  // Drag state
  const [dragOver, setDragOver] = useState(false);

  // Preview lightbox
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.id) setMyProId(d.id); });
  }, []);

  const fetchDocs = useCallback(() => {
    setLoading(true);
    fetch(`/api/documents?type=${tab}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDocs(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Reset receiver when switching tabs
  useEffect(() => { setUploadReceiver(""); }, [tab]);

  // Fetch receiver options
  useEffect(() => {
    // Pros from connections
    fetch("/api/messagerie/contacts")
      .then(r => r.json())
      .then(d => { if (d.professionals) setPros(d.professionals); })
      .catch(() => {});
    // Athletes directly
    fetch("/api/athletes")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAthletes(d); })
      .catch(() => {});
  }, []);

  const handleUpload = async () => {
    if (!uploadFile || !uploadReceiver) return;
    setUploading(true);
    setUploadError("");
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("category", uploadCategory);
    if (uploadNote) fd.append("note", uploadNote);
    if (tab === "pro") fd.append("receiverProId", uploadReceiver);
    else fd.append("receiverAthleteId", uploadReceiver);

    try {
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        setUploadError(err.error || "Erreur");
        return;
      }
      setUploadOpen(false);
      setUploadFile(null);
      setUploadNote("");
      setUploadReceiver("");
      setUploadCategory("autre");
      fetchDocs();
    } catch {
      setUploadError("Erreur réseau");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce document ?")) return;
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    fetchDocs();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setUploadFile(file); setUploadOpen(true); }
  };

  // Filter docs
  const filtered = docs.filter(d => {
    if (catFilter !== "all" && d.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = d.originalName.toLowerCase().includes(q)
        || d.senderPro.prenom.toLowerCase().includes(q)
        || d.senderPro.nom.toLowerCase().includes(q)
        || d.receiverPro?.prenom?.toLowerCase().includes(q)
        || d.receiverPro?.nom?.toLowerCase().includes(q)
        || d.receiverAthlete?.name?.toLowerCase().includes(q)
        || d.note?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Documents</h1>
        <button className={styles.uploadBtn} onClick={() => setUploadOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Envoyer un document
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "pro" ? styles.tabActive : ""}`} onClick={() => setTab("pro")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Professionnels
        </button>
        <button className={`${styles.tab} ${tab === "athlete" ? styles.tabActive : ""}`} onClick={() => setTab("athlete")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          Patients
        </button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un document..." />
        </div>
        <div className={styles.catFilters}>
          <button className={`${styles.catBtn} ${catFilter === "all" ? styles.catBtnActive : ""}`} onClick={() => setCatFilter("all")}>Tous</button>
          {CATEGORIES.map(c => (
            <button key={c.value} className={`${styles.catBtn} ${catFilter === c.value ? styles.catBtnActive : ""}`} onClick={() => setCatFilter(c.value)}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* Drop zone + doc list */}
      <div
        className={`${styles.content} ${dragOver ? styles.contentDragOver : ""}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {loading && <div className={styles.loading}>Chargement...</div>}

        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>Aucun document</span>
            <span className={styles.emptySub}>Glissez un fichier ici ou cliquez sur "Envoyer un document"</span>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className={styles.docGrid}>
            {filtered.map(doc => {
              const isMine = doc.senderProId === myProId;
              const otherPerson = tab === "pro"
                ? (isMine ? doc.receiverPro : doc.senderPro)
                : doc.receiverAthlete;
              const otherName = tab === "pro"
                ? `${(otherPerson as any)?.prenom || ""} ${(otherPerson as any)?.nom || ""}`
                : (otherPerson as any)?.name || "";

              return (
                <div key={doc.id} className={styles.docCard} onClick={() => setPreviewDoc(doc)}>
                  <div className={styles.docIcon}>
                    {doc.mimeType.startsWith("image/") ? (
                      <img src={doc.filePath} alt="" className={styles.docPreview} />
                    ) : (
                      <span className={styles.docEmoji}>{getFileIcon(doc.mimeType)}</span>
                    )}
                  </div>
                  <div className={styles.docInfo}>
                    <div className={styles.docName} title={doc.originalName}>{doc.originalName}</div>
                    <div className={styles.docMeta}>
                      <span className={styles.docCat}>{CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}</span>
                      <span>{formatSize(doc.size)}</span>
                      <span>{formatDate(doc.createdAt)}</span>
                    </div>
                    <div className={styles.docPeople}>
                      {isMine ? (
                        <span className={styles.docSent}>Envoyé à <strong>{otherName}</strong></span>
                      ) : (
                        <span className={styles.docReceived}>Reçu de <strong>{otherName}</strong></span>
                      )}
                    </div>
                    {doc.note && <div className={styles.docNote}>{doc.note}</div>}
                  </div>
                  <div className={styles.docActions}>
                    <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className={styles.docActionBtn} title="Télécharger">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                    {isMine && (
                      <button className={`${styles.docActionBtn} ${styles.docDeleteBtn}`} onClick={() => handleDelete(doc.id)} title="Supprimer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview lightbox */}
      {previewDoc && (
        <div className={styles.lightboxOverlay} onClick={() => setPreviewDoc(null)}>
          <div className={styles.lightbox} onClick={e => e.stopPropagation()}>
            <button className={styles.lightboxClose} onClick={() => setPreviewDoc(null)}>✕</button>
            <div className={styles.lightboxContent}>
              {previewDoc.mimeType.startsWith("image/") ? (
                <img src={previewDoc.filePath} alt={previewDoc.originalName} className={styles.lightboxImage} />
              ) : previewDoc.mimeType === "application/pdf" ? (
                <iframe src={previewDoc.filePath} className={styles.lightboxPdf} title={previewDoc.originalName} />
              ) : (
                <div className={styles.lightboxFallback}>
                  <span className={styles.lightboxEmoji}>{getFileIcon(previewDoc.mimeType)}</span>
                  <span className={styles.lightboxFilename}>{previewDoc.originalName}</span>
                  <span className={styles.lightboxSize}>{formatSize(previewDoc.size)}</span>
                </div>
              )}
            </div>
            <div className={styles.lightboxFooter}>
              <div className={styles.lightboxInfo}>
                <span className={styles.lightboxName}>{previewDoc.originalName}</span>
                <span className={styles.lightboxMeta}>{formatSize(previewDoc.size)} · {formatDate(previewDoc.createdAt)}</span>
              </div>
              <a href={previewDoc.filePath} target="_blank" rel="noopener noreferrer" className={styles.lightboxDownload}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Télécharger
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <div className={styles.modalOverlay} onClick={() => setUploadOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Envoyer un document</h2>
              <button className={styles.modalClose} onClick={() => setUploadOpen(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {/* File picker */}
              <div
                className={`${styles.fileDrop} ${uploadFile ? styles.fileDropHasFile : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setUploadFile(f); }}
              >
                {uploadFile ? (
                  <div className={styles.fileDropPreview}>
                    <span className={styles.fileDropIcon}>{getFileIcon(uploadFile.type)}</span>
                    <span className={styles.fileDropName}>{uploadFile.name}</span>
                    <span className={styles.fileDropSize}>{formatSize(uploadFile.size)}</span>
                  </div>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span>Cliquer ou glisser un fichier</span>
                    <span className={styles.fileDropHint}>PDF, Image, Word, Excel, ZIP — Max 10 Mo</span>
                  </>
                )}
                <input ref={fileRef} type="file" hidden onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }} />
              </div>

              {/* Receiver */}
              <label className={styles.fieldLabel}>
                Destinataire
                <select className={styles.fieldSelect} value={uploadReceiver} onChange={e => setUploadReceiver(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {tab === "pro" ? (
                    pros.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.specialite})</option>)
                  ) : (
                    athletes.map(a => <option key={a.id} value={a.id}>{a.name}{a.contactEmail ? ` (${a.contactEmail})` : " — pas d'email"}</option>)
                  )}
                </select>
              </label>

              {/* Category */}
              <label className={styles.fieldLabel}>
                Catégorie
                <select className={styles.fieldSelect} value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>

              {/* Note */}
              <label className={styles.fieldLabel}>
                Note (optionnel)
                <textarea className={styles.fieldTextarea} value={uploadNote} onChange={e => setUploadNote(e.target.value)} rows={2} placeholder="Ajouter un commentaire..." />
              </label>

              {uploadError && <div className={styles.uploadError}>{uploadError}</div>}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setUploadOpen(false)}>Annuler</button>
              <button className={styles.modalSubmit} onClick={handleUpload} disabled={!uploadFile || !uploadReceiver || uploading}>
                {uploading ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
