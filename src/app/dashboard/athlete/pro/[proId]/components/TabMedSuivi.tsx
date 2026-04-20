"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.scss";
import type { MedSubTab } from "./types";

const ORDO_TYPE_LABELS: Record<string, string> = {
  kine: "Rééducation / Kiné", imagerie: "Imagerie", biologie: "Examens biologiques",
  medicament: "Médicaments", arret: "Arrêt de travail", certificat: "Certificat médical",
  orientation: "Orientation spécialiste", dispositif: "Dispositif médical",
};

const ORDO_TYPE_ICONS: Record<string, string> = {
  kine: "M18 20V10 M12 20V4 M6 20v-6",
  imagerie: "M5.5 5.5L12 2l6.5 3.5v4L12 13 5.5 9.5v-4z M12 13v9",
  biologie: "M9 3v2 M15 3v2 M9 5h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M9 12h6 M9 16h4",
  medicament: "M10.5 1.5H8.8a1 1 0 0 0-.9.6L3 15.3a1 1 0 0 0 .9 1.4h5.3L7.5 22.5l10-13.2h-5.8L14 1.5",
  arret: "M12 2v10l4 4 M4.93 4.93l14.14 14.14 M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0",
  certificat: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  orientation: "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
  dispositif: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
};

const ORDO_TYPE_COLORS: Record<string, string> = {
  kine: "#3b82f6", imagerie: "#8b5cf6", biologie: "#f59e0b",
  medicament: "#ef4444", arret: "#6b7280", certificat: "#22c55e",
  orientation: "#0ea5e9", dispositif: "#f97316",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const fmtDateLong = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const fmtDatetime = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ORDO_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  signee: { label: "Signée", color: "#22c55e" },
  transmise: { label: "Transmise", color: "#3b82f6" },
};

const PRESC_TYPE_LABELS: Record<string, string> = {
  activite: "Consignes d'activité", douleur: "Protocole douleur", suivi: "Suivi / Contrôle",
  education: "Éducation thérapeutique", sport: "Prescription sportive", symptomes: "Suivi symptômes",
};

const PRESC_TYPE_ICONS: Record<string, string> = {
  activite: "M18 20V10 M12 20V4 M6 20v-6",
  douleur: "M22 12h-4l-3 9L9 3l-3 9H2",
  suivi: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z M12 9v3 M12 15h.01",
  education: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 1 3-3h7z",
  sport: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  symptomes: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 3h6v4H9V3z M9 14l2 2 4-4",
};

const PRESC_TYPE_COLORS: Record<string, string> = {
  activite: "#3b82f6", douleur: "#ef4444", suivi: "#8b5cf6",
  education: "#f59e0b", sport: "#22c55e", symptomes: "#0ea5e9",
};

const PRESC_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#22c55e" },
  terminee: { label: "Terminée", color: "#94a3b8" },
};

