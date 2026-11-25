import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeRaw } from "../../veille/write.ts";
import type { FetchLike } from "../../veille/fetch.ts";
import { fetchCellar } from "./fetch.ts";
import { estConsolide, compterConsiderantsConsolide, parseCellar, parseConsolide, urlVersion } from "./parse.ts";
import type { Descripteur, Unite } from "./parse.ts";
import { parseCcs } from "./ccs/parse.ts";
import { parseDonnees } from "./donnees/parse.ts";
import { writeCorpus, writeCorpusMulti } from "./write.ts";
import type { DocumentCorpus, OrigineConsiderants } from "./write.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../..", import.meta.url));

export type BuildOptions = {
  rootDir?: string;
  descripteurPath?: string;
  /** Une capture locale remplace l'appel réseau ; le test ne sort jamais du disque. */
  fixturePath?: string;
  /** Captures locales par CELEX, quand un corpus porte plusieurs documents. */
  fixtures?: Readonly<Record<string, string>>;
  /** Capture locale de l'acte d'origine, quand une consolidation n'a pas de préambule. */
  origineFixturePath?: string;
  fetchImpl?: FetchLike;
};

export type BuildSetOptions = {
  rootDir?: string;
  /** Corpus ou document CELEX à construire seul ; absent, tous les descripteurs. */
  document?: string;
  fixturePath?: string;
  /** Captures locales par CELEX, quand un corpus porte plusieurs documents. */
  fixtures?: Readonly<Record<string, string>>;
  /** Capture locale de l'acte d'origine, quand une consolidation n'a pas de préambule. */
  origineFixturePath?: string;
  fetchImpl?: FetchLike;
};

export type BuildResult = {
  unites: Unite[];
  snapshotPath: string;
  manifestPath: string;
  unitesPath: string;
};

/** Tous les descripteurs de `mcp/corpus/*.json`, dans l'ordre des noms de fichier. */
export function lireDescripteurs(dossier = ICI): Descripteur[] {
  return readdirSync(dossier)
    .filter((fichier) => fichier.endsWith(".json"))
    .sort()
    .map((fichier) => JSON.parse(readFileSync(join(dossier, fichier), "utf8")) as Descripteur);
}

/**
 * Récupère (ou lit) le rendu XHTML, le parse, puis écrit le snapshot brut. Rien
 * n'est écrit avant que le parse n'ait réussi : une capture incomplète laisse la
 * racine intacte. Le manifeste est écrit par l'appelant, qui regroupe les
 * documents d'un même corpus.
 *
 * Une consolidation sans préambule ne porte aucun considérant : le corpus garde
 * ceux de l'acte d'origine, que les actes modificatifs ne touchent pas, et prend
 * les articles de la consolidation. Les deux captures sont parsées avant la
 * moindre écriture.
 */
async function construire(
  descripteur: Descripteur,
  options: BuildOptions,
): Promise<DocumentCorpus> {
  const rootDir = options.rootDir ?? RACINE;
  const fixturePath = options.fixturePath ?? options.fixtures?.[descripteur.document];
  const contenu =
    fixturePath === undefined
      ? await fetchCellar(descripteur.version ?? descripteur.document, descripteur.langue, options.fetchImpl)
      : readFileSync(fixturePath, "utf8");

  let unites: Unite[];
  let origine: OrigineConsiderants | undefined;
  if (descripteur.parseur === "ccs") {
    unites = parseCcs(contenu, descripteur);
  } else if (descripteur.parseur === "donnees" || descripteur.parseur === "sante_ue") {
    unites = parseDonnees(contenu, descripteur);
  } else if (estConsolide(descripteur)) {
    if (compterConsiderantsConsolide(contenu) === 0 && descripteur.considerants_attendus > 0) {
      const contenuOrigine =
        options.origineFixturePath === undefined
          ? await fetchCellar(descripteur.document, descripteur.langue, options.fetchImpl)
          : readFileSync(options.origineFixturePath, "utf8");
      // Les considérants viennent de l'acte d'origine : leur lien pointe cet acte,
      // même quand le descripteur sert l'URL de la consolidation.
      const descripteurOrigine = { ...descripteur, url: urlVersion(descripteur.document) };
      const considerants = parseCellar(contenuOrigine, descripteurOrigine, "considérants").filter(
        (unite) => unite.niveau === "considérant",
      );
      const articles = parseConsolide(contenu, { ...descripteur, considerants_attendus: 0 });
      unites = [...considerants, ...articles];
      origine = { document: descripteur.document, snapshotPath: writeRaw(rootDir, contenuOrigine, "xhtml") };
    } else {
      unites = parseConsolide(contenu, descripteur);
    }
  } else {
    unites = parseCellar(contenu, descripteur);
  }

  const snapshotPath = writeRaw(rootDir, contenu, "xhtml");
  return {
    descripteur,
    unites,
    snapshotPath,
    ...(origine === undefined ? {} : { origine }),
  };
}

