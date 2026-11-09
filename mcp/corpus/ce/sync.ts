/**
 * Synchronise le corpus du Conseil d'État depuis l'archive globale JADE.
 *
 * L'archive est un instantané complet, pas un incrément : elle est lue en flux,
 * décision par décision, puis le corpus n'est écrit qu'après validation. Un
 * second passage sur la même archive et la même empreinte ne relit rien et ne
 * réécrit rien.
 */

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Unite } from "../parse.ts";
import { lireEntreesJade } from "./archive.ts";
import type { EntreeJade, FetchFlux, Fonds } from "./archive.ts";
import {
  ECARTES_VIDES,
  classerDecision,
  estConseilEtat,
  parseDecisionJade,
  unitesJade,
  validerUnites,
} from "./parse.ts";
import type { DescripteurCe, Ecartes } from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus CE sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "ce");
/** Dossier de l'archive brute, non commitée. */
export const DOSSIER_BRUT = join("data", "raw", "ce");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Réponse texte minimale d'un `fetch`, injectable en test. */
export type FetchTexte = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** État de reprise : l'archive déjà lue et son empreinte. */
export type EtatCe = {
  archive: string | null;
  sha256: string | null;
  lu_le: string | null;
  date_min: string | null;
  /** Empreinte du filtre (borne, juridiction, exclusions, mots-clés). */
  filtre_sha256: string | null;
};

export const ETAT_VIDE: EtatCe = {
  archive: null,
  sha256: null,
  lu_le: null,
  date_min: null,
  filtre_sha256: null,
};

export type Exclusions = {
  juridictions: string[];
  motifs: Ecartes;
};

/** Comptes d'un fonds JADE : publié au recueil ou inédit. */
export type CompteFonds = {
  documents_lus: number;
  decisions_ce_depuis_2014: number;
  documents: number;
  fragments: number;
  /** Entrées dont l'identifiant avait déjà été lu dans l'autre fonds. */
  doublons: number;
  ecartes: Ecartes;
};

/** Manifeste du corpus : identité, comptes, écarts et couverture déclarée. */
export type ManifesteCe = {
  corpus: string;
  nom: string;
  titre: string;
  archive: string;
  archive_sha256: string;
  archive_url: string;
  date_extraction: string;
  date_min: string;
  mots_cles: string[];
  juridiction: string;
  licence: string;
  /** Entrées XML lues dans l'archive, toutes juridictions confondues. */
  documents_lus: number;
  /** Décisions du Conseil d'État datées au moins du `date_min`, avant mots-clés. */
  decisions_ce_depuis_2014: number;
  /** Décisions retenues après filtrage. */
  documents: number;
  fragments: number;
  /** Entrées ignorées parce que leur identifiant avait déjà été lu. */
  doublons: number;
  ecartes: Ecartes;
  couverture: {
    source: string;
    archive: string;
    periode: { date_min: string; date_max: string | null };
    juridiction: string;
    mots_cles: string[];
    /** Comptes par fonds : `publie` et `inedit`. */
    fonds: Record<Fonds, CompteFonds>;
    exclusions: Exclusions;
  };
};

export type SyncCeOptions = {
  rootDir?: string;
  descripteurPath?: string;
  /** Archive locale ; par défaut, la plus récente de la liste DILA est téléchargée. */
  archive?: string;
  dateMin?: string;
  dryRun?: boolean;
  /** Date d'extraction consignée ; par défaut, le jour courant. */
  date?: string;
  fetchTexte?: FetchTexte;
  fetchFlux?: FetchFlux;
  /** Plafond d'une entrée XML, pour les tests. */
  maxOctets?: number;
};

export type ResultatCe = {
  archive: string;
  sha256: string;
  archiveUrl: string;
  /** Vrai quand l'état portait déjà cette archive et cette empreinte. */
  ignore: boolean;
  ecrit: boolean;
  documentsLus: number;
  decisionsCeDepuis2014: number;
  documents: number;
  fragments: number;
  doublons: number;
  ecartes: Ecartes;
  parFonds: Record<Fonds, CompteFonds>;
};

/** Lit le descripteur CE. */
export function lireDescripteurCe(chemin: string): DescripteurCe {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurCe;
}

