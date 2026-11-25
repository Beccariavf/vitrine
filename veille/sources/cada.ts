/**
 * Veille des avis et conseils de la CADA.
 *
 * La source ne lit aucun document : elle compare la ressource consolidée que
 * l'API data.gouv.fr décrit (URL datée, `sha1`, dernière modification) à
 * l'état de lecture du corpus `cada`. Une ressource inchangée n'écrit aucune
 * entrée et ne télécharge rien ; une ressource nouvelle écrit une entrée qui
 * fait relancer `cada:sync` par `npm run corpus:sync`.
 *
 * L'entrée ne nomme aucun document : la liste des avis n'est connue qu'en
 * lisant le fichier de 189 Mo, ce que la veille ne fait pas. Elle porte donc la
 * version de la ressource, et le corpus est resynchronisé en bloc.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Entry } from "../types.ts";
import type { FetchLike } from "../fetch.ts";
import { lireEtat } from "../../mcp/corpus/cada/sync.ts";
import type { EtatCada } from "../../mcp/corpus/cada/sync.ts";
import { lireDescripteur } from "../../mcp/corpus/cada/parse.ts";
import { memeRessource, resoudreRessource } from "../../mcp/corpus/cada/source.ts";
import type { RessourceCada } from "../../mcp/corpus/cada/source.ts";

/** Identifiant de la source de veille. */
export const SOURCE_ID = "cada";

/** Matière du pilier données non personnelles. */
export const THEME = "donnees-non-personnelles";

/** Descripteur du corpus, partagé avec `cada:sync`. */
export const DESCRIPTEUR = fileURLToPath(new URL("../../mcp/corpus/cada/descripteur.json", import.meta.url));

/** État de lecture du corpus : sa ressource dit ce qui est déjà lu. */
export const ETAT = join("data", "corpus", "cada", "etat.json");

export type PasseCada = {
  raw: string[];
  entries: Entry[];
  warnings: string[];
  notes: string[];
};

/** Lit l'état de lecture du corpus ; `null` s'il est absent ou illisible. */
export function lireEtatCada(rootDir: string): EtatCada | null {
  const chemin = join(rootDir, ETAT);
  if (!existsSync(chemin)) return null;
  try {
    return lireEtat(chemin);
  } catch {
    return null;
  }
}

/** Identité stable d'une entrée : la version de la ressource, jamais sa date de passe. */
export function idEntree(ressource: RessourceCada): string {
  const version = ressource.sha1 ?? ressource.modifiee_le ?? ressource.url;
  return `cada-${createHash("sha1").update(`${ressource.id}:${version}`).digest("hex").slice(0, 16)}`;
}

/** Libellé de la version comparée : `sha1` d'abord, date ensuite. */
function versionDe(ressource: RessourceCada): string {
  return ressource.sha1 ?? ressource.modifiee_le ?? ressource.url;
}

/**
 * Une passe de veille : une entrée seulement quand la ressource change. Le
 * corps de l'API est rendu comme capture brute, jamais le CSV.
 */
export async function passeCada(options: {
  rootDir: string;
  fetchImpl: FetchLike;
  maintenant?: Date;
}): Promise<PasseCada> {
  const descripteur = lireDescripteur(DESCRIPTEUR);
  const { ressource, brut } = await resoudreRessource(descripteur, options.fetchImpl);
  const etat = lireEtatCada(options.rootDir);
  const version = versionDe(ressource);

  if (etat !== null && memeRessource(etat.ressource, ressource)) {
    return {
      raw: [],
      entries: [],
      warnings: [],
      notes: [
        `cada : ressource inchangée (${ressource.modifiee_le ?? version}), aucun téléchargement`,
      ],
    };
  }

  const passe = (options.maintenant ?? new Date()).toISOString().slice(0, 10);
  const entry: Entry = {
    id: idEntree(ressource),
    title: `Avis et conseils de la CADA — ressource du ${ressource.modifiee_le ?? passe}`,
    officialTitle: "Avis et conseils de la CADA — ensemble consolidé",
    url: descripteur.jeu.url,
    publishedAt: passe,
    summary:
      `Nouvelle version de la ressource consolidée (${version}) : ` +
      "`cada:sync` la lira et n'indexera que les avis ajoutés ou modifiés.",
    references: [],
    themes: [THEME],
    source: SOURCE_ID,
    version,
  };

  return {
    raw: [brut],
    entries: [entry],
    warnings: [],
    notes: [
      `cada : ressource modifiée (${version}) ; cada:sync la relira`,
    ],
  };
}
