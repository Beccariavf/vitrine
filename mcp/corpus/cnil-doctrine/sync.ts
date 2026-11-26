/**
 * Synchronise le corpus `cnil_doctrine` : guides, référentiels et listes AIPD
 * publiés sur cnil.fr.
 *
 * Les pages de référence déclarées au descripteur listent les documents ; les
 * PDF sont téléchargés, adressés par leur `sha256` sous `data/raw/`, puis
 * découpés en fragments mot pour mot. Un document qui porte une mention
 * contraire à la licence est écarté avec son motif. Une délibération déjà
 * présente au corpus `cnil` n'est pas dupliquée : elle est portée au manifeste
 * comme « couvert par le corpus cnil ».
 *
 * Le corpus n'est écrit qu'après validation de tous les fragments. Le cache de
 * `data/raw/cnil-doctrine/cache.json` rend une relance sans réseau.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { extraireTextePdf } from "../cepd/pdf.ts";
import type { Unite } from "../parse.ts";
import { texteVisible } from "../parse.ts";
import {
  chargerPdf,
  chargerTexte,
  estPdf,
  extraireDocuments,
  lireDescripteur,
  parcourirReference,
  pdfVersionFiche,
} from "./liste.ts";
import type {
  DescripteurDoctrine,
  FetchHtml,
  FetchPdf,
  LienDocument,
  PageReference,
  TypeDoctrine,
} from "./liste.ts";
import {
  dateDePage,
  dateDuDocument,
  deliberationDuDocument,
  deliberationsCitees,
  mentionContraire,
  slugDe,
  slugUnique,
  texteFiche,
  unitesDoctrine,
  validerUnites,
} from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "cnil_doctrine");
/** Dossier des PDF et du cache, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "cnil-doctrine");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Une entrée du cache : le fichier écrit et l'empreinte de son contenu. */
export type EntreeCache = { fichier: string; sha256: string; consulte_le: string };

export type Cache = Record<string, EntreeCache>;

export type DocumentManifeste = {
  slug: string;
  type: TypeDoctrine;
  titre: string;
  url: string;
  snapshot: string;
  date_acte: string;
  date_source: "document" | "descripteur" | "extraction";
  date_extraction: string;
  /** Numéro de la délibération que le document met en œuvre, quand il la déclare. */
  numero?: string;
  /** Numéros des documents que celui-ci remplace. */
  remplace?: string[];
  /** Comment le texte a été obtenu : la page HTML de la fiche, ou son PDF officiel. */
  representation: "pdf" | "page";
  /**
   * PDF officiel proposé pour la fiche, même quand la page l'emporte
   * (`representation: "page"`, par exemple une infographie) ; `null` sans PDF.
   */
  pdf: string | null;
  /** Licence applicable à ce document, portée par le document lui-même. */
  licence: string;
  licence_url: string;
  /** Crédit à afficher avec chaque extrait de ce document. */
  source: string;
  fragments: number;
};

export type CouvertParCnil = {
  type: TypeDoctrine;
  titre: string;
  url: string;
  numero: string;
  document: string;
};

/** Document déjà listé par une autre page de référence, donc non dupliqué. */
export type CouvertParDoctrine = {
  type: TypeDoctrine;
  titre: string;
  url: string;
};

export type DocumentEcart = {
  url: string;
  titre: string;
  raison: string;
};

export type ManifesteDoctrine = {
  corpus: string;
  nom: string;
  titre: string;
  /** Pages de référence réellement consultées, avec leur date de consultation. */
  liste_reference: {
    type: TypeDoctrine;
    url: string;
    /** `page` : page de résultats relue ; `liste` : liste explicite déclarée. */
    origine: "page" | "liste";
    consulte_le: string;
    /** Documents que la page a listés, retenus ou non. */
    listes: number;
    /** Documents retenus au corpus (ou couverts par le corpus `cnil`). */
    documents: number;
  }[];
  consulte_le: string;
  date_extraction: string;
  /** Documents que les pages de référence ont listés, tous types confondus. */
  documents_listes: number;
  documents: number;
  fragments: number;
  types: Record<TypeDoctrine, number>;
  /** Documents de chaque type laissés au corpus `cnil` : ni dupliqués ni recomptés. */
  couverts_par_type: Record<TypeDoctrine, number>;
  documents_par_type: Record<TypeDoctrine, DocumentManifeste[]>;
  /** Numéro remplacé → numéro qui le remplace, lu sur les documents déclarés. */
  remplacements: Record<string, string>;
  couverts_par_cnil: CouvertParCnil[];
  /** Documents déjà listés ailleurs au corpus, non dupliqués. */
  couverts_par_doctrine: CouvertParDoctrine[];
  documents_ecartes: DocumentEcart[];
  mention: string;
  licence: string;
  licence_url: string;
  source: string;
  couverture: {
    source: string;
    date_liste: string;
    date_extraction: string;
    pages_reference: string[];
    documents_listes: number;
    types: Record<TypeDoctrine, number>;
    couverts_par_type: Record<TypeDoctrine, number>;
    couverts_par_cnil: number;
    couverts_par_doctrine: number;
    documents_ecartes: number;
    mentions_contraires: number;
    licence_note: string;
  };
};