/** Lit l'état de reprise ; un état absent vaut l'état vide. */
export function lireEtat(chemin: string): EtatCe {
  if (!existsSync(chemin)) return { ...ETAT_VIDE };
  try {
    return { ...ETAT_VIDE, ...(JSON.parse(readFileSync(chemin, "utf8")) as Partial<EtatCe>) };
  } catch {
    return { ...ETAT_VIDE };
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

/** Empreinte sha256 d'un fichier, lue en flux : l'archive ne tient pas en mémoire. */
export function sha256Fichier(chemin: string): Promise<string> {
  return new Promise((reussir, echouer) => {
    const empreinte = createHash("sha256");
    createReadStream(chemin)
      .on("data", (morceau) => empreinte.update(morceau))
      .on("error", echouer)
      .on("end", () => reussir(empreinte.digest("hex")));
  });
}

/** Expression régulière d'un motif glob simple (`*` seul joker admis). */
export function motifVersExpression(motif: string): RegExp {
  const echappe = motif
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    // Un `*` de motif désigne un nom de fichier, jamais le reste du document.
    .replace(/\*/g, "[^\\s\"'<>/]*");
  return new RegExp(echappe, "g");
}

/** Noms d'archives publiés par la DILA, triés, sans doublon. */
export async function listerArchives(
  url: string,
  motif: string,
  fetchImpl: FetchTexte = fetch as unknown as FetchTexte,
): Promise<string[]> {
  const reponse = await fetchImpl(url);
  if (!reponse.ok) {
    throw new Error(`Liste JADE refusée : ${url} (HTTP ${reponse.status}).`);
  }
  const html = await reponse.text();
  return [...new Set(html.match(motifVersExpression(motif)) ?? [])].sort();
}

/** Télécharge une archive par fichier temporaire puis renommage. */
export async function telechargerArchive(
  url: string,
  chemin: string,
  fetchImpl: FetchFlux = fetch as unknown as FetchFlux,
): Promise<void> {
  mkdirSync(dirname(chemin), { recursive: true });
  const reponse = await fetchImpl(url);
  if (!reponse.ok) {
    throw new Error(`Téléchargement JADE refusé : ${url} (HTTP ${reponse.status}).`);
  }
  if (reponse.body === null) {
    throw new Error(`Téléchargement JADE sans corps : ${url}.`);
  }
  const temporaire = `${chemin}.tmp`;
  try {
    await pipeline(Readable.fromWeb(reponse.body), createWriteStream(temporaire));
    if (!existsSync(temporaire) || statSync(temporaire).size === 0) {
      throw new Error(`Téléchargement JADE vide : ${url}.`);
    }
    renameSync(temporaire, chemin);
  } finally {
    if (existsSync(temporaire)) rmSync(temporaire, { force: true });
  }
}

/** Date du jour en UTC, forme `AAAA-MM-JJ`. */
export function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/** Empreinte de la configuration : changer un fonds, un titre, un mot-clé ou la borne force une relecture. */
export function empreinteFiltre(descripteur: DescripteurCe, dateMin: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 3,
        fonds: ["publie", "inedit"],
        titre: descripteur.titre,
        date_min: dateMin,
        juridiction: descripteur.juridiction,
        juridictions_exclues: descripteur.juridictions_exclues,
        mots_cles: descripteur.mots_cles,
      }),
      "utf8",
    )
    .digest("hex");
}

/** Comptes vides d'un fonds. */
export function compteFondsVide(): CompteFonds {
  return {
    documents_lus: 0,
    decisions_ce_depuis_2014: 0,
    documents: 0,
    fragments: 0,
    doublons: 0,
    ecartes: { ...ECARTES_VIDES },
  };
}

/** Manifeste du corpus, à partir des comptes mesurés. */
export function manifesteCe(
  descripteur: DescripteurCe,
  archive: string,
  archiveUrl: string,
  sha256: string,
  dateExtraction: string,
  dateMin: string,
  comptes: {
    documentsLus: number;
    decisionsCeDepuis2014: number;
    documents: number;
    fragments: number;
    doublons: number;
    ecartes: Ecartes;
    parFonds: Record<Fonds, CompteFonds>;
    dateMax: string | null;
  },
): ManifesteCe {
  return {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    archive,
    archive_sha256: sha256,
    archive_url: archiveUrl,
    date_extraction: dateExtraction,
    date_min: dateMin,
    mots_cles: descripteur.mots_cles,
    juridiction: descripteur.juridiction,
    licence: descripteur.licence,
    documents_lus: comptes.documentsLus,
    decisions_ce_depuis_2014: comptes.decisionsCeDepuis2014,
    documents: comptes.documents,
    fragments: comptes.fragments,
    doublons: comptes.doublons,
    ecartes: comptes.ecartes,
    couverture: {
      source: "DILA — JADE (OPENDATA), fonds publie et inedit",
      archive,
      periode: { date_min: dateMin, date_max: comptes.dateMax },
      juridiction: descripteur.juridiction,
      mots_cles: descripteur.mots_cles,
      fonds: comptes.parFonds,
      exclusions: {
        juridictions: descripteur.juridictions_exclues,
        motifs: comptes.ecartes,
      },
    },
  };
}

