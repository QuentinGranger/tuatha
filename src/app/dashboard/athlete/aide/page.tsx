"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../../../support/page.module.scss";
import LegalFooter from "../components/LegalFooter";

const TODAY = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const TOC = [
  { id: "mission", label: "1. À quoi sert le Support Tuatha ?" },
  { id: "contact", label: "2. Comment contacter le support ?" },
  { id: "demandes", label: "3. Types de demandes prises en charge" },
  { id: "sla", label: "4. Délais de réponse (SLA)" },
  { id: "confidentialite", label: "5. Engagements de confidentialité" },
  { id: "compromis", label: "6. Procédure « Compte compromis »" },
  { id: "faq", label: "7. Aide rapide (FAQ)" },
  { id: "signalement", label: "8. Signalement & abus" },
  { id: "rgpd", label: "9. RGPD : exercer vos droits" },
  { id: "statut", label: "10. Statut service & incidents" },
];

export default function AidePage() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Header ── */}
        <header className={styles.header}>
          <button
            className={styles.backLink}
            onClick={() => router.push("/dashboard/athlete")}
          >
            &larr; Retour au tableau de bord
          </button>
          <h1 className={styles.title}>Support &amp; Aide</h1>
          <p className={styles.meta}>Tuatha App (Paris) &mdash; Derni&egrave;re mise &agrave; jour : {TODAY}</p>
        </header>

        {/* ── Contact banner ── */}
        <div className={styles.contactBanner}>
          <div className={styles.contactItem}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <a href="mailto:contact@tuatha-app.com">contact@tuatha-app.com</a>
          </div>
          <div className={styles.contactItem}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <a href="tel:+33671638306">+33 6.71.63.83.06</a>
          </div>
        </div>

        {/* ── Urgency notice ── */}
        <div className={styles.urgencyBanner}>
          <strong>Important :</strong> le Support Tuatha n&apos;est pas un service m&eacute;dical et ne fournit pas de diagnostic. En cas d&apos;urgence m&eacute;dicale, contactez le <strong>15 / 112</strong>.
        </div>

        {/* ── TOC ── */}
        <nav className={styles.toc}>
          <p className={styles.tocTitle}>Sommaire</p>
          <ul className={styles.tocList}>
            {TOC.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className={styles.tocLink}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Content ── */}
        <div className={styles.content}>

          {/* 1 — Mission */}
          <section id="mission" className={styles.section}>
            <h2 className={styles.sectionTitle}>1. &Agrave; quoi sert le Support Tuatha ?</h2>
            <div className={styles.sectionBody}>
              <p className={styles.paragraph}>Le Support Tuatha a pour mission de :</p>
              <p className={styles.bullet}>Vous aider &agrave; utiliser la Plateforme (compte, partage Athl&egrave;te &harr; Pro, documents, param&egrave;tres)</p>
              <p className={styles.bullet}>Traiter les incidents techniques (bugs, erreurs, probl&egrave;mes d&apos;acc&egrave;s)</p>
              <p className={styles.bullet}>R&eacute;pondre aux questions RGPD / confidentialit&eacute; (droits, acc&egrave;s, suppression, export)</p>
              <p className={styles.bullet}>G&eacute;rer les demandes li&eacute;es &agrave; la s&eacute;curit&eacute; (compte compromis, acc&egrave;s suspect, usurpation)</p>
              <p className={styles.bullet}>Traiter les demandes sp&eacute;cifiques aux Professionnels (v&eacute;rification, statut, acc&egrave;s &agrave; un Athl&egrave;te)</p>
            </div>
          </section>

          {/* 2 — Contact */}
          <section id="contact" className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Comment contacter le support ?</h2>
            <div className={styles.sectionBody}>
              <h3 className={styles.subTitle}>Formulaire de demande (recommandé)</h3>
              <p className={styles.paragraph}>
                <Link href="/dashboard/athlete/aide/support" style={{ display: "inline-block", padding: "0.6rem 1.2rem", borderRadius: "8px", background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>
                  Contacter le support
                </Link>
              </p>
              <h3 className={styles.subTitle}>Canal email</h3>
              <p className={styles.paragraph}>Email : <a href="mailto:contact@tuatha-app.com">contact@tuatha-app.com</a></p>

              <h3 className={styles.subTitle}>Canal secondaire</h3>
              <p className={styles.paragraph}>T&eacute;l&eacute;phone : <a href="tel:+33671638306">+33 6.71.63.83.06</a> <em>(uniquement en cas d&apos;urgence s&eacute;curit&eacute; / blocage critique)</em></p>

              <h3 className={styles.subTitle}>Informations &agrave; inclure dans votre message</h3>
              <p className={styles.bullet}>Votre email de compte Tuatha</p>
              <p className={styles.bullet}>Votre statut : Athl&egrave;te ou Pro</p>
              <p className={styles.bullet}>La description du probl&egrave;me (quand, o&ugrave;, comment)</p>
              <p className={styles.bullet}>Une capture si possible (sans infos trop sensibles)</p>
              <p className={styles.bullet}>Le type d&apos;appareil (iPhone / Android / Web) + navigateur si web</p>
              <p className={styles.bullet}>Si le probl&egrave;me concerne un partage : nom du Pro / Athl&egrave;te concern&eacute;</p>
            </div>
          </section>

          {/* 3 — Types de demandes */}
          <section id="demandes" className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Types de demandes prises en charge</h2>
            <div className={styles.sectionBody}>
              <h3 className={styles.subTitle}>A) Compte &amp; connexion</h3>
              <p className={styles.bullet}>Email non re&ccedil;u / activation</p>
              <p className={styles.bullet}>Mot de passe oubli&eacute;</p>
              <p className={styles.bullet}>Authentification renforc&eacute;e (si activ&eacute;e)</p>
              <p className={styles.bullet}>Changement d&apos;email / t&eacute;l&eacute;phone</p>

              <h3 className={styles.subTitle}>B) Partage Athl&egrave;te &harr; Pro</h3>
              <p className={styles.bullet}>Inviter / accepter / refuser un Pro</p>
              <p className={styles.bullet}>R&eacute;gler &laquo; qui voit quoi &raquo; (p&eacute;rim&egrave;tres / scopes)</p>
              <p className={styles.bullet}>Limiter la dur&eacute;e / renouveler</p>
              <p className={styles.bullet}>R&eacute;voquer l&apos;acc&egrave;s</p>

              <h3 className={styles.subTitle}>C) Documents &amp; donn&eacute;es de sant&eacute;</h3>
              <p className={styles.bullet}>Upload impossible (PDF / image)</p>
              <p className={styles.bullet}>Document illisible / erreurs</p>
              <p className={styles.bullet}>Droits d&apos;acc&egrave;s d&apos;un Pro &agrave; un document</p>
              <p className={styles.bullet}>Export / t&eacute;l&eacute;chargement</p>

              <h3 className={styles.subTitle}>D) Bugs &amp; performance</h3>
              <p className={styles.bullet}>Page qui charge mal</p>
              <p className={styles.bullet}>Crash / erreurs</p>
              <p className={styles.bullet}>Lenteur</p>

              <h3 className={styles.subTitle}>E) S&eacute;curit&eacute;</h3>
              <p className={styles.bullet}>Suspicion de compte compromis</p>
              <p className={styles.bullet}>Acc&egrave;s suspect / connexion inconnue</p>
              <p className={styles.bullet}>Signalement de comportement abusif</p>
              <p className={styles.bullet}>Perte d&apos;acc&egrave;s suite &agrave; une v&eacute;rification</p>

              <h3 className={styles.subTitle}>F) RGPD &amp; confidentialit&eacute;</h3>
              <p className={styles.bullet}>Demande d&apos;acc&egrave;s &agrave; vos donn&eacute;es</p>
              <p className={styles.bullet}>Demande d&apos;export / portabilit&eacute; (si disponible)</p>
              <p className={styles.bullet}>Rectification / suppression (selon conditions)</p>
              <p className={styles.bullet}>Question sur cookies / traceurs</p>
            </div>
          </section>

          {/* 4 — SLA */}
          <section id="sla" className={styles.section}>
            <h2 className={styles.sectionTitle}>4. D&eacute;lais de r&eacute;ponse (SLA MVP)</h2>
            <div className={styles.sectionBody}>
              <p className={styles.paragraph}>Objectif : &ecirc;tre s&eacute;rieux, r&eacute;aliste, et clair.</p>

              <div className={styles.slaGrid}>
                <div className={`${styles.slaRow} ${styles.slaHeader}`}>
                  <div className={styles.slaCell}>Priorit&eacute;</div>
                  <div className={styles.slaCell}>Description</div>
                  <div className={styles.slaCell}>R&eacute;ponse cible</div>
                </div>
                <div className={styles.slaRow}>
                  <div className={styles.slaCell}><span className={`${styles.slaBadge} ${styles.p0}`}>P0</span></div>
                  <div className={styles.slaCell}>S&eacute;curit&eacute; critique / acc&egrave;s compromis / fuite suspect&eacute;e</div>
                  <div className={styles.slaCell}><strong>&lt; 24h</strong></div>
                </div>
                <div className={styles.slaRow}>
                  <div className={styles.slaCell}><span className={`${styles.slaBadge} ${styles.p1}`}>P1</span></div>
                  <div className={styles.slaCell}>Blocage total (connexion impossible, partage impossible, app inutilisable)</div>
                  <div className={styles.slaCell}><strong>&lt; 48h</strong></div>
                </div>
                <div className={styles.slaRow}>
                  <div className={styles.slaCell}><span className={`${styles.slaBadge} ${styles.p2}`}>P2</span></div>
                  <div className={styles.slaCell}>Bug non bloquant / question usage</div>
                  <div className={styles.slaCell}><strong>&lt; 72h</strong></div>
                </div>
                <div className={styles.slaRow}>
                  <div className={styles.slaCell}><span className={`${styles.slaBadge} ${styles.p3}`}>P3</span></div>
                  <div className={styles.slaCell}>Suggestions / demandes de features</div>
                  <div className={styles.slaCell}><strong>&lt; 7 jours</strong></div>
                </div>
              </div>

              <p className={styles.sectionSubLabel}>Ces d&eacute;lais sont indicatifs et peuvent &eacute;voluer pendant le MVP. Nous vous tenons inform&eacute; si la r&eacute;solution demande plus de temps.</p>
            </div>
          </section>

          {/* 5 — Confidentialité */}
          <section id="confidentialite" className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Engagements de confidentialit&eacute; du Support</h2>
            <div className={styles.sectionBody}>
              <p className={styles.paragraph}>Parce que Tuatha peut traiter des donn&eacute;es sensibles (dont des donn&eacute;es de sant&eacute;), le Support applique ces r&egrave;gles :</p>
              <p className={styles.bullet}>Acc&egrave;s strictement limit&eacute; au besoin d&apos;assistance</p>
              <p className={styles.bullet}>Jamais de demande de mot de passe</p>
              <p className={styles.bullet}>Limitation des copies d&apos;&eacute;cran et des transferts</p>
              <p className={styles.bullet}>Priorit&eacute; &agrave; des informations minimis&eacute;es (vous pouvez masquer certains &eacute;l&eacute;ments)</p>
              <p className={styles.paragraph}>Si vous nous envoyez un document m&eacute;dical par email, nous vous recommanderons souvent de le d&eacute;poser via l&apos;app (quand possible), car c&apos;est plus s&eacute;curis&eacute;.</p>
            </div>
          </section>

          {/* 6 — Compte compromis */}
          <section id="compromis" className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Proc&eacute;dure &laquo; Compte compromis &raquo; (urgence s&eacute;curit&eacute;)</h2>
            <div className={styles.sectionBody}>
              <p className={styles.paragraph}>Si vous pensez que votre compte a &eacute;t&eacute; compromis :</p>
              <p className={styles.bullet}>Envoyez un email &agrave; <a href="mailto:contact@tuatha-app.com">contact@tuatha-app.com</a> avec l&apos;objet : <strong>[URGENT S&Eacute;CURIT&Eacute;] Compte compromis</strong></p>
              <p className={styles.bullet}>Indiquez : email du compte + dernier acc&egrave;s suspect + appareil</p>
              <p className={styles.bullet}>Si possible : <strong>changez votre mot de passe imm&eacute;diatement</strong></p>

              <h3 className={styles.subTitle}>Nous pouvons :</h3>
              <p className={styles.bullet}>R&eacute;voquer toutes les sessions</p>
              <p className={styles.bullet}>Bloquer temporairement le compte</p>
              <p className={styles.bullet}>V&eacute;rifier l&apos;historique de connexions</p>
              <p className={styles.bullet}>Vous accompagner pour s&eacute;curiser l&apos;acc&egrave;s</p>
            </div>
          </section>

          {/* 7 — FAQ */}
          <section id="faq" className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Aide rapide (FAQ)</h2>
            <div className={styles.sectionBody}>
              <h3 className={styles.subTitle}>Je n&apos;arrive pas &agrave; connecter un Pro</h3>
              <p className={styles.bullet}>V&eacute;rifiez que le Pro utilise la m&ecirc;me adresse email que celle connue dans Tuatha</p>
              <p className={styles.bullet}>V&eacute;rifiez que vous avez bien valid&eacute; le partage et les p&eacute;rim&egrave;tres</p>
              <p className={styles.bullet}>V&eacute;rifiez la dur&eacute;e d&apos;acc&egrave;s (pas expir&eacute;e)</p>

              <h3 className={styles.subTitle}>Un Pro voit trop de choses / pas assez</h3>
              <p className={styles.bullet}>Allez dans : <strong>Param&egrave;tres &gt; Partage des donn&eacute;es</strong></p>
              <p className={styles.bullet}>Modifiez les p&eacute;rim&egrave;tres (scopes) et le niveau (lecture / commentaire / &eacute;dition)</p>
              <p className={styles.bullet}>R&eacute;voquez et reconnectez si n&eacute;cessaire</p>

              <h3 className={styles.subTitle}>Je veux supprimer mon compte</h3>
              <p className={styles.bullet}><strong>Param&egrave;tres &gt; Compte &gt; Suppression</strong> (si disponible)</p>
              <p className={styles.bullet}>Sinon : email &agrave; <a href="mailto:contact@tuatha-app.com">contact@tuatha-app.com</a></p>
              <p className={styles.sectionSubLabel}>Certaines donn&eacute;es peuvent &ecirc;tre conserv&eacute;es temporairement pour des raisons l&eacute;gales / s&eacute;curit&eacute; (logs, preuves).</p>

              <h3 className={styles.subTitle}>Je veux un export de mes donn&eacute;es</h3>
              <p className={styles.bullet}><strong>Param&egrave;tres &gt; Donn&eacute;es &gt; Export</strong> (si disponible)</p>
              <p className={styles.bullet}>Sinon : demande au support (portabilit&eacute; selon conditions)</p>
            </div>
          </section>

          {/* 8 — Signalement */}
          <section id="signalement" className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Signalement &amp; abus</h2>
            <div className={styles.sectionBody}>
              <p className={styles.paragraph}>Vous pouvez signaler :</p>
              <p className={styles.bullet}>Usurpation d&apos;identit&eacute; pro</p>
              <p className={styles.bullet}>Faux documents</p>
              <p className={styles.bullet}>Comportements dangereux</p>
              <p className={styles.bullet}>Tentative d&apos;acc&egrave;s non autoris&eacute;</p>
              <p className={styles.paragraph}>Email : <a href="mailto:contact@tuatha-app.com">contact@tuatha-app.com</a><br />Objet conseill&eacute; : <strong>[SIGNALEMENT] &hellip;</strong></p>
            </div>
          </section>

          {/* 9 — RGPD */}
          <section id="rgpd" className={styles.section}>
            <h2 className={styles.sectionTitle}>9. RGPD : comment exercer vos droits</h2>
            <div className={styles.sectionBody}>
              <p className={styles.paragraph}>Pour toute demande RGPD :</p>
              <p className={styles.paragraph}>Email : <a href="mailto:contact@tuatha-app.com">contact@tuatha-app.com</a><br />Objet : <strong>[RGPD] Acc&egrave;s / Rectification / Suppression / Portabilit&eacute;</strong></p>
              <p className={styles.paragraph}>Nous r&eacute;pondons sous <strong>1 mois</strong> (d&eacute;lai RGPD), sauf cas complexe.</p>
            </div>
          </section>

          {/* 10 — Statut */}
          <section id="statut" className={styles.section}>
            <h2 className={styles.sectionTitle}>10. Statut service &amp; incidents</h2>
            <div className={styles.sectionBody}>
              <p className={styles.paragraph}>En cas d&apos;incident majeur :</p>
              <p className={styles.bullet}>Tuatha communique via l&apos;app (banni&egrave;re)</p>
              <p className={styles.bullet}>Et/ou par email si n&eacute;cessaire</p>
              <p className={styles.bullet}>Indication des mesures prises (maintenance, restauration, correctif)</p>
            </div>
          </section>
        </div>

        {/* ── Footer ── */}
        <LegalFooter />
      </div>
    </div>
  );
}
