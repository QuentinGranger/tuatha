"use client";

import { useState, useEffect } from "react";

export default function AdminCommandCenter() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => { if (!r.ok) throw new Error("Erreur API"); return r.json(); })
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const s = stats;
  const v = (path: string) => {
    if (!s) return "...";
    const parts = path.split(".");
    let val: any = s;
    for (const p of parts) { val = val?.[p]; }
    return val ?? "—";
  };

  return (
    <div style={{ color: "#1e293b" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div className="admin-header-row">
          <div>
            <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.02em" }}>TUATHA ADMIN — COMMAND CENTER</h1>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>Est-ce que Tuatha va bien aujourd&apos;hui ?</p>
          </div>
          <div className="admin-header-pills">
            <Pill label="État" value={loading ? "..." : (Number(v("security.unresolvedAlerts")) > 0 ? "Dégradé" : "Stable")} color={loading ? "#94a3b8" : (Number(v("security.unresolvedAlerts")) > 0 ? "#f59e0b" : "#22c55e")} />
            <Pill label="Risque" value={loading ? "..." : (Number(v("security.unresolvedAlerts")) > 2 ? "Élevé" : Number(v("security.unresolvedAlerts")) > 0 ? "Moyen" : "Faible")} color={loading ? "#94a3b8" : (Number(v("security.unresolvedAlerts")) > 2 ? "#ef4444" : Number(v("security.unresolvedAlerts")) > 0 ? "#f59e0b" : "#22c55e")} />
            <Pill label="Paiements" value={loading ? "..." : (Number(v("billing.failedPayments")) > 0 ? `${v("billing.failedPayments")} échec(s)` : "OK")} color={loading ? "#94a3b8" : (Number(v("billing.failedPayments")) > 0 ? "#f59e0b" : "#22c55e")} />
          </div>
        </div>
      </div>

      {error && <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "8px", padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#92400e", marginBottom: "1rem" }}>Impossible de charger les statistiques.</div>}

      {/* Welcome banner */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.1rem 1.5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>Bonjour Quentin,</span>
          </div>
          <BannerMetric label="État plateforme" value={loading ? "..." : (Number(v("security.unresolvedAlerts")) > 0 ? "Dégradé" : "Stable")} />
          <BannerMetric label="Risque sécurité" value={loading ? "..." : (Number(v("security.unresolvedAlerts")) > 2 ? "Élevé" : Number(v("security.unresolvedAlerts")) > 0 ? "Moyen" : "Faible")} />
          <BannerMetric label="Tickets ouverts" value={loading ? "..." : v("support.openTickets")} color="#2563eb" />
          <BannerMetric label="Incidents actifs" value={loading ? "..." : v("security.recentAlerts")} />
          <BannerMetric label="Athlètes actifs" value={loading ? "..." : v("users.totalAthleteUsers")} color="#2563eb" />
        </div>
        <div style={{ display: "flex", gap: "2rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
          <SubMetric label="Professionnels actifs" value={loading ? "..." : v("users.totalPros")} />
          <SubMetric label="Documents uploadés cette semaine" value={loading ? "..." : v("documents.thisWeek")} />
          <SubMetric label="Partages actifs" value={loading ? "..." : v("connections.active")} />
          <SubMetric label="MRR estimé" value={loading ? "..." : `${v("billing.revenueEuros")} €`} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid">
        <KPI icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} label="Athlètes" value={loading ? "..." : v("users.totalAthleteUsers")} change={loading ? "" : `+${v("users.recentAthletes")} (30j) · ${Number(v("users.athleteChange")) >= 0 ? "+" : ""}${v("users.athleteChange")} aujourd'hui`} positive href="/admin/athletes" />
        <KPI icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>} label="Pros actifs" value={loading ? "..." : v("users.totalPros")} change={loading ? "" : `+${v("users.recentPros")} (30j) · ${Number(v("users.prosChange")) >= 0 ? "+" : ""}${v("users.prosChange")} aujourd'hui`} positive href="/admin/pros" />
        <KPI icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>} label="Tickets" value={loading ? "..." : v("support.openTickets")} change={loading ? "" : `${v("support.urgentTickets")} urgent${Number(v("support.urgentTickets")) !== 1 ? "s" : ""} · ${v("support.blockedTickets")} bloqué${Number(v("support.blockedTickets")) !== 1 ? "s" : ""}`} positive={Number(v("support.urgentTickets")) === 0} href="/admin/tickets" />
        <KPI icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} label="MRR" value={loading ? "..." : `${v("billing.revenueEuros")} €`} change={loading ? "" : `${v("billing.paidPayments")} paiement${Number(v("billing.paidPayments")) !== 1 ? "s" : ""} · ${v("billing.failedPayments")} échoué${Number(v("billing.failedPayments")) !== 1 ? "s" : ""}`} positive={Number(v("billing.failedPayments")) === 0} href="/admin/payments" />
      </div>

      {/* 4 detail columns */}
      <div className="admin-cols-grid">
        <Col title="Santé plateforme">
          <Row label="Utilisateurs actifs aujourd'hui" val={loading ? "..." : v("sessions.active")} />
          <Row label="Inscriptions du jour" val={loading ? "..." : String(Number(v("users.prosToday")) + Number(v("users.athletesToday")))} />
          <Row label="Connexions échouées" val={loading ? "..." : v("billing.failedPayments")} />
          <Row label="Erreurs API (24h)" val={loading ? "..." : v("security.apiErrors24h")} badge={Number(v("security.apiErrors24h")) > 0 ? "orange" : "green"} />
          <Row label="Temps moyen réponse" val={loading ? "..." : `${v("health.avgResponseTime")} ms`} />
          <Row label="Disponibilité" val={loading ? "..." : (v("health.dbStatus") === "healthy" ? "OK" : v("health.dbStatus") === "unknown" ? "Inconnu" : "Dégradé")} badge={v("health.dbStatus") === "healthy" ? "green" : v("health.dbStatus") === "unknown" ? undefined : "orange"} />
          <Row label="Dernier backup" val={loading ? "..." : v("health.backupStatus")} badge={v("health.backupStatus") === "OK" ? "green" : "orange"} />
          <Row label="Statut HDS / cloud" val={loading ? "..." : v("health.dbStatus")} badge={v("health.dbStatus") === "healthy" ? "green" : "orange"} />
          <Row label="Statut paiements" val={loading ? "..." : v("health.stripeStatus")} badge={v("health.stripeStatus") === "healthy" ? "green" : "orange"} />
          <Row label="Statut emails" val={loading ? "..." : v("health.emailStatus")} badge={v("health.emailStatus") === "healthy" ? "green" : "orange"} />
        </Col>
        <Col title="Sécurité">
          <Row label="Alertes critiques" val={loading ? "..." : v("security.unresolvedAlerts")} badge={Number(v("security.unresolvedAlerts")) > 0 ? "red" : "green"} />
          <Row label="Tentatives connexion suspectes" val={loading ? "..." : v("security.recentAlerts")} badge={Number(v("security.recentAlerts")) > 0 ? "orange" : "green"} />
          <Row label="Erreurs 403 répétées (24h)" val={loading ? "..." : v("security.errors403")} badge={Number(v("security.errors403")) > 0 ? "orange" : "green"} />
          <Row label="Comptes supprimés" val={loading ? "..." : v("security.deletedAccounts")} badge={Number(v("security.deletedAccounts")) > 0 ? "orange" : "green"} />
          <Row label="Actions admin sensibles" val={loading ? "..." : v("security.adminLogsToday")} />
          <Row label="Emails envoyés (24h)" val={loading ? "..." : v("health.emails24h")} />
          <Row label="Emails échoués (24h)" val={loading ? "..." : v("health.failedEmails24h")} badge={Number(v("health.failedEmails24h")) > 0 ? "orange" : "green"} />
          <Row label="Logs d'accès total" val={loading ? "..." : v("security.totalAccessLogs")} />
        </Col>
        <Col title="Support">
          <Row label="Tickets ouverts" val={loading ? "..." : v("support.openTickets")} badge={Number(v("support.openTickets")) > 0 ? "blue" : "green"} />
          <Row label="Tickets urgents" val={loading ? "..." : v("support.urgentTickets")} badge={Number(v("support.urgentTickets")) > 0 ? "red" : "green"} />
          <Row label="Tickets bloqués" val={loading ? "..." : v("support.blockedTickets")} badge={Number(v("support.blockedTickets")) > 0 ? "orange" : "green"} />
          <Row label="Investigations actives" val={loading ? "..." : v("support.activeInvestigations")} badge={Number(v("support.activeInvestigations")) > 0 ? "red" : "green"} />
          <Row label="Tickets sécurité" val={loading ? "..." : v("support.securityTickets")} />
          <Row label="Tickets paiements" val={loading ? "..." : v("support.paymentTickets")} />
          <Row label="Tickets professionnels" val={loading ? "..." : v("support.proTickets")} />
        </Col>
        <Col title="Croissance">
          <Row label="Nouveaux athlètes (30j)" val={loading ? "..." : v("users.recentAthletes")} />
          <Row label="Nouveaux pros (30j)" val={loading ? "..." : v("users.recentPros")} />
          <Row label="Taux d'activation" val={loading ? "..." : `${v("growth.activationRate")}%`} />
          <Row label="Athlètes connectés un pro" val={loading ? "..." : `${Math.round((Number(v("connections.active")) / Number(v("users.totalAthleteUsers") || 1)) * 100)}%`} />
          <Row label="Athlètes ayant uploadé un doc" val={loading ? "..." : `${v("growth.docsRate")}%`} />
          <Row label="Connexions actives" val={loading ? "..." : v("connections.active")} />
          <Row label="Messages échangés (7j)" val={loading ? "..." : v("messaging.recentMessages")} />
          <Row label="Comptes supprimés" val={loading ? "..." : v("security.deletedAccounts")} badge={Number(v("security.deletedAccounts")) > 0 ? "orange" : "green"} />
        </Col>
      </div>

      {/* Bottom cards */}
      <div className="admin-bottom-grid">
        <BCard title="Alertes sécurité" href="/admin/security">
          <div style={{ fontSize: "0.73rem", color: "#475569", lineHeight: 1.9 }}>
            <div>• {loading ? "..." : v("security.recentAlerts")} alertes (24h)</div>
            <div>• {loading ? "..." : v("security.unresolvedAlerts")} non résolues</div>
            <div>• {loading ? "..." : v("security.deletedAccounts")} suppressions de comptes</div>
          </div>
        </BCard>
        <BCard title="Tickets & Investigations" href="/admin/tickets">
          <div style={{ fontSize: "0.73rem", color: "#475569", lineHeight: 1.9 }}>
            <div>• {loading ? "..." : v("support.urgentTickets")} tickets urgents</div>
            <div>• {loading ? "..." : v("support.blockedTickets")} tickets bloqués</div>
            <div>• {loading ? "..." : v("support.activeInvestigations")} investigations actives</div>
            <div>• {loading ? "..." : v("support.securityTickets")} tickets sécurité</div>
          </div>
        </BCard>
        <BCard title="Activité récente" href="/admin/analytics">
          {loading ? <div style={{ fontSize: "0.73rem", color: "#94a3b8" }}>Chargement...</div> : (
            <div style={{ fontSize: "0.73rem", color: "#475569", lineHeight: 1.9 }}>
              {(s?.activity?.recentSignups ?? []).slice(0, 2).map((a: any, i: number) => (
                <div key={i}>• Inscription athlète <span style={{ color: "#94a3b8" }}>{timeAgo(a.at)}</span></div>
              ))}
              {(s?.activity?.recentDocs ?? []).slice(0, 1).map((a: any, i: number) => (
                <div key={i}>• Document uploadé <span style={{ color: "#94a3b8" }}>{timeAgo(a.at)}</span></div>
              ))}
              {(s?.activity?.recentConsents ?? []).slice(0, 1).map((a: any, i: number) => (
                <div key={i}>• Consentement {a.type} <span style={{ color: "#94a3b8" }}>{timeAgo(a.at)}</span></div>
              ))}
              {(!s?.activity?.recentSignups?.length && !s?.activity?.recentDocs?.length) && <div>Aucune activité récente</div>}
            </div>
          )}
        </BCard>
        <BCard title="Funnel" href="/admin/analytics">
          {loading ? <div style={{ fontSize: "0.73rem", color: "#94a3b8" }}>Chargement...</div> : (() => {
            const totalUsers = Number(v("users.totalAthleteUsers")) || 1;
            const connected = Number(v("connections.active"));
            const withDocs = Number(v("documents.total"));
            const pctConnected = Math.round((connected / totalUsers) * 100);
            const pctDocs = Math.round((withDocs / totalUsers) * 100);
            return (
              <>
                <div style={{ fontSize: "0.72rem", color: "#475569", marginBottom: "0.5rem" }}>Inscrits → Connectés → Documents</div>
                <div style={{ display: "flex", gap: "3px", height: "8px" }}>
                  <div style={{ flex: 100, background: "#2563eb", borderRadius: "4px" }} />
                  <div style={{ flex: pctConnected || 1, background: "#60a5fa", borderRadius: "4px" }} />
                  <div style={{ flex: pctDocs || 1, background: "#93c5fd", borderRadius: "4px" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                  <span>{totalUsers} inscrits</span><span>{pctConnected}% connectés</span><span>{pctDocs}% docs</span>
                </div>
              </>
            );
          })()}
        </BCard>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

/* ─── Utility components ─── */

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem" }}>
      <span style={{ color: "#64748b" }}>{label} :</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
    </span>
  );
}

function BannerMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "0.62rem", color: "#94a3b8" }}>{label} :</div>
      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: color || "#1e293b" }}>{value}</div>
    </div>
  );
}

