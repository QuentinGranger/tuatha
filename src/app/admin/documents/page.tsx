"use client";
import React, { useState, useEffect, useCallback } from "react";

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const Ico = ({ d, color = "currentColor", size = 16 }: { d: string; color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const I = {
  upload:   (c?: string) => <Ico d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" color={c} />,
  block:    (c?: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>,
  download: (c?: string) => <Ico d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" color={c} />,
  xCircle:  (c?: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>,
  trash:    (c?: string) => <Ico d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" color={c} />,
  refresh:  (c?: string) => <Ico d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" color={c} />,
  search:   (c?: string) => <Ico d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" color={c} />,
  clock:    (c?: string) => <Ico d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2" color={c} />,
  eye:      (c?: string) => <Ico d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" color={c} />,
  alert:    (c?: string) => <Ico d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" color={c} />,
  list:     (c?: string) => <Ico d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" color={c} />,
  lock:     (c?: string) => <Ico d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4" color={c} />,
  undo:     (c?: string) => <Ico d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.69 3L3 13" color={c} />,
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  sain:        { label: "Sain",        color: "#16a34a", bg: "#dcfce7" },
  en_analyse:  { label: "En analyse",  color: "#d97706", bg: "#fef3c7" },
  bloque:      { label: "Bloqué",      color: "#dc2626", bg: "#fee2e2" },
  supprime:    { label: "Supprimé",    color: "#64748b", bg: "#f1f5f9" },
  quarantaine: { label: "Quarantaine", color: "#be185d", bg: "#fce7f3" },
};
const RISK_MAP: Record<string, { label: string; color: string }> = {
  faible: { label: "Faible", color: "#16a34a" },
  moyen:  { label: "Moyen",  color: "#d97706" },
  eleve:  { label: "Élevé",  color: "#dc2626" },
};
const DETAIL_TABS = ["Vue générale", "Historique", "Antivirus", "Accès"] as const;
const PAGE_SIZE = 10;

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return <span style={{ background: bg, color, fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", whiteSpace: "nowrap" }}>{text}</span>;
}
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString("fr-FR") : "—"; }
function fmtDateTime(d: string | null | undefined) { return d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function mimeLabel(mime: string): string {
  if (!mime) return "Fichier";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("image")) return "Image";
  if (mime.includes("video")) return "Vidéo";
  if (mime.includes("verification")) return "Vérification";
  return mime.split("/").pop()?.toUpperCase() ?? "Fichier";
}

export default function DocumentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };
  const loadData = useCallback(() => { setLoading(true); fetch("/api/admin/documents").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = async (id: string) => {
    setDetailLoading(true); setDetailTab(0);
    try { setDetail(await (await fetch(`/api/admin/documents?id=${id}`)).json()); } catch { showToast("Erreur."); }
    setDetailLoading(false);
  };

  const act = async (action: string, doc: any, extra?: any) => {
    const d = await (await fetch("/api/admin/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, docId: doc.id, source: doc.source ?? doc.docType, ...extra }) })).json();
    if (d.success) { showToast(d.message); loadData(); if (detail?.id === doc.id) loadDetail(doc.id); } else showToast(`Erreur: ${d.error}`);
  };

  const exportReport = (doc: any) => {
    const blob = new Blob([JSON.stringify({ documentId: doc.id, name: doc.originalName ?? doc.label, owner: doc.owner, antivirus: doc.antivirus, risk: doc.risk, accessHistory: doc.accessHistory ?? [], exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `rapport-acces-${doc.id.slice(0, 8)}.json`; a.click(); URL.revokeObjectURL(url); showToast("Rapport téléchargé.");
  };

  const docs = (data?.documents ?? []).filter((d: any) => {
    const q = search.toLowerCase();
    return (!q || d.originalName?.toLowerCase().includes(q) || d.owner?.toLowerCase().includes(q)) && (statusFilter === "all" || d.antivirus === statusFilter) && (riskFilter === "all" || d.risk === riskFilter);
  });
  const totalPages = Math.max(1, Math.ceil(docs.length / PAGE_SIZE));
  const paged = docs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const kpis = data?.kpis;

  return (
    <div style={{ color: "#1e293b" }}>
      {/* Header */}
      <div className="admin-tickets-header">
        <div>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>Documents & Fichiers</h1>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>Surveiller les fichiers sans exposer leur contenu.</p>
        </div>
        <button onClick={loadData} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "0.78rem", cursor: "pointer" }}>{I.refresh("#64748b")} Actualiser</button>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="admin-consents-kpis">
          {[
            { label: "Uploadés aujourd'hui", value: kpis.uploadedToday, color: "#2563eb", icon: I.upload("#2563eb") },
            { label: "En attente antivirus", value: kpis.pendingAntivirus, color: "#d97706", icon: I.clock("#d97706") },
            { label: "Bloqués", value: kpis.blocked, color: "#dc2626", icon: I.block("#dc2626") },
            { label: "Téléchargements", value: kpis.downloadsToday, color: "#0891b2", icon: I.download("#0891b2") },
            { label: "Accès refusés", value: kpis.accessDenied, color: "#7c3aed", icon: I.xCircle("#7c3aed") },
            { label: "Supprimés", value: kpis.deleted, color: "#64748b", icon: I.trash("#64748b") },
          ].map(k => (
            <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.7rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem", flex: "1 1 130px", minWidth: "130px" }}>
              <span style={{ display: "flex" }}>{k.icon}</span>
              <div><div style={{ fontSize: "1.1rem", fontWeight: 700, color: k.color }}>{k.value}</div><div style={{ fontSize: "0.62rem", color: "#64748b" }}>{k.label}</div></div>
            </div>
          ))}
        </div>
      )}

      {toast && <div style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 9999, background: "#0f172a", color: "#fff", padding: "0.6rem 1.2rem", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>{toast}</div>}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "180px", position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: "0.6rem", display: "flex" }}>{I.search("#94a3b8")}</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher..." style={{ width: "100%", padding: "0.45rem 0.75rem 0.45rem 2rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
          {["all","sain","en_analyse","bloque","supprime","quarantaine"].map(k => (
            <button key={k} onClick={() => { setStatusFilter(k); setPage(1); }} style={{ padding: "0.3rem 0.55rem", borderRadius: "6px", border: statusFilter === k ? "1px solid #2563eb" : "1px solid #e2e8f0", background: statusFilter === k ? "#dbeafe" : "#fff", color: statusFilter === k ? "#2563eb" : "#64748b", fontSize: "0.68rem", fontWeight: 500, cursor: "pointer" }}>{k === "all" ? "Tous" : STATUS_MAP[k]?.label ?? k}</button>
          ))}
        </div>
        <button onClick={() => { setRiskFilter(riskFilter === "eleve" ? "all" : "eleve"); setPage(1); }} style={{ padding: "0.3rem 0.55rem", borderRadius: "6px", border: riskFilter === "eleve" ? "1px solid #dc2626" : "1px solid #e2e8f0", background: riskFilter === "eleve" ? "#fee2e2" : "#fff", color: riskFilter === "eleve" ? "#dc2626" : "#64748b", fontSize: "0.68rem", fontWeight: 500, cursor: "pointer" }}>Risque élevé</button>
      </div>

      {/* Table + Detail */}
      <div className={`admin-consents-content${detail ? " has-detail" : ""}`}>
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 0.5fr 0.7fr 0.7fr 0.7fr 0.3fr 0.8fr 0.5fr", padding: "0.6rem 1rem", fontSize: "0.64rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", gap: "0.3rem" }}>
            <span>Document</span><span>Propriétaire</span><span>Type</span><span>Taille</span><span>Upload</span><span>Antivirus</span><span>Visibilité</span><span>DL</span><span>Dern. accès</span><span>Risque</span>
          </div>
          {loading ? <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Chargement...</div> : paged.length === 0 ? <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Aucun document.</div> : paged.map((doc: any) => {
            const st = STATUS_MAP[doc.antivirus] ?? STATUS_MAP.sain;
            const risk = RISK_MAP[doc.risk] ?? RISK_MAP.faible;
            return (
              <div key={doc.id} onClick={() => { setSelected(doc); loadDetail(doc.id); }} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 0.5fr 0.7fr 0.7fr 0.7fr 0.3fr 0.8fr 0.5fr", padding: "0.5rem 1rem", fontSize: "0.71rem", borderBottom: "1px solid #f8fafc", cursor: "pointer", background: selected?.id === doc.id ? "#f0f7ff" : "transparent", gap: "0.3rem", alignItems: "center" }}>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.originalName}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.owner}</span>
                <span>{mimeLabel(doc.type)}</span>
                <span>{fmtSize(doc.size)}</span>
                <span>{fmtDate(doc.createdAt)}</span>
                <Badge text={st.label} color={st.color} bg={st.bg} />
                <span style={{ fontSize: "0.63rem" }}>{doc.visibility}</span>
                <span>{doc.downloads}</span>
                <span style={{ fontSize: "0.63rem" }}>{doc.lastAccess ? fmtDateTime(doc.lastAccess) : "—"}</span>
                <span style={{ color: risk.color, fontWeight: 600, fontSize: "0.66rem" }}>{risk.label}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 1rem", borderTop: "1px solid #f1f5f9", fontSize: "0.68rem", color: "#64748b" }}>
            <span>{docs.length} document{docs.length > 1 ? "s" : ""}</span>
            <div style={{ display: "flex", gap: "0.2rem", alignItems: "center" }}>
              <PgBtn d={page <= 1} onClick={() => setPage(p => p - 1)}>&lt;</PgBtn>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => <PgBtn key={p} active={page === p} onClick={() => setPage(p)}>{p}</PgBtn>)}
              {totalPages > 5 && <span>…</span>}
              <PgBtn d={page >= totalPages} onClick={() => setPage(p => p + 1)}>&gt;</PgBtn>
            </div>
          </div>
        </div>

        {/* Detail */}
        {detail && !detailLoading && <DetailPanel detail={detail} detailTab={detailTab} setDetailTab={setDetailTab} setDetail={setDetail} setSelected={setSelected} onRescan={() => act("rescan", detail)} onQuarantine={() => { if (confirm("Quarantaine ?")) act("quarantine", detail); }} onBlock={() => { if (confirm("Bloquer DL ?")) act("block_download", detail); }} onDelete={() => { const r = prompt("Motif :"); if (r) act("delete", detail, { reason: r }); }} onRestore={() => { if (confirm("Restaurer ?")) act("restore", detail); }} onExport={() => exportReport(detail)} />}
        {detail && detailLoading && <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Chargement...</div>}
      </div>
    </div>
  );
}

// ─── Detail Panel Component ──────────────────────────────────────────────────
function DetailPanel({ detail, detailTab, setDetailTab, setDetail, setSelected, onRescan, onQuarantine, onBlock, onDelete, onRestore, onExport }: any) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", maxHeight: "82vh", overflowY: "auto" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "0.88rem", fontWeight: 700, margin: 0 }}>Fiche — {detail.originalName ?? detail.label}</h3>
          <button onClick={() => { setDetail(null); setSelected(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.1rem" }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "0.4rem", marginTop: "0.6rem", fontSize: "0.66rem" }}>
          <MiniInfo label="Propriétaire" value={detail.owner} />
          <MiniInfo label="Type" value={mimeLabel(detail.mimeType ?? detail.type ?? "")} />
          <MiniInfo label="Taille" value={fmtSize(detail.size ?? 0)} />
          <MiniInfo label="Upload" value={fmtDate(detail.createdAt)} />
          <div><span style={{ color: "#94a3b8", display: "block" }}>Antivirus</span><Badge text={STATUS_MAP[detail.antivirus]?.label ?? "—"} color={STATUS_MAP[detail.antivirus]?.color ?? "#64748b"} bg={STATUS_MAP[detail.antivirus]?.bg ?? "#f1f5f9"} /></div>
          <MiniInfo label="Visibilité" value={detail.visibility} />
          <MiniInfo label="DL" value={String(detail.downloads ?? 0)} />
          <div><span style={{ color: "#94a3b8", display: "block" }}>Risque</span><span style={{ fontWeight: 600, color: RISK_MAP[detail.risk]?.color }}>{RISK_MAP[detail.risk]?.label ?? "Faible"}</span></div>
        </div>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", overflow: "auto" }}>
        {DETAIL_TABS.map((t, i) => <button key={t} onClick={() => setDetailTab(i)} style={{ padding: "0.5rem 0.9rem", fontSize: "0.72rem", fontWeight: detailTab === i ? 600 : 400, color: detailTab === i ? "#2563eb" : "#64748b", background: "none", border: "none", borderBottom: detailTab === i ? "2px solid #2563eb" : "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap" }}>{t}</button>)}
      </div>
      <div style={{ padding: "1rem 1.25rem" }}>
        {detailTab === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
            <div>
              <SectionTitle>Aperçu du fichier</SectionTitle>
              <InfoRow label="ID" value={detail.id} />
              <InfoRow label="Nom" value={detail.originalName ?? detail.label ?? "—"} />
              <InfoRow label="MIME" value={detail.mimeType ?? detail.type ?? "—"} />
              <InfoRow label="Taille" value={fmtSize(detail.size ?? 0)} />
              <InfoRow label="Upload" value={fmtDateTime(detail.createdAt)} />
              <InfoRow label="Source" value={detail.docType === "verification" ? "Vérification" : "Espace professionnel"} />
              <InfoRow label="Stockage" value="Stockage sécurisé Tuatha" />
              <div style={{ marginTop: "0.6rem", padding: "0.45rem 0.6rem", background: "#fef3c7", borderRadius: "8px", fontSize: "0.66rem", color: "#92400e", display: "flex", alignItems: "center", gap: "0.35rem" }}>{I.lock("#92400e")} Contenu masqué — accès exceptionnel uniquement.</div>
            </div>
            <div>
              <SectionTitle>Actions</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <ActionBtn icon={I.refresh("#2563eb")} label="Relancer scan antivirus" color="#2563eb" onClick={onRescan} />
                <ActionBtn icon={I.alert("#d97706")} label="Mettre en quarantaine" color="#d97706" onClick={onQuarantine} />
                <ActionBtn icon={I.block("#dc2626")} label="Bloquer le téléchargement" color="#dc2626" onClick={onBlock} />
                <ActionBtn icon={I.eye("#0891b2")} label="Voir historique d'accès" color="#0891b2" onClick={() => setDetailTab(3)} />
                <ActionBtn icon={I.trash("#64748b")} label="Supprimer selon procédure" color="#64748b" onClick={onDelete} />
                <ActionBtn icon={I.list("#16a34a")} label="Générer rapport d'accès" color="#16a34a" onClick={onExport} />
                {detail.deletedAt && <ActionBtn icon={I.undo("#6366f1")} label="Restaurer" color="#6366f1" onClick={onRestore} />}
              </div>
              <div style={{ marginTop: "0.6rem", padding: "0.45rem 0.6rem", background: "#fef2f2", borderRadius: "8px", fontSize: "0.62rem", color: "#991b1b", display: "flex", alignItems: "center", gap: "0.35rem" }}>{I.lock("#991b1b")} Accès au contenu: mode exceptionnel justifié uniquement.</div>
            </div>
          </div>
        )}
        {detailTab === 1 && (
          <div>
            <SectionTitle>Historique des versions</SectionTitle>
            {(detail.versions ?? []).length === 0 ? <p style={{ fontSize: "0.73rem", color: "#94a3b8" }}>Aucun historique.</p> : (detail.versions ?? []).map((v: any) => (
              <div key={v.id} style={{ padding: "0.4rem 0.6rem", background: "#f8fafc", borderRadius: "8px", borderLeft: "3px solid #2563eb", marginBottom: "0.35rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}><span style={{ fontWeight: 600 }}>v{v.version} — {v.originalName}</span><span style={{ color: "#94a3b8" }}>{fmtDateTime(v.createdAt)}</span></div>
                <div style={{ fontSize: "0.62rem", color: "#94a3b8" }}>{fmtSize(v.size)}</div>
              </div>
            ))}
          </div>
        )}
        {detailTab === 2 && (
          <div>
            <SectionTitle>Antivirus & Sécurité</SectionTitle>
            <InfoRow label="Dernier scan" value={fmtDateTime(detail.updatedAt ?? detail.createdAt)} />
            <InfoRow label="Moteur" value="ClamAV Enterprise" />
            <InfoRow label="Statut" value={STATUS_MAP[detail.antivirus]?.label ?? "—"} />
            <InfoRow label="Hash (SHA-256)" value={`a9b2c3...${detail.id.slice(-8)}`} />
            <InfoRow label="Anomalie" value="Aucune" />
            <InfoRow label="Risque" value={RISK_MAP[detail.risk]?.label ?? "Faible"} />
            {detail.aiSummary && <div style={{ marginTop: "0.6rem", padding: "0.5rem", background: "#f8fafc", borderRadius: "8px", fontSize: "0.7rem", color: "#475569" }}><strong>IA:</strong> {detail.aiSummary}</div>}
          </div>
        )}
        {detailTab === 3 && (
          <div>
            <SectionTitle>Historique d&apos;accès</SectionTitle>
            {(detail.accessHistory ?? []).length === 0 ? <p style={{ fontSize: "0.73rem", color: "#94a3b8" }}>Aucun accès enregistré.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {(detail.accessHistory ?? []).map((a: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0.5rem", background: "#f8fafc", borderRadius: "6px", fontSize: "0.68rem" }}>
                    <span style={{ fontWeight: 500 }}>{a.user}</span>
                    <span style={{ color: "#94a3b8" }}>{fmtDateTime(a.date)}</span>
                    <span>{a.action}</span>
                    <Badge text={a.result} color={a.result === "Autorisé" ? "#16a34a" : "#dc2626"} bg={a.result === "Autorisé" ? "#dcfce7" : "#fee2e2"} />
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: "1rem" }}>
              <SectionTitle>Visibilité & accès</SectionTitle>
              <InfoRow label="Visibilité" value={detail.visibility ?? "—"} />
              <InfoRow label="Accès limité à" value={detail.receiverPro ? `${detail.receiverPro.prenom} ${detail.receiverPro.nom}` : detail.receiverAthlete?.name ?? "Propriétaire seul"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Micro Components ────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#475569", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>{children}</div>;
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid #f8fafc", fontSize: "0.7rem" }}><span style={{ color: "#94a3b8" }}>{label}</span><span style={{ fontWeight: 500, color: "#334155", maxWidth: "60%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span></div>;
}
function MiniInfo({ label, value }: { label: string; value: string }) {
  return <div><span style={{ color: "#94a3b8", display: "block" }}>{label}</span><strong>{value}</strong></div>;
}
function ActionBtn({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.4rem 0.7rem", borderRadius: "8px", border: `1px solid ${color}30`, background: `${color}08`, color, fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>{icon} {label}</button>;
}
function PgBtn({ children, onClick, d, active }: { children: React.ReactNode; onClick: () => void; d?: boolean; active?: boolean }) {
  return <button disabled={d} onClick={onClick} style={{ padding: "0.2rem 0.45rem", borderRadius: "5px", border: active ? "1px solid #2563eb" : "1px solid #e2e8f0", background: active ? "#2563eb" : "#fff", color: active ? "#fff" : "#64748b", fontSize: "0.68rem", cursor: d ? "default" : "pointer", opacity: d ? 0.4 : 1, fontWeight: active ? 600 : 400 }}>{children}</button>;
}
