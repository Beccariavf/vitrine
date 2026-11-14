/**
 * Lit l'archive globale JADE en flux.
 *
 * Le fichier `Freemium_jade_global_*.tar.gz` pèse plus d'un gigaoctet et son
 * contenu décompressé davantage : le lecteur tar incrémental vit dans
 * `../tar.ts` et n'est pas répété ici. Seules les entrées
 * `jade/global/publie/**\/*.xml` et `jade/global/inedit/**\/*.xml` sont rendues ;
 * les autres sont sautées sans être matérialisées.
 */

import { Readable } from "node:stream";
import type { EntreeTar } from "../tar.ts";
import { lireEntreesTar } from "../tar.ts";
import type { OptionsTar, ReponseFlux } from "../tar.ts";

export type { FetchFlux, ReponseFlux } from "../tar.ts";
export { MAX_ENTREE_OCTETS, lireEntreesTar } from "../tar.ts";

/** Fonds JADE : une décision publiée au recueil ou inédite. */
export type Fonds = "publie" | "inedit";

/** Une entrée XML retenue de l'archive. */
export type EntreeJade = EntreeTar & {
  /** Fonds d'origine, `publie` ou `inedit`. */
  fonds: Fonds;
};

export type OptionsArchive = OptionsTar;

/** Motif par défaut : les XML publiés et inédits de `jade/global`. */
export const MOTIF_XML_JADE = /^jade\/global\/(?:publie|inedit)\/(?:.+\/)?[^/]+\.xml$/i;

/** Fonds d'une entrée, ou `null` hors des deux fonds admis. */
function fondsDe(nom: string): Fonds | null {
  if (nom.startsWith("jade/global/publie/")) return "publie";
  if (nom.startsWith("jade/global/inedit/")) return "inedit";
  return null;
}

/**
 * Rend les entrées XML de l'archive JADE, une par une, dans l'ordre du tar. Le
 * flux source doit être le `.tar.gz` brut.
 */
export async function* lireEntreesJade(
  source: AsyncIterable<Uint8Array> | Readable,
  options: OptionsArchive = {},
): AsyncGenerator<EntreeJade> {
  for await (const entree of lireEntreesTar(source, {
    ...options,
    motif: options.motif ?? MOTIF_XML_JADE,
  })) {
    const fonds = fondsDe(entree.nom);
    if (fonds === null) continue;
    yield { ...entree, fonds };
  }
}

/** Ouvre une réponse HTTP en flux et rend ses entrées JADE. */
export async function* lireEntreesDepuisReponse(
  reponse: ReponseFlux,
  options: OptionsArchive = {},
): AsyncGenerator<EntreeJade> {
  if (!reponse.ok) {
    throw new Error(`Archive JADE refusée (HTTP ${reponse.status})`);
  }
  if (reponse.body === null) {
    throw new Error("Archive JADE sans corps lisible en flux");
  }
  yield* lireEntreesJade(Readable.fromWeb(reponse.body), options);
}
