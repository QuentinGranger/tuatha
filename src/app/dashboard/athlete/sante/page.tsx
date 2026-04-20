"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import styles from "./page.module.scss";
import LegalFooter from "../components/LegalFooter";

// ─── Provider definitions ───

type Provider = "GARMIN" | "POLAR" | "WHOOP" | "OURA";

const PROVIDERS: { id: Provider; name: string; logo: string; desc: string }[] = [
  { id: "GARMIN", name: "Garmin", logo: "/Garmin.png", desc: "Activité / outdoor / GPS" },
  { id: "POLAR", name: "Polar", logo: "/Polar.png", desc: "Cardio / endurance" },
  { id: "WHOOP", name: "WHOOP", logo: "/WHOOP.png", desc: "Strain / récupération" },
  { id: "OURA", name: "Oura", logo: "/OURA.png", desc: "Sommeil / readiness / HRV" },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  steps: { label: "Pas", icon: "👟", color: "#22c55e" },
  heart_rate: { label: "Fréquence cardiaque", icon: "❤️", color: "#ef4444" },
  sleep: { label: "Sommeil", icon: "🌙", color: "#818cf8" },
  calories: { label: "Calories", icon: "🔥", color: "#f97316" },
  distance: { label: "Distance", icon: "📍", color: "#06b6d4" },
  active_minutes: { label: "Minutes actives", icon: "⚡", color: "#eab308" },
  spo2: { label: "SpO2", icon: "🫁", color: "#14b8a6" },
  hrv: { label: "VFC (HRV)", icon: "📈", color: "#a78bfa" },
  body_weight: { label: "Poids", icon: "⚖️", color: "#6366f1" },
  body_fat: { label: "Masse grasse", icon: "📊", color: "#f472b6" },
  stress: { label: "Stress", icon: "🧠", color: "#fb923c" },
};

interface Connection {
  id: string;
  provider: Provider;
  status: string;
  scopes: string[];
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

interface LatestData {
  [category: string]: { value: number; unit: string; date: string; provider: string };
}

// ─── Component ───

export default function SantePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [latestData, setLatestData] = useState<LatestData>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Provider | null>(null);
  const [disconnecting, setDisconnecting] = useState<Provider | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState(7);

