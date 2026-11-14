/**
 * Synchronise le corpus CEPD : liste paginée, pages de documents et PDF.
 *
 * Le corpus n'est écrit qu'après extraction et validation de tous les textes.
 * Une liste en 429/503 est retentée trois fois, puis relue par le Wayback
 * Machine ; les PDF suivent le même chemin. Si les deux voies échouent, rien
 * n'est écrit et le journal des tentatives est rendu à l'appelant.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Unite } from "../parse.ts";
import {
  ErreurHttp,
  TYPES_DOCUMENT,
  chargerTexte,
  listerDocumentsG29,
  listerDocumentsSitemap,
  listerDocumentsWayback,
  snapshotWayback,
  trouverLienPdf,
} from "./liste.ts";
import type {
  DescripteurCePd,
  DocumentG29Liste,
  DocumentListe,
  FetchHtml,
  FetchJson,
  HebergementG29,
  ResultatListe,
  Tentative,
  TypeDocument,
} from "./liste.ts";
import { extraireTextePdf, languePdf, telechargerPdf } from "./pdf.ts";
import type { FetchPdf, LanguePdf } from "./pdf.ts";
import {
  choisirVersions,
  enrichirDocument,
  preparerDocument,
  slugDe,
  unitesCePd,
  validerUnites,
} from "./parse.ts";
import type { DocumentPrepare } from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus CEPD sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "cepd");
/** Dossier des PDF bruts, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "cepd");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type DocumentEcart = {
  url: string;
  slug: string;
  /** Type du document écarté, lu sur sa rubrique. */
  type: TypeDocument;
  raison: string;
  /** Origine de l'écart : le sitemap ou la liste d'endossement du G29. */
  source?: "sitemap" | "endossement";
};

/** Un document de la liste d'endossement du G29 et son sort au corpus. */
export type DocumentG29Manifeste = {
  titre: string;
  url: string;
  wp: string | null;
  hebergement: HebergementG29;
  statut: "retenu" | "ecarte";
  /** Slug du document retenu, quand il l'est. */
  document?: string;
  /** Type du document retenu, quand il l'est. */
  type?: TypeDocument;
  /** Vrai quand le WP est représenté au corpus par son successeur EDPB. */
  successeur?: boolean;
  raison?: string;
};

/** La liste d'endossement du G29, rapprochée du corpus. */
export type BlocG29 = {
  source: string;
  liste_le: string;
  documents: DocumentG29Manifeste[];
  comptes: { listes: number; retenus: number; successeurs: number; ecartes: number };
  /** Renseigné quand la page n'a pas pu être lue. */
  erreur?: string;
};

/** Comptes d'un type : documents retenus et fragments produits. */
export type CompteType = { documents: number; fragments: number };

/** Comptes des cinq types, y compris ceux qui n'ont rien rendu. */
export type ComptesParType = Record<TypeDocument, CompteType>;

export type ManifesteCePd = {
  corpus: string;
  nom: string;
  titre: string;
  url_liste: string;
  date_liste: string;
  depuis: string | null;
  /** Limite demandée, ou `null` quand la liste entière est traitée. */
  limite: number | null;
  /** Voie qui a fourni la liste : sitemap, directe ou Wayback Machine. */
  via: "sitemap" | "direct" | "wayback";
  /** Pages de sitemap lues, vide hors sitemap. */
  sitemap_pages: string[];
  documents: number;
  fragments: number;
  versions_ecartees: number;
  documents_sans_texte_ecartes: number;
  types_retenus: TypeDocument[];
  /** Documents et fragments retenus, type par type. */
  comptes_par_type: ComptesParType;
  /** Langue des PDF retenus, tous types confondus. */
  langues_pdf: Record<LanguePdf, number>;
  /** Langue du texte retenu, document par document. */
  documents_langues: Record<string, LanguePdf>;
  /** Type de chaque document retenu, document par document. */
  documents_types: Record<string, TypeDocument>;
  /** Version de chaque document retenu (`2.0`, `rev01`, …) ; `null` quand la page n'en porte pas. */
  documents_versions: Record<string, string | null>;
  /** Dernière modification du sitemap pour chaque document retenu ; `null` hors sitemap. */
  documents_lastmod: Record<string, string | null>;
  /** Liste d'endossement du G29, rapprochée du corpus ; `null` si non lue. */
  g29: BlocG29 | null;
  licence: string;
  couverture: {
    source: string;
    date_liste: string;
    limite: number | null;
    via: "sitemap" | "direct" | "wayback";
    sitemap_pages: string[];
    pages_lues: number;
    periode: { date_min: string | null; date_max: string | null };
    types_retenus: TypeDocument[];
    comptes_par_type: ComptesParType;
    langues_pdf: Record<LanguePdf, number>;
    documents_langues: Record<string, LanguePdf>;
    documents_types: Record<string, TypeDocument>;
    documents_versions: Record<string, string | null>;
    documents_lastmod: Record<string, string | null>;
    g29: BlocG29 | null;
    documents_sans_texte_ecartes: number;
    versions_ecartees: number;
    /** Documents écartés, avec leur URL, leur slug, leur type et le motif. */
    documents_ecartes: DocumentEcart[];
  };
};

