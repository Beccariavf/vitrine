/**
 * Passe de veille des textes français du périmètre.
 *
 * Commande séparée (`npm run veille:textes-fr`) : elle ouvre son propre
 * processus, donc son propre compteur d'appels PISTE, et coûte un jeton plus un
 * appel par texte — cinq au plus. Elle ne fait pas partie de `npm run veille`,
 * dont les treize appels n'ont pas de place pour elle.
 *
 * Elle ne publie que des différences d'identifiant de version ; une version
 * inchangée n'écrit aucune entrée. Chaque réponse est conservée telle quelle
 * sous `data/raw/`, adressée par son hash : la version remplacée garde sa
 * preuve, même quand le corpus passe à la suivante.
 */

import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FetchLike } from "./fetch.ts";
import { PisteSession, flushUsage } from "./piste.ts";
import type { PisteConfig } from "./piste.ts";
import {
  MAX_CALLS_PASSE,
  appelerTexte,
  detecterChangements,
  entreeDeChangement,
  etatsCorpus,
  lireVersion,
  textesSuivis,
} from "./sources/legi.ts";
import type { Changement, TexteSuivi } from "./sources/legi.ts";
import type { Entry } from "./types.ts";
import { writeEntries, writeRaw } from "./write.ts";
import { configPiste } from "../mcp/corpus/lil/sync.ts";

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("..", import.meta.url));

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type PasseTextesFrOptions = {
  rootDir?: string;
  /** Date de la passe `AAAA-MM-JJ` ; sert de repli à une version sans date de début. */
  date?: string;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
  /** Configuration PISTE ; `null` explicite interdit l'appel réseau. */
  config?: PisteConfig | null;
  /** Réponses déjà lues, par clé de texte : les tests remplacent le réseau. */
  reponses?: Readonly<Record<string, unknown>>;
};

export type ResultatPasseTextesFr = {
  date: string;
  entrees: Entry[];
  /** Textes qui n'ont pas pu être comparés, avec leur raison. */
  echecs: string[];
  /** Appels PISTE consommés par la passe, jeton compris. */
  appels: number;
  ecrit: boolean;
};

function raison(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/**
 * Lit les quatre textes, compare leurs identifiants au corpus et écrit une
 * entrée par changement. Une panne sur un texte n'empêche pas les autres : elle
 * est nommée dans `echecs` et la commande sort en erreur.
 */
export async function passeTextesFr(
  options: PasseTextesFrOptions = {},
): Promise<ResultatPasseTextesFr> {
  const rootDir = options.rootDir ?? RACINE;
  const date = options.date ?? dateDuJour();
  if (!DATE_ISO.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`Date de passe attendue AAAA-MM-JJ ; reçu « ${date} »`);
  }

  const suivis = textesSuivis();
  const reseau = suivis.some((texteSuivi) => options.reponses?.[texteSuivi.cle] === undefined);
  let session: PisteSession | null = null;
  if (reseau) {
    const config = options.config === undefined ? configPiste(rootDir) : options.config;
    if (config === null) {
      throw new Error(
        "Configuration PISTE absente (PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_KEY_ID) : " +
          "renseignez .env ou l'environnement.",
      );
    }
    session = new PisteSession(config, MAX_CALLS_PASSE);
  }

  const etats = etatsCorpus(rootDir);
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const changements: Changement[] = [];
  const echecs: string[] = [];

  for (const texteSuivi of suivis) {
    try {
      const etat = etats.get(texteSuivi.document);
      if (etat === undefined) {
        throw new Error(
          `corpus ${texteSuivi.document} absent ou illisible sous data/corpus : ` +
            "lancez la synchronisation du texte avant la veille",
        );
      }
      const reponse = options.reponses?.[texteSuivi.cle] ?? (await lireChezPiste(session, fetchImpl, texteSuivi, date));
      if (options.dryRun !== true) {
        writeRaw(rootDir, `${JSON.stringify(reponse, null, 2)}\n`, "json");
      }
      changements.push(...detecterChangements(texteSuivi, lireVersion(texteSuivi, reponse), etat));
    } catch (error) {
      echecs.push(`${texteSuivi.nom} : ${raison(error)}`);
    }
  }

  const entrees = changements.map((changement) => entreeDeChangement(changement, date));
  let ecrit = false;
  if (options.dryRun !== true && entrees.length > 0) {
    writeEntries(rootDir, entrees);
    ecrit = true;
  }

  return {
    date,
    entrees,
    echecs,
    appels: session === null ? 0 : MAX_CALLS_PASSE - session.remainingCalls(),
    ecrit,
  };
}

function lireChezPiste(
  session: PisteSession | null,
  fetchImpl: FetchLike,
  texteSuivi: TexteSuivi,
  date: string,
): Promise<unknown> {
  if (session === null) {
    return Promise.reject(new Error("session PISTE absente"));
  }
  return appelerTexte(session, fetchImpl, texteSuivi, date);
}

function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const date = valeurDe("--date", argv);
  const rootDir = valeurDe("--root", argv);

  let resultat: ResultatPasseTextesFr;
  try {
    resultat = await passeTextesFr({
      ...(rootDir === undefined ? {} : { rootDir }),
      ...(date === undefined ? {} : { date }),
      dryRun,
    });
  } finally {
    flushUsage(rootDir === undefined ? RACINE : resolve(rootDir));
  }

  for (const entree of resultat.entrees) process.stdout.write(`${entree.title}\n`);
  for (const echec of resultat.echecs) process.stderr.write(`échec : ${echec}\n`);
  process.stderr.write(
    `${resultat.entrees.length} nouvelle(s) version(s), ${resultat.appels} appel(s) PISTE` +
      `${dryRun ? " — dry-run, rien n'est écrit" : resultat.ecrit ? " — entrées écrites" : " — aucune entrée"}\n`,
  );
  if (resultat.echecs.length > 0) process.exitCode = 1;
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${raison(error)}\n`);
    process.exitCode = 1;
  });
}
