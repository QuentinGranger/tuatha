"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AvatarCropModal from "@/components/AvatarCropModal";
import { validatePassword, getPasswordStrengthLabel } from "@/lib/security";
import { CGU_VERSION } from "@/lib/cgu";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { SHARING_VERSION } from "@/lib/dataSharing";
import styles from "./page.module.scss";

const sports = [
  { value: "", label: "Sélectionnez votre sport (optionnel)" },
  { value: "football", label: "Football" },
  { value: "rugby", label: "Rugby" },
  { value: "basketball", label: "Basketball" },
  { value: "handball", label: "Handball" },
  { value: "volleyball", label: "Volleyball" },
  { value: "tennis", label: "Tennis" },
  { value: "natation", label: "Natation" },
  { value: "athletisme", label: "Athlétisme" },
  { value: "cyclisme", label: "Cyclisme" },
  { value: "boxe", label: "Boxe" },
  { value: "judo", label: "Judo" },
  { value: "musculation", label: "Musculation" },
  { value: "crossfit", label: "CrossFit" },
  { value: "yoga", label: "Yoga" },
  { value: "course", label: "Course à pied" },
  { value: "triathlon", label: "Triathlon" },
  { value: "escalade", label: "Escalade" },
  { value: "ski", label: "Ski" },
  { value: "danse", label: "Danse" },
  { value: "autre", label: "Autre" },
];

const ANTECEDENTS_LIST = [
  "Opération chirurgicale", "Fracture", "Entorse récurrente", "Tendinite chronique",
  "Lombalgie", "Hernie discale", "Problème cardiaque", "Asthme",
  "Diabète", "Trouble hormonal", "Dépression / burn-out",
];

