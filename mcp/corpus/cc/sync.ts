/**
 * Synchronise le corpus de la Cour de cassation depuis Judilibre (PISTE).
 *
 * La recherche est bornée par les phrases du descripteur ; chaque décision est
 * ensuite lue par `/decision`, mise en cache sous `data/raw/cc/` et filtrée.
 * Le budget d'appels est dédié à la collecte : quand il s'épuise, le corpus
 * écrit les décisions déjà lues et la passe suivante reprend au cache.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FetchLike } from "../../../veille/fetch.ts";
import { PisteBudgetError, PisteSession, flushUsage, readPisteConfig } from "../../../veille/piste.ts";
import type { PisteConfig } from "../../../veille/piste.ts";
import { validerUnitesCorpus } from "../parse.ts";
import type { Unite } from "../parse.ts";
import { ECARTES_CC_VIDES, classerDecisionCc, unitesCc } from "./parse.ts";
import type { DecisionJudilibre, DescripteurCc, EcartesCc } from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "cc");
/** Dossier du cache brut, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "cc");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID_JUDILIBRE = /^[a-z0-9]+$/;

export type EtatCc = {
  date_min: string;
  filtre_sha256: string;
  lu_le: string | null;
  /** Décisions en cache après la dernière passe. */
  cache: number;
  /** Décisions sélectionnées mais non lues, faute de budget. */
  en_attente: number;
};

export type CouvertureCc = {
  source: string;
  periode: { date_min: string; date_max: string | null };
  champs: string;
  requetes: string[];
  filtre: {
    mots_cles: string[];
    occurrences_min: number;
    visa_pertinent: boolean;
  };
  veille: { entrees: number; ajoutees: number; retenues: number };
  /** Borne demandée ; `periode.date_min` porte la première date observée. */
  borne: string;
  exclusions: EcartesCc;
  /** Identifiants sélectionnés que Judilibre ne rend pas (HTTP 404). */
  introuvables: string[];
  reprise: { en_cache: number; en_attente: number };
};

export type ManifesteCc = {
  corpus: string;
  nom: string;
  titre: string;
  source: string;
  date_min: string;
  date_extraction: string;
  licence: string;
  documents: number;
  fragments: number;
  documents_lus: number;
  doublons_recherche: number;
  exclusions: EcartesCc;
  couverture: CouvertureCc;
};

export type SyncCcOptions = {
  rootDir?: string;
  descripteurPath?: string;
  dateMin?: string;
  /** Date d'extraction consignée ; par défaut, le jour courant. */
  date?: string;
  /** Budget d'appels PISTE de cette passe ; par défaut, celui du descripteur. */
  maxAppels?: number;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
  /** Configuration PISTE ; `null` explicite interdit l'appel réseau. */
  config?: PisteConfig | null;
  /** Réponses déjà lues : les tests remplacent le réseau (`recherche` par requête). */
  reponsesRecherche?: Record<string, unknown>;
  reponsesDecision?: Record<string, unknown>;
};

export type ResultatCc = {
  documents: number;
  fragments: number;
  documentsLus: number;
  enAttente: number;
  doublons: number;
  introuvables: string[];
  ecartes: EcartesCc;
  appels: { recherche: number; decision: number };
  ecrit: boolean;
  manifestPath: string;
  unitesPath: string;
};

/** Lit l'état de reprise ; un état absent vaut `null`. */
function lireEtatCc(chemin: string): EtatCc | null {
  try {
    return JSON.parse(readFileSync(chemin, "utf8")) as EtatCc;
  } catch {
    return null;
  }
}

/** Lit un manifeste existant, pour ne pas changer sa date d'extraction sans raison. */
function lireManifesteCc(chemin: string): ManifesteCc | null {
  try {
    return JSON.parse(readFileSync(chemin, "utf8")) as ManifesteCc;
  } catch {
    return null;
  }
}

/** Lit le descripteur Cour de cassation. */
export function lireDescripteurCc(chemin: string): DescripteurCc {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurCc;
}

