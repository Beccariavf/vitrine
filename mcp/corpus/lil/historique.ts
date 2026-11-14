/**
 * Historique des versions d'articles de la LIL, lu par `get_article(date)`.
 *
 * La collecte interroge PISTE une fois par date de version repérée dans la
 * réponse courante, puis range chaque version d'article dans
 * `data/corpus/lil/versions.jsonl` — hors de `unites.jsonl` et de l'index. Le
 * manifeste ne reçoit qu'un bloc `historique` (borne, dates lues, compte) ; les
 * autres champs restent intacts. Aucun réseau à la lecture du MCP.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FetchLike } from "../../../veille/fetch.ts";
import { PisteBudgetError, PisteSession, flushUsage } from "../../../veille/piste.ts";
import type { PisteConfig } from "../../../veille/piste.ts";
import { normaliserNumero } from "../articles.ts";
import { texteVisible } from "../parse.ts";
import { lireManifeste } from "../versions.ts";
import {
  DOSSIER_CORPUS,
  RACINE,
  configPiste,
  dateDuJour,
  ecrireSiChange,
  lireDescripteurLil,
} from "./sync.ts";
import { lireLegiPart } from "./parse.ts";
import type { LegiPart } from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Budget d'appels de `npm run lil:historique`, jeton et appel courant compris. */
export const HISTORIQUE_BUDGET = 120;

/** Borne de repli quand la collecte complète dépasse le budget. */
export const HISTORIQUE_DEPUIS_LIMITE = "2018-06-01";

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

function estDate(valeur: unknown): valeur is string {
  return typeof valeur === "string" && DATE_ISO.test(valeur) && !Number.isNaN(Date.parse(valeur));
}

/** Une version d'article rangée dans `versions.jsonl`. */
export type VersionArticle = {
  /** Numéro DILA, par exemple « 8 », « 15 bis ». */
  numero: string;
  /** Identifiant de la version d'article, `LEGIARTI…`. */
  identifiant: string;
  /** Date de début `AAAA-MM-JJ`. */
  date_debut: string;
  /** Date de fin `AAAA-MM-JJ`, `null` si la version est ouverte. */
  date_fin: string | null;
  /** Texte visible, jamais une reformulation. */
  texte: string;
  /** URL Légifrance de l'article. */
  url: string;
};

/** Bloc `historique` du manifeste LIL. */
export type BlocHistorique = {
  /** Plus ancienne date couverte par la collecte. */
  depuis: string;
  /** Dates déjà interrogées, triées. */
  dates_lues: string[];
  /** Nombre de versions rangées. */
  versions: number;
  /** Date de la collecte. */
  consulte_le: string;
};

export type OptionsHistorique = {
  rootDir?: string;
  descripteurPath?: string;
  /** Date de la réponse courante, graine de la collecte ; par défaut, aujourd'hui. */
  dateCourante?: string;
  budget?: number;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
  /** Configuration PISTE ; `null` explicite interdit l'appel réseau. */
  config?: PisteConfig | null;
  /** Réponse legiPart courante déjà lue : les tests remplacent le réseau. */
  reponseCourante?: unknown;
};

export type ResultatHistorique = {
  versions: number;
  datesLues: string[];
  /** Appels HTTP consommés, jeton compris. */
  appels: number;
  depuis: string;
  budgetEpuise: boolean;
  /** Vrai si `versions.jsonl` ou le manifeste a changé sur le disque. */
  ecrit: boolean;
  versionsPath: string;
  manifestPath: string;
};

function cheminVersions(rootDir: string): string {
  return join(rootDir, DOSSIER_CORPUS, "versions.jsonl");
}

function cheminManifeste(rootDir: string): string {
  return join(rootDir, DOSSIER_CORPUS, "manifest.json");
}

/** Compare deux chaînes sans dépendre de la locale, pour un tri stable. */
function comparer(gauche: string, droite: string): number {
  return gauche < droite ? -1 : gauche > droite ? 1 : 0;
}

/** Lit une version de ligne, ou `null` si elle est mal formée. */
function lireVersion(valeur: unknown): VersionArticle | null {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return null;
  const version = valeur as Partial<VersionArticle>;
  if (typeof version.numero !== "string" || version.numero.trim() === "") return null;
  if (typeof version.identifiant !== "string" || version.identifiant.trim() === "") return null;
  if (!estDate(version.date_debut)) return null;
  if (version.date_fin !== null && !estDate(version.date_fin)) return null;
  if (typeof version.texte !== "string" || version.texte.trim() === "") return null;
  if (typeof version.url !== "string") return null;
  return {
    numero: version.numero,
    identifiant: version.identifiant,
    date_debut: version.date_debut,
    date_fin: version.date_fin ?? null,
    texte: version.texte,
    url: version.url,
  };
}

/** Lit `versions.jsonl` ; fichier absent rend `[]`, ligne mal formée est écartée. */
export function lireVersionsHistorique(rootDir: string): VersionArticle[] {
  const chemin = cheminVersions(rootDir);
  if (!existsSync(chemin)) return [];
  const versions: VersionArticle[] = [];
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    if (ligne.trim() === "") continue;
    try {
      const version = lireVersion(JSON.parse(ligne) as unknown);
      if (version !== null) versions.push(version);
    } catch {
      // Une ligne illisible ne fait pas perdre les autres.
    }
  }
  return versions;
}

