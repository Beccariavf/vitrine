/**
 * Synchronise le corpus LIL : la loi n° 78-17, dans sa version consolidée à une
 * date, lue par PISTE (`/consult/legiPart`).
 *
 * Rien n'est écrit avant que la réponse ne soit parsée et validée en entier :
 * une réponse sans sections, un article en vigueur sans texte ou un compte
 * attendu absent laissent le corpus existant intact.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FetchLike } from "../../../veille/fetch.ts";
import { PisteSession, flushUsage, readPisteConfig } from "../../../veille/piste.ts";
import type { PisteConfig } from "../../../veille/piste.ts";
import { lireLegiPart, unitesLil, validerCapture } from "./parse.ts";
import type { DescripteurLil } from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus LIL sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "lil");
/** Dossier du snapshot brut, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "lil");

export type CouvertureLil = {
  source: string;
  date: string;
  sections: number;
  articles_en_vigueur: number;
  articles_abroges_ecartes: number;
};

export type ManifesteLil = {
  corpus: string;
  nom: string;
  text_id: string;
  /** Identifiant de la version consolidée rendue par PISTE. */
  version: string;
  titre: string;
  url: string;
  licence: string;
  date_consultation: string;
  date_debut_version: string | null;
  documents: number;
  unites: number;
  couverture: CouvertureLil;
  /** Nom du snapshot sous `data/raw/lil/`, adressé par son empreinte. */
  snapshot: string;
  snapshot_sha256: string;
};

export type SyncLilOptions = {
  rootDir?: string;
  descripteurPath?: string;
  /** Date de consultation `AAAA-MM-JJ` ; par défaut, le jour courant. */
  date?: string;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
  /** Configuration PISTE ; `null` explicite interdit l'appel réseau. */
  config?: PisteConfig | null;
  /** Réponse legiPart déjà lue : les tests remplacent le réseau. */
  reponse?: unknown;
  /** Comptes attendus, quand l'appelant connaît sa capture réduite. */
  attendus?: { sections: number; articles: number };
};

export type ResultatLil = {
  version: string;
  date: string;
  unites: number;
  sections: number;
  abroges: number;
  /** Vrai si un fichier du corpus ou le snapshot a changé sur le disque. */
  ecrit: boolean;
  snapshotPath: string;
  unitesPath: string;
  manifestPath: string;
};

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Date du jour en UTC, forme `AAAA-MM-JJ`. */
export function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/** Lit le descripteur LIL. */
export function lireDescripteurLil(chemin: string): DescripteurLil {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurLil;
}

/**
 * Lit `.env` quand il existe, puis les trois secrets PISTE ; `null` si l'un
 * manque. Un `.env` absent n'est pas une erreur : les secrets peuvent venir de
 * l'environnement.
 */
export function configPiste(rootDir: string): PisteConfig | null {
  try {
    process.loadEnvFile(join(rootDir, ".env"));
  } catch {
    // Pas de `.env` : les secrets peuvent venir de l'environnement.
  }
  return readPisteConfig();
}

/**
 * Retire le temps d'exécution que la DILA pose sur chaque objet : il change à
 * chaque appel et rendrait le snapshot différent pour la même version. Tout le
 * reste de la réponse est conservé tel quel.
 */
export function sansTempsExecution(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map((element) => sansTempsExecution(element));
  if (typeof valeur !== "object" || valeur === null) return valeur;
  const canonique: Record<string, unknown> = {};
  for (const [cle, contenu] of Object.entries(valeur)) {
    if (cle === "executionTime") continue;
    canonique[cle] = sansTempsExecution(contenu);
  }
  return canonique;
}

