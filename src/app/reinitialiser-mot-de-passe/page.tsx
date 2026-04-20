"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { validatePassword, getPasswordStrengthLabel } from "@/lib/security";
import styles from "./page.module.scss";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pwdStrength, setPwdStrength] = useState<ReturnType<typeof validatePassword> | null>(null);

  const ICO = {
    lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  };

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenError("Lien invalide : aucun token trouvé.");
      return;
    }
    fetch(`/api/auth/reset-password?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setTokenValid(true);
        } else {
          setTokenError(data.error || "Lien invalide ou expiré.");
        }
      })
      .catch(() => setTokenError("Erreur de vérification du lien."))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
      setTimeout(() => router.push("/"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur.");
    } finally {
      setLoading(false);
    }
  }, [token, password, passwordConfirm, router]);

  if (validating) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>Tuatha</div>
          <div className={styles.spinner}>Vérification du lien...</div>
        </div>
      </div>
    );
  }

  if (!tokenValid && !success) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>Tuatha</div>
          <div className={`${styles.icon} ${styles.iconError}`}>{ICO.alert}</div>
          <h1 className={styles.title}>Lien invalide</h1>
          <p className={styles.desc}>{tokenError}</p>
          <Link href="/mot-de-passe-oublie" className={styles.btnPrimary} style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
            Demander un nouveau lien
          </Link>
          <Link href="/" className={styles.backLink}>{ICO.back} Retour à la connexion</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>Tuatha</div>

        <div className={`${styles.icon} ${success ? styles.iconSuccess : styles.iconDefault}`}>
          {success ? ICO.check : ICO.lock}
        </div>

        {!success ? (
          <>
            <h1 className={styles.title}>Nouveau mot de passe</h1>
            <p className={styles.desc}>Choisissez un mot de passe solide pour sécuriser votre compte.</p>

            <form onSubmit={handleSubmit}>
              <input
                type="password"
                className={styles.input}
                placeholder="Nouveau mot de passe"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwdStrength(validatePassword(e.target.value)); }}
                required
                autoFocus
              />

              {pwdStrength && (
                <div className={styles.pwdStrength}>
                  <div className={styles.pwdStrengthBar}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={styles.pwdStrengthSeg} style={{ background: i < pwdStrength.score ? getPasswordStrengthLabel(pwdStrength.score).color : "rgba(255,255,255,0.06)" }} />
                    ))}
                  </div>
                  <span className={styles.pwdStrengthLabel} style={{ color: getPasswordStrengthLabel(pwdStrength.score).color }}>
                    {getPasswordStrengthLabel(pwdStrength.score).label}
                  </span>
                  <div className={styles.pwdChecks}>
                    {pwdStrength.checks.map((c, i) => (
                      <span key={i} className={c.met ? styles.pwdCheckMet : styles.pwdCheckUnmet}>
                        {c.met ? "✓" : "✗"} {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <input
                type="password"
                className={styles.input}
                placeholder="Confirmer le mot de passe"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.btnPrimary} disabled={loading || !password || !passwordConfirm}>
                {loading ? "Modification..." : "Modifier le mot de passe"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Mot de passe modifié !</h1>
            <p className={styles.desc}>
              Votre mot de passe a été changé avec succès. Vous allez être redirigé vers la page de connexion...
            </p>
            <button className={styles.btnPrimary} onClick={() => router.push("/")}>
              Se connecter
            </button>
          </>
        )}

        <Link href="/" className={styles.backLink}>{ICO.back} Retour à la connexion</Link>
      </div>
    </div>
  );
}
