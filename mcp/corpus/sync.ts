/**
 * Rafraîchit le corpus depuis la veille, en une passe idempotente.
 *
 * La commande lit les entrées récentes, fait correspondre celles qui visent un
 * document, lance seulement les synchronisations concernées, réindexe par delta
 * et écrit `data/corpus/sync.json`. Une source en panne n'emporte ni le corpus
 * existant ni les autres sources ; le rapport le dit et la fraîcheur n'avance pas.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Entry } from "../../veille/types.ts";
import { flushUsage } from "../../veille/piste.ts";
import { buildIndex } from "../index/build.ts";
import type { ResultatBuild } from "../index/build.ts";
import { createOllamaEmbedder } from "../embed/embedder.ts";
import type { Embedder } from "../embed/embedder.ts";
import { classementHorsCorpus } from "./hors-corpus.ts";
import { syncIncrements } from "./cnil/sync.ts";
import { syncCe } from "./ce/sync.ts";
import { syncCc } from "./cc/sync.ts";
import { syncCjue } from "./cjue/sync.ts";
import { syncLil } from "./lil/sync.ts";
import type { ResultatLil } from "./lil/sync.ts";
import { syncTextesFr } from "./textes-fr/sync.ts";
import type { ResultatTextesFr } from "./textes-fr/sync.ts";
import { synchroniserActeUe, synchroniserAdequation } from "./actes-ue.ts";
import {
  corpusDeLEntree,
  documentsDeLEntree,
  documentsEcartes,
  indexerDocumentsCorpus,
  indexerSnapshots,
  indexerVersionsCorpus,
  lireEntrees,
} from "./veille.ts";
import type { CorpusVeille } from "./veille.ts";
import {
  ecrireRapport,
  formaterRapport,
  inventaireCorpus,
  lireRapport,
  ORDRE_SOURCES,
} from "./sync-rapport.ts";
import type {
  DocumentRapport,
  IndexRapport,
  RapportSync,
  SourceRapport,
  StatutDocument,
} from "./sync-rapport.ts";
import { commandesLaunchctl, installerPlanificateur } from "./sync-planificateur.ts";

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../..", import.meta.url));

/** Fenêtre par défaut quand aucun rapport n'existe encore. */
export const FENETRE_JOURS = 7;

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type AgentSync = (cible?: CibleAgent) => Promise<{ ecrit: boolean; message: string }>;

/** Entrée de veille qui a déclenché la source, quand elle en porte une. */
export type CibleAgent = { entree: Entry | null };

export type SyncCorpusOptions = {
  rootDir?: string;
  /** Borne basse de la fenêtre, incluse ; par défaut l'`a_jour_au` précédent ou 7 jours. */
  depuis?: string;
  /** Date de la passe, pour les tests. */
  date?: string;
  dryRun?: boolean;
  /** Quatre agents injectables ; absent, les synchronisations réelles sont utilisées. */
  agents?: Partial<Record<CorpusVeille, AgentSync>>;
  embedder?: Embedder;
  construireIndex?: (rootDir: string, embedder: Embedder) => Promise<ResultatBuild>;
};

