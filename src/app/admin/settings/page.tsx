"use client";
import { PageHeader, Section, DataTable, Badge, InfoBox } from "../components";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Paramètres plateforme" subtitle="Configuration globale Tuatha" />
      <Section title="Variables d'environnement (publiques uniquement)">
        <InfoBox text="Les clés secrètes ne sont jamais affichées. Seules les variables NEXT_PUBLIC_ sont listées." />
        <DataTable
          columns={[
            { key: "name", label: "Variable" },
            { key: "usage", label: "Usage" },
            { key: "safe", label: "Sensible" },
          ]}
          rows={[
            { name: "NEXT_PUBLIC_APP_URL", usage: "URL de l'application", safe: <Badge text="Non" variant="success" /> },
            { name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", usage: "Push notifications", safe: <Badge text="Non" variant="success" /> },
            { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", usage: "Paiement Stripe", safe: <Badge text="Non" variant="success" /> },
            { name: "NEXT_PUBLIC_BASE_URL", usage: "URL de base", safe: <Badge text="Non" variant="success" /> },
          ]}
        />
      </Section>
      <Section title="Configuration sécurité">
        <DataTable
          columns={[
            { key: "param", label: "Paramètre" },
            { key: "value", label: "Valeur" },
          ]}
          rows={[
            { param: "Session TTL (access)", value: "15 min" },
            { param: "Session TTL (refresh)", value: "30 jours" },
            { param: "Admin session TTL", value: "4 heures" },
            { param: "Inactivity timeout", value: "15 min (dashboards)" },
            { param: "Password hashing", value: "bcrypt (12 rounds)" },
            { param: "Rate limit (login)", value: "5 tentatives / 15 min" },
            { param: "CSP unsafe-eval", value: "Dev uniquement" },
            { param: "Cookie prefix (prod)", value: "__Host- / __Secure-" },
          ]}
        />
      </Section>
    </div>
  );
}
