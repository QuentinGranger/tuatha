"use client";
import { useState, useEffect, useCallback } from "react";

// ─── Constants ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  new:                  { label: "Nouveau",              color: "#2563eb", bg: "#dbeafe" },
  open:                 { label: "Ouvert",               color: "#2563eb", bg: "#dbeafe" },
  in_progress:          { label: "En cours",             color: "#d97706", bg: "#fef3c7" },
  waiting_user:         { label: "Attente utilisateur",  color: "#7c3aed", bg: "#ede9fe" },
  waiting_tech:         { label: "Attente équipe tech",  color: "#0891b2", bg: "#cffafe" },
  waiting_compliance:   { label: "Attente conformité",   color: "#9333ea", bg: "#f3e8ff" },
  blocked:              { label: "Bloqué",               color: "#dc2626", bg: "#fee2e2" },
  resolved:             { label: "Résolu",               color: "#16a34a", bg: "#dcfce7" },
  closed:               { label: "Fermé",                color: "#64748b", bg: "#f1f5f9" },
  pending_info:         { label: "Info requise",         color: "#7c3aed", bg: "#ede9fe" },
  closed_resolved:      { label: "Clos (résolu)",        color: "#16a34a", bg: "#dcfce7" },
  closed_unfounded:     { label: "Clos (infondé)",       color: "#64748b", bg: "#f1f5f9" },
};
const PRIORITY_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  p0:     { label: "P0 — Sécurité / données",  color: "#fff",    bg: "#dc2626" },
  p1:     { label: "P1 — Blocage",             color: "#dc2626", bg: "#fee2e2" },
  p2:     { label: "P2 — Bug important",       color: "#d97706", bg: "#fef3c7" },
  p3:     { label: "P3 — Question",            color: "#2563eb", bg: "#dbeafe" },
  p4:     { label: "P4 — Feedback",            color: "#64748b", bg: "#f1f5f9" },
  urgent: { label: "Urgente",                  color: "#dc2626", bg: "#fee2e2" },
  high:   { label: "Haute",                    color: "#d97706", bg: "#fef3c7" },
  normal: { label: "Normale",                  color: "#2563eb", bg: "#dbeafe" },
  low:    { label: "Basse",                    color: "#64748b", bg: "#f1f5f9" },
};
const SEVERITY_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  low:      { label: "Faible",   color: "#64748b", bg: "#f1f5f9" },
  medium:   { label: "Moyenne",  color: "#d97706", bg: "#fef3c7" },
  high:     { label: "Haute",    color: "#dc2626", bg: "#fee2e2" },
  critical: { label: "Critique", color: "#fff",    bg: "#dc2626" },
};
const TYPE_LABELS: Record<string, string> = {
  compliance: "Conformité", fraud: "Fraude", security: "Sécurité", rgpd: "RGPD", other: "Autre",
};
const CATEGORY_LABELS: Record<string, string> = {
  account:           "Compte",
  connexion:         "Connexion",
  payment:           "Paiement",
  pro:               "Professionnel",
  document:          "Document",
  consent:           "Consentement",
  delete_account:    "Suppression compte",
  data_export:       "Export données",
  technical:         "Bug",
  security:          "Sécurité",
  report:            "Signalement",
  investigation:     "Investigation",
  other:             "Autre",
};

// Sensitive categories that may contain health data
const SENSITIVE_CATEGORIES = ["security", "report", "delete_account", "data_export", "consent"];

