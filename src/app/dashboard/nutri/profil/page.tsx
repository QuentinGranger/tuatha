"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.scss";

/* ────── Types ────── */
interface Service { id?: string; nom: string; personnalise: boolean; }
interface Tarif { id?: string; label: string; price: number; duration: number; description?: string; format?: string | null; }
interface Disponibilite { id?: string; jourDebut: string; jourFin: string; heureDebut: string; heureFin: string; }
interface VerifDoc { id: string; type: string; label: string; filePath: string; status: string; note: string | null; aiVerified: boolean | null; aiConfidence: number | null; aiSummary: string | null; createdAt: string; }
interface ProfilData {
  id: string; nom: string; prenom: string; email: string; telephone: string;
  specialite: string; numeroVerification: string; avatarPath: string | null;
  adresseCabinet: string | null; twoFactorEnabled: boolean;
  verificationStatus: string; verifiedAt: string | null; verificationNote: string | null;
  createdAt: string;
  services: Service[]; tarifs: Tarif[]; disponibilites: Disponibilite[];
}

const VERIF_STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  unverified: { label: "Non vérifié", color: "red", icon: "alert" },
  pending: { label: "En attente", color: "orange", icon: "clock" },
  verified: { label: "Vérifié", color: "green", icon: "check" },
  rejected: { label: "Refusé", color: "red", icon: "x" },
};

const VERIF_DOC_TYPES: Record<string, string> = {
  rpps: "Numéro RPPS",
  adeli: "Numéro ADELI",
  carte_pro: "Carte professionnelle",
  diplome: "Diplôme",
  structure: "Justificatif de structure",
  other: "Autre document",
};

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SPECIALITE_LABELS: Record<string, string> = { medecin: "Médecin", kine: "Kinésithérapeute", coach: "Coach sportif", nutri: "Nutritionniste" };

/* ────── Icons (inline SVG helpers) ────── */
const ICO = {
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  wrench: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  zap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
};

