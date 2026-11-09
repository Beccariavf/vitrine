/**
 * Synchronise le corpus CNIL par une seule porte : l'historique DINUM, les
 * incréments DILA, ou les deux.
 *
 * Le corpus n'est écrit qu'après validation complète : un parquet amputé, une
 * archive illisible, une référence dupliquée ou un texte vide laissent les
 * fichiers existants intacts.
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
import type {
  DescripteurCnil,
  ExclusionNature,
  FetchBinaire,
  FichierDinum,
  LigneDinum,
} from "./historique.ts";
import {
  archivesNouvelles,
  fusionnerDecisions,
  lireArchiveDepuis,
  lireEtat,
  listerArchives,
} from "./increments.ts";
import type { ArchiveLue, EtatCnil, FetchTexte } from "./increments.ts";
import { natureComparable } from "./nature.ts";
import type { DecisionDila } from "./parse.ts";

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
  derniere_archive?: string;
  archive_sha256?: string;
  fichiers?: { url: string; sha256: string }[];
};

/** Comptes d'une nature : documents distincts et fragments. */
export type CompteNature = { documents: number; unites: number };

export type ManifesteCnil = {
  corpus: string;
  nom: string;
  /** Natures effectivement demandées à cette synchronisation. */
  natures: string[];
  /** Même liste, nommée explicitement pour la couverture. */
  natures_demandees: string[];
  /** Natures déclarées par le descripteur mais non demandées. */
  natures_exclues: string[];
  documents: number;
  unites: number;
  /** Comptes par nature présente : documents distincts et fragments. */
  par_nature: Record<string, CompteNature>;
  origines: Origines;
  decoupage: string;
  /** Date de la source la plus récente intégrée : l'arrêté de la synchronisation. */
  arrete_le: string;
  url_texte: string;
  url_texte_verifiee: boolean;
  url_texte_note: string;
  snapshot: string;
  revision: string;
  sources: SourceManifeste[];
  /** Couverture déclarée : sources, natures, comptes et exclusions. */
  couverture: {
    source: string;
    date: string;
    bornes: { debut: string | null; fin: string };
    natures: string[];
    natures_demandees: string[];
    natures_exclues: string[];
    par_nature: Record<string, CompteNature>;
    origines: Origines;
    /** Lignes écartées par `nature_delib`, `(vide)` pour null. */
    exclusions: ExclusionNature[];
    /** Lignes DINUM lues : unités retenues + exclusions. */
    lignes_lues: number;
    comptes: { documents: number; unites: number };
  };
};

/** Compte les origines d'un ensemble d'unités. */
export function compterOrigines(unites: Unite[]): Origines {
  return {
    dinum: unites.filter((unite) => unite.origine === "dinum").length,
    dila: unites.filter((unite) => unite.origine === "dila").length,
  };
}

/** Compte documents et fragments par nature, dans l'ordre des natures rencontrées. */
export function compterNatures(unites: Unite[]): Record<string, CompteNature> {
  const parNature = new Map<string, { documents: Set<string>; unites: number }>();
  for (const unite of unites) {
    const nature = unite.nature?.trim() ?? "";
    if (nature === "") continue;
    const compte = parNature.get(nature) ?? { documents: new Set<string>(), unites: 0 };
    compte.documents.add(unite.document);
    compte.unites += 1;
    parNature.set(nature, compte);
  }
  return Object.fromEntries(
    [...parNature.entries()]
      .sort(([gauche], [droite]) => gauche.localeCompare(droite, "fr"))
      .map(([nature, compte]) => [
        nature,
        { documents: compte.documents.size, unites: compte.unites },
      ]),
  );
}

/**
 * Natures demandées : `natures` prime, puis une `nature` unique, puis celles du
 * descripteur.
 */
export function naturesDemandees(
  options: { nature?: string; natures?: readonly string[] },
  descripteur: Pick<DescripteurCnil, "natures">,
): string[] {
  if (options.natures !== undefined && options.natures.length > 0) return [...options.natures];
  if (options.nature !== undefined && options.nature.trim() !== "") return [options.nature];
  return descripteur.natures;
}

