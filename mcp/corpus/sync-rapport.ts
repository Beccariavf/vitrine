/**
 * Rapport de la synchronisation du corpus depuis la veille.
 *
 * Le fichier `data/corpus/sync.json` est la seule mémoire de la passe : il porte
 * la date de fraîcheur (`a_jour_au`), la fenêtre de veille et le sort de chaque
 * document. Le serveur MCP le lit pour répondre « corpus à jour au … ».
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { formaterAutorites } from "./hors-corpus.ts";
import type { ClassementHorsCorpus } from "./hors-corpus.ts";
import type { CorpusVeille } from "./veille.ts";

/**
 * Sources que `npm run corpus:sync` revérifie sur signal, dans leur ordre
 * d'exécution. `cnil`, `ce`, `cc` et `cjue` le sont à chaque passe et portent la
 * fraîcheur ; `cnil_doctrine`, `cepd`, `constit`, `lil`, `textes_fr`, la
 * préparation et les corpus d'actes n'y entrent que sur une entrée de veille.
 */
export const ORDRE_SOURCES: readonly CorpusVeille[] = [
  "cnil",
  "cnil_doctrine",
  "ce",
  "constit",
  "cc",
  "preparation",
  "cjue",
  "cepd",
  "lil",
  "textes_fr",
  "rgpd",
  "aiact",
  "eprivacy",
  "police",
  "eudpr",
  "rgpdproc",
  "ccs",
  "adequation",
  "donnees",
];

/**
 * Corpus dont `a_jour_au` couvre la fraîcheur : chaque passe les revérifie.
 * `lil` et `textes_fr` en sont exclus, leur synchronisation attendant le signal
 * de `npm run veille:textes-fr`.
 */
export const SOURCES_SOUS_VEILLE: readonly CorpusVeille[] = ["cnil", "ce", "cc", "cjue"];

/** Manifestes lisibles sous `data/corpus/`, par nom de corpus ; un manifeste illisible est ignoré. */
export function lireManifestes(rootDir: string): Map<string, Record<string, unknown>> {
  const manifestes = new Map<string, Record<string, unknown>>();
  const racine = join(rootDir, "data", "corpus");
  if (!existsSync(racine)) return manifestes;
  for (const dossier of readdirSync(racine, { withFileTypes: true })) {
    if (!dossier.isDirectory()) continue;
    const chemin = join(racine, dossier.name, "manifest.json");
    if (!existsSync(chemin)) continue;
    try {
      const valeur: unknown = JSON.parse(readFileSync(chemin, "utf8"));
      if (typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)) {
        manifestes.set(dossier.name, valeur as Record<string, unknown>);
      }
    } catch {
      // Un manifeste illisible ne masque pas les autres corpus.
    }
  }
  return manifestes;
}

/** Chemin du rapport, relatif à la racine du dépôt. */
export const CHEMIN_RAPPORT = join("data", "corpus", "sync.json");

export type StatutDocument = "present" | "manquant" | "ecarte" | "non_mappe" | "perime";

export type DocumentRapport = {
  /** Identifiant de l'entrée de veille d'origine. */
  entree: string;
  source: string;
  document: string | null;
  corpus: CorpusVeille | null;
  statut: StatutDocument;
  /** Motif d'un document écarté, non mappé ou périmé. */
  motif?: string;
  /** Version visée par une entrée `legi` ; permet de clore un document périmé. */
  version?: string;
  /** Vrai quand la version visée est soumise à consultation publique (`cepd`). */
  consultation?: boolean;
  /** Corpus de textes visé par un texte adopté (`preparation`). */
  corpus_vise?: string;
};

export type SourceRapport = {
  source: CorpusVeille;
  statut: "ok" | "ignoree" | "panne";
  message?: string;
};

export type IndexRapport = {
  statut: "ok" | "ignoree" | "panne";
  mode?: "complet" | "incremental";
  ajoutees?: number;
  modifiees?: number;
  supprimees?: number;
  inchangees?: number;
  message?: string;
};

export type CorpusRapport = {
  corpus: string;
  documents: number;
  unites: number;
  /** Date de l'arrêté de la collection, quand son manifeste la porte. */
  arrete_le: string | null;
};

export type RapportSync = {
  version: 1;
  /** Dernière passe sans source ni index en panne ; `null` avant la première. */
  a_jour_au: string | null;
  derniere_tentative: string | null;
  /** Borne basse de la fenêtre de veille, incluse. */
  depuis: string;
  entrees_lues: number;
  comptes: { presents: number; manquants: number; ecartes: number; non_mappes: number; perimes: number };
  documents: DocumentRapport[];
  corpus: CorpusRapport[];
  sources: SourceRapport[];
  index: IndexRapport;
  /**
   * Classement des documents cités absents du corpus, recalculé et daté à chaque
   * passe. Absent d'un rapport antérieur : `etat_corpus` rend alors `null`.
   */
  hors_corpus?: ClassementHorsCorpus;
};

