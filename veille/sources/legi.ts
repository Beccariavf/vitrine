/**
 * Détection des nouvelles versions des textes français du périmètre.
 *
 * Une version est identifiée, jamais comparée par son texte : `LEGIARTI…` par
 * article en vigueur, `LEGITEXT…_JJ-MM-AAAA` pour le décret consolidé. La passe
 * lit un appel par texte (loi 78-17 par `legiPart`, décret par une recherche
 * `LODA_DATE` sur son numéro, Code pénal par sa section, CPCE par son numéro)
 * et compare les identifiants à ceux du corpus. Une différence devient une
 * entrée de veille ; aucune différence n'en produit aucune.
 *
 * Le module est hors ligne : aucune requête n'est faite ici, l'appelant fournit
 * une `PisteSession` et la racine du dépôt.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FetchLike } from "../fetch.ts";
import type { PisteSession } from "../piste.ts";
import type { Entry } from "../types.ts";
import { lireLegiPart, objet, texte } from "../../mcp/corpus/lil/parse.ts";
import type { DescripteurLil, LegiPart } from "../../mcp/corpus/lil/parse.ts";
import { lireArticleParNumero, lireSectionDeCode } from "../../mcp/corpus/textes-fr/parse.ts";
import type { DescripteurTextesFr } from "../../mcp/corpus/textes-fr/parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Descripteurs versionnés : la passe en lit les noms, les routes et les URL. */
export const DESCRIPTEUR_LIL = join(ICI, "..", "..", "mcp", "corpus", "lil", "descripteur.json");
export const DESCRIPTEUR_TEXTES_FR = join(ICI, "..", "..", "mcp", "corpus", "textes-fr", "descripteur.json");

/** Identifiant de la source de veille. */
export const SOURCE_ID = "legi";

/** Plafond de la passe : un jeton et un appel par texte. */
export const MAX_CALLS_PASSE = 5;

/** Matière unique des quatre textes : ils mettent en œuvre la protection des données. */
export const THEME = "donnees-personnelles";

/** Comment la version d'un texte se lit chez PISTE. */
type RouteDetection =
  | { type: "legiPart" }
  | { type: "code"; sctCid: string }
  | { type: "article"; num: string }
  | { type: "search"; fond: string; num: string };

/** Un texte suivi : son identité, sa route et ce que le corpus en compare. */
export type TexteSuivi = {
  /** Clé du descripteur, pour les réponses injectées par les tests. */
  cle: string;
  nom: string;
  titre: string;
  /** Identifiant Légifrance du texte, `document` du corpus. */
  document: string;
  url: string;
  /** Modèle d'URL d'article portant `{id}`. */
  urlArticle: string;
  route: RouteDetection;
  /**
   * `articles` compare les `LEGIARTI…` en vigueur article par article ;
   * `version` compare l'identifiant consolidé du texte, seule donnée que rend
   * la recherche `LODA_DATE` du décret.
   */
  comparaison: "articles" | "version";
};

/** Les quatre textes suivis, lus dans les descripteurs qui font foi. */
export function textesSuivis(
  descripteurLil: string = DESCRIPTEUR_LIL,
  descripteurTextes: string = DESCRIPTEUR_TEXTES_FR,
): TexteSuivi[] {
  const lil = JSON.parse(readFileSync(descripteurLil, "utf8")) as DescripteurLil;
  const textes = JSON.parse(readFileSync(descripteurTextes, "utf8")) as DescripteurTextesFr;

  const suivis: TexteSuivi[] = [
    {
      cle: "lil",
      nom: lil.nom,
      titre: lil.titre,
      document: lil.textId,
      url: lil.url,
      urlArticle: lil.url_article,
      route: { type: "legiPart" },
      comparaison: "articles",
    },
  ];

  for (const texteFr of textes.textes) {
    const route: RouteDetection =
      texteFr.detection !== undefined
        ? { type: "search", fond: texteFr.detection.fond, num: texteFr.detection.num }
        : texteFr.route.type === "code"
          ? { type: "code", sctCid: texteFr.route.sctCid }
          : texteFr.route.type === "article"
            ? { type: "article", num: texteFr.route.num }
            : { type: "legiPart" };
    suivis.push({
      cle: texteFr.cle,
      nom: texteFr.nom,
      titre: texteFr.titre,
      document: texteFr.textId,
      url: texteFr.url,
      urlArticle: texteFr.url_article,
      route,
      comparaison: texteFr.detection !== undefined ? "version" : "articles",
    });
  }

  return suivis;
}

