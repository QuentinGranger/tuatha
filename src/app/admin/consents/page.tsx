"use client";
import React, { useState, useEffect, useCallback } from "react";

// ─── SVG Icons (inline, no dependencies) ────────────────────────────────────────
const Icon = ({ d, color = "currentColor", size = 16 }: { d: string; color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const Icons = {
  link:       (c?: string) => <Icon d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" color={c} />,
  xCircle:    (c?: string) => <Icon d="M18 6 6 18M6 6l12 12" color={c} />,
  heart:      (c?: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill={c ?? "currentColor"} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  megaphone:  (c?: string) => <Icon d="M3 11l18-5v12L3 13v-2zM11.6 16.8a3 3 0 1 1-5.8-1.6" color={c} />,
  arrowDown:  (c?: string) => <Icon d="M12 5v14M19 12l-7 7-7-7" color={c} />,
  clock:      (c?: string) => <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2" color={c} />,
  refresh:    (c?: string) => <Icon d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" color={c} />,
  search:     (c?: string) => <Icon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" color={c} />,
  history:    (c?: string) => <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2" color={c} />,
  pause:      (c?: string) => <Icon d="M6 4h4v16H6zM14 4h4v16h-4z" color={c} />,
  play:       (c?: string) => <Icon d="M5 3l14 9-14 9V3z" color={c} />,
  download:   (c?: string) => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" color={c} />,
  shield:     (c?: string) => <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" color={c} />,
  xShield:    (c?: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>,
  check:      (c?: string) => <Icon d="M20 6 9 17l-5-5" color={c} />,
  x:          (c?: string) => <Icon d="M18 6 6 18M6 6l12 12" color={c} />,
  file:       (c?: string) => <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" color={c} />,
  activity:   (c?: string) => <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" color={c} />,
  userPlus:   (c?: string) => <Icon d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM20 8v6M23 11h-6" color={c} />,
};

// ─── Constants ──────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  accepted:  { label: "Actif",      color: "#16a34a", bg: "#dcfce7" },
  pending:   { label: "En attente", color: "#d97706", bg: "#fef3c7" },
  rejected:  { label: "Révoqué",    color: "#dc2626", bg: "#fee2e2" },
};

const DETAIL_TABS = ["Vue générale", "Historique", "Preuve de consentement", "Activité"] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────────
function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return <span style={{ background: bg, color, fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", whiteSpace: "nowrap" }}>{text}</span>;
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
function athleteName(share: any) {
  if (share?.athleteUser) return `${share.athleteUser.prenom ?? ""} ${share.athleteUser.nom ?? ""}`.trim() || share?.athlete?.name || "—";
  return share?.athlete?.name ?? "—";
}
function proName(share: any) {
  const p = share?.professionnel ?? share?.connectedPro ?? share?.ownerPro;
  return p ? `${p.prenom} ${p.nom}` : "—";
}
function getSharedTypes(share: any): string {
  if (share.readBlessures !== undefined) {
    const types: string[] = [];
    if (share.readBlessures) types.push("Blessures");
    if (share.readDocuments) types.push("Docs médicaux");
    if (share.readProgramme) types.push("Performance");
    if (share.readIndicateurs) types.push("Nutrition");
    if (share.writeNote) types.push("Messagerie");
    return types.length > 0 ? types.join(", ") : "Aucun";
  }
  const types: string[] = [];
  if (share.consentement) types.push("Données santé");
  if (share.consentementPartage) types.push("Partage pro");
  const spec = share.professionnel?.specialite;
  if (spec === "kine") types.push("Blessures, Rééducation");
  else if (spec === "nutri") types.push("Nutrition");
  else if (spec === "coach") types.push("Performance");
  else if (spec === "medecin") types.push("Docs médicaux");
  else if (spec) types.push(spec);
  return types.length > 0 ? types.join(", ") : "Données de base";
}

function exportConsentProof(detail: any) {
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const statusLabel: Record<string, string> = { accepted: "Accepté", pending: "En attente", rejected: "Refusé", revoked: "Révoqué" };
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Preuve de consentement</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px 50px;color:#1e293b;font-size:13px;line-height:1.6}
  .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f47b20;padding-bottom:16px;margin-bottom:32px}
  .logo{font-size:22px;font-weight:800;color:#f47b20}
  .subtitle{font-size:11px;color:#64748b}
  h1{font-size:18px;font-weight:700;margin-bottom:8px;color:#0f172a}
  .badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600}
  .section{margin-bottom:24px}
  .section-title{font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;margin-bottom:8px;border-bottom:1px solid #f1f5f9;padding-bottom:4px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .field{margin-bottom:10px}
  .field-label{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px}
  .field-value{font-size:13px;color:#1e293b;font-weight:500}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  .stamp{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-top:24px;text-align:center}
  .stamp-title{font-size:11px;font-weight:700;color:#16a34a}
  @media print{body{padding:20px 30px}}
</style></head>
<body>
  <div class="header">
    <div><div class="logo">Tuatha</div><div class="subtitle">Plateforme de suivi interprofessionnel</div></div>
    <div style="text-align:right"><div style="font-size:11px;color:#64748b">Preuve de consentement</div><div style="font-size:10px;color:#94a3b8">ID: ${detail.id.slice(0, 8)}</div></div>
  </div>
  <h1>Attestation de consentement de partage de données</h1>
  <p style="color:#64748b;margin-bottom:24px;font-size:12px">Document généré automatiquement — valeur probante conformément au RGPD (Art. 7)</p>

  <div class="section">
    <div class="section-title">Athlète (personne concernée)</div>
    <div class="grid">
      <div class="field"><div class="field-label">Nom</div><div class="field-value">${athleteName(detail)}</div></div>
      <div class="field"><div class="field-label">Email</div><div class="field-value">${detail.athleteUser?.email ?? "—"}</div></div>
      <div class="field"><div class="field-label">Consentement général</div><div class="field-value">${detail.athlete?.consentement ? "✓ Accordé" : "✗ Non accordé"}</div></div>
      <div class="field"><div class="field-label">Date consentement</div><div class="field-value">${fmtDate(detail.athlete?.consentementDate)}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Professionnel (destinataire)</div>
    <div class="grid">
      <div class="field"><div class="field-label">Nom</div><div class="field-value">${proName(detail)}</div></div>
      <div class="field"><div class="field-label">Email</div><div class="field-value">${detail.professionnel?.email ?? "—"}</div></div>
      <div class="field"><div class="field-label">Spécialité</div><div class="field-value">${detail.professionnel?.specialite ?? "—"}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Détails du consentement</div>
    <div class="grid">
      <div class="field"><div class="field-label">Statut</div><div class="field-value">${statusLabel[detail.status] ?? detail.status}</div></div>
      <div class="field"><div class="field-label">Initié par</div><div class="field-value">${detail.requestedBy === "athlete" ? "Athlète" : "Professionnel"}</div></div>
      <div class="field"><div class="field-label">Date de la demande</div><div class="field-value">${fmtDate(detail.createdAt)}</div></div>
      <div class="field"><div class="field-label">Date de réponse</div><div class="field-value">${fmtDate(detail.respondedAt)}</div></div>
    </div>
  </div>

  <div class="stamp">
    <div class="stamp-title">✓ Document certifié conforme</div>
    <div style="font-size:10px;color:#64748b;margin-top:4px">Exporté le ${new Date().toLocaleString("fr-FR")} — Réf. ${detail.id}</div>
  </div>

  <div class="footer">
    <p>Tuatha SAS — France — Ce document atteste de la traçabilité du consentement conformément au Règlement Général sur la Protection des Données (UE 2016/679).</p>
    <p style="margin-top:4px">Document non modifiable — Toute altération invalide cette attestation.</p>
  </div>
</body></html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function ConsentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const showMsg = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(null), 3500); };

  const loadData = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/consents")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailTab(0);
    try {
      const r = await fetch(`/api/admin/consents?id=${id}`);
      const d = await r.json();
      setDetail(d);
    } catch { showMsg("Erreur de chargement."); }
    setDetailLoading(false);
  };

  const callAction = async (payload: any) => {
    const r = await fetch("/api/admin/consents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.json();
  };

  const handleSuspend = async (shareId: string) => {
    if (!confirm("Suspendre ce partage ? L'accès aux données sera bloqué.")) return;
    const d = await callAction({ action: "suspend_share", shareId });
    if (d.success) { showMsg(d.message); loadData(); loadDetail(shareId); }
    else showMsg(`Erreur: ${d.error}`);
  };

  const handleRevoke = async (shareId: string) => {
    const reason = prompt("Motif de révocation (sur demande vérifiée de l'athlète) :");
    if (!reason) return;
    const d = await callAction({ action: "revoke_share", shareId, reason });
    if (d.success) { showMsg(d.message); loadData(); loadDetail(shareId); }
    else showMsg(`Erreur: ${d.error}`);
  };

  const handleReactivate = async (shareId: string) => {
    if (!confirm("Réactiver ce partage ?")) return;
    const d = await callAction({ action: "reactivate_share", shareId });
    if (d.success) { showMsg(d.message); loadData(); loadDetail(shareId); }
    else showMsg(`Erreur: ${d.error}`);
  };

  const shares = (data?.shares ?? []).filter((s: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || athleteName(s).toLowerCase().includes(q) || proName(s).toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const kpis = data?.kpis;

  return (
    <div style={{ color: "#1e293b" }}>
      {/* ── Header ── */}
      <div className="admin-tickets-header">
        <div>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>Consentements & Partages</h1>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>Voir qui partage quoi avec qui.</p>
        </div>
        <button onClick={loadData} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "0.78rem", cursor: "pointer" }}>
          {Icons.refresh("#64748b")} Actualiser
        </button>
      </div>

      {/* ── KPIs ── */}
      {kpis && (
        <div className="admin-consents-kpis">
          {[
            { label: "Partages actifs",              value: kpis.active,             color: "#16a34a", icon: Icons.link("#16a34a") },
            { label: "Partages révoqués",            value: kpis.rejected,           color: "#dc2626", icon: Icons.xCircle("#dc2626") },
            { label: "Consentements santé actifs",   value: kpis.healthConsents,     color: "#0891b2", icon: Icons.heart("#0891b2") },
            { label: "Consentements marketing",      value: kpis.marketingConsents,  color: "#7c3aed", icon: Icons.megaphone("#7c3aed") },
            { label: "Retraits récents",             value: kpis.recentRevocations,  color: "#dc2626", icon: Icons.arrowDown("#dc2626") },
            { label: "En attente",                   value: kpis.pending,            color: "#d97706", icon: Icons.clock("#d97706") },
          ].map(k => (
            <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.7rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem", flex: "1 1 140px", minWidth: "140px" }}>
              <span style={{ display: "flex", alignItems: "center" }}>{k.icon}</span>
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Toast ── */}
      {actionMsg && (
        <div style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 9999, background: "#0f172a", color: "#fff", padding: "0.6rem 1.2rem", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>{actionMsg}</div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "180px", position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: "0.6rem", display: "flex" }}>{Icons.search("#94a3b8")}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par athlète ou professionnel..." style={{ width: "100%", padding: "0.45rem 0.75rem 0.45rem 2rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {[
            { key: "all",      label: "Tous" },
            { key: "accepted", label: "Actif" },
            { key: "rejected", label: "Révoqué" },
            { key: "pending",  label: "En attente" },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: statusFilter === f.key ? "1px solid #2563eb" : "1px solid #e2e8f0", background: statusFilter === f.key ? "#dbeafe" : "#fff", color: statusFilter === f.key ? "#2563eb" : "#64748b", fontSize: "0.7rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── Content: Table + Detail ── */}
      <div className={`admin-consents-content${detail ? " has-detail" : ""}`}>
        {/* ── Table ── */}
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div className="admin-consents-table-header">
            <span>Athlète</span>
            <span>Professionnel</span>
            <span>Type données</span>
            <span>Demandé par</span>
            <span>Accepté par</span>
            <span>Début</span>
            <span>Fin</span>
            <span>Statut</span>
            <span>Dernière modif.</span>
          </div>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Chargement...</div>
          ) : shares.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Aucun partage trouvé.</div>
          ) : shares.map((s: any) => {
            const st = STATUS_MAP[s.status] ?? STATUS_MAP.pending;
            return (
              <div key={s.id} onClick={() => { setSelected(s); loadDetail(s.id); }} className="admin-consents-table-row" style={{ background: selected?.id === s.id ? "#f0f7ff" : "transparent" }}>
                <span style={{ fontWeight: 600 }}>{athleteName(s)}</span>
                <span>{proName(s)}</span>
                <span style={{ fontSize: "0.65rem", color: "#475569" }}>{getSharedTypes(s)}</span>
                <span style={{ fontSize: "0.65rem" }}>{s.requestedBy === "athlete" ? "Athlète" : "Professionnel"}</span>
                <span style={{ fontSize: "0.65rem" }}>{s.status === "accepted" ? (s.requestedBy === "athlete" ? "Professionnel" : "Athlète") : "—"}</span>
                <span>{fmtDate(s.createdAt)}</span>
                <span>Non définie</span>
                <Badge text={st.label} color={st.color} bg={st.bg} />
                <span>{timeAgo(s.respondedAt ?? s.createdAt)}</span>
              </div>
            );
          })}
          {shares.length > 0 && (
            <div style={{ padding: "0.5rem 1rem", fontSize: "0.68rem", color: "#94a3b8", borderTop: "1px solid #f1f5f9" }}>
              Affichage de {shares.length} partage{shares.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {detail && !detailLoading && (
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", maxHeight: "82vh", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>Détail d&apos;un partage — {athleteName(detail)} × {proName(detail)}</h3>
                <button onClick={() => { setDetail(null); setSelected(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.1rem", lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.6rem", flexWrap: "wrap", fontSize: "0.72rem" }}>
                <div><span style={{ color: "#94a3b8" }}>Athlète:</span> <strong>{athleteName(detail)}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>Professionnel:</span> <strong>{proName(detail)}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>Statut:</span> <Badge text={STATUS_MAP[detail.status]?.label ?? detail.status} color={STATUS_MAP[detail.status]?.color ?? "#64748b"} bg={STATUS_MAP[detail.status]?.bg ?? "#f1f5f9"} /></div>
                <div><span style={{ color: "#94a3b8" }}>Début:</span> {fmtDate(detail.createdAt)}</div>
                <div><span style={{ color: "#94a3b8" }}>Fin:</span> Non définie</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", overflow: "auto" }}>
              {DETAIL_TABS.map((t, i) => (
                <button key={t} onClick={() => setDetailTab(i)} style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", fontWeight: detailTab === i ? 600 : 400, color: detailTab === i ? "#2563eb" : "#64748b", background: "none", border: "none", borderBottom: detailTab === i ? "2px solid #2563eb" : "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap" }}>{t}</button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: "1rem 1.25rem" }}>
              {detailTab === 0 && (
                <div className="admin-consents-detail-grid">
                  {/* Données visibles */}
                  <div>
                    <SectionTitle>Données visibles</SectionTitle>
                    {(() => {
                      const spec = detail.professionnel?.specialite;
                      const isKine = spec === "kine";
                      const isMed = spec === "medecin";
                      const isNutri = spec === "nutri";
                      const isCoach = spec === "coach";
                      const isActive = detail.status === "accepted";
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          <DataRow label="Blessures" value={isActive && (isKine || isMed)} />
                          <DataRow label="Documents médicaux" value={isActive && (isMed || isKine)} />
                          <DataRow label="Performance" value={isActive && (isCoach || isKine)} />
                          <DataRow label="Nutrition" value={isActive && isNutri} />
                          <DataRow label="Messagerie" value={isActive} />
                          <DataRow label="Paiements" value={false} />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Informations de consentement */}
                  <div>
                    <SectionTitle>Informations de consentement</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <InfoRow label="Consentement santé" value={detail.athlete?.consentement ? "Actif" : "Non"} accent={!detail.athlete?.consentement} />
                      <InfoRow label="Type de partage" value={detail.requestedBy === "athlete" ? "Initié par l'athlète" : "Initié par le professionnel"} />
                      <InfoRow label="Source" value={detail.athleteConsents?.length > 0 ? (detail.athleteConsents[0].method === "digital" ? "Signature numérique" : "Validation in-app") : "Validation in-app (connexion)"} />
                      <InfoRow label="Date de validation" value={fmtDate(detail.respondedAt ?? detail.createdAt)} />
                      <InfoRow label="Dernière mise à jour" value={fmtDate(detail.respondedAt ?? detail.createdAt)} />
                      <InfoRow label="Expiration" value="Non définie" />
                      <InfoRow label="Preuve disponible" value={detail.respondedAt ? "Oui" : "Non (en attente)"} accent={!detail.respondedAt} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    <SectionTitle>Actions</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <ActionBtn icon={Icons.history("#2563eb")} label="Voir historique" color="#2563eb" onClick={() => setDetailTab(1)} />
                      {detail.status === "accepted" && <ActionBtn icon={Icons.pause("#d97706")} label="Suspendre partage" color="#d97706" onClick={() => handleSuspend(detail.id)} />}
                      {(detail.status === "pending" || detail.status === "rejected") && <ActionBtn icon={Icons.play("#16a34a")} label="Réactiver le partage" color="#16a34a" onClick={() => handleReactivate(detail.id)} />}
                      <ActionBtn icon={Icons.download("#16a34a")} label="Exporter preuve de consentement" color="#16a34a" onClick={() => { exportConsentProof(detail); showMsg("Preuve téléchargée."); }} />
                      {detail.status !== "rejected" && (
                        <div>
                          <ActionBtn icon={Icons.xShield("#dc2626")} label="Révoquer le partage" color="#dc2626" onClick={() => handleRevoke(detail.id)} />
                          <div style={{ fontSize: "0.6rem", color: "#94a3b8", marginTop: "0.2rem", fontStyle: "italic", paddingLeft: "0.25rem" }}>Uniquement sur demande vérifiée de l&apos;athlète.</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Activité récente */}
                  <div>
                    <SectionTitle>Activité récente</SectionTitle>
                    {(() => {
                      const events: { icon: React.ReactNode; label: string; time: string }[] = [];
                      if (detail.respondedAt && detail.status === "accepted") {
                        events.push({ icon: Icons.check("#16a34a"), label: "Partage accepté", time: fmtDateTime(detail.respondedAt) });
                      }
                      if (detail.respondedAt && detail.status === "rejected") {
                        events.push({ icon: Icons.x("#dc2626"), label: "Partage révoqué", time: fmtDateTime(detail.respondedAt) });
                      }
                      events.push({ icon: Icons.userPlus("#2563eb"), label: `Demande envoyée par ${detail.requestedBy === "athlete" ? "l'athlète" : "le professionnel"}`, time: fmtDateTime(detail.createdAt) });
                      for (const log of (detail.consentLogs ?? []).slice(0, 4)) {
                        events.push({
                          icon: log.action === "granted" ? Icons.check("#16a34a") : log.action === "revoked" ? Icons.x("#dc2626") : Icons.activity("#94a3b8"),
                          label: `${log.consentType}: ${log.action}`,
                          time: fmtDateTime(log.createdAt),
                        });
                      }
                      return events.length === 0 ? (
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Aucune activité récente.</div>
                      ) : events.map((e, i) => (
                        <ActivityRow key={i} icon={e.icon} label={e.label} time={e.time} />
                      ));
                    })()}
                  </div>
                </div>
              )}

              {detailTab === 1 && (
                <div>
                  <SectionTitle>Historique des consentements</SectionTitle>
                  {(detail.consentLogs ?? []).length === 0 && (detail.athleteConsents ?? []).length === 0 ? (
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Aucun historique disponible.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {[...(detail.consentLogs ?? []), ...(detail.athleteConsents ?? [])]
                        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((log: any, i: number) => (
                          <div key={log.id ?? i} style={{ padding: "0.5rem 0.6rem", background: log.action === "revoked" ? "#fef2f2" : log.action === "granted" ? "#f0fdf4" : "#f8fafc", borderRadius: "8px", borderLeft: `3px solid ${log.action === "revoked" ? "#dc2626" : log.action === "granted" ? "#16a34a" : "#94a3b8"}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                              <span style={{ fontWeight: 600 }}>{log.consentType} — {log.action}</span>
                              <span style={{ color: "#94a3b8" }}>{fmtDateTime(log.createdAt)}</span>
                            </div>
                            {log.purpose && <div style={{ fontSize: "0.68rem", color: "#475569", marginTop: "0.15rem" }}>{log.purpose}</div>}
                            {log.method && <div style={{ fontSize: "0.62rem", color: "#94a3b8" }}>Méthode: {log.method}{log.documentVersion ? ` · v${log.documentVersion}` : ""}</div>}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 2 && (
                <div>
                  <SectionTitle>Preuve de consentement</SectionTitle>
                  <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "1rem", border: "1px solid #e2e8f0" }}>
                    <div className="admin-detail-grid-2">
                      <InfoRow label="Horodatage" value={fmtDateTime(detail.respondedAt ?? detail.createdAt)} />
                      <InfoRow label="Version" value={detail.athleteConsents?.[0]?.documentVersion ?? "—"} />
                      <InfoRow label="Validé par" value={detail.status === "accepted" ? (detail.requestedBy === "athlete" ? proName(detail) : athleteName(detail)) : "—"} />
                      <InfoRow label="Méthode" value={detail.athleteConsents?.[0]?.method === "digital" ? "Signature numérique" : detail.athleteConsents?.[0]?.method ?? "Acceptation in-app"} />
                      <InfoRow label="ID Partage" value={detail.id} />
                      <InfoRow label="Demandé par" value={detail.requestedBy === "athlete" ? "Athlète" : "Professionnel"} />
                      <InfoRow label="Accepté par" value={detail.status === "accepted" ? (detail.requestedBy === "athlete" ? "Professionnel" : "Athlète") : "—"} />
                    </div>
                    <div style={{ marginTop: "1rem" }}>
                      <button onClick={() => { exportConsentProof(detail); showMsg("Preuve téléchargée."); }} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.85rem", borderRadius: "8px", border: "1px solid #16a34a", background: "#f0fdf4", color: "#16a34a", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>
                        {Icons.download("#16a34a")} Télécharger la preuve
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 3 && (
                <div>
                  <SectionTitle>Activité complète</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {detail.respondedAt && (
                      <ActivityRow icon={detail.status === "rejected" ? Icons.x("#dc2626") : Icons.check("#16a34a")} label={detail.status === "rejected" ? "Partage révoqué" : "Partage accepté"} time={fmtDateTime(detail.respondedAt)} />
                    )}
                    <ActivityRow icon={Icons.userPlus("#2563eb")} label={`Demande de connexion (${detail.requestedBy === "athlete" ? "athlète" : "professionnel"})`} time={fmtDateTime(detail.createdAt)} />
                    {(detail.consentLogs ?? []).map((log: any) => (
                      <ActivityRow key={log.id} icon={log.action === "granted" ? Icons.check("#16a34a") : Icons.x("#dc2626")} label={`${log.consentType}: ${log.action}`} time={fmtDateTime(log.createdAt)} />
                    ))}
                    {(detail.athleteConsents ?? []).map((c: any) => (
                      <ActivityRow key={c.id} icon={c.granted ? Icons.shield("#16a34a") : Icons.xShield("#dc2626")} label={`Consentement ${c.consentType}: ${c.action}`} time={fmtDateTime(c.createdAt)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {detail && detailLoading && (
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Chargement...</div>
        )}
      </div>
    </div>
  );
}

// ─── Micro components ───────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>{children}</div>;
}
function DataRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0.5rem", background: "#f8fafc", borderRadius: "6px" }}>
      <span style={{ fontSize: "0.72rem", color: "#334155" }}>{label}</span>
      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: value ? "#16a34a" : "#dc2626" }}>{value ? "Oui" : "Non"}</span>
    </div>
  );
}
function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid #f8fafc" }}>
      <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{label}</span>
      <span style={{ fontSize: "0.7rem", fontWeight: 500, color: accent ? "#dc2626" : "#334155" }}>{value}</span>
    </div>
  );
}
function ActionBtn({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.45rem 0.75rem", borderRadius: "8px", border: `1px solid ${color}30`, background: `${color}08`, color, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
      {icon} {label}
    </button>
  );
}
function ActivityRow({ icon, label, time }: { icon: React.ReactNode; label: string; time: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.5rem", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: "0.72rem", color: "#334155", flex: 1 }}>{label}</span>
      <span style={{ fontSize: "0.65rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{time}</span>
    </div>
  );
}
