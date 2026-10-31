import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  FEED_URL as CNIL_FEED_URL,
  parseCnilPageReferences,
  parseFeed as parseCnilFeed,
} from "./sources/cnil.ts";
import { FEED_URL as CJEU_FEED_URL, parseFeed as parseCjeuFeed } from "./sources/cjeu.ts";
import { FEED_URL as ANSSI_FEED_URL, parseFeed as parseAnssiFeed } from "./sources/anssi.ts";
import { FEED_URL as CEPD_FEED_URL, parseFeed as parseCepdFeed } from "./sources/cepd.ts";
import { FEED_URL as ARCEP_FEED_URL, parseFeed as parseArcepFeed } from "./sources/arcep.ts";
import { FEED_URL as COMMISSION_FEED_URL, parseFeed as parseCommissionFeed } from "./sources/commission.ts";
import { FEED_URL as COMMISSION_DMA_FEED_URL, parseFeed as parseCommissionDmaFeed } from "./sources/commission-dma.ts";
import { fetchEntries as fetchCetatEntries } from "./sources/cetat.ts";
import { fetchEntries as fetchJudilibreEntries } from "./sources/judilibre.ts";
import { flushUsage } from "./piste.ts";
import { assignThemes, readThemes } from "./themes.ts";
import type { Theme } from "./themes.ts";
import type { Entry } from "./types.ts";
import { readEntryById, writeEntries, writeRaw } from "./write.ts";
import type { FetchLike } from "./fetch.ts";

export type { FetchLike } from "./fetch.ts";

/** Une source à flux : son identité, son flux et le parseur qui produit ses entrées. */
export type Source = {
  kind: "rss";
  id: string;
  feedUrl: string;
  parse(xml: string): Entry[];
  /** Enrichissement optionnel depuis la page officielle de chaque entrée. */
  references?: {
    pageUrl(entry: Entry): string;
    parsePage(html: string): string[];
  };
};

/** Ce qu'une source API rend : ses réponses brutes, ses entrées et ses avertissements. */
export type ApiResult = {
  raw: string[];
  entries: Entry[];
  warnings: string[];
};

export type ApiContext = {
  fetchImpl: FetchLike;
  themes: Theme[];
  now?: Date;
};

/** Une source API : elle interroge un service et rend des entrées normalisées. */
export type ApiSource = {
  kind: "api";
  id: string;
  fetchEntries(context: ApiContext): Promise<ApiResult>;
};

export type AnySource = Source | ApiSource;

export const SOURCES: AnySource[] = [
  {
    kind: "rss",
    id: "cnil",
    feedUrl: CNIL_FEED_URL,
    parse: (xml) => parseCnilFeed(xml),
    references: {
      pageUrl: (entry) => entry.url,
      parsePage: parseCnilPageReferences,
    },
  },
  {
    kind: "rss",
    id: "cjeu",
    feedUrl: CJEU_FEED_URL,
    parse: (xml) => parseCjeuFeed(xml),
  },
  {
    kind: "rss",
    id: "anssi",
    feedUrl: ANSSI_FEED_URL,
    parse: (xml) => parseAnssiFeed(xml),
  },
  {
    kind: "rss",
    id: "cepd",
    feedUrl: CEPD_FEED_URL,
    parse: (xml) => parseCepdFeed(xml),
  },
  {
    kind: "rss",
    id: "arcep",
    feedUrl: ARCEP_FEED_URL,
    parse: (xml) => parseArcepFeed(xml),
  },
  {
    kind: "rss",
    id: "commission",
    feedUrl: COMMISSION_FEED_URL,
    parse: (xml) => parseCommissionFeed(xml),
  },
  {
    kind: "rss",
    id: "commission-dma",
    feedUrl: COMMISSION_DMA_FEED_URL,
    parse: (xml) => parseCommissionDmaFeed(xml),
  },
  {
    kind: "api",
    id: "cetat",
    fetchEntries: (context) => fetchCetatEntries(context),
  },
  {
    kind: "api",
    id: "judilibre",
    fetchEntries: (context) => fetchJudilibreEntries(context),
  },
];

export type RunOptions = {
  fetchImpl: FetchLike;
  /** Racine du dépôt : `data/` est écrit en dessous. */
  rootDir: string;
  /** Sources à exécuter ; toutes par défaut. */
  sources?: AnySource[];
  /** Catalogue déjà chargé, utile aux tests hors d'un dépôt complet. */
  themes?: Theme[];
};

