import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Entry } from "./types.ts";

/** Écrit un fichier UTF-8 s'il n'a pas déjà exactement ce contenu. */
function writeIfChanged(path: string, content: string): string {
  try {
    if (readFileSync(path, "utf8") === content) return path;
  } catch {
    // Absent : on l'écrit plus bas.
  }
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  try {
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, path);
  } finally {
    if (existsSync(tmp)) rmSync(tmp, { force: true });
  }
  return path;
}

/** Liste récursivement les fichiers sous `dir`. */
function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files;
}

/**
 * Supprime les copies périmées de la même entrée : une date corrigée déplace
 * le fichier, et deux copies du même `id` seraient un doublon.
 */
function removeStaleCopies(rootDir: string, id: string, targetPath: string): void {
  const entriesDir = join(rootDir, "data", "entries");
  if (!existsSync(entriesDir)) return;
  for (const path of listFiles(entriesDir)) {
    if (basename(path) === `${id}.json` && path !== targetPath) rmSync(path, { force: true });
  }
}

/**
 * Conserve une réponse brute, adressée par son contenu :
 * `data/raw/<2 hex>/<sha256>.<extension>`. Un contenu inchangé réécrit le même chemin.
 */
export function writeRaw(rootDir: string, content: string, extension = "xml"): string {
  const body = content.endsWith("\n") ? content : `${content}\n`;
  const hash = createHash("sha256").update(body, "utf8").digest("hex");
  return writeIfChanged(join(rootDir, "data", "raw", hash.slice(0, 2), `${hash}.${extension}`), body);
}

/** Chemin relatif d'une entrée : année/mois UTC de publication, `unknown/` sinon. */
function entryRelativePath(entry: Entry): string {
  if (entry.publishedAt === null) return join("data", "entries", "unknown", `${entry.id}.json`);
  const published = new Date(entry.publishedAt);
  const year = String(published.getUTCFullYear());
  const month = String(published.getUTCMonth() + 1).padStart(2, "0");
  return join("data", "entries", year, month, `${entry.id}.json`);
}

/**
 * Écrit une entrée par actualité sous `data/entries/`. Une copie périmée de la
 * même entrée (date corrigée) est supprimée ; aucune autre entrée n'est jamais
 * supprimée, même quand elle disparaît du flux.
 */
export function writeEntries(rootDir: string, entries: Entry[]): string[] {
  return entries.map((entry) => {
    const path = join(rootDir, entryRelativePath(entry));
    writeIfChanged(path, `${JSON.stringify(entry, null, 2)}\n`);
    removeStaleCopies(rootDir, entry.id, path);
    return path;
  });
}

/** Lit l'entrée déjà écrite pour un `id`, ou `null` si elle manque ou est illisible. */
export function readEntryById(rootDir: string, id: string): Entry | null {
  const entriesDir = join(rootDir, "data", "entries");
  if (!existsSync(entriesDir)) return null;

  for (const path of listFiles(entriesDir)) {
    if (basename(path) !== `${id}.json`) continue;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as Entry;
    } catch {
      return null;
    }
  }
  return null;
}
