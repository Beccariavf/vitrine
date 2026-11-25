import { lireUnites } from "./index/build.ts";
import { cheminIndex } from "./index/build.ts";
import { openIndex, rechercheHybride, rechercheLexicale, searchIndex } from "./index/search.ts";
import type { Index, ResultatRecherche } from "./index/search.ts";
import type { Unite } from "./corpus/parse.ts";
import type { Embedder } from "./embed/embedder.ts";
import { CANDIDATS_RERANK } from "./rerank/reranker.ts";
import type { Reranker } from "./rerank/reranker.ts";
import { debutDispositif, numeroIndex } from "./corpus/cnil/meta.ts";
import { estSanction } from "./corpus/cnil/nature.ts";
import {
  absenceDuDocument,
  articlesCouverts,
  citationsDesUnites,
  citationsDuCorpus,
  documentsPresents,
  documentDeclare,
  estCorpusDecision,
  identifiantsDuManifeste,
  marquerPresence,
} from "./corpus/citations.ts";
import type { Citation, CitationRendue } from "./corpus/citations.ts";
import { decisionsCitees } from "./corpus/citations-decisions.ts";
import type { DecisionCitee } from "./corpus/citations-decisions.ts";
import { statutApplication, mentionPreparation } from "./corpus/statut.ts";
import type { StatutApplication } from "./corpus/statut.ts";
import { mentionsDoctrine } from "./corpus/cnil-doctrine/mention.ts";
import type { MentionDoctrine } from "./corpus/cnil-doctrine/mention.ts";
import { CORPUS_METADONNEES, avecMarquageMetadonnees } from "./corpus/metadonnees/mention.ts";
import { SUFFIXE_ARTICLE, normaliserNumero } from "./corpus/articles.ts";
import { niveauConfiance } from "./confidence.ts";
import type { NiveauConfiance } from "./confidence.ts";
import { SOURCES_SOUS_VEILLE, inventaireCorpus, lireManifestes, lireRapport } from "./corpus/sync-rapport.ts";
import type {
  CorpusRapport,
  DocumentRapport,
  IndexRapport,
  SourceRapport,
} from "./corpus/sync-rapport.ts";
import type { ClassementHorsCorpus } from "./corpus/hors-corpus.ts";
import { lireLectures } from "./corpus/lectures.ts";
import { CORPUS_SANS_VEILLE, SOURCES_PAR_CORPUS } from "./corpus/veille.ts";
import { normaliserIdentifiant } from "./corpus/citations.ts";
import type { ArticlesCouverts } from "./corpus/citations.ts";
import {
  lireBlocHistorique,
  lireVersionsHistorique,
  versionApplicable,
} from "./corpus/lil/historique.ts";

/** Où lire les exclusions déclarées : le bloc `couverture` de chaque corpus, rendu par `etat_corpus`. */
export const RENVOI_EXCLUSIONS = "etat_corpus → corpus[].couverture";

/**
 * Un corpus interrogé et sa fraîcheur. Seul un corpus sous veille (`veille: true`)
 * est revérifié par `npm run corpus:sync` : lui seul reçoit `a_jour_au`. Un corpus
 * statique est un instantané daté par `arrete_le`, `null` quand son manifeste ne
 * porte aucune date.
 */
export type CorpusInterroge = {
  corpus: string;
  veille: boolean;
  /** Dernière passe réussie de la veille ; toujours `null` pour un corpus statique. */
  a_jour_au: string | null;
  /** Date d'arrêté portée par le manifeste ; `null` si le manifeste n'en porte pas. */
  arrete_le: string | null;
  /** Présent quand le corpus demandé n'existe pas localement : rien n'y a été interrogé. */
  inconnu?: true;
};

/**
 * Ce qu'une réponse a interrogé et à quelle date : le lecteur juge ainsi si une
 * absence vient du droit ou des limites du corpus.
 */
export type Perimetre = {
  corpus: CorpusInterroge[];
  /** Présent quand l'appel est borné à un document. */
  document?: string;
  /** Renvoi vers les exclusions déclarées, jamais leur copie. */
  exclusions: typeof RENVOI_EXCLUSIONS;
  /** Présent seulement sur une recherche sans résultat fiable. */
  avertissement?: string;
};

/** Corpus dont le manifeste déclare ce document (`document`, `text_id`, `textes[].text_id`) ; `null` sinon. */
function corpusDuDocument(
  manifestes: ReadonlyMap<string, Record<string, unknown>>,
  document: string,
): string | null {
  const cherche = normaliserIdentifiant(document);
  for (const [corpus, manifeste] of manifestes) {
    if (identifiantsDuManifeste(manifeste).some((valeur) => normaliserIdentifiant(valeur) === cherche)) {
      return corpus;
    }
  }
  return null;
}

/** Fraîcheur lisible d'un corpus, pour l'avertissement. */
function fraicheurLisible(entree: CorpusInterroge): string {
  if (entree.inconnu === true) return `${entree.corpus} : corpus inconnu, rien n'a été interrogé`;
  if (entree.veille) {
    if (entree.a_jour_au !== null) return `${entree.corpus} : sous veille, à jour au ${entree.a_jour_au}`;
    const arrete = entree.arrete_le === null ? "" : `, données arrêtées le ${entree.arrete_le}`;
    return `${entree.corpus} : sous veille, aucune synchronisation réussie${arrete}`;
  }
  return entree.arrete_le === null
    ? `${entree.corpus} : instantané fixe non daté, jamais revérifié`
    : `${entree.corpus} : instantané fixe arrêté le ${entree.arrete_le}, jamais revérifié`;
}

/**
 * Périmètre d'une réponse : le corpus demandé, sinon celui dont le manifeste
 * déclare le document, sinon tous les corpus de l'inventaire. La fraîcheur vient
 * du rapport de synchronisation pour les corpus sous veille et du manifeste pour
 * les autres, jamais d'une déduction. `avertir` ajoute la phrase d'une recherche
 * sans résultat fiable.
 */
export function perimetreDe(
  rootDir: string,
  borne: { corpus?: string; document?: string },
  avertir = false,
): Perimetre {
  const manifestes = lireManifestes(rootDir);
  const inventaire = inventaireCorpus(rootDir, manifestes);
  const a_jour_au = lireRapport(rootDir)?.a_jour_au ?? null;
  const document = borne.document?.trim() || undefined;
  const cible =
    borne.corpus?.trim() || (document === undefined ? null : corpusDuDocument(manifestes, document));
  const noms = cible === null ? inventaire.map((entree) => entree.corpus) : [cible];
  const corpus: CorpusInterroge[] = noms.map((nom) => {
    const inventorie = inventaire.find((entree) => entree.corpus === nom);
    const veille = inventorie !== undefined && (SOURCES_SOUS_VEILLE as readonly string[]).includes(nom);
    return {
      corpus: nom,
      veille,
      a_jour_au: veille ? a_jour_au : null,
      arrete_le: inventorie?.arrete_le ?? null,
      ...(inventorie === undefined ? { inconnu: true as const } : {}),
    };
  });
  const perimetre: Perimetre = {
    corpus,
    ...(document === undefined ? {} : { document }),
    exclusions: RENVOI_EXCLUSIONS,
  };
  if (!avertir) return perimetre;
  const liste =
    corpus.length === 0 ? "aucun corpus présent" : corpus.map(fraicheurLisible).join(" ; ");
  const borneDocument = document === undefined ? "" : ` Borne : document ${document}.`;
  return {
    ...perimetre,
    avertissement:
      `Aucun résultat fiable dans le périmètre interrogé (${liste}).${borneDocument} ` +
      "Cela ne prouve pas que la règle n'existe pas : elle peut se trouver hors de ce périmètre, " +
      `dans une exclusion déclarée (${RENVOI_EXCLUSIONS}) ou après la date de chaque corpus.`,
  };
}

