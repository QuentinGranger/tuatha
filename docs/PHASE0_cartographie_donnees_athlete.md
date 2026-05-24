# PHASE 0.1 — Cartographie des données athlète

> Document généré le 2025-04-26 — Tuatha-pro  
> Référence : schema.prisma (1901 lignes), 56 routes API `/api/athlete/*`

---

## 1. Vue d'ensemble des modèles Prisma liés à l'athlète

L'athlète est représenté par **deux entités distinctes** :

| Entité | Rôle | Créé par |
|--------|------|----------|
| `AthleteUser` | Compte autonome de l'athlète (inscription, auth, app mobile/web) | L'athlète lui-même |
| `Athlete` | Fiche patient côté professionnel (dossier de suivi) | Le professionnel |

La liaison entre les deux se fait via `ConnectionRequest` (acceptée) + `CalendarEvent.athleteUserId`.

---

## 2. Inventaire des données (data_inventory)

### 2.1 — Données saisies par l'athlète

| Donnée | Modèle Prisma | Champs | Catégorie | Sensible | Finalité | Base légale | Qui lit | Qui écrit | Qui supprime | Durée conservation | Stockage |
|--------|---------------|--------|-----------|----------|----------|-------------|---------|-----------|--------------|-------------------|----------|
| **Profil identité** | `AthleteUser` | `nom, prenom, email, telephone` | Identité | Non | Identification, contact | Contrat (B6a) | Athlète, Pros connectés (filtré par privacy) | Athlète | Athlète (suppression compte) | Durée du compte + 3 ans | PostgreSQL |
| **Données physiques** | `AthleteUser` | `taille, poids, dateNaissance` | Santé contextualisée | **Oui** (poids = sensible selon contexte) | Suivi médical/sportif | Consentement explicite (A9§2a) | Athlète, Pros si `sharePhysical=true` | Athlète | Athlète | Durée du compte | PostgreSQL |
| **Sport & objectif** | `AthleteUser` | `sport, objectif` | Sport | Non | Personnalisation suivi | Intérêt légitime (B6f) | Athlète, Pros si `shareSport=true` | Athlète | Athlète | Durée du compte | PostgreSQL |
| **Antécédents médicaux** | `AthleteUser` | `antecedents, traitements, contreIndications` | **Santé** | **Oui** | Sécurité des soins | Consentement explicite (A9§2a) | Athlète, Pros si `shareAntecedents/Traitements/Contraindic=true` | Athlète | Athlète | Durée du compte | PostgreSQL |
| **Avatar** | `AthleteUser` | `avatarPath` | Identité | Non | UX | Consentement | Athlète, Pros si `sharePhoto=true` | Athlète | Athlète | Durée du compte | Filesystem (uploads/) |
| **Préparation consultation** | `ConsultationPrep` | `motifDetail, symptoms, painLevel, fatigueLevel, evolution, questionnaire, documents` | **Santé** | **Oui** | Préparation RDV | Consentement explicite | Athlète, Pro du RDV | Athlète | Cascade (suppression event) | Durée du RDV + archivage | PostgreSQL |
| **Feedback séance** | `Session` | `rpeRessenti, douleur, douleurZone, feedbackAthlete` | **Santé** | **Oui** (douleur) | Suivi sportif/kiné | Consentement | Athlète (via API feedback), Pro propriétaire | Athlète | Pro (soft-delete) | Durée du programme | PostgreSQL |
| **Log exercices kiné** | `ExerciseLog` | `done, pain, difficulty, comment` | **Santé** | **Oui** (pain) | Suivi rééducation | Consentement | Pro propriétaire du plan | Athlète | Cascade (suppression plan) | Durée du plan kiné | PostgreSQL |
| **Journal nutrition** | `NutriDayLog` | `date, mealItemId, consumed` | Santé/Sport | Contextuel | Suivi alimentaire | Consentement | Pros nutritionnistes connectés | Athlète | Athlète | Durée connexion | PostgreSQL |
| **Aliments personnalisés** | `NutriCustomEntry` | `name, quantity, unit, kcal, protein, carbs, fat` | Sport/Nutrition | Non | Suivi alimentaire | Consentement | Pro nutritionniste | Athlète | Athlète | Durée connexion | PostgreSQL |
| **Mesures nutritionnelles** | `NutriMeasure` | `weight, bmi, bodyFat, waist, hydration` | **Santé** | **Oui** (poids, bodyFat) | Suivi pondéral | Consentement explicite | Pro nutritionniste | Athlète (ou Pro) | Pro | Durée suivi | PostgreSQL |
| **Messages athlète→pro** | `AthleteProMessage` | `content, attachments` | Communication | Contextuel (si contenu santé) | Échange patient-pro | Contrat (B6b) | Athlète, Pro destinataire | Athlète ou Pro | Aucun (pas de hard delete) | Durée connexion | PostgreSQL |
| **Messages groupe** | `AthleteGroupMessage` | `content, attachments` | Communication | Contextuel | Coordination équipe | Contrat | Athlète, Pros membres du groupe | Athlète ou Pro | Aucun | Durée du groupe | PostgreSQL |
| **Documents envoyés** | `AthleteDocument` | `filename, originalName, mimeType, filePath, category, note` | **Santé** | **Oui** (selon contenu) | Partage docs médicaux | Consentement explicite | Athlète, Pro destinataire | Athlète | Athlète (soft-delete) | Durée connexion | Filesystem + PostgreSQL |
| **Vidéos athlète** | `AthleteVideo` | `filename, filePath, note` | Sport/Santé | Contextuel | Analyse mouvement | Consentement | Athlète (upload), Pro | Athlète (via upload token) | Pro (soft-delete) | Durée suivi | Filesystem + PostgreSQL |
| **Signalement retard** | `BookingReminder` via `/notify-delay` | `eventMotif` | Logistique | Non | Gestion RDV | Intérêt légitime | Pro du RDV | Athlète | Système (automatique) | 30 jours post-RDV | PostgreSQL |
| **Réglages confidentialité** | `AthletePrivacySettings` | `shareSport, sharePhysical, shareAntecedents, shareTraitements, shareContraindic, shareVitals, shareConsultPrep, sharePhoto, shareMessaging` | Technique/RGPD | Non | Contrôle accès | Obligation légale (RGPD) | Athlète, Système | Athlète | Athlète | Durée connexion | PostgreSQL |
| **Réponse demande d'accès** | `DataAccessRequest` | `status, respondedAt` | Technique/RGPD | Non | Gestion consentement granulaire | Obligation légale | Athlète, Pro demandeur | Athlète (accept/reject) | Système | Durée connexion | PostgreSQL |
| **Préférences notification** | `localStorage` | `tuatha_notif_enabled` | Technique | Non | UX | Intérêt légitime | Athlète (client-side) | Athlète | Athlète | Durée navigateur | localStorage (client) |