/** Vrai si les deux ensembles de natures sont les mêmes, à la casse près. */
function memesNatures(gauche: readonly string[], droite: readonly string[]): boolean {
  if (gauche.length !== droite.length) return false;
  return gauche.every((nature) =>
    droite.some((autre) => natureComparable(autre) === natureComparable(nature)),
  );
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

/** Date portée par un nom d'archive, `CNIL_20261028-212713` → `2026-10-28`. */
export function dateArchive(nom: string | null): string | null {
  const trouve = nom === null ? null : /^CNIL_(\d{4})(\d{2})(\d{2})-/.exec(nom);
  return trouve === null ? null : `${trouve[1]}-${trouve[2]}-${trouve[3]}`;
}

/** Empreintes DINUM déjà consignées, pour ne pas les perdre en mode incréments. */
function fichiersDuManifeste(cheminManifeste: string): FichierDinum[] {
  if (!existsSync(cheminManifeste)) return [];
  try {
    const manifeste = JSON.parse(readFileSync(cheminManifeste, "utf8")) as ManifesteCnil;
    const dinum = manifeste.sources?.find((source) => source.origine === "dinum");
    return (dinum?.fichiers ?? []).map((fichier) => ({
      url: fichier.url,
      chemin: "",
      sha256: fichier.sha256,
    }));
  } catch {
    return [];
  }
}

/** Exclusions DINUM déjà consignées, pour ne pas les perdre en mode incréments. */
function exclusionsDuManifeste(cheminManifeste: string): ExclusionNature[] {
  if (!existsSync(cheminManifeste)) return [];
  try {
    const manifeste = JSON.parse(readFileSync(cheminManifeste, "utf8")) as ManifesteCnil;
    return Array.isArray(manifeste.couverture?.exclusions)
      ? manifeste.couverture.exclusions
      : [];
  } catch {
    return [];
  }
}

/** Manifeste du corpus : deux sources déclarées, comptes, découpage et arrêté. */
export function manifesteCnil(
  descripteur: DescripteurCnil,
  unites: Unite[],
  fichiers: FichierDinum[],
  etat: EtatCnil,
  natures: readonly string[] = descripteur.natures,
  exclusions: ExclusionNature[] = [],
): ManifesteCnil {
  const origines = compterOrigines(unites);
  const documents = new Set(unites.map((unite) => unite.document)).size;
  const archive = dateArchive(etat.derniere_archive);
  const arrete = archive !== null && archive > descripteur.snapshot ? archive : descripteur.snapshot;
  const parNature = compterNatures(unites);
  const exclues = exclusions.reduce((total, exclusion) => total + exclusion.lignes, 0);
  const naturesExclues = descripteur.natures.filter(
    (nature) => !natures.some((demandee) => natureComparable(demandee) === natureComparable(nature)),
  );
  return {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    natures: [...natures],
    natures_demandees: [...natures],
    natures_exclues: naturesExclues,
    documents,
    unites: unites.length,
    par_nature: parNature,
    origines,
    decoupage: origines.dila > 0 ? `dinum + ${descripteur.dila.decoupage}` : "dinum",
    arrete_le: arrete,
    couverture: {
      source: "CNIL — historique DINUM et incréments DILA",
      date: arrete,
      bornes: { debut: null, fin: arrete },
      natures: [...natures],
      natures_demandees: [...natures],
      natures_exclues: naturesExclues,
      par_nature: parNature,
      origines,
      exclusions,
      lignes_lues: origines.dinum + exclues,
      comptes: { documents, unites: unites.length },
    },
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
        ...(etat.derniere_archive === null
          ? {}
          : {
              derniere_archive: etat.derniere_archive,
              archive_sha256: etat.archive_sha256 ?? "",
            }),
      },
    ],
  };
}

export type SyncOptions = {
  rootDir?: string;
  descripteurPath?: string;
  /** Une seule nature, forme historique du filtre. */
  nature?: string;
  /** Plusieurs natures ; prime sur `nature`. */
  natures?: string[];
  dryRun?: boolean;
  fetchImpl?: FetchBinaire;
  /** Lignes DINUM déjà lues : les tests remplacent le parquet, jamais le réseau. */
  lignes?: LigneDinum[];
  /** Comptes attendus, quand l'appelant connaît son jeu réduit. */
  attendus?: { documents: number; fragments: number };
};

export type ResultatHistorique = {
  mode: "historique";
  documents: number;
  unites: number;
  origines: Origines;
  /** Vrai si un fichier du corpus a changé sur le disque. */
  ecrit: boolean;
  /** Fichiers parquet lus, avec leur empreinte. */
  fichiers: FichierDinum[];
};

