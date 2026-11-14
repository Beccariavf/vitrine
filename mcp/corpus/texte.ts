/**
 * Formes comparables et recherche d'expressions dans un texte de décision.
 *
 * La comparaison ignore casse, diacritiques et ponctuation : « Conseil d'État »
 * et « conseil d etat » se rencontrent. Les filtres de pertinence des corpus de
 * décisions s'appuient dessus ; ils restent volontairement larges.
 */

/**
 * Forme comparable d'une chaîne : minuscules, sans diacritiques, ponctuation
 * ramenée à une espace. « Conseil d'État » y devient « conseil d etat ».
 */
export function normaliserComparaison(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Vrai si `expression` apparaît comme suite de mots dans la forme comparable. */
export function contientExpression(texte: string, expression: string): boolean {
  return ` ${texte} `.includes(` ${expression} `);
}

/** Vrai si le texte contient au moins un mot-clé, à la casse et aux accents près. */
export function contientMotCle(texte: string, motsCles: readonly string[]): boolean {
  const forme = normaliserComparaison(texte);
  return motsCles.some((motCle) => {
    const cherche = normaliserComparaison(motCle);
    return cherche !== "" && forme.includes(cherche);
  });
}
