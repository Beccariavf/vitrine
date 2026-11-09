import { lireUnites } from "./index/build.ts";
import { cheminIndex } from "./index/build.ts";
import { openIndex, rechercheHybride, searchIndex } from "./index/search.ts";
import type { Index, ResultatRecherche } from "./index/search.ts";
import type { Unite } from "./corpus/parse.ts";
import type { Embedder } from "./embed/embedder.ts";
import { numeroIndex } from "./corpus/cnil/meta.ts";
import { estSanction } from "./corpus/cnil/nature.ts";
import { niveauConfiance } from "./confidence.ts";
import type { NiveauConfiance } from "./confidence.ts";

/** Un article trouvé : le texte du corpus, jamais une génération. */
export type ArticleTrouve = Unite & { trouve: true };

/** Un article absent : la réponse le dit, elle ne rend pas de chaîne vide. */
export type ArticleAbsent = {
  trouve: false;
  document: string;
  numero: string;
  message: string;
};

export type ResultatArticle = ArticleTrouve | ArticleAbsent;

/** Un passage rendu à la recherche : la distance devient une similarité lisible. */
export type Passage = ResultatRecherche & { similarite: number };

export type ResultatRechercheOutil = {
  niveau_confiance: NiveauConfiance;
  passages: Passage[];
  /** Présent quand une référence exacte est introuvable ou existe dans plusieurs documents. */
  message?: string;
};

/** `Article 17`, `art. 17`, `17` : ne garde que le nombre, sans zéro de tête. */
function normaliserNumero(numero: string | number): string | null {
  const chiffres = /\d+/.exec(String(numero));
  return chiffres === null ? null : String(Number(chiffres[0]));
}

function passageExact(unite: Unite): Passage {
  return { ...unite, distance: 0, similarite: 1 };
}

