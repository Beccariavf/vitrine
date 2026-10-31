import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Entry } from "../types.ts";
import { hashFullUrl } from "../normalize.ts";
import { extractReferences } from "../references.ts";
import { decodeHtmlEntities, toSummary } from "../summary.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "cjeu";

/** Flux public de jurisprudence CJUE : pas de compte, pas de PISTE. */
export const FEED_URL = "https://eur-lex.europa.eu/FR/display-feed.rss?rssId=163";

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

/** Espaces insécables et espaces multiples ramenés à une forme parseable. */
function normalize(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

const MONTHS: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
};

/** Date de décision française du titre, à midi UTC ; `null` si absente. */
export function parseDecisionDate(text: string): string | null {
  const normalized = normalize(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const match = normalized.match(/(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/);
  if (match === null) return null;

  const day = Number(match[1]);
  const month = MONTHS[match[2] ?? ""];
  const year = Number(match[3]);
  if (month === undefined || !Number.isInteger(day) || !Number.isInteger(year)) return null;
  return new Date(Date.UTC(year, month, day, 12)).toISOString();
}

const MONTHS_EN: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** `pubDate` de publication, ramené au jour calendaire à midi UTC. */
export function parsePublicationDate(text: string | null): string | null {
  if (text === null) return null;
  const match = normalize(text).match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
  if (match === null) return null;

  const day = Number(match[1]);
  const month = MONTHS_EN[(match[2] ?? "").toLowerCase()];
  const year = Number(match[3]);
  if (month === undefined || !Number.isInteger(day) || !Number.isInteger(year)) return null;
  return new Date(Date.UTC(year, month, day, 12)).toISOString();
}

/**
 * Sépare le titre d'affichage du sujet officiel.
 * Deux formats coexistent dans le flux : `#` et « Affaire … [sujet] ».
 */
export function parseCaseTitle(official: string): { title: string; summary: string | null } {
  const text = normalize(official);

  if (text.includes("#")) {
    const parts = text
      .split("#")
      .map((part) => part.trim())
      .filter(Boolean);
    const [part0, part1, part2, part3] = parts;
    if (part0 !== undefined && part1 !== undefined) {
      const caseNumber = part3?.match(/C-\d+\/\d+/)?.[0];
      const suffix = caseNumber === undefined ? "" : ` (${caseNumber})`;
      return { title: `${part1}${suffix} — ${part0}`, summary: part2 ?? null };
    }
  }

  const bracket = text.match(/^Affaire\s+(C-\d+\/\d+),\s*([^:]+):\s*([\s\S]*)$/);
  if (bracket !== null) {
    const [, caseNumber, caseName, rest] = bracket;
    const open = rest?.indexOf("[") ?? -1;
    const close = rest?.lastIndexOf("]") ?? -1;
    if (open !== -1 && close > open) {
      const before = (rest ?? "").slice(0, open).trim();
      const subject = (rest ?? "").slice(open + 1, close).trim();
      const cut = before.lastIndexOf(" – ");
      const type = cut === -1 ? before : before.slice(0, cut).trim();
      return {
        title: `${caseName?.trim() ?? ""} (${caseNumber ?? ""}) — ${type}`,
        summary: subject === "" ? null : subject,
      };
    }
  }

  return { title: text, summary: null };
}

/**
 * Transforme le flux CJUE en entrées normalisées.
 * Le filtre par matière est appliqué après le parse, sur le titre officiel complet.
 */
export function parseFeed(xml: string): Entry[] {
  const validity = XMLValidator.validate(xml);
  if (validity !== true) {
    throw new Error(`CJUE feed is not valid XML: ${validity.err.msg}`);
  }

  const document = parser.parse(xml) as unknown;
  const root = isObject(document) ? document["rss"] : undefined;
  const channel = isObject(root) ? root["channel"] : undefined;
  if (!isObject(channel)) {
    throw new Error("CJUE feed has no <rss><channel> root");
  }

  const rawItems = channel["item"];
  const items = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
  if (items.length === 0) {
    throw new Error("CJUE feed has no item");
  }

  const byCelex = new Map<string, { entry: Entry; rank: number }>();

  items.forEach((item, index) => {
    if (!isObject(item)) {
      throw new Error(`CJUE feed item #${index} is not an element`);
    }

    const rawTitle = textOf(item["title"]);
    if (rawTitle === null || rawTitle === "") {
      throw new Error(`CJUE feed item #${index} has no title`);
    }

    const celexMatch = rawTitle.match(/^CELEX:([^:\s]+):\s*/);
    if (celexMatch === null) {
      throw new Error(`CJUE feed item #${index} has no CELEX identifier`);
    }

    const celex = celexMatch[1] ?? "";
    const suffix = celex.match(/_(SUM|RES|INF)$/)?.[1];
    if (suffix === "INF") return;

    const official = decodeHtmlEntities(rawTitle.slice(celexMatch[0].length)).trim();

    const base = celex.replace(/_(SUM|RES|INF)$/, "");
    const url = `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${base}`;
    const { title, summary } = parseCaseTitle(official);
    const publishedAt = parseDecisionDate(official) ?? parsePublicationDate(textOf(item["pubDate"]));

    const entry: Entry = {
      id: hashFullUrl(url),
      title,
      officialTitle: official,
      url,
      publishedAt,
      summary: toSummary(summary),
      references: extractReferences(official),
      themes: [],
      source: SOURCE_ID,
    };

    const rank = suffix === undefined ? 0 : suffix === "RES" ? 1 : 2;
    const existing = byCelex.get(base);
    if (existing === undefined || rank < existing.rank) {
      byCelex.set(base, { entry, rank });
    }
  });

  return [...byCelex.values()].map(({ entry }) => entry);
}
