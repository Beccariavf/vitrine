import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";

/** Un index ouvert, avec son modèle et sa dimension lus dans `meta`. */
export type Index = {
  db: DatabaseSync;
  chemin: string;
  model: string;
  dim: number;
  unites: number;
};

/**
 * Bande de similarité qui fait passer un article devant un considérant à
 * pertinence comparable. Elle est mesurée sur les questions `dev` ; `0,02` est
 * retenue pour rester minimale, car la métrique de développement ne pénalise pas
 * la sur-promotion des articles. Elle ne supprime jamais le considérant, elle le
 * place après l'article.
 */
export const BANDE_ARTICLE = 0.02;

export type ResultatRecherche = {
  ref: string;
  document: string;
  /** Collection d'appartenance : `rgpd`, `aiact`, `cnil`. */
  corpus: string;
  niveau: string;
  numero: string;
  texte: string;
  chemin: string;
  url: string;
  date_acte: string;
  date_debut: string;
  date_fin: string | null;
  statut: string;
  /** Distance cosinus rendue par sqlite-vec : `similarité = 1 - distance`. */
  distance: number;
};

export type SearchOptions = {
  k: number;
  /**
   * Restreint à une collection (`rgpd`, `aiact`, `cnil`) ; absent, tous les
   * corpus répondent.
   */
  corpus?: string;
  /** Restreint aux unités de ce document ; absent, tout le corpus répond. */
  document?: string;
};

type Valeur = null | number | bigint | string | Uint8Array;
type Ligne = Record<string, Valeur>;

