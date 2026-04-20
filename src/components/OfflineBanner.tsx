"use client";

import { useOffline } from "@/hooks/useOffline";

export default function OfflineBanner() {
  const { isOffline, pendingCount, syncing, replayQueue } = useOffline();

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "8px 16px",
        background: isOffline ? "rgba(239, 68, 68, 0.95)" : "rgba(234, 179, 8, 0.95)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 500,
        backdropFilter: "blur(8px)",
        transition: "all 0.3s ease",
      }}
    >
      {isOffline ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>Hors connexion</span>
          {pendingCount > 0 && (
            <span style={{ opacity: 0.8, fontSize: 12 }}>
              · {pendingCount} action{pendingCount > 1 ? "s" : ""} en attente
            </span>
          )}
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={syncing ? { animation: "spin 1s linear infinite" } : {}}>
            <path d="M21.5 2v6h-6" />
            <path d="M2.5 22v-6h6" />
            <path d="M2.5 11.5a10 10 0 0 1 18.8-4.3" />
            <path d="M21.5 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          <span>
            {syncing
              ? "Synchronisation en cours…"
              : `${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente`}
          </span>
          {!syncing && (
            <button
              onClick={replayQueue}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                padding: "3px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Synchroniser
            </button>
          )}
        </>
      )}
    </div>
  );
}
