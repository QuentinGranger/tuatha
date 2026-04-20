// ─── Charte de Partage des Données — Tuatha ───
// Version centralisée. Importée par la page /charte-partage et le formulaire d'inscription.

export const SHARING_VERSION = "1.0";
export const SHARING_DATE = "02/03/2026";

export const SHARING_SECTIONS = [
  {
    id: "objectif",
    title: "1. Objectif et philosophie",
    content: `Tuatha est conçu pour que **l'Athlète garde le contrôle** de ses informations et puisse collaborer avec des Professionnels (coach, kinésithérapeute, médecin, nutritionniste) en partageant **uniquement ce qui est nécessaire**, au bon moment.

Cette Charte a pour objectifs :
• Décrire le **cadre du partage** : périmètres, niveaux d'accès, durée, révocation ;
• Garantir une information **claire, transparente et compréhensible** au moment de votre décision (RGPD Art. 13, recommandations CNIL) ;
• Rappeler le cadre renforcé applicable lorsque des **données de santé** sont concernées (RGPD Art. 9, CNIL santé).

Elle complète les CGU, la Politique de Confidentialité et la Politique Cookies de la Plateforme.`,
  },
  {
    id: "acteurs",
    title: "2. Qui est qui ?",
    content: `• **Athlète / Patient** : la personne physique à laquelle les données se rapportent. C'est elle qui contrôle le partage.
• **Professionnel (« Pro »)** : la personne autorisée à accéder à certaines données dans le cadre du suivi sportif ou de santé. Deux types d'accès existent :
  — **Professionnel propriétaire (référent)** : le professionnel qui a créé le dossier de l'athlète. Il dispose d'un accès complet à toutes les catégories de données.
  — **Professionnel connecté** : un professionnel autorisé par le propriétaire, avec un accès limité aux catégories et niveaux définis.
• **Tuatha** : la plateforme technique qui héberge et met à disposition les données selon vos choix, avec les mesures de sécurité et de traçabilité décrites dans cette Charte.`,
  },
  {
    id: "categories",
    title: "3. Quelles données peuvent être partagées ?",
    content: `Selon vos réglages, les données partagées sont organisées en **8 catégories indépendantes**, chacune avec son propre niveau d'accès :

**3.1. Entraînement** (entrainement)
Programmes, séances, blocs d'exercices, charges, répétitions, plans kiné, plans nutrition.

**3.2. Indicateurs** (indicateurs)
KPIs, logs d'exercices, mesures de performance, scores, métriques de suivi.

**3.3. Constantes vitales** (constantes)
Entrées vitales médicales (tension, fréquence cardiaque, température, etc.). Données classifiées **médicales**.

**3.4. Imagerie et documents médicaux** (imagerie)
Comptes-rendus médicaux, ordonnances, prescriptions, imagerie. Données classifiées **médicales** — accès fortement encadré.

**3.5. Documents partagés** (documents)
Documents téléversés (PDF, fichiers), pièces jointes. Classifiés **confidentiels**.

**3.6. Blessures et antécédents** (blessures)
Notes de blessure, antécédents médicaux et chirurgicaux, pathologies, zones corporelles. Données classifiées **médicales**.

**3.7. Nutrition** (nutrition)
Plans nutritionnels, repas, journal alimentaire, objectifs nutritionnels. Classifiés **confidentiels**.

**3.8. Notes** (notes)
Notes collaboratives, notes cliniques, notes de l'athlète. Classifiées **confidentielles**.`,
  },
  {
    id: "scopes",
    title: "4. Partage à la carte : périmètres et niveaux d'accès",
    content: `**4.1. Le système de scopes (ABAC)**

La Plateforme implémente un contrôle d'accès par attributs (**ABAC** — Attribute-Based Access Control). Pour chaque connexion Professionnel ↔ Athlète, vous définissez **précisément** :
• **Quelles catégories** de données sont partagées (parmi les 8 ci-dessus) ;
• **Quel niveau d'accès** par catégorie.

**4.2. Les 4 niveaux d'accès**

| Niveau | Description |
|---|---|
| **Aucun** (none) | La catégorie n'est pas partagée — le Professionnel ne voit rien |
| **Lecture** (read) | Le Professionnel peut consulter les données, sans les modifier |
| **Commentaire** (comment) | Lecture + possibilité d'ajouter des commentaires ou annotations |
| **Écriture** (write) | Accès complet : lecture, commentaire, création et modification |

**4.3. Principe de moindre privilège**

Par défaut, une nouvelle connexion partagée a **tous les scopes à « aucun »** (zéro accès). Chaque catégorie doit être **explicitement** ouverte par le Professionnel propriétaire. Ce principe de zéro accès par défaut est conforme aux exigences de minimisation du RGPD (Art. 5(1)(c)).

**4.4. Professionnel propriétaire vs connecté**

| | Propriétaire | Connecté |
|---|---|---|
| Accès | Complet (écriture sur toutes les catégories) | Limité aux scopes attribués |
| Durée | Illimitée | Limitée (expiration configurable) |
| Renouvellement | Automatique | Manuel (renouvellement par le propriétaire) |
| Exports | Autorisés (avec traçabilité) | Soumis à restrictions par rôle |`,
  },
  {
    id: "declenchement",
    title: "5. Comment le partage est-il déclenché ?",
    content: `Le partage ne se fait **jamais automatiquement**. Il nécessite une action explicite :

**5.1. Consentement préalable obligatoire**

Avant toute opération de partage ou d'export, la Plateforme vérifie que l'Athlète a donné son **consentement explicite au partage** (consentementPartage). Ce consentement est :
• Recueilli de manière libre, spécifique, éclairée et univoque ;
• Tracé dans un **journal immuable** (ConsentLog) incluant : type, action, méthode de recueil, motif, identité du professionnel, horodatage, IP et user-agent ;
• Vérifié automatiquement avant chaque accès partagé.

**5.2. Modes de déclenchement**

• **Connexion par le Professionnel propriétaire** : le propriétaire crée une connexion avec un autre professionnel, en définissant les scopes ;
• **Acceptation d'une demande** : un professionnel demande l'accès, le propriétaire l'autorise ;
• **Activation via l'interface** : un écran de confirmation affiche le professionnel concerné, les catégories partagées, la durée et un lien vers cette Charte.

**5.3. Information au moment de l'activation**

Au moment de la connexion, la Plateforme affiche :
• L'identité du Professionnel (nom, spécialité, numéro professionnel) ;
• Les catégories et niveaux d'accès attribués ;
• La durée de la connexion ;
• Un lien vers cette Charte.`,
  },
  {
    id: "duree",
    title: "6. Durée du partage",
    content: `**6.1. Durée par défaut**

Les connexions partagées ont une **durée par défaut de 30 jours** (configurable). Passé ce délai, l'accès expire automatiquement.

**6.2. Expiration automatique**

À chaque accès, la Plateforme vérifie la date d'expiration (expiresAt) de la connexion. Si la connexion est expirée :
• L'accès est **refusé** avec un message clair ;
• Le Professionnel est informé que la connexion doit être renouvelée.

**6.3. Renouvellement**

Le Professionnel propriétaire peut renouveler la durée d'une connexion existante. Le renouvellement est tracé dans les logs.

**6.4. Révocation à tout moment**

L'accès peut être révoqué **à tout moment** par le Professionnel propriétaire. La révocation :
• Bloque **immédiatement** les futures opérations de partage ;
• Est tracée dans le journal des consentements ;
• Ne supprime pas les journaux d'accès antérieurs (conservés pour audit et sécurité).`,
  },
  {
    id: "revocation",
    title: "7. Révocation : que se passe-t-il concrètement ?",
    content: `Lorsque l'accès d'un Professionnel est révoqué :

**7.1. Effet immédiat**
• Le Professionnel **ne peut plus consulter** les données de l'Athlète via la Plateforme ;
• Il ne peut plus accéder aux documents, notes, bilans ou messages liés ;
• La connexion est marquée comme révoquée dans le système.

**7.2. Données déjà consultées**
Si un Professionnel a **exporté ou copié** certaines informations dans le cadre légal de son activité (obligations professionnelles, dossier médical), Tuatha ne peut pas techniquement effacer ce qui a été enregistré en dehors de la Plateforme. En revanche, Tuatha :
• **Trace toutes les actions** sensibles (consultations, exports, téléchargements) ;
• **Limite les exports** par des quotas stricts (1 export/heure, 10 exports/jour) ;
• **Applique des restrictions de téléchargement** par rôle et par niveau de confidentialité ;
• **Ajoute des métadonnées de traçabilité** (watermark) aux fichiers téléchargés.

**7.3. Consentement au partage**
La révocation du consentement au partage (consentementPartage) bloque **toutes** les opérations de partage et d'export pour l'ensemble des connexions de l'Athlète, pas uniquement celle d'un Professionnel spécifique.`,
  },
  {
    id: "tracabilite",
    title: "8. Traçabilité : qui a consulté quoi ?",
    content: `Pour la sécurité et la conformité RGPD, la Plateforme met en place une **journalisation complète** :

**8.1. Journal des consentements (ConsentLog)**
Chaque recueil, retrait ou renouvellement de consentement est enregistré de manière **immuable** avec :
• Type de consentement (général, partage, export, traitement) ;
• Action (accordé, révoqué, renouvelé) ;
• Méthode de recueil (verbal, écrit, digital, email) ;
• Identité du professionnel ayant effectué l'action ;
• Horodatage, adresse IP et user-agent.

Les logs de consentement sont conservés **indéfiniment** (RGPD Art. 7(1) — preuve du consentement).

**8.2. Journal d'audit**
Chaque action sensible est journalisée :
• Consultations de profils et documents ;
• Modifications de dossiers ;
• Exports et téléchargements (avec catégories, format, volume) ;
• Connexions créées, modifiées, expirées ou révoquées.

**8.3. Durées de conservation des journaux**
• Alertes de sécurité : 1 an (recommandation CNIL) ;
• Sessions révoquées : 6 mois ;
• Logs de consentement : indéfinie (obligation légale RGPD Art. 7(1)) ;
• Demandes de droits RGPD : indéfinie (responsabilisation RGPD Art. 5(2)).`,
  },
  {
    id: "exports",
    title: "9. Exports et téléchargements",
    content: `**9.1. Formats contrôlés**
Les exports sont disponibles uniquement en **CSV et PDF** — aucun dump brut (JSON, SQL) n'est possible.

**9.2. Quotas stricts**
• **1 export par heure** par professionnel (cooldown de 60 minutes) ;
• **10 exports maximum par jour** ;
• En cas de dépassement, un message d'erreur indique le délai d'attente.

**9.3. Filtrage par scopes**
Les données exportées sont **filtrées par les scopes ABAC** du Professionnel : seules les catégories auxquelles il a accès (au minimum en lecture) sont incluses dans l'export.

**9.4. Restrictions par rôle**
Le téléchargement et l'impression de fichiers sont soumis à des **restrictions par rôle professionnel** et par niveau de confidentialité du document :

| Confidentialité | Coach | Kiné | Médecin | Nutritionniste |
|---|---|---|---|---|
| **Public** | ✅ Téléch. + Impr. | ✅ | ✅ | ✅ |
| **Interne** | ✅ Téléch. + Impr. | ✅ | ✅ | ✅ |
| **Confidentiel** | ✅ Téléch. / ❌ Impr. | ✅ | ✅ | ✅ Téléch. / ❌ Impr. |
| **Médical** | ❌ Aucun accès | ✅ Téléch. / ❌ Impr. | ✅ Téléch. + Impr. | ❌ Aucun accès |

**9.5. Watermark et traçabilité**
Les documents confidentiels et médicaux téléchargés incluent des **métadonnées de traçabilité** (identité du professionnel, horodatage, provenance). Chaque téléchargement est journalisé.

**9.6. Vérification du consentement**
Avant tout export, la Plateforme vérifie que le **consentement au partage** de l'Athlète est actif. Sans consentement, l'export est refusé avec un message explicite.`,
  },
  {
    id: "engagements-pro",
    title: "10. Engagements du Professionnel",
    content: `En se connectant à un Athlète via Tuatha, le Professionnel s'engage à :

• N'accéder qu'aux données **strictement nécessaires** à la prise en charge ou au suivi ;
• Respecter la **confidentialité** et, le cas échéant, le secret professionnel et les règles déontologiques ;
• Ne pas tenter d'accéder à des données non autorisées (contournement de contrôles d'accès, modification d'identifiants, injection) ;
• Protéger ses propres accès : **mot de passe fort** (8 caractères min., majuscule, minuscule, chiffre, caractère spécial), **MFA/TOTP** si proposé, terminal sécurisé ;
• Ne pas effectuer de **copies massives** de données en dehors du cadre professionnel légitime ;
• Signaler toute **faille de sécurité** ou accès non autorisé détecté.

La CNIL rappelle l'importance de documenter les rôles et responsabilités, la sécurité et l'accès limité au besoin d'en connaître pour les traitements de données de santé.`,
  },
  {
    id: "classification",
    title: "11. Classification des données",
    content: `Chaque catégorie de données est classée par **niveau de confidentialité**, qui détermine les restrictions d'accès, de téléchargement et d'impression :

| Catégorie | Classification | Impact |
|---|---|---|
| Entraînement | Interne | Téléchargement autorisé, traçabilité standard |
| Indicateurs | Interne | Téléchargement autorisé, traçabilité standard |
| Constantes vitales | **Médical** | Accès restreint aux professionnels de santé |
| Imagerie / Ordonnances | **Médical** | Accès restreint, impression contrôlée, watermark |
| Documents partagés | Confidentiel | Téléchargement avec traçabilité, impression restreinte |
| Blessures / Antécédents | **Médical** | Accès restreint aux professionnels de santé |
| Nutrition | Confidentiel | Téléchargement avec traçabilité |
| Notes | Confidentiel | Téléchargement avec traçabilité |

Les données classifiées **médicales** bénéficient des protections renforcées : chiffrement au repos (AES-256-GCM), rédaction automatique selon le niveau d'accès, URLs signées temporaires, et ScreenShield anti-capture d'écran.`,
  },
  {
    id: "hds",
    title: "12. Hébergement des données de santé (HDS)",
    content: `Tuatha peut héberger des **données de santé à caractère personnel** au sens de l'article L.1111-8 du Code de la santé publique.

**Statut : conformité HDS en cours**

Tuatha est en démarche de conformité et de certification HDS (Hébergeur de Données de Santé). En attendant, Tuatha met en œuvre des **mesures de sécurité renforcées** :
• Chiffrement au repos (AES-256-GCM) et en transit (HTTPS/TLS) ;
• Contrôle d'accès granulaire (ABAC + RBAC) ;
• Journalisation complète des accès ;
• Blocage des connexions VPN/proxy/Tor ;
• Analyse antivirus des fichiers téléversés (ClamAV) ;
• Procédures de réponse aux incidents (révocation globale, mode lecture seule, kill switches).

Tuatha mettra à jour cette Charte et la Politique de Confidentialité dès que la certification HDS sera finalisée.

**Approche prudente** : information claire + contrôle par l'Athlète (via son Professionnel référent) + traçabilité complète.`,
  },
  {
    id: "droits",
    title: "13. Vos droits et votre contrôle",
    content: `Vous pouvez à tout moment, via votre Professionnel référent ou directement :

• **Voir** quels Professionnels ont accès à vos données (liste des connexions actives) ;
• **Modifier** les catégories et niveaux d'accès de chaque connexion ;
• **Modifier** la durée de la connexion ;
• **Révoquer** l'accès d'un Professionnel (effet immédiat) ;
• **Révoquer le consentement au partage** (bloque toutes les connexions) ;
• **Demander un export** complet de vos données (RGPD Art. 15 — droit d'accès) ;
• **Demander la rectification** de données inexactes (RGPD Art. 16) ;
• **Demander l'effacement** de vos données (RGPD Art. 17 — anonymisation irréversible, sous réserve des obligations légales de conservation).

Chaque exercice de droit est enregistré dans un registre dédié (SubjectAccessRequest) avec : type de droit, statut, résultat, horodatage, IP et user-agent.

**Comment exercer vos droits**
• Via la Plateforme : menu « Droits RGPD » du dossier athlète ;
• Par email : contact@tuatha-app.com ;
• Par téléphone : +33 6.71.63.83.06.

**Délai** : 1 mois maximum (RGPD Art. 12(3)), prolongeable de 2 mois en cas de complexité.`,
  },
  {
    id: "securite",
    title: "14. Sécurité du partage (résumé)",
    content: `Sans détailler d'éléments pouvant aider un attaquant, Tuatha met en œuvre notamment :

**Contrôle d'accès**
• ABAC : vérification par catégorie, niveau d'accès et expiration à chaque requête ;
• RBAC : restrictions par spécialité professionnelle ;
• Vérification du consentement et du lien pro ↔ athlète avant tout accès ;
• Protection IDOR (vérification que l'utilisateur a le droit d'accéder à la ressource).

**Chiffrement et protection**
• Chiffrement au repos (AES-256-GCM) pour les données sensibles ;
• Chiffrement en transit (HTTPS/TLS) ;
• URLs signées (HMAC-SHA256 + expiration) pour les fichiers — aucun lien permanent ;
• Rédaction automatique des champs sensibles selon le niveau d'accès ;
• ScreenShield (anti-capture d'écran) sur les interfaces sensibles.

**Anti-exfiltration**
• Quotas d'export (1/heure, 10/jour) ;
• Restrictions de téléchargement par rôle et confidentialité ;
• Watermark sur les documents confidentiels et médicaux ;
• Rate limiting sur toutes les opérations sensibles.

**Authentification**
• Mot de passe fort + MFA/TOTP + WebAuthn/Passkeys ;
• Sessions révocables avec rotation de tokens ;
• Blocage VPN/proxy/Tor ;
• Détection de credential stuffing et scoring de risque.

**Journalisation**
• Journal immuable des consentements ;
• Audit complet des accès, exports et téléchargements ;
• Registre des demandes de droits RGPD.`,
  },
  {
    id: "confirmation",
    title: "15. Ce que vous confirmez au moment du partage",
    content: `En autorisant un Professionnel à accéder aux données d'un Athlète, vous confirmez que :

1. Vous avez **identifié le Professionnel** (nom, spécialité, numéro professionnel) ;
2. Vous comprenez **quelles catégories** de données sont partagées et à quel niveau d'accès ;
3. Vous comprenez **la durée** du partage (par défaut 30 jours, configurable) ;
4. Vous savez comment **révoquer** et modifier les accès à tout moment ;
5. Vous comprenez que les **actions sensibles** (consultations, exports, téléchargements) sont tracées ;
6. Vous avez été informé du **cadre renforcé** applicable aux données de santé (RGPD Art. 9) ;
7. Le **consentement au partage** de l'Athlète est actif et a été recueilli de manière conforme.`,
  },
  {
    id: "contact",
    title: "16. Contact",
    content: `**Tuatha SAS** — Paris

Email : contact@tuatha-app.com
Téléphone : +33 6.71.63.83.06

Pour toute question relative au partage de données, à la gestion des accès ou à l'exercice de vos droits, n'hésitez pas à nous contacter.

**Documents complémentaires**
• Conditions Générales d'Utilisation (CGU)
• Politique de Confidentialité
• Politique Cookies`,
  },
];
