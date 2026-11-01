import type { Entry } from "../types.ts";
import type { FetchLike } from "../fetch.ts";
import { extractCetatReferences } from "../references.ts";
import { toSummary } from "../summary.ts";
import type { Theme } from "../themes.ts";
import { activeThemes, followedInstruments, instrumentOf, themeQueries } from "../themes.ts";
import { PisteSession, readPisteConfig } from "../piste.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "cetat";

/** Les décisions administratives sont publiées avec du retard ; 90 jours restent utiles. */
export const WINDOW_DAYS = 90;

/**
 * Appels PISTE réservés aux six recherches Judilibre : CETAT passe avant
 * Judilibre dans la passe, et la lecture de ses textes ne doit pas leur prendre
 * leur part du plafond.
 */
export const JUDILIBRE_SEARCH_RESERVE = 6;

type CetatTitle = { id?: unknown; title?: unknown };
type CetatResult = {
  id?: unknown;
  titles?: unknown;
  resumePrincipal?: unknown;
  text?: unknown;
};

/** Date `JJ/MM/AAAA` du titre, à midi UTC ; `null` si absente ou invalide. */
export function parseCetatDate(title: string): string | null {
  const match = title.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match === null) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString();
}

/** Texte intégral d'une décision, tel que le rend `/consult/juri` ; `""` s'il manque. */
export function decisionText(response: unknown): string {
  if (typeof response !== "object" || response === null) return "";
  const text = (response as { text?: unknown }).text;
  if (typeof text !== "object" || text === null) return "";
  const body = (text as { texte?: unknown }).texte;
  return typeof body === "string" ? body : "";
}

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function firstTitle(value: unknown): CetatTitle | null {
  if (!Array.isArray(value)) return null;
  const first = value[0];
  return typeof first === "object" && first !== null ? (first as CetatTitle) : null;
}

/**
 * Une décision retenue par la recherche : son titre et son résumé, sans
 * référence. Les articles se lisent dans le texte intégral, après le rattachement.
 */
function toEntry(result: CetatResult): Entry | null {
  const title = firstTitle(result.titles);
  const id = typeof title?.id === "string" ? title.id : typeof result.id === "string" ? result.id : null;
  const label = typeof title?.title === "string" ? title.title : null;
  if (id === null || label === null) return null;

  const rawSummary = textArray(result.resumePrincipal)[0] ?? (typeof result.text === "string" ? result.text : null);
  const summary = toSummary(rawSummary);

  return {
    id,
    title: label,
    officialTitle: label,
    url: `https://www.legifrance.gouv.fr/ceta/id/${id}`,
    publishedAt: parseCetatDate(label),
    summary,
    references: [],
    themes: [],
    source: SOURCE_ID,
  };
}

type ApiContext = {
  fetchImpl: FetchLike;
  themes: Theme[];
  now?: Date;
};

type CetatApiResult = {
  raw: string[];
  entries: Entry[];
  warnings: string[];
  enrich?: (entry: Entry) => Promise<string[] | null>;
};

/**
 * Une recherche par matière active sur le fonds CETAT, triée par date. Le texte
 * intégral de chaque décision nouvelle est lu ensuite, décision par décision :
 * la recherche ne porte pas les articles appliqués.
 */
export async function fetchEntries({
  fetchImpl,
  themes,
  now = new Date(),
}: ApiContext): Promise<CetatApiResult> {
  const config = readPisteConfig();
  if (config === null) {
    return {
      raw: [],
      entries: [],
      warnings: ["PISTE configuration missing (PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_KEY_ID); skipping CETAT and Judilibre"],
    };
  }

  const session = new PisteSession(config);
  const raw: string[] = [];
  const warnings: string[] = [];
  const byId = new Map<string, Entry>();
  const cutoff = now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;

  for (const theme of activeThemes(themes)) {
    for (const query of themeQueries(theme)) {
      const body = {
        recherche: {
          champs: [
            {
              typeChamp: "ALL",
              criteres: [{ typeRecherche: "EXACTE", valeur: query, operateur: "ET" }],
              operateur: "ET",
            },
          ],
          filtres: [],
          pageNumber: 1,
          pageSize: 20,
          sort: "DATE_DESC",
          typePagination: "DEFAUT",
        },
        fond: "CETAT",
      };

      const response = await session.legifrance(fetchImpl, body);
      raw.push(JSON.stringify(response, null, 2));

      const results = typeof response === "object" && response !== null && Array.isArray((response as { results?: unknown }).results)
        ? ((response as { results: unknown[] }).results as CetatResult[])
        : [];

      for (const result of results) {
        const entry = toEntry(result);
        if (entry === null) continue;
        if (entry.publishedAt !== null && Date.parse(entry.publishedAt) < cutoff) continue;
        if (!byId.has(entry.id)) byId.set(entry.id, entry);
      }
    }
  }

  return {
    raw,
    entries: [...byId.values()],
    warnings,
    /** Lit le texte d'une décision retenue, sous le budget restant de la passe. */
    async enrich(entry: Entry): Promise<string[] | null> {
      if (session.remainingCalls() <= JUDILIBRE_SEARCH_RESERVE) {
        warnings.push(
          `cetat decision ${entry.id}: PISTE call budget reserved for ${JUDILIBRE_SEARCH_RESERVE} Judilibre searches, entry deferred`,
        );
        return null;
      }

      const response = await session.consultJuri(fetchImpl, entry.id);
      raw.push(JSON.stringify(response, null, 2));

      const instruments = followedInstruments(entry, themes);
      return extractCetatReferences(decisionText(response)).filter((reference) =>
        instruments.has(instrumentOf(reference)),
      );
    },
  };
}
