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
  /** Présent quand la question citait une référence exacte introuvable. */
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

/** Cherche un article par son numéro, dans un document ou dans tout le corpus. */
function trouverArticle(
  rootDir: string,
  document: string | undefined,
  numero: string | number,
): Unite | null {
  const cherche = normaliserNumero(numero);
  if (cherche === null) return null;
  for (const unite of lireUnites(rootDir)) {
    if (document !== undefined && unite.document !== document) continue;
    if (unite.niveau !== "article") continue;
    if (normaliserNumero(unite.numero) !== cherche) continue;
    return unite;
  }
  return null;
}

/** Lit un article exact dans le corpus de `document`. */
export function getArticle(
  rootDir: string,
  demande: { document: string; numero: string | number },
): ResultatArticle {
  const article = trouverArticle(rootDir, demande.document, demande.numero);
  if (article !== null) return { ...article, trouve: true };
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
  const numero = referenceExacte(demande.question);
  if (numero !== null) {
    const article = trouverArticle(rootDir, demande.document, numero);
    if (article !== null) {
      return { niveau_confiance: "confiant", passages: [passageExact(article)] };
    }
    return {
      niveau_confiance: "aucun_resultat_fiable",
      passages: [],
      message:
        `La question cite l'article ${numero}, absent du corpus` +
        `${demande.document === undefined ? "" : ` ${demande.document}`}.`,
    };
  }

  const index =
    typeof deps.index === "function" ? deps.index() : deps.index ?? openIndex(cheminIndex(rootDir));
  const k = Math.max(1, Math.trunc(demande.k ?? 5));
  const vecteur = await deps.embedder.embedQuery(demande.question, demande.document);
  const options =
    demande.document === undefined ? { k } : { k, document: demande.document };
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