/** Une source de veille d'un corpus et sa dernière lecture réussie. */
export type SourceVeille = {
  id: string;
  /** Dernière passe sans erreur de cette source ; `null` quand elle n'est jamais lue ici. */
  derniere_lecture_reussie: string | null;
};

/**
 * Ce qui alimente un corpus. `absente` est présent quand aucune source ne le
 * couvre : le corpus est alors un instantané, et la raison le dit.
 */
export type VeilleCorpus = {
  sources: SourceVeille[];
  absente?: { raison: string };
};

/** Sources et dernière lecture réussie d'un corpus, dérivées du raccord de veille. */
export function veilleDuCorpus(
  corpus: string,
  lectures: ReadonlyMap<string, string>,
): VeilleCorpus {
  const sources = (SOURCES_PAR_CORPUS[corpus] ?? []).map((id) => ({
    id,
    derniere_lecture_reussie: lectures.get(id) ?? null,
  }));
  if (sources.length > 0) return { sources };
  return {
    sources,
    absente: {
      raison: CORPUS_SANS_VEILLE[corpus] ?? "aucune source de veille déclarée pour ce corpus",
    },
  };
}

/** Ce que le serveur dit de la fraîcheur du corpus, sans réseau ni index. */
export type EtatCorpus = {
  /** Dernière passe sans source ni index en panne ; `null` avant la première. */
  a_jour_au: string | null;
  derniere_tentative: string | null;
  /** Borne basse de la dernière fenêtre de veille. */
  depuis: string | null;
  /**
   * Chaque corpus porte le bloc `couverture` de son manifeste — ses exclusions
   * déclarées — et `veille`, les sources qui l'alimentent avec leur dernière
   * lecture réussie, ou la raison de leur absence.
   */
  corpus: (CorpusRapport & {
    couverture: Record<string, unknown> | null;
    veille: VeilleCorpus;
  })[];
  manquants: DocumentRapport[];
  /**
   * Classement des documents cités absents du corpus, daté et recalculé par
   * `npm run corpus:sync`. Il vient du rapport, jamais d'un calcul à la lecture ;
   * `null` quand le rapport est absent ou antérieur au classement.
   */
  hors_corpus: ClassementHorsCorpus | null;
  sources: SourceRapport[];
  index: IndexRapport | null;
  message?: string;
};

/**
 * Lit le rapport de `npm run corpus:sync` et l'inventaire des manifestes. Un
 * rapport absent n'empêche pas de décrire les collections : seule la fraîcheur
 * est alors inconnue.
 */
export function etatCorpus(rootDir: string): EtatCorpus {
  const rapport = lireRapport(rootDir);
  const documents = Array.isArray(rapport?.documents) ? rapport.documents : [];
  const manifestes = lireManifestes(rootDir);
  const lectures = lireLectures(rootDir);
  return {
    a_jour_au: rapport?.a_jour_au ?? null,
    derniere_tentative: rapport?.derniere_tentative ?? null,
    depuis: rapport?.depuis ?? null,
    corpus: inventaireCorpus(rootDir, manifestes).map((entree) => {
      const couverture = manifestes.get(entree.corpus)?.couverture;
      return {
        ...entree,
        couverture:
          typeof couverture === "object" && couverture !== null && !Array.isArray(couverture)
            ? (couverture as Record<string, unknown>)
            : null,
        veille: veilleDuCorpus(entree.corpus, lectures),
      };
    }),
    manquants: documents.filter(
      (document) =>
        typeof document === "object" &&
        document !== null &&
        (document as { statut?: unknown }).statut === "manquant",
    ),
    hors_corpus: rapport?.hors_corpus ?? null,
    sources: Array.isArray(rapport?.sources) ? rapport.sources : [],
    index: rapport?.index ?? null,
    ...(rapport === null
      ? { message: "Aucune synchronisation enregistrée : lancez « npm run corpus:sync »." }
      : {}),
  };
}

/** Un article trouvé : le texte du corpus, jamais une génération. */
export type ArticleTrouve = Unite & {
  trouve: true;
  statut_application: StatutApplication;
  perimetre: Perimetre;
};

/** Un article absent : la réponse le dit, elle ne rend pas de chaîne vide. */
export type ArticleAbsent = {
  trouve: false;
  document: string;
  numero: string;
  message: string;
  perimetre: Perimetre;
};

export type ResultatArticle = ArticleTrouve | ArticleAbsent;

/** Un passage rendu à la recherche : la distance devient une similarité lisible. */
export type Passage = ResultatRecherche & {
  /** Similarité cosinus ; absente en recherche lexicale, où aucun score comparable n'existe. */
  similarite?: number;
  /** Vocabulaire uniforme du serveur ; le statut source reste dans `statut`. */
  statut_application: StatutApplication;
  /**
   * Corpus `preparation` seulement : « Texte non applicable… » ou « Affaire
   * pendante… », à transmettre avec le passage. Jamais un préfixe du texte.
   */
  mention?: string;
  /** Instruments et articles cités par la décision ; absent hors des six corpus de décisions. */
  citations?: CitationRendue[];
  /** Décisions que la décision cite, familles exposées seulement ; absent hors des corpus de décisions. */
  decisions_citees?: DecisionCitee[];
  /**
   * Corpus `cnil_doctrine` seulement : la ligne de licence et le crédit exigés
   * par la CC BY-ND 4.0, à afficher avant l'extrait. Le texte reste mot pour mot.
   */
  marquage?: MentionDoctrine;
  /**
   * Corpus `metadonnees` seulement : l'unité ne porte que des métadonnées, le
   * serveur ne connaît pas le contenu du document cité.
   */
  metadonnees_seulement?: true;
  /** Phrase à afficher telle quelle, avec le lien officiel du passage. */
  avertissement_contenu?: string;
};

export type ResultatRechercheOutil = {
  niveau_confiance: NiveauConfiance;
  passages: Passage[];
  /** Présent seulement en recherche lexicale : aucun modèle n'a servi à la requête. */
  recherche?: "lexicale";
  /** Présent quand une référence exacte est introuvable ou existe dans plusieurs documents. */
  message?: string;
  /** Présent quand le second étage a tourné : la seule latence imputable au rerank. */
  rerank?: { modele: string; duree_ms: number };
  perimetre: Perimetre;
};

/** Ce qu'il faut d'une unité rendue pour lire son statut d'application. */
type PorteurStatut = { corpus: string; statut: string; nature?: string };

/**
 * Ajoute le statut d'application à une unité devenue réponse, sans réécrire le
 * statut source : les deux champs coexistent, la source reste la vérité de la
 * source. Une valeur non reconnue rend `inconnu` (`mcp/corpus/statut.ts`).
 */
