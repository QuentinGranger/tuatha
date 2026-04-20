// ─── CGU Pro — Conditions Générales d'Utilisation Professionnel ───
// Version centralisée. Importée par la page /cgu-pro et le formulaire d'inscription professionnel.

export const CGU_PRO_VERSION = "1.0";
export const CGU_PRO_DATE = "16/03/2026";

export const CGU_PRO_SECTIONS = [
  {
    id: "preambule",
    title: "Préambule",
    content: `Les présentes Conditions Générales d'Utilisation Professionnel (les « **CGU Pro** ») définissent les conditions dans lesquelles un professionnel de santé, du sport, du bien-être ou de l'accompagnement (le « **Professionnel** ») peut créer un Compte, être référencé, utiliser les services proposés par la plateforme Tuatha (la « **Plateforme** ») et, le cas échéant, proposer des Prestations à destination des Athlètes.

Les présentes CGU Pro encadrent notamment :
• le référencement du Professionnel sur la Plateforme ;
• l'utilisation des outils Tuatha (messagerie, visioconférence, agenda, plans de soins, programmes, réseau interprofessionnel, documents, indicateurs, kanban) ;
• la publication des Prestations ;
• les règles relatives aux paiements et reversements ;
• les obligations du Professionnel ;
• les règles de conformité, de suspension et de résiliation.

Les présentes CGU Pro complètent les **CGU globales** de la Plateforme, les **CGV Athlète**, la **Politique de Confidentialité**, la **Charte de Partage des Données**, ainsi que tout document contractuel, politique ou annexe communiqué par Tuatha.

En cas de contradiction :
• les **CGV Athlète** prévalent pour les relations de vente conclues avec un Athlète ;
• les présentes **CGU Pro** prévalent pour les relations entre Tuatha et le Professionnel.

Le Professionnel reconnaît avoir pris connaissance des présentes CGU Pro avant toute création de Compte ou utilisation des services réservés aux professionnels.`,
  },
  {
    id: "definitions",
    title: "1. Définitions",
    content: `Au sens des présentes CGU Pro, les termes suivants ont la signification ci-dessous :

• **Plateforme** : site, application, interfaces, modules, logiciels, API et services numériques opérés par Tuatha.
• **Tuatha** : société éditrice et opératrice de la Plateforme (Tuatha SAS).
• **Professionnel** : personne physique ou morale utilisant la Plateforme dans le cadre de son activité professionnelle, appartenant à l'une des quatre catégories autorisées (médecin, kinésithérapeute, diététicien, autre professionnel).
• **Compte Professionnel** : espace personnel dédié au Professionnel sur la Plateforme, protégé par des identifiants et une authentification sécurisée (mot de passe et/ou Passkey WebAuthn/FIDO2).
• **Athlète** : utilisateur de la Plateforme pouvant consulter le profil du Professionnel, réserver ou payer une Prestation, et contrôler le partage de ses données via les réglages de confidentialité.
• **Prestation** : tout service, consultation, séance, accompagnement, suivi, contenu ou offre proposé par le Professionnel via la Plateforme.
• **Commande** : réservation et, le cas échéant, paiement d'une Prestation par un Athlète via la Plateforme.
• **Commission** : rémunération due à Tuatha en contrepartie des services fournis au Professionnel.
• **Prestataire de paiement** : prestataire tiers agréé chargé du traitement des flux financiers liés aux transactions réalisées via la Plateforme.
• **Reversement** : somme versée ou mise à disposition du Professionnel après traitement d'une transaction, selon les modalités applicables.
• **Documents Professionnels** : tous documents relevant de la responsabilité propre du Professionnel, notamment facture, note d'honoraires, reçu, document de consultation, feuille de soins, justificatif métier, ordonnance ou document utile à une prise en charge éventuelle.
• **RPPS** : Répertoire Partagé des Professionnels de Santé, numéro d'identification obligatoire pour les médecins, kinésithérapeutes et diététiciens.
• **Réseau interprofessionnel** : fonctionnalité permettant aux Professionnels de collaborer autour d'un Athlète commun.`,
  },
  {
    id: "objet",
    title: "2. Objet",
    content: `Les présentes CGU Pro ont pour objet de définir les conditions dans lesquelles Tuatha met à disposition du Professionnel une infrastructure numérique lui permettant notamment :

• de créer un profil professionnel ;
• de présenter son activité et ses spécialités ;
• de publier des Prestations ;
• d'utiliser les outils de communication (messagerie individuelle et de groupe, visioconférence intégrée) ;
• d'utiliser les outils d'organisation (agenda, gestion de rendez-vous, créneaux de disponibilité) ;
• d'utiliser les outils de suivi (plans de soins, programmes, sessions, indicateurs, kanban, alertes, documents partagés) ;
• de collaborer avec d'autres Professionnels via le réseau interprofessionnel ;
• de bénéficier, selon les fonctionnalités activées, d'un parcours de paiement intégré et d'un système de reversement.

Les présentes CGU Pro ne constituent ni un contrat de travail, ni un mandat général, ni une société commune, ni une association entre Tuatha et le Professionnel.

Le Professionnel exerce son activité de manière indépendante, sous sa seule responsabilité.`,
  },
  {
    id: "role-tuatha",
    title: "3. Rôle de Tuatha",
    content: `**3.1. Opérateur de plateforme**

Tuatha agit en qualité d'éditeur et d'opérateur d'une plateforme d'intermédiation et de réservation avec, le cas échéant, paiement intégré.

Tuatha met à disposition une infrastructure technique permettant notamment :
• le référencement de profils professionnels ;
• la mise en relation avec des Athlètes ;
• la réservation de Prestations ;
• les échanges et partages d'informations (messagerie, documents, visioconférence) ;
• les outils de suivi et de gestion (plans, programmes, sessions, kanban, indicateurs) ;
• certains services transactionnels.

**3.2. Absence d'exercice de l'activité du Professionnel**

Tuatha n'exerce pas l'activité professionnelle du Professionnel en son nom. Sauf mention expresse contraire, Tuatha n'est pas le fournisseur de la Prestation, n'en fixe pas le contenu métier, n'en assure pas l'exécution et ne se substitue pas au Professionnel dans ses obligations légales, réglementaires, déontologiques, fiscales, sociales, comptables ou assurantielles.

**3.3. Limites du rôle de Tuatha**

Tuatha ne garantit notamment pas :
• un volume minimum de visibilité, de réservation, de chiffre d'affaires ou de revenus ;
• un nombre minimum d'Athlètes ;
• la pertinence d'un Athlète pour le Professionnel ;
• la disponibilité continue de la Plateforme sans interruption ;
• l'éligibilité d'une Prestation à un remboursement, une prise en charge ou un tiers payant ;
• l'absence d'incident imputable à un tiers, notamment au Prestataire de paiement ou à l'établissement bancaire concerné.`,
  },
  {
    id: "eligibilite",
    title: "4. Conditions d'éligibilité du Professionnel",
    content: `Le Professionnel déclare et garantit qu'il dispose de la capacité et des droits nécessaires pour conclure les présentes CGU Pro et utiliser la Plateforme dans un cadre professionnel.

La Plateforme distingue quatre catégories de Professionnels :
• **Médecin** : professionnel de santé inscrit au RPPS. Numéro RPPS (11 chiffres) obligatoire à l'inscription.
• **Kinésithérapeute** : professionnel de santé inscrit au RPPS. Numéro RPPS (11 chiffres) obligatoire à l'inscription.
• **Diététicien** : professionnel de santé inscrit au RPPS. Numéro RPPS (11 chiffres) obligatoire à l'inscription.
• **Autre professionnel** : nutritionniste, coach sportif, préparateur physique ou tout autre intervenant. Numéro de carte professionnelle ou SIRET obligatoire à l'inscription.

Le Professionnel s'engage à n'utiliser la Plateforme que s'il dispose, lorsque cela est requis :
• des diplômes, titres, certifications ou autorisations nécessaires ;
• des numéros professionnels, inscriptions ordinales ou références administratives applicables (RPPS, carte pro, SIRET) ;
• d'une assurance responsabilité civile professionnelle valide ;
• d'une structure juridique régulière lorsqu'il agit pour le compte d'une personne morale ;
• de tout droit ou pouvoir nécessaire pour engager la structure qu'il représente.

Tuatha se réserve le droit de demander à tout moment tout justificatif utile, y compris un document de vérification (diplôme, certificat, justificatif professionnel) au format PDF, JPEG ou PNG.`,
  },
  {
    id: "compte",
    title: "5. Création et validation du Compte Professionnel",
    content: `**5.1. Création du Compte**

Le Professionnel doit créer un Compte Professionnel en fournissant l'ensemble des informations demandées par Tuatha, notamment : nom, prénom, email, téléphone, spécialité, numéro de vérification (RPPS, carte pro ou SIRET), mot de passe conforme à la politique de sécurité, et document de vérification.

Le Professionnel s'engage à fournir des informations exactes, complètes, sincères et à jour.

**5.2. Vérification de l'email**

L'inscription est subordonnée à la vérification de l'adresse email par un code à usage unique envoyé au Professionnel. Ce code est valable 15 minutes.

Les adresses email temporaires ou jetables ne sont pas acceptées.

**5.3. Vérifications documentaires**

Tuatha peut procéder à des vérifications documentaires, techniques, déclaratives, administratives ou de cohérence. Ces vérifications peuvent porter notamment sur :
• l'identité ;
• la qualité professionnelle (numéro RPPS, carte pro, SIRET) ;
• la structure juridique ;
• les coordonnées ;
• les documents d'assurance ;
• les informations bancaires ;
• les pièces demandées par le Prestataire de paiement.

Ces vérifications visent à sécuriser la Plateforme sans constituer une validation exhaustive ou une certification professionnelle complète.

**5.4. Statuts du Compte**

Le Compte Professionnel peut avoir différents statuts :
• **non vérifié** (email non confirmé) ;
• **en attente** (documents soumis, en cours de revue) ;
• **vérifié** (identité et qualité confirmées) ;
• **rejeté** (documents insuffisants ou invalides) ;
• **suspendu** ou **désactivé** (mesure de sécurité ou manquement).

Le Professionnel reconnaît que la création d'un Compte ou l'envoi de pièces ne lui donne aucun droit acquis à l'activation, au référencement, à la visibilité ou à l'accès aux services transactionnels.

**5.5. Sécurité du Compte**

Le Professionnel est seul responsable de la confidentialité de ses identifiants, de l'usage de son Compte et de l'ensemble des actions réalisées depuis celui-ci.

La Plateforme propose des mécanismes d'authentification renforcée, notamment les **Passkeys (WebAuthn/FIDO2)**, l'authentification TOTP et la gestion des sessions actives (révocation à distance, historique des connexions, empreinte d'appareil).

Le Professionnel s'engage à signaler sans délai toute suspicion d'accès non autorisé, de fraude ou de compromission via la procédure « Compte compromis » (page Support & aide).`,
  },
  {
    id: "profil",
    title: "6. Profil professionnel et informations publiées",
    content: `Le Professionnel peut être amené à publier sur la Plateforme notamment :
• son identité ou sa dénomination ;
• sa profession et sa catégorie ;
• sa spécialité ;
• sa photo de profil ;
• sa présentation ;
• l'adresse de son cabinet ;
• ses prestations et tarifs ;
• ses disponibilités ;
• ses documents ou informations utiles ;
• tout contenu complémentaire autorisé par la Plateforme.

Le Professionnel garantit que les contenus qu'il publie :
• sont exacts, loyaux, licites et non trompeurs ;
• ne portent pas atteinte aux droits de tiers ;
• correspondent à la réalité de son activité ;
• respectent la réglementation qui lui est applicable.

Le Professionnel peut gérer la visibilité de son profil via le paramètre **« Référencement »** (searchable). Si désactivé, son profil n'apparaît plus dans les résultats de recherche des Athlètes.

Tuatha se réserve le droit de modérer, reformater, déréférencer, masquer ou supprimer tout contenu qui serait contraire à la loi, aux présentes CGU Pro, à l'intérêt du service ou à la sécurité de la Plateforme.`,
  },
  {
    id: "prestations",
    title: "7. Prestations proposées par le Professionnel",
    content: `Le Professionnel détermine, sous sa seule responsabilité :
• les Prestations qu'il souhaite proposer ;
• leur contenu ;
• leurs prérequis ;
• leurs modalités d'exécution ;
• leur durée indicative ;
• leurs tarifs ;
• leur caractère présentiel ou en **visioconférence** (fonctionnalité intégrée à la Plateforme).

Le Professionnel s'engage à ne proposer que des Prestations qu'il est effectivement habilité et en mesure de réaliser.

Il s'interdit de présenter comme certaines, garanties ou automatiques des informations relatives à des remboursements, des prises en charge ou des résultats lorsqu'une telle certitude n'existe pas.

**Précisions sur les catégories et le remboursement :**
• **Médecin** et **Kinésithérapeute** : professionnels de santé inscrits au RPPS. Prestations susceptibles d'être remboursées par l'Assurance Maladie selon les conditions en vigueur.
• **Diététicien** : professionnel de santé inscrit au RPPS. Prestations remboursables sous certaines conditions.
• **Autre professionnel** : prestations **non remboursables** par l'Assurance Maladie.

Le Professionnel est tenu d'informer loyalement les Athlètes sur le caractère remboursable ou non de ses prestations.`,
  },
  {
    id: "obligations",
    title: "8. Obligations générales du Professionnel",
    content: `Le Professionnel s'engage à :
• exercer son activité de manière indépendante, loyale, professionnelle et conforme à la réglementation qui lui est applicable ;
• fournir des informations exactes, à jour et complètes ;
• maintenir à jour son profil, ses disponibilités, ses prix et ses documents ;
• respecter les Athlètes, Tuatha et les autres utilisateurs ;
• ne pas utiliser la Plateforme à des fins frauduleuses, trompeuses, illicites ou abusives ;
• respecter ses obligations fiscales, sociales, comptables, réglementaires, professionnelles et déontologiques ;
• détenir les assurances requises ;
• ne pas porter atteinte à l'image, à la sécurité ou au fonctionnement de la Plateforme ;
• respecter les **réglages de confidentialité** définis par chaque Athlète (données médicales, données générales, accès aux informations de santé) ;
• ne pas tenter de contourner les restrictions d'accès aux données mises en place par un Athlète.

Le Professionnel demeure seul responsable de son activité, des conseils ou actes délivrés, des décisions prises dans le cadre de la relation avec l'Athlète, ainsi que des conséquences de ces décisions.`,
  },
  {
    id: "reservation",
    title: "9. Réservation et relation avec les Athlètes",
    content: `Lorsque la Plateforme permet la réservation d'une Prestation, le Professionnel s'engage à :
• honorer les créneaux proposés, sous réserve de cas légitimes ;
• informer au plus tôt l'Athlète en cas d'empêchement ;
• ne pas créer de confusion sur le contenu, le prix ou les conditions de la Prestation ;
• traiter les Athlètes de manière loyale, respectueuse et non discriminatoire.

**Outils de suivi et de communication**

La Plateforme met à disposition du Professionnel des outils pour la relation avec l'Athlète, notamment :
• **Messagerie** : échanges individuels et de groupe, pièces jointes, réactions, messages importants et épinglés ;
• **Visioconférence** : consultations à distance intégrées, avec salles dédiées par rendez-vous ;
• **Plans de soins / programmes** : création, suivi, exercices avec vidéos, journaux d'activité ;
• **Documents partagés** : échange de fichiers, ordonnances, comptes rendus ;
• **Alertes** : système de signalement médical par l'Athlète (douleur, symptôme, urgence) ;
• **Sessions** : suivi détaillé avec RPE, douleur, feedback, analyse professionnelle.

L'usage de ces outils doit s'inscrire dans un cadre professionnel et respecter les droits de l'Athlète, y compris ses réglages de confidentialité.

Le Professionnel reconnaît que les ventes conclues avec les Athlètes via la Plateforme sont également encadrées par les **CGV Athlète**.`,
  },
  {
    id: "paiement",
    title: "10. Paiement intégré et Prestataire de paiement",
    content: `**10.1. Paiement en ligne sécurisé via un Prestataire de Services de Paiement (PSP)**

Lorsque le service de paiement intégré est activé, les flux financiers transitent par un **Prestataire de Services de Paiement (PSP)** tiers, agréé et régulé conformément à la réglementation applicable.

**Tuatha n'encaisse pas directement les fonds des Athlètes.** Les sommes versées par les Athlètes transitent par le PSP, qui assure la collecte, la sécurisation et, le cas échéant, le reversement au Professionnel selon les modalités contractuelles applicables.

Le Professionnel reconnaît que l'accès à certaines fonctionnalités transactionnelles peut être subordonné :
• à l'ouverture, à la validation ou au maintien d'un compte auprès du PSP concerné ;
• à la fourniture de documents ou informations complémentaires (KYC) ;
• au respect des conditions du PSP.

**10.2. Obligations du Professionnel**

Le Professionnel s'engage à fournir toutes informations et pièces requises pour la mise en place et le maintien de son accès au paiement intégré, notamment celles demandées au titre des obligations réglementaires du PSP (KYC / lutte anti-blanchiment).

Le Professionnel s'engage à maintenir des coordonnées bancaires valides, exactes et à jour.

**10.3. Incidents et restrictions**

Tuatha peut suspendre ou limiter l'accès du Professionnel au paiement intégré en cas notamment de :
• compte incomplet ;
• document expiré ou invalide ;
• demande du PSP ;
• suspicion de fraude ;
• litige ou contestation sérieuse ;
• risque de conformité ;
• non-respect des présentes CGU Pro.

**10.4. Prise en charge Assurance Maladie / mutuelle — Rôle et limites**

Tuatha n'est **ni un organisme de Sécurité sociale, ni une mutuelle, ni une complémentaire santé, ni un organisme d'assurance**. Tuatha est un opérateur de plateforme. Le paiement d'une Prestation via la Plateforme **ne constitue pas une prise en charge** par l'Assurance Maladie ou par tout organisme tiers.

**Aucun remboursement automatique n'est garanti.** La prise en charge éventuelle d'une Prestation par l'Assurance Maladie, une mutuelle ou une complémentaire dépend de facteurs que Tuatha ne contrôle pas, notamment :
• le **type de Professionnel** et son statut réglementaire ;
• la **situation personnelle de l'Athlète** (régime, parcours de soins, prescription, etc.) ;
• les **conditions de la complémentaire santé** de l'Athlète ;
• la **nature de la Prestation** (acte conventionné ou non, présentiel ou à distance) ;
• les **règles en vigueur** des organismes payeurs.

Au stade actuel du service, Tuatha **n'assure pas** : le tiers payant, la télétransmission SESAM-Vitale, la télétransmission vers les mutuelles, le calcul du reste à charge, ni la vérification d'éligibilité.

Les **justificatifs de transaction** mis à disposition par Tuatha documentent l'opération financière. **Ils ne constituent pas des feuilles de soins, des notes d'honoraires, ni des documents ouvrant droit à remboursement.** Les documents professionnels nécessaires à une éventuelle demande de prise en charge relèvent de la **responsabilité exclusive du Professionnel**.

**La démarche de remboursement auprès de l'Assurance Maladie, d'une mutuelle ou de tout organisme tiers reste une démarche personnelle de l'Athlète, effectuée en dehors de la Plateforme.** Tuatha n'intervient pas dans cette démarche et n'en garantit pas le résultat.

Le Professionnel s'engage à ne pas présenter comme certains, garantis ou automatiques des remboursements ou prises en charge lorsqu'une telle certitude n'existe pas, et à informer loyalement les Athlètes sur le caractère remboursable ou non de ses prestations.`,
  },
  {
    id: "commission",
    title: "11. Commission Tuatha",
    content: `**11.1. Principe**

En contrepartie des services fournis au Professionnel, Tuatha perçoit une Commission.

Cette Commission rémunère notamment, selon les fonctionnalités activées :
• le référencement sur la Plateforme ;
• les outils de mise en relation ;
• les outils de réservation ;
• l'infrastructure technique (messagerie, visioconférence, documents, indicateurs, kanban) ;
• le paiement intégré ;
• certains outils documentaires, support ou services associés.

**11.2. Montant et structure**

Le montant, le taux, l'assiette, les frais fixes éventuels et les modalités d'application de la Commission sont communiqués au Professionnel lors de son onboarding, dans son interface, dans un document commercial, dans une annexe tarifaire ou par tout autre moyen contractuel approprié.

Sauf indication contraire expresse, Tuatha peut modifier la structure tarifaire pour l'avenir, sous réserve d'une information préalable raisonnable du Professionnel.

**11.3. Déduction**

Lorsque la structure de paiement le prévoit, la Commission peut être prélevée, retenue, déduite ou compensée sur les montants encaissés avant Reversement au Professionnel.`,
  },
  {
    id: "reversements",
    title: "12. Reversements",
    content: `**12.1. Principe**

Le Reversement correspond au montant destiné au Professionnel après prise en compte notamment :
• du paiement effectif par l'Athlète ;
• de la Commission Tuatha ;
• des frais applicables ;
• des annulations ;
• des remboursements ;
• des litiges ;
• des contestations ou chargebacks ;
• de toute retenue légitime liée à la sécurité ou à la conformité.

**12.2. Délais**

Les délais de Reversement dépendent de la configuration du service, des règles du Prestataire de paiement, des délais bancaires et, le cas échéant, des mesures de sécurité ou de revue applicables.

Les délais communiqués par Tuatha sont indicatifs sauf engagement exprès contraire.

**12.3. Suspension d'un Reversement**

Tuatha peut suspendre tout ou partie d'un Reversement en cas notamment de :
• demande du Prestataire de paiement ;
• litige avec un Athlète ;
• suspicion de fraude ;
• non-conformité documentaire ;
• non-respect des présentes CGU Pro ;
• risque financier ou réglementaire ;
• nécessité de préserver les intérêts de la Plateforme, des Athlètes ou d'un tiers.`,
  },
  {
    id: "annulations",
    title: "13. Annulations, remboursements et litiges",
    content: `Le Professionnel reconnaît que les annulations et remboursements vis-à-vis des Athlètes sont régis par les **CGV Athlète**, et notamment la politique standard d'annulation :
• Annulation **plus de 48 heures** avant le rendez-vous : remboursement intégral ;
• Annulation **entre 24 et 48 heures** : remboursement de 50 % ;
• Annulation **moins de 24 heures** : aucun remboursement ;
• **Non-présentation** sans annulation préalable : aucun remboursement.

Le Professionnel accepte que Tuatha puisse :
• appliquer la politique d'annulation affichée sur la Plateforme ;
• procéder à un remboursement lorsque celui-ci est dû ;
• retenir des sommes en cas de litige, chargeback, contestation sérieuse ou suspicion de fraude ;
• demander des justificatifs utiles à l'instruction d'une réclamation.

Le Professionnel s'engage à coopérer de bonne foi en cas de litige avec un Athlète, notamment en fournissant sans délai les éléments utiles à l'instruction du dossier.`,
  },
  {
    id: "documents-pro",
    title: "14. Documents professionnels et obligations métier",
    content: `Le Professionnel demeure seul responsable de l'émission, de l'exactitude, du contenu, de la conformité, de la conservation et de la transmission des Documents Professionnels qui relèvent de sa profession ou de son activité.

Cela inclut notamment, lorsque cela est applicable :
• les factures ;
• les notes d'honoraires ;
• les reçus professionnels ;
• les documents de consultation ;
• les feuilles de soins ;
• les prescriptions ;
• les justificatifs utiles à une éventuelle demande de remboursement ou de prise en charge.

La Plateforme permet le partage de documents entre le Professionnel et l'Athlète via l'espace dédié, sous réserve des réglages de confidentialité de l'Athlète.

Tuatha ne garantit ni l'automaticité ni l'acceptation d'une prise en charge par l'Assurance Maladie, une mutuelle ou un organisme tiers.

Les factures sont conservées conformément aux obligations comptables (10 ans — Code de commerce Art. L.123-22, Code général des impôts Art. L.102 B).`,
  },
  {
    id: "obligations-fiscales",
    title: "15. Obligations fiscales, sociales et comptables",
    content: `Le Professionnel demeure seul responsable :
• de ses déclarations fiscales, sociales et comptables ;
• du paiement de ses impôts, taxes, cotisations et contributions ;
• de la qualification juridique et fiscale de son activité ;
• de l'établissement de ses propres documents comptables et justificatifs obligatoires ;
• de toute obligation liée à la TVA lorsque celle-ci lui est applicable.

Tuatha n'assume aucune responsabilité à ce titre.`,
  },
  {
    id: "propriete-intellectuelle",
    title: "16. Propriété intellectuelle",
    content: `Le Professionnel conserve les droits qu'il détient sur les contenus qu'il publie sur la Plateforme.

Il concède toutefois à Tuatha, pour les besoins de l'exploitation du service, une licence non exclusive, mondiale, gratuite, transférable aux sous-traitants techniques concernés, permettant notamment l'hébergement, la reproduction, la mise en forme, l'affichage, l'indexation, l'adaptation technique et la communication des contenus strictement nécessaires à la fourniture de la Plateforme.

Le Professionnel garantit qu'il dispose des droits nécessaires sur les contenus qu'il publie, y compris les vidéos d'exercices, documents, photos et contenus de plans de soins ou programmes.

La Plateforme, sa structure, ses outils, sa marque, ses interfaces, ses logiciels et ses contenus propres demeurent la propriété exclusive de Tuatha ou de ses titulaires de droits.`,
  },
  {
    id: "confidentialite",
    title: "17. Confidentialité et protection des données",
    content: `Le Professionnel s'engage à respecter la confidentialité des informations auxquelles il accède via la Plateforme et à n'utiliser les données des Athlètes que dans le cadre autorisé par la loi, les présentes CGU Pro, les CGU globales, la Politique de Confidentialité, la Charte de Partage des Données et la relation nouée avec l'Athlète.

**Réglages de confidentialité des Athlètes**

L'Athlète dispose d'un système de contrôle granulaire lui permettant de définir, pour chaque Professionnel connecté, les données auxquelles celui-ci a accès (données générales, données médicales, antécédents, traitements, contre-indications, constantes vitales, etc.).

Le Professionnel s'engage à respecter ces réglages et à ne pas tenter de contourner les restrictions d'accès.

**Interdictions**

Le Professionnel s'interdit notamment :
• tout usage détourné, excessif ou non autorisé des données ;
• toute extraction massive non autorisée ;
• toute communication de données à un tiers non autorisé ;
• toute conservation injustifiée de données au-delà de ce qui est nécessaire à la relation professionnelle.

Le Professionnel demeure responsable des traitements qu'il met en œuvre pour son propre compte dans le cadre de son activité, conformément au RGPD et aux réglementations applicables en matière de données de santé.`,
  },
  {
    id: "interdictions",
    title: "18. Interdictions spécifiques",
    content: `Il est notamment interdit au Professionnel de :
• fournir des informations fausses ou trompeuses ;
• usurper une qualité, un titre, un numéro RPPS ou une autorisation ;
• contourner la Plateforme de manière déloyale pour échapper à la Commission lorsque la mise en relation ou la réservation a eu lieu via Tuatha, si une telle pratique est interdite par les conditions commerciales applicables ;
• détourner des Athlètes par des moyens abusifs ;
• utiliser la Plateforme à des fins illicites, frauduleuses ou nuisibles ;
• porter atteinte à la sécurité ou au fonctionnement de la Plateforme ;
• porter atteinte aux droits de propriété intellectuelle de Tuatha ou de tiers ;
• publier des contenus contraires à la loi, à la déontologie applicable, à l'ordre public ou à l'intérêt du service ;
• accéder aux données d'un Athlète en contournant ses réglages de confidentialité ;
• utiliser les outils de messagerie ou de visioconférence à des fins non professionnelles ou abusives.`,
  },
  {
    id: "reseau-interpro",
    title: "19. Réseau interprofessionnel",
    content: `La Plateforme permet aux Professionnels de collaborer au sein d'un réseau interprofessionnel autour d'Athlètes communs.

**19.1. Fonctionnalités**

Le réseau interprofessionnel permet notamment :
• la visualisation des autres Professionnels connectés à un même Athlète ;
• les échanges entre Professionnels dans le cadre du suivi partagé d'un Athlète ;
• le partage d'informations utiles à la prise en charge coordonnée.

**19.2. Obligations**

Le Professionnel s'engage à :
• n'utiliser le réseau interprofessionnel que dans un cadre strictement professionnel ;
• respecter la confidentialité des informations partagées ;
• ne pas utiliser les données d'autres Professionnels à des fins commerciales, de démarchage ou de concurrence déloyale ;
• respecter la déontologie propre à sa profession dans le cadre des échanges interprofessionnels.

**19.3. Limites**

L'accès aux données d'un Athlète via le réseau interprofessionnel reste soumis aux réglages de confidentialité définis par cet Athlète.`,
  },
  {
    id: "suspension",
    title: "20. Suspension, restriction, déréférencement et résiliation",
    content: `**20.1. Mesures pouvant être prises par Tuatha**

Tuatha peut, à tout moment, restreindre, suspendre, déréférencer ou résilier tout ou partie de l'accès du Professionnel à la Plateforme, notamment en cas de :
• non-respect des présentes CGU Pro, des CGU globales ou des CGV Athlète ;
• fraude ou tentative de fraude ;
• justificatifs manquants, inexacts, expirés ou insuffisants ;
• non-respect des obligations légales, réglementaires ou professionnelles ;
• plainte ou signalement sérieux ;
• risque pour les Athlètes, la Plateforme ou des tiers ;
• demande d'une autorité ou d'un Prestataire de paiement ;
• inactivité prolongée ;
• comportement portant atteinte à l'image ou au fonctionnement de Tuatha.

**20.2. Effets**

Les mesures prises peuvent notamment entraîner :
• la suspension du profil ;
• la perte de visibilité ;
• le blocage des réservations ;
• la suspension des paiements ou Reversements ;
• la suppression de certains contenus ;
• la fermeture du Compte ;
• la révocation de toutes les sessions actives.

**20.3. Résiliation par le Professionnel**

Le Professionnel peut demander la fermeture de son Compte sous réserve :
• des transactions en cours ;
• des obligations légales de conservation ;
• des litiges en cours ;
• des sommes restant dues ;
• des vérifications de clôture éventuellement nécessaires.`,
  },
  {
    id: "responsabilite",
    title: "21. Responsabilité",
    content: `**21.1. Responsabilité de Tuatha**

Tuatha est responsable des obligations qui lui incombent au titre de son rôle d'opérateur de plateforme, dans les limites prévues par la loi et par les présentes CGU Pro.

**21.2. Exclusions**

Tuatha n'est pas responsable notamment :
• de l'activité propre du Professionnel ;
• des Prestations réalisées ;
• des dommages causés à un Athlète ou à un tiers dans le cadre de la relation professionnelle ;
• des conséquences fiscales, sociales, comptables ou réglementaires de l'activité du Professionnel ;
• des refus, lenteurs, blocages ou incidents imputables à un Prestataire de paiement, à une banque, à un organisme tiers ou à une autorité ;
• de l'absence de chiffre d'affaires, de réservations ou de visibilité ;
• des dysfonctionnements imputables au réseau internet, à l'hébergeur, au matériel du Professionnel ou à un cas de force majeure ;
• de tout dommage indirect, perte de chance, perte de revenus, perte d'exploitation ou atteinte à l'image, dans les limites permises par la loi.

**21.3. Limitation**

Sauf faute lourde, dol ou disposition d'ordre public contraire, la responsabilité de Tuatha, lorsqu'elle est engagée, est limitée aux montants effectivement perçus par Tuatha du fait de la relation contractuelle avec le Professionnel au cours des douze derniers mois.

Le Professionnel garantit Tuatha contre toute réclamation, action, condamnation, coût ou dommage résultant d'un manquement du Professionnel à ses obligations.`,
  },
  {
    id: "modifications",
    title: "22. Modification des CGU Pro",
    content: `Tuatha se réserve le droit de modifier à tout moment les présentes CGU Pro.

Les modifications prennent effet selon les modalités communiquées au Professionnel. En cas de poursuite d'utilisation de la Plateforme après entrée en vigueur de la nouvelle version, le Professionnel est réputé l'avoir acceptée, sauf lorsque la loi impose une acceptation spécifique.

La version applicable est celle en vigueur au moment concerné.`,
  },
  {
    id: "droit-applicable",
    title: "23. Droit applicable et litiges",
    content: `Les présentes CGU Pro sont régies par le **droit français**.

Les parties s'efforceront de rechercher une solution amiable en cas de litige.

À défaut d'accord amiable, les juridictions compétentes seront déterminées conformément aux règles légales applicables.`,
  },
  {
    id: "contact",
    title: "24. Contact",
    content: `**Opérateur / éditeur de la Plateforme :** Tuatha SAS
**Email de contact :** support@tuatha.app

Pour toute question relative aux présentes CGU Pro, au Compte Professionnel, au référencement, aux paiements, aux Reversements, à une suspension ou à un litige, le Professionnel peut contacter Tuatha à l'adresse ci-dessus ou via les outils proposés sur la Plateforme (page Support & aide).`,
  },
];
