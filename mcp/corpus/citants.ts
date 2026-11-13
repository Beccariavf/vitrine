/**
 * Décisions qui citent un article : la lecture inverse des citations de #28.
 *
 * Le calcul se fait à la lecture, depuis le cache de `citationsDuCorpus` : aucun
 * index, aucun stockage. La liste hérite de la précision de l'extraction : elle
 * est non exhaustive, et une liste vide ne prouve pas qu'aucune décision ne cite
 * l'article. Un article absent du corpus est dit absent, jamais « jamais cité ».
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Unite } from "./parse.ts";
import {
  CORPUS_DECISIONS,
  absenceDuDocument,
  citationsDuCorpus,
  documentDeclare,
  documentsPresents,
  normaliserIdentifiant,
} from "./citations.ts";
import type { Citation } from "./citations.ts";
import { autoriteDe } from "./hors-corpus.ts";

/** Taille de page par défaut et plafond : l'article 15 de la LIL a plus de 700 citants. */
export const LIMITE_DEFAUT = 50;
export const LIMITE_MAX = 500;

/** Une décision citante, telle que l'outil la rend. */
export type DecisionCitante = {
  document: string;
  corpus: string;
  autorite: string;
  /** Intitulé de la décision, tiré de son chemin : `Conseil d'État > Décision 353066`. */
  intitule: string;
  date_acte: string;
  url: string;
  /** La citation qui vise l'instrument, au format de #28 : `RGPD · art. 6, 9`. */
  reference: string;
  /** Présent quand l'article n'est atteint que par une plage (`8–10`), jamais nommément. */
  via_plage?: true;
};

export type ResultatCitants = {
  /** Faux seulement quand l'identifiant n'est ni au catalogue ni au corpus. */
  trouve: boolean;
  document: string;
  numero: string;
  /** L'article existe-t-il dans le corpus local ? */
  article_au_corpus: boolean;
  /** Décisions citantes distinctes, toutes pages confondues. */
  total: number;
  par_autorite: { autorite: string; decisions: number }[];
  /**
   * LIL seulement : décisions antérieures au 2019-06-01 qui citent ce numéro.
   * L'ordonnance 2018-1125 a renuméroté la loi : elles visent un autre texte et
   * sont écartées de `decisions`, `total` et `par_autorite`.
   */
  ecartees_numerotation_anterieure?: number;
  decisions: DecisionCitante[];
  decalage: number;
  /** Vrai quand des décisions restent après cette page. */
  tronque: boolean;
  message?: string;
};

export type DemandeCitants = {
  document: string;
  numero: string | number;
  limite?: number;
  decalage?: number;
};

/** Préfixe de code (`L. `, `R. `, `D. `) et corps d'un numéro d'article. */
type Article = { prefixe: string; corps: string };

/**
 * Forme comparable d'un numéro : sans « article » ni « art. », `1er` devenu `1`,
 * préfixe de code ramené à `L. `. `null` quand rien ne ressemble à un numéro.
 */
export function formeArticle(valeur: string | number): Article | null {
  const brut = String(valeur)
    .trim()
    .replace(/^(?:articles?|art\.?)\s*/i, "");
  // Seule une subdivision suit le numéro : alinéa `(2)`, point `.2` ; `9 bis` n'est pas `9`.
  const trouve = /^(?:([LRD])\.?\s*)?(\d+)(?:er)?((?:-\d+)*)((?:\([0-9a-z]{1,4}\)|\.\d+)*)\s*$/i.exec(brut);
  if (trouve === null) return null;
  return {
    prefixe: trouve[1] === undefined ? "" : `${trouve[1].toUpperCase()}. `,
    corps: `${Number(trouve[2])}${trouve[3] ?? ""}`,
  };
}

/** Compare deux corps `226-16` et `226-24` segment par segment ; un segment absent vaut moins. */
function comparer(gauche: string, droite: string): number {
  const a = gauche.split("-").map(Number);
  const b = droite.split("-").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const ecart = (a[i] ?? -1) - (b[i] ?? -1);
    if (ecart !== 0) return ecart;
  }
  return 0;
}

/** Vrai quand l'article cité est une plage `a–b`. */
function estPlage(articleCite: string): boolean {
  return articleCite.includes("–");
}

/**
 * Vrai quand un article cité vise l'article demandé : même base — l'alinéa
 * `9(2)` ou `9.2` compte pour `9`, le tiret `26-1` reste un autre article —, ou
 * plage `a–b` du même code qui le contient.
 */
