/**
 * Synchronise le corpus CNIL : l'historique DINUM, puis (phase suivante) les
 * incréments DILA. Une seule porte pour les deux origines.
 *
 * Le corpus n'est écrit qu'après validation complète : un parquet amputé, une
 * référence dupliquée ou un texte vide laissent les fichiers existants intacts.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Unite } from "../parse.ts";
import {
  lireDescripteur,
  lireLignes,
  telechargerHistorique,
  unitesDinum,
} from "./historique.ts";
import type { DescripteurCnil, FetchBinaire, FichierDinum, LigneDinum } from "./historique.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus CNIL sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "cnil");
/** Dossier des sources brutes, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "cnil");

export type Origines = { dinum: number; dila: number };

export type SourceManifeste = {
  origine: "dinum" | "dila";
  nom: string;
  url: string;
  decoupage: string;
  licence?: { huggingface: string; data_gouv: string; incoherence: boolean };
  snapshot?: string;
  revision?: string;
  fichiers?: { url: string; sha256: string }[];
};

export type ManifesteCnil = {
  corpus: string;
  nom: string;
  nature: string;
  documents: number;
  unites: number;
  origines: Origines;
  decoupage: string;
  url_texte: string;
  url_texte_verifiee: boolean;
  url_texte_note: string;
  snapshot: string;
  revision: string;
  sources: SourceManifeste[];
};

export type ResultatSync = {
  mode: "historique";
  documents: number;
  unites: number;
  origines: Origines;
  /** Vrai si `unites.jsonl` ou `manifest.json` a changé sur le disque. */
  ecrit: boolean;
  /** Fichiers parquet lus, avec leur empreinte. */
  fichiers: FichierDinum[];
};

/** Compte les origines d'un ensemble d'unités. */
export function compterOrigines(unites: Unite[]): Origines {
  return {
    dinum: unites.filter((unite) => unite.origine === "dinum").length,
    dila: unites.filter((unite) => unite.origine === "dila").length,
  };
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valide un corpus complet : références uniques, textes non vides, dates ISO,
 * et comptes attendus quand ils sont fournis. Lève en nommant les défauts.
 */
export function validerUnites(
  unites: Unite[],
  attendus?: { documents: number; fragments: number },
): { documents: number; unites: number } {
  const erreurs: string[] = [];
  const vues = new Set<string>();
  for (const unite of unites) {
    if (unite.ref.trim() === "") {
      erreurs.push("référence vide");
      continue;
    }
    if (vues.has(unite.ref)) {
      erreurs.push(`référence dupliquée : ${unite.ref}`);
    }
    vues.add(unite.ref);
    if (unite.texte.trim() === "") erreurs.push(`texte vide : ${unite.ref}`);
    if (!DATE_ISO.test(unite.date_acte) || Number.isNaN(Date.parse(unite.date_acte))) {
      erreurs.push(`date non ISO : ${unite.ref} (${unite.date_acte || "vide"})`);
    }
    if (unite.document.trim() === "") erreurs.push(`document vide : ${unite.ref}`);
    if (unite.corpus.trim() === "") erreurs.push(`corpus vide : ${unite.ref}`);
  }

  const documents = new Set(unites.map((unite) => unite.document)).size;
  if (attendus !== undefined) {
    if (documents !== attendus.documents) {
      erreurs.push(`${documents} documents au lieu de ${attendus.documents} attendus`);
    }
    if (unites.length !== attendus.fragments) {
      erreurs.push(`${unites.length} fragments au lieu de ${attendus.fragments} attendus`);
    }
  }

  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 10).join(" ; ");
    const reste = erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : "";
    throw new Error(`Corpus CNIL invalide, rien n'est écrit : ${liste}${reste}`);
  }
  return { documents, unites: unites.length };
}

/** Lit `unites.jsonl` s'il existe ; un corpus absent vaut une liste vide. */
export function lireCorpus(chemin: string): Unite[] {
  if (!existsSync(chemin)) return [];
  return readFileSync(chemin, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim() !== "")
    .map((ligne) => JSON.parse(ligne) as Unite);
}

