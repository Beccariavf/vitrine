/**
 * Mesure la latence ajoutée par la seconde recherche du quota de textes (#171).
 *
 * Sur le jeu de #164, compare la première requête KNN de `search` (k = 5, soit
 * 50 candidats) et la seconde, bornée aux corpus texte (`corpus_parmi`, sans
 * considérant, k = 50, soit 500 candidats). Lecture seule de l'index ;
 * l'embedding vient d'Ollama et n'est pas chronométré.
 *
 *   node mcp/eval/latence-quota.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { CORPUS } from "../corpus/registre.ts";
import { cheminIndex, creerEmbedder } from "../index/build.ts";
import { openIndex, searchIndex } from "../index/search.ts";
import { lireJeu } from "./run.ts";

const RACINE = fileURLToPath(new URL("../../", import.meta.url));
const CORPUS_TEXTE = CORPUS.filter((corpus) => corpus.type === "texte").map((corpus) => corpus.nom);
const jeu = lireJeu(readFileSync(join(RACINE, "mcp/eval/questions-sources-publiees.csv"), "utf8"));
const embedder = creerEmbedder("ollama", {});
const index = openIndex(cheminIndex(RACINE));

function mediane(valeurs: number[]): number {
  const triees = [...valeurs].sort((gauche, droite) => gauche - droite);
  return triees.length % 2 === 1
    ? triees[(triees.length - 1) / 2]!
    : (triees[triees.length / 2 - 1]! + triees[triees.length / 2]!) / 2;
}

const globales: number[] = [];
const textes: number[] = [];
for (const { question } of jeu.questions) {
  const vecteur = await embedder.embedQuery(question, undefined);
  const debutGlobal = performance.now();
  searchIndex(index, vecteur, { k: 5 });
  const finGlobal = performance.now();
  searchIndex(index, vecteur, {
    k: 50,
    corpus_parmi: CORPUS_TEXTE,
    niveaux_exclus: ["considérant"],
  });
  const finTexte = performance.now();
  globales.push(finGlobal - debutGlobal);
  textes.push(finTexte - finGlobal);
}
index.db.close();

const triees = [...textes].sort((gauche, droite) => gauche - droite);
process.stdout.write(
  `${JSON.stringify(
    {
      questions: jeu.questions.length,
      modele: embedder.model,
      global_k5_mediane_ms: mediane(globales),
      texte_k50_mediane_ms: mediane(textes),
      texte_p95_ms: triees[Math.floor(triees.length * 0.95)],
      texte_min_ms: triees[0],
      texte_max_ms: triees.at(-1),
    },
    null,
    2,
  )}\n`,
);