function raison(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Date du jour en UTC, forme `AAAA-MM-JJ`. */
export function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/** Date `AAAA-MM-JJ` reculée de `jours`, sans dépendre du fuseau local. */
export function joursAvant(date: string, jours: number): string {
  const instant = Date.parse(`${date}T00:00:00Z`);
  return new Date(instant - jours * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** La plus ancienne des deux dates ISO. */
export function plusTot(gauche: string, droite: string): string {
  return gauche < droite ? gauche : droite;
}

function validerDate(date: string, nom: string): void {
  if (!DATE_ISO.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`${nom} attendue AAAA-MM-JJ ; reçu « ${date} »`);
  }
}

/** Les six synchronisations réelles, derrière la même interface que les tests. */
export type AgentsParDefautDeps = {
  /** Remplaçable en test : une passe `cc` sans réseau. */
  syncCc?: (options: { rootDir: string }) => Promise<{
    ecrit: boolean;
    documentsLus: number;
    documents: number;
    enAttente: number;
  }>;
  /** Remplaçable en test : une passe LIL sans réseau. */
  syncLil?: (options: { rootDir: string }) => Promise<ResultatLil>;
  /** Remplaçable en test : une passe des textes français sans réseau. */
  syncTextesFr?: (options: { rootDir: string }) => Promise<ResultatTextesFr>;
  /** Remplaçable en test : journal d'usage en panne. */
  flushUsage?: (rootDir: string) => void;
};

/** Les six synchronisations réelles, derrière la même interface que les tests. */
export function agentsParDefaut(
  rootDir: string,
  deps: AgentsParDefautDeps = {},
): Record<CorpusVeille, AgentSync> {
  const synchroniserCc = deps.syncCc ?? syncCc;
  const synchroniserLil = deps.syncLil ?? syncLil;
  const synchroniserTextesFr = deps.syncTextesFr ?? syncTextesFr;
  const journal = deps.flushUsage ?? flushUsage;
  return {
    cnil: async () => {
      const resultat = await syncIncrements({ rootDir });
      return {
        ecrit: resultat.ecrit,
        message:
          `${resultat.archives.length} archive(s) lue(s), ` +
          `${resultat.documents_retenus} document(s) retenu(s)`,
      };
    },
    ce: async () => {
      const resultat = await syncCe({ rootDir });
      return {
        ecrit: resultat.ecrit,
        message: resultat.ignore
          ? `archive ${resultat.archive} inchangée`
          : `archive ${resultat.archive}, ${resultat.documents} document(s)`,
      };
    },
    cc: async () => {
      let resultat: Awaited<ReturnType<typeof synchroniserCc>>;
      let avertissement = "";
      try {
        resultat = await synchroniserCc({ rootDir });
      } finally {
        try {
          journal(rootDir);
        } catch (error) {
          // Le corpus a déjà été écrit : un journal d'usage en panne ne doit pas
          // faire passer la source en panne, il est seulement signalé.
          avertissement = ` ; journal d'usage non écrit (${raison(error)})`;
        }
      }
      return {
        ecrit: resultat.ecrit,
        message:
          `${resultat.documentsLus} décision(s) lue(s), ${resultat.documents} retenue(s), ` +
          `${resultat.enAttente} en attente${avertissement}`,
      };
    },
    cjue: async () => {
      const resultat = await syncCjue({ rootDir });
      return {
        ecrit: resultat.ecrit,
        message: `${resultat.documentsLus} décision(s) lue(s), ${resultat.documents} retenue(s)`,
      };
    },
    lil: async () => {
      let resultat: Awaited<ReturnType<typeof synchroniserLil>>;
      let avertissement = "";
      try {
        resultat = await synchroniserLil({ rootDir });
      } finally {
        try {
          journal(rootDir);
        } catch (error) {
          avertissement = ` ; journal d'usage non écrit (${raison(error)})`;
        }
      }
      return {
        ecrit: resultat.ecrit,
        message: `${resultat.version} au ${resultat.date}, ${resultat.unites} article(s)${avertissement}`,
      };
    },
    textes_fr: async () => {
      let resultat: Awaited<ReturnType<typeof synchroniserTextesFr>>;
      let avertissement = "";
      try {
        resultat = await synchroniserTextesFr({ rootDir });
      } finally {
        try {
          journal(rootDir);
        } catch (error) {
          avertissement = ` ; journal d'usage non écrit (${raison(error)})`;
        }
      }
      const unites = resultat.lectures.reduce((total, lecture) => total + lecture.unites.length, 0);
      return {
        ecrit: resultat.ecrit,
        message: `${resultat.lectures.length} texte(s), ${unites} article(s)${avertissement}`,
      };
    },
    rgpd: agentActe("rgpd"),
    aiact: agentActe("aiact"),
    eprivacy: agentActe("eprivacy"),
    police: agentActe("police"),
    eudpr: agentActe("eudpr"),
    rgpdproc: agentActe("rgpdproc"),
    ccs: agentActe("ccs"),
    adequation: async (cible) => {
      if (cible?.entree === null || cible?.entree === undefined) {
        throw new Error("entrée eurlex absente : décision d'adéquation inconnue");
      }
      const resultat = await synchroniserAdequation({ rootDir, entree: cible.entree });
      return { ecrit: resultat.ecrit, message: resultat.message };
    },
  };

  function agentActe(corpus: string): AgentSync {
    return async (cible) => {
      const version = cible?.entree?.version;
      const resultat = await synchroniserActeUe({
        rootDir,
        corpus,
        ...(version === undefined ? {} : { version }),
      });
      return { ecrit: resultat.ecrit, message: resultat.message };
    };
  }
}

function classer(
  entrees: Entry[],
  snapshots: Map<string, string[]>,
  documentsCorpus: Map<string, Set<string>>,
  ecartesCjue: Map<string, string>,
  versionsCorpus: Map<string, Set<string>>,
): DocumentRapport[] {
  const documents: DocumentRapport[] = [];
  for (const entree of entrees) {
    const corpus = corpusDeLEntree(entree);
    const ids = documentsDeLEntree(entree, snapshots);

    if (corpus === null) {
      documents.push({
        entree: entree.id,
        source: entree.source,
        document: null,
        corpus: null,
        statut: "non_mappe",
        motif: "source hors corpus",
      });
      continue;
    }
    if (ids.length === 0) {
      documents.push({
        entree: entree.id,
        source: entree.source,
        document: null,
        corpus,
        statut: "non_mappe",
        motif:
          corpus === "cnil"
            ? "aucun identifiant CNILTEXT dans la page snapshotée"
            : "identifiant de document absent",
      });
      continue;
    }

    const presents = documentsCorpus.get(corpus) ?? new Set<string>();
    for (const document of ids) {
      const motif = corpus === "cjue" ? ecartesCjue.get(document) : undefined;
      const present = presents.has(document);
      // Une entrée `legi` ou `eurlex` ne dit pas seulement quel document est
      // visé, mais quelle version : le document présent avec une autre version
      // est périmé.
      const aJour =
        present &&
        ((entree.source !== "legi" && entree.source !== "eurlex") ||
          entree.version === undefined ||
          versionsCorpus.get(document)?.has(entree.version) === true);
      const statut: StatutDocument = !present
        ? motif === undefined
          ? "manquant"
          : "ecarte"
        : aJour
          ? "present"
          : "perime";
      documents.push({
        entree: entree.id,
        source: entree.source,
        document,
        corpus,
        statut,
        ...(motif === undefined ? {} : { motif }),
        ...(statut === "perime" ? { motif: "version du corpus antérieure" } : {}),
        ...(entree.version === undefined ? {} : { version: entree.version }),
      });
    }
  }
  return documents;
}

function compter(documents: DocumentRapport[]): RapportSync["comptes"] {
  const comptes = { presents: 0, manquants: 0, ecartes: 0, non_mappes: 0, perimes: 0 };
  for (const document of documents) {
    switch (document.statut) {
      case "present":
        comptes.presents += 1;
        break;
      case "manquant":
        comptes.manquants += 1;
        break;
      case "ecarte":
        comptes.ecartes += 1;
        break;
      case "non_mappe":
        comptes.non_mappes += 1;
        break;
      case "perime":
        comptes.perimes += 1;
        break;
    }
  }
  return comptes;
}

function sourcesALancer(documents: DocumentRapport[]): Set<CorpusVeille> {
  const aLancer = new Set<CorpusVeille>();
  for (const document of documents) {
    if (document.statut === "manquant" && document.corpus !== null) aLancer.add(document.corpus);
    // Un document périmé est présent mais dans une version antérieure : la
    // source doit être relancée comme pour un document manquant.
    if (document.statut === "perime" && document.corpus !== null) aLancer.add(document.corpus);
    // Une sanction CNIL non mappée peut être portée par un nouvel incrément DILA.
    if (document.statut === "non_mappe" && document.source === "cnil") aLancer.add("cnil");
  }
  return aLancer;
}

function reindexer(
  resultat: ResultatBuild,
): Pick<IndexRapport, "mode" | "ajoutees" | "modifiees" | "supprimees" | "inchangees"> {
  return {
    mode: resultat.mode,
    ajoutees: resultat.delta.ajoutees,
    modifiees: resultat.delta.modifiees,
    supprimees: resultat.delta.supprimees,
    inchangees: resultat.delta.inchangees,
  };
}

/** Vrai si au moins un corpus porte des unités lisibles. */
function corpusPresent(rootDir: string): boolean {
  const racine = join(rootDir, "data", "corpus");
  if (!existsSync(racine)) return false;
  for (const dossier of readdirSync(racine, { withFileTypes: true })) {
    if (!dossier.isDirectory()) continue;
    const chemin = join(racine, dossier.name, "unites.jsonl");
    if (existsSync(chemin) && statSync(chemin).size > 0) return true;
  }
  return false;
}

/**
 * Conserve les documents encore en attente d'une passe antérieure : manquants
 * et périmés. Le rapport ne décrit que la dernière fenêtre ; sans cette fusion,
 * un document en attente disparaîtrait de `etat_corpus` dès que la fenêtre
 * avance, alors qu'il manque toujours. Une ligne redevient courante dès que le
 * document entre au corpus dans la bonne version ou est déclaré écarté.
 */
function fusionnerManquants(
  courants: DocumentRapport[],
  precedent: RapportSync | null,
  documentsCorpus: Map<string, Set<string>>,
  versionsCorpus: Map<string, Set<string>>,
  ecartes: Map<string, string>,
): DocumentRapport[] {
  if (precedent === null) return courants;
  const vus = new Set(
    courants
      .filter((document) => document.document !== null)
      .map((document) => `${document.corpus ?? ""}:${document.document ?? ""}`),
  );
  const resultat = [...courants];
  for (const ancien of precedent.documents ?? []) {
    if (ancien.statut !== "manquant" && ancien.statut !== "perime") continue;
    if (ancien.document === null || ancien.corpus === null) continue;
    const cle = `${ancien.corpus}:${ancien.document}`;
    if (vus.has(cle)) continue;
    if (documentsCorpus.get(ancien.corpus)?.has(ancien.document) === true) {
      // Un document présent clôt un manquant ; une ligne périmée ne se clôt que
      // si la version qu'elle nomme est entrée au corpus.
      if (ancien.statut === "manquant") continue;
      const version = ancien.version;
      if (version !== undefined && versionsCorpus.get(ancien.document)?.has(version) === true) {
        continue;
      }
      resultat.push(ancien);
      continue;
    }
    if (ancien.corpus === "cjue" && ecartes.has(ancien.document)) continue;
    resultat.push(ancien);
  }
  return resultat;
}

/**
 * Une passe de rafraîchissement. Le rapport est rendu et écrit sauf en
 * `dryRun` ; `a_jour_au` n'avance que si aucune source ni l'index n'a échoué.
 */
export async function syncCorpus(options: SyncCorpusOptions = {}): Promise<RapportSync> {
  const rootDir = options.rootDir ?? RACINE;
  const date = options.date ?? dateDuJour();
  validerDate(date, "Date de passe");
  const precedent = lireRapport(rootDir);
  // Une tentative en échec garde sa fenêtre : sinon la borne reculerait et
  // perdrait le jour le plus ancien. Un succès reprend au moins les 7 derniers
  // jours, parce que la veille hebdomadaire peut écrire une entrée ancienne
  // après la passe.
  const echecPrecedent =
    precedent !== null &&
    (precedent.sources.some((source) => source.statut === "panne") ||
      precedent.index.statut === "panne");
  const bornePrecedente =
    precedent === null
      ? date
      : echecPrecedent
        ? precedent.depuis
        : (precedent.a_jour_au ?? date);
  const depuis = options.depuis ?? plusTot(bornePrecedente, joursAvant(date, FENETRE_JOURS));
  validerDate(depuis, "Borne de fenêtre");

  const entrees = lireEntrees(rootDir, depuis);
  const snapshots = indexerSnapshots(rootDir);
  let documentsCorpus = indexerDocumentsCorpus(rootDir);
  let ecartes = documentsEcartes(rootDir, "cjue");
  let versionsCorpus = indexerVersionsCorpus(rootDir);
  let documents = classer(entrees, snapshots, documentsCorpus, ecartes, versionsCorpus);

  const aLancer = sourcesALancer(documents);
  const agents = options.agents ?? agentsParDefaut(rootDir);
  const entreesParId = new Map(entrees.map((entree) => [entree.id, entree]));
  const cibles = new Map<CorpusVeille, Entry>();
  for (const document of documents) {
    if (document.corpus === null) continue;
    if (document.statut === "present" || document.statut === "ecarte") continue;
    const entree = entreesParId.get(document.entree);
    if (entree === undefined) continue;
    const existante = cibles.get(document.corpus);
    // Une entrée qui porte une version dit plus qu'une entrée qui n'en porte
    // pas : c'est elle qui fixe la version à construire.
    if (existante === undefined || (existante.version === undefined && entree.version !== undefined)) {
      cibles.set(document.corpus, entree);
    }
  }
  const sources: SourceRapport[] = [];
  let echec = false;

  for (const source of ORDRE_SOURCES) {
    if (!aLancer.has(source)) {
      sources.push({ source, statut: "ignoree", message: "aucun document manquant" });
      continue;
    }
    if (options.dryRun === true) {
      sources.push({ source, statut: "ignoree", message: "dry-run : serait lancé" });
      continue;
    }
    const agent = agents[source];
    if (agent === undefined) {
      sources.push({ source, statut: "panne", message: "agent absent" });
      echec = true;
      continue;
    }
    try {
      const resultat = await agent({ entree: cibles.get(source) ?? null });
      sources.push({ source, statut: "ok", message: resultat.message });
    } catch (error) {
      sources.push({ source, statut: "panne", message: raison(error) });
      echec = true;
    }
  }

  // Relire le corpus après les écritures : le statut du rapport est celui d'après.
  documentsCorpus = indexerDocumentsCorpus(rootDir);
  ecartes = documentsEcartes(rootDir, "cjue");
  versionsCorpus = indexerVersionsCorpus(rootDir);
  documents = classer(entrees, snapshots, documentsCorpus, ecartes, versionsCorpus);
  documents = fusionnerManquants(documents, precedent, documentsCorpus, versionsCorpus, ecartes);

  let index: IndexRapport;
  if (options.dryRun === true) {
    index = { statut: "ignoree", message: "dry-run : rien n'est écrit" };
  } else if (!corpusPresent(rootDir)) {
    index = { statut: "ignoree", message: "aucun corpus à indexer" };
  } else {
    try {
      const embedder = options.embedder ?? createOllamaEmbedder();
      const construire = options.construireIndex ?? buildIndex;
      const resultat = await construire(rootDir, embedder);
      index = { statut: "ok", ...reindexer(resultat) };
    } catch (error) {
      index = { statut: "panne", message: raison(error) };
      echec = true;
    }
  }

  // Le classement suit la relecture du corpus : une extraction de citations en
  // échec est ignorée par corpus, la passe ne doit pas échouer. Rendu aussi en
  // `dry-run`, il n'est alors simplement pas écrit.
  const horsCorpus = classementHorsCorpus(rootDir, date);

  const rapport: RapportSync = {
    version: 1,
    a_jour_au:
      options.dryRun === true || echec ? (precedent?.a_jour_au ?? null) : date,
    derniere_tentative:
      options.dryRun === true ? (precedent?.derniere_tentative ?? null) : date,
    depuis,
    entrees_lues: entrees.length,
    comptes: compter(documents),
    documents,
    corpus: inventaireCorpus(rootDir),
    sources,
    index,
    hors_corpus: horsCorpus,
  };

  if (options.dryRun !== true) ecrireRapport(rootDir, rapport);
  return rapport;
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const rootDir = valeurDe("--root", argv) ?? RACINE;

  if (argv.includes("--planifier")) {
    const dossier = valeurDe("--dossier", argv);
    const dryRun = argv.includes("--dry-run");
    const chemin = installerPlanificateur({
      rootDir,
      ...(dossier === undefined ? {} : { dossier }),
      ...(dryRun ? { dryRun } : {}),
    });
    const commandes = commandesLaunchctl(chemin);
    process.stdout.write(
      dryRun
        ? `Agent launchd serait écrit : ${chemin}\n`
        : `Agent launchd écrit : ${chemin}\n`,
    );
    process.stdout.write(`Installer : ${commandes.installer}\n`);
    process.stdout.write(`Retirer   : ${commandes.retirer}\n`);
    return;
  }

  const depuis = valeurDe("--depuis", argv);
  const date = valeurDe("--date", argv);
  const rapport = await syncCorpus({
    rootDir,
    ...(depuis === undefined ? {} : { depuis }),
    ...(date === undefined ? {} : { date }),
    dryRun: argv.includes("--dry-run"),
  });

  process.stdout.write(
    argv.includes("--json") ? `${JSON.stringify(rapport, null, 2)}\n` : formaterRapport(rapport),
  );
  if (rapport.sources.some((source) => source.statut === "panne") || rapport.index.statut === "panne") {
    process.exitCode = 1;
  }
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${raison(error)}\n`);
    process.exitCode = 1;
  });
}
