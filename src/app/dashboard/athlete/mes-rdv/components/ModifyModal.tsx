"use client";

import React from "react";
import styles from "../page.module.scss";
import { formatDate, formatTime } from "../constants";
import { useAppointmentActions } from "../hooks/useAppointmentActions";
import { getCancellationEligibility } from "@/lib/cancellation";

type Actions = ReturnType<typeof useAppointmentActions>;

interface Props {
  actions: Actions;
}

export function ModifyModal({ actions }: Props) {
  const {
    modifyingRdv, modifyView, setModifyView, closeModifyModal,
    modifyLoading, cancelReason, setCancelReason,
    handleCancel, loadRescheduleSlots, handleReschedule,
    rescheduleLoading, rescheduleSlots,
    waitlistStatus, handleWaitlist,
  } = actions;

  if (!modifyingRdv) return null;

  return (
    <div className={styles.modifyOverlay} onClick={closeModifyModal}>
      <div className={styles.modifyModal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modifyClose} onClick={closeModifyModal}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {/* Actions view */}
        {modifyView === "actions" && (
          <>
            <div className={styles.modifyHeader}>
              <h3 className={styles.modifyTitle}>Modifier votre rendez-vous</h3>
              <p className={styles.modifySubtitle}>
                {modifyingRdv.title} — {formatDate(modifyingRdv.date)} à {formatTime(modifyingRdv.date)}
              </p>
            </div>
            <div className={styles.modifyActions}>
              <button className={styles.modifyActionBtn} onClick={loadRescheduleSlots}>
                <span className={styles.modifyActionIcon} style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                </span>
                <div>
                  <div className={styles.modifyActionName}>Reprogrammer</div>
                  <div className={styles.modifyActionDesc}>Choisir un autre créneau sans annuler</div>
                </div>
              </button>
              <button className={styles.modifyActionBtn} onClick={loadRescheduleSlots}>
                <span className={styles.modifyActionIcon} style={{ background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                </span>
                <div>
                  <div className={styles.modifyActionName}>Voir d&apos;autres créneaux</div>
                  <div className={styles.modifyActionDesc}>Explorer les disponibilités du praticien</div>
                </div>
              </button>
              <button className={`${styles.modifyActionBtn} ${waitlistStatus[modifyingRdv.id] ? styles.modifyActionBtnActive : ""}`} onClick={() => handleWaitlist(modifyingRdv.id)}>
                <span className={styles.modifyActionIcon} style={{ background: waitlistStatus[modifyingRdv.id] ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.1)", color: waitlistStatus[modifyingRdv.id] ? "#10b981" : "#f59e0b" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                </span>
                <div>
                  <div className={styles.modifyActionName}>{waitlistStatus[modifyingRdv.id] ? "Alerte activée ✓" : "Être alerté plus tôt"}</div>
                  <div className={styles.modifyActionDesc}>{waitlistStatus[modifyingRdv.id] ? "Vous serez notifié si un créneau se libère" : "Recevoir une notification si un créneau se libère avant"}</div>
                </div>
              </button>
              <button className={`${styles.modifyActionBtn} ${styles.modifyActionBtnDanger}`} onClick={() => setModifyView("cancel-confirm")}>
                <span className={styles.modifyActionIcon} style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                </span>
                <div>
                  <div className={styles.modifyActionName}>Annuler le rendez-vous</div>
                  <div className={styles.modifyActionDesc}>Annulation gratuite jusqu&apos;à 24h avant</div>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Cancel confirmation */}
        {modifyView === "cancel-confirm" && (
          <>
            <div className={styles.modifyHeader}>
              <div className={styles.modifyCancelIcon}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              </div>
              <h3 className={styles.modifyTitle}>Confirmer l&apos;annulation</h3>
              <p className={styles.modifySubtitle}>
                {modifyingRdv.title} — {formatDate(modifyingRdv.date)} à {formatTime(modifyingRdv.date)}
              </p>
            </div>
            {(() => {
              const eligibility = getCancellationEligibility(modifyingRdv.date);
              return (
                <div style={{
                  margin: "0 0 12px",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: eligibility.outcome === "full_refund"
                    ? "rgba(16,185,129,0.08)"
                    : eligibility.outcome === "pro_policy"
                      ? "rgba(245,158,11,0.08)"
                      : "rgba(239,68,68,0.08)",
                  border: `1px solid ${eligibility.rule.color}22`,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  <div style={{ fontWeight: 600, color: eligibility.rule.color, marginBottom: 4 }}>
                    {eligibility.rule.icon} {eligibility.rule.shortLabel}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                    {eligibility.rule.description}
                  </div>
                </div>
              );
            })()}
            <div className={styles.modifyCancelForm}>
              <label className={styles.modifyCancelLabel}>Raison de l&apos;annulation (facultatif)</label>
              <textarea className={styles.modifyCancelTextarea} placeholder="Précisez la raison si vous le souhaitez…" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} />
            </div>
            <div className={styles.modifyCancelActions}>
              <button className={styles.modifyCancelBack} onClick={() => setModifyView("actions")}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                Retour
              </button>
              <button className={styles.modifyCancelConfirm} onClick={handleCancel} disabled={modifyLoading}>
                {modifyLoading ? <span className={styles.btnSpinner} /> : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>}
                Annuler définitivement
              </button>
            </div>
          </>
        )}

        {/* Reschedule slot picker */}
        {modifyView === "reschedule" && (
          <>
            <div className={styles.modifyHeader}>
              <button className={styles.modifyBackBtn} onClick={() => setModifyView("actions")}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              </button>
              <div>
                <h3 className={styles.modifyTitle}>Choisir un nouveau créneau</h3>
                <p className={styles.modifySubtitle}>{modifyingRdv.pro.prenom} {modifyingRdv.pro.nom}</p>
              </div>
            </div>
            {rescheduleLoading ? (
              <div className={styles.modifySlotLoading}>
                <span className={styles.btnSpinner} style={{ width: 20, height: 20 }} />
                <span>Chargement des créneaux…</span>
              </div>
            ) : rescheduleSlots.length === 0 ? (
              <div className={styles.modifySlotEmpty}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                <p>Aucun créneau disponible pour le moment</p>
                <button className={`${styles.modifyActionBtn} ${waitlistStatus[modifyingRdv.id] ? styles.modifyActionBtnActive : ""}`} onClick={() => handleWaitlist(modifyingRdv.id)} style={{ marginTop: 8 }}>
                  <span className={styles.modifyActionIcon} style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                  </span>
                  <div><div className={styles.modifyActionName}>Être alerté si un créneau se libère</div></div>
                </button>
              </div>
            ) : (
              <div className={styles.modifySlotList}>
                {rescheduleSlots.slice(0, 12).map((slot, i) => (
                  <button key={i} className={styles.modifySlotBtn} onClick={() => handleReschedule(slot)} disabled={modifyLoading}>
                    <div className={styles.modifySlotDate}>{slot.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
                    <div className={styles.modifySlotTime}>{slot.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                    <div className={styles.modifySlotDur}>{slot.duration || 30} min</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
