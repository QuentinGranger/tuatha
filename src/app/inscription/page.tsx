import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.scss";

export default function InscriptionPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Choisissez votre profil</h1>
        <p className={styles.subtitle}>
          Sélectionnez le type de compte qui vous correspond
        </p>
      </header>

      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardImage}>
            <Image
              src="/Athlete.png"
              alt="Athlète"
              fill
              style={{ objectFit: "cover", objectPosition: "top" }}
              priority
            />
            <div className={styles.cardOverlay} />
          </div>
          <div className={styles.cardContent}>
            <h2 className={styles.cardTitle}>Athlète</h2>
            <p className={styles.cardDescription}>
              Accédez à vos programmes, suivez vos performances et communiquez
              avec vos professionnels de santé
            </p>
            <Link href="/inscription/athlete" className={styles.cardButton}>
              Choisir ce profil
            </Link>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardImage}>
            <Image
              src="/Medecin.png"
              alt="Professionnel de santé"
              fill
              style={{ objectFit: "cover", objectPosition: "top" }}
              priority
            />
            <div className={styles.cardOverlay} />
          </div>
          <div className={styles.cardContent}>
            <h2 className={styles.cardTitle}>Professionnel de santé</h2>
            <p className={styles.cardDescription}>
              Gérez vos patients, créez des programmes personnalisés et optimisez
              votre pratique professionnelle
            </p>
            <Link href="/inscription/professionnel" className={styles.cardButton}>
              Choisir ce profil
            </Link>

          </div>
        </div>
      </div>

      <p className={styles.loginLink}>
        Vous avez déjà un compte ?{" "}
        <Link href="/">Connectez-vous</Link>
      </p>
    </div>
  );
}
