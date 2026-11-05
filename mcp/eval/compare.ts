import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ObjetMesureJson } from "./run.ts";

/** Une paire alignée : ce que chaque modèle réussit sur la même question. */
export type Paire = {
  question: string;
  type: string;
  piege: boolean;
  baseTop5: boolean;
  candidatTop5: boolean;
  baseTop1: boolean;
  candidatTop1: boolean;
};

export type Verdict = "adopter" | "conserver" | "non_etabli";

export type Decision = {
  b: number;
  c: number;
  p: number;
  baseTop5: number;
  candidatTop5: number;
  baseTop1: number;
  candidatTop1: number;
  questions: number;
  verdict: Verdict;
  raisons: string[];
};

/** Succès au top 5 : une référence attendue figure parmi les cinq passages rendus. */
function succesTop5(entree: ObjetMesureJson["questions"][number]): boolean {
  return entree.refs
    .slice(0, 5)
    .some((ref) => entree.attendues.includes(ref));
}

/** Succès au rang 1 : le premier passage rendu est une référence attendue. */
function succesTop1(entree: ObjetMesureJson["questions"][number]): boolean {
  return entree.attendues.includes(entree.refs[0] ?? "");
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
    paires.push({
      question: gauche.question,
      type: gauche.type,
      piege: gauche.piege,
      baseTop5: succesTop5(gauche),
      candidatTop5: succesTop5(droite),
      baseTop1: succesTop1(gauche),
      candidatTop1: succesTop1(droite),
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
 * Applique la règle figée : adopter le candidat si `b > c`, `p < 0,05`,
 * `b + c ≥ 6`, et si son top 5 n'est pas inférieur de plus d'une question.
 * Le plancher de six paires discordantes interdit de conclure sur un petit
 * désaccord, même si une p-value calculée hors du test le paraissait petit.
 */
export function decider(args: {
  b: number;
  c: number;
  p: number;
  baseTop5: number;
  candidatTop5: number;
}): { verdict: Verdict; raisons: string[] } {
  const { b, c, p, baseTop5, candidatTop5 } = args;
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
        `top 5 rendu dégradé de ${baseTop5 - candidatTop5} questions ` +
          `(${baseTop5} → ${candidatTop5}) : le gain au rang 1 ne compense pas`,
      ],
    };
  }
  return {
    verdict: "adopter",
    raisons: [
      `b=${b} > c=${c}, p = ${p.toFixed(4)} < 0,05, ${discordantes} paires discordantes, ` +
        `top 5 rendu non dégradé (${baseTop5} → ${candidatTop5})`,
    ],
  };
}

/**
 * Compare deux mesures JSON. Le rang 1 porte le test de McNemar ; le top 5 en
 * est le garde-fou. Les pièges et les références exactes ne tranchent pas : les
 * premiers n'ont pas de référence attendue, les secondes sont déterministes.
 * Ils restent alignés mais sortent du domaine de décision.
 */
export function analyser(base: ObjetMesureJson, candidat: ObjetMesureJson): Decision {
  const paires = aligner(base, candidat);
  const decision = paires.filter((paire) => paire.type === "conceptuelle" && !paire.piege);
  const b = decision.filter((paire) => paire.candidatTop1 && !paire.baseTop1).length;
  const c = decision.filter((paire) => paire.baseTop1 && !paire.candidatTop1).length;
  const p = pValueMcNemar(b, c);
  const baseTop5 = decision.filter((paire) => paire.baseTop5).length;
  const candidatTop5 = decision.filter((paire) => paire.candidatTop5).length;
  const baseTop1 = decision.filter((paire) => paire.baseTop1).length;
  const candidatTop1 = decision.filter((paire) => paire.candidatTop1).length;
  const { verdict, raisons } = decider({ b, c, p, baseTop5, candidatTop5 });

  return {
    b,
    c,
    p,
    baseTop5,
    candidatTop5,
    baseTop1,
    candidatTop1,
    questions: decision.length,
    verdict,
    raisons,
  };
}

function pourcentage(numerateur: number, denominateur: number): string {
  if (denominateur === 0) return "0,0 %";
  return `${((numerateur / denominateur) * 100).toFixed(1)} %`;
}

/** Rapport lisible : les comptes d'abord, le verdict ensuite. */
export function formater(base: ObjetMesureJson, candidat: ObjetMesureJson, decision: Decision): string {
  return [
    `comparaison appariée : « ${base.modele} » (référence) contre « ${candidat.modele} » (candidat)`,
    `questions alignées : ${base.questions.length}`,
    `domaine de décision : ${decision.questions} questions sémantiques`,
    `top 5 rendu : « ${base.modele} » ${decision.baseTop5}/${decision.questions} ` +
      `(${pourcentage(decision.baseTop5, decision.questions)}) ; ` +
      `« ${candidat.modele} » ${decision.candidatTop5}/${decision.questions} ` +
      `(${pourcentage(decision.candidatTop5, decision.questions)})`,
    `top 1 rendu : « ${base.modele} » ${decision.baseTop1}/${decision.questions} ` +
      `(${pourcentage(decision.baseTop1, decision.questions)}) ; ` +
      `« ${candidat.modele} » ${decision.candidatTop1}/${decision.questions} ` +
      `(${pourcentage(decision.candidatTop1, decision.questions)})`,
    `paires discordantes au rang 1 : b = ${decision.b} (candidat seul), ` +
      `c = ${decision.c} (référence seule)`,
    `McNemar exact : p = ${decision.p}`,
    `verdict : ${decision.verdict} — ${decision.raisons.join(" ; ")}`,
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

function main(argv: string[]): void {
  const [cheminBase, cheminCandidat] = argv;
  if (cheminBase === undefined || cheminCandidat === undefined) {
    throw new Error(
      "Usage : node mcp/eval/compare.ts <mesure-reference.json> <mesure-candidat.json>",
    );
  }
  const base = lireMesure(resolve(cheminBase));
  const candidat = lireMesure(resolve(cheminCandidat));
  const decision = analyser(base, candidat);
  process.stdout.write(`${formater(base, candidat, decision)}\n`);
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
