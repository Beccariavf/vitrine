/**
 * Synchronise le corpus CJUE depuis CELLAR.
 *
 * La liste vient d'une requête SPARQL sur la matière « protection des données
 * personnelles » ; chaque décision est ensuite lue en XHTML français et mise
 * en cache sous `data/raw/cjue/`. Une version française absente (404) ou un
 * texte vide est écarté et compté ; une panne d'un document n'emporte pas les
 * autres. Le corpus n'est écrit qu'après validation de toutes ses unités.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type { FetchLike } from "../../../veille/fetch.ts";
import { validerUnitesCorpus } from "../parse.ts";
import type { Unite } from "../parse.ts";
import {
  ECARTES_CJUE_VIDES,
  classerEntree,
  typeCelex,
  fetchAvantBorne,
  fetchListe,
  lireListe,
} from "./liste.ts";
import type { DescripteurCjue, EcartesCjue, EntreeCjue, MotifEcartCjue } from "./liste.ts";
import { dateDecisionCjue, unitesCjue } from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "cjue");
/** Dossier du cache XHTML, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "cjue");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const CELEX = /^6[a-zA-Z0-9()]+$/;

export type EtatCjue = {
  date_min: string;
  liste_sha256: string;
  lu_le: string | null;
  date_extraction: string | null;
  cache: number;
};

export type DocumentEcartCjue = { celex: string; motif: MotifEcartCjue };

export type CouvertureCjue = {
  source: string;
  matiere: { uri: string; libelle: string };
  langue: string;
  types_retenus: Record<string, string>;
  /** `date_min` est la première date observée ; `borne` la borne demandée. */
  periode: { date_min: string; date_max: string | null };
  borne: string;
  /** Décisions des types retenus, de la même matière et antérieures à la borne. */
  avant_borne: number | null;
  exclusions: EcartesCjue;
  veille: { entrees: number; ajoutees: number };
  documents_ecartes: DocumentEcartCjue[];
  limite: number | null;
};

export type ManifesteCjue = {
  corpus: string;
  nom: string;
  titre: string;
  source: string;
  date_min: string;
  date_extraction: string;
  licence: string;
  langue: string;
  documents: number;
  fragments: number;
  documents_lus: number;
  exclusions: EcartesCjue;
  couverture: CouvertureCjue;
};

export type SyncCjueOptions = {
  rootDir?: string;
  descripteurPath?: string;
  dateMin?: string;
  date?: string;
  /** Ne lit que les N premières décisions retenues, pour un essai. */
  limite?: number;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
  /** Réponse SPARQL déjà lue : les tests remplacent le réseau. */
  reponseListe?: unknown;
  /** Nombre de décisions avant la borne ; `null` si la requête a échoué. */
  avantBorne?: number | null;
  /** XHTML par CELEX, quand l'appelant connaît déjà les captures. */
  reponsesXhtml?: Record<string, string>;
};

export type ResultatCjue = {
  documents: number;
  fragments: number;
  documentsLus: number;
  ecartes: EcartesCjue;
  documentsEcartes: DocumentEcartCjue[];
  appels: { liste: number; avantBorne: number; documents: number };
  ecrit: boolean;
  manifestPath: string;
  unitesPath: string;
};

/** Identifiants CELEX des décisions CJUE publiées par la veille. */
export function entreesVeilleCjue(rootDir: string): Array<{ celex: string; date: string }> {
  const racine = join(rootDir, "data", "entries");
  if (!existsSync(racine)) return [];
  const sortie: Array<{ celex: string; date: string }> = [];
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
          const { source, url, publishedAt } = element as {
            source?: unknown;
            url?: unknown;
            publishedAt?: unknown;
          };
          if (source !== "cjue" || typeof url !== "string") continue;
          const celex = /CELEX:([^/?#]+)/.exec(url)?.[1];
          const date = typeof publishedAt === "string" ? publishedAt.slice(0, 10) : "";
          if (celex !== undefined && DATE_ISO.test(date)) sortie.push({ celex, date });
        }
      } catch {
        // Une entrée illisible ne bloque pas la collecte.
      }
    }
  };
  visiter(racine);
  return sortie;
}

