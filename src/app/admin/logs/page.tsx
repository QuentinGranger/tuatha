"use client";
import { useState, useEffect } from "react";
import { PageHeader, InfoBox, Section, DataTable, Badge, StatCard, Grid } from "../components";

export default function LogsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/logs").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <PageHeader title="Logs système" subtitle="Journaux d'administration — accès restreint" />
      <InfoBox text="Cette page est réservée à l'administrateur principal. Les logs ne contiennent aucune donnée médicale." variant="warning" />
      <Grid cols={3}>
        <StatCard label="Total logs admin" value={data?.totalLogs ?? "..."} color="#64748b" />
        <StatCard label="Logs dernières 24h" value={data?.recent24h ?? "..."} color="#3b82f6" />
        <StatCard label="Total accès athlètes" value={data?.totalAccessLogs ?? "..."} color="#8b5cf6" />
      </Grid>
      <Section title="Derniers logs admin">
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "action", label: "Action" },
            { key: "detail", label: "Détail" },
          ]}
          rows={(data?.logs ?? []).map((l: any) => ({
            date: new Date(l.createdAt).toLocaleString("fr-FR"),
            action: <Badge text={l.action} variant="info" />,
            detail: l.detail || "—",
          }))}
          emptyMsg="Aucun log récent."
        />
      </Section>
    </div>
  );
}
