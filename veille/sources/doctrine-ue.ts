/**
 * Veille de la doctrine de la Commission : lignes directrices, codes de bonne
 * pratique, modèles et questions-réponses sur l'IA et les données.
 *
 * Aucun flux de documents n'existe : les seuls fils de la Commission
 * (`digital-strategy.ec.europa.eu/en/rss.xml` et ses équivalents) ne portent que
 * des actualités, et `/en/library/rss.xml` répond par une page HTML. La source
 * relit donc les quatre `liste_reference` du descripteur — pages de politique et
 * d'actualité qui listent leurs documents — et compare ce qu'elle y trouve au
 * manifeste du corpus. Les PDF ne sont jamais téléchargés : seule l'URL dit
 * qu'un document existe.
 *
 * Bornes anti-bruit : un lien n'est un document que si son intitulé porte un
 * motif (`guidelines`, `code of practice`, `template`, `faq`, `questions and
 * answers`, `guidance`…) et si son chemin est un chemin de document
 * (`/en/library/`, `/en/faqs/`, `/en/policies/`, `/en/consultations/`). Un
 * document servi uniquement sous une page de politique — le code de marquage et
 * l'helpdesk Data Act du corpus — reste donc suivi ; une page d'actualité ou
 * d'agenda intitulée « Guidelines … » ne produit rien.
 *
 * Une publication nouvelle est un document absent du descripteur et du
 * manifeste ; une publication modifiée porte l'intitulé d'un document connu mais
 * une autre URL. Un document dont la page ne publie qu'un fichier déjà connu
 * (`source` du descripteur, redirection newsroom ou rendu CELLAR) est un alias
 * de la même pièce : la veille l'ignore, de même qu'une page de politique de
 * présentation qui renvoie une page de document connue sans publier de nouveau
 * fichier. Une Q&R ou une FAQ reste un document même sans fichier. Aucun
 * résumé : l'intitulé seul est repris.
 *
 * Refus sans contournement : une page de référence qui répond 403 ou sert un
 * défi fait échouer la source ; `etat_corpus` ne date alors pas la lecture, et la
 * passe suivante la rejoue.
 *
 * Limite déclarée : la veille ne lit ni les PDF ni le contenu des pages de
 * document. Une réédition servie sous la même URL n'est vue qu'à
 * `corpus:sync:doctrine-ue`, qui hache le fichier. Un document qu'aucune page de
 * référence ne liste encore reste invisible : son ajout au descripteur est
 * manuel.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chargerTexte } from "../../mcp/corpus/cnil-doctrine/liste.ts";
import type { FetchHtml, OptionsHttp } from "../../mcp/corpus/cnil-doctrine/liste.ts";
import type { DescripteurDoctrineUe } from "../../mcp/corpus/doctrine-ue/liste.ts";
import {
  cheminPolitique,
  extraireDocumentsListes,
  liensPage,
  liensTelechargement,
  lireDescripteur,
} from "../../mcp/corpus/doctrine-ue/liste.ts";
import type { LienListe } from "../../mcp/corpus/doctrine-ue/liste.ts";
import { texteDepuisHtml, verifierPage } from "../../mcp/corpus/doctrine-ue/parse.ts";
import type { Entry } from "../types.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "doctrine_ue";

/** Matières de la doctrine de la Commission : IA et données non personnelles. */
export const THEMES = ["ia", "donnees-non-personnelles"] as const;

/** Descripteur du corpus, partagé avec `corpus:sync:doctrine-ue`. */
export const DESCRIPTEUR = fileURLToPath(
  new URL("../../mcp/corpus/doctrine-ue/descripteur.json", import.meta.url),
);

/** Manifeste du corpus : il dit quels documents y sont déjà. */
export const MANIFESTE = join("data", "corpus", "doctrine_ue", "manifest.json");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Manifeste lu ; ses blocs absents ou mal formés ne lèvent pas. */
export type ManifesteDoctrineUeLu = {
  documents_par_type?: Record<string, unknown>;
  documents_ecartes?: unknown;
};

export type PasseDoctrineUeOptions = {
  /** Racine du dépôt : `data/` y est lu. */
  rootDir?: string;
  /** Pages de référence et de document, simulées en test. */
  fetchHtml?: FetchHtml;
  /** Attente injectable : les tests la remplacent par une fonction vide. */
  attendre?: (ms: number) => Promise<void>;
  /** Date de la passe : `publishedAt` des entrées. */
  maintenant?: Date;
  descripteur?: DescripteurDoctrineUe;
  /** Manifeste du corpus ; par défaut `data/corpus/doctrine_ue/manifest.json`. */
  manifestePath?: string;
};