/**
 * Lit le rapport ; `null` s'il est absent, illisible ou d'une forme inconnue. Le
 * classement hors corpus est facultatif — un rapport antérieur reste lisible —,
 * mais un bloc présent et mal formé rend `null` : aucune forme inventée.
 */
export function lireRapport(rootDir: string): RapportSync | null {
  const chemin = join(rootDir, CHEMIN_RAPPORT);
  if (!existsSync(chemin)) return null;
  try {
    const valeur = JSON.parse(readFileSync(chemin, "utf8")) as Partial<RapportSync>;
    const estObjet = (element: unknown): boolean =>
      typeof element === "object" && element !== null;
    const aStatut = (element: unknown): boolean =>
      estObjet(element) && typeof (element as { statut?: unknown }).statut === "string";
    const horsCorpus = valeur.hors_corpus;
    const aClassement = (element: unknown): boolean =>
      estObjet(element) &&
      typeof (element as { document?: unknown }).document === "string" &&
      typeof (element as { instrument?: unknown }).instrument === "string" &&
      ((element as { url?: unknown }).url === null ||
        typeof (element as { url?: unknown }).url === "string") &&
      ((element as { statut?: unknown }).statut === "absent" ||
        (element as { statut?: unknown }).statut === "exclu") &&
      typeof (element as { citations?: unknown }).citations === "number" &&
      Array.isArray((element as { autorites?: unknown }).autorites) &&
      ((element as { autorites?: unknown[] }).autorites ?? []).every(
        (autorite) =>
          estObjet(autorite) &&
          typeof (autorite as { autorite?: unknown }).autorite === "string" &&
          typeof (autorite as { citations?: unknown }).citations === "number",
      );
    const horsCorpusLisible =
      horsCorpus === undefined ||
      (estObjet(horsCorpus) &&
        typeof (horsCorpus as { calcule_le?: unknown }).calcule_le === "string" &&
        Array.isArray((horsCorpus as { documents?: unknown }).documents) &&
        ((horsCorpus as { documents?: unknown[] }).documents ?? []).every(aClassement));
    if (
      valeur.version !== 1 ||
      !Array.isArray(valeur.documents) ||
      !valeur.documents.every(aStatut) ||
      !Array.isArray(valeur.corpus) ||
      !Array.isArray(valeur.sources) ||
      !valeur.sources.every(aStatut) ||
      !aStatut(valeur.index) ||
      typeof valeur.depuis !== "string" ||
      !horsCorpusLisible
    ) {
      return null;
    }
    return valeur as RapportSync;
  } catch {
    return null;
  }
}

