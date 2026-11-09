import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as sqliteVec from "sqlite-vec";
import type { Unite } from "../corpus/parse.ts";
import { dateIndex, montantIndex, numeroIndex } from "../corpus/cnil/meta.ts";
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
  /** Unités dont seule une colonne d'affichage a changé. */
  metaModifiees: number;
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
  empreinte TEXT NOT NULL,
  nature TEXT NOT NULL DEFAULT '',
  type_sanction TEXT NOT NULL DEFAULT 'autre',
  montant INTEGER,
  injonction INTEGER NOT NULL DEFAULT 0,
  date_num INTEGER NOT NULL DEFAULT 0,
  numero_index TEXT NOT NULL DEFAULT ''
);
CREATE VIRTUAL TABLE vec_unites USING vec0(
  corpus TEXT,
  document TEXT,
  nature TEXT,
  date_num INTEGER,
  type_sanction TEXT,
  montant INTEGER,
  numero TEXT,
  injonction INTEGER,
  embedding float[${dim}] distance_metric=cosine
);
CREATE VIRTUAL TABLE fts_unites USING fts5(chemin, texte, tokenize="unicode61 remove_diacritics 2");
`;

/** Métadonnées d'index d'une unité ; `-1` marque un montant inconnu. */
export type ChampsMeta = {
  /** Nature CNIL ; `""` pour les corpus qui n'en portent pas. */
  nature: string;
  type_sanction: string;
  /** `null` pour un montant absent ou masqué ; `-1` est réservé à `vec0`. */
  montant: number | null;
  injonction: number;
  date_num: number;
  numero_index: string;
};

export function champsMeta(unite: Unite): ChampsMeta {
  return {
    nature: unite.nature ?? "",
    type_sanction: unite.type_sanction ?? "autre",
    montant: unite.montant === undefined || unite.montant === null ? null : Math.trunc(unite.montant),
    injonction: unite.injonction === true ? 1 : 0,
    date_num: dateIndex(unite.date_acte),
    numero_index: numeroIndex(unite.numero),
  };
}

/** Valeur `vec0` d'un montant : `-1` quand il est inconnu. */
export function montantVecteur(montant: number | null): bigint {
  return BigInt(montantIndex(montant));
}

/** Empreinte des seules métadonnées : elle décide d'une recopie de `vec0`. */
export function empreinteMeta(unites: Unite[]): string {
  return createHash("sha256")
    .update(unites.map((unite) => JSON.stringify([unite.ref, champsMeta(unite)])).join("\n"))
    .digest("hex");
}

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

type LigneIndex = {
  ref: string;
  rowid: number;
  empreinte: string;
  numero: string;
  niveau: string;
  date_acte: string;
  date_debut: string;
  date_fin: string | null;
  statut: string;
  url: string;
};

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

    const lignes = db
      .prepare(
        "SELECT ref, rowid, empreinte, numero, niveau, date_acte, date_debut, date_fin, statut, url FROM unites",
      )
      .all() as {
      ref: string;
      rowid: number | bigint;
      empreinte: string;
      numero: string;
      niveau: string;
      date_acte: string;
      date_debut: string;
      date_fin: string | null;
      statut: string;
      url: string;
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
        numero: ligne.numero,
        niveau: ligne.niveau,
        date_acte: ligne.date_acte,
        date_debut: ligne.date_debut,
        date_fin: ligne.date_fin,
        statut: ligne.statut,
        url: ligne.url,
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
  /** Unités inchangées pour le vecteur, mais dont l'affichage a changé. */
  metaModifiees: { unite: Unite; rowid: number }[];
};

/** Vrai si une colonne d'affichage a changé sans toucher au passage embarqué. */
function metaChangee(existante: LigneIndex, unite: Unite): boolean {
  return (
    existante.numero !== unite.numero ||
    existante.niveau !== unite.niveau ||
    existante.date_acte !== unite.date_acte ||
    existante.date_debut !== unite.date_debut ||
    existante.date_fin !== unite.date_fin ||
    existante.statut !== unite.statut ||
    existante.url !== unite.url
  );
}

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
  const metaModifiees: { unite: Unite; rowid: number }[] = [];
  for (const unite of unites) {
    const existante = parRef.get(unite.ref);
    if (existante === undefined) ajoutees.push(unite);
    else if (existante.empreinte !== empreintes.get(unite.ref)) modifiees.push(unite);
    else {
      inchangees.push(unite);
      if (metaChangee(existante, unite)) {
        metaModifiees.push({ unite, rowid: existante.rowid });
      }
    }
  }
  return {
    ajoutees,
    modifiees,
    supprimees: lignes.filter((ligne) => !refsCorpus.has(ligne.ref)),
    inchangees,
    metaModifiees,
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
      INSERT INTO unites (rowid, ref, document, corpus, niveau, numero, chemin, texte, date_acte, date_debut, date_fin, statut, url, empreinte, nature, type_sanction, montant, injonction, date_num, numero_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insererVecteur = db.prepare(
      "INSERT INTO vec_unites (rowid, corpus, document, nature, date_num, type_sanction, montant, numero, injonction, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
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
      const meta = champsMeta(unite);
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
        meta.nature,
        meta.type_sanction,
        meta.montant,
        BigInt(meta.injonction),
        BigInt(meta.date_num),
        meta.numero_index,
      );
      insererVecteur.run(
        rowid,
        unite.corpus,
        unite.document,
        meta.nature,
        BigInt(meta.date_num),
        meta.type_sanction,
        montantVecteur(meta.montant),
        meta.numero_index,
        BigInt(meta.injonction),
        JSON.stringify(vecteur),
      );
      insererFts.run(rowid, unite.chemin, unite.texte);
    });
    insererMeta.run("model", embedder.model);
    insererMeta.run("dim", String(embedder.dim));
    insererMeta.run("construit_le", new Date().toISOString());
    insererMeta.run("unites", String(unites.length));
    insererMeta.run("meta_sha", empreinteMeta(unites));
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
           date_debut = ?, date_fin = ?, statut = ?, url = ?, empreinte = ?,
           nature = ?, type_sanction = ?, montant = ?, injonction = ?, date_num = ?, numero_index = ?
     WHERE rowid = ?
  `);
  const modifierMeta = db.prepare(`
    UPDATE unites
       SET numero = ?, numero_index = ?, niveau = ?, date_acte = ?, date_debut = ?, date_fin = ?,
           statut = ?, url = ?
     WHERE rowid = ?
  `);
  const insererUnite = db.prepare(`
    INSERT INTO unites (rowid, ref, document, corpus, niveau, numero, chemin, texte, date_acte, date_debut, date_fin, statut, url, empreinte, nature, type_sanction, montant, injonction, date_num, numero_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insererVecteur = db.prepare(
    "INSERT INTO vec_unites (rowid, corpus, document, nature, date_num, type_sanction, montant, numero, injonction, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
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

    for (const { unite, rowid } of delta.metaModifiees) {
      modifierMeta.run(
        unite.numero,
        numeroIndex(unite.numero),
        unite.niveau,
        unite.date_acte,
        unite.date_debut,
        unite.date_fin,
        unite.statut,
        unite.url,
        BigInt(rowid),
      );
    }

    for (const unite of delta.modifiees) {
      const rowid = anciennes.get(unite.ref);
      const vecteur = vecteurs.get(unite.ref);
      if (rowid === undefined || vecteur === undefined) {
        throw new Error(`Delta incohérent pour ${unite.ref}`);
      }
      const meta = champsMeta(unite);
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
        meta.nature,
        meta.type_sanction,
        meta.montant,
        BigInt(meta.injonction),
        BigInt(meta.date_num),
        meta.numero_index,
        BigInt(rowid),
      );
      supprimerVecteur.run(BigInt(rowid));
      insererVecteur.run(
        BigInt(rowid),
        unite.corpus,
        unite.document,
        meta.nature,
        BigInt(meta.date_num),
        meta.type_sanction,
        montantVecteur(meta.montant),
        meta.numero_index,
        BigInt(meta.injonction),
        JSON.stringify(vecteur),
      );
      supprimerFts.run(BigInt(rowid));
      insererFts.run(BigInt(rowid), unite.chemin, unite.texte);
    }

    for (const unite of delta.ajoutees) {
      const rowid = nouveaux.get(unite.ref);
      const vecteur = vecteurs.get(unite.ref);
      if (rowid === undefined || vecteur === undefined) {
        throw new Error(`Delta incohérent pour ${unite.ref}`);
      }
      const meta = champsMeta(unite);
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
        meta.nature,
        meta.type_sanction,
        meta.montant,
        BigInt(meta.injonction),
        BigInt(meta.date_num),
        meta.numero_index,
      );
      insererVecteur.run(
        BigInt(rowid),
        unite.corpus,
        unite.document,
        meta.nature,
        BigInt(meta.date_num),
        meta.type_sanction,
        montantVecteur(meta.montant),
        meta.numero_index,
        BigInt(meta.injonction),
        JSON.stringify(vecteur),
      );
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
 * Met à jour les métadonnées d'un index construit avant elles. Les vecteurs
 * existants sont recopiés, jamais ré-embarqués : seule la table `vec0` est
 * reconstruite quand ses colonnes ou l'empreinte des métadonnées changent.
 */
export function migrerVecteurs(db: DatabaseSync, dim: number, unites: Unite[]): boolean {
  const colonnesUnites = db.prepare("PRAGMA table_info(unites)").all() as { name: string }[];
  const nomsUnites = new Set(colonnesUnites.map((colonne) => colonne.name));
  const ajouts: [string, string][] = [
    ["nature", "TEXT NOT NULL DEFAULT ''"],
    ["type_sanction", "TEXT NOT NULL DEFAULT 'autre'"],
    ["montant", "INTEGER"],
    ["injonction", "INTEGER NOT NULL DEFAULT 0"],
    ["date_num", "INTEGER NOT NULL DEFAULT 0"],
    ["numero_index", "TEXT NOT NULL DEFAULT ''"],
  ];
  for (const [nom, type] of ajouts) {
    if (!nomsUnites.has(nom)) db.exec(`ALTER TABLE unites ADD COLUMN ${nom} ${type}`);
  }

  db.exec("BEGIN");
  try {
    const maj = db.prepare(`
      UPDATE unites
         SET nature = ?, type_sanction = ?, montant = ?, injonction = ?, date_num = ?, numero_index = ?
       WHERE ref = ?
    `);
    for (const unite of unites) {
      const meta = champsMeta(unite);
      maj.run(
        meta.nature,
        meta.type_sanction,
        meta.montant,
        BigInt(meta.injonction),
        BigInt(meta.date_num),
        meta.numero_index,
        unite.ref,
      );
    }

    const colonnesVecteurs = db.prepare("PRAGMA table_info(vec_unites)").all() as { name: string }[];
    const nomsVecteurs = new Set(colonnesVecteurs.map((colonne) => colonne.name));
    const attendues = ["corpus", "document", "nature", "date_num", "type_sanction", "montant", "numero", "injonction"];
    const complete = attendues.every((nom) => nomsVecteurs.has(nom));
    const sha = empreinteMeta(unites);
    const ancienSha = (() => {
      try {
        const ligne = db.prepare("SELECT valeur FROM meta WHERE cle = 'meta_sha'").get() as
          | { valeur: string }
          | undefined;
        return ligne?.valeur ?? "";
      } catch {
        return "";
      }
    })();
    if (complete && ancienSha === sha) {
      db.exec("COMMIT");
      return false;
    }

    // La copie passe par une table ordinaire : renommer une table virtuelle
    // laisse ses tables d'ombre sous l'ancien nom et casse l'index.
    db.exec(
      "CREATE TABLE vec_migration (rowid INTEGER PRIMARY KEY, corpus TEXT, document TEXT, " +
        "nature TEXT, date_num INTEGER, type_sanction TEXT, montant INTEGER, numero TEXT, injonction INTEGER, embedding BLOB)",
    );
    db.exec(
      `INSERT INTO vec_migration (rowid, corpus, document, nature, date_num, type_sanction, montant, numero, injonction, embedding)
         SELECT v.rowid, u.corpus, u.document, u.nature, u.date_num, u.type_sanction, u.montant, u.numero_index,
                u.injonction, v.embedding
           FROM vec_unites v JOIN unites u ON u.rowid = v.rowid`,
    );
    db.exec("DROP TABLE vec_unites");
    db.exec(
      `CREATE VIRTUAL TABLE vec_unites USING vec0(
         corpus TEXT,
         document TEXT,
         nature TEXT,
         date_num INTEGER,
         type_sanction TEXT,
         montant INTEGER,
         numero TEXT,
         injonction INTEGER,
         embedding float[${dim}] distance_metric=cosine
       )`,
    );
    const lignes = db
      .prepare(
        "SELECT rowid, corpus, document, nature, date_num, type_sanction, montant, numero, injonction, embedding FROM vec_migration",
      )
      .all() as {
      rowid: number | bigint;
      corpus: string;
      document: string;
      nature: string;
      date_num: number | bigint;
      type_sanction: string;
      montant: number | bigint;
      numero: string;
      injonction: number | bigint;
      embedding: Uint8Array;
    }[];
    const inserer = db.prepare(
      "INSERT INTO vec_unites (rowid, corpus, document, nature, date_num, type_sanction, montant, numero, injonction, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const ligne of lignes) {
      inserer.run(
        BigInt(ligne.rowid),
        ligne.corpus,
        ligne.document,
        ligne.nature,
        BigInt(ligne.date_num),
        ligne.type_sanction,
        BigInt(ligne.montant === null ? -1 : ligne.montant),
        ligne.numero,
        BigInt(ligne.injonction),
        ligne.embedding,
      );
    }
    db.exec("DROP TABLE vec_migration");
    db.prepare(
      "INSERT INTO meta (cle, valeur) VALUES ('meta_sha', ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
    ).run(sha);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return true;
}

/**
 * Construit `data/corpus/index/index.db` : incrémental quand l'index est
 * réutilisable, complet sinon. Un index complet s'écrit dans `index.db.tmp`
 * puis se renomme ; un delta s'écrit dans une transaction et s'annule en cas
 * d'erreur.
 */
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
        metaModifiees: 0,
      },
      mode: "complet",
      raison: existant.raison,
    };
  }

  try {
    migrerVecteurs(existant.db, embedder.dim, unites);
    const delta = calculerDelta(existant.lignes, unites, empreintes);
    await appliquerDelta(
      existant.db,
      delta,
      empreintes,
      embedder,
      existant.maxRowid,
      unites.length,
    );
    existant.db
      .prepare(
        "INSERT INTO meta (cle, valeur) VALUES ('meta_sha', ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
      )
      .run(empreinteMeta(unites));
    return {
      chemin,
      unites: unites.length,
      delta: {
        ajoutees: delta.ajoutees.length,
        modifiees: delta.modifiees.length,
        supprimees: delta.supprimees.length,
        inchangees: delta.inchangees.length,
        metaModifiees: delta.metaModifiees.length,
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
    `${resultat.delta.supprimees} supprimées, ${resultat.delta.inchangees} inchangées, ` +
    `${resultat.delta.metaModifiees} métadonnées rafraîchies\n`
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