/** Lit `.env` quand il existe, puis les trois secrets PISTE. */
export function configPiste(rootDir: string): PisteConfig | null {
  try {
    process.loadEnvFile(join(rootDir, ".env"));
  } catch {
    // Pas de `.env` : les secrets peuvent venir de l'environnement.
  }
  return readPisteConfig();
}

/** Nombre de lignes non vides d'un fichier ; `0` s'il est absent. */
function lireNombreLignes(chemin: string): number {
  try {
    return readFileSync(chemin, "utf8").split("\n").filter((ligne) => ligne.trim() !== "").length;
  } catch {
    return 0;
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

/** Empreinte du filtre : borne, requêtes, mots-clés et seuil. */
export function empreinteFiltre(descripteur: DescripteurCc, dateMin: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        date_min: dateMin,
        champs: descripteur.champs,
        requetes: descripteur.requetes,
        mots_cles: descripteur.mots_cles,
        occurrences_min: descripteur.occurrences_min,
      }),
    )
    .digest("hex");
}

function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

type ResultatRecherche = { id: string; date: string | null };

type ReponseRecherche = {
  total?: unknown;
  results?: unknown;
};

/** Identifiants et dates des résultats d'une réponse de recherche. */
export function lireResultats(reponse: unknown): ResultatRecherche[] {
  if (typeof reponse !== "object" || reponse === null) return [];
  const results = (reponse as ReponseRecherche).results;
  if (!Array.isArray(results)) return [];
  const sortie: ResultatRecherche[] = [];
  for (const resultat of results) {
    if (typeof resultat !== "object" || resultat === null) continue;
    const id = (resultat as { id?: unknown }).id;
    const date = (resultat as { decision_date?: unknown }).decision_date;
    if (typeof id !== "string" || !ID_JUDILIBRE.test(id)) continue;
    sortie.push({ id, date: typeof date === "string" ? date : null });
  }
  return sortie;
}

/** Nombre total de résultats annoncé par une réponse, `0` s'il manque. */
export function totalResultats(reponse: unknown): number {
  if (typeof reponse !== "object" || reponse === null) return 0;
  const total = (reponse as ReponseRecherche).total;
  return typeof total === "number" && Number.isFinite(total) ? total : 0;
}

/** Parcourt `data/entries/` et rend les identifiants Judilibre publiés. */
export function entreesVeille(rootDir: string, source: string): string[] {
  const racine = join(rootDir, "data", "entries");
  if (!existsSync(racine)) return [];
  const ids: string[] = [];
  const visiter = (dossier: string): void => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) {
        visiter(chemin);
        continue;
      }
      if (!entree.name.endsWith(".json")) continue;
      try {
        const valeur: unknown = JSON.parse(readFileSync(chemin, "utf8"));
        const liste = Array.isArray(valeur) ? valeur : [valeur];
        for (const element of liste) {
          if (typeof element !== "object" || element === null) continue;
          const { source: origine, id } = element as { source?: unknown; id?: unknown };
          if (origine === source && typeof id === "string" && ID_JUDILIBRE.test(id)) ids.push(id);
        }
      } catch {
        // Une entrée illisible ne bloque pas la collecte.
      }
    }
  };
  visiter(racine);
  return ids;
}

function cheminCache(rootDir: string, id: string): string {
  return join(rootDir, DOSSIER_BRUT, "decisions", `${id}.json`);
}

