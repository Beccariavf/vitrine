import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { refSatisfaite } from "./run.ts";
import type { ObjetMesureJson } from "./run.ts";

/** Vue qui tranche : les passages rendus au lecteur, ou les rangs bruts de la recherche. */
export type Vue = "rendue" | "brute";

/** Nom de la configuration mesurée : l'embedder, plus le reranker quand il a tourné. */
export function libelle(objet: ObjetMesureJson): string {
  return objet.rerank === undefined
    ? objet.modele
    : `${objet.modele} + rerank ${objet.rerank.modele}`;
}

/** Une paire alignée : ce que chaque modèle réussit sur la même question, brut et rendu. */
export type Paire = {
  question: string;
  type: string;
  piege: boolean;
  baseTop5Brut: boolean;
  candidatTop5Brut: boolean;
  baseTop1Brut: boolean;
  candidatTop1Brut: boolean;
  baseTop5Rendu: boolean;
  candidatTop5Rendu: boolean;
  baseTop1Rendu: boolean;
  candidatTop1Rendu: boolean;
};

export type Verdict = "adopter" | "conserver" | "non_etabli";

export type Decision = {
  b: number;
  c: number;
  p: number;
  baseTop5Brut: number;
  candidatTop5Brut: number;
  baseTop1Brut: number;
  candidatTop1Brut: number;
  baseTop5Rendu: number;
  candidatTop5Rendu: number;
  baseTop1Rendu: number;
  candidatTop1Rendu: number;
  questions: number;
  verdict: Verdict;
  raisons: string[];
};

/**
 * Passages que le modèle rend au lecteur : un refus sous le seuil bas ne rend
 * rien, même si la recherche a classé des références. La règle figée parle du
 * « top 5 rendu » : c'est cette vue, et non `refs`, qui tranche.
 */
export function passagesRendus(entree: ObjetMesureJson["questions"][number]): string[] {
  return entree.niveau === "aucun_resultat_fiable" ? [] : entree.refs;
}

/** Succès au top 5 : une référence attendue figure parmi les cinq premiers passages fournis. */
function succesTop5(refs: string[], attendues: string[]): boolean {
  return refs.slice(0, 5).some((ref) => attendues.some((attendue) => refSatisfaite(ref, attendue)));
}

/** Succès au rang 1 : le premier passage fourni est une référence attendue. */
function succesTop1(refs: string[], attendues: string[]): boolean {
  return attendues.some((attendue) => refSatisfaite(refs[0] ?? "", attendue));
}

/**
 * Aligne deux mesures par question, dans l'ordre. Un décalage est refusé en
 * nommant la question absente : deux jeux différents ne se comparent pas.
 */
export function aligner(
  base: ObjetMesureJson,
  candidat: ObjetMesureJson,
): Paire[] {
  const nombre = Math.max(base.questions.length, candidat.questions.length);
  const paires: Paire[] = [];
  for (let index = 0; index < nombre; index += 1) {
    const gauche = base.questions[index];
    const droite = candidat.questions[index];
    if (gauche === undefined) {
      throw new Error(
        `Question absente de « ${base.modele} » au rang ${index + 1} : ` +
          `« ${droite?.question ?? "(vide)"} »`,
      );
    }
    if (droite === undefined) {
      throw new Error(
        `Question absente de « ${candidat.modele} » au rang ${index + 1} : « ${gauche.question} »`,
      );
    }
    if (gauche.question !== droite.question) {
      throw new Error(
        `Questions non appariées au rang ${index + 1} : « ${gauche.question} » ` +
          `dans « ${base.modele} », « ${droite.question} » dans « ${candidat.modele} »`,
      );
    }
    const rendusGauche = passagesRendus(gauche);
    const rendusDroite = passagesRendus(droite);
    paires.push({
      question: gauche.question,
      type: gauche.type,
      piege: gauche.piege,
      baseTop5Brut: succesTop5(gauche.refs, gauche.attendues),
      candidatTop5Brut: succesTop5(droite.refs, droite.attendues),
      baseTop1Brut: succesTop1(gauche.refs, gauche.attendues),
      candidatTop1Brut: succesTop1(droite.refs, droite.attendues),
      baseTop5Rendu: succesTop5(rendusGauche, gauche.attendues),
      candidatTop5Rendu: succesTop5(rendusDroite, droite.attendues),
      baseTop1Rendu: succesTop1(rendusGauche, gauche.attendues),
      candidatTop1Rendu: succesTop1(rendusDroite, droite.attendues),
    });
  }
  return paires;
}

/** `C(n, k)` en entiers exacts : la p-value ne dépend d'aucun flottant intermédiaire. */
function combinaison(n: number, k: number): bigint {
  let resultat = 1n;
  for (let index = 1; index <= k; index += 1) {
    resultat = (resultat * BigInt(n - k + index)) / BigInt(index);
  }
  return resultat;
}

