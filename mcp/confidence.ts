/**
 * Les trois niveaux de confiance rendus au lecteur, et les seuils qui les décident.
 *
 * ## Ce que « confiant » garantit
 * Sur le corpus CNIL — le seul dont la ligne de table s'applique — l'étiquette a
 * une promesse chiffrée : sur les 54 questions sémantiques de
 * `questions-cnil-etendu.csv`, 2 erreurs sur 28 réponses confiantes (7,1 %),
 * soit une borne haute à 95 % de **22,6 %** (Wilson), à **51,9 %** de couverture,
 * en comptant satisfait un passage qui porte le document attendu dans les cinq
 * premiers du top 5 brut. Hors échantillon, le split `test` déjà stocké rend
 * 0 erreur sur 34 confiantes (borne 10,2 %, couverture 63,0 %). Le meilleur
 * réglage mesuré sur `dev` plafonne à 19,4 %, à 29,6 % de couverture seulement.
 * Source : `aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/calibration.md`.
 *
 * ## Ce qu'elle ne garantit pas
 * La réponse prise une à une : c'est une moyenne de corpus, aucun signal par
 * passage ne dit que le premier résultat est le bon article. Ni le fragment
 * exact (la mesure est au document), ni le rang 1 (le top 5 suffit), ni le
 * sous-ensemble doctrinal `questions-cnil-doctrine.csv` (hors plafond), ni une
 * recherche sans `corpus` ou à document unique (autre instruction de requête,
 * autre bassin : repli, aucune promesse), ni les autres corpus (aucun n'a la
 * puissance de fixer sa borne), ni la justesse rédactionnelle.
 *
 * ## La borne qui soutient la promesse
 * `bas` refuse, `haut` et `marge` certifient. Le triplet CNIL a `bas = haut =
 * 0,73` : aucun refus ne porte sur une réponse qui aurait été confiante, et la
 * plus faible similarité d'une bonne réponse (0,7304) est rendue. La table est
 * liée au couple (modèle, corpus) : Harrier 0.6B déplace l'échelle, la table se
 * recalibre, la mécanique reste.
 */
export type NiveauConfiance = "confiant" | "incertain" | "aucun_resultat_fiable";

/** Un triplet de seuils, en similarité cosinus (`1 - distance`). */
export type SeuilsCorpus = { bas: number; haut: number; marge: number };

/**
 * Table par corpus : elle ne porte que les corpus dont la promesse est mesurée.
 * Chaque entrée vient de `promesse.md`, et `tests/mcp.test.ts` échoue si les deux
 * divergent. Un corpus absent de la table suit le repli, sans promesse chiffrée.
 */
export const SEUILS_PAR_CORPUS: Record<string, SeuilsCorpus> = {
  /** CNIL : 22,6 % d'erreur au plus sur les réponses confiantes, à 51,9 % de couverture. */
  cnil: { bas: 0.73, haut: 0.73, marge: 0.01 },
};

/** Sous ce seuil, aucun passage n'est digne d'être présenté (repli global). */
export const SEUIL_BAS = 0.69;
/** Au-dessus de ce seuil, avec la marge, le premier passage est tenu pour sûr (repli). */
export const SEUIL_HAUT = 0.74;
/** Écart minimal entre le premier et le second passage pour parler de confiance (repli). */
export const MARGE = 0.01;

/** Le triplet de repli : tout corpus sans promesse chiffrée, et la recherche sans corpus. */
export const SEUILS_REPLI: SeuilsCorpus = { bas: SEUIL_BAS, haut: SEUIL_HAUT, marge: MARGE };

export type ResultatAvecDistance = { distance: number };

/** Options d'un calcul de niveau : les seuils de l'appelant priment sur la table. */
export type OptionsConfiance = {
  bas?: number;
  haut?: number;
  marge?: number;
  /** Corpus demandé par l'appel ; absent, aucune table ne s'applique. */
  corpus?: string;
};

/**
 * Seuils d'un corpus : sa ligne de table quand elle existe, le repli global
 * sinon. La résolution ne lit que le corpus demandé, jamais les passages rendus.
 * `Object.hasOwn` interdit de lire une propriété héritée : un corpus nommé
 * `constructor` ou `toString` ne doit pas recevoir la ligne d'un prototype.
 */
export function seuilsDuCorpus(corpus?: string): SeuilsCorpus {
  if (corpus === undefined || !Object.hasOwn(SEUILS_PAR_CORPUS, corpus)) return SEUILS_REPLI;
  return SEUILS_PAR_CORPUS[corpus] ?? SEUILS_REPLI;
}

function similarite(resultat: ResultatAvecDistance | undefined): number {
  return resultat === undefined ? Number.NEGATIVE_INFINITY : 1 - resultat.distance;
}

/**
 * `confiant` si la référence est exacte, ou si le premier passage dépasse le
 * seuil haut et devance le second de plus que la marge ; `aucun_resultat_fiable`
 * sous le seuil bas ou sans résultat ; `incertain` entre les deux.
 *
 * Les seuils se résolvent dans cet ordre : ceux fournis par l'appelant, puis la
 * table du corpus demandé (`options.corpus`), puis le repli global. `exact: true`
 * rend `confiant` sans lire la table.
 */
export function niveauConfiance(
  resultats: ResultatAvecDistance[],
  exact: boolean,
  options: OptionsConfiance = {},
): NiveauConfiance {
  if (exact) return "confiant";
  const premier = resultats[0];
  if (premier === undefined) return "aucun_resultat_fiable";

  const parCorpus = seuilsDuCorpus(options.corpus);
  const bas = options.bas ?? parCorpus.bas;
  const haut = options.haut ?? parCorpus.haut;
  const margeRequise = options.marge ?? parCorpus.marge;

  const premierScore = similarite(premier);
  if (premierScore < bas) return "aucun_resultat_fiable";

  const secondScore = resultats.length > 1 ? similarite(resultats[1]) : 0;
  if (premierScore >= haut && premierScore - secondScore > margeRequise) return "confiant";
  return "incertain";
}
