/**
 * Résumé d'une actualité : le texte de la source, nettoyé et tronqué.
 * Aucune réécriture, aucun appel réseau : la source dit le texte, ce module le rend lisible.
 */

/** Longueur maximale d'un résumé, ellipse comprise. */
export const SUMMARY_MAX_LENGTH = 200;

/** Espace insécable : rendu comme un espace ordinaire avant la normalisation. */
const NON_BREAKING_SPACE = /\u00a0/g;

/**
 * Balise HTML connue : on ne retire pas n'importe quel `<...>`, sinon une comparaison
 * comme `1 < 2 > 0` serait prise pour une balise et perdrait son texte.
 */
const TAG =
  /<\/?(?:p|br|a|strong|em|b|i|u|s|ul|ol|li|span|div|img|figure|figcaption|blockquote|h[1-6]|table|thead|tbody|tr|th|td|code|pre|sup|sub|hr)\b[^>]*>/gi;

/** Entités nommées reconnues sans dépendance ; le reste du HTML n'est pas nécessaire ici. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

/** Une entité HTML : nommée, décimale (`&#123;`) ou hexadécimale (`&#x1F;`). */
const ENTITY = /&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g;

/** Décode les entités connues ; une entité inconnue ou hors Unicode reste telle quelle. */
function decodeHtmlEntities(text: string): string {
  return text.replace(ENTITY, (match, decimal: string | undefined, hex: string | undefined, named: string | undefined) => {
    if (named !== undefined) return NAMED_ENTITIES[named] ?? match;

    const codePoint = decimal !== undefined ? Number.parseInt(decimal, 10) : Number.parseInt(hex ?? "", 16);
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    return String.fromCodePoint(codePoint);
  });
}

/**
 * Ramène le texte de la source à une ligne propre.
 * L'ordre compte : décoder deux fois neutralise aussi les balises doublement encodées
 * (`&amp;lt;p&amp;gt;`), que retirer les balises avant décodage laisserait passer.
 */
function clean(text: string): string {
  return decodeHtmlEntities(decodeHtmlEntities(text))
    .replace(TAG, " ")
    .replace(NON_BREAKING_SPACE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Coupe à la dernière frontière de mot des 199 premiers caractères, sinon à 199. */
function truncate(text: string): string {
  const head = text.slice(0, SUMMARY_MAX_LENGTH - 1);
  const lastSpace = head.lastIndexOf(" ");
  const cut = lastSpace > 0 ? head.slice(0, lastSpace) : head;
  return `${cut}…`;
}

/**
 * Rend le résumé d'une description de source, ou `null` si elle est absente ou vide.
 * Un texte de 200 caractères ou moins est rendu tel quel, sans ellipse.
 */
export function toSummary(text: string | null): string | null {
  if (text === null) return null;
  const cleaned = clean(text);
  if (cleaned === "") return null;
  return cleaned.length > SUMMARY_MAX_LENGTH ? truncate(cleaned) : cleaned;
}
