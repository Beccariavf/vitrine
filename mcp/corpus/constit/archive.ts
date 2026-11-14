/**
 * Lit l'archive CONSTIT de la DILA en flux.
 *
 * Le fichier `Freemium_constit_global_*.tar.gz` (≈ 13 Mo) contient les XML
 * `TEXTE_JURI_CONSTIT` sous `constit/global/CONS/TEXT/`. Le lecteur tar
 * incrémental vit dans `../tar.ts` ; seules les décisions XML sont rendues.
 */

import { Readable } from "node:stream";
import type { EntreeTar } from "../tar.ts";
import { lireEntreesTar } from "../tar.ts";
import type { OptionsTar } from "../tar.ts";

/** Une entrée XML de l'archive CONSTIT. */
export type EntreeConstit = EntreeTar;

export type OptionsArchive = OptionsTar;

/** Motif des décisions : les XML de `constit/global/CONS/TEXT`. */
export const MOTIF_XML_CONSTIT = /^constit\/global\/CONS\/TEXT\/(?:.+\/)?[^/]+\.xml$/i;

/**
 * Rend les décisions XML de l'archive CONSTIT, une par une, dans l'ordre du
 * tar. Le flux source doit être le `.tar.gz` brut.
 */
export async function* lireEntreesConstit(
  source: AsyncIterable<Uint8Array> | Readable,
  options: OptionsArchive = {},
): AsyncGenerator<EntreeConstit> {
  yield* lireEntreesTar(source, { ...options, motif: options.motif ?? MOTIF_XML_CONSTIT });
}