/**
 * Reconstruit l'historique DINUM, puis écrit le corpus après validation. Les
 * unités DILA déjà présentes sont conservées : relancer l'historique ne doit
 * jamais effacer un incrément.
 */
export async function syncHistorique(options: SyncOptions = {}): Promise<ResultatHistorique> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteur(options.descripteurPath ?? join(ICI, "descripteur.json"));
  const natures = naturesDemandees(options, descripteur);
  const cheminEtat = join(rootDir, DOSSIER_CORPUS, "etat.json");

  const fichiers =
    options.lignes === undefined
      ? await telechargerHistorique(descripteur, join(rootDir, DOSSIER_BRUT), options.fetchImpl)
      : [];
  const lignes =
    options.lignes ?? (await lireLignes(fichiers.map((fichier) => fichier.chemin)));
  const { unites: historiques, erreurs, exclusions } = unitesDinum(lignes, descripteur, natures);
  if (erreurs.length > 0) {
    throw new Error(
      `Corpus CNIL invalide, rien n'est écrit : ${erreurs.slice(0, 10).join(" ; ")}` +
        (erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : ""),
    );
  }

  const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const existantes = lireCorpus(cheminUnites).filter((unite) => unite.origine === "dila");
  // Un incrément remplace le document qu'il porte : garder aussi la version
  // DINUM créerait deux unités de même référence.
  const documentsDila = new Set(existantes.map((unite) => unite.document));
  const unites = [
    ...historiques.filter((unite) => !documentsDila.has(unite.document)),
    ...existantes,
  ];

  const attendus =
    options.attendus ??
    (memesNatures(natures, descripteur.natures)
      ? { documents: descripteur.documents_attendus, fragments: descripteur.fragments_attendus }
      : undefined);
  // Les comptes du snapshot portent sur l'historique seul : y ajouter un
  // incrément DILA ne doit pas rendre la synchronisation invalide.
  validerUnites(historiques, attendus);
  const comptes = validerUnites(unites);
  const manifeste = manifesteCnil(
    descripteur,
    unites,
    fichiers,
    lireEtat(cheminEtat),
    natures,
    exclusions,
  );

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

export type SyncIncrementsOptions = SyncOptions & {
  /** Liste des archives ; par défaut, la page OPENDATA de la DILA. */
  lister?: (url: string) => Promise<string[]>;
  /** Lecture d'une archive ; par défaut, téléchargement puis décompression. */
  lireArchive?: (nom: string) => Promise<ArchiveLue>;
  fetchTexte?: FetchTexte;
  etatPath?: string;
};

export type ResultatIncrements = {
  mode: "increments";
  /** Archives nouvelles réellement lues. */
  archives: string[];
  archives_lues: number;
  documents_lus: number;
  documents_retenus: number;
  /** Décisions écartées parce que l'archive n'est pas plus récente que le corpus. */
  documents_ignores: number;
  unites_remplacees: number;
  documents: number;
  unites: number;
  origines: Origines;
  ecrit: boolean;
};

/**
 * Applique les archives postérieures à l'état, en remplaçant chaque `doc_id`
 * entier. Aucune écriture n'a lieu avant que toutes les archives soient lues et
 * que le corpus soit validé ; un échec laisse l'état et le corpus intacts.
 */
