"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import styles from "./page.module.scss";

export default function ConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmationContent />
    </Suspense>
  );
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
          </svg>
        </div>

        <h1 className={styles.title}>Inscription en cours de validation</h1>

        <p className={styles.description}>
          Merci pour votre inscription ! Un <strong>email de confirmation</strong> a été envoyé à votre adresse. 
          Notre équipe va vérifier vos informations et valider votre profil.
        </p>

        <div className={styles.steps}>
          <div className={`${styles.step} ${styles.stepDone}`}>
            <span className={styles.stepNumber}>1</span>
            <div>
              <p className={styles.stepTitle}>Inscription complétée</p>
              <p className={styles.stepDesc}>Vos informations ont été enregistrées</p>
            </div>
          </div>
          <div className={`${styles.step} ${styles.stepDone}`}>
            <span className={styles.stepNumber}>2</span>
            <div>
              <p className={styles.stepTitle}>Configuration terminée</p>
              <p className={styles.stepDesc}>Services, disponibilités et calendrier configurés</p>
            </div>
          </div>
          <div className={`${styles.step} ${styles.stepActive}`}>
            <span className={styles.stepNumber}>3</span>
            <div>
              <p className={styles.stepTitle}>Vérification en cours</p>
              <p className={styles.stepDesc}>Validation de vos documents et informations</p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>4</span>
            <div>
              <p className={styles.stepTitle}>Profil activé</p>
              <p className={styles.stepDesc}>Votre profil sera visible par les patients</p>
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <p>
            Vous recevrez un email dès que votre profil sera activé. 
            En attendant, consultez votre boîte mail pour confirmer votre adresse email.
          </p>
          <p className={styles.spamNote}>
            Vous ne trouvez pas l&apos;email ? Pensez à vérifier vos <strong>spams</strong> ou votre dossier <strong>courrier indésirable</strong>.
          </p>
        </div>

        <Link href={redirect} className={styles.dashBtn}>
          Accéder à mon espace
        </Link>
        <Link href="/" className={styles.backBtn}>
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
