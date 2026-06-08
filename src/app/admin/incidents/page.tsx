"use client";
import { useState, useEffect, useCallback } from "react";

/* ─── Constants ─── */
const SEVERITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: "#fee2e2", color: "#dc2626", label: "Critique" },
  high: { bg: "#fef3c7", color: "#d97706", label: "Élevée" },
  medium: { bg: "#dbeafe", color: "#2563eb", label: "Modérée" },
  low: { bg: "#f1f5f9", color: "#64748b", label: "Faible" },
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: "#fef3c7", color: "#d97706", label: "En analyse" },
  in_progress: { bg: "#dbeafe", color: "#2563eb", label: "En cours" },
  pending_info: { bg: "#f3e8ff", color: "#7c3aed", label: "Info requise" },
  closed_resolved: { bg: "#dcfce7", color: "#16a34a", label: "Clôturé" },
  closed_unfounded: { bg: "#f1f5f9", color: "#64748b", label: "Infondé" },
};

const TABS = ["Résumé", "Timeline", "Utilisateurs", "Données", "Décisions", "Documents", "Post-mortem"];

/* ─── SVG Icons ─── */
const SVG = {
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  file: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  send: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
};

/* ─── Helpers ─── */
function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function cnilDeadline(createdAt: string) {
  const d = new Date(createdAt);
  d.setHours(d.getHours() + 72);
  const remaining = d.getTime() - Date.now();
  if (remaining <= 0) return { label: "Dépassée", color: "#dc2626" };
  const h = Math.floor(remaining / 3600000);
  return { label: `${h}h restantes`, color: h < 24 ? "#d97706" : "#16a34a" };
}

/* ─── Sub-components ─── */
function Stat({ icon, label, value, change, color }: { icon: React.ReactNode; label: string; value: string | number; change?: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "0.9rem 1rem", flex: 1, minWidth: "110px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
        <span style={{ color, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1e293b" }}>{value}</div>
      {change && <div style={{ fontSize: "0.6rem", fontWeight: 600, color: change.startsWith("▼") ? "#16a34a" : "#ef4444", marginTop: "2px" }}>{change}</div>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low;
  return <span style={{ background: s.bg, color: s.color, fontSize: "0.6rem", fontWeight: 700, padding: "2px 8px", borderRadius: "9999px", whiteSpace: "nowrap" }}>{s.label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.open;
  return <span style={{ background: s.bg, color: s.color, fontSize: "0.6rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", whiteSpace: "nowrap" }}>{s.label}</span>;
}

function Chip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: "9999px", fontSize: "0.65rem", fontWeight: 600,
      border: active ? `1px solid ${color ?? "#2563eb"}` : "1px solid #e2e8f0",
      background: active ? (color ? `${color}15` : "#eff6ff") : "#f8fafc",
      color: active ? (color ?? "#2563eb") : "#64748b",
      cursor: "pointer", whiteSpace: "nowrap",
    }}>{label}</button>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid #f8fafc" }}>
      <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: accent ? 600 : 400, color: accent ? "#1e293b" : "#475569" }}>{value}</span>
    </div>
  );
}

