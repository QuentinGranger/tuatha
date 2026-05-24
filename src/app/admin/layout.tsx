"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import "./admin-responsive.css";

const NAV_SECTIONS = [
  { label: "Command Center", href: "/admin", icon: "command" },
  { label: "Athlètes", href: "/admin/athletes", icon: "users" },
  { label: "Professionnels", href: "/admin/pros", icon: "briefcase" },
  { label: "Tickets Support", href: "/admin/tickets", icon: "ticket" },
  { label: "Consentements", href: "/admin/consents", icon: "shield" },
  { label: "Documents", href: "/admin/documents", icon: "file" },
  { label: "Sécurité", href: "/admin/security", icon: "lock" },
  { label: "Incidents", href: "/admin/incidents", icon: "alert" },
  { label: "Paiements", href: "/admin/payments", icon: "wallet" },
  { label: "Analytics", href: "/admin/analytics", icon: "chart" },
  { label: "Conformité", href: "/admin/compliance", icon: "check" },
  { label: "Notifications", href: "/admin/notifications", icon: "bell", badge: 5 },
  { label: "Paramètres", href: "/admin/settings", icon: "settings" },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  command: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  briefcase: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  ticket: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  terminal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K shortcut to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside className="admin-sidebar" style={{
        width: "220px", background: "#0f1b2d", display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ padding: "1.25rem 1.25rem 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src="/LogoTuathaAdmin.png" alt="Tuatha Admin" style={{ height: "36px", objectFit: "contain" }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 0.6rem", overflowY: "auto" }}>
          {NAV_SECTIONS.map((item) => {
            const active = isActive(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => { e.preventDefault(); router.push(item.href); }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.5rem 0.7rem", borderRadius: "8px", marginBottom: "2px",
                  fontSize: "0.8rem", fontWeight: active ? 600 : 400,
                  color: active ? "#fff" : "#94a3b8",
                  background: active ? "#2563eb" : "transparent",
                  textDecoration: "none", transition: "all 0.15s", position: "relative",
                }}
              >
                <span style={{ width: "18px", height: "18px", minWidth: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ICONS[item.icon]}
                </span>
                <span className="nav-label">{item.label}</span>
                {"badge" in item && (item as any).badge > 0 && (
                  <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", fontSize: "0.65rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 6px", minWidth: "18px", textAlign: "center" }}>
                    {(item as any).badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Footer status */}
        <div style={{ padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.7rem", background: "rgba(34,197,94,0.08)", borderRadius: "8px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div className="sidebar-footer-text">
              <div style={{ color: "#22c55e", fontSize: "0.72rem", fontWeight: 600 }}>Plateforme saine</div>
              <div style={{ color: "#64748b", fontSize: "0.65rem" }}>Tous les systèmes opérationnels</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="admin-main" style={{ flex: 1, marginLeft: "220px", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <header style={{
          height: "56px", background: "#fff", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", padding: "0 1.5rem", gap: "1rem",
          position: "sticky", top: 0, zIndex: 40,
        }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1e293b", margin: 0 }}>Command Center</h2>
          {/* Search */}
          <div style={{ flex: 1, maxWidth: "400px", marginLeft: "1rem" }}>
            <div
              onClick={() => setSearchOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#f1f5f9", borderRadius: "8px", padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Rechercher...</span>
              <span style={{ marginLeft: "auto", background: "#e2e8f0", borderRadius: "4px", padding: "1px 6px", fontSize: "0.7rem", color: "#64748b" }}>⌘ K</span>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Notifications bell */}
            <div onClick={() => router.push("/admin/notifications")} style={{ position: "relative", cursor: "pointer" }} title="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span style={{ position: "absolute", top: "-2px", right: "-4px", background: "#2563eb", color: "#fff", fontSize: "0.6rem", fontWeight: 700, borderRadius: "9999px", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>6</span>
            </div>
            {/* User avatar with dropdown */}
            <UserDropdown onLogout={handleLogout} />
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "1.5rem", overflow: "auto" }}>
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} router={router} />
    </div>
  );
}

// Dropdown component for user menu
function UserDropdown({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <div 
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }} 
        onClick={() => setOpen(!open)}
      >
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.75rem", fontWeight: 700 }}>Q</div>
        <div>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e293b" }}>Quentin</div>
          <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Admin</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ marginLeft: "0.25rem" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 0.5rem)",
          right: 0,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          minWidth: "160px",
          zIndex: 100,
          overflow: "hidden",
        }}>
          <div style={{ padding: "0.5rem 0" }}>
            <div 
              style={{ 
                padding: "0.5rem 0.75rem", 
                fontSize: "0.8rem", 
                color: "#1e293b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              onClick={() => { setOpen(false); window.location.href = '/admin/settings'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Profil
            </div>
            <div 
              style={{ 
                padding: "0.5rem 0.75rem", 
                fontSize: "0.8rem", 
                color: "#1e293b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              onClick={() => { setOpen(false); window.location.href = '/admin/settings'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Paramètres
            </div>
            <div style={{ borderTop: "1px solid #e2e8f0", margin: "0.25rem 0" }} />
            <div 
              style={{ 
                padding: "0.5rem 0.75rem", 
                fontSize: "0.8rem", 
                color: "#ef4444",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              onClick={() => { setOpen(false); onLogout(); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Déconnexion
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SVG icons for command palette
const PAL_ICONS: Record<string, React.ReactNode> = {
  home:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  users:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  briefcase:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  ticket:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>,
  shield:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  file:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  lock:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  alert:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  wallet:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  chart:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>,
  bell:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  settings: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  logout:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

// Command Palette (⌘K search)
const SEARCH_ITEMS = [
  { label: "Command Center", href: "/admin", category: "Pages", icon: "home" },
  { label: "Athlètes", href: "/admin/athletes", category: "Pages", icon: "users" },
  { label: "Professionnels", href: "/admin/pros", category: "Pages", icon: "briefcase" },
  { label: "Tickets Support", href: "/admin/tickets", category: "Pages", icon: "ticket" },
  { label: "Consentements", href: "/admin/consents", category: "Pages", icon: "shield" },
  { label: "Documents", href: "/admin/documents", category: "Pages", icon: "file" },
  { label: "Sécurité", href: "/admin/security", category: "Pages", icon: "lock" },
  { label: "Incidents", href: "/admin/incidents", category: "Pages", icon: "alert" },
  { label: "Paiements", href: "/admin/payments", category: "Pages", icon: "wallet" },
  { label: "Analytics", href: "/admin/analytics", category: "Pages", icon: "chart" },
  { label: "Conformité", href: "/admin/compliance", category: "Pages", icon: "check" },
  { label: "Notifications", href: "/admin/notifications", category: "Pages", icon: "bell" },
  { label: "Paramètres", href: "/admin/settings", category: "Pages", icon: "settings" },
  { label: "Se déconnecter", href: "__logout__", category: "Actions", icon: "logout" },
];

function CommandPalette({ open, onClose, router }: { open: boolean; onClose: () => void; router: any }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
        else { setQuery(""); setSelectedIndex(0); }
      }
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const filtered = SEARCH_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handleNav(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      }
    }
    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [open, filtered, selectedIndex]);

  function handleSelect(item: typeof SEARCH_ITEMS[0]) {
    onClose();
    if (item.href === "__logout__") {
      fetch("/api/admin/auth", { method: "DELETE" }).then(() => router.push("/admin/login"));
    } else {
      router.push(item.href);
    }
  }

  if (!open) return null;

  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof SEARCH_ITEMS>);

  let globalIndex = -1;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "15vh",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "520px",
          background: "#fff", borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem", borderBottom: "1px solid #e2e8f0" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Rechercher une page, une action..."
            style={{
              flex: 1, border: "none", outline: "none", fontSize: "0.9rem",
              background: "transparent", color: "#1e293b",
            }}
          />
          <kbd style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "2px 6px", fontSize: "0.65rem", color: "#64748b" }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: "340px", overflowY: "auto", padding: "0.5rem 0" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
              Aucun résultat pour &ldquo;{query}&rdquo;
            </div>
          )}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div style={{ padding: "0.4rem 1rem 0.2rem", fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {category}
              </div>
              {items.map((item) => {
                globalIndex++;
                const isSelected = globalIndex === selectedIndex;
                const idx = globalIndex;
                return (
                  <div
                    key={item.href}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.6rem",
                      padding: "0.5rem 1rem", cursor: "pointer",
                      background: isSelected ? "#f1f5f9" : "transparent",
                      borderLeft: isSelected ? "2px solid #2563eb" : "2px solid transparent",
                    }}
                  >
                    <span style={{ width: "24px", height: "24px", borderRadius: "6px", background: isSelected ? "#dbeafe" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: isSelected ? "#2563eb" : "#64748b", flexShrink: 0 }}>
                      {PAL_ICONS[item.icon]}
                    </span>
                    <span style={{ fontSize: "0.82rem", fontWeight: isSelected ? 600 : 400, color: "#1e293b" }}>{item.label}</span>
                    {isSelected && (
                      <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#94a3b8" }}>Entrée ↵</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
