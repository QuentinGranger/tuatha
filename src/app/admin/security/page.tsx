"use client";
import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Constants ─── */
const ALERT_TYPES = [
  "Connexion suspecte", "Bruteforce", "Login bloqué", "Login bloqué (répété)",
  "Téléchargement massif", "Accès pro inhabituel", "Accès admin inhabituel",
  "Tentative IDOR", "Export inhabituel", "Suppression suspecte",
  "Trop d'erreurs 403", "Nouveau pays connexion", "Reset mot de passe", "Mot de passe modifié",
];

const SEVERITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  critique: { bg: "#fee2e2", color: "#dc2626", label: "CRITIQUE" },
  eleve: { bg: "#fef3c7", color: "#d97706", label: "Élevé" },
  moyen: { bg: "#dbeafe", color: "#2563eb", label: "Moyen" },
  faible: { bg: "#f1f5f9", color: "#64748b", label: "Faible" },
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  unresolved: { bg: "#fef3c7", color: "#d97706", label: "À analyser" },
  resolved: { bg: "#dcfce7", color: "#16a34a", label: "Clôturé" },
  in_progress: { bg: "#dbeafe", color: "#2563eb", label: "En cours" },
};

const ACCOUNT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "#16a34a" },
  suspended: { label: "Suspendu", color: "#dc2626" },
  restricted: { label: "Restreint", color: "#d97706" },
  compliance_review: { label: "Revue conformité", color: "#2563eb" },
  draft: { label: "Brouillon", color: "#64748b" },
  deleted: { label: "Supprimé", color: "#94a3b8" },
};

/* ─── SVG Icons ─── */
const SVG = {
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  lock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  unlock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>,
  block: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  key: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  logout: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  clipboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  incident: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  history: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
};

/* ─── Helper Components ─── */
function Stat({ icon, label, value, change, color }: { icon: React.ReactNode; label: string; value: string | number; change?: string; color: string }) {
  const isPositive = change?.startsWith("+") || change?.startsWith("▲");
  const isNegative = change?.startsWith("-") || change?.startsWith("▼");
  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "0.9rem 1rem", flex: 1, minWidth: "120px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
        <span style={{ color, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1e293b" }}>{value}</div>
      {change && <div style={{ fontSize: "0.62rem", fontWeight: 600, color: isNegative ? "#16a34a" : isPositive ? "#ef4444" : "#64748b", marginTop: "2px" }}>{change}</div>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.faible;
  return <span style={{ background: s.bg, color: s.color, fontSize: "0.6rem", fontWeight: 700, padding: "2px 8px", borderRadius: "9999px", whiteSpace: "nowrap" }}>{s.label}</span>;
}

function StatusBadge({ resolved }: { resolved: boolean }) {
  const s = resolved ? STATUS_STYLES.resolved : STATUS_STYLES.unresolved;
  return <span style={{ background: s.bg, color: s.color, fontSize: "0.6rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", whiteSpace: "nowrap" }}>{s.label}</span>;
}

function AccountStatusBadge({ status }: { status: string }) {
  const s = ACCOUNT_STATUS_LABELS[status] ?? { label: status, color: "#64748b" };
  return <span style={{ fontSize: "0.6rem", fontWeight: 600, color: s.color }}>{s.label}</span>;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: "9999px", fontSize: "0.65rem", fontWeight: 500,
      border: active ? "1px solid #dc2626" : "1px solid #e2e8f0",
      background: active ? "#fee2e2" : "#f8fafc",
      color: active ? "#dc2626" : "#64748b",
      cursor: "pointer", whiteSpace: "nowrap",
    }}>{label}</button>
  );
}

