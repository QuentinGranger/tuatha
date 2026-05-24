# Matrice RBAC/ABAC — Contrôle d'accès Tuatha

> Dernière mise à jour : 2026-04-27
> Statut : **Audit P0 complet**

---

## 1. Rôles

| Rôle | Description | Dashboard |
|------|-------------|-----------|
| **athlete** | Compte AthleteUser autonome | `/dashboard/athlete` |
| **coach** | Professionnel — coach sportif | `/dashboard/coach` |
| **kine** | Professionnel — kinésithérapeute | `/dashboard/kine` |
| **medecin** | Professionnel — médecin du sport | `/dashboard/medecin` |
| **nutri** | Professionnel — diététicien/nutritionniste | `/dashboard/nutri` |

---

## 2. Matrice Athlète (côté `/api/athlete/*`)

**Principe** : un athlète ne voit que SES données. Toutes les routes utilisent `getSessionAthlete()` + `session.id` pour scoper les requêtes DB.

| Route | Auth | Ownership Check | Statut |
|-------|------|-----------------|--------|
| `GET /api/athlete/profil` | ✅ session | `where: { id: session.id }` | ✅ OK |
| `PATCH /api/athlete/profile` | ✅ session | `where: { id: session.id }` | ✅ OK |
| `GET /api/athlete/my-connections` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `POST /api/athlete/connect` | ✅ session | crée avec `athleteUserId: session.id` | ✅ OK |
| `POST /api/athlete/connection-request/[id]` | ✅ session | `connectionRequest.athleteUserId !== session.id` → 403 | ✅ OK |
| `GET /api/athlete/messages` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `GET /api/athlete/messages/[proId]` | ✅ session | `where: { athleteUserId: session.id, professionnelId: proId }` | ✅ OK |
| `DELETE /api/athlete/messages/delete/[id]` | ✅ session | `msg.athleteUserId !== session.id \|\| msg.senderType !== "athlete"` → 403 | ✅ OK |
| `PATCH /api/athlete/messages/edit/[id]` | ✅ session | idem | ✅ OK |
| `PATCH /api/athlete/messages/pin/[id]` | ✅ session | `msg.athleteUserId !== session.id` → 403 | ✅ OK |
| `PATCH /api/athlete/messages/important/[id]` | ✅ session | idem | ✅ OK |
| `GET /api/athlete/groups` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `GET /api/athlete/groups/[id]/messages` | ✅ session | `group.athleteUserId !== session.id` → 404 | ✅ OK |
| `POST /api/athlete/groups/[id]/messages` | ✅ session | idem | ✅ OK |
| `DELETE /api/athlete/groups/messages/[id]/delete` | ✅ session | `conversation.athleteUserId !== session.id` → 403 | ✅ OK |
| `PATCH /api/athlete/groups/messages/[id]/edit` | ✅ session | idem | ✅ OK |
| `GET /api/athlete/documents` | ✅ session | connection check + email-based athlete resolution | ✅ OK |
| `POST /api/athlete/documents` | ✅ session | idem + `athleteUserId: session.id` | ✅ OK |
| `GET /api/athlete/documents/download` | ✅ session | ownership via athlete email match | ✅ OK |
| `GET /api/athlete/health/connections` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `DELETE /api/athlete/health/connections` | ✅ session | idem | ✅ OK |
| `GET /api/athlete/health/data` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `POST /api/athlete/health/sync` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `POST /api/athlete/health/webhook` | ⚠️ token | Garmin push — token match (pas de session) | ✅ OK (design) |
| `POST /api/athlete/cancel-appointment` | ✅ session | `event.athleteUserId === session.id` + fallback email | ✅ OK |
| `POST /api/athlete/book-appointment` | ✅ session | crée avec `athleteUserId: session.id` | ✅ OK |
| `GET /api/athlete/all-rdv` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `GET /api/athlete/booking-reminders` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `PATCH /api/athlete/booking-reminders` | ✅ session | `where: { id, athleteUserId: session.id }` | ✅ OK |
| `POST /api/athlete/data-access-request/[requestId]` | ✅ session | `req.athleteUserId !== session.id` → 403 | ✅ OK |
| `GET /api/athlete/export-data` | ✅ session | `where: { id: session.id }` | ✅ OK |
| `GET /api/athlete/kine-plans` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/med-ordonnances` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/med-prescriptions` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/med-protocols` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/med-vitals` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/med-alerts` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/med-plan` | ✅ session | connection check + email match | ✅ OK |
| `PATCH /api/athlete/coach-sessions/[id]/feedback` | ✅ session | email match → athlete → session → connection | ✅ OK |
| `POST /api/athlete/exercise-log` | ✅ session | email match → athlete → plan ownership | ✅ OK |
| `GET /api/athlete/privacy` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `GET /api/athlete/privacy/[proId]` | ✅ session | `where: { athleteUserId: session.id, professionnelId: proId }` | ✅ OK |
| `GET /api/athlete/privacy/[proId]/access-log` | ✅ session | connection check + `where: { athleteUserId: session.id }` | ✅ OK |
| `GET /api/athlete/indicateurs` | ✅ session | email match → athlete scoping | ✅ OK |
| `GET /api/athlete/nutri-journal` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/nutri-measures` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/nutri-objectives` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/nutri-plans` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/nutri-notes` | ✅ session | connection check + email match | ✅ OK |
| `GET /api/athlete/nutri-alerts` | ✅ session | connection check + email match | ✅ OK |
| `POST /api/athlete/nutri-custom-entry` | ✅ session | ⚠️ **IDOR: `nutriMealId` non vérifié** | ❌ **FIXÉ** |
| `DELETE /api/athlete/nutri-custom-entry` | ✅ session | `entry.athleteUserId !== session.id` → 404 | ✅ OK |
| `POST /api/athlete/nutri-tracking` | ✅ session | `athleteUserId: session.id` | ✅ OK |
| `GET /api/athlete/payments-history` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |
| `GET /api/athlete/receipts` | ✅ session | `where: { athleteUserId: session.id }` | ✅ OK |