/**
 * Test exact de McNemar bilatéral : `min(1, 2 × P(X ≤ min(b, c)))` avec
 * `X ~ Binomial(b + c, 1/2)`. Sans paire discordante, il n'y a rien à tester.
 */
export function pValueMcNemar(b: number, c: number): number {
  const total = b + c;
  if (total === 0) return 1;
  const borne = Math.min(b, c);
  let somme = 0n;
  for (let k = 0; k <= borne; k += 1) somme += combinaison(total, k);
  const p = Number(2n * somme) / Number(2n ** BigInt(total));
  return Math.min(1, p);
}

/**
 * Applique la règle figée sur la vue demandée : adopter le candidat si `b > c`,
 * `p < 0,05`, `b + c ≥ 6`, et si son top 5 n'est pas inférieur de plus d'une
 * question. Le plancher de six paires discordantes interdit de conclure sur un
 * petit désaccord, même si une p-value calculée hors du test le paraissait petit.
 */
export function decider(args: {
  b: number;
  c: number;
  p: number;
  baseTop5: number;
  candidatTop5: number;
  vue?: Vue;
}): { verdict: Verdict; raisons: string[] } {
  const { b, c, p, baseTop5, candidatTop5, vue = "rendue" } = args;
  const nomVue = vue === "brute" ? "top 5 brut" : "top 5 rendu";
  const discordantes = b + c;
  if (discordantes === 0) {
    return { verdict: "non_etabli", raisons: ["aucun désaccord entre les deux modèles"] };
  }
  if (discordantes < 6) {
    return {
      verdict: "non_etabli",
      raisons: [`moins de six paires discordantes (${discordantes}) : aucune conclusion`],
    };
  }
  if (b <= c) {
    return {
      verdict: "conserver",
      raisons: [`le candidat ne gagne pas plus de paires qu'il n'en perd (b=${b}, c=${c})`],
    };
  }
  if (p >= 0.05) {
    return {
      verdict: "non_etabli",
      raisons: [`p = ${p.toFixed(4)} ≥ 0,05 : le gain n'est pas significatif`],
    };
  }
  if (candidatTop5 < baseTop5 - 1) {
    return {
      verdict: "conserver",
      raisons: [
        `${nomVue} dégradé de ${baseTop5 - candidatTop5} questions ` +
          `(${baseTop5} → ${candidatTop5}) : le gain au rang 1 ne compense pas`,
      ],
    };
  }
  return {
    verdict: "adopter",
    raisons: [
      `b=${b} > c=${c}, p = ${p.toFixed(4)} < 0,05, ${discordantes} paires discordantes, ` +
        `${nomVue} non dégradé (${baseTop5} → ${candidatTop5})`,
    ],
  };
}

/** Succès au rang 1 de chaque mesure, dans la vue demandée. */
function rang1(paire: Paire, vue: Vue): { base: boolean; candidat: boolean } {
  return vue === "brute"
    ? { base: paire.baseTop1Brut, candidat: paire.candidatTop1Brut }
    : { base: paire.baseTop1Rendu, candidat: paire.candidatTop1Rendu };
}

/**
 * Compare deux mesures JSON. Par défaut, le rang 1 rendu porte le test de
 * McNemar et le top 5 rendu en est le garde-fou ; `--vue brute` fait décider les
 * vues brutes, seules valides quand l'échelle de similarité change. Les pièges
 * et les références exactes ne tranchent pas : les premiers n'ont pas de
 * référence attendue, les secondes sont déterministes. Ils restent alignés mais
 * sortent du domaine de décision.
 */
export function analyser(
  base: ObjetMesureJson,
  candidat: ObjetMesureJson,
  vue: Vue = "rendue",
): Decision {
  const paires = aligner(base, candidat);
  const decision = paires.filter((paire) => paire.type === "conceptuelle" && !paire.piege);
  const rangs = decision.map((paire) => rang1(paire, vue));
  const b = rangs.filter((rang) => rang.candidat && !rang.base).length;
  const c = rangs.filter((rang) => rang.base && !rang.candidat).length;
  const p = pValueMcNemar(b, c);
  const baseTop5 = decision.filter((paire) =>
    vue === "brute" ? paire.baseTop5Brut : paire.baseTop5Rendu,
  ).length;
  const candidatTop5 = decision.filter((paire) =>
    vue === "brute" ? paire.candidatTop5Brut : paire.candidatTop5Rendu,
  ).length;
  const baseTop5Rendu = decision.filter((paire) => paire.baseTop5Rendu).length;
  const candidatTop5Rendu = decision.filter((paire) => paire.candidatTop5Rendu).length;
  const baseTop1Rendu = decision.filter((paire) => paire.baseTop1Rendu).length;
  const candidatTop1Rendu = decision.filter((paire) => paire.candidatTop1Rendu).length;
  const baseTop5Brut = decision.filter((paire) => paire.baseTop5Brut).length;
  const candidatTop5Brut = decision.filter((paire) => paire.candidatTop5Brut).length;
  const baseTop1Brut = decision.filter((paire) => paire.baseTop1Brut).length;
  const candidatTop1Brut = decision.filter((paire) => paire.candidatTop1Brut).length;
  const { verdict, raisons } = decider({ b, c, p, baseTop5, candidatTop5, vue });

  return {
    b,
    c,
    p,
    baseTop5Brut,
    candidatTop5Brut,
    baseTop1Brut,
    candidatTop1Brut,
    baseTop5Rendu,
    candidatTop5Rendu,
    baseTop1Rendu,
    candidatTop1Rendu,
    questions: decision.length,
    verdict,
    raisons,
  };
}

