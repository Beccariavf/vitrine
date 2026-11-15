/**
 * Versement au corpus CJUE des arrêts rendus que les affaires suivies par la
 * veille de préparation ont désignés.
 *
 * La synchronisation ordinaire décide seule de ce qu'elle retient : un arrêt
 * entre par le filtre CJUE (matière `PDON`, notions, type) quand il y passe. Un
 * arrêt suivi qui n'y passe pas est ajouté aux CELEX complémentaires du
 * descripteur — par ce module, jamais à la main —, puis la synchronisation est
 * relancée. Un arrêt durablement écarté (XHTML absent, avis d'avocat général) est
 * dit tel quel : le redemander à chaque passe figerait la fraîcheur du corpus.
 * Le descripteur est rétabli si le corpus ne suit pas.
 */

import { readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { documentsEcartes } from "../veille.ts";
import { typeCelex } from "./liste.ts";
import type { DescripteurCjue } from "./liste.ts";
import { lireRefus, syncCjue } from "./sync.ts";
import type { SyncCjueOptions } from "./sync.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Dossier du corpus CJUE sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "cjue");

const CELEX_DECISION = /^6\d{4}[A-Z]{2}\d{4}(?:\(\d+\))?$/;

export type IncorporerArretsOptions = {
  rootDir: string;
  /** CELEX des décisions rendues, désignés par les affaires suivies. */
  celexes: readonly string[];
  descripteurPath?: string;
  /** Date de la passe, pour la synchronisation. */
  date?: string;
  /** Remplaçable en test : la synchronisation réelle lit CELLAR. */
  syncImpl?: (options: SyncCjueOptions) => Promise<unknown>;
};

export type ResultatArretsVeille = {
  ecrit: boolean;
  /** Un message par CELEX, dans l'ordre demandé. */
  messages: string[];
  /** CELEX ajoutés aux complémentaires du descripteur pendant cette passe. */
  complementaires: string[];
};

export type IncorporerArretOptions = Omit<IncorporerArretsOptions, "celexes"> & { celex: string };

export type ResultatArretVeille = {
  ecrit: boolean;
  message: string;
  /** Vrai quand l'arrêt est entré par la liste complémentaire, hors filtre CJUE. */
  complementaire: boolean;
};

/** Écrit un fichier UTF-8 s'il n'a pas déjà exactement ce contenu. */
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

function ecritPar(resultat: unknown): boolean {
  return (
    typeof resultat === "object" &&
    resultat !== null &&
    (resultat as { ecrit?: unknown }).ecrit === true
  );
}

/** Documents présents dans le corpus CJUE, lus dans `unites.jsonl`. */
export function documentsCjue(rootDir: string): Set<string> {
  const documents = new Set<string>();
  try {
    for (const ligne of readFileSync(
      join(rootDir, DOSSIER_CORPUS, "unites.jsonl"),
      "utf8",
    ).split("\n")) {
      if (ligne.trim() === "") continue;
      try {
        const unite = JSON.parse(ligne) as { document?: unknown };
        if (typeof unite.document === "string") documents.add(unite.document);
      } catch {
        // Une ligne illisible ne masque pas les autres documents.
      }
    }
  } catch {
    // Corpus absent : aucun document n'est présent.
  }
  return documents;
}

/**
 * Motif durable déjà consigné pour un CELEX : manifeste de la dernière
 * synchronisation ou marqueur de refus. Un échec de téléchargement n'en est pas
 * un : il est rejoué.
 */
function motifDurable(rootDir: string, celex: string): string | null {
  const duManifeste = documentsEcartes(rootDir, "cjue").get(celex);
  if (duManifeste !== undefined) return duManifeste;
  return lireRefus(rootDir, celex);
}

/**
 * Décisions désignées par les entrées de veille de la préparation, lues dans
 * `data/entries/`. Toutes les décisions suivies sont rendues, pas seulement
 * celle de l'entrée qui a déclenché la passe : deux arrêts rendus le même jour
 * entrent ainsi ensemble.
 */
export function decisionsSuivies(rootDir: string): string[] {
  const decisions = new Set<string>();
  const racine = join(rootDir, "data", "entries");
  const visiter = (dossier: string): void => {
    let entrees;
    try {
      entrees = readdirSync(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entree of entrees) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) {
        visiter(chemin);
        continue;
      }
      if (!entree.name.endsWith(".json")) continue;
      try {
        const valeur: unknown = JSON.parse(readFileSync(chemin, "utf8"));
        for (const element of Array.isArray(valeur) ? valeur : [valeur]) {
          if (typeof element !== "object" || element === null) continue;
          const { source, decision } = element as { source?: unknown; decision?: unknown };
          if (source === "preparation" && typeof decision === "string" && CELEX_DECISION.test(decision)) {
            decisions.add(decision);
          }
        }
      } catch {
        // Une entrée illisible ne bloque pas la collecte.
      }
    }
  };
  visiter(racine);
  return [...decisions].sort();
}