/** Écrit un fichier UTF-8 s'il n'a pas déjà exactement ce contenu. */
function ecrireSiChange(chemin: string, contenu: string): boolean {  try {
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

/** Manifeste du corpus : identité, comptes et couverture déclarée. */
export function manifesteLil(
  descripteur: DescripteurLil,
  version: string,
  date: string,
  dateDebutVersion: string | null,
  comptes: CouvertureLil,
  snapshot: string,
  snapshotSha256: string,
): ManifesteLil {
  return {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    text_id: descripteur.textId,
    version,
    titre: descripteur.titre,
    url: descripteur.url,
    licence: descripteur.licence,
    date_consultation: date,
    date_debut_version: dateDebutVersion,
    documents: 1,
    unites: comptes.articles_en_vigueur,
    couverture: comptes,
    snapshot,
    snapshot_sha256: snapshotSha256,
  };
}

/**
 * Récupère la version consolidée à `date`, la parse, la valide, puis écrit le
 * snapshot et le corpus. Une réponse invalide n'écrit rien.
 */
export async function syncLil(options: SyncLilOptions = {}): Promise<ResultatLil> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurLil(
    options.descripteurPath ?? join(ICI, "descripteur.json"),
  );
  const date = options.date ?? dateDuJour();
  if (!DATE_ISO.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`Date de consultation attendue AAAA-MM-JJ ; reçu « ${date} »`);
  }

  let reponse = options.reponse;
  if (reponse === undefined) {
    const config = options.config === undefined ? configPiste(rootDir) : options.config;
    if (config === null) {
      throw new Error(
        "Configuration PISTE absente (PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_KEY_ID) : " +
          "renseignez .env ou l'environnement.",
      );
    }
    const session = new PisteSession(config);
    reponse = await session.consultLegiPart(
      options.fetchImpl ?? (fetch as unknown as FetchLike),
      descripteur.textId,
      date,
    );
  }

  const part = lireLegiPart(reponse);
  const { unites, abroges } = unitesLil(part, descripteur);
  validerCapture(
    part,
    unites,
    options.attendus ?? {
      sections: descripteur.sections_attendues,
      articles: descripteur.articles_attendus,
    },
  );

  const snapshot = JSON.stringify(sansTempsExecution(reponse), null, 2);
  const corpsSnapshot = snapshot.endsWith("\n") ? snapshot : `${snapshot}\n`;
  const snapshotSha256 = createHash("sha256").update(corpsSnapshot, "utf8").digest("hex");
  const snapshotPath = join(rootDir, DOSSIER_BRUT, `legi-part-${date}.json`);
  const comptes: CouvertureLil = {
    source: "PISTE — Légifrance /consult/legiPart",
    date,
    sections: part.sections,
    articles_en_vigueur: unites.length,
    articles_abroges_ecartes: abroges,
  };
  const manifeste = manifesteLil(
    descripteur,
    part.version,
    date,
    part.dateDebutVersion,
    comptes,
    basename(snapshotPath),
    snapshotSha256,
  );
  const unitesPath = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const manifestPath = join(rootDir, DOSSIER_CORPUS, "manifest.json");

  let ecrit = false;
  if (options.dryRun !== true) {
    const ecritSnapshot = ecrireSiChange(snapshotPath, corpsSnapshot);
    const ecritUnites = ecrireSiChange(
      unitesPath,
      `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    );
    const ecritManifeste = ecrireSiChange(
      manifestPath,
      `${JSON.stringify(manifeste, null, 2)}\n`,
    );
    ecrit = ecritSnapshot || ecritUnites || ecritManifeste;
  }

  return {
    version: part.version,
    date,
    unites: unites.length,
    sections: part.sections,
    abroges,
    ecrit,
    snapshotPath,
    unitesPath,
    manifestPath,
  };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const date = valeurDe("--date", argv);
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);

  let resultat: ResultatLil;
  try {
    resultat = await syncLil({
      ...(rootDir === undefined ? {} : { rootDir }),
      ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
      ...(date === undefined ? {} : { date }),
      dryRun,
    });
  } finally {
    flushUsage(rootDir ?? RACINE);
  }
  process.stderr.write(
    `${resultat.version} au ${resultat.date} : ${resultat.unites} articles en vigueur, ` +
      `${resultat.sections} sections, ${resultat.abroges} article(s) abrogé(s) écarté(s)` +
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
