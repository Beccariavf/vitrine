import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Entry } from "../types.ts";
import { canonicalUrl, hashId } from "../normalize.ts";
import { toSummary } from "../summary.ts";
import { toIsoUtc } from "./cnil.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "cepd";

/** Flux d'actualités du Comité européen de la protection des données. */
export const FEED_URL = "https://www.edpb.europa.eu/feed/news_fr";

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

const TRUSTED_HOSTS = new Set(["www.edpb.europa.eu", "edpb.europa.eu"]);

function assertTrustedLink(link: string, index: number): void {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new Error(`CEPD feed item #${index} has an unparsable link: ${link}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`CEPD feed item #${index} link is not https: ${link}`);
  }
  if (!TRUSTED_HOSTS.has(parsed.hostname)) {
    throw new Error(`CEPD feed item #${index} link leaves edpb.europa.eu: ${link}`);
  }
}

/** Transforme le flux CEPD en entrées normalisées. */
export function parseFeed(xml: string): Entry[] {
  const validity = XMLValidator.validate(xml);
  if (validity !== true) {
    throw new Error(`CEPD feed is not valid XML: ${validity.err.msg}`);
  }

  const document = parser.parse(xml) as unknown;
  const root = isObject(document) ? document["rss"] : undefined;
  const channel = isObject(root) ? root["channel"] : undefined;
  if (!isObject(channel)) {
    throw new Error("CEPD feed has no <rss><channel> root");
  }

  const rawItems = channel["item"];
  const items = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
  if (items.length === 0) {
    throw new Error("CEPD feed has no item");
  }

  const entries: Entry[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (!isObject(item)) {
      throw new Error(`CEPD feed item #${index} is not an element`);
    }

    const title = textOf(item["title"]);
    if (title === null || title === "") {
      throw new Error(`CEPD feed item #${index} has no title`);
    }

    const link = textOf(item["link"]);
    if (link === null || link === "") {
      throw new Error(`CEPD feed item #${index} has no link`);
    }
    assertTrustedLink(link, index);

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
