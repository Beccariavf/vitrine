import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Entry } from "../types.ts";
import { canonicalUrl, hashId } from "../normalize.ts";
import { decodeHtmlEntities, toPlainText, toSummary } from "../summary.ts";
import { toIsoUtc } from "./cnil.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "commission";

/** Flux francophone de la stratégie numérique de la Commission. */
export const FEED_URL = "https://digital-strategy.ec.europa.eu/fr/rss.xml";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

type Unknown = Record<string, unknown>;

function isObject(value: unknown): value is Unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (isObject(value) && typeof value["#text"] === "string") return value["#text"].trim();
  return null;
}

const TRUSTED_HOSTS = new Set(["digital-strategy.ec.europa.eu"]);

/** Un événement ou une consultation n'est pas une publication de veille. */
function isPublication(link: string): boolean {
  return !link.includes("/events/") && !link.includes("/consultations/");
}

function assertTrustedLink(link: string, index: number): void {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new Error(`Commission feed item #${index} has an unparsable link: ${link}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Commission feed item #${index} link is not https: ${link}`);
  }
  if (!TRUSTED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Commission feed item #${index} link leaves digital-strategy.ec.europa.eu: ${link}`);
  }
}

/** Transforme le flux Commission en actualités normalisées. */
export function parseFeed(xml: string): Entry[] {
  const validity = XMLValidator.validate(xml);
  if (validity !== true) {
    throw new Error(`Commission feed is not valid XML: ${validity.err.msg}`);
  }

  const document = parser.parse(xml) as unknown;
  const root = isObject(document) ? document["rss"] : undefined;
  const channel = isObject(root) ? root["channel"] : undefined;
  if (!isObject(channel)) {
    throw new Error("Commission feed has no <rss><channel> root");
  }

  const rawItems = channel["item"];
  const items = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];

  const entries: Entry[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Commission feed item #${index} is not an element`);
    }

    const title = textOf(item["title"]);
    if (title === null || title === "") {
      throw new Error(`Commission feed item #${index} has no title`);
    }

    const link = textOf(item["link"]);
    if (link === null || link === "") {
      throw new Error(`Commission feed item #${index} has no link`);
    }
    assertTrustedLink(link, index);
    if (!isPublication(link)) return;

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
      themes: [],
      source: SOURCE_ID,
    });
  });

  return entries;
}

/** Contenu d'une balise meta, par `name` ou `property`. */
function metaContent(html: string, key: string): string | null {
  const tag = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, "i").exec(html)?.[0];
  if (tag === undefined) return null;
  const content = /content=["']([^"']*)["']/i.exec(tag)?.[1];
  if (content === undefined) return null;
  return decodeHtmlEntities(content).trim();
}

/** Titre officiel de la page : `og:title`, puis `h1`, puis `title` sans le suffixe du site. */
function pageTitle(html: string): string | null {
  const og = metaContent(html, "og:title");
  if (og !== null && og !== "") return og;

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1 !== undefined) {
    const text = toPlainText(h1);
    if (text !== "") return text;
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title === undefined) return null;
  const text = toPlainText(title).split(" | ")[0]?.trim() ?? "";
  return text === "" ? null : text;
}

/**
 * Version française officielle de la page Commission.
 * Le flux reste anglais ; la page `/fr/` fournit le titre, le résumé et l'URL.
 */
export const PAGE = {
  required: false,
  url(entry: Entry): string {
    return entry.url.includes("/en/") ? entry.url.replace("/en/", "/fr/") : entry.url;
  },
  parse(html: string): {
    summary: string | null;
    keep: boolean;
    title?: string;
    localized?: boolean;
  } {
    const lang = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (lang !== "fr") return { summary: null, keep: true };

    const title = pageTitle(html);
    const summary = toSummary(metaContent(html, "description"));
    if (title === null) return { summary, keep: true };

    return { summary, keep: true, title, localized: true };
  },
};
