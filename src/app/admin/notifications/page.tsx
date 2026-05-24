"use client";
import { PageHeader, InfoBox, Section, StatCard, Grid, DataTable, Badge } from "../components";

export default function NotificationsPage() {
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Gestion des notifications push et emails" />
      <InfoBox text="Les notifications n'incluent jamais de données médicales. Seuls les événements sont notifiés (nouveau message, rappel RDV, etc.)." />
      <Section title="Canaux de notification">
        <DataTable
          columns={[
            { key: "canal", label: "Canal" },
            { key: "status", label: "Statut" },
            { key: "detail", label: "Détail" },
          ]}
          rows={[
            { canal: "Push Web (VAPID)", status: <Badge text="Actif" variant="success" />, detail: "Service Worker + PushSubscription" },
            { canal: "Email transactionnel", status: <Badge text="Actif" variant="success" />, detail: "Confirmation, reset password, rappels" },
            { canal: "SSE (temps réel)", status: <Badge text="Actif" variant="success" />, detail: "Notifications in-app" },
          ]}
        />
      </Section>
      <Section title="Règles de notification">
        <div style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(148,163,184,0.08)", borderRadius: "0.75rem", padding: "1.25rem", fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.8 }}>
          <div><strong style={{ color: "#e2e8f0" }}>Nouveau message :</strong> Push + SSE</div>
          <div><strong style={{ color: "#e2e8f0" }}>Rappel RDV :</strong> Push 24h avant + 1h avant</div>
          <div><strong style={{ color: "#e2e8f0" }}>Connexion pro :</strong> Push + email</div>
          <div><strong style={{ color: "#e2e8f0" }}>Alerte santé :</strong> Push (sans détail médical)</div>
          <div><strong style={{ color: "#e2e8f0" }}>Facture :</strong> Email uniquement</div>
        </div>
      </Section>
    </div>
  );
}