function avecStatutApplication<T extends PorteurStatut>(
  porteur: T,
): T & { statut_application: StatutApplication; mention?: string } {
  const statut_application = statutApplication(porteur.corpus, porteur.statut, porteur.nature);
  return {
    ...porteur,
    statut_application,
    ...(porteur.corpus === "preparation"
      ? { mention: mentionPreparation(statut_application) }
      : {}),
  };
}

function passageExact(unite: Unite): Passage {
  return { ...avecStatutApplication(unite), distance: 0, similarite: 1 };
}

/**
 * Recopie les citations du document sur ses passages : une décision garde sa
 * base juridique entière, même quand le passage rendu ne la nomme pas. Hors des
 * six corpus de décisions, le champ reste absent.
 */
function avecCitations(rootDir: string, passages: Passage[]): Passage[] {
  const parCorpus = new Map<string, ReadonlyMap<string, Citation[]>>();
  // La présence est lue une fois par réponse : huit manifestes, jamais par passage.
  let presents: ReadonlySet<string> | undefined;
  let couverts: ArticlesCouverts | undefined;
  return passages.map((passage) => {
    if (!estCorpusDecision(passage.corpus)) return passage;
    presents ??= documentsPresents(rootDir);
    couverts ??= articlesCouverts(rootDir);
    let corpus = parCorpus.get(passage.corpus);
    if (corpus === undefined) {
      corpus = citationsDuCorpus(rootDir, passage.corpus);
      parCorpus.set(passage.corpus, corpus);
    }
    return {
      ...passage,
      citations: marquerPresence(presents, corpus.get(passage.document) ?? [], couverts),
      decisions_citees: decisionsCitees(rootDir, passage.corpus, passage.document),
    };
  });
}

/**
 * Ajoute le marquage de licence aux passages de doctrine. Un passage du corpus
 * `cnil_doctrine` sans marquage au manifeste lève : mieux vaut une réponse en
 * erreur qu'un extrait partagé sans attribution.
 */
export function avecMarquageDoctrine(rootDir: string, passages: Passage[]): Passage[] {
  if (!passages.some((passage) => passage.corpus === "cnil_doctrine")) return passages;
  const mentions = mentionsDoctrine(rootDir);
  return passages.map((passage) => {
    if (passage.corpus !== "cnil_doctrine") return passage;
    const marquage = mentions.get(passage.document);
    if (marquage === undefined) {
      throw new Error(
        `Marquage de licence introuvable pour ${passage.document} : ` +
          "le manifeste de data/corpus/cnil_doctrine ne le porte pas. Lancez « npm run cnil-doctrine:sync ».",
      );
    }
    return { ...passage, marquage };
  });
}

/**
 * Numéro cité par « article N », « art. N », « article L. 34-5 », « article 226-16 »,
 * suffixe latin compris (« 15 bis ») ; `null` sinon.
 */
export function referenceExacte(question: string): string | null {
  const reference = new RegExp(
    `\\b(?:article|art\\.?)\\s*(unique\\b|(?:[LRD]\\.?\\s*)?\\d+(?:-\\d+)*(?:\\s*(?:${SUFFIXE_ARTICLE})\\b)?)`,
    "i",
  ).exec(question);
  return reference === null ? null : (reference[1] ?? "");
}

/**
 * Forme comparable d'une question : minuscules, sans diacritiques, ponctuation
 * remplacée par une espace. « R.G.P.D. » y devient « r g p d ».
 */
