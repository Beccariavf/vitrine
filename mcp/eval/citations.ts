/**
 * Échantillonneur des citations d'un corpus de décisions.
 *
 * `node mcp/eval/citations.ts <corpus> --taille <n>` affiche les citations de n
 * documents pris à pas régulier dans l'ordre trié des identifiants, avec le
 * passage qui les porte : c'est le support de la relecture, pas une mesure
 * automatique. Chaque citation porte son document et sa présence au corpus ; une
 * ligne finale compte, sur tous les documents du corpus, les citations hors
 * corpus par instrument. Deux exécutions donnent la même sortie ; aucun fichier
 * n'est écrit, seul `data/corpus/` est lu.
 *
 * `node mcp/eval/citations.ts --classement` imprime le classement réel des
 * documents cités absents du corpus, celui que `npm run corpus:sync` écrit dans
 * `data/corpus/sync.json` : documents, statut, citations et autorités citantes.
 * Même lecture seule, aucun index, aucun réseau.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CORPUS_DECISIONS,
  citationsDesUnites,
  documentsPresents,
  extraireAttributions,
  marquerPresence,
} from "../corpus/citations.ts";
import type { CitationRendue } from "../corpus/citations.ts";
import { classementHorsCorpus } from "../corpus/hors-corpus.ts";
import type { Unite } from "../corpus/parse.ts";

const RACINE = fileURLToPath(new URL("../..", import.meta.url));

/** Nombre de documents relus par défaut. */
const TAILLE_DEFAUT = 5;

const USAGE =
  "Usage : node mcp/eval/citations.ts <corpus> [--taille <n>] [--root <racine>]\n" +
  "        node mcp/eval/citations.ts --classement [--root <racine>]\n" +
  `Corpus acceptés : ${CORPUS_DECISIONS.join(", ")}.`;

/** Date du jour en UTC, forme `AAAA-MM-JJ`, la même que la passe de synchronisation. */
function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/** Corpus demandé, refusé s'il n'est pas un corpus de décisions. */
export function lireCorpus(valeur: string | undefined): string {
  if (valeur === undefined || valeur === "") throw new Error(USAGE);
  if (!CORPUS_DECISIONS.includes(valeur)) {
    throw new Error(
      `Corpus « ${valeur} » hors périmètre : les citations ne se lisent que pour ` +
        `${CORPUS_DECISIONS.join(", ")}.`,
    );
  }
  return valeur;
}

/** Taille de l'échantillon : un entier au moins égal à 1. */
export function lireTaille(valeur: string | undefined): number {
  if (valeur === undefined) return TAILLE_DEFAUT;
  const taille = Number(valeur);
  if (!Number.isInteger(taille) || taille < 1) {
    throw new Error(`--taille attend un entier au moins égal à 1, reçu « ${valeur} ».`);
  }
  return taille;
}

/**
 * Documents pris à pas régulier dans une liste triée : l'échantillon ne dépend
 * que de l'ordre des identifiants, jamais d'un choix manuel.
 */
export function echantillonner<T>(elements: readonly T[], taille: number): T[] {
  if (elements.length <= taille) return [...elements];
  const pas = elements.length / taille;
  return Array.from({ length: taille }, (_, rang) => elements[Math.floor(rang * pas)]).filter(
    (element): element is T => element !== undefined,
  );
}

/** Groupes de fragments par document, dans l'ordre du fichier. */
function parDocument(unites: readonly Unite[]): Map<string, Unite[]> {
  const documents = new Map<string, Unite[]>();
  for (const unite of unites) {
    const liste = documents.get(unite.document) ?? [];
    liste.push(unite);
    documents.set(unite.document, liste);
  }
  return documents;
}

/** Lit les unités d'un corpus, sans index ni réseau. */
function lireCorpusUnites(rootDir: string, corpus: string): Unite[] {
  const chemin = join(rootDir, "data", "corpus", corpus, "unites.jsonl");
  const unites: Unite[] = [];
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    if (ligne.trim() === "") continue;
    unites.push(JSON.parse(ligne) as Unite);
  }
  return unites;
}

/** Mention d'une citation : son document et sa présence, lue dans les manifestes. */
function mention(citation: CitationRendue): string {
  return `${citation.reference} — ${citation.document} (${citation.hors_corpus ? "hors corpus" : "au corpus"})`;
}

