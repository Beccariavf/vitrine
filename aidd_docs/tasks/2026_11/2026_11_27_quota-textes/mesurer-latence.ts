/**
 * Mesure la latence ajoutée par la seconde recherche du quota de textes (#171).
 *
 * Sur le jeu de #164, compare la requête KNN globale de `search` et la seconde
 * requête bornée aux corpus texte (`corpus_parmi`, sans considérant). Lecture
 * seule de l'index ; l'embedding vient d'Ollama et n'est pas chronométré.
 *
 *   node aidd_docs/tasks/2026_11/2026_11_27_quota-textes/mesurer-latence.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { CORPUS } from "../../../../mcp/corpus/registre.ts";
import { lireJeu } from "../../../../mcp/eval/run.ts";
import { cheminIndex, creerEmbedder } from "../../../../mcp/index/build.ts";
import { openIndex, searchIndex } from "../../../../mcp/index/search.ts";

const RACINE = fileURLToPath(new URL("../../../../", import.meta.url));
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
  searchIndex(index, vecteur, { k: 50 });
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
      global_mediane_ms: mediane(globales),
      texte_mediane_ms: mediane(textes),
      texte_p95_ms: triees[Math.floor(triees.length * 0.95)],
      texte_min_ms: triees[0],
      texte_max_ms: triees.at(-1),
    },
    null,
    2,
  )}\n`,
);