/**
 * Arrêts suivis encore à verser : absents du corpus, sans motif d'écart durable.
 * L'agent CJUE s'en sert à chaque passe où la veille de préparation en désigne
 * un, même hors de la fenêtre de `corpus:sync` : un arrêt n'est jamais perdu
 * parce qu'une entrée de flux a occupé la cible du corpus.
 */
export function arretsAVerser(rootDir: string): string[] {
  const documents = documentsCjue(rootDir);
  return decisionsSuivies(rootDir).filter(
    (celex) => !documents.has(celex) && motifDurable(rootDir, celex) === null,
  );
}

/**
 * Verse au corpus CJUE les arrêts désignés : le filtre CJUE d'abord, les CELEX
 * complémentaires du descripteur ensuite. Rien n'est écrit quand tous sont déjà
 * présents ou durablement écartés.
 */
export async function incorporerArretsVeille(
  options: IncorporerArretsOptions,
): Promise<ResultatArretsVeille> {
  const chemin = options.descripteurPath ?? join(ICI, "descripteur.json");
  const avant = readFileSync(chemin, "utf8");
  const descripteur = JSON.parse(avant) as DescripteurCjue;
  const messages: string[] = [];
  const complementaires: string[] = [];
  const retenus: string[] = [];

  for (const celex of [...new Set(options.celexes)].sort()) {
    const type = typeCelex(celex);
    if (!(type in descripteur.types_retenus)) {
      messages.push(`${celex} : type ${type} non retenu par la CJUE, non ajouté`);
      continue;
    }
    if (documentsCjue(options.rootDir).has(celex)) {
      messages.push(`${celex} déjà au corpus CJUE`);
      continue;
    }
    const motif = motifDurable(options.rootDir, celex);
    if (motif !== null) {
      messages.push(`${celex} : écarté durablement du corpus CJUE (${motif})`);
      continue;
    }
    retenus.push(celex);
  }
  if (retenus.length === 0) return { ecrit: false, messages, complementaires };

  const synchroniser = async (): Promise<boolean> => {
    const resultat = await (options.syncImpl ?? syncCjue)({
      rootDir: options.rootDir,
      descripteurPath: chemin,
      ...(options.date === undefined ? {} : { date: options.date }),
    });
    return ecritPar(resultat);
  };

  let ecrit = await synchroniser();
  const absents: string[] = [];
  for (const celex of retenus) {
    if (documentsCjue(options.rootDir).has(celex)) {
      messages.push(`${celex} entré au corpus CJUE par le filtre`);
      continue;
    }
    const motif = motifDurable(options.rootDir, celex);
    if (motif !== null) {
      messages.push(`${celex} : écarté durablement du corpus CJUE (${motif})`);
      continue;
    }
    absents.push(celex);
  }
  if (absents.length === 0) return { ecrit, messages, complementaires };

  const existants = descripteur.celex_complementaires ?? [];
  const ajouts = absents.filter((celex) => !existants.includes(celex));
  if (ajouts.length > 0) {
    descripteur.celex_complementaires = [...existants, ...ajouts];
    ecrit = ecrireSiChange(chemin, `${JSON.stringify(descripteur, null, 2)}\n`) || ecrit;
    complementaires.push(...ajouts);
  }

  try {
    ecrit = (await synchroniser()) || ecrit;
  } catch (error) {
    // Le corpus n'a pas suivi : le descripteur revient à son état antérieur.
    ecrireSiChange(chemin, avant);
    throw error;
  }
  const restants: string[] = [];
  for (const celex of absents) {
    if (documentsCjue(options.rootDir).has(celex)) {
      messages.push(`${celex} entré au corpus CJUE par les CELEX complémentaires`);
      continue;
    }
    const motif = motifDurable(options.rootDir, celex);
    if (motif !== null) {
      messages.push(`${celex} : écarté durablement du corpus CJUE (${motif})`);
      continue;
    }
    restants.push(celex);
  }
  if (restants.length > 0) {
    ecrireSiChange(chemin, avant);
    throw new Error(
      `${restants.join(", ")} : arrêt(s) suivi(s) absent(s) du corpus CJUE après ` +
        "synchronisation et ajout aux CELEX complémentaires",
    );
  }
  return { ecrit, messages, complementaires };
}

/** Verse un seul arrêt ; raccourci de `incorporerArretsVeille`. */
export async function incorporerArretVeille(
  options: IncorporerArretOptions,
): Promise<ResultatArretVeille> {
  const resultat = await incorporerArretsVeille({ ...options, celexes: [options.celex] });
  const message =
    resultat.messages.find((candidat) => candidat.startsWith(`${options.celex} `)) ??
    resultat.messages[0] ??
    "";
  return {
    ecrit: resultat.ecrit,
    message,
    // Un CELEX déjà complémentaire avant la passe entre aussi par cette liste :
    // le message le dit, le tableau des ajouts ne le porte pas.
    complementaire:
      resultat.complementaires.includes(options.celex) ||
      /CELEX complémentaires/.test(message),
  };
}