function ActionBtn({ label, icon, danger, success, disabled, onClick }: { label: string; icon?: React.ReactNode; danger?: boolean; success?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: "0.4rem",
      padding: "0.4rem 0.75rem", borderRadius: "7px", fontSize: "0.7rem", fontWeight: 600,
      border: danger ? "1px solid #dc2626" : success ? "1px solid #16a34a" : "1px solid #e2e8f0",
      background: danger ? "#fee2e2" : success ? "#dcfce7" : "#f8fafc",
      color: danger ? "#dc2626" : success ? "#16a34a" : "#475569",
      cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      opacity: disabled ? 0.5 : 1,
    }}>{icon}{label}</button>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", borderBottom: "1px solid #f8fafc" }}>
      <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: accent ? 600 : 400, color: accent ? "#1e293b" : "#475569" }}>{value}</span>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel, note, setNote, showNote }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
  note: string; setNote: (v: string) => void; showNote: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", maxWidth: "400px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: "0 0 1rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5 }}>{message}</p>
        {showNote && (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note optionnelle (raison, contexte...)"
            style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.75rem", resize: "vertical", minHeight: "60px", marginBottom: "1rem", outline: "none", fontFamily: "inherit" }}
          />
        )}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.75rem", cursor: "pointer", color: "#475569" }}>Annuler</button>
          <button onClick={onConfirm} style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #dc2626", background: "#fee2e2", fontSize: "0.75rem", cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtTimeAgo(d: string | null | undefined) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}

