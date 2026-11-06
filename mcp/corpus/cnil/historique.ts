/**
 * Historique DINUM : le parquet public des délibérations vectorisées.
 *
 * On ne lit que le texte et les métadonnées : la colonne d'embeddings `bge-m3`
 * reste sur le disque et n'entre jamais dans l'index, dont l'espace vectoriel
 * est celui de `qwen3-embedding:0.6b`. Le parquet n'est pas commité ; il est
 * téléchargé une fois sous `data/raw/cnil/` puis réutilisé.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import type { Unite } from "../parse.ts";
import { extraireMetaSanction } from "./meta.ts";

/** Une ligne du parquet, réduite aux colonnes lues. */
export type LigneDinum = {
  doc_id: string;
  chunk_index: number;
  text: string;
  number: string | null;
  date: string | null;
  title: string | null;
  status: string | null;
  nature_delib: string | null;
};

/** Le descripteur CNIL, lu depuis `descripteur.json`. */
export type DescripteurCnil = {
  corpus: string;
  nom: string;
  nature: string;
  documents_attendus: number;
  fragments_attendus: number;
  snapshot: string;
  revision: string;
  url_texte: string;
  url_texte_verifiee: boolean;
  url_texte_note: string;
  dinum: {
    nom: string;
    url_page: string;
    url_data_gouv: string;
    licence_huggingface: string;
    licence_data_gouv: string;
    licence_incoherence: boolean;
    fichiers: string[];
    colonnes_lues: string[];
    colonne_ignoree: string;
  };
  dila: { nom: string; url: string; format: string; decoupage: string };
};

/** Réponse binaire minimale d'un `fetch`, injectable en test. */
export type ReponseBinaire = {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};
export type FetchBinaire = (url: string) => Promise<ReponseBinaire>;

/** Un fichier parquet téléchargé, avec l'empreinte de ses octets. */
export type FichierDinum = { url: string; chemin: string; sha256: string };

/** Les colonnes lues, jamais celle des embeddings. */
export const COLONNES_LUES = [
  "doc_id",
  "chunk_index",
  "text",
  "number",
  "date",
  "title",
  "status",
  "nature_delib",
] as const;

export function lireDescripteur(chemin: string): DescripteurCnil {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurCnil;
}

/** Empreinte sha256 des octets d'un fichier. */
export function sha256Fichier(chemin: string): string {
  return createHash("sha256").update(readFileSync(chemin)).digest("hex");
}

/**
 * Télécharge les parquet absents sous `dossier`, réutilise ceux qui sont là.
 * L'écriture passe par un fichier temporaire : un téléchargement interrompu ne
 * laisse pas de parquet tronqué à la place d'un bon.
 */
export async function telechargerHistorique(
  descripteur: DescripteurCnil,
  dossier: string,
  fetchImpl: FetchBinaire = fetch,
): Promise<FichierDinum[]> {
  mkdirSync(dossier, { recursive: true });
  const fichiers: FichierDinum[] = [];
  for (const url of descripteur.dinum.fichiers) {
    const chemin = join(dossier, basename(new URL(url).pathname));
    if (!existsSync(chemin) || statSync(chemin).size === 0) {
      const reponse = await fetchImpl(url);
      if (!reponse.ok) {
        throw new Error(`Téléchargement refusé pour ${url} (HTTP ${reponse.status}).`);
      }
      const temporaire = `${chemin}.tmp`;
      try {
        writeFileSync(temporaire, Buffer.from(await reponse.arrayBuffer()));
        renameSync(temporaire, chemin);
      } finally {
        if (existsSync(temporaire)) rmSync(temporaire, { force: true });
      }
    }
    fichiers.push({ url, chemin, sha256: sha256Fichier(chemin) });
  }
  return fichiers;
}

/** Lit les lignes des fichiers parquet, colonne par colonne. */
export async function lireLignes(fichiers: string[]): Promise<LigneDinum[]> {
  const lignes: LigneDinum[] = [];
  for (const chemin of fichiers) {
    const file = await asyncBufferFromFile(chemin);
    const objets = await parquetReadObjects({
      file,
      columns: [...COLONNES_LUES],
      compressors,
    });
    for (const objet of objets) {
      lignes.push(objet as unknown as LigneDinum);
    }
  }
  return lignes;
}

/** Vrai si la ligne relève de la nature filtrée. */
export function estDeNature(ligne: LigneDinum, nature: string): boolean {
  return ligne.nature_delib === nature;
}

/**
 * Mappe une ligne DINUM en unité. La référence reste vérifiable : elle porte le
 * `doc_id` publié et le `chunk_index` publié, jamais une numérotation inventée.
 */
export function uniteDinum(ligne: LigneDinum, descripteur: DescripteurCnil): Unite {
  const document = String(ligne.doc_id ?? "").trim();
  const numero = String(ligne.number ?? "").trim() || document;
  const date = String(ligne.date ?? "").trim();
  return {
    ref: `${document}#f${Number(ligne.chunk_index)}`,
    document,
    corpus: descripteur.corpus,
    niveau: "fragment",
    numero,
    chemin: `${descripteur.nom} > Sanctions > Délibération ${numero}`,
    texte: String(ligne.text ?? "").trim(),
    date_acte: date,
    date_debut: date,
    date_fin: null,
    statut: String(ligne.status ?? "").trim(),
    url: descripteur.url_texte.replace("{id}", document),
    origine: "dinum",
  };
}

/**
 * Rend les unités des lignes de la nature demandée. Une ligne vide ou sans
 * identifiant est comptée en erreur : l'appelant n'écrit alors aucun fichier.
 */
export function unitesDinum(
  lignes: LigneDinum[],
  descripteur: DescripteurCnil,
  nature = descripteur.nature,
): { unites: Unite[]; erreurs: string[] } {
  const unites: Unite[] = [];
  const erreurs: string[] = [];
  for (const ligne of lignes) {
    if (!estDeNature(ligne, nature)) continue;
    const document = String(ligne.doc_id ?? "").trim();
    const emplacement = `${document || "(sans doc_id)"}#f${ligne.chunk_index}`;
    if (document === "") {
      erreurs.push(`${emplacement} : doc_id absent`);
      continue;
    }
    if (String(ligne.text ?? "").trim() === "") {
      erreurs.push(`${emplacement} : texte vide`);
      continue;
    }
    if (String(ligne.date ?? "").trim() === "") {
      erreurs.push(`${emplacement} : date absente`);
      continue;
    }
    unites.push(uniteDinum(ligne, descripteur));
  }

  // Le dispositif est commun à tous les fragments d'une décision : on le lit
  // une fois, puis on pose le même type et le même montant sur chaque unité.
  const parDocument = new Map<string, Unite[]>();
  for (const unite of unites) {
    const groupe = parDocument.get(unite.document) ?? [];
    groupe.push(unite);
    parDocument.set(unite.document, groupe);
  }
  for (const groupe of parDocument.values()) {
    const meta = extraireMetaSanction(groupe.map((unite) => unite.texte).join("\n"));
    for (const unite of groupe) Object.assign(unite, meta);
  }

  return { unites, erreurs };
}
