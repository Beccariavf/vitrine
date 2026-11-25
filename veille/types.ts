/**
 * Contrat de données d'une actualité, tel que le site et le MCP le liront.
 * La forme est volontairement plate : un fichier JSON, aucun couplage au flux source.
 */
export type Entry = {
  /** Identifiant stable, dérivé de l'identité canonique de la source (URL, document). */
  id: string;
  /** Titre d'affichage, tel que publié par la source ou reconstruit depuis son titre officiel. */
  title: string;
  /** Titre officiel complet : source du filtre et des références, jamais réécrit. */
  officialTitle: string;
  /** URL canonique ; selon la source, l'identité peut être portée par la query (CELEX). */
  url: string;
  /** Publication en ISO 8601 UTC, ou `null` si la source n'en donne pas d'exploitable. */
  publishedAt: string | null;
  /** Début de la description de la source, nettoyé et tronqué à 200 caractères ; `null` si vide. */
  summary: string | null;
  /** Références principales citées par le titre officiel (CJUE) ou la page liée (CNIL) ; tableau vide si aucune. */
  references: string[];
  /** Matières auxquelles l'entrée appartient, calculées à l'ingestion ; au moins une. */
  themes: string[];
  /** Identifiant de la source : `cnil`, `cjeu`, etc. */
  source: string;
  /** Document du corpus visé, quand la source en désigne un (`legi` : `LEGITEXT…`, `constit` : `CONSTEXT…`, `cepd` : slug). */
  document?: string;
  /**
   * Version publiée (`LEGIARTI…`, `LEGITEXT…_JJ-MM-AAAA`, consolidation CELEX) ou
   * signature CEPD (`2.0`, sinon `finale`/`projet`) ; `legi`, `eurlex` et `cepd`.
   * Pour `preparation`, le statut atteint (`PROP_ADOPTED`, `CJ`…), comparé au
   * statut de l'unité du corpus pour savoir si la synchronisation doit suivre.
   */
  version?: string;
  /** Nature de la nouveauté détectée ; `eurlex` seulement. */
  categorie?: "consolidation" | "adequation" | "clauses_types" | "acte_execution" | "modification";
  /** Date de l'acte, de la consolidation ou de la décision détectée ; `eurlex` et `constit`. */
  date_acte?: string;
  /** Numéro de la décision, tel que la source l'écrit (`2018-765 DC`) ; `constit` seulement. */
  numero?: string;
  /** Nature de la décision (`DC` ou `QPC`) ; `constit` seulement. */
  nature?: string;
  /**
   * Type du document quand la source le distingue : CEPD (`lignes_directrices`,
   * `avis_art64`, `decision_art65`, `recommandation`, `g29_repris`) ou doctrine
   * CNIL (`guide`, `referentiel`, `liste_aipd`, `fiche_ia`, `doctrine_ia`) ;
   * `cepd` et `cnil_doctrine`.
   */
  type?: string;
  /** Vrai quand la version listée est soumise à consultation publique ; `cepd` seulement. */
  consultation?: boolean;
  /** CELEX de la décision abrogée par celle que porte l'entrée ; `eurlex` seulement. */
  abroge?: string;
  /** Nature de la nouveauté détectée (`nouveau`, `modifie`) ; `cnil_doctrine` seulement. */
  motif?: "nouveau" | "modifie";
  /** Libellé CELLAR du dossier avant le changement (`PROP_PENDING`) ; `preparation` seulement. */
  statut_avant?: string;
  /** Statut source après le changement (`PROP_ADOPTED`, `RETIRE`, `PROP_REJECTED`, `CJ`…) ; `preparation` seulement. */
  statut_apres?: string;
  /** CELEX de l'acte adopté membre du dossier ; `preparation` seulement, absent s'il n'est pas identifié. */
  acte_adopte?: string;
  /** CELEX de la décision rendue de même numéro ; `preparation` seulement. */
  decision?: string;
  /** Corpus de textes visé par l'acte adopté ; `preparation` seulement, absent quand il est hors corpus. */
  corpus_vise?: string;
};
