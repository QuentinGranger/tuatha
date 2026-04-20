"use client";

import React from "react";
import styles from "../page.module.scss";
import type { Toast } from "../hooks/useToast";

interface Props {
  toasts: Toast[];
  dismissToast: (id: string) => void;
}

export function ToastContainer({ toasts, dismissToast }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[`toast--${t.type}`]}`}
          onClick={() => dismissToast(t.id)}
          role="alert"
        >
          <span className={styles.toastIcon}>
            {t.type === "success" ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : t.type === "error" ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            )}
          </span>
          <span className={styles.toastMessage}>{t.message}</span>
          <button className={styles.toastDismiss} onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
