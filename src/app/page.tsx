"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.scss";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, totpCode: needs2FA ? totpCode : undefined }),
      });

      const data = await res.json();

      if (data.requires2FA && !data.error) {
        setNeeds2FA(true);
        setLoading(false);
        return;
      }

      if (data.requiresEmailVerification) {
        router.push(`/inscription/verifier-email?email=${encodeURIComponent(data.email || email)}`);
        return;
      }

      if (!res.ok) {
        setError(data.error);
      } else {
        router.push(data.redirect);
      }
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Mobile logo area — visible only on small screens */}
      <div className={styles.mobileLogoArea}>
        <Image src="/LogoTuatha.png" alt="Tuatha" width={600} height={200} priority />
      </div>

      <div className={styles.leftPanel}>
        <div className={styles.alphaNotice}>
          Ceci est une version alpha de Tuatha. Si vous avez pu accéder à cette
          page, c&apos;est que vous avez reçu le lien de la part de Quentin.
          <br />
          En cas de problème, veuillez contacter{" "}
          <a href="mailto:quentin@tuatha-app.com">quentin@tuatha-app.com</a>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputWrapper}>
            <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <input
              type="email"
              className={styles.input}
              placeholder="Nom d'utilisateur"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputWrapper}>
            <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input
              type={showPassword ? "text" : "password"}
              className={styles.input}
              placeholder="Mot de passe"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className={styles.togglePassword} onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label={showPassword ? "Masquer" : "Afficher"}>
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>

          {needs2FA && (
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M12 16v2"/><circle cx="12" cy="16" r="1"/></svg>
              <input
                type="text"
                className={styles.input}
                placeholder="Code 2FA (6 chiffres)"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
                style={{ letterSpacing: 6, textAlign: "center", fontSize: 18, fontWeight: 700 }}
              />
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <label className={styles.rememberMe}>
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            <span>Se souvenir de moi</span>
          </label>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "Connexion..." : needs2FA ? "Vérifier" : "Continuer"}
          </button>

          <div className={styles.forgotLink}>
            <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
          </div>
        </form>

        <p className={styles.signupLink}>
          Vous n&apos;avez pas de compte ?{" "}
          <Link href="/inscription">Inscrivez-vous</Link>
        </p>

        <div className={styles.footerLinks}>
          <Link href="/sitemap">Sitemap</Link>
          <Link href="/confidentialite">Politique de confidentialité</Link>
          <Link href="/cgu">CGU</Link>
          <Link href="/cgv">CGV</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/charte-partage">Charte de partage</Link>
          <Link href="/support">Support &amp; aide</Link>
          <Link href="/faq">FAQ</Link>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <nav className={styles.topNav}>
          <Link href="/sitemap" className={styles.navLink}>Sitemap</Link>
          <Link href="/confidentialite" className={styles.navLink}>Confidentialité</Link>
          <Link href="/cgu" className={styles.navLink}>CGU</Link>
          <Link href="/cgv" className={styles.navLink}>CGV</Link>
          <Link href="/cookies" className={styles.navLink}>Cookies</Link>
          <Link href="/charte-partage" className={styles.navLink}>Charte de partage</Link>
          <Link href="/support" className={styles.navLink}>Support &amp; aide</Link>
          <Link href="/faq" className={styles.navLink}>FAQ</Link>
        </nav>

        <div className={styles.logoContainer}>
          <Image
            src="/LogoTuatha.png"
            alt="Tuatha"
            width={1200}
            height={400}
            priority
          />
        </div>
      </div>
    </div>
  );
}
