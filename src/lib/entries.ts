import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Entry } from "../../veille/types.ts";

/** Les cinq champs du contrat `veille/types.ts`, dans l'ordre du fichier. */
const FIELDS = ["id", "title", "url", "publishedAt", "source"] as const;

/** Liste récursivement les fichiers `.json` sous `dir`, triés pour être déterministes. */
function listJsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJsonFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

/**
 * Valide la forme d'une entrée et rend une copie typée : seuls les cinq champs
 * du contrat sont retenus. Une entrée qui dévie est une erreur de pipeline, pas
 * une entrée à afficher partiellement.
 */
function parseEntry(text: string, file: string): Entry {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid entry ${file}: not valid JSON (${reason})`, { cause: error });
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid entry ${file}: expected a JSON object`);
  }

  const record = value as Record<string, unknown>;
  for (const field of FIELDS) {
    if (!(field in record)) throw new Error(`Invalid entry ${file}: missing field "${field}"`);
  }

  for (const field of ["id", "title", "url", "source"] as const) {
    const candidate = record[field];
    if (typeof candidate !== "string" || candidate.length === 0) {
      throw new Error(`Invalid entry ${file}: field "${field}" must be a non-empty string`);
    }
  }
  if (record.publishedAt !== null && typeof record.publishedAt !== "string") {
    throw new Error(`Invalid entry ${file}: field "publishedAt" must be an ISO 8601 string or null`);
  }

  return {
    id: record.id as string,
    title: record.title as string,
    url: record.url as string,
    publishedAt: record.publishedAt as string | null,
    source: record.source as string,
  };
}

/** Lit une entrée ; un fichier illisible est nommé tel quel dans l'erreur. */
function readEntry(file: string): Entry {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unreadable entry ${file}: ${reason}`, { cause: error });
  }
  return parseEntry(text, file);
}

/**
 * Compare deux entrées pour l'affichage : date de publication décroissante, les
 * entrées sans date en dernier, puis titre. Une chaîne ISO 8601 UTC se compare
 * lexicographiquement, sans conversion de fuseau.
 */
function compareEntries(a: Entry, b: Entry): number {
  if (a.publishedAt !== b.publishedAt) {
    if (a.publishedAt === null) return 1;
    if (b.publishedAt === null) return -1;
    return a.publishedAt < b.publishedAt ? 1 : -1;
  }
  return a.title.localeCompare(b.title, "fr");
}

/**
 * Rend toutes les entrées de `data/entries/`, triées de la plus récente à la
 * plus ancienne. Le site lit la sortie du pipeline, jamais une API : une
 * génération sans données échoue au lieu de publier une page vide.
 */
export function getEntries(rootDir: string = process.cwd()): Entry[] {
  const entriesDir = join(rootDir, "data", "entries");
  if (!existsSync(entriesDir)) {
    throw new Error(
      `Missing ${relative(rootDir, entriesDir)} in ${rootDir}: run npm run veille to fetch the entries first`,
    );
  }
  return listJsonFiles(entriesDir).map(readEntry).sort(compareEntries);
}
