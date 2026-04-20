"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.scss";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const ICO = {
    mail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>Tuatha</div>

        <div className={`${styles.icon} ${sent ? styles.iconSuccess : styles.iconDefault}`}>
          {sent ? ICO.check : ICO.mail}
        </div>

        {!sent ? (
          <>
            <h1 className={styles.title}>Mot de passe oublié</h1>
            <p className={styles.desc}>
              Entrez votre adresse email. Si un compte existe, vous recevrez un lien de réinitialisation.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                className={styles.input}
                placeholder="Votre adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.btnPrimary} disabled={loading || !email.trim()}>
                {loading ? "Envoi en cours..." : "Envoyer le lien"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Email envoyé !</h1>
            <p className={styles.desc}>
              Si un compte est associé à <strong>{email}</strong>, vous recevrez un email avec un lien de réinitialisation valable 15 minutes.
              <br /><br />
              Pensez à vérifier vos spams.
            </p>
            <button className={styles.btnPrimary} onClick={() => { setSent(false); setEmail(""); }}>
              Renvoyer un email
            </button>
          </>
        )}

        <Link href="/" className={styles.backLink}>
          {ICO.back} Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
