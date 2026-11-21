/**
 * Synchronise le corpus des textes français d'application : un texte entier, des
 * sections de code et des articles cités par leur numéro, lus par PISTE à une
 * date. Un appel par entrée, plus un par numéro d'une liste, et le jeton : le
 * budget est calculé sur le descripteur.
 *
 * Chaque réponse est d'abord gardée sous `data/raw/textes_fr/<date>/` (non
 * commité) : une relance à la même date relit ce cache sans appel. Le corpus
 * n'est écrit qu'après lecture et validation de tous les textes ; une réponse
 * invalide laisse le corpus existant intact.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FetchLike } from "../../../veille/fetch.ts";
import { PisteSession, flushUsage } from "../../../veille/piste.ts";
import type { PisteConfig } from "../../../veille/piste.ts";
import { configPiste, dateDuJour, ecrireSiChange, sansTempsExecution } from "../lil/sync.ts";
import { budgetPasse, lireTexte, validerLectures } from "./parse.ts";
import type { DescripteurTextesFr, LectureTexte, TexteFr } from "./parse.ts";
import type { VersionRemplacee } from "../versions.ts";
import { historiqueVersions, lireManifeste } from "../versions.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

export const DOSSIER_CORPUS = join("data", "corpus", "textes_fr");
/** Snapshots bruts, non commités, un dossier par date de consultation. */
export const DOSSIER_BRUT = join("data", "raw", "textes_fr");

/** Un texte au manifeste : son identité, sa version et ce que le corpus en couvre. */
export type TexteManifeste = {
  /** Clé du bloc dans le descripteur : le Code pénal et le CPCE en ont plusieurs. */
  cle: string;
  text_id: string;
  nom: string;
  titre: string;
  url: string;
  version: string;
  date_debut_version: string | null;
  perimetre: string;
  /**
   * Numéros en vigueur couverts quand le corpus ne porte qu'une partie du texte ;
   * `null` quand il porte le texte entier. Une citation d'un autre article du
   * même texte reste hors corpus.
   */
  articles_couverts: string[] | null;
  articles_en_vigueur: number;
  articles_abroges_ecartes: number;
  /** Versions remplacées, de la plus ancienne à la plus récente. */
  versions_remplacees: VersionRemplacee[];
  snapshot: string;
  snapshot_sha256: string;
};

export type ManifesteTextesFr = {
  corpus: string;
  nom: string;
  licence: string;
  date_consultation: string;
  documents: number;
  unites: number;
  textes: TexteManifeste[];
  couverture: {
    source: string;
    date: string;
    articles_en_vigueur: number;
    articles_abroges_ecartes: number;
    perimetre: string[];
  };
};

export type SyncTextesFrOptions = {
  rootDir?: string;
  descripteurPath?: string;
  /** Date de consultation `AAAA-MM-JJ` ; par défaut, le jour courant. */
  date?: string;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
  /** Configuration PISTE ; `null` explicite interdit l'appel réseau. */
  config?: PisteConfig | null;
  /** Réponses déjà lues, par `cle` : les tests remplacent le réseau et le cache. */
  reponses?: Readonly<Record<string, unknown>>;
};

export type ResultatTextesFr = {
  date: string;
  lectures: LectureTexte[];
  /** Textes lus sur le réseau dans cette passe ; les autres viennent du cache. */
  appeles: string[];
  ecrit: boolean;
  unitesPath: string;
  manifestPath: string;
};

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function lireDescripteurTextesFr(chemin: string): DescripteurTextesFr {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurTextesFr;
}

/** Snapshot canonique : sans temps d'exécution, indenté, terminé par un saut de ligne. */
function corpsSnapshot(reponse: unknown): string {
  const brut = JSON.stringify(sansTempsExecution(reponse), null, 2);
  return brut.endsWith("\n") ? brut : `${brut}\n`;
}

