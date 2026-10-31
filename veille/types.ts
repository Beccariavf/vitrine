/**
 * Contrat de données d'une actualité, tel que le site et le MCP le liront.
 * La forme est volontairement plate : un fichier JSON, aucun couplage au flux source.
 */
export type Entry = {
  /** `sha256` de l'identité canonique de l'URL, tronqué à 16 hex. Stable d'une exécution à l'autre. */
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
};
