/**
 * Agrège des mesures JSON de `run.ts` par champ ou par corpus, avec et sans
 * filtre. Le jeu de sources publiées couvre plusieurs collections : `run.ts`
 * mesure un groupe à la fois (`--corpus`), et ce script rend les chiffres du
 * rapport sans relire l'index.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { refSatisfaite } from "./run.ts";
import type { ObjetMesureJson } from "./run.ts";

/** Source d'une question : URL, auteur, dates, champ et corpus attendu. */
export type SourceQuestion = {
  question: string;
  champ: string;
  corpus_attendu: string;
  url: string;
  auteur: string;
  date_publication: string | null;
  date_lecture: string;
};

/** Une ligne d'agrégat : le groupe, ses effectifs et ses rangs. */
export type Agregat = {
  groupe: string;
  questions: number;
  top5: number;
  /** Rang moyen de la première bonne référence, sur les questions où elle est trouvée. */
  rang_moyen: number | null;
  mrr: number;
  confiant: number;
  confiant_top5: number;
  confiant_incorrect: number;
};

function premiereAttendue(
  entree: ObjetMesureJson["questions"][number],
): { rang: number; dansTop5: boolean } {
  const rang = entree.refs.findIndex((ref) =>
    entree.attendues.some((attendue) => refSatisfaite(ref, attendue)),
  );
  return { rang: rang === -1 ? 0 : rang + 1, dansTop5: rang >= 0 && rang < 5 };
}

function ligne(groupe: string, entrees: ObjetMesureJson["questions"]): Agregat {
  const rangs = entrees.map(premiereAttendue);
  const trouves = rangs.filter((rang) => rang.rang > 0);
  const confiantes = entrees
    .map((entree, position) => ({ entree, rang: rangs[position] }))
    .filter(({ entree }) => entree.niveau === "confiant");
  const sommeRangs = trouves.reduce((total, rang) => total + rang.rang, 0);
  const sommeInverses = trouves.reduce((total, rang) => total + 1 / rang.rang, 0);
  return {
    groupe,
    questions: entrees.length,
    top5: rangs.filter((rang) => rang.dansTop5).length,
    rang_moyen: trouves.length === 0 ? null : sommeRangs / trouves.length,
    mrr: entrees.length === 0 ? 0 : sommeInverses / entrees.length,
    confiant: confiantes.length,
    confiant_top5: confiantes.filter(({ rang }) => rang?.dansTop5 === true).length,
    confiant_incorrect: confiantes.filter(({ rang }) => rang?.dansTop5 !== true).length,
  };
}

/** Groupe les entrées d'une mesure par champ (annexe) ou par corpus déclaré. */
export function agreger(
  mesure: ObjetMesureJson,
  sources: SourceQuestion[],
  par: "champ" | "corpus",
): Agregat[] {
  const sourceParQuestion = new Map(sources.map((source) => [source.question, source]));
  const groupes = new Map<string, ObjetMesureJson["questions"]>();
  for (const entree of mesure.questions) {
    const source = sourceParQuestion.get(entree.question);
    const groupe = par === "champ" ? source?.champ : (source?.corpus_attendu ?? mesure.corpus);
    if (groupe === undefined) {
      throw new Error(`Question absente de l'annexe des sources : « ${entree.question} »`);
    }
    const liste = groupes.get(groupe) ?? [];
    liste.push(entree);
    groupes.set(groupe, liste);
  }
  return [...groupes.entries()]
    .sort(([gauche], [droite]) => gauche.localeCompare(droite, "fr"))
    .map(([groupe, entrees]) => ligne(groupe, entrees));
}

function pourcentage(succes: number, total: number): string {
  return total === 0 ? "—" : `${((succes / total) * 100).toFixed(1)} %`;
}

function rang(valeur: number | null): string {
  return valeur === null ? "absent" : valeur.toFixed(2);
}

/** Tableau Markdown d'un agrégat. */
export function formater(agregats: Agregat[], titre: string): string {
  const lignes = agregats.map(
    (agregat) =>
      `| ${agregat.groupe} | ${agregat.questions} | ${agregat.top5}/${agregat.questions} ` +
      `(${pourcentage(agregat.top5, agregat.questions)}) | ${rang(agregat.rang_moyen)} | ` +
      `${agregat.mrr.toFixed(3)} | ${agregat.confiant} | ${agregat.confiant_top5} / ` +
      `${agregat.confiant_incorrect} |`,
  );
  return [
    `### ${titre}`,
    "",
    "| groupe | questions | rappel@5 | rang moyen | MRR@5 | confiant | confiant juste / faux |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...lignes,
  ].join("\n");
}

/** Lit un fichier de mesure ; lève en le nommant s'il n'a pas la forme attendue. */
export function lireMesureFichier(chemin: string): ObjetMesureJson {
  let objet: unknown;
  try {
    objet = JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    throw new Error(`JSON illisible : ${chemin}`);
  }
  if (
    typeof objet !== "object" ||
    objet === null ||
    !Array.isArray((objet as { questions?: unknown }).questions)
  ) {
    throw new Error(`Mesure attendue (questions[]) : ${chemin}`);
  }
  return objet as ObjetMesureJson;
}

/** Fusionne plusieurs mesures d'un même jeu : les questions s'ajoutent. */
export function fusionner(mesures: ObjetMesureJson[]): ObjetMesureJson {
  const premiere = mesures[0];
  if (premiere === undefined) throw new Error("Aucune mesure à agréger");
  return {
    ...premiere,
    corpus: mesures.map((mesure) => mesure.corpus).join("+"),
    questions: mesures.flatMap((mesure) => mesure.questions),
  };
}

/** Chemins qui suivent une option répétée (`--avec a.json --avec b.json`). */
export function cheminsDe(nom: string, argv: string[]): string[] {
  const chemins: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === nom && argv[index + 1] !== undefined) chemins.push(argv[index + 1] ?? "");
  }
  return chemins;
}

function main(argv: string[]): void {
  const avec = cheminsDe("--avec", argv);
  const sans = cheminsDe("--sans", argv);
  const cheminSources = cheminsDe("--sources", argv)[0];
  if (avec.length === 0 || sans.length === 0 || cheminSources === undefined) {
    throw new Error(
      "Usage : node mcp/eval/agreger.ts --sources sources.json " +
        "--avec mesure.json [--avec …] --sans mesure.json [--sans …]",
    );
  }
  const sources = JSON.parse(readFileSync(resolve(cheminSources), "utf8")) as SourceQuestion[];
  const mesureAvec = fusionner(avec.map(lireMesureFichier));
  const mesureSans = fusionner(sans.map(lireMesureFichier));
  const blocs = [
    formater(agreger(mesureAvec, sources, "champ"), "Avec filtre corpus, par champ"),
    formater(agreger(mesureSans, sources, "champ"), "Sans filtre corpus, par champ"),
    formater(agreger(mesureAvec, sources, "corpus"), "Avec filtre corpus, par corpus"),
    formater(agreger(mesureSans, sources, "corpus"), "Sans filtre corpus, par corpus"),
  ];
  process.stdout.write(`${blocs.join("\n\n")}\n`);
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