export async function syncIncrements(
  options: SyncIncrementsOptions = {},
): Promise<ResultatIncrements> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteur(options.descripteurPath ?? join(ICI, "descripteur.json"));
  const natures = naturesDemandees(options, descripteur);
  const cheminEtat = options.etatPath ?? join(rootDir, DOSSIER_CORPUS, "etat.json");
  const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const cheminManifeste = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  const etat = lireEtat(cheminEtat);

  const lister =
    options.lister ??
    ((url: string) => listerArchives(url, options.fetchTexte ?? (fetch as unknown as FetchTexte)));
  const lire =
    options.lireArchive ??
    ((nom: string) => lireArchiveDepuis(nom, descripteur, options.fetchImpl, natures));

  const liste = await lister(descripteur.dila.url);
  const recentes = archivesNouvelles(liste, etat);

  let unites = lireCorpus(cheminUnites);
  let documentsLus = 0;
  let documentsRetenus = 0;
  let documentsIgnores = 0;
  let unitesRemplacees = 0;
  let dernier: ArchiveLue | null = null;
  const decisions: DecisionDila[] = [];

  for (const nom of recentes) {
    const archive = await lire(nom);
    dernier = archive;
    documentsLus += archive.documentsLus;
    documentsRetenus += archive.decisions.length;
    decisions.push(...archive.decisions);
  }

  if (decisions.length > 0) {
    const fusion = fusionnerDecisions(unites, decisions, descripteur, natures);
    unites = fusion.unites;
    unitesRemplacees += fusion.remplacees;
    documentsIgnores += fusion.ignorees;
    validerUnites(unites);
  }

  const nouvelEtat: EtatCnil =
    dernier === null
      ? etat
      : {
          derniere_archive: dernier.nom,
          archive_sha256: dernier.sha256,
          lu_le: new Date().toISOString().slice(0, 10),
          archives_lues: etat.archives_lues + recentes.length,
        };
  const manifeste = manifesteCnil(
    descripteur,
    unites,
    fichiersDuManifeste(cheminManifeste),
    nouvelEtat,
    natures,
    exclusionsDuManifeste(cheminManifeste),
  );

  let ecrit = false;
  if (options.dryRun !== true) {
    const ecritUnites =
      dernier === null
        ? false
        : ecrireSiChange(
            cheminUnites,
            `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
          );
    const ecritManifeste =
      dernier === null
        ? false
        : ecrireSiChange(cheminManifeste, `${JSON.stringify(manifeste, null, 2)}\n`);
    const ecritEtat =
      dernier === null
        ? false
        : ecrireSiChange(cheminEtat, `${JSON.stringify(nouvelEtat, null, 2)}\n`);
    ecrit = ecritUnites || ecritManifeste || ecritEtat;
  }

  return {
    mode: "increments",
    archives: recentes,
    archives_lues: nouvelEtat.archives_lues,
    documents_lus: documentsLus,
    documents_retenus: documentsRetenus,
    documents_ignores: documentsIgnores,
    unites_remplacees: unitesRemplacees,
    documents: new Set(unites.map((unite) => unite.document)).size,
    unites: unites.length,
    origines: compterOrigines(unites),
    ecrit,
  };
}

/** Toutes les valeurs qui suivent `--nom`, chaque valeur admettant des virgules. */
function valeursDe(nom: string, argv: string[]): string[] {
  const valeurs: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== nom) continue;
    const valeur = argv[index + 1];
    if (valeur === undefined || valeur.startsWith("--")) continue;
    valeurs.push(
      ...valeur
        .split(",")
        .map((element) => element.trim())
        .filter((element) => element !== ""),
    );
  }
  return valeurs;
}

const MODES = ["--historique", "--increments", "--tout"] as const;

async function main(argv: string[]): Promise<void> {
  const choisis = MODES.filter((mode) => argv.includes(mode));
  if (choisis.length === 0) {
    throw new Error(`Précisez ${MODES.join(", ")}.`);
  }
  const dryRun = argv.includes("--dry-run");
  const natures = valeursDe("--nature", argv);
  const options = { ...(natures.length === 0 ? {} : { natures }), dryRun };

  if (argv.includes("--historique") || argv.includes("--tout")) {
    const resultat = await syncHistorique(options);
    process.stderr.write(
      `historique : ${resultat.unites} fragments, ${resultat.documents} documents ` +
        `(${resultat.origines.dinum} dinum, ${resultat.origines.dila} dila), ` +
        `${resultat.fichiers.length} parquet` +
        `${dryRun ? " — dry-run, rien n'est écrit" : resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé"}\n`,
    );
  }

  if (argv.includes("--increments") || argv.includes("--tout")) {
    const resultat = await syncIncrements(options);
    process.stderr.write(
      `incréments : ${resultat.archives.length} archive(s) nouvelle(s) sur ` +
        `${resultat.archives_lues}, ${resultat.documents_lus} document(s) lu(s), ` +
        `${resultat.documents_retenus} retenu(s), ${resultat.documents_ignores} ignoré(s) ` +
        `(archive non plus récente), ${resultat.unites_remplacees} unité(s) remplacée(s) ; ` +
        `corpus ${resultat.unites} fragments, ${resultat.documents} documents ` +
        `(${resultat.origines.dinum} dinum, ${resultat.origines.dila} dila)` +
        `${dryRun ? " — dry-run, rien n'est écrit" : resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé"}\n`,
    );
  }
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
