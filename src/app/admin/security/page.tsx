"use client";
import { useState, useEffect } from "react";
import { PageHeader, StatCard, Grid, InfoBox, Section, DataTable, Badge } from "../components";

export default function SecurityPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/stats").then(r => r.json()).then(setStats).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <PageHeader title="Sécurité" subtitle="Surveillance sécurité plateforme" />
      <Grid cols={4}>
        <StatCard label="Alertes (24h)" value={stats?.security?.recentAlerts ?? "..."} color="#ef4444" />
        <StatCard label="Alertes total" value={stats?.security?.totalAlerts ?? "..."} color="#f97316" />
        <StatCard label="Sessions actives" value={stats?.sessions?.active ?? "..."} color="#22c55e" />
        <StatCard label="Logs d'accès" value={stats?.security?.totalAccessLogs ?? "..."} color="#64748b" />
      </Grid>
      <Section title="Mesures de sécurité actives">
        <DataTable
          columns={[
            { key: "mesure", label: "Mesure" },
            { key: "status", label: "Statut" },
            { key: "detail", label: "Détail" },
          ]}
          rows={[
            { mesure: "CSP (Content Security Policy)", status: <Badge text="Actif" variant="success" />, detail: "unsafe-eval retiré en prod" },
            { mesure: "CORS strict", status: <Badge text="Actif" variant="success" />, detail: "Origine unique tuatha.pro" },
            { mesure: "CSRF protection", status: <Badge text="Actif" variant="success" />, detail: "Origin check sur POST/PUT/PATCH/DELETE" },
            { mesure: "Rate limiting", status: <Badge text="Actif" variant="success" />, detail: "Login, messages, APIs sensibles" },
            { mesure: "Chiffrement au repos", status: <Badge text="Actif" variant="success" />, detail: "AES-256-GCM via vault.ts" },
            { mesure: "Timeout d'inactivité", status: <Badge text="Actif" variant="success" />, detail: "15 min sur dashboards" },
            { mesure: "XSS Sanitization", status: <Badge text="Actif" variant="success" />, detail: "sanitize.ts sur tous les inputs" },
            { mesure: "SameSite cookies", status: <Badge text="Actif" variant="success" />, detail: "__Host-/__Secure- en prod" },
            { mesure: "HSTS", status: <Badge text="Actif" variant="success" />, detail: "Strict-Transport-Security 1 an" },
            { mesure: "Error boundary", status: <Badge text="Actif" variant="success" />, detail: "Pas de stack traces en front" },
          ]}
        />
      </Section>
    </div>
  );
}
