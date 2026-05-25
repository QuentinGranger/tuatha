"use client";
import { useState, useEffect, useCallback } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function timeAgo(d: string | null | undefined) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

// ─── Status helpers ────────────────────────────────────────────────────────────
const VERIF_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  verified:   { label: "Vérifié",   color: "#16a34a", bg: "#dcfce7" },
  pending:    { label: "En attente", color: "#d97706", bg: "#fef3c7" },
  rejected:   { label: "Refusé",    color: "#dc2626", bg: "#fee2e2" },
  unverified: { label: "Non vérifié", color: "#64748b", bg: "#f1f5f9" },
};
const ACCOUNT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:           { label: "Actif",         color: "#16a34a", bg: "#dcfce7" },
  suspended:        { label: "Suspendu",       color: "#dc2626", bg: "#fee2e2" },
  restricted:       { label: "Restreint",      color: "#d97706", bg: "#fef3c7" },
  deleted:          { label: "Supprimé",       color: "#fff",    bg: "#1e293b" },
  compliance_review:{ label: "À revoir",       color: "#7c3aed", bg: "#ede9fe" },
  draft:            { label: "Brouillon",      color: "#64748b", bg: "#f1f5f9" },
  profile_pending:  { label: "Profil incomplet", color: "#d97706", bg: "#fef3c7" },
  stripe_pending:   { label: "Stripe en attente", color: "#d97706", bg: "#fef3c7" },
};

function VerifBadge({ status }: { status: string }) {
  const s = VERIF_LABELS[status] ?? { label: status, color: "#64748b", bg: "#f1f5f9" };
  return <span style={{ background: s.bg, color: s.color, fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px" }}>{s.label}</span>;
}
function AccountBadge({ status }: { status: string }) {
  const s = ACCOUNT_LABELS[status] ?? { label: status, color: "#64748b", bg: "#f1f5f9" };
  return <span style={{ background: s.bg, color: s.color, fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px" }}>{s.label}</span>;
}
function RiskBadge({ score }: { score: number }) {
  const level = score > 70 ? { label: "Élevé", color: "#dc2626", bg: "#fee2e2" } : score > 30 ? { label: "Moyen", color: "#d97706", bg: "#fef3c7" } : { label: "Faible", color: "#16a34a", bg: "#dcfce7" };
  return <span style={{ background: level.bg, color: level.color, fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px" }}>{level.label}</span>;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0.9rem 0 0.4rem" }}>{children}</div>;
}
function DRow({ label, value, accent }: { label: string; value?: string | null; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0", borderBottom: "1px solid #f8fafc" }}>
      <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{label}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: 500, color: accent ? "#dc2626" : "#1e293b", maxWidth: "60%", textAlign: "right" }}>{value ?? "—"}</span>
    </div>
  );
}
function ActBtn({ label, icon, onClick, danger, disabled }: { label: string; icon?: React.ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: "0.3rem",
      padding: "0.3rem 0.6rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 500,
      border: danger ? "1px solid #fca5a5" : "1px solid #e2e8f0",
      background: danger ? "#fff1f2" : "#f8fafc",
      color: danger ? "#dc2626" : "#475569",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    }}>{icon}{label}</button>
  );
}

