import type { FetchLike } from "../../veille/fetch.ts";

/** Résout un identifiant CELEX vers son rendu XHTML par la cellule CELLAR. */
const CELLAR = "https://publications.europa.eu/resource/celex";

/**
 * Récupère le rendu XHTML d'un acte depuis CELLAR. CELLAR répond 303 puis 200 :
 * `fetch` suit la redirection par défaut. Sans `Accept-Language`, il répond 400 ;
 * sans `Accept: application/xhtml+xml`, il rend un autre format.
 */
export async function fetchCellar(
  document: string,
  langue: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const reponse = await fetchImpl(`${CELLAR}/${document}`, {
    headers: {
      Accept: "application/xhtml+xml",
      "Accept-Language": langue,
    },
  });
  if (!reponse.ok) {
    throw new Error(`CELLAR ${document} : HTTP ${reponse.status}`);
  }
  return reponse.text();
}
