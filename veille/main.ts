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

/**
 * Une passe complète : récupérer, parser, écrire.
 * Le parse précède les écritures : une source illisible n'écrit aucun fichier.
 */
export async function run({ fetchImpl, rootDir }: RunOptions): Promise<RunResult> {
  const response = await fetchImpl(FEED_URL);
  if (!response.ok) {
    throw new Error(`CNIL feed unavailable: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const entries = parseFeed(xml);

  return {
    rawPath: writeRaw(rootDir, xml),
    entryPaths: writeEntries(rootDir, entries),
  };
}

const calledDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (calledDirectly) {
  run({ fetchImpl: fetch, rootDir: process.cwd() })
    .then(({ rawPath, entryPaths }) => {
      console.log(`snapshot: ${rawPath}`);
      console.log(`entries: ${entryPaths.length}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
