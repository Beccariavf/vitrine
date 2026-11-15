/**
 * Dernière lecture réussie de chaque source de veille.
 *
 * La veille n'écrivait aucune date par source : les entrées ne disent que les
 * nouveautés trouvées, pas la passe qui n'en a trouvé aucune. Ce fichier porte
 * cette date, écrite à la fin de chaque passe pour les sources qui n'ont pas
 * échoué. Il décrit l'état d'une machine, comme `data/corpus/sync.json`, et n'est
 * pas versionné : un fichier absent rend « jamais lue » partout, jamais une date
 * inventée.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Chemin de l'état, relatif à la racine du dépôt. */
export const CHEMIN_ETAT_LECTURES = join("data", "veille", "etat.json");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Une date `AAAA-MM-JJ` valide, ou `null`. */
export function dateValide(valeur: unknown): string | null {
  return typeof valeur === "string" && DATE_ISO.test(valeur) && !Number.isNaN(Date.parse(valeur))
    ? valeur
    : null;
}

/**
 * Dernière lecture réussie par source, lue dans `data/veille/etat.json`. Un
 * fichier absent, illisible ou d'une forme inconnue rend une carte vide : le
 * client lit alors « jamais lue », il ne devine rien.
 */
export function lireLectures(rootDir: string): Map<string, string> {
  const lectures = new Map<string, string>();
  const chemin = join(rootDir, CHEMIN_ETAT_LECTURES);
  if (!existsSync(chemin)) return lectures;
  let valeur: unknown;
  try {
    valeur = JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    return lectures;
  }
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return lectures;
  const sources = (valeur as { sources?: unknown }).sources;
  if (typeof sources !== "object" || sources === null || Array.isArray(sources)) return lectures;
  for (const [source, date] of Object.entries(sources)) {
    const valide = dateValide(date);
    if (source !== "" && valide !== null) lectures.set(source, valide);
  }
  return lectures;
}

/** Écrit un fichier JSON de façon atomique, seulement si son contenu change. */
export function ecrireJsonAtomique(chemin: string, valeur: unknown): boolean {
  const contenu = `${JSON.stringify(valeur, null, 2)}\n`;
  try {
    if (readFileSync(chemin, "utf8") === contenu) return false;
  } catch {
    // Absent : on l'écrit plus bas.
  }
  mkdirSync(dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.tmp`;
  try {
    writeFileSync(temporaire, contenu, "utf8");
    renameSync(temporaire, chemin);
  } finally {
    if (existsSync(temporaire)) rmSync(temporaire, { force: true });
  }
  return true;
}

/** Écrit l'état s'il change ; rend vrai quand le disque a bougé. */
export function ecrireLectures(rootDir: string, lectures: ReadonlyMap<string, string>): boolean {
  const sources = Object.fromEntries(
    [...lectures.entries()].sort(([gauche], [droite]) => gauche.localeCompare(droite)),
  );
  return ecrireJsonAtomique(join(rootDir, CHEMIN_ETAT_LECTURES), { version: 1, sources });
}

/**
 * Note la lecture réussie des `sources` à la `date` de la passe ; les autres
 * gardent leur date antérieure. Une date invalide est refusée en la nommant :
 * l'état ne porte jamais une date qu'on ne saurait relire.
 */
export function noterLectures(rootDir: string, sources: readonly string[], date: string): boolean {
  if (dateValide(date) === null) {
    throw new Error(`Date de lecture attendue AAAA-MM-JJ ; reçu « ${date} »`);
  }
  const lectures = lireLectures(rootDir);
  let change = false;
  for (const source of sources) {
    if (source === "" || lectures.get(source) === date) continue;
    lectures.set(source, date);
    change = true;
  }
  if (!change) return false;
  return ecrireLectures(rootDir, lectures);
}