/** Bilan des citations d'un corpus entier, tous documents confondus. */
export function compterCitations(
  rootDir: string,
  documents: Map<string, Unite[]>,
): {
  documents: number;
  citations: number;
  hors_corpus: number;
  par_instrument: [string, number][];
} {
  const presents = documentsPresents(rootDir);
  let citations = 0;
  let horsCorpus = 0;
  const parInstrument = new Map<string, number>();

  for (const fragments of documents.values()) {
    for (const citation of marquerPresence(presents, citationsDesUnites(fragments))) {
      citations += 1;
      if (!citation.hors_corpus) continue;
      horsCorpus += 1;
      const cle = `${citation.instrument} (${citation.document})`;
      parInstrument.set(cle, (parInstrument.get(cle) ?? 0) + 1);
    }
  }

  return {
    documents: documents.size,
    citations,
    hors_corpus: horsCorpus,
    par_instrument: [...parInstrument.entries()].sort(
      (gauche, droite) => droite[1] - gauche[1] || gauche[0].localeCompare(droite[0]),
    ),
  };
}

/** Sortie de l'échantillonneur, prête à relire. */
export function rendreEchantillon(rootDir: string, corpus: string, taille: number): string {
  const unites = lireCorpusUnites(rootDir, corpus);
  const documents = parDocument(unites);
  const identifiants = [...documents.keys()].sort();
  const choisis = echantillonner(identifiants, taille);
  const presents = documentsPresents(rootDir);

  const lignes = [
    `corpus ${corpus} : ${identifiants.length} documents, échantillon de ${choisis.length} ` +
      "pris à pas régulier dans l'ordre trié",
  ];

  for (const document of choisis) {
    const fragments = documents.get(document) ?? [];
    const texte = fragments.map((unite) => unite.texte).join("\n");
    const citations = marquerPresence(presents, citationsDesUnites(fragments));
    const premier = fragments[0];
    lignes.push("");
    lignes.push(
      `${document} · ${premier?.numero ?? "?"} · ${premier?.date_acte ?? "?"} · ` +
        `${fragments.length} fragments · ${citations.length} citation(s)`,
    );

    if (citations.length === 0) {
      lignes.push("  aucune citation reconnue");
      continue;
    }
    for (const citation of citations) {
      lignes.push(`  ${mention(citation)}`);
      lignes.push(`    ${citation.url ?? "(sans lien officiel)"}`);
    }
    for (const attribution of extraireAttributions(texte)) {
      lignes.push(`  ↳ ${attribution.reference}`);
      lignes.push(`    ${attribution.extrait}`);
    }
  }

  const bilan = compterCitations(rootDir, documents);
  lignes.push("");
  lignes.push(
    `Bilan sur les ${bilan.documents} documents : ${bilan.citations} citation(s), ` +
      `${bilan.hors_corpus} hors corpus.`,
  );
  lignes.push(
    bilan.par_instrument.length === 0
      ? "  aucune citation hors corpus"
      : "  hors corpus par instrument : " +
          bilan.par_instrument.map(([instrument, compte]) => `${instrument} ${compte}`).join(", "),
  );

  return `${lignes.join("\n")}\n`;
}

/**
 * Classement réel des documents cités absents du corpus : une ligne par
 * document, son statut, ses citations et les autorités qui le citent, puis le
 * total. Aucune écriture, aucun index, aucun réseau.
 */
export function rendreClassement(rootDir: string, date: string): string {
  const classement = classementHorsCorpus(rootDir, date);
  const total = classement.documents.reduce((somme, document) => somme + document.citations, 0);
  const lignes = [
    `classement des documents hors corpus au ${classement.calcule_le} : ` +
      `${classement.documents.length} document(s), ${total} citation(s)`,
  ];
  for (const document of classement.documents) {
    const autorites =
      document.autorites.length === 0
        ? ""
        : ` — ${document.autorites
            .map((autorite) => `${autorite.autorite} ${autorite.citations}`)
            .join(", ")}`;
    lignes.push(
      `${document.instrument} (${document.document}) — ${document.statut} : ` +
        `${document.citations} citation(s)${autorites}`,
    );
  }
  return `${lignes.join("\n")}\n`;
}

async function main(argv: string[]): Promise<void> {
  const positionnels = argv.filter((argument) => !argument.startsWith("--"));
  const valeurDe = (nom: string): string | undefined => {
    const position = argv.indexOf(nom);
    return position === -1 ? undefined : argv[position + 1];
  };

  const rootDir = resolve(valeurDe("--root") ?? RACINE);
  if (argv.includes("--classement")) {
    const corpus = positionnels[0];
    if (corpus !== undefined) {
      throw new Error(
        `--classement couvre les cinq corpus de décisions : aucun corpus positionnel, reçu « ${corpus} ».`,
      );
    }
    process.stdout.write(rendreClassement(rootDir, dateDuJour()));
    return;
  }

  const corpus = lireCorpus(positionnels[0]);
  const taille = lireTaille(valeurDe("--taille"));
  process.stdout.write(rendreEchantillon(rootDir, corpus, taille));
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
