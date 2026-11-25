/**
 * Résolution et téléchargement de la ressource « Avis et conseils de la CADA ».
 *
 * La ressource est trouvée par l'API data.gouv.fr, jamais par scraping : le
 * jeu porte un fichier consolidé que l'API nomme par son identifiant, son URL
 * datée et sa somme de contrôle SHA-1. Le fichier (~189 Mo) est lu une fois
 * sous `data/raw/cada/`, adressé par son `sha256`.
 */

import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { FetchLike } from "../../../veille/fetch.ts";
import type { DescripteurCada } from "./parse.ts";

/** Ce qu'un téléchargement binaire attend d'un `fetch`. */
export type ReponseBinaire = {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type FetchBinaire = (url: string) => Promise<ReponseBinaire>;

/** Ressource consolidée telle que l'API la décrit. */
export type RessourceCada = {
  id: string;
  titre: string;
  url: string;
  /** Somme SHA-1 publiée par data.gouv ; `null` quand elle manque. */
  sha1: string | null;
  /** Dernière modification de la ressource, `AAAA-MM-JJ`. */
  modifiee_le: string | null;
  taille: number | null;
};

/** Réponse de l'API lue, gardée comme capture brute par la veille. */
export type ResolutionRessource = { ressource: RessourceCada; brut: string };

type RessourceApi = {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  filesize?: unknown;
  last_modified?: unknown;
  checksum?: { type?: unknown; value?: unknown } | null;
};

type JeuApi = { resources?: unknown };

/** Date `AAAA-MM-JJ` d'un horodatage API, ou `null`. */
function dateApi(valeur: unknown): string | null {
  if (typeof valeur !== "string" || valeur.length < 10) return null;
  const date = valeur.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/**
 * Interroge l'API data.gouv.fr et rend la ressource consolidée : celle de
 * l'identifiant du descripteur, sinon celle dont le titre est exactement
 * déclaré. Une ressource absente lève en nommant les deux.
 */
export async function resoudreRessource(
  descripteur: DescripteurCada,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<ResolutionRessource> {
  const reponse = await fetchImpl(descripteur.jeu.api, { headers: { Accept: "application/json" } });
  if (!reponse.ok) {
    throw new Error(`API data.gouv.fr indisponible : HTTP ${reponse.status} (${descripteur.jeu.api})`);
  }
  const brut = await reponse.text();
  let jeu: JeuApi;
  try {
    jeu = JSON.parse(brut) as JeuApi;
  } catch {
    throw new Error(`API data.gouv.fr : réponse illisible pour ${descripteur.jeu.url}`);
  }
  if (!Array.isArray(jeu.resources)) {
    throw new Error(`API data.gouv.fr : aucune ressource pour ${descripteur.jeu.url}`);
  }

  const ressources = jeu.resources as RessourceApi[];
  const trouvee =
    ressources.find((ressource) => ressource.id === descripteur.ressource.id) ??
    ressources.find((ressource) => ressource.title === descripteur.ressource.titre);
  if (trouvee === undefined || typeof trouvee.url !== "string" || trouvee.url === "") {
    throw new Error(
      `Ressource « ${descripteur.ressource.titre} » (${descripteur.ressource.id}) ` +
        `absente du jeu ${descripteur.jeu.url}`,
    );
  }

  const checksum = trouvee.checksum;
  const sha1 =
    checksum !== null &&
    checksum !== undefined &&
    checksum.type === "sha1" &&
    typeof checksum.value === "string"
      ? checksum.value
      : null;

  return {
    brut,
    ressource: {
      id: typeof trouvee.id === "string" ? trouvee.id : descripteur.ressource.id,
      titre: typeof trouvee.title === "string" ? trouvee.title : descripteur.ressource.titre,
      url: trouvee.url,
      sha1,
      modifiee_le: dateApi(trouvee.last_modified),
      taille: typeof trouvee.filesize === "number" ? trouvee.filesize : null,
    },
  };
}

/** Vrai quand deux descriptions désignent la même version de la ressource. */
export function memeRessource(
  gauche: Pick<RessourceCada, "url" | "sha1" | "modifiee_le">,
  droite: Pick<RessourceCada, "url" | "sha1" | "modifiee_le">,
): boolean {
  if (gauche.url !== droite.url) return false;
  if (gauche.sha1 !== null && droite.sha1 !== null) return gauche.sha1 === droite.sha1;
  return gauche.modifiee_le !== null && gauche.modifiee_le === droite.modifiee_le;
}

/** `sha256` d'un fichier, lu en flux. */
export async function sha256Fichier(chemin: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const morceau of createReadStream(chemin)) hash.update(morceau as Buffer);
  return hash.digest("hex");
}

/** Nom de fichier local d'une ressource, tiré de son URL datée. */
export function nomFichier(ressource: Pick<RessourceCada, "url">): string {
  const nom = basename(new URL(ressource.url).pathname);
  if (nom === "" || nom.includes("/")) throw new Error(`URL de ressource sans nom de fichier : ${ressource.url}`);
  return nom;
}

/**
 * Télécharge la ressource sous `dossier` si le fichier local n'a pas déjà la
 * taille annoncée. Rend le chemin et l'empreinte des octets lus.
 */
export async function telechargerRessource(
  ressource: RessourceCada,
  dossier: string,
  fetchImpl: FetchBinaire = fetch as unknown as FetchBinaire,
): Promise<{ chemin: string; sha256: string; telecharge: boolean }> {
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, nomFichier(ressource));
  let telecharge = false;

  if (!existsSync(chemin) || (ressource.taille !== null && statSync(chemin).size !== ressource.taille)) {
    const reponse = await fetchImpl(ressource.url);
    if (!reponse.ok) {
      throw new Error(`Téléchargement refusé pour ${ressource.url} (HTTP ${reponse.status}).`);
    }
    const temporaire = `${chemin}.tmp`;
    try {
      writeFileSync(temporaire, Buffer.from(await reponse.arrayBuffer()));
      renameSync(temporaire, chemin);
    } finally {
      if (existsSync(temporaire)) rmSync(temporaire, { force: true });
    }
    telecharge = true;
  }

  return { chemin, sha256: await sha256Fichier(chemin), telecharge };
}
