"use client";

import React from "react";
import styles from "../page.module.scss";
import type { BookingWarning, AthleteProfile } from "../types";
import { getSpecColor, MotifSvgIcon } from "../constants";
import { useBookingFlow } from "../hooks/useBookingFlow";
import { PRESTATION_TYPES, REMBOURSEMENT_LABELS, type PrestationType, type RemboursementLabel } from "@/lib/prestations";
import { getRemboursementMessage } from "@/lib/remboursement";
import { CANCELLATION_POLICY_SUMMARY } from "@/lib/cancellation";

type Flow = ReturnType<typeof useBookingFlow>;

interface Props {
  flow: Flow;
  bookingWarnings: BookingWarning[];
  athleteProfile: AthleteProfile | null;
}

export function StepSummary({ flow, bookingWarnings, athleteProfile }: Props) {
  const {
    step, selectedPro, selectedMotif, selectedSlot, selectedFormat,
    bookingLoading, bookingConfirmed, confirmedEventId,
    calendarPickerOpen, setCalendarPickerOpen,
    formComplaint, setFormComplaint, formComment, setFormComment,
    formAltAvailability, setFormAltAvailability, formDocs, setFormDocs,
    formConsent, setFormConsent, formConsentData, setFormConsentData, formConsentCgv, setFormConsentCgv,
    formAttachAntecedents, setFormAttachAntecedents,
    confirmBooking, setStep, setBooking, setBookingConfirmed,
    generateICS, getGoogleCalendarUrl, getOutlookCalendarUrl,
  } = flow;

  // Summary view
  if (step === "summary" && !bookingConfirmed && selectedPro && selectedMotif && selectedFormat) {
    return (
      <div className={styles.stepContent}>
        <h2 className={styles.stepTitle}>Votre rendez-vous</h2>
        <p className={styles.stepSubtitle}>Vérifiez les détails avant de confirmer</p>

        {/* Warnings */}
        {bookingWarnings.length > 0 && (
          <div className={styles.warningsContainer}>
            {bookingWarnings.map((w) => (
              <div key={w.id} className={`${styles.warningCard} ${styles[`warningCard--${w.level}`]}`}>
                <div className={styles.warningIcon}>
                  {w.level === "error" ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                  ) : w.level === "warning" ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                  )}
                </div>
                <div className={styles.warningContent}>
                  <div className={styles.warningMessage}>{w.message}</div>
                  {w.detail && <div className={styles.warningDetail}>{w.detail}</div>}
                  {w.action && (
                    <button className={styles.warningAction} onClick={w.action.onClick}>
                      {w.action.label}
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pro header */}
        <div className={styles.ficheProHeader}>
          <div className={styles.ficheProAvatar}>
            {selectedPro.avatarUrl ? <img src={selectedPro.avatarUrl} alt="" /> : <span>{`${selectedPro.prenom[0]}${selectedPro.nom[0]}`.toUpperCase()}</span>}
          </div>
          <div className={styles.ficheProInfo}>
            <div className={styles.ficheProName}>{selectedPro.prenom} {selectedPro.nom}</div>
            <div className={styles.ficheProSpec} style={{ color: getSpecColor(selectedPro.specialite) }}>{selectedPro.specialite}</div>
          </div>
          <div className={styles.ficheFormatBadge} style={{ background: selectedFormat === "presentiel" ? "rgba(59,130,246,0.1)" : "rgba(16,185,129,0.1)", color: selectedFormat === "presentiel" ? "#3b82f6" : "#10b981" }}>
            {selectedFormat === "presentiel" ? (
              <><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>Cabinet</>
            ) : (
              <><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>Visio</>
            )}
          </div>
        </div>

        {/* Date/time hero */}
        {selectedSlot && (
          <div className={styles.ficheDateTime}>
            <div className={styles.ficheDateIcon}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <div className={styles.ficheDateInfo}>
              <span className={styles.ficheDateDay}>{selectedSlot.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              <span className={styles.ficheDateTime}>
                {selectedSlot.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                {" — "}
                {(() => { const end = new Date(selectedSlot.date); end.setMinutes(end.getMinutes() + (selectedSlot.duration || 30)); return end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); })()}
                <span className={styles.ficheDuration}>({selectedSlot.duration || 30} min)</span>
              </span>
            </div>
          </div>
        )}

        {/* Details grid */}
        <div className={styles.ficheDetails}>
          <div className={styles.ficheDetailRow}>
            <div className={styles.ficheDetailIcon}><MotifSvgIcon name={selectedMotif.icon} size={16} /></div>
            <div className={styles.ficheDetailContent}>
              <span className={styles.ficheDetailLabel}>Motif</span>
              <span className={styles.ficheDetailValue}>{selectedMotif.label}</span>
            </div>
          </div>
          {selectedMotif.duration && (
            <div className={styles.ficheDetailRow}>
              <div className={styles.ficheDetailIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></div>
              <div className={styles.ficheDetailContent}>
                <span className={styles.ficheDetailLabel}>Durée estimée</span>
                <span className={styles.ficheDetailValue}>{selectedMotif.duration}</span>
              </div>
            </div>
          )}
          {selectedFormat === "presentiel" && selectedPro.adresseCabinet ? (
            <div className={styles.ficheDetailRow}>
              <div className={styles.ficheDetailIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg></div>
              <div className={styles.ficheDetailContent}>
                <span className={styles.ficheDetailLabel}>Lieu</span>
                <span className={styles.ficheDetailValue}>{selectedPro.adresseCabinet}</span>
              </div>
            </div>
          ) : selectedFormat === "teleconsultation" ? (
            <div className={styles.ficheDetailRow}>
              <div className={styles.ficheDetailIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94M22 16.92v3a2 2 0 0 1-2.18 2A19.86 19.86 0 0 1 3.05 5.18 2 2 0 0 1 5 3h3" /></svg></div>
              <div className={styles.ficheDetailContent}>
                <span className={styles.ficheDetailLabel}>Téléconsultation</span>
                <span className={styles.ficheDetailValue}>Le lien vous sera envoyé avant le rendez-vous</span>
              </div>
            </div>
          ) : null}
          {(() => {
            const tarifs = selectedPro?.tarifs ?? [];
            // Find tarifs matching the selected format (or format-agnostic ones)
            const matching = tarifs.filter((t) =>
              !t.format || t.format === selectedFormat
            );
            if (matching.length === 0) {
              const rm = getRemboursementMessage(selectedPro!.specialite);
              return (
                <>
                  <div className={styles.ficheDetailRow}>
                    <div className={styles.ficheDetailIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
                    <div className={styles.ficheDetailContent}>
                      <span className={styles.ficheDetailLabel}>Tarif</span>
                      <span className={styles.ficheDetailValue} style={{ color: "rgba(255,255,255,0.35)" }}>Non renseigné par le professionnel</span>
                    </div>
                  </div>
                  <div className={styles.ficheDetailRow}>
                    <div className={styles.ficheDetailIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
                    <div className={styles.ficheDetailContent}>
                      <span className={styles.ficheDetailLabel}>Remboursement</span>
                      <span className={styles.ficheDetailValue} style={{ color: rm.color }}>
                        {rm.icon} {rm.label}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginTop: 2 }}>
                        {rm.disclaimer}
                      </span>
                    </div>
                  </div>
                </>
              );
            }
            // Show the cheapest matching tarif as primary, or show a range
            const sorted = [...matching].sort((a, b) => a.price - b.price);
            const min = sorted[0].price;
            const max = sorted[sorted.length - 1].price;
            const priceLabel = min === max
              ? `${(min / 100).toFixed(2)} €`
              : `${(min / 100).toFixed(2)} € – ${(max / 100).toFixed(2)} €`;
            return (
              <>
                <div className={styles.ficheDetailRow}>
                  <div className={styles.ficheDetailIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
                  <div className={styles.ficheDetailContent}>
                    <span className={styles.ficheDetailLabel}>Tarif</span>
                    <span className={styles.ficheDetailValue} style={{ color: "#10b981", fontWeight: 600 }}>{priceLabel}</span>
                  </div>
                </div>
                {sorted.length > 1 && (
                  <div style={{ paddingLeft: 32, marginTop: -4, marginBottom: 4 }}>
                    {sorted.map((t) => (
                      <div key={t.id} style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "flex", gap: 6, marginBottom: 2 }}>
                        <span>{t.label}</span>
                        <span style={{ color: "rgba(255,255,255,0.55)" }}>{(t.price / 100).toFixed(2)} € · {t.duration} min</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Type de prestation */}
                {sorted[0]?.prestationType && PRESTATION_TYPES[sorted[0].prestationType as PrestationType] && (
                  <div className={styles.ficheDetailRow}>
                    <div className={styles.ficheDetailIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg></div>
                    <div className={styles.ficheDetailContent}>
                      <span className={styles.ficheDetailLabel}>Type de prestation</span>
                      <span className={styles.ficheDetailValue}>{PRESTATION_TYPES[sorted[0].prestationType as PrestationType].label}</span>
                    </div>
                  </div>
                )}
                {/* Mention remboursement — tarif-level or specialité-level fallback */}
                {sorted[0]?.remboursementLabel && REMBOURSEMENT_LABELS[sorted[0].remboursementLabel as RemboursementLabel] ? (
                  <div className={styles.ficheDetailRow}>
                    <div className={styles.ficheDetailIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
                    <div className={styles.ficheDetailContent}>
                      <span className={styles.ficheDetailLabel}>Remboursement</span>
                      <span className={styles.ficheDetailValue} style={{ color: REMBOURSEMENT_LABELS[sorted[0].remboursementLabel as RemboursementLabel].color }}>
                        {REMBOURSEMENT_LABELS[sorted[0].remboursementLabel as RemboursementLabel].label}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginTop: 2 }}>
                        {REMBOURSEMENT_LABELS[sorted[0].remboursementLabel as RemboursementLabel].description}
                      </span>
                    </div>
                  </div>
                ) : (() => {
                  const rm = getRemboursementMessage(selectedPro!.specialite);
                  return (
                    <div className={styles.ficheDetailRow}>
                      <div className={styles.ficheDetailIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
                      <div className={styles.ficheDetailContent}>
                        <span className={styles.ficheDetailLabel}>Remboursement</span>
                        <span className={styles.ficheDetailValue} style={{ color: rm.color }}>
                          {rm.icon} {rm.label}
                        </span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginTop: 2 }}>
                          {rm.disclaimer}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </div>

        {/* Documents à prévoir */}
        <div className={styles.ficheSection}>
          <div className={styles.ficheSectionTitle}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            Pièces à prévoir
          </div>
          <ul className={styles.ficheChecklist}>
            <li><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Carte Vitale ou attestation</li>
            <li><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Ordonnance ou lettre du médecin (si disponible)</li>
            <li><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Examens récents (radio, IRM, bilans…)</li>
          </ul>
        </div>

        {/* Conditions */}
        <div className={styles.ficheSection}>
          <div className={styles.ficheSectionTitle}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            Conditions
          </div>
          <div className={styles.ficheConditions}>
            {CANCELLATION_POLICY_SUMMARY.lines.map((line, i) => (
              <div key={i} className={styles.ficheConditionItem}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{line.icon}</span>
                <span>{line.bold ? <strong>{line.text}</strong> : line.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className={styles.ficheTips}>
          <div className={styles.ficheTip}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span>Ce rendez-vous dure environ {selectedMotif.duration || "30 min"}</span>
          </div>
          {selectedFormat === "presentiel" && (
            <div className={styles.ficheTip}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              <span>Pensez à venir avec vos examens si vous en avez</span>
            </div>
          )}
          {selectedFormat === "teleconsultation" && (
            <div className={styles.ficheTip}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
              <span>Téléconsultation possible depuis votre téléphone</span>
            </div>
          )}
          <div className={styles.ficheTip}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            <span>Vous pourrez ajouter une note avant la consultation</span>
          </div>
        </div>

        {/* Pre-filled identity */}
        {athleteProfile && (
          <div className={styles.ficheSection}>
            <div className={styles.ficheSectionTitle}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              Vos informations
            </div>
            <div className={styles.ficheIdentityGrid}>
              <div className={styles.ficheIdentityItem}>
                <span className={styles.ficheIdentityLabel}>Nom</span>
                <span className={styles.ficheIdentityValue}>{athleteProfile.prenom} {athleteProfile.nom}</span>
              </div>
              <div className={styles.ficheIdentityItem}>
                <span className={styles.ficheIdentityLabel}>Email</span>
                <span className={styles.ficheIdentityValue}>{athleteProfile.email}</span>
              </div>
              <div className={styles.ficheIdentityItem}>
                <span className={styles.ficheIdentityLabel}>Téléphone</span>
                <span className={styles.ficheIdentityValue}>{athleteProfile.telephone}</span>
              </div>
              {athleteProfile.sport && (
                <div className={styles.ficheIdentityItem}>
                  <span className={styles.ficheIdentityLabel}>Sport</span>
                  <span className={styles.ficheIdentityValue}>{athleteProfile.sport}</span>
                </div>
              )}
            </div>
            <div className={styles.ficheIdentityCheck}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Pré-rempli depuis votre profil
            </div>
          </div>
        )}

        {/* Complaint */}
        <div className={styles.ficheFormGroup}>
          <label className={styles.ficheFormLabel}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            Douleur / problème principal
          </label>
          <input type="text" className={styles.ficheFormInput} placeholder="Ex : douleur au genou droit depuis 2 semaines" value={formComplaint} onChange={(e) => setFormComplaint(e.target.value)} />
        </div>

        {/* Antécédents */}
        {athleteProfile && athleteProfile.antecedents.length > 0 && (
          <div className={styles.ficheFormGroup}>
            <label className={styles.ficheFormLabel}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              Antécédents médicaux
            </label>
            <button className={`${styles.ficheAttachBtn} ${formAttachAntecedents ? styles.ficheAttachBtnActive : ""}`} onClick={() => setFormAttachAntecedents(!formAttachAntecedents)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {formAttachAntecedents ? <><polyline points="20 6 9 17 4 12" /></> : <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>}
              </svg>
              {formAttachAntecedents ? "Antécédents joints" : "Joindre mes antécédents"}
              <span className={styles.ficheAttachCount}>{athleteProfile.antecedents.length}</span>
            </button>
            {formAttachAntecedents && (
              <div className={styles.ficheAntecedentsList}>
                {athleteProfile.antecedents.map((a, i) => (
                  <span key={i} className={styles.ficheAntecedentTag}>{a}</span>
                ))}
                {athleteProfile.traitements && <span className={styles.ficheAntecedentTag}>Traitements : {athleteProfile.traitements}</span>}
              </div>
            )}
          </div>
        )}

        {/* Documents */}
        <div className={styles.ficheFormGroup}>
          <label className={styles.ficheFormLabel}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
            Documents à transmettre
          </label>
          <div className={styles.ficheDocOptions}>
            {["Ordonnance", "Radio / IRM", "Bilan sanguin", "Autre document"].map((doc) => (
              <button key={doc} className={`${styles.ficheDocChip} ${formDocs.has(doc) ? styles.ficheDocChipActive : ""}`} onClick={() => setFormDocs((prev) => { const next = new Set(prev); if (next.has(doc)) next.delete(doc); else next.add(doc); return next; })}>
                {formDocs.has(doc) ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                {doc}
              </button>
            ))}
          </div>
          {formDocs.size > 0 && <p className={styles.ficheDocHint}>Vous pourrez les envoyer après confirmation</p>}
        </div>

        {/* Comment */}
        <div className={styles.ficheFormGroup}>
          <label className={styles.ficheFormLabel}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Commentaire <span className={styles.ficheOptional}>(optionnel)</span>
          </label>
          <textarea className={styles.ficheFormTextarea} placeholder="Informations complémentaires pour le professionnel…" rows={2} value={formComment} onChange={(e) => setFormComment(e.target.value)} />
        </div>

        {/* Alternative availability */}
        <div className={styles.ficheFormGroup}>
          <label className={styles.ficheFormLabel}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
            Disponibilité alternative <span className={styles.ficheOptional}>(optionnel)</span>
          </label>
          <input type="text" className={styles.ficheFormInput} placeholder="Ex : plutôt le matin en semaine, ou après 17h" value={formAltAvailability} onChange={(e) => setFormAltAvailability(e.target.value)} />
        </div>

        {/* Consents */}
        <div className={styles.ficheConsents}>
          <label className={styles.ficheConsentRow}>
            <input type="checkbox" checked={formConsentCgv} onChange={(e) => setFormConsentCgv(e.target.checked)} className={styles.ficheCheckbox} />
            <span>J&apos;ai lu et j&apos;accepte les <a href="/cgu" target="_blank" rel="noopener noreferrer" style={{ color: "#f47b20", textDecoration: "underline" }}>Conditions Générales de Vente</a> et la <a href="/cgu#annulation" target="_blank" rel="noopener noreferrer" style={{ color: "#f47b20", textDecoration: "underline" }}>politique d&apos;annulation</a></span>
          </label>
          <label className={styles.ficheConsentRow}>
            <input type="checkbox" checked={formConsent} onChange={(e) => setFormConsent(e.target.checked)} className={styles.ficheCheckbox} />
            <span>Je confirme avoir vérifié le détail et le prix total de cette prestation, et j&apos;accepte l&apos;obligation de paiement associée</span>
          </label>
          <label className={styles.ficheConsentRow}>
            <input type="checkbox" checked={formConsentData} onChange={(e) => setFormConsentData(e.target.checked)} className={styles.ficheCheckbox} />
            <span>J&apos;autorise le partage de mes informations médicales avec ce professionnel</span>
          </label>
        </div>

        {/* Actions */}
        <div className={styles.summaryActions}>
          <button className={styles.summaryConfirmBtn} disabled={!formConsent || !formConsentData || !formConsentCgv || bookingLoading} onClick={confirmBooking}>
            {bookingLoading ? <><span className={styles.btnSpinner} /> Réservation en cours…</> : <><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Confirmer et réserver avec obligation de paiement</>}
          </button>
          <button className={styles.summaryEditBtn} onClick={() => setStep("choose-slot")} disabled={bookingLoading}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            Changer de créneau
          </button>
          <button className={styles.summaryEditBtn} onClick={() => setStep("choose-need")} disabled={bookingLoading}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Tout modifier
          </button>
        </div>
      </div>
    );
  }

  // Confirmation screen
  if (bookingConfirmed && selectedPro && selectedSlot && selectedMotif && selectedFormat) {
    return (
      <div className={styles.stepContent}>
        <div className={styles.confirmSuccess}>
          <div className={styles.confirmCheckCircle}>
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 className={styles.confirmTitle}>Rendez-vous confirmé</h2>
          <p className={styles.confirmSubtitle}>Un email de confirmation vous a été envoyé</p>
        </div>

        <div className={styles.confirmCard}>
          <div className={styles.confirmCardRow}>
            <div className={styles.confirmCardIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></div>
            <div>
              <div className={styles.confirmCardLabel}>Professionnel</div>
              <div className={styles.confirmCardValue}>{selectedPro.prenom} {selectedPro.nom}</div>
              <div className={styles.confirmCardSub} style={{ color: getSpecColor(selectedPro.specialite) }}>{selectedPro.specialite}</div>
            </div>
          </div>
          <div className={styles.confirmCardRow}>
            <div className={styles.confirmCardIcon}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg></div>
            <div>
              <div className={styles.confirmCardLabel}>Date & heure</div>
              <div className={styles.confirmCardValue}>{selectedSlot.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
              <div className={styles.confirmCardSub}>
                {selectedSlot.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                {" — "}
                {(() => { const end = new Date(selectedSlot.date); end.setMinutes(end.getMinutes() + (selectedSlot.duration || 30)); return end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); })()}
                {` (${selectedSlot.duration || 30} min)`}
              </div>
            </div>
          </div>
          <div className={styles.confirmCardRow}>
            <div className={styles.confirmCardIcon}>
              {selectedFormat === "presentiel" ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>}
            </div>
            <div>
              <div className={styles.confirmCardLabel}>{selectedFormat === "presentiel" ? "Lieu" : "Format"}</div>
              <div className={styles.confirmCardValue}>{selectedFormat === "presentiel" ? (selectedPro.adresseCabinet || "En cabinet") : "Téléconsultation"}</div>
            </div>
          </div>
          <div className={styles.confirmCardRow}>
            <div className={styles.confirmCardIcon}><MotifSvgIcon name={selectedMotif.icon} size={16} /></div>
            <div>
              <div className={styles.confirmCardLabel}>Motif</div>
              <div className={styles.confirmCardValue}>{selectedMotif.label}</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className={styles.confirmActions}>
          <div className={styles.calPickerWrap}>
            <button className={styles.confirmActionBtn} onClick={() => setCalendarPickerOpen(!calendarPickerOpen)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Ajouter à mon calendrier
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", transform: calendarPickerOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {calendarPickerOpen && (
              <div className={styles.calPickerDropdown}>
                <a className={styles.calPickerOption} href={getGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer" onClick={() => setCalendarPickerOpen(false)}>
                  <span className={styles.calPickerIcon} style={{ background: "rgba(66,133,244,0.1)" }}><img src="/Logo GoogleCalendar.png" alt="Google Calendar" width={20} height={20} style={{ borderRadius: 4 }} /></span>
                  <div><div className={styles.calPickerName}>Google Calendar</div><div className={styles.calPickerDesc}>Ouvrir dans votre navigateur</div></div>
                </a>
                <button className={styles.calPickerOption} onClick={generateICS}>
                  <span className={styles.calPickerIcon} style={{ background: "rgba(255,255,255,0.06)" }}><img src="/LogoCalendrierApple.png" alt="Apple Calendar" width={20} height={20} style={{ borderRadius: 4 }} /></span>
                  <div><div className={styles.calPickerName}>Apple Calendar</div><div className={styles.calPickerDesc}>Télécharger le fichier .ics</div></div>
                </button>
                <a className={styles.calPickerOption} href={getOutlookCalendarUrl()} target="_blank" rel="noopener noreferrer" onClick={() => setCalendarPickerOpen(false)}>
                  <span className={styles.calPickerIcon} style={{ background: "rgba(0,120,212,0.1)" }}><img src="/LogoOutlook.png" alt="Outlook" width={20} height={20} style={{ borderRadius: 4 }} /></span>
                  <div><div className={styles.calPickerName}>Outlook</div><div className={styles.calPickerDesc}>Ouvrir dans Outlook Web</div></div>
                </a>
                <button className={styles.calPickerOption} onClick={generateICS}>
                  <span className={styles.calPickerIcon} style={{ background: "rgba(255,255,255,0.04)" }}><img src="/LogoCalendrier.png" alt="Calendrier" width={20} height={20} style={{ borderRadius: 4 }} /></span>
                  <div><div className={styles.calPickerName}>Autre calendrier</div><div className={styles.calPickerDesc}>Fichier .ics universel</div></div>
                </button>
              </div>
            )}
          </div>

          {selectedFormat === "presentiel" && selectedPro.adresseCabinet && (
            <a className={styles.confirmActionBtn} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPro.adresseCabinet)}`} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
              Voir l&apos;itinéraire
            </a>
          )}

          <button className={styles.confirmActionBtn} onClick={() => { setBookingConfirmed(false); setStep("summary"); }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            Préparer mes documents
          </button>

          <button className={`${styles.confirmActionBtn} ${styles.confirmActionBtnDanger}`} onClick={() => { setBookingConfirmed(false); setBooking(false); }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            Modifier / annuler
          </button>
        </div>

        <button className={styles.confirmDoneBtn} onClick={() => { setBookingConfirmed(false); setBooking(false); }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          Retour à mes rendez-vous
        </button>
      </div>
    );
  }

  return null;
}
