import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Descripteur, Unite } from "./parse.ts";

/** Couverture déclarée d'un acte : ce qu'il contient et ce qu'il exclut. */
export type CouvertureActe = {
  source: string;
  date_publication: string;
  bornes: { debut: string; fin: string | null };
  statut: string;
  types_retenus: string[];
  exclusions: string[];
  comptes: { articles: number; considerants: number };
};

/** Métadonnées du corpus, écrites une fois par document. */
export type Manifeste = {
  document: string;
  titre: string;
  langue: string;
  url: string;
  licence: string;
  date_acte: string;
  date_publication: string;
  date_debut: string;
  date_fin: string | null;
  statut: string;
  /** Nom du fichier rendu par `writeRaw`, adressé par son `sha256`. */
  snapshot: string;
  unites: number;
  couverture: CouvertureActe;
};

/** Écrit un fichier UTF-8 s'il n'a pas déjà exactement ce contenu. */
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

/**
 * Écrit `manifest.json` puis `unites.jsonl` sous `data/corpus/<document>/`.
 * Deux passes sur le même corpus rendent les mêmes octets et ne réécrivent rien.
 */
export function writeCorpus(
  rootDir: string,
  descripteur: Descripteur,
  unites: Unite[],
  snapshotPath: string,
): { manifestPath: string; unitesPath: string } {
  const dossier = join(rootDir, "data", "corpus", descripteur.corpus);
  const articles = unites.filter((unite) => unite.niveau === "article").length;
  const considerants = unites.filter((unite) => unite.niveau === "considérant").length;
  const types = [
    ...(articles > 0 ? ["article"] : []),
    ...(considerants > 0 ? ["considérant"] : []),
  ];
  const manifeste: Manifeste = {
    document: descripteur.document,
    titre: descripteur.titre,
    langue: descripteur.langue,
    url: descripteur.url,
    licence: descripteur.licence,
    date_acte: descripteur.date_acte,
    date_publication: descripteur.date_publication,
    date_debut: descripteur.date_debut,
    date_fin: descripteur.date_fin,
    statut: descripteur.statut,
    snapshot: basename(snapshotPath),
    unites: unites.length,
    couverture: {
      source: `CELLAR — publications.europa.eu/resource/celex/${descripteur.document}`,
      date_publication: descripteur.date_publication,
      bornes: { debut: descripteur.date_debut, fin: descripteur.date_fin },
      statut: descripteur.statut,
      types_retenus: types,
      exclusions: [],
      comptes: { articles, considerants },
    },
  };

  const manifestPath = join(dossier, "manifest.json");
  const unitesPath = join(dossier, "unites.jsonl");
  writeIfChanged(manifestPath, `${JSON.stringify(manifeste, null, 2)}\n`);
  writeIfChanged(unitesPath, `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`);
  return { manifestPath, unitesPath };
}