export type ResultatPasseDoctrineUe = {
  /** Rien à conserver : la veille ne lit que des pages de référence, relues à chaque passe. */
  raw: string[];
  entries: Entry[];
  warnings: string[];
  notes: string[];
};

/** Lit le manifeste du corpus ; `null` s'il est absent, une erreur de lecture s'il est illisible. */
export function lireManifeste(chemin: string): ManifesteDoctrineUeLu | null {
  if (!existsSync(chemin)) return null;
  let texte: string;
  try {
    texte = readFileSync(chemin, "utf8");
  } catch (error) {
    throw new Error(
      `Manifeste illisible ${chemin} : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let valeur: unknown;
  try {
    valeur = JSON.parse(texte);
  } catch (error) {
    throw new Error(
      `Manifeste illisible ${chemin} : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) {
    throw new Error(`Manifeste illisible ${chemin} : objet attendu`);
  }
  const manifeste = valeur as ManifesteDoctrineUeLu;
  return {
    ...(typeof manifeste.documents_par_type === "object" &&
    manifeste.documents_par_type !== null
      ? { documents_par_type: manifeste.documents_par_type }
      : {}),
    ...(Array.isArray(manifeste.documents_ecartes)
      ? { documents_ecartes: manifeste.documents_ecartes }
      : {}),
  };
}

/**
 * Forme comparable d'un intitulé : casse, diacritiques, apostrophes et
 * ponctuation ne distinguent pas deux versions d'un même document.
 */
export function cleTitre(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Forme comparable d'une URL : l'hôte perd son `www`, le fragment et la requête
 * sont ignorés, la barre finale aussi (une page et sa variante `/fr/` sont la
 * même).
 */
export function urlComparable(url: string): string {
  try {
    const adresse = new URL(url);
    const hote = adresse.hostname.toLowerCase().replace(/^www\./, "");
    return `${adresse.protocol}//${hote}${adresse.pathname}`.replace(/\/+$/, "");
  } catch {
    return url.replace(/\/+$/, "");
  }
}

/** Identifiant d'une entrée : stable, adressé par l'URL comparable du document. */
export function identifiant(url: string): string {
  return createHash("sha256")
    .update(`${SOURCE_ID}|${url}`, "utf8")
    .digest("hex")
    .slice(0, 16);
}

/** URLs de documents portées par un manifeste, à plat. */
function urlsDuManifeste(manifeste: ManifesteDoctrineUeLu | null): string[] {
  const urls: string[] = [];
  const ajouter = (valeur: unknown): void => {
    if (typeof valeur !== "object" || valeur === null) return;
    const url = (valeur as { url?: unknown }).url;
    if (typeof url === "string" && url !== "") urls.push(url);
  };
  for (const liste of Object.values(manifeste?.documents_par_type ?? {})) {
    if (!Array.isArray(liste)) continue;
    for (const element of liste) ajouter(element);
  }
  if (Array.isArray(manifeste?.documents_ecartes)) {
    for (const element of manifeste.documents_ecartes) ajouter(element);
  }
  return urls;
}

/** Dernier segment du chemin d'une URL, décodé : le nom du document. */
function nomDocument(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "");
  } catch {
    return "";
  }
}

/**
 * Empreinte constatable d'un document : les liens de téléchargement triés quand
 * la page en publie, l'URL de la page sinon. Le contenu n'est pas lu : une
 * réédition sous la même URL garde la même empreinte.
 */
function empreinte(liens: string[], url: string): string {
  if (liens.length === 0) return url;
  return createHash("sha256").update(liens.join("\n"), "utf8").digest("hex").slice(0, 16);
}

/**
 * Entrée de veille d'un document. `publishedAt` est la date de la passe : les
 * pages de référence ne datent pas leurs documents, et une entrée datée d'une
 * ancienne édition sortirait de la fenêtre de `corpus:sync`.
 */
function entreeDeDocument(
  document: LienListe,
  motif: "nouveau" | "modifie",
  datePasse: string,
  liens: string[],
): Entry {
  return {
    id: identifiant(urlComparable(document.url)),
    title: document.titre,
    officialTitle: document.titre,
    url: document.url,
    publishedAt: `${datePasse}T12:00:00.000Z`,
    summary: null,
    references: [],
    themes: [...THEMES],
    source: SOURCE_ID,
    document: nomDocument(document.url),
    version: empreinte(liens, document.url),
    motif,
  };
}

/**
 * Une passe : chaque page de référence est relue, ses documents listés sont
 * comparés au descripteur et au manifeste. Un document inconnu dont la page ne
 * publie qu'un fichier déjà connu est un alias ; un document inconnu dont
 * l'intitulé est connu est modifié ; tout autre document inconnu est nouveau.
 */
