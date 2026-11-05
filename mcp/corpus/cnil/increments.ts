/**
 * Incréments DILA : les archives `CNIL_YYYYMMDD-HHMMSS.tar.gz` publiées depuis
 * le 11 juillet 2025. Chaque archive porte des fichiers `TEXTE_CNIL` ; un
 * document déjà présent est remplacé en entier, jamais doublé.
 *
 * Ce module ne touche pas au corpus : il liste, télécharge, décompresse, parse
 * et fusionne en mémoire. L'appelant valide puis écrit, ou n'écrit rien.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { Unite } from "../parse.ts";
import type { DescripteurCnil, FetchBinaire } from "./historique.ts";
import { parseTexteCnil, unitesDila } from "./parse.ts";
import type { DecisionDila } from "./parse.ts";

/** Un `fetch` texte minimal, injectable en test. */
export type FetchTexte = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** Nom d'archive admis : l'horodatage se trie comme une date. */
const MOTIF_ARCHIVE = /CNIL_\d{8}-\d{6}\.tar\.gz/g;

/** État de reprise : la dernière archive lue, son empreinte et la date. */
export type EtatCnil = {
  derniere_archive: string | null;
  archive_sha256: string | null;
  lu_le: string | null;
  archives_lues: number;
};

export const ETAT_VIDE: EtatCnil = {
  derniere_archive: null,
  archive_sha256: null,
  lu_le: null,
  archives_lues: 0,
};

/** Une entrée de tar, nom complet et octets. */
export type EntreeTar = { nom: string; donnees: Buffer };

export function lireEtat(chemin: string): EtatCnil {
  if (!existsSync(chemin)) return { ...ETAT_VIDE };
  return { ...ETAT_VIDE, ...(JSON.parse(readFileSync(chemin, "utf8")) as Partial<EtatCnil>) };
}

/** Noms d'archives publiés par la DILA, triés, sans doublon. */
export async function listerArchives(url: string, fetchImpl: FetchTexte = fetch): Promise<string[]> {
  const reponse = await fetchImpl(url);
  if (!reponse.ok) {
    throw new Error(`Liste DILA refusée : ${url} (HTTP ${reponse.status}).`);
  }
  const html = await reponse.text();
  return [...new Set(html.match(MOTIF_ARCHIVE) ?? [])].sort();
}

/** Archives strictement postérieures à l'état : un nom d'archive est daté. */
export function archivesNouvelles(liste: string[], etat: EtatCnil): string[] {
  const derniere = etat.derniere_archive;
  return [...liste].sort().filter((nom) => derniere === null || nom > derniere);
}

/**
 * Lit un tar non compressé. Les en-têtes pax et GNU sont ignorés ; seuls les
 * fichiers réguliers sont rendus. Les archives DILA pèsent quelques kilo-octets.
 */
export function extraireTar(tar: Buffer): EntreeTar[] {
  const entrees: EntreeTar[] = [];
  let position = 0;
  while (position + 512 <= tar.length) {
    const bloc = tar.subarray(position, position + 512);
    if (bloc.every((octet) => octet === 0)) break;

    const fin = (debut: number, longueur: number): string =>
      bloc
        .subarray(debut, debut + longueur)
        .toString("utf8")
        .replace(/\0.*$/s, "")
        .trim();
    const nom = fin(0, 100);
    const prefixe = fin(345, 155);
    const taille = Number.parseInt(fin(124, 12) || "0", 8);
    const type = String.fromCharCode(bloc[156] ?? 0);
    const debutDonnees = position + 512;

    if (nom !== "" && (type === "0" || type === "\0")) {
      entrees.push({
        nom: prefixe === "" ? nom : `${prefixe}/${nom}`,
        donnees: tar.subarray(debutDonnees, debutDonnees + taille),
      });
    }
    position = debutDonnees + Math.ceil(taille / 512) * 512;
  }
  return entrees;
}

/** Une archive lue : son nom, l'empreinte de ses octets, ses décisions retenues. */
export type ArchiveLue = {
  nom: string;
  sha256: string;
  /** Nombre de fichiers `TEXTE_CNIL` parsés, toutes natures confondues. */
  documentsLus: number;
  /** Décisions de la nature demandée. */
  decisions: DecisionDila[];
};

/** Télécharge, décompresse et parse une archive ; retient la nature demandée. */
export async function lireArchiveDepuis(
  nom: string,
  descripteur: DescripteurCnil,
  fetchImpl: FetchBinaire = fetch,
  nature = descripteur.nature,
): Promise<ArchiveLue> {
  const url = new URL(nom, descripteur.dila.url).href;
  const reponse = await fetchImpl(url);
  if (!reponse.ok) {
    throw new Error(`Archive DILA refusée : ${nom} (HTTP ${reponse.status}).`);
  }
  const octets = Buffer.from(await reponse.arrayBuffer());
  const sha256 = createHash("sha256").update(octets).digest("hex");

  const decisions: DecisionDila[] = [];
  let documentsLus = 0;
  for (const entree of extraireTar(gunzipSync(octets))) {
    if (!/CNILTEXT\d+\.xml$/i.test(entree.nom)) continue;
    documentsLus += 1;
    const decision = parseTexteCnil(entree.donnees.toString("utf8"), entree.nom);
    if (decision.natureDelib !== nature) continue;
    if (decision.paragraphes.length === 0) {
      throw new Error(`${entree.nom} : ${decision.id} sans texte, nature ${nature} attendue`);
    }
    decisions.push(decision);
  }
  return { nom, sha256, documentsLus, decisions };
}

/**
 * Applique les décisions lues, par `doc_id`. Un document absent est ajouté ;
 * un document présent n'est remplacé que si l'archive est strictement plus
 * récente que sa date : une archive plus ancienne ne dégrade jamais le
 * `chunk_index` publié de la DINUM. Les décisions sont appliquées dans
 * l'ordre, une archive plus récente gagne.
 */
export function fusionnerDecisions(
  unites: Unite[],
  decisions: DecisionDila[],
  descripteur: Pick<DescripteurCnil, "corpus" | "nom" | "url_texte">,
): { unites: Unite[]; remplacees: number; ajoutees: number; ignorees: number } {
  let courant = [...unites];
  let remplacees = 0;
  let ajoutees = 0;
  let ignorees = 0;
  for (const decision of decisions) {
    const existantes = courant.filter((unite) => unite.document === decision.id);
    const dateCorpus = existantes[0]?.date_acte ?? "";
    if (existantes.length > 0 && decision.dateTexte <= dateCorpus) {
      ignorees += 1;
      continue;
    }
    const nouvelles = unitesDila(decision, descripteur);
    courant = courant.filter((unite) => unite.document !== decision.id);
    courant.push(...nouvelles);
    remplacees += existantes.length;
    ajoutees += nouvelles.length;
  }
  return { unites: courant, remplacees, ajoutees, ignorees };
}
