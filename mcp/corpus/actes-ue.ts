/**
 * Raccord entre la veille des actes de l'Union et le corpus.
 *
 * Une entrée `eurlex` de consolidation met à jour le descripteur de l'acte
 * (`version`, `date_consolidation`) puis relance `corpus:build` sur ce seul
 * corpus. Une nouvelle décision d'adéquation entre dans la liste du corpus
 * `adequation`, avec son pays, sa date, son URL et son statut, puis
 * `adequation:build` est relancé ; une décision qu'elle abroge passe en
 * `ABROGE` avec son motif.
 *
 * Le descripteur est rétabli si la construction échoue : il ne reste jamais en
 * avant d'un corpus qui n'a pas suivi.
 *
 * Le compte d'articles n'est ajusté qu'à la hausse : un acte modificatif peut
 * insérer des articles, jamais en retirer. Un rendu consolidé qui en sert moins
 * que le descripteur est tenu pour tronqué, refusé sans toucher au descripteur,
 * et l'entrée reste `perime` pour la passe suivante.
 */

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Entry } from "../../veille/types.ts";
import type { FetchLike } from "../../veille/fetch.ts";
import { buildCorpusSet } from "./build.ts";
import type { BuildResult } from "./build.ts";
import { fetchCellar } from "./fetch.ts";
import { compterArticlesConsolide } from "./parse.ts";
import { buildAdequation, fetchDecision } from "./adequation/build.ts";
import type { ResultatAdequation } from "./adequation/build.ts";
import {
  compterArticlesDecision,
  paysDeTitre,
  titreDeCapture,
} from "./adequation/parse.ts";
import type { DecisionAdequation, DescripteurAdequation, SourceDecision } from "./adequation/parse.ts";
import type { Descripteur } from "./parse.ts";
import { dateDeConsolidation } from "./versions.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Chemin du descripteur d'un acte suivi. */
export function cheminDescripteur(corpus: string, dossier: string = ICI): string {
  return join(dossier, `${corpus}.json`);
}

/** Chemin du descripteur-liste des décisions d'adéquation. */
export const CHEMIN_ADEQUATION = join(ICI, "adequation", "descripteur.json");

function ecrireSiChange(chemin: string, contenu: string): boolean {
  try {
    if (readFileSync(chemin, "utf8") === contenu) return false;
  } catch {
    // Absent : on l'écrit plus bas.
  }
  const temporaire = `${chemin}.tmp`;
  writeFileSync(temporaire, contenu, "utf8");
  renameSync(temporaire, chemin);
  return true;
}