### 2.2 — Données créées par les professionnels (visibles par l'athlète)

| Donnée | Modèle Prisma | Catégorie | Sensible | Qui lit | Qui écrit | Qui supprime | Stockage |
|--------|---------------|-----------|----------|---------|-----------|--------------|----------|
| **Fiche patient** | `Athlete` | Santé | **Oui** (injuryNote, antecedents, traitements) | Pro propriétaire, Pros invités (permissions) | Pro | Pro (soft-delete) | PostgreSQL |
| **Notes cliniques** | `MedClinicalNote` | **Santé** | **Oui** | Pro propriétaire (notePatient visible athlète si set) | Pro médecin | Pro | PostgreSQL |
| **Ordonnances** | `MedOrdonnance` | **Santé** | **Oui** | Athlète (via API), Pro | Pro médecin | Pro (soft-delete) | PostgreSQL |
| **Prescriptions** | `MedPrescription` | **Santé** | **Oui** | Athlète (si visiblePatient), Pro | Pro médecin | Pro | PostgreSQL |
| **Protocoles médicaux** | `MedProtocol` | **Santé** | **Oui** | Athlète (via API), Pro | Pro médecin | Pro (soft-delete) | PostgreSQL |
| **Plan de soins** | `MedPlan` | **Santé** | **Oui** | Athlète (via API), Pro | Pro médecin | Pro | PostgreSQL |
| **Constantes vitales** | `MedVitalEntry` | **Santé** | **Oui** (douleur, fatigue, FC, TA, SpO2, température) | Athlète (si shareVitals), Pro | Pro médecin ou Athlète (via API) | Pro | PostgreSQL |
| **Alertes médicales** | `MedAlert` | **Santé** | **Oui** | Athlète (via API), Pro | Pro ou Système auto | Pro | PostgreSQL |
| **Plan kiné** | `KinePlan` | **Santé** | **Oui** (pathology, injuryNote) | Athlète (via API), Pro | Pro kiné | Pro (soft-delete) | PostgreSQL |
| **Alertes kiné** | `KineAlert` | **Santé** | **Oui** | Pro kiné | Pro ou Système auto | Pro | PostgreSQL |
| **Alertes nutrition** | `NutriAlert` | **Santé** | **Oui** | Pro nutritionniste | Pro ou Système auto | Pro | PostgreSQL |
| **Objectifs nutrition** | `NutriObjective` | Sport/Santé | Contextuel | Athlète (via API), Pro | Pro nutritionniste | Pro | PostgreSQL |
| **Plan alimentaire** | `NutriPlan` + `NutriMeal` + `NutriFoodItem` | Sport/Santé | Contextuel | Athlète (via API), Pro | Pro nutritionniste | Pro (soft-delete) | PostgreSQL |
| **Notes consultation nutri** | `NutriConsultNote` | **Santé** | **Oui** | Athlète (notePatient), Pro | Pro nutritionniste | Pro | PostgreSQL |
| **Sessions / Programmes** | `Session` + `ExerciseBlock` + `Exercise` | Sport | Non (sauf si douleur/RPE) | Athlète (si visibleAthlete), Pro | Pro coach/kiné | Pro (soft-delete) | PostgreSQL |
| **Documents partagés pro→athlète** | `SharedDocument` | **Santé** | **Oui** (selon contenu) | Athlète (via API), Pro | Pro | Pro (soft-delete) | Filesystem + PostgreSQL |
| **Notes collaboration** | `CollabNote` | **Santé** | **Oui** | Pros autorisés sur l'athlète | Pro | Pro (soft-delete) | PostgreSQL |
| **RDV / Événements** | `CalendarEvent` | Logistique/Santé | Contextuel | Athlète, Pro | Pro ou Athlète (booking) | Pro ou Athlète (annulation, soft-delete) | PostgreSQL |
| **Factures** | `Invoice` | **Paiement** | Non (montants) | Athlète (via API), Pro | Pro ou Système (Stripe auto) | Pro (soft-delete) | PostgreSQL |

