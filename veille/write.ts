import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Entry } from "./types.ts";

/** Écrit un fichier UTF-8 s'il n'a pas déjà exactement ce contenu. */
function writeIfChanged(path: string, content: string): string {
  try {
    if (readFileSync(path, "utf8") === content) return path;
  } catch {
    // Absent : on l'écrit plus bas.
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  return path;
}

/**
 * Conserve la réponse brute, adressée par son contenu :
 * `data/raw/<2 hex>/<sha256>.xml`. Un flux inchangé réécrit le même chemin.
 */
export function writeRaw(rootDir: string, xml: string): string {
  const content = xml.endsWith("\n") ? xml : `${xml}\n`;
  const hash = createHash("sha256").update(content, "utf8").digest("hex");
  return writeIfChanged(join(rootDir, "data", "raw", hash.slice(0, 2), `${hash}.xml`), content);
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
 * Écrit une entrée par actualité sous `data/entries/`. Rien n'est supprimé :
 * une actualité disparue du flux reste sur disque.
 */
export function writeEntries(rootDir: string, entries: Entry[]): string[] {
  return entries.map((entry) =>
    writeIfChanged(join(rootDir, entryRelativePath(entry)), `${JSON.stringify(entry, null, 2)}\n`),
  );
}
