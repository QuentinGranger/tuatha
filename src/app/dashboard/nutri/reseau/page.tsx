"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offlineFetch";
import styles from "./page.module.scss";

/* ─── Types ─── */
interface AthleteOption { id: string; name: string; sport: string | null; status: string }

interface ProInfo { id: string; nom: string; prenom: string; specialite: string | null; avatarPath: string | null; email?: string; telephone?: string }

interface Connection {
  id: string;
  role: string;
  status: string;
  connectedPro: ProInfo;
  readProgramme: boolean;
  readIndicateurs: boolean;
  readBlessures: boolean;
  readDocuments: boolean;
  writeNote: boolean;
  writeProgramme: boolean;
  writeValidation: boolean;
  scope: string;
  createdAt: string;
  isOwner?: boolean;
  myPermissions?: { readProgramme: boolean; readIndicateurs: boolean; readBlessures: boolean; readDocuments: boolean };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  message: string | null;
  status: string;
  createdAt: string;
}

interface CollabNoteItem {
  id: string;
  content: string;
  type: string;
  tags: string[];
  pinned: boolean;
  parentId: string | null;
  authorPro: ProInfo;
  createdAt: string;
}

interface ReseauData {
  connections: Connection[];
  invitations: Invitation[];
  notes: CollabNoteItem[];
}

interface ChatMessage {
  id: string;
  content: string;
  senderPro: ProInfo;
  senderProId: string;
  createdAt: string;
}

/* ─── Constants ─── */
const ROLE_OPTIONS = ["Médecin", "Kinésithérapeute", "Ostéopathe", "Diététicien", "Prépa mentale", "Préparateur physique", "Autre professionnel"];
const NOTE_TAGS = ["Pathologie", "Protocole", "Douleur", "Retour patient", "Bilan", "Alerte", "Post-op", "Imagerie", "Ordonnance"];

const STATUS_LABELS: Record<string, string> = {
  connecte: "Connecté", en_attente: "En attente", refuse: "Refusé",
  envoyee: "Envoyée", acceptee: "Acceptée", refusee: "Refusée", annulee: "Annulée",
};