export type SyncCePdOptions = {
  rootDir?: string;
  descripteurPath?: string;
  dryRun?: boolean;
  /** Nombre maximal de documents retenus après sélection des versions. */
  limite?: number;
  /** Ne garde que les documents datés au moins de ce jour (`AAAA-MM-JJ`). */
  depuis?: string;
  /** Date de liste consignée ; par défaut, le jour courant. */
  date?: string;
  fetchHtml?: FetchHtml;
  fetchJson?: FetchJson;
  fetchPdf?: FetchPdf;
  attendre?: (ms: number) => Promise<void>;
  tentatives?: number;
  delaiMs?: number;
  /** Délai de politesse entre deux documents ; `0` le désactive. */
  delaiEntreRequetesMs?: number;
  pageMax?: number;
  /** Extraction injectable : les tests remplacent unpdf par le texte de la fixture. */
  extraireTexte?: (octets: Uint8Array, url: string) => Promise<string>;
  /** Journal des tentatives, lisible même si la synchronisation échoue. */
  journal?: Tentative[];
};

export type ResultatCePd = {
  documents: number;
  fragments: number;
  versionsEcartees: number;
  documentsSansTexte: number;
  pages: number;
  /** Vrai si un fichier du corpus a changé sur le disque. */
  ecrit: boolean;
  tentatives: Tentative[];
};

/** Lit le descripteur CEPD. */
export function lireDescripteur(chemin: string): DescripteurCePd {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurCePd;
}

/** Date du jour en UTC, forme `AAAA-MM-JJ`. */
export function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
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

/** Manifeste du corpus : comptes, versions écartées et couverture déclarée. */
export function manifesteCePd(
  descripteur: DescripteurCePd,
  dateListe: string,
  depuis: string | null,
  limite: number | null,
  via: "sitemap" | "direct" | "wayback",
  sitemapPages: string[],
  comptes: {
    pages: number;
    documents: number;
    fragments: number;
    versionsEcartees: number;
    documentsSansTexte: number;
    typesRetenus: TypeDocument[];
    comptesParType: ComptesParType;
    languesPdf: Record<LanguePdf, number>;
    documentsLangues: Record<string, LanguePdf>;
    documentsTypes: Record<string, TypeDocument>;
    documentsVersions: Record<string, string | null>;
    documentsLastmod: Record<string, string | null>;
    g29: BlocG29 | null;
    documentsEcartes: DocumentEcart[];
    dateMin: string | null;
    dateMax: string | null;
  },
): ManifesteCePd {
  return {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    url_liste: descripteur.url_liste,
    date_liste: dateListe,
    depuis,
    limite,
    via,
    sitemap_pages: sitemapPages,
    documents: comptes.documents,
    fragments: comptes.fragments,
    versions_ecartees: comptes.versionsEcartees,
    documents_sans_texte_ecartes: comptes.documentsSansTexte,
    types_retenus: comptes.typesRetenus,
    comptes_par_type: comptes.comptesParType,
    langues_pdf: comptes.languesPdf,
    documents_langues: comptes.documentsLangues,
    documents_types: comptes.documentsTypes,
    documents_versions: comptes.documentsVersions,
    documents_lastmod: comptes.documentsLastmod,
    g29: comptes.g29,
    licence: descripteur.licence,
    couverture: {
      source:
        "CEPD — lignes directrices, avis art. 64, décisions contraignantes " +
        "art. 65, recommandations et documents G29 repris (PDF)",
      date_liste: dateListe,
      limite,
      via,
      sitemap_pages: sitemapPages,
      pages_lues: comptes.pages,
      periode: { date_min: comptes.dateMin, date_max: comptes.dateMax },
      types_retenus: comptes.typesRetenus,
      comptes_par_type: comptes.comptesParType,
      langues_pdf: comptes.languesPdf,
      documents_langues: comptes.documentsLangues,
      documents_types: comptes.documentsTypes,
      documents_versions: comptes.documentsVersions,
      documents_lastmod: comptes.documentsLastmod,
      g29: comptes.g29,
      documents_sans_texte_ecartes: comptes.documentsSansTexte,
      versions_ecartees: comptes.versionsEcartees,
      documents_ecartes: comptes.documentsEcartes,
    },
  };
}

