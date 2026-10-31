import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Entry } from "../types.ts";
import { canonicalUrl, hashId } from "../normalize.ts";
import { toSummary } from "../summary.ts";
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
