"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./layout.module.scss";
import ScreenShieldWrapper from "@/components/ScreenShieldWrapper";
import { useSSE } from "@/hooks/useSSE";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { offlineFetch } from "@/lib/offlineFetch";
import IncomingCallModal from "@/components/IncomingCallModal";

const navItems = [
  { label: "Tableau de Bord", href: "/dashboard/nutri", icon: "grid" },
  { label: "Plans Alimentaires", href: "/dashboard/nutri/programmes", icon: "clipboard" },
  { label: "Bilans Nutritionnels", href: "/dashboard/nutri/indicateurs", icon: "trending" },
  { label: "Réseau Professionnel", href: "/dashboard/nutri/reseau", icon: "network" },
  { label: "Messagerie", href: "/dashboard/nutri/messagerie", icon: "message" },
  { label: "Documents", href: "/dashboard/nutri/documents", icon: "file" },
  { label: "Cabinet / Équipe", href: "/dashboard/nutri/cabinet", icon: "building" },
  { label: "Facturation et Paiements", href: "/dashboard/nutri/facturation", icon: "wallet" },
];

const icons: Record<string, React.ReactNode> = {
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6" /><path d="M9 16h6" />
    </svg>
  ),
  trending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" />
      <path d="M12 8v4" /><path d="M8.5 16.5L12 12" /><path d="M15.5 16.5L12 12" />
    </svg>
  ),
  message: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <path d="M1 10h22" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" />
      <path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" />
      <path d="M8 10h.01" /><path d="M8 14h.01" />
    </svg>
  ),
};

function getBreadcrumb(pathname: string): { label: string; href: string | null }[] {
  const crumbs: { label: string; href: string | null }[] = [
    { label: "Dashboard", href: "/dashboard/nutri" },
  ];
  const item = navItems.find((n) => n.href === pathname);
  if (item && item.href !== "/dashboard/nutri") {
    crumbs.push({ label: item.label, href: null });
  } else if (pathname.startsWith("/dashboard/nutri/programmes/")) {
    crumbs.push({ label: "Plans Alimentaires", href: "/dashboard/nutri/programmes" });
    crumbs.push({ label: "Détail plan", href: null });
  }
  return crumbs;
}

