import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Entry } from "../types.ts";
import { canonicalUrl, hashId } from "../normalize.ts";
import { extractCnilReferences } from "../references.ts";
import { toPlainText, toSummary } from "../summary.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "cnil";

/** URL du flux officiel, en un seul endroit : la réparer ne touche qu'ici. */
export const FEED_URL = "https://www.cnil.fr/fr/rss.xml";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  // Un titre "2026" ou "true" reste du texte : aucune conversion implicite.
  parseTagValue: false,
  parseAttributeValue: false,
});

type Unknown = Record<string, unknown>;

function isObject(value: unknown): value is Unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Extrait le texte d'un nœud, qu'il soit simple ou porteur d'attributs. */
function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (isObject(value) && typeof value["#text"] === "string") return value["#text"].trim();
  return null;
}

/**
 * RFC 822 avec offset explicite (`+0100`, `GMT`, `UT`) : sans fuseau, une date
 * serait interprétée dans le fuseau de la machine, donc instable.
 */
const RFC_822_WITH_OFFSET =
  /^(?:[A-Z][a-z]{2},\s*)?\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(?:\d{4}|\d{2})\s+\d{2}:\d{2}(?::\d{2})?\s+(?:GMT|UT|[+-]\d{4})$/;

/** Convertit un `pubDate` RFC 822 en ISO 8601 UTC ; `null` si absent ou illisible. */
export function toIsoUtc(test: string | null): string | null {
  if (test === null) return null;
  const trimmed = test.trim();
  if (!RFC_822_WITH_OFFSET.test(trimmed)) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

const TRUSTED_HOSTS = new Set(["www.cnil.fr", "cnil.fr"]);

/** Un lien qui sort du domaine officiel n'est pas une actualité CNIL. */
function assertTrustedLink(link: string, index: number): void {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new Error(`CNIL feed item #${index} has an unparsable link: ${link}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`CNIL feed item #${index} link is not https: ${link}`);
  }
  if (!TRUSTED_HOSTS.has(parsed.hostname)) {
    throw new Error(`CNIL feed item #${index} link leaves cnil.fr: ${link}`);
  }
}

/**
 * Bloc CNIL : la classe extérieure exacte, son contenu et la paire `</div></div>`
 * qui ferme le wrapper puis le bloc. Un simple préfixe matcherait `-contenu` et
 * `-lien`, d'où l'ancrage sur la classe complète.
 */
const SECTION_BLOCK =
  /<div[^>]*class=['"]ctn-gen-textes-references['"][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;

/**
 * Lit les références de la section « Textes de référence » d'une page CNIL.
 * Une page sans section, ou sans texte reconnu, rend `[]` sans lever.
 */
export function parseCnilPageReferences(html: string): string[] {
  const items: string[] = [];

  for (const block of html.matchAll(SECTION_BLOCK)) {
    const body = block[1] ?? "";
    const heading = toPlainText(body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
    if (!/^Textes?\s+de\s+références?$/i.test(heading)) continue;

    for (const item of body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = toPlainText(item[1] ?? "");
      if (text !== "") items.push(text);
    }
  }

  return extractCnilReferences(items);
}

/**
 * Transforme le XML du flux CNIL en entrées normalisées.
 * Un XML illisible lève une exception : aucun résultat partiel n'est produit.
 */
export function parseFeed(xml: string): Entry[] {
  const validity = XMLValidator.validate(xml);
  if (validity !== true) {
    throw new Error(`CNIL feed is not valid XML: ${validity.err.msg}`);
  }

  const document = parser.parse(xml) as unknown;
  const root = isObject(document) ? document["rss"] : undefined;
  const channel = isObject(root) ? root["channel"] : undefined;
  if (!isObject(channel)) {
    throw new Error("CNIL feed has no <rss><channel> root");
  }

  const rawItems = channel["item"];
  const items = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];

  const entries: Entry[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (!isObject(item)) {
      throw new Error(`CNIL feed item #${index} is not an element`);
    }

    const title = textOf(item["title"]);
    if (title === null || title === "") {
      throw new Error(`CNIL feed item #${index} has no title`);
    }

    const link = textOf(item["link"]);
    if (link === null || link === "") {
      throw new Error(`CNIL feed item #${index} has no link`);
    }
    assertTrustedLink(link, index);

    // Deux items de même URL canonique désignent la même actualité : le premier gagne.
    const url = canonicalUrl(link);
    if (seen.has(url)) return;
    seen.add(url);

    entries.push({
      id: hashId(url),
      title,
      officialTitle: title,
      url,
      publishedAt: toIsoUtc(textOf(item["pubDate"])),
      summary: toSummary(textOf(item["description"])),
      references: [],
      source: SOURCE_ID,
    });
  });

  return entries;
}
