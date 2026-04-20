// ─── CGV — Conditions Générales de Vente (Athlète) ───
// Version centralisée. Importée par la page /cgv.

import { CANCELLATION_CGV_TEXT } from "@/lib/cancellation";

export const CGV_VERSION = "2.1";
export const CGV_DATE = "23/03/2026";

export const CGV_SECTIONS = [
  {
    id: "preambule",
    title: "Préambule",
    content: `Les présentes Conditions Générales de Vente (les « **CGV** ») ont pour objet de définir les conditions dans lesquelles un Athlète peut réserver et payer une Prestation proposée via la plateforme Tuatha (la « **Plateforme** »), éditée par **Tuatha SAS** (« **Tuatha** »).

Les présentes CGV encadrent notamment :
• la réservation des Prestations ;
• le paiement ;
• les annulations ;
• les remboursements ;
• les justificatifs de transaction ;
• les règles applicables aux éventuelles prises en charge par l'Assurance Maladie ou par une mutuelle.

Les présentes CGV complètent les **Conditions Générales d'Utilisation** (« **CGU** ») de la Plateforme. En cas de contradiction, les présentes CGV prévalent pour les sujets relatifs à la Commande, au paiement, à l'annulation et au remboursement.

L'Athlète reconnaît avoir pris connaissance des présentes CGV avant toute validation de Commande.`,
  },
  {
    id: "definitions",
    title: "1. Définitions",
    content: `Au sens des présentes CGV, les termes suivants ont la signification ci-dessous :

• **Athlète** ou **Client** : personne physique utilisant la Plateforme pour réserver et payer une Prestation.
• **Professionnel** : personne physique ou morale proposant une ou plusieurs Prestations via la Plateforme, appartenant à l'une des catégories autorisées (médecin, kinésithérapeute, diététicien, autre professionnel).
• **Plateforme** : site, application, interface et services numériques opérés par Tuatha.
• **Tuatha** : société éditrice et opératrice de la Plateforme (Tuatha SAS).
• **Prestation** : tout service, consultation, séance, accompagnement, suivi, rendez-vous ou offre proposé par un Professionnel via la Plateforme.
• **Commande** : processus par lequel l'Athlète sélectionne une Prestation, confirme sa réservation et procède au paiement.
• **Prix** : montant total affiché avant validation de la Commande et dû par l'Athlète.
• **Frais de service** : somme éventuellement facturée à l'Athlète au titre de l'utilisation de certains services de la Plateforme.
• **Commission** : rémunération perçue par Tuatha, pouvant être supportée par le Professionnel et/ou intégrée dans la structure économique de la transaction.
• **Prestataire de paiement** : prestataire tiers agréé chargé du traitement des paiements réalisés via la Plateforme.
• **Justificatif de transaction** : document émis ou mis à disposition par Tuatha récapitulant les éléments financiers de la Commande.`,
  },
  {
    id: "champ-application",
    title: "2. Champ d'application",
    content: `Les présentes CGV s'appliquent à toute Commande réalisée par un Athlète via la Plateforme.

Toute Commande implique l'acceptation pleine et entière des présentes CGV, sans réserve.

Les CGV applicables sont celles en vigueur à la date de validation de la Commande.`,
  },
  {
    id: "role",
    title: "3. Rôle de Tuatha et du Professionnel",
    content: `**3.1. Rôle de Tuatha**

Tuatha agit en qualité de plateforme d'intermédiation et d'outil de réservation avec paiement intégré.

À ce titre, Tuatha met à disposition une infrastructure technique permettant notamment :
• de consulter des profils de Professionnels ;
• de réserver certaines Prestations ;
• de payer certaines Prestations via un parcours sécurisé ;
• d'obtenir des éléments liés à la transaction (justificatif de transaction, historique).

**3.2. Rôle du Professionnel**

Sauf mention expresse contraire, la Prestation est réalisée par le Professionnel, sous sa seule responsabilité.

Le Professionnel est seul responsable notamment :
• du contenu de la Prestation ;
• de ses qualifications, autorisations, assurances et obligations professionnelles ;
• de la pertinence de la Prestation au regard de la situation de l'Athlète ;
• des documents professionnels qu'il doit émettre (note d'honoraires, feuille de soins, ordonnance, etc.) ;
• de toute décision, recommandation, acte, suivi ou conseil fourni dans le cadre de la Prestation.

**3.3. Limites du rôle de Tuatha**

Tuatha n'est pas responsable de la qualité, de la pertinence, du résultat ou des conséquences d'une Prestation.

Tuatha ne garantit pas :
• qu'une Prestation sera adaptée à la situation de l'Athlète ;
• qu'un Professionnel sera disponible en permanence ;
• qu'une Prestation donnera lieu à remboursement ou prise en charge par un organisme tiers.`,
  },
  {
    id: "informations-prestations",
    title: "4. Informations sur les Prestations",
    content: `Avant toute Commande, l'Athlète peut consulter les informations essentielles relatives à la Prestation, telles que disponibles sur la Plateforme, et notamment selon les cas :

• l'identité ou la dénomination du Professionnel ;
• sa catégorie (médecin, kinésithérapeute, diététicien, autre professionnel) ;
• la nature de la Prestation ;
• son format (présentiel, visioconférence) ;
• sa durée indicative ;
• son prix ;
• les éventuelles conditions particulières ;
• les éventuelles informations fournies à titre indicatif sur une possible prise en charge par l'Assurance Maladie.

Il appartient à l'Athlète de vérifier que la Prestation correspond à ses besoins, à sa situation et à ses attentes avant de confirmer la Commande.`,
  },
  {
    id: "prix",
    title: "5. Prix",
    content: `**5.1. Affichage du prix**

Le prix applicable à la Commande est celui affiché sur la Plateforme au moment de la validation de la Commande.

Le récapitulatif de Commande mentionne, avant paiement :
• le prix de la Prestation ;
• les éventuels frais de service ;
• le montant total dû.

Les prix sont affichés en euros (€). Ils s'entendent toutes taxes comprises lorsque la réglementation l'impose.

**5.2. Modification des prix**

Les prix peuvent être modifiés à tout moment par le Professionnel pour les Commandes futures.

Aucune modification de prix ne s'applique à une Commande déjà valablement confirmée.

**5.3. Commission et frais de service**

Le fonctionnement économique de la Plateforme peut reposer sur :
• une **commission** perçue par Tuatha auprès du Professionnel ;
• et/ou des **frais de service** facturés à l'Athlète, clairement affichés avant la validation de la Commande.

Le montant des frais de service, lorsqu'ils sont applicables, est visible dans le récapitulatif de Commande avant le paiement.`,
  },
  {
    id: "commande",
    title: "6. Processus de Commande",
    content: `**6.1. Étapes de la Commande**

La Commande s'effectue selon les étapes suivantes :
1. l'Athlète sélectionne une Prestation et, le cas échéant, un créneau ;
2. un récapitulatif est présenté avant validation ;
3. l'Athlète vérifie les informations, accepte les présentes CGV et reconnaît son obligation de paiement ;
4. l'Athlète procède au paiement via le module sécurisé ;
5. la Commande est confirmée après validation du paiement.

**6.2. Obligation de paiement**

Toute validation finale d'une Commande emporte obligation de paiement.

**6.3. Confirmation de la Commande**

La Commande devient ferme à compter de la confirmation du paiement par le Prestataire de paiement.

Tant que le paiement n'a pas été valablement autorisé et confirmé, aucune réservation définitive n'est acquise.

**6.4. Refus ou suspension de Commande**

Tuatha peut refuser, suspendre ou annuler une Commande en cas notamment de :
• suspicion de fraude ;
• incident de paiement ;
• indisponibilité technique ;
• erreur manifeste ;
• compte suspendu ou restreint ;
• impossibilité de finaliser la transaction dans des conditions normales de sécurité.`,
  },
  {
    id: "paiement",
    title: "7. Paiement",
    content: `**7.1. Paiement en ligne sécurisé via un Prestataire de Services de Paiement (PSP)**

Le paiement s'effectue exclusivement **en ligne**, via les moyens de paiement proposés sur la Plateforme au moment de la Commande. Les transactions sont traitées par un **Prestataire de Services de Paiement (PSP)** tiers, agréé et régulé conformément à la réglementation applicable.

À la date de la présente version, le paiement par carte bancaire peut être proposé. Tuatha se réserve la possibilité d'ajouter, retirer ou modifier les moyens de paiement disponibles.

**Tuatha n'encaisse pas directement les fonds.** Les sommes versées par l'Athlète transitent par le PSP, qui assure la collecte, la sécurisation et, le cas échéant, le reversement au Professionnel selon les modalités contractuelles applicables.

**7.2. Sécurisation du paiement**

Tuatha ne stocke pas les numéros complets de carte bancaire ni le cryptogramme visuel de l'Athlète.

Les paiements peuvent faire l'objet de mesures de sécurité appropriées, notamment :
• chiffrement des échanges (TLS) ;
• authentification forte (3D Secure / SCA) ;
• tokenisation ;
• contrôles anti-fraude.

**7.3. Incident de paiement**

En cas de refus, d'échec, d'annulation, d'opposition ou de contestation du paiement, la Commande peut être refusée, suspendue, annulée ou non confirmée.

**7.4. Justificatif de transaction**

Après confirmation du paiement, un justificatif de transaction peut être mis à disposition de l'Athlète via la Plateforme ou transmis par email.

Ce justificatif récapitule l'opération financière réalisée. **Il ne constitue pas une feuille de soins, une note d'honoraires, ni un document ouvrant droit à remboursement** par l'Assurance Maladie, une mutuelle ou tout autre organisme. Les documents professionnels nécessaires à une éventuelle prise en charge relèvent de la responsabilité du Professionnel (cf. article 10).`,
  },
  {
    id: "retractation",
    title: "8. Droit de rétractation",
    content: `**8.1. Principe**

Lorsqu'elle est applicable, la réglementation sur le droit de rétractation bénéficie au consommateur dans les conditions prévues par les articles L.221-18 et suivants du Code de la consommation.

Le délai de rétractation est de 14 jours à compter de la conclusion du contrat, sauf exception légale.

**8.2. Demande d'exécution avant la fin du délai**

Lorsque l'Athlète demande expressément que la Prestation commence avant l'expiration du délai légal de rétractation, il reconnaît que son droit de rétractation peut être exclu ou limité dans les conditions prévues par la loi (article L.221-28 du Code de la consommation).

**8.3. Prestation pleinement exécutée**

En cas de Prestation pleinement exécutée avant la fin du délai légal de rétractation après demande expresse de l'Athlète, celui-ci reconnaît qu'il perd son droit de rétractation conformément à l'article L.221-28 du Code de la consommation.

**8.4. Exercice du droit de rétractation**

Lorsque le droit de rétractation s'applique, l'Athlète peut l'exercer en contactant Tuatha à l'adresse support@tuatha.app ou via les outils de la Plateforme, en indiquant clairement sa volonté de se rétracter.`,
  },
  {
    id: "annulation-remboursement",
    title: "9. Annulation et remboursement",
    content: CANCELLATION_CGV_TEXT,
  },
  {
    id: "assurance-maladie",
    title: "10. Prise en charge Assurance Maladie / mutuelle",
    content: `**10.1. Tuatha n'est pas un organisme payeur**

Tuatha n'est **ni un organisme de Sécurité sociale, ni une mutuelle, ni une complémentaire santé, ni un organisme d'assurance**. Tuatha est un opérateur de plateforme qui met à disposition un service de réservation avec paiement intégré via un Prestataire de Services de Paiement (PSP) tiers agréé.

Le paiement d'une Prestation via la Plateforme **ne constitue en aucun cas une prise en charge** par l'Assurance Maladie ou par tout organisme tiers.

**10.2. Aucun remboursement automatique n'est garanti**

Le fait de payer une Prestation via la Plateforme **n'ouvre aucun droit automatique à remboursement**, que ce soit par l'Assurance Maladie (régime obligatoire), par une mutuelle, par une complémentaire santé ou par tout autre organisme de prise en charge.

Aucun mécanisme de remboursement automatique n'est intégré à la Plateforme.

**10.3. La prise en charge dépend de facteurs externes à Tuatha**

L'éventuelle prise en charge d'une Prestation dépend de facteurs que Tuatha ne contrôle pas, notamment :
• le **type de Professionnel** consulté et son statut réglementaire ;
• la **situation personnelle de l'Athlète** (régime d'affiliation, parcours de soins, prescription préalable, etc.) ;
• les **conditions de la complémentaire santé** ou de la mutuelle de l'Athlète ;
• la **nature de la Prestation** (acte conventionné ou non, format présentiel ou à distance, etc.) ;
• les **règles en vigueur** des organismes payeurs concernés.

La Plateforme distingue quatre catégories de Professionnels :
• **Médecin** et **Kinésithérapeute** : professionnels de santé inscrits au RPPS. Prestations *susceptibles* d'être remboursées par l'Assurance Maladie selon les conditions en vigueur.
• **Diététicien** : professionnel de santé inscrit au RPPS. Prestations remboursables *sous certaines conditions*.
• **Autre professionnel (non remboursable)** : coach, nutritionniste, préparateur physique, etc. **Prestations non remboursées par l'Assurance Maladie.**

L'Athlète est informé de la catégorie du Professionnel avant toute Commande.

**10.4. Justificatifs fournis, démarche de remboursement externe**

Tuatha peut mettre à disposition de l'Athlète un **justificatif de transaction** récapitulant les éléments financiers de la Commande (date, montant, professionnel, référence).

Ce justificatif a pour objet de documenter la transaction. **Il ne constitue pas un document médical, une feuille de soins, ni un titre de prise en charge.**

Les documents professionnels nécessaires à une éventuelle demande de remboursement (feuille de soins, note d'honoraires, ordonnance, etc.) relèvent de la **responsabilité exclusive du Professionnel**.

**La démarche de demande de remboursement auprès de l'Assurance Maladie, d'une mutuelle ou de tout organisme tiers reste une démarche personnelle de l'Athlète, effectuée en dehors de la Plateforme.** Tuatha n'intervient pas dans cette démarche et n'en garantit pas le résultat.

**10.5. Rôle limité de Tuatha vis-à-vis des circuits de remboursement**

Au stade actuel du service, Tuatha **n'assure pas** notamment :
• le tiers payant ;
• la télétransmission SESAM-Vitale ;
• la télétransmission vers les mutuelles ou complémentaires ;
• le calcul automatique du reste à charge ;
• la vérification de l'éligibilité d'un Athlète à une prise en charge ;
• la garantie d'acceptation d'un dossier par un organisme tiers.

**10.6. Responsabilité de vérification**

Il appartient à l'Athlète de vérifier, **avant** la Commande, si la Prestation peut faire l'objet d'une prise en charge partielle ou totale selon sa situation personnelle, le type de Professionnel concerné, la nature de la Prestation et les règles de l'organisme compétent.`,
  },
  {
    id: "justificatifs",
    title: "11. Justificatifs et documents",
    content: `**11.1. Justificatif de transaction Tuatha**

Tuatha peut mettre à disposition un justificatif de transaction mentionnant notamment :
• la date de la Commande ;
• l'identité ou la dénomination du Professionnel ;
• le détail général de la Prestation ;
• le montant total payé ;
• les éventuels frais de service ;
• la référence de transaction.

Ce document a pour objet de récapituler l'opération financière réalisée via la Plateforme.

**11.2. Documents relevant du Professionnel**

Les documents professionnels, notamment facture, note d'honoraires, reçu professionnel, feuille de soins, ordonnance ou tout document utile à une éventuelle prise en charge, relèvent de la responsabilité du Professionnel, sauf fonctionnalité spécifique expressément prévue sur la Plateforme.

**11.3. Disponibilité**

Les justificatifs de transaction générés par Tuatha sont accessibles dans l'espace personnel de l'Athlète pendant la durée de disponibilité du service, sous réserve des contraintes techniques, légales et d'archivage applicables.

Les factures sont conservées conformément aux obligations comptables (10 ans — Code de commerce Art. L.123-22, Code général des impôts Art. L.102 B).`,
  },
  {
    id: "obligations-athlete",
    title: "12. Obligations de l'Athlète",
    content: `L'Athlète s'engage à :
• fournir des informations exactes, à jour et complètes ;
• vérifier l'adéquation de la Prestation à sa situation ;
• respecter les rendez-vous convenus ;
• payer le prix dû ;
• adopter un comportement respectueux envers le Professionnel et envers Tuatha ;
• ne pas utiliser la Plateforme de manière frauduleuse, abusive ou contraire aux CGU.

L'Athlète demeure seul responsable des informations qu'il communique au Professionnel dans le cadre de la relation nouée avec celui-ci.`,
  },
  {
    id: "reclamations",
    title: "13. Réclamations",
    content: `**13.1. Réclamation relative à la transaction ou à la Plateforme**

Toute réclamation relative au paiement, à l'annulation, au remboursement, à un justificatif de transaction ou au fonctionnement de la Plateforme peut être adressée à Tuatha à l'adresse suivante : **support@tuatha.app**.

**13.2. Réclamation relative à la Prestation**

Toute réclamation relative au contenu, à la qualité, au déroulement ou aux conséquences d'une Prestation doit être adressée en priorité au Professionnel concerné.

Tuatha peut, sans y être tenue, faciliter les échanges entre l'Athlète et le Professionnel.

**13.3. Instruction des réclamations**

Tuatha peut demander toute pièce utile à l'examen d'une réclamation et prendre, si nécessaire, des mesures conservatoires raisonnables, notamment la suspension temporaire d'un versement ou le gel de certaines fonctionnalités.`,
  },
  {
    id: "responsabilite",
    title: "14. Responsabilité",
    content: `**14.1. Responsabilité de Tuatha**

Tuatha est responsable des obligations qui lui incombent au titre de son rôle d'intermédiaire et d'opérateur de plateforme, dans les limites prévues par la loi et par les présentes CGV.

**14.2. Exclusions de responsabilité**

Tuatha n'est pas responsable notamment :
• du contenu, de la qualité, de la pertinence ou du résultat d'une Prestation ;
• des décisions, recommandations, actes ou suivis réalisés par le Professionnel ;
• de l'absence de prise en charge par l'Assurance Maladie, une mutuelle ou tout organisme tiers ;
• des refus, délais, blocages ou incidents imputables au Prestataire de paiement, à la banque de l'Athlète ou à tout tiers ;
• des dommages résultant de la relation entre l'Athlète et le Professionnel ;
• des dysfonctionnements imputables au réseau internet, à l'hébergeur, au matériel de l'Utilisateur ou à un cas de force majeure.

**14.3. Limitation**

Sauf faute lourde, dol ou disposition d'ordre public contraire, la responsabilité de Tuatha, lorsqu'elle est engagée, est limitée au montant effectivement perçu par Tuatha au titre de la transaction concernée.`,
  },
  {
    id: "donnees-personnelles",
    title: "15. Données personnelles",
    content: `Les données personnelles traitées dans le cadre d'une Commande sont soumises à la Politique de Confidentialité de Tuatha et aux dispositions des CGU relatives à la protection des données personnelles (RGPD).

Ces traitements peuvent notamment avoir pour finalités :
• l'exécution de la Commande ;
• la gestion des paiements, annulations, remboursements et réclamations ;
• la prévention de la fraude ;
• la mise à disposition des justificatifs de transaction ;
• le respect des obligations légales.

Le Prestataire de paiement traite les données strictement nécessaires au paiement selon ses propres conditions et politiques.`,
  },
  {
    id: "modifications",
    title: "16. Modification des CGV",
    content: `Tuatha se réserve le droit de modifier à tout moment les présentes CGV.

La version applicable à la Commande est celle en vigueur au jour de la validation de cette Commande.

Les modifications ultérieures ne s'appliquent pas rétroactivement aux Commandes déjà confirmées, sauf disposition légale impérative contraire.`,
  },
  {
    id: "droit-applicable",
    title: "17. Droit applicable et litiges",
    content: `Les présentes CGV sont régies par le **droit français**.

En cas de litige, les parties rechercheront en priorité une solution amiable.

Lorsqu'il y est éligible, l'Athlète consommateur peut recourir gratuitement à un médiateur de la consommation dans les conditions prévues par les articles L.611-1 et suivants du Code de la consommation.

À défaut d'accord amiable, les juridictions compétentes seront déterminées conformément aux règles légales applicables.`,
  },
  {
    id: "contact",
    title: "18. Contact",
    content: `**Opérateur / éditeur de la Plateforme :** Tuatha SAS
**Email de contact :** support@tuatha.app

Pour toute question relative à une Commande, un paiement, une annulation, un remboursement ou un justificatif de transaction, l'Athlète peut contacter Tuatha à l'adresse ci-dessus ou via les outils de contact proposés sur la Plateforme.`,
  },
];
