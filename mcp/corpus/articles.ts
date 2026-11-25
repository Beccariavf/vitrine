/**
 * Numéros d'article comparables : préfixe de code (`L. `), corps (`34-5`) et
 * plages (`226-16–226-24`). Partagé par la lecture inverse des citations, la
 * couverture partielle d'un texte et la lecture d'un article.
 */

/** Préfixe de code (`L. `, `R. `, `D. `) et corps d'un numéro d'article. */
export type Article = { prefixe: string; corps: string };

/** Suffixes latins d'un article inséré : `15 bis`, `1 ter`. */
export const SUFFIXE_ARTICLE = "bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies";

/**
 * `Article 17`, `art. 17`, `n° 17`, `L. 34-5`, `226-16` : préfixe de code, nombre
 * sans zéro de tête, segments à tiret, puis lettre (`226-16-1-A`), suffixe latin
 * (`15 bis`) ou lettre collée (`15a`, gardée telle quelle : elle ne désigne aucun
 * article français et rend « introuvable » plutôt que l'article 15). `26-1` reste
 * distinct de `26`, `9 bis` de `9` ; ce qui suit (paragraphe, sigle) est ignoré.
 */
export function normaliserNumero(numero: string | number): string | null {
  const brut = String(numero)
    .trim()
    .replace(/^(?:articles?|art\.?)\s*/i, "")
    .replace(/^(?:n[°o]|§)\s*/i, "");
  const trouve = new RegExp(
    "^(?:([LRD])\\.?\\s*)?(\\d+)(?:er)?((?:-\\d+)*)" +
      "(?:-([A-Z]{1,2})(?![A-Za-zÀ-ÿ])|([a-z])(?![A-Za-zÀ-ÿ]))?" +
      `(?:\\s*(${SUFFIXE_ARTICLE})(?![A-Za-zÀ-ÿ]))?`,
    "i",
  ).exec(brut);
  if (trouve === null) return null;
  // La DILA détache parfois le suffixe de lettre par une espace (« L1121-16-1 A ») :
  // il reste un article distinct de « L1121-16-1 ». Seule une majuscule non suivie
  // d'un point compte, pour ne pas lire « C. pén. » ni « du » après un numéro.
  const detache = /^\s+([A-Z]{1,2})(?![A-Za-zÀ-ÿ.])/.exec(brut.slice(trouve[0].length));
  const lettre = trouve[4] === undefined
    ? (detache?.[1] === undefined ? "" : `-${detache[1]}`)
    : `-${trouve[4].toUpperCase()}`;
  const collee = trouve[5] === undefined ? "" : trouve[5].toLowerCase();
  const latin = trouve[6] === undefined ? "" : ` ${trouve[6].toLowerCase()}`;
  return `${trouve[1]?.toUpperCase() ?? ""}${Number(trouve[2])}${trouve[3] ?? ""}${lettre}${collee}${latin}`;
}

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
export function comparerCorps(gauche: string, droite: string): number {
  const a = gauche.split("-").map(Number);
  const b = droite.split("-").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const ecart = (a[i] ?? -1) - (b[i] ?? -1);
    if (ecart !== 0) return ecart;
  }
  return 0;
}

/** Vrai quand l'article cité est une plage `a–b`. */
export function estPlage(articleCite: string): boolean {
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
    return comparerCorps(debut.corps, demande.corps) <= 0 && comparerCorps(demande.corps, fin.corps) <= 0;
  }
  const cite = formeArticle(articleCite);
  return cite !== null && cite.prefixe === demande.prefixe && cite.corps === demande.corps;
}
