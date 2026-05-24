"use client";
import { PageHeader, InfoBox, Section, DataTable, Badge } from "../components";

export default function CompliancePage() {
  return (
    <div>
      <PageHeader title="Conformité RGPD / HDS" subtitle="Suivi de la conformité réglementaire" />
      <InfoBox text="Ce tableau récapitule les mesures RGPD et HDS implémentées dans Tuatha." />
      <Section title="RGPD — Droits des utilisateurs">
        <DataTable
          columns={[
            { key: "droit", label: "Droit" },
            { key: "status", label: "Implémenté" },
            { key: "api", label: "Endpoint" },
          ]}
          rows={[
            { droit: "Droit d'accès (Art. 15)", status: <Badge text="OK" variant="success" />, api: "/api/athlete/export" },
            { droit: "Droit de rectification (Art. 16)", status: <Badge text="OK" variant="success" />, api: "Profil athlète/pro" },
            { droit: "Droit à l'effacement (Art. 17)", status: <Badge text="OK" variant="success" />, api: "/api/athlete/delete" },
            { droit: "Droit à la portabilité (Art. 20)", status: <Badge text="OK" variant="success" />, api: "/api/athlete/export (JSON)" },
            { droit: "Droit d'opposition (Art. 21)", status: <Badge text="OK" variant="success" />, api: "Retrait consentement" },
            { droit: "Consentement explicite (Art. 7)", status: <Badge text="OK" variant="success" />, api: "/api/athlete/consents" },
            { droit: "Minimisation données (Art. 5)", status: <Badge text="OK" variant="success" />, api: "Data minimization cron" },
            { droit: "Registre traitements (Art. 30)", status: <Badge text="OK" variant="success" />, api: "AdminLog + ConsentLog" },
          ]}
        />
      </Section>
      <Section title="HDS — Hébergement données de santé">
        <DataTable
          columns={[
            { key: "mesure", label: "Mesure" },
            { key: "status", label: "Statut" },
            { key: "detail", label: "Détail" },
          ]}
          rows={[
            { mesure: "Chiffrement au repos", status: <Badge text="OK" variant="success" />, detail: "AES-256-GCM (vault.ts)" },
            { mesure: "Chiffrement en transit", status: <Badge text="OK" variant="success" />, detail: "HTTPS + HSTS" },
            { mesure: "Contrôle d'accès", status: <Badge text="OK" variant="success" />, detail: "RBAC athlète/pro/admin" },
            { mesure: "Traçabilité", status: <Badge text="OK" variant="success" />, detail: "AccessLog + AdminLog + ConsentLog" },
            { mesure: "Backup chiffré", status: <Badge text="OK" variant="success" />, detail: "/api/admin/backup" },
            { mesure: "Soft delete + rétention", status: <Badge text="OK" variant="success" />, detail: "30j rétention, purge auto" },
            { mesure: "Masquage back-office", status: <Badge text="OK" variant="success" />, detail: "Aucun contenu médical visible" },
          ]}
        />
      </Section>
    </div>
  );
}