/**
 * Lit le bloc `historique` du manifeste. Absent ou mal formé rend `null` : la
 * lecture par date dit alors que l'historique n'est pas collecté.
 */
export function lireBlocHistorique(rootDir: string): BlocHistorique | null {
  const manifeste = lireManifeste(cheminManifeste(rootDir));
  const valeur = manifeste?.historique;
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return null;
  const bloc = valeur as Partial<BlocHistorique>;
  if (!estDate(bloc.depuis)) return null;
  if (!Array.isArray(bloc.dates_lues)) return null;
  const dates = bloc.dates_lues.filter(estDate);
  if (dates.length !== bloc.dates_lues.length) return null;
  if (typeof bloc.versions !== "number" || !Number.isInteger(bloc.versions) || bloc.versions < 0) {
    return null;
  }
  if (!estDate(bloc.consulte_le)) return null;
  return {
    depuis: bloc.depuis,
    dates_lues: [...dates].sort(comparer),
    versions: bloc.versions,
    consulte_le: bloc.consulte_le,
  };
}

/**
 * Version applicable à `date` : `date_debut <= date` et (`date_fin === null` ou
 * `date < date_fin`), la plus récente `date_debut` si plusieurs. La même
 * normalisation de numéro que `get_article`.
 */
export function versionApplicable(
  versions: readonly VersionArticle[],
  numero: string | number,
  date: string,
): VersionArticle | null {
  const cherche = normaliserNumero(numero);
  if (cherche === null) return null;
  let retenue: VersionArticle | null = null;
  for (const version of versions) {
    if (normaliserNumero(version.numero) !== cherche) continue;
    if (!(version.date_debut <= date)) continue;
    if (version.date_fin !== null && !(date < version.date_fin)) continue;
    if (
      retenue === null ||
      version.date_debut > retenue.date_debut ||
      (version.date_debut === retenue.date_debut && version.identifiant > retenue.identifiant)
    ) {
      retenue = version;
    }
  }
  return retenue;
}

/** Dates distinctes d'une réponse : débuts, fins non nulles et début de version. */
function datesDeLaReponse(part: LegiPart): Set<string> {
  const dates = new Set<string>();
  for (const article of part.articles) {
    if (article.dateDebut !== null) dates.add(article.dateDebut);
    if (article.dateFin !== null) dates.add(article.dateFin);
  }
  if (part.dateDebutVersion !== null) dates.add(part.dateDebutVersion);
  return dates;
}

/**
 * Range les articles d'une réponse dans la carte par identifiant. Un article
 * sans contenu visible est ignoré : aucun texte n'est inventé. Une version déjà
 * connue n'est pas remplacée.
 */
function collecterReponse(
  part: LegiPart,
  descripteur: { url_article: string },
  versions: Map<string, VersionArticle>,
): void {
  for (const article of part.articles) {
    if (versions.has(article.id)) continue;
    if (article.content.trim() === "") continue;
    const texte = texteVisible(article.content);
    if (texte === "") continue;
    const numero = article.num.trim();
    if (numero === "") continue;
    const date_debut = article.dateDebut ?? part.dateDebutVersion;
    if (date_debut === null) continue;
    versions.set(article.id, {
      numero,
      identifiant: article.id,
      date_debut,
      date_fin: article.dateFin,
      texte,
      url: descripteur.url_article.replace("{id}", article.id),
    });
  }
}

function trierDates(dates: Iterable<string>): string[] {
  return [...new Set(dates)].sort(comparer);
}

/**
 * Collecte l'historique des versions d'articles de la LIL.
 *
 * Une réponse `legiPart` courante sert de graine : ses dates de début et de fin
 * donnent les dates à interroger. Un appel par date restante, dédupliqué par
 * `LEGIARTI…` avec `versions.jsonl`. Budget explicite, reprise par
 * `historique.dates_lues`, et écriture du seul contenu qui a changé.
 */
