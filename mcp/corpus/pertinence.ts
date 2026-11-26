/**
 * Critères d'un filtre élargi de corpus de décisions : textes visés et
 * expressions bornées.
 *
 * Les textes visés se reconnaissent au numéro d'article, cherché dans la forme
 * comparable de `normaliserComparaison` (minuscules, sans diacritiques, toute
 * ponctuation ramenée à une espace) : `L. 311-1` s'y lit `l 311 1`. Un motif
 * d'accompagnement exige le nom du texte, pour qu'un numéro d'article d'un
 * autre code ne suffise pas. Les expressions, elles, sont des suites de mots
 * de la même forme comparable, prises ensemble ou séparément.
 *
 * Le filtre élargi ne remplace jamais le filtre historique : les corpus
 * gardent leurs décisions et le nouveau critère s'ajoute en union.
 */

import { normaliserComparaison } from "./texte.ts";

/** Un critère du filtre élargi, déclaré au descripteur du corpus. */
export type CritereElargi = {
  /** Identifiant stable, porté aux comptes du manifeste. */
  cle: string;
  /** Libellé lisible, porté au manifeste. */
  libelle: string;
  /** Motif des numéros d'articles, dans la forme comparable. */
  articles?: string;
  /**
   * Motifs du contexte, tous exigés dans la fenêtre autour de l'article quand
   * ils sont présents : le nom du texte, et le contexte qui rend la citation
   * pertinente (santé, communication d'un document, etc.).
   */
  contexte?: string | readonly string[];
  /** Expressions exigées, dans la forme comparable. */
  expressions?: string[];
  /** Vrai quand toutes les expressions doivent apparaître, au lieu d'une seule. */
  toutes?: boolean;
  /**
   * Nombre minimal d'occurrences des expressions dans le texte entier. Avec
   * `toutes`, chaque expression doit atteindre ce nombre ; sinon le total des
   * occurrences rencontrées le doit. Défaut : 1.
   */
  occurrences_min?: number;
};

/** Critère rencontré dans un texte, avec son libellé. */
export type CritereTrouve = { cle: string; libelle: string };

/** Fenêtre, en caractères de la forme comparable, où le nom du texte doit accompagner l'article. */
const FENETRE_CONTEXTE = 160;

/** Motifs compilés une fois par objet de critère : un critère invalide lève à la première lecture. */
type CritereCompile = {
  articlesGlobal: RegExp | null;
  contextes: RegExp[];
  expressions: string[];
  toutes: boolean;
  occurrencesMin: number;
};

const COMPILES = new WeakMap<CritereElargi, CritereCompile>();

function compiler(critere: CritereElargi): CritereCompile {
  const connu = COMPILES.get(critere);
  if (connu !== undefined) return connu;
  if (critere.articles !== undefined && critere.articles.trim() === "") {
    throw new Error(`Critère « ${critere.cle} » : motif d'articles vide`);
  }
  const contextes = (
    critere.contexte === undefined
      ? []
      : Array.isArray(critere.contexte)
        ? critere.contexte
        : [critere.contexte]
  ).map((motif) => {
    if (motif.trim() === "") {
      throw new Error(`Critère « ${critere.cle} » : motif de contexte vide`);
    }
    return new RegExp(motif);
  });
  const expressions = (critere.expressions ?? []).map((expression) =>
    normaliserComparaison(expression),
  );
  if (expressions.some((expression) => expression === "")) {
    throw new Error(`Critère « ${critere.cle} » : expression vide`);
  }
  const occurrencesMin = critere.occurrences_min ?? 1;
  if (!Number.isInteger(occurrencesMin) || occurrencesMin < 1) {
    throw new Error(`Critère « ${critere.cle} » : occurrences_min doit être un entier positif`);
  }
  const compile: CritereCompile = {
    articlesGlobal: critere.articles === undefined ? null : new RegExp(critere.articles, "g"),
    contextes,
    expressions,
    toutes: critere.toutes === true,
    occurrencesMin,
  };
  COMPILES.set(critere, compile);
  return compile;
}