function SubMetric({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
      {label} : <strong style={{ color: "#1e293b" }}>{value}</strong>
    </span>
  );
}

function KPI({ icon, label, value, change, positive, href }: { icon: React.ReactNode; label: string; value: string; change: string; positive: boolean; href?: string }) {
  return (
    <div onClick={() => href && (window.location.href = href)} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1rem 1.25rem", cursor: href ? "pointer" : "default", transition: "box-shadow 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
        <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{value}</div>
      {change && <div style={{ fontSize: "0.68rem", color: positive ? "#22c55e" : "#f59e0b", fontWeight: 500, marginTop: "0.15rem" }}>{change}</div>}
    </div>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "0.9rem 1rem" }}>
      <h3 style={{ fontSize: "0.78rem", fontWeight: 700, margin: "0 0 0.6rem", color: "#1e293b" }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>{children}</div>
    </div>
  );
}

function Row({ label, val, badge }: { label: string; val: string; badge?: "green" | "orange" | "blue" | "red" }) {
  const colors: Record<string, string> = { green: "#22c55e", orange: "#f59e0b", blue: "#3b82f6", red: "#ef4444" };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem" }}>
      <span style={{ color: "#475569" }}>{label}</span>
      {badge ? (
        <span style={{ background: `${colors[badge]}12`, color: colors[badge], padding: "1px 7px", borderRadius: "9999px", fontSize: "0.63rem", fontWeight: 600 }}>{val}</span>
      ) : (
        <span style={{ fontWeight: 600, color: "#1e293b" }}>{val}</span>
      )}
    </div>
  );
}

function BCard({ title, children, href }: { title: string; children: React.ReactNode; href?: string }) {
  return (
    <div onClick={() => href && (window.location.href = href)} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "0.9rem 1rem", cursor: href ? "pointer" : "default", transition: "box-shadow 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <h4 style={{ fontSize: "0.75rem", fontWeight: 700, margin: 0, color: "#1e293b" }}>{title}</h4>
        {href && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
      </div>
      {children}
    </div>
  );
}
