import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Entry } from "../types.ts";
import { canonicalUrl, hashId } from "../normalize.ts";

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

/** Extrait le texte d'un nœud, qu'il soit simple, typé ou porteur d'attributs. */
function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (isObject(value) && typeof value["#text"] === "string") return value["#text"].trim();
  return null;
}

/** Convertit un `pubDate` RFC 822 en ISO 8601 UTC ; `null` si absent ou illisible. */
export function toIsoUtc(test: string | null): string | null {
  if (test === null) return null;
  const trimmed = test.trim();
  if (trimmed === "") return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
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

    // Deux items de même URL canonique désignent la même actualité : le premier gagne.
    const url = canonicalUrl(link);
    if (seen.has(url)) return;
    seen.add(url);

    entries.push({
      id: hashId(url),
      title,
      url,
      publishedAt: toIsoUtc(textOf(item["pubDate"])),
      source: SOURCE_ID,
    });
  });

  return entries;
}