  // Check for redirect param after OAuth
  useEffect(() => {
    const connectedProvider = searchParams.get("connected");
    if (connectedProvider) {
      // Refresh connections after redirect
      fetchConnections();
      // Clean URL
      window.history.replaceState({}, "", "/dashboard/athlete/sante");
    }
  }, [searchParams]);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/athlete/health/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/athlete/health/data?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setLatestData(data.latest || {});
      }
    } catch (err) {
      console.error("Failed to fetch health data:", err);
    }
  }, [days]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchConnections(), fetchData()]);
      setLoading(false);
    };
    init();
  }, [fetchConnections, fetchData]);

  const handleConnect = async (provider: Provider) => {
    setConnecting(provider);
    try {
      const res = await fetch("/api/athlete/health/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        const data = await res.json();
        // Redirect to provider OAuth page
        window.location.href = data.url;
      } else {
        const err = await res.json();
        console.error("Connect error:", err);
      }
    } catch (err) {
      console.error("Connect error:", err);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider: Provider) => {
    if (!confirm(`Déconnecter ${PROVIDERS.find((p) => p.id === provider)?.name} ? Les données synchronisées seront supprimées.`)) return;

    setDisconnecting(provider);
    try {
      const res = await fetch("/api/athlete/health/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        setConnections((prev) => prev.filter((c) => c.provider !== provider));
        // Refresh data
        await fetchData();
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/athlete/health/sync", { method: "POST" });
      if (res.ok) {
        await fetchConnections();
        await fetchData();
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  const getConnectionStatus = (provider: Provider): Connection | undefined => {
    return connections.find((c) => c.provider === provider);
  };

  const connectedCount = connections.filter((c) => c.status === "connected").length;
  const hasData = Object.keys(latestData).length > 0;

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const daysAgo = Math.floor(hours / 24);
    return `il y a ${daysAgo}j`;
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.logoWrap}>
            <img src="/LogoTuatha.png" alt="Tuatha" className={styles.logoImg} />
          </div>
          <nav className={styles.headerNav}>
            <button className={styles.navBtn} onClick={() => router.push("/dashboard/athlete")}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <span>Mes Pros</span>
            </button>
            <button className={styles.navBtn} onClick={() => router.push("/dashboard/athlete/mes-rdv?action=quick-book")}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              <span>Mes RDV</span>
            </button>
            <button className={`${styles.navBtn} ${styles.navBtnActive}`} onClick={() => router.push("/dashboard/athlete/sante")}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              <span>Santé</span>
            </button>
          </nav>
          <div />
        </header>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Chargement...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <img src="/LogoTuatha.png" alt="Tuatha" className={styles.logoImg} />
        </div>
        <nav className={styles.headerNav}>
          <button className={styles.navBtn} onClick={() => router.push("/dashboard/athlete")}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <span>Mes Pros</span>
          </button>
          <button className={styles.navBtn} onClick={() => router.push("/dashboard/athlete/mes-rdv?action=quick-book")}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <span>Mes RDV</span>
          </button>
          <button className={styles.navBtn} onClick={() => router.push("/dashboard/athlete/ma-journee")}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span>Ma Journée</span>
          </button>
          <button className={`${styles.navBtn} ${styles.navBtnActive}`} onClick={() => router.push("/dashboard/athlete/sante")}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            <span>Santé</span>
          </button>
        </nav>
        <button className={styles.backBtn} onClick={() => router.push("/dashboard/athlete")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Retour
        </button>
      </header>

      {/* ── Main ── */}
      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            <svg className={styles.pageTitleIcon} viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            Santé & Appareils
          </h1>
          <p className={styles.pageSubtitle}>
            Connectez vos appareils et applications pour synchroniser vos données de santé
            {connectedCount > 0 && ` — ${connectedCount} appareil${connectedCount > 1 ? "s" : ""} connecté${connectedCount > 1 ? "s" : ""}`}
          </p>
        </div>

        {/* ── Connections Section ── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg className={styles.sectionTitleIcon} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            Appareils & Applications
          </h2>

          <div className={styles.providerGrid}>
            {PROVIDERS.map((prov) => {
              const conn = getConnectionStatus(prov.id);
              const isConnected = conn?.status === "connected";
              const isPending = conn?.status === "pending";

              return (
                <div
                  key={prov.id}
                  className={`${styles.providerCard} ${isConnected ? styles.providerCardConnected : ""} ${isPending ? styles.providerCardPending : ""}`}
                >
                  <div className={styles.providerLogo}>
                    <Image src={prov.logo} alt={prov.name} width={48} height={48} />
                  </div>
                  <span className={styles.providerName}>{prov.name}</span>

                  <div className={`${styles.providerStatus} ${isConnected ? styles.statusConnected : isPending ? styles.statusPending : styles.statusDisconnected}`}>
                    <span className={styles.statusDot} />
                    {isConnected ? "Connecté" : isPending ? "En attente..." : "Non connecté"}
                  </div>

                  {isConnected && conn?.lastSyncAt && (
                    <span className={styles.providerLastSync}>
                      Dernière sync : {formatRelativeTime(conn.lastSyncAt)}
                    </span>
                  )}

                  <div className={styles.providerActions}>
                    {isConnected ? (
                      <button
                        className={styles.disconnectBtn}
                        onClick={() => handleDisconnect(prov.id)}
                        disabled={disconnecting === prov.id}
                      >
                        {disconnecting === prov.id ? "Déconnexion..." : "Déconnecter"}
                      </button>
                    ) : (
                      <button
                        className={styles.connectBtn}
                        onClick={() => handleConnect(prov.id)}
                        disabled={connecting === prov.id}
                      >
                        {connecting === prov.id ? "Connexion..." : "Connecter"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Health Data Section ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <svg className={styles.sectionTitleIcon} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              Données de santé
            </h2>
            {connectedCount > 0 && (
              <button className={styles.syncBtn} onClick={handleSync} disabled={syncing}>
                <svg className={syncing ? styles.syncSpinner : ""} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                {syncing ? "Synchronisation..." : "Synchroniser"}
              </button>
            )}
          </div>

          <div className={styles.periodRow}>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                className={`${styles.periodBtn} ${days === d ? styles.periodBtnActive : ""}`}
                onClick={() => setDays(d)}
              >
                {d}j
              </button>
            ))}
          </div>

          {hasData ? (
            <div className={styles.dataGrid}>
              {Object.entries(latestData).map(([category, entry]) => {
                const meta = CATEGORY_LABELS[category] || { label: category, icon: "📊", color: "#888" };
                return (
                  <div key={category} className={styles.dataCard}>
                    <span className={styles.dataCardLabel}>{meta.icon} {meta.label}</span>
                    <span className={styles.dataCardValue} style={{ color: meta.color }}>
                      {typeof entry.value === "number"
                        ? entry.value >= 1000
                          ? entry.value.toLocaleString("fr-FR")
                          : entry.value % 1 === 0
                            ? entry.value
                            : entry.value.toFixed(1)
                        : entry.value}
                      <span className={styles.dataCardUnit}> {entry.unit}</span>
                    </span>
                    <span className={styles.dataCardMeta}>
                      {formatRelativeTime(entry.date)} — {PROVIDERS.find((p) => p.id === entry.provider)?.name || entry.provider}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div className={styles.emptyTitle}>Aucune donnée de santé</div>
              <p className={styles.emptyText}>
                {connectedCount === 0
                  ? "Connectez un appareil ou une application ci-dessus pour commencer à synchroniser vos données."
                  : "Vos données apparaîtront ici après la première synchronisation."}
              </p>
            </div>
          )}
        </div>
      </main>

      <LegalFooter />

      {/* ── Mobile bottom nav ── */}
      <nav className={styles.bottomNav}>
        <button className={styles.bottomNavBtn} onClick={() => router.push("/dashboard/athlete")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <span>Mes Pros</span>
        </button>
        <button className={styles.bottomNavBtn} onClick={() => router.push("/dashboard/athlete/mes-rdv?action=quick-book")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <span>Mes RDV</span>
        </button>
        <button className={styles.bottomNavBtn} onClick={() => router.push("/dashboard/athlete/ma-journee")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span>Ma Journée</span>
        </button>
        <button className={`${styles.bottomNavBtn} ${styles.bottomNavBtnActive}`} onClick={() => router.push("/dashboard/athlete/sante")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          <span>Santé</span>
        </button>
      </nav>
    </div>
  );
}
