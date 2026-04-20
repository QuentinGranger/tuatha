// ─── Politique de Confidentialité (RGPD) — Tuatha ───
// Version centralisée. Importée par la page /confidentialite et le formulaire d'inscription.

export const PRIVACY_VERSION = "1.0";
export const PRIVACY_DATE = "02/03/2026";

export const PRIVACY_SECTIONS = [
  {
    id: "introduction",
    title: "Introduction",
    content: `La présente Politique de Confidentialité explique comment Tuatha SAS (« Tuatha », « nous ») collecte, utilise, conserve et protège vos données personnelles lorsque vous utilisez la plateforme Tuatha et ses services (ci-après « la Plateforme »).

Elle est rédigée conformément aux exigences de transparence du Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679), de la loi Informatique et Libertés, et des recommandations de la CNIL, en particulier pour les traitements de données de santé.`,
  },
  {
    id: "destinataires",
    title: "1. À qui s'adresse cette Politique ?",
    content: `Cette Politique s'applique à :

• **Professionnels** (kinésithérapeutes, médecins, coachs sportifs, nutritionnistes) — utilisateurs principaux de la Plateforme, gérant les dossiers de leurs athlètes/patients ;
• **Athlètes / Patients** — personnes physiques dont les données sont collectées et gérées sur la Plateforme dans le cadre de leur suivi sportif ou de santé ;
• **Visiteurs** — personnes consultant les pages publiques de la Plateforme (site vitrine, page d'inscription).`,
  },
  {
    id: "definitions",
    title: "2. Définitions",
    content: `• **Données personnelles** : toute information se rapportant à une personne physique identifiée ou identifiable (RGPD Art. 4(1)).
• **Données de santé** : données personnelles relatives à la santé physique ou mentale d'une personne, qui révèlent des informations sur son état de santé (RGPD Art. 4(15)). Constituent une catégorie particulière soumise à un régime renforcé (RGPD Art. 9).
• **Responsable de traitement** : entité qui détermine les finalités et les moyens du traitement des données personnelles.
• **Sous-traitant** : entité qui traite des données personnelles pour le compte du responsable de traitement.
• **Consentement** : manifestation de volonté libre, spécifique, éclairée et univoque par laquelle la personne accepte le traitement de ses données (RGPD Art. 4(11)).
• **ABAC** : Attribute-Based Access Control — contrôle d'accès par attributs, permettant une gestion granulaire des permissions par catégorie de données.`,
  },
  {
    id: "responsable",
    title: "3. Qui est responsable de vos données ?",
    content: `**3.1. Responsable de traitement principal**

Tuatha SAS agit en qualité de **responsable de traitement** pour les opérations nécessaires au fonctionnement de la Plateforme :
• Création et gestion des comptes utilisateurs ;
• Sécurité, authentification et prévention de la fraude ;
• Hébergement et infrastructure technique ;
• Administration de la Plateforme ;
• Support technique.

**3.2. Cas particulier : contenus créés par un Professionnel**

Lorsqu'un Professionnel crée des contenus cliniques (notes, protocoles, prescriptions, ordonnances, plans de soins) dans le cadre de son activité, il détermine les finalités liées à sa relation avec l'Athlète. Dans ce cadre :
• Le Professionnel peut être considéré comme **responsable de traitement** pour les décisions relatives à l'exercice de sa profession ;
• Tuatha agit comme **sous-traitant** (RGPD Art. 28) pour la mise à disposition de l'infrastructure technique.

Les rôles et responsabilités sont documentés conformément aux recommandations de la CNIL pour les projets de santé numérique.

**3.3. Coordonnées**

Tuatha SAS — Paris
Email : contact@tuatha-app.com
Téléphone : +33 6.71.63.83.06`,
  },
  {
    id: "donnees-traitees",
    title: "4. Quelles données traitons-nous ?",
    content: `Nous appliquons le **principe de minimisation** (RGPD Art. 5(1)(c)) : seules les données strictement nécessaires aux finalités déclarées sont collectées et traitées. Les réponses de la Plateforme ne retournent que les champs nécessaires au contexte d'utilisation.

**4.1. Données d'identification et de compte**
• Nom, prénom ;
• Adresse email (obligatoire) ;
• Numéro de téléphone ;
• Mot de passe (stocké sous forme de hash bcrypt avec coût 12 — jamais en clair) ;
• Photo de profil (avatar) ;
• Version des CGU acceptées, date et IP d'acceptation.

**4.2. Données professionnelles (compte Professionnel)**
• Profession et spécialité déclarées (kinésithérapeute, médecin, coach sportif, nutritionniste) ;
• Numéro d'identification professionnel (RPPS 11 chiffres / carte d'éducateur sportif) ;
• Document de vérification (diplôme, certificat, justificatif) ;
• Adresse du cabinet ;
• Statut de vérification et résultats d'audit (y compris vérification IA) ;
• Informations de facturation et services proposés.

**4.3. Données d'usage, techniques et de sécurité**
• Logs de connexion et d'actions sensibles ;
• Adresse IP et agent utilisateur (user-agent) ;
• Identifiant d'appareil (device hash) et empreinte de navigateur ;
• Sessions d'authentification (token, famille de tokens, rotation, durée, révocation) ;
• Alertes de sécurité (tentatives suspectes, credential stuffing, énumération de comptes, force brute) ;
• Détection VPN/proxy/Tor : résultat de l'analyse (score de risque, type détecté) — aucune donnée de navigation via VPN n'est conservée, seul le blocage est journalisé ;
• Score de risque comportemental (connexions inhabituelles, changements d'appareil) ;
• Historique d'activité pour la continuité de soins ;
• Journaux d'administration (actions sensibles des administrateurs).

**4.4. Données sportives, de performance et de suivi**
• Séances d'entraînement, blocs, exercices, charges, répétitions ;
• Plans et programmes (kiné, nutrition, médecin) ;
• Objectifs, motifs de consultation, fréquence d'entraînement ;
• Indicateurs de performance, scores, métriques ;
• Événements de calendrier et tâches de suivi ;
• Vidéos d'analyse du mouvement.

**4.5. Données de santé et documents médicaux**

La Plateforme traite des données susceptibles de constituer des **données de santé** au sens du RGPD Art. 9, notamment :
• Antécédents médicaux et chirurgicaux ;
• Traitements en cours et contre-indications ;
• Scores de douleur, notes de blessure, zone corporelle concernée ;
• Ordonnances et prescriptions médicales ;
• Protocoles de soins et plans de rééducation ;
• Notes cliniques rédigées par les Professionnels ;
• Constantes vitales et bilans ;
• Alertes médicales.

Ces données sont soumises au **régime renforcé** de l'article 9 du RGPD et aux dispositions du Code de la santé publique.

**4.6. Données de consentement et d'audit**
• Historique complet des consentements (recueil, retrait, renouvellement) ;
• Méthode de recueil du consentement (verbal, écrit, digital, email) ;
• Demandes d'exercice de droits RGPD (accès, rectification, effacement) ;
• Journaux d'export de données.`,
  },
  {
    id: "finalites",
    title: "5. Pourquoi traitons-nous vos données ? (Finalités)",
    content: `Vos données sont traitées pour les finalités suivantes :

• **Fourniture des Services** : création de compte, authentification, gestion des dossiers athlètes, centralisation des données de suivi ;
• **Gestion du partage Athlète ↔ Professionnel** : partage contrôlé par catégories de données (scopes), niveaux d'accès (lecture, écriture), durée et révocation, selon les autorisations de l'Athlète ;
• **Sécurité et intégrité** : prévention des accès non autorisés, détection de fraude, journalisation des accès, alertes de sécurité, protection contre l'exfiltration de données ;
• **Continuité des soins** : suivi de l'historique d'activité pour assurer la cohérence du parcours patient ;
• **Facturation** : génération et conservation des factures ;
• **Support technique** : traitement des demandes, résolution d'incidents ;
• **Conformité légale** : conservation réglementaire, réponse aux demandes d'exercice de droits, preuve du consentement ;
• **Amélioration du service** : mesure de performance, stabilité, ergonomie (sans profilage individuel).`,
  },
  {
    id: "bases-legales",
    title: "6. Bases légales des traitements",
    content: `**6.1. Exécution du contrat** (RGPD Art. 6(1)(b))
Fourniture du service, gestion du compte, fonctionnement des partages demandés par l'utilisateur.

**6.2. Intérêt légitime** (RGPD Art. 6(1)(f))
Sécurité de la Plateforme, prévention de la fraude, détection d'activité anormale (credential stuffing, exports massifs), défense en justice, amélioration technique. Ces traitements sont proportionnés et ne portent pas une atteinte disproportionnée à vos droits.

**6.3. Obligation légale** (RGPD Art. 6(1)(c))
Conservation des factures (10 ans — Code de commerce Art. L.123-22), conservation du dossier médical (CSP Art. R.1112-7), réponse aux demandes d'exercice de droits.

**6.4. Consentement** (RGPD Art. 6(1)(a))
• Consentement au partage de données avec d'autres Professionnels ;
• Cookies et traceurs non essentiels (cadre CNIL).

Chaque recueil ou retrait de consentement est tracé dans un journal immuable (ConsentLog) incluant : type, action, méthode, motif, identité du professionnel, horodatage, IP et user-agent.

**6.5. Données de santé — cadre renforcé** (RGPD Art. 9)
Le traitement de données de santé est soumis à une **interdiction de principe** assortie d'exceptions limitatives. Dans Tuatha, ces traitements s'inscrivent dans le cadre :
• De la fourniture de soins de santé (Art. 9(2)(h)) ;
• Du consentement explicite de la personne concernée (Art. 9(2)(a)) ;
• Documentés dans le registre des traitements et, le cas échéant, une analyse d'impact (AIPD/PIA).`,
  },
  {
    id: "partage",
    title: "7. Partage Athlète ↔ Professionnel",
    content: `**7.1. Contrôle par l'Athlète**

L'Athlète conserve le contrôle de ses données. Via le Professionnel référent, il détermine :
• Quels Professionnels ont accès à ses données ;
• Quelles catégories de données sont partagées (entraînement, notes, documents, indicateurs, nutrition, blessures, constantes) ;
• Le niveau d'accès par catégorie (lecture, écriture, écriture complète) ;
• Et peut révoquer l'accès à tout moment.

**7.2. Consentement au partage**

Le partage nécessite un **consentement explicite** de l'Athlète (consentementPartage), recueilli et tracé de manière immuable. Ce consentement est vérifié **avant** toute opération de partage ou d'export.

**7.3. Contrôle d'accès granulaire (ABAC)**

La Plateforme implémente un contrôle d'accès par attributs (ABAC) qui vérifie pour chaque requête :
• L'identité du Professionnel ;
• Son lien avec l'Athlète (propriétaire ou connexion autorisée) ;
• Les catégories de données autorisées ;
• Le niveau d'accès accordé.

**7.4. Journalisation et audit**

Pour la sécurité et la traçabilité, la Plateforme conserve un historique :
• Des autorisations données et des révocations ;
• Des consultations de profils et documents ;
• Des exports de données (avec quotas : 1 export/heure, 10/jour) ;
• Des modifications de dossiers.

Ces logs sont conservés pour la durée nécessaire à l'audit et à la sécurité.

**7.5. Révocation**

La révocation du consentement au partage bloque **immédiatement** les futures opérations de partage. Les connexions existantes restent en place mais ne permettent plus de nouvelles actions. Les journaux d'accès antérieurs sont conservés conformément aux durées de conservation applicables.

**7.6. Protection contre l'exfiltration**

Des mesures de limitation sont en place pour prévenir les copies massives :
• Quotas de téléchargement par utilisateur (volume et nombre) ;
• Rate limiting sur les exports et téléchargements ;
• Marquage de confidentialité sur les documents sensibles ;
• Journalisation complète des téléchargements.`,
  },
  {
    id: "acces-donnees",
    title: "8. Qui peut accéder à vos données ?",
    content: `**8.1. Au sein de Tuatha**

L'accès est limité aux personnes habilitées (support technique, sécurité, exploitation) selon le **principe du moindre privilège**. Les opérations d'administration sensibles sont protégées par un jeton d'accès dédié (ADMIN_SECRET).

**8.2. Entre utilisateurs**

Les Professionnels n'accèdent qu'aux données que l'Athlète a **explicitement** partagées, et uniquement dans les catégories et niveaux d'accès autorisés. Le Professionnel propriétaire (référent) a un accès complet au dossier de ses propres athlètes.

**8.3. Prestataires (sous-traitants)**

Tuatha peut recourir à des prestataires techniques :
• Hébergement et infrastructure ;
• Envoi d'emails transactionnels (vérification, notifications) ;
• Stockage de fichiers ;
• Services d'analyse et de monitoring.

Ces prestataires sont encadrés par des **accords de sous-traitance** (DPA) conformes à l'article 28 du RGPD, avec des exigences de sécurité et de confidentialité.`,
  },
  {
    id: "hebergement",
    title: "9. Hébergement, HDS et localisation",
    content: `**9.1. Localisation des données**

Les données sont hébergées en France / Union Européenne.

**9.2. Hébergement de Données de Santé (HDS)**

La Plateforme est susceptible d'héberger des données de santé à caractère personnel au sens de l'article L.1111-8 du Code de la santé publique. La certification HDS (Hébergeur de Données de Santé) constitue la référence en matière d'e-santé.

Tuatha s'engage à mettre en conformité l'hébergement des données de santé et communiquera les éléments relatifs à la certification HDS (périmètre couvert, garanties) dès que celle-ci sera finalisée. Cette Politique sera mise à jour en conséquence.

**9.3. Transferts hors UE**

Si certains prestataires impliquent des transferts de données hors de l'Union Européenne, Tuatha met en place les garanties appropriées :
• Clauses contractuelles types (CCT) de la Commission européenne ;
• Mesures complémentaires (chiffrement, pseudonymisation) ;
• Documentation des transferts et évaluation de la législation du pays destinataire.`,
  },
  {
    id: "ia",
    title: "10. Intelligence Artificielle (OpenAI)",
    content: `La Plateforme utilise des services d'intelligence artificielle (OpenAI) pour des fonctionnalités d'assistance :
• Vérification automatique des documents professionnels (diplômes, justificatifs) ;
• Analyse et structuration de contenus ;
• Aide à la qualification et au tri d'informations.

**10.1. Données transmises à l'IA**

Seules les données strictement nécessaires à la fonctionnalité sont transmises (principe de minimisation). Les données de santé des patients ne sont **pas** envoyées à des services d'IA tiers sans nécessité fonctionnelle documentée.

**10.2. Encadrement**

OpenAI agit en tant que sous-traitant, encadré contractuellement. L'utilisation est transparente : les résultats d'analyse IA sont identifiés comme tels dans l'interface (score de confiance, résumé IA).

**10.3. Aucune décision médicale automatisée**

Les résultats de l'IA sont des **assistances techniques**. Ils ne constituent en aucun cas :
• Un diagnostic médical ;
• Une décision clinique ;
• Une recommandation thérapeutique.

Le Professionnel reste seul responsable de ses décisions cliniques.`,
  },
  {
    id: "cookies",
    title: "11. Cookies et traceurs",
    content: `Tuatha utilise des cookies dans le cadre réglementaire de la CNIL :

**Cookies strictement nécessaires** (sans consentement préalable) :
• Cookie de session d'authentification ;
• Jeton de sécurité (CSRF) ;
• Préférences fonctionnelles essentielles.

**Cookies soumis au consentement** (si activés) :
• Mesure d'audience et analytics ;
• Fonctionnalités tierces.

Conformément aux lignes directrices de la CNIL, les cookies non essentiels nécessitent un **consentement préalable** et un mécanisme simple pour refuser ou paramétrer les préférences (bandeau cookies / CMP).`,
  },
  {
    id: "durees-conservation",
    title: "12. Durées de conservation",
    content: `Tuatha conserve les données le temps nécessaire aux finalités déclarées, puis les supprime ou les anonymise. Les durées ci-dessous sont des **maximums légaux** — la suppression peut intervenir plus tôt à la demande de l'utilisateur.

**Données médicales / de santé**
| Type | Durée maximale | Base légale |
|---|---|---|
| Profils athlètes archivés inactifs | 5 ans → anonymisation | CSP Art. R.1112-7, RGPD Art. 5(1)(e) |
| Notes cliniques | 5 ans | CSP Art. R.1112-7 |
| Ordonnances supprimées | 5 ans | CSP Art. R.1112-7, Art. L.1111-8 |
| Protocoles médicaux supprimés | 5 ans | CSP Art. R.1112-7 |
| Plans kiné / nutrition supprimés | 3 ans | RGPD Art. 5(1)(e) |

**Données opérationnelles**
| Type | Durée maximale | Base légale |
|---|---|---|
| Logs d'exercices | 3 ans | RGPD Art. 5(1)(e) |
| Séances supprimées | 2 ans | RGPD Art. 5(1)(e) |
| Événements supprimés | 1 an | RGPD Art. 5(1)(e) |
| Tâches supprimées | 6 mois | RGPD Art. 5(1)(e) |

**Facturation & comptabilité**
| Type | Durée maximale | Base légale |
|---|---|---|
| Factures supprimées | 10 ans | Code de commerce Art. L.123-22 |
| Cabinets supprimés | 2 ans | RGPD Art. 5(1)(e) |

**Communication**
| Type | Durée maximale | Base légale |
|---|---|---|
| Messages supprimés | 1 an | RGPD Art. 5(1)(e) |
| Notes collaboratives supprimées | 2 ans | RGPD Art. 5(1)(e) |
| Documents partagés supprimés | 3 ans | CSP Art. R.1112-7 |
| Vidéos supprimées | 1 an | RGPD Art. 5(1)(e) |

**Sécurité & audit**
| Type | Durée maximale | Base légale |
|---|---|---|
| Alertes de sécurité | 1 an | CNIL recommandation |
| Sessions révoquées | 6 mois | CNIL recommandation |
| Logs de consentement | **Indéfinie** | **RGPD Art. 7(1)** — preuve du consentement |
| Demandes de droits RGPD | **Indéfinie** | **RGPD Art. 5(2)** — responsabilisation |

**Processus automatique** : un mécanisme d'application des durées de conservation supprime ou anonymise automatiquement les données expirées. Les profils d'athlètes archivés inactifs au-delà de la durée applicable sont anonymisés de manière irréversible.`,
  },
  {
    id: "securite",
    title: "13. Mesures de sécurité",
    content: `Tuatha met en œuvre des mesures techniques et organisationnelles proportionnées au niveau de sensibilité des données traitées :

**Authentification et accès**
• Politique de mot de passe forte (8 caractères min., majuscule, minuscule, chiffre, caractère spécial) ;
• Authentification multifacteur (MFA/TOTP) avec génération de QR code et vérification en temps réel ;
• Support des clés de sécurité physiques (WebAuthn/FIDO2/Passkeys) pour une authentification sans mot de passe ;
• Vérification de l'adresse email par code à usage unique (OTP) avec expiration à 15 minutes ;
• Sessions révocables avec rotation automatique des tokens (token families) et détection de réutilisation ;
• Détection des emails jetables et temporaires (anti-temp-mail) ;
• Blocage actif des connexions via VPN, proxy, Tor — détection multi-couches (IP intelligence, heuristiques, DNS Tor, plages datacenter).

**Protection des données**
• **Chiffrement au repos** : AES-256-GCM pour les données sensibles et médicales stockées en base (clé gérée via coffre-fort applicatif) ;
• **Chiffrement en transit** : HTTPS/TLS sur toutes les communications ;
• Hachage des mots de passe (bcrypt, coût 12) — jamais stockés en clair ;
• URLs signées (HMAC-SHA256 + expiration) pour l'accès aux fichiers — aucun lien permanent public ;
• **Rédaction automatique** des données sensibles : masquage, omission ou résumé des champs selon le niveau d'accès du demandeur et la classification de sensibilité du champ ;
• Soft-delete avec délai de purge (30 jours) pour la protection contre les suppressions accidentelles ;
• Minimisation des données dans les réponses API (projection par champs) ;
• **Protection anti-capture d'écran** (ScreenShield) : superposition de protection visuelle sur les interfaces contenant des données sensibles ;
• Gestion centralisée des secrets applicatifs (vault) avec rotation documentée.

**Détection et prévention**
• Rate limiting sur les opérations sensibles (authentification, exports, téléchargements, inscriptions) ;
• Détection de credential stuffing et d'énumération de comptes avec alertes automatiques ;
• Quotas de téléchargement par utilisateur (volume et nombre — anti-exfiltration) ;
• Alertes de sécurité automatiques (activité anormale, connexions suspectes, tentatives de force brute) ;
• Analyse antivirus des fichiers téléversés (ClamAV) avec vérification des magic bytes ;
• **Détection de risques** : scoring comportemental en temps réel (connexions inhabituelles, changements d'appareil, patterns suspects) ;
• Protection IDOR (Insecure Direct Object Reference) : vérification systématique que l'utilisateur a le droit d'accéder à la ressource demandée ;
• Sanitisation des entrées utilisateur (XSS, injection HTML/SQL) sur toutes les routes API.

**Contrôle d'accès**
• RBAC (Role-Based Access Control) par spécialité professionnelle avec restrictions de téléchargement par rôle ;
• ABAC (Attribute-Based Access Control) granulaire pour l'accès aux données des athlètes (par catégorie et niveau) ;
• Vérification du consentement avant tout partage ou export ;
• Contrôle des exports par rôle avec niveaux de confidentialité (standard, confidentiel, restreint) ;
• Principe du moindre privilège pour les accès internes ;
• Classification des données médicales par champ avec niveaux de sensibilité (public, interne, confidentiel, restreint).

**Journalisation et audit**
• Journalisation des accès aux données sensibles ;
• Journal immuable des consentements (ConsentLog) ;
• Registre des demandes d'exercice de droits (SubjectAccessRequest) ;
• Traçabilité des exports et téléchargements avec audit complet ;
• Journalisation administrative des actions sensibles ;
• Suivi de la continuité des soins (historique d'activité par professionnel).

**Réponse aux incidents**
• **Contrôles d'urgence** : révocation globale de toutes les sessions, mode lecture seule (blocage des écritures), kill switches par intégration tierce ;
• Procédures de rotation des clés et secrets documentées ;
• Sauvegardes automatiques avec chiffrement et objectifs de temps de reprise définis ;
• Procédures de notification en cas de violation de données (RGPD Art. 33 et 34).`,
  },
  {
    id: "droits",
    title: "14. Vos droits (RGPD) et comment les exercer",
    content: `Conformément au RGPD, vous disposez des droits suivants :

**14.1. Droit d'accès** (Art. 15)
Obtenir l'export complet de toutes vos données personnelles dans un format structuré et lisible (JSON). L'export inclut : profil, consentements, notes, séances, documents, factures, messages, plans de soins, ordonnances, protocoles, vidéos, événements et tâches.

**14.2. Droit de rectification** (Art. 16)
Corriger les données personnelles inexactes. Les champs rectifiables directement sont : nom, email, téléphone, date de naissance, taille, poids, sport, objectif, motif, zone corporelle, fréquence, canal de communication. Les données cliniques saisies par un Professionnel sont rectifiées par celui-ci dans le dossier.

**14.3. Droit à l'effacement** (Art. 17)
Obtenir l'anonymisation irréversible de vos données personnelles, **sous réserve** des obligations légales de conservation :
• Factures : conservation obligatoire 10 ans (Code de commerce Art. L.123-22) — anonymisation partielle appliquée ;
• Dossier médical : conservation selon CSP Art. R.1112-7.
En cas d'obligation de conservation, une anonymisation partielle est appliquée automatiquement (suppression des données identifiantes, maintien des données soumises à obligation).

**14.4. Droit à la limitation** (Art. 18)
**14.5. Droit à la portabilité** (Art. 20)
**14.6. Droit d'opposition** (Art. 21)

**14.7. Retrait du consentement**
Lorsque le traitement est fondé sur le consentement, vous pouvez le retirer à tout moment. Le retrait ne remet pas en cause la licéité du traitement effectué avant le retrait.

**14.8. Traçabilité des demandes**
Chaque exercice de droit est enregistré dans un registre dédié (SubjectAccessRequest) incluant : type de droit, statut, résultat, horodatage, adresse IP et agent utilisateur.

**14.9. Comment exercer vos droits**

• **Via la Plateforme** : menu « Droits RGPD » du dossier athlète, accessible au Professionnel référent ;
• **Par email** : contact@tuatha-app.com ;
• **Par téléphone** : +33 6.71.63.83.06.

**Délai** : 1 mois maximum à compter de la réception de la demande (RGPD Art. 12(3)), prolongeable de 2 mois en cas de complexité.

Nous pouvons demander une **preuve d'identité** en cas de doute raisonnable sur l'identité du demandeur.

**14.10. Réclamation**
Vous pouvez introduire une réclamation auprès de la CNIL :
Commission Nationale de l'Informatique et des Libertés — www.cnil.fr`,
  },
  {
    id: "donnees-tiers",
    title: "15. Données de tiers",
    content: `Vous vous engagez à ne pas importer ni partager sur la Plateforme des documents ou informations contenant des données personnelles de tiers sans droit ni autorisation (par exemple : documents médicaux d'une autre personne, données d'identification de tiers non concernés).

En cas de partage de données de tiers dans le cadre professionnel légitime (par exemple, partage interprofessionnel pour la continuité des soins), le Professionnel s'assure de disposer des autorisations nécessaires.`,
  },
  {
    id: "mineurs",
    title: "16. Mineurs",
    content: `La Plateforme est destinée aux professionnels de santé et du sport. Les données de mineurs ne sont collectées que dans le cadre du suivi par un Professionnel habilité, avec le consentement du représentant légal lorsque requis par la réglementation applicable.`,
  },
  {
    id: "mises-a-jour",
    title: "17. Mise à jour de cette Politique",
    content: `Nous pouvons mettre à jour cette Politique pour refléter :
• Des évolutions légales ou réglementaires ;
• Des changements techniques (hébergeur, périmètre HDS, prestataires) ;
• L'ajout de fonctionnalités (IA, intégrations tierces).

En cas de modification substantielle :
• Vous serez informé par notification sur la Plateforme et/ou par email ;
• Une nouvelle acceptation sera requise si nécessaire ;
• La version acceptée et la date d'acceptation sont conservées dans le système.

L'historique des versions est maintenu et consultable.`,
  },
  {
    id: "contact",
    title: "18. Contact",
    content: `**Tuatha SAS** — Paris

Email : contact@tuatha-app.com
Téléphone : +33 6.71.63.83.06

Pour toute question relative à la protection de vos données personnelles ou pour exercer vos droits, n'hésitez pas à nous contacter.`,
  },
];
