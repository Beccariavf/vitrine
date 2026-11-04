import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as sqliteVec from "sqlite-vec";
import type { Unite } from "../corpus/parse.ts";
import { createOllamaEmbedder } from "../embed/embedder.ts";
import type { Embedder } from "../embed/embedder.ts";

const RACINE = fileURLToPath(new URL("../..", import.meta.url));

/** Chemin de l'index, relatif à la racine du dépôt. */
export const INDEX_RELATIF = join("data", "corpus", "index", "index.db");

/** Nombre de passages envoyés par requête d'embedding. */
const LOT = 32;

export type MetaIndex = {
  model: string;
  dim: number;
  construit_le: string;
  unites: number;
};

export function cheminIndex(rootDir: string): string {
  return join(rootDir, INDEX_RELATIF);
}

/** Lit tous les `data/corpus/<corpus>/unites.jsonl`, dans l'ordre des fichiers. */
export function lireUnites(rootDir: string): Unite[] {
  const racineCorpus = join(rootDir, "data", "corpus");
  if (!existsSync(racineCorpus)) {
    throw new Error(`Corpus introuvable sous ${racineCorpus}. Lancez « npm run corpus:build ».`);
  }

  const unites: Unite[] = [];
  for (const entree of readdirSync(racineCorpus, { withFileTypes: true })) {
    if (!entree.isDirectory()) continue;
    const chemin = join(racineCorpus, entree.name, "unites.jsonl");
    if (!existsSync(chemin)) continue;
    for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
      if (ligne.trim() === "") continue;
      unites.push(JSON.parse(ligne) as Unite);
    }
  }
  return unites;
}

function lireMeta(db: DatabaseSync): Partial<MetaIndex> {
  try {
    const lignes = db.prepare("SELECT cle, valeur FROM meta").all() as { cle: string; valeur: string }[];
    const meta: Record<string, string> = {};
    for (const ligne of lignes) meta[ligne.cle] = ligne.valeur;
    return {
      ...(meta.model === undefined ? {} : { model: meta.model }),
      ...(meta.dim === undefined ? {} : { dim: Number(meta.dim) }),
      ...(meta.unites === undefined ? {} : { unites: Number(meta.unites) }),
    };
  } catch {
    return {};
  }
}

/**
 * Refuse de réutiliser un index construit avec un autre modèle ou une autre
 * dimension : le message nomme le fichier à supprimer.
 */
function verifierIndexExistant(chemin: string, embedder: Embedder): void {
  if (!existsSync(chemin)) return;
  const db = new DatabaseSync(chemin);
  try {
    const meta = lireMeta(db);
    if (meta.model !== undefined && meta.dim !== undefined && (meta.model !== embedder.model || meta.dim !== embedder.dim)) {
      throw new Error(
        `Index existant construit avec ${meta.model} (${meta.dim} dimensions) ; ` +
          `supprimez ${chemin} puis relancez « npm run corpus:index » ` +
          `pour ${embedder.model} (${embedder.dim} dimensions).`,
      );
    }
  } finally {
    db.close();
  }
}

const SCHEMA = (dim: number): string => `
CREATE TABLE meta (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);
CREATE TABLE unites (
  rowid INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  document TEXT NOT NULL,
  niveau TEXT NOT NULL,
  numero TEXT NOT NULL,
  chemin TEXT NOT NULL,
  texte TEXT NOT NULL,
  date_acte TEXT NOT NULL,
  date_debut TEXT NOT NULL,
  date_fin TEXT,
  statut TEXT NOT NULL,
  url TEXT NOT NULL
);
CREATE VIRTUAL TABLE vec_unites USING vec0(embedding float[${dim}] distance_metric=cosine);
`;

/** Contexte d'un passage : son chemin, puis son texte intact. */
function passage(unite: Unite): string {
  return `${unite.chemin}\n${unite.texte}`;
}

/**
 * Reconstruit `data/corpus/index/index.db` à partir de tous les corpus. Le
 * fichier n'existe qu'après renommage du temporaire : un échec ne laisse pas
 * d'index partiel.
 */
export async function buildIndex(
  rootDir: string,
  embedder: Embedder,
): Promise<{ chemin: string; unites: number }> {
  const unites = lireUnites(rootDir);
  if (unites.length === 0) {
    throw new Error("Aucune unité à indexer. Lancez « npm run corpus:build ».");
  }

  const chemin = cheminIndex(rootDir);
  verifierIndexExistant(chemin, embedder);

  const vecteurs: number[][] = [];
  for (let debut = 0; debut < unites.length; debut += LOT) {
    const lot = unites.slice(debut, debut + LOT);
    vecteurs.push(...(await embedder.embedPassages(lot.map(passage))));
  }
  if (vecteurs.length !== unites.length) {
    throw new Error(`${vecteurs.length} vecteurs pour ${unites.length} unités : index abandonné`);
  }

  mkdirSync(dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.tmp`;
  rmSync(temporaire, { force: true });

  const db = new DatabaseSync(temporaire, { allowExtension: true });
  let transaction = false;
  try {
    sqliteVec.load(db);
    db.exec(SCHEMA(embedder.dim));

    const insererUnite = db.prepare(`
      INSERT INTO unites (rowid, ref, document, niveau, numero, chemin, texte, date_acte, date_debut, date_fin, statut, url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insererVecteur = db.prepare("INSERT INTO vec_unites (rowid, embedding) VALUES (?, ?)");
    const insererMeta = db.prepare("INSERT INTO meta (cle, valeur) VALUES (?, ?)");

    db.exec("BEGIN");
    transaction = true;
    unites.forEach((unite, index) => {
      const rowid = BigInt(index + 1);
      const vecteur = vecteurs[index];
      if (vecteur === undefined) throw new Error(`Vecteur manquant pour ${unite.ref}`);
      insererUnite.run(
        rowid,
        unite.ref,
        unite.document,
        unite.niveau,
        unite.numero,
        unite.chemin,
        unite.texte,
        unite.date_acte,
        unite.date_debut,
        unite.date_fin,
        unite.statut,
        unite.url,
      );
      insererVecteur.run(rowid, JSON.stringify(vecteur));
    });
    insererMeta.run("model", embedder.model);
    insererMeta.run("dim", String(embedder.dim));
    insererMeta.run("construit_le", new Date().toISOString());
    insererMeta.run("unites", String(unites.length));
    db.exec("COMMIT");
  } catch (error) {
    if (transaction) db.exec("ROLLBACK");
    rmSync(temporaire, { force: true });
    throw error;
  } finally {
    db.close();
  }

  renameSync(temporaire, chemin);
  return { chemin, unites: unites.length };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const embedder = createOllamaEmbedder();
  const resultat = await buildIndex(valeurDe("--root", argv) ?? RACINE, embedder);
  process.stderr.write(
    `${resultat.unites} unités indexées dans ${resultat.chemin} ` +
      `(${embedder.model}, ${embedder.dim} dimensions)\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
