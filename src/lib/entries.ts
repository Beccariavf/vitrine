import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Entry } from "../../veille/types.ts";

/** Les huit champs du contrat `veille/types.ts`. */
const FIELDS = ["id", "title", "officialTitle", "url", "publishedAt", "summary", "references", "source"] as const;

/** Champs qui doivent porter une chaîne non vide ; `publishedAt` et `summary` acceptent `null`. */
const STRING_FIELDS = ["id", "title", "officialTitle", "url", "source"] as const;

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
 * Valide la forme d'une entrée et rend une copie typée : seuls les huit champs
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

  for (const field of STRING_FIELDS) {
    const candidate = record[field];
    if (typeof candidate !== "string" || candidate.length === 0) {
      throw new Error(`Invalid entry ${file}: field "${field}" must be a non-empty string`);
    }
  }
  if (record.publishedAt !== null && typeof record.publishedAt !== "string") {
    throw new Error(`Invalid entry ${file}: field "publishedAt" must be an ISO 8601 string or null`);
  }
  if (record.summary !== null && (typeof record.summary !== "string" || record.summary.length === 0)) {
    throw new Error(`Invalid entry ${file}: field "summary" must be a non-empty string or null`);
  }
  const references = record.references;
  if (Array.isArray(references) === false || !references.every((reference) => typeof reference === "string" && reference.length > 0)) {
    throw new Error(`Invalid entry ${file}: field "references" must be an array of non-empty strings`);
  }

  return {
    id: record.id as string,
    title: record.title as string,
    officialTitle: record.officialTitle as string,
    url: record.url as string,
    publishedAt: record.publishedAt as string | null,
    summary: record.summary as string | null,
    references: references as string[],
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

/** Mots normalisés : casse, accents et ponctuation retirés. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Longueur, en caractères, de la plus longue suite de mots contiguë commune. */
function longestSharedWords(title: string, summary: string): number {
  const a = words(title);
  const b = words(summary);
  let longest = 0;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      let k = 0;
      while (a[i + k] !== undefined && a[i + k] === b[j + k]) k += 1;
      if (k === 0) continue;
      const length = a.slice(i, i + k).join(" ").length;
      if (length > longest) longest = length;
      if (longest >= 40) return longest;
    }
  }
  return longest;
}

/**
 * Un résumé qui répète une longue expression du titre n'apporte rien : on le
 * masque plutôt que de le réécrire, ce que le contrat interdit.
 */
export function isRedundantSummary(title: string, summary: string): boolean {
  return longestSharedWords(title, summary) >= 40;
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
  const files = listJsonFiles(entriesDir);
  if (files.length === 0) {
    throw new Error(
      `No entry in ${relative(rootDir, entriesDir)} in ${rootDir}: run npm run veille to fetch the entries first`,
    );
  }
  return files.map(readEntry).sort(compareEntries);
}
