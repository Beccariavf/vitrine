/**
 * Synchronise le corpus `metadonnees` depuis deux sources officielles : la base
 * HUDOC de la CEDH et le registre des décisions définitives du guichet unique du
 * CEPD.
 *
 * Le corpus ne porte aucune décision : chaque unité est une ligne de
 * métadonnées (identifiant, intitulé, autorité, date, lien officiel), marquée
 * `metadonnees_seulement`. Aucune page de décision n'est téléchargée, aucun
 * texte n'est extrait, aucun résumé n'est produit.
 *
 * Requêtes polies : un appel à la fois, attente lue au descripteur, agent
 * générique, cache des pages valable sept jours et reprise par `etat.json`. Le
 * corpus n'est écrit qu'après validation de toutes ses unités.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { setTimeout as attendre } from "node:timers/promises";
import type { FetchLike } from "../../../veille/fetch.ts";
import { validerUnitesCorpus } from "../parse.ts";
import type { Unite } from "../parse.ts";
import {
  classerRegistre,
  validerNotices,
  fusionnerCedh,
  lirePageCedh,
  lireRegistre,
  totalRegistre,
  unitesCedh,
  unitesRegistre,
  urlRequeteCedh,
} from "./liste.ts";
import type {
  DescripteurMetadonnees,
  EcartesCedh,
  EcartesRegistre,
  EntreeCedh,
} from "./liste.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "metadonnees");
/** Dossier du cache des pages, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "metadonnees");

/** Garde-fou : au-delà, la pagination d'une source est tenue pour cassée. */
const PAGES_MAX = 400;

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type EtatMetadonnees = {
  date_extraction: string | null;
  cedh: { pages: number; fiches: number; unites: number };
  registre: { pages: number; lignes: number; unites: number };
};

export type SourceMetadonnees = {
  source: string;
  url: string;
  consulte_le: string;
  /** `abandonnee` : la source a été arrêtée, et le motif est dit. */
  statut: "lue" | "abandonnee";
  motif?: string;
  pages: number;
  /** Éléments lus à la source, avant fusion et exclusions. */
  elements_lus: number;
  retenues: number;
  exclusions: Record<string, number>;
  licence: string;
  licence_url: string;
};

export type ManifesteMetadonnees = {
  corpus: string;
  nom: string;
  titre: string;
  source: string;
  date_extraction: string;
  licence: string;
  /** Vrai pour tout le corpus : aucune unité ne porte le texte d'une décision. */
  metadonnees_seulement: true;
  documents: number;
  unites: number;
  fragments: number;
  couverture: {
    perimetre: {
      cedh: {
        criteres: string;
        mots_cles: string[];
        requete: string;
        cas_connus_retenus: string[];
        branches_ecartees: Record<string, string>;
      };
      registre: { criteres: string };
      /** Source CEDH arrêtée : la passe ne l'interroge plus et le dit. */
      cedh_abandonnee: DescripteurMetadonnees["cedh"]["abandonnee"];
    };
    champs: string;
    sources: SourceMetadonnees[];
    exclusions: { cedh: EcartesCedh; registre: EcartesRegistre };
    /** Limites déclarées de la passe : ce que le corpus ne garantit pas. */
    limites: string[];
  };
};

export type SyncMetadonneesOptions = {
  rootDir?: string;
  descripteurPath?: string;
  date?: string;
  dryRun?: boolean;
  /** Relit les pages sans attendre l'expiration du cache. */
  refresh?: boolean;
  fetchImpl?: FetchLike;
  /**
   * Pages HUDOC déjà lues, par décalage `start` : elles remplacent le réseau et
   * forcent la lecture de la source CEDH, même déclarée abandonnée au descripteur.
   */
  pagesCedh?: Record<number, unknown>;
  /** Pages du registre déjà lues, par numéro de page. */
  pagesRegistre?: Record<number, string>;
  /** Attente nulle entre deux requêtes, pour les tests. */
  sansAttente?: boolean;
};

export type ResultatMetadonnees = {
  documents: number;
  unites: number;
  cedh: { fiches: number; retenues: number; exclusions: EcartesCedh };
  registre: { lignes: number; retenues: number; exclusions: EcartesRegistre };
  appels: number;
  ecrit: boolean;
  manifestPath: string;
  unitesPath: string;
};

