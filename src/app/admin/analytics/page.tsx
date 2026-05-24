"use client";
import { useState, useEffect } from "react";
import { PageHeader, StatCard, Grid, InfoBox, Section, Badge } from "../components";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/stats").then(r => r.json()).then(setStats).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <PageHeader title="Analytics Produit" subtitle="Métriques de croissance et d'usage — aucun tracking externe" />
      <InfoBox text="Tuatha n'utilise aucun analytics tiers (GA, Mixpanel, Posthog). Les métriques sont calculées exclusivement depuis la base de données interne." />
      <Grid cols={4}>
        <StatCard label="Professionnels" value={stats?.users?.totalPros ?? "..."} sub={`+${stats?.users?.recentPros ?? 0} ce mois`} color="#3b82f6" />
        <StatCard label="Athlètes" value={stats?.users?.totalAthleteUsers ?? "..."} sub={`+${stats?.users?.recentAthletes ?? 0} ce mois`} color="#8b5cf6" />
        <StatCard label="Messages / semaine" value={stats?.messaging?.recentMessages ?? "..."} color="#06b6d4" />
        <StatCard label="Événements calendrier" value={stats?.calendar?.totalEvents ?? "..."} color="#22c55e" />
      </Grid>
      <Section title="Spécialités">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", background: "rgba(30,41,59,0.6)", border: "1px solid rgba(148,163,184,0.08)", borderRadius: "0.75rem", padding: "1rem" }}>
          {(stats?.specialties ?? []).map((s: any) => (
            <Badge key={s.name} text={`${s.name}: ${s.count}`} variant="info" />
          ))}
        </div>
      </Section>
      <Section title="Engagement">
        <Grid cols={3}>
          <StatCard label="Connexions pro-athlète" value={stats?.connections?.active ?? "..."} sub="Actives" color="#14b8a6" />
          <StatCard label="Documents partagés" value={stats?.documents?.total ?? "..."} color="#f97316" />
          <StatCard label="Consentements" value={stats?.consents?.total ?? "..."} color="#a855f7" />
        </Grid>
      </Section>
    </div>
  );
}
