import { createHash } from "node:crypto";

/**
 * Analyse une URL et refuse tout schéma autre que `http:` ou `https:` : l'URL
 * d'une entrée devient un `href` du site, un `javascript:` y serait exécuté.
 */
function webUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`URL refusée, schéma ${parsed.protocol} ni http ni https : ${url}`);
  }
  return parsed;
}

/**
 * Réduit une URL à sa forme canonique : hôte en minuscules, sans query, sans
 * fragment, sans slash final. Deux écritures d'une même page donnent la même
 * chaîne, donc le même identifiant.
 */
export function canonicalUrl(url: string): string {
  const parsed = webUrl(url);
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.host}${path}`;
}

/** Identifiant stable d'une actualité : `sha256` de son URL canonique, 16 hex. */
export function hashId(url: string): string {
  return createHash("sha256").update(canonicalUrl(url), "utf8").digest("hex").slice(0, 16);
}

/**
 * Identifiant d'une URL dont la query porte l'identité (CELEX EUR-Lex) :
 * `canonicalUrl` supprimerait la query et donnerait le même id à tous les arrêts.
 */
export function hashFullUrl(url: string): string {
  webUrl(url);
  return createHash("sha256").update(url, "utf8").digest("hex").slice(0, 16);
}