/** Nom d'un corpus qui porte plusieurs documents, pour son manifeste. */
const NOMS_CORPUS: Readonly<Record<string, string>> = {
  ccs: "Clauses contractuelles types",
  donnees: "Textes UE de l'économie des données",
  sante_ue: "Espace européen des données de santé",
};

/**
 * Écrit les documents construits, un corpus à la fois. Un corpus qui n'a qu'un
 * document garde son manifeste à plat ; un corpus à plusieurs documents écrit un
 * manifeste à `documents[]` et un seul `unites.jsonl`, sans écraser l'autre.
 */
function ecrireCorpus(
  rootDir: string,
  constructions: readonly DocumentCorpus[],
): Map<DocumentCorpus, BuildResult> {
  const parCorpus = new Map<string, DocumentCorpus[]>();
  for (const construction of constructions) {
    const groupe = parCorpus.get(construction.descripteur.corpus) ?? [];
    groupe.push(construction);
    parCorpus.set(construction.descripteur.corpus, groupe);
  }

  const resultats = new Map<DocumentCorpus, BuildResult>();
  for (const [corpus, groupe] of parCorpus) {
    let ecrit: { manifestPath: string; unitesPath: string };
    let ordonne = groupe;
    if (groupe.length === 1) {
      const seul = groupe[0]!;
      ecrit = writeCorpus(rootDir, seul.descripteur, seul.unites, seul.snapshotPath, seul.origine);
    } else {
      // L'ordre est stable : date de l'acte, puis CELEX. 2021/914 passe avant 2021/915.
      ordonne = [...groupe].sort(
        (gauche, droite) =>
          gauche.descripteur.date_acte.localeCompare(droite.descripteur.date_acte) ||
          gauche.descripteur.document.localeCompare(droite.descripteur.document),
      );
      ecrit = writeCorpusMulti(rootDir, corpus, NOMS_CORPUS[corpus] ?? corpus, ordonne);
    }
    for (const construction of ordonne) {
      resultats.set(construction, {
        unites: construction.unites,
        snapshotPath: construction.snapshotPath,
        manifestPath: ecrit.manifestPath,
        unitesPath: ecrit.unitesPath,
      });
    }
  }
  return resultats;
}

/** Construit un corpus depuis son descripteur ; le RGPD par défaut. */
export async function buildCorpus(options: BuildOptions = {}): Promise<BuildResult> {
  const descripteurPath = options.descripteurPath ?? join(ICI, "rgpd.json");
  const descripteur = JSON.parse(readFileSync(descripteurPath, "utf8")) as Descripteur;
  // Un corpus à plusieurs documents ne s'écrit pas document par document : le
  // manifeste plat du dernier écraserait celui des autres.
  const memeCorpus = lireDescripteurs().filter((candidat) => candidat.corpus === descripteur.corpus);
  if (memeCorpus.length > 1) {
    throw new Error(
      `Le corpus « ${descripteur.corpus} » porte ${memeCorpus.length} documents : ` +
        `lancez « npm run corpus:build -- --document ${descripteur.corpus} »`,
    );
  }
  const construction = await construire(descripteur, options);
  const ecrit = writeCorpus(
    options.rootDir ?? RACINE,
    descripteur,
    construction.unites,
    construction.snapshotPath,
    construction.origine,
  );
  return { unites: construction.unites, snapshotPath: construction.snapshotPath, ...ecrit };
}

