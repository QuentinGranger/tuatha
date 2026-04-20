"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

/* ═══════════════ SIGNATURE UTILS ═══════════════ */

async function hashDocument(payload: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Signature indisponible : WebCrypto (crypto.subtle) non disponible. Utilise HTTPS ou un navigateur compatible.");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function buildSignaturePayload(doc: { type: string; diagnosis: string; content: any; episode?: string; validUntil?: string }, timestamp: string): string {
  return JSON.stringify({ type: doc.type, diagnosis: doc.diagnosis, content: doc.content, episode: doc.episode, validUntil: doc.validUntil, signedAt: timestamp });
}

/* ═══════════════ PDF GENERATION ═══════════════ */

async function generateOrdonnancePDF(o: Ordonnance, typeLabel: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 20;
  const contentW = W - margin * 2;
  let y = 20;

  const addLine = (text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number]; maxW?: number }) => {
    const sz = opts?.size || 10;
    doc.setFontSize(sz);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    if (opts?.color) doc.setTextColor(...opts.color); else doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(text, opts?.maxW || contentW);
    if (y + lines.length * sz * 0.4 > 275) { doc.addPage(); y = 20; }
    doc.text(lines, margin, y);
    y += lines.length * sz * 0.45 + 1;
  };

  const addSpacer = (h = 4) => { y += h; };

  // ── Header
  doc.setDrawColor(230, 120, 30);
  doc.setLineWidth(0.8);
  doc.line(margin, y, W - margin, y);
  y += 6;
  addLine("ORDONNANCE", { bold: true, size: 18, color: [230, 120, 30] });
  addLine(typeLabel.toUpperCase(), { bold: true, size: 11, color: [100, 100, 100] });
  addSpacer(4);

  // ── Dates
  addLine(`Date : ${new Date(o.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, { size: 9, color: [80, 80, 80] });
  if (o.validUntil) addLine(`Valide jusqu'au : ${new Date(o.validUntil).toLocaleDateString("fr-FR")}`, { size: 9, color: [80, 80, 80] });
  if (o.signedAt) addLine(`Signée le : ${new Date(o.signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, { size: 9, color: [80, 80, 80] });
  addSpacer(3);

  doc.setDrawColor(200, 200, 200); doc.line(margin, y, W - margin, y); y += 5;

  // ── Diagnostic
  addLine("Diagnostic / Motif", { bold: true, size: 10, color: [60, 60, 60] });
  addLine(o.diagnosis || "—", { size: 11 });
  if (o.episode) { addSpacer(2); addLine(`Épisode de soin : ${o.episode}`, { size: 9, color: [80, 80, 80] }); }
  addSpacer(5);

  // ── Content per type
  const c = o.content || {};
  if (o.type === "kine") {
    if (c.seances) addLine(`Séances : ${c.seances} — Fréquence : ${c.frequence || ""}`, { size: 10 });
    if (c.objectifs) { addLine("Objectifs :", { bold: true, size: 10 }); addLine(c.objectifs, { size: 10 }); }
    if (c.consignes) { addLine("Consignes :", { bold: true, size: 10 }); addLine(c.consignes, { size: 10 }); }
    if (c.techniques) { addLine("Techniques :", { bold: true, size: 10 }); addLine(c.techniques, { size: 10 }); }
    if (c.bilanCR) addLine("Bilan initial + compte rendu demandé", { size: 9, color: [100, 100, 100] });
  } else if (o.type === "imagerie") {
    addLine(`Examen : ${c.examType || ""} — Zone : ${c.zone || ""}`, { size: 10 });
    if (c.indication) addLine(`Indication : ${c.indication}`, { size: 10 });
    addLine(`Urgence : ${c.urgence || "non"} — Injection : ${c.injection || "non"}`, { size: 10 });
    if (c.contreIndications) addLine(`Contre-indications : ${c.contreIndications}`, { size: 10 });
  } else if (o.type === "biologie") {
    addLine(`Examens demandés : ${(c.examens || []).join(", ")}${c.autreExamens ? `, ${c.autreExamens}` : ""}`, { size: 10 });
    if (c.indication) addLine(`Indication : ${c.indication}`, { size: 10 });
    if (c.aJeun) addLine("Patient à jeun", { size: 9, color: [180, 50, 50] });
    if (c.urgent) addLine("URGENT", { bold: true, size: 10, color: [180, 50, 50] });
  } else if (o.type === "medicament") {
    (c.lignes || []).forEach((l: any, i: number) => {
      addSpacer(2);
      addLine(`${i + 1}. ${l.dci || ""} ${l.dosage || ""} — ${l.forme || ""}`, { bold: true, size: 10 });
      addLine(`   Posologie : ${l.posologie || ""} — Durée : ${l.duree || ""} — Qté : ${l.qte || ""}${l.renouvelable ? " (renouvelable)" : ""}`, { size: 9 });
    });
  } else if (o.type === "arret") {
    addLine(`Période : du ${c.dateDebut || "?"} au ${c.dateFin || "?"}`, { size: 10 });
    if (c.tempsPartiel) addLine("Temps partiel thérapeutique", { size: 10 });
    if (c.prolongation) addLine("Prolongation d'un arrêt précédent", { size: 10 });
    if (c.motif) addLine(`Motif : ${c.motif}`, { size: 10 });
  } else if (o.type === "certificat") {
    addLine(`Type : ${c.certType || ""} — Sport : ${c.sport || ""}`, { size: 10 });
    if (c.restrictions) addLine(`Restrictions : ${c.restrictions}`, { size: 10 });
    if (c.duree) addLine(`Durée de validité : ${c.duree}`, { size: 10 });
  } else if (o.type === "orientation") {
    addLine(`Spécialité : ${c.specialite || ""} — Urgence : ${c.urgence || "non"}`, { size: 10 });
    if (c.motif) addLine(`Motif : ${c.motif}`, { size: 10 });
  } else if (o.type === "dispositif") {
    addLine(`Dispositif : ${c.dispType || ""} — Côté : ${c.cote || ""}`, { size: 10 });
    if (c.specs) addLine(`Spécifications : ${c.specs}`, { size: 10 });
    if (c.duree) addLine(`Durée : ${c.duree}`, { size: 10 });
  }

  addSpacer(8);
  doc.setDrawColor(200, 200, 200); doc.line(margin, y, W - margin, y); y += 6;

  // ── Signature
  const sigData = (() => { try { return o.signatureData ? JSON.parse(o.signatureData) : null; } catch { return null; } })();
  if (sigData?.image) {
    addLine("Signature électronique", { bold: true, size: 9, color: [60, 60, 60] });
    addSpacer(2);
    try { doc.addImage(sigData.image, "PNG", W - margin - 60, y, 60, 20); } catch { /* skip if image invalid */ }
    y += 22;
    addSpacer(2);
  }

  if (sigData) {
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(130, 130, 130);
    doc.text(`ID: ${sigData.shortId} | SHA-256: ${sigData.hash}`, margin, y); y += 3;
    doc.text(`Horodatage: ${sigData.timestamp}`, margin, y); y += 3;
    doc.text("Document signé électroniquement (signature simple) · Intégrité vérifiable par empreinte SHA-256", margin, y);
    y += 5;
  }

  if (o.status === "annulee") {
    doc.setFontSize(50); doc.setTextColor(239, 68, 68); doc.setFont("helvetica", "bold");
    doc.text("ANNULÉE", W / 2, 150, { align: "center", angle: 30 });
  }

  // ── Footer
  doc.setDrawColor(230, 120, 30); doc.setLineWidth(0.3);
  doc.line(margin, 282, W - margin, 282);
  doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "normal");
  doc.text("Ordonnance générée par TuathaPro — Ce document ne se substitue pas à une consultation médicale.", margin, 286);

  const filename = `ordonnance_${typeLabel.replace(/\s+/g, "_").toLowerCase()}_${new Date(o.createdAt).toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/* ═══════════════ TYPES ═══════════════ */

type OrdoType = "kine" | "imagerie" | "biologie" | "medicament" | "arret" | "certificat" | "orientation" | "dispositif";
type OrdoStatus = "brouillon" | "signee" | "transmise" | "expiree" | "annulee";
type PrescType = "activite" | "douleur" | "suivi" | "education" | "sport" | "symptomes";
type Tab = "ordonnances" | "prescriptions" | "protocoles";

interface Athlete { id: string; name: string; sport?: string; objectif?: string; poids?: number; taille?: number; riskLevel?: string; dateNaissance?: string; }

interface Ordonnance {
  id: string; type: OrdoType; status: OrdoStatus;
  createdAt: string; signedAt?: string; validUntil?: string;
  diagnosis: string; content: Record<string, any>;
  episode?: string; version: number; patientId: string;
  signatureData?: string;
}

interface Prescription {
  id: string; type: PrescType; title: string;
  content: string[]; dateStart: string; dateEnd?: string;
  redFlags: string[]; visiblePatient: boolean;
  linkedProtocol?: string; status: "active" | "completed" | "cancelled";
  patientId: string;
}

interface Phase {
  id: string; name: string; objectives: string[];
  toDo: string[]; toAvoid: string[];
  progressionCriteria: string[]; alertCriteria: string[];
  recommendedOrders: string[]; recommendedExams: string[];
}

interface Protocol {
  id: string; name: string; description: string;
  objectives: string[]; phases: Phase[];
  linkedTemplates: string[]; status: "active" | "draft" | "completed";
  patientId: string;
}

/* ═══════════════ CONSTANTS ═══════════════ */

const ORDO_TYPES: { value: OrdoType; label: string; icon: string }[] = [
  { value: "kine", label: "Rééducation / Kiné", icon: "M18 4a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v4h12V4z M4 8h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" },
  { value: "imagerie", label: "Imagerie", icon: "M2 7l4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7 M4 7h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z M12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
  { value: "biologie", label: "Examens biologiques", icon: "M9 3h6v2H9V3z M12 11v6 M9 14h6 M5 7h14v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z" },
  { value: "medicament", label: "Médicaments", icon: "M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5A2.25 2.25 0 0 0 8.25 22.5h7.5A2.25 2.25 0 0 0 18 20.25V3.75A2.25 2.25 0 0 0 15.75 1.5H13.5 M10.5 1.5V3h3V1.5 M12 11v4 M10 13h4" },
  { value: "arret", label: "Arrêt de travail", icon: "M4 4h16v16H4V4z M4 9h16 M9 4v16" },
  { value: "certificat", label: "Certificat médical", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M9 15l2 2 4-4" },
  { value: "orientation", label: "Orientation spécialiste", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
  { value: "dispositif", label: "Dispositif médical", icon: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" },
];

const ORDO_STATUS_LABELS: Record<OrdoStatus, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "#94a3b8" },
  signee: { label: "Signée", color: "#22c55e" },
  transmise: { label: "Transmise", color: "#3b82f6" },
  expiree: { label: "Expirée", color: "#f59e0b" },
  annulee: { label: "Annulée", color: "#ef4444" },
};

const PRESC_TYPES: { value: PrescType; label: string }[] = [
  { value: "activite", label: "Consignes d'activité" },
  { value: "douleur", label: "Protocole douleur" },
  { value: "suivi", label: "Suivi / Contrôle" },
  { value: "education", label: "Éducation thérapeutique" },
  { value: "sport", label: "Prescription sportive" },
  { value: "symptomes", label: "Suivi symptômes" },
];

const SPECIALITES = ["ORL", "Cardiologie", "Orthopédie", "Neurologie", "Rhumatologie", "Pneumologie", "Dermatologie", "Ophtalmologie", "Médecine interne", "Autre"];

const BIO_EXAMS = [
  "NFS", "CRP", "VS", "Ionogramme", "Glycémie", "HbA1c", "Créatinine", "Bilan hépatique",
  "TSH", "Ferritine", "Vitamine D", "Bilan lipidique", "CPK", "Acide urique", "Calcémie",
];

const uuid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);

/* ═══════════════ PAGE ═══════════════ */

export default function ProtocolesPage() {
  const router = useRouter();

  /* ── Patient ── */
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [showAthleteList, setShowAthleteList] = useState(false);
  const [episode, setEpisode] = useState("");

  /* ── Tab ── */
  const [tab, setTab] = useState<Tab>("ordonnances");

  /* ── Data ── */
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);

  /* ── Modals ── */
  const [showNewOrdo, setShowNewOrdo] = useState(false);
  const [showNewPresc, setShowNewPresc] = useState(false);
  const [showNewProtocol, setShowNewProtocol] = useState(false);
  const [editProtocol, setEditProtocol] = useState<Protocol | null>(null);
  const [previewOrdo, setPreviewOrdo] = useState<Ordonnance | null>(null);

  const selectedAthlete = athletes.find(a => a.id === athleteId);

  /* ── Fetch athletes ── */
  useEffect(() => {
    fetch("/api/athletes").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAthletes(d); })
      .catch(() => {});
  }, []);

  /* ── Fetch data when athlete changes ── */
  const fetchOrdonnances = useCallback(() => {
    if (!athleteId) { setOrdonnances([]); return; }
    fetch(`/api/medecin/ordonnances?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setOrdonnances(d); })
      .catch(() => setOrdonnances([]));
  }, [athleteId]);

  const fetchPrescriptions = useCallback(() => {
    if (!athleteId) { setPrescriptions([]); return; }
    fetch(`/api/medecin/prescriptions?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPrescriptions(d); })
      .catch(() => setPrescriptions([]));
  }, [athleteId]);

  const fetchProtocols = useCallback(() => {
    if (!athleteId) { setProtocols([]); return; }
    fetch(`/api/medecin/protocols?athleteId=${athleteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProtocols(d); })
      .catch(() => setProtocols([]));
  }, [athleteId]);

  useEffect(() => { fetchOrdonnances(); fetchPrescriptions(); fetchProtocols(); }, [fetchOrdonnances, fetchPrescriptions, fetchProtocols]);

  const getAge = (dob?: string) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / 31557600000);
  };

  /* ── Ordonnance CRUD (API) ── */
  const addOrdonnance = async (o: Omit<Ordonnance, "id" | "createdAt" | "version" | "patientId">) => {
    const res = await fetch("/api/medecin/ordonnances", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId, ...o }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
      throw new Error(err.error || `Erreur ${res.status}`);
    }
    fetchOrdonnances();
    setShowNewOrdo(false);
  };

  const signOrdonnance = async (id: string) => {
    try {
      await fetch(`/api/medecin/ordonnances/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "signee", signedAt: new Date().toISOString() }),
      });
      fetchOrdonnances();
    } catch { console.error("Erreur signature"); }
  };

  const cancelOrdonnance = async (id: string) => {
    try {
      await fetch(`/api/medecin/ordonnances/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "annulee" }),
      });
      fetchOrdonnances();
    } catch { console.error("Erreur annulation"); }
  };

  const duplicateOrdonnance = async (o: Ordonnance) => {
    try {
      await fetch("/api/medecin/ordonnances", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, type: o.type, status: "brouillon", diagnosis: o.diagnosis, content: o.content, episode: o.episode, validUntil: o.validUntil }),
      });
      fetchOrdonnances();
    } catch { console.error("Erreur duplication"); }
  };

  /* ── Prescription CRUD (API) ── */
  const addPrescription = async (p: Omit<Prescription, "id" | "patientId">) => {
    try {
      const res = await fetch("/api/medecin/prescriptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...p }),
      });
      if (res.ok) { fetchPrescriptions(); setShowNewPresc(false); }
    } catch { console.error("Erreur création prescription"); }
  };

  /* ── Protocol CRUD (API) ── */
  const addProtocol = async (p: Omit<Protocol, "id" | "patientId">): Promise<Protocol | null> => {
    try {
      const res = await fetch("/api/medecin/protocols", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...p }),
      });
      if (res.ok) {
        const newP = await res.json();
        fetchProtocols();
        setShowNewProtocol(false);
        return newP;
      }
    } catch { console.error("Erreur création protocole"); }
    return null;
  };

  const updateProtocol = async (p: Protocol) => {
    try {
      await fetch(`/api/medecin/protocols/${p.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name, description: p.description, objectives: p.objectives, phases: p.phases, linkedTemplates: p.linkedTemplates, status: p.status }),
      });
      fetchProtocols();
      setEditProtocol(null);
    } catch { console.error("Erreur mise à jour protocole"); }
  };

  /* ── Data for current patient (already filtered by API) ── */
  const patientOrdos = ordonnances;
  const patientPrescs = prescriptions;
  const patientProtos = protocols;

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className={styles.page}>
      {/* ──── HEADER ──── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Protocoles & Prescriptions</h1>
          <div className={styles.athletePicker}>
            <input className={styles.athleteSearch} placeholder="Rechercher un patient..."
              value={athleteSearch}
              onChange={e => { setAthleteSearch(e.target.value); setShowAthleteList(true); }}
              onFocus={() => setShowAthleteList(true)} />
            {showAthleteList && (
              <div className={styles.athleteDropdown}>
                {athletes.filter(a => a.name.toLowerCase().includes(athleteSearch.toLowerCase())).length === 0 ? (
                  <div className={styles.athleteEmpty}>Aucun patient trouvé</div>
                ) : athletes.filter(a => a.name.toLowerCase().includes(athleteSearch.toLowerCase())).map(a => (
                  <div key={a.id} className={`${styles.athleteCard} ${athleteId === a.id ? styles.athleteCardActive : ""}`}
                    onClick={() => { setAthleteId(a.id); setAthleteSearch(a.name); setShowAthleteList(false); }}>
                    <div className={styles.athleteAvatar}>{a.name.charAt(0).toUpperCase()}</div>
                    <div className={styles.athleteInfo}>
                      <div className={styles.athleteName}>{a.name}</div>
                      <div className={styles.athleteMeta}>
                        {a.sport && <span>{a.sport}</span>}
                        {a.poids && <span>{a.poids} kg</span>}
                      </div>
                    </div>
                    <span className={styles.athleteRisk} style={{ background: a.riskLevel === "GOOD" ? "#22c55e" : a.riskLevel === "MODERATE" ? "#f59e0b" : "#ef4444" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ──── PATIENT CONTEXT BANNER ──── */}
      {selectedAthlete && (
        <div className={styles.contextBanner}>
          <div className={styles.ctxLeft}>
            <div className={styles.ctxAvatar}>{selectedAthlete.name.charAt(0).toUpperCase()}</div>
            <div className={styles.ctxInfo}>
              <div className={styles.ctxName}>{selectedAthlete.name}</div>
              <div className={styles.ctxDetails}>
                {getAge(selectedAthlete.dateNaissance) && <span>{getAge(selectedAthlete.dateNaissance)} ans</span>}
                {selectedAthlete.sport && <span>{selectedAthlete.sport}</span>}
                {selectedAthlete.objectif && <span>{selectedAthlete.objectif}</span>}
                {selectedAthlete.poids && <span>{selectedAthlete.poids} kg</span>}
              </div>
            </div>
            <div className={styles.ctxEpisode}>
              <input className={styles.episodeInput} placeholder="Épisode de soin (ex: Genou droit – post-entorse)"
                value={episode} onChange={e => setEpisode(e.target.value)} />
            </div>
          </div>
          <div className={styles.ctxActions}>
            <button className={styles.btnPrimary} onClick={() => setShowNewOrdo(true)}>+ Ordonnance</button>
            <button className={styles.btnOutline} onClick={() => setShowNewPresc(true)}>+ Prescription</button>
            <button className={styles.btnOutline} onClick={() => setShowNewProtocol(true)}>+ Protocole</button>
            <button className={styles.btnGhost} onClick={() => router.push("/dashboard/medecin/indicateurs")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Suivi médical
            </button>
            <button className={styles.btnGhost} onClick={() => window.print()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Exporter PDF
            </button>
          </div>
        </div>
      )}

      {/* ──── PATIENT GRID (no selection) ──── */}
      {!athleteId && (
        <div className={styles.patientGrid}>
          {athletes.length === 0 ? (
            <div className={styles.emptyState}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <p>Aucun patient pour le moment</p>
            </div>
          ) : athletes.map(a => (
            <div key={a.id} className={styles.patientCardGrid} onClick={() => { setAthleteId(a.id); setAthleteSearch(a.name); }}>
              <div className={styles.patientCardAvatar}>{a.name.charAt(0).toUpperCase()}</div>
              <div className={styles.patientCardBody}>
                <div className={styles.patientCardName}>{a.name}</div>
                <div className={styles.patientCardDetails}>
                  {a.sport && <span>{a.sport}</span>}
                  {a.poids && <span>{a.poids} kg</span>}
                  {a.taille && <span>{a.taille} cm</span>}
                </div>
                {a.objectif && <div className={styles.patientCardObj}>{a.objectif}</div>}
              </div>
              <span className={styles.patientCardRisk} style={{ background: a.riskLevel === "GOOD" ? "#22c55e" : a.riskLevel === "MODERATE" ? "#f59e0b" : "#ef4444" }} />
            </div>
          ))}
        </div>
      )}

      {/* ──── TABS ──── */}
      {athleteId && (
        <>
          <div className={styles.tabs}>
            {([
              { id: "ordonnances" as Tab, label: "Ordonnances", count: patientOrdos.length },
              { id: "prescriptions" as Tab, label: "Prescriptions", count: patientPrescs.length },
              { id: "protocoles" as Tab, label: "Protocoles", count: patientProtos.length },
            ]).map(t => (
              <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.count > 0 && <span className={styles.tabCount}>{t.count}</span>}
              </button>
            ))}
          </div>

          {/* ──── ORDONNANCES TAB ──── */}
          {tab === "ordonnances" && (
            <div className={styles.section}>
              {patientOrdos.length === 0 ? (
                <div className={styles.emptyMini}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <p>Aucune ordonnance pour ce patient</p>
                  <button className={styles.btnPrimary} onClick={() => setShowNewOrdo(true)}>+ Nouvelle ordonnance</button>
                </div>
              ) : (
                <div className={styles.ordoGrid}>
                  {patientOrdos.map(o => (
                    <div key={o.id} className={styles.ordoCard}>
                      <div className={styles.ordoCardHeader}>
                        <span className={styles.ordoType}>{ORDO_TYPES.find(t => t.value === o.type)?.label}</span>
                        <span className={styles.ordoStatus} style={{ color: ORDO_STATUS_LABELS[o.status].color, borderColor: ORDO_STATUS_LABELS[o.status].color }}>
                          {ORDO_STATUS_LABELS[o.status].label}
                        </span>
                      </div>
                      <div className={styles.ordoDiag}>{o.diagnosis || "—"}</div>
                      {o.episode && <div className={styles.ordoEpisode}>{o.episode}</div>}
                      <div className={styles.ordoMeta}>
                        <span>{new Date(o.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {o.validUntil && <span>Valide jusqu'au {new Date(o.validUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
                        <span>v{o.version}</span>
                      </div>
                      <div className={styles.ordoActions}>
                        <button className={styles.btnSmall} onClick={() => setPreviewOrdo(o)}>Ouvrir</button>
                        <button className={styles.btnSmall} onClick={() => duplicateOrdonnance(o)}>Dupliquer</button>
                        {o.status === "brouillon" && <button className={styles.btnSmallPrimary} onClick={() => signOrdonnance(o.id)}>Signer</button>}
                        {o.status !== "annulee" && <button className={styles.btnSmallDanger} onClick={() => cancelOrdonnance(o.id)}>Annuler</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──── PRESCRIPTIONS TAB ──── */}
          {tab === "prescriptions" && (
            <div className={styles.section}>
              {patientPrescs.length === 0 ? (
                <div className={styles.emptyMini}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <p>Aucune prescription pour ce patient</p>
                  <button className={styles.btnPrimary} onClick={() => setShowNewPresc(true)}>+ Nouvelle prescription</button>
                </div>
              ) : (
                <div className={styles.prescGrid}>
                  {patientPrescs.map(p => (
                    <div key={p.id} className={styles.prescCard}>
                      <div className={styles.prescCardHeader}>
                        <span className={styles.prescType}>{PRESC_TYPES.find(t => t.value === p.type)?.label}</span>
                        <span className={`${styles.prescStatus} ${styles[`prescStatus_${p.status}`]}`}>{p.status === "active" ? "Active" : p.status === "completed" ? "Terminée" : "Annulée"}</span>
                      </div>
                      <div className={styles.prescTitle}>{p.title}</div>
                      <ul className={styles.prescContent}>
                        {p.content.slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}
                        {p.content.length > 3 && <li className={styles.prescMore}>+{p.content.length - 3} consignes</li>}
                      </ul>
                      <div className={styles.prescMeta}>
                        <span>{new Date(p.dateStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                        {p.dateEnd && <span>→ {new Date(p.dateEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
                        {p.visiblePatient && <span className={styles.prescVisible}>Visible patient</span>}
                      </div>
                      {p.redFlags.length > 0 && (
                        <div className={styles.prescRedFlags}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          {p.redFlags.join(" · ")}
                        </div>
                      )}
                      <div className={styles.prescActions}>
                        <button className={styles.btnSmall} onClick={() => setShowNewOrdo(true)}>Convertir en ordonnance</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──── PROTOCOLES TAB ──── */}
          {tab === "protocoles" && (
            <div className={styles.section}>
              {patientProtos.length === 0 ? (
                <div className={styles.emptyMini}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
                  <p>Aucun protocole pour ce patient</p>
                  <button className={styles.btnPrimary} onClick={() => setShowNewProtocol(true)}>+ Nouveau protocole</button>
                </div>
              ) : (
                <div className={styles.protoGrid}>
                  {patientProtos.map(p => (
                    <div key={p.id} className={styles.protoCard}>
                      <div className={styles.protoCardHeader}>
                        <span className={styles.protoName}>{p.name}</span>
                        <span className={`${styles.protoStatus} ${styles[`protoStatus_${p.status}`]}`}>{p.status === "active" ? "Actif" : p.status === "draft" ? "Brouillon" : "Terminé"}</span>
                      </div>
                      <p className={styles.protoDesc}>{p.description}</p>
                      <div className={styles.protoPhases}>
                        {p.phases.map((ph, i) => (
                          <div key={ph.id} className={styles.phaseChip}>
                            <span className={styles.phaseNum}>{i + 1}</span>
                            {ph.name}
                          </div>
                        ))}
                      </div>
                      {p.objectives.length > 0 && (
                        <div className={styles.protoObj}>
                          {p.objectives.slice(0, 2).map((o, i) => <span key={i}>{o}</span>)}
                        </div>
                      )}
                      <div className={styles.protoActions}>
                        <button className={styles.btnSmall} onClick={() => setEditProtocol(p)}>Modifier</button>
                        <button className={styles.btnSmall} onClick={() => {
                          const dup = { ...p, id: uuid(), name: `${p.name} (copie)`, status: "draft" as const };
                          setProtocols(prev => [dup, ...prev]);
                        }}>Dupliquer</button>
                        <button className={styles.btnSmall} onClick={() => {}}>Partager</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════════ MODALS ═══════════════ */}

      {showNewOrdo && <NewOrdonnanceWizard episode={episode} onClose={() => setShowNewOrdo(false)} onCreate={addOrdonnance} />}
      {showNewPresc && <NewPrescriptionModal onClose={() => setShowNewPresc(false)} onCreate={addPrescription} />}
      {showNewProtocol && <NewProtocolModal onClose={() => setShowNewProtocol(false)} onCreate={async (p) => { const np = await addProtocol(p); if (np) setEditProtocol(np); }} />}
      {editProtocol && <ProtocolEditor protocol={editProtocol} onClose={() => setEditProtocol(null)} onSave={updateProtocol} />}
      {previewOrdo && <OrdonnancePreview ordonnance={previewOrdo} onClose={() => setPreviewOrdo(null)} onSign={() => { signOrdonnance(previewOrdo.id); setPreviewOrdo(null); }} />}
    </div>
  );
}

/* ═══════════════ NEW ORDONNANCE WIZARD ═══════════════ */

function NewOrdonnanceWizard({ episode, onClose, onCreate }: { episode: string; onClose: () => void; onCreate: (o: any) => Promise<void> }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<OrdoType | "">("");
  const [diagnosis, setDiagnosis] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [content, setContent] = useState<Record<string, any>>({});

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Signature state ── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureHash, setSignatureHash] = useState<string | null>(null);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineTo(x, y); ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current; if (!canvas) return;
    setSignatureImage(canvas.toDataURL("image/png"));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureImage(null); setSignatureHash(null);
  };

  const handleCreate = async (asDraft: boolean) => {
    if (isSubmitting) return;
    setSubmitError(null);

    if (!type) {
      setSubmitError("Choisis un type d'ordonnance.");
      setStep(1);
      return;
    }

    if (!diagnosis.trim()) {
      setSubmitError("Le diagnostic / motif est requis.");
      setStep(2);
      return;
    }

    if (!asDraft && !signatureImage) {
      setSubmitError("La signature est requise pour signer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      let sigData: string | undefined;

      if (!asDraft && signatureImage) {
        const payload = buildSignaturePayload({ type: type as string, diagnosis, content, episode, validUntil }, timestamp);
        const hash = await hashDocument(payload);
        setSignatureHash(hash);
        sigData = JSON.stringify({ image: signatureImage, hash, timestamp, shortId: hash.slice(0, 12).toUpperCase() });
      }

      await onCreate({
        type,
        status: asDraft ? "brouillon" : "signee",
        signedAt: asDraft ? undefined : timestamp,
        validUntil: validUntil || undefined,
        diagnosis,
        content,
        episode: episode || undefined,
        signatureData: sigData,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création";
      setSubmitError(msg);
      console.error("Ordonnance signature/create error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.wizardModal} onClick={e => e.stopPropagation()}>
        <div className={styles.wizardHeader}>
          <h2>Nouvelle ordonnance</h2>
          <div className={styles.wizardSteps}>
            {["Type", "Contenu", "Aperçu & Signature"].map((s, i) => (
              <span key={i} className={`${styles.wizStep} ${step === i + 1 ? styles.wizStepActive : ""} ${step > i + 1 ? styles.wizStepDone : ""}`}>
                <span className={styles.wizStepNum}>{step > i + 1 ? "✓" : i + 1}</span>
                {s}
              </span>
            ))}
          </div>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.wizardBody}>
          {/* ── STEP 1: Type ── */}
          {step === 1 && (
            <div className={styles.typeGrid}>
              {ORDO_TYPES.map(t => (
                <button key={t.value} className={`${styles.typeCard} ${type === t.value ? styles.typeCardActive : ""}`}
                  onClick={() => { setType(t.value); setContent({}); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28"><path d={t.icon} /></svg>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── STEP 2: Content ── */}
          {step === 2 && (
            <div className={styles.wizContent}>
              <div className={styles.field}>
                <label>Diagnostic / Motif *</label>
                <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Ex: douleur antérieure genou droit" />
              </div>
              <div className={styles.field}>
                <label>Validité</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>

              {/* ── KINE ── */}
              {type === "kine" && (
                <>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label>Nombre de séances</label>
                      <input type="number" value={content.seances || ""} onChange={e => setContent(p => ({ ...p, seances: +e.target.value }))} placeholder="10" />
                    </div>
                    <div className={styles.field}>
                      <label>Fréquence</label>
                      <input value={content.frequence || ""} onChange={e => setContent(p => ({ ...p, frequence: e.target.value }))} placeholder="2-3/semaine" />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Objectifs</label>
                    <input value={content.objectifs || ""} onChange={e => setContent(p => ({ ...p, objectifs: e.target.value }))} placeholder="Antalgie, mobilité, renforcement, proprioception..." />
                  </div>
                  <div className={styles.field}>
                    <label>Consignes / Restrictions</label>
                    <textarea value={content.consignes || ""} onChange={e => setContent(p => ({ ...p, consignes: e.target.value }))} placeholder="Pas d'impact, limiter ROM, douleur max tolérée..." rows={3} />
                  </div>
                  <div className={styles.field}>
                    <label>Techniques suggérées</label>
                    <input value={content.techniques || ""} onChange={e => setContent(p => ({ ...p, techniques: e.target.value }))} placeholder="Renforcement excentrique, thérapie manuelle..." />
                  </div>
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={content.bilanCR || false} onChange={e => setContent(p => ({ ...p, bilanCR: e.target.checked }))} />
                    <span>Bilan initial + compte rendu demandé</span>
                  </label>
                </>
              )}

              {/* ── IMAGERIE ── */}
              {type === "imagerie" && (
                <>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label>Type d'examen</label>
                      <select value={content.examType || ""} onChange={e => setContent(p => ({ ...p, examType: e.target.value }))}>
                        <option value="">— Choisir —</option>
                        <option value="radio">Radiographie</option>
                        <option value="echo">Échographie</option>
                        <option value="irm">IRM</option>
                        <option value="scanner">Scanner</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Zone anatomique</label>
                      <input value={content.zone || ""} onChange={e => setContent(p => ({ ...p, zone: e.target.value }))} placeholder="Genou droit, épaule gauche..." />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Indication clinique</label>
                    <textarea value={content.indication || ""} onChange={e => setContent(p => ({ ...p, indication: e.target.value }))} placeholder="Suspicion de rupture LCA, douleur persistante..." rows={2} />
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label>Urgence</label>
                      <select value={content.urgence || "standard"} onChange={e => setContent(p => ({ ...p, urgence: e.target.value }))}>
                        <option value="standard">Standard</option>
                        <option value="prioritaire">Prioritaire</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Injection / Contraste</label>
                      <select value={content.injection || "non"} onChange={e => setContent(p => ({ ...p, injection: e.target.value }))}>
                        <option value="non">Non</option>
                        <option value="oui">Oui</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Contre-indications</label>
                    <input value={content.contreIndications || ""} onChange={e => setContent(p => ({ ...p, contreIndications: e.target.value }))} placeholder="Grossesse, allergie iode..." />
                  </div>
                </>
              )}

              {/* ── BIOLOGIE ── */}
              {type === "biologie" && (
                <>
                  <div className={styles.field}>
                    <label>Examens demandés</label>
                    <div className={styles.checkGrid}>
                      {BIO_EXAMS.map(ex => (
                        <label key={ex} className={styles.checkItem}>
                          <input type="checkbox" checked={(content.examens || []).includes(ex)}
                            onChange={e => {
                              const arr = content.examens || [];
                              setContent(p => ({ ...p, examens: e.target.checked ? [...arr, ex] : arr.filter((x: string) => x !== ex) }));
                            }} />
                          <span>{ex}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Autres examens</label>
                    <input value={content.autreExamens || ""} onChange={e => setContent(p => ({ ...p, autreExamens: e.target.value }))} placeholder="Examens supplémentaires..." />
                  </div>
                  <div className={styles.field}>
                    <label>Indication clinique</label>
                    <input value={content.indication || ""} onChange={e => setContent(p => ({ ...p, indication: e.target.value }))} placeholder="Fatigue, inflammation, suivi..." />
                  </div>
                  <div className={styles.fieldRow}>
                    <label className={styles.checkbox}>
                      <input type="checkbox" checked={content.aJeun || false} onChange={e => setContent(p => ({ ...p, aJeun: e.target.checked }))} />
                      <span>À jeun</span>
                    </label>
                    <div className={styles.field}>
                      <label>Urgence</label>
                      <select value={content.urgence || "standard"} onChange={e => setContent(p => ({ ...p, urgence: e.target.value }))}>
                        <option value="standard">Standard</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* ── MEDICAMENT ── */}
              {type === "medicament" && (
                <>
                  <div className={styles.field}>
                    <label>Lignes de prescription</label>
                  </div>
                  {(content.lignes || [{ dci: "", dosage: "", forme: "cp", posologie: "", duree: "", qte: "", renouvelable: false }]).map((l: any, i: number) => (
                    <div key={i} className={styles.medLine}>
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label>DCI / Nom</label>
                          <input value={l.dci} onChange={e => { const arr = [...(content.lignes || [l])]; arr[i] = { ...arr[i], dci: e.target.value }; setContent(p => ({ ...p, lignes: arr })); }} />
                        </div>
                        <div className={styles.field}>
                          <label>Dosage</label>
                          <input value={l.dosage} onChange={e => { const arr = [...(content.lignes || [l])]; arr[i] = { ...arr[i], dosage: e.target.value }; setContent(p => ({ ...p, lignes: arr })); }} placeholder="500mg" />
                        </div>
                      </div>
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label>Forme</label>
                          <select value={l.forme} onChange={e => { const arr = [...(content.lignes || [l])]; arr[i] = { ...arr[i], forme: e.target.value }; setContent(p => ({ ...p, lignes: arr })); }}>
                            <option value="cp">Comprimé</option>
                            <option value="gelule">Gélule</option>
                            <option value="spray">Spray</option>
                            <option value="injectable">Injectable</option>
                            <option value="creme">Crème</option>
                            <option value="solution">Solution</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label>Posologie</label>
                          <input value={l.posologie} onChange={e => { const arr = [...(content.lignes || [l])]; arr[i] = { ...arr[i], posologie: e.target.value }; setContent(p => ({ ...p, lignes: arr })); }} placeholder="1 cp matin et soir" />
                        </div>
                      </div>
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label>Durée</label>
                          <input value={l.duree} onChange={e => { const arr = [...(content.lignes || [l])]; arr[i] = { ...arr[i], duree: e.target.value }; setContent(p => ({ ...p, lignes: arr })); }} placeholder="5 jours" />
                        </div>
                        <div className={styles.field}>
                          <label>Quantité / Boîtes</label>
                          <input value={l.qte} onChange={e => { const arr = [...(content.lignes || [l])]; arr[i] = { ...arr[i], qte: e.target.value }; setContent(p => ({ ...p, lignes: arr })); }} placeholder="1 boîte" />
                        </div>
                        <label className={styles.checkbox}>
                          <input type="checkbox" checked={l.renouvelable} onChange={e => { const arr = [...(content.lignes || [l])]; arr[i] = { ...arr[i], renouvelable: e.target.checked }; setContent(p => ({ ...p, lignes: arr })); }} />
                          <span>Renouvelable</span>
                        </label>
                      </div>
                      {(content.lignes || []).length > 1 && (
                        <button className={styles.btnSmallDanger} onClick={() => { const arr = [...content.lignes]; arr.splice(i, 1); setContent(p => ({ ...p, lignes: arr })); }}>Supprimer</button>
                      )}
                    </div>
                  ))}
                  <button className={styles.btnOutline} onClick={() => setContent(p => ({ ...p, lignes: [...(p.lignes || [{ dci: "", dosage: "", forme: "cp", posologie: "", duree: "", qte: "", renouvelable: false }]), { dci: "", dosage: "", forme: "cp", posologie: "", duree: "", qte: "", renouvelable: false }] }))}>
                    + Ajouter un médicament
                  </button>
                </>
              )}

              {/* ── ARRET ── */}
              {type === "arret" && (
                <>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label>Date début</label>
                      <input type="date" value={content.dateDebut || ""} onChange={e => setContent(p => ({ ...p, dateDebut: e.target.value }))} />
                    </div>
                    <div className={styles.field}>
                      <label>Date fin</label>
                      <input type="date" value={content.dateFin || ""} onChange={e => setContent(p => ({ ...p, dateFin: e.target.value }))} />
                    </div>
                  </div>
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={content.tempsPartiel || false} onChange={e => setContent(p => ({ ...p, tempsPartiel: e.target.checked }))} />
                    <span>Temps partiel thérapeutique</span>
                  </label>
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={content.prolongation || false} onChange={e => setContent(p => ({ ...p, prolongation: e.target.checked }))} />
                    <span>Prolongation d'un arrêt précédent</span>
                  </label>
                  <div className={styles.field}>
                    <label>Motif</label>
                    <textarea value={content.motif || ""} onChange={e => setContent(p => ({ ...p, motif: e.target.value }))} rows={2} />
                  </div>
                </>
              )}

              {/* ── CERTIFICAT ── */}
              {type === "certificat" && (
                <>
                  <div className={styles.field}>
                    <label>Type de certificat</label>
                    <select value={content.certType || ""} onChange={e => setContent(p => ({ ...p, certType: e.target.value }))}>
                      <option value="">— Choisir —</option>
                      <option value="aptitude">Aptitude sportive</option>
                      <option value="reprise">Reprise d'activité</option>
                      <option value="inaptitude">Inaptitude temporaire</option>
                      <option value="contre_indication">Contre-indication</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Sport concerné</label>
                    <input value={content.sport || ""} onChange={e => setContent(p => ({ ...p, sport: e.target.value }))} placeholder="Football, Course, Crossfit..." />
                  </div>
                  <div className={styles.field}>
                    <label>Restrictions / Conditions</label>
                    <textarea value={content.restrictions || ""} onChange={e => setContent(p => ({ ...p, restrictions: e.target.value }))} placeholder="Éviter les impacts directs pendant 3 semaines..." rows={2} />
                  </div>
                  <div className={styles.field}>
                    <label>Durée</label>
                    <input value={content.duree || ""} onChange={e => setContent(p => ({ ...p, duree: e.target.value }))} placeholder="6 mois, jusqu'au prochain contrôle..." />
                  </div>
                </>
              )}

              {/* ── ORIENTATION ── */}
              {type === "orientation" && (
                <>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label>Spécialité</label>
                      <select value={content.specialite || ""} onChange={e => setContent(p => ({ ...p, specialite: e.target.value }))}>
                        <option value="">— Choisir —</option>
                        {SPECIALITES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Urgence</label>
                      <select value={content.urgence || "standard"} onChange={e => setContent(p => ({ ...p, urgence: e.target.value }))}>
                        <option value="standard">Standard</option>
                        <option value="prioritaire">Prioritaire</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Motif de l'orientation</label>
                    <textarea value={content.motif || ""} onChange={e => setContent(p => ({ ...p, motif: e.target.value }))} placeholder="Bilan complémentaire, avis spécialisé..." rows={3} />
                  </div>
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={content.dossierJoint || false} onChange={e => setContent(p => ({ ...p, dossierJoint: e.target.checked }))} />
                    <span>Dossier patient joint</span>
                  </label>
                </>
              )}

              {/* ── DISPOSITIF ── */}
              {type === "dispositif" && (
                <>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label>Type de dispositif</label>
                      <select value={content.dispType || ""} onChange={e => setContent(p => ({ ...p, dispType: e.target.value }))}>
                        <option value="">— Choisir —</option>
                        <option value="attelle">Attelle</option>
                        <option value="orthese">Orthèse</option>
                        <option value="semelles">Semelles orthopédiques</option>
                        <option value="bequilles">Béquilles</option>
                        <option value="contention">Contention / Compression</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Côté</label>
                      <select value={content.cote || ""} onChange={e => setContent(p => ({ ...p, cote: e.target.value }))}>
                        <option value="">— —</option>
                        <option value="droit">Droit</option>
                        <option value="gauche">Gauche</option>
                        <option value="bilateral">Bilatéral</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Taille / Spécifications</label>
                    <input value={content.specs || ""} onChange={e => setContent(p => ({ ...p, specs: e.target.value }))} placeholder="Taille M, mesures..." />
                  </div>
                  <div className={styles.field}>
                    <label>Durée d'utilisation</label>
                    <input value={content.duree || ""} onChange={e => setContent(p => ({ ...p, duree: e.target.value }))} placeholder="3 semaines, jusqu'à consolidation..." />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP 3: Preview & Sign ── */}
          {step === 3 && (
            <div className={styles.wizPreview}>
              <div className={styles.previewDoc}>
                <div className={styles.previewHeader}>
                  <h3>ORDONNANCE — {ORDO_TYPES.find(t => t.value === type)?.label?.toUpperCase()}</h3>
                  <span className={styles.previewDate}>{new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
                <div className={styles.previewSection}>
                  <strong>Diagnostic :</strong> {diagnosis || "—"}
                </div>
                {episode && <div className={styles.previewSection}><strong>Épisode :</strong> {episode}</div>}
                {validUntil && <div className={styles.previewSection}><strong>Valide jusqu'au :</strong> {new Date(validUntil).toLocaleDateString("fr-FR")}</div>}
                <div className={styles.previewContent}>
                  {type === "kine" && (
                    <>
                      {content.seances && <p><strong>Séances :</strong> {content.seances} — {content.frequence}</p>}
                      {content.objectifs && <p><strong>Objectifs :</strong> {content.objectifs}</p>}
                      {content.consignes && <p><strong>Consignes :</strong> {content.consignes}</p>}
                      {content.techniques && <p><strong>Techniques :</strong> {content.techniques}</p>}
                      {content.bilanCR && <p><em>Bilan initial + compte rendu demandé</em></p>}
                    </>
                  )}
                  {type === "imagerie" && (
                    <>
                      <p><strong>Examen :</strong> {content.examType} — {content.zone}</p>
                      {content.indication && <p><strong>Indication :</strong> {content.indication}</p>}
                      <p><strong>Urgence :</strong> {content.urgence} | <strong>Injection :</strong> {content.injection}</p>
                    </>
                  )}
                  {type === "biologie" && (
                    <>
                      <p><strong>Examens :</strong> {(content.examens || []).join(", ")}{content.autreExamens ? `, ${content.autreExamens}` : ""}</p>
                      {content.indication && <p><strong>Indication :</strong> {content.indication}</p>}
                      {content.aJeun && <p><em>Patient à jeun</em></p>}
                    </>
                  )}
                  {type === "medicament" && (content.lignes || []).map((l: any, i: number) => (
                    <div key={i} className={styles.previewMedLine}>
                      <p><strong>{l.dci}</strong> {l.dosage} — {l.forme}</p>
                      <p>{l.posologie} — {l.duree} — Qté: {l.qte} {l.renouvelable ? "(renouvelable)" : ""}</p>
                    </div>
                  ))}
                  {type === "arret" && (
                    <>
                      <p><strong>Période :</strong> {content.dateDebut} → {content.dateFin}</p>
                      {content.tempsPartiel && <p><em>Temps partiel thérapeutique</em></p>}
                      {content.prolongation && <p><em>Prolongation</em></p>}
                      {content.motif && <p><strong>Motif :</strong> {content.motif}</p>}
                    </>
                  )}
                  {type === "certificat" && (
                    <>
                      <p><strong>Type :</strong> {content.certType} — Sport : {content.sport}</p>
                      {content.restrictions && <p><strong>Restrictions :</strong> {content.restrictions}</p>}
                      {content.duree && <p><strong>Durée :</strong> {content.duree}</p>}
                    </>
                  )}
                  {type === "orientation" && (
                    <>
                      <p><strong>Spécialité :</strong> {content.specialite} — Urgence : {content.urgence}</p>
                      {content.motif && <p><strong>Motif :</strong> {content.motif}</p>}
                    </>
                  )}
                  {type === "dispositif" && (
                    <>
                      <p><strong>Dispositif :</strong> {content.dispType} — Côté : {content.cote}</p>
                      {content.specs && <p><strong>Spécifications :</strong> {content.specs}</p>}
                      {content.duree && <p><strong>Durée :</strong> {content.duree}</p>}
                    </>
                  )}
                </div>
                <div className={styles.previewSignature}>
                  <div className={styles.signatureLabel}>
                    <span>Signature du médecin</span>
                    <button type="button" className={styles.btnSmall} onClick={clearSignature}>Effacer</button>
                  </div>
                  <div className={styles.canvasWrapper}>
                    <canvas ref={canvasRef} width={460} height={140} className={styles.signatureCanvas}
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                    {!signatureImage && <div className={styles.canvasPlaceholder}>Dessinez votre signature ici</div>}
                  </div>
                  {signatureImage && (
                    <div className={styles.signatureConfirm}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg>
                      <span>Signature capturée</span>
                    </div>
                  )}
                  <div className={styles.signatureLegal}>
                    Document signé électroniquement · Horodatage ISO 8601 · Intégrité SHA-256
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.wizardFooter}>
          {step > 1 && <button type="button" className={styles.btnOutline} onClick={() => setStep(step - 1)}>Précédent</button>}
          <div style={{ flex: 1 }} />
          {submitError && <div className={styles.formError}>{submitError}</div>}
          {step === 1 && <button type="button" className={styles.btnPrimary} disabled={!type || isSubmitting} onClick={() => setStep(2)}>Suivant</button>}
          {step === 2 && <button type="button" className={styles.btnPrimary} disabled={!diagnosis || isSubmitting} onClick={() => setStep(3)}>Aperçu</button>}
          {step === 3 && (
            <>
              <button type="button" className={styles.btnOutline} disabled={isSubmitting} onClick={() => handleCreate(true)}>Enregistrer brouillon</button>
              <button type="button" className={styles.btnPrimary} disabled={!signatureImage || isSubmitting} onClick={() => handleCreate(false)}>
                {isSubmitting ? "Signature..." : "Signer & Créer"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ ORDONNANCE PREVIEW ═══════════════ */

function OrdonnancePreview({ ordonnance: o, onClose, onSign }: { ordonnance: Ordonnance; onClose: () => void; onSign: () => void }) {
  const sigData = (() => { try { return o.signatureData ? JSON.parse(o.signatureData) : null; } catch { return null; } })();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.wizardModal} onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className={styles.wizardHeader}>
          <h2>{ORDO_TYPES.find(t => t.value === o.type)?.label}</h2>
          <span className={styles.ordoStatus} style={{ color: ORDO_STATUS_LABELS[o.status].color, borderColor: ORDO_STATUS_LABELS[o.status].color }}>
            {ORDO_STATUS_LABELS[o.status].label}
          </span>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.wizPreview}>
          <div className={styles.previewDoc}>
            <div className={styles.previewSection}><strong>Diagnostic :</strong> {o.diagnosis}</div>
            {o.episode && <div className={styles.previewSection}><strong>Épisode :</strong> {o.episode}</div>}
            <div className={styles.previewSection}><strong>Créée le :</strong> {new Date(o.createdAt).toLocaleDateString("fr-FR")}</div>
            {o.signedAt && <div className={styles.previewSection}><strong>Signée le :</strong> {new Date(o.signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>}
            <pre className={styles.previewJson}>{JSON.stringify(o.content, null, 2)}</pre>

            {/* ── Signature display ── */}
            {sigData && (
              <div className={styles.previewSignature}>
                <div className={styles.signatureLabel}><span>Signature électronique</span></div>
                {sigData.image && (
                  <div className={styles.signatureImageWrapper}>
                    <img src={sigData.image} alt="Signature" className={styles.signatureImg} />
                  </div>
                )}
                <div className={styles.signatureProof}>
                  <div><strong>ID :</strong> {sigData.shortId}</div>
                  <div><strong>Hash SHA-256 :</strong> <code>{sigData.hash}</code></div>
                  <div><strong>Horodatage :</strong> {sigData.timestamp}</div>
                </div>
                <div className={styles.signatureLegal}>
                  Document signé électroniquement · Intégrité vérifiable par hash SHA-256
                </div>
              </div>
            )}
            {o.status === "annulee" && (
              <div className={styles.cancelledWatermark}>ANNULÉE</div>
            )}
          </div>
        </div>
        <div className={styles.wizardFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Fermer</button>
          <div style={{ flex: 1 }} />
          <button className={styles.btnOutline} onClick={() => generateOrdonnancePDF(o, ORDO_TYPES.find(t => t.value === o.type)?.label || o.type)}>Télécharger PDF</button>
          {o.status === "brouillon" && <button className={styles.btnPrimary} onClick={onSign}>Signer</button>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ NEW PRESCRIPTION MODAL ═══════════════ */

function NewPrescriptionModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Omit<Prescription, "id" | "patientId">) => void }) {
  const [type, setType] = useState<PrescType>("activite");
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<string[]>([""]);
  const [dateStart, setDateStart] = useState(new Date().toISOString().slice(0, 10));
  const [dateEnd, setDateEnd] = useState("");
  const [redFlags, setRedFlags] = useState<string[]>([""]);
  const [visible, setVisible] = useState(true);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.wizardModal} onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className={styles.wizardHeader}>
          <h2>Nouvelle prescription</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.wizardBody}>
          <div className={styles.field}>
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value as PrescType)}>
              {PRESC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label>Titre *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Repos relatif genou droit" />
          </div>
          <div className={styles.field}>
            <label>Consignes</label>
            {lines.map((l, i) => (
              <div key={i} className={styles.lineRow}>
                <input value={l} onChange={e => { const a = [...lines]; a[i] = e.target.value; setLines(a); }} placeholder={`Consigne ${i + 1}`} />
                {lines.length > 1 && <button className={styles.btnSmallDanger} onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            <button className={styles.btnSmall} onClick={() => setLines([...lines, ""])}>+ Ajouter</button>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label>Début</label><input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} /></div>
            <div className={styles.field}><label>Fin</label><input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} /></div>
          </div>
          <div className={styles.field}>
            <label>Red flags / Critères d'arrêt</label>
            {redFlags.map((r, i) => (
              <div key={i} className={styles.lineRow}>
                <input value={r} onChange={e => { const a = [...redFlags]; a[i] = e.target.value; setRedFlags(a); }} placeholder="Ex: douleur augmente, gonflement..." />
                {redFlags.length > 1 && <button className={styles.btnSmallDanger} onClick={() => setRedFlags(redFlags.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            <button className={styles.btnSmall} onClick={() => setRedFlags([...redFlags, ""])}>+ Ajouter</button>
          </div>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />
            <span>Visible par le patient</span>
          </label>
        </div>
        <div className={styles.wizardFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <div style={{ flex: 1 }} />
          <button className={styles.btnPrimary} disabled={!title} onClick={() => onCreate({ type, title, content: lines.filter(Boolean), dateStart, dateEnd: dateEnd || undefined, redFlags: redFlags.filter(Boolean), visiblePatient: visible, status: "active" })}>
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ NEW PROTOCOL MODAL ═══════════════ */

function NewProtocolModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Omit<Protocol, "id" | "patientId">) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [objectives, setObjectives] = useState<string[]>([""]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.wizardModal} onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className={styles.wizardHeader}>
          <h2>Nouveau protocole</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.wizardBody}>
          <div className={styles.field}>
            <label>Nom du protocole *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Entorse cheville grade I–II" />
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Objectifs globaux du protocole..." />
          </div>
          <div className={styles.field}>
            <label>Objectifs</label>
            {objectives.map((o, i) => (
              <div key={i} className={styles.lineRow}>
                <input value={o} onChange={e => { const a = [...objectives]; a[i] = e.target.value; setObjectives(a); }} placeholder={`Objectif ${i + 1}`} />
                {objectives.length > 1 && <button className={styles.btnSmallDanger} onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            <button className={styles.btnSmall} onClick={() => setObjectives([...objectives, ""])}>+ Ajouter</button>
          </div>
        </div>
        <div className={styles.wizardFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <div style={{ flex: 1 }} />
          <button className={styles.btnPrimary} disabled={!name} onClick={() => onCreate({ name, description: desc, objectives: objectives.filter(Boolean), phases: [{ id: uuid(), name: "Phase 1", objectives: [], toDo: [], toAvoid: [], progressionCriteria: [], alertCriteria: [], recommendedOrders: [], recommendedExams: [] }], linkedTemplates: [], status: "draft" })}>
            Créer & Éditer les phases
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ PROTOCOL EDITOR ═══════════════ */

function ProtocolEditor({ protocol, onClose, onSave }: { protocol: Protocol; onClose: () => void; onSave: (p: Protocol) => void }) {
  const [proto, setProto] = useState<Protocol>({ ...protocol, phases: protocol.phases.map(p => ({ ...p })) });
  const [activePhase, setActivePhase] = useState(0);

  const updatePhase = (idx: number, key: keyof Phase, val: any) => {
    setProto(prev => {
      const phases = prev.phases.map((p, i) => i === idx ? { ...p, [key]: val } : p);
      return { ...prev, phases };
    });
  };

  const addPhase = () => {
    setProto(prev => ({
      ...prev,
      phases: [...prev.phases, { id: uuid(), name: `Phase ${prev.phases.length + 1}`, objectives: [], toDo: [], toAvoid: [], progressionCriteria: [], alertCriteria: [], recommendedOrders: [], recommendedExams: [] }],
    }));
    setActivePhase(proto.phases.length);
  };

  const removePhase = (idx: number) => {
    if (proto.phases.length <= 1) return;
    setProto(prev => ({ ...prev, phases: prev.phases.filter((_, i) => i !== idx) }));
    if (activePhase >= idx && activePhase > 0) setActivePhase(activePhase - 1);
  };

  const phase = proto.phases[activePhase];
  if (!phase) return null;

  const ListEditor = ({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) => (
    <div className={styles.phaseField}>
      <label>{label}</label>
      {items.map((item, i) => (
        <div key={i} className={styles.lineRow}>
          <input value={item} onChange={e => { const a = [...items]; a[i] = e.target.value; onChange(a); }} />
          {items.length > 0 && <button className={styles.btnSmallDanger} onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>}
        </div>
      ))}
      <button className={styles.btnSmall} onClick={() => onChange([...items, ""])}>+ Ajouter</button>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.protoEditorModal} onClick={e => e.stopPropagation()}>
        <div className={styles.wizardHeader}>
          <div>
            <h2>{proto.name}</h2>
            <span className={styles.protoDescSmall}>{proto.description}</span>
          </div>
          <select value={proto.status} onChange={e => setProto(p => ({ ...p, status: e.target.value as any }))}>
            <option value="draft">Brouillon</option>
            <option value="active">Actif</option>
            <option value="completed">Terminé</option>
          </select>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.protoEditorBody}>
          {/* Phase sidebar */}
          <div className={styles.phaseSidebar}>
            {proto.phases.map((p, i) => (
              <div key={p.id} className={`${styles.phaseItem} ${activePhase === i ? styles.phaseItemActive : ""}`} onClick={() => setActivePhase(i)}>
                <span className={styles.phaseItemNum}>{i + 1}</span>
                <input className={styles.phaseItemInput} value={p.name} onClick={e => e.stopPropagation()}
                  onChange={e => updatePhase(i, "name", e.target.value)} />
                {proto.phases.length > 1 && <button className={styles.phaseRemove} onClick={e => { e.stopPropagation(); removePhase(i); }}>×</button>}
              </div>
            ))}
            <button className={styles.btnSmall} onClick={addPhase}>+ Phase</button>
          </div>

          {/* Phase content */}
          <div className={styles.phaseContent}>
            <ListEditor label="Objectifs de cette phase" items={phase.objectives} onChange={v => updatePhase(activePhase, "objectives", v)} />
            <ListEditor label="À faire (exercices, kiné, consignes)" items={phase.toDo} onChange={v => updatePhase(activePhase, "toDo", v)} />
            <ListEditor label="À éviter" items={phase.toAvoid} onChange={v => updatePhase(activePhase, "toAvoid", v)} />
            <ListEditor label="Critères de progression" items={phase.progressionCriteria} onChange={v => updatePhase(activePhase, "progressionCriteria", v)} />
            <ListEditor label="Critères d'alerte (red flags)" items={phase.alertCriteria} onChange={v => updatePhase(activePhase, "alertCriteria", v)} />
            <ListEditor label="Ordonnances recommandées" items={phase.recommendedOrders} onChange={v => updatePhase(activePhase, "recommendedOrders", v)} />
            <ListEditor label="Examens recommandés" items={phase.recommendedExams} onChange={v => updatePhase(activePhase, "recommendedExams", v)} />
          </div>
        </div>

        <div className={styles.wizardFooter}>
          <button className={styles.btnOutline} onClick={onClose}>Annuler</button>
          <div style={{ flex: 1 }} />
          <button className={styles.btnPrimary} onClick={() => onSave(proto)}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