/** Un appel PISTE, selon la route du texte ; une liste d'articles en coûte un par numéro. */
async function appeler(
  session: PisteSession,
  fetchImpl: FetchLike,
  texteFr: TexteFr,
  date: string,
): Promise<unknown> {
  const route = texteFr.route;
  switch (route.type) {
    case "legiPart":
      return session.consultLegiPart(fetchImpl, texteFr.textId, date);
    case "code":
      return session.consultCode(fetchImpl, texteFr.textId, date, route.sctCid);
    case "article":
      return session.consultArticleParNumero(fetchImpl, texteFr.textId, route.num);
    case "articles": {
      const reponses: unknown[] = [];
      for (const numero of route.nums) {
        reponses.push(await session.consultArticleParNumero(fetchImpl, texteFr.textId, numero));
      }
      return reponses;
    }
  }
}

/** Manifeste du corpus : un bloc par texte, puis la couverture agrégée. */
export function manifesteTextesFr(
  descripteur: DescripteurTextesFr,
  date: string,
  lectures: readonly LectureTexte[],
  snapshots: ReadonlyMap<string, { nom: string; sha256: string }>,
  historiques: ReadonlyMap<string, VersionRemplacee[]> = new Map(),
): ManifesteTextesFr {
  const textes = lectures.map((lecture): TexteManifeste => {
    const snapshot = snapshots.get(lecture.texte.cle);
    return {
      cle: lecture.texte.cle,
      text_id: lecture.texte.textId,
      nom: lecture.texte.nom,
      titre: lecture.texte.titre,
      url: lecture.texte.url,
      version: lecture.version,
      date_debut_version: lecture.dateDebutVersion,
      perimetre: lecture.texte.perimetre,
      articles_couverts:
        lecture.texte.route.type === "legiPart" ? null : lecture.unites.map((unite) => unite.numero),
      articles_en_vigueur: lecture.unites.length,
      articles_abroges_ecartes: lecture.abroges,
      versions_remplacees: historiques.get(lecture.texte.cle) ?? [],
      snapshot: snapshot?.nom ?? "",
      snapshot_sha256: snapshot?.sha256 ?? "",
    };
  });
  const unites = textes.reduce((total, texteFr) => total + texteFr.articles_en_vigueur, 0);
  return {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    licence: descripteur.licence,
    date_consultation: date,
    // Un document par texte : le Code pénal et le CPCE ont plusieurs blocs.
    documents: new Set(textes.map((texteFr) => texteFr.text_id)).size,
    unites,
    textes,
    couverture: {
      source:
        "PISTE — Légifrance /consult/legiPart (texte entier), /consult/code (section de code), " +
        "/consult/getArticleWithIdAndNum (article ou liste de numéros)",
      date,
      articles_en_vigueur: unites,
      articles_abroges_ecartes: textes.reduce((total, texteFr) => total + texteFr.articles_abroges_ecartes, 0),
      perimetre: textes.map((texteFr) => `${texteFr.nom} : ${texteFr.perimetre}`),
    },
  };
}

/**
 * Lit chaque texte depuis le cache du jour ou PISTE, les valide tous, puis
 * écrit le corpus. Une réponse lue est gardée en cache avant toute validation :
 * la relance ne repaie pas l'appel.
 */