/** Lit le descripteur CJUE. */
export function lireDescripteurCjue(chemin: string): DescripteurCjue {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurCjue;
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

function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/** Empreinte de la liste lue : elle décide de l'inutilité d'une seconde passe. */
export function empreinteListe(entrees: readonly EntreeCjue[]): string {
  return createHash("sha256")
    .update(entrees.map((entree) => `${entree.celex}\t${entree.date}`).join("\n"))
    .digest("hex");
}

function cheminCache(rootDir: string, celex: string): string {
  return join(rootDir, DOSSIER_BRUT, `${celex}.xhtml`);
}

/** Lit le cache XHTML d'un CELEX ; `null` s'il est absent. */
export function lireCapture(rootDir: string, celex: string): string | null {
  const chemin = cheminCache(rootDir, celex);
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
}

/** Marqueur d'une version française absente : elle n'est pas redemandée. */
function cheminRefus(rootDir: string, celex: string): string {
  return join(rootDir, DOSSIER_BRUT, `${celex}.absente.json`);
}

/** Motif d'un refus déjà consigné pour ce CELEX, `null` sinon. */
export function lireRefus(rootDir: string, celex: string): "version_francaise_absente" | null {
  try {
    const valeur = JSON.parse(readFileSync(cheminRefus(rootDir, celex), "utf8")) as {
      motif?: unknown;
    };
    return valeur.motif === "version_francaise_absente" ? "version_francaise_absente" : null;
  } catch {
    return null;
  }
}

/** Nombre de captures XHTML déjà en cache. */
export function compterCache(rootDir: string): number {
  const dossier = join(rootDir, DOSSIER_BRUT);
  if (!existsSync(dossier)) return 0;
  return readdirSync(dossier).filter((nom) => nom.endsWith(".xhtml") && CELEX.test(nom.slice(0, -6))).length;
}

/** Télécharge le XHTML français d'un CELEX ; `null` si la version manque. */
export async function telechargerCjue(
  celex: string,
  langue: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ texte: string } | { motif: "version_francaise_absente" | "echec_telechargement" }> {
  const reponse = await fetchImpl(`https://publications.europa.eu/resource/celex/${celex}`, {
    headers: { Accept: "application/xhtml+xml", "Accept-Language": langue },
  }).catch(() => null);
  if (reponse === null) return { motif: "echec_telechargement" };
  if (reponse.status === 404) return { motif: "version_francaise_absente" };
  if (reponse.status === 429) {
    throw new Error("CELLAR : HTTP 429 (quota) — le corpus existant reste intact, relancez plus tard");
  }
  if (!reponse.ok) return { motif: "echec_telechargement" };
  const texte = await reponse.text();
  return texte.trim() === "" ? { motif: "echec_telechargement" } : { texte };
}

/**
 * Synchronise le corpus. Une liste inchangée et un cache complet ne déclenchent
 * aucune lecture de décision ; la liste, elle, est toujours redemandée.
 */
export async function syncCjue(options: SyncCjueOptions = {}): Promise<ResultatCjue> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurCjue(
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
  const limite =
    options.limite === undefined ? null : Math.max(0, Math.trunc(options.limite));

  const cheminEtat = join(rootDir, DOSSIER_CORPUS, "etat.json");
  const etat = lireEtat(cheminEtat);

  let reponseListe = options.reponseListe;
  let appelsListe = 0;
  if (reponseListe === undefined) {
    reponseListe = await fetchListe(descripteur, dateMin, options.fetchImpl ?? fetch);
    appelsListe = 1;
  }
  const entrees = lireListe(reponseListe);
  const sha = empreinteListe(entrees);

  let avantBorne = options.avantBorne;
  let appelsAvantBorne = 0;
  if (avantBorne === undefined) {
    if (options.reponseListe === undefined) {
      avantBorne = await fetchAvantBorne(descripteur, dateMin, options.fetchImpl ?? fetch);
      appelsAvantBorne = 1;
    } else {
      avantBorne = null;
    }
  }

  const ecartes: EcartesCjue = { ...ECARTES_CJUE_VIDES };
  const documentsEcartes: DocumentEcartCjue[] = [];
  const retenues: EntreeCjue[] = [];
  for (const entree of entrees) {
    const verdict = classerEntree(entree, descripteur, dateMin);
    if (!verdict.retenue) {
      ecartes[verdict.motif] += 1;
      if (verdict.motif === "avis_avocat_general" || verdict.motif === "autre_type") {
        documentsEcartes.push({ celex: entree.celex, motif: verdict.motif });
      }
      continue;
    }
    retenues.push(entree);
  }
  const veille = entreesVeilleCjue(rootDir);
  const dejaListes = new Set(retenues.map((entree) => entree.celex));
  let veilleAjoutees = 0;
  for (const entree of veille) {
    if (dejaListes.has(entree.celex)) continue;
    const type = typeCelex(entree.celex);
    const verdict = classerEntree({ celex: entree.celex, date: entree.date, type }, descripteur, dateMin);
    if (!verdict.retenue) {
      ecartes[verdict.motif] += 1;
      if (verdict.motif === "avis_avocat_general" || verdict.motif === "autre_type") {
        documentsEcartes.push({ celex: entree.celex, motif: verdict.motif });
      }
      continue;
    }
    retenues.push({ celex: entree.celex, date: entree.date, type });
    dejaListes.add(entree.celex);
    veilleAjoutees += 1;
  }
  const lues = limite === null ? retenues : retenues.slice(0, limite);

  if (options.dryRun === true) {
    return {
      documents: 0,
      fragments: 0,
      documentsLus: lues.length,
      ecartes,
      documentsEcartes,
      appels: { liste: appelsListe, avantBorne: appelsAvantBorne, documents: 0 },
      ecrit: false,
      manifestPath: join(rootDir, DOSSIER_CORPUS, "manifest.json"),
      unitesPath: join(rootDir, DOSSIER_CORPUS, "unites.jsonl"),
    };
  }

  let appelsDocuments = 0;
  for (const entree of lues) {
    if (lireCapture(rootDir, entree.celex) !== null) continue;
    if (lireRefus(rootDir, entree.celex) !== null) {
      ecartes.version_francaise_absente += 1;
      documentsEcartes.push({ celex: entree.celex, motif: "version_francaise_absente" });
      continue;
    }
    let capture: string;
    if (options.reponsesXhtml !== undefined) {
      const fournie = options.reponsesXhtml[entree.celex];
      if (fournie === undefined) {
        ecartes.echec_telechargement += 1;
        documentsEcartes.push({ celex: entree.celex, motif: "echec_telechargement" });
        continue;
      }
      capture = fournie;
    } else {
      const resultat = await telechargerCjue(entree.celex, descripteur.langue, options.fetchImpl ?? fetch);
      appelsDocuments += 1;
      if ("motif" in resultat) {
        ecartes[resultat.motif] += 1;
        documentsEcartes.push({ celex: entree.celex, motif: resultat.motif });
        if (resultat.motif === "version_francaise_absente") {
          ecrireSiChange(
            cheminRefus(rootDir, entree.celex),
            `${JSON.stringify({ celex: entree.celex, motif: resultat.motif, date: dateExtraction }, null, 2)}\n`,
          );
        }
        continue;
      }
      capture = resultat.texte;
    }
    ecrireSiChange(cheminCache(rootDir, entree.celex), capture);
  }

  const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  if (ecartes.echec_telechargement > 0 && lireNombreLignes(cheminUnites) > 0) {
    throw new Error(
      `${ecartes.echec_telechargement} téléchargement(s) en échec alors que le corpus existe : ` +
        "il reste intact, relancez quand CELLAR répond.",
    );
  }

  const unites: Unite[] = [];
  let dateMax: string | null = null;
  let dateMinObserve: string | null = null;

  for (const entree of lues) {
    const capture = lireCapture(rootDir, entree.celex);
    if (capture === null) {
      // Le téléchargement a échoué plus haut et a déjà été compté.
      continue;
    }
    try {
      // La date de l'en-tête XHTML fait foi ; la liste ne sert que de repli.
      const date = dateDecisionCjue(capture) ?? entree.date;
      if (date < dateMin) {
        ecartes.avant_borne += 1;
        documentsEcartes.push({ celex: entree.celex, motif: "avant_borne" });
        continue;
      }
      const nouvelles = unitesCjue(capture, entree.celex, date, descripteur);
      if (nouvelles.length === 0) {
        ecartes.texte_vide += 1;
        documentsEcartes.push({ celex: entree.celex, motif: "texte_vide" });
        continue;
      }
      for (const unite of nouvelles) {
        unites.push(unite);
        if (dateMax === null || unite.date_acte > dateMax) dateMax = unite.date_acte;
        if (dateMinObserve === null || unite.date_acte < dateMinObserve) {
          dateMinObserve = unite.date_acte;
        }
      }
    } catch {
      ecartes.texte_vide += 1;
      documentsEcartes.push({ celex: entree.celex, motif: "texte_vide" });
    }
  }

  validerUnitesCorpus(unites, "CJUE");
  if (unites.length === 0 && lireNombreLignes(cheminUnites) > 0) {
    throw new Error(
      "Aucune unité produite alors que le corpus existant n'est pas vide : " +
        "le corpus reste intact, vérifiez la liste CELLAR et les captures.",
    );
  }
  const documents = new Set(unites.map((unite) => unite.document)).size;

  const manifeste: ManifesteCjue = {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    source: "CELLAR / EUR-Lex — SPARQL et rendu XHTML français",
    date_min: dateMin,
    date_extraction:
      etat.liste_sha256 === sha && etat.date_extraction !== null
        ? etat.date_extraction
        : dateExtraction,
    licence: descripteur.licence,
    langue: descripteur.langue,
    documents,
    fragments: unites.length,
    documents_lus: limite === null ? entrees.length + veilleAjoutees : lues.length,
    exclusions: ecartes,
    couverture: {
      source: "CELLAR / EUR-Lex — SPARQL et rendu XHTML français",
      matiere: { uri: descripteur.matiere, libelle: descripteur.matiere_libelle },
      langue: descripteur.langue,
      types_retenus: descripteur.types_retenus,
      periode: { date_min: dateMinObserve ?? dateMin, date_max: dateMax },
      borne: dateMin,
      avant_borne: avantBorne,
      exclusions: ecartes,
      veille: { entrees: veille.length, ajoutees: veilleAjoutees },
      documents_ecartes: documentsEcartes,
      limite,
    },
  };

  const unitesPath = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const manifestPath = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  const ecritUnites = ecrireSiChange(
    unitesPath,
    `${unites.map((unite) => JSON.stringify(unite)).join("\n")}${unites.length === 0 ? "" : "\n"}`,
  );
  const ecritManifeste = ecrireSiChange(manifestPath, `${JSON.stringify(manifeste, null, 2)}\n`);
  const etatEcrit: EtatCjue = {
    date_min: dateMin,
    liste_sha256: sha,
    lu_le: ecritUnites || ecritManifeste ? dateExtraction : etat.lu_le ?? dateExtraction,
    date_extraction: manifeste.date_extraction,
    cache: compterCache(rootDir),
  };
  const ecritEtat = ecrireSiChange(cheminEtat, `${JSON.stringify(etatEcrit, null, 2)}\n`);

  return {
    documents,
    fragments: unites.length,
    documentsLus: entrees.length + veilleAjoutees,
    ecartes,
    documentsEcartes,
    appels: { liste: appelsListe, avantBorne: appelsAvantBorne, documents: appelsDocuments },
    ecrit: ecritUnites || ecritManifeste || ecritEtat,
    manifestPath,
    unitesPath,
  };
}

/** Lit l'état de reprise ; un état absent vaut l'état vide. */
function lireEtat(chemin: string): EtatCjue {
  try {
    const valeur = JSON.parse(readFileSync(chemin, "utf8")) as Partial<EtatCjue>;
    return {
      date_min: valeur.date_min ?? "",
      liste_sha256: valeur.liste_sha256 ?? "",
      lu_le: valeur.lu_le ?? null,
      date_extraction: valeur.date_extraction ?? null,
      cache: valeur.cache ?? 0,
    };
  } catch {
    return { date_min: "", liste_sha256: "", lu_le: null, date_extraction: null, cache: 0 };
  }
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const dateMin = valeurDe("--date-min", argv);
  const limite = valeurDe("--limite", argv);
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const date = valeurDe("--date", argv);

  const resultat = await syncCjue({
    ...(rootDir === undefined ? {} : { rootDir }),
    ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
    ...(dateMin === undefined ? {} : { dateMin }),
    ...(date === undefined ? {} : { date }),
    ...(limite === undefined ? {} : { limite: Number(limite) }),
    dryRun,
  });

  process.stderr.write(
    dryRun
      ? `dry-run : ${resultat.documentsLus} décision(s) à lire, rien n'est écrit\n`
      : `${resultat.documentsLus} décision(s) lue(s), ${resultat.documents} retenue(s), ` +
        `${resultat.fragments} fragments, ${resultat.appels.documents} téléchargement(s) ; ` +
        `écartées ${Object.entries(resultat.ecartes)
          .filter(([, compte]) => compte > 0)
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