/* ─── Main Page ─── */
export default function SecurityPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");
  const [showFilters, setShowFilters] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; action: string; showNote: boolean } | null>(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const PER_PAGE = 12;

  const reloadList = useCallback(() => {
    fetch("/api/admin/security")
      .then(r => r.json())
      .then(d => { setData(d); setLastRefresh(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reloadList(); }, [reloadList]);

  useEffect(() => {
    if (autoRefresh) {
      refreshInterval.current = setInterval(reloadList, 30000);
    }
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  }, [autoRefresh, reloadList]);

  const loadDetail = useCallback((alert: any) => {
    setSelected(alert);
    setDetailLoading(true);
    fetch(`/api/admin/security?id=${alert.id}`)
      .then(r => r.json())
      .then(setDetail)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, []);

  const showMsg = (msg: string, isError?: boolean) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 4000);
  };

  const callAction = async (payload: Record<string, string>) => {
    const r = await fetch("/api/admin/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.json();
  };

  const requestAction = (actionName: string, title: string, message: string, showNote = true) => {
    setConfirmModal({ title, message, action: actionName, showNote });
    setConfirmNote("");
  };

  const executeAction = async () => {
    if (!detail || !confirmModal) return;
    setActionLoading(true);
    try {
      const d = await callAction({ action: confirmModal.action, alertId: detail.id, proId: detail.professionnelId, note: confirmNote });
      if (d.success) { showMsg(d.message); reloadList(); if (selected) loadDetail(selected); }
      else showMsg(`Erreur : ${d.error}`, true);
    } catch { showMsg("Erreur réseau.", true); }
    setActionLoading(false);
    setConfirmModal(null);
  };

  const quickResolve = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const d = await callAction({ action: "resolve", alertId, proId: "" });
      if (d.success) { showMsg("Alerte clôturée."); reloadList(); }
      else showMsg(`Erreur : ${d.error}`, true);
    } catch { showMsg("Erreur réseau.", true); }
  };

  const toggleFilter = (f: string) => {
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
    setPage(1);
  };

  // Filter alerts
  const allAlerts = data?.alerts ?? [];
  const filtered = allAlerts.filter((a: any) => {
    // Status filter
    if (statusFilter === "unresolved" && a.resolved) return false;
    if (statusFilter === "resolved" && !a.resolved) return false;
    // Search
    const q = search.toLowerCase();
    const matchSearch = !q || a.userName?.toLowerCase().includes(q) || a.typeLabel?.toLowerCase().includes(q) || a.message?.toLowerCase().includes(q);
    if (!matchSearch) return false;
    // Type filter
    if (activeFilters.length === 0) return true;
    return activeFilters.includes(a.typeLabel);
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const stats = data?.stats ?? {};
  const accountStatus = detail?.professionnel?.accountStatus ?? "active";
  const isAccountLocked = accountStatus === "suspended" || accountStatus === "restricted" || accountStatus === "compliance_review";

  return (
    <div style={{ color: "#1e293b" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.02em" }}>Sécurité</h1>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>Centre de surveillance et réponse aux incidents</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Rafraîchi {fmtTimeAgo(lastRefresh.toISOString())}</span>
          <button onClick={reloadList} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.6rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "0.68rem", color: "#475569", cursor: "pointer" }}>
            {SVG.refresh} Rafraîchir
          </button>
          <button
            onClick={() => setAutoRefresh(v => !v)}
            style={{ padding: "0.35rem 0.6rem", borderRadius: "7px", border: autoRefresh ? "1px solid #16a34a" : "1px solid #e2e8f0", background: autoRefresh ? "#dcfce7" : "#fff", fontSize: "0.68rem", color: autoRefresh ? "#16a34a" : "#64748b", cursor: "pointer", fontWeight: 500 }}
          >
            {autoRefresh ? "● Auto 30s" : "○ Auto off"}
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="admin-stats-row" style={{ marginBottom: "1.25rem" }}>
        <Stat icon={SVG.alert} label="Alertes critiques" value={loading ? "..." : stats.criticalAlerts ?? 0} change={stats.criticalChange > 0 ? `▲ ${Math.abs(stats.criticalChange)} vs hier` : stats.criticalChange < 0 ? `▼ ${Math.abs(stats.criticalChange)} vs hier` : undefined} color="#ef4444" />
        <Stat icon={SVG.key} label="Tentatives login échouées" value={loading ? "..." : stats.failedLogins ?? 0} change={stats.loginsChange > 0 ? `▲ ${Math.abs(stats.loginsChange)} vs hier` : stats.loginsChange < 0 ? `▼ ${Math.abs(stats.loginsChange)} vs hier` : undefined} color="#f97316" />
        <Stat icon={SVG.lock} label="Comptes verrouillés" value={loading ? "..." : stats.lockedAccounts ?? 0} color="#8b5cf6" />
        <Stat icon={SVG.block} label="Accès refusés (24h)" value={loading ? "..." : stats.accessDenied ?? 0} color="#06b6d4" />
        <Stat icon={SVG.clipboard} label="Exports données (24h)" value={loading ? "..." : stats.dataExports ?? 0} color="#22c55e" />
        <Stat icon={SVG.download} label="DL massifs non résolus" value={loading ? "..." : stats.massDownloads ?? 0} color="#f59e0b" />
        <Stat icon={SVG.shield} label="Actions admin (24h)" value={loading ? "..." : stats.adminActions ?? 0} color="#64748b" />
      </div>

      {/* Main layout: table + detail */}
      <div className="admin-detail-layout" style={{ alignItems: "flex-start" }}>
        {/* ── Left: Alerts table ── */}
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {/* Title + search */}
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <h2 style={{ fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>Alertes sécurité</h2>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button onClick={() => setShowFilters(v => !v)} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.6rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.68rem", color: "#475569", cursor: "pointer" }}>
                  {SVG.filter} Filtres
                </button>
                <button onClick={() => { setActiveFilters([]); setSearch(""); setPage(1); setStatusFilter("unresolved"); }} style={{ padding: "0.3rem 0.6rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.68rem", color: "#475569", cursor: "pointer" }}>
                  Réinitialiser
                </button>
              </div>
            </div>
            {/* Status tabs */}
            <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.6rem" }}>
              {([["unresolved", "À traiter", stats.totalUnresolved], ["all", "Toutes", allAlerts.length], ["resolved", "Clôturées", allAlerts.filter((a: any) => a.resolved).length]] as const).map(([key, label, count]) => (
                <button key={key} onClick={() => { setStatusFilter(key as any); setPage(1); }} style={{
                  padding: "0.3rem 0.7rem", borderRadius: "7px", fontSize: "0.68rem", fontWeight: statusFilter === key ? 600 : 400,
                  border: statusFilter === key ? "1px solid #2563eb" : "1px solid #e2e8f0",
                  background: statusFilter === key ? "#eff6ff" : "#fff",
                  color: statusFilter === key ? "#2563eb" : "#64748b",
                  cursor: "pointer",
                }}>{label} ({count ?? 0})</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.35rem 0.6rem", marginBottom: showFilters ? "0.6rem" : 0 }}>
              <span style={{ color: "#94a3b8" }}>{SVG.search}</span>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher par type, utilisateur ou message..." style={{ flex: 1, border: "none", outline: "none", fontSize: "0.75rem", background: "transparent", color: "#1e293b" }} />
            </div>
            {/* Filter chips */}
            {showFilters && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {ALERT_TYPES.map(f => <Chip key={f} label={f} active={activeFilters.includes(f)} onClick={() => toggleFilter(f)} />)}
              </div>
            )}
          </div>

          {/* Table headers */}
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 1.5fr 90px 70px 120px", gap: "0", padding: "0.4rem 0.75rem", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
            {["Gravité", "Type", "Utilisateur", "Message", "Date", "Statut", "Action"].map(h => (
              <span key={h} style={{ fontSize: "0.6rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: "calc(100vh - 520px)", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Chargement...</div>
            ) : paged.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Aucune alerte trouvée.</div>
            ) : paged.map((a: any) => (
              <div
                key={a.id}
                onClick={() => loadDetail(a)}
                style={{
                  display: "grid", gridTemplateColumns: "70px 1fr 1fr 1.5fr 90px 70px 120px",
                  padding: "0.5rem 0.75rem", cursor: "pointer",
                  borderBottom: "1px solid #f8fafc",
                  background: selected?.id === a.id ? "#eff6ff" : "transparent",
                  borderLeft: selected?.id === a.id ? "2px solid #2563eb" : "2px solid transparent",
                  alignItems: "center",
                }}
              >
                <span><SeverityBadge severity={a.severity} /></span>
                <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.typeLabel}</span>
                <span style={{ fontSize: "0.7rem", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.userName}</span>
                <span style={{ fontSize: "0.68rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.message?.slice(0, 50)}{a.message?.length > 50 ? "…" : ""}</span>
                <span style={{ fontSize: "0.65rem", color: "#64748b" }}>{fmtTimeAgo(a.createdAt)}</span>
                <span><StatusBadge resolved={a.resolved} /></span>
                <span style={{ display: "flex", gap: "0.25rem" }}>
                  {!a.resolved ? (
                    <>
                      <button onClick={e => { e.stopPropagation(); loadDetail(a); }} style={{ fontSize: "0.6rem", padding: "3px 6px", borderRadius: "6px", border: "1px solid #2563eb", background: "#dbeafe", color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>Analyser</button>
                      <button onClick={e => quickResolve(a.id, e)} style={{ fontSize: "0.6rem", padding: "3px 6px", borderRadius: "6px", border: "1px solid #16a34a", background: "#dcfce7", color: "#16a34a", cursor: "pointer", fontWeight: 600 }}>Clore</button>
                    </>
                  ) : (
                    <span style={{ fontSize: "0.62rem", color: "#16a34a", fontWeight: 500 }}>{SVG.check} {fmtTimeAgo(a.resolvedAt)}</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem", color: "#94a3b8" }}>
            <span>{filtered.length} alerte{filtered.length > 1 ? "s" : ""} · page {page}/{totalPages || 1}</span>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page <= 1 ? "#f8fafc" : "#fff", cursor: page <= 1 ? "default" : "pointer", fontSize: "0.68rem", color: "#475569", opacity: page <= 1 ? 0.5 : 1 }}>&lt;</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{ padding: "3px 8px", borderRadius: "6px", border: page === p ? "1px solid #2563eb" : "1px solid #e2e8f0", background: page === p ? "#2563eb" : "#fff", color: page === p ? "#fff" : "#475569", fontSize: "0.68rem", cursor: "pointer", fontWeight: page === p ? 600 : 400 }}>{p}</button>
              ))}
              {totalPages > 5 && <span style={{ padding: "3px 4px" }}>…</span>}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page >= totalPages ? "#f8fafc" : "#fff", cursor: page >= totalPages ? "default" : "pointer", fontSize: "0.68rem", color: "#475569", opacity: page >= totalPages ? 0.5 : 1 }}>&gt;</button>
            </div>
          </div>

          {/* Platform status footer */}
          <div style={{ padding: "0.6rem 1rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: (stats.criticalAlerts ?? 0) === 0 ? "#22c55e" : "#ef4444", animation: (stats.criticalAlerts ?? 0) > 0 ? "pulse 2s infinite" : "none" }} />
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: (stats.criticalAlerts ?? 0) === 0 ? "#16a34a" : "#dc2626" }}>
              {(stats.criticalAlerts ?? 0) === 0 ? "Plateforme saine" : `${stats.criticalAlerts} alerte(s) critique(s) non résolue(s)`}
            </span>
            <span style={{ fontSize: "0.65rem", color: "#94a3b8", marginLeft: "auto" }}>
              {stats.totalUnresolved ?? 0} total non résolu(s)
            </span>
          </div>
        </div>

        {/* ── Right: Detail panel ── */}
        {!selected ? (
          <div style={{ flex: 1, background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", color: "#94a3b8" }}>
            <span style={{ marginBottom: "0.75rem", opacity: 0.4 }}>{SVG.shield}</span>
            <p style={{ fontSize: "0.82rem", margin: "0 0 0.3rem" }}>Sélectionner une alerte pour voir les détails</p>
            <p style={{ fontSize: "0.7rem", margin: 0, color: "#cbd5e1" }}>{filtered.filter((a: any) => !a.resolved).length} alerte(s) à traiter</p>
          </div>
        ) : (
          <div style={{ flex: 1, background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {/* Detail header */}
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: SEVERITY_STYLES[selected.severity]?.bg ?? "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: SEVERITY_STYLES[selected.severity]?.color ?? "#64748b" }}>{SVG.alert}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{selected.typeLabel}</span>
                    <SeverityBadge severity={selected.severity} />
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                    {selected.userName} · {fmtDateTime(selected.createdAt)}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                  <StatusBadge resolved={selected.resolved} />
                  {!selected.resolved && (
                    <button onClick={() => requestAction("resolve", "Clore l'alerte", "Voulez-vous marquer cette alerte comme traitée et clôturée ?", true)} style={{ fontSize: "0.62rem", padding: "3px 8px", borderRadius: "6px", border: "1px solid #16a34a", background: "#dcfce7", color: "#16a34a", cursor: "pointer", fontWeight: 600 }}>Clore l&apos;alerte</button>
                  )}
                </div>
              </div>
            </div>

            {/* Detail content */}
            <div style={{ padding: "1rem 1.25rem", overflowY: "auto", maxHeight: "calc(100vh - 400px)" }}>
              {detailLoading ? (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "2rem", fontSize: "0.8rem" }}>Chargement...</div>
              ) : !detail ? null : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                  {/* Context */}
                  <div>
                    <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem", color: "#1e293b" }}>Contexte de l&apos;alerte</h4>
                    <InfoRow label="Type" value={detail.typeLabel} accent />
                    <InfoRow label="Message" value={detail.message?.slice(0, 60) ?? "—"} />
                    <InfoRow label="IP" value={detail.ip ?? "Non capturée"} />
                    <InfoRow label="User-Agent" value={detail.userAgent ? detail.userAgent.slice(0, 35) : "Non capturé"} />
                    <InfoRow label="Créée le" value={fmtDateTime(detail.createdAt)} />
                    <InfoRow label="Statut" value={detail.resolved ? `Résolu le ${fmtDateTime(detail.resolvedAt)}` : "Actif"} accent />
                  </div>

                  {/* User info */}
                  <div>
                    <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem", color: "#1e293b" }}>Professionnel concerné</h4>
                    <InfoRow label="Nom" value={detail.professionnel ? `${detail.professionnel.prenom} ${detail.professionnel.nom}` : "—"} accent />
                    <InfoRow label="Email" value={detail.professionnel?.email ?? "—"} />
                    <InfoRow label="Spécialité" value={detail.professionnel?.specialite ?? "—"} />
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", borderBottom: "1px solid #f8fafc" }}>
                      <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Statut compte</span>
                      <AccountStatusBadge status={accountStatus} />
                    </div>
                    <InfoRow label="Sessions actives" value={String(detail.recentSessions?.filter((s: any) => !s.revoked).length ?? 0)} accent />
                    <InfoRow label="Alertes associées" value={`${(detail.relatedAlerts?.length ?? 0) + 1} au total`} accent={(detail.relatedAlerts?.length ?? 0) > 2} />
                  </div>

                  {/* Quick actions */}
                  <div>
                    <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem", color: "#1e293b" }}>Actions rapides</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {isAccountLocked ? (
                        <ActionBtn label="Débloquer le compte" icon={SVG.unlock} success onClick={() => requestAction("unlock_account", "Débloquer le compte", `Remettre le compte en statut "actif" ? (actuellement: ${ACCOUNT_STATUS_LABELS[accountStatus]?.label ?? accountStatus})`, true)} />
                      ) : (
                        <ActionBtn label="Verrouiller compte" icon={SVG.lock} danger onClick={() => requestAction("lock_account", "Verrouiller le compte", "Le compte sera suspendu et toutes les sessions seront révoquées. L'utilisateur ne pourra plus se connecter.", true)} />
                      )}
                      <ActionBtn label="Déconnecter les sessions" icon={SVG.logout} danger onClick={() => requestAction("disconnect_sessions", "Déconnecter toutes les sessions", "Toutes les sessions actives seront révoquées. L'utilisateur devra se reconnecter.", false)} />
                      <ActionBtn label="Restreindre le compte" icon={SVG.block} danger disabled={accountStatus === "restricted"} onClick={() => requestAction("restrict_account", "Restreindre le compte", "Le compte passera en mode restreint. L'utilisateur gardera un accès limité.", true)} />
                      <ActionBtn label="Forcer reset mot de passe" icon={SVG.key} onClick={() => requestAction("force_reset_password", "Forcer le reset du mot de passe", "Sessions révoquées et alerte créée. L'utilisateur devra changer son mot de passe à la reconnexion.", false)} />
                      <ActionBtn label="Revue conformité" icon={SVG.clipboard} disabled={accountStatus === "compliance_review"} onClick={() => requestAction("compliance_review", "Activer la revue de conformité", "Le compte sera marqué comme en revue de conformité.", true)} />
                      <ActionBtn label="Ouvrir un incident" icon={SVG.incident} onClick={() => requestAction("open_incident", "Ouvrir un incident", "Un dossier d'investigation sera créé et lié à ce professionnel.", true)} />
                    </div>
                  </div>

                  {/* Activity */}
                  <div>
                    <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem", color: "#1e293b" }}>Sessions récentes</h4>
                    {(detail.recentSessions ?? []).slice(0, 5).map((s: any) => (
                      <div key={s.id} style={{ display: "flex", gap: "0.5rem", padding: "0.25rem 0", borderBottom: "1px solid #f8fafc", alignItems: "center" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.revoked ? "#94a3b8" : "#22c55e", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.68rem", color: "#475569", flex: 1 }}>{s.deviceName ?? "Session inconnue"}</span>
                        <span style={{ fontSize: "0.6rem", color: s.revoked ? "#dc2626" : "#94a3b8" }}>{s.revoked ? "Révoquée" : fmtTimeAgo(s.lastActiveAt)}</span>
                      </div>
                    ))}
                    {(detail.recentSessions ?? []).length === 0 && <p style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Aucune session trouvée.</p>}
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem", color: "#1e293b" }}>Recommandation système</h4>
                    <div style={{ fontSize: "0.72rem", color: "#475569", lineHeight: 1.8 }}>
                      {detail.severity === "critique" && (
                        <>
                          <div style={{ color: "#dc2626", fontWeight: 600 }}>⚠ Action immédiate requise</div>
                          <div>• Verrouiller le compte immédiatement</div>
                          <div>• Ouvrir un incident sécurité</div>
                          <div>• Notifier le DPO si données compromises</div>
                        </>
                      )}
                      {detail.severity === "eleve" && (
                        <>
                          <div style={{ color: "#d97706", fontWeight: 600 }}>⚡ Surveillance renforcée</div>
                          <div>• Vérifier les sessions et exports récents</div>
                          <div>• Restreindre le compte si récidive</div>
                          <div>• Forcer un reset mot de passe</div>
                        </>
                      )}
                      {detail.severity === "moyen" && (
                        <>
                          <div style={{ color: "#2563eb", fontWeight: 600 }}>📋 À surveiller</div>
                          <div>• Surveiller l&apos;activité sur 48h</div>
                          <div>• Vérifier si comportement légitime</div>
                        </>
                      )}
                      {detail.severity === "faible" && (
                        <>
                          <div style={{ color: "#64748b", fontWeight: 600 }}>ℹ Information</div>
                          <div>• Aucune action urgente requise</div>
                          <div>• Peut être clôturé directement</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Resolution status */}
                  <div>
                    <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem", color: "#1e293b" }}>Traitement</h4>
                    <InfoRow label="Assigné à" value={detail.resolvedBy ?? "Non assigné"} />
                    <InfoRow label="Gravité" value={SEVERITY_STYLES[detail.severity]?.label ?? "—"} accent />
                    {detail.resolvedAt && <InfoRow label="Résolu le" value={fmtDateTime(detail.resolvedAt)} />}
                    {detail.resolvedBy && <InfoRow label="Par" value={detail.resolvedBy} accent />}
                  </div>

                  {/* Related alerts */}
                  {(detail.relatedAlerts ?? []).length > 0 && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem", color: "#1e293b" }}>Historique alertes (même professionnel)</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {(detail.relatedAlerts as any[]).map((ra: any) => (
                          <div key={ra.id} onClick={() => loadDetail(ra)} style={{ padding: "0.4rem 0.6rem", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "0.68rem", background: "#f8fafc", cursor: "pointer", transition: "border-color 0.15s" }}>
                            <SeverityBadge severity={ra.severity} />
                            <span style={{ marginLeft: "0.4rem", color: "#475569" }}>{ra.typeLabel}</span>
                            <span style={{ marginLeft: "0.4rem", color: "#94a3b8" }}>{fmtTimeAgo(ra.createdAt)}</span>
                            {ra.resolved && <span style={{ marginLeft: "0.3rem", color: "#16a34a" }}>{SVG.check}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={executeAction}
          onCancel={() => setConfirmModal(null)}
          note={confirmNote}
          setNote={setConfirmNote}
          showNote={confirmModal.showNote}
        />
      )}

      {/* Toast */}
      {actionMsg && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999,
          background: "#1e293b", color: "#fff", padding: "0.75rem 1.25rem",
          borderRadius: "8px", fontSize: "0.8rem", fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          <span style={{ color: "#22c55e" }}>{SVG.check}</span>
          {actionMsg}
        </div>
      )}
    </div>
  );
}
