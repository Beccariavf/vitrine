import { lireUnites } from "./index/build.ts";
import { cheminIndex } from "./index/build.ts";
import { openIndex, rechercheHybride, searchIndex } from "./index/search.ts";
import type { Index, ResultatRecherche } from "./index/search.ts";
import type { Unite } from "./corpus/parse.ts";
import type { Embedder } from "./embed/embedder.ts";
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

/** Alias qui nomment un corpus dans une question, et le CELEX qu'ils désignent. */
const ALIAS_DOCUMENTS: readonly { alias: RegExp; document: string }[] = [
  { alias: /\bRGPD\b/i, document: "32016R0679" },
  {
    alias: /r[eè]glement g[eé]n[eé]ral sur la protection des donn[eé]es/i,
    document: "32016R0679",
  },
  { alias: /\bAI Act\b/i, document: "32024R1689" },
  {
    alias: /r[eè]glement sur l['’]intelligence artificielle/i,
    document: "32024R1689",
  },
  { alias: /\br[eè]glement IA\b/i, document: "32024R1689" },
];

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
 * Document nommé par la question, quand ses alias désignent un seul corpus ;
 * `null` si aucun alias ne s'y trouve ou si deux corpus sont nommés.
 */
export function documentNomme(question: string): string | null {
  const documents = new Set(
    ALIAS_DOCUMENTS.filter(({ alias }) => alias.test(question)).map(({ document }) => document),
  );
  return documents.size === 1 ? ([...documents][0] ?? null) : null;
}

/**
 * Cherche les articles portant ce numéro, dans un document ou dans tout le
 * corpus. Plusieurs documents peuvent porter le même numéro : l'appelant décide
 * s'il rend le premier ou s'il expose l'ambiguïté.
 */
function trouverArticles(
  rootDir: string,
  document: string | undefined,
  numero: string | number,
): Unite[] {
  const cherche = normaliserNumero(numero);
  if (cherche === null) return [];
  return lireUnites(rootDir).filter(
    (unite) =>
      (document === undefined || unite.document === document) &&
      unite.niveau === "article" &&
      normaliserNumero(unite.numero) === cherche,
  );
}

/** Lit un article exact dans le corpus de `document`. */
export function getArticle(
  rootDir: string,
  demande: { document: string; numero: string | number },
): ResultatArticle {
  const article = trouverArticles(rootDir, demande.document, demande.numero)[0];
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
  document?: string;
};

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
  const document = demande.document ?? documentNomme(demande.question) ?? undefined;
  const numero = referenceExacte(demande.question);
  if (numero !== null) {
    const articles = trouverArticles(rootDir, document, numero);
    if (articles.length > 0) {
      const documents = articles.map((article) => article.document);
      return {
        niveau_confiance: articles.length === 1 ? "confiant" : "incertain",
        passages: articles.map(passageExact),
        ...(articles.length === 1
          ? {}
          : {
              message:
                `L'article ${numero} existe dans plusieurs documents ` +
                `(${documents.join(", ")}). Précisez « document » pour n'en rendre qu'un.`,
            }),
      };
    }
    return {
      niveau_confiance: "aucun_resultat_fiable",
      passages: [],
      message:
        document === undefined
          ? `La question cite l'article ${numero}, absent du corpus.`
          : `La question cite l'article ${numero} du document ${libelleDocument(document)}, ` +
            "absent du corpus.",
    };
  }

  const index =
    typeof deps.index === "function" ? deps.index() : deps.index ?? openIndex(cheminIndex(rootDir));
  const k = Math.max(1, Math.trunc(demande.k ?? 5));
  const vecteur = await deps.embedder.embedQuery(demande.question, document);
  const options = document === undefined ? { k } : { k, document };
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
