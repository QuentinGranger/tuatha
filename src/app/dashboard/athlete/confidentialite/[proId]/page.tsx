"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "./page.module.scss";
import LegalFooter from "../../components/LegalFooter";

interface AccessLogEntry {
  id: string;
  action: string;
  resource: string | null;
  blocked: boolean;
  createdAt: string;
}

interface PrivacyData {
  professionnel: {
    id: string;
    nom: string;
    prenom: string;
    specialite: string;
    avatarPath: string | null;
  };
  connectedAt: string;
  settings: Record<string, boolean>;
}

interface ToggleItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  sensitive?: boolean;
}

const TOGGLE_GROUPS: { title: string; items: ToggleItem[] }[] = [
  {
    title: "Informations générales",
    items: [
      {
        key: "sharePhoto",
        label: "Photo de profil",
        description: "Le professionnel peut voir votre photo de profil",
        icon: "camera",
      },
      {
        key: "shareSport",
        label: "Sport & Objectif",
        description: "Sport pratiqué et objectifs personnels",
        icon: "activity",
      },
      {
        key: "sharePhysical",
        label: "Données physiques",
        description: "Taille, poids et âge",
        icon: "ruler",
      },
    ],
  },
  {
    title: "Données médicales",
    items: [
      {
        key: "shareAntecedents",
        label: "Antécédents médicaux",
        description: "Historique médical et antécédents",
        icon: "clipboard",
        sensitive: true,
      },
      {
        key: "shareTraitements",
        label: "Traitements en cours",
        description: "Médicaments et traitements actuels",
        icon: "pill",
        sensitive: true,
      },
      {
        key: "shareContraindic",
        label: "Contre-indications",
        description: "Allergies et contre-indications médicales",
        icon: "alert",
        sensitive: true,
      },
      {
        key: "shareVitals",
        label: "Constantes vitales",
        description: "Tension, fréquence cardiaque, température…",
        icon: "heart",
        sensitive: true,
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        key: "shareConsultPrep",
        label: "Préparation de consultation",
        description: "Symptômes, douleur et évolution avant un RDV",
        icon: "file-text",
      },
      {
        key: "shareMessaging",
        label: "Messagerie",
        description: "Pouvoir échanger des messages avec ce professionnel",
        icon: "message",
      },
    ],
  },
];

function getIcon(name: string) {
  const props = { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "camera": return <svg {...props}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
    case "activity": return <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
    case "ruler": return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case "clipboard": return <svg {...props}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>;
    case "pill": return <svg {...props}><path d="M10.5 1.5H8A6.5 6.5 0 0 0 1.5 8v8A6.5 6.5 0 0 0 8 22.5h8a6.5 6.5 0 0 0 6.5-6.5v-2.5" /><line x1="1" y1="23" x2="23" y2="1" /></svg>;
    case "alert": return <svg {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    case "heart": return <svg {...props}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
    case "file-text": return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
    case "message": return <svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    default: return null;
  }
}

const ACTION_LABELS: Record<string, string> = {
  view_profile: "Consultation du profil",
  view_list: "Affichage dans la liste",
  view_vitals: "Consultation des constantes vitales",
  view_messages: "Accès à la messagerie",
  view_plan_kine: "Consultation du plan kiné",
  view_plan_nutri: "Consultation du plan nutrition",
  view_ordonnance: "Consultation d'une ordonnance",
  view_programme: "Consultation d'un programme",
  view_protocol: "Consultation d'un protocole",
  search: "Recherche",
};

const SPECIALITE_COLORS: Record<string, string> = {
  kinesitherapeute: "#3b82f6", kine: "#3b82f6", coach: "#10b981", medecin: "#a855f7", nutritionniste: "#f59e0b", nutri: "#f59e0b",
};

function getSpecColor(spec: string) {
  const key = spec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, color] of Object.entries(SPECIALITE_COLORS)) {
    if (key.includes(k)) return color;
  }
  return "#6b7280";
}