export type SyncDoctrineOptions = {
  rootDir?: string;
  descripteurPath?: string;
  dryRun?: boolean;
  /** Jour de la passe et date d'extraction consignée ; par défaut le jour courant. */
  date?: string;
  fetchHtml?: FetchHtml;
  fetchPdf?: FetchPdf;
  attendre?: (ms: number) => Promise<void>;
  tentatives?: number;
  delaiMs?: number;
  /** Attente avant chaque requête ; par défaut, le `delai_ms` du descripteur. */
  pauseEntreMs?: number;
  /** Force la relecture des PDF, sans attendre l'expiration du cache. */
  rafraichir?: boolean;
  /** Durée de validité du cache des PDF, en jours ; par défaut celle du descripteur. */
  validite_jours?: number;
  /** Extraction injectable : les tests remplacent unpdf par un texte de fixture. */
  extraireTexte?: (octets: Uint8Array, url: string) => Promise<string>;
  /** Texte injectable des pages de référence, pour éviter le réseau en test. */
  lirePage?: (url: string) => Promise<string>;
};

export type ResultatDoctrine = {
  documents: number;
  fragments: number;
  couverts: number;
  couverts_doctrine: number;
  ecartes: number;
  pagesLues: number;
  ecrit: boolean;
};

/** Date du jour en UTC, forme `AAAA-MM-JJ`. */
export function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/** Empreinte `sha256` d'octets. */
function sha256(octets: Uint8Array | string): string {
  return createHash("sha256").update(octets).digest("hex");
}

