/**
 * Le risque de l'étiquette « confiant », mesuré sur un `--json` de `run.ts`.
 *
 * `run.ts` mesure le rappel ; ce script mesure la promesse. Pour un couple
 * (`haut`, `marge`), il dit quelle part des questions sémantiques est étiquetée
 * `confiant` (couverture) et, parmi elles, quelle part n'a pas la référence
 * attendue dans les cinq premiers passages (risque). Le risque porte donc sur
 * les seules réponses `confiantes`, jamais sur la taille du jeu : c'est ce
 * nombre qui dimensionne la borne de Wilson publiée à côté.
 *
 * Le balayage se fait sans refus (`bas = 0`) : sous `haut`, une question n'est
 * de toute façon jamais `confiante`, donc la couverture et le risque de
 * l'étiquette ne dépendent pas de `bas`. Le plancher a sa propre courbe, qui
 * dit ce qu'il refuse et ce que ce refus coûte.
 *
 * Les questions sémantiques sont celles qui ne sont ni un piège, ni une
 * référence exacte d'article : le court-circuit déterministe de `search` les
 * rend sans vecteurs, et leur niveau ne dit rien de la promesse.
 *
 * Usage :
 *   node mcp/eval/risque.ts mesure.json [autre.json ...]
 *   node mcp/eval/risque.ts mesure.json --seuils 0.69,0.74,0.01
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { niveauConfiance } from "../confidence.ts";
import { referenceExacte } from "../tools.ts";
import { lireSeuils, refSatisfaite } from "./run.ts";
import { intervalleWilson } from "../statistiques.ts";
import type { EntreeQuestionJson, ObjetMesureJson, Seuils } from "./run.ts";

/** Marges balayées : celles que `calibrer` considère aussi. */
export const MARGES: readonly number[] = [0.01, 0.02, 0.05];
/** Bornes du balayage `haut` : 0,30 à 0,95 par pas de 0,01. */
export const HAUT_MIN = 0.3;
export const HAUT_MAX = 0.95;
/** Bornes de la courbe du plancher, qui couvre la grille de `calibrer`. */
export const BAS_MIN = 0.2;
export const BAS_MAX = 0.95;

/** Une suite de centièmes, bornes incluses, sans accumulation flottante. */
export function centiemes(debut: number, fin: number): number[] {
  const valeurs: number[] = [];
  for (let centieme = Math.round(debut * 100); centieme <= Math.round(fin * 100); centieme += 1) {
    valeurs.push(centieme / 100);
  }
  return valeurs;
}

/**
 * Les questions qui portent la promesse : ni piège, ni référence exacte
 * d'article. Une référence exacte est servie sans vecteurs ; un piège n'a
 * aucune référence attendue. Ni l'une ni l'autre ne dit si l'étiquette tient.
 */
export function questionsSemantiques(entrees: EntreeQuestionJson[]): EntreeQuestionJson[] {
  return entrees.filter(
    (entree) => !entree.piege && referenceExacte(entree.question) === null,
  );
}

/** Vrai si une référence attendue figure dans les cinq premiers passages bruts. */
export function refSatisfaiteTop5(entree: EntreeQuestionJson): boolean {
  return entree.refs
    .slice(0, 5)
    .some((rendue) => entree.attendues.some((attendue) => refSatisfaite(rendue, attendue)));
}

function niveauDe(
  entree: EntreeQuestionJson,
  seuils: Seuils,
): ReturnType<typeof niveauConfiance> {
  return niveauConfiance(
    entree.similarites.map((similarite) => ({ distance: 1 - similarite })),
    false,
    seuils,
  );
}

/** Couverture et risque de l'étiquette, avec la borne haute de Wilson du risque. */
export type MesureRisque = {
  /** Questions sémantiques du jeu : le dénominateur de la couverture. */
  semantiques: number;
  /** Réponses étiquetées `confiant` : le dénominateur du risque. */
  confiantes: number;
  /** Confiantes dont aucune référence attendue n'est au top 5. */
  erreurs: number;
  couverture: number;
  /** `null` quand aucune question n'est confiante : le risque n'est pas mesuré. */
  risque: number | null;
  /** Borne haute à 95 % du risque, sur les seules confiantes ; `null` sans confiante. */
  borneHaute: number | null;
};