function raison(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type ResultatActeUe = {
  ecrit: boolean;
  message: string;
};

export type SynchroniserActeOptions = {
  rootDir: string;
  corpus: string;
  /** Consolidation à rendre ; absente, aucune version n'est appliquée. */
  version?: string;
  descripteurPath?: string;
  /** Remplaçable en test : le compte d'articles lit le rendu consolidé. */
  fetchImpl?: FetchLike;
  /** Remplaçable en test : la construction réelle appelle CELLAR. */
  construire?: (options: { rootDir: string; document: string }) => Promise<BuildResult[]>;
};

/**
 * Applique une consolidation au descripteur de l'acte puis reconstruit son
 * corpus. Rejouer la même version reconstruit sans réécrire le descripteur.
 */
export async function synchroniserActeUe(options: SynchroniserActeOptions): Promise<ResultatActeUe> {
  const chemin = options.descripteurPath ?? cheminDescripteur(options.corpus);
  const avant = readFileSync(chemin, "utf8");
  const descripteur = JSON.parse(avant) as Descripteur;

  if (options.version === undefined) {
    return { ecrit: false, message: "aucune version consolidée à appliquer" };
  }
  const date = dateDeConsolidation(options.version);
  if (date === null) {
    throw new Error(`Version consolidée illisible : ${options.version}`);
  }

  const contenu = await fetchCellar(options.version, descripteur.langue, options.fetchImpl);
  const articles = compterArticlesConsolide(contenu, options.version);
  const attendus = descripteur.articles_attendus;
  if (articles < attendus) {
    throw new Error(
      `Rendu ${options.version} : ${articles} articles au lieu de ${attendus} au descripteur, ` +
        "compte non ajusté (rendu tronqué) : consolidation refusée",
    );
  }

  let ecrit = false;
  const compteAjuste = articles > attendus ? articles : attendus;
  if (
    descripteur.version !== options.version ||
    descripteur.date_consolidation !== date ||
    descripteur.articles_attendus !== compteAjuste
  ) {
    const suivant: Descripteur = {
      ...descripteur,
      version: options.version,
      date_consolidation: date,
      articles_attendus: compteAjuste,
    };
    ecrit = ecrireSiChange(chemin, `${JSON.stringify(suivant, null, 2)}\n`);
  }

  const construire = options.construire ?? buildCorpusSet;
  try {
    const resultats = await construire({ rootDir: options.rootDir, document: descripteur.corpus });
    const unites = resultats.reduce((total, resultat) => total + resultat.unites.length, 0);
    return {
      ecrit,
      message: `${options.version} consolidée, ${unites} unité(s)`,
    };
  } catch (error) {
    // Le corpus n'a pas suivi : le descripteur revient à son état antérieur.
    ecrireSiChange(chemin, avant);
    throw new Error(
      `construction ${descripteur.corpus} impossible pour ${options.version} (${raison(error)})`,
      { cause: error },
    );
  }
}

/** Clé stable d'une décision ajoutée : son CELEX, en minuscules. */
export function cleDecision(celex: string): string {
  return celex.toLowerCase();
}

export type SynchroniserAdequationOptions = {
  rootDir: string;
  entree: Pick<Entry, "document" | "title" | "officialTitle" | "url" | "publishedAt" | "abroge"> & {
    /** Date de l'acte, quand la veille la porte ; sinon la date de détection. */
    date_acte?: string;
  };
  descripteurPath?: string;
  fetchImpl?: FetchLike;
  /** Remplaçable en test : la construction réelle relit toutes les décisions. */
  construire?: (options: { rootDir: string; descripteurPath: string }) => Promise<ResultatAdequation>;
};

/**
 * Ajoute une décision d'adéquation au descripteur-liste, abroge celle qu'elle
 * remplace, puis reconstruit `data/corpus/adequation/`. Le descripteur est
 * rétabli si la construction échoue.
 */
export async function synchroniserAdequation(
  options: SynchroniserAdequationOptions,
): Promise<ResultatActeUe> {
  const celex = options.entree.document;
  if (celex === undefined || celex === "") {
    throw new Error("décision d'adéquation sans CELEX");
  }
  const date = options.entree.date_acte ?? options.entree.publishedAt?.slice(0, 10);
  if (date === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`décision ${celex} sans date d'acte exploitable`);
  }

  const chemin = options.descripteurPath ?? CHEMIN_ADEQUATION;
  const avant = readFileSync(chemin, "utf8");
  const descripteur = JSON.parse(avant) as DescripteurAdequation;
  if (descripteur.decisions.some((decision) => decision.celex === celex)) {
    return { ecrit: false, message: `${celex} déjà déclarée` };
  }

  const capture = await fetchDecision(celex, options.fetchImpl);
  const source: SourceDecision = {
    document: celex,
    corpus: descripteur.corpus,
    nom: "Décision d'adéquation",
    url: options.entree.url,
    date_acte: date,
    date_debut: date,
    date_fin: null,
    statut: "en_vigueur",
    articles_attendus: 0,
    considerants_attendus: 0,
  };
  const articles = compterArticlesDecision(capture.contenu, source);
  if (articles < 1) {
    throw new Error(`décision ${celex} : capture sans article, descripteur inchangé`);
  }

  const titreCapture = titreDeCapture(capture.contenu);
  const titreOfficiel = options.entree.officialTitle.trim();
  const titre = titreCapture ?? (titreOfficiel === "" ? options.entree.title : titreOfficiel);
  const decision: DecisionAdequation = {
    cle: cleDecision(celex),
    pays: paysDeTitre(titre) ?? "Pays non déterminé",
    titre,
    celex,
    url: options.entree.url,
    date_acte: date,
    date_fin: null,
    statut: "en_vigueur",
    articles,
  };

  const decisions = [...descripteur.decisions, decision];
  const abrogee: string[] = [];
  if (options.entree.abroge !== undefined && options.entree.abroge !== "") {
    const ancienne = decisions.find(
      (candidate) => candidate.celex === options.entree.abroge && candidate.celex !== celex,
    );
    if (ancienne !== undefined) {
      ancienne.statut = "ABROGE";
      ancienne.date_fin = date;
      ancienne.motif = `abrogée par la décision ${celex} du ${date}`;
      abrogee.push(ancienne.celex);
    }
  }

  const suivant: DescripteurAdequation = { ...descripteur, decisions };
  ecrireSiChange(chemin, `${JSON.stringify(suivant, null, 2)}\n`);

  const construire = options.construire ?? buildAdequation;
  try {
    const resultat = await construire({ rootDir: options.rootDir, descripteurPath: chemin });
    return {
      ecrit: true,
      message:
        `${celex} ajoutée (${articles} article(s))` +
        (abrogee.length === 0 ? "" : `, ${abrogee.join(", ")} abrogée`) +
        `, ${resultat.decisions} décision(s)`,
    };
  } catch (error) {
    ecrireSiChange(chemin, avant);
    throw new Error(`construction adequation impossible après ${celex} (${raison(error)})`, {
      cause: error,
    });
  }
}
