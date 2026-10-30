/**
 * Contrat de données d'une actualité, tel que le site et le MCP le liront.
 * La forme est volontairement plate : un fichier JSON, aucun couplage au flux source.
 */
export type Entry = {
  /** `sha256` de l'URL canonique, tronqué à 16 hex. Stable d'une exécution à l'autre. */
  id: string;
  /** Titre de l'actualité, tel que publié par la source. */
  title: string;
  /** URL canonique : pas de query, pas de fragment, pas de slash final. */
  url: string;
  /** Publication en ISO 8601 UTC, ou `null` si la source n'en donne pas d'exploitable. */
  publishedAt: string | null;
  /** Identifiant de la source, ici `cnil`. */
  source: string;
};