export type SourceRun = {
  source: string;
  /** Première réponse brute ; conservée pour les flux. */
  rawPath: string;
  rawPaths: string[];
  pagePaths: string[];
  entryPaths: string[];
};

export type RunResult = {
  sources: SourceRun[];
  entryPaths: string[];
  warnings: string[];
};

/** Récupère un texte ; une panne réseau est reformulée avec le libellé et l'URL. */
async function fetchText(
  fetchImpl: FetchLike,
  url: string,
  label: string,
): Promise<string> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} fetch failed for ${url}: ${reason}`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`${label} unavailable: HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

function fetchFeed(fetchImpl: FetchLike, url: string, source: string): Promise<string> {
  return fetchText(fetchImpl, url, `${source} feed`);
}

/** Lit une page ; le message reste la raison seule, l'appelant ajoute la source et l'URL. */
async function fetchPage(fetchImpl: FetchLike, url: string): Promise<string> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error), { cause: error });
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

/**
 * Une passe complète : chaque source est lue, snapshotée puis parsée.
 * Une source en panne n'empêche pas les autres d'écrire, mais la passe échoue
 * avec un message qui nomme la source.
 */
export async function run({
  fetchImpl,
  rootDir,
  sources = SOURCES,
  themes,
}: RunOptions): Promise<RunResult> {
  const catalog = themes ?? readThemes(rootDir);

  const results: SourceRun[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const source of sources) {
    try {
      if (source.kind === "api") {
        const result = await source.fetchEntries({ fetchImpl, themes: catalog });
        warnings.push(...result.warnings);
        const rawPaths = result.raw.map((body) => writeRaw(rootDir, body, "json"));
        const entryPaths = writeEntries(rootDir, assignThemes(result.entries, catalog));
        results.push({
          source: source.id,
          rawPath: rawPaths[0] ?? "",
          rawPaths,
          pagePaths: [],
          entryPaths,
        });
        continue;
      }

      const xml = await fetchFeed(fetchImpl, source.feedUrl, source.id);
      const rawPath = writeRaw(rootDir, xml);
      let entries = source.parse(xml);
      const pagePaths: string[] = [];

      if (source.references) {
        const enriched: Entry[] = [];

        for (const entry of entries) {
          const url = source.references.pageUrl(entry);
          const previous = readEntryById(rootDir, entry.id);
          let references: string[] = [];
          let html: string | null = null;

          try {
            html = await fetchPage(fetchImpl, url);
            references = source.references.parsePage(html);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            warnings.push(`${source.id} page ${url}: ${reason}`);
            html = null;
          }

          const unchanged =
            previous !== null &&
            JSON.stringify(previous.references) === JSON.stringify(references);

          if (html !== null && references.length > 0 && !unchanged) {
            pagePaths.push(writeRaw(rootDir, html, "html"));
          }

          enriched.push({ ...entry, references });
        }

        entries = enriched;
      }

      const entryPaths = writeEntries(rootDir, assignThemes(entries, catalog));

      results.push({ source: source.id, rawPath, rawPaths: [rawPath], pagePaths, entryPaths });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push(`${source.id}: ${reason}`);
    }
  }

  flushUsage(rootDir);

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return {
    sources: results,
    entryPaths: results.flatMap((result) => result.entryPaths),
    warnings,
  };
}

const USER_AGENT = "vitrine-veille/0.1 (+https://github.com/Beccariavf/vitrine)";

/** Le vrai réseau, borné dans le temps et identifié auprès de la source. */
const cliFetch: FetchLike = (url, init = {}) =>
  fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": USER_AGENT, ...init.headers },
  });

const calledDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (calledDirectly) {
  try {
    process.loadEnvFile(resolve(process.cwd(), ".env"));
  } catch {
    // Pas de `.env` : les secrets peuvent venir de l'environnement.
  }

  run({ fetchImpl: cliFetch, rootDir: process.cwd() })
    .then(({ sources, entryPaths, warnings }) => {
      for (const warning of warnings) console.warn(`warning: ${warning}`);

      for (const source of sources) {
        console.log(`${source.source} snapshot: ${source.rawPath}`);
        if (source.pagePaths.length > 0) {
          console.log(`${source.source} pages: ${source.pagePaths.length}`);
        }
        console.log(`${source.source} entries: ${source.entryPaths.length}`);
      }
      console.log(`entries: ${entryPaths.length}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