export default function InscriptionAthletePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarRawSrc, setAvatarRawSrc] = useState<string | null>(null);
  const [croppedAvatarFile, setCroppedAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwdStrength, setPwdStrength] = useState<ReturnType<typeof validatePassword> | null>(null);
  const [cguAccepted, setCguAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [sharingAccepted, setSharingAccepted] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Step 2 — Health profile
  const [taille, setTaille] = useState("");
  const [poids, setPoids] = useState("");
  const [objectif, setObjectif] = useState("");
  const [antecedents, setAntecedents] = useState<string[]>([]);
  const [traitements, setTraitements] = useState("");
  const [contreIndications, setContreIndications] = useState("");

  // Step 3 — Health app connections
  const [healthApps, setHealthApps] = useState<Set<string>>(new Set());

  const HEALTH_APPS = [
    { id: "garmin", name: "Garmin", logo: "/Garmin.png", desc: "Activit\u00e9 / outdoor / GPS" },
    { id: "polar", name: "Polar", logo: "/Polar.png", desc: "Cardio / endurance" },
    { id: "whoop", name: "WHOOP", logo: "/WHOOP.png", desc: "Strain / r\u00e9cup\u00e9ration" },
    { id: "oura", name: "Oura", logo: "/OURA.png", desc: "Sommeil / readiness / HRV" },
  ];

  const toggleHealthApp = (id: string) => {
    setHealthApps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAntecedent = (item: string) => {
    setAntecedents((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarRawSrc(url);
    }
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleCropDone = (file: File, previewUrl: string) => {
    setCroppedAvatarFile(file);
    setAvatarPreview(previewUrl);
    setAvatarRawSrc(null);
  };

  const handleCropCancel = () => {
    setAvatarRawSrc(null);
  };

  const handleReset = () => {
    formRef.current?.reset();
    setStep(1);
    setAvatarPreview(null);
    setCroppedAvatarFile(null);
    setAvatarRawSrc(null);
    setMessage(null);
    setPwdStrength(null);
    setCguAccepted(false);
    setPrivacyAccepted(false);
    setSharingAccepted(false);
    setTaille("");
    setPoids("");
    setObjectif("");
    setAntecedents([]);
    setTraitements("");
    setContreIndications("");
    setHealthApps(new Set());
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(formRef.current!);

    // Validate CGU + Privacy acceptance
    if (!cguAccepted || !privacyAccepted || !sharingAccepted) {
      setMessage({ type: "error", text: "Vous devez accepter les CGU, la Politique de Confidentialité et la Charte de Partage pour vous inscrire." });
      setLoading(false);
      return;
    }

    formData.delete("avatar");
    if (croppedAvatarFile) {
      formData.append("avatar", croppedAvatarFile);
    }
    formData.append("cguVersion", CGU_VERSION);
    // Health profile fields (step 2)
    if (taille) formData.append("taille", taille);
    if (poids) formData.append("poids", poids);
    if (objectif) formData.append("objectif", objectif);
    if (antecedents.length > 0) formData.append("antecedents", JSON.stringify(antecedents));
    if (traitements) formData.append("traitements", traitements);
    if (contreIndications) formData.append("contreIndications", contreIndications);
    if (healthApps.size > 0) formData.append("healthApps", JSON.stringify(Array.from(healthApps)));

    try {
      const res = await fetch("/api/inscription/athlete", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
      } else if (data.requiresEmailVerification) {
        router.push(`/inscription/verifier-email?email=${encodeURIComponent(formData.get("email") as string)}`);
      } else {
        setMessage({ type: "success", text: data.message });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur de connexion au serveur." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Inscription Athlète</h1>
          <p className={styles.subtitle}>
            Créez votre compte pour suivre vos performances et communiquer avec vos professionnels de santé
          </p>
        </header>

        {message && (
          <div className={`${styles.message} ${message.type === "error" ? styles.messageError : styles.messageSuccess}`}>
            {message.text}
          </div>
        )}

        <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>

          {/* ── Step indicator ── */}
          <div className={styles.stepIndicator}>
            <div className={`${styles.stepDot} ${step >= 1 ? styles.stepDotActive : ""}`}>1</div>
            <div className={`${styles.stepLine} ${step >= 2 ? styles.stepLineActive : ""}`} />
            <div className={`${styles.stepDot} ${step >= 2 ? styles.stepDotActive : ""}`}>2</div>
            {/* TODO: HEALTH_INTEGRATIONS — Réactiver quand les APIs seront prêtes
            <div className={`${styles.stepLine} ${step >= 3 ? styles.stepLineActive : ""}`} />
            <div className={`${styles.stepDot} ${step >= 3 ? styles.stepDotActive : ""}`}>3</div>
            */}
          </div>
          <p className={styles.stepTitle}>
            {step === 1 ? "Étape 1 — Identité & compte" : "Étape 2 — Profil santé"}
          </p>

          {/* ── STEP 1: Identity & Account ── */}
          <div style={{ display: step === 1 ? "block" : "none" }}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Photo de profil</label>
                <div className={styles.avatarRow}>
                  <div
                    className={styles.avatarPreview}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {avatarPreview ? (
                      <Image
                        src={avatarPreview}
                        alt="Aperçu"
                        fill
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <span className={styles.avatarPlaceholder}>+</span>
                    )}
                  </div>
                  <div className={styles.avatarInfo}>
                    <button
                      type="button"
                      className={styles.avatarButton}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {avatarPreview ? "Changer la photo" : "Choisir une photo"}
                    </button>
                    <span className={styles.hint}>JPEG, PNG ou WebP • 5 Mo max</span>
                  </div>
                  <input
                    ref={avatarInputRef}
                    name="avatar"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    hidden
                  />
                </div>
              </div>

              {avatarRawSrc && (
                <AvatarCropModal
                  imageSrc={avatarRawSrc}
                  onCropDone={handleCropDone}
                  onCancel={handleCropCancel}
                />
              )}

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Nom *</label>
                  <input name="nom" type="text" className={styles.input} placeholder="Votre nom" required />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Prénom *</label>
                  <input name="prenom" type="text" className={styles.input} placeholder="Votre prénom" required />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Email *</label>
                  <input name="email" type="email" className={styles.input} placeholder="Votre email" required />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Confirmer l'email *</label>
                  <input name="emailConfirm" type="email" className={styles.input} placeholder="Confirmez votre email" required />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Téléphone *</label>
                <input name="telephone" type="tel" className={styles.input} placeholder="Ex: 06 12 34 56 78" required />
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Sport</label>
                  <select name="sport" className={styles.select}>
                    {sports.map((s) => (
                      <option key={s.value} value={s.value} disabled={s.value === ""}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Date de naissance</label>
                  <input name="dateNaissance" type="date" className={styles.input} />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Mot de passe *</label>
                  <input
                    name="password"
                    type="password"
                    className={styles.input}
                    placeholder="Min. 8 caractères, majuscule, chiffre, spécial"
                    minLength={8}
                    required
                    onChange={(e) => setPwdStrength(validatePassword(e.target.value))}
                  />
                  {pwdStrength && (
                    <div className={styles.pwdStrength}>
                      <div className={styles.pwdStrengthBar}>
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className={styles.pwdStrengthSeg} style={{ background: i < pwdStrength.score ? getPasswordStrengthLabel(pwdStrength.score).color : "rgba(255,255,255,0.06)" }} />
                        ))}
                      </div>
                      <span className={styles.pwdStrengthLabel} style={{ color: getPasswordStrengthLabel(pwdStrength.score).color }}>
                        {getPasswordStrengthLabel(pwdStrength.score).label}
                      </span>
                      <div className={styles.pwdChecks}>
                        {pwdStrength.checks.map((c, i) => (
                          <span key={i} className={c.met ? styles.pwdCheckMet : styles.pwdCheckUnmet}>
                            {c.met ? "✓" : "✗"} {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Confirmer le mot de passe *</label>
                  <input name="passwordConfirm" type="password" className={styles.input} placeholder="Confirmez votre mot de passe" required />
                </div>
              </div>

              <button type="button" className={styles.submitButton} onClick={() => setStep(2)}>
                Suivant — Profil santé →
              </button>
          </div>

          {/* ── STEP 2: Health Profile ── */}
          <div style={{ display: step === 2 ? "block" : "none" }}>
              <p className={styles.hint} style={{ textAlign: "center", marginBottom: 8 }}>
                Ces informations sont optionnelles mais très utiles pour vos professionnels de santé.
              </p>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Objectif principal</label>
                <input
                  type="text"
                  className={styles.input}
                  value={objectif}
                  onChange={(e) => setObjectif(e.target.value)}
                  placeholder="Ex: reprendre après blessure, perdre du poids, performance..."
                />
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Taille (cm)</label>
                  <input type="number" className={styles.input} value={taille} onChange={(e) => setTaille(e.target.value)} placeholder="175" />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Poids (kg)</label>
                  <input type="number" className={styles.input} value={poids} onChange={(e) => setPoids(e.target.value)} placeholder="70" />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Antécédents médicaux</label>
                <span className={styles.hint}>Sélectionnez ceux qui vous concernent</span>
                <div className={styles.chipGroup}>
                  {ANTECEDENTS_LIST.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`${styles.chip} ${antecedents.includes(a) ? styles.chipActive : ""}`}
                      onClick={() => toggleAntecedent(a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Traitements en cours</label>
                <textarea
                  className={styles.input}
                  value={traitements}
                  onChange={(e) => setTraitements(e.target.value)}
                  placeholder="Médicaments, compléments, thérapies en cours..."
                  rows={2}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Contre-indications</label>
                <textarea
                  className={styles.input}
                  value={contreIndications}
                  onChange={(e) => setContreIndications(e.target.value)}
                  placeholder="Mouvements, activités ou aliments à éviter..."
                  rows={2}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div className={styles.cguField}>
                <label className={styles.cguLabel}>
                  <input type="checkbox" className={styles.cguCheckbox} checked={cguAccepted} onChange={(e) => setCguAccepted(e.target.checked)} />
                  <span className={styles.cguText}>
                    J&apos;ai lu et j&apos;accepte les{" "}
                    <Link href="/cgu" target="_blank" className={styles.cguLink}>Conditions Générales d&apos;Utilisation</Link>
                    {" "}(version {CGU_VERSION})
                  </span>
                </label>
              </div>

              <div className={styles.cguField}>
                <label className={styles.cguLabel}>
                  <input type="checkbox" className={styles.cguCheckbox} checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
                  <span className={styles.cguText}>
                    J&apos;ai lu et j&apos;accepte la{" "}
                    <Link href="/confidentialite" target="_blank" className={styles.cguLink}>Politique de Confidentialité</Link>
                    {" "}(version {PRIVACY_VERSION})
                  </span>
                </label>
              </div>

              <div className={styles.cguField}>
                <label className={styles.cguLabel}>
                  <input type="checkbox" className={styles.cguCheckbox} checked={sharingAccepted} onChange={(e) => setSharingAccepted(e.target.checked)} />
                  <span className={styles.cguText}>
                    J&apos;ai lu et j&apos;accepte la{" "}
                    <Link href="/charte-partage" target="_blank" className={styles.cguLink}>Charte de Partage des Données</Link>
                    {" "}(version {SHARING_VERSION})
                  </span>
                </label>
              </div>

              <div className={styles.row}>
                <button type="button" className={styles.resetButton} onClick={() => setStep(1)}>
                  ← Retour
                </button>
                {/* TODO: HEALTH_INTEGRATIONS — Réactiver quand les APIs seront prêtes
                <button type="button" className={styles.submitButton} onClick={() => setStep(3)}>
                  Suivant — Applis santé →
                </button>
                */}
                <button type="submit" className={styles.submitButton} disabled={loading || !cguAccepted || !privacyAccepted || !sharingAccepted}>
                  {loading ? "Inscription en cours..." : "Créer mon compte"}
                </button>
              </div>
          </div>

          {/* TODO: HEALTH_INTEGRATIONS — Réactiver quand les APIs seront prêtes */}
          {/* ── STEP 3: Health App Connections ── */}
          <div style={{ display: "none" /* step === 3 ? "block" : "none" */ }}>
              <p className={styles.hint} style={{ textAlign: "center", marginBottom: 4 }}>
                Connectez vos appareils et applications de santé pour enrichir votre profil.
              </p>
              <p className={styles.hint} style={{ textAlign: "center", marginBottom: 16 }}>
                Cette étape est optionnelle — vous pourrez le faire plus tard.
              </p>

              <div className={styles.healthAppGrid}>
                {HEALTH_APPS.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className={`${styles.healthAppCard} ${healthApps.has(app.id) ? styles.healthAppCardActive : ""}`}
                    onClick={() => toggleHealthApp(app.id)}
                  >
                    <div className={styles.healthAppLogo}>
                      <Image src={app.logo} alt={app.name} width={48} height={48} />
                    </div>
                    <div className={styles.healthAppInfo}>
                      <span className={styles.healthAppName}>{app.name}</span>
                      <span className={styles.healthAppDesc}>{app.desc}</span>
                    </div>
                    <div className={`${styles.healthAppCheck} ${healthApps.has(app.id) ? styles.healthAppCheckActive : ""}`}>
                      {healthApps.has(app.id) ? (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {healthApps.size > 0 && (
                <p className={styles.healthAppSelected}>
                  {healthApps.size} application{healthApps.size > 1 ? "s" : ""} sélectionnée{healthApps.size > 1 ? "s" : ""}
                </p>
              )}

              <div className={styles.cguField}>
                <label className={styles.cguLabel}>
                  <input type="checkbox" className={styles.cguCheckbox} checked={cguAccepted} onChange={(e) => setCguAccepted(e.target.checked)} />
                  <span className={styles.cguText}>
                    J'ai lu et j'accepte les{" "}
                    <Link href="/cgu" target="_blank" className={styles.cguLink}>Conditions Générales d'Utilisation</Link>
                    {" "}(version {CGU_VERSION})
                  </span>
                </label>
              </div>

              <div className={styles.cguField}>
                <label className={styles.cguLabel}>
                  <input type="checkbox" className={styles.cguCheckbox} checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
                  <span className={styles.cguText}>
                    J'ai lu et j'accepte la{" "}
                    <Link href="/confidentialite" target="_blank" className={styles.cguLink}>Politique de Confidentialité</Link>
                    {" "}(version {PRIVACY_VERSION})
                  </span>
                </label>
              </div>

              <div className={styles.cguField}>
                <label className={styles.cguLabel}>
                  <input type="checkbox" className={styles.cguCheckbox} checked={sharingAccepted} onChange={(e) => setSharingAccepted(e.target.checked)} />
                  <span className={styles.cguText}>
                    J'ai lu et j'accepte la{" "}
                    <Link href="/charte-partage" target="_blank" className={styles.cguLink}>Charte de Partage des Données</Link>
                    {" "}(version {SHARING_VERSION})
                  </span>
                </label>
              </div>

              <div className={styles.row}>
                <button type="button" className={styles.resetButton} onClick={() => setStep(2)}>
                  ← Retour
                </button>
                <button type="submit" className={styles.submitButton} disabled={loading || !cguAccepted || !privacyAccepted || !sharingAccepted}>
                  {loading ? "Inscription en cours..." : "Créer mon compte"}
                </button>
              </div>
          </div>

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            Vider le formulaire
          </button>
        </form>

        <p className={styles.loginLink}>
          Déjà inscrit ?{" "}
          <Link href="/">Connectez-vous</Link>
        </p>
      </div>
    </div>
  );
}
