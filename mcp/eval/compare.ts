import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ObjetMesureJson } from "./run.ts";

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
  return refs.slice(0, 5).some((ref) => attendues.includes(ref));
}

/** Succès au rang 1 : le premier passage fourni est une référence attendue. */
function succesTop1(refs: string[], attendues: string[]): boolean {
  return attendues.includes(refs[0] ?? "");
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
 * Applique la règle figée sur la vue rendue : adopter le candidat si `b > c`,
 * `p < 0,05`, `b + c ≥ 6`, et si son top 5 rendu n'est pas inférieur de plus
 * d'une question. Le plancher de six paires discordantes interdit de conclure
 * sur un petit désaccord, même si une p-value calculée hors du test le
 * paraissait petit.
 */
export function decider(args: {
  b: number;
  c: number;
  p: number;
  baseTop5Rendu: number;
  candidatTop5Rendu: number;
}): { verdict: Verdict; raisons: string[] } {
  const { b, c, p, baseTop5Rendu, candidatTop5Rendu } = args;
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
  if (candidatTop5Rendu < baseTop5Rendu - 1) {
    return {
      verdict: "conserver",
      raisons: [
        `top 5 rendu dégradé de ${baseTop5Rendu - candidatTop5Rendu} questions ` +
          `(${baseTop5Rendu} → ${candidatTop5Rendu}) : le gain au rang 1 ne compense pas`,
      ],
    };
  }
  return {
    verdict: "adopter",
    raisons: [
      `b=${b} > c=${c}, p = ${p.toFixed(4)} < 0,05, ${discordantes} paires discordantes, ` +
        `top 5 rendu non dégradé (${baseTop5Rendu} → ${candidatTop5Rendu})`,
    ],
  };
}

/**
 * Compare deux mesures JSON. Le rang 1 rendu porte le test de McNemar ; le
 * top 5 rendu en est le garde-fou. Les vues brutes restent calculées et
 * imprimées pour la lecture, mais ne décident pas : la règle parle du rendu.
 * Les pièges et les références exactes ne tranchent pas : les premiers n'ont
 * pas de référence attendue, les secondes sont déterministes. Ils restent
 * alignés mais sortent du domaine de décision.
 */
export function analyser(base: ObjetMesureJson, candidat: ObjetMesureJson): Decision {
  const paires = aligner(base, candidat);
  const decision = paires.filter((paire) => paire.type === "conceptuelle" && !paire.piege);
  const b = decision.filter((paire) => paire.candidatTop1Rendu && !paire.baseTop1Rendu).length;
  const c = decision.filter((paire) => paire.baseTop1Rendu && !paire.candidatTop1Rendu).length;
  const p = pValueMcNemar(b, c);
  const baseTop5Rendu = decision.filter((paire) => paire.baseTop5Rendu).length;
  const candidatTop5Rendu = decision.filter((paire) => paire.candidatTop5Rendu).length;
  const baseTop1Rendu = decision.filter((paire) => paire.baseTop1Rendu).length;
  const candidatTop1Rendu = decision.filter((paire) => paire.candidatTop1Rendu).length;
  const baseTop5Brut = decision.filter((paire) => paire.baseTop5Brut).length;
  const candidatTop5Brut = decision.filter((paire) => paire.candidatTop5Brut).length;
  const baseTop1Brut = decision.filter((paire) => paire.baseTop1Brut).length;
  const candidatTop1Brut = decision.filter((paire) => paire.candidatTop1Brut).length;
  const { verdict, raisons } = decider({ b, c, p, baseTop5Rendu, candidatTop5Rendu });

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
  libelle: string,
  base: ObjetMesureJson,
  candidat: ObjetMesureJson,
  baseValeur: number,
  candidatValeur: number,
  total: number,
): string {
  return (
    `${libelle} : « ${base.modele} » ${baseValeur}/${total} ` +
    `(${pourcentage(baseValeur, total)}) ; « ${candidat.modele} » ${candidatValeur}/${total} ` +
    `(${pourcentage(candidatValeur, total)})`
  );
}

/** Rapport lisible : les deux vues, puis le verdict qui suit la vue rendue. */
export function formater(base: ObjetMesureJson, candidat: ObjetMesureJson, decision: Decision): string {
  const total = decision.questions;
  return [
    `comparaison appariée : « ${base.modele} » (référence) contre « ${candidat.modele} » (candidat)`,
    `questions alignées : ${base.questions.length}`,
    `domaine de décision : ${total} questions sémantiques`,
    ligneMetrique("top 5 brut", base, candidat, decision.baseTop5Brut, decision.candidatTop5Brut, total),
    ligneMetrique("top 5 rendu", base, candidat, decision.baseTop5Rendu, decision.candidatTop5Rendu, total),
    ligneMetrique("top 1 brut", base, candidat, decision.baseTop1Brut, decision.candidatTop1Brut, total),
    ligneMetrique("top 1 rendu", base, candidat, decision.baseTop1Rendu, decision.candidatTop1Rendu, total),
    `paires discordantes au rang 1 rendu : b = ${decision.b} (candidat seul), ` +
      `c = ${decision.c} (référence seule)`,
    `McNemar exact : p = ${decision.p}`,
    `verdict (rendu) : ${decision.verdict} — ${decision.raisons.join(" ; ")}`,
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