export default function NutriDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const breadcrumbs = getBreadcrumb(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  usePushSubscription();

  // Close sidebar by default on mobile & on route change
  useEffect(() => {
    if (window.innerWidth <= 768) setSidebarOpen(false);
  }, []);
  useEffect(() => {
    if (window.innerWidth <= 768) setSidebarOpen(false);
  }, [pathname]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<"all" | "priority" | "action">("all");
  const [notifications, setNotifications] = useState<{ id: string; title: string; subtitle?: string; date: string; type: string; color: string; athlete: { name: string } | null; source?: string; meta?: any }[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; nom: string; prenom: string; sport: string | null; avatarUrl: string | null; connectionStatus: string | null }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [user, setUser] = useState<{
    prenom: string;
    nom: string;
    email: string;
    specialite: string;
    avatarPath: string | null;
  } | null>(null);

  const specialiteLabels: Record<string, string> = {
    kine: "Kinésithérapeute",
    medecin: "Médecin",
    coach: "Coach sportif",
    nutri: "Nutritionniste",
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.prenom) setUser(data);
      })
      .catch(() => {});
  }, []);

  // Real-time notifications via SSE (replaces polling)
  useSSE<any[]>({
    url: "/api/notifications/stream",
    onMessage: (data) => { if (Array.isArray(data)) setNotifications(data); },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const res = await fetch(`/api/pro/search-athletes?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSearchResults(data.results || []);
        setSearchOpen(true);
      } catch (err: any) {
        if (err?.name !== "AbortError") setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  const markAsRead = (eventId: string) => {
    setReadIds((prev) => new Set(prev).add(eventId));
  };

  const deleteNotif = async (eventId: string, source?: string) => {
    await offlineFetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, source }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== eventId));
    setReadIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
  };

  const respondInvite = async (inviteId: string, accept: boolean) => {
    try {
      await fetch(`/api/invitation/${inviteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== inviteId));
    } catch { /* ignore */ }
  };

  const respondConnection = async (notifId: string, requestId: string, accept: boolean) => {
    try {
      await fetch(`/api/connection-request/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch { /* ignore */ }
  };

  const blockAthlete = async (notifId: string, requestId: string) => {
    try {
      await fetch(`/api/connection-request/${requestId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch { /* ignore */ }
  };

  const connectAthlete = async (athleteUserId: string) => {
    try {
      const res = await fetch("/api/pro/connect-athlete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteUserId }),
      });
      const data = await res.json();
      if (res.ok || res.status === 409) {
        setSearchResults((prev) => prev.map((a) => a.id === athleteUserId ? { ...a, connectionStatus: data.status || "pending" } : a));
      }
    } catch { /* ignore */ }
  };

  const formatNotifTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < -60) return date.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    if (diffMin < 0) return `Il y a ${Math.abs(diffMin)} min`;
    if (diffMin === 0) return "Maintenant";
    if (diffMin < 60) return `Dans ${diffMin} min`;
    return `Dans ${Math.round(diffMin / 60)}h`;
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const displayName = user ? `${user.prenom} ${user.nom}` : "...";
  const initials = user ? `${user.prenom[0]}${user.nom[0]}` : "";

  return (
    <div className={styles.layout}>
      <IncomingCallModal />
      {/* <ScreenShieldWrapper /> */}
      {/* Mobile overlay */}
      {sidebarOpen && <div className={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${!sidebarOpen ? styles.sidebarCollapsed : ""}`}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.logo}>
            <img src="/TuathaPro.png" alt="TuathaPro" className={styles.logoImg} />
          </Link>
          <button
            className={styles.toggleBtn}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {sidebarOpen ? (
                <><path d="M11 17l-5-5 5-5" /><path d="M18 17l-5-5 5-5" /></>
              ) : (
                <><path d="M13 7l5 5-5 5" /><path d="M6 7l5 5-5 5" /></>
              )}
            </svg>
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                title={item.label}
              >
                <span className={styles.navIcon}>{icons[item.icon]}</span>
                {sidebarOpen && <span className={styles.navLabel}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.legalRow}>
            <Link href="/cgu" target="_blank">CGU</Link>
            <Link href="/cgv" target="_blank">CGV</Link>
            <Link href="/confidentialite" target="_blank">Confidentialité</Link>
            <Link href="/cookies" target="_blank">Cookies</Link>
            <Link href="/charte-partage" target="_blank">Charte Partage</Link>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Se déconnecter">
            <span className={styles.navIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            {sidebarOpen && <span className={styles.navLabel}>Se déconnecter</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`${styles.main} ${!sidebarOpen ? styles.mainExpanded : ""}`}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <button className={styles.hamburger} onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className={styles.topbarSearch} ref={searchRef}>
            <div className={styles.topbarSearchInputWrap}>
              <svg className={styles.topbarSearchIcon} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                ref={searchInputRef}
                className={styles.topbarSearchInput}
                type="text"
                placeholder="Rechercher un athlète…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
              />
              {searchLoading && <span className={styles.topbarSearchSpinner} />}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div className={styles.topbarSearchDropdown}>
                {searchResults.map((a) => {
                  const initials = `${a.prenom[0]}${a.nom[0]}`.toUpperCase();
                  return (
                    <div key={a.id} className={styles.topbarSearchItem} onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                      <div className={styles.topbarSearchAvatar}>
                        {a.avatarUrl ? <img src={a.avatarUrl} alt="" width={32} height={32} /> : <span>{initials}</span>}
                      </div>
                      <div className={styles.topbarSearchInfo}>
                        <span className={styles.topbarSearchName}>{a.prenom} {a.nom}</span>
                        {a.sport && <span className={styles.topbarSearchSport}>{a.sport}</span>}
                      </div>
                      {a.connectionStatus === "accepted" && <span className={styles.topbarSearchBadge} data-status="accepted">Connecté</span>}
                      {a.connectionStatus === "pending" && <span className={styles.topbarSearchBadge} data-status="pending">En attente</span>}
                      {!a.connectionStatus && <button className={styles.topbarSearchConnect} onClick={(e) => { e.stopPropagation(); connectAthlete(a.id); }}>Suivre</button>}
                    </div>
                  );
                })}
              </div>
            )}
            {searchOpen && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
              <div className={styles.topbarSearchDropdown}>
                <div className={styles.topbarSearchEmpty}>Aucun athlète trouvé</div>
              </div>
            )}
          </div>

          <div className={styles.topbarRight}>
            <div className={styles.notifWrapper} ref={notifRef}>
              <button className={styles.notifBtn} aria-label="Notifications" onClick={() => setNotifOpen(!notifOpen)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notifications.filter(n => !readIds.has(n.id)).length > 0 && <span className={styles.notifBadge}>{notifications.filter(n => !readIds.has(n.id)).length}</span>}
              </button>

              {notifOpen && (() => {
                const getNotifLevel = (n: typeof notifications[0]) => {
                  if (n.color === "red" || n.type === "urgent") return "urgent";
                  if (n.color === "orange" || n.color === "purple" || n.source === "invite" || n.source === "message" || n.source === "athlete_message" || n.source === "connection") return "action";
                  return "info";
                };
                const levelWeight = { urgent: 0, action: 1, info: 2 };
                const sortedNotifs = [...notifications].sort((a, b) => {
                  const wa = levelWeight[getNotifLevel(a)];
                  const wb = levelWeight[getNotifLevel(b)];
                  if (wa !== wb) return wa - wb;
                  return new Date(b.date).getTime() - new Date(a.date).getTime();
                });
                const filteredNotifs = sortedNotifs.filter((n) => {
                  if (notifFilter === "all") return true;
                  if (notifFilter === "priority") return getNotifLevel(n) === "urgent";
                  if (notifFilter === "action") return getNotifLevel(n) === "urgent" || getNotifLevel(n) === "action";
                  return true;
                });
                const levelIcons = {
                  urgent: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
                  action: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
                };

                return (
                <div className={styles.notifDropdown}>
                  <div className={styles.notifDropdownHeader}>
                    <span className={styles.notifHeaderTitle}>Centre</span>
                    <div className={styles.notifHeaderActions}>
                      {notifications.filter(n => !readIds.has(n.id)).length > 0 && (
                        <button className={styles.notifMarkAllBtn} onClick={() => { setReadIds(new Set(notifications.map(n => n.id))); }} title="Tout marquer lu">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 5.5 5 9.5 15 1.5"/><polyline points="1 12.5 5 16.5 15 8.5"/></svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.notifFilters}>
                    <button className={`${styles.notifFilterChip} ${notifFilter === "all" ? styles.notifFilterActive : ""}`} onClick={() => setNotifFilter("all")}>
                      Tout {notifications.length > 0 && <span className={styles.notifFilterCount}>{notifications.length}</span>}
                    </button>
                    <button className={`${styles.notifFilterChip} ${styles.notifFilterUrgent} ${notifFilter === "priority" ? styles.notifFilterActive : ""}`} onClick={() => setNotifFilter("priority")}>
                      Priorité {notifications.filter(n => getNotifLevel(n) === "urgent").length > 0 && <span className={styles.notifFilterCount}>{notifications.filter(n => getNotifLevel(n) === "urgent").length}</span>}
                    </button>
                    <button className={`${styles.notifFilterChip} ${styles.notifFilterAction} ${notifFilter === "action" ? styles.notifFilterActive : ""}`} onClick={() => setNotifFilter("action")}>
                      À faire
                    </button>
                  </div>

                  {filteredNotifs.length === 0 ? (
                    <div className={styles.notifEmpty}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      <span>Aucune notification</span>
                    </div>
                  ) : (
                    <div className={styles.notifList}>
                      {filteredNotifs.slice(0, 8).map((n) => {
                        const level = getNotifLevel(n);
                        return (
                          <div key={n.id} className={`${styles.notifItem} ${styles[`notifItem_${level}`]} ${readIds.has(n.id) ? styles.notifItemRead : ""}`} onClick={() => {
                            markAsRead(n.id);
                            if (n.source === "message" || n.source === "athlete_message") { setNotifOpen(false); router.push("/dashboard/nutri/messagerie"); }
                            else if (n.athlete) { setNotifOpen(false); }
                          }}>
                            <div className={styles.notifItemIcon}>{levelIcons[level]}</div>
                            <div className={styles.notifItemContent}>
                              <span className={styles.notifItemTitle}>{n.title}</span>
                              <span className={styles.notifItemMeta}>
                                {n.athlete ? n.athlete.name : "Système"} • {formatNotifTime(n.date)}
                                {n.meta?.role && n.source === "invite" && ` • ${n.meta.role}`}
                              </span>
                            </div>
                            <div className={styles.notifItemAction}>
                              {n.source === "invite" ? (
                                <div className={styles.notifInviteActions}>
                                  <button className={styles.notifAcceptBtn} onClick={(e) => { e.stopPropagation(); respondInvite(n.id, true); }}>Accepter</button>
                                  <button className={styles.notifDeclineBtn} onClick={(e) => { e.stopPropagation(); respondInvite(n.id, false); }}>Décliner</button>
                                </div>
                              ) : n.source === "connection" ? (
                                <div className={styles.notifInviteActions}>
                                  <button className={styles.notifAcceptBtn} onClick={(e) => { e.stopPropagation(); respondConnection(n.id, n.meta?.requestId, true); }}>Accepter</button>
                                  <button className={styles.notifDeclineBtn} onClick={(e) => { e.stopPropagation(); respondConnection(n.id, n.meta?.requestId, false); }}>Refuser</button>
                                  <button className={styles.notifBlockBtn} onClick={(e) => { e.stopPropagation(); blockAthlete(n.id, n.meta?.requestId); }} title="Bloquer cet athlète">Bloquer</button>
                                </div>
                              ) : level === "urgent" ? (
                                <button className={`${styles.notifActionBtn} ${styles.notifActionUrgent}`} onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}>Traiter</button>
                              ) : level === "action" ? (
                                <button className={`${styles.notifActionBtn} ${styles.notifActionOrange}`} onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}>Faire</button>
                              ) : (
                                <button className={`${styles.notifActionBtn} ${styles.notifActionGray}`} onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}>Voir</button>
                              )}
                              <button className={styles.notifDeleteBtn} onClick={(e) => { e.stopPropagation(); deleteNotif(n.id, n.source); }} title="Supprimer">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
                );
              })()}
            </div>

            <div className={styles.userInfo} ref={dropdownRef}>
              <button
                className={styles.userBtn}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className={styles.userNameBlock}>
                  <span className={styles.userName}>{displayName}</span>
                  {user && <span className={styles.userRole}>{specialiteLabels[user.specialite] || user.specialite}</span>}
                </div>
                <div className={styles.avatar}>
                  {user?.avatarPath ? (
                    <img src={user.avatarPath} alt="Photo de profil" width={36} height={36} />
                  ) : (
                    <span className={styles.avatarInitials}>{initials}</span>
                  )}
                </div>
                <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className={styles.dropdown}>
                  {user && (
                    <div className={styles.dropdownHeader}>
                      <p className={styles.dropdownName}>{user.prenom} {user.nom}</p>
                      <p className={styles.dropdownEmail}>{user.email}</p>
                    </div>
                  )}
                  <div className={styles.dropdownDivider} />
                  <Link href="/dashboard/nutri/profil" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Mon profil
                  </Link>
                  <button className={styles.dropdownItem} onClick={handleLogout}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}
