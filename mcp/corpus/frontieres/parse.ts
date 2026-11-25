/**
 * Découpe un texte UE de frontière en unités citables : ses articles, ses
 * considérants et ses annexes.
 *
 * Le corps se parse comme tout acte CELLAR — `parseConsolide` pour une version
 * consolidée, `parseCellar` pour l'acte d'origine — et chaque annexe (`anx_I`,
 * `anx_1`…) devient une unité, comme dans `donnees`.
 *
 * Les consolidations CELLAR ne portent pas de préambule : les considérants
 * viennent de l'acte d'origine, que `build.ts` capture à part. La directive
 * 96/9, antérieure au XHTML moderne, est servie dans le HTML patrimonial de
 * 1996 : ses considérants n'ont ni ancre `rct_N` ni bloc `preamble`, mais des
 * lignes `(N)` en table, la forme que `mcp/corpus/adequation/` lit déjà pour les
 * actes anciens. Les comptes du descripteur font foi : une capture incomplète
 * lève avant toute écriture.
 */

import { estConsolide, parseCellar, parseConsolide, texteVisible, uniteDe, urlVersion } from "../parse.ts";
import type { Descripteur, Unite } from "../parse.ts";

/** Ancre d'annexe : romaine (`anx_I`) ou arabe (`anx_1`). */
const ANCRE_ANNEXE = /id="(anx_[IVXLC]+|anx_\d+)"/g;

/** Ligne `(N)` d'un préambule patrimonial : le numéro seul dans une cellule, le texte dans la suivante. */
const LIGNE_CONSIDERANT =
  /<tr>\s*<td[^>]*>\s*<p class="[^"]*">\((\d+)\)<\/p>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;

/** Formule exécutoire qui clôt le préambule d'un acte patrimonial. */
const FIN_PREAMBULE = /(?:ONT|A)\s+ARR[ÊE]T[ÉE]/;

/** Vrai quand la capture porte les ancres ELI d'un acte moderne. */
function porteAncresEli(xhtml: string): boolean {
  return /id="rct_\d+"/.test(xhtml);
}

/**
 * Considérants d'un acte patrimonial : les lignes `(N)` du préambule, arrêtées à
 * la formule exécutoire. Le lien pointe l'acte, qui n'a pas d'ancre par
 * considérant. Le numéro doit suivre `1..N` sans trou.
 */
export function considerantsPatrimoniaux(xhtml: string, descripteur: Descripteur): Unite[] {
  const fin = xhtml.search(FIN_PREAMBULE);
  const bloc = fin < 0 ? xhtml : xhtml.slice(0, fin);
  const unites: Unite[] = [];
  const vus = new Set<number>();

  for (let trouve = LIGNE_CONSIDERANT.exec(bloc); trouve !== null; trouve = LIGNE_CONSIDERANT.exec(bloc)) {
    const [, numero, contenu] = trouve;
    if (numero === undefined || contenu === undefined) continue;
    const rang = Number(numero);
    if (vus.has(rang)) continue;
    const texte = texteVisible(contenu);
    if (texte === "") throw new Error(`Considérant ${numero} vide dans ${descripteur.document}`);
    vus.add(rang);
    unites.push({
      ...uniteDe(descripteur, "considérant", String(rang), `${descripteur.nom} > Considérants`, texte),
      url: descripteur.url,
    });
  }

  const attendus = descripteur.considerants_attendus;
  for (let rang = 1; rang <= attendus; rang += 1) {
    if (!vus.has(rang)) {
      throw new Error(
        `Capture ${descripteur.document} incomplète : considérant (${rang}) absent ` +
          `(${unites.length} considérants au lieu de ${attendus})`,
      );
    }
  }
  if (unites.length !== attendus) {
    throw new Error(
      `Capture ${descripteur.document} : ${unites.length} considérants au lieu de ${attendus} attendus`,
    );
  }
  return unites;
}

/**
 * Considérants de l'acte d'origine d'une consolidation : par leurs ancres ELI
 * quand il en a, par les lignes `(N)` du HTML patrimonial sinon.
 */
export function considerantsOrigine(xhtml: string, descripteur: Descripteur): Unite[] {
  if (!porteAncresEli(xhtml)) return considerantsPatrimoniaux(xhtml, descripteur);
  return parseCellar(xhtml, descripteur, "considérants").filter(
    (unite) => unite.niveau === "considérant",
  );
}

/**
 * Une unité par annexe, dans l'ordre de la capture. Une annexe va de son `<div>`
 * au `<div>` de la suivante : l'équilibrage des `<div>` de `contenuDiv` échoue
 * sur les annexes du crédit à la consommation, dont une table porte une balise
 * non refermée. Le découpage par bornes d'annexes ne dépend pas de cet
 * équilibrage et ne change rien aux autres corpus.
 */
function annexesFrontieres(xhtml: string, descripteur: Descripteur): Unite[] {
  const reperes = [...xhtml.matchAll(ANCRE_ANNEXE)].map((trouve) => ({
    ancre: trouve[1] ?? "",
    position: trouve.index ?? 0,
  }));
  const unites: Unite[] = [];
  const url = estConsolide(descripteur) ? urlVersion(descripteur.version ?? descripteur.document) : null;

  for (const [index, repere] of reperes.entries()) {
    const debut = xhtml.lastIndexOf("<div", repere.position);
    const suivant = reperes[index + 1];
    const fin = suivant === undefined ? xhtml.length : xhtml.lastIndexOf("<div", suivant.position);
    if (debut < 0 || fin <= debut) throw new Error(`Annexe ${repere.ancre} annoncée mais introuvable`);
    const texte = texteVisible(xhtml.slice(debut, fin));
    if (texte === "") throw new Error(`Annexe ${repere.ancre} vide dans ${descripteur.document}`);
    const numero = repere.ancre.slice("anx_".length);
    unites.push({
      ref: `${descripteur.document}#${repere.ancre}`,
      document: descripteur.document,
      corpus: descripteur.corpus,
      niveau: "annexe",
      numero,
      chemin: `${descripteur.nom} > Annexe ${numero}`,
      texte,
      date_acte: descripteur.date_acte,
      date_debut: descripteur.date_debut,
      date_fin: descripteur.date_fin,
      statut: descripteur.statut,
      url: url ?? `${descripteur.url}#${repere.ancre}`,
    });
  }

  const attendues = descripteur.annexes_attendues ?? 0;
  if (unites.length !== attendues) {
    throw new Error(
      `Capture ${descripteur.document} : ${unites.length} annexe(s) au lieu de ${attendues} attendues`,
    );
  }
  return unites;
}

/**
 * Unités d'un texte de frontière : considérants et articles du corps servi, puis
 * une unité par annexe, dans l'ordre du document.
 */
export function parseFrontieres(xhtml: string, descripteur: Descripteur): Unite[] {
  const corps = estConsolide(descripteur)
    ? parseConsolide(xhtml, descripteur)
    : parseCellar(xhtml, descripteur);
  return [...corps, ...annexesFrontieres(xhtml, descripteur)];
}
