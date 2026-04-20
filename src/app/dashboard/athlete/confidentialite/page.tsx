"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";
import LegalFooter from "../components/LegalFooter";

interface ProPrivacy {
  professionnel: {
    id: string;
    nom: string;
    prenom: string;
    specialite: string;
    avatarPath: string | null;
  };
  connectedAt: string;
  settings: {
    shareSport: boolean;
    sharePhysical: boolean;
    shareAntecedents: boolean;
    shareTraitements: boolean;
    shareContraindic: boolean;
    shareVitals: boolean;
    shareConsultPrep: boolean;
    sharePhoto: boolean;
    shareMessaging: boolean;
  };
}

const SPECIALITE_COLORS: Record<string, string> = {
  kinesitherapeute: "#3b82f6",
  kine: "#3b82f6",
  coach: "#10b981",
  medecin: "#a855f7",
  nutritionniste: "#f59e0b",
  nutri: "#f59e0b",
};

function getSpecColor(spec: string) {
  const key = spec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, color] of Object.entries(SPECIALITE_COLORS)) {
    if (key.includes(k)) return color;
  }
  return "#6b7280";
}

function countShared(settings: ProPrivacy["settings"]): number {
  return Object.values(settings).filter(Boolean).length;
}

export default function ConfidentialitePage() {
  const router = useRouter();
  const [pros, setPros] = useState<ProPrivacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/athlete/export-data");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mes-donnees-tuatha-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[export] error:", err);
    } finally {
      setExporting(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/athlete/privacy")
      .then(async (r) => {
        if (r.status === 401) { router.push("/"); return null; }
        const json = await r.json();
        if (!r.ok) { console.error("[privacy] API error:", json); return null; }
        return json;
      })
      .then((data) => { if (Array.isArray(data)) setPros(data); })
      .catch((err) => console.error("[privacy] fetch error:", err))
      .finally(() => setLoading(false));
  }, [router]);

  const totalToggles = 9;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 className={styles.headerTitle}>Confidentialité</h1>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <div className={styles.introIcon}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h2 className={styles.introTitle}>Gérez vos données</h2>
          <p className={styles.introText}>
            Contrôlez précisément quelles informations chaque professionnel de santé peut consulter. Vos données médicales sensibles sont protégées par défaut.
          </p>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <span>Chargement...</span>
          </div>
        ) : pros.length === 0 ? (
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <p>Aucun professionnel connecté</p>
            <span>Connectez-vous à un professionnel pour gérer vos paramètres de confidentialité.</span>
          </div>
        ) : (
          <div className={styles.proList}>
            {pros.map(({ professionnel: pro, connectedAt, settings }) => {
              const shared = countShared(settings);
              const specColor = getSpecColor(pro.specialite);
              const initials = `${pro.prenom[0]}${pro.nom[0]}`.toUpperCase();
              const connDate = new Date(connectedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

              return (
                <button
                  key={pro.id}
                  className={styles.proCard}
                  onClick={() => router.push(`/dashboard/athlete/confidentialite/${pro.id}`)}
                >
                  <div className={styles.proAvatar}>
                    {pro.avatarPath ? (
                      <img src={pro.avatarPath} alt="" />
                    ) : (
                      <span>{initials}</span>
                    )}
                    <div className={styles.proAvatarBadge} style={{ background: specColor }} />
                  </div>
                  <div className={styles.proInfo}>
                    <span className={styles.proName}>{pro.prenom} {pro.nom}</span>
                    <span className={styles.proSpec} style={{ color: specColor }}>{pro.specialite}</span>
                    <span className={styles.proDate}>Connecté le {connDate}</span>
                  </div>
                  <div className={styles.proRight}>
                    <div className={styles.shareIndicator}>
                      <div className={styles.shareBar}>
                        <div className={styles.shareFill} style={{ width: `${(shared / totalToggles) * 100}%` }} />
                      </div>
                      <span className={styles.shareCount}>{shared}/{totalToggles}</span>
                    </div>
                    <svg className={styles.proChevron} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.infoCard}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          <div>
            <strong>Données médicales protégées</strong>
            <p>Les antécédents, traitements et contre-indications sont désactivés par défaut. Activez-les uniquement pour les professionnels qui en ont besoin pour votre suivi.</p>
          </div>
        </div>

        <div className={styles.exportSection}>
          <div className={styles.exportIcon}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          </div>
          <h3 className={styles.exportTitle}>Télécharger mes données</h3>
          <p className={styles.exportDesc}>
            Conformément au RGPD, vous pouvez télécharger l&apos;ensemble de vos données personnelles stockées sur Tuatha : profil, messages, rendez-vous, paramètres de confidentialité et historique d&apos;accès.
          </p>
          <button
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <div className={styles.exportSpinner} />
                Préparation en cours...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Télécharger mes données (JSON)
              </>
            )}
          </button>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
