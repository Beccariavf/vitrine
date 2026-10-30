import { createHash } from "node:crypto";

/**
 * Réduit une URL à sa forme canonique : hôte en minuscules, sans query, sans
 * fragment, sans slash final. Deux écritures d'une même page donnent la même
 * chaîne, donc le même identifiant.
 */
export function canonicalUrl(url: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.host}${path}`;
}

/** Identifiant stable d'une actualité : `sha256` de son URL canonique, 16 hex. */
export function hashId(url: string): string {
  return createHash("sha256").update(canonicalUrl(url), "utf8").digest("hex").slice(0, 16);
}