/** Corps de la recherche d'un texte par son numéro, fond `LODA_DATE`. */
export function corpsRechercheLoda(fond: string, num: string): unknown {
  return {
    recherche: {
      champs: [
        {
          typeChamp: "NUM",
          criteres: [{ typeRecherche: "EXACTE", valeur: num, operateur: "ET" }],
          operateur: "ET",
        },
      ],
      filtres: [],
      pageNumber: 1,
      pageSize: 100,
      sort: "DATE_DESC",
      typePagination: "DEFAUT",
    },
    fond,
  };
}

/** Un appel PISTE par texte, selon sa route de détection. */
export async function appelerTexte(
  session: PisteSession,
  fetchImpl: FetchLike,
  texteSuivi: TexteSuivi,
  date: string,
): Promise<unknown> {
  const route = texteSuivi.route;
  switch (route.type) {
    case "legiPart":
      return session.consultLegiPart(fetchImpl, texteSuivi.document, date);
    case "code":
      return session.consultCode(fetchImpl, texteSuivi.document, date, route.sctCid);
    case "article":
      return session.consultArticleParNumero(fetchImpl, texteSuivi.document, route.num);
    case "search":
      return session.legifrance(fetchImpl, corpsRechercheLoda(route.fond, route.num));
  }
}

/** Date `AAAA-MM-JJ` portée par un identifiant `LEGITEXT…_JJ-MM-AAAA`. */
export function dateDeVersionIdentifiant(identifiant: string): string | null {
  const trouve = /_(\d{2})-(\d{2})-(\d{4})$/.exec(identifiant);
  if (trouve === null) return null;
  const [, jour, mois, annee] = trouve;
  if (jour === undefined || mois === undefined || annee === undefined) return null;
  const date = new Date(Date.UTC(Number(annee), Number(mois) - 1, Number(jour)));
  if (
    date.getUTCFullYear() !== Number(annee) ||
    date.getUTCMonth() !== Number(mois) - 1 ||
    date.getUTCDate() !== Number(jour)
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** Version lue chez PISTE : identifiant du texte et identifiants d'articles en vigueur. */
export type VersionLue = {
  /** Identifiant de la version consolidée (`LEGITEXT…_JJ-MM-AAAA` ou `LEGIARTI…`). */
  version: string;
  dateDebut: string | null;
  /** Numéro d'article → identifiant de sa version en vigueur. */
  articles: Map<string, string>;
  /** Numéro d'article → date de début de sa version, quand elle est donnée. */
  dates: Map<string, string | null>;
};

function articlesEnVigueur(part: LegiPart): VersionLue {
  const articles = new Map<string, string>();
  const dates = new Map<string, string | null>();
  for (const article of part.articles) {
    if (article.etat.trim().toUpperCase() !== "VIGUEUR") continue;
    const numero = article.num.trim();
    if (numero === "" || article.id === "") continue;
    articles.set(numero, article.id);
    dates.set(numero, article.dateDebut ?? part.dateDebutVersion);
  }
  return { version: part.version, dateDebut: part.dateDebutVersion, articles, dates };
}

/**
 * Lit l'identifiant de version rendu par une recherche `LODA_DATE` : une ligne
 * par version consolidée. PISTE ne garantit pas l'ordre malgré `sort` : la
 * version retenue est celle dont la date d'identifiant est la plus récente sans
 * dépasser la date de la passe.
 */
export function versionDeRecherche(
  reponse: unknown,
  document: string,
  date: string,
): { version: string; dateDebut: string | null } {
  const results = objet(reponse)?.results;
  if (!Array.isArray(results)) {
    throw new Error(`Réponse search ${document} sans results`);
  }
  let retenue: { version: string; dateDebut: string } | null = null;
  for (const valeur of results) {
    const resultat = objet(valeur);
    if (resultat === null) continue;
    const premierTitre = Array.isArray(resultat.titles) ? objet(resultat.titles[0]) : null;
    const identifiant =
      texte(premierTitre?.id) || texte(resultat.id) || texte(resultat.textId);
    if (!identifiant.startsWith(`${document}_`)) continue;
    const dateDebut = dateDeVersionIdentifiant(identifiant);
    if (dateDebut === null || dateDebut > date) continue;
    if (retenue === null || dateDebut > retenue.dateDebut) {
      retenue = { version: identifiant, dateDebut };
    }
  }
  if (retenue === null) {
    throw new Error(`Réponse search sans version consolidée de ${document}`);
  }
  return { version: retenue.version, dateDebut: retenue.dateDebut };
}

/** Lit une réponse selon la route du texte. */
export function lireVersion(texteSuivi: TexteSuivi, reponse: unknown, date: string): VersionLue {
  switch (texteSuivi.route.type) {
    case "legiPart":
      return articlesEnVigueur(lireLegiPart(reponse));
    case "code":
      return articlesEnVigueur(lireSectionDeCode(reponse, texteSuivi.route.sctCid));
    case "article":
      return articlesEnVigueur(lireArticleParNumero(reponse));
    case "search": {
      const lu = versionDeRecherche(reponse, texteSuivi.document, date);
      return { version: lu.version, dateDebut: lu.dateDebut, articles: new Map(), dates: new Map() };
    }
  }
}

/** État du corpus pour un texte : ce que la synchronisation y a laissé. */
export type EtatTexte = {
  version: string;
  articles: Map<string, string>;
};

function lireJson(chemin: string): Record<string, unknown> | null {
  if (!existsSync(chemin)) return null;
  try {
    const valeur: unknown = JSON.parse(readFileSync(chemin, "utf8"));
    return objet(valeur);
  } catch {
    return null;
  }
}

function lireUnites(chemin: string): Array<Record<string, unknown>> | null {
  if (!existsSync(chemin)) return null;
  try {
    const lignes = readFileSync(chemin, "utf8")
      .split("\n")
      .filter((ligne) => ligne.trim() !== "");
    return lignes.map((ligne) => JSON.parse(ligne) as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Versions déclarées par un manifeste : `(document, version)`. */
function versionsManifeste(manifeste: Record<string, unknown>): Array<[string, string]> {
  const versions: Array<[string, string]> = [];
  if (typeof manifeste.text_id === "string" && typeof manifeste.version === "string") {
    versions.push([manifeste.text_id, manifeste.version]);
  }
  if (Array.isArray(manifeste.textes)) {
    for (const valeur of manifeste.textes) {
      const texteManifeste = objet(valeur);
      if (
        texteManifeste !== null &&
        typeof texteManifeste.text_id === "string" &&
        typeof texteManifeste.version === "string"
      ) {
        versions.push([texteManifeste.text_id, texteManifeste.version]);
      }
    }
  }
  return versions;
}

/**
 * Corpus actuel, par document, lu dans `lil` et `textes_fr`. Un corpus absent ou
 * illisible ne figure pas dans la carte : l'appelant ne peut alors pas comparer
 * et le dit, plutôt que de publier chaque article comme nouveau.
 */
export function etatsCorpus(
  rootDir: string,
  corpus: readonly string[] = ["lil", "textes_fr"],
): Map<string, EtatTexte> {
  const etats = new Map<string, EtatTexte>();
  for (const nom of corpus) {
    const dossier = join(rootDir, "data", "corpus", nom);
    const manifeste = lireJson(join(dossier, "manifest.json"));
    const unites = lireUnites(join(dossier, "unites.jsonl"));
    if (manifeste === null || unites === null) continue;

    for (const [document, version] of versionsManifeste(manifeste)) {
      const articles = new Map<string, string>();
      for (const unite of unites) {
        if (unite.document !== document) continue;
        if (typeof unite.numero !== "string" || typeof unite.ref !== "string") continue;
        articles.set(unite.numero, unite.ref);
      }
      etats.set(document, { version, articles });
    }
  }
  return etats;
}

/** Une différence entre la version lue et le corpus. */
export type Changement = {
  texte: TexteSuivi;
  /** `null` pour la version consolidée d'un texte entier. */
  numero: string | null;
  version: string;
  dateDebut: string | null;
  /** Vrai quand l'article était au corpus et n'est plus en vigueur. */
  retrait: boolean;
};

/**
 * Compare une version lue au corpus. Un article absent du corpus est une
 * nouveauté ; un identifiant différent est une nouvelle version ; un article du
 * corpus absent de la lecture est un retrait, daté par la version du texte.
 */
export function detecterChangements(
  texteSuivi: TexteSuivi,
  lu: VersionLue,
  etat: EtatTexte,
): Changement[] {
  if (texteSuivi.comparaison === "version") {
    if (etat.version === lu.version) return [];
    return [
      {
        texte: texteSuivi,
        numero: null,
        version: lu.version,
        dateDebut: lu.dateDebut,
        retrait: false,
      },
    ];
  }

  const changements: Changement[] = [];
  for (const [numero, version] of lu.articles) {
    if (etat.articles.get(numero) === version) continue;
    changements.push({
      texte: texteSuivi,
      numero,
      version,
      dateDebut: lu.dates.get(numero) ?? null,
      retrait: false,
    });
  }
  for (const numero of etat.articles.keys()) {
    if (lu.articles.has(numero)) continue;
    changements.push({
      texte: texteSuivi,
      numero,
      version: lu.version,
      dateDebut: lu.dateDebut,
      retrait: true,
    });
  }
  return changements.sort((gauche, droite) =>
    (gauche.numero ?? "").localeCompare(droite.numero ?? "", "fr", { numeric: true }),
  );
}

/** `2026-11-01` → `01/11/2026`. */
export function dateFr(date: string): string {
  const [annee, mois, jour] = date.split("-");
  return annee === undefined || mois === undefined || jour === undefined
    ? date
    : `${jour}/${mois}/${annee}`;
}

/** Identifiant stable d'une entrée : la version, jamais la date de la passe. */
function identifiant(document: string, numero: string, version: string): string {
  return createHash("sha256")
    .update(`${SOURCE_ID}|${document}|${numero}|${version}`, "utf8")
    .digest("hex")
    .slice(0, 16);
}

/**
 * Entrée de veille d'un changement : titre lisible, URL Légifrance, identifiant
 * de version. `publishedAt` est la date de la passe, c'est-à-dire la détection :
 * une version détectée entre ainsi dans la fenêtre de `corpus:sync` même si sa
 * date d'effet est ancienne. La date d'effet reste dans le titre et `version`.
 */
export function entreeDeChangement(changement: Changement, datePasse: string): Entry {
  const texteSuivi = changement.texte;
  const jour = changement.dateDebut ?? datePasse;
  const numero = changement.numero;
  const titre =
    numero === null
      ? `${texteSuivi.nom} : nouvelle version en vigueur au ${dateFr(jour)}`
      : changement.retrait
        ? `${texteSuivi.nom}, art. ${numero} : article retiré de la version en vigueur au ${dateFr(jour)}`
        : `${texteSuivi.nom}, art. ${numero} : nouvelle version en vigueur au ${dateFr(jour)}`;
  const urlArticle =
    numero === null || !changement.version.startsWith("LEGIARTI")
      ? texteSuivi.url
      : texteSuivi.urlArticle.replace("{id}", changement.version);

  return {
    id: identifiant(texteSuivi.document, numero ?? "", changement.version),
    title: titre,
    officialTitle: texteSuivi.titre,
    url: urlArticle,
    publishedAt: `${datePasse}T12:00:00.000Z`,
    summary: null,
    references: [],
    themes: [THEME],
    source: SOURCE_ID,
    document: texteSuivi.document,
    version: changement.version,
  };
}
