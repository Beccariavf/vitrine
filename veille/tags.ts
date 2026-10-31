import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Un tag du catalogue : son état et les motifs qui le déclenchent. */
export type Tag = {
  id: string;
  label: string;
  active: boolean;
  terms: string[];
};

type Unknown = Record<string, unknown>;

function isObject(value: unknown): value is Unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTag(value: unknown, index: number): Tag {
  if (!isObject(value)) throw new Error(`Invalid tag #${index}: expected an object`);

  const { id, label, active, terms } = value;
  if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`Invalid tag #${index}: "id" must be lowercase letters, digits or dashes`);
  }
  if (typeof label !== "string" || label.trim() === "") {
    throw new Error(`Invalid tag #${index}: "label" must be a non-empty string`);
  }
  if (typeof active !== "boolean") {
    throw new Error(`Invalid tag #${index}: "active" must be a boolean`);
  }
  if (!Array.isArray(terms) || terms.length === 0 || !terms.every((term) => typeof term === "string" && term.trim() !== "")) {
    throw new Error(`Invalid tag #${index}: "terms" must be a non-empty array of non-empty strings`);
  }

  return { id, label, active, terms: terms.map((term) => term.trim()) };
}

/** Lit et valide le catalogue versionné. Une configuration cassée est une erreur, pas un défaut silencieux. */
export function readTags(rootDir: string = process.cwd()): Tag[] {
  const path = join(rootDir, "veille", "tags.json");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unreadable tags config ${path}: ${reason}`, { cause: error });
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid tags config ${path}: not valid JSON (${reason})`, { cause: error });
  }

  if (!isObject(value) || !Array.isArray(value.tags)) {
    throw new Error(`Invalid tags config ${path}: expected { "tags": [...] }`);
  }

  const tags = value.tags.map(validateTag);
  const ids = new Set<string>();
  for (const tag of tags) {
    if (ids.has(tag.id)) throw new Error(`Invalid tags config ${path}: duplicate id "${tag.id}"`);
    ids.add(tag.id);
  }
  if (tags.length === 0) throw new Error(`Invalid tags config ${path}: no tag`);

  return tags;
}

/** Les tags qui participent à la publication. */
export function activeTags(tags: Tag[]): Tag[] {
  return tags.filter((tag) => tag.active);
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

/** Vrai si le titre contient la séquence de mots du motif, sans correspondance partielle. */
export function matchesTag(title: string, tag: Tag): boolean {
  const titleWords = words(title);
  return tag.terms.some((term) => {
    const termWords = words(term);
    if (termWords.length === 0) return false;
    for (let start = 0; start + termWords.length <= titleWords.length; start += 1) {
      let matches = true;
      for (let offset = 0; offset < termWords.length; offset += 1) {
        if (titleWords[start + offset] !== termWords[offset]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
    return false;
  });
}

/** Vrai si le titre correspond à au moins un tag actif. */
export function matchesActiveTags(title: string, tags: Tag[]): boolean {
  return tags.some((tag) => tag.active && matchesTag(title, tag));
}