export async function passeDoctrineUe(
  options: PasseDoctrineUeOptions = {},
): Promise<ResultatPasseDoctrineUe> {
  const descripteur = options.descripteur ?? lireDescripteur(DESCRIPTEUR);
  const rootDir = options.rootDir ?? process.cwd();
  const instant = options.maintenant ?? new Date();
  const datePasse = Number.isNaN(instant.getTime()) ? "" : instant.toISOString().slice(0, 10);
  if (!DATE_ISO.test(datePasse) || Number.isNaN(Date.parse(datePasse))) {
    throw new Error(`Date de passe attendue AAAA-MM-JJ ; reçue « ${datePasse} »`);
  }

  const http: OptionsHttp = {
    ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
    ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
    tentatives: descripteur.tentatives,
    delaiMs: descripteur.delai_ms,
    pauseEntreMs: descripteur.delai_ms,
  };

  const documents: LienListe[] = [];
  const vus = new Set<string>();
  let pagesLues = 0;
  for (const reference of descripteur.liste_reference) {
    const html = await chargerTexte(reference.url, http);
    verifierPage(texteDepuisHtml(html), reference.url);
    pagesLues += 1;
    for (const document of extraireDocumentsListes(html, reference.url)) {
      const cle = urlComparable(document.url);
      if (vus.has(cle)) continue;
      vus.add(cle);
      documents.push(document);
    }
  }
  if (documents.length === 0) {
    throw new Error("Aucun document de doctrine listé : les pages de référence ont changé ?");
  }

  const manifeste = lireManifeste(options.manifestePath ?? join(rootDir, MANIFESTE));

  // Un document déjà déclaré, déjà écarté, non récupéré ou déjà au manifeste ne
  // produit rien : la synchronisation sait qu'il existe.
  const connues = new Set<string>();
  const noter = (url: string | undefined): void => {
    if (url !== undefined) connues.add(urlComparable(url));
  };
  for (const document of descripteur.documents) {
    noter(document.url);
    noter(document.source);
  }
  for (const document of descripteur.documents_ecartes) noter(document.url);
  for (const document of descripteur.non_recuperes) noter(document.url);
  for (const url of urlsDuManifeste(manifeste)) noter(url);

  // Fichiers que le corpus a déjà lus : une page qui les publie est un alias.
  const sourcesConnues = new Set<string>();
  for (const document of descripteur.documents) sourcesConnues.add(urlComparable(document.source));
  for (const document of descripteur.non_recuperes) sourcesConnues.add(urlComparable(document.url));

  // Pages officielles des documents du corpus : une page qui les renvoie sans
  // publier de nouveau fichier les présente, elle n'apporte pas de document.
  const pagesConnues = new Set<string>();
  for (const document of descripteur.documents) pagesConnues.add(urlComparable(document.url));

  // Intitulés déjà couverts, dans leur forme traduite comme dans celle de la source.
  const titresConnus = new Set<string>();
  for (const document of descripteur.documents) {
    titresConnus.add(cleTitre(document.titre));
    if (document.titre_source !== undefined) titresConnus.add(cleTitre(document.titre_source));
  }

  const entries: Entry[] = [];
  let inchanges = 0;
  let alias = 0;

  for (const document of documents) {
    if (connues.has(urlComparable(document.url))) {
      inchanges += 1;
      continue;
    }
    const html = await chargerTexte(document.url, http);
    verifierPage(texteDepuisHtml(html), document.url);
    const liens = liensTelechargement(html, document.url);
    if (liens.some((lien) => sourcesConnues.has(urlComparable(lien)))) {
      alias += 1;
      continue;
    }
    // Page de présentation d'une politique : elle renvoie une page de document
    // connue et ne publie aucun fichier nouveau. Une Q&R ou une FAQ, même sans
    // fichier, reste un document : la règle est bornée aux pages de politique.
    const presentation =
      cheminPolitique(document.url) &&
      liens.every((lien) => sourcesConnues.has(urlComparable(lien))) &&
      liensPage(html, document.url).some((lien) => pagesConnues.has(urlComparable(lien)));
    if (presentation) {
      alias += 1;
      continue;
    }
    const motif: "nouveau" | "modifie" = titresConnus.has(cleTitre(document.titre))
      ? "modifie"
      : "nouveau";
    entries.push(entreeDeDocument(document, motif, datePasse, liens));
  }

  const nouveaux = entries.filter((entry) => entry.motif === "nouveau").length;
  const modifies = entries.length - nouveaux;
  return {
    raw: [],
    entries,
    warnings: [],
    notes: [
      `${SOURCE_ID} : ${pagesLues} page(s) lue(s), ${documents.length} document(s) listé(s), ` +
        `${nouveaux} nouveau(x), ${modifies} modifié(s), ${inchanges} inchangé(s), ` +
        `${alias} alias ignoré(s)`,
    ],
  };
}
