"use client";

import Link from "next/link";
import { CGU_SECTIONS, CGU_VERSION, CGU_DATE } from "@/lib/cgu";
import styles from "./page.module.scss";

export default function CguPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <button
            className={styles.backLink}
            onClick={() => {
              if (window.opener || window.history.length <= 1) {
                window.close();
              } else {
                window.history.back();
              }
            }}
          >
            &larr; Fermer
          </button>
          <h1 className={styles.title}>Conditions G&eacute;n&eacute;rales d&apos;Utilisation</h1>
          <p className={styles.meta}>
            Version {CGU_VERSION} &mdash; En vigueur depuis le {CGU_DATE}
          </p>
          <p className={styles.editor}>
            &Eacute;diteur : Tuatha SAS &mdash; Contact : support@tuatha.app
          </p>
        </header>

        <nav className={styles.toc}>
          <p className={styles.tocTitle}>Sommaire</p>
          <ul className={styles.tocList}>
            {CGU_SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className={styles.tocLink}>
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.content}>
          {CGU_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className={styles.section}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <div className={styles.sectionBody}>
                {section.content.split("\n").map((paragraph, i) => {
                  const trimmed = paragraph.trim();
                  if (!trimmed) return <br key={i} />;

                  // Render markdown-style bold
                  const rendered = trimmed.replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong>$1</strong>'
                  );

                  // Table rows
                  if (trimmed.startsWith("|")) {
                    const cells = trimmed.split("|").filter(Boolean).map(c => c.trim());
                    if (cells.every(c => c.match(/^-+$/))) return null;
                    const isHeader = i > 0 && section.content.split("\n")[i + 1]?.trim().startsWith("|---");
                    if (isHeader) {
                      return (
                        <div key={i} className={styles.tableRow + " " + styles.tableHeader}>
                          {cells.map((cell, j) => (
                            <span key={j} className={styles.tableCell} dangerouslySetInnerHTML={{ __html: cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          ))}
                        </div>
                      );
                    }
                    return (
                      <div key={i} className={styles.tableRow}>
                        {cells.map((cell, j) => (
                          <span key={j} className={styles.tableCell} dangerouslySetInnerHTML={{ __html: cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        ))}
                      </div>
                    );
                  }

                  // Bullet points
                  if (trimmed.startsWith("•") || trimmed.startsWith("–") || trimmed.startsWith("-")) {
                    return (
                      <p key={i} className={styles.bullet} dangerouslySetInnerHTML={{ __html: rendered }} />
                    );
                  }

                  // Italic sections
                  if (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**")) {
                    return (
                      <p key={i} className={styles.sectionSubLabel}>
                        {trimmed.replace(/^\*|\*$/g, "")}
                      </p>
                    );
                  }

                  return (
                    <p key={i} className={styles.paragraph} dangerouslySetInnerHTML={{ __html: rendered }} />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className={styles.footer}>
          <p>Tuatha SAS &mdash; Version {CGU_VERSION} &mdash; {CGU_DATE}</p>
          <p className={styles.footerLinks}>
            <Link href="/cgv">CGV</Link>
            {" · "}
            <Link href="/confidentialite">Politique de Confidentialit&eacute;</Link>
            {" · "}
            <Link href="/cookies">Cookies</Link>
            {" · "}
            <Link href="/charte-partage">Charte Partage</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