function normaliserTexte(question: string): string {
  return question
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Forme sans espaces : rattrape les sigles pointés et les identifiants CELEX. */
function compacter(texteNormalise: string): string {
  return texteNormalise.replace(/\s+/g, "");
}

/**
 * Alias qui nomment chaque corpus, cherchés sur la forme normalisée (jetons)
 * ou compacte. `IA` n'est admis que comme jeton isolé, jamais dans un mot.
 */
const ALIAS_RGPD_TEXTE: readonly RegExp[] = [
  /\breglement general sur la protection des donnees\b/,
  /\breglement general\b/,
  /\breglement ue 2016 679\b/,
  /\b2016 679\b/,
];
const ALIAS_RGPD_COMPACT: readonly RegExp[] = [/rgpd/, /32016r0679/];
const ALIAS_AIA_TEXTE: readonly RegExp[] = [
  /\bai act\b/,
  /\bia act\b/,
  /\bia\b/,
  /\breglement (?:europeen )?sur l intelligence artificielle\b/,
  /\breglement ue 2024 1689\b/,
  /\b2024 1689\b/,
];
const ALIAS_AIA_COMPACT: readonly RegExp[] = [/32024r1689/];
const ALIAS_LIL_TEXTE: readonly RegExp[] = [
  /\blil\b/,
  /\bloi informatique et libertes\b/,
  /\bloi (?:n )?78 17\b/,
];

/**
 * Actes de l'Union qui encadrent le RGPD : leurs alias sur la forme normalisée
 * (jetons) et compacte (CELEX).
 */
const ALIAS_ACTES_UE: ReadonlyArray<{ document: string; texte: readonly RegExp[]; compact: readonly RegExp[] }> = [
  {
    document: "32002L0058",
    texte: [
      /\be ?privacy\b/,
      /\bdirective vie privee et communications electroniques\b/,
      /\bdirective (?:ce )?(?:n )?2002 58\b/,
    ],
    compact: [/32002l0058/],
  },
  {
    document: "32016L0680",
    texte: [/\bdirective police(?: justice)?\b/, /\bdirective (?:ue )?(?:n )?2016 680\b/],
    compact: [/32016l0680/],
  },
  {
    document: "32018R1725",
    texte: [/\beudpr\b/, /\breglement (?:ue )?(?:n )?2018 1725\b/],
    compact: [/32018r1725/],
  },
  {
    document: "32025R2518",
    texte: [
      /\breglement procedural (?:du |de l )?(?:rgpd|r g p d)\b/,
      /\breglement (?:ue )?(?:n )?2025 2518\b/,
      /\brgpdproc\b/,
    ],
    compact: [/32025r2518/],
  },
  {
    document: "32021D0914",
    texte: [
      /\bdecision d execution (?:ue )?(?:n )?2021 914\b/,
      /\b2021 914\b/,
      /\bclauses contractuelles types (?:pour le transfert|de transfert)\b/,
    ],
    compact: [/32021d0914/],
  },
  {
    document: "32021D0915",
    texte: [
      /\bdecision d execution (?:ue )?(?:n )?2021 915\b/,
      /\b2021 915\b/,
      /\bclauses contractuelles types (?:entre (?:le )?responsables? du traitement et (?:les |le )?sous traitants?|de sous traitance)\b/,
    ],
    compact: [/32021d0915/],
  },
  {
    document: "32023R2854",
    texte: [
      /\bdata act\b/,
      /\breglement sur les donnees\b/,
      /\breglement (?:ue )?(?:n )?2023 2854\b/,
    ],
    compact: [/32023r2854/],
  },
  {
    document: "32022R0868",
    texte: [
      /\bdga\b/,
      /\breglement sur la gouvernance (?:europeenne )?des donnees\b/,
      /\breglement (?:ue )?(?:n )?2022 868\b/,
    ],
    compact: [/32022r0868/],
  },
  {
    document: "32019L1024",
    texte: [
      /\bdirective open data\b/,
      /\bdirective sur les donnees ouvertes\b/,
      /\bdirective (?:ue )?(?:n )?2019 1024\b/,
    ],
    compact: [/32019l1024/],
  },
  {
    document: "32023R0138",
    texte: [
      /\bensembles? de (?:donnees de )?(?:forte|haute) valeur\b/,
      /\breglement d execution (?:ue )?(?:n )?2023 138\b/,
    ],
    compact: [/32023r0138/],
  },
  {
    document: "32018R1807",
    texte: [
      /\blibre (?:flux|circulation) des donnees\b/,
      /\breglement (?:ue )?(?:n )?2018 1807\b/,
    ],
    compact: [/32018r1807/],
  },
  {
    document: "32026H2394",
    texte: [
      /\brecommandation (?:ue )?(?:n )?2026 2394\b/,
      /\bclauses types (?:du )?data act\b/,
    ],
    compact: [/32026h2394/],
  },
  {
    document: "32023R1622",
    texte: [
      /\blogos (?:dga|de la dga|du dga)\b/,
      /\breglement d execution (?:ue )?(?:n )?2023 1622\b/,
    ],
    compact: [/32023r1622/],
  },
];

/**
 * Corpus nommé par une formule générique : « les clauses contractuelles types »
 * désigne la collection `ccs` entière, sans choisir entre 2021/914 (transfert)
 * et 2021/915 (sous-traitance). Un corpus demandé ou un document nommé prime.
 */
const ALIAS_CORPUS: ReadonlyArray<{ corpus: string; texte: readonly RegExp[] }> = [
  {
    corpus: "ccs",
    texte: [/\bclauses contractuelles types\b/, /\bclauses types\b/, /\bccs\b/, /\bcct\b/],
  },
];

/** Corpus nommé par la question, quand la formule ne nomme aucun document précis. */
export function corpusNomme(question: string): string | null {
  const texte = normaliserTexte(question);
  for (const alias of ALIAS_CORPUS) {
    if (alias.texte.some((motif) => motif.test(texte))) return alias.corpus;
  }
  return null;
}

/** « règlement procédural RGPD » et `rgpdproc` nomment le règlement 2025/2518, pas le RGPD. */
const NOM_PROCEDURAL_RGPD = /\breglement procedural (?:du |de l )?(?:rgpd|r g p d)\b|\brgpdproc\b/g;
const ALIAS_DECRET_2019_536: readonly RegExp[] = [/\bdecret (?:n )?2019 536\b/];
const ALIAS_CPCE_TEXTE: readonly RegExp[] = [
  /\bcpce\b/,
  /\bcode des postes et (?:des )?communications electroniques\b/,
];
const ALIAS_CODE_PENAL: readonly RegExp[] = [/\bcode penal\b/];
/**
 * Codes français dont le corpus `textes_fr` porte des articles. Leurs alias sont
 * cherchés sur la forme normalisée : diacritiques retirés, ponctuation changée
 * en espaces.
 */
const ALIAS_CODES_FRANCAIS: ReadonlyArray<{ document: string; texte: readonly RegExp[] }> = [
  { document: "LEGITEXT000006072050", texte: [/\bcode du travail\b/, /\bc trav\b/] },
  { document: "LEGITEXT000006072665", texte: [/\bcode de la sante publique\b/, /\bcsp\b/] },
  { document: "LEGITEXT000025503132", texte: [/\bcode de la securite interieure\b/, /\bcsi\b/] },
  { document: "LEGITEXT000006072026", texte: [/\bcode monetaire et financier\b/, /\bcmf\b/] },
  {
    document: "LEGITEXT000031366350",
    texte: [/\bcode des relations entre le public et l administration\b/, /\bcrpa\b/],
  },
  { document: "LEGITEXT000006070721", texte: [/\bcode civil\b/] },
];
/** Fin du titre du décret 2019-536 : la loi 78-17 qu'il applique n'est pas nommée pour elle-même. */
const TITRE_DECRET_2019_536 =
  /\bdecret (?:n )?2019 536(?: du 29 mai 2019)? pris pour l application de la loi (?:n )?78 17(?: du 6 janvier 1978)?(?: relative a l informatique aux fichiers et aux libertes)?/g;

/** Nom lisible d'un corpus connu, pour les messages de refus. */
const NOMS_DOCUMENTS: Record<string, string> = {
  "32016R0679": "RGPD",
  "32024R1689": "AI Act",
  LEGITEXT000006068624: "LIL",
  "32002L0058": "ePrivacy",
  "32016L0680": "directive police-justice",
  "32018R1725": "règlement 2018/1725",
  "32025R2518": "règlement procédural RGPD",
  "32021D0914": "clauses contractuelles types (transfert)",
  "32021D0915": "clauses contractuelles types (sous-traitance)",
  "32023R2854": "Data Act",
  "32022R0868": "DGA",
  "32019L1024": "directive Open Data",
  "32023R0138": "ensembles de forte valeur",
  "32018R1807": "libre circulation des données",
  "32026H2394": "recommandation clauses types Data Act",
  "32023R1622": "logos DGA",
  LEGITEXT000038567662: "décret 2019-536",
  LEGITEXT000006070719: "Code pénal",
  LEGITEXT000006070987: "CPCE",
  LEGITEXT000006072050: "Code du travail",
  LEGITEXT000006072665: "Code de la santé publique",
  LEGITEXT000025503132: "Code de la sécurité intérieure",
  LEGITEXT000006072026: "Code monétaire et financier",
  LEGITEXT000031366350: "CRPA",
  LEGITEXT000006070721: "Code civil",
};

function libelleDocument(document: string): string {
  const nom = NOMS_DOCUMENTS[document];
  return nom === undefined ? document : `${nom} (${document})`;
}

/**
 * Tous les corpus nommés par la question. Zéro, un ou plusieurs : « le RGPD et
 * l'AI Act » en nomme deux, et l'appelant doit alors distinguer « aucun nom » de
 * « plusieurs noms » dans ses messages.
 */
/** Une occurrence d'un alias dans la question normalisée. */
type NomTrouve = { document: string; debut: number; fin: number };

/** Toutes les occurrences des alias d'un document, positions comprises. */
function occurrences(texte: string, document: string, alias: readonly RegExp[]): NomTrouve[] {
  const trouves: NomTrouve[] = [];
  for (const motif of alias) {
    const global = new RegExp(motif.source, motif.flags.includes("g") ? motif.flags : `${motif.flags}g`);
    for (const trouve of texte.matchAll(global)) {
      if (trouve.index === undefined || trouve[0] === "") continue;
      trouves.push({ document, debut: trouve.index, fin: trouve.index + trouve[0].length });
    }
  }
  return trouves;
}

export function documentsNommes(question: string): string[] {
  const texteBrut = normaliserTexte(question);
  // Le titre complet du décret nomme la loi 78-17 : il ne nomme que le décret.
  const texte = texteBrut.replace(TITRE_DECRET_2019_536, "decret 2019 536");
  const compact = compacter(texte);
  const texteRgpd = texte.replace(NOM_PROCEDURAL_RGPD, " ");
  const compactRgpd = compacter(texteRgpd);
  const trouves = [
    ...occurrences(texte, "32016R0679", ALIAS_RGPD_TEXTE),
    ...occurrences(texte, "32024R1689", ALIAS_AIA_TEXTE),
    ...occurrences(texte, "LEGITEXT000006068624", ALIAS_LIL_TEXTE),
    ...ALIAS_ACTES_UE.flatMap((acte) => occurrences(texte, acte.document, acte.texte)),
    ...occurrences(texte, "LEGITEXT000038567662", ALIAS_DECRET_2019_536),
    ...occurrences(texte, "LEGITEXT000006070987", ALIAS_CPCE_TEXTE),
    ...occurrences(texte, "LEGITEXT000006070719", ALIAS_CODE_PENAL),
    ...ALIAS_CODES_FRANCAIS.flatMap((code) => occurrences(texte, code.document, code.texte)),
  ];
  // Un alias contenu dans un alias plus long d'un autre document cède le pas :
  // « logos DGA » nomme 2023/1622, pas la DGA ; « clauses types Data Act » la
  // recommandation, pas le Data Act.
  const retenus = trouves.filter(
    (trouve) =>
      !trouves.some(
        (autre) =>
          autre.document !== trouve.document &&
          autre.debut <= trouve.debut &&
          trouve.fin <= autre.fin &&
          autre.fin - autre.debut > trouve.fin - trouve.debut,
      ),
  );
  const documents = retenus.sort((gauche, droite) => gauche.debut - droite.debut).map((trouve) => trouve.document);
  // Un CELEX compact n'a pas de position comparable aux mots : il s'ajoute après.
  if (ALIAS_RGPD_COMPACT.some((alias) => alias.test(compactRgpd))) documents.push("32016R0679");
  if (ALIAS_AIA_COMPACT.some((alias) => alias.test(compact))) documents.push("32024R1689");
  for (const acte of ALIAS_ACTES_UE) {
    if (acte.compact.some((alias) => alias.test(compact))) documents.push(acte.document);
  }
  return [...new Set(documents)];
}

/**
 * Document nommé par la question, quand ses alias désignent un seul corpus ;
 * `null` si aucun alias ne s'y trouve ou si deux corpus sont nommés.
 */
export function documentNomme(question: string): string | null {
  const documents = documentsNommes(question);
  return documents.length === 1 ? (documents[0] ?? null) : null;
}

/**
 * Vrai pour un corpus dont les unités ne sont pas des articles : une question
 * qui y cite « article N » cherche par le sens, sans court-circuit exact. Le
 * corpus `metadonnees` ne porte que des notices ; les corpus de décisions sont
 * déjà traités ainsi.
 */
function corpusSansArticle(corpus: string | undefined): boolean {
  return corpus !== undefined && (estCorpusDecision(corpus) || corpus === CORPUS_METADONNEES);
}

/**
 * Cherche les articles portant ce numéro, dans un document, un corpus, ou tout
 * le corpus. Plusieurs documents peuvent porter le même numéro : l'appelant
 * décide s'il rend le premier ou s'il expose l'ambiguïté.
 */
function trouverArticles(
  rootDir: string,
  filtre: { document?: string; corpus?: string },
  numero: string | number,
): Unite[] {
  const cherche = normaliserNumero(numero);
  if (cherche === null) return [];
  return lireUnites(rootDir).filter(
    (unite) =>
      (filtre.document === undefined || unite.document === filtre.document) &&
      (filtre.corpus === undefined || unite.corpus === filtre.corpus) &&
      unite.niveau === "article" &&
      normaliserNumero(unite.numero) === cherche,
  );
}

/** Identifiant de la LIL, seul document à accepter une lecture datée. */
const LIL = "LEGITEXT000006068624";

/** Vrai si `document` désigne la LIL, par identifiant ou par un de ses alias. */
function estDocumentLil(document: string): boolean {
  if (normaliserIdentifiant(document) === LIL) return true;
  const nommes = documentsNommes(document);
  return nommes.length === 1 && nommes[0] === LIL;
}

/**
 * Date `AAAA-MM-JJ` réellement existante : `Date.parse` normalise le 30 février,
 * l'aller-retour ISO refuse une date décalée en silence.
 */
function dateValide(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const instant = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(instant) && new Date(instant).toISOString().slice(0, 10) === date;
}

/**
 * Lit un article exact dans le corpus de `document`. Un nom d'instrument
 * (`Data Act`, `RGPD`, `code pénal`…) est résolu par `documentNomme` ; un
 * identifiant reste tel quel. Avec `date`, réservée à la LIL, rend la version
 * applicable à cette date depuis `versions.jsonl` (hors ligne) ; sans date, le
 * comportement est celui du corpus en vigueur. Un alias de la LIL est résolu sur
 * les deux chemins.
 */
export function getArticle(
  rootDir: string,
  demande: { document: string; numero: string | number; date?: string },
): ResultatArticle {
  const nomme = documentNomme(demande.document) ?? demande.document;
  const lil = estDocumentLil(nomme);
  const document = lil ? LIL : nomme;
  if (demande.date === undefined) {
    return articleEnVigueur(rootDir, { document, numero: demande.numero });
  }
  const perimetre = perimetreDe(rootDir, { document });
  const absent = (message: string): ArticleAbsent => ({
    trouve: false,
    document: demande.document,
    numero: String(demande.numero),
    message,
    perimetre,
  });
  const date = demande.date;
  if (!dateValide(date)) {
    return absent(`Date attendue AAAA-MM-JJ ; reçu « ${date} ».`);
  }
  if (!lil) {
    return absent(
      `Le paramètre date n'est accepté que pour la LIL (${LIL}) ; ` +
        `document reçu : ${demande.document}.`,
    );
  }
  const historique = lireBlocHistorique(rootDir);
  if (historique === null) {
    return absent(
      "Historique non collecté pour la LIL : lancez « npm run lil:historique ».",
    );
  }
  if (date < historique.depuis) {
    return absent(
      `Article ${demande.numero} : historique non couvert avant ${historique.depuis} ` +
        `(date demandée ${date}).`,
    );
  }
  const version = versionApplicable(lireVersionsHistorique(rootDir), demande.numero, date);
  if (version === null) {
    return absent(`Article ${demande.numero} inexistant à la date ${date}.`);
  }
  const article: Unite = {
    ref: version.identifiant,
    document: LIL,
    corpus: "lil",
    niveau: "article",
    numero: version.numero,
    chemin: "LIL",
    texte: version.texte,
    date_acte: version.date_debut,
    date_debut: version.date_debut,
    date_fin: version.date_fin,
    statut: "HISTORIQUE",
    url: version.url,
  };
  return { ...avecStatutApplication(article), trouve: true, perimetre };
}

/** Chemin sans date : l'article du corpus en vigueur, strictement comme avant. */
function articleEnVigueur(
  rootDir: string,
  demande: { document: string; numero: string | number },
): ResultatArticle {
  const perimetre = perimetreDe(rootDir, { document: demande.document });
  const article = trouverArticles(rootDir, { document: demande.document }, demande.numero)[0];
  if (article !== undefined) {
    return { ...avecStatutApplication(article), trouve: true, perimetre };
  }
  // Un instrument connu mais absent du corpus est dit absent, jamais « introuvable » ;
  // un texte couvert en partie dit ce qu'il couvre ; un identifiant inconnu garde
  // le message d'un article manquant.
  const couverts = articlesCouverts(rootDir).get(normaliserIdentifiant(demande.document));
  const libelle = documentDeclare(demande.document)?.libelle ?? demande.document;
  return {
    trouve: false,
    document: demande.document,
    numero: String(demande.numero),
    message:
      absenceDuDocument(rootDir, demande.document) ??
      (couverts === undefined
        ? `Article ${demande.numero} introuvable dans le document ${demande.document}.`
        : `Article ${demande.numero} hors du corpus : seuls les articles ${couverts.join(", ")} ` +
          `du ${libelle} (${demande.document}) y figurent.`),
    perimetre,
  };
}

/** Voie de recherche du serveur : le mode lexical n'appelle jamais l'embedder. */
export type ModeRecherche = "dense" | "hybride" | "lexicale";

export type SearchDeps = {
  embedder: Embedder;
  /**
   * Index déjà ouvert, ou fournisseur évalué seulement si la question n'est pas
   * une référence exacte ; sinon il est ouvert depuis `data/corpus/index/index.db`.
   */
  index?: Index | (() => Index);
  seuils?: { bas?: number; haut?: number; marge?: number };
  /**
   * Voie de recherche ; `dense` par défaut, `hybride` sur demande mesurée,
   * `lexicale` sans embedder ni vecteur (configuration du serveur, jamais un
   * paramètre de l'outil).
   */
  recherche?: ModeRecherche;
  /**
   * Second étage : il réordonne la fenêtre dense, il ne remplace pas l'index.
   * Absent, la voie dense reste strictement celle d'avant.
   */
  rerank?: Reranker;
};

/**
 * Corpus dont la table de seuils s'applique : celui demandé, sauf si un document
 * borne la recherche à un acte. Un document fixé réduit le bassin, change
 * l'instruction de requête, et suit donc le repli, sans promesse.
 */
export function corpusDeNiveau(demande: { corpus?: string; document?: string }): string | undefined {
  return demande.document === undefined ? demande.corpus : undefined;
}

export type SearchDemande = {
  question: string;
  k?: number;
  /** Restreint la recherche à une collection : `rgpd`, `aiact`, `eprivacy`, `police`, `eudpr`, `rgpdproc`, `ccs`, `adequation`, `donnees`, `cnil`, `cada`, `cnil_doctrine`, `lil`, `textes_fr`, `preparation`, `ce`, `constit`, `cepd`, `cc`, `cjue`, `metadonnees`. */
  corpus?: string;
  /** Restreint la recherche à un document précis. */
  document?: string;
  /** Restreint à une nature : Sanction, Avis ou Recommandation/Lignes directrices (CNIL), DC ou QPC (constit). */
  nature?: string;
  /** Date ISO minimale de la décision. */
  date_min?: string;
  /** Date ISO maximale de la décision. */
  date_max?: string;
  /** Type de sanction CNIL. */
  type_sanction?: string;
  /** Montant minimal de la sanction pécuniaire, en euros. */
  montant_min?: number;
  /** Montant maximal de la sanction pécuniaire, en euros. */
  montant_max?: number;
  /** Numéro de délibération, par exemple `SAN-2026-015`. */
  numero?: string;
};

/** Un fragment d'une décision, dans l'ordre du document. */
export type FragmentDecision = {
  ref: string;
  numero: string;
  chemin: string;
  texte: string;
};

/** Une décision rendue par son identifiant ou son numéro, et la partie demandée. */
export type DecisionTrouvee = {
  document: string;
  numero: string;
  date_acte: string;
  statut: string;
  /** Vocabulaire uniforme du serveur ; le statut source reste dans `statut`. */
  statut_application: StatutApplication;
  url: string;
  /** `dinum` ou `dila` : d'où vient le découpage des fragments. */
  origine?: string;
  /** Nature de la délibération : toujours une sanction ici. */
  nature?: string;
  /** Type de sanction lu dans le dispositif. */
  type_sanction?: string;
  /** Montant de la sanction pécuniaire (amende ou liquidation) ; `null` si absent ou masqué. */
  montant?: number | null;
  /** Vrai si la décision prononce une injonction. */
  injonction?: boolean;
  /** Nombre total de fragments du document, avant sélection. */
  fragments_total: number;
  /** Partie rendue : la partie opératoire, ou le document entier. */
  partie: PartieDecision;
  /** Instruments et articles que le texte de la décision cite ; `[]` si aucun. */
  citations: CitationRendue[];
  /** Décisions que la décision cite, familles exposées seulement ; `[]` si aucune. */
  decisions_citees: DecisionCitee[];
  fragments: FragmentDecision[];
};

/** Partie d'une décision rendue par `get_decision`. */
export type PartieDecision = "dispositif" | "tous";

/** La réponse de `get_decision` : des décisions, ou une absence dite. */
export type ResultatDecision = {
  trouve: boolean;
  decisions: DecisionTrouvee[];
  message?: string;
  perimetre: Perimetre;
};

export type DecisionDemande = {
  /** Identifiant du document, par exemple `CNILTEXT000055022778`. */
  document?: string;
  /** Numéro de délibération, par exemple `SAN-2026-015`. */
  numero?: string;
  /** Restreint à une collection ; absent, tous les corpus répondent. */
  corpus?: string;
  /**
   * `dispositif` (défaut) rend la partie opératoire ; `tous` rend le document
   * entier, qui peut dépasser la charge acceptée par un client MCP.
   */
  partie?: PartieDecision;
};

/** Rang d'un fragment dans son document : le nombre final de la référence. */
function rangDeRef(ref: string): [number, string] {
  const chiffres = /(\d+)$/.exec(ref);
  return [chiffres === null ? Number.POSITIVE_INFINITY : Number(chiffres[1]), ref];
}

/**
 * Index du premier fragment de la partie opératoire.
 *
 * La borne est calculée sur le texte recollé, puis reportée sur les fragments :
 * le premier dont la fin dépasse la borne est le premier rendu. Les fragments
 * restent entiers, aucun texte n'est coupé.
 */
function premierFragmentDuDispositif(fragments: Unite[]): number {
  const borne = debutDispositif(fragments.map((unite) => unite.texte).join("\n"));
  let cumul = 0;
  for (let index = 0; index < fragments.length; index += 1) {
    cumul += (fragments[index]?.texte.length ?? 0) + 1;
    if (cumul > borne) return index;
  }
  return Math.max(0, fragments.length - 1);
}

/**
 * Lit une décision, par identifiant de document ou par numéro, dans un corpus
 * ou dans tous. La partie opératoire est rendue par défaut ; `partie: "tous"`
 * rend le document entier. Plusieurs documents peuvent porter le même numéro :
 * chacun est rendu avec son identifiant. Une absence est dite, jamais comblée.
 */
export function getDecision(rootDir: string, demande: DecisionDemande): ResultatDecision {
  return {
    ...lireDecision(rootDir, demande),
    perimetre: perimetreDe(rootDir, {
      ...(demande.corpus === undefined ? {} : { corpus: demande.corpus }),
      ...(demande.document === undefined ? {} : { document: demande.document }),
    }),
  };
}

function lireDecision(
  rootDir: string,
  demande: DecisionDemande,
): Omit<ResultatDecision, "perimetre"> {
  const document = demande.document?.trim();
  const numero = demande.numero?.trim();
  const corpus = demande.corpus?.trim();
  // Une valeur inconnue retombe sur le défaut : le schéma du serveur la refuse,
  // mais l'appel direct ne doit pas rendre une partie qui n'existe pas.
  const partie: PartieDecision = demande.partie === "tous" ? "tous" : "dispositif";
  const portee = corpus === undefined || corpus === "" ? "" : ` dans le corpus ${corpus}`;

  if ((document === undefined || document === "") && (numero === undefined || numero === "")) {
    return {
      trouve: false,
      decisions: [],
      message:
        "Précisez « document » (identifiant CNILTEXT…) ou « numero » (par exemple SAN-2026-015).",
    };
  }

  const trouvees = lireUnites(rootDir).filter(
    (unite) =>
      (corpus === undefined || corpus === "" || unite.corpus === corpus) &&
      (document === undefined || document === "" || unite.document === document) &&
      (numero === undefined || numero === "" || numeroIndex(unite.numero) === numeroIndex(numero)),
  );

  const quoi =
    document !== undefined && document !== ""
      ? `le document ${document}`
      : `le numéro ${numero ?? ""}`;

  if (trouvees.length === 0) {
    const absence =
      document === undefined || document === "" ? null : absenceDuDocument(rootDir, document);
    return {
      trouve: false,
      decisions: [],
      message: absence ?? `Aucune décision pour ${quoi}${portee}.`,
    };
  }

  // `get_decision` reste réservé aux sanctions : un avis ou une recommandation
  // se lit par `search`, qui porte le filtre `nature`. Une affaire pendante ou
  // une proposition n'est pas une décision : le dire, sans la présenter comme
  // une sanction manquante.
  const preparation = trouvees.find((unite) => unite.corpus === "preparation");
  if (preparation !== undefined && trouvees.every((unite) => unite.corpus === "preparation")) {
    const etat =
      preparation.statut === "PENDANT"
        ? `affaire pendante (${preparation.numero}), aucune décision rendue`
        : `texte en préparation (${preparation.numero}), non applicable`;
    return {
      trouve: false,
      decisions: [],
      message: `${quoi} relève du corpus preparation : ${etat}.`,
    };
  }
  const unites = trouvees.filter((unite) => estSanction(unite.nature));
  if (unites.length === 0) {
    const natures = [
      ...new Set(
        trouvees
          .map((unite) => unite.nature?.trim() ?? "")
          .filter((nature) => nature !== ""),
      ),
    ];
    const comme =
      natures.length === 0
        ? "ce document n'est pas une délibération de sanction"
        : `la délibération existe comme ${natures.join(", ")}`;
    return {
      trouve: false,
      decisions: [],
      message:
        `Aucune sanction pour ${quoi}${portee} : ${comme}. ` +
        "Utilisez « search » avec le filtre « nature » pour la lire.",
    };
  }

  const parDocument = new Map<string, Unite[]>();
  for (const unite of unites) {
    const liste = parDocument.get(unite.document) ?? [];
    liste.push(unite);
    parDocument.set(unite.document, liste);
  }

  const presents = documentsPresents(rootDir);
  const couverts = articlesCouverts(rootDir);
  const decisions: DecisionTrouvee[] = [...parDocument.entries()]
    .sort((gauche, droite) => gauche[0].localeCompare(droite[0]))
    .map(([identifiant, fragments]) => {
      const premiers = [...fragments].sort((gauche, droite) => {
        const [rangGauche, refGauche] = rangDeRef(gauche.ref);
        const [rangDroite, refDroite] = rangDeRef(droite.ref);
        return rangGauche - rangDroite || refGauche.localeCompare(refDroite);
      });
      const premier = premiers[0];
      if (premier === undefined) throw new Error(`Décision vide pour ${identifiant}`);
      const debut = partie === "tous" ? 0 : premierFragmentDuDispositif(premiers);
      const rendus = premiers.slice(debut);
      // Le statut d'application vient de la même composition que les passages et les articles.
      const { statut_application } = avecStatutApplication(premier);
      return {
        document: identifiant,
        numero: premier.numero,
        date_acte: premier.date_acte,
        statut: premier.statut,
        statut_application,
        url: premier.url,
        ...(premier.origine === undefined ? {} : { origine: premier.origine }),
        ...(premier.nature === undefined ? {} : { nature: premier.nature }),
        ...(premier.type_sanction === undefined ? {} : { type_sanction: premier.type_sanction }),
        ...(premier.montant === undefined ? {} : { montant: premier.montant }),
        ...(premier.injonction === undefined ? {} : { injonction: premier.injonction }),
        fragments_total: premiers.length,
        partie,
        citations: marquerPresence(presents, citationsDesUnites(premiers), couverts),
        decisions_citees: decisionsCitees(rootDir, premier.corpus, identifiant),
        fragments: rendus.map((unite) => ({
          ref: unite.ref,
          numero: unite.numero,
          chemin: unite.chemin,
          texte: unite.texte,
        })),
      };
    });

  return { trouve: true, decisions };
}

/**
 * Cherche par le sens, après un court-circuit déterministe : une question qui
 * cite un article rend cet article sans interroger l'index.
 */
export async function search(
  rootDir: string,
  demande: SearchDemande,
  deps: SearchDeps,
): Promise<ResultatRechercheOutil> {
  // Le document nommé par la question vaut document demandé : une question qui
  // cite « l'article 100 du RGPD » ne doit jamais rendre l'article 100 de l'AI Act.
  // Un corpus demandé prime : il borne la recherche, même si la question nomme
  // un autre corpus. La même borne sert à chercher et à dire le périmètre.
  // Une formule générique (« les clauses contractuelles types ») borne au corpus
  // entier quand elle ne nomme aucun document : elle ne choisit pas 2021/914
  // plutôt que 2021/915.
  const corpusImplicite =
    demande.corpus === undefined &&
    demande.document === undefined &&
    documentsNommes(demande.question).length === 0
      ? corpusNomme(demande.question)
      : null;
  const effective: SearchDemande =
    corpusImplicite === null ? demande : { ...demande, corpus: corpusImplicite };
  const document =
    (effective.document === undefined
      ? undefined
      : (documentNomme(effective.document) ?? effective.document)) ??
    (effective.corpus === undefined ? documentNomme(effective.question) : null) ??
    undefined;
  const resultat = await chercher(
    rootDir,
    document === undefined ? effective : { ...effective, document },
    document,
    deps,
  );
  const lexical = deps.recherche === "lexicale";
  return {
    ...resultat,
    ...(lexical ? { recherche: "lexicale" as const } : {}),
    passages: lexical
      ? resultat.passages.map((passage, position) => {
          // Ni distance ni similarité : BM25 n'a pas d'échelle comparable. Le
          // rang lexical porte ce qu'un lecteur peut interpréter.
          const { distance: _distance, similarite: _similarite, ...reste } = passage;
          return { ...reste, rang_lexical: position + 1 };
        })
      : resultat.passages,
    perimetre: perimetreDe(
      rootDir,
      {
        ...(effective.corpus === undefined ? {} : { corpus: effective.corpus }),
        ...(document === undefined ? {} : { document }),
      },
      resultat.niveau_confiance === "aucun_resultat_fiable",
    ),
  };
}

/** Recherche sans périmètre : `search` l'ajoute à chaque sortie. */
type RechercheBrute = Omit<ResultatRechercheOutil, "perimetre">;

async function chercher(
  rootDir: string,
  demande: SearchDemande,
  document: string | undefined,
  deps: SearchDeps,
): Promise<RechercheBrute> {
  const corpus = demande.corpus;
  // La confiance ne peut certifier un corpus que la question ou l'appel nomme.
  const corpusBorne = corpus !== undefined || document !== undefined;
  // Un document connu mais absent du corpus n'a aucun passage à chercher : le
  // refus précède l'embedder et l'index, et garde la phrase des trois outils.
  const absence = document === undefined ? null : absenceDuDocument(rootDir, document);
  if (absence !== null) {
    return { niveau_confiance: "aucun_resultat_fiable", passages: [], message: absence };
  }
  /** Enrichit les passages rendus de leurs citations, du marquage de doctrine et des métadonnées. */
  const rendre = (resultat: RechercheBrute): RechercheBrute => ({
    ...resultat,
    passages: avecMarquageMetadonnees(
      avecMarquageDoctrine(rootDir, avecCitations(rootDir, resultat.passages)),
    ),
  });
  // Un corpus de décisions ne porte aucun article : une question qui y cite
  // « l'article L. 34-5 » cherche des décisions, par le sens.
  const numero = corpusSansArticle(corpus) ? null : referenceExacte(demande.question);
  if (numero !== null) {
    const articles = trouverArticles(
      rootDir,
      {
        ...(document === undefined ? {} : { document }),
        ...(corpus === undefined ? {} : { corpus }),
      },
      numero,
    );
    if (articles.length > 0) {
      const documents = [...new Set(articles.map((article) => article.document))];
      if (documents.length > 1) {
        return rendre({
          niveau_confiance: "incertain",
          passages: articles.map(passageExact),
          message:
            `L'article ${numero} existe dans plusieurs documents ` +
            `(${documents.join(", ")}). Précisez « document » pour n'en rendre qu'un.`,
        });
      }
      const article = articles[0];
      if (article === undefined) {
        return { niveau_confiance: "aucun_resultat_fiable", passages: [] };
      }
      if (!corpusBorne) {
        const nommes = documentsNommes(demande.question);
        const motif =
          nommes.length > 1
            ? `La question nomme plusieurs documents (${nommes.map(libelleDocument).join(", ")}) ` +
              `et l'article ${numero} n'existe que dans ${libelleDocument(article.document)} : ` +
              "nommez le corpus qui le porte, ou précisez « document » pour lever l'ambiguïté."
            : `L'article ${numero} n'existe que dans ${libelleDocument(article.document)}. ` +
              "La question ne nomme aucun document : nommez le corpus ou précisez « document » " +
              "pour lever l'ambiguïté.";
        return rendre({
          niveau_confiance: "incertain",
          passages: [passageExact(article)],
          message: motif,
        });
      }
      return rendre({ niveau_confiance: "confiant", passages: [passageExact(article)] });
    }
    return {
      niveau_confiance: "aucun_resultat_fiable",
      passages: [],
      message:
        document !== undefined
          ? `La question cite l'article ${numero} du document ${libelleDocument(document)}, ` +
            "absent du corpus."
          : corpus !== undefined
            ? `La question cite l'article ${numero}, absent du corpus ${corpus}.`
            : `La question cite l'article ${numero}, absent du corpus.`,
    };
  }

  const index =
    typeof deps.index === "function" ? deps.index() : deps.index ?? openIndex(cheminIndex(rootDir));
  const k = Math.max(1, Math.trunc(demande.k ?? 5));
  const mode = deps.recherche ?? "dense";
  // Le reranker réordonne une fenêtre plus large que `k` : il ne peut pas
  // promouvoir un passage que la recherche n'a pas ramené.
  const fenetre = deps.rerank === undefined ? k : Math.max(k, CANDIDATS_RERANK);
  // L'instruction de requête suit le document, puis le corpus : un corpus CNIL
  // ne doit pas recevoir l'instruction mesurée pour le RGPD.
  const vecteur =
    mode === "lexicale"
      ? null
      : await deps.embedder.embedQuery(demande.question, document ?? corpus);
  const options = {
    k: fenetre,
    ...(corpus === undefined ? {} : { corpus }),
    ...(document === undefined ? {} : { document }),
    ...(demande.nature === undefined ? {} : { nature: demande.nature }),
    ...(demande.date_min === undefined ? {} : { date_min: demande.date_min }),
    ...(demande.date_max === undefined ? {} : { date_max: demande.date_max }),
    ...(demande.type_sanction === undefined ? {} : { type_sanction: demande.type_sanction }),
    ...(demande.montant_min === undefined ? {} : { montant_min: demande.montant_min }),
    ...(demande.montant_max === undefined ? {} : { montant_max: demande.montant_max }),
    ...(demande.numero === undefined ? {} : { numero: demande.numero }),
  };
  let resultats: ResultatRecherche[];
  if (mode === "lexicale") {
    resultats = rechercheLexicale(index, demande.question, options);
  } else {
    if (vecteur === null) throw new Error("Vecteur de requête absent hors mode lexical");
    resultats =
      mode === "hybride"
        ? rechercheHybride(index, vecteur, demande.question, options)
        : searchIndex(index, vecteur, options);
  }

  let ordre = resultats;
  let blocRerank: { modele: string; duree_ms: number } | undefined;
  if (deps.rerank !== undefined) {
    const debut = performance.now();
    const scores = await deps.rerank.score(
      demande.question,
      resultats.map((resultat) => resultat.texte),
    );
    const duree_ms = performance.now() - debut;
    // La distance dense de chaque passage est conservée : le rerank ne change
    // que l'ordre, jamais l'échelle de confiance.
    ordre = resultats
      .map((resultat, position) => {
        const score = scores[position];
        if (score === undefined) {
          throw new Error(
            `Le reranker ${deps.rerank?.model ?? ""} a rendu ${scores.length} scores ` +
              `pour ${resultats.length} passages.`,
          );
        }
        return { resultat, score, position };
      })
      .sort((gauche, droite) => droite.score - gauche.score || gauche.position - droite.position)
      .slice(0, k)
      .map((entree) => entree.resultat);
    blocRerank = { modele: deps.rerank.model, duree_ms };
  }

  const corpusDuNiveau = corpusDeNiveau(demande);
  // Aucun score BM25 n'est confiant : hors appariement exact (traité plus haut),
  // le mode lexical ne prétend rien de plus qu'« incertain ».
  const niveau =
    mode === "lexicale"
      ? ordre.length === 0
        ? "aucun_resultat_fiable"
        : "incertain"
      : niveauConfiance(
          ordre.map((resultat) => {
            if (resultat.distance === undefined) {
              throw new Error(`Distance dense absente pour ${resultat.ref}`);
            }
            return { distance: resultat.distance };
          }),
          false,
          {
            ...deps.seuils,
            ...(corpusDuNiveau === undefined ? {} : { corpus: corpusDuNiveau }),
          },
        );
  return rendre({
    niveau_confiance: niveau,
    passages:
      niveau === "aucun_resultat_fiable"
        ? []
        : ordre.map((resultat) => {
            if (resultat.distance === undefined) return avecStatutApplication(resultat);
            return avecStatutApplication({ ...resultat, similarite: 1 - resultat.distance });
          }),
    ...(blocRerank === undefined ? {} : { rerank: blocRerank }),
  });
}
