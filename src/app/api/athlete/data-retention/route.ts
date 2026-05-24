// ─── Document de rétention des données (RGPD Art. 13/14) ───
//
// GET /api/athlete/data-retention
//
// Retourne le mapping complet des données conservées vs supprimées
// lors de la suppression d'un compte athlète.
// Accessible par tout athlète authentifié (transparence RGPD).

import { NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// ─── Mapping rétention : données supprimées vs conservées ───

const RETENTION_MAP = {
  suppression_compte: {
    description:
      "Lors de la suppression de votre compte, les données suivantes sont traitées conformément au RGPD et au droit français.",

    donnees_supprimees: [
      {
        categorie: "Profil personnel",
        donnees: ["Nom", "Prénom", "Email", "Téléphone", "Date de naissance", "Photo de profil"],
        delai: "Immédiat",
        base_legale: "RGPD Art. 17 — Droit à l'effacement",
      },
      {
        categorie: "Données de santé",
        donnees: ["Antécédents", "Traitements", "Contre-indications", "Taille", "Poids", "Sport", "Objectif"],
        delai: "Immédiat",
        base_legale: "RGPD Art. 17 — Données sensibles (Art. 9)",
      },
      {
        categorie: "Connexions professionnels",
        donnees: ["Demandes de connexion", "Paramètres de confidentialité", "Accès aux pros"],
        delai: "Immédiat (révocation puis suppression)",
        base_legale: "RGPD Art. 17 — Consentement retiré",
      },
      {
        categorie: "Messages",
        donnees: ["Messages avec professionnels", "Conversations de groupe"],
        delai: "Immédiat",
        base_legale: "RGPD Art. 17 — Droit à l'effacement",
      },
      {
        categorie: "Documents",
        donnees: ["Documents uploadés", "Documents partagés"],
        delai: "Immédiat",
        base_legale: "RGPD Art. 17 — Droit à l'effacement",
      },
      {
        categorie: "Rendez-vous",
        donnees: ["Événements calendrier", "Préparations de consultation", "Rappels"],
        delai: "Immédiat",
        base_legale: "RGPD Art. 17 — Droit à l'effacement",
      },
      {
        categorie: "Données connectées (santé)",
        donnees: ["Connexions Garmin/Polar/WHOOP/Oura", "Données de santé synchronisées", "Tokens OAuth"],
        delai: "Immédiat (tokens révoqués puis supprimés)",
        base_legale: "RGPD Art. 17 — Consentement retiré",
      },
      {
        categorie: "Nutrition",
        donnees: ["Journaux nutritionnels", "Entrées personnalisées"],
        delai: "Immédiat",
        base_legale: "RGPD Art. 17 — Droit à l'effacement",
      },
      {
        categorie: "Sessions et sécurité",
        donnees: ["Sessions actives", "Tokens d'authentification", "Historique de connexion"],
        delai: "Immédiat (révocation puis suppression)",
        base_legale: "RGPD Art. 17 — Sécurité",
      },
      {
        categorie: "Consentements",
        donnees: ["Historique des consentements"],
        delai: "Immédiat",
        base_legale: "RGPD Art. 17 — Droit à l'effacement",
      },
    ],

    donnees_conservees: [
      {
        categorie: "Factures et paiements",
        donnees: [
          "Montant des paiements",
          "Date des transactions",
          "Numéros de facture",
          "Références Stripe (anonymisées)",
        ],
        duree_conservation: "10 ans",
        base_legale: "Code de commerce Art. L.123-22 — Conservation des pièces comptables",
        note: "Les données personnelles associées (nom, email) sont anonymisées. Seules les données financières nécessaires à la comptabilité sont conservées.",
      },
      {
        categorie: "Logs de sécurité minimaux",
        donnees: ["Date de suppression du compte", "Type d'action (suppression)"],
        duree_conservation: "1 an",
        base_legale: "RGPD Art. 5(1)(f) — Sécurité du traitement ; Intérêt légitime",
        note: "Log minimal sans données personnelles, uniquement pour traçabilité en cas de fraude.",
      },
    ],

    procedure: [
      "1. Authentification forte (mot de passe requis)",
      "2. Révocation de toutes les connexions professionnels",
      "3. Révocation des tokens OAuth externes (appareils connectés)",
      "4. Révocation de toutes les sessions actives",
      "5. Anonymisation des données comptables conservées",
      "6. Suppression définitive du compte et de toutes les données personnelles",
      "7. Envoi d'un email de confirmation",
    ],

    droits_exercables: {
      export: "GET /api/athlete/export-data — Export complet au format JSON",
      suppression: "DELETE /api/athlete/delete-account — Suppression définitive avec confirmation par mot de passe",
      acces: "GET /api/athlete/export-data — Consultation de toutes vos données",
    },

    contact: "support@tuatha-app.com",
  },
} as const;

export async function GET() {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.json(RETENTION_MAP);
}
