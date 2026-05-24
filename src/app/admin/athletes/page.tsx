"use client";
import { useState, useEffect, useCallback } from "react";

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
};
const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  if (diff < 60000) return "À l'instant";
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Aujourd'hui ${dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  if (diff < 172800000) return `Hier ${dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return dt.toLocaleDateString("fr-FR");
};

// ─── Status badge ───────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "Actif":            { bg: "#dcfce7", color: "#16a34a" },
  "Inactif":          { bg: "#f1f5f9", color: "#64748b" },
  "Non vérifié":      { bg: "#fef9c3", color: "#854d0e" },
  "Paiement échoué":  { bg: "#fee2e2", color: "#dc2626" },
  "Suppression demandée": { bg: "#fce7f3", color: "#be185d" },
  "Activité suspecte":{ bg: "#fef3c7", color: "#b45309" },
  "Ticket ouvert":    { bg: "#dbeafe", color: "#1d4ed8" },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: "0.7rem", fontWeight: 600, borderRadius: "99px", padding: "2px 8px", whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    "Normal":  { bg: "#dcfce7", color: "#16a34a" },
    "Moyen":   { bg: "#fef3c7", color: "#b45309" },
    "Élevé":   { bg: "#fee2e2", color: "#dc2626" },
  };
  const s = map[level] || map["Normal"];
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: "0.7rem", fontWeight: 600, borderRadius: "99px", padding: "2px 8px" }}>
      {level}
    </span>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────
function Stat({ icon, label, value, sub, color = "#2563eb" }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1rem 1.2rem", display: "flex", alignItems: "center", gap: "0.9rem", minWidth: 0 }}>
      <div style={{ width: 36, height: 36, borderRadius: "8px", background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>{label}</div>
        {sub && <div style={{ fontSize: "0.68rem", color: color, marginTop: "1px" }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Filter chip ────────────────────────────────────────────────────────────
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "3px 10px", borderRadius: "99px", fontSize: "0.72rem", fontWeight: 500, cursor: "pointer", border: "1px solid",
      borderColor: active ? "#2563eb" : "#e2e8f0",
      background: active ? "#dbeafe" : "#f8fafc",
      color: active ? "#1d4ed8" : "#475569",
    }}>{label}</button>
  );
}

// ─── Tab ────────────────────────────────────────────────────────────────────
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: active ? 600 : 400,
      color: active ? "#2563eb" : "#64748b",
      background: "none", border: "none", borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
      cursor: "pointer", whiteSpace: "nowrap",
    }}>{label}</button>
  );
}

// ─── Section title ─────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>{children}</div>;
}

// ─── Detail row ─────────────────────────────────────────────────────────────
function DRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: "0.75rem", color: "#64748b", minWidth: "140px", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "0.78rem", color: accent ? "#2563eb" : "#1e293b", fontWeight: accent ? 600 : 400 }}>{value}</span>
    </div>
  );
}

