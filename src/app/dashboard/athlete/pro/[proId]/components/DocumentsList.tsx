"use client";

import styles from "../page.module.scss";
import type { DocItem } from "./types";
import { DOC_CATEGORIES, docIcon, fmtSize } from "./types";

export default function DocumentsList({ docs }: { docs: DocItem[] }) {
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

  const handleDownload = (doc: DocItem) => {
    const url = `/api/athlete/documents/download?id=${doc.id}&type=${doc.direction}`;
    window.open(url, "_blank");
  };

  return (
    <div className={styles.docList}>
      {docs.map((doc) => (
        <div key={doc.id} className={styles.docCard} onClick={() => handleDownload(doc)}>
          <div className={styles.docIconBox}>
            <span className={styles.docEmoji}>{docIcon(doc.mimeType)}</span>
          </div>
          <div className={styles.docInfo}>
            <div className={styles.docName}>{doc.originalName}</div>
            <div className={styles.docMeta}>
              <span className={styles.docCat}>{DOC_CATEGORIES[doc.category] || doc.category}</span>
              <span>{fmtSize(doc.size)}</span>
              <span>{fmtDate(doc.createdAt)}</span>
            </div>
            <div className={styles.docDirection}>
              {doc.direction === "received" ? (
                <span className={styles.docReceived}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Reçu{doc.senderName ? ` de ${doc.senderName}` : ""}
                </span>
              ) : (
                <span className={styles.docSent}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  Envoyé par vous
                </span>
              )}
            </div>
            {doc.note && <div className={styles.docNote}>{doc.note}</div>}
          </div>
          <div className={styles.docDlBtn} title="Ouvrir / Télécharger">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          </div>
        </div>
      ))}
    </div>
  );
}