/** Lit le descripteur du corpus. */
export function lireDescripteurMetadonnees(chemin: string): DescripteurMetadonnees {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurMetadonnees;
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

/** Vrai si le fichier en cache existe et n'a pas dépassé sa validité. */
function cacheValide(chemin: string, jours: number, instant = Date.now()): boolean {
  try {
    const age = instant - statSync(chemin).mtimeMs;
    return age >= 0 && age <= jours * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

/** Texte d'un fichier de cache, `null` s'il est absent. */
function lireCache(chemin: string): string | null {
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
}

type Contexte = {
  rootDir: string;
  descripteur: DescripteurMetadonnees;
  options: SyncMetadonneesOptions;
  fetchImpl: FetchLike;
  appels: number;
};

/** Attente entre deux requêtes, sauf en test ou sans délai déclaré. */
async function patienter(contexte: Contexte): Promise<void> {
  const delai = contexte.options.sansAttente === true ? 0 : contexte.descripteur.delai_ms;
  if (delai > 0) await attendre(delai);
}

/**
 * Corps d'une requête : la page en cache quand elle est encore valable, sinon
 * la source. Un refus transitoire (`403`, `429`, `5xx`) est réessayé deux fois
 * avec les attentes du descripteur (une, deux puis cinq minutes) ; un refus
 * durable lève en nommant la source et l'URL, et le corpus existant reste
 * alors intact. La source limite le débit par adresse : deux secondes entre
 * deux pages, et le cache de sept jours rend une reprise peu coûteuse.
 */
async function lireAvecCache(
  contexte: Contexte,
  chemin: string,
  url: string,
  source: string,
): Promise<string> {
  const enCache = contexte.options.refresh === true ? null : lireCache(chemin);
  if (enCache !== null && cacheValide(chemin, contexte.descripteur.cache_validite_jours)) {
    return enCache;
  }
  const attentes =
    contexte.options.sansAttente === true
      ? [0, 0, 0]
      : contexte.descripteur.reprises_ms;
  for (let essai = 0; ; essai += 1) {
    // L'attente précède l'appel, jamais la lecture d'une page en cache.
    await patienter(contexte);
    contexte.appels += 1;
    const reponse = await contexte.fetchImpl(url, {
      headers: {
        Accept: "application/json, text/html",
        "User-Agent": contexte.descripteur.user_agent,
        // La source refuse une requête sur deux quand la connexion est réutilisée :
        // chaque page part sur sa propre connexion, comme un navigateur qui ouvre
        // une page de résultats.
        Connection: "close",
      },
    });
    if (reponse.ok) {
      const texte = await reponse.text();
      if (contexte.options.dryRun !== true) ecrireSiChange(chemin, texte);
      return texte;
    }
    const transitoire = reponse.status === 403 || reponse.status === 429 || reponse.status >= 500;
    const attente = attentes[essai];
    if (!transitoire || attente === undefined) {
      throw new Error(`${source} : HTTP ${reponse.status} sur ${url} — le corpus existant reste intact.`);
    }
    await attendre(attente);
  }
}

/** Lit toutes les fiches HUDOC du critère, page après page. */
async function lireCedh(contexte: Contexte): Promise<{ total: number; fiches: EntreeCedh[]; pages: number }> {
  const fiches: EntreeCedh[] = [];
  let total = 0;
  let pages = 0;
  let debut = 0;
  while (pages < PAGES_MAX) {
    const fournie = contexte.options.pagesCedh?.[debut];
    const url = urlRequeteCedh(contexte.descripteur, debut, contexte.descripteur.cedh.taille_page);
    let texte: string;
    if (fournie !== undefined) {
      texte = typeof fournie === "string" ? fournie : JSON.stringify(fournie);
    } else {
      texte = await lireAvecCache(
        contexte,
        join(contexte.rootDir, DOSSIER_BRUT, "hudoc", `page-${debut}.json`),
        url,
        "HUDOC",
      );
    }
    pages += 1;
    let page: ReturnType<typeof lirePageCedh>;
    try {
      page = lirePageCedh(JSON.parse(texte) as unknown);
    } catch (error) {
      const raison = error instanceof Error ? error.message : String(error);
      throw new Error(`HUDOC : réponse illisible (${raison}) — le corpus existant reste intact.`, {
        cause: error,
      });
    }
    if (page.total > 0) total = page.total;
    fiches.push(...page.entrees);
    if (page.entrees.length < contexte.descripteur.cedh.taille_page) break;
    if (total > 0 && fiches.length >= total) break;
    debut += contexte.descripteur.cedh.taille_page;
  }
  return { total, fiches, pages };
}

/** Lit toutes les pages du registre du guichet unique. */
async function lireGuichetUnique(
  contexte: Contexte,
): Promise<{ total: number | null; lignes: ReturnType<typeof lireRegistre>; pages: number }> {
  const lignes: ReturnType<typeof lireRegistre> = [];
  let total: number | null = null;
  let pages = 0;
  while (pages < PAGES_MAX) {
    const fournie = contexte.options.pagesRegistre?.[pages];
    const url = contexte.descripteur.registre.url_modele.replace("{page}", String(pages));
    const html =
      fournie ??
      (await lireAvecCache(
        contexte,
        join(contexte.rootDir, DOSSIER_BRUT, "registre", `page-${pages}.html`),
        url,
        "Registre du guichet unique",
      ));
    pages += 1;
    if (total === null) total = totalRegistre(html);
    const lues = lireRegistre(html, contexte.descripteur);
    if (lues.length === 0) break;
    lignes.push(...lues);
    if (total !== null && lignes.length >= total) break;
  }
  return { total, lignes, pages };
}

/**
 * Synchronise le corpus. `--dry-run` lit les sources et compte, sans écrire ni
 * corpus ni cache ; une source en panne lève avant toute écriture.
 */
export async function syncMetadonnees(
  options: SyncMetadonneesOptions = {},
): Promise<ResultatMetadonnees> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurMetadonnees(
    options.descripteurPath ?? join(ICI, "descripteur.json"),
  );
  const dateExtraction = options.date ?? dateDuJour();
  if (!DATE_ISO.test(dateExtraction) || Number.isNaN(Date.parse(dateExtraction))) {
    throw new Error(`Date d'extraction attendue AAAA-MM-JJ ; reçue « ${dateExtraction} »`);
  }
  const contexte: Contexte = {
    rootDir,
    descripteur,
    options,
    fetchImpl: options.fetchImpl ?? fetch,
    appels: 0,
  };

  // Une source abandonnée n'est pas interrogée : la passe ne tente pas de forcer
  // un endpoint qui refuse le client, et le manifeste dit pourquoi.
  const cedhLue = descripteur.cedh.abandonnee === null || options.pagesCedh !== undefined;
  const cedh = cedhLue
    ? await lireCedh(contexte)
    : { total: 0, fiches: [] as EntreeCedh[], pages: 0 };
  const fusion = fusionnerCedh(cedh.fiches, descripteur);
  const registre = await lireGuichetUnique(contexte);
  const classement = classerRegistre(registre.lignes);

  const sansLienPdf = classement.retenues.filter((entree) => entree.lien === "registre").length;
  const unites: Unite[] = [
    ...unitesCedh(fusion.decisions, descripteur),
    ...unitesRegistre(classement.retenues, descripteur),
  ];
  validerNotices(unites);
  validerUnitesCorpus(unites, "METADONNEES");
  const documents = new Set(unites.map((unite) => unite.document)).size;

  const sources: SourceMetadonnees[] = [
    {
      source: "HUDOC — Cour européenne des droits de l'homme",
      url: descripteur.cedh.endpoint,
      consulte_le: dateExtraction,
      statut: cedhLue ? "lue" : "abandonnee",
      ...(cedhLue || descripteur.cedh.abandonnee === null
        ? {}
        : { motif: descripteur.cedh.abandonnee.motif }),
      pages: cedh.pages,
      elements_lus: cedh.fiches.length,
      retenues: fusion.decisions.length,
      exclusions: { ...fusion.ecartes, total_annonce: cedh.total },
      licence: descripteur.cedh.licence,
      licence_url: descripteur.cedh.licence_url,
    },
    {
      source: "Registre des décisions définitives du guichet unique — CEPD",
      url: descripteur.registre.url_modele.replace("{page}", "0"),
      consulte_le: dateExtraction,
      statut: "lue",
      pages: registre.pages,
      elements_lus: registre.lignes.length,
      retenues: classement.retenues.length,
      exclusions: {
        ...classement.ecartes,
        ...(registre.total === null ? {} : { total_annonce: registre.total }),
      },
      licence: descripteur.registre.licence,
      licence_url: descripteur.registre.licence_url,
    },
  ];

  const manifeste: ManifesteMetadonnees = {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    source: cedhLue
      ? "HUDOC (base de la Cour européenne des droits de l'homme) et registre des décisions " +
        "définitives du guichet unique (CEPD) — métadonnées seulement"
      : "Registre des décisions définitives du guichet unique (CEPD) — métadonnées seulement ; " +
        "source CEDH (HUDOC) arrêtée, motif sous couverture.perimetre.cedh_abandonnee",
    date_extraction: dateExtraction,
    licence: `${descripteur.cedh.licence} ${descripteur.registre.licence}`,
    metadonnees_seulement: true,
    documents,
    unites: unites.length,
    fragments: unites.length,
    couverture: {
      perimetre: {
        cedh: {
          criteres: descripteur.cedh.criteres,
          mots_cles: [...descripteur.cedh.mots_cles],
          requete: descripteur.cedh.requete,
          cas_connus_retenus: [...descripteur.cedh.cas_connus_retenus],
          branches_ecartees: { ...descripteur.cedh.branches_ecartees },
        },
        registre: { criteres: descripteur.registre.criteres },
        cedh_abandonnee: descripteur.cedh.abandonnee,
      },
      champs:
        "Chaque unité porte document (n° de requête CEDH ou identifiant EDPBI), numero, date_acte, " +
        "titre, autorite, url officielle et une ligne `texte` de métadonnées (intitulé, autorité, " +
        "date, et pour le registre les sujets qu'il publie). Aucune unité ne porte le texte d'une " +
        "décision ni un résumé. `search` rend cette ligne : le titre et l'autorité y sont, pas " +
        "comme champs séparés.",
      sources,
      exclusions: { cedh: fusion.ecartes, registre: classement.ecartes },
      limites: [
        "Le registre du guichet unique n'a pas d'ordre stable entre deux requêtes : une ligne peut " +
          "passer d'une page à l'autre pendant la passe. Les lignes exactement répétées sont " +
          "comptées (`exclusions.registre.doublon`) et le total annoncé est porté " +
          "(`exclusions.registre.total_annonce`) : l'écart avec `documents` dit les décisions " +
          "qu'une passe n'a pas vues, reprises à la passe suivante.",
        "Deux décisions distinctes peuvent être servies sous un même identifiant EDPBI : elles " +
          "sont gardées toutes les deux et la seconde porte une référence suffixée (`#2`).",
        ...(sansLienPdf === 0
          ? []
          : [
              `${sansLienPdf} notice(s) n'ont pas de PDF au registre : leur url ouvre le registre ` +
                "filtré sur l'identifiant, faute de lien propre.",
            ]),
      ],
    },
  };

  const unitesPath = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const manifestPath = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  const resultat: ResultatMetadonnees = {
    documents,
    unites: unites.length,
    cedh: {
      fiches: cedh.fiches.length,
      retenues: fusion.decisions.length,
      exclusions: fusion.ecartes,
    },
    registre: {
      lignes: registre.lignes.length,
      retenues: classement.retenues.length,
      exclusions: classement.ecartes,
    },
    appels: contexte.appels,
    ecrit: false,
    manifestPath,
    unitesPath,
  };
  if (options.dryRun === true) return resultat;

  const ecritUnites = ecrireSiChange(
    unitesPath,
    `${unites.map((unite) => JSON.stringify(unite)).join("\n")}${unites.length === 0 ? "" : "\n"}`,
  );
  const ecritManifeste = ecrireSiChange(manifestPath, `${JSON.stringify(manifeste, null, 2)}\n`);
  const etat: EtatMetadonnees = {
    date_extraction: dateExtraction,
    cedh: { pages: cedh.pages, fiches: cedh.fiches.length, unites: fusion.decisions.length },
    registre: {
      pages: registre.pages,
      lignes: registre.lignes.length,
      unites: classement.retenues.length,
    },
  };
  const ecritEtat = ecrireSiChange(
    join(rootDir, DOSSIER_CORPUS, "etat.json"),
    `${JSON.stringify(etat, null, 2)}\n`,
  );
  return { ...resultat, ecrit: ecritUnites || ecritManifeste || ecritEtat };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const refresh = argv.includes("--refresh");
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const date = valeurDe("--date", argv);

  const resultat = await syncMetadonnees({
    ...(rootDir === undefined ? {} : { rootDir }),
    ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
    ...(date === undefined ? {} : { date }),
    dryRun,
    refresh,
  });
  const exclusions = (comptes: Record<string, number>): string =>
    Object.entries(comptes)
      .filter(([, compte]) => compte > 0)
      .map(([motif, compte]) => `${motif}=${compte}`)
      .join(", ") || "aucune";

  process.stderr.write(
    (dryRun ? "dry-run : " : "") +
      `CEDH ${resultat.cedh.retenues} décision(s) sur ${resultat.cedh.fiches} fiche(s) ` +
      `(écartées ${exclusions({ ...resultat.cedh.exclusions })}) ; ` +
      `registre ${resultat.registre.retenues} décision(s) sur ${resultat.registre.lignes} ligne(s) ` +
      `(écartées ${exclusions({ ...resultat.registre.exclusions })}) ; ` +
      `${resultat.documents} document(s), ${resultat.unites} unité(s), ${resultat.appels} appel(s)` +
      (dryRun ? ", rien n'est écrit" : resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé") +
      "\n",
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
