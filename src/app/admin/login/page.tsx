"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur de connexion.");
        return;
      }

      router.push("/admin");
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        padding: "2.5rem",
        background: "rgba(30, 41, 59, 0.8)",
        borderRadius: "1rem",
        border: "1px solid rgba(148, 163, 184, 0.1)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: "48px",
            height: "48px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1rem",
            fontSize: "1.5rem",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 style={{ color: "#f1f5f9", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            Tuatha Admin
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginTop: "0.5rem" }}>
            Centre de commandement
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.8rem", marginBottom: "0.4rem", fontWeight: 500 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                borderRadius: "0.5rem",
                color: "#f1f5f9",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.8rem", marginBottom: "0.4rem", fontWeight: 500 }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                borderRadius: "0.5rem",
                color: "#f1f5f9",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "0.75rem",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "0.5rem",
              color: "#fca5a5",
              fontSize: "0.85rem",
              marginBottom: "1rem",
              textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: loading ? "#475569" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
