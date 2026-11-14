/**
 * Lit une archive `.tar.gz` en flux, entrée par entrée.
 *
 * Les archives de la DILA pèsent de quelques mégaoctets à plus d'un gigaoctet :
 * rien n'est chargé entier. `fetch` rend un flux Web, ramené à un `Readable`,
 * puis `createGunzip` alimente un lecteur tar incrémental. Seules les entrées
 * dont le nom satisfait le motif sont rendues ; les autres sont sautées sans
 * être matérialisées. Chaque corpus décide ensuite ce qu'il fait de l'entrée.
 */

import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";

/** Réponse minimale d'un `fetch` en flux, injectable en test. */
export type ReponseFlux = {
  ok: boolean;
  status: number;
  body: WebReadableStream<Uint8Array> | null;
};

/** Un `fetch` qui rend un corps lisible en flux, jamais un `arrayBuffer`. */
export type FetchFlux = (url: string) => Promise<ReponseFlux>;

/** Une entrée de l'archive retenue par le motif. */
export type EntreeTar = {
  /** Nom complet dans le tar, par exemple `constit/global/CONS/TEXT/…/CONSTEXT….xml`. */
  nom: string;
  /** Taille déclarée par l'en-tête tar, en octets. */
  taille: number;
  donnees: Buffer;
};

export type OptionsTar = {
  /** Nom de l'archive, pour nommer l'entrée dans un message d'erreur. */
  nomArchive?: string;
  /** Taille maximale d'une entrée ; au-delà, l'archive est refusée. */
  maxOctets?: number;
  /** Motif des entrées retenues ; par défaut, tout fichier du tar. */
  motif?: RegExp;
};

/** Plafond par défaut d'une entrée : 5 Mo. */
export const MAX_ENTREE_OCTETS = 5 * 1024 * 1024;

const TAILLE_BLOC = 512;

/** Lit exactement `n` octets du flux, ou saute `n` octets sans les garder. */
class LecteurOctets {
  private morceaux: Buffer[] = [];
  private disponible = 0;
  private fin = false;
  /** Entrée en cours de lecture, pour nommer une corruption gzip. */
  entree = "";
  private readonly source: AsyncIterator<Uint8Array>;
  private readonly nomArchive: string;

  constructor(source: AsyncIterator<Uint8Array>, nomArchive: string) {
    this.source = source;
    this.nomArchive = nomArchive;
  }

