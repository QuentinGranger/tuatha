"use client";

import { useRouter } from "next/navigation";
import styles from "../page.module.scss";
import type { ProFullProfile, SpecConfig } from "./types";
import ReportUserButton from "../../../components/ReportUserButton";

interface ProfileHeroProps {
  proId: string;
  prenom: string;
  nom: string;
  avatarUrl: string | null;
  fullProfile: ProFullProfile | null;
  specConfig: SpecConfig;
  connectedSince: string | null;
  profileView: "profil" | "suivi";
  onViewChange: (view: "profil" | "suivi") => void;
}

export default function ProfileHero({
  proId, prenom, nom, avatarUrl, fullProfile: fp, specConfig: sc,
  connectedSince, profileView, onViewChange,
}: ProfileHeroProps) {
  const router = useRouter();
  const initials = `${prenom[0]}${nom[0]}`.toUpperCase();

  return (
    <div className={styles.profileHero}>
      <button className={styles.backBtn} onClick={() => router.push("/dashboard/athlete")}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Retour
      </button>

      <div className={styles.profileHeroCard}>
        <div className={styles.profileAvatar}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${prenom} ${nom}`} />
          ) : (
            <span className={styles.profileAvatarInitials}>{initials}</span>
          )}
        </div>
        <div className={styles.profileHeroInfo}>
          <h1 className={styles.profileName}>{prenom} {nom}</h1>
          <span className={styles.profileSpec}>
            {fp?.professionAffichee || sc.label}
            {fp?.specialiteAffichee && <> · {fp.specialiteAffichee}</>}
          </span>
          {fp?.adresseCabinet && (
            <a
              className={styles.profileAddress}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fp.adresseCabinet)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              {fp.adresseCabinet}
            </a>
          )}
          {connectedSince && (
            <span className={styles.profileSince}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Connecté depuis {new Date(connectedSince).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
        </div>
      </div>

      <div className={styles.profileActions}>
        <button className={styles.profileActionPrimary} onClick={() => router.push(`/dashboard/athlete/mes-rdv?action=quick-book&proId=${proId}`)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" /></svg>
          Prendre rendez-vous
        </button>
        <button className={styles.profileActionSecondary} onClick={() => router.push(`/dashboard/athlete/messagerie?proId=${proId}`)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          Message
        </button>
        {fp?.telephone && (
          <a className={styles.profileActionSecondary} href={`tel:${fp.telephone}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            Appeler
          </a>
        )}
        <ReportUserButton reportedUserId={proId} reportedUserType="pro" />
      </div>

      <div className={styles.profileViewToggle}>
        <button className={`${styles.profileViewBtn} ${profileView === "profil" ? styles.profileViewBtnActive : ""}`} onClick={() => onViewChange("profil")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          Profil
        </button>
        <button className={`${styles.profileViewBtn} ${profileView === "suivi" ? styles.profileViewBtnActive : ""}`} onClick={() => onViewChange("suivi")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          Mon suivi
        </button>
      </div>
    </div>
  );
}
