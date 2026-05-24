"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "account", label: "Compte & connexion" },
  { value: "security", label: "Sécurité" },
  { value: "payment", label: "Paiement" },
  { value: "technical", label: "Bug / problème technique" },
  { value: "pro", label: "Problème avec un professionnel" },
  { value: "data", label: "Données / documents" },
  { value: "rgpd", label: "RGPD / confidentialité" },
  { value: "other", label: "Autre" },
];

export default function SupportFormPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [hpField, setHpField] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const r = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, category, _hp_email: hpField || undefined }),
      });
      const data = await r.json();
      if (data.success) {
        setSuccess(true);
        setSubject("");
        setDescription("");
        setCategory("other");
      } else {
        setError(data.error || "Une erreur est survenue.");
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  const loadHistory = async () => {
    setShowHistory(true);
    try {
      const r = await fetch("/api/support/ticket");
      const data = await r.json();
      setTickets(data.tickets ?? []);
    } catch {
      setTickets([]);
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      open: "En attente", in_progress: "En cours", resolved: "Résolu", closed: "Fermé", blocked: "Bloqué",
    };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      open: "#2563eb", in_progress: "#d97706", resolved: "#16a34a", closed: "#64748b", blocked: "#dc2626",
    };
    return map[s] || "#64748b";
  };

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Back link */}
      <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.8rem", cursor: "pointer", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
        ← Retour à l&apos;aide
      </button>

      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.25rem", color: "#1e293b" }}>Contacter le support</h1>
      <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 1.5rem" }}>
        Décrivez votre problème et nous reviendrons vers vous dans les plus brefs délais.
      </p>

      {success ? (
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: "12px", padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem", color: "#166534" }}>Demande envoyée</h2>
          <p style={{ fontSize: "0.8rem", color: "#15803d", margin: 0 }}>
            Notre équipe a bien reçu votre message. Vous recevrez une réponse sous 24 à 48h.
          </p>
          <button onClick={() => setSuccess(false)} style={{ marginTop: "1rem", padding: "0.5rem 1.25rem", borderRadius: "8px", border: "1px solid #16a34a", background: "#fff", color: "#16a34a", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>
            Envoyer une autre demande
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Honeypot — hidden from real users, filled by bots */}
          <div style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }} aria-hidden="true">
            <input type="email" name="_hp_email" tabIndex={-1} autoComplete="off" value={hpField} onChange={e => setHpField(e.target.value)} />
          </div>

          {/* Category */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.3rem" }}>
              Type de demande
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.85rem", background: "#fff", color: "#1e293b" }}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.3rem" }}>
              Sujet
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ex: Impossible de me connecter"
              required
              minLength={3}
              maxLength={200}
              style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.85rem", color: "#1e293b" }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.3rem" }}>
              Description du problème
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Décrivez le problème en détail : ce que vous faisiez, ce qui s'est passé, le message d'erreur si applicable..."
              required
              minLength={10}
              maxLength={2000}
              rows={5}
              style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.85rem", resize: "vertical", color: "#1e293b" }}
            />
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.2rem", textAlign: "right" }}>
              {description.length}/2000
            </div>
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.6rem 1rem", fontSize: "0.8rem", color: "#b91c1c" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            style={{
              padding: "0.7rem 1.5rem", borderRadius: "8px", border: "none",
              background: sending ? "#94a3b8" : "#2563eb", color: "#fff",
              fontSize: "0.85rem", fontWeight: 600, cursor: sending ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {sending ? "Envoi en cours..." : "Envoyer ma demande"}
          </button>

          <p style={{ fontSize: "0.72rem", color: "#94a3b8", textAlign: "center", margin: "0.25rem 0 0" }}>
            Délai de réponse habituel : 24 à 48h ouvrées.
            Pour une urgence sécurité, appelez le +33 6.71.63.83.06
          </p>
        </form>
      )}

      {/* Ticket history */}
      <div style={{ marginTop: "2rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.25rem" }}>
        <button onClick={loadHistory} style={{ background: "none", border: "none", fontSize: "0.82rem", color: "#2563eb", fontWeight: 600, cursor: "pointer" }}>
          {showHistory ? "↻ Actualiser" : "Voir mes demandes précédentes"}
        </button>

        {showHistory && tickets !== null && (
          <div style={{ marginTop: "0.75rem" }}>
            {tickets.length === 0 ? (
              <p style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Aucune demande précédente.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {tickets.map((t: any) => (
                  <div key={t.id} style={{ padding: "0.6rem 0.8rem", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#fafafa" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e293b" }}>{t.subject}</span>
                      <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", background: `${statusColor(t.status)}15`, color: statusColor(t.status) }}>
                        {statusLabel(t.status)}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                      {CATEGORIES.find(c => c.value === t.category)?.label ?? t.category} · {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
