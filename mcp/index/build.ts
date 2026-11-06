import { createHash } from "node:crypto";
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

/** Le delta d'une construction : ce qui a été ajouté, modifié, supprimé, gardé. */
export type DeltaIndex = {
  ajoutees: number;
  modifiees: number;
  supprimees: number;
  inchangees: number;
};

export type ResultatBuild = {
  chemin: string;
  unites: number;
  delta: DeltaIndex;
  mode: "complet" | "incremental";
  /** Renseigné en mode complet quand l'index existant n'était pas réutilisable. */
  raison?: string;
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
      const unite = JSON.parse(ligne) as Unite;
      if (typeof unite.corpus !== "string" || unite.corpus === "") {
        throw new Error(
          `Unité sans corpus dans ${chemin} (${unite.ref}) : ` +
            "régénérez le corpus avec « npm run corpus:build ».",
        );
      }
      unites.push(unite);
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

const SCHEMA = (dim: number): string => `
CREATE TABLE meta (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);
CREATE TABLE unites (
  rowid INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  document TEXT NOT NULL,
  corpus TEXT NOT NULL,
  niveau TEXT NOT NULL,
  numero TEXT NOT NULL,
  chemin TEXT NOT NULL,
  texte TEXT NOT NULL,
  date_acte TEXT NOT NULL,
  date_debut TEXT NOT NULL,
  date_fin TEXT,
  statut TEXT NOT NULL,
  url TEXT NOT NULL,
  empreinte TEXT NOT NULL
);
CREATE VIRTUAL TABLE vec_unites USING vec0(corpus TEXT, document TEXT, embedding float[${dim}] distance_metric=cosine);
CREATE VIRTUAL TABLE fts_unites USING fts5(chemin, texte, tokenize="unicode61 remove_diacritics 2");
`;

/** Contexte d'un passage : son chemin, puis son texte intact. */
function passage(unite: Unite): string {
  return `${unite.chemin}\n${unite.texte}`;
}

/** Vérifie que `node:sqlite` expose FTS5 avant de bâtir un index neuf. */
function verifierFts5(db: DatabaseSync): void {
  try {
    db.exec("CREATE VIRTUAL TABLE temp.fts5_sonde USING fts5(x)");
    db.exec("DROP TABLE temp.fts5_sonde");
  } catch {
    throw new Error("Ce Node n'expose pas FTS5 : impossible de construire la voie lexicale.");
  }
}

/**
 * Empreinte du vecteur d'une unité : le modèle, la dimension et le passage
 * contextualisé. Elle change dès que l'embedding changerait, sans toucher aux
 * autres champs d'affichage.
 */
export function empreinteUnite(unite: Unite, embedder: Embedder): string {
  return createHash("sha256")
    .update(`${embedder.model}\n${embedder.dim}\n${passage(unite)}`)
    .digest("hex");
}

type LigneIndex = { ref: string; rowid: number; empreinte: string };

type Existant =
  | { compatible: true; db: DatabaseSync; lignes: LigneIndex[]; maxRowid: number }
  | { compatible: false; raison: string };

/**
 * Ouvre l'index existant seulement s'il est lisible, du même modèle et de la
 * même dimension, et s'il porte l'empreinte. Sinon, la construction complète
 * reprend, avec une raison explicite.
 */
function ouvrirExistant(chemin: string, embedder: Embedder): Existant {
  if (!existsSync(chemin)) return { compatible: false, raison: "index absent" };

  let db: DatabaseSync;
  try {
    db = new DatabaseSync(chemin, { allowExtension: true });
  } catch {
    return { compatible: false, raison: "index illisible" };
  }

  try {
    sqliteVec.load(db);
    const meta = lireMeta(db);
    if (meta.model !== embedder.model || meta.dim !== embedder.dim) {
      db.close();
      return {
        compatible: false,
        raison:
          `index construit avec ${meta.model ?? "un modèle inconnu"} ` +
          `(${meta.dim ?? "?"} dimensions)`,
      };
    }

    const colonnes = db.prepare("PRAGMA table_info(unites)").all() as { name: string }[];
    if (!colonnes.some((colonne) => colonne.name === "empreinte")) {
      db.close();
      return { compatible: false, raison: "index sans empreinte" };
    }
    if (!colonnes.some((colonne) => colonne.name === "corpus")) {
      db.close();
      return {
        compatible: false,
        raison: "index sans colonne corpus (reconstruire avec « npm run corpus:index »)",
      };
    }

    const fts = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fts_unites'")
      .get();
    if (fts === undefined) {
      db.close();
      return { compatible: false, raison: "index sans table lexicale" };
    }

    const lignes = db.prepare("SELECT ref, rowid, empreinte FROM unites").all() as {
      ref: string;
      rowid: number | bigint;
      empreinte: string;
    }[];
    const maximum = db.prepare("SELECT max(rowid) AS maximum FROM unites").get() as {
      maximum: number | bigint | null;
    };
    return {
      compatible: true,
      db,
      lignes: lignes.map((ligne) => ({
        ref: ligne.ref,
        rowid: Number(ligne.rowid),
        empreinte: ligne.empreinte,
      })),
      maxRowid: maximum.maximum === null ? 0 : Number(maximum.maximum),
    };
  } catch {
    try {
      db.close();
    } catch {
      // La base reste inutilisable ; la construction complète la remplacera.
    }
    return { compatible: false, raison: "index illisible" };
  }
}

type Delta = {
  ajoutees: Unite[];
  modifiees: Unite[];
  supprimees: LigneIndex[];
  inchangees: Unite[];
};

function calculerDelta(
  lignes: LigneIndex[],
  unites: Unite[],
  empreintes: Map<string, string>,
): Delta {
  const parRef = new Map(lignes.map((ligne) => [ligne.ref, ligne]));
  const refsCorpus = new Set(unites.map((unite) => unite.ref));

  const ajoutees: Unite[] = [];
  const modifiees: Unite[] = [];
  const inchangees: Unite[] = [];
  for (const unite of unites) {
    const existante = parRef.get(unite.ref);
    if (existante === undefined) ajoutees.push(unite);
    else if (existante.empreinte !== empreintes.get(unite.ref)) modifiees.push(unite);
    else inchangees.push(unite);
  }
  return {
    ajoutees,
    modifiees,
    supprimees: lignes.filter((ligne) => !refsCorpus.has(ligne.ref)),
    inchangees,
  };
}

/** Embarque les passages par lots et rend un vecteur par `ref`. */
async function embarquer(
  unites: Unite[],
  embedder: Embedder,
): Promise<Map<string, number[]>> {
  const vecteurs = new Map<string, number[]>();
  for (let debut = 0; debut < unites.length; debut += LOT) {
    const lot = unites.slice(debut, debut + LOT);
    const rendus = await embedder.embedPassages(lot.map(passage));
    if (rendus.length !== lot.length) {
      throw new Error(`${rendus.length} vecteurs pour ${lot.length} unités : index abandonné`);
    }
    lot.forEach((unite, index) => {
      const vecteur = rendus[index];
      if (vecteur === undefined) throw new Error(`Vecteur manquant pour ${unite.ref}`);
      vecteurs.set(unite.ref, vecteur);
    });
  }
  return vecteurs;
}

/** Écrit un index neuf dans `chemin.tmp`, puis le renomme : aucun index partiel. */
async function construireComplet(
  chemin: string,
  unites: Unite[],
  empreintes: Map<string, string>,
  embedder: Embedder,
): Promise<void> {
  const vecteurs = await embarquer(unites, embedder);

  mkdirSync(dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.tmp`;
  rmSync(temporaire, { force: true });

  const db = new DatabaseSync(temporaire, { allowExtension: true });
  let transaction = false;
  try {
    sqliteVec.load(db);
    verifierFts5(db);
    db.exec(SCHEMA(embedder.dim));

    const insererUnite = db.prepare(`
      INSERT INTO unites (rowid, ref, document, corpus, niveau, numero, chemin, texte, date_acte, date_debut, date_fin, statut, url, empreinte)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insererVecteur = db.prepare("INSERT INTO vec_unites (rowid, corpus, document, embedding) VALUES (?, ?, ?, ?)");
    const insererFts = db.prepare(
      "INSERT INTO fts_unites (rowid, chemin, texte) VALUES (?, ?, ?)",
    );
    const insererMeta = db.prepare("INSERT INTO meta (cle, valeur) VALUES (?, ?)");

    db.exec("BEGIN");
    transaction = true;
    unites.forEach((unite, index) => {
      const rowid = BigInt(index + 1);
      const vecteur = vecteurs.get(unite.ref);
      if (vecteur === undefined) throw new Error(`Vecteur manquant pour ${unite.ref}`);
      insererUnite.run(
        rowid,
        unite.ref,
        unite.document,
        unite.corpus,
        unite.niveau,
        unite.numero,
        unite.chemin,
        unite.texte,
        unite.date_acte,
        unite.date_debut,
        unite.date_fin,
        unite.statut,
        unite.url,
        empreintes.get(unite.ref) ?? "",
      );
      insererVecteur.run(rowid, unite.corpus, unite.document, JSON.stringify(vecteur));
      insererFts.run(rowid, unite.chemin, unite.texte);
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
}

/** Applique le delta dans une transaction ; un échec annule tout. */
async function appliquerDelta(
  db: DatabaseSync,
  delta: Delta,
  empreintes: Map<string, string>,
  embedder: Embedder,
  maxRowid: number,
  total: number,
): Promise<void> {
  const aEmbarquer = [...delta.ajoutees, ...delta.modifiees];
  const vecteurs = await embarquer(aEmbarquer, embedder);

  const supprimerVecteur = db.prepare("DELETE FROM vec_unites WHERE rowid = ?");
  const supprimerUnite = db.prepare("DELETE FROM unites WHERE rowid = ?");
  const supprimerFts = db.prepare("DELETE FROM fts_unites WHERE rowid = ?");
  const insererFts = db.prepare(
    "INSERT INTO fts_unites (rowid, chemin, texte) VALUES (?, ?, ?)",
  );
  const modifierUnite = db.prepare(`
    UPDATE unites
       SET document = ?, corpus = ?, niveau = ?, numero = ?, chemin = ?, texte = ?, date_acte = ?,
           date_debut = ?, date_fin = ?, statut = ?, url = ?, empreinte = ?
     WHERE rowid = ?
  `);
  const insererUnite = db.prepare(`
    INSERT INTO unites (rowid, ref, document, corpus, niveau, numero, chemin, texte, date_acte, date_debut, date_fin, statut, url, empreinte)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insererVecteur = db.prepare("INSERT INTO vec_unites (rowid, corpus, document, embedding) VALUES (?, ?, ?, ?)");
  const ecrireMeta = db.prepare(
    "INSERT INTO meta (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
  );
  const anciennes = new Map<string, number>();
  for (const unite of delta.modifiees) {
    const ligne = db.prepare("SELECT rowid FROM unites WHERE ref = ?").get(unite.ref) as
      | { rowid: number | bigint }
      | undefined;
    if (ligne === undefined) throw new Error(`Ligne introuvable pour ${unite.ref}`);
    anciennes.set(unite.ref, Number(ligne.rowid));
  }

  let prochain = maxRowid;
  const nouveaux = new Map<string, number>();
  for (const unite of delta.ajoutees) {
    prochain += 1;
    nouveaux.set(unite.ref, prochain);
  }

  db.exec("BEGIN");
  try {
    for (const ligne of delta.supprimees) {
      supprimerVecteur.run(BigInt(ligne.rowid));
      supprimerFts.run(BigInt(ligne.rowid));
      supprimerUnite.run(BigInt(ligne.rowid));
    }

    for (const unite of delta.modifiees) {
      const rowid = anciennes.get(unite.ref);
      const vecteur = vecteurs.get(unite.ref);
      if (rowid === undefined || vecteur === undefined) {
        throw new Error(`Delta incohérent pour ${unite.ref}`);
      }
      modifierUnite.run(
        unite.document,
        unite.corpus,
        unite.niveau,
        unite.numero,
        unite.chemin,
        unite.texte,
        unite.date_acte,
        unite.date_debut,
        unite.date_fin,
        unite.statut,
        unite.url,
        empreintes.get(unite.ref) ?? "",
        BigInt(rowid),
      );
      supprimerVecteur.run(BigInt(rowid));
      insererVecteur.run(BigInt(rowid), unite.corpus, unite.document, JSON.stringify(vecteur));
      supprimerFts.run(BigInt(rowid));
      insererFts.run(BigInt(rowid), unite.chemin, unite.texte);
    }

    for (const unite of delta.ajoutees) {
      const rowid = nouveaux.get(unite.ref);
      const vecteur = vecteurs.get(unite.ref);
      if (rowid === undefined || vecteur === undefined) {
        throw new Error(`Delta incohérent pour ${unite.ref}`);
      }
      insererUnite.run(
        BigInt(rowid),
        unite.ref,
        unite.document,
        unite.corpus,
        unite.niveau,
        unite.numero,
        unite.chemin,
        unite.texte,
        unite.date_acte,
        unite.date_debut,
        unite.date_fin,
        unite.statut,
        unite.url,
        empreintes.get(unite.ref) ?? "",
      );
      insererVecteur.run(BigInt(rowid), unite.corpus, unite.document, JSON.stringify(vecteur));
      insererFts.run(BigInt(rowid), unite.chemin, unite.texte);
    }

    ecrireMeta.run("construit_le", new Date().toISOString());
    ecrireMeta.run("unites", String(total));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Construit `data/corpus/index/index.db` : incrémental quand l'index est
 * réutilisable, complet sinon. Un index complet s'écrit dans `index.db.tmp`
 * puis se renomme ; un delta s'écrit dans une transaction et s'annule en cas
 * d'erreur.
 */
/**
 * Ajoute la colonne `corpus` à un index construit avant elle, en recopiant les
 * vecteurs existants : aucune unité n'est ré-embarquée. Rend `true` si la table
 * a été reconstruite.
 */
export function migrerVecteursCorpus(db: DatabaseSync, dim: number): boolean {
  const colonnes = db.prepare("PRAGMA table_info(vec_unites)").all() as { name: string }[];
  const noms = new Set(colonnes.map((colonne) => colonne.name));
  if (noms.has("corpus") && noms.has("document")) return false;

  db.exec("BEGIN");
  try {
    // La copie passe par une table ordinaire : renommer une table virtuelle
    // laisse ses tables d'ombre sous l'ancien nom et casse l'index.
    db.exec(
      "CREATE TABLE vec_migration (rowid INTEGER PRIMARY KEY, corpus TEXT, document TEXT, embedding BLOB)",
    );
    db.exec(
      `INSERT INTO vec_migration (rowid, corpus, document, embedding)
         SELECT v.rowid, u.corpus, u.document, v.embedding
           FROM vec_unites v JOIN unites u ON u.rowid = v.rowid`,
    );
    db.exec("DROP TABLE vec_unites");
    db.exec(
      `CREATE VIRTUAL TABLE vec_unites USING vec0(corpus TEXT, document TEXT, embedding float[${dim}] distance_metric=cosine)`,
    );
    const lignes = db
      .prepare("SELECT rowid, corpus, document, embedding FROM vec_migration")
      .all() as {
      rowid: number | bigint;
      corpus: string;
      document: string;
      embedding: Uint8Array;
    }[];
    const inserer = db.prepare(
      "INSERT INTO vec_unites (rowid, corpus, document, embedding) VALUES (?, ?, ?, ?)",
    );
    for (const ligne of lignes) {
      inserer.run(BigInt(ligne.rowid), ligne.corpus, ligne.document, ligne.embedding);
    }
    db.exec("DROP TABLE vec_migration");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return true;
}

export async function buildIndex(rootDir: string, embedder: Embedder): Promise<ResultatBuild> {
  const unites = lireUnites(rootDir);
  if (unites.length === 0) {
    throw new Error("Aucune unité à indexer. Lancez « npm run corpus:build ».");
  }

  const chemin = cheminIndex(rootDir);
  const empreintes = new Map(unites.map((unite) => [unite.ref, empreinteUnite(unite, embedder)]));
  const existant = ouvrirExistant(chemin, embedder);

  if (!existant.compatible) {
    await construireComplet(chemin, unites, empreintes, embedder);
    return {
      chemin,
      unites: unites.length,
      delta: {
        ajoutees: unites.length,
        modifiees: 0,
        supprimees: 0,
        inchangees: 0,
      },
      mode: "complet",
      raison: existant.raison,
    };
  }

  try {
    migrerVecteursCorpus(existant.db, embedder.dim);
    const delta = calculerDelta(existant.lignes, unites, empreintes);
    await appliquerDelta(
      existant.db,
      delta,
      empreintes,
      embedder,
      existant.maxRowid,
      unites.length,
    );
    return {
      chemin,
      unites: unites.length,
      delta: {
        ajoutees: delta.ajoutees.length,
        modifiees: delta.modifiees.length,
        supprimees: delta.supprimees.length,
        inchangees: delta.inchangees.length,
      },
      mode: "incremental",
    };
  } finally {
    existant.db.close();
  }
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** Journal stderr : le mode, la raison et les quatre comptes du delta. */
export function formaterJournal(resultat: ResultatBuild, embedder: Embedder): string {
  const raison = resultat.raison === undefined ? "" : ` (${resultat.raison})`;
  return (
    `${resultat.unites} unités indexées dans ${resultat.chemin} ` +
    `(${embedder.model}, ${embedder.dim} dimensions, ${resultat.mode}${raison}) : ` +
    `${resultat.delta.ajoutees} ajoutées, ${resultat.delta.modifiees} modifiées, ` +
    `${resultat.delta.supprimees} supprimées, ${resultat.delta.inchangees} inchangées\n`
  );
}

async function main(argv: string[]): Promise<void> {
  const modele = valeurDe("--modele", argv);
  const dim = valeurDe("--dim", argv);
  const embedder = createOllamaEmbedder({
    ...(modele === undefined ? {} : { model: modele }),
    ...(dim === undefined ? {} : { dim: Number(dim) }),
  });
  const resultat = await buildIndex(valeurDe("--root", argv) ?? RACINE, embedder);
  process.stderr.write(formaterJournal(resultat, embedder));
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
