"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.scss";

type FaqItem = { q: string; a: string };
type FaqSection = { id: string; title: string; icon: string; items: FaqItem[] };

const SECTIONS: FaqSection[] = [
  {
    id: "general",
    title: "Général",
    icon: "info",
    items: [
      {
        q: "Qu'est-ce que Tuatha ?",
        a: "Tuatha est une plateforme collaborative dédiée aux <strong>professionnels de santé et du sport</strong> (médecins, kinésithérapeutes, coachs sportifs, nutritionnistes). Elle permet de gérer vos athlètes, communiquer entre professionnels, partager des documents et suivre les programmes de vos patients — le tout dans un environnement sécurisé et conforme au RGPD.",
      },
      {
        q: "Qui peut utiliser Tuatha ?",
        a: "Tuatha est actuellement réservée aux professionnels des spécialités suivantes :<ul><li><strong>Médecin</strong> — ordonnances, protocoles, notes cliniques, signes vitaux</li><li><strong>Kinésithérapeute</strong> — plans de rééducation, vidéos d'exercices, alertes</li><li><strong>Coach sportif</strong> — programmes d'entraînement, sessions, vidéos athlète</li><li><strong>Nutritionniste</strong> — plans alimentaires, journal nutritionnel, mesures, consultations</li></ul>",
      },
      {
        q: "Tuatha est-elle gratuite ?",
        a: "Tuatha est actuellement en <strong>version alpha</strong>. L'accès est gratuit pendant cette phase. Un modèle de facturation sera introduit ultérieurement — vous serez prévenu en amont.",
      },
      {
        q: "L'application fonctionne-t-elle sur mobile ?",
        a: "Oui. Tuatha est une <strong>Progressive Web App (PWA)</strong>. Vous pouvez l'installer sur votre téléphone (iOS / Android) directement depuis le navigateur, sans passer par un store. Elle fonctionne également <strong>hors-ligne</strong> pour les fonctions essentielles.",
      },
      {
        q: "Comment installer Tuatha sur mon téléphone ?",
        a: "Sur votre navigateur mobile, rendez-vous sur Tuatha, puis :<ul><li><strong>iOS (Safari)</strong> : appuyez sur le bouton Partager → « Sur l'écran d'accueil »</li><li><strong>Android (Chrome)</strong> : une bannière d'installation apparaît automatiquement, ou via le menu ⋮ → « Installer l'application »</li></ul>",
      },
    ],
  },
  {
    id: "compte",
    title: "Compte & inscription",
    icon: "user",
    items: [
      {
        q: "Comment créer un compte ?",
        a: "Rendez-vous sur la <a href='/inscription'>page d'inscription</a>. Choisissez votre spécialité, remplissez vos informations, puis validez votre email via le lien reçu par mail. Vous serez ensuite guidé dans la <strong>configuration</strong> de votre profil.",
      },
      {
        q: "Je n'ai pas reçu l'email de vérification",
        a: "Vérifiez votre dossier spam. Si vous ne trouvez rien, rendez-vous sur la page de <a href='/inscription/verifier-email'>vérification email</a> pour renvoyer le lien. Si le problème persiste, contactez <a href='mailto:contact@tuatha-app.com'>contact@tuatha-app.com</a>.",
      },
      {
        q: "J'ai oublié mon mot de passe",
        a: "Cliquez sur <a href='/mot-de-passe-oublie'>Mot de passe oublié ?</a> sur la page de connexion. Un lien de réinitialisation sera envoyé à votre adresse email.",
      },
      {
        q: "Puis-je activer l'authentification à deux facteurs (2FA) ?",
        a: "Oui. Rendez-vous dans <strong>Profil → Sécurité</strong>. Vous pouvez activer la <strong>2FA TOTP</strong> (code à 6 chiffres via une application comme Google Authenticator) ou configurer une <strong>Passkey</strong> (empreinte digitale, Face ID, clé de sécurité).",
      },
      {
        q: "Puis-je me connecter avec Google, Outlook ou Apple ?",
        a: "Oui. Tuatha prend en charge l'authentification via <strong>Google</strong>, <strong>Microsoft Outlook</strong> et <strong>Apple</strong>. Vous pouvez lier ces comptes depuis votre profil.",
      },
      {
        q: "Comment supprimer mon compte ?",
        a: "Rendez-vous dans <strong>Profil → Compte → Suppression</strong>. Si l'option n'est pas encore disponible, envoyez un email à <a href='mailto:contact@tuatha-app.com'>contact@tuatha-app.com</a>. Certaines données peuvent être conservées temporairement pour des raisons légales (logs, factures).",
      },
    ],
  },
  {
    id: "dashboard",
    title: "Tableau de bord",
    icon: "layout",
    items: [
      {
        q: "Quelles pages sont disponibles dans mon dashboard ?",
        a: "Chaque spécialité dispose de :<ul><li><strong>Tableau de bord</strong> — vue d'ensemble</li><li><strong>Programmes</strong> — plans et sessions</li><li><strong>Indicateurs</strong> — suivi des métriques</li><li><strong>Réseau</strong> — connexions entre professionnels</li><li><strong>Messagerie</strong> — communication en temps réel</li><li><strong>Documents</strong> — partage et versioning</li><li><strong>Facturation</strong> — factures et paiements</li><li><strong>Cabinet</strong> — gestion d'équipe</li><li><strong>Profil</strong> — paramètres personnels et sécurité</li></ul>",
      },
      {
        q: "Les notifications sont-elles en temps réel ?",
        a: "Oui. Tuatha utilise les <strong>Server-Sent Events (SSE)</strong> pour les notifications en temps réel dans l'application, et les <strong>Push Notifications</strong> (Web Push / VAPID) pour les alertes même quand l'app est fermée.",
      },
      {
        q: "Puis-je utiliser Tuatha hors-ligne ?",
        a: "Oui. Les actions effectuées hors-ligne (envoi de message, modifications) sont mises en <strong>file d'attente</strong> et rejouées automatiquement dès le retour de la connexion. Un bandeau vous indique votre statut de connexion et le nombre d'actions en attente.",
      },
    ],
  },
  {
    id: "messagerie",
    title: "Messagerie",
    icon: "message",
    items: [
      {
        q: "Quelles fonctionnalités offre la messagerie ?",
        a: "La messagerie Tuatha est complète :<ul><li><strong>Conversations 1:1 et groupes</strong></li><li><strong>Pièces jointes</strong> (images, PDF, fichiers)</li><li><strong>Messages vocaux</strong></li><li><strong>Réactions emoji</strong></li><li><strong>Épingler</strong> et <strong>marquer important</strong></li><li><strong>Modifier</strong> et <strong>supprimer</strong> des messages</li><li><strong>Répondre</strong> à un message spécifique</li><li><strong>Indicateur de frappe</strong> et de <strong>présence</strong> en temps réel</li><li><strong>Recherche</strong> dans les conversations</li></ul>",
      },
      {
        q: "La messagerie fonctionne-t-elle hors-ligne ?",
        a: "Oui. Les messages envoyés hors-ligne sont mis en file d'attente et envoyés automatiquement au retour de la connexion. Les réactions, épingles, modifications et suppressions sont également supportées hors-ligne.",
      },
      {
        q: "Puis-je envoyer des fichiers dans la messagerie ?",
        a: "Oui. Vous pouvez joindre des <strong>images, PDF, documents</strong> et d'autres types de fichiers. Les fichiers sont analysés pour détecter les malwares avant d'être stockés.",
      },
      {
        q: "Comment créer une conversation de groupe ?",
        a: "Dans la messagerie, cliquez sur <strong>Nouveau groupe</strong>. Sélectionnez les professionnels à ajouter depuis votre réseau, donnez un nom au groupe et commencez à communiquer.",
      },
    ],
  },
  {
    id: "reseau",
    title: "Réseau professionnel",
    icon: "network",
    items: [
      {
        q: "Comment ajouter un professionnel à mon réseau ?",
        a: "Rendez-vous dans <strong>Réseau</strong> et recherchez le professionnel par nom ou spécialité. Envoyez une <strong>invitation</strong>. Une fois acceptée, vous pourrez collaborer, échanger des messages et partager des athlètes.",
      },
      {
        q: "Puis-je partager un athlète avec un autre professionnel ?",
        a: "Oui. Depuis la fiche athlète ou depuis le réseau, vous pouvez partager un athlète avec un professionnel connecté. Vous contrôlez les <strong>périmètres d'accès</strong> (quelles données sont visibles) et la <strong>durée</strong> du partage.",
      },
      {
        q: "Que sont les notes collaboratives ?",
        a: "Les <strong>notes collaboratives</strong> permettent aux professionnels partageant un athlète de rédiger et consulter des notes communes sur le suivi du patient. Elles facilitent la coordination pluridisciplinaire.",
      },
    ],
  },
  {
    id: "documents",
    title: "Documents & fichiers",
    icon: "file",
    items: [
      {
        q: "Quels types de documents puis-je partager ?",
        a: "Vous pouvez partager tout type de fichier : <strong>PDF, images, vidéos, tableurs</strong>, etc. Les documents bénéficient d'un <strong>versioning</strong> (historique des versions) et d'un contrôle d'accès granulaire.",
      },
      {
        q: "Les documents sont-ils sécurisés ?",
        a: "Oui. Les fichiers sont :<ul><li><strong>Analysés</strong> pour détecter les malwares à l'upload</li><li>Protégés par des <strong>URLs signées</strong> (accès temporaire)</li><li>Soumis au <strong>contrôle d'accès</strong> (RBAC / ABAC)</li><li>Soumis au <strong>contrôle de téléchargement</strong> et d'export</li></ul>",
      },
      {
        q: "Puis-je envoyer des vidéos ?",
        a: "Oui. Les <strong>kinés</strong> peuvent créer des vidéos d'exercices pour leurs plans de rééducation, et les <strong>coachs</strong> peuvent recevoir des vidéos d'athlètes via un lien sécurisé (sans nécessiter de compte).",
      },
    ],
  },
  {
    id: "specialites",
    title: "Fonctions par spécialité",
    icon: "stethoscope",
    items: [
      {
        q: "Quelles sont les fonctions spécifiques au médecin ?",
        a: "<ul><li><strong>Ordonnances</strong> et prescriptions</li><li><strong>Protocoles médicaux</strong></li><li><strong>Notes cliniques</strong></li><li><strong>Plans de suivi</strong></li><li><strong>Signes vitaux</strong> (entrées de constantes)</li><li><strong>Alertes médicales</strong></li></ul>",
      },
      {
        q: "Quelles sont les fonctions spécifiques au kinésithérapeute ?",
        a: "<ul><li><strong>Plans de rééducation</strong> (avec exercices)</li><li><strong>Bibliothèque de vidéos</strong> d'exercices</li><li><strong>Modèles d'exercices</strong> réutilisables</li><li><strong>Suivi des logs</strong> d'exercices (séries, répétitions)</li><li><strong>Alertes</strong> et règles d'alerte personnalisées</li></ul>",
      },
      {
        q: "Quelles sont les fonctions spécifiques au coach sportif ?",
        a: "<ul><li><strong>Programmes d'entraînement</strong> avec sessions détaillées</li><li><strong>Blocs d'exercices</strong> (échauffement, travail, récupération)</li><li><strong>Vidéos athlète</strong> (upload par lien sécurisé)</li><li><strong>Indicateurs de performance</strong></li></ul>",
      },
      {
        q: "Quelles sont les fonctions spécifiques au nutritionniste ?",
        a: "<ul><li><strong>Plans alimentaires</strong> avec repas et aliments détaillés</li><li><strong>Alternatives alimentaires</strong></li><li><strong>Journal nutritionnel</strong></li><li><strong>Mesures corporelles</strong></li><li><strong>Objectifs nutritionnels</strong></li><li><strong>Notes de consultation</strong></li><li><strong>Modèles de repas et de journées</strong> réutilisables</li><li><strong>Alertes</strong> et règles d'alerte personnalisées</li></ul>",
      },
    ],
  },
  {
    id: "facturation",
    title: "Facturation",
    icon: "receipt",
    items: [
      {
        q: "Comment fonctionne la facturation ?",
        a: "Depuis <strong>Facturation</strong>, vous pouvez créer des factures pour vos athlètes/patients. Chaque facture comporte un <strong>montant</strong>, une <strong>date d'échéance</strong>, un <strong>mode de paiement</strong> et un <strong>statut</strong> (impayée, payée, en retard, annulée).",
      },
      {
        q: "Puis-je exporter mes factures en PDF ?",
        a: "Oui. Vous pouvez <strong>générer un PDF</strong> de chaque facture directement depuis l'application pour l'envoyer ou l'archiver.",
      },
    ],
  },
  {
    id: "cabinet",
    title: "Cabinet & équipe",
    icon: "building",
    items: [
      {
        q: "Comment créer un cabinet ?",
        a: "Depuis <strong>Cabinet</strong>, vous pouvez créer votre structure, inviter des membres et gérer les rôles au sein de votre équipe.",
      },
      {
        q: "Quels rôles existent dans un cabinet ?",
        a: "Un cabinet dispose d'un <strong>propriétaire</strong> (créateur) et de <strong>membres</strong>. Le propriétaire peut gérer les accès, inviter ou retirer des membres, et consulter les logs d'administration.",
      },
    ],
  },
  {
    id: "securite",
    title: "Sécurité & confidentialité",
    icon: "shield",
    items: [
      {
        q: "Comment Tuatha protège-t-elle mes données ?",
        a: "Tuatha applique des mesures de sécurité avancées :<ul><li><strong>Chiffrement</strong> des données sensibles</li><li><strong>HTTPS obligatoire</strong> avec HSTS</li><li><strong>Protection CSRF</strong> et <strong>Content Security Policy</strong></li><li><strong>Rate limiting</strong> sur les API</li><li><strong>Contrôle d'accès</strong> RBAC + ABAC</li><li><strong>Détection de VPN</strong> et d'exfiltration</li><li><strong>Monitoring de sécurité</strong> et réponse aux incidents</li></ul>",
      },
      {
        q: "Tuatha est-elle conforme au RGPD ?",
        a: "Oui. Tuatha intègre :<ul><li><strong>Consentement</strong> explicite et traçable</li><li><strong>Droit d'accès</strong>, de rectification et de suppression</li><li><strong>Minimisation des données</strong></li><li><strong>Audit logs</strong> complets</li><li><strong>Soft delete</strong> (suppression logique)</li><li><strong>Redaction</strong> (masquage de données)</li><li>Pages <a href='/cgu'>CGU</a>, <a href='/confidentialite'>Confidentialité</a> et <a href='/cookies'>Cookies</a></li></ul>",
      },
      {
        q: "Que faire si mon compte est compromis ?",
        a: "Envoyez immédiatement un email à <a href='mailto:contact@tuatha-app.com'>contact@tuatha-app.com</a> avec l'objet <strong>[URGENT SÉCURITÉ] Compte compromis</strong>. Changez votre mot de passe et consultez notre page <a href='/support#compromis'>Support — Procédure compte compromis</a>.",
      },
      {
        q: "Mes données de santé sont-elles protégées ?",
        a: "Oui. Les données de santé sont traitées avec un niveau de protection renforcé, incluant le <strong>chiffrement</strong>, des accès <strong>strictement limités</strong>, et une gestion conforme aux exigences de la réglementation française et européenne sur les données de santé.",
      },
    ],
  },
  {
    id: "calendrier",
    title: "Calendrier & agenda",
    icon: "calendar",
    items: [
      {
        q: "Puis-je synchroniser mon agenda externe ?",
        a: "Oui. Tuatha prend en charge la synchronisation avec <strong>Google Calendar</strong>, <strong>Microsoft Outlook</strong> et <strong>Calendly</strong>. Vous pouvez connecter votre agenda depuis votre profil.",
      },
      {
        q: "Comment gérer mes disponibilités ?",
        a: "Depuis votre profil ou votre tableau de bord, vous pouvez configurer vos <strong>créneaux de disponibilité</strong>. Ceux-ci sont visibles par les professionnels de votre réseau si vous le souhaitez.",
      },
    ],
  },
];