export default function TabMedSuivi({ proId }: { proId: string }) {
  const [medOrdonnances, setMedOrdonnances] = useState<any[]>([]);
  const [medPrescriptions, setMedPrescriptions] = useState<any[]>([]);
  const [medProtocols, setMedProtocols] = useState<any[]>([]);
  const [medSubTab, setMedSubTab] = useState<MedSubTab>("ordonnances");
  const [medPreviewOrdo, setMedPreviewOrdo] = useState<any | null>(null);
  const [medExpandedProto, setMedExpandedProto] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/athlete/med-ordonnances?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.ordonnances) setMedOrdonnances(data.ordonnances); })
      .catch(() => {});
    fetch(`/api/athlete/med-prescriptions?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.prescriptions) setMedPrescriptions(data.prescriptions); })
      .catch(() => {});
    fetch(`/api/athlete/med-protocols?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.protocols) setMedProtocols(data.protocols); })
      .catch(() => {});
  }, [proId]);


  return (
    <section className={styles.tabContent}>
      {/* Sub-tabs */}
      <div className={styles.medSubTabs}>
        {([
          { id: "ordonnances" as MedSubTab, label: "Ordonnances", count: medOrdonnances.length, icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" },
          { id: "prescriptions" as MedSubTab, label: "Prescriptions", count: medPrescriptions.length, icon: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" },
          { id: "protocoles" as MedSubTab, label: "Protocoles", count: medProtocols.length, icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 3h6v4H9V3z M9 14l2 2 4-4" },
        ]).map((t) => (
          <button key={t.id} className={`${styles.medSubTab} ${medSubTab === t.id ? styles.medSubTabActive : ""}`} onClick={() => setMedSubTab(t.id)}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={t.icon} /></svg>
            {t.label}
            {t.count > 0 && <span className={styles.medSubTabCount}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Ordonnances sub-tab ── */}
      {medSubTab === "ordonnances" && (
        <div className={styles.medSection}>
          {medOrdonnances.length === 0 ? (
            <div className={styles.tabEmpty}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              <span>Aucune ordonnance</span>
            </div>
          ) : (
            <div className={styles.medGrid}>
              {medOrdonnances.map((o: any) => {
                const sl = ORDO_STATUS_LABELS[o.status] || { label: o.status, color: "#94a3b8" };
                const typeColor = ORDO_TYPE_COLORS[o.type] || "#94a3b8";
                const typeIcon = ORDO_TYPE_ICONS[o.type] || "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z";
                return (
                  <div key={o.id} className={styles.medCard} onClick={() => setMedPreviewOrdo(o)}>
                    <div className={styles.medCardHeader}>
                      <div className={styles.medCardTypeWrap}>
                        <span className={styles.medCardIcon} style={{ background: `${typeColor}18`, color: typeColor }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={typeIcon} /></svg>
                        </span>
                        <span className={styles.medCardType}>{ORDO_TYPE_LABELS[o.type] || o.type}</span>
                      </div>
                      <span className={styles.medCardBadge} style={{ color: sl.color, background: `${sl.color}14`, borderColor: `${sl.color}40` }}>{sl.label}</span>
                    </div>

                    <div className={styles.medCardDiag}>{o.diagnosis || "—"}</div>
                    {o.episode && <div className={styles.medCardEpisode}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                      {o.episode}
                    </div>}

                    <div className={styles.medCardDates}>
                      <div className={styles.medCardDateRow}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        <span>Créée le {fmtDate(o.createdAt)}</span>
                      </div>
                      {o.validUntil && (
                        <div className={styles.medCardDateRow}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                          <span>Valide jusqu&apos;au {fmtDate(o.validUntil)}</span>
                        </div>
                      )}
                      {o.signedAt && (
                        <div className={styles.medCardDateRow} style={{ color: "#22c55e" }}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                          <span>Signée le {fmtDate(o.signedAt)}</span>
                        </div>
                      )}
                    </div>

                    {o.signatureProof && (
                      <div className={styles.medCardSig}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                        Signature · <code>{o.signatureProof.shortId}</code>
                      </div>
                    )}

                    <div className={styles.medCardFooter}>
                      <span className={styles.medCardVersion}>v{o.version}</span>
                      {o.pdfUrl && (
                        <button
                          className={styles.medCardPdfBtn}
                          onClick={(e) => { e.stopPropagation(); window.open(o.pdfUrl, "_blank"); }}
                          title="Télécharger le PDF"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          PDF
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Prescriptions sub-tab ── */}
      {medSubTab === "prescriptions" && (
        <div className={styles.medSection}>
          {medPrescriptions.length === 0 ? (
            <div className={styles.tabEmpty}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              <span>Aucune prescription</span>
            </div>
          ) : (
            <div className={styles.medGrid}>
              {medPrescriptions.map((p: any) => {
                const typeColor = PRESC_TYPE_COLORS[p.type] || "#94a3b8";
                const typeIcon = PRESC_TYPE_ICONS[p.type] || "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7";
                const st = PRESC_STATUS[p.status] || { label: p.status, color: "#94a3b8" };
                return (
                  <div key={p.id} className={styles.medCard}>
                    <div className={styles.medCardHeader}>
                      <div className={styles.medCardTypeWrap}>
                        <span className={styles.medCardIcon} style={{ background: `${typeColor}18`, color: typeColor }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={typeIcon} /></svg>
                        </span>
                        <span className={styles.medCardType}>{PRESC_TYPE_LABELS[p.type] || p.type}</span>
                      </div>
                      <span className={styles.medCardBadge} style={{ color: st.color, background: `${st.color}14`, borderColor: `${st.color}40` }}>{st.label}</span>
                    </div>

                    <div className={styles.medCardTitle}>{p.title}</div>

                    {p.content.length > 0 && (
                      <ul className={styles.medCardList}>
                        {p.content.slice(0, 3).map((c: string, i: number) => <li key={i}>{c}</li>)}
                        {p.content.length > 3 && <li className={styles.medCardMore}>+{p.content.length - 3} consignes</li>}
                      </ul>
                    )}

                    <div className={styles.medCardDates}>
                      <div className={styles.medCardDateRow}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        <span>Début {fmtDate(p.dateStart)}</span>
                      </div>
                      {p.dateEnd && (
                        <div className={styles.medCardDateRow}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                          <span>Fin {fmtDate(p.dateEnd)}</span>
                        </div>
                      )}
                    </div>

                    {p.redFlags.length > 0 && (
                      <div className={styles.medCardRedFlags}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        <span>{p.redFlags.join(" · ")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Protocoles sub-tab ── */}
      {medSubTab === "protocoles" && (
        <div className={styles.medSection}>
          {medProtocols.length === 0 ? (
            <div className={styles.tabEmpty}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>
              <span>Aucun protocole</span>
            </div>
          ) : (
            <div className={styles.medGrid}>
              {medProtocols.map((p: any) => {
                const stColor = p.status === "active" ? "#22c55e" : "#3b82f6";
                const stLabel = p.status === "active" ? "Actif" : "Terminé";
                return (
                  <div key={p.id} className={styles.medCard}>
                    <div className={styles.medCardHeader}>
                      <div className={styles.medCardTypeWrap}>
                        <span className={styles.medCardIcon} style={{ background: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>
                        </span>
                        <span className={styles.medCardType}>{p.name}</span>
                      </div>
                      <span className={styles.medCardBadge} style={{ color: stColor, background: `${stColor}14`, borderColor: `${stColor}40` }}>{stLabel}</span>
                    </div>

                    {p.description && <div className={styles.medCardDiag}>{p.description}</div>}

                    {p.objectives.length > 0 && (
                      <div className={styles.protoObjSection}>
                        <span className={styles.protoObjLabel}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
                          Objectifs
                        </span>
                        <div className={styles.medCardObj}>
                          {p.objectives.slice(0, 3).map((o: string, i: number) => <span key={i}>{o}</span>)}
                          {p.objectives.length > 3 && <span className={styles.medCardMore}>+{p.objectives.length - 3}</span>}
                        </div>
                      </div>
                    )}

                    {p.phases.length > 0 && (
                      <div className={styles.protoPhaseSection}>
                        <span className={styles.protoPhaseLabel}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                          {p.phases.length} phase{p.phases.length > 1 ? "s" : ""}
                        </span>
                        <div className={styles.medPhaseChips}>
                          {p.phases.map((ph: any, i: number) => (
                            <button key={ph.id || i} className={`${styles.medPhaseChip} ${medExpandedProto === `${p.id}-${i}` ? styles.medPhaseChipActive : ""}`}
                              onClick={() => setMedExpandedProto(medExpandedProto === `${p.id}-${i}` ? null : `${p.id}-${i}`)}>
                              <span className={styles.medPhaseNum}>{i + 1}</span>
                              {ph.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expanded phase detail */}
                    {p.phases.map((ph: any, i: number) => (
                      medExpandedProto === `${p.id}-${i}` && (
                        <div key={`detail-${i}`} className={styles.medPhaseDetail}>
                          <h4 className={styles.medPhaseDetailTitle}>
                            <span className={styles.medPhaseDetailNum}>{i + 1}</span>
                            {ph.name}
                          </h4>

                          {ph.objectives?.length > 0 && (
                            <div className={styles.medPhaseBlock}>
                              <span className={styles.medPhaseBlockLabel}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M16 12l-4-4-4 4 M12 16V8" /></svg>
                                Objectifs
                              </span>
                              <ul>{ph.objectives.map((o: string, j: number) => <li key={j}>{o}</li>)}</ul>
                            </div>
                          )}

                          {ph.toDo?.length > 0 && (
                            <div className={`${styles.medPhaseBlock} ${styles.medPhaseBlockGreen}`}>
                              <span className={styles.medPhaseBlockLabel}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                                À faire
                              </span>
                              <ul>{ph.toDo.map((t: string, j: number) => <li key={j}>{t}</li>)}</ul>
                            </div>
                          )}

                          {ph.toAvoid?.length > 0 && (
                            <div className={`${styles.medPhaseBlock} ${styles.medPhaseBlockRed}`}>
                              <span className={styles.medPhaseBlockLabel}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                                À éviter
                              </span>
                              <ul>{ph.toAvoid.map((t: string, j: number) => <li key={j}>{t}</li>)}</ul>
                            </div>
                          )}

                          {ph.progressionCriteria?.length > 0 && (
                            <div className={`${styles.medPhaseBlock} ${styles.medPhaseBlockBlue}`}>
                              <span className={styles.medPhaseBlockLabel}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#3b82f6" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                                Critères de progression
                              </span>
                              <ul>{ph.progressionCriteria.map((c: string, j: number) => <li key={j}>{c}</li>)}</ul>
                            </div>
                          )}

                          {ph.alertCriteria?.length > 0 && (
                            <div className={`${styles.medPhaseBlock} ${styles.medPhaseBlockAmber}`}>
                              <span className={styles.medPhaseBlockLabel}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                Critères d&apos;alerte
                              </span>
                              <ul>{ph.alertCriteria.map((c: string, j: number) => <li key={j}>{c}</li>)}</ul>
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Ordonnance preview modal ── */}
      {medPreviewOrdo && <OrdoPreviewModal ordo={medPreviewOrdo} onClose={() => setMedPreviewOrdo(null)} />}
    </section>
  );
}

/* ── Ordonnance preview modal (read-only) ── */
function OrdoPreviewModal({ ordo: o, onClose }: { ordo: any; onClose: () => void }) {
  const c = o.content || {};
  return (
    <div className={styles.medOverlay} onClick={onClose}>
      <div className={styles.medModal} onClick={(e: any) => e.stopPropagation()}>
        <div className={styles.medModalHeader}>
          <h3>{ORDO_TYPE_LABELS[o.type] || o.type}</h3>
          <button className={styles.medModalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.medModalBody}>
          <div className={styles.medModalInfoGrid}>
            <div className={styles.medModalInfoItem}>
              <span className={styles.medModalInfoLabel}>Diagnostic</span>
              <span className={styles.medModalInfoValue}>{o.diagnosis || "—"}</span>
            </div>
            {o.episode && (
              <div className={styles.medModalInfoItem}>
                <span className={styles.medModalInfoLabel}>Épisode</span>
                <span className={styles.medModalInfoValue}>{o.episode}</span>
              </div>
            )}
            <div className={styles.medModalInfoItem}>
              <span className={styles.medModalInfoLabel}>Date de création</span>
              <span className={styles.medModalInfoValue}>{fmtDateLong(o.createdAt)}</span>
            </div>
            {o.signedAt && (
              <div className={styles.medModalInfoItem}>
                <span className={styles.medModalInfoLabel}>Signée le</span>
                <span className={styles.medModalInfoValue} style={{ color: "#22c55e" }}>{fmtDatetime(o.signedAt)}</span>
              </div>
            )}
            {o.validUntil && (
              <div className={styles.medModalInfoItem}>
                <span className={styles.medModalInfoLabel}>Valide jusqu&apos;au</span>
                <span className={styles.medModalInfoValue}>{fmtDateLong(o.validUntil)}</span>
              </div>
            )}
            <div className={styles.medModalInfoItem}>
              <span className={styles.medModalInfoLabel}>Version</span>
              <span className={styles.medModalInfoValue}>v{o.version}</span>
            </div>
          </div>

          <div className={styles.medModalContent}>
            {o.type === "kine" && (
              <>
                {c.seances && <p><strong>Séances :</strong> {c.seances} — {c.frequence}</p>}
                {c.objectifs && <p><strong>Objectifs :</strong> {c.objectifs}</p>}
                {c.consignes && <p><strong>Consignes :</strong> {c.consignes}</p>}
                {c.techniques && <p><strong>Techniques :</strong> {c.techniques}</p>}
                {c.bilanCR && <p><em>Bilan initial + compte rendu demandé</em></p>}
              </>
            )}
            {o.type === "imagerie" && (
              <>
                <p><strong>Examen :</strong> {c.examType} — Zone : {c.zone}</p>
                {c.indication && <p><strong>Indication :</strong> {c.indication}</p>}
                <p><strong>Urgence :</strong> {c.urgence || "standard"} · <strong>Injection :</strong> {c.injection || "non"}</p>
              </>
            )}
            {o.type === "biologie" && (
              <>
                <p><strong>Examens :</strong> {(c.examens || []).join(", ")}{c.autreExamens ? `, ${c.autreExamens}` : ""}</p>
                {c.indication && <p><strong>Indication :</strong> {c.indication}</p>}
                {c.aJeun && <p style={{ color: "#ef4444" }}><em>Patient à jeun</em></p>}
              </>
            )}
            {o.type === "medicament" && (c.lignes || []).map((l: any, i: number) => (
              <div key={i} className={styles.medModalMedLine}>
                <p><strong>{l.dci}</strong> {l.dosage} — {l.forme}</p>
                <p>{l.posologie} — {l.duree} — Qté: {l.qte}{l.renouvelable ? " (renouvelable)" : ""}</p>
              </div>
            ))}
            {o.type === "arret" && (
              <>
                <p><strong>Période :</strong> {c.dateDebut} → {c.dateFin}</p>
                {c.tempsPartiel && <p><em>Temps partiel thérapeutique</em></p>}
                {c.prolongation && <p><em>Prolongation</em></p>}
                {c.motif && <p><strong>Motif :</strong> {c.motif}</p>}
              </>
            )}
            {o.type === "certificat" && (
              <>
                <p><strong>Type :</strong> {c.certType} — Sport : {c.sport}</p>
                {c.restrictions && <p><strong>Restrictions :</strong> {c.restrictions}</p>}
                {c.duree && <p><strong>Durée :</strong> {c.duree}</p>}
              </>
            )}
            {o.type === "orientation" && (
              <>
                <p><strong>Spécialité :</strong> {c.specialite} — Urgence : {c.urgence}</p>
                {c.motif && <p><strong>Motif :</strong> {c.motif}</p>}
              </>
            )}
            {o.type === "dispositif" && (
              <>
                <p><strong>Dispositif :</strong> {c.dispType} — Côté : {c.cote}</p>
                {c.specs && <p><strong>Spécifications :</strong> {c.specs}</p>}
                {c.duree && <p><strong>Durée :</strong> {c.duree}</p>}
              </>
            )}
          </div>

          {o.signatureProof && (
            <div className={styles.medModalSig}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
              <span>Signé électroniquement</span>
              <code>{o.signatureProof.shortId}</code>
            </div>
          )}
        </div>
        <div className={styles.medModalFooter}>
          {o.pdfUrl && (
            <button
              className={styles.medModalPdfBtn}
              onClick={() => window.open(o.pdfUrl, "_blank")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Télécharger le PDF
            </button>
          )}
          <button className={styles.medModalBtn} onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
