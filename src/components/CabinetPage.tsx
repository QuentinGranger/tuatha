"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./CabinetPage.module.scss";

/* ─── Types ─── */
interface ProInfo {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  specialite: string | null;
}

interface CabinetMember {
  id: string;
  proId: string;
  role: "admin" | "member";
  joinedAt: string;
  professionnel: ProInfo;
}

interface Cabinet {
  id: string;
  name: string;
  address: string | null;
  ownerId: string;
  owner: { id: string; nom: string; prenom: string; specialite: string | null };
  members: CabinetMember[];
  myRole: "admin" | "member";
  createdAt: string;
}

interface LogEntry {
  id: string;
  action: string;
  actorPro: { id: string; nom: string; prenom: string; specialite: string | null };
  targetPro: { id: string; nom: string; prenom: string } | null;
  details: Record<string, unknown> | null;
  ip?: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  cabinet_created: "a créé le cabinet",
  member_added: "a ajouté",
  member_removed: "a retiré",
  role_changed: "a modifié le rôle de",
  cabinet_updated: "a modifié le cabinet",
  cabinet_deleted: "a supprimé le cabinet",
  offboarding: "a effectué l'offboarding de",
};

const SPEC_LABELS: Record<string, string> = {
  kine: "Kinésithérapeute",
  medecin: "Médecin",
  coach: "Coach sportif",
  nutri: "Nutritionniste",
};