/** Vrai quand un article est cité à portée de tous les contextes du critère. */
function articleProche(forme: string, articles: RegExp, contextes: readonly RegExp[]): boolean {
  for (const trouve of forme.matchAll(articles)) {
    if (contextes.length === 0) return true;
    const index = trouve.index ?? 0;
    const debut = Math.max(0, index - FENETRE_CONTEXTE);
    const fin = Math.min(forme.length, index + trouve[0].length + FENETRE_CONTEXTE);
    const fenetre = forme.slice(debut, fin);
    if (contextes.every((contexte) => contexte.test(fenetre))) return true;
  }
  return false;
}

/** Occurrences d'une expression dans la forme comparable, sans chevauchement. */
function compterOccurrences(forme: string, expression: string): number {
  let compte = 0;
  let index = 0;
  while ((index = forme.indexOf(expression, index)) !== -1) {
    compte += 1;
    index += expression.length;
  }
  return compte;
}

/**
 * Vrai quand les expressions atteignent le seuil d'occurrences. Avec `toutes`,
 * chacune doit l'atteindre ; sinon leur total suffit.
 */
function occurrencesSuffisantes(
  forme: string,
  expressions: readonly string[],
  toutes: boolean,
  minimum: number,
): boolean {
  const comptes = expressions.map((expression) => compterOccurrences(forme, expression));
  return toutes
    ? comptes.every((compte) => compte >= minimum)
    : comptes.reduce((total, compte) => total + compte, 0) >= minimum;
}

/**
 * Critères élargis rencontrés dans un texte, dans l'ordre du descripteur.
 *
 * Un critère à articles exige un numéro d'article et, s'ils sont déclarés, ses
 * motifs de contexte, tous présents dans la fenêtre autour de l'article ; ses
 * expressions, quand il en porte, s'y ajoutent. Un critère sans articles ne
 * repose que sur ses expressions, toutes exigées ou l'une d'elles selon
 * `toutes`, et sur leur nombre minimal d'occurrences. Un critère sans articles
 * ni expressions ne retient rien : il est refusé plutôt que de tout retenir.
 */
export function criteresTrouves(
  texte: string,
  criteres: readonly CritereElargi[],
): CritereTrouve[] {
  if (criteres.length === 0) return [];
  const forme = normaliserComparaison(texte);
  const trouves: CritereTrouve[] = [];
  for (const critere of criteres) {
    const compile = compiler(critere);
    if (compile.articlesGlobal === null && compile.expressions.length === 0) {
      throw new Error(`Critère « ${critere.cle} » sans article ni expression`);
    }
    if (compile.articlesGlobal !== null) {
      if (!articleProche(forme, compile.articlesGlobal, compile.contextes)) continue;
    }
    if (compile.expressions.length > 0) {
      const presentes = compile.expressions.filter((expression) => forme.includes(expression));
      const satisfait = compile.toutes
        ? presentes.length === compile.expressions.length
        : presentes.length > 0;
      if (!satisfait) continue;
      if (
        !occurrencesSuffisantes(
          forme,
          compile.expressions,
          compile.toutes,
          compile.occurrencesMin,
        )
      ) {
        continue;
      }
    }
    trouves.push({ cle: critere.cle, libelle: critere.libelle });
  }
  return trouves;
}

/** Compte les critères trouvés, par clé, pour le manifeste. */
export function compterCriteres(
  comptes: Map<string, number>,
  trouves: readonly CritereTrouve[],
): void {
  for (const critere of trouves) {
    comptes.set(critere.cle, (comptes.get(critere.cle) ?? 0) + 1);
  }
}

/** Objet `clé → compte`, trié par clé, tel que le manifeste l'écrit. */
export function comptesTries(comptes: ReadonlyMap<string, number>): Record<string, number> {
  return Object.fromEntries([...comptes.entries()].sort(([gauche], [droite]) =>
    gauche.localeCompare(droite),
  ));
}
