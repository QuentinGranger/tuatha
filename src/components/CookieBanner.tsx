"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./CookieBanner.module.scss";

// ─── Types ───

interface CookiePreferences {
  necessary: true;
  analytics: boolean;
  personalization: boolean;
}

const COOKIE_NAME = "consent_choice";
const COOKIE_MAX_AGE_DAYS = 180; // 6 mois (CNIL)

// ─── Helpers ───

function getCookieConsent(): CookiePreferences | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.split("=")[1]));
  } catch {
    return null;
  }
}

function setCookieConsent(prefs: CookiePreferences) {
  const value = encodeURIComponent(JSON.stringify(prefs));
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

// ─── Component ───

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    personalization: false,
  });

  useEffect(() => {
    const existing = getCookieConsent();
    if (!existing) {
      setVisible(true);
    } else {
      setPrefs(existing);
    }
  }, []);

  const save = useCallback((newPrefs: CookiePreferences) => {
    setCookieConsent(newPrefs);
    setPrefs(newPrefs);
    setVisible(false);
    setShowPreferences(false);
  }, []);

  const acceptAll = useCallback(() => {
    save({ necessary: true, analytics: true, personalization: true });
  }, [save]);

  const refuseAll = useCallback(() => {
    save({ necessary: true, analytics: false, personalization: false });
  }, [save]);

  const saveCustom = useCallback(() => {
    save(prefs);
  }, [save, prefs]);

  // Expose a global to re-open preferences from a "Gérer mes cookies" link
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__openCookiePrefs = () => {
      setVisible(true);
      setShowPreferences(true);
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__openCookiePrefs;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.banner}>
        {/* ── Bannière simple ── */}
        {!showPreferences && (
          <>
            <div className={styles.content}>
              <div className={styles.icon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="8" cy="9" r="1" fill="currentColor" />
                  <circle cx="15" cy="8" r="1" fill="currentColor" />
                  <circle cx="10" cy="14" r="1" fill="currentColor" />
                  <circle cx="15" cy="13" r="1" fill="currentColor" />
                  <circle cx="12" cy="18" r="1" fill="currentColor" />
                </svg>
              </div>
              <div className={styles.text}>
                <h3 className={styles.title}>Gestion des cookies</h3>
                <p className={styles.description}>
                  Tuatha utilise des cookies strictement nécessaires au fonctionnement et à la sécurité de la plateforme.
                  Aucun traceur publicitaire n&apos;est utilisé.{" "}
                  <Link href="/cookies" target="_blank" className={styles.link}>
                    En savoir plus
                  </Link>
                </p>
              </div>
            </div>
            <div className={styles.actions}>
              <button className={styles.btnRefuse} onClick={refuseAll}>
                Refuser
              </button>
              <button className={styles.btnPrefs} onClick={() => setShowPreferences(true)}>
                Paramétrer
              </button>
              <button className={styles.btnAccept} onClick={acceptAll}>
                Accepter
              </button>
            </div>
          </>
        )}

        {/* ── Centre de préférences ── */}
        {showPreferences && (
          <>
            <div className={styles.prefsHeader}>
              <button className={styles.prefsBack} onClick={() => setShowPreferences(false)}>
                &larr;
              </button>
              <h3 className={styles.title}>Centre de préférences cookies</h3>
            </div>
            <p className={styles.prefsIntro}>
              Choisissez les catégories de traceurs que vous acceptez.
              Les cookies strictement nécessaires ne peuvent pas être désactivés.{" "}
              <Link href="/cookies" target="_blank" className={styles.link}>
                Politique Cookies
              </Link>
            </p>

            <div className={styles.categories}>
              {/* Nécessaires */}
              <div className={styles.category}>
                <div className={styles.catHeader}>
                  <div className={styles.catInfo}>
                    <span className={styles.catName}>Strictement nécessaires</span>
                    <span className={styles.catBadge}>Toujours actif</span>
                  </div>
                  <div className={styles.toggleLocked}>
                    <div className={styles.toggleTrackOn} />
                  </div>
                </div>
                <p className={styles.catDesc}>
                  Authentification, sécurité de session, mémorisation du choix cookies.
                  Sans ces cookies, la plateforme ne peut pas fonctionner.
                </p>
                <div className={styles.catCookies}>
                  <span className={styles.cookieChip}>tuatha_access</span>
                  <span className={styles.cookieChip}>tuatha_refresh</span>
                  <span className={styles.cookieChip}>consent_choice</span>
                </div>
              </div>

              {/* Analytics */}
              <div className={styles.category}>
                <div className={styles.catHeader}>
                  <div className={styles.catInfo}>
                    <span className={styles.catName}>Mesure d&apos;audience</span>
                    <span className={styles.catStatus}>Non utilisé actuellement</span>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={prefs.analytics}
                      onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                    />
                    <span className={styles.toggleTrack} />
                  </label>
                </div>
                <p className={styles.catDesc}>
                  Permet de mesurer l&apos;audience et d&apos;améliorer le service.
                  Aucun outil d&apos;analytics n&apos;est actuellement activé.
                </p>
              </div>

              {/* Personnalisation */}
              <div className={styles.category}>
                <div className={styles.catHeader}>
                  <div className={styles.catInfo}>
                    <span className={styles.catName}>Personnalisation</span>
                    <span className={styles.catStatus}>Non utilisé actuellement</span>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={prefs.personalization}
                      onChange={(e) => setPrefs({ ...prefs, personalization: e.target.checked })}
                    />
                    <span className={styles.toggleTrack} />
                  </label>
                </div>
                <p className={styles.catDesc}>
                  Mémorisation de préférences avancées non essentielles.
                  Aucun traceur de personnalisation n&apos;est actuellement utilisé.
                </p>
              </div>
            </div>

            <div className={styles.prefsActions}>
              <button className={styles.btnRefuse} onClick={refuseAll}>
                Tout refuser
              </button>
              <button className={styles.btnAccept} onClick={saveCustom}>
                Enregistrer mes choix
              </button>
              <button className={styles.btnAcceptAll} onClick={acceptAll}>
                Tout accepter
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