/** Slug sûr pour une URL qui n'a pas encore été préparée. */
function slugSecurise(url: string): string {
  try {
    return slugDe(url);
  } catch {
    return url;
  }
}

/** Message lisible d'une erreur, pour le motif d'un document écarté. */
function messageErreur(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Forme courte d'un numéro (`Guidelines 05/2020` → `05/2020`). */
function numeroCourt(numero: string): string | null {
  const trouve = /(\d{1,2})\s*\/\s*(\d{4})/.exec(numero);
  if (trouve?.[1] === undefined || trouve[2] === undefined) return null;
  return `${String(Number(trouve[1])).padStart(2, "0")}/${trouve[2]}`;
}

/** Famille d'un document de la liste d'endossement, pour ne pas confondre un avis homonyme. */
function familleG29(titre: string): "guidelines" | "recommandation" | "autre" {
  if (/^guidelines?\b/i.test(titre)) return "guidelines";
  if (/^recommendations?\b/i.test(titre)) return "recommandation";
  return "autre";
}

/** Famille déduite du lien de successeur, quand le titre est un « Working Document ». */
function familleDepuisUrlG29(url: string): "guidelines" | "recommandation" | "autre" {
  let chemin: string;
  try {
    chemin = new URL(url).pathname;
  } catch {
    return "autre";
  }
  if (/\/recommendations?\//i.test(chemin)) return "recommandation";
  if (/\/guidelines?\//i.test(chemin)) return "guidelines";
  return "autre";
}

/**
 * Rapproche la liste d'endossement du G29 du corpus : un document dont le
 * numéro EDPB ou WP est déjà retenu est `retenu` ; un document déjà écarté
 * garde son motif ; les autres sont ajoutés aux écarts avec leur hébergement.
 */
function rapprocherG29(
  items: readonly DocumentG29Liste[],
  retenus: readonly DocumentPrepare[],
  ecartes: readonly DocumentEcart[],
  dateListe: string,
  source: string,
): { bloc: BlocG29; ajouts: DocumentEcart[] } {
  // Un avis 05/2020 et une ligne directrice 05/2020 portent le même numéro :
  // la famille du titre de la liste d'endossement départage.
  const parNumero = new Map<string, DocumentPrepare>();
  const parWp = new Map<string, DocumentPrepare>();
  for (const document of retenus) {
    // Un avis art. 64 ou une décision art. 65 porte souvent le même numéro
    // qu'une ligne directrice : il n'appartient jamais à la liste du G29.
    if (document.type === "avis_art64" || document.type === "decision_art65") continue;
    const famille = document.type === "recommandation" ? "recommandation" : "guidelines";
    const court = numeroCourt(document.numero);
    if (court !== null) parNumero.set(`${famille}|${court}`, document);
    if (/^WP\d+$/i.test(document.numero)) parWp.set(document.numero.toUpperCase(), document);
  }

  const ajouts: DocumentEcart[] = [];
  const documents = items.map((item, index): DocumentG29Manifeste => {
    // « Working Document … WP256 » pointe Recommandations 1/2022 : la famille
    // se lit alors dans le lien du successeur, pas dans le titre.
    const famille =
      familleG29(item.titre) === "autre"
        ? familleDepuisUrlG29(item.url)
        : familleG29(item.titre);
    const retenu =
      (item.wp === null ? undefined : parWp.get(item.wp.toUpperCase())) ??
      (item.numero === null || famille === "autre"
        ? undefined
        : parNumero.get(`${famille}|${item.numero}`));
    if (retenu !== undefined) {
      const successeur = item.wp !== null && retenu.numero.toUpperCase() !== item.wp.toUpperCase();
      return {
        ...item,
        statut: "retenu",
        document: retenu.slug,
        type: retenu.type,
        ...(successeur ? { successeur: true } : {}),
      };
    }
    const existant = ecartes.find(
      (ecart) =>
        (item.wp !== null && ecart.slug.toLowerCase().includes(item.wp.toLowerCase())) ||
        ecart.url === item.url,
    );
    if (existant !== undefined) {
      return { ...item, statut: "ecarte", raison: existant.raison };
    }
    let hote = "hors site";
    try {
      hote = new URL(item.url).hostname;
    } catch {
      // URL illisible : le motif générique suffit.
    }
    const raison =
      item.hebergement === "commission"
        ? `document hébergé hors du site du CEPD (${hote})`
        : item.hebergement === "cepd"
          ? "page CEPD sans PDF ou non listée au sitemap"
          : `hébergement hors du site du CEPD (${hote})`;
    const slug =
      item.wp?.toLowerCase() ??
      (/^position paper/i.test(item.titre) ? "position-paper" : `g29-${index + 1}`);
    ajouts.push({
      url: item.url,
      slug,
      type: "g29_repris",
      raison,
      source: "endossement",
    });
    return { ...item, statut: "ecarte", raison };
  });

  return {
    bloc: {
      source,
      liste_le: dateListe,
      documents,
      comptes: {
        listes: documents.length,
        retenus: documents.filter((document) => document.statut === "retenu").length,
        successeurs: documents.filter((document) => document.successeur === true).length,
        ecartes: documents.filter((document) => document.statut === "ecarte").length,
      },
    },
    ajouts,
  };
}

/** Comptes vides des cinq types. */
function comptesVides(): ComptesParType {
  return {
    lignes_directrices: { documents: 0, fragments: 0 },
    avis_art64: { documents: 0, fragments: 0 },
    decision_art65: { documents: 0, fragments: 0 },
    recommandation: { documents: 0, fragments: 0 },
    g29_repris: { documents: 0, fragments: 0 },
  };
}

/**
 * Liste les documents, puis bascule sur le Wayback Machine si la liste directe
 * échoue. Une erreur finale porte les deux causes ; le journal reste lisible.
 */
async function listerAvecRepli(
  descripteur: DescripteurCePd,
  options: SyncCePdOptions,
  journal: Tentative[],
): Promise<ResultatListe> {
  const http = {
    ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
    ...(options.fetchJson === undefined ? {} : { fetchJson: options.fetchJson }),
    ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
    ...(options.tentatives === undefined ? {} : { tentatives: options.tentatives }),
    ...(options.delaiMs === undefined ? {} : { delaiMs: options.delaiMs }),
    ...(options.pageMax === undefined ? {} : { pageMax: options.pageMax }),
    journal,
  };
  try {
    return await listerDocumentsSitemap(descripteur, http);
  } catch (sitemap) {
    if (!(sitemap instanceof ErreurHttp)) throw sitemap;
    try {
      return await listerDocumentsWayback(descripteur, http);
    } catch (repli) {
      const cause = repli instanceof Error ? repli.message : String(repli);
      throw new Error(
        `Liste CEPD indisponible. Sitemap : ${sitemap.message}. Wayback : ${cause}`,
      );
    }
  }
}

/** Charge une page de document, directement ou par son instantané Wayback. */
async function chargerPageDocument(
  url: string,
  descripteur: DescripteurCePd,
  options: SyncCePdOptions,
  journal: Tentative[],
): Promise<string> {
  const http = {
    ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
    ...(options.fetchJson === undefined ? {} : { fetchJson: options.fetchJson }),
    ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
    ...(options.tentatives === undefined ? {} : { tentatives: options.tentatives }),
    ...(options.delaiMs === undefined ? {} : { delaiMs: options.delaiMs }),
    journal,
  };
  try {
    return await chargerTexte(url, { ...http, via: "direct" });
  } catch (direct) {
    if (!(direct instanceof ErreurHttp)) throw direct;
    const instantane = await snapshotWayback(url, descripteur, http);
    if (instantane === null) throw direct;
    return chargerTexte(instantane, { ...http, via: "wayback" });
  }
}

/** Télécharge un PDF, directement ou par son instantané Wayback. */
async function octetsPdf(
  url: string,
  chemin: string,
  descripteur: DescripteurCePd,
  options: SyncCePdOptions,
  journal: Tentative[],
): Promise<Uint8Array> {
  const commun = {
    ...(options.fetchPdf === undefined ? {} : { fetchPdf: options.fetchPdf }),
    ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
    ...(options.fetchJson === undefined ? {} : { fetchJson: options.fetchJson }),
    ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
    ...(options.tentatives === undefined ? {} : { tentatives: options.tentatives }),
    ...(options.delaiMs === undefined ? {} : { delaiMs: options.delaiMs }),
    ...(options.dryRun === undefined ? {} : { dryRun: options.dryRun }),
    journal,
  };
  try {
    return await telechargerPdf(url, chemin, {
      ...commun,
      via: "direct",
      hotesAutorises: [descripteur.domaine],
    });
  } catch (direct) {
    if (!(direct instanceof ErreurHttp)) throw direct;
    const instantane = await snapshotWayback(url, descripteur, commun);
    if (instantane === null) throw direct;
    return telechargerPdf(instantane, chemin, {
      ...commun,
      via: "wayback",
      hotesAutorises: [descripteur.domaine, "web.archive.org"],
    });
  }
}

/**
 * Synchronise le corpus CEPD. Une limite ou une date de départ réduit le jeu
 * avant téléchargement ; un `--dry-run` ne crée aucun fichier de corpus ni PDF.
 */
export async function syncCePd(options: SyncCePdOptions = {}): Promise<ResultatCePd> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteur(
    options.descripteurPath ?? join(ICI, "descripteur.json"),
  );
  const dateListe = options.date ?? dateDuJour();
  if (!DATE_ISO.test(dateListe) || Number.isNaN(Date.parse(dateListe))) {
    throw new Error(`Date de liste attendue AAAA-MM-JJ ; reçue « ${dateListe} »`);
  }
  if (options.depuis !== undefined && (!DATE_ISO.test(options.depuis) || Number.isNaN(Date.parse(options.depuis)))) {
    throw new Error(`Date de départ attendue AAAA-MM-JJ ; reçue « ${options.depuis} »`);
  }
  if (options.limite !== undefined && (!Number.isInteger(options.limite) || options.limite < 1)) {
    throw new Error(`--limite attend un entier positif ; reçu « ${options.limite} »`);
  }

  const journal: Tentative[] = options.journal ?? [];
  const delai = options.delaiEntreRequetesMs ?? descripteur.delai_entre_requetes_ms ?? 0;
  const attendre = options.attendre ?? ((ms: number): Promise<void> =>
    new Promise((reussir) => setTimeout(reussir, ms)));
  const liste = await listerAvecRepli(descripteur, options, journal);
  const documentsEcartes: DocumentEcart[] = [];
  // Documents sans texte lisible : page, date, PDF ou extraction.
  let sansTexte = 0;

  const documentsListe: DocumentListe[] = [];
  for (const document of liste.documents) {
    if (liste.via === "sitemap") {
      try {
        const html = await chargerPageDocument(document.url, descripteur, options, journal);
        documentsListe.push(enrichirDocument(document, html));
      } catch (error) {
        sansTexte += 1;
        documentsEcartes.push({
          url: document.url,
          slug: slugSecurise(document.url),
          type: document.type,
          raison: `page illisible : ${messageErreur(error)}`,
        });
        continue;
      }
    } else {
      documentsListe.push(document);
    }
    // Requête polie : un délai entre deux pages, jamais dans les tests.
    if (delai > 0) await attendre(delai);
  }

  const prepares: DocumentPrepare[] = [];
  for (const document of documentsListe) {
    try {
      prepares.push(preparerDocument(document));
    } catch (error) {
      sansTexte += 1;
      documentsEcartes.push({
        url: document.url,
        slug: slugSecurise(document.url),
        type: document.type,
        raison: messageErreur(error),
      });
    }
  }
  // Une même ligne est listée en français et en anglais : le slug les réunit.
  const uniques = new Map<string, DocumentPrepare>();
  for (const document of prepares) {
    if (!uniques.has(document.slug)) uniques.set(document.slug, document);
  }
  const depuis = options.depuis;
  const filtres = depuis === undefined
    ? [...uniques.values()]
    : [...uniques.values()].filter((document) => document.date >= depuis);
  const { retenus, ecartes } = choisirVersions(filtres);
  const choix = options.limite === undefined ? retenus : retenus.slice(0, options.limite);
  if (choix.length === 0) {
    throw new Error(
      `Aucun document CEPD retenu (${liste.documents.length} listé(s), ` +
        `${filtres.length} après la date de départ)`,
    );
  }
  documentsEcartes.push(
    ...ecartes.map((document) => ({
      url: document.url,
      slug: document.slug,
      type: document.type,
      raison: "version obsolète",
    })),
  );

  const extraireTexte = options.extraireTexte ?? extraireTextePdf;
  const unites: Unite[] = [];
  const documentsAvecTexte: DocumentPrepare[] = [];
  const languesPdf: Record<LanguePdf, number> = { fr: 0, en: 0, autre: 0 };
  const documentsLangues: Record<string, LanguePdf> = {};

  for (const document of choix) {
    try {
      let pdfUrl = document.pdfUrl;
      if (pdfUrl === null && liste.via !== "sitemap") {
        const html = await chargerPageDocument(document.url, descripteur, options, journal);
        pdfUrl = trouverLienPdf(html, document.url);
      }
      if (pdfUrl === null) {
        sansTexte += 1;
        documentsEcartes.push({
          url: document.url,
          slug: document.slug,
          type: document.type,
          raison: "PDF absent",
        });
        continue;
      }
      // Un document G29 n'est retenu que si son PDF porte bien son numéro WP :
      // une pièce jointe sans rapport ne doit pas entrer au corpus.
      if (document.type === "g29_repris") {
        const wp = /\b(WP\d{2,4})\b/i.exec(document.numero)?.[1]?.toUpperCase();
        if (wp !== undefined && !new URL(pdfUrl).pathname.toLowerCase().includes(wp.toLowerCase())) {
          sansTexte += 1;
          documentsEcartes.push({
            url: document.url,
            slug: document.slug,
            type: document.type,
            raison: `PDF sans rapport avec le document (${wp} absent du nom du fichier)`,
          });
          continue;
        }
      }
      // Une page qui ne sert que l'annexe ne donne pas le document : le
      // corpus ne doit pas prendre la pièce jointe pour le texte principal.
      // « …_with_annex_fr.pdf » est le document complet, pas une annexe seule.
      const nomPdf = new URL(pdfUrl).pathname.split("/").at(-1) ?? "";
      const annexeSeule =
        /_annexe?\d*_(?:fr|en)\.pdf$/i.test(nomPdf) && !/_with_annex/i.test(nomPdf);
      if (annexeSeule && !/annexe?/i.test(document.titre)) {
        sansTexte += 1;
        documentsEcartes.push({
          url: document.url,
          slug: document.slug,
          type: document.type,
          raison: "PDF annexe seulement",
        });
        continue;
      }
      const chemin = join(rootDir, DOSSIER_BRUT, `${document.slug}.pdf`);
      const octets = await octetsPdf(pdfUrl, chemin, descripteur, options, journal);
      const texte = await extraireTexte(octets, pdfUrl);
      unites.push(...unitesCePd(document, texte, descripteur));
      documentsAvecTexte.push(document);
      // Un PDF sans suffixe de langue suit la langue de sa page : c'est elle
      // qui a décidé du repli français → anglais.
      const langue = languePdf(pdfUrl) === "autre" ? (document.langue ?? "autre") : languePdf(pdfUrl);
      languesPdf[langue] += 1;
      documentsLangues[document.slug] = langue;
    } catch (error) {
      sansTexte += 1;
      documentsEcartes.push({
        url: document.url,
        slug: document.slug,
        type: document.type,
        raison: messageErreur(error),
      });
    } finally {
      if (delai > 0) await attendre(delai);
    }
  }

  if (unites.length === 0) {
    throw new Error(
      `Aucun fragment CEPD produit : ${sansTexte} document(s) sans PDF` +
        `${sansTexte === 0 ? "" : ` (${documentsEcartes.slice(0, 3).map((document) => document.url).join(", ")})`}`,
    );
  }
  validerUnites(unites);

  const documents = new Set(unites.map((unite) => unite.document)).size;
  const dates = unites.map((unite) => unite.date_acte).sort();
  const comptesParType = comptesVides();
  const documentsTypes: Record<string, TypeDocument> = {};
  const documentsVersions: Record<string, string | null> = {};
  const documentsLastmod: Record<string, string | null> = {};
  const fragmentsParDocument = new Map<string, number>();
  for (const unite of unites) {
    fragmentsParDocument.set(unite.document, (fragmentsParDocument.get(unite.document) ?? 0) + 1);
  }
  for (const document of documentsAvecTexte) {
    comptesParType[document.type].documents += 1;
    comptesParType[document.type].fragments += fragmentsParDocument.get(document.slug) ?? 0;
    documentsTypes[document.slug] = document.type;
    documentsVersions[document.slug] = document.version;
    documentsLastmod[document.slug] = document.lastmod ?? null;
  }
  const typesRetenus = TYPES_DOCUMENT.filter((type) => comptesParType[type].documents > 0);

  let g29: BlocG29 | null = null;
  if (descripteur.url_endossement !== undefined) {
    const http = {
      ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
      ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
      ...(options.tentatives === undefined ? {} : { tentatives: options.tentatives }),
      ...(options.delaiMs === undefined ? {} : { delaiMs: options.delaiMs }),
      journal,
    };
    try {
      const html = await chargerTexte(descripteur.url_endossement, { ...http, via: "direct" });
      const rapproche = rapprocherG29(
        listerDocumentsG29(html, descripteur.url_endossement),
        documentsAvecTexte,
        documentsEcartes,
        dateListe,
        descripteur.url_endossement,
      );
      g29 = rapproche.bloc;
      documentsEcartes.push(...rapproche.ajouts);
    } catch (error) {
      // La liste d'endossement ne bloque pas la synchronisation du corpus.
      g29 = {
        source: descripteur.url_endossement,
        liste_le: dateListe,
        documents: [],
        comptes: { listes: 0, retenus: 0, successeurs: 0, ecartes: 0 },
        erreur: messageErreur(error),
      };
    }
  }
  const via = liste.via;
  const manifeste = manifesteCePd(
    descripteur,
    dateListe,
    options.depuis ?? null,
    options.limite ?? null,
    via,
    liste.sitemapPages,
    {
      pages: liste.pages,
      documents,
      fragments: unites.length,
      versionsEcartees: ecartes.length,
      documentsSansTexte: sansTexte,
      typesRetenus,
      comptesParType,
      languesPdf,
      documentsLangues,
      documentsTypes,
      documentsVersions,
      documentsLastmod,
      g29,
      documentsEcartes,
      dateMin: dates[0] ?? null,
      dateMax: dates.at(-1) ?? null,
    },
  );
  const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const cheminManifeste = join(rootDir, DOSSIER_CORPUS, "manifest.json");

  let ecrit = false;
  if (options.dryRun !== true) {
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
    versionsEcartees: ecartes.length,
    documentsSansTexte: sansTexte,
    pages: liste.pages,
    ecrit,
    tentatives: journal,
  };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const limite = valeurDe("--limite", argv);
  const depuis = valeurDe("--depuis", argv);
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const date = valeurDe("--date", argv);
  const pageMax = valeurDe("--page-max", argv);

  const journal: Tentative[] = [];
  let resultat: ResultatCePd;
  try {
    resultat = await syncCePd({
      ...(rootDir === undefined ? {} : { rootDir }),
      ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
      ...(limite === undefined ? {} : { limite: Number.parseInt(limite, 10) }),
      ...(depuis === undefined ? {} : { depuis }),
      ...(date === undefined ? {} : { date }),
      ...(pageMax === undefined ? {} : { pageMax: Number.parseInt(pageMax, 10) }),
      dryRun,
      journal,
    });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    for (const tentative of journal) {
      process.stderr.write(
        `  ${tentative.via} ${tentative.url} → ${tentative.statut} (tentative ${tentative.tentative})\n`,
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stderr.write(
    `${resultat.pages} page(s), ${resultat.documents} document(s), ${resultat.fragments} fragment(s), ` +
      `${resultat.versionsEcartees} version(s) écartée(s), ` +
      `${resultat.documentsSansTexte} sans PDF` +
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