/** Ouvre l'index en lecture seule ; lève en nommant la commande qui le construit. */
export function openIndex(chemin: string): Index {
  if (!existsSync(chemin)) {
    throw new Error(`Index introuvable : ${chemin}. Lancez « npm run corpus:index ».`);
  }

  const db = new DatabaseSync(chemin, { allowExtension: true, readOnly: true });
  try {
    sqliteVec.load(db);
    const colonnes = db.prepare("PRAGMA table_info(unites)").all() as { name: string }[];
    if (!colonnes.some((colonne) => colonne.name === "corpus")) {
      throw new Error(
        `Index sans colonne corpus : ${chemin}. Reconstruisez-le avec « npm run corpus:index ».`,
      );
    }
    const meta = new Map<string, string>();
    for (const ligne of db.prepare("SELECT cle, valeur FROM meta").all() as {
      cle: string;
      valeur: string;
    }[]) {
      meta.set(ligne.cle, ligne.valeur);
    }
    const model = meta.get("model");
    const dim = Number(meta.get("dim"));
    if (model === undefined || !Number.isFinite(dim) || dim <= 0) {
      throw new Error(`Index illisible : ${chemin}. Relancez « npm run corpus:index ».`);
    }
    return {
      db,
      chemin,
      model,
      dim,
      unites: Number(meta.get("unites") ?? 0),
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

function ligneVersResultat(ligne: Ligne): ResultatRecherche {
  const texte = (valeur: Valeur | undefined): string =>
    typeof valeur === "string" ? valeur : String(valeur ?? "");
  const nullable = (valeur: Valeur | undefined): string | null =>
    valeur === null || valeur === undefined ? null : texte(valeur);

  return {
    ref: texte(ligne.ref),
    document: texte(ligne.document),
    corpus: texte(ligne.corpus),
    niveau: texte(ligne.niveau),
    numero: texte(ligne.numero),
    texte: texte(ligne.texte),
    chemin: texte(ligne.chemin),
    url: texte(ligne.url),
    date_acte: texte(ligne.date_acte),
    date_debut: texte(ligne.date_debut),
    date_fin: nullable(ligne.date_fin),
    statut: texte(ligne.statut),
    distance: Number(ligne.distance),
  };
}

/**
 * Classe les passages : similarité brute, plus `BANDE_ARTICLE` pour un article.
 * La distance et la similarité rendues restent les valeurs brutes ; seuls les
 * articles à moins de 0,02 d'un considérant le dépassent.
 */
export function rangerPassages(resultats: ResultatRecherche[], k: number): ResultatRecherche[] {
  const nombre = Math.max(0, Math.trunc(k));
  if (nombre === 0) return [];
  return resultats
    .map((resultat, position) => ({
      resultat,
      score: 1 - resultat.distance + (resultat.niveau === "article" ? BANDE_ARTICLE : 0),
      position,
    }))
    .sort(
      (gauche, droite) =>
        droite.score - gauche.score ||
        gauche.resultat.distance - droite.resultat.distance ||
        gauche.position - droite.position,
    )
    .slice(0, nombre)
    .map((entree) => entree.resultat);
}

/** Vrai si le résultat passe les filtres optionnels de corpus et de document. */
function retenu(resultat: ResultatRecherche, options: SearchOptions): boolean {
  if (options.corpus !== undefined && resultat.corpus !== options.corpus) return false;
  if (options.document !== undefined && resultat.document !== options.document) return false;
  return true;
}

/**
 * Rend les `k` passages les plus proches, rangés par la bande article. Les
 * filtres `corpus` et `document` s'appliquent avant le classement : on demande
 * plus de candidats pour que l'article promu reste dans la fenêtre, puis on rend
 * `k` passages.
 */
export function searchIndex(index: Index, vecteur: number[], options: SearchOptions): ResultatRecherche[] {
  if (vecteur.length !== index.dim) {
    throw new Error(
      `Vecteur de ${vecteur.length} dimensions pour un index de ${index.dim} ; ` +
        `modèle ${index.model}. Reconstruisez l'index avec « npm run corpus:index ».`,
    );
  }

  const k = Math.max(0, Math.trunc(options.k));
  if (k === 0) return [];

  const candidats = Math.max(k * 10, 50);
  // Le filtre `corpus` descend dans la requête `vec0` : sans cela, un corpus
  // majoritaire (la CNIL) remplirait la fenêtre et affamerait les autres.
  const filtreCorpus = options.corpus === undefined ? "" : " AND v.corpus = ?";
  const parametres: (string | number)[] =
    options.corpus === undefined
      ? [JSON.stringify(vecteur), candidats]
      : [JSON.stringify(vecteur), candidats, options.corpus];
  const lignes = index.db
    .prepare(
      `SELECT u.ref, u.document, u.corpus, u.niveau, u.numero, u.texte, u.chemin, u.url,
              u.date_acte, u.date_debut, u.date_fin, u.statut, v.distance
         FROM vec_unites v
         JOIN unites u ON u.rowid = v.rowid
        WHERE v.embedding MATCH ? AND k = ?${filtreCorpus}
        ORDER BY v.distance`,
    )
    .all(...parametres) as Ligne[];

  const resultats = lignes.map(ligneVersResultat).filter((resultat) => retenu(resultat, options));
  return rangerPassages(resultats, k);
}

/** Nombre de candidats pris dans chaque voie avant fusion. */
export const CANDIDATS_VOIE = 50;
/** Constante RRF : `1 / (RRF_K + rang)`, sans réglage fin. */
export const RRF_K = 60;

/** Mots outils français retirés de la requête lexicale : ils ne discriminent rien. */
const MOTS_VIDES = new Set([
  "au", "aux", "avec", "ce", "ces", "cet", "cette", "dans", "de", "des", "du", "elle",
  "en", "est", "et", "eux", "il", "ils", "je", "la", "le", "les", "leur", "leurs",
  "lui", "mais", "me", "mes", "moi", "mon", "ne", "nos", "notre", "nous", "on", "ou",
  "où", "par", "pas", "pour", "qu", "que", "quel", "quelle", "quelles", "quels", "qui",
  "quoi", "sa", "se", "ses", "son", "sont", "sur", "ta", "te", "tes", "toi", "ton",
  "tu", "un", "une", "vos", "votre", "vous", "y", "à",
]);

/** Requête FTS5 : chaque mot utile entre guillemets, joints par `OR` ; `null` si vide. */
export function requeteLexicale(texte: string): string | null {
  const mots = texte.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const utiles = [...new Set(mots.filter((mot) => mot.length > 1 && !MOTS_VIDES.has(mot)))];
  if (utiles.length === 0) return null;
  return utiles.map((mot) => `"${mot.replace(/"/g, '""')}"`).join(" OR ");
}

type CandidatDense = { rowid: number; resultat: ResultatRecherche };

/** Candidats vectoriels, avec leur rowid, la bande article appliquée plus tard. */
function candidatsDenses(
  index: Index,
  vecteur: number[],
  limite: number,
  options: SearchOptions,
): CandidatDense[] {
  const filtreCorpus = options.corpus === undefined ? "" : " AND v.corpus = ?";
  const parametres: (string | number)[] =
    options.corpus === undefined
      ? [JSON.stringify(vecteur), limite]
      : [JSON.stringify(vecteur), limite, options.corpus];
  const lignes = index.db
    .prepare(
      `SELECT v.rowid AS rowid, u.ref, u.document, u.corpus, u.niveau, u.numero, u.texte, u.chemin, u.url,
              u.date_acte, u.date_debut, u.date_fin, u.statut, v.distance
         FROM vec_unites v
         JOIN unites u ON u.rowid = v.rowid
        WHERE v.embedding MATCH ? AND k = ?${filtreCorpus}
        ORDER BY v.distance`,
    )
    .all(...parametres) as Ligne[];
  return lignes
    .map((ligne) => ({
      rowid: Number(ligne.rowid),
      resultat: ligneVersResultat(ligne),
    }))
    .filter((candidat) => retenu(candidat.resultat, options));
}

/** Rowids rendus par FTS5, dans l'ordre du classement lexical. */
function candidatsLexicaux(
  index: Index,
  texte: string,
  limite: number,
  options: SearchOptions,
): number[] {
  const requete = requeteLexicale(texte);
  if (requete === null) return [];

  const conditions: string[] = [];
  const parametres: (string | number)[] = [requete];
  if (options.corpus !== undefined) {
    conditions.push("u.corpus = ?");
    parametres.push(options.corpus);
  }
  if (options.document !== undefined) {
    conditions.push("u.document = ?");
    parametres.push(options.document);
  }
  const filtre = conditions.length === 0 ? "" : ` AND ${conditions.join(" AND ")}`;
  parametres.push(limite);
  const lignes = index.db
    .prepare(
      `SELECT f.rowid AS rowid
         FROM fts_unites f
         JOIN unites u ON u.rowid = f.rowid
        WHERE fts_unites MATCH ?${filtre}
        ORDER BY rank
        LIMIT ?`,
    )
    .all(...parametres) as { rowid: number | bigint }[];
  return lignes.map((ligne) => Number(ligne.rowid));
}

/** Distance cosinus d'une requête contre un vecteur stocké en float32. */
function distanceCosinus(vecteur: number[], blob: Uint8Array): number {
  const valeurs = new Float32Array(blob.buffer, blob.byteOffset, Math.floor(blob.byteLength / 4));
  let produit = 0;
  let norme = 0;
  let normeRequete = 0;
  const longueur = Math.min(vecteur.length, valeurs.length);
  for (let index = 0; index < longueur; index += 1) {
    const requete = vecteur[index] ?? 0;
    const valeur = valeurs[index] ?? 0;
    produit += requete * valeur;
    norme += valeur * valeur;
    normeRequete += requete * requete;
  }
  const denominateur = Math.sqrt(norme) * Math.sqrt(normeRequete);
  return denominateur === 0 ? 1 : 1 - produit / denominateur;
}

/** Distance dense des rowids que la voie vectorielle n'a pas rendus. */
function distancesManquantes(
  index: Index,
  vecteur: number[],
  rowids: number[],
): Map<number, number> {
  if (rowids.length === 0) return new Map();
  const marques = rowids.map(() => "?").join(",");
  const lignes = index.db
    .prepare(`SELECT rowid, embedding FROM vec_unites WHERE rowid IN (${marques})`)
    .all(...rowids.map((rowid) => BigInt(rowid))) as {
    rowid: number | bigint;
    embedding: Uint8Array;
  }[];
  return new Map(
    lignes.map((ligne) => [Number(ligne.rowid), distanceCosinus(vecteur, ligne.embedding)]),
  );
}

/** Lignes complètes des rowids retenus, avec la distance dense déjà connue. */
function resultatsParRowid(
  index: Index,
  rowids: number[],
  distances: Map<number, number>,
): Map<number, ResultatRecherche> {
  if (rowids.length === 0) return new Map();
  const marques = rowids.map(() => "?").join(",");
  const lignes = index.db
    .prepare(
      `SELECT rowid, ref, document, corpus, niveau, numero, texte, chemin, url,
              date_acte, date_debut, date_fin, statut
         FROM unites
        WHERE rowid IN (${marques})`,
    )
    .all(...rowids.map((rowid) => BigInt(rowid))) as Ligne[];

  return new Map(
    lignes.map((ligne) => {
      const rowid = Number(ligne.rowid);
      const distance = distances.get(rowid);
      if (distance === undefined) throw new Error(`Distance dense absente pour le rowid ${rowid}`);
      return [rowid, ligneVersResultat({ ...ligne, distance })];
    }),
  );
}

/**
 * Fusionne au moins `CANDIDATS_VOIE` candidats denses et autant de lexicaux
 * (davantage si `k` les dépasse) par RRF (`1 / (60 + rang)`). L'ordre dense est
 * d'abord rangé par la bande article ; la distance rendue reste la similarité
 * dense brute, jamais un score fusionné.
 */
export function rechercheHybride(
  index: Index,
  vecteur: number[],
  texte: string,
  options: SearchOptions,
): ResultatRecherche[] {
  if (vecteur.length !== index.dim) {
    throw new Error(
      `Vecteur de ${vecteur.length} dimensions pour un index de ${index.dim} ; ` +
        `modèle ${index.model}. Reconstruisez l'index avec « npm run corpus:index ».`,
    );
  }

  const k = Math.max(0, Math.trunc(options.k));
  if (k === 0) return [];

  const limite = Math.max(CANDIDATS_VOIE, k);
  const denses = candidatsDenses(index, vecteur, limite, options);
  const distances = new Map(denses.map((candidat) => [candidat.rowid, candidat.resultat.distance]));

  const rowidParRef = new Map(denses.map((candidat) => [candidat.resultat.ref, candidat.rowid]));
  const rangDense = new Map<number, number>();
  rangerPassages(
    denses.map((candidat) => candidat.resultat),
    denses.length,
  ).forEach((resultat, position) => {
    const rowid = rowidParRef.get(resultat.ref);
    if (rowid !== undefined) rangDense.set(rowid, position + 1);
  });

  const lexicaux = candidatsLexicaux(index, texte, limite, options);
  const absents = lexicaux.filter((rowid) => !distances.has(rowid));
  for (const [rowid, distance] of distancesManquantes(index, vecteur, absents)) {
    distances.set(rowid, distance);
  }

  const scores = new Map<number, number>();
  for (const [rowid, rang] of rangDense) scores.set(rowid, 1 / (RRF_K + rang));
  lexicaux.forEach((rowid, position) => {
    scores.set(rowid, (scores.get(rowid) ?? 0) + 1 / (RRF_K + position + 1));
  });

  const ordre = [...scores.entries()]
    .sort(
      (gauche, droite) =>
        droite[1] - gauche[1] ||
        (distances.get(gauche[0]) ?? Number.POSITIVE_INFINITY) -
          (distances.get(droite[0]) ?? Number.POSITIVE_INFINITY) ||
        gauche[0] - droite[0],
    )
    .slice(0, k)
    .map(([rowid]) => rowid);

  const resultats = resultatsParRowid(index, ordre, distances);
  return ordre.map((rowid) => {
    const resultat = resultats.get(rowid);
    if (resultat === undefined) throw new Error(`Résultat absent pour le rowid ${rowid}`);
    return resultat;
  });
}
