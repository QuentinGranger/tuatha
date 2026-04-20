"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { buildVisioPairRoom, openVisioRoom } from "@/lib/visio";
import IncomingCallModal from "@/components/IncomingCallModal";
import styles from "./page.module.scss";
import LegalFooter from "./components/LegalFooter";

interface AthleteProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  sport: string | null;
  avatarPath: string | null;
  taille: number | null;
  poids: number | null;
  dateNaissance: string | null;
}

interface ProResult {
  id: string;
  nom: string;
  prenom: string;
  specialite: string;
  avatarUrl: string | null;
  adresseCabinet: string | null;
}

interface MyConnection {
  id: string;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  professionnel: ProResult;
}

interface NextRdv {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  description: string | null;
  color: string;
  pro: { id: string; nom: string; prenom: string; specialite: string };
}

export default function AthleteDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [myConnections, setMyConnections] = useState<MyConnection[]>([]);
  const [nextRdv, setNextRdv] = useState<NextRdv | null>(null);
  const [upcomingRdvs, setUpcomingRdvs] = useState<NextRdv[]>([]);
  const [rdvLoading, setRdvLoading] = useState(true);
  const [paymentRdv, setPaymentRdv] = useState<NextRdv | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("tuatha_notif_enabled");
    return stored !== null ? stored === "true" : true;
  });
  const [notifications, setNotifications] = useState<{ id: string; title: string; subtitle?: string; date: string; type: string; color: string; source: string; meta?: any }[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const SPECIALITE_CONFIG: Record<string, { label: string; color: string; hasVisio: boolean; hasRdv: boolean; hasSeances: boolean; rdvLabel: string; remboursable: boolean }> = {
    medecin: { label: "Médecin", color: "#a855f7", hasVisio: true, hasRdv: true, hasSeances: false, rdvLabel: "Consultation", remboursable: true },
    kine: { label: "Kinésithérapeute", color: "#3b82f6", hasVisio: true, hasRdv: true, hasSeances: false, rdvLabel: "Rendez-vous", remboursable: true },
    dieteticien: { label: "Diététicien", color: "#f59e0b", hasVisio: true, hasRdv: true, hasSeances: false, rdvLabel: "Rendez-vous", remboursable: true },
    autre: { label: "Autre professionnel", color: "#10b981", hasVisio: true, hasRdv: true, hasSeances: false, rdvLabel: "Rendez-vous", remboursable: false },
    // Legacy values (existing users)
    nutri: { label: "Diététicien", color: "#f59e0b", hasVisio: true, hasRdv: true, hasSeances: false, rdvLabel: "Rendez-vous", remboursable: true },
    coach: { label: "Autre professionnel", color: "#10b981", hasVisio: true, hasRdv: true, hasSeances: false, rdvLabel: "Rendez-vous", remboursable: false },
  };

  const getSpecConfig = (spec: string) => {
    const key = spec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const [k, cfg] of Object.entries(SPECIALITE_CONFIG)) {
      if (key.includes(k)) return cfg;
    }
    return { label: spec || "Professionnel", color: "#6b7280", hasVisio: true, hasRdv: true, hasSeances: false, rdvLabel: "Rendez-vous" };
  };

  const getSpecBadgeColor = (spec: string) => getSpecConfig(spec).color;

  const highlightMatch = (text: string, query: string) => {
    if (!query || query.length < 3) return text;
    const parts = query.trim().split(/\s+/);
    const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const regex = new RegExp(`(${escaped})`, "gi");
    const segments = text.split(regex);
    return segments.map((seg, i) =>
      regex.test(seg) ? <mark key={i} className={styles.highlight}>{seg}</mark> : seg
    );
  };

  const fetchResults = useCallback(async (query: string) => {
    if (query.length < 3) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }
    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    try {
      const res = await fetch(`/api/athlete/search-pros?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.results || []);
      setHasSearched(true);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setResults([]);
        setHasSearched(true);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => fetchResults(value.trim()), 350);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasSearched || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev < results.length - 1 ? prev + 1 : 0;
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev > 0 ? prev - 1 : results.length - 1;
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleConnect(results[activeIndex].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSearch("");
      setResults([]);
      setHasSearched(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  };

  const scrollToIndex = (index: number) => {
    const container = resultsRef.current;
    if (!container) return;
    const card = container.children[index] as HTMLElement;
    if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const handleConnect = async (proId: string) => {
    if (connectingId || connectedIds.has(proId) || pendingIds.has(proId)) return;
    setConnectingId(proId);
    try {
      const res = await fetch("/api/athlete/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionnelId: proId }),
      });
      const data = await res.json();
      if (res.ok) {
        setPendingIds((prev) => new Set(prev).add(proId));
      } else if (res.status === 409 && data.status === "pending") {
        setPendingIds((prev) => new Set(prev).add(proId));
      } else if (res.status === 409 && data.status === "accepted") {
        setConnectedIds((prev) => new Set(prev).add(proId));
      }
    } catch { /* ignore */ }
    finally { setConnectingId(null); }
  };

  // Fetch notifications + poll every 15s (gated by notifEnabled)
  const notifPausedRef = useRef(false);
  const fetchNotifications = useCallback(() => {
    if (notifPausedRef.current) return;
    fetch("/api/athlete/notifications")
      .then((r) => {
        if (r.status === 401) { notifPausedRef.current = true; return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => { if (Array.isArray(d)) setNotifications(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!notifEnabled) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 15000);
    return () => clearInterval(iv);
  }, [fetchNotifications, notifEnabled]);

  // Respond to a connection request (accept/decline)
  const respondConnection = async (notifId: string, requestId: string, accept: boolean) => {
    try {
      await fetch(`/api/athlete/connection-request/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      // Refresh connections list
      fetch("/api/athlete/my-connections")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data?.connections) return;
          setMyConnections(data.connections);
          const accepted = new Set<string>();
          const pending = new Set<string>();
          for (const c of data.connections) {
            if (c.status === "accepted") accepted.add(c.professionnel.id);
            else if (c.status === "pending") pending.add(c.professionnel.id);
          }
          setConnectedIds(accepted);
          setPendingIds(pending);
        })
        .catch(() => {});
    } catch { /* ignore */ }
  };

  // Respond to a data access request (accept/reject)
  const respondDataAccess = async (notifId: string, requestId: string, accept: boolean) => {
    try {
      await fetch(`/api/athlete/data-access-request/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch { /* ignore */ }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) setAvatarMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch next appointments
  useEffect(() => {
    fetch("/api/athlete/next-rdv")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setNextRdv(data.next || null);
          setUpcomingRdvs(data.appointments || []);
        }
      })
      .catch(() => {})
      .finally(() => setRdvLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/athlete/profil")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data) => setProfile(data))
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));

    fetch("/api/athlete/my-connections")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.connections) return;
        setMyConnections(data.connections);
        const accepted = new Set<string>();
        const pending = new Set<string>();
        for (const c of data.connections) {
          if (c.status === "accepted") accepted.add(c.professionnel.id);
          else if (c.status === "pending") pending.add(c.professionnel.id);
        }
        setConnectedIds(accepted);
        setPendingIds(pending);
      })
      .catch(() => {});
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const computeAge = (dob: string | null) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const toggleNotifications = async () => {
    if (!notifEnabled) {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      setNotifEnabled(true);
      localStorage.setItem("tuatha_notif_enabled", "true");
    } else {
      setNotifEnabled(false);
      localStorage.setItem("tuatha_notif_enabled", "false");
      setNotifications([]);
    }
  };

  const profileSummaryParts: string[] = [];
  if (profile?.taille) profileSummaryParts.push(`${profile.taille} cm`);
  const age = computeAge(profile?.dateNaissance ?? null);
  if (age) profileSummaryParts.push(`${age} ans`);
  if (profile?.poids) profileSummaryParts.push(`${profile.poids} kg`);

  const startVisioWithPro = (proId: string) => {
    if (!profile?.id) return;
    const room = buildVisioPairRoom("athlete", profile.id, "pro", proId);
    openVisioRoom(room);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.main}>
          <p style={{ color: "rgba(255,255,255,0.4)" }}>Chargement...</p>
        </div>
      </div>
    );
  }

  const initials = profile ? `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase() : "";

  return (
    <div className={styles.page}>
      <IncomingCallModal />
      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <img src="/LogoTuatha.png" alt="Tuatha" className={styles.logoImg} />
        </div>
        <nav className={styles.headerNav}>
          <button className={`${styles.navBtn} ${styles.navBtnActive}`} onClick={() => router.push("/dashboard/athlete")}>
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
          {/* TODO: HEALTH_INTEGRATIONS — Réactiver quand les APIs seront prêtes
          <button className={styles.navBtn} onClick={() => router.push("/dashboard/athlete/sante")}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            <span>Santé</span>
          </button>
          */}
        </nav>

        <div className={styles.userInfo}>
          <div className={styles.notifWrap} ref={notifRef}>
            <button className={styles.notifBtn} title="Notifications" onClick={() => setNotifOpen(!notifOpen)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              {notifications.length > 0 && <span className={styles.notifBadge}>{notifications.length}</span>}
            </button>
            {notifOpen && (
              <div className={styles.notifDropdown}>
                <div className={styles.notifDropdownHeader}>Notifications</div>
                {notifications.length === 0 ? (
                  <div className={styles.notifEmpty}>Aucune notification</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={styles.notifItem}
                      onClick={() => {
                        if (n.source === "pro_message" && n.meta?.proId) {
                          setNotifOpen(false);
                          router.push(`/dashboard/athlete/messagerie?proId=${n.meta.proId}`);
                        } else if (n.source === "slot_freed" && n.meta?.proId) {
                          setNotifOpen(false);
                          router.push(`/dashboard/athlete/mes-rdv?action=book&proId=${n.meta.proId}`);
                        }
                      }}
                    >
                      <div className={styles.notifItemAvatar} style={
                        n.source === "connection" ? { background: "rgba(76,175,80,0.12)", color: "#4caf50" }
                        : n.source === "slot_freed" ? { background: "rgba(16,185,129,0.12)", color: "#10b981" }
                        : undefined
                      }>
                        {n.source === "slot_freed" ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                        ) : n.meta?.avatarPath ? (
                          <img src={n.meta.avatarPath} alt="" />
                        ) : (
                          <span>{n.title.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}</span>
                        )}
                      </div>
                      <div className={styles.notifItemContent}>
                        <div className={styles.notifItemTitle}>{n.title}</div>
                        {n.subtitle && <div className={styles.notifItemSub}>{n.subtitle.slice(0, 60)}</div>}
                        {n.source === "connection" && n.meta?.requestId && (
                          <div className={styles.notifActions}>
                            <button className={styles.notifAcceptBtn} onClick={(e) => { e.stopPropagation(); respondConnection(n.id, n.meta.requestId, true); }}>Accepter</button>
                            <button className={styles.notifDeclineBtn} onClick={(e) => { e.stopPropagation(); respondConnection(n.id, n.meta.requestId, false); }}>Refuser</button>
                          </div>
                        )}
                        {n.source === "data_access_request" && n.meta?.requestId && (
                          <div className={styles.notifActions}>
                            {n.meta.reason && <div className={styles.notifReason}>« {n.meta.reason} »</div>}
                            <button className={styles.notifAcceptBtn} onClick={(e) => { e.stopPropagation(); respondDataAccess(n.id, n.meta.requestId, true); }}>Autoriser</button>
                            <button className={styles.notifDeclineBtn} onClick={(e) => { e.stopPropagation(); respondDataAccess(n.id, n.meta.requestId, false); }}>Refuser</button>
                          </div>
                        )}
                        {n.source === "slot_freed" && (
                          <div className={styles.notifActions}>
                            <button className={styles.notifBookBtn} onClick={(e) => { e.stopPropagation(); setNotifOpen(false); router.push(`/dashboard/athlete/mes-rdv?action=book&proId=${n.meta?.proId}`); }}>
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                              Réserver maintenant
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <span className={styles.userName}>{profile?.prenom} {profile?.nom}</span>
          <div className={styles.avatarWrap} ref={avatarMenuRef}>
            <button className={styles.avatarBtn} onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}>
              <div className={styles.avatar}>
                {profile?.avatarPath ? (
                  <img src={profile.avatarPath} alt="Photo de profil" width={36} height={36} />
                ) : (
                  <span className={styles.avatarInitials}>{initials}</span>
                )}
              </div>
              <svg className={styles.avatarChevron} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {avatarMenuOpen && (
              <div className={styles.avatarDropdown}>
                <div className={styles.avatarDropdownHeader}>
                  <span className={styles.avatarDropdownTitle}>Paramètres</span>
                </div>
                <div className={styles.avatarDropdownProfile}>
                  <div className={styles.avatarDropdownPhoto}>
                    {profile?.avatarPath ? (
                      <img src={profile.avatarPath} alt="" />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div className={styles.avatarDropdownInfo}>
                    <span className={styles.avatarDropdownName}>{profile?.prenom} {profile?.nom}</span>
                    {profile?.sport && <span className={styles.avatarDropdownSport}>{profile.sport}</span>}
                    {profileSummaryParts.length > 0 && (
                      <span className={styles.avatarDropdownStats}>{profileSummaryParts.join(" · ")}</span>
                    )}
                  </div>
                </div>
                <div className={styles.avatarDropdownDivider} />
                <button className={styles.avatarDropdownItem} onClick={() => { setAvatarMenuOpen(false); router.push("/dashboard/athlete/profil"); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  <span>Mon profil</span>
                  <svg className={styles.avatarDropdownChevron} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
                <div className={styles.avatarDropdownItemRow} onClick={toggleNotifications}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                  <span>Notifications</span>
                  <div className={`${styles.toggleSwitch} ${notifEnabled ? styles.toggleOn : ""}`}>
                    <div className={styles.toggleKnob} />
                  </div>
                </div>
                <button className={styles.avatarDropdownItem} onClick={() => { setAvatarMenuOpen(false); router.push("/dashboard/athlete/confidentialite"); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 7h.01" /><path d="M7 12h.01" /><path d="M7 17h.01" /><path d="M11 7h6" /><path d="M11 12h6" /><path d="M11 17h6" /></svg>
                  <span>Confidentialité</span>
                  <svg className={styles.avatarDropdownChevron} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
                <button className={styles.avatarDropdownItem} onClick={() => { setAvatarMenuOpen(false); router.push("/dashboard/athlete/mes-recus"); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                  <span>Documents</span>
                  <svg className={styles.avatarDropdownChevron} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
                <button className={styles.avatarDropdownItem} onClick={() => { setAvatarMenuOpen(false); router.push("/dashboard/athlete/aide"); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <span>Aide et support</span>
                  <svg className={styles.avatarDropdownChevron} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
                <div className={styles.avatarDropdownDivider} />
                <button className={`${styles.avatarDropdownItem} ${styles.avatarDropdownLogout}`} onClick={() => { setAvatarMenuOpen(false); handleLogout(); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  <span>Déconnexion</span>
                </button>
                <div className={styles.avatarDropdownVersion}>Version 1.0.2</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Mes Professionnels</h1>
          <p className={styles.pageSubtitle}>Gérez vos connexions avec vos professionnels de santé</p>
        </div>

        <div className={styles.searchSection}>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Rechercher par email, téléphone ou nom..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-expanded={hasSearched && results.length > 0}
              aria-activedescendant={activeIndex >= 0 ? `result-${results[activeIndex]?.id}` : undefined}
              aria-autocomplete="list"
            />
            {searching && (
              <div className={styles.searchSpinner}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {hasSearched && results.length > 0 && (
          <div className={styles.resultsList} ref={resultsRef} role="listbox">
            {results.map((pro, idx) => {
              const proInitials = `${pro.prenom[0]}${pro.nom[0]}`.toUpperCase();
              const sc = getSpecConfig(pro.specialite);
              return (
                <div
                  key={pro.id}
                  id={`result-${pro.id}`}
                  className={`${styles.resultCard} ${idx === activeIndex ? styles.resultCardActive : ""}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <div className={styles.resultAvatar}>
                    {pro.avatarUrl ? (
                      <img src={pro.avatarUrl} alt="" width={44} height={44} />
                    ) : (
                      <span>{proInitials}</span>
                    )}
                  </div>
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{highlightMatch(`${pro.prenom} ${pro.nom}`, search)}</span>
                    <span className={styles.resultSpecialite} style={{ color: sc.color, background: `${sc.color}18` }}>
                      {sc.label}
                    </span>
                    {pro.adresseCabinet && (
                      <span className={styles.resultAddress}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        {highlightMatch(pro.adresseCabinet, search)}
                      </span>
                    )}
                  </div>
                  {connectedIds.has(pro.id) ? (
                    <span className={styles.statusBadge} data-status="accepted">Connecté</span>
                  ) : pendingIds.has(pro.id) ? (
                    <span className={styles.statusBadge} data-status="pending">En attente</span>
                  ) : (
                    <button
                      className={styles.connectBtn}
                      disabled={connectingId === pro.id}
                      onClick={() => handleConnect(pro.id)}
                    >
                      {connectingId === pro.id ? "Envoi..." : "Se connecter"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasSearched && results.length === 0 && !searching && (
          <div className={styles.noResults}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="8" x2="14" y2="14" /><line x1="14" y1="8" x2="8" y2="14" />
            </svg>
            <p>Aucun professionnel trouvé pour &laquo;&nbsp;{search}&nbsp;&raquo;</p>
            <span>Vérifiez l&apos;orthographe ou essayez un autre critère</span>
          </div>
        )}

        {!hasSearched && myConnections.filter((c) => c.status === "accepted").length > 0 && (
          <div className={styles.myProsSection}>
            <h2 className={styles.myProsTitle}>Mes professionnels connectés</h2>
            <div className={styles.myProsGrid}>
              {myConnections.filter((c) => c.status === "accepted").map((c) => {
                const pro = c.professionnel;
                const proInitials = `${pro.prenom[0]}${pro.nom[0]}`.toUpperCase();
                const sc = getSpecConfig(pro.specialite);
                return (
                  <div key={c.id} className={styles.proCard} onClick={() => router.push(`/dashboard/athlete/pro/${pro.id}`)}>
                    <div className={styles.proCardPhoto}>
                      {pro.avatarUrl ? (
                        <img src={pro.avatarUrl} alt={`${pro.prenom} ${pro.nom}`} />
                      ) : (
                        <span className={styles.proCardInitials}>{proInitials}</span>
                      )}
                      <div className={styles.proCardOverlay}>
                        <span className={styles.proCardName}>{pro.prenom} {pro.nom}</span>
                        <span className={styles.proCardSpecialite} style={{ color: sc.color }}>
                          {sc.label}
                        </span>
                        {pro.adresseCabinet && (
                          <span className={styles.proCardCity}>{pro.adresseCabinet}</span>
                        )}
                        <div className={styles.proCardActions}>
                          <button className={styles.proCardAction} title="Message" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/athlete/messagerie?proId=${pro.id}`) }}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                          </button>
                          {sc.hasVisio && (
                            <button className={styles.proCardAction} title="Visio" onClick={(e) => { e.stopPropagation(); startVisioWithPro(pro.id) }}>
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                            </button>
                          )}
                          {sc.hasRdv && (
                            <button className={styles.proCardAction} title={sc.rdvLabel} onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/athlete/mes-rdv?action=quick-book&proId=${pro.id}`) }}>
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            </button>
                          )}
                          {sc.hasSeances && (
                            <button className={styles.proCardAction} title="Mes Séances" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/athlete/pro/${pro.id}`) }}>
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!hasSearched && myConnections.filter((c) => c.status === "pending").length > 0 && (
          <div className={styles.myProsSection}>
            <h2 className={styles.myProsTitle}>Demandes en attente</h2>
            <div className={styles.myProsList}>
              {myConnections.filter((c) => c.status === "pending").map((c) => {
                const pro = c.professionnel;
                const proInitials = `${pro.prenom[0]}${pro.nom[0]}`.toUpperCase();
                const sc = getSpecConfig(pro.specialite);
                return (
                  <div key={c.id} className={styles.myProCard}>
                    <div className={styles.resultAvatar}>
                      {pro.avatarUrl ? (
                        <img src={pro.avatarUrl} alt="" width={44} height={44} />
                      ) : (
                        <span>{proInitials}</span>
                      )}
                    </div>
                    <div className={styles.resultInfo}>
                      <span className={styles.resultName}>{pro.prenom} {pro.nom}</span>
                      <span className={styles.resultSpecialite} style={{ color: sc.color, background: `${sc.color}18` }}>
                        {sc.label}
                      </span>
                    </div>
                    <span className={styles.statusBadge} data-status="pending">En attente</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Rendez-vous Section ─── */}
        {!hasSearched && (
          <div className={styles.rdvSection}>
            <div className={styles.rdvSectionHeader}>
              <h2 className={styles.rdvSectionTitle}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Mes Rendez-vous
              </h2>
            </div>

            {/* Prochain RDV */}
            {rdvLoading ? (
              <div className={styles.rdvLoading}>Chargement…</div>
            ) : nextRdv ? (
              <div className={styles.rdvNextCard}>
                <div className={styles.rdvNextBadge}>Prochain rendez-vous</div>
                <div className={styles.rdvNextContent}>
                  <div className={styles.rdvNextDate}>
                    <span className={styles.rdvNextDay}>{new Date(nextRdv.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
                    <span className={styles.rdvNextTime}>{new Date(nextRdv.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}{nextRdv.endDate ? ` – ${new Date(nextRdv.endDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
                  </div>
                  <div className={styles.rdvNextInfo}>
                    <span className={styles.rdvNextTitle}>{nextRdv.title}</span>
                    <span className={styles.rdvNextPro}>{nextRdv.pro.prenom} {nextRdv.pro.nom} · {nextRdv.pro.specialite}</span>
                    {nextRdv.description && <span className={styles.rdvNextDesc}>{nextRdv.description}</span>}
                  </div>
                </div>
                <button className={styles.payBtn} onClick={() => setPaymentRdv(nextRdv)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                  Régler la consultation
                </button>
              </div>
            ) : (
              <div className={styles.rdvEmpty}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                <span>Aucun rendez-vous à venir</span>
              </div>
            )}

            {/* Quick action buttons */}
            <div className={styles.rdvActions}>
              <button className={styles.rdvActionBtn} onClick={() => router.push("/dashboard/athlete/mes-rdv?action=book")}>
                <div className={styles.rdvActionIcon} style={{ background: "rgba(230, 126, 34, 0.12)", color: "#e67e22" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" /></svg>
                </div>
                <span className={styles.rdvActionLabel}>Réserver</span>
                <span className={styles.rdvActionSub}>Prendre un rendez-vous</span>
              </button>

              <button className={styles.rdvActionBtn} onClick={() => router.push(`/dashboard/athlete/mes-rdv?action=quick-book${nextRdv ? `&proId=${nextRdv.pro.id}` : ""}`)}>
                <div className={styles.rdvActionIcon} style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                </div>
                <span className={styles.rdvActionLabel}>RDV rapide IA</span>
                <span className={styles.rdvActionSub}>{nextRdv ? `Avec ${nextRdv.pro.prenom} ${nextRdv.pro.nom}` : "Réservation assistée par IA"}</span>
              </button>

              <button className={styles.rdvActionBtn} onClick={() => router.push("/dashboard/athlete/mes-rdv?tab=upcoming")}>
                <div className={styles.rdvActionIcon} style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                </div>
                <span className={styles.rdvActionLabel}>Mes rendez-vous</span>
                <span className={styles.rdvActionSub}>{upcomingRdvs.length > 0 ? `${upcomingRdvs.length} à venir` : "Historique & à venir"}</span>
              </button>

              <button className={styles.rdvActionBtn} onClick={() => router.push("/dashboard/athlete/mes-rdv?action=resume")}>
                <div className={styles.rdvActionIcon} style={{ background: "rgba(168, 85, 247, 0.12)", color: "#a855f7" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                </div>
                <span className={styles.rdvActionLabel}>Reprendre</span>
                <span className={styles.rdvActionSub}>Un RDV déjà commencé</span>
              </button>
            </div>

            {/* Upcoming list (if more than 1) */}
            {upcomingRdvs.length > 1 && (
              <div className={styles.rdvUpcomingList}>
                <div className={styles.rdvUpcomingTitle}>À venir</div>
                {upcomingRdvs.slice(1, 4).map((rdv) => (
                  <div key={rdv.id} className={styles.rdvUpcomingItem}>
                    <div className={styles.rdvUpcomingDot} />
                    <div className={styles.rdvUpcomingInfo}>
                      <span className={styles.rdvUpcomingDate}>
                        {new Date(rdv.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                        {" à "}
                        {new Date(rdv.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={styles.rdvUpcomingName}>{rdv.title} — {rdv.pro.prenom} {rdv.pro.nom}</span>
                    </div>
                    <button className={styles.payBtnSmall} onClick={() => setPaymentRdv(rdv)}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                      Payer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!hasSearched && myConnections.length === 0 && <div className={styles.onboarding}>
          <div className={styles.onboardingCard}>
            <div className={styles.onboardingIllustration}>
              <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <h2 className={styles.onboardingTitle}>Trouvez votre professionnel de santé</h2>
            <p className={styles.onboardingDesc}>
              Recherchez votre kiné, coach, médecin ou nutritionniste pour vous connecter et commencer votre suivi personnalisé.
            </p>

            <div className={styles.onboardingHints}>
              <div className={styles.hint}>
                <div className={styles.hintIcon}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                </div>
                <div>
                  <span className={styles.hintLabel}>Par email</span>
                  <span className={styles.hintExample}>ex: dr.dupont@gmail.com</span>
                </div>
              </div>
              <div className={styles.hint}>
                <div className={styles.hintIcon}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                </div>
                <div>
                  <span className={styles.hintLabel}>Par téléphone</span>
                  <span className={styles.hintExample}>ex: 06 12 34 56 78</span>
                </div>
              </div>
              <div className={styles.hint}>
                <div className={styles.hintIcon}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </div>
                <div>
                  <span className={styles.hintLabel}>Par nom / prénom</span>
                  <span className={styles.hintExample}>ex: Martin Dupont</span>
                </div>
              </div>
            </div>
          </div>
        </div>}
      </main>

      {/* ─── Footer ─── */}
      <LegalFooter />

      {/* ─── Payment Modal ─── */}
      {paymentRdv && (
        <div className={styles.payOverlay} onClick={() => setPaymentRdv(null)}>
          <div className={styles.payModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.payModalClose} onClick={() => setPaymentRdv(null)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>

            <div className={styles.payModalIcon}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
            </div>

            <h3 className={styles.payModalTitle}>Régler la consultation</h3>
            <p className={styles.payModalSub}>
              {paymentRdv.title} — {paymentRdv.pro.prenom} {paymentRdv.pro.nom}
            </p>

            <div className={styles.payModalDetails}>
              <div className={styles.payModalRow}>
                <span className={styles.payModalLabel}>Date</span>
                <span className={styles.payModalValue}>
                  {new Date(paymentRdv.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div className={styles.payModalRow}>
                <span className={styles.payModalLabel}>Heure</span>
                <span className={styles.payModalValue}>
                  {new Date(paymentRdv.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  {paymentRdv.endDate ? ` – ${new Date(paymentRdv.endDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
              </div>
              <div className={styles.payModalRow}>
                <span className={styles.payModalLabel}>Praticien</span>
                <span className={styles.payModalValue}>{paymentRdv.pro.prenom} {paymentRdv.pro.nom} · {paymentRdv.pro.specialite}</span>
              </div>
              <div className={`${styles.payModalRow} ${styles.payModalRowTotal}`}>
                <span className={styles.payModalLabel}>Montant</span>
                <span className={styles.payModalAmount}>—</span>
              </div>
            </div>

            <p className={styles.payModalNotice}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              Le paiement sécurisé sera bientôt disponible. Vous serez notifié dès son activation.
            </p>

            <button className={styles.payModalSubmit} disabled>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Paiement sécurisé — Bientôt disponible
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className={styles.bottomNav}>
        <button className={`${styles.bottomNavBtn} ${styles.bottomNavBtnActive}`} onClick={() => router.push("/dashboard/athlete")}>
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
        {/* TODO: HEALTH_INTEGRATIONS — Réactiver quand les APIs seront prêtes
        <button className={styles.bottomNavBtn} onClick={() => router.push("/dashboard/athlete/sante")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          <span>Santé</span>
        </button>
        */}
      </nav>
    </div>
  );
}