/**
 * Construit tous les descripteurs, ou ceux qu'un `document` nomme par `corpus`,
 * identifiant CELEX ou version consolidée. Un corpus à plusieurs documents se
 * construit d'un bloc : écrire un seul de ses documents écraserait le manifeste
 * des autres. Une capture locale ne peut servir qu'à un seul corpus ; `fixtures`
 * en donne une par CELEX.
 */
export async function buildCorpusSet(options: BuildSetOptions = {}): Promise<BuildResult[]> {
  const descripteurs = lireDescripteurs();
  const choisis =
    options.document === undefined
      ? descripteurs
      : descripteurs.filter(
          (descripteur) =>
            descripteur.corpus === options.document ||
            descripteur.document === options.document ||
            descripteur.version === options.document,
        );

  if (choisis.length === 0) {
    throw new Error(
      `Aucun descripteur pour « ${options.document} » : ` +
        [...new Set(descripteurs.map((descripteur) => descripteur.corpus))].join(", "),
    );
  }

  const parCorpus = new Map<string, Descripteur[]>();
  for (const descripteur of descripteurs) {
    const groupe = parCorpus.get(descripteur.corpus) ?? [];
    groupe.push(descripteur);
    parCorpus.set(descripteur.corpus, groupe);
  }
  const corpusMulti = new Set(
    [...parCorpus.entries()].filter(([, groupe]) => groupe.length > 1).map(([corpus]) => corpus),
  );
  const ensemble = descripteurs.filter(
    (descripteur) =>
      choisis.includes(descripteur) ||
      (corpusMulti.has(descripteur.corpus) && choisis.some((choisi) => choisi.corpus === descripteur.corpus)),
  );

  if (options.fixturePath !== undefined && ensemble.length > 1) {
    throw new Error("--fixture ne sert qu'un document : ajoutez --document <corpus>");
  }

  const constructions: DocumentCorpus[] = [];
  for (const descripteur of ensemble) {
    constructions.push(
      await construire(descripteur, {
        ...(options.rootDir === undefined ? {} : { rootDir: options.rootDir }),
        ...(options.fixturePath === undefined ? {} : { fixturePath: options.fixturePath }),
        ...(options.fixtures === undefined ? {} : { fixtures: options.fixtures }),
        ...(options.origineFixturePath === undefined
          ? {}
          : { origineFixturePath: options.origineFixturePath }),
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
      }),
    );
  }

  const ecrits = ecrireCorpus(options.rootDir ?? RACINE, constructions);
  return constructions.map((construction) => ecrits.get(construction)!);
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const fixturePath = valeurDe("--fixture", argv);
  const descripteurPath = valeurDe("--descripteur", argv);
  const document = valeurDe("--document", argv);

  const resultats =
    descripteurPath === undefined
      ? await buildCorpusSet({
          ...(fixturePath === undefined ? {} : { fixturePath }),
          ...(document === undefined ? {} : { document }),
        })
      : [
          await buildCorpus({
            ...(fixturePath === undefined ? {} : { fixturePath }),
            descripteurPath,
          }),
        ];

  for (const resultat of resultats) {
    process.stderr.write(
      `${resultat.unites.length} unités écrites dans ${resultat.unitesPath} ` +
        `(snapshot ${resultat.snapshotPath})\n`,
    );
  }
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
