import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FEED_URL as CNIL_FEED_URL, parseFeed as parseCnilFeed } from "./sources/cnil.ts";
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
};

export const SOURCES: Source[] = [
  {
    id: "cnil",
    feedUrl: CNIL_FEED_URL,
    parse: (xml) => parseCnilFeed(xml),
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
  entryPaths: string[];
};

export type RunResult = {
  sources: SourceRun[];
  entryPaths: string[];
};

/** Récupère un flux ; une panne réseau est reformulée avec la source et l'URL. */
async function fetchFeed(fetchImpl: FetchLike, url: string, source: string): Promise<string> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${source} feed fetch failed for ${url}: ${reason}`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`${source} feed unavailable: HTTP ${response.status} for ${url}`);
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
  tags,
}: RunOptions): Promise<RunResult> {
  const needsTags = sources.some((source) => source.id === "cjeu");
  const topicTags = tags ?? (needsTags ? readTags(rootDir) : []);

  const results: SourceRun[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const xml = await fetchFeed(fetchImpl, source.feedUrl, source.id);
      const rawPath = writeRaw(rootDir, xml);
      const entries = source.parse(xml, topicTags);
      const entryPaths = writeEntries(rootDir, entries);

      if (source.id === "cjeu") {
        pruneSourceEntries(rootDir, source.id, (entry) =>
          matchesActiveTags(entry.officialTitle, topicTags),
        );
      }

      results.push({ source: source.id, rawPath, entryPaths });
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
    .then(({ sources, entryPaths }) => {
      for (const source of sources) {
        console.log(`${source.source} snapshot: ${source.rawPath}`);
        console.log(`${source.source} entries: ${source.entryPaths.length}`);
      }
      console.log(`entries: ${entryPaths.length}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