export function citeArticle(articleCite: string, demande: Article): boolean {
  const bornes = articleCite.split("–");
  if (bornes.length === 2) {
    const debut = formeArticle(bornes[0] ?? "");
    const fin = formeArticle(bornes[1] ?? "");
    if (debut === null || fin === null || debut.prefixe !== demande.prefixe) return false;
    if (debut.prefixe !== fin.prefixe) return false;
    return comparer(debut.corps, demande.corps) <= 0 && comparer(demande.corps, fin.corps) <= 0;
  }
  const cite = formeArticle(articleCite);
  return cite !== null && cite.prefixe === demande.prefixe && cite.corps === demande.corps;
}

/** Lit les unités d'un fichier JSONL ; un fichier absent n'en donne aucune. */
function lireJsonl(chemin: string): Unite[] {
  if (!existsSync(chemin)) return [];
  return readFileSync(chemin, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim() !== "")
    .map((ligne) => JSON.parse(ligne) as Unite);
}

/**
 * Vrai quand un article de ce numéro existe dans le corpus qui déclare le
 * document (champ `document` ou `text_id` de son manifeste). Seul ce corpus est
 * lu.
 */
function articleAuCorpus(rootDir: string, document: string, demande: Article): boolean {
  const racine = join(rootDir, "data", "corpus");
  if (!existsSync(racine)) return false;
  const cherche = normaliserIdentifiant(document);
  for (const dossier of readdirSync(racine, { withFileTypes: true })) {
    if (!dossier.isDirectory()) continue;
    const manifeste = join(racine, dossier.name, "manifest.json");
    if (!existsSync(manifeste)) continue;
    let declare = false;
    try {
      const valeur = JSON.parse(readFileSync(manifeste, "utf8")) as Record<string, unknown>;
      declare = ["document", "text_id"].some(
        (champ) =>
          typeof valeur[champ] === "string" &&
          normaliserIdentifiant(valeur[champ] as string) === cherche,
      );
    } catch {
      // Un manifeste illisible ne déclare rien.
    }
    if (!declare) continue;
    return lireJsonl(join(racine, dossier.name, "unites.jsonl")).some((unite) => {
      if (unite.niveau !== "article" || normaliserIdentifiant(unite.document) !== cherche) return false;
      const forme = formeArticle(unite.numero);
      return forme !== null && forme.prefixe === demande.prefixe && forme.corps === demande.corps;
    });
  }
  return false;
}

/** Loi 78-17 : sa numérotation actuelle date de l'ordonnance 2018-1125, en vigueur le 2019-06-01. */
const LIL = "LEGITEXT000006068624";
const RENUMEROTATION_LIL = "2019-06-01";

/**
 * Citation d'une décision qui vise l'article demandé, et si elle ne l'atteint
 * que par une plage ; `null` sinon.
 */
function citationVisant(
  citations: readonly Citation[],
  document: string,
  demande: Article,
): { citation: Citation; viaPlage: boolean } | null {
  let parPlage: Citation | null = null;
  for (const citation of citations) {
    if (normaliserIdentifiant(citation.document) !== document) continue;
    const touches = citation.articles.filter((article) => citeArticle(article, demande));
    if (touches.some((article) => !estPlage(article))) return { citation, viaPlage: false };
    if (touches.length > 0) parPlage ??= citation;
  }
  return parPlage === null ? null : { citation: parPlage, viaPlage: true };
}

/** Corpus dont le chemin d'une unité finit par la section du fragment (`Visa`, `En-tête`). */
const CHEMIN_AVEC_SECTION: readonly string[] = ["cc", "cjue"];

/**
 * Intitulé d'une décision : le chemin de sa première unité, sans la section du
 * fragment pour la Cour de cassation et la CJUE, dont le `numero` d'unité est un
 * nom de section et non un numéro de décision.
 */
function intituleDe(corpus: string, unite: Unite | undefined): string {
  if (unite === undefined) return "";
  if (!CHEMIN_AVEC_SECTION.includes(corpus)) return unite.chemin;
  const segments = unite.chemin.split(" > ");
  return segments.length > 1 ? segments.slice(0, -1).join(" > ") : unite.chemin;
}

/** Première unité de chaque document voulu, dans l'ordre du fichier. */
function premieresUnites(
  rootDir: string,
  corpus: string,
  documents: ReadonlySet<string>,
): Map<string, Unite> {
  const premieres = new Map<string, Unite>();
  if (documents.size === 0) return premieres;
  for (const unite of lireJsonl(join(rootDir, "data", "corpus", corpus, "unites.jsonl"))) {
    if (documents.has(unite.document) && !premieres.has(unite.document)) {
      premieres.set(unite.document, unite);
    }
  }
  return premieres;
}

