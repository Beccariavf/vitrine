/**
 * Décide si une décision CJUE listée par la citation d'un acte le reste (#143).
 *
 * CELLAR liste une décision dès que son œuvre cite l'acte, même en passant :
 * une ordonnance de résolution bancaire peut citer le Data Act sans le
 * discuter. Le texte tranche : l'acte doit figurer dans le titre ou les
 * mots-clés de l'arrêt, ou y être cité au moins deux fois dans les motifs qui
 * suivent le rappel du cadre juridique. Une mention unique, ou une mention que
 * la Cour déclare sans lien avec le litige, ne suffit pas.
 *
 * Le filtre ne s'applique qu'aux décisions retenues par le seul critère
 * `acte_cite` : celles de la matière, des notions, de la veille et des CELEX
 * complémentaires restent, comme avant #143.
 */

import { normaliserComparaison } from "../texte.ts";
import { blocsCjue } from "./parse.ts";
import type { BlocCjue } from "./parse.ts";
import type { DescripteurCjue } from "./liste.ts";

/** Nombre de lignes d'en-tête qui portent le titre et les mots-clés. */
const LIGNES_TITRE = 3;

/** Nombre minimal de citations dans les motifs hors rappel du cadre juridique. */
const CITATIONS_MIN = 2;

/** Formule par laquelle la Cour écarte un acte du litige : ses mentions ne comptent pas. */
const SANS_LIEN =
  /\baucun lien avec (?:le présent recours|le litige|la présente affaire)\b|\bnon pas la directive\b[^.]{0,120}\bmais la directive\b/;

/**
 * Numéro d'acte tel qu'il s'écrit dans un arrêt, à partir de son CELEX :
 * `32019L0790` devient `2019/790`, `31996L0009` devient `96/9`.
 */
export function numeroActe(celex: string): string | null {
  const detail = /^3(\d{4})[A-Z](\d{4})$/.exec(celex);
  if (detail === null) return null;
  const [, annee, numero] = detail;
  const court = Number(annee) < 2000 ? String(Number(annee) % 100) : String(Number(annee));
  return `${court}/${Number(numero)}`;
}

/** Motif comparable d'un numéro d'acte : « 2019/790 » se lit « 2019 790 ». */
function motifActe(numero: string): RegExp {
  const [annee, suite] = numero.split("/");
  return new RegExp(`\\b${annee} ${suite}\\b`, "g");
}

/** Titre et mots-clés de l'arrêt : les premières lignes de l'en-tête. */
function zoneTitre(blocs: readonly BlocCjue[]): string {
  const entete = blocs.find((bloc) => bloc.genre === "entete")?.texte ?? "";
  return normaliserComparaison(entete.split("\n").slice(0, LIGNES_TITRE).join(" "));
}

/**
 * Blocs des motifs qui suivent le rappel du cadre juridique et les arguments
 * des parties : le premier bloc qui porte le titre « Appréciation de la Cour »
 * (ou du Tribunal) ouvre le raisonnement de la juridiction. Le titre est
 * rattaché au bloc précédent, la numérotation commence donc au bloc suivant.
 * Sans titre reconnaissable, le chapitre « Sur le recours » sert de repère ;
 * à défaut, tous les points comptent.
 */
function blocsMotifs(blocs: readonly BlocCjue[]): BlocCjue[] {
  const sansEntete = blocs.filter((bloc) => bloc.genre !== "entete");
  const appreciation = sansEntete.findIndex((bloc) => {
    const fin = normaliserComparaison(bloc.texte).slice(-200);
    return /\bappreciation (?:de la cour|du tribunal)\b/.test(fin);
  });
  if (appreciation >= 0) return sansEntete.slice(appreciation + 1);
  const chapitre = sansEntete.findIndex((bloc) =>
    /\bsur (?:le recours|le pourvoi|les conclusions)\b/.test(normaliserComparaison(bloc.texte)),
  );
  return chapitre < 0 ? sansEntete : sansEntete.slice(chapitre + 1);
}

/** Occurrences d'un acte dans les motifs, hors blocs où la Cour le déclare sans lien. */
function citationsMotifs(blocs: readonly BlocCjue[], numero: string): number {
  const motif = motifActe(numero);
  let compte = 0;
  for (const bloc of blocsMotifs(blocs)) {
    const forme = normaliserComparaison(bloc.texte);
    if (SANS_LIEN.test(forme)) continue;
    compte += [...forme.matchAll(motif)].length;
  }
  return compte;
}

/**
 * Vrai quand l'acte cité justifie à lui seul la présence de la décision : il
 * figure dans le titre ou les mots-clés, ou il est cité au moins deux fois
 * hors du rappel du cadre juridique et des passages qui l'écartent du litige.
 */
export function acteCiteRetenu(xhtml: string, descripteur: DescripteurCjue): boolean {
  const blocs = blocsCjue(xhtml, "");
  const titre = zoneTitre(blocs);
  for (const celex of descripteur.actes_cites ?? []) {
    const numero = numeroActe(celex);
    if (numero === null) continue;
    if (motifActe(numero).test(titre)) return true;
  }
  for (const celex of descripteur.actes_cites ?? []) {
    const numero = numeroActe(celex);
    if (numero === null) continue;
    if (citationsMotifs(blocs, numero) >= CITATIONS_MIN) return true;
  }
  return false;
}