function getInitials(p: { prenom: string; nom: string }) {
  return `${p.prenom[0] || ""}${p.nom[0] || ""}`.toUpperCase();
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/* ─── Component ─── */
export default function CabinetPage() {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showOffboard, setShowOffboard] = useState<CabinetMember | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);

  // Forms
  const [createName, setCreateName] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"member" | "admin">("member");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const selected = cabinets.find((c) => c.id === selectedId) || null;
  const isAdmin = selected?.myRole === "admin";

  /* ─── Fetch cabinets ─── */
  const fetchCabinets = useCallback(async () => {
    try {
      const res = await fetch("/api/cabinet");
      if (!res.ok) throw new Error("Erreur chargement");
      const data = await res.json();
      setCabinets(data);
      setSelectedId((prev) => {
        if (prev && data.some((c: Cabinet) => c.id === prev)) return prev;
        return data.length > 0 ? data[0].id : null;
      });
    } catch {
      setError("Impossible de charger les cabinets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCabinets(); }, [fetchCabinets]);

  /* ─── Fetch logs ─── */
  const fetchLogs = useCallback(async (offset = 0) => {
    if (!selectedId) return;
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/cabinet/logs?cabinetId=${selectedId}&limit=20&offset=${offset}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs);
      setLogsTotal(data.total);
      setLogsOffset(offset);
    } catch { /* ignore */ }
    setLogsLoading(false);
  }, [selectedId]);

  useEffect(() => { if (showLogs) fetchLogs(0); }, [showLogs, fetchLogs]);

  /* ─── API helpers ─── */
  async function cabinetAction(body: Record<string, unknown>) {
    setFormLoading(true);
    setFormError("");
    try {
      const res = await fetch("/api/cabinet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.detail || data.error || "Erreur"); return null; }
      return data;
    } catch {
      setFormError("Erreur réseau");
      return null;
    } finally {
      setFormLoading(false);
    }
  }

  /* ─── Create cabinet ─── */
  async function handleCreate() {
    if (createName.trim().length < 2) { setFormError("Nom requis (min 2 caractères)"); return; }
    const result = await cabinetAction({ action: "create", name: createName.trim(), address: createAddress.trim() || null });
    if (result) {
      setShowCreate(false);
      setCreateName("");
      setCreateAddress("");
      await fetchCabinets();
      setSelectedId(result.id);
    }
  }

  /* ─── Add member ─── */
  async function handleAddMember() {
    if (!addEmail.trim()) { setFormError("Email requis"); return; }
    const result = await cabinetAction({ action: "addMember", cabinetId: selectedId, email: addEmail.trim(), role: addRole });
    if (result) {
      setShowAddMember(false);
      setAddEmail("");
      setAddRole("member");
      await fetchCabinets();
    }
  }

  /* ─── Remove member ─── */
  async function handleRemoveMember(memberId: string) {
    const result = await cabinetAction({ action: "removeMember", cabinetId: selectedId, memberId });
    if (result) await fetchCabinets();
  }

  /* ─── Change role ─── */
  async function handleChangeRole(memberId: string, newRole: "admin" | "member") {
    const result = await cabinetAction({ action: "changeRole", cabinetId: selectedId, memberId, newRole });
    if (result) await fetchCabinets();
  }

  /* ─── Offboard ─── */
  async function handleOffboard(memberId: string) {
    const result = await cabinetAction({ action: "offboard", cabinetId: selectedId, memberId });
    if (result) {
      setShowOffboard(null);
      await fetchCabinets();
    }
  }

  /* ─── Delete cabinet ─── */
  async function handleDeleteCabinet() {
    if (!selectedId) return;
    if (!confirm("Supprimer ce cabinet ? Cette action est irréversible.")) return;
    try {
      const res = await fetch("/api/cabinet", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cabinetId: selectedId }),
      });
      if (res.ok) {
        setSelectedId(null);
        await fetchCabinets();
      }
    } catch { /* ignore */ }
  }

  /* ─── Render ─── */
  if (loading) {
    return <div className={styles.page}><div className={styles.loading}><div className={styles.spinner} /> Chargement...</div></div>;
  }

  return (
    <div className={styles.page}>
      {/* ─── Header ─── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Cabinet / Équipe</h1>
          <p className={styles.subtitle}>Gérez votre cabinet et vos collaborateurs</p>
        </div>
        <div className={styles.headerBtns}>
          <button className={styles.btnPrimary} onClick={() => { setFormError(""); setShowCreate(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Créer un cabinet
          </button>
        </div>
      </div>

      {/* ─── No cabinets ─── */}
      {cabinets.length === 0 && (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" />
            <path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" />
            <path d="M8 10h.01" /><path d="M8 14h.01" />
          </svg>
          <p className={styles.emptyTitle}>Aucun cabinet</p>
          <p className={styles.emptyText}>
            Créez votre premier cabinet pour commencer à collaborer avec d&apos;autres professionnels de santé.
          </p>
          <button className={styles.btnPrimary} onClick={() => { setFormError(""); setShowCreate(true); }}>
            Créer mon premier cabinet
          </button>
        </div>
      )}

      {/* ─── Cabinet tabs ─── */}
      {cabinets.length > 0 && (
        <>
          {cabinets.length > 1 && (
            <div className={styles.cabinetTabs}>
              {cabinets.map((c) => (
                <button
                  key={c.id}
                  className={`${styles.cabinetTab} ${selectedId === c.id ? styles.cabinetTabActive : ""}`}
                  onClick={() => { setSelectedId(c.id); setShowLogs(false); }}
                >
                  {c.name}
                  <span className={`${styles.cabinetTabRole} ${c.myRole === "admin" ? styles.cabinetTabRoleAdmin : ""}`}>
                    {c.myRole === "admin" ? "Admin" : "Membre"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <>
              {/* ─── Info banner ─── */}
              <div className={styles.infoBanner}>
                <svg className={styles.infoBannerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                </svg>
                <span>
                  <strong>{selected.name}</strong>
                  {selected.address && ` — ${selected.address}`}
                  {" · "}
                  {selected.members.length} membre{selected.members.length > 1 ? "s" : ""}
                  {" · Créé le "}{new Date(selected.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </div>

              {/* ─── Members card ─── */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>
                  <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Membres
                  <span className={styles.cardTitleRight}>{selected.members.length} membre{selected.members.length > 1 ? "s" : ""}</span>
                </div>

                {isAdmin && (
                  <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className={styles.btnPrimary} onClick={() => { setFormError(""); setShowAddMember(true); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Ajouter un membre
                    </button>
                    <button className={styles.btnSecondary} onClick={() => setShowLogs(!showLogs)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      {showLogs ? "Masquer les logs" : "Logs admin"}
                    </button>
                    <button className={styles.btnDanger} onClick={handleDeleteCabinet}>Supprimer le cabinet</button>
                  </div>
                )}

                <div className={styles.membersGrid}>
                  {selected.members.map((m) => (
                    <div key={m.id} className={styles.memberCard}>
                      <div className={styles.memberHeader}>
                        <div className={styles.memberAvatar}>
                          {getInitials(m.professionnel)}
                        </div>
                        <div className={styles.memberInfo}>
                          <div className={styles.memberName}>{m.professionnel.prenom} {m.professionnel.nom}</div>
                          <div className={styles.memberEmail}>{m.professionnel.email}</div>
                          {m.professionnel.specialite && (
                            <div className={styles.memberSpec}>{SPEC_LABELS[m.professionnel.specialite] || m.professionnel.specialite}</div>
                          )}
                        </div>
                        <span className={`${styles.memberRole} ${m.role === "admin" ? styles.memberRoleAdmin : ""}`}>
                          {m.role === "admin" ? "Admin" : "Membre"}
                        </span>
                      </div>

                      {isAdmin && m.proId !== selected.ownerId && (
                        <div className={styles.memberActions}>
                          {m.role === "member" ? (
                            <button className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => handleChangeRole(m.id, "admin")}>
                              Promouvoir admin
                            </button>
                          ) : (
                            <button className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => handleChangeRole(m.id, "member")}>
                              Rétrograder membre
                            </button>
                          )}
                          <button className={`${styles.btnDanger} ${styles.btnSmall}`} onClick={() => handleRemoveMember(m.id)}>
                            Retirer
                          </button>
                          <button className={`${styles.btnDanger} ${styles.btnSmall}`} onClick={() => { setFormError(""); setShowOffboard(m); }}>
                            Offboarding
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── Logs panel ─── */}
              {showLogs && (
                <div className={`${styles.card} ${styles.logsSection}`}>
                  <div className={styles.cardTitle}>
                    <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    Historique admin
                    <span className={styles.cardTitleRight}>{logsTotal} entrée{logsTotal > 1 ? "s" : ""}</span>
                  </div>

                  {logsLoading ? (
                    <div className={styles.loading}><div className={styles.spinner} /></div>
                  ) : logs.length === 0 ? (
                    <div className={styles.logsEmpty}>Aucune activité enregistrée</div>
                  ) : (
                    <>
                      <div className={styles.logsList}>
                        {logs.map((log) => {
                          const isCreate = log.action.includes("created") || log.action.includes("added");
                          const isDelete = log.action.includes("removed") || log.action.includes("deleted") || log.action === "offboarding";
                          return (
                            <div key={log.id} className={styles.logItem}>
                              <div className={`${styles.logDot} ${isCreate ? styles.logDotCreate : isDelete ? styles.logDotDelete : styles.logDotUpdate}`} />
                              <div className={styles.logContent}>
                                <div className={styles.logText}>
                                  <span className={styles.logActor}>{log.actorPro.prenom} {log.actorPro.nom}</span>
                                  {" "}{ACTION_LABELS[log.action] || log.action}
                                  {log.targetPro && (
                                    <>{" "}<span className={styles.logTarget}>{log.targetPro.prenom} {log.targetPro.nom}</span></>
                                  )}
                                </div>
                                <div className={styles.logTime}>{formatDate(log.createdAt)}</div>
                                {log.details && log.action === "role_changed" && (
                                  <div className={styles.logDetail}>
                                    {String(log.details.oldRole)} → {String(log.details.newRole)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {logsTotal > 20 && (
                        <div className={styles.logsPagination}>
                          <button className={styles.btnSecondary} disabled={logsOffset === 0} onClick={() => fetchLogs(Math.max(0, logsOffset - 20))}>
                            ← Précédent
                          </button>
                          <button className={styles.btnSecondary} disabled={logsOffset + 20 >= logsTotal} onClick={() => fetchLogs(logsOffset + 20)}>
                            Suivant →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══ MODAL: Create cabinet ═══ */}
      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowCreate(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <h2 className={styles.modalTitle}>Créer un cabinet</h2>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nom du cabinet *</label>
              <input className={styles.formInput} value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="ex: Cabinet Santé Sport Lyon" autoFocus />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Adresse (optionnel)</label>
              <input className={styles.formInput} value={createAddress} onChange={(e) => setCreateAddress(e.target.value)} placeholder="ex: 12 rue de la Santé, 69001 Lyon" />
            </div>

            {formError && <p className={styles.formError}>{formError}</p>}

            <div className={styles.formActions}>
              <button className={styles.btnSecondary} onClick={() => setShowCreate(false)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={handleCreate} disabled={formLoading}>
                {formLoading ? "Création..." : "Créer le cabinet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Add member ═══ */}
      {showAddMember && (
        <div className={styles.overlay} onClick={() => setShowAddMember(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowAddMember(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <h2 className={styles.modalTitle}>Ajouter un membre</h2>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email du professionnel *</label>
              <input className={styles.formInput} type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="prenom.nom@email.com" autoFocus />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Rôle</label>
              <select className={styles.formSelect} value={addRole} onChange={(e) => setAddRole(e.target.value as "member" | "admin")}>
                <option value="member">Membre</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>

            {formError && <p className={styles.formError}>{formError}</p>}

            <div className={styles.formActions}>
              <button className={styles.btnSecondary} onClick={() => setShowAddMember(false)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={handleAddMember} disabled={formLoading}>
                {formLoading ? "Ajout..." : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Offboard ═══ */}
      {showOffboard && (
        <div className={styles.overlay} onClick={() => setShowOffboard(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowOffboard(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <h2 className={styles.modalTitle}>Offboarding</h2>

            <div className={styles.offboardWarning}>
              <p className={styles.offboardWarningTitle}>Action irréversible</p>
              <p className={styles.offboardWarningText}>
                L&apos;offboarding de <strong>{showOffboard.professionnel.prenom} {showOffboard.professionnel.nom}</strong> va :
              </p>
              <ul className={styles.offboardWarningText} style={{ paddingLeft: 18, marginTop: 8 }}>
                <li>Révoquer toutes ses sessions (déconnexion immédiate)</li>
                <li>Réassigner ses suivis partagés vers vous</li>
                <li>Annuler ses invitations en attente</li>
                <li>Le retirer du cabinet</li>
              </ul>
              <p className={styles.offboardWarningText} style={{ marginTop: 8 }}>
                Ses athlètes restent liés à son compte et ne sont pas transférés.
              </p>
            </div>

            {formError && <p className={styles.formError}>{formError}</p>}

            <div className={styles.formActions}>
              <button className={styles.btnSecondary} onClick={() => setShowOffboard(null)}>Annuler</button>
              <button className={styles.btnDanger} onClick={() => handleOffboard(showOffboard.id)} disabled={formLoading}>
                {formLoading ? "En cours..." : "Confirmer l'offboarding"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#ef4444", textAlign: "center" }}>{error}</p>}
    </div>
  );
}
