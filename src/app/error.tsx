"use client";

// ─── Global Error Boundary ───
// Catches unhandled errors in the app and shows a safe, generic message.
// NEVER exposes stack traces, error details, or internal state to the user.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error server-side only — no details sent to the client
    console.error("[GlobalError]", error.digest || "unhandled");
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#1a1a2e" }}>
        Une erreur est survenue
      </h2>
      <p style={{ color: "#666", maxWidth: "400px", marginBottom: "1.5rem" }}>
        Nous nous excusons pour la gêne occasionnée. Veuillez réessayer ou
        contacter le support si le problème persiste.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "0.5rem",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        Réessayer
      </button>
    </div>
  );
}
