/**
 * Les trois niveaux de confiance rendus au lecteur, et leurs seuils.
 *
 * Les seuils sont exprimés en similarité cosinus (`1 - distance`). Les valeurs
 * ci-dessous sont calibrées sur les 35 questions `dev`, jamais sur les 15
 * questions `test` tenues à l'écart :
 * `aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md`.
 *
 * `confiant` ne dit qu'une chose : la similarité du premier passage dépasse
 * `SEUIL_HAUT` et devance le second d'au moins `MARGE`. Il ne dit jamais que
 * l'article attendu est en tête, ni que la réponse est juste. La marge sépare le
 * premier du second passage, pas le vrai du faux : une réponse `confiante` peut
 * rester le mauvais article. `incertain` apparaît quand les deux premiers
 * passages sont proches, ou quand le premier reste entre les deux seuils.
 */
export type NiveauConfiance = "confiant" | "incertain" | "aucun_resultat_fiable";

/** Sous ce seuil, aucun passage n'est digne d'être présenté. */
export const SEUIL_BAS = 0.69;
/** Au-dessus de ce seuil, avec la marge, le premier passage est tenu pour sûr. */
export const SEUIL_HAUT = 0.74;
/** Écart minimal entre le premier et le second passage pour parler de confiance. */
export const MARGE = 0.01;

export type ResultatAvecDistance = { distance: number };

function similarite(resultat: ResultatAvecDistance | undefined): number {
  return resultat === undefined ? Number.NEGATIVE_INFINITY : 1 - resultat.distance;
}

/**
 * `confiant` si la référence est exacte, ou si le premier passage dépasse le
 * seuil haut et devance le second de plus que la marge ; `aucun_resultat_fiable`
 * sous le seuil bas ou sans résultat ; `incertain` entre les deux.
 */
export function niveauConfiance(
  resultats: ResultatAvecDistance[],
  exact: boolean,
  seuils: { bas?: number; haut?: number; marge?: number } = {},
): NiveauConfiance {
  if (exact) return "confiant";
  const premier = resultats[0];
  if (premier === undefined) return "aucun_resultat_fiable";

  const bas = seuils.bas ?? SEUIL_BAS;
  const haut = seuils.haut ?? SEUIL_HAUT;
  const margeRequise = seuils.marge ?? MARGE;

  const premierScore = similarite(premier);
  if (premierScore < bas) return "aucun_resultat_fiable";

  const secondScore = resultats.length > 1 ? similarite(resultats[1]) : 0;
  if (premierScore >= haut && premierScore - secondScore > margeRequise) return "confiant";
  return "incertain";
}
