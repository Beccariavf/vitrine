import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  FEED_URL as CNIL_FEED_URL,
  parseCnilPageReferences,
  parseFeed as parseCnilFeed,
} from "./sources/cnil.ts";
import { FEED_URL as CJEU_FEED_URL, parseFeed as parseCjeuFeed } from "./sources/cjeu.ts";
import { matchesActiveTags, readTags } from "./tags.ts";
import type { Tag } from "./tags.ts";
import type { Entry } from "./types.ts";
import { pruneSourceEntries, writeEntries, writeRaw } from "./write.ts";

/** Ce que `run` attend d'un `fetch` : le minimum, injectable en test. */
export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** Une source : son identité, son flux et le parseur qui produit ses entrées. */
export type Source = {
  id: string;
  feedUrl: string;
  parse(xml: string, tags: Tag[]): Entry[];
  /** Enrichissement optionnel depuis la page officielle de chaque entrée. */
  references?: {
    pageUrl(entry: Entry): string;
    parsePage(html: string): string[];
  };
};

export const SOURCES: Source[] = [
  {
    id: "cnil",
    feedUrl: CNIL_FEED_URL,
    parse: (xml) => parseCnilFeed(xml),
    references: {
      pageUrl: (entry) => entry.url,
      parsePage: parseCnilPageReferences,
    },
  },
  {
    id: "cjeu",
    feedUrl: CJEU_FEED_URL,
    parse: (xml, tags) => parseCjeuFeed(xml, tags),
  },
];

export type RunOptions = {
  fetchImpl: FetchLike;
  /** Racine du dépôt : `data/` est écrit en dessous. */
  rootDir: string;
  /** Sources à exécuter ; les deux par défaut. */
  sources?: Source[];
  /** Catalogue déjà chargé, utile aux tests hors d'un dépôt complet. */
  tags?: Tag[];
};

export type SourceRun = {
  source: string;
  rawPath: string;
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

function fetchPage(fetchImpl: FetchLike, url: string, source: string): Promise<string> {
  return fetchText(fetchImpl, url, `${source} page`);
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
  tags,
}: RunOptions): Promise<RunResult> {
  const needsTags = sources.some((source) => source.id === "cjeu");
  const topicTags = tags ?? (needsTags ? readTags(rootDir) : []);

  const results: SourceRun[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const source of sources) {
    try {
      const xml = await fetchFeed(fetchImpl, source.feedUrl, source.id);
      const rawPath = writeRaw(rootDir, xml);
      let entries = source.parse(xml, topicTags);
      const pagePaths: string[] = [];

      if (source.references) {
        const enriched: Entry[] = [];

        for (const entry of entries) {
          const url = source.references.pageUrl(entry);
          let references: string[] = [];
          let html: string | null = null;

          try {
            html = await fetchPage(fetchImpl, url, source.id);
            references = source.references.parsePage(html);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            warnings.push(`${source.id} page ${url}: ${reason}`);
            html = null;
          }

          if (html !== null && references.length > 0) {
            pagePaths.push(writeRaw(rootDir, html, "html"));
          }

          enriched.push({ ...entry, references });
        }

        entries = enriched;
      }

      const entryPaths = writeEntries(rootDir, entries);

      if (source.id === "cjeu") {
        pruneSourceEntries(rootDir, source.id, (entry) =>
          matchesActiveTags(entry.officialTitle, topicTags),
        );
      }

      results.push({ source: source.id, rawPath, pagePaths, entryPaths });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push(`${source.id}: ${reason}`);
    }
  }

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
const cliFetch: FetchLike = (url) =>
  fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": USER_AGENT },
  });

const calledDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (calledDirectly) {
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