function libelle(document: string, numero: string): string {
  const declare = documentDeclare(document);
  return `l'article ${numero} ${declare === null ? `du document ${document}` : `du ${declare.libelle}`}`;
}

/**
 * Les décisions du corpus qui citent un article, triées par date décroissante,
 * avec leur total et leur compte par autorité, calculés avant la pagination.
 */
export function decisionsCitant(rootDir: string, demandeBrute: DemandeCitants): ResultatCitants {
  const document = normaliserIdentifiant(demandeBrute.document);
  const numero = String(demandeBrute.numero).trim();
  const limite = Math.min(
    LIMITE_MAX,
    Math.max(1, Math.trunc(demandeBrute.limite ?? LIMITE_DEFAUT)),
  );
  const decalage = Math.max(0, Math.trunc(demandeBrute.decalage ?? 0));
  const vide = {
    document,
    numero,
    article_au_corpus: false,
    total: 0,
    par_autorite: [],
    decisions: [],
    decalage,
    tronque: false,
  };

  const demande = formeArticle(numero);
  if (demande === null) {
    return { ...vide, trouve: false, message: `« ${numero} » n'est pas un numéro d'article.` };
  }
  const present = documentsPresents(rootDir).has(document);
  if (!present && documentDeclare(document) === null) {
    return {
      ...vide,
      trouve: false,
      message: `Document ${document} inconnu : ni au catalogue des instruments cités, ni au corpus.`,
    };
  }

  const citantes: DecisionCitante[] = [];
  let anterieures = 0;
  for (const corpus of CORPUS_DECISIONS) {
    const visees = new Map<string, { citation: Citation; viaPlage: boolean }>();
    for (const [decision, citations] of citationsDuCorpus(rootDir, corpus)) {
      const vise = citationVisant(citations, document, demande);
      if (vise !== null) visees.set(decision, vise);
    }
    const premieres = premieresUnites(rootDir, corpus, new Set(visees.keys()));
    for (const [decision, { citation, viaPlage }] of visees) {
      const unite = premieres.get(decision);
      const date_acte = unite?.date_acte ?? "";
      // Une date inconnue n'est pas écartée : rien ne dit qu'elle précède la renumérotation.
      if (document === LIL && date_acte !== "" && date_acte < RENUMEROTATION_LIL) {
        anterieures += 1;
        continue;
      }
      citantes.push({
        document: decision,
        corpus,
        autorite: autoriteDe(corpus),
        intitule: intituleDe(corpus, unite),
        date_acte,
        url: unite?.url ?? "",
        reference: citation.reference,
        ...(viaPlage ? { via_plage: true as const } : {}),
      });
    }
  }
  citantes.sort(
    (gauche, droite) =>
      droite.date_acte.localeCompare(gauche.date_acte) || gauche.document.localeCompare(droite.document),
  );

  const comptes = new Map<string, number>();
  for (const citante of citantes) comptes.set(citante.autorite, (comptes.get(citante.autorite) ?? 0) + 1);
  const par_autorite = [...comptes.entries()]
    .map(([autorite, decisions]) => ({ autorite, decisions }))
    .sort((gauche, droite) => droite.decisions - gauche.decisions || gauche.autorite.localeCompare(droite.autorite));

  const article_au_corpus = present && articleAuCorpus(rootDir, document, demande);
  const quoi = libelle(document, numero);
  const absence = present
    ? article_au_corpus
      ? null
      : `${quoi.charAt(0).toUpperCase()}${quoi.slice(1)} est absent du corpus : son texte n'est pas rendu.`
    : absenceDuDocument(rootDir, document);
  const aucune =
    citantes.length === 0
      ? `Aucune décision du corpus ne cite ${quoi} parmi les citations reconnues ; ` +
        "la liste est non exhaustive et ne prouve pas que l'article n'est jamais cité."
      : null;
  const renumerotation =
    anterieures === 0
      ? null
      : `${anterieures} décision(s) antérieure(s) au ${RENUMEROTATION_LIL} citent un article 78-17 ` +
        `numéroté ${numero} : l'ordonnance 2018-1125 a renuméroté la loi, elles visent un autre ` +
        "texte et sont écartées des comptes.";
  const message = [absence, aucune, renumerotation].filter((partie) => partie !== null).join(" ");

  return {
    ...vide,
    trouve: true,
    article_au_corpus,
    total: citantes.length,
    par_autorite,
    ...(document === LIL ? { ecartees_numerotation_anterieure: anterieures } : {}),
    decisions: citantes.slice(decalage, decalage + limite),
    tronque: decalage + limite < citantes.length,
    ...(message === "" ? {} : { message }),
  };
}