/**
 * Couverture et risque d'un couple de seuils. Les pièges et les références
 * exactes sont écartés du dénominateur, même si l'appelant les a transmis.
 */
export function mesurerRisque(entrees: EntreeQuestionJson[], seuils: Seuils): MesureRisque {
  const semantiques = questionsSemantiques(entrees);
  const confiantes = semantiques.filter(
    (entree) => niveauDe(entree, seuils) === "confiant",
  );
  const erreurs = confiantes.filter((entree) => !refSatisfaiteTop5(entree)).length;
  return {
    semantiques: semantiques.length,
    confiantes: confiantes.length,
    erreurs,
    couverture: semantiques.length === 0 ? 0 : confiantes.length / semantiques.length,
    risque: confiantes.length === 0 ? null : erreurs / confiantes.length,
    borneHaute:
      confiantes.length === 0 ? null : intervalleWilson(erreurs, confiantes.length)[1],
  };
}

/** Une ligne du balayage `haut × marge`, sans refus. */
export type LigneGrille = MesureRisque & { bas: number; haut: number; marge: number };

/**
 * Le balayage complet, `haut` croissant puis `marge` croissante : même entrée,
 * même sortie. `bas = 0` parce que le plancher ne déplace pas l'étiquette.
 */
export function grilleRisque(entrees: EntreeQuestionJson[]): LigneGrille[] {
  const lignes: LigneGrille[] = [];
  for (const haut of centiemes(HAUT_MIN, HAUT_MAX)) {
    for (const marge of MARGES) {
      const seuils: Seuils = { bas: 0, haut, marge };
      lignes.push({ ...seuils, ...mesurerRisque(entrees, seuils) });
    }
  }
  return lignes;
}

/** Ce que le plancher refuse à une valeur donnée, et ce que ce refus coûte. */
export type LigneRefus = {
  bas: number;
  /** Questions sémantiques sans aucun passage présenté. */
  refusees: number;
  /** Refusées dont une référence attendue était pourtant au top 5 brut. */
  justesRefusees: number;
};

/**
 * La courbe du plancher, sur les questions sémantiques. Un refus ne dépend que
 * de `bas` : `haut` et `marge` ne changent pas qu'une question soit rendue ou
 * non. `justesRefusees` chiffre le coût du refus.
 */
export function courbeRefus(
  entrees: EntreeQuestionJson[],
  valeurs: number[] = centiemes(BAS_MIN, BAS_MAX),
): LigneRefus[] {
  const semantiques = questionsSemantiques(entrees);
  return valeurs.map((bas) => {
    const refusees = semantiques.filter(
      // `haut = 2` : une similarité ne l'atteint jamais, donc aucune question
      // n'est confiante et seul le plancher décide du refus.
      (entree) => niveauDe(entree, { bas, haut: 2, marge: 0 }) === "aucun_resultat_fiable",
    );
    return {
      bas,
      refusees: refusees.length,
      justesRefusees: refusees.filter(refSatisfaiteTop5).length,
    };
  });
}

/** Lit un objet `--json` de `run.ts` ; lève si la forme manque. */
export function lireMesure(chemin: string): ObjetMesureJson {
  const brut: unknown = JSON.parse(readFileSync(chemin, "utf8"));
  if (typeof brut !== "object" || brut === null || !Array.isArray((brut as ObjetMesureJson).questions)) {
    throw new Error(`Mesure illisible (questions absentes) : ${chemin}`);
  }
  return brut as ObjetMesureJson;
}

function pourcentage(valeur: number): string {
  return `${(valeur * 100).toFixed(1)} %`;
}

function borne(valeur: number | null): string {
  return valeur === null ? "non mesuré" : pourcentage(valeur);
}

function risque(valeur: number | null): string {
  return valeur === null ? "non mesuré" : pourcentage(valeur);
}

function nombre(valeur: number, largeur: number): string {
  return String(valeur).padStart(largeur);
}

function seuil(valeur: number): string {
  return valeur.toFixed(3);
}

