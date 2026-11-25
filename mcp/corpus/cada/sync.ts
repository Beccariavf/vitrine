/**
 * Synchronise le corpus `cada` depuis le fichier consolidé de data.gouv.fr.
 *
 * Le fichier est adressé par son `sha256` : un fichier identique à celui de
 * `etat.json` n'est ni retéléchargé ni relu. La règle de volume est tranchée
 * après une mesure complète, avant toute écriture ; le corpus n'est écrit
 * qu'après validation de tous ses fragments.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FetchLike } from "../../../veille/fetch.ts";
import type { Unite } from "../parse.ts";
import { enregistrementsCsv } from "./csv.ts";
import {
  ajouterLigne,
  anomaliesDe,
  colonnesDe,
  creerMesure,
  deciderVolume,
  exclusionsDe,
  lireDescripteur,
  lireLigne,
  unitesCada,
} from "./parse.ts";
import type {
  AnomalieCada,
  DescripteurCada,
  DocumentCada,
  ExclusionCada,
  VolumeCada,
} from "./parse.ts";
import {
  memeRessource,
  nomFichier,
  resoudreRessource,
  sha256Fichier,
  telechargerRessource,
} from "./source.ts";
import type { FetchBinaire, RessourceCada } from "./source.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "cada");
/** Dossier de la source brute, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "cada");

/** Ce qui a déjà été lu, pour ne pas relire un fichier identique. */
export type EtatCada = {
  fichier: string;
  sha256: string;
  lu_le: string;
  lignes_lues: number;
  documents: number;
  unites: number;
  ressource: {
    id: string;
    url: string;
    sha1: string | null;
    modifiee_le: string | null;
    taille: number | null;
  };
};

export type CompteNature = { documents: number; unites: number };

/** Manifeste du corpus, sur le modèle de la CNIL : source, couverture, volume. */
export type ManifesteCada = {
  corpus: string;
  nom: string;
  documents: number;
  unites: number;
  par_nature: Record<string, CompteNature>;
  par_sens: Record<string, number>;
  decoupage: string;
  arrete_le: string;
  url_texte: string;
  url_texte_verifiee: boolean;
  url_texte_note: string;
  source: {
    jeu: string;
    jeu_id: string;
    ressource_id: string;
    ressource_titre: string;
    url: string;
    fichier: string;
    sha256: string;
    sha1: string | null;
    taille: number | null;
    modifiee_le: string | null;
    licence: string;
  };
  couverture: {
    source: string;
    date: string | null;
    bornes: { debut: string | null; fin: string | null };
    lignes_lues: number;
    exclusions: ExclusionCada[];
    anomalies: AnomalieCada[];
    volume: VolumeCada;
    comptes: { documents: number; unites: number };
  };
};

/** Delta entre le corpus déjà écrit et celui qui vient d'être construit. */
export type DeltaCada = {
  documents_ajoutes: number;
  documents_remplaces: number;
  documents_inchanges: number;
  documents_supprimes: number;
  unites_ajoutees: number;
  unites_remplacees: number;
  unites_inchangees: number;
  unites_supprimees: number;
};

export type ResultatCada = {
  lignes_lues: number;
  documents: number;
  unites: number;
  fragments_total: number;
  volume: VolumeCada;
  exclusions: ExclusionCada[];
  anomalies: AnomalieCada[];
  delta: DeltaCada;
  /** Faux quand le fichier de `etat.json` est identique : rien n'a été relu. */
  relu: boolean;
  /** Vrai si un fichier du corpus a changé sur le disque. */
  ecrit: boolean;
};

export type SyncOptions = {
  rootDir?: string;
  descripteurPath?: string;
  dryRun?: boolean;
  /** Réponse JSON de l'API, injectable ; le réseau n'est jamais appelé en test. */
  fetchImpl?: FetchLike;
  /** Téléchargement du CSV, injectable. */
  fetchBinaire?: FetchBinaire;
  /** Ressource déjà résolue, pour éviter l'API. */
  ressource?: RessourceCada;
  /** CSV local à lire, sans API ni téléchargement. */
  fichier?: string;
  /** Date de la passe, pour les tests. */
  date?: string;
};