/** Numéro cité par « article N », « art. N » ou « art N » ; `null` sinon. */
export function referenceExacte(question: string): string | null {
  const reference = /\b(?:article|art\.?)\s*(\d+)/i.exec(question);
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

/** Nom lisible d'un corpus connu, pour les messages de refus. */
const NOMS_DOCUMENTS: Record<string, string> = {
  "32016R0679": "RGPD",
  "32024R1689": "AI Act",
};

function libelleDocument(document: string): string {
  const nom = NOMS_DOCUMENTS[document];
  return nom === undefined ? document : `${nom} (${document})`;
}

/**
 * Tous les corpus nommés par la question. Zéro, un ou deux : « le RGPD et l'AI
 * Act » en nomme deux, et l'appelant doit alors distinguer « aucun nom » de
 * « deux noms » dans ses messages.
 */
export function documentsNommes(question: string): string[] {
  const texte = normaliserTexte(question);
  const compact = compacter(texte);
  const documents = new Set<string>();
  if (
    ALIAS_RGPD_TEXTE.some((alias) => alias.test(texte)) ||
    ALIAS_RGPD_COMPACT.some((alias) => alias.test(compact))
  ) {
    documents.add("32016R0679");
  }
  if (
    ALIAS_AIA_TEXTE.some((alias) => alias.test(texte)) ||
    ALIAS_AIA_COMPACT.some((alias) => alias.test(compact))
  ) {
    documents.add("32024R1689");
  }
  return [...documents];
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

/** Lit un article exact dans le corpus de `document`. */
export function getArticle(
  rootDir: string,
  demande: { document: string; numero: string | number },
): ResultatArticle {
  const article = trouverArticles(rootDir, { document: demande.document }, demande.numero)[0];
  if (article !== undefined) return { ...article, trouve: true };
  return {
    trouve: false,
    document: demande.document,
    numero: String(demande.numero),
    message: `Article ${demande.numero} introuvable dans le document ${demande.document}.`,
  };
}

export type SearchDeps = {
  embedder: Embedder;
  /**
   * Index déjà ouvert, ou fournisseur évalué seulement si la question n'est pas
   * une référence exacte ; sinon il est ouvert depuis `data/corpus/index/index.db`.
   */
  index?: Index | (() => Index);
  seuils?: { bas?: number; haut?: number; marge?: number };
  /** Voie de recherche ; `dense` par défaut, `hybride` sur demande mesurée. */
  recherche?: "dense" | "hybride";
};

export type SearchDemande = {
  question: string;
  k?: number;
  /** Restreint la recherche à une collection : `rgpd`, `aiact`, `cnil`. */
  corpus?: string;
  /** Restreint la recherche à un document précis. */
  document?: string;
  /** Restreint à une nature CNIL : Sanction, Avis ou Recommandation/Lignes directrices. */
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

/** Une décision entière rendue par son identifiant ou son numéro. */
export type DecisionTrouvee = {
  document: string;
  numero: string;
  date_acte: string;
  statut: string;
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
  fragments: FragmentDecision[];
};

/** La réponse de `get_decision` : des décisions entières, ou une absence dite. */
export type ResultatDecision = {
  trouve: boolean;
  decisions: DecisionTrouvee[];
  message?: string;
};

export type DecisionDemande = {
  /** Identifiant du document, par exemple `CNILTEXT000055022778`. */
  document?: string;
  /** Numéro de délibération, par exemple `SAN-2026-015`. */
  numero?: string;
  /** Restreint à une collection ; absent, tous les corpus répondent. */
  corpus?: string;
};

/** Rang d'un fragment dans son document : le nombre final de la référence. */
function rangDeRef(ref: string): [number, string] {
  const chiffres = /(\d+)$/.exec(ref);
  return [chiffres === null ? Number.POSITIVE_INFINITY : Number(chiffres[1]), ref];
}

/**
 * Lit une décision entière, par identifiant de document ou par numéro, dans un
 * corpus ou dans tous. Plusieurs documents peuvent porter le même numéro :
 * chacun est rendu avec son identifiant. Une absence est dite, jamais comblée.
 */
export function getDecision(rootDir: string, demande: DecisionDemande): ResultatDecision {
  const document = demande.document?.trim();
  const numero = demande.numero?.trim();
  const corpus = demande.corpus?.trim();
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
    return {
      trouve: false,
      decisions: [],
      message: `Aucune décision pour ${quoi}${portee}.`,
    };
  }

  // `get_decision` reste réservé aux sanctions : un avis ou une recommandation
  // se lit par `search`, qui porte le filtre `nature`.
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
      return {
        document: identifiant,
        numero: premier.numero,
        date_acte: premier.date_acte,
        statut: premier.statut,
        url: premier.url,
        ...(premier.origine === undefined ? {} : { origine: premier.origine }),
        ...(premier.nature === undefined ? {} : { nature: premier.nature }),
        ...(premier.type_sanction === undefined ? {} : { type_sanction: premier.type_sanction }),
        ...(premier.montant === undefined ? {} : { montant: premier.montant }),
        ...(premier.injonction === undefined ? {} : { injonction: premier.injonction }),
        fragments: premiers.map((unite) => ({
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
  // un autre corpus.
  const documentInferé =
    demande.document === undefined && demande.corpus === undefined
      ? documentNomme(demande.question)
      : null;
  const document = demande.document ?? documentInferé ?? undefined;
  const corpus = demande.corpus;
  // La confiance ne peut certifier un corpus que la question ou l'appel nomme.
  const corpusNomme = corpus !== undefined || document !== undefined;
  const numero = referenceExacte(demande.question);
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
        return {
          niveau_confiance: "incertain",
          passages: articles.map(passageExact),
          message:
            `L'article ${numero} existe dans plusieurs documents ` +
            `(${documents.join(", ")}). Précisez « document » pour n'en rendre qu'un.`,
        };
      }
      const article = articles[0];
      if (article === undefined) {
        return { niveau_confiance: "aucun_resultat_fiable", passages: [] };
      }
      if (!corpusNomme) {
        const nommes = documentsNommes(demande.question);
        const motif =
          nommes.length > 1
            ? `La question nomme plusieurs documents (${nommes.map(libelleDocument).join(", ")}) ` +
              `et l'article ${numero} n'existe que dans ${libelleDocument(article.document)} : ` +
              "nommez le corpus qui le porte, ou précisez « document » pour lever l'ambiguïté."
            : `L'article ${numero} n'existe que dans ${libelleDocument(article.document)}. ` +
              "La question ne nomme aucun document : nommez le corpus ou précisez « document » " +
              "pour lever l'ambiguïté.";
        return {
          niveau_confiance: "incertain",
          passages: [passageExact(article)],
          message: motif,
        };
      }
      return { niveau_confiance: "confiant", passages: [passageExact(article)] };
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
  // L'instruction de requête suit le document, puis le corpus : un corpus CNIL
  // ne doit pas recevoir l'instruction mesurée pour le RGPD.
  const vecteur = await deps.embedder.embedQuery(demande.question, document ?? corpus);
  const options = {
    k,
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
  const resultats =
    (deps.recherche ?? "dense") === "hybride"
      ? rechercheHybride(index, vecteur, demande.question, options)
      : searchIndex(index, vecteur, options);

  const niveau = niveauConfiance(resultats, false, deps.seuils);
  return {
    niveau_confiance: niveau,
    passages:
      niveau === "aucun_resultat_fiable"
        ? []
        : resultats.map((resultat) => ({ ...resultat, similarite: 1 - resultat.distance })),
  };
}
