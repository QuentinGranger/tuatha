"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.scss";

export default function VerifierEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const fullCode = code.join("");

  const verify = async () => {
    if (fullCode.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerified(true);
      showToast("Email vérifié avec succès !", "success");

      // API auto-creates session and returns redirect path
      const dest = data.redirect || "/";
      setTimeout(() => router.push(dest), 2500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur de vérification", "error");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Nouveau code envoyé !", "success");
      setCooldown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setResending(false);
    }
  };

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (fullCode.length === 6 && !loading && !verified) {
      verify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullCode]);

  const ICO = {
    mail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>Tuatha</div>

        <div className={`${styles.icon} ${verified ? styles.iconSuccess : ""}`}>
          {verified ? ICO.check : ICO.mail}
        </div>

        {!verified ? (
          <>
            <h1 className={styles.title}>Vérifiez votre email</h1>
            <p className={styles.desc}>
              Un code à 6 chiffres a été envoyé à<br />
              <span className={styles.email}>{emailParam || "votre adresse email"}</span>
            </p>

            <div className={styles.codeInputs} onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className={styles.codeDigit}
                  value={digit}
                  onChange={(e) => handleInput(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button className={styles.btnPrimary} onClick={verify} disabled={loading || fullCode.length !== 6}>
              {loading ? "Vérification..." : "Vérifier"}
            </button>

            <div className={styles.resendRow}>
              <span>Pas reçu ?</span>
              <button className={styles.resendBtn} onClick={resendCode} disabled={cooldown > 0 || resending}>
                {cooldown > 0 ? `Renvoyer (${cooldown}s)` : resending ? "Envoi..." : "Renvoyer le code"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Email vérifié !</h1>
            <p className={styles.desc}>
              Votre adresse email a été confirmée. Redirection en cours...
            </p>
          </>
        )}

        <Link href="/" className={styles.backLink}>
          {ICO.back} Retour à la connexion
        </Link>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.success : styles.error}`}>
          {toast.type === "success" ? ICO.check : ICO.alert} {toast.msg}
        </div>
      )}
    </div>
  );
}
