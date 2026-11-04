import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeRaw } from "../../veille/write.ts";
import type { FetchLike } from "../../veille/fetch.ts";
import { fetchCellar } from "./fetch.ts";
import { parseRgpd } from "./parse.ts";
import type { Descripteur, Unite } from "./parse.ts";
import { writeCorpus } from "./write.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../..", import.meta.url));

export type BuildOptions = {
  rootDir?: string;
  descripteurPath?: string;
  /** Une capture locale remplace l'appel réseau ; le test ne sort jamais du disque. */
  fixturePath?: string;
  fetchImpl?: FetchLike;
};

export type BuildResult = {
  unites: Unite[];
  snapshotPath: string;
  manifestPath: string;
  unitesPath: string;
};

/**
 * Récupère (ou lit) le rendu XHTML, le parse, puis écrit le snapshot brut et le
 * corpus. Rien n'est écrit avant que le parse n'ait réussi : une capture
 * incomplète laisse la racine intacte.
 */
export async function buildCorpus(options: BuildOptions = {}): Promise<BuildResult> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteurPath = options.descripteurPath ?? join(ICI, "rgpd.json");
  const descripteur = JSON.parse(readFileSync(descripteurPath, "utf8")) as Descripteur;

  const contenu =
    options.fixturePath === undefined
      ? await fetchCellar(descripteur.document, descripteur.langue, options.fetchImpl)
      : readFileSync(options.fixturePath, "utf8");

  const unites = parseRgpd(contenu, descripteur);
  const snapshotPath = writeRaw(rootDir, contenu, "xhtml");
  const { manifestPath, unitesPath } = writeCorpus(rootDir, descripteur, unites, snapshotPath);

  return { unites, snapshotPath, manifestPath, unitesPath };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const fixturePath = valeurDe("--fixture", argv);
  const descripteurPath = valeurDe("--descripteur", argv);

  const resultat = await buildCorpus({
    ...(fixturePath === undefined ? {} : { fixturePath }),
    ...(descripteurPath === undefined ? {} : { descripteurPath }),
  });

  process.stderr.write(
    `${resultat.unites.length} unités écrites dans ${resultat.unitesPath} ` +
      `(snapshot ${resultat.snapshotPath})\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
