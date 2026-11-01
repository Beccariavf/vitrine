import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Entry } from "../types.ts";
import { canonicalUrl, hashId } from "../normalize.ts";
import { toPlainText, toSummary } from "../summary.ts";
import { toIsoUtc } from "./cnil.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "arcom";

/** Flux des communiqués de presse de l'Arcom. */
export const FEED_URL = "https://www.arcom.fr/rss/presse";

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

const TRUSTED_HOSTS = new Set(["www.arcom.fr", "arcom.fr"]);

function assertTrustedLink(link: string, index: number): void {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new Error(`ARCOM feed item #${index} has an unparsable link: ${link}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`ARCOM feed item #${index} link is not https: ${link}`);
  }
  if (!TRUSTED_HOSTS.has(parsed.hostname)) {
    throw new Error(`ARCOM feed item #${index} link leaves arcom.fr: ${link}`);
  }
}

const DSA_MARKERS = [
  /r[eè]glement sur les services num[eé]riques/i,
  /\bRSN\b/i,
  /\bDSA\b/i,
  /2022\/2065/,
  /Digital Services Act/i,
];

/** Transforme le flux presse en entrées françaises ; la page décidera du DSA. */
export function parseFeed(xml: string): Entry[] {
  const validity = XMLValidator.validate(xml);
  if (validity !== true) {
    throw new Error(`ARCOM feed is not valid XML: ${validity.err.msg}`);
  }

  const document = parser.parse(xml) as unknown;
  const root = isObject(document) ? document["rss"] : undefined;
  const channel = isObject(root) ? root["channel"] : undefined;
  if (!isObject(channel)) {
    throw new Error("ARCOM feed has no <rss><channel> root");
  }

  const rawItems = channel["item"];
  const items = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];

  const entries: Entry[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (!isObject(item)) {
      throw new Error(`ARCOM feed item #${index} is not an element`);
    }

    const title = textOf(item["title"]);
    if (title === null || title === "") {
      throw new Error(`ARCOM feed item #${index} has no title`);
    }

    const link = textOf(item["link"]);
    if (link === null || link === "") {
      throw new Error(`ARCOM feed item #${index} has no link`);
    }
    assertTrustedLink(link, index);

    const parsed = new URL(link);
    if (parsed.pathname.startsWith("/en/")) return;

    const url = canonicalUrl(link);
    if (seen.has(url)) return;
    seen.add(url);

    entries.push({
      id: hashId(url),
      title,
      officialTitle: title,
      url,
      publishedAt: toIsoUtc(textOf(item["pubDate"])),
      summary: null,
      references: [],
      themes: [],
      source: SOURCE_ID,
    });
  });

  return entries;
}

/** Lit la page article : le flux n'a pas de description et ne dit pas si le texte relève du DSA. */
export const PAGE = {
  url(entry: Entry): string {
    return entry.url;
  },
  parse(html: string): { summary: string | null; keep: boolean } {
    const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html;
    const text = toPlainText(main);
    const keep = DSA_MARKERS.some((marker) => marker.test(text));
    const paragraphs = [...main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) =>
      toPlainText(match[1] ?? ""),
    );
    const relevant = paragraphs.find((paragraph) =>
      DSA_MARKERS.some((marker) => marker.test(paragraph)),
    );

    return { summary: toSummary(relevant ?? null), keep };
  },
};
