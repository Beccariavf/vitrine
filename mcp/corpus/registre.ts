/**
 * Déclaration unique des corpus du serveur.
 *
 * Chaque corpus est décrit une seule fois ici : nom, libellé, type, champ de
 * gouvernance, commande de synchronisation, sources de veille, famille du site,
 * règle de statut d'application et textes des descriptions. Les autres fichiers
 * de `mcp/`, `veille/` et `src/` en dérivent leurs listes ; ajouter un corpus est
 * un descripteur `mcp/corpus/*.json` plus une entrée de ce tableau.
 *
 * Ce module ne lit ni le disque ni le réseau : le site l'importe au build comme
 * le serveur. Le champ de gouvernance est la seule table corpus → champs :
 * `etat_corpus`, la description du serveur et la page connecteur en dérivent
 * leur correspondance.
 *
 * Règle d'attribution : un champ est déclaré quand la collection en porte une
 * part identifiable — texte de fond, doctrine ou contentieux —, pas pour une
 * mention incidente. Un texte fondateur reste dans son champ principal (le RGPD
 * en données personnelles, l'AI Act en IA), et l'ordre de la liste n'exprime
 * aucune priorité. La table est curatée à la main, jamais déduite d'un comptage.
 */

export type TypeCorpus = "texte" | "decision" | "doctrine" | "preparation" | "metadonnees";

/** Champ de gouvernance d'un corpus ; plusieurs champs possibles. */
export type ChampGouvernance = "personnelles" | "non_personnelles" | "ia" | "sante";

/** Famille d'affichage du site, celle de `src/lib/familles.ts`. */
export type FamilleSite = "textes" | "autorites" | "ue" | "juridictions" | "autre";

/**
 * Règle de `statutApplication` : un texte suit son statut source, une décision
 * juridictionnelle est rendue, la doctrine et les notices ont leurs propres
 * règles.
 */
export type RegleStatut =
  | "texte"
  | "juridiction"
  | "cnil"
  | "cnil_doctrine"
  | "cepd"
  | "cada"
  | "preparation"
  | "metadonnees"
  | "doctrine_ue";

type DefinitionCorpus = {
  nom: string;
  /** Libellé du connecteur (`src/lib/corpus.ts`). */
  libelle: string;
  /** Nom du manifeste d'un corpus à plusieurs documents ; le libellé par défaut. */
  nomManifeste?: string;
  type: TypeCorpus;
  gouvernance: readonly ChampGouvernance[];
  famille: FamilleSite;
  regleStatut: RegleStatut;
  /** Commande qui reconstruit le corpus ou son instantané. */
  commandeSync: string;
  /** Fragment de la description du serveur, dans l'ordre du tableau. */
  descriptionServeur: string;
  /** Séparateur qui précède ce fragment dans la description du serveur ; « , » par défaut. */
  separateurServeur?: string;
  /** Fragment de la provenance rappelée par les outils, dans le même ordre. */
  descriptionProvenance: string;
  /** Séparateur qui précède ce fragment dans la provenance ; « , » par défaut. */
  separateurProvenance?: string;
  /** Fragment de la description de l'outil `search`, dans l'ordre du tableau. */
  descriptionRecherche: string;
  /** Rang d'affichage du connecteur, textes puis autorités puis juridictions. */
  rangSite: number;
  /** Rang dans l'énumération `veille: false` de la consigne de périmètre ; absent, non énuméré. */
  rangPerimetre?: number;
  /** Libellé de la phrase de refus d'un document absent (`citations.ts`). */
  libellePerimetre?: string;
  /** Ordre d'exécution de `npm run corpus:sync` ; absent, aucun agent de synchronisation. */
  ordreVeille?: number;
  /** Sources de veille qui alimentent le corpus. */
  sources: readonly string[];
  /** Raison de l'absence de source de veille, quand aucune ne le couvre. */
  sansVeille?: string;
  /** Vrai quand `corpus:sync` revérifie le corpus à chaque passe. */
  sousVeille?: true;
  /** Vrai pour un acte de l'Union suivi par la veille `eurlex`. */
  acteUe?: true;
  /** Vrai quand le corpus publie la liste de ses documents écartés. */
  publieEcartes?: true;
  /** Vrai quand le corpus porte des décisions citant des textes. */
  citationsDecisions?: true;
  /** Rang dans `CORPUS_DECISIONS`, l'ordre historique des citations. */
  rangCitations?: number;
  /** Rang de préférence quand un acte adopté vise plusieurs corpus de textes. */
  rangActeVise?: number;
  /** CELEX des actes de base suivis par la veille `eurlex`. */
  actesSuivis?: readonly string[];
  /** Catégories d'une entrée `eurlex` qui désignent ce corpus. */
  categoriesEurlex?: readonly string[];
  /** Identifiants Légifrance dont une entrée `legi` vise ce corpus. */
  documentsLegi?: readonly string[];
};

