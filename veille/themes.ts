import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Entry } from "./types.ts";

/** Une matière : ce qu'elle couvre, ses sources, et les motifs qui rattachent une entrée. */
export type Theme = {
  id: string;
  label: string;
  description: string;
  /** Instruments canoniques, tels que les rend `Entry.references` avant le ` · `. */
  instruments: string[];
  /** Termes de repli, appliqués au titre, au titre officiel et au résumé. */
  terms: string[];
  /** Libellés affichés des sources qui alimentent la matière. */
  sources: string[];
  /** Requêtes de jurisprudence propres à la matière ; à défaut, son premier terme. */
  queries?: string[];
  active: boolean;
};

type Unknown = Record<string, unknown>;

function isObject(value: unknown): value is Unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyStrings(value: unknown, field: string, index: number): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid theme #${index}: "${field}" must be a non-empty array`);
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw new Error(`Invalid theme #${index}: "${field}" must contain non-empty strings`);
    }
    return item.trim();
  });
}

function validateTheme(value: unknown, index: number): Theme {
  if (!isObject(value)) throw new Error(`Invalid theme #${index}: expected an object`);

  const { id, label, description, instruments, terms, sources, queries, active } = value;
  if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`Invalid theme #${index}: "id" must be lowercase letters, digits or dashes`);
  }
  if (typeof label !== "string" || label.trim() === "") {
    throw new Error(`Invalid theme #${index}: "label" must be a non-empty string`);
  }
  if (typeof description !== "string" || description.trim() === "") {
    throw new Error(`Invalid theme #${index}: "description" must be a non-empty string`);
  }
  if (typeof active !== "boolean") {
    throw new Error(`Invalid theme #${index}: "active" must be a boolean`);
  }

  const parsedQueries = queries === undefined ? undefined : nonEmptyStrings(queries, "queries", index);

  return {
    id,
    label: label.trim(),
    description: description.trim(),
    instruments: nonEmptyStrings(instruments, "instruments", index),
    terms: nonEmptyStrings(terms, "terms", index),
    sources: nonEmptyStrings(sources, "sources", index),
    ...(parsedQueries === undefined ? {} : { queries: parsedQueries }),
    active,
  };
}

/**
 * Lit et valide le catalogue versionné. Une configuration cassée est une erreur,
 * pas un défaut silencieux : le site et la passe lisent le même fichier.
 */
export function readThemes(rootDir: string = process.cwd()): Theme[] {
  const path = join(rootDir, "veille", "themes.json");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unreadable themes config ${path}: ${reason}`, { cause: error });
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid themes config ${path}: not valid JSON (${reason})`, { cause: error });
  }

  if (!isObject(value) || !Array.isArray(value.themes)) {
    throw new Error(`Invalid themes config ${path}: expected { "themes": [...] }`);
  }

  const themes = value.themes.map(validateTheme);
  const ids = new Set<string>();
  for (const theme of themes) {
    if (ids.has(theme.id)) throw new Error(`Invalid themes config ${path}: duplicate id "${theme.id}"`);
    ids.add(theme.id);
  }
  if (themes.length !== 5) {
    throw new Error(`Invalid themes config ${path}: expected exactly five themes`);
  }

  return themes;
}

/** Les matières qui participent à la publication. */
export function activeThemes(themes: Theme[]): Theme[] {
  return themes.filter((theme) => theme.active);
}

/** Requêtes de jurisprudence d'une matière : les siennes, sinon son premier terme. */
export function themeQueries(theme: Theme): string[] {
  if (theme.queries !== undefined && theme.queries.length > 0) return theme.queries;
  return [theme.terms[0] ?? theme.instruments[0] ?? theme.label];
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

/** Vrai si le texte contient la séquence de mots du terme, sans correspondance partielle. */
export function matchesTerm(text: string, term: string): boolean {
  const textWords = words(text);
  const termWords = words(term);
  if (termWords.length === 0) return false;
  for (let start = 0; start + termWords.length <= textWords.length; start += 1) {
    let match = true;
    for (let offset = 0; offset < termWords.length; offset += 1) {
      if (textWords[start + offset] !== termWords[offset]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

/** Partie instrument d'une référence : `Règlement (UE) 2016/679 · art. 6` → `Règlement (UE) 2016/679`. */
export function instrumentOf(reference: string): string {
  return reference.split(" · ")[0] ?? reference;
}

/** Forme comparable d'un instrument, indifférente à la casse, aux accents et au `n°`. */
function normalizeInstrument(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/n[°o]\s*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Vrai si une entrée cite un instrument de la matière, ou contient un de ses termes. */
export function matchesTheme(entry: Entry, theme: Theme): boolean {
  const cited = new Set(entry.references.map((reference) => normalizeInstrument(instrumentOf(reference))));
  if (theme.instruments.some((instrument) => cited.has(normalizeInstrument(instrument)))) return true;

  const text = [entry.title, entry.officialTitle, entry.summary ?? ""].join(" ");
  return theme.terms.some((term) => matchesTerm(text, term));
}

/** Matières qu'une source alimente par nature, avant tout motif. */
const SOURCE_DEFAULT_THEMES: Record<string, string[]> = {
  cnil: ["donnees-personnelles"],
  cepd: ["donnees-personnelles"],
  anssi: ["cybersecurite"],
  "commission-dma": ["plateformes"],
};

/**
 * Matières d'une entrée : défauts de la source, indices de la requête, puis motifs.
 * Les matières inactives sont conservées : le site filtre, la collecte ne perd rien.
 */
export function themesForEntry(entry: Entry, themes: Theme[], hints: string[] = []): string[] {
  const ids = new Set<string>(entry.themes);
  for (const id of SOURCE_DEFAULT_THEMES[entry.source] ?? []) ids.add(id);
  for (const hint of hints) ids.add(hint);
  for (const theme of themes) {
    if (matchesTheme(entry, theme)) ids.add(theme.id);
  }
  const known = new Set(themes.map((theme) => theme.id));
  return [...ids].filter((id) => known.has(id));
}

/** Rattache les entrées et ne rend que celles qui portent au moins une matière. */
export function assignThemes(entries: Entry[], themes: Theme[], hints: string[] = []): Entry[] {
  return entries
    .map((entry) => ({ ...entry, themes: themesForEntry(entry, themes, hints) }))
    .filter((entry) => entry.themes.length > 0);
}

/** Entrées visibles pour les matières actives. */
export function visibleEntries(entries: Entry[], themes: Theme[]): Entry[] {
  const active = new Set(activeThemes(themes).map((theme) => theme.id));
  return entries.filter((entry) => entry.themes.some((id) => active.has(id)));
}
