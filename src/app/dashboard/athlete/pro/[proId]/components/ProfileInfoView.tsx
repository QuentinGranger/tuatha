"use client";

import { useRouter } from "next/navigation";
import styles from "../page.module.scss";
import type { ProFullProfile, Rdv, SpecConfig } from "./types";
import { formatDate, formatTime } from "./types";

// ── Label maps ──
const CONV_LABELS: Record<string, string> = { oui: "Conventionné", non: "Non conventionné", secteur_1: "Secteur 1", secteur_2: "Secteur 2", a_verifier: "À vérifier" };
const ORD_LABELS: Record<string, string> = { oui: "Requise", non: "Non requise", selon_acte: "Selon l'acte" };
const MUT_LABELS: Record<string, string> = { oui: "Acceptée", non: "Non acceptée", a_verifier: "À vérifier" };
const STAT_LABELS: Record<string, string> = { liberal: "Libéral", salarie: "Salarié", mixte: "Mixte", remplacant: "Remplaçant", autre: "Autre" };
const JOUR_LABELS: Record<string, string> = { lundi: "Lun", mardi: "Mar", mercredi: "Mer", jeudi: "Jeu", vendredi: "Ven", samedi: "Sam", dimanche: "Dim" };
const FORMAT_LABELS: Record<string, string> = { presentiel: "Cabinet", teleconsultation: "Téléconsultation" };
const REMBOURS_LABELS: Record<string, string> = {
  potentiellement_remboursable: "Potentiellement remboursable",
  hors_assurance_maladie: "Hors assurance maladie",
  complementaire_possible: "Complémentaire possible",
  a_verifier_patient: "À vérifier",
};

interface ProfileInfoViewProps {
  proId: string;
  fullProfile: ProFullProfile | null;
  specConfig: SpecConfig;
  rdvs: Rdv[];
  rdvLoading: boolean;
}

