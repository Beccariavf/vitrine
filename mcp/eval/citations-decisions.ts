/**
 * Échantillonneur des citations entre décisions, pour la relecture de #30.
 *
 * `node mcp/eval/citations-decisions.ts <famille> [--taille <n>]` rend n
 * citations d'une famille, prises à pas régulier dans l'ordre de toutes les
 * citations du corpus — corpus et documents triés, références dans l'ordre de
 * rencontre —, chacune avec l'extrait qui
 * la porte et les décisions du corpus qu'elle désigne. Toutes les familles sont
 * lues, exposées ou non. Deux exécutions rendent la même sortie ; seul
 * `data/corpus/` est lu, rien n'est écrit.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CORPUS_DECISIONS } from "../corpus/citations.ts";
import { FAMILLES, decisionsCitees, referencesPositionnees } from "../corpus/citations-decisions.ts";
import type { Famille } from "../corpus/citations-decisions.ts";
import type { Unite } from "../corpus/parse.ts";

const RACINE = fileURLToPath(new URL("../..", import.meta.url));

export type Echantillon = {
  rang: number;
  corpus: string;
  document: string;
  reference: string;
  extrait: string;
  cibles: string[];
  /** Date donnée par le texte, quand aucune décision du corpus de ce numéro ne la porte. */
  date_divergente?: string;
};

/** Textes des documents d'un corpus, fragments recollés dans l'ordre du fichier. */
function textes(rootDir: string, corpus: string): Map<string, string> {
  const parDocument = new Map<string, string[]>();
  for (const ligne of readFileSync(join(rootDir, "data", "corpus", corpus, "unites.jsonl"), "utf8").split("\n")) {
    if (ligne.trim() === "") continue;
    const unite = JSON.parse(ligne) as Unite;
    const liste = parDocument.get(unite.document) ?? [];
    liste.push(unite.texte);
    parDocument.set(unite.document, liste);
  }
  return new Map([...parDocument].map(([document, parties]) => [document, parties.join("\n")]));
}

/** Échantillon déterministe d'une famille : pas régulier sur l'ordre trié. */
export function echantillon(rootDir: string, famille: Famille, taille: number): Echantillon[] {
  const toutes: Omit<Echantillon, "rang">[] = [];
  const familles = new Set<Famille>([famille]);
  for (const corpus of [...CORPUS_DECISIONS].sort()) {
    const documents = textes(rootDir, corpus);
    for (const document of [...documents.keys()].sort()) {
      const texte = documents.get(document) ?? "";
      const positions = new Map(
        referencesPositionnees(texte).map((r) => [r.reference, r.position] as const),
      );
      for (const citee of decisionsCitees(rootDir, corpus, document, familles)) {
        const position = positions.get(citee.reference) ?? 0;
        const normalise = texte.replace(/[‐‑‒−]/g, "-");
        toutes.push({
          corpus,
          document,
          reference: citee.reference,
          extrait: normalise.slice(Math.max(0, position - 220), position + 80).replace(/\s+/g, " "),
          cibles: citee.cibles.map((c) => `${c.document} · ${c.intitule} · ${c.date_acte}`),
          ...(citee.date_divergente === true && citee.date_citee !== undefined
            ? { date_divergente: citee.date_citee }
            : {}),
        });
      }
    }
  }
  const n = Math.min(taille, toutes.length);
  return Array.from({ length: n }, (_, rang) => ({
    rang: rang + 1,
    ...(toutes[Math.floor((rang * toutes.length) / n)] as Omit<Echantillon, "rang">),
  }));
}

function main(): void {
  const args = process.argv.slice(2);
  const famille = args[0] as Famille;
  if (!FAMILLES.includes(famille)) {
    process.stderr.write(`Usage : node mcp/eval/citations-decisions.ts <${FAMILLES.join("|")}> [--taille <n>]\n`);
    process.exitCode = 1;
    return;
  }
  const i = args.indexOf("--taille");
  const taille = i === -1 ? 40 : Number(args[i + 1]);
  for (const e of echantillon(RACINE, famille, taille)) {
    process.stdout.write(
      `#${e.rang} [${e.corpus}] ${e.document} → ${e.reference}\n` +
        `  extrait : …${e.extrait}…\n` +
        `  cibles : ${e.cibles.length === 0 ? "(hors corpus)" : e.cibles.join(" | ")}\n` +
        (e.date_divergente === undefined
          ? "\n"
          : `  date divergente : le texte date la décision du ${e.date_divergente}\n\n`),
    );
  }
}

const entree = process.argv[1];
if (entree !== undefined && import.meta.url === pathToFileURL(resolve(entree)).href) main();
