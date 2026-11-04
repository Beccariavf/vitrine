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

export type ResultatRecherche = {
  ref: string;
  document: string;
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
  /** Restreint aux unités de ce document ; absent, tous les corpus répondent. */
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
 * Rend les `k` passages les plus proches, distance cosinus croissante. Le filtre
 * `document` s'applique après la recherche vectorielle : on demande alors plus de
 * candidats pour rendre tout de même `k` passages du document demandé.
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

  const candidats = options.document === undefined ? k : Math.max(k * 10, 50);
  const lignes = index.db
    .prepare(
      `SELECT u.ref, u.document, u.texte, u.chemin, u.url, u.date_acte, u.date_debut, u.date_fin,
              u.statut, v.distance
         FROM vec_unites v
         JOIN unites u ON u.rowid = v.rowid
        WHERE v.embedding MATCH ? AND k = ?
        ORDER BY v.distance`,
    )
    .all(JSON.stringify(vecteur), candidats) as Ligne[];

  const resultats = lignes.map(ligneVersResultat);
  return (options.document === undefined
    ? resultats
    : resultats.filter((resultat) => resultat.document === options.document)
  ).slice(0, k);
}