### 2.3 — Données venant de fichiers uploadés

| Source | Modèle | Types acceptés | Taille max | Stockage | Chiffrement |
|--------|--------|---------------|------------|----------|-------------|
| **Avatar athlète** | `AthleteUser.avatarPath` | image/* | ~5 MB | `uploads/avatars/` | Non (à sécuriser) |
| **Documents athlète→pro** | `AthleteDocument` | PDF, image, Word | Variable | `uploads/athlete-documents/` | Non (à sécuriser) |
| **Pièces jointes messages** | `AthleteProMessageAttachment` | Tous | Variable | `uploads/messages/` | Non (à sécuriser) |
| **Pièces jointes groupes** | `AthleteGroupMessageAttachment` | Tous | Variable | `uploads/group-messages/` | Non (à sécuriser) |
| **Vidéos athlète** | `AthleteVideo` | video/* | ~500 MB | `uploads/athlete-videos/` | Non (à sécuriser) |
| **Documents prépa consultation** | `ConsultationPrep.documents` | Noms fichiers stockés | N/A | Référence seulement | N/A |

### 2.4 — Données venant de wearables / apps externes

| Source | Modèle | Données | Catégorie | Sensible | Stockage |
|--------|--------|---------|-----------|----------|----------|
| **Garmin** (OAuth 1.0a) | `HealthAppConnection` + `HealthDataPoint` | steps, heart_rate, sleep, calories, distance, active_minutes, spo2, hrv, body_weight, body_fat | **Santé** | **Oui** (FC, SpO2, HRV, sommeil, poids, masse grasse) | PostgreSQL |
| **Polar** (OAuth 2.0) | idem | idem | **Santé** | **Oui** | PostgreSQL |
| **WHOOP** (OAuth 2.0) | idem | idem | **Santé** | **Oui** | PostgreSQL |
| **Oura** (OAuth 2.0) | idem | idem | **Santé** | **Oui** | PostgreSQL |

**Tokens OAuth** : `accessToken`, `refreshToken`, `accessTokenSecret` stockés en clair dans `HealthAppConnection`. → **KO : doivent être chiffrés au repos**.

### 2.5 — Données de session / sécurité

| Donnée | Modèle | Catégorie | Sensible | Durée |
|--------|--------|-----------|----------|-------|
| **Sessions auth** | `AuthSession` | Technique | Non | 15 min (access) / 30 jours (refresh) |
| **IP, User-Agent** | `AuthSession`, `ConsultationPrep`, `BookingReminder` | Technique | Oui (données personnelles) | Durée de la session |
| **Demandes connexion** | `ConnectionRequest` | Social | Non | Permanente |
| **Blocages** | `BlockedAthlete` | Modération | Non | Permanente |

### 2.6 — Données paiement

| Donnée | Modèle | Détail | Sensible | PCI DSS |
|--------|--------|--------|----------|---------|
| **Paiements** | `Payment` | `stripeCheckoutSessionId, stripePaymentIntentId, amount, platformFee, stripeFee` | Comptable | ✅ Conforme — aucune donnée carte stockée (commentaire schema l.1819-1822) |
| **Reçus** | `Payment` | `receiptNumber, receiptGeneratedAt` | Comptable | ✅ |
| **Historique paiements** | via `/api/athlete/payments-history` | Lecture seule athlète | Non | ✅ |

---

## 3. Matrice des accès (CRUD)

| Donnée | Athlète (C) | Athlète (R) | Athlète (U) | Athlète (D) | Pro connecté (R) | Pro connecté (U) | Pro (D) | Système |
|--------|:-----------:|:-----------:|:-----------:|:-----------:|:-----------------:|:-----------------:|:-------:|:-------:|
| Profil AthleteUser | ✅ | ✅ | ✅ | ✅ (compte) | Filtré par privacy | ❌ | ❌ | ❌ |
| Antécédents/traitements | ✅ | ✅ | ✅ | ✅ | Si `shareAntecedents=true` | ❌ | ❌ | ❌ |
| Messages athlète↔pro | ✅ | ✅ | ✅ (edit) | ❌ | ✅ (destinataire) | ❌ | ❌ | ❌ |
| Documents athlète | ✅ | ✅ | ❌ | ✅ (soft) | ✅ (destinataire) | ❌ | ❌ | ❌ |
| Consultation prep | ✅ | ✅ | ✅ | Cascade | ✅ (pro du RDV) | ❌ | Cascade | ❌ |
| Feedback séance | ✅ | ✅ | ❌ | ❌ | ✅ (pro séance) | ❌ | ✅ (soft) | ❌ |
| Exercise logs | ✅ | ✅ | ❌ | ❌ | ✅ (pro plan) | ❌ | Cascade | ❌ |
| Nutrition journal | ✅ | ✅ | ✅ | ✅ | ✅ (pro nutri) | ❌ | ❌ | ❌ |
| Health wearable data | ❌ | ✅ | ❌ | ✅ (déconnexion) | ✅ (si shareVitals) | ❌ | ❌ | ✅ (sync) |
| Privacy settings | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Fiche Athlete (pro-side) | ❌ | Indirect | ❌ | ❌ | ✅ | ✅ | ✅ (soft) | ❌ |
| Ordonnances | ❌ | ✅ | ❌ | ❌ | ✅ (auteur) | ✅ | ✅ (soft) | ❌ |
| Plans kiné | ❌ | ✅ | ❌ | ❌ | ✅ (auteur) | ✅ | ✅ (soft) | ❌ |
| Plans nutrition | ❌ | ✅ | ❌ | ❌ | ✅ (auteur) | ✅ | ✅ (soft) | ❌ |
| RDV | ✅ (booking) | ✅ | ❌ | ✅ (annul.) | ✅ | ✅ | ✅ (soft) | ❌ |
| Paiements | ✅ (Stripe) | ✅ | ❌ | ❌ | ✅ (pro) | ❌ | ❌ | ✅ (webhook) |

---

## 4. Classification des données

### 4.1 — Données de santé (Art. 9 RGPD — catégorie spéciale)

- `antecedents`, `traitements`, `contreIndications`
- `painLevel`, `fatigueLevel`, `douleur`, `douleurZone`, `rpeRessenti`
- `MedOrdonnance`, `MedPrescription`, `MedProtocol`, `MedPlan`, `MedClinicalNote`, `MedAlert`
- `MedVitalEntry` (FC, TA, SpO2, température, douleur, fatigue, poids)
- `KinePlan` (pathology, injuryNote), `KineAlert`, `ExerciseLog.pain`
- `NutriAlert`, `NutriMeasure` (weight, bodyFat, bmi, waist)
- `ConsultationPrep` (symptoms, painLevel, fatigueLevel)
- `HealthDataPoint` (heart_rate, sleep, spo2, hrv, body_weight, body_fat)
- `AthleteDocument`, `SharedDocument` (selon contenu)
- `Athlete.injuryNote`, `Athlete.antecedents`, `Athlete.traitements`, `Athlete.contreIndications`

### 4.2 — Données sportives uniquement

- `sport`, `objectif`, `frequence`, `bodyZone`
- `Session` (programme, exercices, consignes) — sauf feedback douleur
- `NutriObjective` (kcal/macros cibles)
- `NutriPlan` (plan alimentaire)
- `NutriJournal` (journal quotidien)
- `KineVideo` (vidéos d'exercices)

### 4.3 — Données sensibles selon contexte

| Donnée | Quand devient sensible |
|--------|----------------------|
| `poids` | Si contexte TCA, pathologie pondérale |
| `sommeil` (`HealthDataPoint.sleep`) | Si contexte dépression, burnout |
| `douleur` / `pain` | Toujours sensible (donnée de santé) |
| `fatigue` | Si contexte médical |
| `nutrition` (journal, mesures) | Si contexte TCA |
| `cycle` | Non stocké actuellement — mais si ajouté = santé Art.9 |
| `messages` | Si contenu médical échangé |

### 4.4 — Données paiement

- `Payment` : montants, IDs Stripe, reçus
- `Invoice` : montants, statut, dates
- **Aucune donnée carte** stockée (PCI DSS conforme)

### 4.5 — Données support / marketing

- **Aucune donnée marketing** identifiée dans le schema
- Support : contact via messagerie intégrée uniquement

---

## 5. Points d'attention identifiés (KO à corriger)

### 🔴 KO Critiques

| # | Problème | Risque | Correction recommandée |
|---|----------|--------|----------------------|
| K1 | **Tokens OAuth wearables en clair** (`HealthAppConnection.accessToken/refreshToken`) | Fuite de tokens → accès aux données santé externes | Chiffrer au repos avec AES-256 (clé env `HEALTH_TOKEN_KEY`) |
| K2 | **Pas de durée de conservation définie** pour la majorité des données | Non-conformité RGPD Art.5§1e | Définir TTL par catégorie, implémenter purge automatique |
| K3 | **Fichiers uploadés non chiffrés** au repos (avatars, documents, vidéos) | Fuite de données santé en cas de compromission serveur | Chiffrement côté serveur (AES-256-GCM) ou stockage cloud chiffré |
| K4 | **Soft-delete sans purge** : les données "supprimées" restent indéfiniment | Données conservées au-delà du nécessaire | Cron de purge : soft-deleted > 90 jours → hard delete |
| K5 | **Pas de séparation physique** santé vs sport vs paiement | Principe de minimisation non respecté | À évaluer : schemas séparés ou tags de classification |

### 🟡 Avertissements

| # | Problème | Recommandation |
|---|----------|----------------|
| W1 | `Athlete` (fiche pro) et `AthleteUser` (compte) sont 2 tables distinctes sans FK directe | Documenter clairement le lien, ajouter un champ `athleteUserId` sur `Athlete` |
| W2 | `CollabNote` visible par tous les pros d'un réseau sans granularité | Vérifier que le contenu santé n'est pas partagé à des pros non-autorisés |
| W3 | `ProAccessLog` trace les accès pro mais pas les accès athlète à ses propres données | Ajouter un log athlète pour la portabilité |
| W4 | Export données (`/api/athlete/export-data`) incomplet : manque nutrition, plans kiné, ordonnances, wearables | Compléter l'export pour conformité Art.20 RGPD |
| W5 | `localStorage` côté client pour préférences (notifications) — OK mais documenter | RAS si données non sensibles |

---

## 6. Durées de conservation recommandées

| Catégorie | Durée recommandée | Base |
|-----------|-------------------|------|
| **Données de santé** (ordonnances, prescriptions, notes cliniques) | 20 ans après dernier acte (Code de la santé publique L.1111-7) | Obligation légale |
| **Données médicales actives** (plans, alertes, vitals) | Durée du suivi + 5 ans | Obligation légale |
| **Données sportives** (sessions, exercices, nutrition) | Durée de la connexion pro-athlète + 1 an | Intérêt légitime |
| **Messages** | Durée de la connexion + 1 an | Contrat |
| **Documents/fichiers** | Durée de la connexion + 5 ans (si santé) | Obligation légale |
| **Paiements** | 10 ans (obligation comptable) | Obligation légale |
| **Tokens OAuth wearables** | Jusqu'à déconnexion par l'athlète | Consentement |
| **Sessions auth** | 30 jours max (refresh) | Technique |
| **Données supprimées (soft-delete)** | 90 jours max avant hard-delete | Minimisation |
| **Logs d'accès** | 1 an | Intérêt légitime |
| **Exports de données** | Téléchargement immédiat, pas de stockage serveur | Minimisation |

---

## 7. Synthèse : tableau data_inventory consolidé

| # | Donnée | Finalité | Base légale RGPD | Visibilité | Conservation | Stockage | Sensible |
|---|--------|----------|-----------------|------------|--------------|----------|----------|
| 1 | Identité (nom, prénom, email, tel) | Identification | Contrat B6b | Athlète + Pros connectés (filtré) | Compte + 3 ans | PostgreSQL | Non |
| 2 | Date naissance, taille, poids | Suivi santé/sport | Consentement A9§2a | Athlète + Pros si privacy OK | Compte | PostgreSQL | **Oui** |
| 3 | Sport, objectif | Personnalisation | Intérêt légitime B6f | Athlète + Pros si privacy OK | Compte | PostgreSQL | Non |
| 4 | Antécédents, traitements, CI | Sécurité soins | Consentement A9§2a | Athlète + Pros si privacy OK | Compte | PostgreSQL | **Oui** |
| 5 | Avatar | UX | Consentement | Athlète + Pros si privacy OK | Compte | Filesystem | Non |
| 6 | Prépa consultation | Préparation RDV | Consentement A9§2a | Athlète + Pro du RDV | RDV + archivage | PostgreSQL | **Oui** |
| 7 | Feedback/douleur séance | Suivi rééducation | Consentement A9§2a | Athlète + Pro | Programme | PostgreSQL | **Oui** |
| 8 | Logs exercices kiné | Suivi rééducation | Consentement A9§2a | Pro propriétaire | Plan kiné | PostgreSQL | **Oui** |
| 9 | Journal nutrition | Suivi alimentaire | Consentement | Athlète + Pro nutri | Connexion + 1 an | PostgreSQL | Contextuel |
| 10 | Mesures nutrition | Suivi pondéral | Consentement A9§2a | Athlète + Pro nutri | Connexion + 1 an | PostgreSQL | **Oui** |
| 11 | Messages | Communication patient-pro | Contrat B6b | Expéditeur + Destinataire | Connexion + 1 an | PostgreSQL | Contextuel |
| 12 | Pièces jointes | Partage fichiers | Contrat B6b | Expéditeur + Destinataire | Connexion + 1 an | Filesystem + PG | Contextuel |
| 13 | Documents athlète→pro | Partage docs médicaux | Consentement A9§2a | Athlète + Pro destinataire | Connexion + 5 ans | Filesystem + PG | **Oui** |
| 14 | Vidéos athlète | Analyse mouvement | Consentement | Athlète + Pro | Suivi | Filesystem + PG | Contextuel |
| 15 | Données wearables | Suivi santé connectée | Consentement A9§2a | Athlète + Pros si shareVitals | Jusqu'à déconnexion | PostgreSQL | **Oui** |
| 16 | Tokens OAuth wearables | Synchronisation | Consentement | Système uniquement | Jusqu'à déconnexion | PostgreSQL (**⚠️ en clair**) | Technique |
| 17 | Ordonnances | Prescription médicale | Obligation légale | Athlète + Pro médecin | 20 ans | PostgreSQL | **Oui** |
| 18 | Prescriptions | Conseil médical | Obligation légale | Athlète (si visible) + Pro | 20 ans | PostgreSQL | **Oui** |
| 19 | Notes cliniques | Suivi médical | Obligation légale | Pro (notePatient → athlète) | 20 ans | PostgreSQL | **Oui** |
| 20 | Alertes médicales | Sécurité patient | Obligation légale | Pro + Athlète (via API) | 5 ans | PostgreSQL | **Oui** |
| 21 | Plans kiné | Rééducation | Consentement A9§2a | Athlète + Pro kiné | Plan + 5 ans | PostgreSQL | **Oui** |
| 22 | Plans nutrition | Suivi alimentaire | Consentement | Athlète + Pro nutri | Plan + 1 an | PostgreSQL | Contextuel |
| 23 | RDV / Événements | Gestion agenda | Contrat B6b | Athlète + Pro | 3 ans post-RDV | PostgreSQL | Contextuel |
| 24 | Paiements | Comptabilité | Obligation légale | Athlète + Pro | 10 ans | PostgreSQL | Non |
| 25 | Factures | Comptabilité | Obligation légale | Athlète + Pro | 10 ans | PostgreSQL | Non |
| 26 | Privacy settings | Contrôle accès | Obligation RGPD | Athlète | Connexion | PostgreSQL | Non |
| 27 | Logs d'accès pro | Traçabilité | Intérêt légitime | Athlète (export) | 1 an | PostgreSQL | Non |
| 28 | Sessions auth | Authentification | Contrat B6b | Système | 30j max | PostgreSQL | Technique |
| 29 | Connexions/blocages | Social | Intérêt légitime | Athlète + Pro | Permanente | PostgreSQL | Non |
| 30 | Consentements | Preuve RGPD | Obligation légale | Pro + Système | 5 ans post-révocation | PostgreSQL | Non |

---

## 8. Prochaines actions (Phase 0.1 → Phase 0.2)

1. **Chiffrer les tokens OAuth wearables** au repos (K1)
2. **Implémenter la purge automatique** des soft-deleted > 90j (K4)
3. **Chiffrer les fichiers uploadés** au repos ou migrer vers stockage chiffré (K3)
4. **Compléter l'export RGPD Art.20** avec nutrition, plans kiné, ordonnances, wearables (W4)
5. **Ajouter les durées de conservation** dans un fichier de configuration et implémenter les crons de purge (K2)
6. **Documenter le lien Athlete ↔ AthleteUser** et évaluer la fusion ou FK directe (W1)
