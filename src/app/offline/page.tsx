"use client";

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center" as const,
        padding: "2rem",
      }}
    >
      <img
        src="/TuathaPro.png"
        alt="Tuatha Pro"
        style={{ width: 180, marginBottom: 32, opacity: 0.85 }}
      />
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#64748b"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: 16 }}
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 8px" }}>
        Pas de connexion
      </h1>
      <p style={{ fontSize: "0.95rem", color: "#94a3b8", maxWidth: 360, lineHeight: 1.5 }}>
        Vérifiez votre connexion internet et réessayez. L'application sera disponible dès que vous serez de nouveau en ligne.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 24,
          padding: "10px 24px",
          background: "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: "0.9rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Réessayer
      </button>
    </div>
  );
}
