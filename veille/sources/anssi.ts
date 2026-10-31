import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Entry } from "../types.ts";
import { canonicalUrl, hashId } from "../normalize.ts";
import { toSummary } from "../summary.ts";
import { toIsoUtc } from "./cnil.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "anssi";

/** Flux « actualité » du CERT-FR, choisi pour rester proche du juridique. */
export const FEED_URL = "https://www.cert.ssi.gouv.fr/actualite/feed/";

/** Fenêtre de veille : au-delà, une actualité n'est plus une nouveauté. */
const WINDOW_DAYS = 90;

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

const TRUSTED_HOSTS = new Set([
  "www.cert.cyber.gouv.fr",
  "cert.cyber.gouv.fr",
  "www.cert.ssi.gouv.fr",
  "cert.ssi.gouv.fr",
]);

function assertTrustedLink(link: string, index: number): void {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new Error(`ANSSI feed item #${index} has an unparsable link: ${link}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`ANSSI feed item #${index} link is not https: ${link}`);
  }
  if (!TRUSTED_HOSTS.has(parsed.hostname)) {
    throw new Error(`ANSSI feed item #${index} link leaves the CERT-FR domain: ${link}`);
  }
}

/**
 * Transforme le flux « actualité » du CERT-FR en entrées normalisées.
 * Le flux est chronologique et couvre plusieurs années : on ne garde que la fenêtre.
 */
export function parseFeed(xml: string, now: Date = new Date()): Entry[] {
  const validity = XMLValidator.validate(xml);
  if (validity !== true) {
    throw new Error(`ANSSI feed is not valid XML: ${validity.err.msg}`);
  }

  const document = parser.parse(xml) as unknown;
  const root = isObject(document) ? document["rss"] : undefined;
  const channel = isObject(root) ? root["channel"] : undefined;
  if (!isObject(channel)) {
    throw new Error("ANSSI feed has no <rss><channel> root");
  }

  const rawItems = channel["item"];
  const items = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
  const threshold = now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const entries: Entry[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (!isObject(item)) {
      throw new Error(`ANSSI feed item #${index} is not an element`);
    }

    const title = textOf(item["title"]);
    if (title === null || title === "") {
      throw new Error(`ANSSI feed item #${index} has no title`);
    }

    const link = textOf(item["link"]);
    if (link === null || link === "") {
      throw new Error(`ANSSI feed item #${index} has no link`);
    }
    assertTrustedLink(link, index);

    const url = canonicalUrl(link);
    if (seen.has(url)) return;

    const publishedAt = toIsoUtc(textOf(item["pubDate"]));
    if (publishedAt !== null && Date.parse(publishedAt) < threshold) return;

    seen.add(url);
    entries.push({
      id: hashId(url),
      title,
      officialTitle: title,
      url,
      publishedAt,
      summary: toSummary(textOf(item["description"])),
      references: [],
      themes: [],
      source: SOURCE_ID,
    });
  });

  return entries;
}