// ─── Status filter pills ───────────────────────────────────────────────────────
const STATUS_FILTERS = ["En attente", "Vérifié", "Refusé", "Suspendu", "À revoir"];
const filterToQuery: Record<string, Partial<{ verificationStatus: string; accountStatus: string }>> = {
  "En attente": { verificationStatus: "pending" },
  "Vérifié":    { verificationStatus: "verified" },
  "Refusé":     { verificationStatus: "rejected" },
  "Suspendu":   { accountStatus: "suspended" },
  "À revoir":   { accountStatus: "compliance_review" },
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const SVG = {
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  filter: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  refresh: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  suspend: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  warning: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  download: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  eye: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  shield: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  user: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  activity: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; danger?: boolean; withReason?: boolean; onConfirm: (reason?: string) => void } | null>(null);
  const [modalReason, setModalReason] = useState("");

  const showMsg = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(null), 3500); };

  const reloadList = useCallback(() => {
    fetch("/api/admin/pros").then(r => r.json()).then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/pros").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadProInvestigations = useCallback((proId: string) => {
    fetch(`/api/admin/tickets?view=investigations`)
      .then(r => r.json())
      .then(d => {
        const inv = (d.investigations ?? []).filter((i: any) => i.professionnel?.id === proId);
        setProInvestigations(inv);
      })
      .catch(() => setProInvestigations([]));
  }, []);

  const loadDetail = useCallback((pro: any) => {
    setSelected(pro);
    setTab(0);
    setDetail(null);
    setDetailLoading(true);
    setProInvestigations([]);
    fetch(`/api/admin/pros?id=${pro.id}`).then(r => r.json()).then(setDetail).catch(() => {}).finally(() => setDetailLoading(false));
    loadProInvestigations(pro.id);
  }, [loadProInvestigations]);

  const callAction = async (payload: Record<string, string>) => {
    const r = await fetch("/api/admin/pros/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.json();
  };

  const openConfirm = (title: string, message: string, onConfirm: (reason?: string) => void, opts?: { danger?: boolean; withReason?: boolean }) => {
    setModalReason("");
    setConfirmModal({ title, message, danger: opts?.danger, withReason: opts?.withReason, onConfirm });
  };

  const handleAction = (action: string, label: string, confirm_msg?: string, opts?: { danger?: boolean }) => {
    if (!confirm_msg) {
      callAction({ action, proId: selected?.id }).then(d => {
        if (d.success) { showMsg(d.message); reloadList(); if (selected) loadDetail(selected); }
        else showMsg(`Erreur : ${d.error}`);
      });
      return;
    }
    openConfirm(label, confirm_msg, async () => {
      const d = await callAction({ action, proId: selected?.id });
      if (d.success) { showMsg(d.message); reloadList(); if (selected) loadDetail(selected); }
      else showMsg(`Erreur : ${d.error}`);
      setConfirmModal(null);
    }, opts);
  };

  const handleVerifyDoc = async (docId: string, status: string) => {
    const d = await callAction({ action: "update_verification_doc", docId, status });
    if (d.success) { showMsg(d.message); reloadList(); if (selected) loadDetail(selected); }
    else showMsg(`Erreur : ${d.error}`);
  };

  // ── Filtered list ──
  const pros = (data?.pros ?? []).filter((p: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.prenom} ${p.nom}`.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.specialite ?? "").toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (!activeFilter) return true;
    const fq = filterToQuery[activeFilter];
    if (!fq) return true;
    if (fq.verificationStatus) return p.verificationStatus === fq.verificationStatus;
    if (fq.accountStatus) return p.accountStatus === fq.accountStatus;
    return true;
  });

  const st = data?.stats ?? {};

  // ── Risk score (derived) ──
  const riskScore = (p: any) => {
    let score = 0;
    if (p._count?.securityAlerts > 0) score += 40;
    if (p.accountStatus === "suspended") score += 60;
    if (p.accountStatus === "compliance_review") score += 50;
    if (p.verificationStatus === "rejected") score += 30;
    return Math.min(score, 100);
  };

  const TABS = ["Vue générale", "Vérification", "Athlètes liés", "Comportement", "Enquêtes"];
  const [proInvestigations, setProInvestigations] = useState<any[]>([]);

  return (
    <div style={{ color: "#1e293b", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.02em" }}>Professionnels</h1>
        <p style={{ margin: "0.1rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>Vérifier, gérer et surveiller les professionnels</p>
      </div>

      {/* Stats bar */}
      <div className="admin-stats-row" style={{ marginBottom: "1rem" }}>
        {[
          { label: "Professionnels actifs", value: st.total ?? "...", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>, color: "#2563eb" },
          { label: "En attente", value: st.pending ?? "...", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, color: "#f59e0b" },
          { label: "Suspendus", value: st.suspended ?? "...", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>, color: "#ef4444" },
          { label: "Signalements", value: st.alerts ?? "...", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>, color: "#dc2626" },
          { label: "Dossiers vérifiés", value: st.verified ?? "...", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, color: "#16a34a" },
          { label: "Risque élevé", value: (data?.pros ?? []).filter((p: any) => riskScore(p) > 70).length, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, color: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "0.75rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
              {s.icon}
              <span style={{ fontSize: "0.65rem", color: "#64748b" }}>{s.label}</span>
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="admin-detail-layout" style={{ alignItems: "start" }}>

        {/* ── LEFT: List panel ── */}
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ padding: "0.75rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.5rem" }}>Liste des professionnels</div>
            {/* Search + filter row */}
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.4rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.3rem 0.6rem" }}>
                <span style={{ color: "#94a3b8" }}>{SVG.search}</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou email..." style={{ flex: 1, border: "none", outline: "none", fontSize: "0.75rem", background: "transparent" }} />
              </div>
              <button onClick={() => setShowFilters(v => !v)} style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.3rem 0.6rem", borderRadius: "7px", border: activeFilter ? "1px solid #2563eb" : "1px solid #e2e8f0", background: activeFilter ? "#dbeafe" : "#f8fafc", fontSize: "0.7rem", color: activeFilter ? "#1d4ed8" : "#475569", cursor: "pointer" }}>
                {SVG.filter} Filtres {activeFilter && <span style={{ background: "#2563eb", color: "#fff", fontSize: "0.58rem", fontWeight: 700, borderRadius: "99px", padding: "0 4px", lineHeight: "14px" }}>1</span>}
              </button>
              <button onClick={() => { setLoading(true); reloadList(); setTimeout(() => setLoading(false), 500); }} style={{ padding: "0.3rem 0.5rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#475569" }}>{SVG.refresh}</button>
            </div>
            {/* Status filter chips */}
            {showFilters && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {STATUS_FILTERS.map(f => (
                  <button key={f} onClick={() => setActiveFilter(activeFilter === f ? null : f)} style={{ padding: "2px 10px", borderRadius: "9999px", fontSize: "0.67rem", fontWeight: 500, cursor: "pointer", border: activeFilter === f ? "1px solid #2563eb" : "1px solid #e2e8f0", background: activeFilter === f ? "#dbeafe" : "#f8fafc", color: activeFilter === f ? "#1d4ed8" : "#475569" }}>{f}</button>
                ))}
                {activeFilter && <button onClick={() => setActiveFilter(null)} style={{ border: "none", background: "none", color: "#dc2626", fontSize: "0.67rem", cursor: "pointer", padding: "2px 4px" }}>Effacer</button>}
              </div>
            )}
          </div>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 50px 50px", gap: 0, padding: "0.35rem 0.75rem", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            {["Nom / Email", "Statut", "Athlètes", "Signal.", "Risque"].map(h => (
              <span key={h} style={{ fontSize: "0.6rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
            ))}
          </div>
          {/* Rows */}
          <div style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
            {loading && <p style={{ padding: "1rem", fontSize: "0.78rem", color: "#94a3b8" }}>Chargement...</p>}
            {!loading && pros.length === 0 && <p style={{ padding: "1rem", fontSize: "0.78rem", color: "#94a3b8" }}>Aucun professionnel.</p>}
            {pros.map((p: any) => {
              const isActive = selected?.id === p.id;
              const risk = riskScore(p);
              const lastConn = p.authSessions?.[0]?.lastActiveAt;
              return (
                <div key={p.id} onClick={() => loadDetail(p)} style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 50px 50px", gap: 0, padding: "0.45rem 0.75rem", borderBottom: "1px solid #f8fafc", background: isActive ? "#eff6ff" : "transparent", cursor: "pointer", borderLeft: isActive ? "3px solid #2563eb" : "3px solid transparent" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                      {p.prenom} {p.nom}
                    </div>
                    <div style={{ fontSize: "0.63rem", color: "#94a3b8", marginTop: "1px" }}>{p.email}</div>
                    <div style={{ fontSize: "0.62rem", color: "#64748b" }}>{p.professionAffichee ?? p.specialite}</div>
                    <div style={{ fontSize: "0.6rem", color: "#b0bec5", marginTop: "1px" }}>Dern. co. {lastConn ? timeAgo(lastConn) : "—"}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", justifyContent: "center" }}>
                    <VerifBadge status={p.verificationStatus} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
                    {p._count?.connectionsAsPro ?? 0}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: p._count?.securityAlerts > 0 ? "#dc2626" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
                    {p._count?.securityAlerts ?? 0}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <RiskBadge score={risk} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid #f1f5f9", fontSize: "0.65rem", color: "#94a3b8" }}>
            {pros.length} professionnel{pros.length !== 1 ? "s" : ""} affichés
          </div>
        </div>

        {/* ── RIGHT: Detail panel ── */}
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", minHeight: "400px", position: "relative" }}>
          {!selected && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", color: "#94a3b8", fontSize: "0.82rem" }}>
              Sélectionnez un professionnel pour voir sa fiche
            </div>
          )}
          {selected && (
            <>
              {/* Detail header */}
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.1rem", fontWeight: 700, flexShrink: 0 }}>
                    {selected.prenom?.[0]}{selected.nom?.[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Fiche professionnel — {selected.prenom} {selected.nom}</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{selected.professionAffichee ?? selected.specialite} · {selected.email}</div>
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.25rem" }}>
                      <VerifBadge status={selected.verificationStatus} />
                      <AccountBadge status={selected.accountStatus} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="admin-tabs-row" style={{ borderBottom: "1px solid #f1f5f9", padding: "0 1.25rem" }}>
                {TABS.map((t, i) => (
                  <button key={t} onClick={() => setTab(i)} style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", fontWeight: tab === i ? 600 : 400, color: tab === i ? "#2563eb" : "#64748b", background: "none", border: "none", borderBottom: tab === i ? "2px solid #2563eb" : "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap" }}>{t}</button>
                ))}
              </div>

              {detailLoading && <p style={{ padding: "1rem", color: "#94a3b8", fontSize: "0.78rem" }}>Chargement...</p>}

              {detail && !detailLoading && (
                <div style={{ padding: "1rem 1.25rem", maxHeight: "calc(100vh - 420px)", overflowY: "auto" }}>

                  {/* ─ Tab 0: Vue générale ─ */}
                  {tab === 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
                      <div>
                        <SectionTitle>Identité</SectionTitle>
                        <DRow label="Nom" value={`${detail.prenom} ${detail.nom}`} />
                        <DRow label="Profession" value={detail.professionAffichee ?? "—"} />
                        <DRow label="Numéro prof." value={detail.numeroVerification} />
                        <DRow label="Spécialité" value={detail.specialiteAffichee ?? detail.specialite} />
                        <DRow label="Email" value={detail.email} />
                        <DRow label="Téléphone" value={detail.telephone} />
                        <DRow label="Structure" value={detail.adresseCabinet ?? "—"} />
                        <DRow label="Statut exercice" value={detail.statutExercice} />
                        <DRow label="MFA activée" value={detail.twoFactorEnabled ? "Oui" : "Non"} />
                      </div>
                      <div>
                        <SectionTitle>Activité</SectionTitle>
                        {(() => {
                          const sessions = detail.authSessions ?? [];
                          const docs = detail.docsSent ?? [];
                          const connections = detail.connectionsAsPro ?? [];
                          const alerts = detail.securityAlerts ?? [];
                          const now = Date.now();
                          const d30 = 30 * 24 * 60 * 60 * 1000;
                          const d7 = 7 * 24 * 60 * 60 * 1000;
                          // Sessions actives (non révoquées, non expirées)
                          const activeSessions = sessions.filter((s: any) => !s.revoked && new Date(s.expiresAt) > new Date());
                          // Dernière connexion
                          const lastSession = sessions[0]?.lastActiveAt;
                          // Sessions dans les 30 derniers jours
                          const sessions30d = sessions.filter((s: any) => now - new Date(s.createdAt).getTime() < d30).length;
                          // Documents cette semaine
                          const docs7d = docs.filter((d: any) => now - new Date(d.createdAt).getTime() < d7).length;
                          // Documents lus (avec readAt)
                          const docsRead = docs.filter((d: any) => d.readAt).length;
                          // Athlètes actifs (connectés)
                          const activeAthletes = connections.filter((c: any) => c.status === "connecte").length;
                          // Taux d'activité: basé sur connexions récentes
                          const daysSinceCreation = Math.max(1, Math.floor((now - new Date(detail.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
                          const activityRate = Math.min(100, Math.round((sessions.length / Math.min(daysSinceCreation, 90)) * 100));
                          return (
                            <>
                              <DRow label="Statut vérification" value={VERIF_LABELS[detail.verificationStatus]?.label ?? detail.verificationStatus} />
                              <DRow label="Statut compte" value={ACCOUNT_LABELS[detail.accountStatus]?.label ?? detail.accountStatus} />
                              <DRow label="Inscrit le" value={fmtDate(detail.createdAt)} />
                              <DRow label="Vérifié le" value={fmtDate(detail.verifiedAt)} />
                              <DRow label="Dernière connexion" value={lastSession ? timeAgo(lastSession) : "Jamais"} />
                              <DRow label="Sessions actives" value={String(activeSessions.length)} />
                              <DRow label="Connexions (30j)" value={String(sessions30d)} />
                              <DRow label="Taux d'activité" value={`${activityRate}%`} />
                              <DRow label="Athlètes actifs" value={`${activeAthletes} / ${connections.length}`} />
                              <DRow label="Docs envoyés (total)" value={String(docs.length)} />
                              <DRow label="Docs cette semaine" value={String(docs7d)} />
                              <DRow label="Docs consultés" value={`${docsRead} / ${docs.length}`} />
                              <DRow label="Signalements" value={String(alerts.length)} accent={alerts.filter((a: any) => !a.resolved).length > 0} />
                              <DRow label="Visible annuaire" value={detail.searchable ? "Oui" : "Non"} />
                            </>
                          );
                        })()}
                      </div>
                      <div>
                        <SectionTitle>Actions rapides</SectionTitle>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.25rem" }}>
                          {detail.accountStatus !== "suspended" ? (
                            <ActBtn label="Suspendre" icon={SVG.suspend} danger onClick={() => handleAction("suspend", "Suspendre le compte", `Êtes-vous sûr de vouloir suspendre le compte de ${detail.prenom} ${detail.nom} ? Un email de notification sera envoyé.`, { danger: true })} />
                          ) : (
                            <ActBtn label="Lever la suspension" icon={SVG.check} onClick={() => handleAction("unsuspend", "Lever la suspension", `Réactiver le compte de ${detail.prenom} ${detail.nom} ? Un email sera envoyé.`)} />
                          )}
                          {detail.accountStatus !== "restricted" && detail.accountStatus !== "suspended" && (
                            <ActBtn label="Restreindre les accès" icon={SVG.eye} onClick={() => handleAction("restrict", "Restreindre les accès", `Restreindre les accès de ${detail.prenom} ${detail.nom} ? Un email sera envoyé.`)} />
                          )}
                          <ActBtn label="Demander revalidation" icon={SVG.warning} onClick={() => handleAction("request_revalidation", "Demander une revalidation", `Demander une revalidation du dossier de ${detail.prenom} ${detail.nom} ? Un email sera envoyé.`)} />
                          <ActBtn label="Déconnecter les sessions" icon={SVG.eye} onClick={() => handleAction("disconnect_all_sessions", "Déconnecter les sessions", `Révoquer toutes les sessions actives de ${detail.prenom} ${detail.nom} ? Un email sera envoyé.`)} />
                          <ActBtn label="Révoquer toutes les connexions" icon={SVG.x} danger onClick={() => handleAction("revoke_all_connections", "Révoquer toutes les connexions", `Révoquer TOUTES les connexions athlètes de ${detail.prenom} ${detail.nom} ? Ce professionnel perdra l'accès aux données de tous ses patients. Un email sera envoyé.`, { danger: true })} />
                          <ActBtn label="Bloquer les téléchargements" icon={SVG.download} danger onClick={() => handleAction("block_downloads", "Bloquer les téléchargements", `Bloquer tous les accès aux téléchargements pour ${detail.prenom} ${detail.nom} ? Un email sera envoyé.`, { danger: true })} />
                          <ActBtn label="Ouvrir une enquête" icon={SVG.shield} danger onClick={() => handleAction("open_investigation", "Ouvrir une enquête", `Ouvrir une enquête interne sur ${detail.prenom} ${detail.nom} ? Le statut passera en revue de conformité et un email sera envoyé.`, { danger: true })} />
                          <ActBtn label="Supprimer le compte (RGPD)" icon={SVG.x} danger onClick={() => handleAction("delete_account", "Supprimer le compte", `⚠️ SUPPRIMER le compte de ${detail.prenom} ${detail.nom} ? Cette action est irréversible (Art. 17 RGPD). Toutes les sessions seront révoquées et un email sera envoyé.`, { danger: true })} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─ Tab 1: Vérification ─ */}
                  {tab === 1 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                      <div>
                        <SectionTitle>Documents fournis</SectionTitle>
                        {(detail.verificationDocs ?? []).length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun document fourni.</p>}
                        {(detail.verificationDocs ?? []).map((doc: any) => (
                          <div key={doc.id} style={{ padding: "0.5rem 0.6rem", borderRadius: "8px", border: "1px solid #f1f5f9", marginBottom: "0.4rem", background: "#fafafa" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>{doc.label}</div>
                                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{doc.type} · {fmtDate(doc.createdAt)}</div>
                                {doc.note && <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: "2px" }}>{doc.note}</div>}
                                {doc.aiVerified !== null && <div style={{ fontSize: "0.62rem", color: doc.aiVerified ? "#16a34a" : "#dc2626" }}>IA : {doc.aiVerified ? "✓ Approuvé" : "✗ Signalé"} ({doc.aiConfidence?.toFixed(0) ?? "?"}%)</div>}
                              </div>
                              <div style={{ display: "flex", gap: "0.3rem", flexDirection: "column" }}>
                                <VerifBadge status={doc.status} />
                                <div style={{ display: "flex", gap: "0.25rem" }}>
                                  <button onClick={() => handleVerifyDoc(doc.id, "accepted")} style={{ background: "#dcfce7", color: "#16a34a", border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "0.62rem", cursor: "pointer" }}>✓</button>
                                  <button onClick={() => handleVerifyDoc(doc.id, "rejected")} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "0.62rem", cursor: "pointer" }}>✗</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <SectionTitle>Statut global de vérification</SectionTitle>
                        <DRow label="Statut" value={VERIF_LABELS[detail.verificationStatus]?.label} />
                        <DRow label="Note interne" value={detail.verificationNote} />
                        <DRow label="Date de validation" value={fmtDate(detail.verifiedAt)} />
                        <SectionTitle>Actions vérification</SectionTitle>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          <ActBtn label="Valider le dossier" icon={SVG.check} onClick={() => handleAction("verify", "Valider le dossier", `Valider le dossier professionnel de ${detail.prenom} ${detail.nom} ? Un email de confirmation sera envoyé.`)} />
                          <ActBtn label="Rejeter le dossier" icon={SVG.x} danger onClick={() => handleAction("reject", "Rejeter le dossier", `Rejeter le dossier de ${detail.prenom} ${detail.nom} ? Un email sera envoyé.`, { danger: true })} />
                          <ActBtn label="Demander revalidation" icon={SVG.warning} onClick={() => handleAction("request_revalidation", "Demander une revalidation", `Demander une nouvelle vérification du dossier de ${detail.prenom} ${detail.nom} ?`)} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─ Tab 2: Athlètes liés ─ */}
                  {tab === 2 && (
                    <div>
                      <SectionTitle>Relations avec les athlètes</SectionTitle>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                            {["Athlète", "Type d'accès", "Début", "Dernière activité", "Statut"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.5rem", fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(detail.connectionsAsPro ?? []).map((c: any) => (
                            <tr key={c.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                              <td style={{ padding: "0.4rem 0.5rem", fontWeight: 500 }}>
                                {c.athlete?.athleteUser ? `${c.athlete.athleteUser.prenom} ${c.athlete.athleteUser.nom[0]}.` : c.athlete?.name ?? "—"}
                              </td>
                              <td style={{ padding: "0.4rem 0.5rem", color: "#64748b" }}>{c.role}</td>
                              <td style={{ padding: "0.4rem 0.5rem", color: "#64748b" }}>{fmtDate(c.createdAt)}</td>
                              <td style={{ padding: "0.4rem 0.5rem", color: "#64748b" }}>{fmtDate(c.updatedAt)}</td>
                              <td style={{ padding: "0.4rem 0.5rem" }}>
                                <span style={{ background: c.status === "connecte" ? "#dcfce7" : c.status === "en_attente" ? "#fef3c7" : "#fee2e2", color: c.status === "connecte" ? "#16a34a" : c.status === "en_attente" ? "#d97706" : "#dc2626", fontSize: "0.62rem", fontWeight: 600, padding: "2px 7px", borderRadius: "9999px" }}>
                                  {c.status === "connecte" ? "Actif" : c.status === "en_attente" ? "En attente" : "Révoqué"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(detail.connectionsAsPro ?? []).length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8", padding: "0.5rem 0" }}>Aucun athlète lié.</p>}
                    </div>
                  )}

                  {/* ─ Tab 3: Comportement ─ */}
                  {tab === 3 && detail && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                      <div>
                        <SectionTitle>Statistiques d'accès</SectionTitle>
                        {(() => {
                          const sessions = detail.authSessions ?? [];
                          const docs = detail.docsSent ?? [];
                          const alerts = detail.securityAlerts ?? [];
                          const now = Date.now();
                          const d7 = 7 * 24 * 60 * 60 * 1000;
                          const d30 = 30 * 24 * 60 * 60 * 1000;
                          const activeSessions = sessions.filter((s: any) => !s.revoked && new Date(s.expiresAt) > new Date());
                          const sessions7d = sessions.filter((s: any) => now - new Date(s.createdAt).getTime() < d7).length;
                          const docs30d = docs.filter((d: any) => now - new Date(d.createdAt).getTime() < d30).length;
                          const docsDeleted = docs.filter((d: any) => d.deletedAt).length;
                          const unresolvedAlerts = alerts.filter((a: any) => !a.resolved).length;
                          // Unique IPs
                          const uniqueIPs = new Set(sessions.map((s: any) => s.ip).filter(Boolean)).size;
                          return (
                            <>
                              <DRow label="Sessions actives" value={String(activeSessions.length)} />
                              <DRow label="Connexions (7j)" value={String(sessions7d)} />
                              <DRow label="IPs distinctes" value={String(uniqueIPs)} accent={uniqueIPs > 5} />
                              <DRow label="Documents envoyés (30j)" value={String(docs30d)} />
                              <DRow label="Documents supprimés" value={String(docsDeleted)} accent={docsDeleted > 0} />
                              <DRow label="Signalements reçus" value={String(alerts.length)} />
                              <DRow label="Signalements non résolus" value={String(unresolvedAlerts)} accent={unresolvedAlerts > 0} />
                            </>
                          );
                        })()}
                        <SectionTitle>Sessions récentes</SectionTitle>
                        {(detail.authSessions ?? []).slice(0, 5).map((s: any) => (
                          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0", borderBottom: "1px solid #f8fafc" }}>
                            <span style={{ fontSize: "0.7rem" }}>{s.deviceName ?? "Appareil inconnu"}</span>
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                              <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{s.ip ?? "—"}</span>
                              <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{timeAgo(s.lastActiveAt)}</span>
                              <span style={{ background: s.revoked ? "#fee2e2" : "#dcfce7", color: s.revoked ? "#dc2626" : "#16a34a", fontSize: "0.6rem", fontWeight: 600, padding: "1px 5px", borderRadius: "9999px" }}>{s.revoked ? "Révoquée" : "Active"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <SectionTitle>Alertes sécurité</SectionTitle>
                        {(detail.securityAlerts ?? []).length === 0 && <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucune alerte.</p>}
                        {(detail.securityAlerts ?? []).slice(0, 8).map((a: any) => (
                          <div key={a.id} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", padding: "0.3rem 0", borderBottom: "1px solid #f8fafc" }}>
                            <span style={{ fontSize: "0.62rem" }}>{a.resolved ? "✓" : "⚠"}</span>
                            <div>
                              <div style={{ fontSize: "0.7rem", fontWeight: 500 }}>{a.message}</div>
                              <div style={{ fontSize: "0.62rem", color: "#94a3b8" }}>{fmtDateTime(a.createdAt)} · {a.ip ?? "—"}</div>
                            </div>
                          </div>
                        ))}
                        <SectionTitle>Actions comportement</SectionTitle>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          <ActBtn label="Déconnecter les sessions" icon={SVG.eye} onClick={() => handleAction("disconnect_all_sessions", "Déconnecter les sessions", `Révoquer toutes les sessions actives de ${detail.prenom} ${detail.nom} ?`)} />
                          <ActBtn label="Révoquer toutes les connexions" icon={SVG.x} danger onClick={() => handleAction("revoke_all_connections", "Révoquer toutes les connexions", `Révoquer TOUTES les connexions athlètes de ${detail.prenom} ${detail.nom} ?`, { danger: true })} />
                          <ActBtn label="Bloquer les téléchargements" icon={SVG.download} danger onClick={() => handleAction("block_downloads", "Bloquer les téléchargements", `Bloquer les accès de ${detail.prenom} ${detail.nom} ?`, { danger: true })} />
                          <ActBtn label="Ouvrir une enquête" icon={SVG.shield} danger onClick={() => handleAction("open_investigation", "Ouvrir une enquête", `Ouvrir une enquête interne sur ${detail.prenom} ${detail.nom} ?`, { danger: true })} />
                          <ActBtn label="Supprimer le compte (RGPD)" icon={SVG.x} danger onClick={() => handleAction("delete_account", "Supprimer le compte", `⚠️ SUPPRIMER le compte de ${detail.prenom} ${detail.nom} ? Irréversible.`, { danger: true })} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─ Tab 4: Enquêtes ─ */}
                  {tab === 4 && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                        <SectionTitle>Investigations liées</SectionTitle>
                        <button onClick={() => { window.open(`/admin/tickets`, "_blank"); }} style={{ padding: "0.3rem 0.7rem", borderRadius: "6px", border: "1px solid #7c3aed", background: "#ede9fe", color: "#7c3aed", fontSize: "0.68rem", fontWeight: 600, cursor: "pointer" }}>Voir toutes →</button>
                      </div>
                      {proInvestigations.length === 0 ? (
                        <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucune enquête ouverte pour ce professionnel.</p>
                      ) : proInvestigations.map((inv: any) => (
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
                      <div style={{ marginTop: "1rem" }}>
                        <ActBtn label="Ouvrir une enquête" icon={SVG.shield} danger onClick={() => handleAction("open_investigation", "Ouvrir une enquête", `Ouvrir une enquête interne sur ${detail.prenom} ${detail.nom} ?`, { danger: true })} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {actionMsg && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", background: "#1e293b", color: "#fff", padding: "0.6rem 1rem", borderRadius: "8px", fontSize: "0.78rem", zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
          {actionMsg}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)" }} onClick={() => setConfirmModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", width: "400px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: "10px", background: confirmModal.danger ? "#fee2e2" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={confirmModal.danger ? "#dc2626" : "#2563eb"} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{confirmModal.title}</div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Action administrative</div>
              </div>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.5, marginBottom: "1rem" }}>{confirmModal.message}</p>
            {confirmModal.withReason && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "0.3rem" }}>Raison (optionnel)</label>
                <input value={modalReason} onChange={e => setModalReason(e.target.value)} placeholder="Précisez la raison..." style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", outline: "none" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.78rem", cursor: "pointer", fontWeight: 500, color: "#475569" }}>Annuler</button>
              <button onClick={() => confirmModal.onConfirm(modalReason || undefined)} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "none", background: confirmModal.danger ? "#dc2626" : "#2563eb", color: "#fff", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600 }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
