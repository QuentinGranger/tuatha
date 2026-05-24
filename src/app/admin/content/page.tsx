"use client";
import { PageHeader, Section, DataTable, Badge } from "../components";

export default function ContentPage() {
  return (
    <div>
      <PageHeader title="Contenu & Pages légales" subtitle="Gestion des pages statiques et textes légaux" />
      <Section title="Pages légales">
        <DataTable
          columns={[
            { key: "page", label: "Page" },
            { key: "url", label: "URL" },
            { key: "status", label: "Statut" },
          ]}
          rows={[
            { page: "Conditions Générales d'Utilisation", url: "/cgu", status: <Badge text="Publiée" variant="success" /> },
            { page: "Politique de confidentialité", url: "/politique-de-confidentialite", status: <Badge text="Publiée" variant="success" /> },
            { page: "Mentions légales", url: "/mentions-legales", status: <Badge text="Publiée" variant="success" /> },
            { page: "Cookies", url: "/politique-cookies", status: <Badge text="Publiée" variant="success" /> },
          ]}
        />
      </Section>
      <Section title="Contenu modifiable">
        <div style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(148,163,184,0.08)", borderRadius: "0.75rem", padding: "1.25rem", fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.8 }}>
          <div><strong style={{ color: "#e2e8f0" }}>Pages statiques :</strong> Éditées directement dans le code (app/cgu, app/mentions-legales, etc.)</div>
          <div><strong style={{ color: "#e2e8f0" }}>Emails transactionnels :</strong> Templates dans lib/email</div>
          <div><strong style={{ color: "#e2e8f0" }}>Textes UI :</strong> Fichiers i18n (fr/en)</div>
        </div>
      </Section>
    </div>
  );
}