/** Écrit un fichier UTF-8 s'il n'a pas déjà exactement ce contenu. */
function ecrireSiChange(chemin: string, contenu: string): boolean {
  try {
    if (readFileSync(chemin, "utf8") === contenu) return false;
  } catch {
    // Absent : on l'écrit plus bas.
  }
  mkdirSync(dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.tmp`;
  try {
    writeFileSync(temporaire, contenu, "utf8");
    renameSync(temporaire, chemin);
  } finally {
    if (existsSync(temporaire)) rmSync(temporaire, { force: true });
  }
  return true;
}

/** Manifeste du corpus : deux sources déclarées, comptes et découpage. */
export function manifesteCnil(
  descripteur: DescripteurCnil,
  unites: Unite[],
  fichiers: FichierDinum[],
): ManifesteCnil {
  const origines = compterOrigines(unites);
  const documents = new Set(unites.map((unite) => unite.document)).size;
  return {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    nature: descripteur.nature,
    documents,
    unites: unites.length,
    origines,
    decoupage: origines.dila > 0 ? `dinum + ${descripteur.dila.decoupage}` : "dinum",
    url_texte: descripteur.url_texte,
    url_texte_verifiee: descripteur.url_texte_verifiee,
    url_texte_note: descripteur.url_texte_note,
    snapshot: descripteur.snapshot,
    revision: descripteur.revision,
    sources: [
      {
        origine: "dinum",
        nom: descripteur.dinum.nom,
        url: descripteur.dinum.url_page,
        decoupage: "dinum",
        licence: {
          huggingface: descripteur.dinum.licence_huggingface,
          data_gouv: descripteur.dinum.licence_data_gouv,
          incoherence: descripteur.dinum.licence_incoherence,
        },
        snapshot: descripteur.snapshot,
        revision: descripteur.revision,
        fichiers: fichiers.map((fichier) => ({ url: fichier.url, sha256: fichier.sha256 })),
      },
      {
        origine: "dila",
        nom: descripteur.dila.nom,
        url: descripteur.dila.url,
        decoupage: descripteur.dila.decoupage,
      },
    ],
  };
}

export type SyncOptions = {
  rootDir?: string;
  descripteurPath?: string;
  nature?: string;
  dryRun?: boolean;
  fetchImpl?: FetchBinaire;
  /** Lignes déjà lues : les tests remplacent le parquet, jamais le réseau. */
  lignes?: LigneDinum[];
  /** Comptes attendus, quand l'appelant connaît son jeu réduit. */
  attendus?: { documents: number; fragments: number };
};

/**
 * Reconstruit l'historique DINUM, puis écrit le corpus après validation. Les
 * unités DILA déjà présentes sont conservées : relancer l'historique ne doit
 * jamais effacer un incrément.
 */
export async function syncHistorique(options: SyncOptions = {}): Promise<ResultatSync> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteur(options.descripteurPath ?? join(ICI, "descripteur.json"));
  const nature = options.nature ?? descripteur.nature;

  const fichiers =
    options.lignes === undefined
      ? await telechargerHistorique(
          descripteur,
          join(rootDir, DOSSIER_BRUT),
          options.fetchImpl,
        )
      : [];
  const lignes =
    options.lignes ?? (await lireLignes(fichiers.map((fichier) => fichier.chemin)));
  const { unites: historiques, erreurs } = unitesDinum(lignes, descripteur, nature);
  if (erreurs.length > 0) {
    throw new Error(
      `Corpus CNIL invalide, rien n'est écrit : ${erreurs.slice(0, 10).join(" ; ")}` +
        (erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : ""),
    );
  }

  const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const existantes = lireCorpus(cheminUnites).filter((unite) => unite.origine === "dila");
  const unites = [...historiques, ...existantes];

  const attendus =
    options.attendus ??
    (nature === descripteur.nature
      ? { documents: descripteur.documents_attendus, fragments: descripteur.fragments_attendus }
      : undefined);
  const comptes = validerUnites(unites, attendus);
  const manifeste = manifesteCnil(descripteur, unites, fichiers);

  let ecrit = false;
  if (options.dryRun !== true) {
    const ecritUnites = ecrireSiChange(
      cheminUnites,
      `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    );
    const ecritManifeste = ecrireSiChange(
      join(rootDir, DOSSIER_CORPUS, "manifest.json"),
      `${JSON.stringify(manifeste, null, 2)}\n`,
    );
    ecrit = ecritUnites || ecritManifeste;
  }

  return {
    mode: "historique",
    documents: comptes.documents,
    unites: comptes.unites,
    origines: compterOrigines(unites),
    ecrit,
    fichiers,
  };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  if (!argv.includes("--historique")) {
    throw new Error("Précisez --historique (les incréments DILA viendront ensuite).");
  }
  const nature = valeurDe("--nature", argv);
  const resultat = await syncHistorique({
    ...(nature === undefined ? {} : { nature }),
    dryRun,
  });
  process.stderr.write(
    `historique : ${resultat.unites} fragments, ${resultat.documents} documents ` +
      `(${resultat.origines.dinum} dinum, ${resultat.origines.dila} dila), ` +
      `${resultat.fichiers.length} parquet` +
      `${dryRun ? " — dry-run, rien n'est écrit" : resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé"}\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