export default function PrivacyProPage() {
  const router = useRouter();
  const params = useParams();
  const proId = params.proId as string;

  const [data, setData] = useState<PrivacyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const logsFetched = useRef(false);

  useEffect(() => {
    fetch(`/api/athlete/privacy/${proId}`)
      .then((r) => {
        if (r.status === 401) { router.push("/"); return null; }
        if (r.status === 404) { router.push("/dashboard/athlete/confidentialite"); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proId, router]);

  const fetchLogs = useCallback(async (before?: string) => {
    setLogsLoading(true);
    try {
      const url = before
        ? `/api/athlete/privacy/${proId}/access-log?limit=30&before=${before}`
        : `/api/athlete/privacy/${proId}/access-log?limit=30`;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      setLogs((prev) => before ? [...prev, ...json.logs] : json.logs);
      setLogsHasMore(json.hasMore);
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  }, [proId]);

  const handleShowLogs = useCallback(() => {
    setShowLogs(true);
    if (!logsFetched.current) {
      logsFetched.current = true;
      fetchLogs();
    }
  }, [fetchLogs]);

  const handleToggle = useCallback(async (key: string, value: boolean) => {
    if (!data) return;
    setSaving(key);

    // Optimistic update
    setData((prev) => prev ? { ...prev, settings: { ...prev.settings, [key]: value } } : prev);

    try {
      const res = await fetch(`/api/athlete/privacy/${proId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        // Revert on error
        setData((prev) => prev ? { ...prev, settings: { ...prev.settings, [key]: !value } } : prev);
      }
    } catch {
      setData((prev) => prev ? { ...prev, settings: { ...prev.settings, [key]: !value } } : prev);
    } finally {
      setSaving(null);
    }
  }, [data, proId]);

  const toggleAll = useCallback(async (enabled: boolean) => {
    if (!data) return;
    setSaving("all");

    const newSettings: Record<string, boolean> = {};
    for (const group of TOGGLE_GROUPS) {
      for (const item of group.items) {
        newSettings[item.key] = enabled;
      }
    }

    setData((prev) => prev ? { ...prev, settings: { ...prev.settings, ...newSettings } } : prev);

    try {
      const res = await fetch(`/api/athlete/privacy/${proId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) {
        setData((prev) => prev ? { ...prev, settings: data.settings } : prev);
      }
    } catch {
      setData((prev) => prev ? { ...prev, settings: data.settings } : prev);
    } finally {
      setSaving(null);
    }
  }, [data, proId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Chargement...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { professionnel: pro, connectedAt, settings } = data;
  const specColor = getSpecColor(pro.specialite);
  const initials = `${pro.prenom[0]}${pro.nom[0]}`.toUpperCase();
  const connDate = new Date(connectedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const sharedCount = Object.values(settings).filter(Boolean).length;
  const totalCount = Object.keys(settings).length;
  const allOn = sharedCount === totalCount;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push("/dashboard/athlete/confidentialite")}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 className={styles.headerTitle}>Confidentialité</h1>
      </header>

      <main className={styles.main}>
        <div className={styles.proHeader}>
          <div className={styles.proAvatar}>
            {pro.avatarPath ? (
              <img src={pro.avatarPath} alt="" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className={styles.proHeaderInfo}>
            <span className={styles.proName}>{pro.prenom} {pro.nom}</span>
            <span className={styles.proSpec} style={{ color: specColor }}>{pro.specialite}</span>
            <span className={styles.proDate}>Connecté le {connDate}</span>
          </div>
        </div>

        <div className={styles.summaryBar}>
          <div className={styles.summaryLeft}>
            <span className={styles.summaryLabel}>{sharedCount} sur {totalCount} données partagées</span>
          </div>
          <button
            className={`${styles.toggleAllBtn} ${allOn ? styles.toggleAllOff : styles.toggleAllOn}`}
            onClick={() => toggleAll(!allOn)}
            disabled={saving === "all"}
          >
            {allOn ? "Tout désactiver" : "Tout activer"}
          </button>
        </div>

        {TOGGLE_GROUPS.map((group) => (
          <div key={group.title} className={styles.toggleGroup}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            <div className={styles.toggleList}>
              {group.items.map((item) => (
                <div key={item.key} className={`${styles.toggleRow} ${item.sensitive ? styles.toggleSensitive : ""}`}>
                  <div className={styles.toggleIcon}>
                    {getIcon(item.icon)}
                  </div>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleLabel}>
                      {item.label}
                      {item.sensitive && <span className={styles.sensitiveBadge}>Sensible</span>}
                    </span>
                    <span className={styles.toggleDesc}>{item.description}</span>
                  </div>
                  <button
                    className={`${styles.toggleSwitch} ${settings[item.key] ? styles.toggleOn : ""}`}
                    onClick={() => handleToggle(item.key, !settings[item.key])}
                    disabled={saving === item.key || saving === "all"}
                    aria-label={`${item.label}: ${settings[item.key] ? "activé" : "désactivé"}`}
                  >
                    <div className={styles.toggleKnob} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {Object.values(settings).some((v) => !v) && (
          <div className={styles.warningCard}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            <p>Les données désactivées ne seront pas visibles par ce professionnel. Cela peut limiter la qualité du suivi médical.</p>
          </div>
        )}

        {/* ── Access History ── */}
        <div className={styles.accessSection}>
          <button className={styles.accessToggle} onClick={handleShowLogs}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span>Historique d&apos;accès</span>
            <svg className={`${styles.accessChevron} ${showLogs ? styles.accessChevronOpen : ""}`} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>

          {showLogs && (
            <div className={styles.accessLogList}>
              {logsLoading && logs.length === 0 ? (
                <div className={styles.accessLogEmpty}>
                  <div className={styles.spinnerSm} />
                  <span>Chargement…</span>
                </div>
              ) : logs.length === 0 ? (
                <div className={styles.accessLogEmpty}>
                  <span>Aucun accès enregistré pour le moment.</span>
                </div>
              ) : (
                <>
                  {logs.map((log) => {
                    const date = new Date(log.createdAt);
                    const timeStr = date.toLocaleString("fr-FR", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    });
                    return (
                      <div key={log.id} className={`${styles.accessLogRow} ${log.blocked ? styles.accessLogBlocked : ""}`}>
                        <div className={`${styles.accessLogDot} ${log.blocked ? styles.dotBlocked : styles.dotAllowed}`} />
                        <div className={styles.accessLogInfo}>
                          <span className={styles.accessLogAction}>
                            {ACTION_LABELS[log.action] || log.action}
                            {log.blocked && <span className={styles.blockedBadge}>Bloqué</span>}
                          </span>
                          <span className={styles.accessLogTime}>{timeStr}</span>
                        </div>
                      </div>
                    );
                  })}
                  {logsHasMore && (
                    <button
                      className={styles.loadMoreBtn}
                      onClick={() => fetchLogs(logs[logs.length - 1].createdAt)}
                      disabled={logsLoading}
                    >
                      {logsLoading ? "Chargement…" : "Voir plus"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