function entete(chemin: string, objet: ObjetMesureJson): string[] {
  const pieges = objet.questions.filter((entree) => entree.piege).length;
  const exactes = objet.questions.filter(
    (entree) => !entree.piege && referenceExacte(entree.question) !== null,
  ).length;
  const semantiques = objet.questions.length - pieges - exactes;
  return [
    `fichier : ${chemin}`,
    `jeu : ${objet.corpus}, split ${objet.split}, ${objet.questions.length} questions ` +
      `mesurées (${semantiques} sémantiques, ${pieges} pièges, ${exactes} références exactes écartées)`,
    `modèle : ${objet.modele} (${objet.dimensions} dimensions), recherche ${objet.recherche}`,
    `seuils de la mesure : bas=${seuil(objet.seuils.bas)} haut=${seuil(objet.seuils.haut)} ` +
      `marge=${seuil(objet.seuils.marge)}`,
  ];
}

const ENTETE_GRILLE =
  "haut  marge  confiantes  couverture  erreurs  risque  borne 95 %";
const ENTETE_SEUILS =
  "bas    haut   marge  confiantes  couverture  erreurs  risque  borne 95 %  " +
  "refusées  justes refusées";
const ENTETE_REFUS = "bas    refusées  justes refusées";

function ligneGrille(ligne: LigneGrille): string {
  return (
    `${seuil(ligne.haut)}  ${seuil(ligne.marge)}  ${nombre(ligne.confiantes, 10)}  ` +
    `${pourcentage(ligne.couverture).padStart(10)}  ${nombre(ligne.erreurs, 7)}  ` +
    `${risque(ligne.risque).padStart(10)}  ${borne(ligne.borneHaute).padStart(10)}`
  );
}

/** Une seule ligne, pour un triplet donné : l'étiquette et le coût du plancher. */
export function ligneSeuils(entrees: EntreeQuestionJson[], seuils: Seuils): string {
  const mesure = mesurerRisque(entrees, seuils);
  const refus = courbeRefus(entrees, [seuils.bas])[0];
  return (
    `${seuil(seuils.bas)}  ${seuil(seuils.haut)}  ${seuil(seuils.marge)}  ` +
    `${nombre(mesure.confiantes, 10)}  ${pourcentage(mesure.couverture).padStart(10)}  ` +
    `${nombre(mesure.erreurs, 7)}  ${risque(mesure.risque).padStart(10)}  ` +
    `${borne(mesure.borneHaute).padStart(10)}  ${nombre(refus?.refusees ?? 0, 8)}  ` +
    `${nombre(refus?.justesRefusees ?? 0, 14)}`
  );
}

function ligneRefus(ligne: LigneRefus): string {
  return `${seuil(ligne.bas)}  ${nombre(ligne.refusees, 8)}  ${nombre(ligne.justesRefusees, 14)}`;
}

function rapport(chemin: string, objet: ObjetMesureJson, seuils: Seuils | null): string[] {
  const lignes = entete(chemin, objet);
  if (seuils !== null) {
    lignes.push("", ENTETE_SEUILS, ligneSeuils(objet.questions, seuils));
    return lignes;
  }
  lignes.push(
    "",
    "balayage sans refus (bas = 0) : couverture = part étiquetée confiant, " +
      "risque = part des confiantes dont la référence attendue manque au top 5",
    ENTETE_GRILLE,
    ...grilleRisque(objet.questions).map(ligneGrille),
    "",
    "courbe du plancher (bas) : refusées = questions sans passage, " +
      "justes refusées = dont la référence attendue était au top 5 brut",
    ENTETE_REFUS,
    ...courbeRefus(objet.questions).map(ligneRefus),
  );
  return lignes;
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** Chemins et options ; toute option inconnue est refusée avant lecture. */
export function lireArguments(argv: string[]): { fichiers: string[]; seuils: Seuils | null } {
  const fichiers: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (argument === "--seuils") {
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) {
      throw new Error(`Option inconnue : ${argument}`);
    }
    fichiers.push(argument);
  }
  if (fichiers.length === 0) {
    throw new Error("Usage : node mcp/eval/risque.ts mesure.json [autre.json ...] [--seuils bas,haut,marge]");
  }
  return { fichiers, seuils: lireSeuils(valeurDe("--seuils", argv)) };
}

async function main(argv: string[]): Promise<void> {
  const { fichiers, seuils } = lireArguments(argv);
  const blocs = fichiers.map((fichier) =>
    rapport(fichier, lireMesure(resolve(fichier)), seuils).join("\n"),
  );
  process.stdout.write(`${blocs.join("\n\n")}\n`);
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
