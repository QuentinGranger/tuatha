"use client";

import { useState } from "react";
import styles from "../page.module.scss";
import type { KinePlan } from "./types";
import { formatShort } from "./types";

export default function HistoryList({ plans }: { plans: KinePlan[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className={styles.suiviHistList}>
      {plans.map((plan) => {
        const isOpen = openId === plan.id;
        const weeks = plan.startDate && plan.endDate
          ? Math.max(1, Math.round((new Date(plan.endDate).getTime() - new Date(plan.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)))
          : null;
        return (
          <div
            key={plan.id}
            className={`${styles.suiviHistCard} ${isOpen ? styles.suiviHistCardOpen : ""}`}
            onClick={() => setOpenId(isOpen ? null : plan.id)}
          >
            <div className={styles.suiviHistTop}>
              <div>
                <span className={styles.suiviHistTitle}>{plan.title}</span>
                {plan.pathology && <span className={styles.suiviHistPathology}>{plan.pathology}</span>}
              </div>
              {plan.outcomeScore != null && (
                <span className={styles.suiviHistScore}>{plan.outcomeScore}%</span>
              )}
            </div>
            <div className={styles.suiviHistMeta}>
              {plan.startDate && <span>{formatShort(plan.startDate)}</span>}
              {plan.endDate && <span>→ {formatShort(plan.endDate)}</span>}
              {weeks && <span>({weeks} sem.)</span>}
              <span>{plan.exercises.length} exercice{plan.exercises.length !== 1 ? "s" : ""}</span>
            </div>
            {isOpen && (
              <div className={styles.suiviHistDetail}>
                {plan.phase && <div className={styles.suiviHistRow}><strong>Phase finale :</strong> {plan.phase}</div>}
                {plan.objective && <div className={styles.suiviHistRow}><strong>Objectif :</strong> {plan.objective}</div>}
                {plan.conclusion && <div className={styles.suiviHistRow}><strong>Conclusion :</strong> {plan.conclusion}</div>}
                <div className={styles.suiviHistRow}><strong>Progression :</strong> {plan.progress}%</div>
                {plan.exercises.length > 0 && (
                  <div className={styles.suiviHistExList}>
                    {plan.exercises.map((ex, i) => (
                      <div key={ex.id} className={styles.suiviHistExItem}>
                        <span>{i + 1}. {ex.video.title}</span>
                        {ex.logsCount > 0 && <span>{ex.logsCount} session{ex.logsCount > 1 ? "s" : ""}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