const DEFINITIONS = [
  {
    nom: "rgpd",
    libelle: "RGPD",
    type: "texte",
    gouvernance: ["personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document rgpd",
    descriptionServeur: "le RGPD (corpus `rgpd`, CELEX 32016R0679)",
    descriptionProvenance: "RGPD `32016R0679`",
    descriptionRecherche: "le RGPD",
    rangSite: 1,
    rangPerimetre: 1,
    libellePerimetre: "RGPD",
    ordreVeille: 11,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 1,
    actesSuivis: ["32016R0679"],
  },
  {
    nom: "aiact",
    libelle: "AI Act",
    nomManifeste: "AI Act et actes d'application",
    type: "texte",
    gouvernance: ["ia"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document aiact",
    descriptionServeur:
      "l'AI Act et ses actes d'application (corpus `aiact`, CELEX 32024R1689, `32025R0454`, " +
      "`32026D2274`, `32026R2487`)",
    descriptionProvenance: "AI Act `32024R1689`",
    descriptionRecherche: "l'AI Act",
    rangSite: 2,
    rangPerimetre: 2,
    libellePerimetre: "AI Act",
    ordreVeille: 12,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 2,
    actesSuivis: ["32024R1689", "32025R0454", "32026D2274", "32026R2487"],
  },
  {
    nom: "eprivacy",
    libelle: "Directive ePrivacy",
    type: "texte",
    gouvernance: ["personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document eprivacy",
    descriptionServeur: "la directive ePrivacy (corpus `eprivacy`, CELEX 32002L0058)",
    descriptionProvenance: "ePrivacy `32002L0058`",
    descriptionRecherche: "la directive ePrivacy",
    rangSite: 3,
    rangPerimetre: 3,
    libellePerimetre: "ePrivacy",
    ordreVeille: 13,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 3,
    actesSuivis: ["32002L0058"],
  },
  {
    nom: "police",
    libelle: "Directive police-justice",
    type: "texte",
    gouvernance: ["personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document police",
    descriptionServeur: "la directive police-justice (corpus `police`, CELEX 32016L0680)",
    descriptionProvenance: "directive police-justice `32016L0680`",
    descriptionRecherche: "la directive police-justice",
    rangSite: 4,
    rangPerimetre: 4,
    libellePerimetre: "directive 2016/680",
    ordreVeille: 14,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 4,
    actesSuivis: ["32016L0680"],
  },
  {
    nom: "eudpr",
    libelle: "Règlement 2018/1725",
    type: "texte",
    gouvernance: ["personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document eudpr",
    descriptionServeur:
      "le règlement 2018/1725 des institutions de l'Union (corpus `eudpr`, CELEX 32018R1725)",
    descriptionProvenance: "règlement 2018/1725 `32018R1725`",
    descriptionRecherche: "le règlement 2018/1725",
    rangSite: 5,
    rangPerimetre: 5,
    libellePerimetre: "règlement 2018/1725",
    ordreVeille: 15,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 5,
    actesSuivis: ["32018R1725"],
  },
  {
    nom: "rgpdproc",
    libelle: "Règlement procédural RGPD",
    type: "texte",
    gouvernance: ["personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document rgpdproc",
    descriptionServeur: "le règlement procédural RGPD (corpus `rgpdproc`, CELEX 32025R2518)",
    descriptionProvenance: "règlement procédural RGPD `32025R2518`",
    descriptionRecherche: "le règlement procédural RGPD",
    rangSite: 6,
    rangPerimetre: 6,
    libellePerimetre: "règlement procédural RGPD",
    ordreVeille: 16,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 6,
    actesSuivis: ["32025R2518"],
  },
  {
    nom: "ccs",
    libelle: "Clauses contractuelles types",
    type: "texte",
    gouvernance: ["personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document ccs",
    descriptionServeur:
      "les clauses contractuelles types pour les transferts hors UE et la sous-traitance (corpus " +
      "`ccs`, CELEX `32021D0914` et `32021D0915`)",
    descriptionProvenance:
      "clauses contractuelles types `32021D0914` (transferts) et `32021D0915` (sous-traitance, art. 28)",
    descriptionRecherche: "les clauses contractuelles types de transfert et de sous-traitance",
    rangSite: 10,
    rangPerimetre: 7,
    libellePerimetre: "clauses contractuelles types",
    ordreVeille: 17,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 7,
    actesSuivis: ["32021D0914", "32021D0915"],
    categoriesEurlex: ["clauses_types"],
  },
  {
    nom: "adequation",
    libelle: "Décisions d'adéquation",
    type: "texte",
    gouvernance: ["personnelles"],
    famille: "ue",
    regleStatut: "texte",
    commandeSync: "npm run adequation:build",
    descriptionServeur: "les décisions d'adéquation, en vigueur et abrogées (corpus `adequation`)",
    separateurServeur: " et ",
    descriptionProvenance: "décisions d'adéquation `adequation`",
    descriptionRecherche: "les décisions d'adéquation",
    rangSite: 14,
    rangPerimetre: 8,
    libellePerimetre: "décisions d'adéquation",
    ordreVeille: 18,
    sources: ["eurlex"],
    acteUe: true,
    actesSuivis: [],
    categoriesEurlex: ["adequation"],
  },
  {
    nom: "donnees",
    libelle: "Textes UE de l'économie des données",
    type: "texte",
    // Le Data Act et la DGA portent sur les données non personnelles et règlent
    // leur articulation avec les données personnelles.
    gouvernance: ["non_personnelles", "personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document donnees",
    descriptionServeur:
      "les textes UE de l'économie des données (corpus `donnees` : Data Act `32023R2854`, DGA " +
      "`32022R0868`, directive Open Data `32019L1024`, ensembles de forte valeur `32023R0138`, libre " +
      "circulation `32018R1807`, recommandation clauses types `32026H2394`, logos DGA `32023R1622`)",
    descriptionProvenance:
      "textes UE de l'économie des données `donnees` (Data Act `32023R2854`, DGA `32022R0868`, " +
      "directive Open Data `32019L1024`, ensembles de forte valeur `32023R0138`…)",
    descriptionRecherche:
      "les textes UE de l'économie des données (Data Act, DGA, directive Open Data, ensembles " +
      "de forte valeur, libre circulation, recommandation clauses types, logos DGA)",
    rangSite: 7,
    rangPerimetre: 9,
    libellePerimetre: "textes UE de l'économie des données",
    ordreVeille: 19,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 8,
    actesSuivis: [
      "32023R2854",
      "32022R0868",
      "32019L1024",
      "32023R0138",
      "32018R1807",
      "32026H2394",
      "32023R1622",
    ],
  },
  {
    nom: "sante_ue",
    libelle: "Espace européen des données de santé",
    type: "texte",
    // L'EHDS organise le partage des données de santé, personnelles par nature.
    gouvernance: ["sante", "personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document sante_ue",
    descriptionServeur:
      "l'espace européen des données de santé (corpus `sante_ue` : règlement (UE) 2025/327 et règlements " +
      "d'exécution `32026R0771`, `32026R2083` et `32026R2098`)",
    descriptionProvenance:
      "espace européen des données de santé `sante_ue` (règlement (UE) 2025/327 et ses règlements d'exécution)",
    descriptionRecherche: "l'espace européen des données de santé (règlement (UE) 2025/327, EHDS)",
    rangSite: 8,
    rangPerimetre: 10,
    libellePerimetre: "espace européen des données de santé (EHDS)",
    ordreVeille: 20,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 9,
    actesSuivis: ["32025R0327", "32026R0771", "32026R2083", "32026R2098"],
    categoriesEurlex: ["acte_execution"],
  },
  {
    nom: "frontieres",
    libelle: "Textes UE de frontière (produits, responsabilité, propriété intellectuelle, plateformes)",
    nomManifeste: "Textes UE de frontière",
    type: "texte",
    // Les textes de produits et de plateformes portent sur des données non
    // personnelles et sur les systèmes d'IA (machines, CRA, DSA).
    gouvernance: ["ia", "non_personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run corpus:build -- --document frontieres",
    descriptionServeur:
      "les textes UE de frontière — surveillance du marché, responsabilité du fait des produits, " +
      "cybersécurité des produits, propriété intellectuelle et plateformes (corpus `frontieres` : " +
      "surveillance du marché `32019R1020`, responsabilité du fait des produits `32024L2853`, CRA " +
      "`32024R2847`, machines `32023R1230`, bases de données `31996L0009`, secret des affaires " +
      "`32016L0943`, droit d'auteur `32019L0790`, DSA `32022R2065`, travail via plateforme " +
      "`32024L2831`, crédit à la consommation `32023L2225`)",
    descriptionProvenance:
      "textes UE de frontière `frontieres` (surveillance du marché, responsabilité du fait des produits, " +
      "CRA, machines, bases de données, secret des affaires, droit d'auteur, DSA, travail via plateforme, " +
      "crédit à la consommation)",
    descriptionRecherche:
      "les textes UE de frontière (surveillance du marché, responsabilité, CRA, machines, bases de " +
      "données, secret des affaires, droit d'auteur, DSA, travail via plateforme, crédit à la consommation)",
    rangSite: 9,
    rangPerimetre: 11,
    libellePerimetre: "textes UE de frontière",
    ordreVeille: 21,
    sources: ["eurlex"],
    acteUe: true,
    rangActeVise: 10,
    actesSuivis: [
      "32019R1020",
      "32024L2853",
      "32024R2847",
      "32023R1230",
      "31996L0009",
      "32016L0943",
      "32019L0790",
      "32022R2065",
      "32024L2831",
      "32023L2225",
    ],
  },
  {
    nom: "lil",
    libelle: "Loi Informatique et Libertés",
    type: "texte",
    gouvernance: ["personnelles"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run lil:sync",
    descriptionServeur: "la loi Informatique et Libertés (corpus `lil`, LEGITEXT000006068624)",
    descriptionProvenance: "LIL `LEGITEXT000006068624`",
    descriptionRecherche: "la LIL",
    rangSite: 11,
    rangPerimetre: 12,
    libellePerimetre: "LIL",
    ordreVeille: 9,
    sources: ["legi"],
    documentsLegi: ["LEGITEXT000006068624"],
  },
  {
    nom: "textes_fr",
    libelle: "Textes français d'application",
    type: "texte",
    // Les codes couvrent l'accès aux documents et la réutilisation (non
    // personnelles), la protection des personnes (personnelles) et la santé.
    gouvernance: ["personnelles", "non_personnelles", "sante"],
    famille: "textes",
    regleStatut: "texte",
    commandeSync: "npm run textes-fr:sync",
    descriptionServeur:
      "les textes français d'application (corpus `textes_fr` : décret 2019-536 LEGITEXT000038567662 en entier, Code pénal " +
      "LEGITEXT000006070719 articles 226-1, 226-8-1, 226-13, 226-16 à 226-24 et chapitre 323 ; CPCE " +
      "LEGITEXT000006070987 articles L32-3, L34-1 et L34-5 ; Code du travail LEGITEXT000006072050 " +
      "L1121-1, L1222-4, L1226-2, L2312-38 et L4624-8 ; Code de la santé publique " +
      "LEGITEXT000006072665 droits de la personne et information des usagers (L1110, L1111), " +
      "recherches impliquant la personne humaine (L1121 à L1126), génétique (L1130 à L1133), " +
      "assurance et droit à l'oubli (L1141), données de santé (L1460, L1461, L1462-1, L1470), " +
      "déclaration obligatoire (L3113-1), pharmacovigilance (L5121-22), télésanté (L6316) et leurs " +
      "parties réglementaires R1110, R1111, R1461, R1470 et R6316 ; Code de la sécurité sociale " +
      "LEGITEXT000006073189 L161-28-1, L161-31 et L315-1 ; Code des assurances " +
      "LEGITEXT000006073984 L113-2 et L133-1 ; CGCT LEGITEXT000006070633 L2223-42 ; Code de la " +
      "sécurité intérieure LEGITEXT000025503132 titre V du livre II " +
      "(vidéoprotection) ; Code monétaire et financier LEGITEXT000006072026 L561-45 ; CRPA " +
      "LEGITEXT000031366350 L311-3-1 ; Code civil LEGITEXT000006070721 article 9)",
    descriptionProvenance:
      "textes français d'application `textes_fr` (accès aux documents administratifs, réutilisation, " +
      "archives, secret statistique et des affaires, bases de données)",
    descriptionRecherche:
      "les textes français d'application (accès aux documents administratifs, réutilisation, " +
      "archives, secret statistique et des affaires, bases de données)",
    rangSite: 12,
    rangPerimetre: 13,
    libellePerimetre: "textes français d'application",
    ordreVeille: 10,
    sources: ["legi"],
    documentsLegi: [
      "LEGITEXT000038567662",
      "LEGITEXT000006070719",
      "LEGITEXT000006070987",
      "LEGITEXT000006072050",
      "LEGITEXT000006072665",
      "LEGITEXT000025503132",
      "LEGITEXT000006072026",
      "LEGITEXT000031366350",
      "LEGITEXT000006070721",
      "LEGITEXT000006074236",
      "LEGITEXT000005634379",
      "LEGITEXT000006069414",
      "LEGITEXT000006068104",
      "LEGITEXT000006068321",
      "LEGITEXT000049565770",
    ],
  },
  {
    nom: "preparation",
    libelle: "Textes en préparation et affaires pendantes",
    type: "preparation",
    // Les propositions et affaires suivies touchent les quatre champs : Digital
    // Omnibus `52025PC0837` (personnelles et non personnelles), Cloud and AI
    // Development Act `52026PC0502` (IA), proposition MDR/IVDR `52025PC1023`
    // (santé, et annexe I de l'AI Act).
    gouvernance: ["personnelles", "non_personnelles", "ia", "sante"],
    famille: "ue",
    regleStatut: "preparation",
    commandeSync: "npm run preparation:sync",
    descriptionServeur:
      "les textes en préparation et les affaires pendantes (corpus `preparation` : propositions de " +
      "modification des actes du corpus et affaires CJUE pendantes)",
    descriptionProvenance: "textes en préparation et affaires pendantes `preparation`",
    descriptionRecherche: "les textes en préparation et les affaires pendantes",
    rangSite: 13,
    rangPerimetre: 14,
    libellePerimetre: "textes en préparation et affaires pendantes",
    ordreVeille: 6,
    sources: ["preparation"],
    publieEcartes: true,
  },
  {
    nom: "cnil",
    libelle: "CNIL",
    type: "decision",
    // Les délibérations comprennent les sanctions et avis sur l'IA et sur la santé.
    gouvernance: ["personnelles", "ia", "sante"],
    famille: "autorites",
    regleStatut: "cnil",
    commandeSync: "npm run cnil:sync",
    descriptionServeur:
      "les délibérations de la CNIL (corpus `cnil`, natures Sanction, Avis et Recommandation/Lignes directrices)",
    descriptionProvenance: "délibérations CNIL `cnil`",
    descriptionRecherche: "les délibérations de la CNIL (sanctions, avis, recommandations et lignes directrices)",
    rangSite: 15,
    rangPerimetre: 15,
    libellePerimetre: "CNIL",
    ordreVeille: 1,
    sources: ["cnil"],
    sousVeille: true,
    citationsDecisions: true,
    rangCitations: 1,
  },
  {
    nom: "cada",
    libelle: "CADA",
    type: "doctrine",
    // La sélection porte sur la réutilisation et l'ouverture des données publiques
    // (non personnelles) et sur la communicabilité des documents (personnelles).
    gouvernance: ["non_personnelles", "personnelles"],
    famille: "autorites",
    regleStatut: "cada",
    commandeSync: "npm run cada:sync",
    descriptionServeur:
      "les avis et conseils de la CADA (corpus `cada` : natures Avis et Conseil ; sélection " +
      "thématique sur la réutilisation, l'ouverture, les algorithmes et le code source des données " +
      "publiques)",
    descriptionProvenance:
      "avis et conseils de la CADA `cada` (sélection thématique : réutilisation, ouverture, algorithmes et code source des données publiques)",
    descriptionRecherche: "les avis et conseils de la CADA",
    rangSite: 17,
    rangPerimetre: 16,
    libellePerimetre: "CADA",
    ordreVeille: 22,
    sources: ["cada"],
  },
  {
    nom: "cnil_doctrine",
    libelle: "Doctrine CNIL",
    type: "doctrine",
    // La doctrine CNIL comprend les fiches IA et les référentiels santé.
    gouvernance: ["personnelles", "ia", "sante"],
    famille: "autorites",
    regleStatut: "cnil_doctrine",
    commandeSync: "npm run cnil-doctrine:sync",
    descriptionServeur:
      "les guides, référentiels, fiches pratiques IA et listes AIPD de la CNIL (corpus `cnil_doctrine`, extraits " +
      "non modifiés sous CC BY-ND 4.0)",
    descriptionProvenance: "doctrine CNIL `cnil_doctrine`",
    descriptionRecherche: "les guides, référentiels, fiches pratiques IA et listes AIPD de la CNIL (corpus `cnil_doctrine`)",
    rangSite: 16,
    rangPerimetre: 17,
    libellePerimetre: "doctrine CNIL",
    ordreVeille: 2,
    sources: ["cnil_doctrine"],
    publieEcartes: true,
  },
  {
    nom: "ce",
    libelle: "Conseil d'État",
    type: "decision",
    // Le fonds contient les décisions sur les algorithmes (Parcoursup, VSA) et la santé ;
    // depuis #143, aussi l'accès aux documents administratifs, le secret des affaires et les archives.
    gouvernance: ["personnelles", "non_personnelles", "ia", "sante"],
    famille: "juridictions",
    regleStatut: "juridiction",
    commandeSync: "npm run ce:sync",
    descriptionServeur:
      "les décisions du Conseil d'État (corpus `ce` : données personnelles, accès et réutilisation des " +
      "documents administratifs, secret des affaires, archives, secret médical)",
    descriptionProvenance: "décisions du Conseil d'État `ce`",
    descriptionRecherche: "les décisions du Conseil d'État",
    rangSite: 20,
    rangPerimetre: 19,
    libellePerimetre: "Conseil d'État",
    ordreVeille: 3,
    sources: ["cetat"],
    sousVeille: true,
    citationsDecisions: true,
    rangCitations: 2,
  },
  {
    nom: "constit",
    libelle: "Conseil constitutionnel",
    type: "decision",
    // Les décisions couvrent la vidéosurveillance algorithmique et le passe sanitaire.
    gouvernance: ["personnelles", "ia", "sante"],
    famille: "juridictions",
    regleStatut: "juridiction",
    commandeSync: "npm run constit:sync",
    descriptionServeur: "les décisions DC et QPC du Conseil constitutionnel (corpus `constit`)",
    descriptionProvenance: "décisions DC et QPC du Conseil constitutionnel `constit`",
    descriptionRecherche: "les décisions DC et QPC du Conseil constitutionnel",
    rangSite: 21,
    rangPerimetre: 20,
    libellePerimetre: "Conseil constitutionnel",
    ordreVeille: 4,
    sources: ["constit"],
    citationsDecisions: true,
    rangCitations: 3,
  },
  {
    nom: "cepd",
    libelle: "CEPD",
    type: "doctrine",
    // Les lignes directrices et avis du CEPD portent aussi sur l'IA et la santé.
    gouvernance: ["personnelles", "ia", "sante"],
    famille: "ue",
    regleStatut: "cepd",
    commandeSync: "npm run cepd:sync",
    descriptionServeur:
      "les documents du CEPD (corpus `cepd` : lignes directrices, avis art. 64, décisions art. 65, recommandations)",
    descriptionProvenance:
      "documents du CEPD `cepd` (lignes directrices, avis art. 64, décisions art. 65, recommandations, G29 repris)",
    descriptionRecherche: "les documents du CEPD",
    rangSite: 18,
    rangPerimetre: 18,
    libellePerimetre: "CEPD",
    ordreVeille: 8,
    sources: ["cepd"],
    publieEcartes: true,
    citationsDecisions: true,
    rangCitations: 6,
  },
  {
    nom: "cc",
    libelle: "Cour de cassation",
    type: "decision",
    // Le fonds contient les décisions sur le secret médical et les données de santé ;
    // depuis #143, aussi le secret des affaires, les bases de données et les documents administratifs.
    gouvernance: ["personnelles", "non_personnelles", "sante"],
    famille: "juridictions",
    regleStatut: "juridiction",
    commandeSync: "npm run cc:sync",
    descriptionServeur:
      "les décisions de la Cour de cassation sur les données personnelles, le secret des affaires, " +
      "les bases de données et les documents administratifs (corpus `cc`)",
    descriptionProvenance: "décisions de la Cour de cassation `cc`",
    descriptionRecherche:
      "les décisions de la Cour de cassation sur les données personnelles, le secret des affaires et les bases de données",
    rangSite: 22,
    rangPerimetre: 21,
    libellePerimetre: "Cour de cassation",
    ordreVeille: 5,
    sources: ["judilibre"],
    sousVeille: true,
    citationsDecisions: true,
    rangCitations: 4,
  },
  {
    nom: "cjue",
    libelle: "CJUE",
    type: "decision",
    // Les arrêts couvrent le scoring (C-634/21), la santé et les données personnelles ;
    // depuis #143, aussi les bases de données, le droit d'auteur, les données ouvertes et le DSA.
    gouvernance: ["personnelles", "non_personnelles", "ia", "sante"],
    famille: "ue",
    regleStatut: "juridiction",
    commandeSync: "npm run cjue:sync",
    descriptionServeur:
      "celles de la CJUE (corpus `cjue` : données personnelles, bases de données, droit d'auteur, " +
      "données ouvertes, services numériques, IA)",
    descriptionProvenance: "décisions de la CJUE `cjue`",
    descriptionRecherche: "celles de la CJUE",
    rangSite: 19,
    rangPerimetre: 22,
    libellePerimetre: "CJUE",
    ordreVeille: 7,
    sources: ["cjeu"],
    sousVeille: true,
    publieEcartes: true,
    citationsDecisions: true,
    rangCitations: 5,
  },
  {
    nom: "metadonnees",
    libelle: "Guichet unique (métadonnées)",
    type: "metadonnees",
    gouvernance: ["personnelles"],
    famille: "autre",
    regleStatut: "metadonnees",
    commandeSync: "npm run metadonnees:sync",
    descriptionServeur:
      "et les métadonnées des décisions définitives du guichet unique (corpus `metadonnees`, sans aucun texte de décision ; source " +
      "CEDH arrêtée, aucune notice CEDH)",
    descriptionProvenance: "et notices du guichet unique `metadonnees`",
    separateurProvenance: " ",
    descriptionRecherche:
      "et les métadonnées des décisions du guichet unique (corpus `metadonnees`, aucun texte de décision ; " +
      "source CEDH arrêtée)",
    rangSite: 23,
    sources: [],
    sansVeille: "instantané du registre art. 60, resynchronisation manuelle `metadonnees:sync`",
  },
  {
    nom: "doctrine_ue",
    libelle: "Doctrine de la Commission",
    type: "doctrine",
    // Le Bureau de l'IA porte la doctrine de l'AI Act ; la FAQ Data Act et le
    // guide des données de véhicules portent sur les données non personnelles.
    gouvernance: ["ia", "non_personnelles"],
    famille: "ue",
    regleStatut: "doctrine_ue",
    commandeSync: "npm run corpus:sync:doctrine-ue",
    descriptionServeur:
      "la doctrine de la Commission sur l'IA et les données (corpus `doctrine_ue` : lignes directrices, " +
      "codes de bonne pratique, modèles et questions-réponses, extraits non modifiés sous CC BY 4.0)",
    descriptionProvenance: "doctrine de la Commission `doctrine_ue`",
    descriptionRecherche:
      "la doctrine de la Commission sur l'IA et les données (lignes directrices, codes de bonne pratique, " +
      "modèles et questions-réponses)",
    rangSite: 23,
    rangPerimetre: 22,
    libellePerimetre: "doctrine de la Commission",
    sources: [],
    sansVeille: "liste explicite de documents, resynchronisation manuelle `corpus:sync:doctrine-ue`",
  },
] as const satisfies readonly DefinitionCorpus[];

/** Nom d'un corpus déclaré, seule forme admise par les consommateurs du registre. */
export type NomCorpus = (typeof DEFINITIONS)[number]["nom"];

/** Corpus qu'une source de veille peut alimenter : tous sauf les notices figées. */
export type CorpusVeille = Exclude<NomCorpus, "metadonnees">;

/** Forme d'une entrée du registre, telle que la lisent les consommateurs. */
export type CorpusDeclare = Omit<DefinitionCorpus, "nom"> & { nom: NomCorpus };

/** Les corpus déclarés, dans l'ordre des descriptions du serveur. */
export const CORPUS: readonly CorpusDeclare[] = DEFINITIONS;

/** Tous les noms, dans l'ordre du registre. */
export const NOMS_CORPUS: readonly NomCorpus[] = DEFINITIONS.map((definition) => definition.nom);

/** Nombre de corpus déclarés : la seule source des comptes en toutes lettres. */
export const NOMBRE_CORPUS = CORPUS.length;

/** Noms dans l'ordre d'affichage du connecteur (`rangSite`). */
export const NOMS_SITE: readonly NomCorpus[] = [...CORPUS]
  .sort((gauche, droite) => gauche.rangSite - droite.rangSite)
  .map((corpus) => corpus.nom);

/** Entrée du registre pour un nom, casse et espaces neutralisés ; `undefined` si inconnu. */
export function corpusDeclare(nom: string): CorpusDeclare | undefined {
  const cherche = nom.trim().toLowerCase();
  return CORPUS.find((corpus) => corpus.nom === cherche);
}

/** Les quatre champs de gouvernance, dans l'ordre de la présentation. */
export const CHAMPS_GOUVERNANCE: readonly ChampGouvernance[] = [
  "personnelles",
  "non_personnelles",
  "ia",
  "sante",
];

/** Libellés des champs : seule source des mots affichés par le serveur et le site. */
export const LIBELLES_GOUVERNANCE: Readonly<Record<ChampGouvernance, string>> = {
  personnelles: "données personnelles",
  non_personnelles: "données non personnelles",
  ia: "IA",
  sante: "santé",
};

/** Corpus qui relèvent d'un champ, dans l'ordre du registre. */
export function corpusDuChamp(champ: ChampGouvernance): NomCorpus[] {
  return CORPUS.filter((corpus) => corpus.gouvernance.includes(champ)).map((corpus) => corpus.nom);
}

/** Table corpus → champs, telle que la rend `etat_corpus`. */
export function champsGouvernance(): Record<ChampGouvernance, NomCorpus[]> {
  return {
    personnelles: corpusDuChamp("personnelles"),
    non_personnelles: corpusDuChamp("non_personnelles"),
    ia: corpusDuChamp("ia"),
    sante: corpusDuChamp("sante"),
  };
}

/** Champs d'un corpus déclaré ; vide pour un corpus inconnu du registre. */
export function gouvernanceDuCorpus(nom: string): ChampGouvernance[] {
  return [...(corpusDeclare(nom)?.gouvernance ?? [])];
}

/** Résumé par champ pour la description du serveur : « données personnelles — `rgpd`, … ». */
export function resumeGouvernance(): string {
  return CHAMPS_GOUVERNANCE.map(
    (champ) =>
      `${LIBELLES_GOUVERNANCE[champ]} — ` +
      `${corpusDuChamp(champ).map((nom) => `\`${nom}\``).join(", ")}`,
  ).join(" ; ");
}

/**
 * Nombre écrit en toutes lettres, de 0 à 99 : « vingt-deux » pour le compte des
 * corpus. Un nombre hors bornes lève plutôt que d'inventer un mot.
 */
export function nombreEnLettres(nombre: number): string {
  if (!Number.isInteger(nombre) || nombre < 0 || nombre > 99) {
    throw new Error(`Nombre hors bornes pour une écriture en lettres : ${nombre}`);
  }
  const unites = [
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
    "dix-huit", "dix-neuf",
  ] as const;
  if (nombre < 20) return unites[nombre]!;
  const dizaines = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "", "quatre-vingt", ""] as const;
  if (nombre < 70) {
    const dizaine = dizaines[Math.floor(nombre / 10)]!;
    const reste = nombre % 10;
    if (reste === 0) return dizaine;
    return reste === 1 ? `${dizaine} et un` : `${dizaine}-${unites[reste]!}`;
  }
  if (nombre < 80) {
    const reste = nombre - 60;
    if (reste === 11) return "soixante et onze";
    return `${dizaines[6]}-${unites[reste]!}`;
  }
  const reste = nombre - 80;
  if (reste === 0) return "quatre-vingts";
  return `${dizaines[8]}-${unites[reste]!}`;
}

/** Description du serveur : fragments du registre, séparés comme aujourd'hui. */
export function descriptionServeur(): string {
  return CORPUS.map(
    (corpus, index) =>
      `${index === 0 ? "" : (corpus.separateurServeur ?? ", ")}${corpus.descriptionServeur}`,
  ).join("");
}

/** Provenance rappelée par les outils : fragments du registre, dans le même ordre. */
export function descriptionProvenance(): string {
  return CORPUS.map(
    (corpus, index) =>
      `${index === 0 ? "" : (corpus.separateurProvenance ?? ", ")}${corpus.descriptionProvenance}`,
  ).join("");
}

/** Description de l'outil `search` : fragments du registre, séparés par des virgules. */
export function descriptionRecherche(): string {
  return CORPUS.map((corpus) => corpus.descriptionRecherche).join(", ");
}

/** Phrase de périmètre d'un document absent : libellés dans l'ordre de refus connu. */
export const PERIMETRE: string = [...CORPUS]
  .filter((corpus) => corpus.rangPerimetre !== undefined)
  .sort((gauche, droite) => gauche.rangPerimetre! - droite.rangPerimetre!)
  .map((corpus) => corpus.libellePerimetre)
  .join(", ");

/** Sources de veille revérifiées à chaque passe, dans l'ordre de `corpus:sync`. */
export const SOURCES_SOUS_VEILLE: readonly CorpusVeille[] = CORPUS.filter(
  (corpus) => corpus.sousVeille === true,
).map((corpus) => corpus.nom as CorpusVeille);

/** Corpus qu'aucune passe ne revérifie à chaque synchronisation (instantanés fixes). */
export const CORPUS_INSTANTANES: readonly NomCorpus[] = CORPUS.filter(
  (corpus) => corpus.sousVeille !== true,
).map((corpus) => corpus.nom);

/** Ordre d'exécution de `corpus:sync`. */
export const ORDRE_SOURCES: readonly CorpusVeille[] = CORPUS.filter(
  (corpus) => corpus.ordreVeille !== undefined,
)
  .sort((gauche, droite) => gauche.ordreVeille! - droite.ordreVeille!)
  .map((corpus) => corpus.nom as CorpusVeille);

/** Corpus de la veille `eurlex` : une panne n'y retient pas la fraîcheur globale. */
export const CORPUS_ACTES: readonly CorpusVeille[] = CORPUS.filter(
  (corpus) => corpus.acteUe === true,
).map((corpus) => corpus.nom as CorpusVeille);

/** Corpus qui publient la liste de leurs documents écartés. */
export const CORPUS_A_ECARTES: readonly CorpusVeille[] = CORPUS.filter(
  (corpus) => corpus.publieEcartes === true,
).map((corpus) => corpus.nom as CorpusVeille);

/** Corpus dont les documents sont des décisions citant des textes, seuls porteurs de citations. */
export const CORPUS_DECISIONS: readonly NomCorpus[] = CORPUS.filter(
  (corpus) => corpus.citationsDecisions === true,
)
  .sort((gauche, droite) => gauche.rangCitations! - droite.rangCitations!)
  .map((corpus) => corpus.nom);

/** Sources de veille déclarées par le registre, triées. */
export const SOURCES_CORPUS: readonly string[] = [
  ...new Set(CORPUS.flatMap((corpus) => corpus.sources)),
].sort();

/** Sources de veille de chaque corpus, triées, tirées du registre. */
export const SOURCES_PAR_CORPUS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  CORPUS.filter((corpus) => corpus.sources.length > 0).map((corpus) => [
    corpus.nom,
    [...corpus.sources].sort(),
  ]),
);

/** Corpus sans source de veille, avec la raison dite au client. */
export const CORPUS_SANS_VEILLE: Readonly<Record<string, string>> = Object.fromEntries(
  CORPUS.filter((corpus) => corpus.sansVeille !== undefined).map((corpus) => [
    corpus.nom,
    corpus.sansVeille!,
  ]),
);

/**
 * Source de veille → corpus, pour les sources qui n'en alimentent qu'un. `legi`
 * et `eurlex` en alimentent plusieurs : leur raccord passe par le document ou la
 * catégorie de l'entrée (`CORPUS_PAR_DOCUMENT`, `CORPUS_ACTES_UE`,
 * `CORPUS_PAR_CATEGORIE`).
 */
export const CORPUS_PAR_SOURCE: Readonly<Record<string, NomCorpus>> = (() => {
  const parSource = new Map<string, Set<NomCorpus>>();
  for (const corpus of CORPUS) {
    for (const source of corpus.sources) {
      const noms = parSource.get(source) ?? new Set<NomCorpus>();
      noms.add(corpus.nom);
      parSource.set(source, noms);
    }
  }
  return Object.fromEntries(
    [...parSource.entries()]
      .filter(([, noms]) => noms.size === 1)
      .map(([source, noms]) => [source, [...noms][0]!]),
  );
})();

/** CELEX d'un acte de base suivi par la veille `eurlex` → corpus. */
export const CORPUS_ACTES_UE: Readonly<Record<string, NomCorpus>> = Object.fromEntries(
  CORPUS.flatMap((corpus) =>
    (corpus.actesSuivis ?? []).map((celex) => [celex, corpus.nom] as const),
  ),
);

/** Catégorie d'une entrée `eurlex` → corpus visé. */
export const CORPUS_PAR_CATEGORIE: Readonly<Record<string, NomCorpus>> = Object.fromEntries(
  CORPUS.flatMap((corpus) =>
    (corpus.categoriesEurlex ?? []).map((categorie) => [categorie, corpus.nom] as const),
  ),
);

/** Identifiant Légifrance d'une entrée `legi` → corpus. */
export const CORPUS_PAR_DOCUMENT: Readonly<Record<string, NomCorpus>> = Object.fromEntries(
  CORPUS.flatMap((corpus) =>
    (corpus.documentsLegi ?? []).map((document) => [document, corpus.nom] as const),
  ),
);

/** Corpus de textes visés par un acte adopté, dans l'ordre de préférence de la préparation. */
export const ORDRE_CORPUS_ACTES: readonly NomCorpus[] = CORPUS.filter(
  (corpus) => corpus.rangActeVise !== undefined,
)
  .sort((gauche, droite) => gauche.rangActeVise! - droite.rangActeVise!)
  .map((corpus) => corpus.nom);
