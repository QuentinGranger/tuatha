"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "../page.module.scss";

type ActiveTab = "mes-pros" | "mes-rdv" | "ma-journee";

interface AthleteHeaderProps {
  activeTab: ActiveTab;
}

interface Profile {
  id: string;
  prenom: string;
  nom: string;
  avatarPath?: string | null;
  sport?: string | null;
  taille?: number | null;
  poids?: number | null;
  dateNaissance?: string | null;
}

type Notification = {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
  type: string;
  color: string;
  source: string;
  meta?: any;
};

export function AthleteHeader({ activeTab }: AthleteHeaderProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("tuatha_notif_enabled");
    return stored !== null ? stored === "true" : true;
  });
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const notifPausedRef = useRef(false);

  // Fetch profile
  useEffect(() => {
    fetch("/api/athlete/profil")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data?.profile) setProfile(data.profile);
        else if (data?.prenom) setProfile(data);
      })
      .catch(() => {});
  }, []);

  // Fetch & poll notifications
  const fetchNotifications = useCallback(async () => {
    if (notifPausedRef.current) return;
    try {
      let res = await fetch("/api/athlete/notifications");
      if (res.status === 401) {
        const refresh = await fetch("/api/auth/refresh", { method: "POST" });
        if (refresh.ok) {
          res = await fetch("/api/athlete/notifications");
        } else {
          notifPausedRef.current = true;
          return;
        }
      }
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d)) setNotifications(d);
      }
    } catch { /* silent */ }
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

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) setAvatarMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Actions
  const respondConnection = async (notifId: string, requestId: string, accept: boolean) => {
    try {
      await fetch(`/api/athlete/connection-request/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch { /* ignore */ }
  };

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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
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

  const computeAge = (dob: string | null) => {
    if (!dob) return null;
    const d = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age;
  };

  const initials = profile ? `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase() : "";
  const profileSummaryParts: string[] = [];
  if (profile?.taille) profileSummaryParts.push(`${profile.taille} cm`);
  const age = computeAge(profile?.dateNaissance ?? null);
  if (age) profileSummaryParts.push(`${age} ans`);
  if (profile?.poids) profileSummaryParts.push(`${profile.poids} kg`);

  return (
    <header className={styles.header}>
      <div className={styles.logoWrap}>
        <img src="/LogoTuatha.png" alt="Tuatha" className={styles.logoImg} />
      </div>
      <nav className={styles.headerNav}>
        <button className={`${styles.navBtn} ${activeTab === "mes-pros" ? styles.navBtnActive : ""}`} onClick={() => router.push("/dashboard/athlete")}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <span>Mes Pros</span>
        </button>
        <button className={`${styles.navBtn} ${activeTab === "mes-rdv" ? styles.navBtnActive : ""}`} onClick={() => router.push("/dashboard/athlete/mes-rdv")}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <span>Mes RDV</span>
        </button>
        <button className={`${styles.navBtn} ${activeTab === "ma-journee" ? styles.navBtnActive : ""}`} onClick={() => router.push("/dashboard/athlete/ma-journee")}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span>Ma Journée</span>
        </button>
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
  );
}
