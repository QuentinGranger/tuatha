"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import styles from "./page.module.scss";

const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const servicesBySpecialite: Record<string, string[]> = {
  medecin: [
    "Consultation générale",
    "Médecine du sport",
    "Certificat médical",
    "Suivi de blessure",
    "Prescription d'examens",
    "Bilan de santé sportif",
  ],
  kine: [
    "Rééducation fonctionnelle",
    "Kinésithérapie respiratoire",
    "Kinésithérapie du sport",
    "Drainage lymphatique",
    "Rééducation post-opératoire",
    "Thérapie manuelle",
  ],
  dieteticien: [
    "Bilan diététique",
    "Plan alimentaire personnalisé",
    "Suivi diététique",
    "Nutrition du sportif",
    "Rééquilibrage alimentaire",
    "Éducation nutritionnelle",
  ],
  autre: [
    "Préparation physique",
    "Remise en forme",
    "Coaching personnalisé",
    "Programme de musculation",
    "HIIT / Cardio training",
    "Récupération sportive",
  ],
};

const calendrierOptions = [
  { type: "calendly", label: "Calendly", logo: "/LogoCalendly.webp" },
  { type: "google", label: "Google Calendar", logo: "/LogoGoogleCalendar.png" },
];

interface Disponibilite {
  jourDebut: string;
  jourFin: string;
  heureDebut: string;
  heureFin: string;
}

export default function ConfigurationPage() {
  return (
    <Suspense fallback={<div className={styles.page}><div className={styles.container}><p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)" }}>Chargement...</p></div></div>}>
      <ConfigurationContent />
    </Suspense>
  );
}

function ConfigurationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const professionnelId = searchParams.get("id") || "";
  const specialite = searchParams.get("specialite") || "";
  const email = searchParams.get("email") || "";

  const suggestedServices = servicesBySpecialite[specialite] || [];

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState("");
  const [customServices, setCustomServices] = useState<string[]>([]);

  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([
    { jourDebut: "Lundi", jourFin: "Vendredi", heureDebut: "09:00", heureFin: "18:00" },
  ]);

  const googleConnected = searchParams.get("google") === "connected";
  const calendlyConnected = searchParams.get("calendly") === "connected";
  const authError = searchParams.get("error");

  const [calendriers, setCalendriers] = useState<Record<string, boolean>>({
    calendly: calendlyConnected,
    google: googleConnected,
  });

  const [adresse, setAdresse] = useState("");
  const [placeData, setPlaceData] = useState<{
    latitude: number;
    longitude: number;
    placeId: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    authError === "google_auth_failed"
      ? { type: "error", text: "Échec de la connexion à Google Calendar." }
      : authError === "calendly_auth_failed"
        ? { type: "error", text: "Échec de la connexion à Calendly." }
        : null
  );

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  const addCustomService = () => {
    const trimmed = customService.trim();
    if (trimmed && !customServices.includes(trimmed)) {
      setCustomServices((prev) => [...prev, trimmed]);
      setCustomService("");
    }
  };

  const removeCustomService = (service: string) => {
    setCustomServices((prev) => prev.filter((s) => s !== service));
  };

  const addDisponibilite = () => {
    setDisponibilites((prev) => [
      ...prev,
      { jourDebut: "Lundi", jourFin: "Vendredi", heureDebut: "09:00", heureFin: "18:00" },
    ]);
  };

  const updateDisponibilite = (index: number, field: keyof Disponibilite, value: string) => {
    setDisponibilites((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const removeDisponibilite = (index: number) => {
    if (disponibilites.length > 1) {
      setDisponibilites((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const toggleCalendrier = (type: string) => {
    if (type === "google" && !calendriers.google) {
      window.location.href = `/api/auth/google?professionnelId=${professionnelId}`;
      return;
    }
    if (type === "calendly" && !calendriers.calendly) {
      window.location.href = `/api/auth/calendly?professionnelId=${professionnelId}`;
      return;
    }
    setCalendriers((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);

    const allServices = [
      ...selectedServices.map((nom) => ({ nom, personnalise: false })),
      ...customServices.map((nom) => ({ nom, personnalise: true })),
    ];

    const calArray = calendrierOptions.map((c) => ({
      type: c.type,
      actif: calendriers[c.type],
    }));

    try {
      const res = await fetch("/api/inscription/professionnel/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionnelId,
          services: allServices,
          disponibilites,
          calendriers: calArray,
          adresseCabinet: adresse,
          latitude: placeData?.latitude || null,
          longitude: placeData?.longitude || null,
          placeId: placeData?.placeId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
      } else {
        setMessage({ type: "success", text: "Configuration enregistrée ! Vérifiez votre email pour activer votre compte." });
        setTimeout(() => router.push(`/inscription/verifier-email?email=${encodeURIComponent(email)}`), 1500);
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
          <h1 className={styles.title}>Configuration des Services</h1>
          <p className={styles.subtitle}>
            Configurez les services que vous proposez à vos patients
          </p>
        </header>

        {message && (
          <div className={`${styles.message} ${message.type === "error" ? styles.messageError : styles.messageSuccess}`}>
            {message.text}
          </div>
        )}

        {/* ── Services ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Vos services</h2>

          <div className={styles.servicesGrid}>
            {suggestedServices.map((service) => (
              <button
                key={service}
                type="button"
                className={`${styles.serviceChip} ${selectedServices.includes(service) ? styles.serviceChipActive : ""}`}
                onClick={() => toggleService(service)}
              >
                {service}
              </button>
            ))}
          </div>

          <div className={styles.customServiceRow}>
            <input
              type="text"
              className={styles.input}
              placeholder="Ajouter un service personnalisé"
              value={customService}
              onChange={(e) => setCustomService(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomService();
                }
              }}
            />
            <button type="button" className={styles.addBtn} onClick={addCustomService}>
              +
            </button>
          </div>

          {customServices.length > 0 && (
            <div className={styles.servicesGrid}>
              {customServices.map((service) => (
                <button
                  key={service}
                  type="button"
                  className={`${styles.serviceChip} ${styles.serviceChipCustom}`}
                  onClick={() => removeCustomService(service)}
                  title="Cliquer pour supprimer"
                >
                  {service} ✕
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Disponibilités ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Configurer les jours et horaires de disponibilité</h2>

          {disponibilites.map((dispo, index) => (
            <div key={index} className={styles.dispoRow}>
              <span className={styles.dispoLabel}>Je suis disponible du</span>
              <select
                className={styles.selectSmall}
                value={dispo.jourDebut}
                onChange={(e) => updateDisponibilite(index, "jourDebut", e.target.value)}
              >
                {jours.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>

              <span className={styles.dispoLabel}>au</span>
              <select
                className={styles.selectSmall}
                value={dispo.jourFin}
                onChange={(e) => updateDisponibilite(index, "jourFin", e.target.value)}
              >
                {jours.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>

              <span className={styles.dispoLabel}>de</span>
              <input
                type="time"
                className={styles.timeInput}
                value={dispo.heureDebut}
                onChange={(e) => updateDisponibilite(index, "heureDebut", e.target.value)}
              />

              <span className={styles.dispoLabel}>à</span>
              <input
                type="time"
                className={styles.timeInput}
                value={dispo.heureFin}
                onChange={(e) => updateDisponibilite(index, "heureFin", e.target.value)}
              />

              {disponibilites.length > 1 && (
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeDisponibilite(index)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button type="button" className={styles.addDateBtn} onClick={addDisponibilite}>
            + Ajouter une autre plage
          </button>
        </section>

        {/* ── Synchronisation ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Synchronisation avec des outils externes</h2>

          <div className={styles.calendriersGrid}>
            {calendrierOptions.map((cal) => (
              <button
                key={cal.type}
                type="button"
                className={`${styles.calendarCard} ${calendriers[cal.type] ? styles.calendarCardActive : ""}`}
                onClick={() => toggleCalendrier(cal.type)}
              >
                <span className={styles.calendarIcon}>
                  <Image src={cal.logo} alt={cal.label} width={28} height={28} />
                </span>
                <span className={styles.calendarLabel}>{cal.label}</span>
                {calendriers[cal.type] && (
                  <span className={styles.calendarStatus}>Connecté</span>
                )}
              </button>
            ))}
          </div>

        </section>

        {/* ── Adresse ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Adresse du cabinet</h2>
          <p className={styles.sectionSubtitle}>Retrouvez-moi à l&apos;adresse suivante :</p>
          <AddressAutocomplete
            value={adresse}
            onChange={setAdresse}
            onSelect={(place) => {
              setAdresse(place.address);
              setPlaceData({
                latitude: place.latitude,
                longitude: place.longitude,
                placeId: place.placeId,
              });
            }}
            placeholder="Rechercher l'adresse de votre cabinet..."
            className={styles.input}
          />
          {placeData && (
            <p className={styles.addressConfirm}>✓ Adresse vérifiée</p>
          )}
        </section>

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <Link href="/inscription/professionnel" className={styles.backBtn}>
            Retour
          </Link>
          <button
            type="button"
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Enregistrement..." : "Terminer la configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
