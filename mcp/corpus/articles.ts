/**
 * Numéros d'article comparables : préfixe de code (`L. `), corps (`34-5`) et
 * plages (`226-16–226-24`). Partagé par la lecture inverse des citations, la
 * couverture partielle d'un texte et la lecture d'un article.
 */

/** Préfixe de code (`L. `, `R. `, `D. `) et corps d'un numéro d'article. */
export type Article = { prefixe: string; corps: string };

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
