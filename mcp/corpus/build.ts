import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeRaw } from "../../veille/write.ts";
import type { FetchLike } from "../../veille/fetch.ts";
import { fetchCellar } from "./fetch.ts";
import { estConsolide, compterConsiderantsConsolide, parseCellar, parseConsolide, urlVersion } from "./parse.ts";
import type { Descripteur, Unite } from "./parse.ts";
import { parseCcs } from "./ccs/parse.ts";
import { writeCorpus } from "./write.ts";
import type { OrigineConsiderants } from "./write.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../..", import.meta.url));

export type BuildOptions = {
  rootDir?: string;
  descripteurPath?: string;
  /** Une capture locale remplace l'appel réseau ; le test ne sort jamais du disque. */
  fixturePath?: string;
  /** Capture locale de l'acte d'origine, quand une consolidation n'a pas de préambule. */
  origineFixturePath?: string;
  fetchImpl?: FetchLike;
};

export type BuildSetOptions = {
  rootDir?: string;
  /** Corpus ou document CELEX à construire seul ; absent, tous les descripteurs. */
  document?: string;
  fixturePath?: string;
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
 * Récupère (ou lit) le rendu XHTML, le parse, puis écrit le snapshot brut et le
 * corpus. Rien n'est écrit avant que le parse n'ait réussi : une capture
 * incomplète laisse la racine intacte.
 *
 * Une consolidation sans préambule ne porte aucun considérant : le corpus garde
 * ceux de l'acte d'origine, que les actes modificatifs ne touchent pas, et prend
 * les articles de la consolidation. Les deux captures sont parsées avant la
 * moindre écriture.
 */
async function construire(
  descripteur: Descripteur,
  options: BuildOptions,
): Promise<BuildResult> {
  const rootDir = options.rootDir ?? RACINE;
  const contenu =
    options.fixturePath === undefined
      ? await fetchCellar(descripteur.version ?? descripteur.document, descripteur.langue, options.fetchImpl)
      : readFileSync(options.fixturePath, "utf8");

  let unites: Unite[];
  let origine: OrigineConsiderants | undefined;
  if (descripteur.parseur === "ccs") {
    unites = parseCcs(contenu, descripteur);
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
  const { manifestPath, unitesPath } = writeCorpus(rootDir, descripteur, unites, snapshotPath, origine);

  return { unites, snapshotPath, manifestPath, unitesPath };
}

/** Construit un corpus depuis son descripteur ; le RGPD par défaut. */
export async function buildCorpus(options: BuildOptions = {}): Promise<BuildResult> {
  const descripteurPath = options.descripteurPath ?? join(ICI, "rgpd.json");
  const descripteur = JSON.parse(readFileSync(descripteurPath, "utf8")) as Descripteur;
  return construire(descripteur, options);
}

/**
 * Construit tous les descripteurs, ou un seul quand `document` nomme son
 * `corpus` (`aiact`), son identifiant CELEX ou sa version consolidée. Une capture locale ne peut servir
 * qu'à un seul corpus.
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
        descripteurs.map((descripteur) => descripteur.corpus).join(", "),
    );
  }
  if (options.fixturePath !== undefined && choisis.length > 1) {
    throw new Error("--fixture ne sert qu'un corpus : ajoutez --document <corpus>");
  }

  const resultats: BuildResult[] = [];
  for (const descripteur of choisis) {
    resultats.push(
      await construire(descripteur, {
        ...(options.rootDir === undefined ? {} : { rootDir: options.rootDir }),
        ...(options.fixturePath === undefined ? {} : { fixturePath: options.fixturePath }),
        ...(options.origineFixturePath === undefined
          ? {}
          : { origineFixturePath: options.origineFixturePath }),
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
      }),
    );
  }
  return resultats;
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