export default function ProfilPage() {
  const [profil, setProfil] = useState<ProfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global edit mode
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [fNom, setFNom] = useState("");
  const [fPrenom, setFPrenom] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fTel, setFTel] = useState("");
  const [fRue, setFRue] = useState("");
  const [fCp, setFCp] = useState("");
  const [fVille, setFVille] = useState("");

  const [fServices, setFServices] = useState<Service[]>([]);
  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcDuration, setNewSvcDuration] = useState("30");
  const [newSvcMode, setNewSvcMode] = useState("Présentiel");

  const [fTarifs, setFTarifs] = useState<Tarif[]>([]);
  const [newTarifLabel, setNewTarifLabel] = useState("");
  const [newTarifPrice, setNewTarifPrice] = useState("");
  const [newTarifDuration, setNewTarifDuration] = useState("30");
  const [newTarifFormat, setNewTarifFormat] = useState<string>("");

  const [fDispos, setFDispos] = useState<Disponibilite[]>([]);
  const [newDispoJour, setNewDispoJour] = useState("Lundi");
  const [newDispoJourFin, setNewDispoJourFin] = useState("Lundi");
  const [newDispoDebut, setNewDispoDebut] = useState("09:00");
  const [newDispoFin, setNewDispoFin] = useState("18:00");

  // Password
  const [showPwd, setShowPwd] = useState(false);
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confPwd, setConfPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  // 2FA
  const [show2FA, setShow2FA] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [twoFAMsg, setTwoFAMsg] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [saving2FA, setSaving2FA] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  // Verification
  const [verifDocs, setVerifDocs] = useState<VerifDoc[]>([]);
  const [showVerifUpload, setShowVerifUpload] = useState(false);
  const [verifDocType, setVerifDocType] = useState("diplome");
  const [verifDocLabel, setVerifDocLabel] = useState("");
  const [uploadingVerif, setUploadingVerif] = useState(false);
  const verifFileRef = useRef<HTMLInputElement>(null);

  // Preview
  const [showPreview, setShowPreview] = useState(false);

  // Account deletion
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copié`, "success");
  };

  // Parse address "Rue, CP Ville" → parts
  const parseAddress = (addr: string | null) => {
    if (!addr) return { rue: "", cp: "", ville: "" };
    const parts = addr.split(",").map((s) => s.trim());
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const cpMatch = last.match(/^(\d{5})\s+(.+)$/);
      if (cpMatch) return { rue: parts.slice(0, -1).join(", "), cp: cpMatch[1], ville: cpMatch[2] };
      return { rue: parts[0], cp: "", ville: parts.slice(1).join(", ") };
    }
    return { rue: addr, cp: "", ville: "" };
  };

  const buildAddress = () => {
    const parts = [fRue, [fCp, fVille].filter(Boolean).join(" ")].filter(Boolean);
    return parts.join(", ") || null;
  };

  // Fetch
  useEffect(() => {
    Promise.all([
      fetch("/api/profil").then((r) => r.json()),
      fetch("/api/profil/verification").then((r) => r.json()),
    ])
      .then(([profilData, verifData]) => {
        setProfil(profilData);
        syncForm(profilData);
        if (verifData.verificationDocs) setVerifDocs(verifData.verificationDocs);
      })
      .catch(() => showToast("Erreur chargement profil", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const uploadVerifDoc = async () => {
    const file = verifFileRef.current?.files?.[0];
    if (!file) return showToast("Sélectionnez un fichier", "error");
    setUploadingVerif(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", verifDocType);
      fd.append("label", verifDocLabel || VERIF_DOC_TYPES[verifDocType]);
      const res = await fetch("/api/profil/verification", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerifDocs((prev) => [data.document, ...prev]);
      setProfil((p) => p ? { ...p, verificationStatus: "pending" } : p);
      setShowVerifUpload(false);
      setVerifDocLabel("");
      if (verifFileRef.current) verifFileRef.current.value = "";
      showToast("Document soumis pour vérification", "success");
    } catch (err) { showToast(err instanceof Error ? err.message : "Erreur upload", "error"); }
    finally { setUploadingVerif(false); }
  };

  const syncForm = (data: ProfilData) => {
    setFNom(data.nom || ""); setFPrenom(data.prenom || ""); setFEmail(data.email || ""); setFTel(data.telephone || "");
    const addr = parseAddress(data.adresseCabinet);
    setFRue(addr.rue); setFCp(addr.cp); setFVille(addr.ville);
    setFServices((data.services || []).map((s: Service) => ({ ...s })));
    setFTarifs((data.tarifs || []).map((t: Tarif) => ({ ...t })));
    setFDispos((data.disponibilites || []).map((d: Disponibilite) => ({ ...d })));
    setDirty(false);
  };

  const markDirty = () => { if (!dirty) setDirty(true); };

  const enterEdit = () => { if (profil) { syncForm(profil); setEditing(true); } };
  const cancelEdit = () => { if (profil) { syncForm(profil); setEditing(false); setDirty(false); } };

  // Save all
  const saveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profil", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: fNom, prenom: fPrenom, email: fEmail, telephone: fTel,
          adresseCabinet: buildAddress(),
          services: fServices,
          tarifs: fTarifs,
          disponibilites: fDispos,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = { ...profil!, nom: fNom, prenom: fPrenom, email: fEmail, telephone: fTel, adresseCabinet: buildAddress(), services: fServices, tarifs: fTarifs, disponibilites: fDispos };
      setProfil(updated);
      setEditing(false); setDirty(false);
      showToast("Profil enregistré", "success");
    } catch { showToast("Erreur lors de la sauvegarde", "error"); }
    finally { setSaving(false); }
  };

  // Avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append("avatar", file);
    try {
      const res = await fetch("/api/profil/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfil((p) => p ? { ...p, avatarPath: data.avatarPath } : p);
      showToast("Photo mise à jour", "success");
    } catch { showToast("Erreur upload photo", "error"); }
  };

  // Password
  const handlePwdChange = async () => {
    setPwdMsg(null);
    if (newPwd !== confPwd) { setPwdMsg({ msg: "Les mots de passe ne correspondent pas", type: "error" }); return; }
    if (newPwd.length < 8) { setPwdMsg({ msg: "Minimum 8 caractères", type: "error" }); return; }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/profil/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPwdMsg({ msg: "Mot de passe modifié !", type: "success" }); setCurPwd(""); setNewPwd(""); setConfPwd("");
    } catch (err) { setPwdMsg({ msg: err instanceof Error ? err.message : "Erreur", type: "error" }); }
    finally { setSavingPwd(false); }
  };

  // 2FA setup
  const start2FASetup = async () => {
    setTwoFAMsg(null); setQrCode(null); setTotpCode("");
    try {
      const res = await fetch("/api/profil/2fa", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrCode(data.qrCode);
      setSecretKey(data.secret);
      setShow2FA(true);
    } catch (err) { showToast(err instanceof Error ? err.message : "Erreur setup 2FA", "error"); }
  };

  const verify2FA = async () => {
    setTwoFAMsg(null); setSaving2FA(true);
    try {
      const res = await fetch("/api/profil/2fa", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: totpCode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfil((p) => p ? { ...p, twoFactorEnabled: true } : p);
      setTwoFAMsg({ msg: "2FA activé avec succès !", type: "success" });
      setQrCode(null); setTotpCode("");
      showToast("Double authentification activée", "success");
    } catch (err) { setTwoFAMsg({ msg: err instanceof Error ? err.message : "Code invalide", type: "error" }); }
    finally { setSaving2FA(false); }
  };

  const disable2FA = async () => {
    setTwoFAMsg(null); setSaving2FA(true);
    try {
      const res = await fetch("/api/profil/2fa", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: disableCode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfil((p) => p ? { ...p, twoFactorEnabled: false } : p);
      setDisabling2FA(false); setDisableCode(""); setShow2FA(false);
      showToast("Double authentification désactivée", "success");
    } catch (err) { setTwoFAMsg({ msg: err instanceof Error ? err.message : "Code invalide", type: "error" }); }
    finally { setSaving2FA(false); }
  };

  // Account deletion
  const handleDeleteAccount = async () => {
    setDeleteMsg(null);
    if (deleteConfirmText !== "SUPPRIMER") {
      setDeleteMsg({ msg: "Tapez SUPPRIMER pour confirmer", type: "error" });
      return;
    }
    if (!deletePassword) {
      setDeleteMsg({ msg: "Mot de passe requis", type: "error" });
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/profil/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = "/";
    } catch (err) {
      setDeleteMsg({ msg: err instanceof Error ? err.message : "Erreur lors de la suppression", type: "error" });
    } finally {
      setDeletingAccount(false);
    }
  };

  // Completion score
  const getCompletion = (p: ProfilData) => {
    const checks = [
      { label: "Nom et prénom", done: !!p.nom && !!p.prenom },
      { label: "Email vérifié", done: !!p.email },
      { label: "Téléphone", done: !!p.telephone },
      { label: "Photo de profil", done: !!p.avatarPath },
      { label: "Adresse du cabinet", done: !!p.adresseCabinet },
      { label: "Services configurés", done: (p.services || []).length > 0 },
      { label: "Disponibilités", done: (p.disponibilites || []).length > 0 },
      { label: "N° vérification (RPPS)", done: !!p.numeroVerification },
    ];
    const done = checks.filter((c) => c.done).length;
    return { checks, pct: Math.round((done / checks.length) * 100) };
  };

  // Security score
  const getSecurityScore = (p: ProfilData) => {
    const items = [
      { title: "Mot de passe", desc: "Défini", ok: true },
      { title: "Double authentification", desc: p.twoFactorEnabled ? "Activée" : "Non activée", ok: p.twoFactorEnabled },
      { title: "Sessions actives", desc: "1 session", ok: true },
    ];
    const score = items.filter((i) => i.ok).length;
    const level = score >= 3 ? "good" : score >= 2 ? "medium" : "weak";
    const label = level === "good" ? "Bon" : level === "medium" ? "Moyen" : "Faible";
    return { items, level, label, score };
  };

  /* ────── SKELETON LOADING ────── */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <div className={styles.skeletonPage}>
              <div className={styles.skeletonHeader} />
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} />
            </div>
          </div>
          <div className={styles.side}>
            <div className={styles.skeletonSide} />
            <div className={styles.skeletonSide} />
          </div>
        </div>
      </div>
    );
  }

  if (!profil) return <div className={styles.page}><div className={styles.emptyState}>Impossible de charger le profil.</div></div>;

  const initials = `${(profil.prenom || "")[0] || ""}${(profil.nom || "")[0] || ""}`.toUpperCase();
  const memberSince = new Date(profil.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const completion = getCompletion(profil);
  const security = getSecurityScore(profil);
  const addr = parseAddress(profil.adresseCabinet);

  return (
    <div className={styles.page}>
      {/* ── PROFILE HEADER ── */}
      <div className={styles.profileHeader}>
        <div className={styles.profileHeaderTop}>
          <div className={styles.avatarWrap}>
            {profil.avatarPath ? (
              <Image src={profil.avatarPath} alt="Photo de profil" width={80} height={80} className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarPlaceholder}>{initials}</div>
            )}
            <button className={styles.avatarUploadBtn} onClick={() => fileInputRef.current?.click()}>
              {ICO.upload}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{profil.prenom} {profil.nom}</h1>
            <p className={styles.profileRole}>{SPECIALITE_LABELS[profil.specialite] || profil.specialite}</p>
            <div className={styles.profileBadges}>
              {(() => { const vs = VERIF_STATUS_MAP[profil.verificationStatus] || VERIF_STATUS_MAP.unverified; return (
                <span className={`${styles.badge} ${profil.verificationStatus === "verified" ? styles.badgeVerified : profil.verificationStatus === "pending" ? styles.badgePending : styles.badgeUnverified}`}>
                  {profil.verificationStatus === "verified" ? ICO.check : profil.verificationStatus === "pending" ? ICO.clock : ICO.alert} {vs.label}
                </span>
              ); })()}
              <span className={`${styles.badge} ${styles.badgeRpps}`} onClick={() => copyToClipboard(profil.numeroVerification, "N° RPPS")} title="Cliquer pour copier">
                {ICO.shield} RPPS {profil.numeroVerification}
              </span>
              <span className={`${styles.badge} ${styles.badgeSpecialite}`}>{SPECIALITE_LABELS[profil.specialite]}</span>
            </div>
            <div className={styles.profileMeta}>
              <span>Membre depuis {memberSince}</span>
              <span>Profil {completion.pct}% complet</span>
            </div>
          </div>
        </div>
        <div className={styles.profileActions}>
          {!editing ? (
            <>
              <button className={styles.btnPrimary} onClick={enterEdit}>{ICO.edit} Modifier le profil</button>
              <button className={styles.btnSecondary} onClick={() => setShowPreview(true)}>{ICO.eye} Prévisualiser</button>
            </>
          ) : (
            <>
              <button className={styles.btnSecondary} onClick={cancelEdit}>Annuler</button>
              <button className={styles.btnPrimary} onClick={saveAll} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer tout"}</button>
            </>
          )}
        </div>
      </div>

      {/* ── 2-COLUMN LAYOUT ── */}
      <div className={styles.layout}>
        {/* ── LEFT: MAIN ── */}
        <div className={styles.main}>

          {/* ── Informations personnelles ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{ICO.user} Informations personnelles</div>
            {editing ? (
              <div className={styles.form}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Prénom</label>
                    <input className={styles.fieldInput} value={fPrenom} onChange={(e) => { setFPrenom(e.target.value); markDirty(); }} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Nom</label>
                    <input className={styles.fieldInput} value={fNom} onChange={(e) => { setFNom(e.target.value); markDirty(); }} />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Email</label>
                    <input className={styles.fieldInput} type="email" value={fEmail} onChange={(e) => { setFEmail(e.target.value); markDirty(); }} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Téléphone</label>
                    <input className={styles.fieldInput} value={fTel} onChange={(e) => { setFTel(e.target.value); markDirty(); }} />
                  </div>
                </div>
                <div className={styles.fieldRow3}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Rue</label>
                    <input className={styles.fieldInput} value={fRue} onChange={(e) => { setFRue(e.target.value); markDirty(); }} placeholder="123 Rue du cabinet" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Code postal</label>
                    <input className={styles.fieldInput} value={fCp} onChange={(e) => { setFCp(e.target.value); markDirty(); }} placeholder="75001" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Ville</label>
                    <input className={styles.fieldInput} value={fVille} onChange={(e) => { setFVille(e.target.value); markDirty(); }} placeholder="Paris" />
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Prénom</span>
                  <span className={styles.infoValue}>{profil.prenom}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Nom</span>
                  <span className={styles.infoValue}>{profil.nom}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Email</span>
                  <div className={styles.infoValueRow}>
                    <span className={styles.infoValue}>{profil.email}</span>
                    <button className={styles.copyBtn} onClick={() => copyToClipboard(profil.email, "Email")} title="Copier">{ICO.copy}</button>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Téléphone</span>
                  <div className={styles.infoValueRow}>
                    <span className={styles.infoValue}>{profil.telephone}</span>
                    <button className={styles.copyBtn} onClick={() => copyToClipboard(profil.telephone, "Téléphone")} title="Copier">{ICO.copy}</button>
                  </div>
                </div>
                <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                  <span className={styles.infoLabel}>Adresse du cabinet</span>
                  <span className={`${styles.infoValue} ${!profil.adresseCabinet ? styles.infoValueMuted : ""}`}>
                    {profil.adresseCabinet ? `${addr.rue}${addr.cp ? `, ${addr.cp}` : ""}${addr.ville ? ` ${addr.ville}` : ""}` : "Non renseignée"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Services ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {ICO.wrench} Services proposés
              {!editing && <button className={styles.sectionEditBtn} onClick={enterEdit}>{ICO.edit} Modifier</button>}
            </div>
            {editing ? (
              <div className={styles.form}>
                <div className={styles.servicesList}>
                  {fServices.map((s, i) => (
                    <div key={i} className={styles.serviceCard}>
                      <div className={styles.serviceInfo}>
                        <div className={styles.serviceName}>{s.nom}</div>
                      </div>
                      <button className={styles.serviceRemove} onClick={() => { setFServices(fServices.filter((_, j) => j !== i)); markDirty(); }}>{ICO.x}</button>
                    </div>
                  ))}
                </div>
                <div className={styles.addServiceRow}>
                  <input className={styles.addServiceInput} value={newSvcName} onChange={(e) => setNewSvcName(e.target.value)} placeholder="Nom du service..."
                    onKeyDown={(e) => { if (e.key === "Enter" && newSvcName.trim()) { setFServices([...fServices, { nom: `${newSvcName.trim()} · ${newSvcDuration}min · ${newSvcMode}`, personnalise: true }]); setNewSvcName(""); markDirty(); } }} />
                  <select className={styles.addServiceSelect} value={newSvcDuration} onChange={(e) => setNewSvcDuration(e.target.value)}>
                    {["15", "30", "45", "60", "90"].map((d) => <option key={d} value={d}>{d} min</option>)}
                  </select>
                  <select className={styles.addServiceSelect} value={newSvcMode} onChange={(e) => setNewSvcMode(e.target.value)}>
                    <option>Présentiel</option><option>Téléconsultation</option><option>Les deux</option>
                  </select>
                  <button className={styles.addBtn} onClick={() => { if (newSvcName.trim()) { setFServices([...fServices, { nom: `${newSvcName.trim()} · ${newSvcDuration}min · ${newSvcMode}`, personnalise: true }]); setNewSvcName(""); markDirty(); } }}>{ICO.plus} Ajouter</button>
                </div>
              </div>
            ) : (
              (profil.services || []).length > 0 ? (
                <div className={styles.servicesList}>
                  {(profil.services || []).map((s, i) => {
                    const parts = s.nom.split(" · ");
                    return (
                      <div key={s.id || `svc-${i}`} className={styles.serviceCard}>
                        <div className={styles.serviceInfo}>
                          <div className={styles.serviceName}>{parts[0]}</div>
                          {parts.length > 1 && <div className={styles.serviceMeta}>{parts.slice(1).map((p, i) => <span key={i}>{p}</span>)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className={styles.emptyState}><button className={styles.emptyStateBtn} onClick={enterEdit}>{ICO.plus} Ajouter un service</button></div>
            )}
          </div>

          {/* ── Tarifs ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              {" "}Tarifs
              {!editing && <button className={styles.sectionEditBtn} onClick={enterEdit}>{ICO.edit} Modifier</button>}
            </div>
            {editing ? (
              <div className={styles.form}>
                <div className={styles.servicesList}>
                  {fTarifs.map((t, i) => (
                    <div key={i} className={styles.serviceCard}>
                      <div className={styles.serviceInfo}>
                        <div className={styles.serviceName}>{t.label}</div>
                        <div className={styles.serviceMeta}>
                          <span>{(t.price / 100).toFixed(2)} €</span>
                          <span>{t.duration} min</span>
                          {t.format && <span>{t.format === "presentiel" ? "Présentiel" : t.format === "teleconsultation" ? "Téléconsultation" : t.format}</span>}
                        </div>
                      </div>
                      <button className={styles.serviceRemove} onClick={() => { setFTarifs(fTarifs.filter((_, j) => j !== i)); markDirty(); }}>{ICO.x}</button>
                    </div>
                  ))}
                </div>
                {fServices.length === 0 ? (
                  <div style={{ padding: "10px 0", color: "rgba(255,255,255,0.35)", fontSize: 12, fontStyle: "italic" }}>Ajoutez d'abord un service pour pouvoir définir un tarif.</div>
                ) : (
                  <div className={styles.addServiceRow}>
                    <select className={styles.addServiceSelect} value={newTarifLabel} onChange={(e) => setNewTarifLabel(e.target.value)} style={{ minWidth: 160 }}>
                      <option value="">— Choisir un service —</option>
                      {fServices.map((s, i) => <option key={i} value={s.nom}>{s.nom.split(" · ")[0]}</option>)}
                    </select>
                    <input className={styles.addServiceInput} style={{ maxWidth: 90 }} value={newTarifPrice} onChange={(e) => setNewTarifPrice(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="Prix (€)" />
                    <select className={styles.addServiceSelect} value={newTarifDuration} onChange={(e) => setNewTarifDuration(e.target.value)}>
                      {["15", "30", "45", "60", "90", "120"].map((d) => <option key={d} value={d}>{d} min</option>)}
                    </select>
                    <select className={styles.addServiceSelect} value={newTarifFormat} onChange={(e) => setNewTarifFormat(e.target.value)}>
                      <option value="">Tous formats</option>
                      <option value="presentiel">Présentiel</option>
                      <option value="teleconsultation">Téléconsultation</option>
                    </select>
                    <button className={styles.addBtn} onClick={() => {
                      const label = newTarifLabel;
                      const priceStr = newTarifPrice.replace(",", ".");
                      const priceNum = parseFloat(priceStr);
                      if (!label || isNaN(priceNum) || priceNum <= 0) return;
                      setFTarifs([...fTarifs, { label, price: Math.round(priceNum * 100), duration: parseInt(newTarifDuration), format: newTarifFormat || null }]);
                      setNewTarifLabel(""); setNewTarifPrice(""); setNewTarifDuration("30"); setNewTarifFormat("");
                      markDirty();
                    }}>{ICO.plus} Ajouter</button>
                  </div>
                )}
              </div>
            ) : (
              (profil.tarifs || []).length > 0 ? (
                <div className={styles.servicesList}>
                  {(profil.tarifs || []).map((t, i) => (
                    <div key={t.id || `tar-${i}`} className={styles.serviceCard}>
                      <div className={styles.serviceInfo}>
                        <div className={styles.serviceName}>{t.label}</div>
                        <div className={styles.serviceMeta}>
                          <span style={{ color: "#10b981", fontWeight: 600 }}>{(t.price / 100).toFixed(2)} €</span>
                          <span>{t.duration} min</span>
                          {t.format && <span>{t.format === "presentiel" ? "Présentiel" : "Téléconsultation"}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className={styles.emptyState}><button className={styles.emptyStateBtn} onClick={enterEdit}>{ICO.plus} Ajouter un tarif</button></div>
            )}
          </div>

          {/* ── Disponibilités ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {ICO.clock} Disponibilités
              {!editing && <button className={styles.sectionEditBtn} onClick={enterEdit}>{ICO.edit} Modifier</button>}
            </div>
            {editing ? (
              <div className={styles.form}>
                <div className={styles.dispoGrid}>
                  {fDispos.map((d, i) => (
                    <div key={i} className={styles.dispoRow}>
                      <span className={styles.dispoDay}>{d.jourDebut === d.jourFin ? d.jourDebut : `${d.jourDebut} → ${d.jourFin}`}</span>
                      <div className={styles.dispoSlots}><span className={styles.dispoSlot}>{d.heureDebut} - {d.heureFin}</span></div>
                      <button className={styles.dispoRemove} onClick={() => { setFDispos(fDispos.filter((_, j) => j !== i)); markDirty(); }}>{ICO.x}</button>
                    </div>
                  ))}
                </div>
                <div className={styles.addDispoRow}>
                  <select className={styles.dispoSelect} value={newDispoJour} onChange={(e) => { setNewDispoJour(e.target.value); setNewDispoJourFin(e.target.value); }}>
                    {JOURS.map((j) => <option key={j} value={j}>{j}</option>)}
                  </select>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>→</span>
                  <select className={styles.dispoSelect} value={newDispoJourFin} onChange={(e) => setNewDispoJourFin(e.target.value)}>
                    {JOURS.map((j) => <option key={j} value={j}>{j}</option>)}
                  </select>
                  <input className={styles.dispoTimeInput} type="time" value={newDispoDebut} onChange={(e) => setNewDispoDebut(e.target.value)} />
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>–</span>
                  <input className={styles.dispoTimeInput} type="time" value={newDispoFin} onChange={(e) => setNewDispoFin(e.target.value)} />
                  <button className={styles.addBtn} onClick={() => { setFDispos([...fDispos, { jourDebut: newDispoJour, jourFin: newDispoJourFin, heureDebut: newDispoDebut, heureFin: newDispoFin }]); markDirty(); }}>
                    {ICO.plus} Ajouter
                  </button>
                </div>
              </div>
            ) : (
              (profil.disponibilites || []).length > 0 ? (
                <div className={styles.dispoGrid}>
                  {(profil.disponibilites || []).map((d, i) => (
                    <div key={d.id || `dispo-${i}`} className={styles.dispoRow}>
                      <span className={styles.dispoDay}>{d.jourDebut === d.jourFin ? d.jourDebut : `${d.jourDebut} → ${d.jourFin}`}</span>
                      <div className={styles.dispoSlots}><span className={styles.dispoSlot}>{d.heureDebut} - {d.heureFin}</span></div>
                      <span />
                    </div>
                  ))}
                </div>
              ) : <div className={styles.emptyState}><button className={styles.emptyStateBtn} onClick={enterEdit}>{ICO.plus} Ajouter une disponibilité</button></div>
            )}
          </div>

          {/* ── Sécurité ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{ICO.lock} Sécurité</div>
            <div className={styles.securityScore}>
              <div className={`${styles.scoreCircle} ${security.level === "good" ? styles.scoreGood : security.level === "medium" ? styles.scoreMedium : styles.scoreWeak}`}>
                {security.label === "Bon" ? "A" : security.label === "Moyen" ? "B" : "C"}
              </div>
              <div className={styles.scoreText}>
                <div className={styles.scoreLabel}>Niveau : {security.label}</div>
                <div className={styles.scoreHint}>Activez la 2FA pour renforcer la sécurité</div>
              </div>
            </div>
            <div className={styles.securityItems}>
              {security.items.map((item, i) => (
                <div key={i} className={styles.securityItem}>
                  <div className={`${styles.securityItemIcon} ${item.ok ? styles.securityItemIconOk : styles.securityItemIconWarn}`}>
                    {item.ok ? ICO.check : ICO.alert}
                  </div>
                  <div className={styles.securityItemText}>
                    <div className={styles.securityItemTitle}>{item.title}</div>
                    <div className={styles.securityItemDesc}>{item.desc}</div>
                  </div>
                  {!item.ok && item.title.includes("Double") && <button className={styles.securityItemAction} onClick={start2FASetup}>Activer</button>}
                  {item.ok && item.title.includes("Double") && <button className={styles.securityItemAction} onClick={() => { setDisabling2FA(true); setShow2FA(true); setTwoFAMsg(null); }}>Désactiver</button>}
                  {item.ok && item.title === "Mot de passe" && <button className={styles.securityItemAction} onClick={() => setShowPwd(!showPwd)}>Modifier</button>}
                </div>
              ))}
            </div>
            {/* 2FA inline removed — now in modal below */}
            {showPwd && (
              <div className={styles.passwordForm} style={{ marginTop: 18 }}>
                {pwdMsg && <div className={`${styles.passwordMsg} ${pwdMsg.type === "success" ? styles.success : styles.error}`}>{pwdMsg.msg}</div>}
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Mot de passe actuel</label>
                    <input className={styles.fieldInput} type="password" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} />
                  </div>
                  <div className={styles.field} />
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Nouveau mot de passe</label>
                    <input className={styles.fieldInput} type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Minimum 8 caractères" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Confirmer</label>
                    <input className={styles.fieldInput} type="password" value={confPwd} onChange={(e) => setConfPwd(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button className={styles.btnSecondary} onClick={() => { setShowPwd(false); setPwdMsg(null); setCurPwd(""); setNewPwd(""); setConfPwd(""); }}>Annuler</button>
                  <button className={styles.btnPrimary} onClick={handlePwdChange} disabled={savingPwd || !curPwd || !newPwd || !confPwd}>
                    {savingPwd ? "Modification..." : "Modifier"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Compte ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Compte
            </div>

            <div className={styles.dangerZone}>
              <div className={styles.dangerZoneHeader}>
                <div className={styles.dangerZoneTitle}>Suppression du compte</div>
                <div className={styles.dangerZoneDesc}>
                  Cette action est <strong>irréversible</strong>. Toutes vos données seront définitivement supprimées : profil, athlètes, programmes, messages, documents, factures et sessions.
                </div>
              </div>
              {!showDeleteAccount ? (
                <button className={styles.btnDanger} onClick={() => setShowDeleteAccount(true)}>
                  Supprimer mon compte
                </button>
              ) : (
                <div className={styles.deleteAccountForm}>
                  {deleteMsg && <div className={`${styles.passwordMsg} ${deleteMsg.type === "success" ? styles.success : styles.error}`}>{deleteMsg.msg}</div>}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Mot de passe actuel</label>
                    <input className={styles.fieldInput} type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Confirmez votre mot de passe" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Tapez <strong>SUPPRIMER</strong> pour confirmer</label>
                    <input className={styles.fieldInput} value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="SUPPRIMER" />
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                    <button className={styles.btnSecondary} onClick={() => { setShowDeleteAccount(false); setDeletePassword(""); setDeleteConfirmText(""); setDeleteMsg(null); }}>Annuler</button>
                    <button className={styles.btnDanger} onClick={handleDeleteAccount} disabled={deletingAccount || deleteConfirmText !== "SUPPRIMER" || !deletePassword}>
                      {deletingAccount ? "Suppression..." : "Confirmer la suppression"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: SIDE PANEL ── */}
        <div className={styles.side}>

          {/* Completion */}
          <div className={styles.completionCard}>
            <div className={styles.completionTitle}>{ICO.target} Complétion du profil</div>
            <div className={styles.completionBar}><div className={styles.completionFill} style={{ width: `${completion.pct}%` }} /></div>
            <div className={styles.completionPct}>{completion.pct}%</div>
            <div className={styles.completionItems}>
              {completion.checks.map((c, i) => (
                <div key={i} className={styles.completionItem}>
                  <div className={`${styles.completionCheck} ${c.done ? styles.completionDone : styles.completionTodo}`}>
                    {c.done ? ICO.check : <span style={{ fontSize: 10 }}>{i + 1}</span>}
                  </div>
                  <span className={c.done ? styles.completionTextDone : styles.completionText}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Account status */}
          <div className={styles.statusCard}>
            <div className={styles.statusTitle}>{ICO.shield} Statut du compte</div>
            <div className={styles.statusItems}>
              <div className={styles.statusItem}>
                <div className={`${styles.statusDot} ${styles.statusDotGreen}`} />
                <span className={styles.statusLabel}>Compte</span>
                <span className={styles.statusValue}>Actif</span>
              </div>
              <div className={styles.statusItem}>
                <div className={`${styles.statusDot} ${profil.verificationStatus === "verified" ? styles.statusDotGreen : profil.verificationStatus === "pending" ? styles.statusDotOrange : styles.statusDotRed}`} />
                <span className={styles.statusLabel}>Identité pro</span>
                <span className={styles.statusValue}>{(VERIF_STATUS_MAP[profil.verificationStatus] || VERIF_STATUS_MAP.unverified).label}</span>
              </div>
              <div className={styles.statusItem}>
                <div className={`${styles.statusDot} ${profil.avatarPath ? styles.statusDotGreen : styles.statusDotOrange}`} />
                <span className={styles.statusLabel}>Photo de profil</span>
                <span className={styles.statusValue}>{profil.avatarPath ? "OK" : "Manquante"}</span>
              </div>
              <div className={styles.statusItem}>
                <div className={`${styles.statusDot} ${security.level === "good" ? styles.statusDotGreen : styles.statusDotOrange}`} />
                <span className={styles.statusLabel}>Sécurité</span>
                <span className={styles.statusValue}>{security.label}</span>
              </div>
            </div>
            {profil.verificationNote && profil.verificationStatus === "rejected" && (
              <div className={styles.verifNote}>{ICO.alert} {profil.verificationNote}</div>
            )}
            {profil.verificationStatus !== "verified" && (
              <button className={styles.btnPrimary} style={{ width: "100%", marginTop: 12, fontSize: 13 }} onClick={() => setShowVerifUpload(true)}>
                {ICO.upload} Soumettre un justificatif
              </button>
            )}
            {verifDocs.length > 0 && (
              <div className={styles.verifDocsList}>
                <div className={styles.verifDocsTitle}>Documents soumis</div>
                {verifDocs.map((doc) => (
                  <div key={doc.id} className={styles.verifDocItem}>
                    <div className={styles.verifDocIcon}>{ICO.file}</div>
                    <div className={styles.verifDocInfo}>
                      <div className={styles.verifDocLabel}>{doc.label}</div>
                      <div className={styles.verifDocMeta}>
                        {new Date(doc.createdAt).toLocaleDateString("fr-FR")} ·{" "}
                        <span className={`${styles.verifDocStatus} ${doc.status === "accepted" ? styles.verifDocAccepted : doc.status === "rejected" ? styles.verifDocRejected : styles.verifDocPending}`}>
                          {doc.status === "accepted" ? "Accepté" : doc.status === "rejected" ? "Refusé" : "En attente"}
                        </span>
                        {doc.aiConfidence != null && (
                          <span className={styles.verifDocAi}> · IA : {doc.aiConfidence}%</span>
                        )}
                      </div>
                      {doc.aiSummary && <div className={styles.verifDocAiSummary}>{doc.aiSummary}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shortcuts */}
          <div className={styles.shortcutsCard}>
            <div className={styles.shortcutsTitle}>{ICO.zap} Raccourcis</div>
            <div className={styles.shortcutsList}>
              <Link href={`/dashboard/${profil.specialite}`} className={styles.shortcutItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                Tableau de bord
              </Link>
              <Link href={`/dashboard/${profil.specialite}/calendrier`} className={styles.shortcutItem}>{ICO.calendar} Calendrier</Link>
              <Link href={`/dashboard/${profil.specialite}/documents`} className={styles.shortcutItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Documents
              </Link>
              <Link href={`/dashboard/${profil.specialite}/messagerie`} className={styles.shortcutItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Messagerie
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── STICKY SAVE BAR ── */}
      {editing && dirty && (
        <div className={styles.stickyBar}>
          <div className={styles.stickyLabel}>{ICO.alert} Changements non enregistrés</div>
          <button className={styles.btnSecondary} onClick={cancelEdit}>Annuler</button>
          <button className={styles.btnPrimary} onClick={saveAll} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
        </div>
      )}

      {/* ── 2FA MODAL ── */}
      {show2FA && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) { setShow2FA(false); setQrCode(null); setTwoFAMsg(null); setDisabling2FA(false); } }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{ICO.shield} {profil.twoFactorEnabled ? "Désactiver la 2FA" : "Activer la 2FA"}</div>
              <button className={styles.modalClose} onClick={() => { setShow2FA(false); setQrCode(null); setTwoFAMsg(null); setDisabling2FA(false); }}>{ICO.x}</button>
            </div>
            {twoFAMsg && <div className={`${styles.modalMsg} ${twoFAMsg.type === "success" ? styles.success : styles.error}`}>{twoFAMsg.msg}</div>}

            {/* Setup flow */}
            {!profil.twoFactorEnabled && qrCode && (
              <>
                <div className={styles.modalDesc}>Scannez ce QR code avec votre application d&apos;authentification (Google Authenticator, Authy, etc.)</div>
                <div className={styles.modalQr}>
                  <img src={qrCode} alt="QR Code 2FA" width={200} height={200} />
                </div>
                <div className={styles.modalSecret}>
                  <label>Clé secrète (si scan impossible)</label>
                  <div className={styles.modalSecretRow}>
                    <code>{secretKey}</code>
                    <button className={styles.copyBtn} onClick={() => copyToClipboard(secretKey, "Clé secrète")}>{ICO.copy}</button>
                  </div>
                </div>
                <label className={styles.fieldLabel} style={{ marginBottom: 8 }}>Code de vérification</label>
                <input className={styles.modalCodeInput} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} autoFocus />
                <div className={styles.modalActions}>
                  <button className={styles.btnSecondary} onClick={() => { setShow2FA(false); setQrCode(null); setTwoFAMsg(null); }}>Annuler</button>
                  <button className={styles.btnPrimary} onClick={verify2FA} disabled={saving2FA || totpCode.length !== 6}>{saving2FA ? "Vérification..." : "Activer la 2FA"}</button>
                </div>
              </>
            )}

            {/* Disable flow */}
            {profil.twoFactorEnabled && disabling2FA && (
              <>
                <div className={styles.modalDesc}>Entrez un code de votre application d&apos;authentification pour confirmer la désactivation.</div>
                <label className={styles.fieldLabel} style={{ marginBottom: 8 }}>Code de vérification</label>
                <input className={styles.modalCodeInput} value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} autoFocus />
                <div className={styles.modalActions}>
                  <button className={styles.btnSecondary} onClick={() => { setDisabling2FA(false); setShow2FA(false); setTwoFAMsg(null); }}>Annuler</button>
                  <button className={styles.btnPrimary} onClick={disable2FA} disabled={saving2FA || disableCode.length !== 6}>{saving2FA ? "Désactivation..." : "Désactiver la 2FA"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── VERIFICATION UPLOAD MODAL ── */}
      {showVerifUpload && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowVerifUpload(false); }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{ICO.shield} Soumettre un justificatif</div>
              <button className={styles.modalClose} onClick={() => setShowVerifUpload(false)}>{ICO.x}</button>
            </div>
            <div className={styles.modalDesc}>
              Envoyez un document prouvant votre identité professionnelle. Il sera examiné par notre équipe.
            </div>
            <div className={styles.field} style={{ marginBottom: 14 }}>
              <label className={styles.fieldLabel}>Type de document</label>
              <select className={styles.fieldInput} value={verifDocType} onChange={(e) => setVerifDocType(e.target.value)}>
                {Object.entries(VERIF_DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className={styles.field} style={{ marginBottom: 14 }}>
              <label className={styles.fieldLabel}>Libellé (optionnel)</label>
              <input className={styles.fieldInput} value={verifDocLabel} onChange={(e) => setVerifDocLabel(e.target.value)} placeholder={VERIF_DOC_TYPES[verifDocType]} />
            </div>
            <div className={styles.field} style={{ marginBottom: 14 }}>
              <label className={styles.fieldLabel}>Fichier</label>
              <input ref={verifFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className={styles.fieldInput} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 4 }}>PDF, JPEG, PNG ou WebP — 10 Mo max</div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowVerifUpload(false)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={uploadVerifDoc} disabled={uploadingVerif}>{uploadingVerif ? "Envoi..." : "Soumettre"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PREVIEW MODAL ── */}
      {showPreview && profil && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}>
          <div className={styles.previewModal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{ICO.eye} Aperçu du profil public</div>
              <button className={styles.modalClose} onClick={() => setShowPreview(false)}>{ICO.x}</button>
            </div>
            <div className={styles.previewCard}>
              <div className={styles.previewTop}>
                <div className={styles.previewAvatar}>
                  {profil.avatarPath ? (
                    <Image src={profil.avatarPath} alt="" width={72} height={72} style={{ borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div className={styles.previewAvatarPlaceholder}>{initials}</div>
                  )}
                </div>
                <div className={styles.previewIdentity}>
                  <div className={styles.previewName}>
                    {profil.prenom} {profil.nom}
                    {profil.verificationStatus === "verified" && <span className={styles.previewVerifBadge}>{ICO.check}</span>}
                  </div>
                  <div className={styles.previewSpecialty}>{SPECIALITE_LABELS[profil.specialite] || profil.specialite}</div>
                  {profil.adresseCabinet && <div className={styles.previewLocation}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> {profil.adresseCabinet}</div>}
                </div>
              </div>

              {(profil.services || []).length > 0 && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSectionTitle}>Services proposés</div>
                  <div className={styles.previewTags}>
                    {(profil.services || []).map((s, i) => <span key={i} className={styles.previewTag}>{s.nom}</span>)}
                  </div>
                </div>
              )}

              {(profil.tarifs || []).length > 0 && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSectionTitle}>Tarifs</div>
                  <div className={styles.previewTags}>
                    {(profil.tarifs || []).map((t, i) => <span key={i} className={styles.previewTag}>{t.label} — {(t.price / 100).toFixed(2)} €</span>)}
                  </div>
                </div>
              )}

              {(profil.disponibilites || []).length > 0 && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSectionTitle}>Disponibilités</div>
                  <div className={styles.previewDispos}>
                    {(profil.disponibilites || []).map((d, i) => (
                      <div key={i} className={styles.previewDispo}>
                        <span className={styles.previewDispoDay}>{d.jourDebut}{d.jourFin && d.jourFin !== d.jourDebut ? ` → ${d.jourFin}` : ""}</span>
                        <span className={styles.previewDispoTime}>{d.heureDebut} - {d.heureFin}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.previewSection}>
                <div className={styles.previewSectionTitle}>Contact</div>
                <div className={styles.previewContact}>
                  <div>{profil.email}</div>
                  <div>{profil.telephone}</div>
                </div>
              </div>

              <div className={styles.previewFooter}>
                <span className={styles.previewRpps}>{ICO.shield} RPPS {profil.numeroVerification}</span>
                {profil.verificationStatus === "verified" && <span className={styles.previewVerified}>{ICO.check} Professionnel vérifié</span>}
              </div>
            </div>
            <div className={styles.previewHint}>Ceci est un aperçu de votre profil tel qu&apos;il sera visible par vos patients et confrères.</div>
          </div>
        </div>
      )}

      {/* Cookie preferences */}
      <div className={styles.legalLinks}>
        <button
          className={styles.cookiePrefBtn}
          onClick={() => {
            const fn = (window as unknown as Record<string, unknown>).__openCookiePrefs;
            if (typeof fn === "function") fn();
          }}
        >
          Gérer mes cookies
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.success : styles.error}`}>
          {toast.type === "success" ? ICO.check : ICO.alert} {toast.msg}
        </div>
      )}
    </div>
  );
}
