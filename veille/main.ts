import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FEED_URL, parseFeed } from "./sources/cnil.ts";
import { writeEntries, writeRaw } from "./write.ts";

/** Ce que `run` attend d'un `fetch` : le minimum, injectable en test. */
export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export type RunOptions = {
  fetchImpl: FetchLike;
  /** Racine du dépôt : `data/` est écrit en dessous. */
  rootDir: string;
};

export type RunResult = {
  rawPath: string;
  entryPaths: string[];
};

/** Récupère le flux ; une panne réseau est reformulée avec l'URL et sa cause. */
async function fetchFeed(fetchImpl: FetchLike): Promise<string> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(FEED_URL);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`CNIL feed fetch failed for ${FEED_URL}: ${reason}`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`CNIL feed unavailable: HTTP ${response.status} for ${FEED_URL}`);
  }

  return response.text();
}

/**
 * Une passe complète : récupérer, parser, écrire.
 * Le parse précède les écritures : une source illisible n'écrit aucun fichier.
 */
export async function run({ fetchImpl, rootDir }: RunOptions): Promise<RunResult> {
  const xml = await fetchFeed(fetchImpl);
  const entries = parseFeed(xml);

  return {
    rawPath: writeRaw(rootDir, xml),
    entryPaths: writeEntries(rootDir, entries),
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
    .then(({ rawPath, entryPaths }) => {
      console.log(`snapshot: ${rawPath}`);
      console.log(`entries: ${entryPaths.length}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
