/**
 * Outils communs aux corpus qui lisent une archive de la DILA.
 *
 * La liste HTML d'un répertoire OPENDATA, le téléchargement par fichier
 * temporaire, l'empreinte d'un gros fichier et l'écriture idempotente ne
 * dépendent d'aucun fonds : le Conseil d'État (JADE) et le Conseil
 * constitutionnel (CONSTIT) les partagent. Le nom du fonds n'entre que dans les
 * messages, pour nommer la source en panne.
 */

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FetchFlux } from "./tar.ts";

/** Réponse texte minimale d'un `fetch`, injectable en test. */
export type FetchTexte = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** Écrit un fichier UTF-8 s'il n'a pas déjà exactement ce contenu. */
export function ecrireSiChange(chemin: string, contenu: string): boolean {
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

/** Empreinte sha256 d'un fichier, lue en flux : l'archive ne tient pas en mémoire. */
export function sha256Fichier(chemin: string): Promise<string> {
  return new Promise((reussir, echouer) => {
    const empreinte = createHash("sha256");
    createReadStream(chemin)
      .on("data", (morceau) => empreinte.update(morceau))
      .on("error", echouer)
      .on("end", () => reussir(empreinte.digest("hex")));
  });
}

/** Expression régulière d'un motif glob simple (`*` seul joker admis). */
export function motifVersExpression(motif: string): RegExp {
  const echappe = motif
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    // Un `*` de motif désigne un nom de fichier, jamais le reste du document.
    .replace(/\*/g, "[^\\s\"'<>/]*");
  return new RegExp(echappe, "g");
}

/** Noms d'archives publiés par la DILA, triés, sans doublon. */
export async function listerArchives(
  url: string,
  motif: string,
  fetchImpl: FetchTexte = fetch as unknown as FetchTexte,
  fonds = "JADE",
): Promise<string[]> {
  const reponse = await fetchImpl(url);
  if (!reponse.ok) {
    throw new Error(`Liste ${fonds} refusée : ${url} (HTTP ${reponse.status}).`);
  }
  const html = await reponse.text();
  return [...new Set(html.match(motifVersExpression(motif)) ?? [])].sort();
}

/** Télécharge une archive par fichier temporaire puis renommage. */
export async function telechargerArchive(
  url: string,
  chemin: string,
  fetchImpl: FetchFlux = fetch as unknown as FetchFlux,
  fonds = "JADE",
): Promise<void> {
  mkdirSync(dirname(chemin), { recursive: true });
  const reponse = await fetchImpl(url);
  if (!reponse.ok) {
    throw new Error(`Téléchargement ${fonds} refusé : ${url} (HTTP ${reponse.status}).`);
  }
  if (reponse.body === null) {
    throw new Error(`Téléchargement ${fonds} sans corps : ${url}.`);
  }
  const temporaire = `${chemin}.tmp`;
  try {
    await pipeline(Readable.fromWeb(reponse.body), createWriteStream(temporaire));
    if (!existsSync(temporaire) || statSync(temporaire).size === 0) {
      throw new Error(`Téléchargement ${fonds} vide : ${url}.`);
    }
    renameSync(temporaire, chemin);
  } finally {
    if (existsSync(temporaire)) rmSync(temporaire, { force: true });
  }
}

/** Date du jour en UTC, forme `AAAA-MM-JJ`. */
export function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}