function pourcentage(numerateur: number, denominateur: number): string {
  if (denominateur === 0) return "0,0 %";
  return `${((numerateur / denominateur) * 100).toFixed(1)} %`;
}

function ligneMetrique(
  libelleMetrique: string,
  base: ObjetMesureJson,
  candidat: ObjetMesureJson,
  baseValeur: number,
  candidatValeur: number,
  total: number,
): string {
  return (
    `${libelleMetrique} : « ${libelle(base)} » ${baseValeur}/${total} ` +
    `(${pourcentage(baseValeur, total)}) ; « ${libelle(candidat)} » ${candidatValeur}/${total} ` +
    `(${pourcentage(candidatValeur, total)})`
  );
}

/** Rapport lisible : les deux vues, puis le verdict qui suit la vue demandée. */
export function formater(
  base: ObjetMesureJson,
  candidat: ObjetMesureJson,
  decision: Decision,
  vue: Vue = "rendue",
): string {
  const total = decision.questions;
  const nomVue = vue === "brute" ? "brut" : "rendu";
  return [
    `comparaison appariée : « ${libelle(base)} » (référence) contre « ${libelle(candidat)} » (candidat)`,
    `questions alignées : ${base.questions.length}`,
    `domaine de décision : ${total} questions sémantiques`,
    ligneMetrique("top 5 brut", base, candidat, decision.baseTop5Brut, decision.candidatTop5Brut, total),
    ligneMetrique("top 5 rendu", base, candidat, decision.baseTop5Rendu, decision.candidatTop5Rendu, total),
    ligneMetrique("top 1 brut", base, candidat, decision.baseTop1Brut, decision.candidatTop1Brut, total),
    ligneMetrique("top 1 rendu", base, candidat, decision.baseTop1Rendu, decision.candidatTop1Rendu, total),
    `paires discordantes au rang 1 ${nomVue} : b = ${decision.b} (candidat seul), ` +
      `c = ${decision.c} (référence seule)`,
    `McNemar exact : p = ${decision.p}`,
    `verdict (${nomVue}) : ${decision.verdict} — ${decision.raisons.join(" ; ")}`,
  ].join("\n");
}

function lireMesure(chemin: string): ObjetMesureJson {
  let objet: unknown;
  try {
    objet = JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    throw new Error(`JSON illisible : ${chemin}`);
  }
  if (
    typeof objet !== "object" ||
    objet === null ||
    !Array.isArray((objet as { questions?: unknown }).questions) ||
    typeof (objet as { modele?: unknown }).modele !== "string"
  ) {
    throw new Error(`JSON de mesure attendu (date, modele, questions) : ${chemin}`);
  }
  return objet as ObjetMesureJson;
}

/** Vue demandée : `rendue` par défaut, `brute` sur `--vue brute`. */
export function lireVue(argv: string[]): Vue {
  const position = argv.indexOf("--vue");
  const valeur = position >= 0 ? argv[position + 1] : "rendue";
  if (valeur !== "rendue" && valeur !== "brute") {
    throw new Error(`--vue attendu rendue ou brute ; reçu « ${valeur ?? "(vide)"} »`);
  }
  return valeur;
}

/** Les deux chemins de mesure, options `--vue` retirées. */
function cheminsDeMesure(argv: string[]): [string | undefined, string | undefined] {
  const position = argv.indexOf("--vue");
  const sansOptions =
    position < 0 ? argv : [...argv.slice(0, position), ...argv.slice(position + 2)];
  return [sansOptions[0], sansOptions[1]];
}

function main(argv: string[]): void {
  const vue = lireVue(argv);
  const [cheminBase, cheminCandidat] = cheminsDeMesure(argv);
  if (cheminBase === undefined || cheminCandidat === undefined) {
    throw new Error(
      "Usage : node mcp/eval/compare.ts <mesure-reference.json> <mesure-candidat.json> [--vue brute]",
    );
  }
  const base = lireMesure(resolve(cheminBase));
  const candidat = lireMesure(resolve(cheminCandidat));
  const decision = analyser(base, candidat, vue);
  process.stdout.write(`${formater(base, candidat, decision, vue)}\n`);
  if (decision.verdict === "non_etabli") process.exitCode = 2;
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
