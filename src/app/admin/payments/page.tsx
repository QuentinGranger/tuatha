"use client";
import { useState, useEffect } from "react";
import { PageHeader, StatCard, Grid, InfoBox, Section, DataTable, Badge } from "../components";

export default function PaymentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/payments").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <PageHeader title="Paiements" subtitle="Suivi facturation et paiements Stripe" />
      <Grid cols={4}>
        <StatCard label="Total factures" value={data?.totalInvoices ?? "..."} color="#14b8a6" />
        <StatCard label="Total paiements" value={data?.totalPayments ?? "..."} color="#22c55e" />
        <StatCard label="Paiements réussis" value={data?.successPayments ?? "..."} color="#3b82f6" />
        <StatCard label="Paiements échoués" value={data?.failedPayments ?? "..."} color="#ef4444" />
      </Grid>
      <Section title="Derniers paiements">
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "pro", label: "Professionnel" },
            { key: "amount", label: "Montant" },
            { key: "status", label: "Statut" },
          ]}
          rows={(data?.recent ?? []).map((p: any) => ({
            date: new Date(p.createdAt).toLocaleDateString("fr-FR"),
            pro: p.proEmail || "[Données protégées]",
            amount: `${(p.amount / 100).toFixed(2)} €`,
            status: <Badge text={p.status} variant={p.status === "succeeded" ? "success" : p.status === "failed" ? "danger" : "warning"} />,
          }))}
          emptyMsg="Aucun paiement enregistré."
        />
      </Section>
    </div>
  );
}