/* ─── Patient Overview sub-component ─── */
function PatientOverview({ onSelectAthlete }: { onSelectAthlete: (id: string) => void }) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/reseau/patients")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setPatients(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fixAvatar = (path: string | null) => path;
  const getInitials = (name: string) => name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  const filtered = search
    ? patients.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sport?.toLowerCase().includes(search.toLowerCase()))
    : patients;

  const riskColors: Record<string, string> = { GOOD: "#22c55e", MODERATE: "#f59e0b", HIGH: "#ef4444" };
  const riskLabels: Record<string, string> = { GOOD: "Bon", MODERATE: "Modéré", HIGH: "Élevé" };
  const trendIcons: Record<string, string> = { IMPROVING: "↗", STAGNATING: "→", DECLINING: "↘" };

  if (loading) return <div className={styles.loading}>Chargement des patients...</div>;

  return (
    <div className={styles.patientOverview}>
      <div className={styles.patientOverviewHeader}>
        <div className={styles.patientOverviewTitle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Mes patients
          <span className={styles.patientCount}>{patients.length}</span>
        </div>
        <div className={styles.patientSearchWrap}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className={styles.patientSearch} placeholder="Rechercher un patient..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {filtered.length === 0 && <div className={styles.emptySection}>Aucun patient trouvé</div>}
      <div className={styles.patientGrid}>
        {filtered.map((p: any) => (
          <div key={p.id} className={styles.patientCard} onClick={() => onSelectAthlete(p.id)}>
            <div className={styles.patientCardTop}>
              <div className={styles.patientAvatar}>{getInitials(p.name)}</div>
              <div className={styles.patientInfo}>
                <div className={styles.patientName}>{p.name}</div>
                <div className={styles.patientMeta}>
                  {p.sport && <span>{p.sport}</span>}
                  {p.bodyZone && <span>· {p.bodyZone}</span>}
                </div>
              </div>
              <div className={styles.patientIndicators}>
                {p.riskLevel && (
                  <span className={styles.patientRisk} style={{ color: riskColors[p.riskLevel] || "#94a3b8", borderColor: riskColors[p.riskLevel] || "#94a3b8" }}>
                    {riskLabels[p.riskLevel] || p.riskLevel}
                  </span>
                )}
                {p.trend && trendIcons[p.trend] && <span className={styles.patientTrend}>{trendIcons[p.trend]}</span>}
              </div>
            </div>
            {p.motif && <div className={styles.patientMotif}>{p.motif}</div>}
            {p.connectedPros?.length > 0 && (
              <div className={styles.patientPros}>
                <span className={styles.patientProsLabel}>Équipe :</span>
                {p.connectedPros.map((pro: any) => (
                  <div key={pro.id} className={styles.patientProChip}>
                    <div className={styles.patientProAvatar}>
                      {fixAvatar(pro.avatarPath) ? <img src={fixAvatar(pro.avatarPath)!} alt="" /> : <span>{(pro.prenom?.[0] || "") + (pro.nom?.[0] || "")}</span>}
                    </div>
                    <span>{pro.prenom} {pro.nom}</span>
                    <span className={styles.patientProSpec}>{pro.specialite}</span>
                  </div>
                ))}
              </div>
            )}
            {(!p.connectedPros || p.connectedPros.length === 0) && <div className={styles.patientNoPro}>Aucun professionnel lié</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Component ─── */
export default function ReseauPage() {
  const router = useRouter();

  const [myProId, setMyProId] = useState("");
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [data, setData] = useState<ReseauData | null>(null);
  const [loading, setLoading] = useState(false);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("Autre");
  const [invMessage, setInvMessage] = useState("");

  // Note form
  const [noteContent, setNoteContent] = useState("");
  const [noteTags, setNoteTags] = useState<string[]>([]);

  // Permission edit
  const [editPermConn, setEditPermConn] = useState<Connection | null>(null);

  // Chat
  const [chatPro, setChatPro] = useState<ProInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Legal disclaimer: persisted in localStorage once accepted
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("tuatha_reseau_terms_accepted");
    if (accepted === "true") setTermsAccepted(true);
  }, []);

  const acceptTerms = () => {
    if (!termsChecked) return;
    localStorage.setItem("tuatha_reseau_terms_accepted", "true");
    setTermsAccepted(true);
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.id) setMyProId(d.id); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/athletes?status=active")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAthletes(d); })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(() => {
    if (!athleteId) { setData(null); return; }
    setLoading(true);
    fetch(`/api/reseau?athleteId=${athleteId}`)
      .then((r) => r.json())
      .then((d) => { if (d.connections) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [athleteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedAthlete = athletes.find((a) => a.id === athleteId);

  const getInitials = (nom: string, prenom: string) => `${prenom?.[0] || ""}${nom?.[0] || ""}`.toUpperCase();
  const getProName = (p: ProInfo) => `${p.prenom} ${p.nom}`;
  const fixAvatar = (path: string | null) => path;

  /* ─── Actions ─── */
  const [inviteError, setInviteError] = useState("");

  const grantSharingConsent = async () => {
    if (!athleteId) return false;
    try {
      const res = await fetch(`/api/athletes/${athleteId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "partage", granted: true, method: "digital", purpose: "Consentement au partage recueilli pour invitation réseau" }),
      });
      return res.ok;
    } catch { return false; }
  };

  const sendInvite = async () => {
    if (!invEmail.trim() || !athleteId) return;
    setInviteError("");
    const res = await fetch("/api/reseau", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", athleteId, email: invEmail, role: invRole, message: invMessage }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      if (err?.consentRequired) {
        const ok = confirm(
          `${err.error || "Le consentement au partage est requis."}\n\nSouhaitez-vous recueillir le consentement de partage maintenant et renvoyer l'invitation ?`
        );
        if (ok) {
          const granted = await grantSharingConsent();
          if (granted) {
            const retry = await fetch("/api/reseau", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "invite", athleteId, email: invEmail, role: invRole, message: invMessage }),
            });
            if (retry.ok) {
              setShowInvite(false);
              setInvEmail(""); setInvRole("Autre"); setInvMessage("");
              fetchData();
              return;
            }
            const retryErr = await retry.json().catch(() => null);
            setInviteError(retryErr?.error || "Erreur lors de l'envoi de l'invitation.");
            return;
          }
          setInviteError("Impossible d'enregistrer le consentement.");
          return;
        }
        return;
      }
      setInviteError(err?.error || "Erreur lors de l'envoi de l'invitation.");
      return;
    }
    setShowInvite(false);
    setInvEmail(""); setInvRole("Autre"); setInvMessage("");
    fetchData();
  };

  const cancelInvite = async (inviteId: string) => {
    await fetch("/api/reseau", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateInvite", inviteId, status: "annulee" }),
    });
    fetchData();
  };

  const updatePermission = async (connectionId: string, field: string, value: boolean) => {
    await fetch("/api/reseau", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updatePermissions", connectionId, [field]: value }),
    });
    fetchData();
  };

  const addNote = async () => {
    if (!noteContent.trim() || !athleteId) return;
    await fetch("/api/reseau", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addNote", athleteId, content: noteContent, tags: noteTags }),
    });
    setNoteContent(""); setNoteTags([]);
    fetchData();
  };

  const pinNote = async (noteId: string, pinned: boolean) => {
    await fetch("/api/reseau", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pinNote", noteId, pinned }),
    });
    fetchData();
  };

  const deleteNote = async (noteId: string) => {
    await fetch("/api/reseau", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteNote", noteId }),
    });
    fetchData();
  };

  const [confirmDeleteConn, setConfirmDeleteConn] = useState<string | null>(null);
  const [shareMenuConn, setShareMenuConn] = useState<string | null>(null);
  const [expandedShared, setExpandedShared] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<Record<string, any>>({});
  const [sharedLoading, setSharedLoading] = useState<string | null>(null);

  const fetchSharedContent = async (proId: string, connId: string) => {
    if (expandedShared === connId) { setExpandedShared(null); return; }
    setExpandedShared(connId);
    if (sharedData[connId]) return;
    setSharedLoading(connId);
    try {
      const res = await fetch(`/api/reseau/shared?athleteId=${athleteId}&proId=${proId}`);
      if (res.ok) {
        const d = await res.json();
        setSharedData((prev) => ({ ...prev, [connId]: d }));
      }
    } catch {}
    setSharedLoading(null);
  };

  const deleteConnection = async (connectionId: string) => {
    await fetch("/api/reseau", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteConnection", connectionId }),
    });
    setConfirmDeleteConn(null);
    fetchData();
  };

  const toggleNoteTag = (tag: string) => {
    setNoteTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const parseMsgResponse = (d: any) => {
    if (d.messages && Array.isArray(d.messages)) return d.messages;
    if (Array.isArray(d)) return d;
    return [];
  };

  const fetchChatMessages = useCallback((proId: string) => {
    fetch(`/api/reseau/messages?proId=${proId}${athleteId ? `&athleteId=${athleteId}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setChatMessages(parseMsgResponse(d)); })
      .catch(() => {});
  }, [athleteId]);

  const openChat = (pro: ProInfo) => {
    setChatPro(pro);
    setChatMinimized(false);
    setChatMessages([]);
    setChatInput("");
    setChatLoading(true);
    fetch(`/api/reseau/messages?proId=${pro.id}${athleteId ? `&athleteId=${athleteId}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setChatMessages(parseMsgResponse(d)); })
      .catch(() => {})
      .finally(() => setChatLoading(false));
  };

  useEffect(() => {
    if (chatPro) {
      chatPollRef.current = setInterval(() => fetchChatMessages(chatPro.id), 5000);
      return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
    }
  }, [chatPro, fetchChatMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || !chatPro) return;
    const content = chatInput.trim();
    setChatInput("");
    const res = await offlineFetch("/api/reseau/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverProId: chatPro.id, athleteId: athleteId || null, content }),
    });
    const data = await res.clone().json().catch(() => null);
    if (!data?.queued) fetchChatMessages(chatPro.id);
  };

  const minimizeChat = () => setChatMinimized(true);
  const expandChat = () => setChatMinimized(false);
  const closeChat = () => {
    setChatPro(null);
    setChatMinimized(false);
    setChatMessages([]);
    if (chatPollRef.current) clearInterval(chatPollRef.current);
  };

  const connectedPros = data?.connections.filter((c) => c.status === "connecte") || [];
  const pendingConns = data?.connections.filter((c) => c.status === "en_attente") || [];
  const sentInvites = data?.invitations.filter((i) => i.status === "envoyee") || [];
  const otherInvites = data?.invitations.filter((i) => i.status !== "envoyee") || [];
  const pinnedNotes = data?.notes.filter((n) => n.pinned) || [];
  const regularNotes = data?.notes.filter((n) => !n.pinned) || [];

  /* ─── RENDER ─── */
  return (
    <div className={styles.page}>
      {/* ─── 1) Header ─── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Réseau professionnel</h1>
          {selectedAthlete && (
            <div className={styles.subtitle}>
              {selectedAthlete.name} · Suivi {selectedAthlete.status === "active" ? "actif" : selectedAthlete.status}
            </div>
          )}
        </div>
        <div className={styles.headerControls}>
          <select className={styles.athleteSelect} value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            <option value="">Sélectionner un patient</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {athleteId && (
            <div className={styles.headerBtns}>
              <button className={styles.btnPrimary} onClick={() => setShowInvite(true)}>+ Inviter un professionnel</button>
              <button className={styles.btnSecondary} onClick={() => router.push(`/dashboard/nutri/programmes?athleteId=${athleteId}`)}>Voir le protocole</button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Legal disclaimer: blocks page until terms accepted ─── */}
      {!termsAccepted && (
        <div className={styles.disclaimer}>
          <div className={styles.disclaimerCard}>
            <svg className={styles.disclaimerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2 className={styles.disclaimerTitle}>Espace Réseau Professionnel</h2>
            <p className={styles.disclaimerSubtitle}>Conditions d&apos;utilisation &amp; Confidentialité</p>
            <div className={styles.disclaimerLegal}>
              <p>En accédant à cet espace, vous vous engagez à respecter les conditions suivantes :</p>
              <ul>
                <li><strong>Secret professionnel</strong> — Les informations partagées dans cet espace sont couvertes par le secret professionnel (art. L.1110-4 du Code de la santé publique). Tout partage est limité aux professionnels de santé strictement impliqués dans la prise en charge et le parcours de soins du patient.</li>
                <li><strong>Consentement du patient</strong> — Vous attestez avoir recueilli le consentement éclairé du patient pour le partage d&apos;informations entre les professionnels de son équipe de soins, conformément au RGPD et à la loi Informatique et Libertés.</li>
                <li><strong>Finalité légitime</strong> — L&apos;utilisation de cet espace est exclusivement réservée à la coordination pluridisciplinaire des soins, à la rééducation et au suivi thérapeutique du patient. Toute utilisation à des fins commerciales, publicitaires ou non liées au soin est interdite.</li>
                <li><strong>Protection des données</strong> — Vous vous engagez à ne pas exporter, copier ou transmettre les données de santé en dehors de cette plateforme sans autorisation préalable et dans le respect du RGPD.</li>
                <li><strong>Responsabilité</strong> — Chaque professionnel reste responsable des informations qu&apos;il partage et des décisions cliniques qu&apos;il prend sur la base des données consultées.</li>
              </ul>
            </div>
            <label className={styles.disclaimerCheckLabel}>
              <input
                type="checkbox"
                className={styles.disclaimerCheck}
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
              />
              J&apos;ai lu et j&apos;accepte les conditions d&apos;utilisation de l&apos;espace Réseau Professionnel.
            </label>
            <button className={styles.disclaimerAcceptBtn} onClick={acceptTerms} disabled={!termsChecked}>
              Accepter et accéder
            </button>
          </div>
        </div>
      )}

      {/* ─── Patient overview (after terms accepted, before athlete selected) ─── */}
      {termsAccepted && !athleteId && (
        <PatientOverview onSelectAthlete={(id: string) => setAthleteId(id)} />
      )}

      {athleteId && loading && <div className={styles.loading}>Chargement du réseau...</div>}

      {athleteId && !loading && data && (
        <>
          {/* ─── 2) Réseau actuel ─── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Réseau actuel
              <span className={styles.cardTitleRight}>{connectedPros.length} connecté{connectedPros.length !== 1 ? "s" : ""}</span>
            </div>

            {connectedPros.length === 0 && pendingConns.length === 0 ? (
              <div className={styles.emptySection}>
                Aucun professionnel lié à ce patient
                <div style={{ marginTop: 10 }}>
                  <button className={styles.btnPrimary} onClick={() => setShowInvite(true)}>Inviter un professionnel</button>
                </div>
              </div>
            ) : (
              <div className={styles.proGrid}>
                {[...connectedPros, ...pendingConns].map((conn) => (
                  <div key={conn.id} className={styles.proCard}>
                    {confirmDeleteConn === conn.id ? (
                      <div className={styles.confirmDeleteOverlay}>
                        <span>Retirer ce professionnel ?</span>
                        <button className={styles.confirmDeleteYes} onClick={() => deleteConnection(conn.id)}>Supprimer</button>
                        <button className={styles.confirmDeleteNo} onClick={() => setConfirmDeleteConn(null)}>Annuler</button>
                      </div>
                    ) : (
                      <button className={styles.proCardClose} onClick={() => setConfirmDeleteConn(conn.id)} title="Retirer">×</button>
                    )}
                    <div className={styles.proCardHeader}>
                      <div className={styles.proAvatar}>
                        {fixAvatar(conn.connectedPro.avatarPath)
                          ? <img src={fixAvatar(conn.connectedPro.avatarPath)!} alt="" />
                          : getInitials(conn.connectedPro.nom, conn.connectedPro.prenom)}
                      </div>
                      <div className={styles.proInfo}>
                        <div className={styles.proName}>{getProName(conn.connectedPro)}</div>
                        <div className={styles.proSpecialite}>{conn.connectedPro.specialite || "Professionnel"}</div>
                      </div>
                      <span className={`${styles.proStatusChip} ${styles[`proStatus_${conn.status}`]}`}>
                        {STATUS_LABELS[conn.status]}
                      </span>
                    </div>
                    <div>
                      <span className={styles.proRoleChip}>{conn.role}</span>
                    </div>
                    {/* Shared access badges */}
                    {conn.myPermissions && !conn.isOwner && conn.status === "connecte" && (
                      <div className={styles.sharedAccess}>
                        <span className={styles.sharedLabel}>Partagé avec moi :</span>
                        <div className={styles.sharedBadges}>
                          {conn.myPermissions.readProgramme && (
                            <button className={styles.sharedBadge} onClick={() => router.push(`/dashboard/nutri/programmes?athleteId=${athleteId}`)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                              Protocole
                            </button>
                          )}
                          {conn.myPermissions.readIndicateurs && (
                            <button className={styles.sharedBadge} onClick={() => router.push(`/dashboard/nutri/indicateurs`)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                              Bilans
                            </button>
                          )}
                          {conn.myPermissions.readBlessures && (
                            <span className={styles.sharedBadge}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                              Pathologies
                            </span>
                          )}
                          {conn.myPermissions.readDocuments && (
                            <span className={styles.sharedBadge}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                              Documents
                            </span>
                          )}
                          {!conn.myPermissions.readProgramme && !conn.myPermissions.readIndicateurs && !conn.myPermissions.readBlessures && !conn.myPermissions.readDocuments && (
                            <span className={styles.sharedBadgeMuted}>Aucun accès partagé</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className={styles.proActions}>
                      <button className={styles.proActionBtn} onClick={() => openChat(conn.connectedPro)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        Contacter
                      </button>
                      <button className={styles.proActionBtn} onClick={() => setEditPermConn(conn)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Permissions
                      </button>
                      <div className={styles.shareWrapper}>
                        <button className={styles.proActionBtn} onClick={() => setShareMenuConn(shareMenuConn === conn.id ? null : conn.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                          Partager
                        </button>
                        {shareMenuConn === conn.id && (
                          <div className={styles.shareMenu}>
                            <button className={styles.shareMenuItem} onClick={() => { router.push(`/dashboard/nutri/programmes?athleteId=${athleteId}`); setShareMenuConn(null); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              Protocole
                            </button>
                            <button className={styles.shareMenuItem} onClick={() => { router.push(`/dashboard/nutri/indicateurs`); setShareMenuConn(null); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                              Bilan
                            </button>
                            <button className={styles.shareMenuItem} onClick={() => { setNoteContent(`Partage demandé avec ${getProName(conn.connectedPro)} — ${conn.connectedPro.specialite || "Pro"}`); setShareMenuConn(null); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              Créer une note
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* View shared data */}
                    {conn.status === "connecte" && (
                      <button className={styles.viewSharedBtn} onClick={() => router.push(`/dashboard/nutri/reseau/${conn.connectedPro.id}?athleteId=${athleteId}`)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Voir les données partagées
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    )}
                    {expandedShared === conn.id && (
                      <div className={styles.sharedContent}>
                        {sharedLoading === conn.id && <div className={styles.sharedContentLoading}>Chargement...</div>}
                        {sharedData[conn.id] && (
                          <>
                            {sharedData[conn.id].kinePlans?.length > 0 && (
                              <div className={styles.sharedSection}>
                                <div className={styles.sharedSectionTitle}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  Protocoles de rééducation
                                </div>
                                {sharedData[conn.id].kinePlans.map((plan: any) => (
                                  <div key={plan.id} className={styles.sharedPlanCard}>
                                    <div className={styles.sharedPlanHeader}>
                                      <strong>{plan.title}</strong>
                                      {plan.status && <span className={styles.sharedPlanStatus}>{plan.status}</span>}
                                    </div>
                                    {plan.pathology && <div className={styles.sharedPlanMeta}>Pathologie : {plan.pathology}</div>}
                                    {plan.phase && <div className={styles.sharedPlanMeta}>Phase : {plan.phase}</div>}
                                    {plan.globalProgress != null && (
                                      <div className={styles.sharedProgress}>
                                        <div className={styles.sharedProgressBar} style={{ width: `${plan.globalProgress}%` }} />
                                        <span>{plan.globalProgress}%</span>
                                      </div>
                                    )}
                                    {plan.exercises?.length > 0 && (
                                      <div className={styles.sharedExercises}>
                                        {plan.exercises.map((ex: any) => (
                                          <div key={ex.id} className={styles.sharedExItem}>
                                            <span className={styles.sharedExName}>{ex.video?.title || "Exercice"}</span>
                                            <span className={styles.sharedExDetail}>
                                              {[ex.sets && `${ex.sets}×${ex.reps || ""}`, ex.duration, ex.frequency].filter(Boolean).join(" · ") || "—"}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {sharedData[conn.id].sessions?.length > 0 && (
                              <div className={styles.sharedSection}>
                                <div className={styles.sharedSectionTitle}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                  Séances
                                </div>
                                {sharedData[conn.id].sessions.map((s: any) => (
                                  <div key={s.id} className={styles.sharedPlanCard}>
                                    <div className={styles.sharedPlanHeader}>
                                      <strong>{s.name}</strong>
                                      <span className={styles.sharedPlanStatus}>{s.status}</span>
                                    </div>
                                    <div className={styles.sharedPlanMeta}>{new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}{s.time ? ` · ${s.time}` : ""}</div>
                                    {s.objectif && <div className={styles.sharedPlanMeta}>Objectif : {s.objectif}</div>}
                                    {s.blocks?.length > 0 && (
                                      <div className={styles.sharedExercises}>
                                        {s.blocks.map((b: any) => b.exercises?.map((ex: any) => (
                                          <div key={ex.id} className={styles.sharedExItem}>
                                            <span className={styles.sharedExName}>{ex.name || "Exercice"}</span>
                                            <span className={styles.sharedExDetail}>
                                              {[ex.sets && `${ex.sets}×${ex.reps || ""}`, ex.duration].filter(Boolean).join(" · ") || "—"}
                                            </span>
                                          </div>
                                        )))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {sharedData[conn.id].logs?.length > 0 && (
                              <div className={styles.sharedSection}>
                                <div className={styles.sharedSectionTitle}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                                  Derniers retours
                                </div>
                                <div className={styles.sharedLogs}>
                                  {sharedData[conn.id].logs.slice(0, 10).map((log: any) => (
                                    <div key={log.id} className={styles.sharedLogItem}>
                                      <span>{log.exercise?.video?.title || "Exercice"}</span>
                                      <span>{log.done ? "✓" : "—"}{log.pain != null ? ` · Douleur ${log.pain}/10` : ""}</span>
                                      <span className={styles.sharedLogDate}>{new Date(log.loggedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {sharedData[conn.id].athleteInfo?.length > 0 && (
                              <div className={styles.sharedSection}>
                                <div className={styles.sharedSectionTitle}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                  Informations patient
                                </div>
                                {sharedData[conn.id].athleteInfo.map((info: any) => (
                                  <div key={info.id} className={styles.sharedPlanCard}>
                                    {info.motif && <div className={styles.sharedPlanMeta}>Motif : {info.motif}</div>}
                                    {info.bodyZone && <div className={styles.sharedPlanMeta}>Zone : {info.bodyZone}</div>}
                                    {info.injuryNote && <div className={styles.sharedPlanMeta}>Note : {info.injuryNote}</div>}
                                    {info.antecedents?.length > 0 && <div className={styles.sharedPlanMeta}>Antécédents : {info.antecedents.join(", ")}</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {!sharedData[conn.id].kinePlans?.length && !sharedData[conn.id].sessions?.length && !sharedData[conn.id].logs?.length && !sharedData[conn.id].athleteInfo?.length && (
                              <div className={styles.sharedContentEmpty}>Aucune donnée partagée pour le moment</div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── 3) Niveaux de partage ─── */}
          {connectedPros.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>
                <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Niveaux de partage
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className={styles.permTable}>
                  <thead>
                    <tr>
                      <th>Professionnel</th>
                      <th>Protocole</th>
                      <th>Bilans</th>
                      <th>Pathologies</th>
                      <th>Documents</th>
                      <th>Écrire note</th>
                      <th>Modif. protocole</th>
                      <th>Valider</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {connectedPros.map((conn) => (
                      <tr key={conn.id}>
                        <td className={styles.permProName}>{getProName(conn.connectedPro)}</td>
                        <td><input type="checkbox" className={styles.permCheck} checked={conn.readProgramme} onChange={(e) => updatePermission(conn.id, "readProgramme", e.target.checked)} /></td>
                        <td><input type="checkbox" className={styles.permCheck} checked={conn.readIndicateurs} onChange={(e) => updatePermission(conn.id, "readIndicateurs", e.target.checked)} /></td>
                        <td><input type="checkbox" className={styles.permCheck} checked={conn.readBlessures} onChange={(e) => updatePermission(conn.id, "readBlessures", e.target.checked)} /></td>
                        <td><input type="checkbox" className={styles.permCheck} checked={conn.readDocuments} onChange={(e) => updatePermission(conn.id, "readDocuments", e.target.checked)} /></td>
                        <td><input type="checkbox" className={styles.permCheck} checked={conn.writeNote} onChange={(e) => updatePermission(conn.id, "writeNote", e.target.checked)} /></td>
                        <td><input type="checkbox" className={styles.permCheck} checked={conn.writeProgramme} onChange={(e) => updatePermission(conn.id, "writeProgramme", e.target.checked)} /></td>
                        <td><input type="checkbox" className={styles.permCheck} checked={conn.writeValidation} onChange={(e) => updatePermission(conn.id, "writeValidation", e.target.checked)} /></td>
                        <td><button className={styles.permEditBtn} onClick={() => setEditPermConn(conn)}>⚙️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── 4) Demandes & Invitations ─── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Demandes &amp; Invitations
            </div>

            {sentInvites.length > 0 && (
              <div className={styles.inviteSection}>
                <div className={styles.inviteSectionTitle}>Invitations envoyées</div>
                <div className={styles.inviteGrid}>
                  {sentInvites.map((inv) => (
                    <div key={inv.id} className={styles.inviteItem}>
                      <div className={styles.inviteInfo}>
                        <div className={styles.inviteEmail}>{inv.email}</div>
                        <div className={styles.inviteMeta}>{inv.role} · {new Date(inv.createdAt).toLocaleDateString("fr-FR")}</div>
                      </div>
                      <span className={styles.inviteStatus}>{STATUS_LABELS[inv.status]}</span>
                      <div className={styles.inviteActions}>
                        <button className={styles.inviteActionBtn}>Relancer</button>
                        <button className={styles.inviteActionBtn} onClick={() => cancelInvite(inv.id)}>Annuler</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {otherInvites.length > 0 && (
              <div className={styles.inviteSection}>
                <div className={styles.inviteSectionTitle}>Historique</div>
                <div className={styles.inviteGrid}>
                  {otherInvites.map((inv) => (
                    <div key={inv.id} className={styles.inviteItem}>
                      <div className={styles.inviteInfo}>
                        <div className={styles.inviteEmail}>{inv.email}</div>
                        <div className={styles.inviteMeta}>{inv.role} · {new Date(inv.createdAt).toLocaleDateString("fr-FR")}</div>
                      </div>
                      <span className={`${styles.inviteStatus} ${styles[`inviteStatus_${inv.status}`]}`}>
                        {STATUS_LABELS[inv.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sentInvites.length === 0 && otherInvites.length === 0 && (
              <div className={styles.emptySection}>Aucune invitation envoyée</div>
            )}
          </div>

          {/* ─── 5) Collaboration (feed partagé) ─── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Collaboration
              <span className={styles.cardTitleRight}>{data.notes.length} note{data.notes.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Add note form */}
            <div className={styles.feedInput}>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Ajouter une note clinique partagée..."
                rows={2}
              />
              <button className={styles.feedSendBtn} onClick={addNote} disabled={!noteContent.trim()}>Publier</button>
            </div>
            <div className={styles.feedTagChips}>
              {NOTE_TAGS.map((t) => (
                <button key={t} className={noteTags.includes(t) ? styles.feedTagChipActive : styles.feedTagChip} onClick={() => toggleNoteTag(t)}>{t}</button>
              ))}
            </div>

            {/* Pinned notes */}
            {pinnedNotes.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>📌 Épinglées</div>
                <div className={styles.feedList}>
                  {pinnedNotes.map((note) => (
                    <NoteItem key={note.id} note={note} getProName={getProName} getInitials={getInitials} onPin={pinNote} onDelete={deleteNote} router={router} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular notes */}
            {regularNotes.length > 0 && (
              <div style={{ marginTop: pinnedNotes.length > 0 ? 18 : 14 }}>
                {pinnedNotes.length > 0 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Récentes</div>
                )}
                <div className={styles.feedList}>
                  {regularNotes.map((note) => (
                    <NoteItem key={note.id} note={note} getProName={getProName} getInitials={getInitials} onPin={pinNote} onDelete={deleteNote} router={router} />
                  ))}
                </div>
              </div>
            )}

            {data.notes.length === 0 && (
              <div className={styles.emptySection} style={{ marginTop: 14 }}>Aucune note de collaboration</div>
            )}
          </div>

          {/* ─── 6) Actions liées Programme ─── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Actions Protocole
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className={styles.btnSecondary} onClick={() => router.push(`/dashboard/nutri/programmes?athleteId=${athleteId}`)}>
                Partager un protocole
              </button>
              <button className={styles.btnSecondary} onClick={() => router.push(`/dashboard/nutri/programmes?athleteId=${athleteId}`)}>
                Partager le plan de soins
              </button>
              <button className={styles.btnSecondary} onClick={() => router.push(`/dashboard/nutri/indicateurs`)}>
                Partager un bilan
              </button>
              <button className={styles.btnSecondary}>Demander avis confrère</button>
              <button className={styles.btnSecondary}>Proposer adaptation protocole</button>
            </div>
          </div>
        </>
      )}

      {/* ─── Invite Modal ─── */}
      {showInvite && (
        <div className={styles.modalOverlay} onClick={() => setShowInvite(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Inviter un professionnel</h2>
            <div className={styles.field}>
              <label>Email *</label>
              <input value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="email@exemple.com" autoFocus />
            </div>
            <div className={styles.field}>
              <label>Rôle / Spécialité</label>
              <select value={invRole} onChange={(e) => setInvRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Message (optionnel)</label>
              <textarea value={invMessage} onChange={(e) => setInvMessage(e.target.value)} placeholder="Bonjour, je souhaite vous inviter à collaborer..." rows={3} />
            </div>
            {inviteError && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 4 }}>
                {inviteError}
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowInvite(false); setInviteError(""); }}>Annuler</button>
              <button className={styles.submitBtn} onClick={sendInvite} disabled={!invEmail.trim()}>Envoyer l&apos;invitation</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Permission Edit Modal ─── */}
      {/* ─── Chat minimized bubble ─── */}
      {chatPro && chatMinimized && (
        <div className={styles.chatBubbleToggle} onClick={expandChat}>
          <div className={styles.chatBubbleAvatar}>{getInitials(chatPro.nom, chatPro.prenom)}</div>
          <span className={styles.chatBubbleName}>{chatPro.prenom}</span>
          <button className={styles.chatBubbleClose} onClick={(e) => { e.stopPropagation(); closeChat(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ─── Chat panel ─── */}
      {chatPro && !chatMinimized && (
        <div className={styles.chatPanel}>
            <div className={styles.chatHeader}>
              <div className={styles.chatHeaderInfo}>
                <div className={styles.chatAvatar}>{getInitials(chatPro.nom, chatPro.prenom)}</div>
                <div>
                  <div className={styles.chatName}>{getProName(chatPro)}</div>
                  <div className={styles.chatSpecialite}>{chatPro.specialite || "Professionnel"}</div>
                </div>
              </div>
              <div className={styles.chatHeaderBtns}>
                <button className={styles.chatMinBtn} onClick={minimizeChat} title="Réduire">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /></svg>
                </button>
                <button className={styles.chatCloseBtn} onClick={closeChat} title="Fermer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className={styles.chatMessages}>
              {chatLoading && <div className={styles.chatEmpty}>Chargement...</div>}
              {!chatLoading && chatMessages.length === 0 && (
                <div className={styles.chatEmpty}>Aucun message. Commencez la conversation !</div>
              )}
              {chatMessages.map((msg) => {
                const isMe = msg.senderProId === myProId;
                return (
                  <div key={msg.id} className={`${styles.chatBubble} ${isMe ? styles.chatBubbleMe : styles.chatBubbleThem}`}>
                    <div className={styles.chatBubbleContent}>{msg.content}</div>
                    <div className={styles.chatBubbleTime}>
                      {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className={styles.chatInputBar}>
              <input
                className={styles.chatInput}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Écrire un message..."
              />
              <button className={styles.chatSendBtn} onClick={sendMessage} disabled={!chatInput.trim()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          </div>
      )}

      {editPermConn && (
        <div className={styles.modalOverlay} onClick={() => setEditPermConn(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Permissions — {getProName(editPermConn.connectedPro)}</h2>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>{editPermConn.role} · {editPermConn.connectedPro.specialite || "Professionnel"}</div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>LECTURE</div>
            {[
              { key: "readProgramme", label: "Protocole de rééducation" },
              { key: "readIndicateurs", label: "Bilans & suivi" },
              { key: "readBlessures", label: "Historique pathologies" },
              { key: "readDocuments", label: "Documents & imagerie" },
            ].map((p) => (
              <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  className={styles.permCheck}
                  checked={(editPermConn as unknown as Record<string, unknown>)[p.key] as boolean}
                  onChange={(e) => { updatePermission(editPermConn.id, p.key, e.target.checked); setEditPermConn({ ...editPermConn, [p.key]: e.target.checked }); }}
                />
                {p.label}
              </label>
            ))}

            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8, marginTop: 14 }}>ÉCRITURE</div>
            {[
              { key: "writeNote", label: "Ajouter une note clinique" },
              { key: "writeProgramme", label: "Proposer modification protocole" },
              { key: "writeValidation", label: "Valider un protocole" },
            ].map((p) => (
              <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  className={styles.permCheck}
                  checked={(editPermConn as unknown as Record<string, unknown>)[p.key] as boolean}
                  onChange={(e) => { updatePermission(editPermConn.id, p.key, e.target.checked); setEditPermConn({ ...editPermConn, [p.key]: e.target.checked }); }}
                />
                {p.label}
              </label>
            ))}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setEditPermConn(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-component: Note item ─── */
function NoteItem({ note, getProName, getInitials, onPin, onDelete, router }: {
  note: CollabNoteItem;
  getProName: (p: ProInfo) => string;
  getInitials: (nom: string, prenom: string) => string;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className={`${styles.feedItem} ${note.pinned ? styles.feedItemPinned : ""}`}>
      <div className={styles.feedHeader}>
        <div className={styles.feedAvatar}>{getInitials(note.authorPro.nom, note.authorPro.prenom)}</div>
        <div>
          <span className={styles.feedAuthor}>{getProName(note.authorPro)}</span>
          <span className={styles.feedRole}> · {note.authorPro.specialite || "Pro"}</span>
        </div>
        <span className={styles.feedDate}>{new Date(note.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div className={styles.feedContent}>{note.content}</div>
      {note.tags.length > 0 && (
        <div className={styles.feedTags}>
          {note.tags.map((t) => <span key={t} className={styles.feedTag}>{t}</span>)}
        </div>
      )}
      <div className={styles.feedActions}>
        <button className={styles.feedActionBtn} onClick={() => onPin(note.id, !note.pinned)}>
          {note.pinned ? "Désépingler" : "📌 Épingler"}
        </button>
        <button className={styles.feedActionBtn} onClick={() => onDelete(note.id)}>Supprimer</button>
        <button className={styles.feedActionBtn} onClick={() => router.push("/dashboard/nutri/programmes")}>→ Protocole</button>
      </div>
    </div>
  );
}