const TABS = ["Tickets", "Investigations"] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────────
function getSlaHours(priority: string): number {
  switch (priority) {
    case "p0": case "urgent": return 1;
    case "p1": case "high": return 4;
    case "p2": return 24;
    case "p3": case "normal": return 48;
    case "p4": case "low": return 72;
    default: return 48;
  }
}
function Badge({ status, map }: { status: string; map: Record<string, { label: string; color: string; bg: string }> }) {
  const s = map[status] ?? { label: status, color: "#64748b", bg: "#f1f5f9" };
  return <span style={{ background: s.bg, color: s.color, fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", whiteSpace: "nowrap" }}>{s.label}</span>;
}
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString("fr-FR") : "—"; }
function fmtDateTime(d: string | null | undefined) { return d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}
function userName(item: any) {
  if (item?.professionnel) return `${item.professionnel.prenom} ${item.professionnel.nom}`;
  if (item?.athleteUser) return `${item.athleteUser.prenom} ${item.athleteUser.nom}`;
  return "—";
}
function userRole(item: any) {
  if (item?.professionnel) return "Pro";
  if (item?.athleteUser) return "Athlète";
  return "—";
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function TicketsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailType, setDetailType] = useState<"ticket" | "investigation">("ticket");
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<"ticket" | "investigation" | null>(null);
  const [newComment, setNewComment] = useState("");

  // Form state for create modals
  const [form, setForm] = useState<any>({});

  const showMsg = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(null), 3500); };

  const loadData = useCallback(() => {
    fetch("/api/admin/tickets?view=all")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadTicketDetail = async (id: string) => {
    setDetailLoading(true); setDetailType("ticket");
    try {
      const r = await fetch(`/api/admin/tickets?id=${id}`);
      const d = await r.json();
      setDetail(d);
    } catch { showMsg("Erreur de chargement."); }
    setDetailLoading(false);
  };

  const loadInvestigationDetail = async (id: string) => {
    setDetailLoading(true); setDetailType("investigation");
    try {
      const r = await fetch(`/api/admin/tickets?investigationId=${id}`);
      const d = await r.json();
      setDetail(d);
    } catch { showMsg("Erreur de chargement."); }
    setDetailLoading(false);
  };

  const callAction = async (payload: any) => {
    const r = await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.json();
  };

  const handleUpdateTicket = async (ticketId: string, updates: any) => {
    const d = await callAction({ action: "update_ticket", ticketId, ...updates });
    if (d.success) { showMsg(d.message); loadData(); loadTicketDetail(ticketId); }
    else showMsg(`Erreur: ${d.error}`);
  };

  const handleAddComment = async (ticketId: string) => {
    if (!newComment.trim()) return;
    const d = await callAction({ action: "add_comment", ticketId, content: newComment });
    if (d.success) { showMsg("Commentaire ajouté."); setNewComment(""); loadTicketDetail(ticketId); }
    else showMsg(`Erreur: ${d.error}`);
  };

  const handleUpdateInvestigation = async (investigationId: string, updates: any) => {
    const d = await callAction({ action: "update_investigation", investigationId, ...updates });
    if (d.success) { showMsg(d.message); loadData(); loadInvestigationDetail(investigationId); }
    else showMsg(`Erreur: ${d.error}`);
  };

  const handleNotifyDPO = async (investigationId: string) => {
    const d = await callAction({ action: "notify_dpo", investigationId });
    if (d.success) { showMsg("DPO notifié."); loadInvestigationDetail(investigationId); }
    else showMsg(`Erreur: ${d.error}`);
  };

  const handleCreate = async () => {
    if (createModal === "ticket") {
      const d = await callAction({ action: "create_ticket", ...form });
      if (d.success) { showMsg("Ticket créé."); setCreateModal(null); setForm({}); loadData(); }
      else showMsg(`Erreur: ${d.error}`);
    } else {
      const d = await callAction({ action: "create_investigation", ...form });
      if (d.success) { showMsg("Investigation ouverte."); setCreateModal(null); setForm({}); loadData(); }
      else showMsg(`Erreur: ${d.error}`);
    }
  };

  // ── Filtered lists ──
  const tickets = (data?.tickets ?? []).filter((t: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.subject.toLowerCase().includes(q) || userName(t).toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const investigations = (data?.investigations ?? []).filter((inv: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || inv.title.toLowerCase().includes(q) || userName(inv).toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ color: "#1e293b" }}>
      {/* ── Header ── */}
      <div className="admin-tickets-header">
        <div>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>Tickets & Investigations</h1>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>Gestion du support et des enquêtes de conformité</p>
        </div>
        <div className="admin-tickets-actions">
          <button onClick={() => { setForm({ category: "other", priority: "normal" }); setCreateModal("ticket"); }} style={{ padding: "0.45rem 0.9rem", borderRadius: "8px", border: "none", background: "#2563eb", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>+ Nouveau ticket</button>
          <button onClick={() => { setForm({ type: "compliance", severity: "medium" }); setCreateModal("investigation"); }} style={{ padding: "0.45rem 0.9rem", borderRadius: "8px", border: "1px solid #7c3aed", background: "#ede9fe", color: "#7c3aed", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>+ Investigation</button>
          <button onClick={loadData} style={{ padding: "0.45rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "0.78rem", cursor: "pointer" }}>↻</button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {data?.stats && (
        <div className="admin-stats-badges">
          {[
            { label: "Ouverts", value: data.stats.open, color: "#2563eb" },
            { label: "En cours", value: data.stats.inProgress, color: "#d97706" },
            { label: "Bloqués", value: data.stats.blocked, color: "#dc2626" },
            { label: "Urgents", value: data.stats.urgent, color: "#dc2626" },
            { label: "Investigations actives", value: data.stats.activeInvestigations, color: "#7c3aed" },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Action message ── */}
      {actionMsg && (
        <div style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 9999, background: "#0f172a", color: "#fff", padding: "0.6rem 1.2rem", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>{actionMsg}</div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", marginBottom: "1rem" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setSelected(null); setDetail(null); setStatusFilter("all"); }} style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: tab === i ? 600 : 400, color: tab === i ? "#2563eb" : "#64748b", background: "none", border: "none", borderBottom: tab === i ? "2px solid #2563eb" : "2px solid transparent", cursor: "pointer" }}>{t} ({i === 0 ? data?.tickets?.length ?? 0 : data?.investigations?.length ?? 0})</button>
        ))}
      </div>

      {/* ── Search + filter ── */}
      <div className="admin-search-row">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ flex: 1, padding: "0.45rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", outline: "none" }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "0.45rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.78rem", outline: "none", background: "#fff" }}>
          <option value="all">Tous les statuts</option>
          {tab === 0 ? (
            <>
              <option value="new">Nouveaux</option>
              <option value="open">Ouverts</option>
              <option value="in_progress">En cours</option>
              <option value="waiting_user">Attente utilisateur</option>
              <option value="waiting_tech">Attente tech</option>
              <option value="waiting_compliance">Attente conformité</option>
              <option value="blocked">Bloqués</option>
              <option value="resolved">Résolus</option>
              <option value="closed">Fermés</option>
            </>
          ) : (
            <>
              <option value="open">Ouvertes</option>
              <option value="in_progress">En cours</option>
              <option value="pending_info">Info requise</option>
              <option value="closed_resolved">Closes (résolues)</option>
              <option value="closed_unfounded">Closes (infondées)</option>
            </>
          )}
        </select>
      </div>

      {/* ── Content: list + detail ── */}
      <div className={`admin-tickets-content${detail ? " has-detail" : ""}`}>
        {/* ─ List ─ */}
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Chargement...</div>
          ) : tab === 0 ? (
            /* Tickets list */
            tickets.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Aucun ticket.</div>
            ) : (
              <>
                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: "0.5rem", padding: "0.5rem 1rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: "0.65rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                  <span>Sujet / Utilisateur</span>
                  <span>Catégorie</span>
                  <span>Priorité</span>
                  <span>Statut</span>
                  <span>Assigné</span>
                  <span>SLA</span>
                </div>
                {tickets.map((t: any) => {
                  const slaHours = getSlaHours(t.priority);
                  const elapsed = (Date.now() - new Date(t.createdAt).getTime()) / 3_600_000;
                  const slaBreached = slaHours > 0 && elapsed > slaHours && t.status !== "resolved" && t.status !== "closed";
                  return (
                    <div key={t.id} onClick={() => { setSelected(t); loadTicketDetail(t.id); }} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: "0.5rem", alignItems: "center", padding: "0.6rem 1rem", borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: selected?.id === t.id ? "#f0f7ff" : "transparent", transition: "background 0.1s" }}>
                      <div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>{t.subject}</div>
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: "0.1rem" }}>
                          {userName(t)} <span style={{ color: "#cbd5e1" }}>·</span> {userRole(t)} <span style={{ color: "#cbd5e1" }}>·</span> {timeAgo(t.createdAt)}
                          {t.investigationId && <span style={{ color: "#7c3aed", fontWeight: 600, marginLeft: "0.4rem" }}>Investigation</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: "0.65rem", color: "#475569", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>{CATEGORY_LABELS[t.category] ?? t.category}</span>
                      <Badge status={t.priority} map={PRIORITY_COLORS} />
                      <Badge status={t.status} map={STATUS_COLORS} />
                      <span style={{ fontSize: "0.65rem", color: t.assignedToId ? "#334155" : "#cbd5e1", fontWeight: 500 }}>{t.assignedToId ?? "—"}</span>
                      <span style={{ fontSize: "0.65rem", fontWeight: 600, color: slaBreached ? "#dc2626" : "#64748b" }}>{slaBreached ? "⚠ SLA" : slaHours > 0 ? `${slaHours}h` : "—"}</span>
                    </div>
                  );
                })}
              </>
            )
          ) : (
            /* Investigations list */
            investigations.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Aucune investigation.</div>
            ) : investigations.map((inv: any) => (
              <div key={inv.id} onClick={() => { setSelected(inv); loadInvestigationDetail(inv.id); }} style={{ padding: "0.65rem 1rem", borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: selected?.id === inv.id ? "#f5f3ff" : "transparent", transition: "background 0.1s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, flex: 1 }}>{inv.title}</span>
                  <Badge status={inv.status} map={STATUS_COLORS} />
                  <Badge status={inv.severity} map={SEVERITY_COLORS} />
                </div>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem", fontSize: "0.68rem", color: "#94a3b8" }}>
                  <span>{userName(inv)} ({userRole(inv)})</span>
                  <span>{TYPE_LABELS[inv.type] ?? inv.type}</span>
                  <span>{timeAgo(inv.createdAt)}</span>
                  {inv.dpoNotifiedAt && <span style={{ color: "#16a34a", fontWeight: 600 }}>DPO notifié</span>}
                  <span>{inv._count?.tickets ?? 0} ticket(s)</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ─ Detail panel ─ */}
        {detail && (
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", maxHeight: "78vh", overflowY: "auto" }}>
            {detailLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Chargement...</div>
            ) : detailType === "ticket" ? (
              /* ── Ticket detail (fiche complète) ── */
              <div>
                {/* Sensitive data warning */}
                {SENSITIVE_CATEGORIES.includes(detail.category) && (
                  <div style={{ background: "#fef2f2", borderBottom: "2px solid #dc2626", padding: "0.6rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1rem" }}>🔒</span>
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#991b1b" }}>Ce ticket peut contenir des données sensibles.</div>
                      <div style={{ fontSize: "0.65rem", color: "#b91c1c" }}>Accès limité. Ne pas copier dans un outil externe.</div>
                    </div>
                  </div>
                )}

                {/* Header: résumé */}
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>{detail.subject}</h3>
                    <button onClick={() => { setDetail(null); setSelected(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.1rem" }}>×</button>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                    <Badge status={detail.status} map={STATUS_COLORS} />
                    <Badge status={detail.priority} map={PRIORITY_COLORS} />
                    <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{CATEGORY_LABELS[detail.category] ?? detail.category}</span>
                    <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Créé {fmtDateTime(detail.createdAt)}</span>
                    <span style={{ fontSize: "0.65rem", fontWeight: 600, color: SENSITIVE_CATEGORIES.includes(detail.category) ? "#dc2626" : "#64748b" }}>
                      Sensibilité: {SENSITIVE_CATEGORIES.includes(detail.category) ? "Haute" : "Standard"}
                    </span>
                  </div>
                  {/* SLA indicator */}
                  {(() => {
                    const slaH = getSlaHours(detail.priority);
                    const elapsed = (Date.now() - new Date(detail.createdAt).getTime()) / 3_600_000;
                    const breached = slaH > 0 && elapsed > slaH && detail.status !== "resolved" && detail.status !== "closed";
                    return (
                      <div style={{ marginTop: "0.4rem", fontSize: "0.68rem", color: breached ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                        SLA: {slaH}h {breached ? `— DÉPASSÉ (${Math.round(elapsed)}h écoulées)` : `— ${Math.max(0, Math.round(slaH - elapsed))}h restantes`}
                      </div>
                    );
                  })()}
                </div>

                {/* Utilisateur concerné */}
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <SectionTitle>Utilisateur concerné</SectionTitle>
                  <div className="admin-detail-grid-2">
                    <DRow label="Nom" value={userName(detail)} />
                    <DRow label="Type" value={userRole(detail)} />
                    <DRow label="Email" value={detail.professionnel?.email ?? detail.athleteUser?.email ?? "—"} />
                    {detail.professionnel?.specialite && <DRow label="Spécialité" value={detail.professionnel.specialite} />}
                    <DRow label="ID compte" value={detail.professionnel?.id ?? detail.athleteUser?.id ?? "—"} />
                  </div>
                </div>

                {/* Description / résumé */}
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <SectionTitle>Résumé du problème</SectionTitle>
                  <div style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{detail.description}</div>
                </div>

                {/* Contexte technique */}
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <SectionTitle>Contexte technique & logs</SectionTitle>
                  <div className="admin-detail-grid-2">
                    <DRow label="Créé par" value={detail.createdByRole ?? "—"} />
                    <DRow label="Assigné à" value={detail.assignedToId ?? "Non assigné"} />
                    <DRow label="Mis à jour" value={fmtDateTime(detail.updatedAt)} />
                    {detail.resolvedAt && <DRow label="Résolu le" value={fmtDateTime(detail.resolvedAt)} />}
                    {detail.resolution && <DRow label="Résolution" value={detail.resolution} />}
                    {detail.blockedReason && <DRow label="Raison blocage" value={detail.blockedReason} />}
                    {detail.investigation && <DRow label="Investigation liée" value={`${detail.investigation.title} (${STATUS_COLORS[detail.investigation.status]?.label ?? detail.investigation.status})`} />}
                  </div>
                  {/* IP/logs extracted from description */}
                  {detail.description?.includes("IP:") && (
                    <div style={{ marginTop: "0.5rem", padding: "0.4rem 0.6rem", background: "#f8fafc", borderRadius: "6px", fontFamily: "monospace", fontSize: "0.65rem", color: "#475569" }}>
                      {detail.description.split("\n").filter((l: string) => l.includes("IP:") || l.includes("Signalé par:") || l.includes("Utilisateur signalé:")).join("\n")}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginRight: "0.25rem" }}>Actions:</span>
                  {detail.status !== "in_progress" && <MiniBtn label="Prendre en charge" onClick={() => handleUpdateTicket(detail.id, { status: "in_progress", assignedToId: "Admin Quentin" })} />}
                  {!["resolved", "closed"].includes(detail.status) && <MiniBtn label="Résoudre" color="#16a34a" onClick={() => { const r = prompt("Résolution :"); if (r) handleUpdateTicket(detail.id, { status: "resolved", resolution: r }); }} />}
                  {detail.status !== "blocked" && <MiniBtn label="Bloquer" color="#dc2626" onClick={() => { const r = prompt("Raison du blocage :"); if (r) handleUpdateTicket(detail.id, { status: "blocked", blockedReason: r }); }} />}
                  {detail.status !== "closed" && <MiniBtn label="Fermer" color="#64748b" onClick={() => handleUpdateTicket(detail.id, { status: "closed" })} />}
                  {detail.status === "blocked" && <MiniBtn label="Débloquer" color="#2563eb" onClick={() => handleUpdateTicket(detail.id, { status: "in_progress" })} />}
                  <MiniBtn label="Attente utilisateur" color="#7c3aed" onClick={() => handleUpdateTicket(detail.id, { status: "waiting_user" })} />
                  <MiniBtn label="Attente tech" color="#0891b2" onClick={() => handleUpdateTicket(detail.id, { status: "waiting_tech" })} />
                  <MiniBtn label="Attente conformité" color="#9333ea" onClick={() => handleUpdateTicket(detail.id, { status: "waiting_compliance" })} />
                  <select onChange={e => { if (e.target.value) handleUpdateTicket(detail.id, { priority: e.target.value }); e.target.value = ""; }} style={{ padding: "0.25rem 0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.68rem", background: "#fff" }}>
                    <option value="">Priorité...</option>
                    <option value="p0">P0 — Sécurité / données</option>
                    <option value="p1">P1 — Blocage</option>
                    <option value="p2">P2 — Bug important</option>
                    <option value="p3">P3 — Question</option>
                    <option value="p4">P4 — Feedback</option>
                  </select>
                  <select onChange={e => { if (e.target.value) handleUpdateTicket(detail.id, { assignedToId: e.target.value }); e.target.value = ""; }} style={{ padding: "0.25rem 0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.68rem", background: "#fff" }}>
                    <option value="">Assigner...</option>
                    <option value="Admin Quentin">Quentin</option>
                    <option value="Support">Support</option>
                    <option value="Technique">Technique</option>
                    <option value="Conformité">Conformité</option>
                  </select>
                </div>

                {/* Historique conversation / commentaires */}
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <SectionTitle>Historique conversation ({detail.comments?.length ?? 0})</SectionTitle>
                  {(detail.comments ?? []).length === 0 ? (
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Aucun échange pour le moment.</div>
                  ) : (detail.comments ?? []).map((c: any) => (
                    <div key={c.id} style={{ padding: "0.5rem", marginBottom: "0.4rem", background: c.internal ? "#fefce8" : "#f8fafc", borderRadius: "8px", borderLeft: `3px solid ${c.internal ? "#d97706" : "#2563eb"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>{c.authorName ?? c.authorRole}{c.internal ? " 🔒 Note interne" : ""}</span>
                        <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{fmtDateTime(c.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#334155", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.content}</div>
                    </div>
                  ))}
                  {/* Add comment */}
                  <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                    <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Répondre ou note interne..." style={{ flex: 1, padding: "0.4rem 0.7rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.78rem", outline: "none" }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleAddComment(detail.id); }} />
                    <button onClick={() => handleAddComment(detail.id)} style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", border: "none", background: "#2563eb", color: "#fff", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>Envoyer</button>
                    <button onClick={() => { if (newComment.trim()) { callAction({ action: "add_comment", ticketId: detail.id, content: newComment, internal: true }).then(() => { setNewComment(""); loadTicketDetail(detail.id); showMsg("Note interne ajoutée."); }); } }} style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", border: "1px solid #d97706", background: "#fefce8", color: "#92400e", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}>🔒 Interne</button>
                  </div>
                </div>

                {/* Pièces jointes (placeholder) */}
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <SectionTitle>Pièces jointes</SectionTitle>
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontStyle: "italic" }}>Aucune pièce jointe. (fonctionnalité upload à venir)</div>
                </div>

                {/* Notes internes séparées */}
                {(detail.comments ?? []).filter((c: any) => c.internal).length > 0 && (
                  <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9", background: "#fffbeb" }}>
                    <SectionTitle>Notes internes ({(detail.comments ?? []).filter((c: any) => c.internal).length})</SectionTitle>
                    {(detail.comments ?? []).filter((c: any) => c.internal).map((c: any) => (
                      <div key={c.id} style={{ fontSize: "0.72rem", color: "#92400e", marginBottom: "0.3rem", padding: "0.3rem 0.5rem", background: "#fef3c7", borderRadius: "6px" }}>
                        <strong>{c.authorName ?? "Admin"}</strong> ({fmtDateTime(c.createdAt)}): {c.content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── Investigation detail ── */
              <div>
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>{detail.title}</h3>
                    <button onClick={() => { setDetail(null); setSelected(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.1rem" }}>×</button>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                    <Badge status={detail.status} map={STATUS_COLORS} />
                    <Badge status={detail.severity} map={SEVERITY_COLORS} />
                    <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{TYPE_LABELS[detail.type] ?? detail.type}</span>
                    <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Ouverte {fmtDateTime(detail.createdAt)}</span>
                  </div>
                </div>
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.6, marginBottom: "0.75rem" }}>{detail.description}</div>
                  <div className="admin-detail-grid-2">
                    <DRow label="Sujet" value={userName(detail)} />
                    <DRow label="Type" value={userRole(detail)} />
                    <DRow label="Ouverte par" value={detail.openedBy} />
                    <DRow label="Assignée à" value={detail.assignedTo ?? "Non assigné"} />
                    <DRow label="DPO notifié" value={detail.dpoNotifiedAt ? fmtDateTime(detail.dpoNotifiedAt) : "Non"} accent={!detail.dpoNotifiedAt} />
                    <DRow label="Utilisateur notifié" value={detail.userNotifiedAt ? fmtDateTime(detail.userNotifiedAt) : "Non"} />
                    {detail.closedAt && <DRow label="Close le" value={fmtDateTime(detail.closedAt)} />}
                    {detail.closedBy && <DRow label="Close par" value={detail.closedBy} />}
                    {detail.outcome && <DRow label="Issue" value={detail.outcome} />}
                  </div>
                  {/* Actions taken */}
                  {detail.actionsTaken?.length > 0 && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.3rem" }}>Actions effectuées</div>
                      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                        {detail.actionsTaken.map((a: string, i: number) => (
                          <span key={i} style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.65rem", padding: "2px 8px", borderRadius: "9999px" }}>{a.replace(/_/g, " ")}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Actions */}
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginRight: "0.25rem" }}>Actions:</span>
                  {!detail.status.startsWith("closed") && <MiniBtn label="En cours" color="#d97706" onClick={() => handleUpdateInvestigation(detail.id, { status: "in_progress" })} />}
                  {!detail.dpoNotifiedAt && <MiniBtn label="Notifier DPO" color="#7c3aed" onClick={() => handleNotifyDPO(detail.id)} />}
                  {!detail.status.startsWith("closed") && <MiniBtn label="Clore (résolu)" color="#16a34a" onClick={() => { const o = prompt("Issue / résolution :"); if (o) handleUpdateInvestigation(detail.id, { status: "closed_resolved", outcome: o }); }} />}
                  {!detail.status.startsWith("closed") && <MiniBtn label="Clore (infondé)" color="#64748b" onClick={() => { const o = prompt("Motif :"); if (o) handleUpdateInvestigation(detail.id, { status: "closed_unfounded", outcome: o }); }} />}
                  <select onChange={e => { if (e.target.value) handleUpdateInvestigation(detail.id, { severity: e.target.value }); e.target.value = ""; }} style={{ padding: "0.25rem 0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.68rem", background: "#fff" }}>
                    <option value="">Sévérité...</option>
                    <option value="low">Faible</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="critical">Critique</option>
                  </select>
                </div>
                {/* Linked tickets */}
                <div style={{ padding: "0.75rem 1.25rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>Tickets liés ({detail.tickets?.length ?? 0})</div>
                  {(detail.tickets ?? []).length === 0 ? (
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Aucun ticket associé.</div>
                  ) : (detail.tickets ?? []).map((t: any) => (
                    <div key={t.id} onClick={() => { setTab(0); loadTicketDetail(t.id); setSelected(t); }} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", cursor: "pointer", borderBottom: "1px solid #f8fafc" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 500, flex: 1 }}>{t.subject}</span>
                      <Badge status={t.status} map={STATUS_COLORS} />
                      <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{fmtDate(t.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
      {createModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)" }} onClick={() => setCreateModal(null)}>
          <div onClick={e => e.stopPropagation()} className="admin-modal-content" style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 1rem" }}>{createModal === "ticket" ? "Nouveau ticket" : "Nouvelle investigation"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <FormField label={createModal === "ticket" ? "Sujet" : "Titre"} value={form.subject ?? form.title ?? ""} onChange={v => setForm({ ...form, [createModal === "ticket" ? "subject" : "title"]: v })} />
              <FormField label="Description" value={form.description ?? ""} onChange={v => setForm({ ...form, description: v })} textarea />
              {createModal === "ticket" ? (
                <>
                  <FormSelect label="Catégorie" value={form.category ?? "other"} options={Object.entries(CATEGORY_LABELS)} onChange={v => setForm({ ...form, category: v })} />
                  <FormSelect label="Priorité" value={form.priority ?? "p3"} options={[["p0","P0 — Sécurité / données"],["p1","P1 — Blocage"],["p2","P2 — Bug important"],["p3","P3 — Question"],["p4","P4 — Feedback"]]} onChange={v => setForm({ ...form, priority: v })} />
                </>
              ) : (
                <>
                  <FormSelect label="Type" value={form.type ?? "compliance"} options={Object.entries(TYPE_LABELS)} onChange={v => setForm({ ...form, type: v })} />
                  <FormSelect label="Sévérité" value={form.severity ?? "medium"} options={Object.entries(SEVERITY_COLORS).map(([k, v]) => [k, v.label])} onChange={v => setForm({ ...form, severity: v })} />
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button onClick={() => setCreateModal(null)} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.78rem", cursor: "pointer", fontWeight: 500, color: "#475569" }}>Annuler</button>
              <button onClick={handleCreate} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "none", background: createModal === "ticket" ? "#2563eb" : "#7c3aed", color: "#fff", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600 }}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Micro components ───────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>{children}</div>;
}
function DRow({ label, value, accent }: { label: string; value?: string | null; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid #f8fafc" }}>
      <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{label}</span>
      <span style={{ fontSize: "0.7rem", fontWeight: 500, color: accent ? "#dc2626" : "#334155", textAlign: "right", maxWidth: "60%" }}>{value || "—"}</span>
    </div>
  );
}
function MiniBtn({ label, color, onClick }: { label: string; color?: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: "0.25rem 0.6rem", borderRadius: "6px", border: `1px solid ${color ?? "#2563eb"}20`, background: `${color ?? "#2563eb"}10`, color: color ?? "#2563eb", fontSize: "0.68rem", fontWeight: 600, cursor: "pointer" }}>{label}</button>;
}
function FormField({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "0.2rem" }}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", outline: "none", resize: "vertical" }} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", outline: "none" }} />
      )}
    </div>
  );
}
function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "0.2rem" }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", outline: "none", background: "#fff" }}>
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}