/** Lit l'état de lecture ; `null` s'il est absent ou illisible. */
export function lireEtat(chemin: string): EtatCada | null {
  if (!existsSync(chemin)) return null;
  try {
    const valeur = JSON.parse(readFileSync(chemin, "utf8")) as Partial<EtatCada>;
    if (
      typeof valeur.fichier !== "string" ||
      typeof valeur.sha256 !== "string" ||
      typeof valeur.lu_le !== "string"
    ) {
      return null;
    }
    return valeur as EtatCada;
  } catch {
    return null;
  }
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

/** Lit `unites.jsonl` s'il existe ; un corpus absent vaut une liste vide. */
export function lireCorpus(chemin: string): Unite[] {
  if (!existsSync(chemin)) return [];
  return readFileSync(chemin, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim() !== "")
    .map((ligne) => JSON.parse(ligne) as Unite);
}

/**
 * Valide le corpus complet avant écriture : références uniques, textes non
 * vides, dates ISO, document, corpus et URL renseignés. Lève en nommant les
 * défauts ; rien n'est écrit.
 */
export function validerUnites(unites: Unite[]): void {
  const erreurs: string[] = [];
  const vues = new Set<string>();
  for (const unite of unites) {
    if (unite.ref.trim() === "") {
      erreurs.push("référence vide");
      continue;
    }
    if (vues.has(unite.ref)) erreurs.push(`référence dupliquée : ${unite.ref}`);
    vues.add(unite.ref);
    if (unite.texte.trim() === "") erreurs.push(`texte vide : ${unite.ref}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(unite.date_acte) || Number.isNaN(Date.parse(unite.date_acte))) {
      erreurs.push(`date non ISO : ${unite.ref} (${unite.date_acte || "vide"})`);
    }
    if (unite.document.trim() === "") erreurs.push(`document vide : ${unite.ref}`);
    if (unite.corpus.trim() === "") erreurs.push(`corpus vide : ${unite.ref}`);
    if (unite.url.trim() === "") erreurs.push(`URL vide : ${unite.ref}`);
  }
  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 10).join(" ; ");
    const reste = erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : "";
    throw new Error(`Corpus CADA invalide, rien n'est écrit : ${liste}${reste}`);
  }
}

/** Parcourt un CSV : l'en-tête d'abord, puis chaque ligne avec ses colonnes. */
async function* lignesUtiles(
  chemin: string,
): AsyncGenerator<{ colonnes: Map<string, number>; champs: string[] }> {
  let colonnes: Map<string, number> | null = null;
  for await (const champs of enregistrementsCsv(chemin)) {
    if (colonnes === null) {
      colonnes = colonnesDe(champs);
      continue;
    }
    if (champs.length === 1 && champs[0] === "") continue;
    yield { colonnes, champs };
  }
  if (colonnes === null) throw new Error(`CSV vide ou sans en-tête : ${chemin}`);
}

/** Compte documents et fragments par nature, puis documents par sens. */
function compter(
  unites: Unite[],
  documents: Map<string, DocumentCada>,
): { parNature: Record<string, CompteNature>; parSens: Record<string, number> } {
  const natures = new Map<string, { documents: Set<string>; unites: number }>();
  for (const unite of unites) {
    const nature = unite.nature ?? "";
    const compte = natures.get(nature) ?? { documents: new Set<string>(), unites: 0 };
    compte.documents.add(unite.document);
    compte.unites += 1;
    natures.set(nature, compte);
  }
  const sens = new Map<string, Set<string>>();
  for (const document of documents.values()) {
    const cle = document.sens === "" ? "(vide)" : document.sens;
    const ensemble = sens.get(cle) ?? new Set<string>();
    ensemble.add(document.numero);
    sens.set(cle, ensemble);
  }
  return {
    parNature: Object.fromEntries(
      [...natures.entries()]
        .sort(([gauche], [droite]) => gauche.localeCompare(droite, "fr"))
        .map(([nature, compte]) => [nature, { documents: compte.documents.size, unites: compte.unites }]),
    ),
    parSens: Object.fromEntries(
      [...sens.entries()]
        .sort(([gauche], [droite]) => gauche.localeCompare(droite, "fr"))
        .map(([valeur, ensemble]) => [valeur, ensemble.size]),
    ),
  };
}

/** Répartition d'un corpus existant, par document, sous forme comparable. */
function grouperParDocument(unites: Unite[]): Map<string, string> {
  const groupes = new Map<string, Unite[]>();
  for (const unite of unites) {
    const liste = groupes.get(unite.document) ?? [];
    liste.push(unite);
    groupes.set(unite.document, liste);
  }
  return new Map(
    [...groupes.entries()].map(([document, liste]) => [document, JSON.stringify(liste)]),
  );
}

/** Delta entre l'ancien corpus et le nouveau, compté par document et par unité. */
export function calculerDelta(anciennes: Unite[], nouvelles: Unite[]): DeltaCada {
  const avant = grouperParDocument(anciennes);
  const apres = grouperParDocument(nouvelles);
  const delta: DeltaCada = {
    documents_ajoutes: 0,
    documents_remplaces: 0,
    documents_inchanges: 0,
    documents_supprimes: 0,
    unites_ajoutees: 0,
    unites_remplacees: 0,
    unites_inchangees: 0,
    unites_supprimees: 0,
  };
  const unitesAvant = new Map(anciennes.map((unite) => [unite.ref, unite.texte]));
  const unitesApres = new Map(nouvelles.map((unite) => [unite.ref, unite.texte]));

  for (const [document, contenu] of apres) {
    const precedent = avant.get(document);
    if (precedent === undefined) {
      delta.documents_ajoutes += 1;
    } else if (precedent === contenu) {
      delta.documents_inchanges += 1;
    } else {
      delta.documents_remplaces += 1;
    }
  }
  for (const document of avant.keys()) {
    if (!apres.has(document)) delta.documents_supprimes += 1;
  }
  for (const [ref, texte] of unitesApres) {
    const precedent = unitesAvant.get(ref);
    if (precedent === undefined) delta.unites_ajoutees += 1;
    else if (precedent === texte) delta.unites_inchangees += 1;
    else delta.unites_remplacees += 1;
  }
  for (const ref of unitesAvant.keys()) {
    if (!unitesApres.has(ref)) delta.unites_supprimees += 1;
  }
  return delta;
}

/** Comptes relus à l'état, quand le fichier n'a pas été relu. */
function resultatInchange(
  etat: EtatCada,
  volume: VolumeCada,
  exclusions: ExclusionCada[],
  anomalies: AnomalieCada[],
): ResultatCada {
  return {
    lignes_lues: etat.lignes_lues,
    documents: etat.documents,
    unites: etat.unites,
    fragments_total: volume.fragments_total,
    volume,
    exclusions,
    anomalies,
    delta: {
      documents_ajoutes: 0,
      documents_remplaces: 0,
      documents_inchanges: etat.documents,
      documents_supprimes: 0,
      unites_ajoutees: 0,
      unites_remplacees: 0,
      unites_inchangees: etat.unites,
      unites_supprimees: 0,
    },
    relu: false,
    ecrit: false,
  };
}

/**
 * Une passe de synchronisation. Rien n'est écrit avant la mesure, la décision
 * de volume et la validation de tout le corpus ; en `dryRun`, seuls les comptes
 * sont rendus.
 */
export async function syncCada(options: SyncOptions = {}): Promise<ResultatCada> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteur(options.descripteurPath ?? join(ICI, "descripteur.json"));
  const cheminEtat = join(rootDir, DOSSIER_CORPUS, "etat.json");
  const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const cheminManifeste = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  const etat = lireEtat(cheminEtat);
  const passe = options.date ?? new Date().toISOString().slice(0, 10);

  let ressource: RessourceCada;
  let chemin: string;
  let sha256: string;
  let fichierLu: string;

  if (options.fichier !== undefined) {
    chemin = resolve(options.fichier);
    if (!existsSync(chemin)) throw new Error(`Fichier introuvable : ${chemin}`);
    sha256 = await sha256Fichier(chemin);
    fichierLu = basename(chemin);
    ressource = {
      id: descripteur.ressource.id,
      titre: descripteur.ressource.titre,
      url: descripteur.ressource.url,
      sha1: null,
      modifiee_le: null,
      taille: statSync(chemin).size,
    };
  } else {
    const resolution =
      options.ressource === undefined
        ? await resoudreRessource(descripteur, options.fetchImpl)
        : { ressource: options.ressource };
    ressource = resolution.ressource;
    fichierLu = nomFichier(ressource);

    const local = join(rootDir, DOSSIER_BRUT, fichierLu);
    const fichierIdentique =
      etat !== null &&
      etat.sha256 !== "" &&
      memeRessource(etat.ressource, ressource) &&
      existsSync(local) &&
      (await sha256Fichier(local)) === etat.sha256;

    if (fichierIdentique) {
      const exclusions = exclusionsDuManifeste(cheminManifeste);
      const volume = volumeDuManifeste(cheminManifeste);
      return resultatInchange(etat, volume, exclusions, anomaliesDuManifeste(cheminManifeste));
    }

    const telecharge = await telechargerRessource(ressource, join(rootDir, DOSSIER_BRUT), options.fetchBinaire);
    chemin = telecharge.chemin;
    sha256 = telecharge.sha256;
  }

  // Premier passage en flux : mesure complète, sans garder les textes.
  const mesure = creerMesure();
  let colonnes: Map<string, number> | null = null;
  for await (const ligne of lignesUtiles(chemin)) {
    colonnes ??= ligne.colonnes;
    ajouterLigne(mesure, ligne.champs, ligne.colonnes);
  }
  if (colonnes === null) throw new Error(`CSV vide ou sans en-tête : ${chemin}`);
  const volume = deciderVolume(mesure, descripteur);
  const exclusions = exclusionsDe(mesure, volume.decision === "tout" ? "" : descripteur.date_min);
  const anomalies = anomaliesDe(mesure);

  // Second passage en flux : les unités des seuls documents retenus.
  const retenus = new Map<string, DocumentCada>();
  const vus = new Set<string>();
  const unites: Unite[] = [];
  for await (const { champs } of lignesUtiles(chemin)) {
    const lecture = lireLigne(champs, colonnes);
    if (lecture.genre === "exclue") continue;
    const document = lecture.document;
    if (vus.has(document.numero)) continue;
    vus.add(document.numero);
    if (volume.decision !== "tout" && document.date < descripteur.date_min) continue;
    retenus.set(document.numero, document);
    unites.push(...unitesCada(document, descripteur));
  }
  validerUnites(unites);

  if (unites.length !== volume.fragments_retenus) {
    throw new Error(
      `Mesure et construction divergent : ${unites.length} fragments construits, ` +
        `${volume.fragments_retenus} mesurés. Rien n'est écrit.`,
    );
  }

  const documents = new Set(unites.map((unite) => unite.document)).size;
  const existantes = lireCorpus(cheminUnites);
  const delta = calculerDelta(existantes, unites);
  const comptes = compter(unites, retenus);
  const debut = [...retenus.values()].reduce<string | null>(
    (min, document) => (min === null || document.date < min ? document.date : min),
    null,
  );
  const fin = [...retenus.values()].reduce<string | null>(
    (max, document) => (max === null || document.date > max ? document.date : max),
    null,
  );

  const manifeste: ManifesteCada = {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    documents,
    unites: unites.length,
    par_nature: comptes.parNature,
    par_sens: comptes.parSens,
    decoupage:
      "local — paragraphes regroupés jusqu'à 1 200 caractères, un paragraphe long restant seul ; " +
      "fragment plus court quand le suivant ne tient pas ; aucun caractère perdu, blancs normalisés",
    arrete_le: fin ?? passe,
    url_texte: descripteur.url_texte,
    url_texte_verifiee: descripteur.url_texte_verifiee,
    url_texte_note: descripteur.url_texte_note,
    source: {
      jeu: descripteur.jeu.url,
      jeu_id: descripteur.jeu.id,
      ressource_id: ressource.id,
      ressource_titre: ressource.titre,
      url: ressource.url,
      fichier: fichierLu,
      sha256,
      sha1: ressource.sha1,
      taille: ressource.taille,
      modifiee_le: ressource.modifiee_le,
      licence: descripteur.licence,
    },
    couverture: {
      source: "data.gouv.fr — Avis et conseils de la CADA (Licence Ouverte 2.0)",
      date: ressource.modifiee_le,
      bornes: { debut, fin },
      lignes_lues: mesure.lignes_lues,
      exclusions,
      anomalies,
      volume,
      comptes: { documents, unites: unites.length },
    },
  };

  const nouvelEtat: EtatCada = {
    fichier: fichierLu,
    sha256,
    lu_le: passe,
    lignes_lues: mesure.lignes_lues,
    documents,
    unites: unites.length,
    ressource: {
      id: ressource.id,
      url: ressource.url,
      sha1: ressource.sha1,
      modifiee_le: ressource.modifiee_le,
      taille: ressource.taille,
    },
  };

  let ecrit = false;
  if (options.dryRun !== true) {
    const ecritUnites = ecrireSiChange(
      cheminUnites,
      `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    );
    const ecritManifeste = ecrireSiChange(cheminManifeste, `${JSON.stringify(manifeste, null, 2)}\n`);
    const ecritEtat = ecrireSiChange(cheminEtat, `${JSON.stringify(nouvelEtat, null, 2)}\n`);
    ecrit = ecritUnites || ecritManifeste || ecritEtat;
  }

  return {
    lignes_lues: mesure.lignes_lues,
    documents,
    unites: unites.length,
    fragments_total: mesure.fragments_total,
    volume,
    exclusions,
    anomalies,
    delta,
    relu: true,
    ecrit,
  };
}

/** Anomalies déjà consignées, pour ne pas les perdre quand rien n'est relu. */
function anomaliesDuManifeste(chemin: string): AnomalieCada[] {
  if (!existsSync(chemin)) return [];
  try {
    const manifeste = JSON.parse(readFileSync(chemin, "utf8")) as Partial<ManifesteCada>;
    return Array.isArray(manifeste.couverture?.anomalies) ? manifeste.couverture.anomalies : [];
  } catch {
    return [];
  }
}

/** Exclusions déjà consignées, pour ne pas les perdre quand rien n'est relu. */
function exclusionsDuManifeste(chemin: string): ExclusionCada[] {
  if (!existsSync(chemin)) return [];
  try {
    const manifeste = JSON.parse(readFileSync(chemin, "utf8")) as Partial<ManifesteCada>;
    return Array.isArray(manifeste.couverture?.exclusions) ? manifeste.couverture.exclusions : [];
  } catch {
    return [];
  }
}

/** Volume déjà consigné, pour ne pas le perdre quand rien n'est relu. */
function volumeDuManifeste(chemin: string): VolumeCada {
  if (existsSync(chemin)) {
    try {
      const manifeste = JSON.parse(readFileSync(chemin, "utf8")) as Partial<ManifesteCada>;
      if (manifeste.couverture?.volume !== undefined) return manifeste.couverture.volume;
    } catch {
      // Manifeste illisible : le volume sera dit inconnu plutôt que deviné.
    }
  }
  return {
    fragments_total: 0,
    fragments_retenus: 0,
    plafond: 0,
    part_index: 0,
    decision: "sous_ensemble_non_indexe",
    indexable: false,
    motif: "volume inconnu : manifeste absent",
  };
}

/** Une ligne lisible pour le compte rendu de passe. */
export function formaterResultat(resultat: ResultatCada, dryRun: boolean): string {
  const exclusions = resultat.exclusions
    .map((exclusion) => `${exclusion.lignes} ${exclusion.motif}`)
    .join(", ");
  const anomalies = resultat.anomalies
    .map((anomalie) => anomalie.constat.split(" : ")[0] ?? anomalie.constat)
    .join(", ");
  return (
    `cada : ${resultat.lignes_lues} ligne(s) lue(s), ${resultat.documents} document(s), ` +
    `${resultat.unites} fragment(s)` +
    (exclusions === "" ? "" : ` (${exclusions})`) +
    (anomalies === "" ? "" : ` ; anomalies : ${anomalies}`) +
    ` ; volume : ${resultat.volume.motif}` +
    ` ; ${resultat.delta.documents_ajoutes} document(s) ajouté(s), ` +
    `${resultat.delta.documents_remplaces} remplacé(s), ${resultat.delta.documents_inchanges} inchangé(s)` +
    `${dryRun ? " — dry-run, rien n'est écrit" : resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé"}`
  );
}

async function main(argv: string[]): Promise<void> {
  const valeurDe = (nom: string): string | undefined => {
    const index = argv.indexOf(nom);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const dryRun = argv.includes("--dry-run");
  const fichier = valeurDe("--fichier");
  const rootDir = valeurDe("--root");
  const resultat = await syncCada({
    ...(dryRun ? { dryRun } : {}),
    ...(fichier === undefined ? {} : { fichier }),
    ...(rootDir === undefined ? {} : { rootDir }),
  });
  process.stderr.write(`${formaterResultat(resultat, dryRun)}\n`);
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
