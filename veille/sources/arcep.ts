import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Entry } from "../types.ts";
import { hashFullUrl } from "../normalize.ts";
import { decodeHtmlEntities, toPlainText, toSummary } from "../summary.ts";
import { toIsoUtc } from "./cnil.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "arcep";

/** Flux des avis et décisions de l'Arcep. */
export const FEED_URL =
  "https://www.arcep.fr/actualites/suivre-actualite-regulation-arcep/avis-et-decisions/rss.xml";

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

const TRUSTED_HOSTS = new Set(["www.arcep.fr", "arcep.fr"]);

function assertTrustedLink(link: string, index: number): void {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new Error(`ARCEP feed item #${index} has an unparsable link: ${link}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`ARCEP feed item #${index} link is not https: ${link}`);
  }
  if (!TRUSTED_HOSTS.has(parsed.hostname)) {
    throw new Error(`ARCEP feed item #${index} link leaves arcep.fr: ${link}`);
  }
}

/** Transforme le flux ARCEP en entrées normalisées ; l'identité passe par la query. */
export function parseFeed(xml: string): Entry[] {
  const validity = XMLValidator.validate(xml);
  if (validity !== true) {
    throw new Error(`ARCEP feed is not valid XML: ${validity.err.msg}`);
  }

  const document = parser.parse(xml) as unknown;
  const root = isObject(document) ? document["rss"] : undefined;
  const channel = isObject(root) ? root["channel"] : undefined;
  if (!isObject(channel)) {
    throw new Error("ARCEP feed has no <rss><channel> root");
  }

  const rawItems = channel["item"];
  const items = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];

  const entries: Entry[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (!isObject(item)) {
      throw new Error(`ARCEP feed item #${index} is not an element`);
    }

    const title = textOf(item["title"]);
    if (title === null || title === "") {
      throw new Error(`ARCEP feed item #${index} has no title`);
    }

    const rawLink = textOf(item["link"]);
    if (rawLink === null || rawLink === "") {
      throw new Error(`ARCEP feed item #${index} has no link`);
    }
    const link = decodeHtmlEntities(rawLink).trim();
    assertTrustedLink(link, index);

    if (seen.has(link)) return;
    seen.add(link);

    entries.push({
      id: hashFullUrl(link),
      title: toPlainText(title),
      officialTitle: toPlainText(title),
      url: link,
      publishedAt: toIsoUtc(textOf(item["pubDate"])),
      summary: toSummary(textOf(item["description"])),
      references: [],
      themes: [],
      source: SOURCE_ID,
    });
  });

  return entries;
}