/** Identifiants déjà constatés introuvables : ils ne sont pas redemandés. */
export function lireIntrouvables(rootDir: string): Set<string> {
  try {
    const valeur = JSON.parse(
      readFileSync(join(rootDir, DOSSIER_BRUT, "introuvables.json"), "utf8"),
    ) as unknown;
    return new Set(Array.isArray(valeur) ? valeur.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** Cache des décisions déjà lues, par identifiant. */
export function lireCache(rootDir: string): Map<string, DecisionJudilibre> {
  const dossier = join(rootDir, DOSSIER_BRUT, "decisions");
  const cache = new Map<string, DecisionJudilibre>();
  if (!existsSync(dossier)) return cache;
  for (const nom of readdirSync(dossier)) {
    if (!nom.endsWith(".json")) continue;
    const id = nom.slice(0, -5);
    if (!ID_JUDILIBRE.test(id)) continue;
    try {
      const valeur = JSON.parse(readFileSync(join(dossier, nom), "utf8")) as DecisionJudilibre;
      cache.set(id, valeur);
    } catch {
      // Un cache illisible est relu au prochain passage.
    }
  }
  return cache;
}

/**
 * Synchronise le corpus Cour de cassation. Une décision déjà en cache ne coûte
 * aucun appel ; la recherche, elle, est rejouée pour voir les nouveautés.
 */
export async function syncCc(options: SyncCcOptions = {}): Promise<ResultatCc> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurCc(
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
  const cheminManifeste = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  const cheminEtat = join(rootDir, DOSSIER_CORPUS, "etat.json");
  const etatExistant = lireEtatCc(cheminEtat);
  const manifesteExistant = lireManifesteCc(cheminManifeste);
  const budget = options.maxAppels ?? descripteur.max_appels;
  const filtreSha256 = empreinteFiltre(descripteur, dateMin);

  const cache = lireCache(rootDir);
  const introuvablesConnus = lireIntrouvables(rootDir);
  const dateManifeste =
    etatExistant !== null &&
    manifesteExistant !== null &&
    etatExistant.filtre_sha256 === filtreSha256 &&
    etatExistant.cache === cache.size
      ? manifesteExistant.date_extraction
      : dateExtraction;
  const veille = entreesVeille(rootDir, "judilibre");
  const veilleIds = new Set(veille);
  const veilleAjoutees = veille.filter((id) => !cache.has(id));

  if (options.dryRun === true) {
    return {
      documents: 0,
      fragments: 0,
      documentsLus: cache.size,
      enAttente: 0,
      doublons: 0,
      introuvables: [],
      ecartes: { ...ECARTES_CC_VIDES },
      appels: { recherche: 0, decision: 0 },
      ecrit: false,
      manifestPath: join(rootDir, DOSSIER_CORPUS, "manifest.json"),
      unitesPath: join(rootDir, DOSSIER_CORPUS, "unites.jsonl"),
    };
  }

  let session: PisteSession | null = null;
  if (options.reponsesRecherche === undefined) {
    const config = options.config === undefined ? configPiste(rootDir) : options.config;
    if (config === null) {
      throw new Error(
        "Configuration PISTE absente (PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_KEY_ID) : " +
          "renseignez .env ou l'environnement.",
      );
    }
    session = new PisteSession(config, budget);
  }
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const appels = { recherche: 0, decision: 0 };

  const selection = new Map<string, string | null>();
  const pageSize = descripteur.taille_page;
  const maxPages = 40;
  let doublonsRecherche = 0;

  let budgetEpuise = false;
  let rechercheIncomplete = false;
  for (const requete of descripteur.requetes) {
    if (budgetEpuise) {
      rechercheIncomplete = true;
      break;
    }
    for (let page = 0; page < maxPages; page += 1) {
      const params = new URLSearchParams({
        query: `"${requete}"`,
        operator: "and",
        field: descripteur.champs,
        date_start: dateMin,
        date_end: dateExtraction,
        sort: "date",
        order: "desc",
        page: String(page),
        page_size: String(pageSize),
      });

      let reponse: unknown;
      if (options.reponsesRecherche === undefined) {
        if (session === null) throw new Error("Session PISTE absente");
        try {
          reponse = await session.judilibre(fetchImpl, params);
          appels.recherche += 1;
        } catch (error) {
          if (error instanceof PisteBudgetError || (error instanceof Error && /HTTP 429/.test(error.message))) {
            budgetEpuise = true;
            rechercheIncomplete = true;
            break;
          }
          throw error;
        }
      } else {
        reponse = options.reponsesRecherche[requete];
        if (page > 0) break;
      }

      const resultats = lireResultats(reponse);
      if (totalResultats(reponse) > 0 && resultats.length === 0) {
        rechercheIncomplete = true;
        break;
      }
      for (const resultat of resultats) {
        if (selection.has(resultat.id)) {
          doublonsRecherche += 1;
          continue;
        }
        selection.set(resultat.id, resultat.date);
      }
      if (resultats.length < pageSize) break;
      if (page + 1 >= maxPages) rechercheIncomplete = true;
    }
  }

  if (rechercheIncomplete) {
    throw new Error(
      "Recherche Judilibre interrompue ou tronquée (429, budget ou plafond de pages) : " +
        "le corpus existant reste intact. Relancez avec un budget plus large.",
    );
  }

  for (const id of veille) {
    if (!selection.has(id)) selection.set(id, null);
  }
  if (selection.size === 0) {
    throw new Error(
      "Aucune décision sélectionnée : Judilibre n'a rien rendu pour les requêtes du descripteur. " +
        "Le corpus existant reste intact.",
    );
  }

  const enAttente: string[] = [];
  const introuvables = new Set(introuvablesConnus);
  let arret = false;
  for (const id of [...selection.keys()].sort()) {
    if (arret) {
      enAttente.push(id);
      continue;
    }
    if (cache.has(id) || introuvables.has(id)) continue;
    let reponse: unknown;
    if (options.reponsesDecision !== undefined) {
      reponse = options.reponsesDecision[id];
      if (reponse === undefined) {
        enAttente.push(id);
        continue;
      }
    } else {
      if (session === null || session.remainingCalls() <= 0) {
        enAttente.push(id);
        continue;
      }
      try {
        reponse = await session.judilibreDecision(fetchImpl, id);
      } catch (error) {
        if (error instanceof PisteBudgetError) {
          enAttente.push(id);
          continue;
        }
        if (error instanceof Error && /HTTP 404/.test(error.message)) {
          introuvables.add(id);
          continue;
        }
        if (error instanceof Error && /HTTP 429/.test(error.message)) {
          arret = true;
          enAttente.push(id);
          continue;
        }
        throw error;
      }
    }
    const decision = typeof reponse === "object" && reponse !== null
      ? (reponse as DecisionJudilibre)
      : {};
    appels.decision += 1;
    cache.set(id, { ...decision, id: typeof decision.id === "string" ? decision.id : id });
    ecrireSiChange(cheminCache(rootDir, id), `${JSON.stringify(cache.get(id), null, 2)}\n`);
  }

  const ecartes: EcartesCc = { ...ECARTES_CC_VIDES };
  const unites: Unite[] = [];
  let dateMax: string | null = null;
  let dateMinObserve: string | null = null;
  let documentsLus = 0;

  for (const id of [...selection.keys()].sort()) {
    const brute = cache.get(id);
    if (brute === undefined) continue;
    documentsLus += 1;
    const verdict = classerDecisionCc(brute, descripteur, dateMin, veilleIds.has(id));
    if (!verdict.retenue) {
      ecartes[verdict.motif] += 1;
      continue;
    }
    const nouvelles = unitesCc(verdict.decision, descripteur);
    for (const unite of nouvelles) {
      unites.push(unite);
      if (dateMax === null || unite.date_acte > dateMax) dateMax = unite.date_acte;
      if (dateMinObserve === null || unite.date_acte < dateMinObserve) {
        dateMinObserve = unite.date_acte;
      }
    }
  }

  validerUnitesCorpus(unites, "Cour de cassation");
  const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  if (unites.length === 0 && lireNombreLignes(cheminUnites) > 0) {
    throw new Error(
      "Aucune unité produite alors que le corpus existant n'est pas vide : " +
        "le corpus reste intact, vérifiez le cache et les réponses de Judilibre.",
    );
  }
  const documents = new Set(unites.map((unite) => unite.document)).size;
  const veilleRetenues = veille.filter((id) =>
    unites.some((unite) => unite.document === id),
  ).length;
  const manifeste: ManifesteCc = {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    source: "PISTE — Judilibre /search et /decision",
    date_min: dateMin,
    date_extraction: dateManifeste,
    licence: descripteur.licence,
    documents,
    fragments: unites.length,
    documents_lus: documentsLus,
    doublons_recherche: doublonsRecherche,
    exclusions: ecartes,
    couverture: {
      source: "PISTE — Judilibre /search et /decision",
      periode: { date_min: dateMinObserve ?? dateMin, date_max: dateMax },
      borne: dateMin,
      champs: descripteur.champs,
      requetes: descripteur.requetes,
      filtre: {
        mots_cles: descripteur.mots_cles,
        occurrences_min: descripteur.occurrences_min,
        visa_pertinent: true,
      },
      veille: {
        entrees: veille.length,
        ajoutees: veilleAjoutees.length,
        retenues: veilleRetenues,
      },
      exclusions: ecartes,
      introuvables: [...introuvables].sort(),
      reprise: { en_cache: cache.size, en_attente: enAttente.length },
    },
  };

  const unitesPath = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");

  const ecritIntrouvables = ecrireSiChange(
    join(rootDir, DOSSIER_BRUT, "introuvables.json"),
    `${JSON.stringify([...introuvables].sort(), null, 2)}\n`,
  );
  const ecritUnites = ecrireSiChange(
    unitesPath,
    `${unites.map((unite) => JSON.stringify(unite)).join("\n")}${unites.length === 0 ? "" : "\n"}`,
  );
  const ecritManifeste = ecrireSiChange(cheminManifeste, `${JSON.stringify(manifeste, null, 2)}\n`);
  const etat: EtatCc = {
    date_min: dateMin,
    filtre_sha256: filtreSha256,
    lu_le:
      ecritUnites || ecritManifeste
        ? dateExtraction
        : etatExistant?.lu_le ?? dateExtraction,
    cache: cache.size,
    en_attente: enAttente.length,
  };
  const ecritEtat = ecrireSiChange(cheminEtat, `${JSON.stringify(etat, null, 2)}\n`);

  return {
    documents,
    fragments: unites.length,
    documentsLus,
    enAttente: enAttente.length,
    doublons: doublonsRecherche,
    introuvables: [...introuvables],
    ecartes,
    appels,
    ecrit: ecritUnites || ecritManifeste || ecritEtat || ecritIntrouvables,
    manifestPath: cheminManifeste,
    unitesPath,
  };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const dateMin = valeurDe("--date-min", argv);
  const maxAppels = valeurDe("--max-appels", argv);
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const date = valeurDe("--date", argv);

  let resultat: ResultatCc;
  try {
    resultat = await syncCc({
      ...(rootDir === undefined ? {} : { rootDir }),
      ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
      ...(dateMin === undefined ? {} : { dateMin }),
      ...(date === undefined ? {} : { date }),
      ...(maxAppels === undefined ? {} : { maxAppels: Number(maxAppels) }),
      dryRun,
    });
  } finally {
    flushUsage(rootDir ?? RACINE);
  }
  process.stderr.write(
    dryRun
      ? `dry-run : ${resultat.documentsLus} décision(s) en cache, aucun appel, rien n'est écrit\n`
      : `${resultat.documentsLus} décision(s) lue(s), ${resultat.documents} retenue(s), ` +
        `${resultat.fragments} fragments, ${resultat.enAttente} en attente, ` +
        `${resultat.appels.recherche} recherche(s) et ${resultat.appels.decision} décision(s) lues ; ` +
        `écartées ${Object.entries(resultat.ecartes)
          .map(([motif, compte]) => `${motif}=${compte}`)
          .join(", ") || "aucune"}` +
        `${resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé"}\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