export async function collecterHistorique(
  options: OptionsHistorique = {},
): Promise<ResultatHistorique> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurLil(
    options.descripteurPath ?? join(ICI, "descripteur.json"),
  );
  const dateCourante = options.dateCourante ?? dateDuJour();
  if (!estDate(dateCourante)) {
    throw new Error(`Date courante attendue AAAA-MM-JJ ; reçu « ${dateCourante} »`);
  }
  const budget = options.budget ?? HISTORIQUE_BUDGET;
  if (!Number.isInteger(budget) || budget <= 0) {
    throw new Error(`Budget attendu entier positif ; reçu « ${budget} »`);
  }

  const versionsPath = cheminVersions(rootDir);
  const manifestPath = cheminManifeste(rootDir);
  const precedent = lireManifeste(manifestPath);
  const blocPrecedent = lireBlocHistorique(rootDir);
  const versions = new Map<string, VersionArticle>();
  for (const version of lireVersionsHistorique(rootDir)) {
    versions.set(version.identifiant, version);
  }

  const config = options.config === undefined ? configPiste(rootDir) : options.config;
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  let appels = 0;
  const compter: FetchLike = async (url, init) => {
    appels += 1;
    return fetchImpl(url, init);
  };
  const session = config === null ? null : new PisteSession(config, budget);
  const sessionRequise = (): PisteSession => {
    if (session === null) {
      throw new Error(
        "Configuration PISTE absente (PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_KEY_ID) : " +
          "renseignez .env ou l'environnement.",
      );
    }
    return session;
  };

  let budgetEpuise = false;
  let courante: LegiPart | null = null;
  if (options.reponseCourante !== undefined) {
    courante = lireLegiPart(options.reponseCourante);
    collecterReponse(courante, descripteur, versions);
  } else {
    try {
      courante = lireLegiPart(
        await sessionRequise().consultLegiPart(compter, descripteur.textId, dateCourante),
      );
      collecterReponse(courante, descripteur, versions);
    } catch (error) {
      if (!(error instanceof PisteBudgetError)) throw error;
      budgetEpuise = true;
    }
  }

  const dejaLues = new Set(blocPrecedent?.dates_lues ?? []);
  const seed = courante === null ? new Set<string>() : datesDeLaReponse(courante);
  const datesLues = new Set(dejaLues);
  if (courante !== null) datesLues.add(dateCourante);

  let restantes = [...seed]
    .filter((date) => !dejaLues.has(date) && date !== dateCourante)
    .sort(comparer);

  // Budget de la commande, jeton et appel courant compris : sans réponse
  // fournie, la graine coûte un jeton puis un appel daté.
  const coutGraine =
    options.reponseCourante === undefined ? 2 : restantes.length > 0 ? 1 : 0;
  let depuis: string;
  if (coutGraine + restantes.length > budget) {
    depuis = HISTORIQUE_DEPUIS_LIMITE;
    restantes = restantes.filter((date) => date >= depuis);
  } else {
    const toutes = [
      ...datesLues,
      ...restantes,
    ];
    const plusAncienne = toutes.sort(comparer)[0] ?? dateCourante;
    depuis =
      blocPrecedent !== null && blocPrecedent.depuis < plusAncienne
        ? blocPrecedent.depuis
        : plusAncienne;
  }

  if (restantes.length > 0 && session === null) {
    throw new Error(
      "Configuration PISTE absente (PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_KEY_ID) : " +
        "renseignez .env ou l'environnement.",
    );
  }

  for (const date of restantes) {
    try {
      const part = lireLegiPart(
        await sessionRequise().consultLegiPart(compter, descripteur.textId, date),
      );
      datesLues.add(date);
      collecterReponse(part, descripteur, versions);
    } catch (error) {
      if (error instanceof PisteBudgetError) {
        budgetEpuise = true;
        break;
      }
      throw error;
    }
  }

  const rangees = [...versions.values()].sort(
    (gauche, droite) =>
      comparer(gauche.numero, droite.numero) ||
      comparer(gauche.date_debut, droite.date_debut) ||
      comparer(gauche.identifiant, droite.identifiant),
  );
  const dates = trierDates(datesLues);
  const bloc: BlocHistorique = {
    depuis,
    versions: rangees.length,
    dates_lues: dates,
    consulte_le: dateCourante,
  };

  let ecrit = false;
  if (options.dryRun !== true) {
    const corpsVersions =
      rangees.length === 0 ? "" : `${rangees.map((version) => JSON.stringify(version)).join("\n")}\n`;
    const manifeste = { ...(precedent ?? {}), historique: bloc };
    const ecritVersions = ecrireSiChange(versionsPath, corpsVersions);
    const ecritManifeste = ecrireSiChange(
      manifestPath,
      `${JSON.stringify(manifeste, null, 2)}\n`,
    );
    ecrit = ecritVersions || ecritManifeste;
  }

  return {
    versions: rangees.length,
    datesLues: dates,
    appels,
    depuis,
    budgetEpuise,
    ecrit,
    versionsPath,
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
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const dateCourante = valeurDe("--date-courante", argv);
  const budgetBrut = valeurDe("--budget", argv);
  const budget = budgetBrut === undefined ? undefined : Number(budgetBrut);

  let resultat: ResultatHistorique;
  try {
    resultat = await collecterHistorique({
      ...(rootDir === undefined ? {} : { rootDir }),
      ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
      ...(dateCourante === undefined ? {} : { dateCourante }),
      ...(budget === undefined ? {} : { budget }),
      dryRun,
    });
  } finally {
    flushUsage(rootDir ?? RACINE);
  }
  process.stderr.write(
    `${resultat.versions} version(s) d'article, ${resultat.datesLues.length} date(s) lue(s), ` +
      `${resultat.appels} appel(s) consommé(s), depuis ${resultat.depuis}` +
      `${resultat.budgetEpuise ? " — budget épuisé, reprise à la prochaine passe" : ""}` +
      `${dryRun ? " — dry-run, rien n'est écrit" : resultat.ecrit ? " — historique réécrit" : " — historique inchangé"}\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