/** Écrit le rapport s'il change ; rend vrai quand le disque a bougé. */
export function ecrireRapport(rootDir: string, rapport: RapportSync): boolean {
  const chemin = join(rootDir, CHEMIN_RAPPORT);
  const contenu = `${JSON.stringify(rapport, null, 2)}\n`;
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

function nombre(valeur: unknown, defaut: number): number {
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : defaut;
}

/**
 * Inventaire des corpus présents sous `data/corpus/`, trié par nom. La date
 * d'arrêté vient du champ que chaque manifeste porte : `arrete_le` pour la CNIL,
 * `date_extraction` pour les collectes, `couverture.date` pour la LIL et
 * `couverture.date_liste` pour le CEPD.
 */
export function inventaireCorpus(
  rootDir: string,
  manifestes: ReadonlyMap<string, Record<string, unknown>> = lireManifestes(rootDir),
): CorpusRapport[] {
  const corpus: CorpusRapport[] = [];
  for (const [nom, manifeste] of manifestes) {
    const couverture =
      typeof manifeste.couverture === "object" && manifeste.couverture !== null
        ? (manifeste.couverture as Record<string, unknown>)
        : {};
    const date =
      (typeof manifeste.arrete_le === "string" ? manifeste.arrete_le : null) ??
      (typeof manifeste.date_extraction === "string" ? manifeste.date_extraction : null) ??
      (typeof couverture.date === "string" ? couverture.date : null) ??
      (typeof couverture.date_liste === "string" ? couverture.date_liste : null);
    corpus.push({
      corpus: nom,
      documents:
        Array.isArray(manifeste.documents)
          ? manifeste.documents.length
          : typeof manifeste.documents === "number"
            ? manifeste.documents
            : typeof manifeste.document === "string" || nom === "rgpd" || nom === "aiact"
              ? 1
              : 0,
      unites: nombre(manifeste.unites, nombre(manifeste.fragments, 0)),
      arrete_le: date,
    });
  }
  return corpus.sort((gauche, droite) => gauche.corpus.localeCompare(droite.corpus));
}

function ligneManquant(document: DocumentRapport): string {
  const ligne =
    document.document === null
      ? `${document.entree} (${document.source})`
      : `${document.document} (${document.corpus ?? document.source})`;
  const consultation = document.consultation === true ? " [consultation]" : "";
  // Le corpus de textes visé par un texte adopté n'est pas le corpus du document
  // suivi (la proposition quitte `preparation`) : le rapport le nomme à part.
  const vise = document.corpus_vise === undefined ? "" : ` → ${document.corpus_vise}`;
  return `${ligne}${consultation}${vise}`;
}

/** Texte court : fraîcheur, fenêtre, comptes, manquants, hors corpus, sources et index. */
export function formaterRapport(rapport: RapportSync): string {
  const fraicheur =
    rapport.a_jour_au === null
      ? "Corpus jamais synchronisé par corpus:sync"
      : `Corpus à jour au ${rapport.a_jour_au}`;
  const tentative =
    rapport.derniere_tentative === null ? "" : `, dernière tentative ${rapport.derniere_tentative}`;
  const lignes = [
    `${fraicheur} (fenêtre depuis ${rapport.depuis}${tentative})`,
    `${rapport.entrees_lues} entrée(s) de veille ; ${rapport.comptes.presents} document(s) présent(s), ` +
      `${rapport.comptes.manquants} manquant(s), ${rapport.comptes.ecartes} écarté(s), ` +
      `${rapport.comptes.non_mappes} entrée(s) non mappée(s), ${rapport.comptes.perimes ?? 0} périmé(s)`,
  ];

  const manquants = rapport.documents.filter((document) => document.statut === "manquant");
  if (manquants.length > 0) {
    lignes.push(`Manquants : ${manquants.map(ligneManquant).join(", ")}`);
  }
  const perimes = rapport.documents.filter((document) => document.statut === "perime");
  if (perimes.length > 0) {
    lignes.push(
      `Périmés : ${perimes
        .map((document) => `${ligneManquant(document)} — ${document.motif ?? "version du corpus antérieure"}`)
        .join(", ")}`,
    );
  }
  const ecartes = rapport.documents.filter((document) => document.statut === "ecarte");
  if (ecartes.length > 0) {
    lignes.push(
      `Écartés : ${ecartes
        .map((document) => `${ligneManquant(document)} — ${document.motif ?? "motif inconnu"}`)
        .join(", ")}`,
    );
  }
  const nonMappes = rapport.documents.filter((document) => document.statut === "non_mappe");
  if (nonMappes.length > 0) {
    const parMotif = new Map<string, number>();
    for (const document of nonMappes) {
      const motif = document.motif ?? "motif inconnu";
      parMotif.set(motif, (parMotif.get(motif) ?? 0) + 1);
    }
    lignes.push(
      `Non mappées : ${[...parMotif.entries()]
        .map(([motif, compte]) => `${motif} : ${compte}`)
        .join(", ")}`,
    );
  }
  const classement = rapport.hors_corpus;
  if (classement !== undefined && classement.documents.length > 0) {
    lignes.push(
      `Hors corpus : ${classement.documents.length} document(s) au ${classement.calcule_le}`,
    );
    for (const document of classement.documents) {
      lignes.push(
        `${document.instrument} (${document.document}) : ${document.citations} décision(s) citante(s)` +
          formaterAutorites(document.autorites) +
          (document.statut === "exclu" ? " [exclu]" : ""),
      );
    }
  }
  for (const source of rapport.sources) {
    lignes.push(
      `${source.source} : ${source.statut}${source.message === undefined ? "" : ` — ${source.message}`}`,
    );
  }
  lignes.push(
    `index : ${rapport.index.statut}` +
      (rapport.index.mode === undefined ? "" : ` — ${rapport.index.mode}`) +
      (rapport.index.ajoutees === undefined
        ? ""
        : `, ${rapport.index.ajoutees} ajoutée(s), ${rapport.index.modifiees ?? 0} modifiée(s), ` +
          `${rapport.index.supprimees ?? 0} supprimée(s), ${rapport.index.inchangees ?? 0} inchangée(s)`) +
      (rapport.index.message === undefined ? "" : ` — ${rapport.index.message}`),
  );
  return `${lignes.join("\n")}\n`;
}
