/**
 * Les trois niveaux de confiance rendus au lecteur, et leurs seuils.
 *
 * Les seuils sont exprimés en similarité cosinus (`1 - distance`). Les valeurs
 * ci-dessous sont celles calibrées en phase 4 sur les vingt-deux questions
 * (`aidd_docs/tasks/2026_11/2026_11_03_mcp-juridique/eval.md`) ; elles séparent
 * les quatre pièges soumis aux seuils (similarité maximale 0,631) des neuf
 * questions servies par les vecteurs (similarité minimale 0,704), soit 0,019 de
 * marge sous `SEUIL_BAS` et 0,004 au-dessus de `SEUIL_HAUT`. Le cinquième piège,
 * « article 100 », est refusé par le court-circuit des articles absents, pas par
 * ces seuils. `MARGE` valant zéro, aucune question mesurée ne tombe dans
 * `incertain`. La confiance est donc fragile et ne dit que la similarité du
 * premier passage : « confiant » ne garantit jamais que l'article attendu est en
 * tête, ni la qualité de la rédaction.
 */
export type NiveauConfiance = "confiant" | "incertain" | "aucun_resultat_fiable";

/** Sous ce seuil, aucun passage n'est digne d'être présenté. */
export const SEUIL_BAS = 0.65;
/** Au-dessus de ce seuil, avec la marge, le premier passage est tenu pour sûr. */
export const SEUIL_HAUT = 0.7;
/** Écart minimal entre le premier et le second passage pour parler de confiance. */
export const MARGE = 0;

export type ResultatAvecDistance = { distance: number };

function similarite(resultat: ResultatAvecDistance | undefined): number {
  return resultat === undefined ? Number.NEGATIVE_INFINITY : 1 - resultat.distance;
}

/**
 * `confiant` si la référence est exacte, ou si le premier passage dépasse le
 * seuil haut avec la marge requise ; `aucun_resultat_fiable` sous le seuil bas
 * ou sans résultat ; `incertain` entre les deux.
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
  if (premierScore >= haut && premierScore - secondScore >= margeRequise) return "confiant";
  return "incertain";
}