/** Nombre de lettres d'un texte, pour comparer deux représentations. */
function lettres(texte: string): number {
  return (texte.match(/\p{L}/gu) ?? []).length;
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

/** Écrit des octets par fichier temporaire puis renommage. */
function ecrireOctets(chemin: string, octets: Uint8Array): void {
  mkdirSync(dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.tmp`;
  try {
    writeFileSync(temporaire, octets);
    renameSync(temporaire, chemin);
  } finally {
    if (existsSync(temporaire)) rmSync(temporaire, { force: true });
  }
}

/** Cache de téléchargement : fichier et empreinte par URL. */
export type Telechargeur = {
  pdf(url: string): Promise<{ octets: Uint8Array; sha256: string }>;
  /** Retire une entrée dont le fichier s'est révélé inutilisable. */
  oublier(url: string): void;
};

/**
 * Téléchargeur avec cache : une URL déjà lue n'est pas redemandée tant que son
 * fichier est présent. Le cache est réécrit après chaque nouvelle entrée pour
 * qu'une passe interrompue reprenne au dernier document.
 */
export function creerTelechargeur(
  brutDir: string,
  cache: Cache,
  options: SyncDoctrineOptions,
  ecrire: boolean,
): Telechargeur {
  const http = {
    ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
    ...(options.fetchPdf === undefined ? {} : { fetchPdf: options.fetchPdf }),
    ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
    ...(options.tentatives === undefined ? {} : { tentatives: options.tentatives }),
    ...(options.delaiMs === undefined ? {} : { delaiMs: options.delaiMs }),
    ...(options.pauseEntreMs === undefined ? {} : { pauseEntreMs: options.pauseEntreMs }),
  };

  const memoriser = (url: string, fichier: string, empreinte: string, date: string): void => {
    cache[url] = { fichier, sha256: empreinte, consulte_le: date };
    if (ecrire) {
      ecrireSiChange(join(brutDir, "cache.json"), `${JSON.stringify(cache, null, 2)}\n`);
    }
  };

  // Le cache des PDF expire : une réédition servie à la même URL doit être vue.
  // `--refresh` le ramène à zéro. Les pages, elles, ne passent jamais par lui.
  const validite = options.rafraichir === true ? 0 : Math.max(0, options.validite_jours ?? 7);
  const date = options.date ?? dateDuJour();
  const perime = (entree: EntreeCache): boolean => {
    const veille = Date.parse(`${entree.consulte_le}T00:00:00Z`);
    if (Number.isNaN(veille)) return true;
    const jour = Date.parse(`${date}T00:00:00Z`);
    return (jour - veille) / 86_400_000 >= validite;
  };
  const cacheValide = (url: string): EntreeCache | null => {
    const entree = cache[url];
    if (entree === undefined) return null;
    if (!existsSync(join(brutDir, entree.fichier))) return null;
    return perime(entree) ? null : entree;
  };

  return {
    async pdf(url) {
      const entree = cacheValide(url);
      if (entree !== null) {
        return {
          octets: new Uint8Array(readFileSync(join(brutDir, entree.fichier))),
          sha256: entree.sha256,
        };
      }
      const octets = await chargerPdf(url, http);
      const empreinte = sha256(octets);
      const fichier = join("pdf", `${empreinte}.pdf`);
      if (ecrire) {
        ecrireOctets(join(brutDir, fichier), octets);
        memoriser(url, fichier, empreinte, date);
      }
      return { octets, sha256: empreinte };
    },
    oublier(url) {
      delete cache[url];
      if (ecrire) {
        ecrireSiChange(join(brutDir, "cache.json"), `${JSON.stringify(cache, null, 2)}\n`);
      }
    },
  };
}

/** Lit le cache de téléchargement, vide quand il n'existe pas. */
export function lireCache(brutDir: string): Cache {
  const chemin = join(brutDir, "cache.json");
  if (!existsSync(chemin)) return {};
  try {
    const valeur: unknown = JSON.parse(readFileSync(chemin, "utf8"));
    if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return {};
    return valeur as Cache;
  } catch {
    return {};
  }
}

/**
 * Numéros de délibération du corpus `cnil` et leur document. Un numéro porté
 * par plusieurs documents garde le premier dans l'ordre du fichier.
 */
export function lireCorpusCnil(rootDir: string): Map<string, string> {
  const chemin = join(rootDir, "data", "corpus", "cnil", "unites.jsonl");
  const numeros = new Map<string, string>();
  if (!existsSync(chemin)) return numeros;
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    if (ligne.trim() === "") continue;
    let unite: Unite;
    try {
      unite = JSON.parse(ligne) as Unite;
    } catch {
      continue;
    }
    if (typeof unite.numero !== "string" || typeof unite.document !== "string") continue;
    if (!numeros.has(unite.numero)) numeros.set(unite.numero, unite.document);
  }
  return numeros;
}

/** Entrée du manifeste précédent, gardée telle quelle quand le texte n'a pas bougé. */
export type DocumentPrecedent = DocumentManifeste & Record<string, unknown>;

/**
 * Documents déjà au corpus, par URL. Leur entrée sert de base à un document
 * dont le texte n'a pas changé : une nouvelle passe ne le redate pas et ne
 * remplace pas l'empreinte de sa capture.
 */
export function lireDocumentsPrecedents(rootDir: string): Map<string, DocumentPrecedent> {
  const chemin = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  const documents = new Map<string, DocumentPrecedent>();
  if (!existsSync(chemin)) return documents;
  let manifeste: unknown;
  try {
    manifeste = JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    return documents;
  }
  if (typeof manifeste !== "object" || manifeste === null) return documents;
  const parType = (manifeste as { documents_par_type?: unknown }).documents_par_type;
  if (typeof parType !== "object" || parType === null) return documents;
  for (const liste of Object.values(parType)) {
    if (!Array.isArray(liste)) continue;
    for (const document of liste) {
      if (typeof document !== "object" || document === null) continue;
      const url = (document as { url?: unknown }).url;
      if (typeof url !== "string") continue;
      documents.set(url, document as DocumentPrecedent);
    }
  }
  return documents;
}

/**
 * Empreinte du texte de chaque document du corpus précédent, lue dans
 * `unites.jsonl` : elle décide si un document a réellement changé, sans se
 * laisser tromper par le chrome volatil d'une page HTML.
 */
export function lireTextesPrecedents(rootDir: string): Map<string, string> {
  const chemin = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const empreintes = new Map<string, string>();
  if (!existsSync(chemin)) return empreintes;
  const morceaux = new Map<string, string[]>();
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    if (ligne.trim() === "") continue;
    let unite: { ref?: unknown; document?: unknown; texte?: unknown };
    try {
      unite = JSON.parse(ligne) as { ref?: unknown; document?: unknown; texte?: unknown };
    } catch {
      continue;
    }
    if (
      typeof unite.ref !== "string" ||
      typeof unite.document !== "string" ||
      typeof unite.texte !== "string"
    ) {
      continue;
    }
    const liste = morceaux.get(unite.document) ?? [];
    liste.push(`${unite.ref}\n${unite.texte}\n`);
    morceaux.set(unite.document, liste);
  }
  for (const [document, liste] of morceaux) {
    empreintes.set(document, sha256(liste.join("")));
  }
  return empreintes;
}

/** Texte lisible d'une page de document : sa zone principale, balises retirées. */
export function texteDePage(html: string): string {
  const main = /<main\b[\s\S]*?<\/main>/i.exec(html);
  return texteVisible(main === null ? html : main[0]).replace(/\s+/g, " ").trim();
}

/** Un candidat de document : sa page, le PDF officiel qu'elle sert, ou les deux. */
type Candidat = {
  type: TypeDoctrine;
  /** Le document : URL de la page de la fiche, ou du PDF quand il n'y a que lui. */
  url: string;
  titre: string;
  /** PDF officiel de la même fiche, quand la page en publie un. */
  pdf: LienDocument | null;
  /** HTML de la page de la fiche, quand le document est publié en page. */
  pageHtml: string | null;
  /** Texte de la page qui porte le document, pour y lire une délibération. */
  pageTexte: string | null;
  /** Numéro de la délibération que le document met en œuvre, déclaré au descripteur. */
  numero?: string;
  /** Date d'acte déclarée au descripteur, quand le fichier ne se date pas. */
  dateActe?: string;
  /** Numéros des documents que celui-ci remplace, déclarés au descripteur. */
  remplace?: string[];
  reference: PageReference;
};

/** Un document retenu, sa représentation, son empreinte et son texte. */
type DocumentLu = {
  candidat: Candidat;
  titre: string;
  date_acte: string;
  date_source: "document" | "descripteur" | "extraction";
  representation: "pdf" | "page";
  snapshot: string;
  texte: string;
  /** Nombre de lettres du texte retenu, pour le seuil et le plafond déclarés. */
  lettres: number;
};

/**
 * Synchronise la doctrine CNIL. Les candidats sont lus sur chaque page de
 * référence, chaque PDF est téléchargé puis extrait ; une mention contraire
 * écarte le document, une délibération déjà au corpus `cnil` le couvre sans
 * duplication. Rien n'est écrit avant validation de tous les fragments.
 */
export async function syncDoctrine(
  options: SyncDoctrineOptions = {},
): Promise<ResultatDoctrine> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteur(
    options.descripteurPath ?? join(ICI, "descripteur.json"),
  );
  const date = options.date ?? dateDuJour();
  if (!DATE_ISO.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`Date attendue AAAA-MM-JJ ; reçue « ${date} »`);
  }

  const brutDir = join(rootDir, DOSSIER_BRUT);
  const cache = lireCache(brutDir);
  const ecrire = options.dryRun !== true;
  const delai = options.delaiMs ?? descripteur.delai_ms;
  const optionsHttp = {
    ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
    ...(options.fetchPdf === undefined ? {} : { fetchPdf: options.fetchPdf }),
    ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
    tentatives: options.tentatives ?? descripteur.tentatives,
    delaiMs: delai,
    pauseEntreMs: delai,
  };
  const telechargeur = creerTelechargeur(
    brutDir,
    cache,
    { ...options, ...optionsHttp, validite_jours: options.validite_jours ?? descripteur.validite_jours },
    ecrire,
  );
  // Les pages de référence et de document sont relues à chaque passe : c'est
  // elles qui disent quels documents existent. Un cache les figerait sans que
  // le manifeste le dise.
  const optionsPage = { ...optionsHttp };
  const lirePage =
    options.lirePage ?? ((url: string) => chargerTexte(url, optionsPage));

  const candidats: Candidat[] = [];
  const references: ManifesteDoctrine["liste_reference"] = [];
  const ecartes: DocumentEcart[] = [];
  let pagesLues = 0;

  for (const reference of descripteur.pages_reference) {
    const liste = await parcourirReference(reference, descripteur.domaine, optionsHttp);
    pagesLues += liste.pagesLues;
    // Ce que la page de référence a listé, retenu ou non : une fiche refusée
    // reste comptée ici, puis déclarée dans `documents_ecartes`.
    let listes = 0;
    const entreeReference: ManifesteDoctrine["liste_reference"][number] = {
      type: reference.type,
      url: reference.url,
      origine: reference.liens === "urls" ? "liste" : "page",
      consulte_le: date,
      listes,
      documents: 0,
    };
    references.push(entreeReference);
    for (const pdf of liste.pdfs) {
      listes += 1;
      candidats.push({
        type: reference.type,
        url: pdf.url,
        titre: pdf.titre.trim(),
        pdf,
        pageHtml: null,
        pageTexte: null,
        reference,
      });
    }
    for (const page of liste.pages) {
      if (reference.liens === "fiches") {
        let html: string;
        try {
          html = await lirePage(page.url);
        } catch (error) {
          // Une fiche refusée est déclarée : la liste de référence ne l'oublie pas.
          listes += 1;
          ecartes.push({
            url: page.url,
            titre: page.titre.trim(),
            raison: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
        listes += 1;
        candidats.push({
          type: reference.type,
          url: page.url,
          titre: page.titre.trim(),
          pdf: pdfVersionFiche(html, page.url, descripteur.domaine, page.titre),
          pageHtml: html,
          pageTexte: texteDePage(html),
          reference,
        });
        continue;
      }
      const html = await lirePage(page.url);
      const trouves = extraireDocuments(
        html,
        page.url,
        { type: reference.type, url: reference.url, pages_max: reference.pages_max, liens: "pdf", ...(reference.motif_pdf === undefined ? {} : { motif_pdf: reference.motif_pdf }) },
        descripteur.domaine,
      );
      const pageTexte = texteDePage(html);
      for (const pdf of trouves.pdfs) {
        listes += 1;
        candidats.push({
          type: reference.type,
          url: pdf.url,
          titre: pdf.titre.trim(),
          pdf,
          pageHtml: null,
          pageTexte,
          reference,
        });
      }
    }
    for (const document of liste.documents) {
      listes += 1;
      const titre = document.titre.trim();
      if (estPdf(document.url, descripteur.domaine)) {
        candidats.push({
          type: reference.type,
          url: document.url,
          titre,
          pdf: { url: document.url, titre },
          pageHtml: null,
          pageTexte: null,
          ...(document.numero === undefined ? {} : { numero: document.numero }),
          ...(document.date_acte === undefined ? {} : { dateActe: document.date_acte }),
          ...(document.remplace === undefined ? {} : { remplace: [...document.remplace] }),
          reference,
        });
        continue;
      }
      let html: string;
      try {
        html = await lirePage(document.url);
      } catch (error) {
        // Une page déclarée et refusée est dite, jamais oubliée.
        ecartes.push({
          url: document.url,
          titre,
          raison: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      const pdf =
        document.pdf === undefined
          ? pdfVersionFiche(html, document.url, descripteur.domaine, titre)
          : { url: document.pdf, titre };
      candidats.push({
        type: reference.type,
        url: document.url,
        titre,
        pdf,
        pageHtml: html,
        pageTexte: texteDePage(html),
        ...(document.numero === undefined ? {} : { numero: document.numero }),
        ...(document.date_acte === undefined ? {} : { dateActe: document.date_acte }),
        ...(document.remplace === undefined ? {} : { remplace: [...document.remplace] }),
        reference,
      });
    }
    entreeReference.listes = listes;
  }

  const vus = new Set<string>();
  const doublons: Candidat[] = [];
  const uniques = candidats.filter((candidat) => {
    if (vus.has(candidat.url)) {
      doublons.push(candidat);
      return false;
    }
    vus.add(candidat.url);
    return true;
  });
  if (uniques.length === 0) {
    throw new Error("Aucun document de doctrine listé : les pages de référence ont changé ?");
  }
  const couvertsParDoctrine: CouvertParDoctrine[] = doublons.map((candidat) => ({
    type: candidat.type,
    titre: candidat.titre.trim(),
    url: candidat.url,
  }));

  const corpusCnil = lireCorpusCnil(rootDir);
  const precedents = lireDocumentsPrecedents(rootDir);
  const textesPrecedents = lireTextesPrecedents(rootDir);
  const extraireTexte = options.extraireTexte ?? extraireTextePdf;
  const documentsParType: Record<TypeDoctrine, DocumentManifeste[]> = {
    guide: [],
    referentiel: [],
    liste_aipd: [],
    fiche_ia: [],
    doctrine_ia: [],
  };
  const couverts: CouvertParCnil[] = [];
  const pris = new Set<string>();
  const lus: DocumentLu[] = [];

  for (const candidat of uniques) {
    const url = candidat.url;
    const titre = candidat.titre.trim();
    const textePage = candidat.pageHtml === null ? null : texteFiche(candidat.pageHtml);
    const datePage = candidat.pageHtml === null ? null : dateDePage(candidat.pageHtml);
    let empreinte = "";
    let texte = textePage ?? "";
    let representation: "pdf" | "page" = "page";
    let luDepuisPdf = false;

    if (candidat.pdf !== null) {
      try {
        const fichier = await telechargeur.pdf(candidat.pdf.url);
        empreinte = fichier.sha256;
        texte = await extraireTexte(fichier.octets, candidat.pdf.url);
        representation = "pdf";
        luDepuisPdf = true;
      } catch (error) {
        // Un PDF dont l'extraction échoue ne doit pas rester au cache : la passe
        // suivante le redemande au lieu d'échouer sur le même fichier.
        telechargeur.oublier(candidat.pdf.url);
        if (candidat.pageHtml === null) {
          ecartes.push({
            url,
            titre,
            raison: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
      }
    }

    if (!luDepuisPdf && candidat.pageHtml !== null) {
      // Une fiche publiée en page : son corps seul, converti en paragraphes.
      texte = textePage ?? "";
      empreinte = sha256(candidat.pageHtml);
      representation = "page";
      if (!/\p{L}/u.test(texte)) {
        ecartes.push({ url, titre, raison: "page sans texte : aucune lettre dans la zone principale" });
        continue;
      }
    } else if (!luDepuisPdf) {
      ecartes.push({ url, titre, raison: "ni page ni PDF à lire" });
      continue;
    }

    // Le PDF d'une fiche peut n'être qu'une infographie : quand la page porte
    // plus de texte, c'est elle la fiche, et le PDF n'est qu'une illustration.
    if (representation === "pdf" && textePage !== null && lettres(texte) < lettres(textePage)) {
      texte = textePage;
      empreinte = sha256(candidat.pageHtml ?? "");
      representation = "page";
    }

    // Une page ou un PDF trop court n'est pas une position de fond : il est
    // déclaré avec sa mesure, jamais retenu pour grossir la liste.
    const seuil = candidat.reference.seuil_lettres;
    if (seuil !== undefined && lettres(texte) < seuil) {
      ecartes.push({
        url,
        titre,
        raison: `moins de ${seuil} lettres (${lettres(texte)})`,
      });
      continue;
    }

    const contraire = mentionContraire(texte);
    if (contraire !== null) {
      ecartes.push({ url, titre, raison: contraire });
      continue;
    }

    // La couverture par une délibération ne vaut que pour les listes AIPD, qui
    // sont la délibération elle-même : une position sur l'IA cite des
    // délibérations sans être l'une d'elles.
    const citees = [
      ...deliberationsCitees(candidat.pageTexte ?? ""),
      ...deliberationsCitees(texte),
    ];
    const couvert =
      candidat.type === "liste_aipd"
        ? deliberationDuDocument(titre, citees, corpusCnil)
        : null;
    if (couvert !== null) {
      couverts.push({ type: candidat.type, titre, url, ...couvert });
      continue;
    }

    // Une méthodologie de référence ne porte ni le numéro ni la date de la
    // délibération qui l'homologue : le descripteur les déclare. Sans cela, la
    // date d'acte serait celle de l'extraction, fausse pour un texte adopté.
    const dateLue = datePage ?? dateDuDocument(texte);
    const dateDocument = candidat.dateActe ?? dateLue;
    const sourceDate =
      candidat.dateActe !== undefined
        ? "descripteur"
        : dateLue === null
          ? "extraction"
          : "document";
    const precedent = precedents.get(url);
    // Un texte inchangé garde la date de sa première extraction : une nouvelle
    // passe ne le redate pas. Un contenu réédité reprend la date du jour.
    const dateActe =
      dateDocument ??
      (precedent !== undefined &&
      precedent.snapshot === empreinte &&
      precedent.date_source === "extraction"
        ? precedent.date_acte
        : date);
    lus.push({
      candidat,
      titre: titre === "" ? slugDe(url) : titre,
      date_acte: dateActe,
      date_source: sourceDate,
      representation,
      snapshot: empreinte,
      texte,
      lettres: lettres(texte),
    });
  }

  // Plafond déclaré par page de référence : les documents les plus substantiels
  // restent, les autres sont déclarés avec leur mesure.
  const gardes = new Set<DocumentLu>();
  const parReference = new Map<PageReference, DocumentLu[]>();
  for (const lu of lus) {
    const liste = parReference.get(lu.candidat.reference) ?? [];
    liste.push(lu);
    parReference.set(lu.candidat.reference, liste);
  }
  for (const [reference, documentsLus] of parReference) {
    const plafond = reference.plafond;
    if (plafond === undefined || documentsLus.length <= plafond) {
      for (const lu of documentsLus) gardes.add(lu);
      continue;
    }
    const tries = [...documentsLus].sort(
      (gauche, droite) =>
        droite.lettres - gauche.lettres ||
        gauche.candidat.url.localeCompare(droite.candidat.url),
    );
    for (const lu of tries.slice(0, plafond)) gardes.add(lu);
    for (const lu of tries.slice(plafond)) {
      ecartes.push({
        url: lu.candidat.url,
        titre: lu.titre,
        raison: `plafond de ${plafond} documents : moins substantiel que les ${plafond} retenus`,
      });
    }
  }

  const unites: Unite[] = [];
  for (const lu of lus) {
    if (!gardes.has(lu)) continue;
    const url = lu.candidat.url;
    // La page retenue est conservée comme preuve, adressée par son empreinte,
    // sous `data/raw/` (non commité), comme les PDF.
    if (ecrire && lu.representation === "page" && lu.candidat.pageHtml !== null) {
      ecrireOctets(
        join(brutDir, "page", `${lu.snapshot}.html`),
        new TextEncoder().encode(lu.candidat.pageHtml),
      );
    }
    const slug = slugUnique(url, pris);
    const fragments = unitesDoctrine(
      {
        type: lu.candidat.type,
        url,
        titre: lu.titre,
        slug,
        date_acte: lu.date_acte,
        ...(lu.candidat.numero === undefined ? {} : { numero: lu.candidat.numero }),
      },
      lu.texte,
      descripteur,
    );
    unites.push(...fragments);
    const empreinteTexte = sha256(
      fragments.map((fragment) => `${fragment.ref}\n${fragment.texte}\n`).join(""),
    );
    const entreePrecedente = precedents.get(url);
    if (
      entreePrecedente !== undefined &&
      textesPrecedents.get(slug) === empreinteTexte
    ) {
      // Le texte est identique : l'entrée existante garde son empreinte de
      // capture, sa date d'acte et sa date d'extraction. Seuls le type,
      // l'intitulé, le lien, le numéro, le remplacement et la licence, qui
      // viennent du descripteur, suivent.
      documentsParType[lu.candidat.type].push({
        ...entreePrecedente,
        type: lu.candidat.type,
        titre: lu.titre,
        url,
        fragments: fragments.length,
        representation: lu.representation,
        pdf: lu.candidat.pdf?.url ?? null,
        ...(lu.candidat.numero === undefined ? {} : { numero: lu.candidat.numero }),
        ...(lu.candidat.remplace === undefined ? {} : { remplace: [...lu.candidat.remplace] }),
        licence: descripteur.licence,
        licence_url: descripteur.licence_url,
        source: descripteur.source,
      });
      continue;
    }
    documentsParType[lu.candidat.type].push({
      slug,
      type: lu.candidat.type,
      titre: lu.titre,
      url,
      snapshot: lu.snapshot,
      date_acte: lu.date_acte,
      date_source: lu.date_source,
      date_extraction:
        precedents.get(url)?.snapshot === lu.snapshot
          ? (precedents.get(url)?.date_extraction ?? date)
          : date,
      representation: lu.representation,
      pdf: lu.candidat.pdf?.url ?? null,
      ...(lu.candidat.numero === undefined ? {} : { numero: lu.candidat.numero }),
      ...(lu.candidat.remplace === undefined ? {} : { remplace: [...lu.candidat.remplace] }),
      licence: descripteur.licence,
      licence_url: descripteur.licence_url,
      source: descripteur.source,
      fragments: fragments.length,
    });
  }

  if (unites.length === 0) {
    throw new Error(
      `Aucun fragment de doctrine produit : ${uniques.length} document(s) listé(s), ` +
        `${couverts.length} couvert(s) par le corpus CNIL, ${ecartes.length} écarté(s)`,
    );
  }
  validerUnites(unites, descripteur.corpus);

  const documents = new Set(unites.map((unite) => unite.document)).size;
  const types: Record<TypeDoctrine, number> = {
    guide: documentsParType.guide.length,
    referentiel: documentsParType.referentiel.length,
    liste_aipd: documentsParType.liste_aipd.length,
    fiche_ia: documentsParType.fiche_ia.length,
    doctrine_ia: documentsParType.doctrine_ia.length,
  };
  const couvertsParType: Record<TypeDoctrine, number> = {
    guide: couverts.filter((couvert) => couvert.type === "guide").length,
    referentiel: couverts.filter((couvert) => couvert.type === "referentiel").length,
    liste_aipd: couverts.filter((couvert) => couvert.type === "liste_aipd").length,
    fiche_ia: couverts.filter((couvert) => couvert.type === "fiche_ia").length,
    doctrine_ia: couverts.filter((couvert) => couvert.type === "doctrine_ia").length,
  };
  const compteParReference = new Map<PageReference, number>();
  const parUrl = new Map(uniques.map((candidat) => [candidat.url, candidat]));
  for (const document of [
    ...documentsParType.guide,
    ...documentsParType.referentiel,
    ...documentsParType.liste_aipd,
    ...documentsParType.fiche_ia,
    ...documentsParType.doctrine_ia,
  ]) {
    const candidat = parUrl.get(document.url);
    if (candidat === undefined) continue;
    compteParReference.set(candidat.reference, (compteParReference.get(candidat.reference) ?? 0) + 1);
  }
  for (const couvert of couverts) {
    const candidat = parUrl.get(couvert.url);
    if (candidat === undefined) continue;
    compteParReference.set(candidat.reference, (compteParReference.get(candidat.reference) ?? 0) + 1);
  }
  for (const doublon of doublons) {
    compteParReference.set(doublon.reference, (compteParReference.get(doublon.reference) ?? 0) + 1);
  }
  const listeReference = references.map((entree, index) => {
    const reference = descripteur.pages_reference[index];
    return {
      ...entree,
      documents: reference === undefined ? 0 : compteParReference.get(reference) ?? 0,
    };
  });
  const documentsListes = references.reduce((total, entree) => total + entree.listes, 0);
  const ecartesParUrl = new Map<string, DocumentEcart>();
  for (const declare of descripteur.documents_ecartes ?? []) {
    ecartesParUrl.set(declare.url, declare);
  }
  for (const ecarte of ecartes) ecartesParUrl.set(ecarte.url, ecarte);
  const tousEcartes = [...ecartesParUrl.values()];

  // Le remplacement déclaré au descripteur : une MR de 2026 remplace celle de
  // 2018, dont le statut au corpus `cnil` dit déjà « Remplacée par 2026-05x ».
  const remplacements: Record<string, string> = {};
  for (const listeDocuments of Object.values(documentsParType)) {
    for (const document of listeDocuments) {
      if (document.numero === undefined || document.remplace === undefined) continue;
      for (const numero of document.remplace) {
        const existant = remplacements[numero];
        if (existant !== undefined && existant !== document.numero) {
          throw new Error(
            `Remplacement ambigu de ${numero} : ${existant} et ${document.numero}`,
          );
        }
        remplacements[numero] = document.numero;
      }
    }
  }

  const manifeste: ManifesteDoctrine = {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    liste_reference: listeReference,
    consulte_le: date,
    date_extraction: date,
    documents_listes: documentsListes,
    documents,
    fragments: unites.length,
    types,
    couverts_par_type: couvertsParType,
    documents_par_type: documentsParType,
    remplacements,
    couverts_par_cnil: couverts,
    couverts_par_doctrine: couvertsParDoctrine,
    documents_ecartes: tousEcartes,
    mention: descripteur.mention,
    licence: descripteur.licence,
    licence_url: descripteur.licence_url,
    source: descripteur.source,
    couverture: {
      source: "CNIL — guides, référentiels, fiches IA, doctrine IA et listes AIPD (cnil.fr)",
      date_liste: date,
      date_extraction: date,
      pages_reference: descripteur.pages_reference.map((reference) => reference.url),
      documents_listes: documentsListes,
      types,
      couverts_par_type: couvertsParType,
      couverts_par_cnil: couverts.length,
      couverts_par_doctrine: couvertsParDoctrine.length,
      documents_ecartes: tousEcartes.length,
      mentions_contraires: tousEcartes.filter((ecarte) => ecarte.raison.startsWith("mention contraire")).length,
      licence_note:
        "Les textes de cnil.fr sont sous CC BY-ND 4.0 sauf mention contraire ; " +
        "l'heuristique écarte une mention contraire explicite. Aucune mention de licence distincte " +
        "n'est portée par les documents retenus ; un document co-édité avec un tiers garde le crédit " +
        "du site et son lien, seule mention fournie par la source.",
    },
  };

  let ecrit = false;
  if (ecrire) {
    const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
    const cheminManifeste = join(rootDir, DOSSIER_CORPUS, "manifest.json");
    const ecritUnites = ecrireSiChange(
      cheminUnites,
      `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    );
    const ecritManifeste = ecrireSiChange(
      cheminManifeste,
      `${JSON.stringify(manifeste, null, 2)}\n`,
    );
    ecrit = ecritUnites || ecritManifeste;
  }

  return {
    documents,
    fragments: unites.length,
    couverts: couverts.length,
    couverts_doctrine: couvertsParDoctrine.length,
    ecartes: tousEcartes.length,
    pagesLues,
    ecrit,
  };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const rafraichir = argv.includes("--refresh");
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const date = valeurDe("--date", argv);

  try {
    const resultat = await syncDoctrine({
      ...(rootDir === undefined ? {} : { rootDir }),
      ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
      ...(date === undefined ? {} : { date }),
      dryRun,
      rafraichir,
    });
    process.stderr.write(
      `${resultat.documents} document(s), ${resultat.fragments} fragment(s), ` +
        `${resultat.couverts} couvert(s) par le corpus CNIL, ` +
        `${resultat.couverts_doctrine} couvert(s) par une autre liste, ${resultat.ecartes} écarté(s), ` +
        `${resultat.pagesLues} page(s) de résultats lues` +
        `${dryRun ? " — dry-run, rien n'est écrit" : resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé"}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
