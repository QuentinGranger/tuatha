"use client";

import React from "react";
import styles from "../page.module.scss";
import type { MyConnection, LearnedPreferences, ProInfo, PeriodFilter, TimeSlot } from "../types";
import type { FetchStatus } from "../hooks/useBookingData";
import { ALL_MOTIFS, getMotifsForSpec, getSpecColor, getMatchScore, getMatchLabel, specMatchesNeed, MotifSvgIcon } from "../constants";
import { useBookingFlow } from "../hooks/useBookingFlow";

type Flow = ReturnType<typeof useBookingFlow>;

interface Props {
  flow: Flow;
  connections: MyConnection[];
  connsStatus: FetchStatus;
  fetchConnections: () => void;
  learnedPrefs: LearnedPreferences | null;
  router: { push: (url: string) => void };
}

export function BookingProgress({ step }: { step: Flow["step"] }) {
  const steps: { key: string; label: string; num: number }[] = [
    { key: "choose-need", label: "Besoin", num: 1 },
    { key: "choose-pro", label: "Pro", num: 2 },
    { key: "choose-motif", label: "Motif", num: 3 },
    { key: "choose-filters", label: "Préf.", num: 4 },
    { key: "choose-slot", label: "Créneau", num: 5 },
  ];
  const stepOrder = ["choose-need", "choose-pro", "choose-motif", "choose-filters", "choose-slot", "summary"];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div className={styles.bookingProgress}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <div className={styles.progressLine} />}
          <div className={`${styles.progressStep} ${step === s.key ? styles.progressStepActive : currentIdx > i ? styles.progressStepDone : ""}`}>
            <span className={styles.progressDot}>{s.num}</span>
            <span className={styles.progressLabel}>{s.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export function BookingFlow({ flow, connections, connsStatus, fetchConnections, learnedPrefs, router }: Props) {
  const {
    step, selectedNeed, selectedPro, selectedMotif, selectedFormat, setSelectedFormat,
    proFilter, setProFilter, filterPeriod, setFilterPeriod, filterTimeSlots,
    toggleTimeSlot, filterFirstAvailable, setFilterFirstAvailable,
    showMoreFilters, setShowMoreFilters, filterDuration, setFilterDuration,
    activeFilterCount, confirmFilters, handleNeedSelect, handleProSelect, handleMotifSelect,
    proAvailability,
  } = flow;

  return (
    <>
      {/* Step 1: Choose need */}
      {step === "choose-need" && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Que souhaitez-vous faire ?</h2>
          <p className={styles.stepSubtitle}>Choisissez ce qui correspond le mieux à votre besoin</p>
          <div className={styles.needGrid}>
            {ALL_MOTIFS.map((need) => (
              <button
                key={need.id}
                className={`${styles.needCard} ${selectedNeed === need.id ? styles.needCardSelected : ""}`}
                onClick={() => handleNeedSelect(need.id)}
              >
                <MotifSvgIcon name={need.icon} size={24} />
                <span className={styles.needLabel}>{need.label}</span>
                <div className={styles.needSpecs}>
                  {need.specs.map((s) => (
                    <span key={s} className={styles.needSpecDot} style={{ background: getSpecColor(s) }} title={s} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Choose pro */}
      {step === "choose-pro" && (() => {
        const enriched = connections.map((c) => {
          const pro = c.professionnel;
          let score = selectedNeed ? getMatchScore(selectedNeed, pro.specialite) : 50;
          const isMatch = selectedNeed ? specMatchesNeed(pro.specialite, selectedNeed) : true;
          const topPro = learnedPrefs?.topPros.find((tp) => tp.id === pro.id);
          if (topPro) score += Math.min(topPro.pct, 30);
          const matchLabel = selectedNeed ? getMatchLabel(score) : "";
          const prefLabel = topPro ? `Consulté ${topPro.count}× (${topPro.pct}%)` : "";
          return { ...c, score, isMatch, matchLabel, prefLabel, isTopPro: !!topPro };
        });

        let sorted = [...enriched];
        if (proFilter === "recommended") {
          sorted.sort((a, b) => b.score - a.score);
        } else if (proFilter === "habitual") {
          sorted.sort((a, b) => {
            const aTop = learnedPrefs?.topPros.find((tp) => tp.id === a.professionnel.id);
            const bTop = learnedPrefs?.topPros.find((tp) => tp.id === b.professionnel.id);
            return (bTop?.count || 0) - (aTop?.count || 0);
          });
        } else if (proFilter === "first-available") {
          sorted.sort((a, b) => b.score - a.score || a.professionnel.nom.localeCompare(b.professionnel.nom));
        }

        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Avec quel professionnel ?</h2>
            <p className={styles.stepSubtitle}>
              {selectedNeed
                ? <>Professionnels pour : <strong>{ALL_MOTIFS.find((m) => m.id === selectedNeed)?.label}</strong></>
                : "Sélectionnez un professionnel connecté"}
            </p>

            {/* Sequential pattern suggestion */}
            {learnedPrefs?.sequentialPatterns && learnedPrefs.sequentialPatterns.length > 0 && (() => {
              const matchingPatterns = learnedPrefs.sequentialPatterns.filter((sp) =>
                connections.some((c) => c.professionnel.specialite.toLowerCase().includes(sp.to.toLowerCase()))
              );
              if (matchingPatterns.length === 0) return null;
              const sp = matchingPatterns[0];
              const matchingPro = connections.find((c) => c.professionnel.specialite.toLowerCase().includes(sp.to.toLowerCase()));
              if (!matchingPro) return null;
              return (
                <div className={styles.seqSuggestionBanner}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  <span>
                    Après votre <strong>{sp.from}</strong>, vous consultez souvent un <strong>{sp.to}</strong>
                    <span className={styles.seqPatternMeta}> ({sp.count}× · ~{sp.avgDelayDays}j après)</span>
                  </span>
                  <button className={styles.seqSuggestionBtn} onClick={() => handleProSelect(matchingPro.professionnel)}>
                    Choisir {matchingPro.professionnel.prenom} {matchingPro.professionnel.nom}
                  </button>
                </div>
              );
            })()}

            {/* Filter tabs */}
            <div className={styles.proFilterTabs}>
              <button className={`${styles.proFilterTab} ${proFilter === "recommended" ? styles.proFilterTabActive : ""}`} onClick={() => setProFilter("recommended")}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                Meilleur match
              </button>
              <button className={`${styles.proFilterTab} ${proFilter === "habitual" ? styles.proFilterTabActive : ""}`} onClick={() => setProFilter("habitual")}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                Mon pro habituel
              </button>
              <button className={`${styles.proFilterTab} ${proFilter === "first-available" ? styles.proFilterTabActive : ""}`} onClick={() => setProFilter("first-available")}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Premier disponible
              </button>
            </div>

            {connsStatus === "loading" ? (
              <div className={styles.skeletonProGrid}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className={styles.skeletonProCard}>
                    <div className={styles.skeletonRow}>
                      <div className={styles.skeletonCircle} style={{ width: 44, height: 44 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div className={`${styles.skeletonLine} ${styles['skeletonLine--medium']}`} />
                        <div className={`${styles.skeletonLine} ${styles['skeletonLine--short']}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : connsStatus === "error" ? (
              <div className={styles.errorBlock}>
                <div className={styles.errorIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <p className={styles.errorTitle}>Impossible de charger vos professionnels</p>
                <p className={styles.errorDetail}>Vérifiez votre connexion et réessayez.</p>
                <button className={styles.retryBtn} onClick={fetchConnections}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                  Réessayer
                </button>
              </div>
            ) : connections.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Aucun professionnel connecté</p>
                <button className={styles.linkBtn} onClick={() => router.push("/dashboard/athlete")}>Connectez-vous à un professionnel</button>
              </div>
            ) : (
              <div className={styles.proList}>
                {sorted.map((c) => {
                  const pro = c.professionnel;
                  const initials = `${pro.prenom[0]}${pro.nom[0]}`.toUpperCase();
                  const specColor = getSpecColor(pro.specialite);
                  const isTopMatch = c.score >= 90 && selectedNeed;

                  return (
                    <button key={pro.id} className={`${styles.proCardRich} ${isTopMatch ? styles.proCardRecommended : ""}`} onClick={() => handleProSelect(pro)}>
                      {isTopMatch && (
                        <div className={styles.proRecommendedBadge}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                          {c.matchLabel}
                        </div>
                      )}
                      <div className={styles.proCardRichTop}>
                        <div className={styles.proCardAvatarLg}>
                          {pro.avatarUrl ? <img src={pro.avatarUrl} alt="" /> : <span>{initials}</span>}
                        </div>
                        <div className={styles.proCardRichInfo}>
                          <span className={styles.proCardRichName}>{pro.prenom} {pro.nom}</span>
                          <span className={styles.proCardRichSpec} style={{ color: specColor }}>{pro.specialite}</span>
                          {selectedNeed && (
                            <div className={styles.matchScoreWrap}>
                              <div className={styles.matchScoreBar}>
                                <div className={styles.matchScoreFill} style={{ width: `${Math.min(c.score, 100)}%`, background: c.score >= 80 ? "#10b981" : c.score >= 50 ? "#f59e0b" : "#6b7280" }} />
                              </div>
                              <span className={styles.matchScoreText}>{Math.min(c.score, 100)}% match</span>
                            </div>
                          )}
                          {c.prefLabel && (
                            <span className={styles.proPrefBadge}>
                              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                              {c.prefLabel}
                            </span>
                          )}
                        </div>
                        <svg className={styles.proCardArrow} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                      </div>
                      <div className={styles.proCardRichMeta}>
                        <div className={styles.proMetaItem}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          <span>Présentiel</span>
                        </div>
                        <div className={styles.proMetaItem}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                          <span>Visio</span>
                        </div>
                        {pro.adresseCabinet && (
                          <div className={styles.proMetaItem}>
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                            <span>{pro.adresseCabinet}</span>
                          </div>
                        )}
                        {(() => {
                          const avail = proAvailability[pro.id];
                          if (!avail || avail.loading) {
                            return (
                              <div className={styles.proMetaItem} style={{ color: "rgba(255,255,255,0.3)" }}>
                                <span className={styles.proAvailDot} style={{ background: "rgba(255,255,255,0.15)" }} />
                                <span>Vérification…</span>
                              </div>
                            );
                          }
                          if (avail.nextSlot) {
                            const d = avail.nextSlot;
                            const isToday = d.toDateString() === new Date().toDateString();
                            const isTomorrow = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return d.toDateString() === t.toDateString(); })();
                            const label = isToday
                              ? `Dispo aujourd'hui à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                              : isTomorrow
                                ? `Dispo demain à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                                : `Dispo le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
                            return (
                              <div className={styles.proMetaItem} style={{ color: "#10b981" }}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                <span>{label}</span>
                              </div>
                            );
                          }
                          return (
                            <div className={styles.proMetaItem} style={{ color: "rgba(255,255,255,0.35)" }}>
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                              <span>Aucun créneau disponible</span>
                            </div>
                          );
                        })()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Step 3: Choose motif */}
      {step === "choose-motif" && selectedPro && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Quel type de rendez-vous ?</h2>
          <p className={styles.stepSubtitle}>
            Avec <strong>{selectedPro.prenom} {selectedPro.nom}</strong> — {selectedPro.specialite}
          </p>
          <div className={styles.motifList}>
            {getMotifsForSpec(selectedPro.specialite).map((motif) => (
              <button
                key={motif.id}
                className={`${styles.motifCard} ${selectedMotif?.id === motif.id ? styles.motifCardSelected : ""}`}
                onClick={() => handleMotifSelect(motif)}
              >
                <span className={styles.motifIcon}><MotifSvgIcon name={motif.icon} size={22} /></span>
                <div className={styles.motifInfo}>
                  <span className={styles.motifLabel}>{motif.label}</span>
                  <span className={styles.motifDesc}>{motif.description}</span>
                </div>
                {motif.duration && <span className={styles.motifDuration}>{motif.duration}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Filters */}
      {step === "choose-filters" && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Vos préférences</h2>
          <p className={styles.stepSubtitle}>Affinez votre recherche pour trouver le créneau idéal</p>

          {/* LEARNED: Preference summary hint */}
          {learnedPrefs && learnedPrefs.totalAppointments >= 3 && (
            <div className={styles.prefHint}>
              <div className={styles.prefHintIcon}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
              </div>
              <div className={styles.prefHintContent}>
                <span className={styles.prefHintTitle}>
                  Pré-rempli selon vos habitudes
                  <span className={styles.prefConfBadge} style={{ background: learnedPrefs.dataConfidence >= 80 ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)", color: learnedPrefs.dataConfidence >= 80 ? "#10b981" : "#f59e0b" }}>
                    {learnedPrefs.dataConfidence}% fiabilité
                  </span>
                  {learnedPrefs.preferenceStability != null && (
                    <span className={styles.prefConfBadge} style={{ background: learnedPrefs.preferenceStability >= 70 ? "rgba(99,102,241,0.12)" : "rgba(245,158,11,0.12)", color: learnedPrefs.preferenceStability >= 70 ? "#6366f1" : "#f59e0b" }}>
                      {learnedPrefs.preferenceStability >= 70 ? "Habitudes stables" : "Habitudes variables"}
                    </span>
                  )}
                </span>
                <span className={styles.prefHintText}>
                  {learnedPrefs.preferredFormat && (
                    <>{learnedPrefs.preferredFormat.format === "presentiel" ? "Présentiel" : "Visio"} ({Math.max(learnedPrefs.preferredFormat.presentielPct, learnedPrefs.preferredFormat.teleconsultationPct)}%)</>
                  )}
                  {learnedPrefs.hourRange && (
                    <> · {learnedPrefs.hourRange.label} ({learnedPrefs.hourRange.pct}%)</>
                  )}
                  {!learnedPrefs.hourRange && learnedPrefs.topDayHours[0] && (
                    <> · {learnedPrefs.topDayHours[0].label} ({learnedPrefs.topDayHours[0].pct}%)</>
                  )}
                  {!learnedPrefs.hourRange && !learnedPrefs.topDayHours[0] && learnedPrefs.preferredHours[0] && (
                    <> · {learnedPrefs.preferredHours[0].hour}h ({learnedPrefs.preferredHours[0].pct}%)</>
                  )}
                  {!learnedPrefs.topDayHours[0] && learnedPrefs.preferredDays[0] && (
                    <> · {learnedPrefs.preferredDays[0].name} ({learnedPrefs.preferredDays[0].pct}%)</>
                  )}
                  {" · "}{learnedPrefs.totalAppointments} RDV analysés
                </span>
                {learnedPrefs.regularity.isRegular && (
                  <span className={styles.prefHintRegularity}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    Rythme {learnedPrefs.regularity.periodLabel}
                    {learnedPrefs.regularity.nextIdealDate && (
                      <> · prochain idéal : {new Date(learnedPrefs.regularity.nextIdealDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</>
                    )}
                  </span>
                )}
                {learnedPrefs.seasonalAwareness && (
                  <span className={styles.prefHintSeason}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    En {learnedPrefs.seasonalAwareness.season}, vous préférez le {learnedPrefs.seasonalAwareness.seasonalSlot === "matin" ? "matin" : learnedPrefs.seasonalAwareness.seasonalSlot === "apresMidi" ? "l'après-midi" : learnedPrefs.seasonalAwareness.seasonalSlot === "soir" ? "soir" : "midi"}
                  </span>
                )}
                {learnedPrefs.trends.hours.length > 0 && (
                  <span className={styles.prefHintTrend}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                    {learnedPrefs.trends.hours[0].direction === "rising" ? "↑" : "↓"} {learnedPrefs.trends.hours[0].hour}h ({learnedPrefs.trends.hours[0].direction === "rising" ? "+" : ""}{learnedPrefs.trends.hours[0].delta}pp)
                    {learnedPrefs.trends.days[0] && (
                      <> · {learnedPrefs.trends.days[0].direction === "rising" ? "↑" : "↓"} {learnedPrefs.trends.days[0].dayName}</>
                    )}
                  </span>
                )}
                {learnedPrefs.bookingVelocity && (
                  <span className={styles.prefHintVelocity}>
                    {learnedPrefs.bookingVelocity === "last-minute" ? "⚡ Réservation de dernière minute" :
                     learnedPrefs.bookingVelocity === "spontane" ? "🎯 Réservation spontanée" :
                     learnedPrefs.bookingVelocity === "planificateur" ? "📋 Planificateur" :
                     "📅 Réservation anticipée"}
                    {learnedPrefs.avgBookingDelay != null && <> (~{learnedPrefs.avgBookingDelay}j avant)</>}
                  </span>
                )}
                {learnedPrefs.sequentialPatterns.length > 0 && (
                  <div className={styles.prefHintSequential}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    {learnedPrefs.sequentialPatterns.slice(0, 2).map((sp, i) => (
                      <span key={i} className={styles.seqPatternItem}>
                        Après votre {sp.from}, vous consultez souvent un {sp.to}
                        <span className={styles.seqPatternMeta}> ({sp.count}× · ~{sp.avgDelayDays}j après)</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Engagement re-engagement nudge */}
          {learnedPrefs && (learnedPrefs.engagement.level === "en-baisse" || learnedPrefs.engagement.level === "inactif") && (
            <div className={styles.engagementNudge}>
              <div className={styles.engagementNudgeIcon}>
                {learnedPrefs.engagement.level === "inactif"
                  ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>}
              </div>
              <div className={styles.engagementNudgeContent}>
                <span className={styles.engagementNudgeTitle}>
                  {learnedPrefs.engagement.level === "inactif"
                    ? "Cela fait un moment !"
                    : "Vos consultations sont en baisse"}
                </span>
                <span className={styles.engagementNudgeText}>
                  {learnedPrefs.engagement.level === "inactif"
                    ? `Votre dernière consultation remonte à ${learnedPrefs.engagement.daysSinceLast ?? "plus de 120"}j. Reprenez le suivi pour rester en forme.`
                    : `${learnedPrefs.engagement.recent90} consultation${learnedPrefs.engagement.recent90 > 1 ? "s" : ""} ces 90 derniers jours vs ${learnedPrefs.engagement.prev90} les 90 jours précédents. Pensez à maintenir votre rythme.`}
                </span>
              </div>
            </div>
          )}

          {/* Format filter */}
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              Format
            </div>
            <div className={styles.filterChips}>
              <button className={`${styles.filterChip} ${selectedFormat === "presentiel" ? styles.filterChipActive : ""}`} onClick={() => setSelectedFormat(selectedFormat === "presentiel" ? null : "presentiel")}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                Présentiel
              </button>
              <button className={`${styles.filterChip} ${selectedFormat === "teleconsultation" ? styles.filterChipActive : ""}`} onClick={() => setSelectedFormat(selectedFormat === "teleconsultation" ? null : "teleconsultation")}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                Téléconsultation
              </button>
            </div>
          </div>

          {/* Period filter */}
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Quand ?
            </div>
            <div className={styles.filterChips}>
              {([
                { id: "this-week" as PeriodFilter, label: "Cette semaine" },
                { id: "next-week" as PeriodFilter, label: "Semaine prochaine" },
                { id: "this-month" as PeriodFilter, label: "Ce mois" },
                { id: "any" as PeriodFilter, label: "Peu importe" },
              ]).map((p) => (
                <button key={p.id} className={`${styles.filterChip} ${filterPeriod === p.id ? styles.filterChipActive : ""}`} onClick={() => setFilterPeriod(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time of day filter */}
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Moment de la journée
            </div>
            <div className={styles.filterChips}>
              {([
                { id: "matin" as TimeSlot, label: "Matin", sub: "8h-12h" },
                { id: "midi" as TimeSlot, label: "Midi", sub: "12h-14h" },
                { id: "apres-midi" as TimeSlot, label: "Après-midi", sub: "14h-18h" },
                { id: "soir" as TimeSlot, label: "Soir", sub: "18h-21h" },
              ]).map((t) => (
                <button key={t.id} className={`${styles.filterChip} ${filterTimeSlots.has(t.id) ? styles.filterChipActive : ""}`} onClick={() => toggleTimeSlot(t.id)}>
                  {t.label}
                  <span className={styles.filterChipSub}>{t.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick toggle: Premier créneau */}
          <button className={`${styles.filterToggle} ${filterFirstAvailable ? styles.filterToggleActive : ""}`} onClick={() => setFilterFirstAvailable(!filterFirstAvailable)}>
            <div className={styles.filterToggleInfo}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
              <div>
                <span className={styles.filterToggleLabel}>Premier créneau disponible</span>
                <span className={styles.filterToggleSub}>Le plus tôt possible</span>
              </div>
            </div>
            <div className={`${styles.filterSwitch} ${filterFirstAvailable ? styles.filterSwitchOn : ""}`}>
              <div className={styles.filterSwitchThumb} />
            </div>
          </button>

          {/* More filters */}
          <button className={styles.moreFiltersBtn} onClick={() => setShowMoreFilters(!showMoreFilters)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
            {showMoreFilters ? "Moins de filtres" : "Plus de filtres"}
            {activeFilterCount > 0 && !showMoreFilters && <span className={styles.filterBadge}>{activeFilterCount}</span>}
            <svg className={`${styles.moreFiltersChevron} ${showMoreFilters ? styles.moreFiltersChevronOpen : ""}`} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>

          {showMoreFilters && (
            <div className={styles.moreFiltersContent}>
              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  Durée souhaitée
                </div>
                <div className={styles.filterChips}>
                  {["15 min", "30 min", "45 min", "60 min"].map((d) => (
                    <button key={d} className={`${styles.filterChip} ${filterDuration === d ? styles.filterChipActive : ""}`} onClick={() => setFilterDuration(filterDuration === d ? null : d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {selectedPro?.adresseCabinet && selectedFormat !== "teleconsultation" && (
                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    Lieu
                  </div>
                  <div className={styles.filterLocationCard}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                    <span>{selectedPro.adresseCabinet}</span>
                  </div>
                </div>
              )}
              {selectedPro && (
                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Professionnel sélectionné
                  </div>
                  <div className={styles.filterProCard}>
                    <div className={styles.filterProAvatar}>
                      {selectedPro.avatarUrl ? <img src={selectedPro.avatarUrl} alt="" /> : <span>{`${selectedPro.prenom[0]}${selectedPro.nom[0]}`.toUpperCase()}</span>}
                    </div>
                    <div>
                      <div className={styles.filterProName}>{selectedPro.prenom} {selectedPro.nom}</div>
                      <div className={styles.filterProSpec} style={{ color: getSpecColor(selectedPro.specialite) }}>{selectedPro.specialite}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirm */}
          <button className={styles.filterConfirmBtn} onClick={confirmFilters}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Rechercher des créneaux
            {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""}</span>}
          </button>
        </div>
      )}
    </>
  );
}