/** Lit le manifeste existant, pour rapporter un corpus inchangé. */
function lireManifeste(chemin: string): ManifesteCe | null {
  if (!existsSync(chemin)) return null;
  try {
    return JSON.parse(readFileSync(chemin, "utf8")) as ManifesteCe;
  } catch {
    return null;
  }
}

/**
 * Synchronise le corpus CE. Une archive identique (nom, empreinte et borne) est
 * ignorée ; sinon l'archive est lue en flux, les décisions sont filtrées, puis
 * le corpus est validé et écrit. Un `--dry-run` ne crée aucun fichier.
 */
export async function syncCe(options: SyncCeOptions = {}): Promise<ResultatCe> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurCe(
    options.descripteurPath ?? join(ICI, "descripteur.json"),
  );
  const dateMin = options.dateMin ?? descripteur.date_min;
  if (!DATE_ISO.test(dateMin) || Number.isNaN(Date.parse(dateMin))) {
    throw new Error(`Borne de date attendue AAAA-MM-JJ ; reçu « ${dateMin} »`);
  }
  const dateExtraction = options.date ?? dateDuJour();
  if (!DATE_ISO.test(dateExtraction) || Number.isNaN(Date.parse(dateExtraction))) {
    throw new Error(`Date d'extraction attendue AAAA-MM-JJ ; reçue « ${dateExtraction} »`);
  }
  const filtreSha256 = empreinteFiltre(descripteur, dateMin);

  const cheminEtat = join(rootDir, DOSSIER_CORPUS, "etat.json");
  const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const cheminManifeste = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  const etat = lireEtat(cheminEtat);

  let cheminArchive: string;
  let archiveUrl: string;
  if (options.archive !== undefined) {
    cheminArchive = isAbsolute(options.archive)
      ? options.archive
      : resolve(rootDir, options.archive);
    if (!existsSync(cheminArchive) || statSync(cheminArchive).size === 0) {
      throw new Error(`Archive JADE absente ou vide : ${cheminArchive}`);
    }
    const nom = basename(cheminArchive);
    archiveUrl = new URL(nom, descripteur.url_liste).href;
  } else {
    const liste = await listerArchives(
      descripteur.url_liste,
      descripteur.motif_archive,
      options.fetchTexte,
    );
    const nom = liste.at(-1);
    if (nom === undefined) {
      throw new Error(`Aucune archive ${descripteur.motif_archive} dans ${descripteur.url_liste}`);
    }
    cheminArchive = join(rootDir, DOSSIER_BRUT, nom);
    archiveUrl = new URL(nom, descripteur.url_liste).href;
    if (!existsSync(cheminArchive) || statSync(cheminArchive).size === 0) {
      await telechargerArchive(archiveUrl, cheminArchive, options.fetchFlux);
    }
  }

  const archive = basename(cheminArchive);
  const sha256 = await sha256Fichier(cheminArchive);
  if (etat.archive === archive && etat.sha256 !== null && etat.sha256 !== sha256) {
    throw new Error(
      `Archive ${archive} : empreinte ${sha256} différente de celle de l'état ` +
        `(${etat.sha256}). Le fichier local est corrompu ou a été remplacé ; ` +
        `supprimez-le pour retélécharger.`,
    );
  }

  const manifesteExistant = lireManifeste(cheminManifeste);
  if (
    etat.archive === archive &&
    etat.sha256 === sha256 &&
    etat.date_min === dateMin &&
    etat.filtre_sha256 === filtreSha256 &&
    manifesteExistant !== null &&
    existsSync(cheminUnites)
  ) {
    return {
      archive,
      sha256,
      archiveUrl,
      ignore: true,
      ecrit: false,
      documentsLus: manifesteExistant.documents_lus,
      decisionsCeDepuis2014: manifesteExistant.decisions_ce_depuis_2014,
      documents: manifesteExistant.documents,
      fragments: manifesteExistant.fragments,
      doublons: manifesteExistant.doublons,
      ecartes: manifesteExistant.ecartes,
      parFonds: manifesteExistant.couverture.fonds,
    };
  }

  const ecartes: Ecartes = { ...ECARTES_VIDES };
  const parFonds: Record<Fonds, CompteFonds> = {
    publie: compteFondsVide(),
    inedit: compteFondsVide(),
  };
  const unites: Unite[] = [];
  const identifiantsVus = new Set<string>();
  let documentsLus = 0;
  let decisionsCeDepuis2014 = 0;
  let doublons = 0;
  let dateMax: string | null = null;

  for await (const entree of lireEntreesJade(createReadStream(cheminArchive), {
    nomArchive: archive,
    ...(options.maxOctets === undefined ? {} : { maxOctets: options.maxOctets }),
  })) {
    const compte = parFonds[entree.fonds];
    documentsLus += 1;
    compte.documents_lus += 1;
    const decision = parseDecisionJade(entree.donnees.toString("utf8"), entree.nom);

    // Une même décision peut figurer dans les deux fonds ; le fonds publié est
    // lu en premier et gagne, l'autre occurrence est comptée comme doublon.
    if (identifiantsVus.has(decision.id)) {
      doublons += 1;
      compte.doublons += 1;
      continue;
    }
    identifiantsVus.add(decision.id);

    if (
      estConseilEtat(decision.juridiction, descripteur) &&
      DATE_ISO.test(decision.date) &&
      !Number.isNaN(Date.parse(decision.date)) &&
      decision.date >= dateMin
    ) {
      decisionsCeDepuis2014 += 1;
      compte.decisions_ce_depuis_2014 += 1;
    }

    const verdict = classerDecision(decision, descripteur, dateMin);
    if (!verdict.retenue) {
      ecartes[verdict.motif] += 1;
      compte.ecartes[verdict.motif] += 1;
      continue;
    }
    const nouvelles = unitesJade(verdict.decision, descripteur, entree.fonds);
    compte.documents += 1;
    compte.fragments += nouvelles.length;
    for (const unite of nouvelles) {
      unites.push(unite);
      if (dateMax === null || unite.date_acte > dateMax) dateMax = unite.date_acte;
    }
  }

  validerUnites(unites);

  const documents = new Set(unites.map((unite) => unite.document)).size;
  const manifeste = manifesteCe(
    descripteur,
    archive,
    archiveUrl,
    sha256,
    dateExtraction,
    dateMin,
    {
      documentsLus,
      decisionsCeDepuis2014,
      documents,
      fragments: unites.length,
      doublons,
      ecartes,
      parFonds,
      dateMax,
    },
  );
  const etatEcrit: EtatCe = {
    archive,
    sha256,
    lu_le: dateExtraction,
    date_min: dateMin,
    filtre_sha256: filtreSha256,
  };

  let ecrit = false;
  if (options.dryRun !== true) {
    const ecritUnites = ecrireSiChange(
      cheminUnites,
      `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    );
    const ecritManifeste = ecrireSiChange(
      cheminManifeste,
      `${JSON.stringify(manifeste, null, 2)}\n`,
    );
    const ecritEtat = ecrireSiChange(cheminEtat, `${JSON.stringify(etatEcrit, null, 2)}\n`);
    ecrit = ecritUnites || ecritManifeste || ecritEtat;
  }

  return {
    archive,
    sha256,
    archiveUrl,
    ignore: false,
    ecrit,
    documentsLus,
    decisionsCeDepuis2014,
    documents,
    fragments: unites.length,
    doublons,
    ecartes,
    parFonds,
  };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const archive = valeurDe("--archive", argv);
  const dateMin = valeurDe("--date-min", argv);
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const date = valeurDe("--date", argv);

  const resultat = await syncCe({
    ...(rootDir === undefined ? {} : { rootDir }),
    ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
    ...(archive === undefined ? {} : { archive }),
    ...(dateMin === undefined ? {} : { dateMin }),
    ...(date === undefined ? {} : { date }),
    dryRun,
  });

  const details = resultat.ignore
    ? `archive déjà lue, rien relu (${resultat.documents} décisions, ` +
      `${resultat.fragments} fragments au manifeste)`
    : `${resultat.documentsLus} entrées lues, ` +
      `${resultat.decisionsCeDepuis2014} décisions CE depuis la borne, ` +
      `${resultat.documents} retenues, ${resultat.fragments} fragments ; ` +
      `fonds ${Object.entries(resultat.parFonds)
        .map(([fonds, compte]) => `${fonds}=${compte.documents}/${compte.fragments}`)
        .join(", ")} ; ` +
      `doublons ${resultat.doublons} ; ` +
      `écartées ${Object.entries(resultat.ecartes)
        .map(([motif, compte]) => `${motif}=${compte}`)
        .join(", ")}`;
  process.stderr.write(
    `${resultat.archive} : ${details}` +
      `${dryRun ? " — dry-run, rien n'est écrit" : resultat.ignore ? "" : resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé"}\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