const CATEGORY_ALL = "all";
const CATEGORIES = [
  { id: CATEGORY_ALL, label: "Tout" },
  { id: "general", label: "Général" },
  { id: "compte", label: "Compte" },
  { id: "dashboard", label: "Dashboard" },
  { id: "messagerie", label: "Messagerie" },
  { id: "reseau", label: "Réseau" },
  { id: "documents", label: "Documents" },
  { id: "specialites", label: "Spécialités" },
  { id: "facturation", label: "Facturation" },
  { id: "securite", label: "Sécurité" },
];

const ICONS: Record<string, React.ReactNode> = {
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  layout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  message: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  network: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>,
  stethoscope: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>,
  receipt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>,
  building: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
};

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ALL);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = activeCategory === CATEGORY_ALL
    ? SECTIONS
    : SECTIONS.filter((s) => s.id === activeCategory);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Header ── */}
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
          <h1 className={styles.title}>Foire aux questions</h1>
          <p className={styles.subtitle}>Trouvez rapidement des r&eacute;ponses sur l&apos;utilisation de Tuatha Pro.</p>
        </header>

        {/* ── Categories ── */}
        <div className={styles.categories}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={activeCategory === cat.id ? styles.categoryBtnActive : styles.categoryBtn}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* ── Sections ── */}
        {filtered.map((section) => (
          <div key={section.id} className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {ICONS[section.icon]}
              {section.title}
            </h2>

            {section.items.map((item, i) => {
              const key = `${section.id}-${i}`;
              const isOpen = openItems.has(key);
              return (
                <div key={key} className={isOpen ? styles.itemOpen : styles.item}>
                  <button
                    className={`${styles.question} ${isOpen ? styles.questionOpen : ""}`}
                    onClick={() => toggle(key)}
                  >
                    <span>{item.q}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div
                      className={styles.answer}
                      dangerouslySetInnerHTML={{ __html: item.a }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* ── Contact CTA ── */}
        <div className={styles.contactCta}>
          <p className={styles.ctaTitle}>Vous n&apos;avez pas trouv&eacute; votre r&eacute;ponse ?</p>
          <p className={styles.ctaText}>Notre &eacute;quipe support est l&agrave; pour vous aider.</p>
          <Link href="/support" className={styles.ctaButton}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            Contacter le support
          </Link>
        </div>

        {/* ── Footer ── */}
        <footer className={styles.footer}>
          <p>&copy; {new Date().getFullYear()} Tuatha SAS &mdash; Tous droits r&eacute;serv&eacute;s</p>
          <div className={styles.footerLinks}>
            <Link href="/cgu">CGU</Link>
            <Link href="/confidentialite">Confidentialit&eacute;</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="/support">Support</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
