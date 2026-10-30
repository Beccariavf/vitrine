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
const TAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*\b[^>]*>/g;

/** Entités nommées reconnues sans dépendance ; le reste du HTML n'est pas nécessaire ici. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  rsquo: "\u2019",
  lsquo: "\u2018",
  ldquo: "\u201c",
  rdquo: "\u201d",
  laquo: "\u00ab",
  raquo: "\u00bb",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  middot: "\u00b7",
  bull: "\u2022",
  deg: "\u00b0",
  euro: "\u20ac",
  times: "\u00d7",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  eacute: "\u00e9",
  egrave: "\u00e8",
  agrave: "\u00e0",
  ccedil: "\u00e7",
  ugrave: "\u00f9",
  ecirc: "\u00ea",
  acirc: "\u00e2",
  icirc: "\u00ee",
  ocirc: "\u00f4",
  ucirc: "\u00fb",
  euml: "\u00eb",
  iuml: "\u00ef",
  uuml: "\u00fc",
  oelig: "\u0153",
  aelig: "\u00e6",
  Eacute: "\u00c9",
  Agrave: "\u00c0",
  Ccedil: "\u00c7",
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

/**
 * Coupe à la dernière frontière de mot des 199 premiers points de code, sinon à 199.
 * Compter des points de code évite de trancher un emoji en deux.
 */
function truncate(text: string): string {
  const chars = Array.from(text);
  const head = chars.slice(0, SUMMARY_MAX_LENGTH - 1).join("");
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
  return Array.from(cleaned).length > SUMMARY_MAX_LENGTH ? truncate(cleaned) : cleaned;
}