export async function syncTextesFr(options: SyncTextesFrOptions = {}): Promise<ResultatTextesFr> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurTextesFr(options.descripteurPath ?? join(ICI, "descripteur.json"));
  const date = options.date ?? dateDuJour();
  if (!DATE_ISO.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`Date de consultation attendue AAAA-MM-JJ ; reçu « ${date} »`);
  }

  const dossierBrut = join(rootDir, DOSSIER_BRUT, date);
  const appeles: string[] = [];
  const snapshots = new Map<string, { nom: string; sha256: string }>();
  const lectures: LectureTexte[] = [];
  let session: PisteSession | null = null;

  for (const texteFr of descripteur.textes) {
    const chemin = join(dossierBrut, `${texteFr.cle}.json`);
    let corps: string;
    const fournie = options.reponses?.[texteFr.cle];
    if (fournie !== undefined) {
      corps = corpsSnapshot(fournie);
    } else if (existsSync(chemin)) {
      corps = readFileSync(chemin, "utf8");
    } else {
      if (session === null) {
        const config = options.config === undefined ? configPiste(rootDir) : options.config;
        if (config === null) {
          throw new Error(
            "Configuration PISTE absente (PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_KEY_ID) : " +
              "renseignez .env ou l'environnement.",
          );
        }
        session = new PisteSession(config, budgetPasse(descripteur.textes));
      }
      const reponse = await appeler(session, options.fetchImpl ?? (fetch as unknown as FetchLike), texteFr, date);
      appeles.push(texteFr.cle);
      corps = corpsSnapshot(reponse);
      if (options.dryRun !== true) ecrireSiChange(chemin, corps);
    }
    snapshots.set(texteFr.cle, {
      nom: `${date}/${texteFr.cle}.json`,
      sha256: createHash("sha256").update(corps, "utf8").digest("hex"),
    });
    lectures.push(lireTexte(texteFr, JSON.parse(corps) as unknown, descripteur.corpus, date));
  }

  validerLectures(lectures);
  const unitesPath = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const manifestPath = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  // L'historique des versions remplacées se lit dans le manifeste précédent :
  // une version qui cède la place garde son identifiant et ses dates. Le suivi est
  // par clé de bloc, le Code pénal et le CPCE ayant plusieurs blocs.
  const precedent = lireManifeste(manifestPath);
  const historiques = new Map<string, VersionRemplacee[]>();
  if (precedent !== null && Array.isArray(precedent.textes)) {
    for (const valeur of precedent.textes) {
      if (typeof valeur !== "object" || valeur === null) continue;
      const texteManifeste = valeur as Record<string, unknown>;
      const cle = texteManifeste.cle;
      if (typeof cle !== "string") continue;
      const lecture = lectures.find((element) => element.texte.cle === cle);
      if (lecture === undefined) continue;
      historiques.set(
        cle,
        historiqueVersions(texteManifeste, {
          version: lecture.version,
          dateDebutVersion: lecture.dateDebutVersion,
        }),
      );
    }
  }
  const manifeste = manifesteTextesFr(descripteur, date, lectures, snapshots, historiques);

  let ecrit = false;
  if (options.dryRun !== true) {
    const lignes = lectures.flatMap((lecture) => lecture.unites).map((unite) => JSON.stringify(unite));
    const ecritUnites = ecrireSiChange(unitesPath, `${lignes.join("\n")}\n`);
    const ecritManifeste = ecrireSiChange(manifestPath, `${JSON.stringify(manifeste, null, 2)}\n`);
    ecrit = ecritUnites || ecritManifeste;
  }
  return { date, lectures, appeles, ecrit, unitesPath, manifestPath };
}

function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const date = valeurDe("--date", argv);
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);

  let resultat: ResultatTextesFr;
  try {
    resultat = await syncTextesFr({
      ...(rootDir === undefined ? {} : { rootDir }),
      ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
      ...(date === undefined ? {} : { date }),
      dryRun,
    });
  } finally {
    flushUsage(rootDir ?? RACINE);
  }
  for (const lecture of resultat.lectures) {
    process.stderr.write(
      `${lecture.texte.nom} (${lecture.version}) : ${lecture.unites.length} article(s) en vigueur, ` +
        `${lecture.abroges} abrogé(s) écarté(s)\n`,
    );
  }
  process.stderr.write(
    `${resultat.appeles.length} texte(s) lu(s) sur PISTE, ` +
      `${resultat.lectures.length - resultat.appeles.length} depuis le cache du ${resultat.date}` +
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