export default function ProfileInfoView({ proId, fullProfile: fp, specConfig: sc, rdvs, rdvLoading }: ProfileInfoViewProps) {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <div className={styles.profileCards}>

        {/* ── Informations ── */}
        <div className={styles.profileCard}>
          <h3 className={styles.profileCardTitle}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Informations
          </h3>
          <div className={styles.profileCardRows}>
            <div className={styles.profileCardRow}>
              <span className={styles.profileCardLabel}>Spécialité</span>
              <span>{fp?.professionAffichee || sc.label}</span>
            </div>
            {fp?.specialiteAffichee && (
              <div className={styles.profileCardRow}>
                <span className={styles.profileCardLabel}>Domaine</span>
                <span>{fp.specialiteAffichee}</span>
              </div>
            )}
            {fp?.statutExercice && (
              <div className={styles.profileCardRow}>
                <span className={styles.profileCardLabel}>Exercice</span>
                <span>{STAT_LABELS[fp.statutExercice] || fp.statutExercice}</span>
              </div>
            )}
            {fp?.adresseCabinet && (
              <div className={styles.profileCardRow}>
                <span className={styles.profileCardLabel}>Adresse</span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fp.adresseCabinet)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.profileLink}
                >
                  {fp.adresseCabinet}
                </a>
              </div>
            )}
            {fp?.telephone && (
              <div className={styles.profileCardRow}>
                <span className={styles.profileCardLabel}>Téléphone</span>
                <a href={`tel:${fp.telephone}`} className={styles.profileLink}>{fp.telephone}</a>
              </div>
            )}
            {fp?.email && (
              <div className={styles.profileCardRow}>
                <span className={styles.profileCardLabel}>Email</span>
                <a href={`mailto:${fp.email}`} className={styles.profileLink}>{fp.email}</a>
              </div>
            )}
          </div>
        </div>

        {/* ── Tarifs & Prestations ── */}
        {fp && fp.tarifs.length > 0 && (
          <div className={styles.profileCard}>
            <h3 className={styles.profileCardTitle}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
              Tarifs &amp; Prestations
            </h3>
            <div className={styles.tarifsList}>
              {fp.tarifs.map((t) => (
                <div key={t.id} className={styles.tarifCard}>
                  <div className={styles.tarifHeader}>
                    <span className={styles.tarifLabel}>{t.label}</span>
                    <span className={styles.tarifPrice}>{(t.price / 100).toFixed(0)} €</span>
                  </div>
                  <div className={styles.tarifMeta}>
                    <span className={styles.tarifDuration}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      {t.duration} min
                    </span>
                    {t.format && <span className={styles.tarifFormat}>{FORMAT_LABELS[t.format] || t.format}</span>}
                    <span className={styles.tarifRembours}>{REMBOURS_LABELS[t.remboursementLabel] || t.remboursementLabel}</span>
                  </div>
                  {t.description && <p className={styles.tarifDesc}>{t.description}</p>}
                  <button
                    className={styles.tarifBookBtn}
                    onClick={() => router.push(`/dashboard/athlete/mes-rdv?action=quick-book&proId=${proId}`)}
                  >
                    Réserver
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Remboursement ── */}
        {fp && (
          <div className={styles.profileCard}>
            <h3 className={styles.profileCardTitle}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Remboursement
            </h3>
            <div className={styles.profileCardRows}>
              <div className={styles.profileCardRow}>
                <span className={styles.profileCardLabel}>Conventionnement</span>
                <span className={styles.profileBadge} data-conv={fp.conventionne}>{CONV_LABELS[fp.conventionne] || fp.conventionne}</span>
              </div>
              {fp.prestationRemboursableType && (
                <div className={styles.profileCardRow}>
                  <span className={styles.profileCardLabel}>Type de prestation</span>
                  <span>{fp.prestationRemboursableType}</span>
                </div>
              )}
              <div className={styles.profileCardRow}>
                <span className={styles.profileCardLabel}>Ordonnance</span>
                <span>{ORD_LABELS[fp.ordonnanceRequise] || fp.ordonnanceRequise}</span>
              </div>
              <div className={styles.profileCardRow}>
                <span className={styles.profileCardLabel}>Mutuelle</span>
                <span>{MUT_LABELS[fp.mutuelleAcceptee] || fp.mutuelleAcceptee}</span>
              </div>
              {fp.remboursementNote && (
                <div className={styles.profileCardNote}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                  {fp.remboursementNote}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Horaires ── */}
        {fp && fp.disponibilites.length > 0 && (
          <div className={styles.profileCard}>
            <h3 className={styles.profileCardTitle}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Horaires
            </h3>
            <div className={styles.horairesList}>
              {fp.disponibilites.map((d) => (
                <div key={d.id} className={styles.horaireRow}>
                  <span className={styles.horaireJour}>
                    {JOUR_LABELS[d.jourDebut] || d.jourDebut}
                    {d.jourDebut !== d.jourFin && <> – {JOUR_LABELS[d.jourFin] || d.jourFin}</>}
                  </span>
                  <span className={styles.horaireHeure}>{d.heureDebut} – {d.heureFin}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Prochains RDV ── */}
        <div className={styles.profileCard}>
          <h3 className={styles.profileCardTitle}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            {sc.rdvLabel}
          </h3>
          {rdvLoading ? (
            <div className={styles.skeleton}><div className={styles.skeletonLine} /><div className={styles.skeletonLine} style={{ width: "60%" }} /></div>
          ) : rdvs.length > 0 ? (
            <div className={styles.rdvList}>
              {rdvs.map((rdv, i) => (
                <div key={rdv.id} className={`${styles.nextRdvCard} ${i === 0 ? styles.nextRdvCardFirst : ""}`}>
                  <div className={styles.nextRdvContent}>
                    <div className={styles.nextRdvDate}>
                      <span className={styles.nextRdvDay}>{formatDate(rdv.date)}</span>
                      <span className={styles.nextRdvTime}>{formatTime(rdv.date)}{rdv.endDate ? ` – ${formatTime(rdv.endDate)}` : ""}</span>
                    </div>
                    <div className={styles.nextRdvInfo}>
                      <span className={styles.nextRdvTitle}>{rdv.title}</span>
                      {rdv.format && <span className={styles.nextRdvFormat}>{rdv.format === "teleconsultation" ? "Téléconsultation" : "Présentiel"}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.rdvEmpty}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              <span>Aucun rendez-vous à venir</span>
              <button className={styles.rdvBookBtn} onClick={() => router.push(`/dashboard/athlete/mes-rdv?action=quick-book&proId=${proId}`)}>
                Prendre rendez-vous
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
