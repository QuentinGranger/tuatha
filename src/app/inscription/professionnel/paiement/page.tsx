"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.scss";

export default function PaiementPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.container}>
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
              Chargement...
            </p>
          </div>
        </div>
      }
    >
      <PaiementContent />
    </Suspense>
  );
}

function PaiementContent() {
  const searchParams = useSearchParams();
  const professionnelId = searchParams.get("id") || "";
  const specialite = searchParams.get("specialite") || "";
  const email = searchParams.get("email") || "";
  const status = searchParams.get("status");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    status === "incomplete"
      ? "L'onboarding Stripe n'a pas été finalisé. Veuillez réessayer pour compléter la vérification."
      : status === "error"
        ? "Une erreur est survenue. Veuillez réessayer."
        : null
  );

  const handleStartOnboarding = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/inscription/professionnel/stripe-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionnelId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de la création du compte.");
        return;
      }

      // Redirect to Stripe hosted onboarding
      window.location.href = data.url;
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.stepBadge}>Étape 2 / 4</span>
          <h1 className={styles.title}>Vérification & Paiement</h1>
          <p className={styles.subtitle}>
            Pour recevoir vos paiements en toute sécurité, nous devons vérifier
            votre identité et vos coordonnées bancaires via notre partenaire
            de paiement agréé.
          </p>
        </header>

        {error && (
          <div
            className={`${styles.message} ${
              status === "incomplete" ? styles.messageWarning : styles.messageError
            }`}
          >
            {error}
          </div>
        )}

        {/* ── Ce qui sera vérifié ── */}
        <div className={styles.infoCard}>
          <h2 className={styles.infoTitle}>
            Informations collectées par Stripe
          </h2>
          <ul className={styles.infoList}>
            <li className={styles.infoItem}>
              <span className={`${styles.infoIcon} ${styles.iconIdentity}`}>
                &#x1F464;
              </span>
              <div>
                <span className={styles.infoItemTitle}>Identité légale</span>
                <br />
                Nom, prénom, date de naissance, adresse — vérifiés via une pièce
                d&apos;identité officielle (KYC).
              </div>
            </li>
            <li className={styles.infoItem}>
              <span className={`${styles.infoIcon} ${styles.iconBank}`}>
                &#x1F3E6;
              </span>
              <div>
                <span className={styles.infoItemTitle}>
                  Coordonnées bancaires (IBAN)
                </span>
                <br />
                Compte bancaire sur lequel seront versés vos paiements. Seul un
                IBAN européen valide est accepté.
              </div>
            </li>
            <li className={styles.infoItem}>
              <span className={`${styles.infoIcon} ${styles.iconBusiness}`}>
                &#x1F4BC;
              </span>
              <div>
                <span className={styles.infoItemTitle}>
                  SIRET / Statut d&apos;exercice
                </span>
                <br />
                Numéro SIRET pour les indépendants, ou informations sur votre
                structure d&apos;exercice si salarié ou mixte.
              </div>
            </li>
            <li className={styles.infoItem}>
              <span className={`${styles.infoIcon} ${styles.iconVerify}`}>
                &#x2705;
              </span>
              <div>
                <span className={styles.infoItemTitle}>
                  Vérification KYC (Know Your Customer)
                </span>
                <br />
                Stripe vérifie votre identité conformément aux obligations
                réglementaires européennes (DSP2, LCB-FT). Aucune donnée
                sensible ne transite par Tuatha.
              </div>
            </li>
          </ul>
        </div>

        {/* ── Sécurité ── */}
        <div className={styles.securityCard}>
          <span className={styles.securityIcon}>&#x1F512;</span>
          <div className={styles.securityContent}>
            <span className={styles.securityTitle}>
              Données sécurisées par Stripe
            </span>
            <span className={styles.securityText}>
              Vos données bancaires et pièces d&apos;identité sont collectées et
              stockées exclusivement par Stripe, prestataire de paiement agréé
              (PCI DSS niveau 1, certifié par les autorités financières).
              Tuatha ne stocke ni votre IBAN, ni vos documents d&apos;identité,
              ni vos numéros de carte.
            </span>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.stripeButton}
            onClick={handleStartOnboarding}
            disabled={loading || !professionnelId}
          >
            {loading ? (
              "Redirection vers Stripe..."
            ) : (
              <>
                &#x1F680; Configurer mon compte de paiement
              </>
            )}
          </button>

          <div className={styles.stripeBadge}>
            <span>Propulsé par</span>
            <strong style={{ color: "#635bff" }}>Stripe</strong>
          </div>

          <Link
            href={`/inscription/professionnel/configuration?id=${professionnelId}&specialite=${specialite}&email=${encodeURIComponent(email)}&skipStripe=true`}
            className={styles.skipLink}
          >
            Passer cette étape pour le moment →
          </Link>

          <Link href="/inscription/professionnel" className={styles.backLink}>
            ← Retour à l&apos;inscription
          </Link>
        </div>
      </div>
    </div>
  );
}
