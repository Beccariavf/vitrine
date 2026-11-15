/**
 * Marquage des unités du corpus `metadonnees`, appliqué au rendu.
 *
 * Le corpus ne contient que des métadonnées : le serveur ne connaît ni l'arrêt
 * de la CEDH ni la décision du guichet unique qu'il cite, et ne doit jamais le
 * laisser croire. Chaque passage rendu porte donc la phrase ci-dessous, à
 * transmettre telle quelle, et son lien officiel permet d'aller à la source.
 * Le marquage est calculé à la lecture : aucun réindex, aucune écriture.
 */

export const CORPUS_METADONNEES = "metadonnees";

/** Phrase unique du rendu, celle que les descriptions d'outil imposent d'afficher. */
export const AVERTISSEMENT_METADONNEES =
  "métadonnées seulement — contenu non connu du serveur, consulter la source";

/** Vrai pour une unité du corpus de métadonnées, sans lire le disque. */
export function estMetadonnees(corpus: string): boolean {
  return corpus === CORPUS_METADONNEES;
}

/** Ce qu'un passage de métadonnées ajoute à son rendu. */
export type MarquageMetadonnees = {
  metadonnees_seulement: true;
  /** Phrase à afficher avant le reste : le contenu du document n'est pas connu. */
  avertissement_contenu: string;
};

/** Marquage d'un passage du corpus `metadonnees`. */
export const MARQUAGE_METADONNEES: MarquageMetadonnees = {
  metadonnees_seulement: true,
  avertissement_contenu: AVERTISSEMENT_METADONNEES,
};

/** Ajoute le marquage aux passages de métadonnées, laisse les autres intacts. */
export function avecMarquageMetadonnees<T extends { corpus: string }>(
  passages: readonly T[],
): Array<T & Partial<MarquageMetadonnees>> {
  return passages.map((passage) =>
    estMetadonnees(passage.corpus) ? { ...passage, ...MARQUAGE_METADONNEES } : passage,
  );
}
