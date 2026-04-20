"use client";

import { useState } from "react";
import styles from "../page.module.scss";
import type { AlertItem } from "./types";

export default function AlertsList({ alerts }: { alerts: AlertItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const dotColor = (status: string) => {
    if (status === "closed") return "#6b7280";
    if (status === "read") return "#f59e0b";
    return "#ef4444";
  };

  const statusLabel = (status: string) => {
    if (status === "closed") return "Résolu";
    if (status === "read") return "Lu";
    return "Non lu";
  };

  const statusColor = (status: string) => {
    if (status === "closed") return "#22c55e";
    if (status === "read") return "#f59e0b";
    return "#ef4444";
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className={styles.suiviAlertList}>
      {alerts.map((a) => {
        const isOpen = openId === a.id;
        return (
          <div
            key={a.id}
            className={`${styles.suiviAlertItem} ${isOpen ? styles.suiviAlertItemOpen : ""}`}
            onClick={() => setOpenId(isOpen ? null : a.id)}
          >
            <div className={styles.suiviAlertHead}>
              <span className={styles.suiviAlertDot} style={{ background: dotColor(a.status) }} />
              <div className={styles.suiviAlertInfo}>
                <span className={styles.suiviAlertTitle}>{a.title}</span>
                <span className={styles.suiviAlertMeta}>
                  {fmtDate(a.createdAt)}
                  {a.intensity != null && ` · Intensité ${a.intensity}/10`}
                  {a.origin === "patient" && " · Par vous"}
                </span>
              </div>
              <span
                className={styles.suiviAlertBadge}
                style={{ color: statusColor(a.status), borderColor: `${statusColor(a.status)}40` }}
              >
                {statusLabel(a.status)}
              </span>
            </div>
            {isOpen && (
              <div className={styles.suiviAlertDetail}>
                {a.description && <p className={styles.suiviAlertDesc}>{a.description}</p>}
                {a.planTitle && <p className={styles.suiviAlertPlan}>Programme : {a.planTitle}</p>}
                {a.closedAt && <p className={styles.suiviAlertClosed}>Résolu le {fmtDate(a.closedAt)}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
