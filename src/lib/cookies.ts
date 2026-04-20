// ─── Politique Cookies / CMP (Consentement Cookies) — Tuatha ───
// Version centralisée. Importée par la page /cookies.

export const COOKIES_VERSION = "1.0";
export const COOKIES_DATE = "02/03/2026";

export const COOKIES_SECTIONS = [
  {
    id: "objet",
    title: "1. Objet",
    content: `Le présent document décrit les traceurs (cookies et technologies similaires) utilisés par la plateforme Tuatha (site et application), les finalités associées, la manière dont vous pouvez accepter, refuser ou paramétrer ces traceurs, et comment retirer votre consentement à tout moment.

En France, le dépôt et la lecture de certains traceurs sont soumis à l'obligation de recueillir un **consentement préalable** (RGPD Art. 6(1)(a), directive ePrivacy, recommandations CNIL), tandis que d'autres traceurs en sont exemptés lorsqu'ils sont strictement nécessaires au fonctionnement du service.

**Contexte santé** : Tuatha traite des données de santé. Nous appliquons une approche **privacy by design** : par défaut, aucun traceur non essentiel n'est déposé. Seuls les cookies strictement nécessaires au fonctionnement et à la sécurité de la Plateforme sont utilisés.`,
  },
  {
    id: "definitions",
    title: "2. Définitions",
    content: `• **Cookie** : petit fichier texte déposé sur votre terminal (ordinateur, mobile, tablette) par le navigateur lors de la consultation d'un site ou d'une application.
• **Traceur** : terme générique englobant les cookies, le stockage local (localStorage, sessionStorage), les identifiants techniques, les pixels et les SDK mobiles.
• **CMP** (Consent Management Platform) : mécanisme permettant de recueillir, gérer et prouver votre consentement concernant les traceurs.
• **Cookie strictement nécessaire** : cookie indispensable au fonctionnement du service, exempt de consentement préalable conformément aux recommandations de la CNIL.`,
  },
  {
    id: "principes",
    title: "3. Principes appliqués",
    content: `**3.1. Consentement libre, spécifique, éclairé et univoque**

Lorsqu'un traceur nécessite un consentement, Tuatha s'assure que :
• Vous êtes informé **avant** tout dépôt ;
• Votre choix est clair et sans ambiguïté ;
• Vous pouvez **refuser aussi simplement qu'accepter** ;
• Le refus ne dégrade pas l'accès au service principal.

**3.2. Retrait du consentement**

Vous pouvez retirer votre consentement **à tout moment**, de manière aussi simple que le fait de l'avoir donné. Le retrait prend effet immédiatement pour les futurs dépôts.

**3.3. Conservation du choix**

Votre choix (acceptation ou refus) est conservé pendant **6 mois** (bonne pratique CNIL), puis le CMP vous sollicite à nouveau. En cas de modification substantielle des finalités ou des traceurs, une nouvelle demande de consentement est présentée avant l'expiration des 6 mois.

**3.4. Privacy by design**

Conformément au RGPD Art. 25 et aux recommandations de la CNIL pour les traitements de données de santé :
• **Aucun traceur non essentiel** n'est déposé par défaut ;
• Aucun traceur marketing ou publicitaire n'est utilisé ;
• Les traceurs sont limités au strict nécessaire pour le fonctionnement et la sécurité.`,
  },
  {
    id: "fonctionnement",
    title: "4. Fonctionnement du CMP",
    content: `**4.1. Bannière de consentement**

Lors de votre première visite ou au premier lancement de l'application, un bandeau de consentement s'affiche avec :
• Une information concise sur les catégories de traceurs utilisés ;
• Un bouton « **Accepter** » pour accepter les traceurs optionnels ;
• Un bouton « **Refuser** » pour refuser les traceurs non essentiels ;
• Un lien « **Paramétrer** » pour accéder au centre de préférences.

Les boutons « Accepter » et « Refuser » sont présentés **au même niveau de visibilité** (pas de dark pattern).

**4.2. Centre de préférences**

Le centre de préférences vous permet :
• D'accepter ou refuser **par catégorie** de traceurs ;
• De consulter le détail de chaque traceur (nom, finalité, durée, émetteur) ;
• De modifier votre choix **à tout moment** via le lien « Gérer mes cookies » accessible en pied de page et dans les paramètres de l'application.

**4.3. Preuve du consentement**

Conformément aux exigences de la CNIL, Tuatha conserve la preuve de votre choix :
• Identifiant technique du consentement ;
• Date et heure du choix ;
• Version du texte CMP présenté ;
• Catégories acceptées / refusées ;
• Méthode de recueil (bannière, centre de préférences).

Ces preuves sont conservées pour la durée nécessaire à la démonstration de la conformité.`,
  },
  {
    id: "traceurs-necessaires",
    title: "5. Traceurs strictement nécessaires (exemptés de consentement)",
    content: `Ces traceurs sont **indispensables** au fonctionnement de la Plateforme. Ils ne peuvent pas être désactivés via le CMP. Leur suppression empêcherait l'utilisation du service.

| Nom | Finalité | Durée | Émetteur | Transfert hors UE |
|---|---|---|---|---|
| tuatha_access (ou __Host-tuatha_access en production) | Authentification — jeton d'accès de session | 15 minutes | Tuatha | Non |
| tuatha_refresh (ou __Secure-tuatha_refresh en production) | Authentification — jeton de rafraîchissement | 30 jours | Tuatha | Non |
| consent_choice | Mémorisation de votre choix cookies (CMP) | 6 mois | Tuatha | Non |

**Détail des protections appliquées à ces cookies :**

• **HttpOnly** : les cookies d'authentification ne sont pas accessibles au JavaScript côté client, empêchant les attaques XSS ;
• **Secure** : en production, les cookies ne sont transmis que via HTTPS (chiffrement en transit) ;
• **SameSite** : protection contre les attaques CSRF — « Lax » pour le cookie d'accès, « Strict » pour le cookie de rafraîchissement ;
• **Préfixes de sécurité** : en production, les cookies utilisent les préfixes \_\_Host- et \_\_Secure- qui empêchent l'injection de cookies via des sous-domaines et garantissent la transmission sécurisée ;
• **Path restreint** : le cookie de rafraîchissement n'est accessible que depuis le chemin /api/auth, limitant son exposition ;
• **Rotation automatique** : les tokens sont renouvelés automatiquement (token families) avec détection de réutilisation — tout token réutilisé entraîne la révocation de toute la famille de tokens ;
• **Empreinte d'appareil** : chaque session est liée à un identifiant d'appareil (device hash) pour détecter les usurpations de session.

**Base légale** : intérêt légitime / nécessité pour la fourniture du service (RGPD Art. 6(1)(b) et (f)).`,
  },
  {
    id: "traceurs-audience",
    title: "6. Mesure d'audience (soumis au consentement)",
    content: `**Statut actuel : non activé.**

Tuatha n'utilise actuellement aucun traceur de mesure d'audience. Si un outil d'analytics est activé à l'avenir, il sera :
• Soumis au **consentement préalable** via le CMP ;
• Configuré dans le respect des recommandations CNIL ;
• Documenté dans cette Politique avec mise à jour de la version.

**Durées de référence CNIL** (si activé ultérieurement) :
• Durée de vie des traceurs d'audience : **13 mois maximum** ;
• Conservation des informations collectées : **25 mois maximum**.`,
  },
  {
    id: "traceurs-personnalisation",
    title: "7. Personnalisation (soumis au consentement)",
    content: `**Statut actuel : non activé.**

Tuatha n'utilise actuellement aucun traceur de personnalisation non essentiel. Les préférences d'interface (thème, sidebar ouverte/fermée) sont gérées côté client sans traceur soumis au consentement.

Si des traceurs de personnalisation sont ajoutés, ils seront soumis au consentement et documentés ici.`,
  },
  {
    id: "traceurs-marketing",
    title: "8. Marketing et réseaux sociaux",
    content: `**Statut : non utilisé — aucun traceur marketing n'est déposé.**

Conformément à l'approche privacy by design et au contexte de traitement de données de santé :
• Aucun pixel de conversion n'est utilisé ;
• Aucun bouton de partage social déposant des traceurs tiers n'est intégré ;
• Aucune publicité ciblée n'est pratiquée ;
• Aucun identifiant publicitaire n'est collecté.

Cette catégorie ne sera pas activée sans une mise à jour de cette Politique et un recueil de consentement explicite.`,
  },
  {
    id: "technologies-similaires",
    title: "9. Technologies similaires",
    content: `En complément des cookies, la Plateforme utilise les technologies suivantes, exclusivement pour le fonctionnement du service :

**9.1. URLs signées (HMAC-SHA256)**
L'accès aux fichiers (documents, images, avatars) ne repose pas sur des cookies mais sur des **URLs temporaires signées** cryptographiquement. Chaque URL contient :
• Un jeton HMAC-SHA256 vérifiant l'intégrité ;
• Un horodatage d'expiration ;
• Un identifiant du sujet (qui a généré l'URL).

Aucun cookie tiers n'est déposé pour l'accès aux fichiers.

**9.2. Stockage local (localStorage)**
Le stockage local du navigateur peut être utilisé pour des préférences d'interface non sensibles (ex. état de la sidebar). Aucune donnée personnelle ni donnée de santé n'est stockée dans le localStorage.

**9.3. Empreinte d'appareil (device hash)**
Un identifiant technique d'appareil est calculé à partir de l'user-agent et de l'adresse IP pour la sécurité des sessions (détection d'usurpation). Il ne constitue pas un traceur au sens de la directive ePrivacy car il ne sert qu'à la sécurité du service.`,
  },
  {
    id: "refus",
    title: "10. Conséquences du refus",
    content: `Si vous refusez les traceurs non essentiels :

• Les **cookies strictement nécessaires** restent actifs (le service ne peut pas fonctionner sans) ;
• Les traceurs des catégories refusées **ne sont pas déposés** et ne sont plus lus ;
• L'accès à la Plateforme et à ses fonctionnalités principales **n'est pas dégradé** ;
• Certaines fonctionnalités optionnelles (analytics, personnalisation avancée) peuvent être limitées.

Tuatha ne conditionne **jamais** l'accès au service à l'acceptation des traceurs non essentiels.`,
  },
  {
    id: "sante",
    title: "11. Traceurs et données de santé",
    content: `La Plateforme traite des données de santé. Les mesures suivantes sont appliquées pour éviter toute fuite indirecte d'informations sensibles via les traceurs :

• **Aucun traceur tiers** n'a accès aux données de santé ;
• Les cookies d'authentification ne contiennent aucune donnée de santé — uniquement un jeton opaque (token) et la spécialité professionnelle ;
• **Aucun traceur marketing** n'est utilisé, empêchant tout profilage par des tiers ;
• Les URLs des pages consultées ne contiennent pas d'informations de santé dans les paramètres d'URL ;
• La protection **ScreenShield** (anti-capture d'écran) est active sur les interfaces contenant des données sensibles ;
• L'accès aux fichiers médicaux passe par des **URLs signées temporaires** (pas de cookies tiers, pas de CDN public) ;
• Le blocage des connexions VPN/proxy/Tor empêche l'accès anonymisé non autorisé aux données de santé.

Ces mesures s'inscrivent dans le cadre du RGPD Art. 9 (données de santé), du RGPD Art. 25 (protection des données dès la conception) et des recommandations de la CNIL pour les projets e-santé.`,
  },
  {
    id: "modifier",
    title: "12. Comment modifier votre choix",
    content: `Vous pouvez à tout moment :

• Cliquer sur le lien « **Gérer mes cookies** » accessible en pied de page de la Plateforme ;
• Accéder au centre de préférences pour modifier les catégories acceptées/refusées ;
• Enregistrer votre nouveau choix.

Le retrait du consentement est **aussi simple** que l'acceptation initiale, conformément aux exigences du RGPD et de la CNIL.

Vous pouvez également supprimer les cookies directement depuis les paramètres de votre navigateur. Dans ce cas, votre choix CMP sera réinitialisé et la bannière vous sera présentée à nouveau lors de votre prochaine visite.`,
  },
  {
    id: "duree-validite",
    title: "13. Durée de validité et renouvellement",
    content: `• Votre choix (acceptation ou refus) est conservé pendant **6 mois** (bonne pratique CNIL) ;
• Après 6 mois, le CMP vous sollicite à nouveau pour confirmer ou modifier votre choix ;
• En cas de modification substantielle des finalités, des traceurs utilisés ou des partenaires, une nouvelle demande de consentement est présentée **avant** l'expiration des 6 mois ;
• La mise à jour de cette Politique entraîne un renouvellement du consentement si les modifications affectent les catégories de traceurs.`,
  },
  {
    id: "annexe",
    title: "14. Annexe — Liste complète des traceurs",
    content: `**Traceurs strictement nécessaires (exemptés de consentement)**

| Nom | Finalité | Type | Durée | HttpOnly | Secure | SameSite | Émetteur |
|---|---|---|---|---|---|---|---|
| tuatha_access / __Host-tuatha_access | Jeton d'accès (authentification) | Cookie de session | 15 min | Oui | Oui (prod) | Lax | Tuatha |
| tuatha_refresh / __Secure-tuatha_refresh | Jeton de rafraîchissement | Cookie persistant | 30 jours | Oui | Oui (prod) | Strict | Tuatha |
| consent_choice | Mémorisation du choix CMP | Cookie persistant | 6 mois | Non | Oui (prod) | Lax | Tuatha |

**Traceurs soumis au consentement**

| Nom | Finalité | Type | Durée | Émetteur | Statut |
|---|---|---|---|---|---|
| — | — | — | — | — | Aucun traceur non essentiel n'est actuellement utilisé |

**Technologies similaires (non-cookies)**

| Technologie | Finalité | Données stockées | Sensibilité |
|---|---|---|---|
| localStorage | Préférences d'interface | État sidebar, thème | Non sensible |
| URL signée (HMAC-SHA256) | Accès temporaire aux fichiers | Aucune donnée stockée côté client | — |
| Device hash | Sécurité de session (anti-usurpation) | Hash IP + user-agent (non réversible) | Technique |

Cette annexe est mise à jour à chaque modification des traceurs utilisés.`,
  },
  {
    id: "contact",
    title: "15. Contact",
    content: `Pour toute question relative aux cookies et traceurs :

**Tuatha SAS** — Paris
Email : contact@tuatha-app.com
Téléphone : +33 6.71.63.83.06

Vous pouvez également consulter :
• Les **Conditions Générales d'Utilisation** (CGU) ;
• La **Politique de Confidentialité** ;
disponibles sur la Plateforme.`,
  },
];