/* ─── Main Page ─── */
export default function IncidentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("Résumé");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [newIncident, setNewIncident] = useState({ title: "", description: "", severity: "medium", type: "security", affectedData: "", affectedUsersCount: "0" });
  const [timelineInput, setTimelineInput] = useState("");
  const [postMortemInput, setPostMortemInput] = useState("");
  const PER_PAGE = 10;

  const reloadList = useCallback(() => {
    fetch("/api/admin/incidents")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reloadList(); }, [reloadList]);

  const loadDetail = useCallback((incident: any) => {
    setSelected(incident);
    setDetailLoading(true);
    setActiveTab("Résumé");
    fetch(`/api/admin/incidents?id=${incident.id}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setPostMortemInput(d.metadata?.postMortem ?? ""); })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, []);

  const showMsg = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(null), 4000); };

  const callAction = async (payload: Record<string, any>) => {
    const r = await fetch("/api/admin/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.json();
  };

  const handleCreate = async () => {
    const d = await callAction({
      action: "create",
      title: newIncident.title,
      description: newIncident.description,
      severity: newIncident.severity,
      type: newIncident.type,
      affectedData: newIncident.affectedData.split(",").map(s => s.trim()).filter(Boolean),
      affectedUsersCount: parseInt(newIncident.affectedUsersCount) || 0,
    });
    if (d.success) { showMsg(d.message); setShowCreate(false); reloadList(); setNewIncident({ title: "", description: "", severity: "medium", type: "security", affectedData: "", affectedUsersCount: "0" }); }
    else showMsg(`Erreur: ${d.error}`);
  };

  const handleAction = async (actionName: string, payload: Record<string, any> = {}) => {
    if (!detail) return;
    const d = await callAction({ action: actionName, incidentId: detail.id, ...payload });
    if (d.success) { showMsg(d.message); reloadList(); loadDetail(selected); }
    else showMsg(`Erreur: ${d.error}`);
  };

  // Filter
  const incidents = data?.incidents ?? [];
  const filtered = incidents.filter((i: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.title?.toLowerCase().includes(q) || i.incidentId?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (severityFilter.length > 0 && !severityFilter.includes(i.severity)) return false;
    if (statusFilter.length > 0 && !statusFilter.includes(i.status)) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const stats = data?.stats ?? {};

  // Timeline parsing
  const timeline = (detail?.metadata?.timeline ?? []).map((entry: string) => {
    const [ts, ...rest] = entry.split("|");
    return { time: ts, event: rest.join("|") };
  }).reverse();

  return (
    <div style={{ color: "#1e293b" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.02em" }}>Incidents</h1>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>Gérer une violation ou suspicion de violation de données</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #dc2626", background: "#fee2e2", color: "#dc2626", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
          {SVG.plus} Nouvel incident
        </button>
      </div>

      {/* KPI Stats */}
      <div className="admin-stats-row" style={{ marginBottom: "1.25rem" }}>
        <Stat icon={SVG.alert} label="Incidents actifs" value={loading ? "..." : stats.activeCount ?? 0} change={stats.activeChange > 0 ? `▲ ${stats.activeChange} vs hier` : undefined} color="#ef4444" />
        <Stat icon={SVG.shield} label="Incidents critiques" value={loading ? "..." : stats.criticalCount ?? 0} color="#dc2626" />
        <Stat icon={SVG.users} label="Utilisateurs touchés" value={loading ? "..." : stats.totalAffectedUsers ?? 0} color="#f97316" />
        <Stat icon={SVG.bell} label="Notif. CNIL à décider" value={loading ? "..." : stats.cnilPending ?? 0} color="#7c3aed" />
        <Stat icon={SVG.send} label="Notif. utilisateurs" value={loading ? "..." : stats.userNotifPending ?? 0} color="#2563eb" />
        <Stat icon={SVG.clock} label="Résolution moy." value={loading ? "..." : stats.avgResolutionHours ? `${stats.avgResolutionHours}h` : "—"} color="#64748b" />
      </div>

      {/* Main layout */}
      <div className="admin-detail-layout" style={{ alignItems: "flex-start" }}>
        {/* ── Left: Table ── */}
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {/* Search + filters */}
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h2 style={{ fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>Incidents actifs</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.35rem 0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ color: "#94a3b8" }}>{SVG.search}</span>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher un incident, titre, ID..." style={{ flex: 1, border: "none", outline: "none", fontSize: "0.75rem", background: "transparent", color: "#1e293b" }} />
            </div>
            {/* Severity chips */}
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "0.4rem" }}>
              <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600, lineHeight: "22px" }}>Gravité</span>
              {Object.entries(SEVERITY_STYLES).map(([key, s]) => (
                <Chip key={key} label={s.label} active={severityFilter.includes(key)} color={s.color} onClick={() => { setSeverityFilter(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]); setPage(1); }} />
              ))}
            </div>
            {/* Status chips */}
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600, lineHeight: "22px" }}>Statut</span>
              {Object.entries(STATUS_STYLES).map(([key, s]) => (
                <Chip key={key} label={s.label} active={statusFilter.includes(key)} color={s.color} onClick={() => { setStatusFilter(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]); setPage(1); }} />
              ))}
            </div>
          </div>

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "90px 1.5fr 65px 1fr 55px 75px 90px 80px", gap: "0", padding: "0.4rem 0.75rem", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
            {["ID", "Titre", "Gravité", "Données", "Touchés", "Statut", "Responsable", "Date"].map(h => (
              <span key={h} style={{ fontSize: "0.58rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: "calc(100vh - 500px)", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Chargement...</div>
            ) : paged.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Aucun incident trouvé.</div>
            ) : paged.map((inc: any) => (
              <div key={inc.id} onClick={() => loadDetail(inc)} style={{
                display: "grid", gridTemplateColumns: "90px 1.5fr 65px 1fr 55px 75px 90px 80px",
                padding: "0.5rem 0.75rem", cursor: "pointer", borderBottom: "1px solid #f8fafc",
                background: selected?.id === inc.id ? "#eff6ff" : "transparent",
                borderLeft: selected?.id === inc.id ? "2px solid #2563eb" : "2px solid transparent",
                alignItems: "center",
              }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#2563eb" }}>{inc.incidentId}</span>
                <span style={{ fontSize: "0.7rem", fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.title}</span>
                <span><SeverityBadge severity={inc.severity} /></span>
                <span style={{ fontSize: "0.62rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(inc.affectedData ?? []).join(", ") || "—"}</span>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#1e293b" }}>{inc.affectedUsersCount || "—"}</span>
                <span><StatusBadge status={inc.status} /></span>
                <span style={{ fontSize: "0.65rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.assignedTo?.split("@")[0] ?? "—"}</span>
                <span style={{ fontSize: "0.62rem", color: "#94a3b8" }}>{fmtDate(inc.createdAt)}</span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem", color: "#94a3b8" }}>
            <span>{filtered.length} incident{filtered.length > 1 ? "s" : ""}</span>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page <= 1 ? "#f8fafc" : "#fff", cursor: page <= 1 ? "default" : "pointer", fontSize: "0.68rem", color: "#475569", opacity: page <= 1 ? 0.5 : 1 }}>&lt;</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{ padding: "3px 8px", borderRadius: "6px", border: page === p ? "1px solid #2563eb" : "1px solid #e2e8f0", background: page === p ? "#2563eb" : "#fff", color: page === p ? "#fff" : "#475569", fontSize: "0.68rem", cursor: "pointer", fontWeight: page === p ? 600 : 400 }}>{p}</button>
              ))}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page >= totalPages ? "#f8fafc" : "#fff", cursor: page >= totalPages ? "default" : "pointer", fontSize: "0.68rem", color: "#475569", opacity: page >= totalPages ? 0.5 : 1 }}>&gt;</button>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "0.5rem 1rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: (stats.criticalCount ?? 0) === 0 ? "#22c55e" : "#ef4444" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: (stats.criticalCount ?? 0) === 0 ? "#16a34a" : "#dc2626" }}>
              {(stats.criticalCount ?? 0) === 0 ? "Plateforme saine" : `${stats.criticalCount} incident(s) critique(s)`}
            </span>
          </div>
        </div>

        {/* ── Right: Detail Panel ── */}
        {!selected ? (
          <div style={{ flex: 1, background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", color: "#94a3b8" }}>
            <span style={{ marginBottom: "0.75rem", opacity: 0.4 }}>{SVG.file}</span>
            <p style={{ fontSize: "0.82rem", margin: 0 }}>Sélectionner un incident pour voir la fiche</p>
          </div>
        ) : (
          <div style={{ flex: 1, background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {/* Detail header */}
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Fiche incident — {selected.incidentId}</span>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <SeverityBadge severity={selected.severity} />
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "1rem", fontSize: "0.68rem", color: "#64748b" }}>
                <span><strong>Titre:</strong> {selected.title}</span>
                <span><strong>Responsable:</strong> {selected.assignedTo?.split("@")[0] ?? "—"}</span>
                <span><strong>Ouvert:</strong> {fmtDate(selected.createdAt)}</span>
                {selected.createdAt && <span><strong>Deadline CNIL:</strong> <span style={{ color: cnilDeadline(selected.createdAt).color, fontWeight: 600 }}>{cnilDeadline(selected.createdAt).label}</span></span>}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #f1f5f9", padding: "0 1rem" }}>
              {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "0.5rem 0.75rem", fontSize: "0.7rem", fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? "#2563eb" : "#64748b", cursor: "pointer",
                  borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent",
                  background: "transparent", border: "none", borderBottomStyle: "solid",
                }}>{tab}</button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: "1rem", overflowY: "auto", maxHeight: "calc(100vh - 440px)" }}>
              {detailLoading ? (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "2rem", fontSize: "0.8rem" }}>Chargement...</div>
              ) : !detail ? null : (
                <>
                  {/* ── Résumé ── */}
                  {activeTab === "Résumé" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div>
                        <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Résumé</h4>
                        <p style={{ fontSize: "0.72rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>{detail.description || "Aucune description."}</p>
                      </div>
                      <div>
                        <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Informations clés</h4>
                        <InfoRow label="Type" value={detail.type} accent />
                        <InfoRow label="Gravité" value={SEVERITY_STYLES[detail.severity]?.label ?? detail.severity} accent />
                        <InfoRow label="Statut" value={STATUS_STYLES[detail.status]?.label ?? detail.status} accent />
                        <InfoRow label="Ouvert par" value={detail.openedBy} />
                        <InfoRow label="Assigné à" value={detail.assignedTo ?? "Non assigné"} />
                        <InfoRow label="Utilisateurs touchés" value={String(detail.metadata?.affectedUsersCount ?? 0)} accent />
                        {detail.dpoNotifiedAt && <InfoRow label="CNIL notifiée" value={fmtDateTime(detail.dpoNotifiedAt)} />}
                        {detail.userNotifiedAt && <InfoRow label="Utilisateurs notifiés" value={fmtDateTime(detail.userNotifiedAt)} />}
                      </div>
                      <div>
                        <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Données concernées</h4>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                          {(detail.metadata?.affectedData ?? []).length > 0 ? (detail.metadata.affectedData as string[]).map((d: string) => (
                            <span key={d} style={{ padding: "3px 8px", borderRadius: "6px", background: "#dbeafe", color: "#2563eb", fontSize: "0.65rem", fontWeight: 500 }}>{d}</span>
                          )) : <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Non renseigné</span>}
                        </div>
                      </div>
                      <div>
                        <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Actions rapides</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          <select onChange={e => { if (e.target.value) handleAction("update_status", { status: e.target.value }); e.target.value = ""; }} style={{ padding: "0.35rem 0.5rem", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "0.7rem", cursor: "pointer" }}>
                            <option value="">Changer le statut...</option>
                            {Object.entries(STATUS_STYLES).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
                          </select>
                          <select onChange={e => { if (e.target.value) handleAction("update_severity", { severity: e.target.value }); e.target.value = ""; }} style={{ padding: "0.35rem 0.5rem", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "0.7rem", cursor: "pointer" }}>
                            <option value="">Changer la gravité...</option>
                            {Object.entries(SEVERITY_STYLES).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
                          </select>
                          {!detail.dpoNotifiedAt && (
                            <button onClick={() => handleAction("notify_cnil", { notes: "Notification initiale dans les 72h." })} style={{ padding: "0.4rem 0.75rem", borderRadius: "7px", border: "1px solid #7c3aed", background: "#f3e8ff", color: "#7c3aed", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                              Notifier la CNIL
                            </button>
                          )}
                          {!detail.userNotifiedAt && (
                            <button onClick={() => handleAction("notify_users", { message: "Notification de violation de données." })} style={{ padding: "0.4rem 0.75rem", borderRadius: "7px", border: "1px solid #2563eb", background: "#dbeafe", color: "#2563eb", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                              Notifier les utilisateurs
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Timeline ── */}
                  {activeTab === "Timeline" && (
                    <div>
                      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
                        <input value={timelineInput} onChange={e => setTimelineInput(e.target.value)} placeholder="Ajouter un événement à la timeline..." style={{ flex: 1, padding: "0.4rem 0.6rem", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "0.75rem", outline: "none" }} onKeyDown={e => { if (e.key === "Enter" && timelineInput.trim()) { handleAction("add_timeline", { event: timelineInput }); setTimelineInput(""); } }} />
                        <button onClick={() => { if (timelineInput.trim()) { handleAction("add_timeline", { event: timelineInput }); setTimelineInput(""); } }} style={{ padding: "0.4rem 0.75rem", borderRadius: "7px", border: "1px solid #2563eb", background: "#dbeafe", color: "#2563eb", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}>{SVG.plus} Ajouter</button>
                      </div>
                      <div style={{ borderLeft: "2px solid #e2e8f0", paddingLeft: "1rem", marginLeft: "0.5rem" }}>
                        {timeline.length === 0 ? (
                          <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun événement enregistré.</p>
                        ) : timeline.map((entry: any, idx: number) => (
                          <div key={idx} style={{ position: "relative", paddingBottom: "1rem" }}>
                            <div style={{ position: "absolute", left: "-1.35rem", top: "0.15rem", width: "8px", height: "8px", borderRadius: "50%", background: idx === 0 ? "#2563eb" : "#cbd5e1" }} />
                            <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginBottom: "2px" }}>{fmtDateTime(entry.time)}</div>
                            <div style={{ fontSize: "0.75rem", color: "#1e293b" }}>{entry.event}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Utilisateurs ── */}
                  {activeTab === "Utilisateurs" && (
                    <div>
                      <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem" }}>Professionnel concerné</h4>
                      {detail.professionnel ? (
                        <div style={{ padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc" }}>
                          <InfoRow label="Nom" value={`${detail.professionnel.prenom} ${detail.professionnel.nom}`} accent />
                          <InfoRow label="Email" value={detail.professionnel.email} />
                          <InfoRow label="Spécialité" value={detail.professionnel.specialite ?? "—"} />
                          <InfoRow label="Statut compte" value={detail.professionnel.accountStatus ?? "actif"} accent />
                        </div>
                      ) : <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun professionnel lié à cet incident.</p>}
                      <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "1rem 0 0.5rem" }}>Utilisateurs potentiellement touchés</h4>
                      <p style={{ fontSize: "0.75rem", color: "#475569" }}>{detail.metadata?.affectedUsersCount ?? 0} utilisateur(s) potentiellement impacté(s).</p>
                      <div style={{ marginTop: "0.5rem" }}>
                        <button onClick={() => {
                          const count = prompt("Nombre d'utilisateurs touchés :");
                          if (count) handleAction("update_metadata", { metadata: { affectedUsersCount: parseInt(count) || 0 } });
                        }} style={{ padding: "0.35rem 0.75rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.7rem", cursor: "pointer", color: "#475569" }}>Mettre à jour le nombre</button>
                      </div>
                    </div>
                  )}

                  {/* ── Données ── */}
                  {activeTab === "Données" && (
                    <div>
                      <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem" }}>Données concernées par l&apos;incident</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                        {(detail.metadata?.affectedData ?? []).map((d: string) => (
                          <span key={d} style={{ padding: "5px 12px", borderRadius: "8px", background: "#dbeafe", color: "#2563eb", fontSize: "0.72rem", fontWeight: 500 }}>{d}</span>
                        ))}
                        {(detail.metadata?.affectedData ?? []).length === 0 && <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucune donnée renseignée.</span>}
                      </div>
                      <button onClick={() => {
                        const dataTypes = prompt("Types de données (séparés par virgule) :", (detail.metadata?.affectedData ?? []).join(", "));
                        if (dataTypes !== null) handleAction("update_metadata", { metadata: { affectedData: dataTypes.split(",").map((s: string) => s.trim()).filter(Boolean) } });
                      }} style={{ padding: "0.4rem 0.75rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.7rem", cursor: "pointer", color: "#475569" }}>Modifier les données concernées</button>

                      <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "1.5rem 0 0.6rem" }}>Cause probable</h4>
                      <p style={{ fontSize: "0.72rem", color: "#475569", margin: 0 }}>{detail.metadata?.cause ?? "Non renseignée"}</p>
                      <button onClick={() => {
                        const cause = prompt("Cause probable :", detail.metadata?.cause ?? "");
                        if (cause !== null) handleAction("update_metadata", { metadata: { cause } });
                      }} style={{ marginTop: "0.5rem", padding: "0.35rem 0.75rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.7rem", cursor: "pointer", color: "#475569" }}>Modifier la cause</button>

                      {/* Related security alerts */}
                      {(detail.relatedAlerts ?? []).length > 0 && (
                        <>
                          <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "1.5rem 0 0.6rem" }}>Alertes sécurité liées</h4>
                          {detail.relatedAlerts.map((a: any) => (
                            <div key={a.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.3rem 0", borderBottom: "1px solid #f8fafc" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: a.resolved ? "#16a34a" : "#d97706" }} />
                              <span style={{ fontSize: "0.7rem", color: "#475569", flex: 1 }}>{a.message?.slice(0, 60)}</span>
                              <span style={{ fontSize: "0.62rem", color: "#94a3b8" }}>{fmtDateTime(a.createdAt)}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Décisions ── */}
                  {activeTab === "Décisions" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                      <div>
                        <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem" }}>Décision notification CNIL</h4>
                        {detail.dpoNotifiedAt ? (
                          <div style={{ padding: "0.75rem", border: "1px solid #dcfce7", borderRadius: "8px", background: "#f0fdf4" }}>
                            <InfoRow label="Statut" value="Notifiée" accent />
                            <InfoRow label="Date" value={fmtDateTime(detail.dpoNotifiedAt)} />
                            <InfoRow label="Par" value={detail.metadata?.cnilDecision?.by ?? "—"} />
                            <InfoRow label="Notes" value={detail.metadata?.cnilDecision?.notes ?? "—"} />
                          </div>
                        ) : (
                          <div style={{ padding: "0.75rem", border: "1px solid #fef3c7", borderRadius: "8px", background: "#fffbeb" }}>
                            <p style={{ fontSize: "0.72rem", color: "#d97706", margin: "0 0 0.5rem", fontWeight: 600 }}>Décision à prendre</p>
                            <p style={{ fontSize: "0.7rem", color: "#64748b", margin: "0 0 0.5rem" }}>Deadline: {cnilDeadline(detail.createdAt).label}</p>
                            <button onClick={() => handleAction("notify_cnil", { notes: "Notification dans le cadre de l'article 33 RGPD." })} style={{ padding: "0.4rem 0.75rem", borderRadius: "7px", border: "1px solid #7c3aed", background: "#f3e8ff", color: "#7c3aed", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}>Notifier la CNIL</button>
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem" }}>Décision notification utilisateurs</h4>
                        {detail.userNotifiedAt ? (
                          <div style={{ padding: "0.75rem", border: "1px solid #dcfce7", borderRadius: "8px", background: "#f0fdf4" }}>
                            <InfoRow label="Statut" value="Notifiés" accent />
                            <InfoRow label="Date" value={fmtDateTime(detail.userNotifiedAt)} />
                            <InfoRow label="Par" value={detail.metadata?.userNotification?.by ?? "—"} />
                            <InfoRow label="Message" value={(detail.metadata?.userNotification?.message ?? "—").slice(0, 60)} />
                          </div>
                        ) : (
                          <div style={{ padding: "0.75rem", border: "1px solid #fef3c7", borderRadius: "8px", background: "#fffbeb" }}>
                            <p style={{ fontSize: "0.72rem", color: "#d97706", margin: "0 0 0.5rem", fontWeight: 600 }}>À décider</p>
                            <p style={{ fontSize: "0.7rem", color: "#64748b", margin: "0 0 0.5rem" }}>Si risque élevé pour les personnes concernées (art. 34 RGPD)</p>
                            <button onClick={() => {
                              const msg = prompt("Message de notification aux utilisateurs :");
                              if (msg) handleAction("notify_users", { message: msg });
                            }} style={{ padding: "0.4rem 0.75rem", borderRadius: "7px", border: "1px solid #2563eb", background: "#dbeafe", color: "#2563eb", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}>Notifier les utilisateurs</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Documents ── */}
                  {activeTab === "Documents" && (
                    <div>
                      <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem" }}>Documents associés</h4>
                      <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "0 0 1rem" }}>Les documents sont générés et attachés automatiquement lors des actions.</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {(detail.actionsTaken ?? []).map((a: string, idx: number) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.6rem", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc" }}>
                            <span style={{ color: "#2563eb" }}>{SVG.file}</span>
                            <span style={{ fontSize: "0.72rem", color: "#475569", flex: 1 }}>{a}</span>
                          </div>
                        ))}
                      </div>
                      <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "1.5rem 0 0.6rem" }}>Templates intégrés</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {([
                          { label: "Message utilisateur", gen: () => `Objet: Notification de sécurité\n\nBonjour,\n\nNous vous informons qu'un incident de sécurité (${detail.title}) a été détecté sur notre plateforme.\nDonnées potentiellement concernées: ${(detail.metadata?.affectedData ?? []).join(", ") || "à déterminer"}.\n\nNotre équipe a pris les mesures immédiates nécessaires. Nous vous tiendrons informé(e) de l'évolution.\n\nCordialement,\nL'équipe Tuatha` },
                          { label: "Message professionnel", gen: () => `Objet: Incident sécurité - Action requise\n\nBonjour,\n\nUn incident de sécurité (${detail.title}) a été ouvert concernant votre compte.\nGravité: ${SEVERITY_STYLES[detail.severity]?.label ?? detail.severity}\nStatut: ${STATUS_STYLES[detail.status]?.label ?? detail.status}\n\nVeuillez contacter l'équipe sécurité si vous avez des informations supplémentaires.\n\nCordialement,\nAdministration Tuatha` },
                          { label: "Notification CNIL", gen: () => `NOTIFICATION DE VIOLATION DE DONNÉES (Art. 33 RGPD)\n\n1. Nature de la violation: ${detail.title}\n2. Date de détection: ${fmtDateTime(detail.createdAt)}\n3. Données concernées: ${(detail.metadata?.affectedData ?? []).join(", ") || "en cours d'identification"}\n4. Nombre de personnes touchées: ${detail.metadata?.affectedUsersCount ?? "estimation en cours"}\n5. Mesures prises: ${(detail.actionsTaken ?? []).join(", ")}\n6. Responsable: ${detail.assignedTo ?? "non assigné"}\n\nDélai de notification: 72h à compter de la prise de connaissance.` },
                          { label: "Note interne", gen: () => `NOTE INTERNE - ${detail.incidentId ?? "Incident"}\nDate: ${fmtDateTime(new Date().toISOString())}\nRédigé par: Admin\n\nRésumé: ${detail.description}\nGravité: ${SEVERITY_STYLES[detail.severity]?.label ?? detail.severity}\nActions prises: ${(detail.actionsTaken ?? []).join(", ")}\n\nProchaines étapes:\n- [ ] ...` },
                          { label: "Post-mortem", gen: () => `POST-MORTEM - ${detail.title}\n\n## Résumé\n${detail.description}\n\n## Chronologie\n${(detail.metadata?.timeline ?? []).map((t: string) => { const [ts, ...r] = t.split("|"); return "- " + fmtDateTime(ts) + ": " + r.join("|"); }).join("\n")}\n\n## Cause racine\n${detail.metadata?.cause ?? "À déterminer"}\n\n## Impact\n- Utilisateurs touchés: ${detail.metadata?.affectedUsersCount ?? 0}\n- Données: ${(detail.metadata?.affectedData ?? []).join(", ") || "—"}\n\n## Mesures correctives\n- [ ] ...\n\n## Leçons apprises\n- ...` },
                        ] as { label: string; gen: () => string }[]).map(t => (
                          <button key={t.label} onClick={() => { navigator.clipboard.writeText(t.gen()); showMsg(`Template "${t.label}" copié dans le presse-papier.`); }} style={{ padding: "0.4rem 0.75rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.7rem", cursor: "pointer", color: "#475569" }}>{t.label}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Post-mortem ── */}
                  {activeTab === "Post-mortem" && (
                    <div>
                      <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.6rem" }}>Post-mortem</h4>
                      {detail.status.startsWith("closed") ? (
                        <>
                          <textarea value={postMortemInput} onChange={e => setPostMortemInput(e.target.value)} placeholder="Rédigez le post-mortem de l'incident : causes racines, leçons apprises, mesures préventives..." style={{ width: "100%", minHeight: "150px", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.75rem", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
                          <button onClick={() => handleAction("save_postmortem", { postMortem: postMortemInput })} style={{ marginTop: "0.5rem", padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #16a34a", background: "#dcfce7", color: "#16a34a", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>Enregistrer le post-mortem</button>
                        </>
                      ) : (
                        <div style={{ padding: "1.5rem", textAlign: "center", border: "1px dashed #e2e8f0", borderRadius: "8px", color: "#94a3b8" }}>
                          <p style={{ fontSize: "0.78rem", margin: 0 }}>Disponible après clôture de l&apos;incident</p>
                          <p style={{ fontSize: "0.68rem", margin: "0.3rem 0 0" }}>Le post-mortem sera rédigé une fois l&apos;incident clôturé.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={() => setShowCreate(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", maxWidth: "500px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "0.95rem", fontWeight: 700 }}>Nouvel incident</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <input value={newIncident.title} onChange={e => setNewIncident(p => ({ ...p, title: e.target.value }))} placeholder="Titre de l'incident" style={{ padding: "0.5rem", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "0.78rem", outline: "none" }} />
              <textarea value={newIncident.description} onChange={e => setNewIncident(p => ({ ...p, description: e.target.value }))} placeholder="Description / résumé initial..." style={{ padding: "0.5rem", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "0.78rem", outline: "none", minHeight: "70px", resize: "vertical", fontFamily: "inherit" }} />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <select value={newIncident.severity} onChange={e => setNewIncident(p => ({ ...p, severity: e.target.value }))} style={{ flex: 1, padding: "0.5rem", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "0.78rem" }}>
                  <option value="low">Faible</option>
                  <option value="medium">Modérée</option>
                  <option value="high">Élevée</option>
                  <option value="critical">Critique</option>
                </select>
                <select value={newIncident.type} onChange={e => setNewIncident(p => ({ ...p, type: e.target.value }))} style={{ flex: 1, padding: "0.5rem", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "0.78rem" }}>
                  <option value="security">Sécurité</option>
                  <option value="rgpd">RGPD</option>
                  <option value="compliance">Conformité</option>
                  <option value="fraud">Fraude</option>
                </select>
              </div>
              <input value={newIncident.affectedData} onChange={e => setNewIncident(p => ({ ...p, affectedData: e.target.value }))} placeholder="Données concernées (séparées par virgule)" style={{ padding: "0.5rem", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "0.78rem", outline: "none" }} />
              <input value={newIncident.affectedUsersCount} onChange={e => setNewIncident(p => ({ ...p, affectedUsersCount: e.target.value }))} placeholder="Nombre d'utilisateurs touchés" type="number" style={{ padding: "0.5rem", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "0.78rem", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.75rem", cursor: "pointer", color: "#475569" }}>Annuler</button>
              <button onClick={handleCreate} style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #dc2626", background: "#fee2e2", fontSize: "0.75rem", cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Créer l&apos;incident</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {actionMsg && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, background: "#1e293b", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#22c55e" }}>{SVG.check}</span>
          {actionMsg}
        </div>
      )}
    </div>
  );
}
