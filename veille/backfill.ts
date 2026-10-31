import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assignThemes, readThemes } from "./themes.ts";
import type { Entry } from "./types.ts";
import { writeEntries } from "./write.ts";

type StoredEntry = Omit<Entry, "themes"> & { themes?: string[] };

/** Liste récursivement les fichiers `.json` sous `dir`. */
function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) files.push(...listJsonFiles(path));
    else if (item.isFile() && item.name.endsWith(".json")) files.push(path);
  }
  return files;
}

/**
 * Recalcule les matières de toutes les entrées déjà écrites. Utile après une
 * évolution du contrat : `data/` n'est jamais édité à la main.
 */
export function backfill(rootDir: string = process.cwd()): number {
  const themes = readThemes(rootDir);
  const entriesDir = join(rootDir, "data", "entries");
  const entries = listJsonFiles(entriesDir).map((path) => {
    const stored = JSON.parse(readFileSync(path, "utf8")) as StoredEntry;
    return { ...stored, themes: stored.themes ?? [] } as Entry;
  });

  const assigned = assignThemes(entries, themes);
  writeEntries(rootDir, assigned);
  return assigned.length;
}

const calledDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (calledDirectly) {
  try {
    const count = backfill(process.cwd());
    console.log(`themes: ${count} entries`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
