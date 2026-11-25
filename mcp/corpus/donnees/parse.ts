/**
 * Découpe un acte de l'économie des données en unités citables. Le corps se
 * parse comme tout acte CELLAR (`parseCellar`) : articles et considérants. Trois
 * formes propres à ce corpus s'y ajoutent, sans toucher au parseur commun :
 *
 * - l'article unique d'un règlement d'exécution, porté par `<div id="art">` et
 *   un titre `Article unique`, sans ancre `art_N` ;
 * - les points numérotés `(1)`, `(2)`… de la partie opératoire d'une
 *   recommandation, dans le bloc `enc_1` ;
 * - chaque annexe (`anx_I`, `anx_1`…) en une unité `annexe`, son texte entier.
 *
 * Les comptes viennent du descripteur : une capture incomplète lève avant toute
 * écriture, et aucun acte n'entre au corpus par approximation. Le découpage ne
 * dépend pas du corpus : `sante_ue` l'emploie tel quel.
 */

import { contenuDiv, estConsolide, parseCellar, texteVisible } from "../parse.ts";
import type { Descripteur, Niveau, Unite } from "../parse.ts";

/** Ancre d'annexe : romaine (`anx_I`) ou arabe (`anx_1`). */
const ANCRE_ANNEXE = /id="(anx_[IVXLC]+|anx_\d+)"/g;

/** Ligne `(N)` de la partie opératoire d'une recommandation. */
const POINT =
  /<p class="(?:oj-)?normal">\((\d+)\)<\/p>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;

function uniteDe(
  descripteur: Descripteur,
  niveau: Niveau,
  numero: string,
  ancre: string,
  chemin: string,
  texte: string,
  /** Ancre de l'URL quand celle du `ref` n'existe pas dans la capture (`art`, `enc_1`). */
  urlAncre: string = ancre,
): Unite {
  return {
    ref: `${descripteur.document}#${ancre}`,
    document: descripteur.document,
    corpus: descripteur.corpus,
    niveau,
    numero,
    chemin,
    texte,
    date_acte: descripteur.date_acte,
    date_debut: descripteur.date_debut,
    date_fin: descripteur.date_fin,
    statut: descripteur.statut,
    url: `${descripteur.url}#${urlAncre}`,
  };
}

/** Points numérotés du bloc opératoire `enc_1`, dans l'ordre du document. */
function pointsOperation(xhtml: string, descripteur: Descripteur): Unite[] {
  const attendus = descripteur.points_attendus ?? 0;
  const bloc = contenuDiv(xhtml, "enc_1");
  const unites: Unite[] = [];
  if (bloc !== null) {
    for (let trouve = POINT.exec(bloc); trouve !== null; trouve = POINT.exec(bloc)) {
      const [, numero, contenu] = trouve;
      if (numero === undefined || contenu === undefined) continue;
      const texte = texteVisible(contenu);
      if (texte === "") throw new Error(`Point ${numero} vide dans ${descripteur.document}`);
      const rang = Number(numero);
      unites.push(
        uniteDe(
          descripteur,
          "point",
          String(rang),
          `point_${rang}`,
          `${descripteur.nom} > Recommandation`,
          texte,
          "enc_1",
        ),
      );
    }
  }
  if (unites.length !== attendus) {
    throw new Error(
      `Capture ${descripteur.document} : ${unites.length} point(s) au lieu de ${attendus} attendus`,
    );
  }
  return unites;
}

/** Une unité par annexe, dans l'ordre de la capture. */
function annexes(xhtml: string, descripteur: Descripteur): Unite[] {
  const attendues = descripteur.annexes_attendues ?? 0;
  const unites: Unite[] = [];
  const vues = new Set<string>();
  for (let trouve = ANCRE_ANNEXE.exec(xhtml); trouve !== null; trouve = ANCRE_ANNEXE.exec(xhtml)) {
    const ancre = trouve[1];
    if (ancre === undefined || vues.has(ancre)) continue;
    const contenu = contenuDiv(xhtml, ancre);
    if (contenu === null) throw new Error(`Annexe ${ancre} annoncée mais introuvable`);
    const texte = texteVisible(contenu);
    if (texte === "") throw new Error(`Annexe ${ancre} vide dans ${descripteur.document}`);
    vues.add(ancre);
    const numero = ancre.slice("anx_".length);
    unites.push(
      uniteDe(descripteur, "annexe", numero, ancre, `${descripteur.nom} > Annexe ${numero}`, texte),
    );
  }
  if (unites.length !== attendues) {
    throw new Error(
      `Capture ${descripteur.document} : ${unites.length} annexe(s) au lieu de ${attendues} attendues`,
    );
  }
  return unites;
}

/**
 * Article unique d'un règlement d'exécution : le titre `Article unique` n'a pas
 * d'ancre `art_N`. Le descripteur en déclare un seul.
 */
function articleUnique(xhtml: string, descripteur: Descripteur): Unite | null {
  if (descripteur.articles_attendus !== 1) return null;
  if (/id="art_\d+"/.test(xhtml)) return null;
  const contenu = contenuDiv(xhtml, "art");
  if (contenu === null) return null;
  const texte = texteVisible(contenu);
  if (texte === "") throw new Error(`Article unique vide dans ${descripteur.document}`);
  return uniteDe(descripteur, "article", "unique", "art_unique", descripteur.nom, texte, "art");
}

/**
 * Unités d'un acte du corpus `donnees` : considérants, articles (ou article
 * unique), points numérotés et annexes, dans l'ordre du document.
 */
export function parseDonnees(xhtml: string, descripteur: Descripteur): Unite[] {
  if (estConsolide(descripteur)) {
    throw new Error(
      `Capture ${descripteur.document} : consolidation ${descripteur.version} servie, ` +
        "que le parseur donnees ne découpe pas ; le descripteur doit être arbitré",
    );
  }
  const unique = articleUnique(xhtml, descripteur);
  const attendusCellar = unique === null ? descripteur.articles_attendus : 0;
  const corps = parseCellar(xhtml, { ...descripteur, articles_attendus: attendusCellar });
  return [
    ...corps,
    ...(unique === null ? [] : [unique]),
    ...pointsOperation(xhtml, descripteur),
    ...annexes(xhtml, descripteur),
  ];
}
