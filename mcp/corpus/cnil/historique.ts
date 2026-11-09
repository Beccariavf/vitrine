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
import { estSanction, libelleNature, natureDemandee } from "./nature.ts";

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
  /** Natures retenues : sanctions, avis, recommandations et lignes directrices. */
  natures: string[];
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

/** Forme brute : un descripteur ancien porte une `nature` unique au singulier. */
type DescripteurCnilBrut = Omit<DescripteurCnil, "natures"> & {
  natures?: string[];
  nature?: string;
};

/**
 * Lit le descripteur. La forme `natures` fait foi ; une `nature` unique reste
 * lue, pour qu'un descripteur ancien ne casse pas la synchronisation.
 */
export function lireDescripteur(chemin: string): DescripteurCnil {
  const brut = JSON.parse(readFileSync(chemin, "utf8")) as DescripteurCnilBrut;
  const { nature: singuliere, ...reste } = brut;
  const natures = reste.natures ?? (singuliere === undefined ? [] : [singuliere]);
  return { ...reste, natures };
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

/** Vrai si la ligne relève de l'une des natures demandées, à la casse près. */
export function estDeNature(ligne: LigneDinum, natures: readonly string[]): boolean {
  return natureDemandee(ligne.nature_delib, natures);
}

/**
 * Mappe une ligne DINUM en unité. La référence reste vérifiable : elle porte le
 * `doc_id` publié et le `chunk_index` publié, jamais une numérotation inventée.
 * Le chemin nomme la nature de la délibération, étiquette du descripteur.
 */
export function uniteDinum(
  ligne: LigneDinum,
  descripteur: DescripteurCnil,
  natures: readonly string[] = descripteur.natures,
): Unite {
  const document = String(ligne.doc_id ?? "").trim();
  const numero = String(ligne.number ?? "").trim() || document;
  const date = String(ligne.date ?? "").trim();
  const nature = libelleNature(ligne.nature_delib, natures);
  const libelle = nature === "" ? "Délibération" : nature;
  return {
    ref: `${document}#f${Number(ligne.chunk_index)}`,
    document,
    corpus: descripteur.corpus,
    niveau: "fragment",
    numero,
    chemin: `${descripteur.nom} > ${libelle} > Délibération ${numero}`,
    texte: String(ligne.text ?? "").trim(),
    date_acte: date,
    date_debut: date,
    date_fin: null,
    statut: String(ligne.status ?? "").trim(),
    url: descripteur.url_texte.replace("{id}", document),
    origine: "dinum",
    ...(nature === "" ? {} : { nature }),
  };
}

/**
 * Rend les unités des lignes des natures demandées. Une ligne vide ou sans
 * identifiant est comptée en erreur : l'appelant n'écrit alors aucun fichier.
 */
export type ExclusionNature = { nature: string; lignes: number };

/** Lignes écartées par nature : la valeur brute, `(vide)` pour null ou vide. */
export function compterExclusionsNature(
  lignes: readonly LigneDinum[],
  natures: readonly string[],
): ExclusionNature[] {
  const comptes = new Map<string, number>();
  for (const ligne of lignes) {
    if (estDeNature(ligne, natures)) continue;
    const nature = String(ligne.nature_delib ?? "").trim() || "(vide)";
    comptes.set(nature, (comptes.get(nature) ?? 0) + 1);
  }
  return [...comptes.entries()]
    .map(([nature, lignes]) => ({ nature, lignes }))
    .sort(
      (gauche, droite) =>
        droite.lignes - gauche.lignes || gauche.nature.localeCompare(droite.nature, "fr"),
    );
}

export function unitesDinum(
  lignes: LigneDinum[],
  descripteur: DescripteurCnil,
  natures: readonly string[] = descripteur.natures,
): { unites: Unite[]; erreurs: string[]; exclusions: ExclusionNature[] } {
  const unites: Unite[] = [];
  const erreurs: string[] = [];
  for (const ligne of lignes) {
    if (!estDeNature(ligne, natures)) continue;
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
    unites.push(uniteDinum(ligne, descripteur, natures));
  }

  // Le dispositif est commun à tous les fragments d'une décision : on le lit
  // une fois, puis on pose le même type et le même montant sur chaque unité.
  // Seules les sanctions en portent : un avis n'a ni type ni montant.
  const parDocument = new Map<string, Unite[]>();
  for (const unite of unites) {
    const groupe = parDocument.get(unite.document) ?? [];
    groupe.push(unite);
    parDocument.set(unite.document, groupe);
  }
  for (const groupe of parDocument.values()) {
    if (!groupe.some((unite) => estSanction(unite.nature))) continue;
    const meta = extraireMetaSanction(groupe.map((unite) => unite.texte).join("\n"));
    for (const unite of groupe) Object.assign(unite, meta);
  }

  return { unites, erreurs, exclusions: compterExclusionsNature(lignes, natures) };
}