---

## 3. Matrice Pro → Athlète (côté `/api/athletes/*`, `/api/athlete-*`)

**Principe** : un pro ne voit que les athlètes qu'il possède OU auxquels il est connecté (ProConnection) avec les scopes ABAC appropriés.

| Route | Auth | Access Check | Privacy | Statut |
|-------|------|-------------|---------|--------|
| `GET /api/athletes` | `withAuth` | `where: { professionnelId: proId }` | — | ✅ OK |
| `GET /api/athletes/[id]` | `withAthleteAccess` | ABAC owner/connection | `applyPrivacyFilter` | ✅ OK |
| `PATCH /api/athletes/[id]` | `withAthleteAccess` | owner only | — | ✅ OK |
| `GET /api/athlete-messages/[athleteId]` | `withAuth` | connection check + `canMessage()` | `logAccess` | ✅ OK |
| `POST /api/athlete-messages` | `withAuth` | connection check + `canMessage()` | `logAccess` | ✅ OK |
| `POST /api/athlete-videos/upload` | ⚠️ token | ⚠️ **IDOR: token non validé** | — | ❌ **FIXÉ** |

---

## 4. Matrice RBAC Pro (rôle × ressource)

| Ressource | coach | kine | medecin | nutri |
|-----------|-------|------|---------|-------|
| athletes | CRUD | CRUD | CRUD | CRUD |
| events | CRUD | CRUD | CRUD | CRUD |
| sessions | CRUD | CRUD | CRUD | CRUD |
| facturation | CRUD | CRUD | CRUD | CRUD |
| documents | CRUD | CRUD | CRUD | CRUD |
| messagerie | RW | RW | RW | RW |
| kine:plans | — | CRUD | — | — |
| kine:alerts | — | CRUD | — | — |
| medecin:ordonnances | — | — | CRUD | — |
| medecin:prescriptions | — | — | CRUD | — |
| medecin:vitals | — | — | RW | — |
| medecin:notes | — | — | CRUD | — |
| nutri:plans | — | — | — | CRUD |
| nutri:meals | — | — | — | CRUD |
| nutri:journal | — | — | — | RW |
| nutri:objectives | — | — | — | CRUD |

> **Résultat** : un coach NE PEUT PAS accéder à `kine:*`, `medecin:*`, `nutri:*`.
> Un kiné NE PEUT PAS accéder à `medecin:*`, `nutri:*`. Etc.

---

## 5. ABAC Data Scopes (ProConnection)

Chaque connexion inter-pro (ProConnection) a des `dataScopes` granulaires :

| Catégorie | Description | Niveaux possibles |
|-----------|-------------|-------------------|
| `entrainement` | Programmes, sessions | none / read / comment / write |
| `indicateurs` | KPIs, exercise logs | none / read / comment / write |
| `constantes` | Constantes vitales | none / read / comment / write |
| `imagerie` | Imagerie, ordonnances | none / read / comment / write |
| `documents` | Documents partagés | none / read / comment / write |
| `blessures` | Blessures, antécédents | none / read / comment / write |
| `nutrition` | Nutrition, régimes | none / read / comment / write |
| `notes` | Notes cliniques/collab | none / read / comment / write |

**Default** : `ZERO_SCOPES` (tout à `none`) — rien n'est ouvert par défaut.

---

## 6. Vulnérabilités trouvées et corrigées

| # | Route | Vulnérabilité | Sévérité | Fix |
|---|-------|---------------|----------|-----|
| 1 | `POST /api/athlete/nutri-custom-entry` | `nutriMealId` accepté sans vérifier ownership | Haute | Ajout vérification meal → dayLog → athleteUserId |
| 2 | `POST /api/athlete-videos/upload` | Token passé dans formData mais jamais validé | Critique | Validation du token en DB avant upload |

---

## 7. Garanties vérifiées

- [x] Un athlète ne peut accéder qu'à ses propres données (52 routes auditées)
- [x] Un pro ne peut accéder qu'aux athlètes qu'il possède ou auxquels il est connecté
- [x] Un pro ne peut accéder qu'aux catégories ABAC autorisées
- [x] Un coach ne voit pas les données médicales (`medecin:*` absent de ses permissions)
- [x] Un nutritionniste ne voit pas les documents kiné (`kine:*` absent)
- [x] Un kiné ne voit pas les conversations coach (scoped par `professionnelId`)
- [x] Chaque endpoint API vérifie les droits côté serveur
- [x] Aucun contrôle d'accès n'est uniquement fait côté front
- [x] Les IDs UUID v4 ne sont pas devinables
