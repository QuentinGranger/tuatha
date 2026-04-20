"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AvatarCropModal from "@/components/AvatarCropModal";
import { validatePassword, getPasswordStrengthLabel } from "@/lib/security";
import { CGU_VERSION } from "@/lib/cgu";
import { CGU_PRO_VERSION } from "@/lib/cgupro";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { SHARING_VERSION } from "@/lib/dataSharing";
import { SPECIALITE_LIST, SPECIALITES } from "@/lib/specialites";
import styles from "./page.module.scss";

const specialties = [
  { value: "", label: "Sélectionnez votre spécialité" },
  ...SPECIALITE_LIST.map((s) => ({ value: s.value, label: s.label })),
];

const verificationFields: Record<string, { label: string; placeholder: string; hint: string; pattern: RegExp; example: string }> = Object.fromEntries(
  SPECIALITE_LIST.map((s) => [
    s.value,
    { label: s.verificationLabel, placeholder: s.verificationPlaceholder, hint: s.verificationHint, pattern: s.verificationPattern, example: s.verificationExample },
  ])
);

export default function InscriptionProfessionnelPage() {
  const router = useRouter();
  const [specialty, setSpecialty] = useState("");
  const [statutExercice, setStatutExercice] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarRawSrc, setAvatarRawSrc] = useState<string | null>(null);
  const [croppedAvatarFile, setCroppedAvatarFile] = useState<File | null>(null);
  const [documentFileName, setDocumentFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [verifError, setVerifError] = useState<string | null>(null);
  const [verifTouched, setVerifTouched] = useState(false);
  const [pwdStrength, setPwdStrength] = useState<ReturnType<typeof validatePassword> | null>(null);
  const [cguAccepted, setCguAccepted] = useState(false);
  const [cguProAccepted, setCguProAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [sharingAccepted, setSharingAccepted] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const verif = verificationFields[specialty];

  const validateVerifNumber = (value: string): string | null => {
    if (!verif || !value.trim()) return null;
    const trimmed = value.trim().toUpperCase();
    if (!verif.pattern.test(trimmed)) {
      if (specialty === "autre") {
        return `Format invalide. Attendu : carte pro (5 chiffres + ED + 4 chiffres) ou SIRET (14 chiffres) (ex : ${verif.example})`;
      }
      return `Format invalide. Le numéro RPPS doit contenir exactement 11 chiffres (ex : ${verif.example})`;
    }
    return null;
  };

  const handleVerifChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (verifTouched) {
      setVerifError(validateVerifNumber(e.target.value));
    }
  };

  const handleVerifBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setVerifTouched(true);
    setVerifError(validateVerifNumber(e.target.value));
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

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setDocumentFileName(file ? file.name : null);
  };

  const handleReset = () => {
    formRef.current?.reset();
    setSpecialty("");
    setAvatarPreview(null);
    setCroppedAvatarFile(null);
    setAvatarRawSrc(null);
    setDocumentFileName(null);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(formRef.current!);

    // Validate verification number before submit
    if (verif) {
      const verifValue = formData.get("numeroVerification") as string || "";
      const err = validateVerifNumber(verifValue);
      if (err) {
        setVerifError(err);
        setVerifTouched(true);
        setLoading(false);
        return;
      }
      // Normalize verification number to uppercase (carte pro format)
      if (specialty === "autre") {
        formData.set("numeroVerification", verifValue.trim().toUpperCase());
      }
    }

    // Validate CGU + Privacy acceptance
    if (!cguAccepted || !cguProAccepted || !privacyAccepted || !sharingAccepted) {
      setMessage({ type: "error", text: "Vous devez accepter les CGU, les CGU Pro, la Politique de Confidentialité et la Charte de Partage pour vous inscrire." });
      setLoading(false);
      return;
    }

    formData.delete("avatar");
    if (croppedAvatarFile) {
      formData.append("avatar", croppedAvatarFile);
    }
    formData.append("cguVersion", CGU_VERSION);
    formData.append("cguProVersion", CGU_PRO_VERSION);

    try {
      const res = await fetch("/api/inscription/professionnel", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
      } else {
        router.push(
          `/inscription/professionnel/paiement?id=${data.id}&specialite=${formData.get("specialite")}&email=${encodeURIComponent(formData.get("email") as string)}`
        );
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
          <h1 className={styles.title}>Inscription Professionnel</h1>
          <p className={styles.subtitle}>
            Créez votre compte professionnel de santé
          </p>
        </header>

        {message && (
          <div className={`${styles.message} ${message.type === "error" ? styles.messageError : styles.messageSuccess}`}>
            {message.text}
          </div>
        )}

        <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
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
              <input
                name="nom"
                type="text"
                className={styles.input}
                placeholder="Votre nom"
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Prénom *</label>
              <input
                name="prenom"
                type="text"
                className={styles.input}
                placeholder="Votre prénom"
                required
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email *</label>
              <input
                name="email"
                type="email"
                className={styles.input}
                placeholder="Votre email"
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Confirmer l&apos;email *</label>
              <input
                name="emailConfirm"
                type="email"
                className={styles.input}
                placeholder="Confirmez votre email"
                required
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Téléphone *</label>
            <input
              name="telephone"
              type="tel"
              className={styles.input}
              placeholder="Ex: 06 12 34 56 78"
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Spécialité *</label>
            <select
              name="specialite"
              className={styles.select}
              value={specialty}
              onChange={(e) => { setSpecialty(e.target.value); setVerifError(null); setVerifTouched(false); }}
              required
            >
              {specialties.map((s) => (
                <option key={s.value} value={s.value} disabled={s.value === ""}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Statut d&apos;exercice *</label>
            <select
              name="statutExercice"
              className={styles.select}
              value={statutExercice}
              onChange={(e) => setStatutExercice(e.target.value)}
              required
            >
              <option value="" disabled>Sélectionnez votre statut</option>
              <option value="liberal">Libéral</option>
              <option value="salarie">Salarié</option>
              <option value="mixte">Mixte (libéral + salarié)</option>
              <option value="remplacant">Remplaçant</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          {verif && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{verif.label}</label>
              <input
                name="numeroVerification"
                type="text"
                className={`${styles.input} ${verifError && verifTouched ? styles.inputError : ''}`}
                placeholder={verif.placeholder}
                required
                maxLength={specialty === "coach" ? 11 : 11}
                onChange={handleVerifChange}
                onBlur={handleVerifBlur}
              />
              <span className={styles.hint}>{verif.hint}</span>
              {verifError && verifTouched && (
                <span className={styles.fieldError}>{verifError}</span>
              )}
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Document de vérification *</label>
            <div
              className={styles.fileInput}
              onClick={() => documentInputRef.current?.click()}
            >
              <span className={documentFileName ? styles.fileChosen : styles.filePlaceholder}>
                {documentFileName || "Aucun fichier choisi"}
              </span>
            </div>
            <input
              ref={documentInputRef}
              name="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleDocumentChange}
              hidden
            />
            <span className={styles.hint}>
              PDF, JPEG ou PNG • Diplôme, certificat ou justificatif professionnel
            </span>
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
              <input
                name="passwordConfirm"
                type="password"
                className={styles.input}
                placeholder="Confirmez votre mot de passe"
                required
              />
            </div>
          </div>

          <div className={styles.cguField}>
            <label className={styles.cguLabel}>
              <input
                type="checkbox"
                className={styles.cguCheckbox}
                checked={cguAccepted}
                onChange={(e) => setCguAccepted(e.target.checked)}
              />
              <span className={styles.cguText}>
                J&apos;ai lu et j&apos;accepte les{" "}
                <Link href="/cgu" target="_blank" className={styles.cguLink}>
                  Conditions G&eacute;n&eacute;rales d&apos;Utilisation
                </Link>
                {" "}(version {CGU_VERSION})
              </span>
            </label>
          </div>

          <div className={styles.cguField}>
            <label className={styles.cguLabel}>
              <input
                type="checkbox"
                className={styles.cguCheckbox}
                checked={cguProAccepted}
                onChange={(e) => setCguProAccepted(e.target.checked)}
              />
              <span className={styles.cguText}>
                J&apos;ai lu et j&apos;accepte les{" "}
                <Link href="/cgu-pro" target="_blank" className={styles.cguLink}>
                  CGU Professionnel
                </Link>
                {" "}(version {CGU_PRO_VERSION})
              </span>
            </label>
          </div>

          <div className={styles.cguField}>
            <label className={styles.cguLabel}>
              <input
                type="checkbox"
                className={styles.cguCheckbox}
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
              />
              <span className={styles.cguText}>
                J&apos;ai lu et j&apos;accepte la{" "}
                <Link href="/confidentialite" target="_blank" className={styles.cguLink}>
                  Politique de Confidentialit&eacute;
                </Link>
                {" "}(version {PRIVACY_VERSION})
              </span>
            </label>
          </div>

          <div className={styles.cguField}>
            <label className={styles.cguLabel}>
              <input
                type="checkbox"
                className={styles.cguCheckbox}
                checked={sharingAccepted}
                onChange={(e) => setSharingAccepted(e.target.checked)}
              />
              <span className={styles.cguText}>
                J&apos;ai lu et j&apos;accepte la{" "}
                <Link href="/charte-partage" target="_blank" className={styles.cguLink}>
                  Charte de Partage des Donn&eacute;es
                </Link>
                {" "}(version {SHARING_VERSION})
              </span>
            </label>
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading || !cguAccepted || !cguProAccepted || !privacyAccepted || !sharingAccepted}>
            {loading ? "Inscription en cours..." : "Continuer"}
          </button>

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
