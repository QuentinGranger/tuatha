"use client";

import { useState } from "react";

const REASONS = [
  { value: "inappropriate_behavior", label: "Comportement inapproprié" },
  { value: "harassment", label: "Harcèlement" },
  { value: "fraud", label: "Fraude / arnaque" },
  { value: "impersonation", label: "Usurpation d'identité" },
  { value: "unprofessional_conduct", label: "Conduite non professionnelle" },
  { value: "privacy_violation", label: "Violation de la vie privée" },
  { value: "spam", label: "Spam / sollicitation abusive" },
  { value: "other", label: "Autre" },
];

interface ReportUserButtonProps {
  reportedUserId: string;
  reportedUserType: "pro" | "athlete";
  className?: string;
  style?: React.CSSProperties;
  variant?: "button" | "menu-item";
}

export default function ReportUserButton({ reportedUserId, reportedUserType, className, style, variant = "button" }: ReportUserButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate_behavior");
  const [description, setDescription] = useState("");
  const [hpField, setHpField] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSending(true);
    try {
      const r = await fetch("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedUserId, reportedUserType, reason, description, _hp_email: hpField || undefined }),
      });
      const data = await r.json();
      if (data.success) {
        setDone(true);
        setTimeout(() => { setOpen(false); setDone(false); setDescription(""); }, 2500);
      } else {
        setError(data.error || "Erreur.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSending(false);
    }
  };

  const defaultButtonStyle: React.CSSProperties = variant === "menu-item"
    ? { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%", padding: "0.4rem 0.75rem", border: "none", background: "none", color: "#dc2626", fontSize: "0.78rem", cursor: "pointer", textAlign: "left" }
    : { display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.7rem", borderRadius: "7px", border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer" };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={className}
        style={style ?? defaultButtonStyle}
        title="Signaler ce profil"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        Signaler
      </button>

      {open && (
        <div
          onClick={() => !sending && setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)", padding: "1rem" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", width: "420px", maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            {done ? (
              <div style={{ textAlign: "center", padding: "1rem 0" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#16a34a" }}>Signalement envoyé</p>
                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Notre équipe va examiner ce profil.</p>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.2rem", color: "#1e293b" }}>
                  Signaler {reportedUserType === "pro" ? "ce professionnel" : "cet athlète"}
                </h3>
                <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0 0 1rem" }}>
                  Ce signalement sera traité par notre équipe de modération.
                </p>

                {/* Honeypot — hidden from real users, filled by bots */}
                <div style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }} aria-hidden="true">
                  <input type="email" name="_hp_email" tabIndex={-1} autoComplete="off" value={hpField} onChange={e => setHpField(e.target.value)} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "0.25rem" }}>Motif du signalement</label>
                    <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: "100%", padding: "0.5rem 0.7rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.82rem", background: "#fff" }}>
                      {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "0.25rem" }}>Description (optionnelle)</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Décrivez la situation..."
                      maxLength={1000}
                      rows={3}
                      style={{ width: "100%", padding: "0.5rem 0.7rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.82rem", resize: "vertical" }}
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "#b91c1c", marginTop: "0.5rem" }}>{error}</div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                  <button onClick={() => setOpen(false)} disabled={sending} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontSize: "0.82rem", cursor: "pointer", fontWeight: 500 }}>Annuler</button>
                  <button onClick={handleSubmit} disabled={sending} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "none", background: sending ? "#94a3b8" : "#dc2626", color: "#fff", fontSize: "0.82rem", cursor: sending ? "not-allowed" : "pointer", fontWeight: 600 }}>
                    {sending ? "Envoi..." : "Envoyer le signalement"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
