"use client";

import Link from "next/link";
import { COOKIES_SECTIONS, COOKIES_VERSION, COOKIES_DATE } from "@/lib/cookies";
import styles from "./page.module.scss";

export default function CookiesPage() {
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
          <h1 className={styles.title}>Politique Cookies</h1>
          <p className={styles.meta}>
            Version {COOKIES_VERSION} &mdash; En vigueur depuis le {COOKIES_DATE}
          </p>
          <p className={styles.editor}>
            Tuatha SAS &mdash; Paris &mdash; contact@tuatha-app.com
          </p>
        </header>

        <nav className={styles.toc}>
          <p className={styles.tocTitle}>Sommaire</p>
          <ul className={styles.tocList}>
            {COOKIES_SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className={styles.tocLink}>
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.content}>
          {COOKIES_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className={styles.section}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <div className={styles.sectionBody}>
                {section.content.split("\n").map((paragraph, i) => {
                  const trimmed = paragraph.trim();
                  if (!trimmed) return <br key={i} />;

                  const rendered = trimmed.replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong>$1</strong>'
                  );

                  if (trimmed.startsWith("|")) {
                    const cells = trimmed.split("|").filter(Boolean).map(c => c.trim());
                    if (cells.every(c => c.match(/^-+$/))) return null;
                    const lines = section.content.split("\n");
                    const nextLine = lines[i + 1]?.trim();
                    const isHeader = nextLine?.startsWith("|") && nextLine.includes("---");
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

                  if (trimmed.startsWith("•") || trimmed.startsWith("–") || trimmed.startsWith("-")) {
                    return (
                      <p key={i} className={styles.bullet} dangerouslySetInnerHTML={{ __html: rendered }} />
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
          <p>Tuatha SAS &mdash; Version {COOKIES_VERSION} &mdash; {COOKIES_DATE}</p>
          <p className={styles.footerLinks}>
            <Link href="/cgu">CGU</Link>
            {" · "}
            <Link href="/confidentialite">Confidentialit&eacute;</Link>
            {" · "}
            <Link href="/charte-partage">Charte Partage</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
