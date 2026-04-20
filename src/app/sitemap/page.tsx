"use client";

import Link from "next/link";
import styles from "./page.module.scss";

const SECTIONS = [
  {
    title: "Général",
    links: [
      { href: "/", label: "Accueil / Connexion" },
      { href: "/inscription", label: "Inscription" },
      { href: "/inscription/professionnel", label: "Inscription professionnel" },
      { href: "/inscription/professionnel/configuration", label: "Configuration du compte" },
      { href: "/inscription/verifier-email", label: "Vérification email" },
      { href: "/mot-de-passe-oublie", label: "Mot de passe oublié" },
      { href: "/reinitialiser-mot-de-passe", label: "Réinitialiser le mot de passe" },
      { href: "/dashboard/confirmation", label: "Confirmation d'inscription" },
      { href: "/offline", label: "Page hors-ligne (PWA)" },
    ],
  },
  {
    title: "Dashboard — Médecin",
    badge: "Auth",
    links: [
      { href: "/dashboard/medecin", label: "Tableau de bord" },
      { href: "/dashboard/medecin/programmes", label: "Programmes" },
      { href: "/dashboard/medecin/indicateurs", label: "Indicateurs" },
      { href: "/dashboard/medecin/reseau", label: "Réseau" },
      { href: "/dashboard/medecin/messagerie", label: "Messagerie" },
      { href: "/dashboard/medecin/documents", label: "Documents" },
      { href: "/dashboard/medecin/facturation", label: "Facturation" },
      { href: "/dashboard/medecin/cabinet", label: "Cabinet" },
      { href: "/dashboard/medecin/profil", label: "Profil" },
    ],
  },
  {
    title: "Dashboard — Kiné",
    badge: "Auth",
    links: [
      { href: "/dashboard/kine", label: "Tableau de bord" },
      { href: "/dashboard/kine/programmes", label: "Programmes" },
      { href: "/dashboard/kine/indicateurs", label: "Indicateurs" },
      { href: "/dashboard/kine/reseau", label: "Réseau" },
      { href: "/dashboard/kine/messagerie", label: "Messagerie" },
      { href: "/dashboard/kine/documents", label: "Documents" },
      { href: "/dashboard/kine/facturation", label: "Facturation" },
      { href: "/dashboard/kine/cabinet", label: "Cabinet" },
      { href: "/dashboard/kine/profil", label: "Profil" },
    ],
  },
  {
    title: "Dashboard — Autre professionnel",
    badge: "Auth",
    links: [
      { href: "/dashboard/coach", label: "Tableau de bord" },
      { href: "/dashboard/coach/programmes", label: "Programmes" },
      { href: "/dashboard/coach/indicateurs", label: "Indicateurs" },
      { href: "/dashboard/coach/reseau", label: "Réseau" },
      { href: "/dashboard/coach/messagerie", label: "Messagerie" },
      { href: "/dashboard/coach/documents", label: "Documents" },
      { href: "/dashboard/coach/facturation", label: "Facturation" },
      { href: "/dashboard/coach/cabinet", label: "Cabinet" },
      { href: "/dashboard/coach/profil", label: "Profil" },
    ],
  },
  {
    title: "Dashboard — Diététicien",
    badge: "Auth",
    links: [
      { href: "/dashboard/nutri", label: "Tableau de bord" },
      { href: "/dashboard/nutri/programmes", label: "Programmes" },
      { href: "/dashboard/nutri/indicateurs", label: "Indicateurs" },
      { href: "/dashboard/nutri/reseau", label: "Réseau" },
      { href: "/dashboard/nutri/messagerie", label: "Messagerie" },
      { href: "/dashboard/nutri/documents", label: "Documents" },
      { href: "/dashboard/nutri/facturation", label: "Facturation" },
      { href: "/dashboard/nutri/cabinet", label: "Cabinet" },
      { href: "/dashboard/nutri/profil", label: "Profil" },
    ],
  },
  {
    title: "Légal, Confidentialité & Support",
    links: [
      { href: "/cgu", label: "Conditions Générales d'Utilisation" },
      { href: "/confidentialite", label: "Politique de confidentialité" },
      { href: "/cookies", label: "Politique de cookies" },
      { href: "/charte-partage", label: "Charte de partage des données" },
      { href: "/support", label: "Support & aide" },
      { href: "/faq", label: "Foire aux questions (FAQ)" },
    ],
  },
];

export default function SitemapPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <button
            className={styles.backLink}
            onClick={() => {
              if (window.history.length <= 1) window.close();
              else window.history.back();
            }}
          >
            &larr; Retour
          </button>
          <h1 className={styles.title}>Plan du site</h1>
          <p className={styles.subtitle}>Toutes les pages accessibles sur Tuatha Pro.</p>
        </header>

        {SECTIONS.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {section.title}
              {section.badge && <span className={styles.badge}>{section.badge}</span>}
            </h2>
            <div className={styles.links}>
              {section.links.map((link) => (
                <Link key={link.href} href={link.href} className={styles.link}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  <span className={styles.linkLabel}>{link.label}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