// ─── Action button ─────────────────────────────────────────────────────────
function ActBtn({ label, icon, onClick, danger }: { label: string; icon: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "0.4rem",
      padding: "0.35rem 0.7rem", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 500,
      border: `1px solid ${danger ? "#fca5a5" : "#e2e8f0"}`,
      background: danger ? "#fef2f2" : "#f8fafc",
      color: danger ? "#dc2626" : "#475569",
      cursor: "pointer",
    }}>
      <span style={{ width: 12, height: 12, flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

const SVG = {
  users:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  shield:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  ticket:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>,
  export:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  trash:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
  alert:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  filter:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  refresh: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  eye:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  lock:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  link:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  file:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  check:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  x:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  unlink:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>,
  send:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  wallet:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  history: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  virus:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>,
  block:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  logout:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const FILTERS = [
  "Actif", "Inactif", "Compte non vérifié", "Paiement échoué",
  "Suppression demandée", "Export demandé", "Consentement retiré",
  "Aucun pro lié", "Activité suspecte", "Ticket ouvert",
];

const TABS = ["Vue générale", "Sécurité du compte", "Professionnels liés", "Documents", "Consentements", "Tickets", "Paiements", "Enquêtes"];

export default function AthletesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [permModal, setPermModal] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [docMetaModal, setDocMetaModal] = useState<any>(null);
  const [docHistoryModal, setDocHistoryModal] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; danger?: boolean; withReason?: boolean; reasonLabel?: string; reasonRequired?: boolean; onConfirm: (reason?: string) => void } | null>(null);
  const [modalReason, setModalReason] = useState("");
  const [athleteInvestigations, setAthleteInvestigations] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/admin/athletes")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadAthleteInvestigations = useCallback((athleteUserId: string) => {
    fetch(`/api/admin/tickets?view=investigations`)
      .then(r => r.json())
      .then(d => {
        const inv = (d.investigations ?? []).filter((i: any) => i.athleteUser?.id === athleteUserId);
        setAthleteInvestigations(inv);
      })
      .catch(() => setAthleteInvestigations([]));
  }, []);

  const loadDetail = useCallback((athlete: any) => {
    setSelected(athlete);
    setTab(0);
    setDetail(null);
    setDetailLoading(true);
    setAthleteInvestigations([]);
    fetch(`/api/admin/athletes?id=${athlete.id}`)
      .then(r => r.json())
      .then(d => { setDetail(d); if (d?.athleteUserId) loadAthleteInvestigations(d.athleteUserId); })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [loadAthleteInvestigations]);

  const showMsg = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(null), 3000); };

  const handlePermissions = async (connectionId: string) => {
    try {
      const r = await fetch("/api/admin/athletes/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_permissions", connectionId }),
      });
      const data = await r.json();
      if (data.error) { showMsg(`Erreur : ${data.error}`); return; }
      setPermModal(data);
    } catch { showMsg("Erreur réseau."); }
  };

  const openConfirm = (title: string, message: string, onConfirm: (reason?: string) => void, opts?: { danger?: boolean; withReason?: boolean; reasonLabel?: string; reasonRequired?: boolean }) => {
    setModalReason("");
    setConfirmModal({ title, message, danger: opts?.danger, withReason: opts?.withReason, reasonLabel: opts?.reasonLabel, reasonRequired: opts?.reasonRequired, onConfirm });
  };

  const handleRevoke = (connectionId: string, proName: string) => {
    openConfirm("Révoquer la connexion", `Révoquer la connexion avec ${proName} ? Cette action est irréversible. Un email sera envoyé à l'athlète.`, async () => {
      try {
        const r = await fetch("/api/admin/athletes/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revoke_connection", connectionId }),
        });
        const data = await r.json();
        if (data.success) { showMsg("Connexion révoquée."); if (selected) loadDetail(selected); }
        else showMsg(`Erreur : ${data.error}`);
      } catch { showMsg("Erreur réseau."); }
      setConfirmModal(null);
    }, { danger: true });
  };

  const handleDisconnectAll = () => {
    openConfirm("Déconnecter les sessions", `Révoquer toutes les sessions actives de cet athlète ? Un email sera envoyé.`, async () => {
      try {
        const r = await fetch("/api/admin/athletes/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "disconnect_all_sessions", athleteId: selected?.id }),
        });
        const data = await r.json();
        if (data.success) { showMsg("Toutes les sessions révoquées."); if (selected) loadDetail(selected); }
        else showMsg(`Erreur : ${data.error}`);
      } catch { showMsg("Erreur réseau."); }
      setConfirmModal(null);
    });
  };

  const callAction = async (payload: Record<string, string>) => {
    const r = await fetch("/api/admin/athletes/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.json();
  };

  const handleDocMeta = async (documentId: string) => {
    try {
      const d = await callAction({ action: "get_doc_metadata", documentId });
      if (d.error) { showMsg(`Erreur : ${d.error}`); return; }
      setDocMetaModal(d);
    } catch { showMsg("Erreur réseau."); }
  };

  const handleDocHistory = async (documentId: string) => {
    try {
      const d = await callAction({ action: "doc_history", documentId });
      if (d.error) { showMsg(`Erreur : ${d.error}`); return; }
      setDocHistoryModal(d.versions ?? []);
    } catch { showMsg("Erreur réseau."); }
  };

  const handleDisableDoc = (documentId: string) => {
    openConfirm("Désactiver le document", "Désactiver ce document ? Il ne sera plus accessible. Un email sera envoyé à l'athlète.", async () => {
      try {
        const d = await callAction({ action: "disable_doc", documentId });
        if (d.success) { showMsg("Document désactivé."); if (selected) loadDetail(selected); }
        else showMsg(`Erreur : ${d.error}`);
      } catch { showMsg("Erreur réseau."); }
      setConfirmModal(null);
    }, { danger: true });
  };

  const handleScanDoc = async (documentId: string) => {
    showMsg("Scan antivirus en cours...");
    try {
      const d = await callAction({ action: "scan_doc", documentId });
      showMsg(d.message ?? "Scan terminé.");
    } catch { showMsg("Erreur réseau."); }
  };

  const handleModeExceptionnel = () => {
    openConfirm("Mode exceptionnel", "Activer le mode exceptionnel pour accéder aux données protégées ? Cet accès sera journalisé et le DPO sera notifié. Un email sera envoyé à l'athlète.", async (justification) => {
      try {
        const d = await callAction({ action: "mode_exceptionnel", athleteId: selected?.id ?? "" });
        showMsg(d.message ?? "Mode exceptionnel activé.");
      } catch { showMsg("Erreur réseau."); }
      setConfirmModal(null);
    }, { danger: true, withReason: true, reasonLabel: "Justification obligatoire", reasonRequired: true });
  };

  const handleAccountAction = (action: string, title: string, message: string, opts?: { danger?: boolean; withReason?: boolean }) => {
    if (!detail?.athleteUserId) { showMsg("Pas de compte utilisateur lié."); return; }
    openConfirm(title, message, async (reason) => {
      try {
        const d = await callAction({ action, athleteUserId: detail.athleteUserId, ...(reason ? { reason } : {}) });
        if (d.success) { showMsg(d.message); if (selected) loadDetail(selected); }
        else showMsg(`Erreur : ${d.error}`);
      } catch { showMsg("Erreur réseau."); }
      setConfirmModal(null);
    }, opts);
  };

  const handleSuspend = () => handleAccountAction("suspend_account", "Suspendre le compte", `Suspendre le compte de ${detail?.prenom} ${detail?.nom} ? Toutes les sessions seront révoquées et un email sera envoyé.`, { danger: true, withReason: true });
  const handleUnsuspend = () => handleAccountAction("unsuspend_account", "Lever la suspension", `Réactiver le compte de ${detail?.prenom} ${detail?.nom} ? Un email sera envoyé.`);
  const handleRestrict = () => handleAccountAction("restrict_account", "Restreindre les accès", `Restreindre les accès de ${detail?.prenom} ${detail?.nom} ? Un email sera envoyé.`, { withReason: true });
  const handleDeleteAccount = () => handleAccountAction("delete_account", "Supprimer le compte", `⚠️ SUPPRIMER le compte de ${detail?.prenom} ${detail?.nom} ? Cette action est irréversible. Toutes les données seront supprimées et un email sera envoyé.`, { danger: true, withReason: true });
  const handleRevokeAllConnections = () => handleAccountAction("revoke_all_connections", "Révoquer toutes les connexions", `Révoquer TOUTES les connexions professionnelles de ${detail?.prenom} ${detail?.nom} ? Un email sera envoyé.`, { danger: true });

  const toggleFilter = (f: string) => {
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  const filtered = (data?.athletes ?? []).filter((a: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${a.prenom} ${a.nom}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (activeFilters.length === 0) return true;
    return activeFilters.some(f => {
      if (f === "Actif") return a.statusKey === "Actif";
      if (f === "Inactif") return a.statusKey === "Inactif";
      if (f === "Compte non vérifié") return !a.emailVerified;
      if (f === "Paiement échoué") return a.hasFailedPayment;
      if (f === "Aucun pro lié") return a.proCount === 0;
      if (f === "Activité suspecte") return a.riskLevel === "Élevé";
      if (f === "Ticket ouvert") return a.openTickets > 0;
      return false;
    });
  });

  const stats = data?.stats ?? {};

  return (
    <div style={{ color: "#1e293b" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.02em" }}>Athlètes</h1>
        <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>Gérer les comptes athlètes sans violer leur intimité</p>
      </div>

      {/* Stat bar */}
      <div className="admin-stats-row" style={{ marginBottom: "1.25rem" }}>
        <Stat icon={SVG.users} label="Athlètes actifs" value={loading ? "..." : stats.total ?? 0} sub={stats.todayCount > 0 ? `+${stats.todayCount} aujourd'hui` : undefined} color="#2563eb" />
        <Stat icon={SVG.shield} label="Comptes non vérifiés" value={loading ? "..." : stats.unverified ?? 0} color="#f59e0b" />
        <Stat icon={SVG.ticket} label="Tickets ouverts" value={loading ? "..." : 0} sub="+0 vs hier" color="#8b5cf6" />
        <Stat icon={SVG.export} label="Exports demandés" value={loading ? "..." : stats.exportRequests ?? 0} color="#06b6d4" />
        <Stat icon={SVG.trash} label="Suppressions demandées" value={loading ? "..." : stats.deletionRequests ?? 0} color="#ec4899" />
        <Stat icon={SVG.alert} label="Risque élevé" value={loading ? "..." : stats.riskHigh ?? 0} color="#ef4444" />
      </div>

      {/* Main layout: list + detail */}
      <div className="admin-detail-layout" style={{ alignItems: "flex-start" }}>
        {/* ── Left: athlete list ── */}
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {/* Search + filter bar */}
          <div style={{ padding: "0.75rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.4rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.35rem 0.6rem" }}>
                <span style={{ color: "#94a3b8" }}>{SVG.search}</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par nom ou email..."
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.78rem", background: "transparent", color: "#1e293b" }}
                />
              </div>
              <button
                onClick={() => setShowFilters(v => !v)}
                onDoubleClick={() => { setActiveFilters([]); setShowFilters(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.7rem", borderRadius: "7px",
                  border: activeFilters.length > 0 ? "1px solid #2563eb" : "1px solid #e2e8f0",
                  background: activeFilters.length > 0 ? "#dbeafe" : showFilters ? "#f1f5f9" : "#f8fafc",
                  fontSize: "0.72rem", color: activeFilters.length > 0 ? "#1d4ed8" : "#475569", cursor: "pointer", position: "relative",
                }}>
                {SVG.filter} Filtres
                {activeFilters.length > 0 && (
                  <span style={{ background: "#2563eb", color: "#fff", fontSize: "0.6rem", fontWeight: 700, borderRadius: "99px", padding: "0 5px", lineHeight: "15px", minWidth: "15px", textAlign: "center" }}>
                    {activeFilters.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setLoading(true);
                  setSelected(null); setDetail(null);
                  fetch("/api/admin/athletes").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
                  showMsg("Données actualisées.");
                }}
                title="Actualiser les données"
                style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.7rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.72rem", color: "#475569", cursor: "pointer" }}>
                {SVG.refresh}
              </button>
            </div>
            {/* Filter chips */}
            {showFilters && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                {FILTERS.map(f => <Chip key={f} label={f} active={activeFilters.includes(f)} onClick={() => toggleFilter(f)} />)}
                {activeFilters.length > 0 && (
                  <button onClick={() => setActiveFilters([])} style={{ border: "none", background: "none", color: "#dc2626", fontSize: "0.68rem", cursor: "pointer", fontWeight: 500, padding: "2px 4px" }}>
                    Effacer tout
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 70px 70px 50px", gap: "0", padding: "0.4rem 0.75rem", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
            {["Nom", "Email", "Statut", "Inscription", "Dern. co."].map(h => (
              <span key={h} style={{ fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Chargement...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Aucun athlète trouvé.</div>
            ) : filtered.map((a: any) => (
              <div
                key={a.id}
                onClick={() => loadDetail(a)}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 70px 70px 50px",
                  padding: "0.5rem 0.75rem", cursor: "pointer",
                  borderBottom: "1px solid #f8fafc",
                  background: selected?.id === a.id ? "#eff6ff" : "transparent",
                  borderLeft: selected?.id === a.id ? "2px solid #2563eb" : "2px solid transparent",
                }}
              >
                <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.prenom} {a.nom?.[0]}.</span>
                <span style={{ fontSize: "0.72rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</span>
                <span><StatusBadge status={a.statusKey} /></span>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{fmtDate(a.createdAt)}</span>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{fmtDateTime(a.lastLogin)}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid #f1f5f9", fontSize: "0.68rem", color: "#94a3b8" }}>
            Affichage de 1 à {Math.min(filtered.length, 12)} sur {filtered.length} athlètes
          </div>
        </div>

        {/* ── Right: detail panel ── */}
        {!selected ? (
          <div style={{ flex: 1, background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", color: "#94a3b8" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" style={{ marginBottom: "0.75rem", opacity: 0.4 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p style={{ fontSize: "0.82rem" }}>Sélectionner un athlète pour voir sa fiche</p>
          </div>
        ) : (
          <div style={{ flex: 1, background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {/* Detail header */}
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Athlète {selected.prenom} {selected.nom?.[0]}.</span>
                  <StatusBadge status={selected.statusKey} />
                  <RiskBadge level={selected.riskLevel} />
                  {detail?.accountStatus && detail.accountStatus !== "active" && (
                    <span style={{
                      background: detail.accountStatus === "suspended" ? "#fee2e2" : detail.accountStatus === "deleted" ? "#1e293b" : "#fef3c7",
                      color: detail.accountStatus === "suspended" ? "#dc2626" : detail.accountStatus === "deleted" ? "#fff" : "#d97706",
                      fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: "9999px",
                    }}>
                      {detail.accountStatus === "suspended" ? "Suspendu" : detail.accountStatus === "restricted" ? "Restreint" : detail.accountStatus === "deleted" ? "Supprimé" : detail.accountStatus}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>Email : {selected.email}</div>
                <div style={{ fontSize: "0.72rem", color: selected.emailVerified ? "#16a34a" : "#dc2626", marginTop: "1px" }}>
                  Compte vérifié : {selected.emailVerified ? "Oui" : "Non"}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,80px)", gap: "0.5rem", fontSize: "0.72rem", textAlign: "center" }}>
                <div><div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>{selected.proCount}</div><div style={{ color: "#64748b" }}>Professionnels</div></div>
                <div><div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>{selected.docCount}</div><div style={{ color: "#64748b" }}>Documents</div></div>
                <div><div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>{selected.openTickets}</div><div style={{ color: "#64748b" }}>Tickets</div></div>
              </div>
            </div>

            {/* Tabs */}
            <div className="admin-tabs-row" style={{ borderBottom: "1px solid #f1f5f9", padding: "0 0.75rem" }}>
              {TABS.map((t, i) => <Tab key={t} label={t} active={tab === i} onClick={() => setTab(i)} />)}
            </div>

            {/* Tab content */}
            <div style={{ padding: "1rem 1.25rem", overflowY: "auto", maxHeight: "calc(100vh - 380px)" }}>
              {detailLoading ? (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "2rem", fontSize: "0.8rem" }}>Chargement...</div>
              ) : !detail ? null : (
                <>
                  {/* ── Tab 7: Enquêtes ── */}
                  {tab === 7 && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                        <SectionTitle>Investigations liées</SectionTitle>
                        <button onClick={() => { window.open(`/admin/tickets`, "_blank"); }} style={{ padding: "0.3rem 0.7rem", borderRadius: "6px", border: "1px solid #7c3aed", background: "#ede9fe", color: "#7c3aed", fontSize: "0.68rem", fontWeight: 600, cursor: "pointer" }}>Voir toutes →</button>
                      </div>
                      {athleteInvestigations.length === 0 ? (
                        <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucune enquête ouverte pour cet athlète.</p>
                      ) : athleteInvestigations.map((inv: any) => (
                        <div key={inv.id} style={{ padding: "0.6rem 0.8rem", border: "1px solid #e2e8f0", borderRadius: "10px", marginBottom: "0.5rem", background: "#fafafa" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{inv.title}</span>
                            <span style={{ fontSize: "0.6rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", background: inv.status.startsWith("closed") ? "#dcfce7" : inv.status === "in_progress" ? "#fef3c7" : "#dbeafe", color: inv.status.startsWith("closed") ? "#16a34a" : inv.status === "in_progress" ? "#d97706" : "#2563eb" }}>{inv.status === "open" ? "Ouverte" : inv.status === "in_progress" ? "En cours" : inv.status.startsWith("closed") ? "Close" : inv.status}</span>
                          </div>
                          <div style={{ display: "flex", gap: "1rem", marginTop: "0.3rem", fontSize: "0.68rem", color: "#64748b" }}>
                            <span>Type: {inv.type}</span>
                            <span>Sévérité: {inv.severity}</span>
                            <span>Ouverte: {fmtDate(inv.createdAt)}</span>
                            {inv.dpoNotifiedAt && <span style={{ color: "#16a34a" }}>DPO notifié</span>}
                          </div>
                          {inv._count?.tickets > 0 && <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: "0.2rem" }}>{inv._count.tickets} ticket(s) lié(s)</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Tab 0: Vue générale ── */}
                  {tab === 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div>
                        <SectionTitle>Aperçu du compte</SectionTitle>
                        <DRow label="Membre depuis le" value={fmtDate(detail.createdAt)} />
                        <DRow label="Statut du compte" value={
                          detail.accountStatus === "suspended" ? "Suspendu" :
                          detail.accountStatus === "restricted" ? "Restreint" :
                          detail.accountStatus === "deleted" ? "Supprimé" : "Actif"
                        } accent />
                        <DRow label="Athlète actif" value={detail.athletes?.some((a: any) => a.status === "active") ? "Oui" : "Non"} />
                        <DRow label="Pros de santé liés" value={detail.athletes?.length ?? 0} accent />
                        <DRow label="Documents partagés" value={detail.athleteDocsSent?.length ?? 0} accent />
                        <DRow label="Consentements à jour" value={detail.acceptedCguAt ? "Oui" : "Non"} />
                      </div>
                      <div>
                        <SectionTitle>Sécurité du compte</SectionTitle>
                        <DRow label="Dernière connexion" value={fmtDateTime(detail.authSessions?.[0]?.lastActiveAt)} />
                        <DRow label="Appareils actifs" value={`${detail.authSessions?.filter((s: any) => !s.revoked).length ?? 0} appareils`} />
                        <DRow label="MFA activée" value={detail.twoFactorEnabled ? "Oui" : "Non"} />
                        <DRow label="Sessions actives" value={`${detail.authSessions?.filter((s: any) => !s.revoked && new Date(s.expiresAt) > new Date()).length ?? 0} sessions`} />
                        <div style={{ marginTop: "0.75rem" }}>
                          <ActBtn label="Déconnecter tous les appareils" icon={SVG.logout} danger onClick={handleDisconnectAll} />
                        </div>
                        <div style={{ marginTop: "1rem" }}>
                          <SectionTitle>Actions administratives</SectionTitle>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {detail.accountStatus !== "suspended" ? (
                              <ActBtn label="Suspendre le compte" icon={SVG.block} danger onClick={handleSuspend} />
                            ) : (
                              <ActBtn label="Lever la suspension" icon={SVG.check} onClick={handleUnsuspend} />
                            )}
                            {detail.accountStatus !== "restricted" && detail.accountStatus !== "suspended" && (
                              <ActBtn label="Restreindre les accès" icon={SVG.lock} onClick={handleRestrict} />
                            )}
                            <ActBtn label="Révoquer toutes les connexions" icon={SVG.unlink} danger onClick={handleRevokeAllConnections} />
                            <ActBtn label="Supprimer le compte" icon={SVG.trash} danger onClick={handleDeleteAccount} />
                          </div>
                        </div>
                      </div>
                      <div>
                        <SectionTitle>Professionnels liés</SectionTitle>
                        {detail.athletes?.length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun professionnel lié.</p>}
                        {(detail.athletes ?? []).map((a: any) => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", borderBottom: "1px solid #f8fafc" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "0.78rem", fontWeight: 500 }}>{a.professionnel?.prenom} {a.professionnel?.nom}</div>
                              <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{a.professionnel?.specialite}</div>
                            </div>
                            <StatusBadge status={a.status === "active" ? "Actif" : a.status === "revoked" ? "Inactif" : "Actif"} />
                          </div>
                        ))}
                      </div>
                      <div>
                        <SectionTitle>Documents</SectionTitle>
                        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: "6px", padding: "0.5rem 0.75rem", fontSize: "0.72rem", color: "#854d0e", marginBottom: "0.5rem" }}>
                          Contenu masqué — accès via mode exceptionnel justifié uniquement
                        </div>
                        {(detail.athleteDocsSent ?? []).slice(0, 5).map((d: any, i: number) => (
                          <DRow key={d.id} label={`Document #${String(i + 1).padStart(3, "0")}`} value={`${d.documentType ?? "Inconnu"} — ${fmtDate(d.createdAt)}`} />
                        ))}
                        {detail.athleteDocsSent?.length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun document.</p>}
                      </div>
                      <div>
                        <SectionTitle>Consentements</SectionTitle>
                        {[
                          { label: "CGU acceptées", date: detail.acceptedCguAt, ok: !!detail.acceptedCguAt },
                          { label: "Politique de confidentialité", date: detail.acceptedPrivacyAt, ok: !!detail.acceptedPrivacyAt },
                          { label: "Consentement données santé", date: detail.acceptedHealthCharterAt, ok: !!detail.acceptedHealthCharterAt },
                          { label: "Consentement marketing", date: detail.consentMarketingAt, ok: detail.consentMarketing },
                          { label: "Consentement IA", date: detail.consentAIAt, ok: detail.consentAI },
                        ].map(c => (
                          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0" }}>
                            <span style={{ color: c.ok ? "#16a34a" : "#dc2626", flexShrink: 0 }}>{c.ok ? SVG.check : SVG.x}</span>
                            <span style={{ fontSize: "0.75rem", flex: 1 }}>{c.label}</span>
                            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{fmtDate(c.date)}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <SectionTitle>Tickets</SectionTitle>
                        {(detail.tickets ?? []).length === 0 ? (
                          <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun ticket ouvert.</p>
                        ) : (detail.tickets as any[]).slice(0, 3).map((t: any) => (
                          <div key={t.id} style={{ padding: "0.3rem 0", borderBottom: "1px solid #f8fafc" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontSize: "0.75rem", flex: 1, fontWeight: 500 }}>{t.subject}</span>
                              <StatusBadge status={t.status === "open" ? "Ticket ouvert" : "Actif"} />
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Priorité : {t.priority} · {fmtDate(t.createdAt)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Tab 1: Sécurité ── */}
                  {tab === 1 && (
                    <div>
                      <SectionTitle>Sessions actives</SectionTitle>
                      {(detail.authSessions ?? []).map((s: any) => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #f1f5f9", marginBottom: "0.4rem", background: s.revoked ? "#fef2f2" : "#f8fafc" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "8px", background: s.revoked ? "#fee2e2" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", color: s.revoked ? "#dc2626" : "#2563eb" }}>{SVG.lock}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 500 }}>{s.deviceName || "Appareil inconnu"}</div>
                            <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{s.ip || "—"} · {fmtDateTime(s.lastActiveAt)}</div>
                          </div>
                          <StatusBadge status={s.revoked ? "Inactif" : new Date(s.expiresAt) > new Date() ? "Actif" : "Inactif"} />
                        </div>
                      ))}
                      {detail.authSessions?.length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucune session.</p>}
                      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                        <ActBtn label="Déconnecter tous les appareils" icon={SVG.logout} danger onClick={handleDisconnectAll} />
                      </div>
                      <div style={{ marginTop: "1rem" }}>
                        <SectionTitle>Historique d&apos;activité sensible</SectionTitle>
                        {(detail.accessLogs ?? []).slice(0, 10).map((l: any) => (
                          <div key={l.id} style={{ display: "flex", gap: "0.5rem", padding: "0.25rem 0", borderBottom: "1px solid #f8fafc" }}>
                            <span style={{ fontSize: "0.72rem", color: "#64748b", minWidth: "100px" }}>{fmtDateTime(l.createdAt)}</span>
                            <span style={{ fontSize: "0.72rem", color: "#1e293b" }}>{l.action}</span>
                            <span style={{ fontSize: "0.68rem", color: "#94a3b8", marginLeft: "auto" }}>{l.ip}</span>
                          </div>
                        ))}
                        {detail.accessLogs?.length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucune activité.</p>}
                      </div>
                    </div>
                  )}

                  {/* ── Tab 2: Professionnels liés ── */}
                  {tab === 2 && (
                    <div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                              {["Professionnel", "Spécialité", "Accès", "Statut", "Actions"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.75rem", fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(detail.athletes ?? []).map((a: any) => (
                              <tr key={a.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{a.professionnel?.prenom} {a.professionnel?.nom}</td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>{a.professionnel?.specialite}</td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>—</td>
                                <td style={{ padding: "0.5rem 0.75rem" }}><StatusBadge status={a.status === "active" ? "Actif" : "Inactif"} /></td>
                                <td style={{ padding: "0.5rem 0.75rem" }}>
                                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                    <ActBtn label="Permissions" icon={SVG.eye} onClick={() => handlePermissions(a.id)} />
                                    <ActBtn label="Révoquer" icon={SVG.unlink} danger onClick={() => handleRevoke(a.id, `${a.professionnel?.prenom} ${a.professionnel?.nom}`)} />
                                    <ActBtn label="Renvoyer invitation" icon={SVG.send} onClick={() => showMsg("Invitation renvoyée (simulé).")} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {detail.athletes?.length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8", padding: "0.5rem" }}>Aucun professionnel lié.</p>}
                      </div>
                    </div>
                  )}

                  {/* ── Tab 3: Documents ── */}
                  {tab === 3 && (
                    <div>
                      <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: "8px", padding: "0.6rem 1rem", fontSize: "0.75rem", color: "#854d0e", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {SVG.lock} Contenu masqué — accès au contenu uniquement via mode exceptionnel justifié.
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                            {["Document", "Type", "Date upload", "Statut", "Actions"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.75rem", fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(detail.athleteDocsSent ?? []).map((d: any, i: number) => (
                            <tr key={d.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>Document #{String(i + 1).padStart(3, "0")}</td>
                              <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>{d.documentType ?? "—"}</td>
                              <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>{fmtDate(d.createdAt)}</td>
                              <td style={{ padding: "0.5rem 0.75rem" }}><StatusBadge status={d.deletedAt ? "Inactif" : "Actif"} /></td>
                              <td style={{ padding: "0.5rem 0.75rem" }}>
                                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                  <ActBtn label="Métadonnées" icon={SVG.eye} onClick={() => handleDocMeta(d.id)} />
                                  <ActBtn label="Historique" icon={SVG.history} onClick={() => handleDocHistory(d.id)} />
                                  <ActBtn label="Désactiver" icon={SVG.block} danger onClick={() => handleDisableDoc(d.id)} />
                                  <ActBtn label="Antivirus" icon={SVG.virus} onClick={() => handleScanDoc(d.id)} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {detail.athleteDocsSent?.length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8", padding: "0.5rem" }}>Aucun document.</p>}
                      <div style={{ marginTop: "0.75rem" }}>
                        <ActBtn label="Mode exceptionnel" icon={SVG.alert} danger onClick={handleModeExceptionnel} />
                      </div>
                    </div>
                  )}

                  {/* ── Tab 4: Consentements ── */}
                  {tab === 4 && (
                    <div>
                      <SectionTitle>Consentements globaux</SectionTitle>
                      {[
                        { label: "CGU acceptées", date: detail.acceptedCguAt, ok: !!detail.acceptedCguAt },
                        { label: "Politique de confidentialité acceptée", date: detail.acceptedPrivacyAt, ok: !!detail.acceptedPrivacyAt },
                        { label: "Consentement données santé", date: detail.acceptedHealthCharterAt, ok: !!detail.acceptedHealthCharterAt },
                        { label: "Consentement marketing", date: detail.consentMarketingAt, ok: detail.consentMarketing },
                        { label: "Consentement IA", date: detail.consentAIAt, ok: detail.consentAI },
                      ].map(c => (
                        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0", borderBottom: "1px solid #f8fafc" }}>
                          <span style={{ color: c.ok ? "#16a34a" : "#dc2626", flexShrink: 0 }}>{c.ok ? SVG.check : SVG.x}</span>
                          <span style={{ fontSize: "0.78rem", flex: 1 }}>{c.label}</span>
                          <span style={{ fontSize: "0.7rem", color: c.ok ? "#16a34a" : "#dc2626", fontWeight: 500 }}>{c.ok ? "Accepté" : "Non"}</span>
                          <span style={{ fontSize: "0.68rem", color: "#94a3b8", minWidth: "80px", textAlign: "right" }}>{fmtDate(c.date)}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: "1rem" }}>
                        <SectionTitle>Consentements par professionnel</SectionTitle>
                        {(detail.athleteConsents ?? []).slice(0, 10).map((c: any) => (
                          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", borderBottom: "1px solid #f8fafc" }}>
                            <span style={{ color: c.granted ? "#16a34a" : "#dc2626", flexShrink: 0 }}>{c.granted ? SVG.check : SVG.x}</span>
                            <span style={{ fontSize: "0.75rem", flex: 1 }}>{c.type ?? "Partage"}</span>
                            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{fmtDate(c.createdAt)}</span>
                          </div>
                        ))}
                        {detail.athleteConsents?.length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun consentement enregistré.</p>}
                      </div>
                    </div>
                  )}

                  {/* ── Tab 5: Tickets ── */}
                  {tab === 5 && (
                    <div>
                      <SectionTitle>Tickets support</SectionTitle>
                      {(detail.tickets ?? []).length === 0 ? (
                        <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun ticket.</p>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                              {["Sujet", "Statut", "Priorité", "Agent assigné", "Date"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.75rem", fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(detail.tickets as any[]).map((t: any) => (
                              <tr key={t.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{t.subject}</td>
                                <td style={{ padding: "0.5rem 0.75rem" }}><StatusBadge status={t.status === "open" ? "Ticket ouvert" : "Actif"} /></td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>{t.priority}</td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>{t.assignedTo || "—"}</td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>{fmtDate(t.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* ── Tab 6: Paiements ── */}
                  {tab === 6 && (
                    <div>
                      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "0.5rem 0.75rem", fontSize: "0.72rem", color: "#1d4ed8", marginBottom: "1rem" }}>
                        Aucun détail médical dans la partie paiement.
                      </div>
                      <SectionTitle>Factures</SectionTitle>
                      {(detail.invoices ?? []).length === 0 ? (
                        <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucune facture.</p>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", marginBottom: "1rem" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                              {["ID", "Montant", "Statut", "Échéance"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.75rem", fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(detail.invoices as any[]).map((inv: any) => (
                              <tr key={inv.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748b", fontSize: "0.68rem" }}>{inv.id.slice(0, 8)}…</td>
                                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{((inv.amount ?? 0) / 100).toFixed(2)} €</td>
                                <td style={{ padding: "0.5rem 0.75rem" }}><StatusBadge status={inv.status === "paid" ? "Actif" : "Inactif"} /></td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>{fmtDate(inv.dueDate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <SectionTitle>Paiements</SectionTitle>
                      {(detail.payments ?? []).length === 0 ? (
                        <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun paiement.</p>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                              {["ID", "Montant", "Statut", "Date"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.75rem", fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(detail.payments as any[]).map((p: any) => (
                              <tr key={p.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748b", fontSize: "0.68rem" }}>{p.id.slice(0, 8)}…</td>
                                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{((p.amount ?? 0) / 100).toFixed(2)} €</td>
                                <td style={{ padding: "0.5rem 0.75rem" }}><StatusBadge status={p.status === "paid" ? "Actif" : p.status === "payment_failed" ? "Paiement échoué" : "Inactif"} /></td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>{fmtDate(p.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Toast message ── */}
      {actionMsg && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999,
          background: "#1e293b", color: "#fff", padding: "0.75rem 1.25rem",
          borderRadius: "8px", fontSize: "0.8rem", fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>{actionMsg}</div>
      )}

      {/* ── Permissions modal ── */}
      {permModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setPermModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: "12px", padding: "1.5rem",
            width: "420px", maxHeight: "80vh", overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>Permissions de connexion</h3>
              <button onClick={() => setPermModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.2rem" }}>×</button>
            </div>
            <DRow label="Professionnel" value={`${permModal.connectedPro?.prenom ?? ""} ${permModal.connectedPro?.nom ?? ""}`} accent />
            <DRow label="Spécialité" value={permModal.connectedPro?.specialite ?? "—"} />
            <DRow label="Rôle" value={permModal.role} />
            <DRow label="Statut" value={permModal.status} />
            <DRow label="Scope" value={permModal.scope} />
            <DRow label="Expire le" value={permModal.expiresAt ? fmtDate(permModal.expiresAt) : "Jamais"} />
            <DRow label="Créé le" value={fmtDate(permModal.createdAt)} />
            <div style={{ marginTop: "0.75rem" }}>
              <SectionTitle>Droits d&apos;accès</SectionTitle>
              {[
                { label: "Lire programme", ok: permModal.readProgramme },
                { label: "Lire indicateurs", ok: permModal.readIndicateurs },
                { label: "Lire blessures", ok: permModal.readBlessures },
                { label: "Lire documents", ok: permModal.readDocuments },
                { label: "Écrire notes", ok: permModal.writeNote },
                { label: "Écrire programme", ok: permModal.writeProgramme },
                { label: "Validation", ok: permModal.writeValidation },
              ].map(p => (
                <div key={p.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0" }}>
                  <span style={{ color: p.ok ? "#16a34a" : "#dc2626", flexShrink: 0 }}>{p.ok ? SVG.check : SVG.x}</span>
                  <span style={{ fontSize: "0.78rem" }}>{p.label}</span>
                </div>
              ))}
            </div>
            {permModal.dataScopes && (
              <div style={{ marginTop: "0.5rem" }}>
                <SectionTitle>Scopes données</SectionTitle>
                <pre style={{ fontSize: "0.68rem", background: "#f8fafc", padding: "0.5rem", borderRadius: "6px", overflow: "auto", color: "#64748b" }}>
                  {JSON.stringify(permModal.dataScopes, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Document metadata modal ── */}
      {docMetaModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDocMetaModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", width: "420px", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>Métadonnées du document</h3>
              <button onClick={() => setDocMetaModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.2rem" }}>×</button>
            </div>
            <DRow label="Nom original" value={docMetaModal.originalName} />
            <DRow label="Fichier" value={docMetaModal.filename} />
            <DRow label="Type MIME" value={docMetaModal.mimeType} />
            <DRow label="Taille" value={`${((docMetaModal.size ?? 0) / 1024).toFixed(1)} Ko`} />
            <DRow label="Catégorie" value={docMetaModal.category} />
            <DRow label="Note" value={docMetaModal.note ?? "—"} />
            <DRow label="Version" value={String(docMetaModal.currentVersion ?? 1)} />
            <DRow label="Envoyé par" value={docMetaModal.senderPro ? `${docMetaModal.senderPro.prenom} ${docMetaModal.senderPro.nom} (${docMetaModal.senderPro.specialite})` : "—"} />
            <DRow label="Lu le" value={docMetaModal.readAt ? fmtDateTime(docMetaModal.readAt) : "Non lu"} />
            <DRow label="Créé le" value={fmtDateTime(docMetaModal.createdAt)} />
            <DRow label="Modifié le" value={fmtDateTime(docMetaModal.updatedAt)} />
            {docMetaModal.deletedAt && <DRow label="Désactivé le" value={fmtDateTime(docMetaModal.deletedAt)} accent />}
            {docMetaModal.deletedBy && <DRow label="Désactivé par" value={docMetaModal.deletedBy} />}
          </div>
        </div>
      )}

      {/* ── Document history modal ── */}
      {docHistoryModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDocHistoryModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", width: "420px", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>Historique des versions</h3>
              <button onClick={() => setDocHistoryModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.2rem" }}>×</button>
            </div>
            {docHistoryModal.length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucune version enregistrée.</p>}
            {docHistoryModal.map((v: any) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#2563eb", minWidth: "30px" }}>v{v.versionNumber}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem" }}>{v.filename}</div>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{((v.size ?? 0) / 1024).toFixed(1)} Ko · {fmtDateTime(v.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Confirm modal ── */}
      {confirmModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)" }} onClick={() => setConfirmModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", width: "420px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: "10px", background: confirmModal.danger ? "#fee2e2" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={confirmModal.danger ? "#dc2626" : "#2563eb"} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{confirmModal.title}</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Action administrative</div>
              </div>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.6, marginBottom: "1rem" }}>{confirmModal.message}</p>
            {confirmModal.withReason && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "0.3rem" }}>{confirmModal.reasonLabel ?? "Raison (optionnel)"}</label>
                <input value={modalReason} onChange={e => setModalReason(e.target.value)} placeholder="Précisez la raison..." style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", outline: "none" }} autoFocus />
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.78rem", cursor: "pointer", fontWeight: 500, color: "#475569" }}>Annuler</button>
              <button disabled={confirmModal.reasonRequired && !modalReason.trim()} onClick={() => confirmModal.onConfirm(modalReason || undefined)} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "none", background: confirmModal.danger ? "#dc2626" : "#2563eb", color: "#fff", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600, opacity: confirmModal.reasonRequired && !modalReason.trim() ? 0.5 : 1 }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