  private async tirer(): Promise<boolean> {
    if (this.fin) return false;
    let suivant: IteratorResult<Uint8Array>;
    try {
      suivant = await this.source.next();
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Archive ${this.nomArchive} illisible (gzip corrompu)` +
          `${this.entree === "" ? "" : ` pendant ${this.entree}`} : ${cause}`,
      );
    }
    if (suivant.done === true) {
      this.fin = true;
      return false;
    }
    const valeur = suivant.value;
    const morceau = Buffer.isBuffer(valeur) ? valeur : Buffer.from(valeur);
    if (morceau.length > 0) {
      this.morceaux.push(morceau);
      this.disponible += morceau.length;
    }
    return true;
  }

  private manque(attendu: number): Error {
    return new Error(
      `Archive ${this.nomArchive} tronquée` +
        `${this.entree === "" ? "" : ` dans ${this.entree}`} : ` +
        `${attendu} octet(s) attendu(s), ${this.disponible} disponible(s)`,
    );
  }

  /** Rend exactement `n` octets ; lève si le flux s'arrête avant. */
  async lire(n: number): Promise<Buffer> {
    while (this.disponible < n) {
      if (!(await this.tirer())) throw this.manque(n);
    }
    const sortie = Buffer.allocUnsafe(n);
    let ecrit = 0;
    while (ecrit < n) {
      const piece = this.morceaux[0];
      if (piece === undefined) throw this.manque(n - ecrit);
      const pris = Math.min(piece.length, n - ecrit);
      piece.copy(sortie, ecrit, 0, pris);
      ecrit += pris;
      this.disponible -= pris;
      if (pris === piece.length) this.morceaux.shift();
      else this.morceaux[0] = piece.subarray(pris);
    }
    return sortie;
  }

  /** Saute `n` octets sans les conserver en mémoire. */
  async sauter(n: number): Promise<void> {
    let reste = n;
    while (reste > 0) {
      while (this.disponible === 0) {
        if (!(await this.tirer())) throw this.manque(reste);
      }
      const piece = this.morceaux[0];
      if (piece === undefined) throw this.manque(reste);
      const pris = Math.min(piece.length, reste);
      reste -= pris;
      this.disponible -= pris;
      if (pris === piece.length) this.morceaux.shift();
      else this.morceaux[0] = piece.subarray(pris);
    }
  }
}

function champ(bloc: Buffer, debut: number, longueur: number): string {
  return bloc
    .subarray(debut, debut + longueur)
    .toString("utf8")
    .replace(/\0.*$/s, "")
    .trim();
}

/** Taille octale d'un en-tête tar ; lève sur une valeur illisible. */
function tailleEntete(bloc: Buffer, nom: string): number {
  const brut = champ(bloc, 124, 12);
  if (brut === "") return 0;
  if (!/^[0-7]+$/.test(brut)) {
    throw new Error(`Archive tar : taille illisible pour ${nom || "(entrée sans nom)"} (« ${brut} »)`);
  }
  return Number.parseInt(brut, 8);
}

/** Longueur de remplissage pour aligner `taille` sur un bloc de 512 octets. */
function remplissage(taille: number): number {
  const reste = taille % TAILLE_BLOC;
  return reste === 0 ? 0 : TAILLE_BLOC - reste;
}

function octetsVides(bloc: Buffer): boolean {
  return bloc.every((octet) => octet === 0);
}

/**
 * Rend les entrées du tar dont le nom satisfait le motif, une par une, dans
 * l'ordre du tar. Le flux source doit être le `.tar.gz` brut ; la décompression
 * et la lecture des en-têtes sont faites ici.
 */
export async function* lireEntreesTar(
  source: AsyncIterable<Uint8Array> | Readable,
  options: OptionsTar = {},
): AsyncGenerator<EntreeTar> {
  const nomArchive = options.nomArchive ?? "(archive)";
  const maxOctets = options.maxOctets ?? MAX_ENTREE_OCTETS;
  const motif = options.motif ?? /./;

  const decompresse = Readable.from(source as AsyncIterable<Uint8Array>).pipe(createGunzip());
  const lecteur = new LecteurOctets(decompresse[Symbol.asyncIterator](), nomArchive);
  let nomLong = "";

  while (true) {
    const bloc = await lecteur.lire(TAILLE_BLOC);
    if (octetsVides(bloc)) return;

    const nom = champ(bloc, 0, 100);
    const prefixe = champ(bloc, 345, 155);
    const type = String.fromCharCode(bloc[156] ?? 0);
    const brut = nomLong !== "" ? nomLong : prefixe === "" ? nom : `${prefixe}/${nom}`;
    const complet = brut.replace(/^\.\//, "");
    const taille = tailleEntete(bloc, complet);
    lecteur.entree = complet;

    // Les métadonnées AppleDouble (`._nom.xml`) ne sont pas des décisions.
    const nomBase = complet.slice(complet.lastIndexOf("/") + 1);
    if (nomBase.startsWith("._")) {
      await lecteur.sauter(taille + remplissage(taille));
      continue;
    }

    if (type === "L") {
      const donnees = await lecteur.lire(taille);
      nomLong = donnees.toString("utf8").replace(/\0.*$/s, "").trim();
      await lecteur.sauter(remplissage(taille));
      continue;
    }
    nomLong = "";

    if (!motif.test(complet)) {
      await lecteur.sauter(taille + remplissage(taille));
      continue;
    }
    if (taille > maxOctets) {
      throw new Error(
        `Entrée ${complet} refusée : ${taille} octets dépassent le plafond de ${maxOctets} octets`,
      );
    }

    if (type !== "0" && type !== "\0") {
      await lecteur.sauter(taille + remplissage(taille));
      continue;
    }

    const donnees = await lecteur.lire(taille);
    const padding = remplissage(taille);
    if (padding > 0) await lecteur.sauter(padding);
    yield { nom: complet, taille, donnees };
  }
}

/** Ouvre une réponse HTTP en flux et rend ses entrées. */
export async function* lireEntreesDepuisReponse(
  reponse: ReponseFlux,
  options: OptionsTar = {},
): AsyncGenerator<EntreeTar> {
  if (!reponse.ok) {
    throw new Error(`Archive refusée (HTTP ${reponse.status})`);
  }
  if (reponse.body === null) {
    throw new Error("Archive sans corps lisible en flux");
  }
  yield* lireEntreesTar(Readable.fromWeb(reponse.body), options);
}
