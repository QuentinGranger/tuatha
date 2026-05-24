"use client";
import { useState, useEffect } from "react";
import { PageHeader, StatCard, Grid, InfoBox, Section, DataTable, Badge } from "../components";

export default function IncidentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/incidents").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <PageHeader title="Incidents" subtitle="Alertes de sécurité et incidents plateforme" />
      <InfoBox text="Les incidents sont tracés sans exposer le contenu médical. Seuls le type d'événement, l'horodatage et le niveau de sévérité sont affichés." />
      <Grid cols={3}>
        <StatCard label="Alertes dernières 24h" value={data?.recent24h ?? "..."} color="#ef4444" />
        <StatCard label="Total alertes" value={data?.total ?? "..."} color="#f97316" />
        <StatCard label="Non résolues" value={data?.unresolved ?? "..."} color="#eab308" />
      </Grid>
      <Section title="Derniers incidents">
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "type", label: "Type" },
            { key: "level", label: "Niveau" },
            { key: "message", label: "Description" },
          ]}
          rows={(data?.alerts ?? []).map((a: any) => ({
            date: new Date(a.createdAt).toLocaleString("fr-FR"),
            type: a.type,
            level: <Badge text={a.level || "info"} variant={a.level === "critical" ? "danger" : a.level === "warning" ? "warning" : "info"} />,
            message: a.message,
          }))}
          emptyMsg="Aucun incident récent."
        />
      </Section>
    </div>
  );
}
