/**
 * Extrait d'une communication du Journal officiel le texte indexable et le
 * numéro d'affaire qu'elle déclare.
 *
 * Le Journal officiel sert deux rendus pour un même document : le XHTML moderne
 * (`class="oj-doc-ti"`, fin `oj-doc-end`) et le HTML patrimonial
 * (`class="doc-ti"`, fin `doc-end`). Le texte est copié du premier titre de
 * document jusqu'à la fin ; seul le pied `ELI: … ISSN …` est retiré, puis les
 * espaces sont normalisés. Le contenu n'est jamais réécrit.
 */

import { texteVisible } from "../parse.ts";

/** Ce qu'une passe tire d'une communication : son numéro déclaré et son texte. */
export type Communication = {
  /** Numéro lu dans `(Affaire C-703/25 P)` ; `null` quand le texte n'en porte pas. */
  numero: string | null;
  texte: string;
};

/** Ouvertures de document des deux rendus, dans l'ordre du XHTML moderne puis patrimonial. */
const DEBUTS = ['class="oj-doc-ti"', 'class="doc-ti"'] as const;

/** Nom du fichier de cache d'une communication, sous `data/raw/preparation/`. */
export function nomFichierCache(celex: string): string {
  return `${celex.replace(/[^\w.-]+/g, "_")}.xhtml`;
}

/** Position de la balise qui ouvre le premier titre de document ; `null` si absent. */
function debutDocument(xhtml: string): number | null {
  let meilleur: number | null = null;
  for (const marqueur of DEBUTS) {
    const position = xhtml.indexOf(marqueur);
    if (position < 0) continue;
    if (meilleur === null || position < meilleur) meilleur = position;
  }
  if (meilleur === null) return null;
  const balise = xhtml.lastIndexOf("<", meilleur);
  return balise < 0 ? meilleur : balise;
}

/** Fin du document : la fermeture du corps, ou la fin de la capture. */
function finDocument(xhtml: string, debut: number): number {
  const fin = xhtml.toLowerCase().lastIndexOf("</body");
  return fin > debut ? fin : xhtml.length;
}

/** Retire le pied du Journal officiel : `ELI: …` puis `ISSN …`. */
function sansPied(texte: string): string {
  const coupe = texte.lastIndexOf("ELI:");
  const sansEli = coupe > 0 ? texte.slice(0, coupe) : texte;
  return sansEli.replace(/\s*ISSN\s+\S+\s*$/, "").trim();
}

/**
 * Numéro d'affaire déclaré par le texte. Il fait foi sur la dérivation depuis le
 * CELEX : la communication nomme l'affaire telle que la Cour l'écrit.
 */
export function numeroDeclare(texte: string): string | null {
  const trouve = /\(\s*Affaire\s+([CT])[‑–—-]?\s*(\d+)\s*\/\s*(\d{2}|20\d{2})(\s*P)?\s*\)/i.exec(texte);
  if (trouve === null) return null;
  const [, lettre, numero, annee, pourvoi] = trouve;
  if (lettre === undefined || numero === undefined || annee === undefined) return null;
  const suffixe = pourvoi === undefined ? "" : " P";
  return `${lettre.toUpperCase()}-${Number(numero)}/${annee.slice(-2)}${suffixe}`;
}

/**
 * Texte d'une communication et numéro qu'elle déclare. `null` quand la capture
 * ne porte aucun titre de document : elle n'est pas une communication lisible.
 */
export function extraireCommunication(xhtml: string, celex: string): Communication | null {
  const debut = debutDocument(xhtml);
  if (debut === null) {
    // Une capture sans titre de document n'est pas une communication lisible :
    // l'appelant l'écarte avec son motif plutôt que d'arrêter la passe.
    return null;
  }
  const fragment = xhtml.slice(debut, finDocument(xhtml, debut));
  const texte = sansPied(texteVisible(fragment));
  if (texte === "") return null;
  return { numero: numeroDeclare(texte), texte };
}
