import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeRaw } from "../../../veille/write.ts";
import type { FetchLike } from "../../../veille/fetch.ts";
import { validerUnitesCorpus } from "../parse.ts";
import type { Unite } from "../parse.ts";
import { descripteurDepuisDecision, parseArticlesDecision } from "./parse.ts";
import type { DecisionAdequation, DescripteurAdequation } from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));
const CELLAR = "https://publications.europa.eu/resource/celex";

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

export type BuildAdequationOptions = {
  rootDir?: string;
  descripteurPath?: string;
  fetchImpl?: FetchLike;
  /** Compte et valide sans écrire ; aucune capture n'est conservée. */
  dryRun?: boolean;
};

export type ResultatAdequation = {
  unites: Unite[];
  manifestPath: string;
  unitesPath: string;
  decisions: number;
};

type Capture = { contenu: string; extension: "xhtml" | "html" };

/**
 * Récupère la décision : XHTML CELLAR quand il existe, HTML sinon (les actes
 * antérieurs à 2004 n'ont pas de datastream XHTML).
 */
export async function fetchDecision(celex: string, fetchImpl: FetchLike = fetch): Promise<Capture> {
  const xhtml = await fetchImpl(`${CELLAR}/${celex}`, {
    headers: { Accept: "application/xhtml+xml", "Accept-Language": "fra" },
  });
  if (xhtml.ok) return { contenu: await xhtml.text(), extension: "xhtml" };

  const html = await fetchImpl(`${CELLAR}/${celex}`, {
    headers: { Accept: "text/html", "Accept-Language": "fra" },
  });
  if (!html.ok) {
    throw new Error(`CELLAR ${celex} : XHTML et HTML indisponibles (HTTP ${xhtml.status} puis ${html.status})`);
  }
  return { contenu: await html.text(), extension: "html" };
}

function writeIfChanged(path: string, content: string): void {
  try {
    if (readFileSync(path, "utf8") === content) return;
  } catch {
    // Absent : on l'écrit plus bas.
  }
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  try {
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, path);
  } finally {
    if (existsSync(tmp)) rmSync(tmp, { force: true });
  }
}

function empreinte(contenu: string): string {
  const body = contenu.endsWith("\n") ? contenu : `${contenu}\n`;
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function lireDescripteurAdequation(
  descripteurPath: string = join(ICI, "descripteur.json"),
): DescripteurAdequation {
  return JSON.parse(readFileSync(descripteurPath, "utf8")) as DescripteurAdequation;
}

/**
 * Construit `data/corpus/adequation/` depuis le descripteur-liste : une unité
 * par article de chaque décision, en vigueur ou abrogée, et un manifeste qui
 * porte la liste de référence et sa date de consultation. Rien n'est écrit
 * avant que toutes les décisions n'aient été lues et validées.
 */
export async function buildAdequation(options: BuildAdequationOptions = {}): Promise<ResultatAdequation> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurAdequation(options.descripteurPath);
  const fetchImpl = options.fetchImpl ?? fetch;

  const lues: Array<{ decision: DecisionAdequation; capture: Capture; unites: Unite[] }> = [];
  for (const decision of descripteur.decisions) {
    const capture = await fetchDecision(decision.celex, fetchImpl);
    const unites = parseArticlesDecision(
      capture.contenu,
      descripteurDepuisDecision(decision, descripteur.corpus),
    );
    lues.push({ decision, capture, unites });
  }

  const unites = lues.flatMap((lue) => lue.unites);
  validerUnitesCorpus(unites, descripteur.corpus);

  const decisions = lues.map(({ decision, capture, unites: articles }) => ({
    celex: decision.celex,
    pays: decision.pays,
    titre: decision.titre,
    date_acte: decision.date_acte,
    date_fin: decision.date_fin,
    url: decision.url,
    statut: decision.statut,
    ...(decision.motif === undefined ? {} : { motif: decision.motif }),
    ...(decision.note === undefined ? {} : { note: decision.note }),
    articles: articles.length,
    snapshot: "",
    snapshot_sha256: empreinte(capture.contenu),
  }));

  if (!options.dryRun) {
    const snapshots = lues.map(({ capture }) => writeRaw(rootDir, capture.contenu, capture.extension));
    decisions.forEach((decision, index) => {
      decision.snapshot = basename(snapshots[index] ?? "");
    });

    const manifeste = {
      corpus: descripteur.corpus,
      nom: descripteur.nom,
      liste_reference: descripteur.liste_reference,
      consulte_le: descripteur.consulte_le,
      documents: decisions.length,
      unites: unites.length,
      decisions,
      couverture: {
        source: `CELLAR — publications.europa.eu/resource/celex/ (${descripteur.liste_reference})`,
        date: descripteur.consulte_le,
        liste_reference: descripteur.liste_reference,
        exclusions: [],
        comptes: { decisions: decisions.length, articles: unites.length },
      },
    };

    const dossier = join(rootDir, "data", "corpus", descripteur.corpus);
    writeIfChanged(join(dossier, "manifest.json"), `${JSON.stringify(manifeste, null, 2)}\n`);
    writeIfChanged(
      join(dossier, "unites.jsonl"),
      `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    );
  }

  return {
    unites,
    manifestPath: join(rootDir, "data", "corpus", descripteur.corpus, "manifest.json"),
    unitesPath: join(rootDir, "data", "corpus", descripteur.corpus, "unites.jsonl"),
    decisions: decisions.length,
  };
}

function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const descripteurPath = valeurDe("--descripteur", argv);
  const resultat = await buildAdequation({
    ...(descripteurPath === undefined ? {} : { descripteurPath }),
    ...(argv.includes("--dry-run") ? { dryRun: true } : {}),
  });
  process.stderr.write(
    `${resultat.decisions} décisions, ${resultat.unites.length} unités` +
      `${argv.includes("--dry-run") ? " (aucune écriture)" : ` écrites dans ${resultat.unitesPath}`}\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
