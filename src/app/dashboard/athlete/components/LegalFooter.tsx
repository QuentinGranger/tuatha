"use client";

import styles from "./LegalFooter.module.scss";

export default function LegalFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerLinks}>
        <a href="/cgu" className={styles.footerLink}>CGU</a>
        <a href="/cgv" className={styles.footerLink}>CGV</a>
        <a href="/confidentialite" className={styles.footerLink}>Confidentialité</a>
        <a href="/cookies" className={styles.footerLink}>Cookies</a>
        <a href="/charte-partage" className={styles.footerLink}>Charte</a>
        <a href="/faq" className={styles.footerLink}>FAQ</a>
        <a href="/dashboard/athlete/aide" className={styles.footerLink}>Aide</a>
      </div>
      <div className={styles.footerCopy}>&copy; {new Date().getFullYear()} Tuatha</div>
    </footer>
  );
}
