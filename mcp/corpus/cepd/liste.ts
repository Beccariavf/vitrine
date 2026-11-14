/**
 * Liste les documents du CEPD : lignes directrices, avis art. 64, décisions
 * contraignantes art. 65, recommandations et documents du G29 repris.
 *
 * Le site répond parfois 429 ou 503 : chaque requête est retentée trois fois
 * avec un délai croissant. Si la liste directe reste indisponible, l'appelant
 * peut demander la même liste par le Wayback Machine. Le sitemap porte les
 * versions `_fr` et `_en` : la version française est préférée, l'anglaise sert
 * de repli. Une page de consultation publique est ignorée.
 */

import { texteVisible } from "../parse.ts";

/** User-agent générique des requêtes du corpus, sans identité personnelle. */
export const AGENT = "vitrine/1.0 (+https://github.com/Beccariavf/vitrine)";

/** `fetch` par défaut, avec le user-agent du corpus. */
function fetchAgent(url: string, accept: string): ReturnType<typeof fetch> {
  return fetch(url, { headers: { "user-agent": AGENT, accept } });
}

/** Type de document retenu, tel qu'il paraît au manifeste et dans le chemin. */
export type TypeDocument =
  | "lignes_directrices"
  | "avis_art64"
  | "decision_art65"
  | "recommandation"
  | "g29_repris";

/** Les cinq types, dans l'ordre du corpus. */
export const TYPES_DOCUMENT: readonly TypeDocument[] = [
  "lignes_directrices",
  "avis_art64",
  "decision_art65",
  "recommandation",
  "g29_repris",
];

/** Libellé du type, premier étage du `chemin` d'un fragment. */
export const LIBELLES_TYPE: Record<TypeDocument, string> = {
  lignes_directrices: "Lignes directrices",
  avis_art64: "Avis art. 64",
  decision_art65: "Décisions contraignantes art. 65",
  recommandation: "Recommandations",
  g29_repris: "G29 repris",
};

/** Rubriques réelles du sitemap, ramenées à un type de corpus. */
const TYPE_PAR_RUBRIQUE: Record<string, TypeDocument> = {
  guideline: "lignes_directrices",
  guidelines: "lignes_directrices",
  recommendation: "recommandation",
  recommendations: "recommandation",
  "opinion-of-the-board-art-64": "avis_art64",
  "edpb-binding-decisions": "decision_art65",
};

/** Type d'un document d'après sa rubrique dans l'URL ; `null` hors corpus. */
export function typeDepuisChemin(pathname: string): TypeDocument | null {
  const rubrique = /\/(?:our-work-tools\/)?(?:our-)?documents\/([^/]+)\//.exec(pathname)?.[1];
  if (rubrique === undefined) return null;
  return TYPE_PAR_RUBRIQUE[rubrique.toLowerCase()] ?? null;
}

/** Langue d'une page de sitemap, lue sur son suffixe. */
export type LanguePage = "fr" | "en";

/** Hébergement d'un document de la liste d'endossement du G29. */
export type HebergementG29 = "cepd" | "commission" | "autre";

/** Un document de la liste d'endossement du G29, avant rapprochement au corpus. */
export type DocumentG29Liste = {
  titre: string;
  url: string;
  /** Numéro WP quand le titre le porte, par exemple `WP260`. */
  wp: string | null;
  /** Numéro EDPB déduit de l'URL liée, par exemple `05/2020`. */
  numero: string | null;
  hebergement: HebergementG29;
};

/** Un document listé, avant enrichissement depuis sa page. */
export type DocumentListe = {
  type: TypeDocument;
  /** URL de la page du document, sur `edpb.europa.eu`. */
  url: string;
  titre: string;
  /** Date ISO (`AAAA-MM-JJ`), quand la liste ou le titre la porte. */
  date: string | null;
  /** URL du PDF, quand la liste ou la page la donne directement. */
  pdfUrl: string | null;
  /** Version explicite lue sur la page, quand elle en porte une. */
  version?: string | null;
  /** Langue de la page retenue, quand la liste la connaît. */
  langue?: LanguePage;
  /** Vrai quand la page sert une version soumise à consultation publique. */
  consultation?: boolean;
};

/** Une tentative HTTP, consignée pour le rapport de blocage. */
export type Tentative = {
  via: "direct" | "wayback";
  url: string;
  tentative: number;
  /** Statut HTTP, ou un libellé quand la réponse n'en porte pas. */
  statut: number | string;
};

/** Réponse HTML minimale d'un `fetch`, injectable en test. */
export type FetchHtml = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** Réponse JSON minimale d'un `fetch`, injectable en test. */
export type FetchJson = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type DescripteurCePd = {
  corpus: string;
  nom: string;
  titre: string;
  url_liste: string;
  /** Index des sitemaps ; source primaire des pages `_fr` et `_en`. */
  url_sitemap: string;
  /** Page d'endossement des documents du G29 par le CEPD. */
  url_endossement?: string;
  /** Nombre de pages de sitemap essayées si l'index est illisible. */
  pages_sitemap: number;
  /** Langue préférée des pages retenues ; l'autre langue sert de repli. */
  langue: string;
  /** Types retenus depuis le sitemap. */
  types: TypeDocument[];
  /** Délai de politesse entre deux documents, en millisecondes. */
  delai_entre_requetes_ms?: number;
  page_debut: number;
  page_max: number;
  domaine: string;
  licence: string;
  tentatives: number;
  delai_ms: number;
  url_wayback_api: string;
  url_wayback_cdx: string;
};

export type OptionsHttp = {
  fetchHtml?: FetchHtml;
  fetchJson?: FetchJson;
  tentatives?: number;
  delaiMs?: number;
  /** Attente injectable : les tests la remplacent par une fonction vide. */
  attendre?: (ms: number) => Promise<void>;
  /** Journal des tentatives, rempli par les requêtes. */
  journal?: Tentative[];
  via?: "direct" | "wayback";
};

export type ResultatListe = {
  documents: DocumentListe[];
  pages: number;
  /** Source de la liste : sitemap primaire, liste directe ou Wayback. */
  via: "sitemap" | "direct" | "wayback";
  /** URLs des pages de sitemap lues, vide hors sitemap. */
  sitemapPages: string[];
  tentatives: Tentative[];
};

/** Erreur HTTP qui porte l'URL et le nombre de tentatives. */
export class ErreurHttp extends Error {
  readonly url: string;
  readonly statut: number | string;
  readonly tentatives: number;

  constructor(url: string, statut: number | string, tentatives: number) {
    super(`${url} : HTTP ${statut} après ${tentatives} tentative(s)`);
    this.name = "ErreurHttp";
    this.url = url;
    this.statut = statut;
    this.tentatives = tentatives;
  }
}

const MOIS: Record<string, string> = {
  janvier: "01",
  février: "02",
  fevrier: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  août: "08",
  aout: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  décembre: "12",
  decembre: "12",
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function jourMoisAnnee(jour: string, mois: string, annee: string): string | null {
  const numeroMois = MOIS[mois.toLocaleLowerCase("fr")];
  if (numeroMois === undefined) return null;
  const jourNombre = Number(jour);
  const anneeNombre = Number(annee);
  if (!Number.isInteger(jourNombre) || !Number.isInteger(anneeNombre)) return null;
  if (jourNombre < 1 || jourNombre > 31) return null;
  return `${annee}-${numeroMois}-${String(jourNombre).padStart(2, "0")}`;
}

/** Première date ISO reconnue dans un fragment HTML ou un titre ; `null` sinon. */
export function dateDansTexte(texte: string): string | null {
  const time = /<time\b[^>]*datetime=["'](\d{4}-\d{2}-\d{2})/i.exec(texte);
  if (time?.[1] !== undefined) return time[1];

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(texte);
  if (iso?.[1] !== undefined && iso[2] !== undefined && iso[3] !== undefined) {
    const valeur = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return Number.isNaN(Date.parse(valeur)) ? null : valeur;
  }

  const francais = /\b(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})\b/i.exec(
    texte,
  );
  if (francais?.[1] !== undefined && francais[2] !== undefined && francais[3] !== undefined) {
    return jourMoisAnnee(francais[1], francais[2], francais[3]);
  }

  const anglais = /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i.exec(
    texte,
  );
  if (anglais?.[1] !== undefined && anglais[2] !== undefined && anglais[3] !== undefined) {
    return jourMoisAnnee(anglais[1], anglais[2], anglais[3]);
  }

  const numerique = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(texte);
  if (numerique?.[1] !== undefined && numerique[2] !== undefined && numerique[3] !== undefined) {
    const jour = Number(numerique[1]);
    const mois = Number(numerique[2]);
    if (jour < 1 || jour > 31 || mois < 1 || mois > 12) return null;
    return `${numerique[3]}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  }
  return null;
}

/** Ramène une URL Wayback à l'URL d'origine qu'elle archive. */
export function normaliserUrlWayback(href: string): string {
  const absolu = /^https?:\/\/web\.archive\.org\/web\/[^/]+\/(https?:\/\/.*)$/i.exec(href);
  if (absolu?.[1] !== undefined) return absolu[1];
  const relatif = /^\/web\/[^/]+\/(https?:\/\/.*)$/i.exec(href);
  if (relatif?.[1] !== undefined) return relatif[1];
  const dejaResolu = /^https?:\/\/[^/]+\/web\/[^/]+\/(https?:\/\/.*)$/i.exec(href);
  return dejaResolu?.[1] ?? href;
}

/** Bloc HTML qui porte une ancre : article, item de liste, ou fenêtre de secours. */
function blocAutour(html: string, position: number): string {
  // Les listes Drupal datent la ligne entière dans `.views-row`, y compris
  // lorsqu'un lien « version adoptée » est placé dans une alerte voisine.
  const debutVue = html.lastIndexOf('<div class="views-row"', position);
  if (debutVue >= 0) {
    const finVue = html.indexOf('<div class="views-row"', position + 1);
    return html.slice(debutVue, finVue >= 0 ? finVue : Math.min(html.length, position + 4000));
  }
  const debut = Math.max(html.lastIndexOf("<article", position), html.lastIndexOf("<li", position));
  if (debut < 0) {
    return html.slice(Math.max(0, position - 2000), Math.min(html.length, position + 2000));
  }
  const fins = [html.indexOf("</article>", position), html.indexOf("</li>", position)].filter(
    (index) => index >= 0,
  );
  const fin = fins.length === 0 ? Math.min(html.length, position + 2000) : Math.min(...fins);
  return html.slice(debut, fin);
}

/** Vrai pour un libellé d'action qui ne nomme pas le document. */
function titreGenerique(titre: string): boolean {
  return /^(?:final version(?: of this publication)?|version finale(?: de cette publication)?|download|télécharger|read more|lire la suite|see more|en savoir plus|public consultation|consultation publique)$/i.test(
    titre.trim(),
  );
}

/**
 * Titre du document : le texte de l'ancre, son attribut `title`, ou le titre
 * de la ligne quand l'ancre n'est qu'un bouton « version finale ».
 */
function titreLisible(ancre: string, attributs: string, bloc: string): string {
  const texte = texteVisible(ancre);
  if (texte !== "" && !titreGenerique(texte)) return texte;
  const attribut = /\btitle=["']([^"']+)["']/i.exec(attributs)?.[1];
  if (attribut !== undefined) {
    const candidat = texteVisible(attribut);
    if (candidat !== "" && !titreGenerique(candidat)) return candidat;
  }
  const entete = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(bloc);
  if (entete !== null) {
    const candidat = texteVisible(entete[1] ?? "");
    if (candidat !== "") return candidat;
  }
  return texte;
}

/** Titre de secours déduit du slug quand l'ancre n'a pas de texte. */
function titreDepuisUrl(url: URL): string {
  const segment = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  return decodeURIComponent(segment)
    .replace(/\.(pdf|html?)$/i, "")
    .replace(/_(en|fr)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

/** Premier lien PDF d'un fragment HTML, normalisé, ou `null`. */
export function trouverLienPdf(html: string, pageUrl: string): string | null {
  const meta = /<meta\b[^>]*name=["']citation_pdf_url["'][^>]*content=["']([^"']+)["']/i.exec(html);
  const candidats: string[] = [];
  if (meta?.[1] !== undefined) candidats.push(meta[1]);
  const ancre = /<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/i.exec(html);
  if (ancre?.[1] !== undefined) candidats.push(ancre[1]);

  for (const candidat of candidats) {
    try {
      const url = new URL(normaliserUrlWayback(candidat), pageUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      return url.href;
    } catch {
      // Lien illisible : on essaie le suivant.
    }
  }
  return null;
}

export type OptionsExtraction = {
  /** Types retenus ; les cinq types du corpus par défaut. */
  types?: readonly TypeDocument[];
};

/**
 * Extrait les documents d'une page de liste. Les types viennent du
 * descripteur ; une page de consultation publique est ignorée.
 */
export function extraireDocuments(
  html: string,
  pageUrl: string,
  options: OptionsExtraction = {},
): DocumentListe[] {
  const documents = new Map<string, DocumentListe>();
  const types = new Set(options.types ?? TYPES_DOCUMENT);
  const motif = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi;
  for (let trouve = motif.exec(html); trouve !== null; trouve = motif.exec(html)) {
    const href = normaliserUrlWayback(trouve[1] ?? "");
    if (href.includes("/public-consultations/")) continue;
    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }
    const type = typeDepuisChemin(url.pathname);
    if (type === null || !types.has(type)) continue;
    const suffixe = /_(fr|en)$/i.exec(url.pathname)?.[1]?.toLowerCase();
    if (suffixe !== "fr" && suffixe !== "en") continue;
    url.hash = "";
    const bloc = blocAutour(html, trouve.index);
    const titre = titreLisible(trouve[2] ?? "", trouve[0], bloc) || titreDepuisUrl(url);
    if (titre === "") continue;

    const pdfUrl = url.pathname.toLowerCase().endsWith(".pdf") ? url.href : null;
    const document: DocumentListe = {
      type,
      url: url.href,
      titre,
      date: dateDansTexte(bloc),
      pdfUrl,
      langue: suffixe,
    };
    // Une même ligne peut être liée en français et en anglais : le français gagne.
    const cle = `${type}|${url.pathname.replace(/_(fr|en)$/i, "")}`;
    const existant = documents.get(cle);
    if (existant !== undefined && (existant.langue === "fr" || suffixe === "en")) continue;
    documents.set(
      cle,
      existant === undefined
        ? document
        : {
            ...document,
            titre: document.titre === "" ? existant.titre : document.titre,
            date: document.date ?? existant.date,
            pdfUrl: document.pdfUrl ?? existant.pdfUrl,
          },
    );
  }
  return [...documents.values()];
}

/** Délai par défaut, sans empêcher un test de l'écourter. */
function attendreMs(ms: number): Promise<void> {
  return new Promise((reussir) => setTimeout(reussir, ms));
}

/** Requête texte avec trois tentatives sur 429 et 503. */
export async function chargerTexte(url: string, options: OptionsHttp = {}): Promise<string> {
  const fetchImpl =
    options.fetchHtml ??
    ((adresse: string) =>
      fetchAgent(adresse, "text/html,application/xml;q=0.9,*/*;q=0.8") as unknown as ReturnType<
        FetchHtml
      >);
  const tentatives = options.tentatives ?? 3;
  const delai = options.delaiMs ?? 2000;
  const attendre = options.attendre ?? attendreMs;
  const via = options.via ?? "direct";
  let statut: number | string = "réseau";

  for (let tentative = 1; tentative <= tentatives; tentative += 1) {
    const reponse = await fetchImpl(url);
    statut = reponse.status;
    options.journal?.push({ via, url, tentative, statut });
    if (reponse.ok) return reponse.text();
    if (reponse.status !== 429 && reponse.status !== 503) {
      throw new ErreurHttp(url, reponse.status, tentative);
    }
    if (tentative < tentatives) await attendre(delai * 2 ** (tentative - 1));
  }
  throw new ErreurHttp(url, statut, tentatives);
}

/** Requête JSON avec trois tentatives sur 429 et 503. */
async function chargerJson(url: string, options: OptionsHttp = {}): Promise<unknown> {
  const fetchImpl =
    options.fetchJson ??
    ((adresse: string) =>
      fetchAgent(adresse, "application/json") as unknown as ReturnType<FetchJson>);
  const tentatives = options.tentatives ?? 3;
  const delai = options.delaiMs ?? 2000;
  const attendre = options.attendre ?? attendreMs;
  let statut: number | string = "réseau";

  for (let tentative = 1; tentative <= tentatives; tentative += 1) {
    const reponse = await fetchImpl(url);
    statut = reponse.status;
    options.journal?.push({ via: "wayback", url, tentative, statut });
    if (reponse.ok) return reponse.json();
    if (reponse.status !== 429 && reponse.status !== 503) {
      throw new ErreurHttp(url, reponse.status, tentative);
    }
    if (tentative < tentatives) await attendre(delai * 2 ** (tentative - 1));
  }
  throw new ErreurHttp(url, statut, tentatives);
}

/** Interroge l'API de disponibilité Wayback, avec les mêmes reprises. */
export async function snapshotWayback(
  url: string,
  descripteur: Pick<DescripteurCePd, "url_wayback_api">,
  options: OptionsHttp = {},
): Promise<string | null> {
  const api = `${descripteur.url_wayback_api}?url=${encodeURIComponent(url)}`;
  const brut = (await chargerJson(api, options)) as {
    archived_snapshots?: { closest?: { available?: boolean; url?: string } };
  };
  const proche = brut.archived_snapshots?.closest;
  if (proche?.available === true && typeof proche.url === "string") return proche.url;
  return null;
}

/**
 * Instantanés connus d'une URL, du plus récent au plus ancien. La liste de
 * disponibilité ne rend que le plus proche, qui peut être une page refondue
 * sans document ; l'index CDX permet d'essayer les versions antérieures.
 */
export async function instantanesWayback(
  url: string,
  descripteur: Pick<DescripteurCePd, "url_wayback_cdx">,
  options: OptionsHttp = {},
  limite = 12,
): Promise<string[]> {
  const api =
    `${descripteur.url_wayback_cdx}?url=${encodeURIComponent(url)}` +
    `&output=json&filter=statuscode:200&fl=timestamp,original` +
    `&collapse=timestamp:8&limit=${limite}&sort=reverse`;
  const brut = await chargerJson(api, options);
  if (!Array.isArray(brut)) return [];
  const urls: string[] = [];
  for (const ligne of brut.slice(1)) {
    if (!Array.isArray(ligne)) continue;
    const [timestamp, original] = ligne;
    if (typeof timestamp !== "string" || typeof original !== "string") continue;
    urls.push(`https://web.archive.org/web/${timestamp}/${original}`);
  }
  return urls;
}

/** URL de la page `page` de la liste ; la première page garde l'URL déclarée. */
export function urlPage(base: string, page: number, pageDebut: number): string {
  if (page === pageDebut) return base;
  const separateur = base.includes("?") ? "&" : "?";
  return `${base}${separateur}page=${page}`;
}

function fusionner(
  cible: Map<string, DocumentListe>,
  documents: DocumentListe[],
): number {
  let nouveaux = 0;
  for (const document of documents) {
    if (cible.has(document.url)) continue;
    cible.set(document.url, document);
    nouveaux += 1;
  }
  return nouveaux;
}

/** Parcourt les pages de la liste directe. */
export async function listerDocuments(
  descripteur: DescripteurCePd,
  options: OptionsHttp & { pageMax?: number } = {},
): Promise<ResultatListe> {
  const journal = options.journal ?? [];
  const documents = new Map<string, DocumentListe>();
  const pageMax = options.pageMax ?? descripteur.page_max;
  const extraction = { types: descripteur.types };
  let pages = 0;

  for (let page = descripteur.page_debut; page <= pageMax; page += 1) {
    const url = urlPage(descripteur.url_liste, page, descripteur.page_debut);
    let html: string;
    try {
      html = await chargerTexte(url, { ...options, journal, via: "direct" });
    } catch (error) {
      if (error instanceof ErreurHttp && error.statut === 404 && page > descripteur.page_debut) {
        break;
      }
      throw error;
    }
    pages += 1;
    const trouves = extraireDocuments(html, url, extraction);
    if (trouves.length === 0) break;
    if (fusionner(documents, trouves) === 0) break;
  }

  if (documents.size === 0) {
    throw new ErreurHttp(descripteur.url_liste, "aucun document", 0);
  }
  return {
    documents: [...documents.values()],
    pages,
    via: "direct",
    sitemapPages: [],
    tentatives: journal,
  };
}

/**
 * Parcourt la même liste par le Wayback Machine : la liste et les pages de
 * documents peuvent être archivées. Les URL rendues restent celles du CEPD,
 * pour que les PDF soient ensuite cherchés à leur adresse d'origine.
 */
export async function listerDocumentsWayback(
  descripteur: DescripteurCePd,
  options: OptionsHttp & { pageMax?: number } = {},
): Promise<ResultatListe> {
  const journal = options.journal ?? [];
  const documents = new Map<string, DocumentListe>();
  const pageMax = options.pageMax ?? descripteur.page_max;
  const extraction = { types: descripteur.types };
  let pages = 0;

  for (let page = descripteur.page_debut; page <= pageMax; page += 1) {
    const original = urlPage(descripteur.url_liste, page, descripteur.page_debut);
    let snapshots = await instantanesWayback(original, descripteur, { ...options, journal });
    if (snapshots.length === 0) {
      const proche = await snapshotWayback(original, descripteur, { ...options, journal });
      if (proche !== null) snapshots = [proche];
    }

    let html: string | null = null;
    for (const snapshot of snapshots) {
      try {
        const contenu = await chargerTexte(snapshot, {
          ...options,
          journal,
          via: "wayback",
        });
        if (extraireDocuments(contenu, original, extraction).length > 0) {
          html = contenu;
          break;
        }
      } catch (error) {
        if (
          error instanceof ErreurHttp &&
          (error.statut === 404 || error.statut === 503)
        ) {
          continue;
        }
        throw error;
      }
    }

    if (html === null) {
      if (page === descripteur.page_debut) {
        throw new ErreurHttp(original, "aucun instantané avec documents", 0);
      }
      break;
    }
    pages += 1;
    const trouves = extraireDocuments(html, original, extraction);
    if (fusionner(documents, trouves) === 0) break;
  }

  if (documents.size === 0) {
    throw new ErreurHttp(descripteur.url_liste, "aucun document Wayback", 0);
  }
  return {
    documents: [...documents.values()],
    pages,
    via: "wayback",
    sitemapPages: [],
    tentatives: journal,
  };
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((trouve) => (trouve[1] ?? "").trim());
}

/** Numéro EDPB porté par une URL liée, par exemple `guidelines-052020` → `05/2020`. */
export function numeroDepuisUrlG29(url: string): string | null {
  let chemin: string;
  try {
    chemin = new URL(url).pathname;
  } catch {
    return null;
  }
  const trouve = /(?:guidelines?|recommendations?)[-_]?(\d{1,2})[-_]?(\d{4})/i.exec(chemin);
  if (trouve?.[1] === undefined || trouve[2] === undefined) return null;
  return `${String(Number(trouve[1])).padStart(2, "0")}/${trouve[2]}`;
}

/**
 * Lit la page d'endossement du G29 : chaque ligne nomme un document du groupe
 * Article 29 et pointe la page du CEPD ou l'archive de la Commission. Le
 * corpus ne reprend que les documents servis par le CEPD ; les autres sont
 * consignés avec leur hébergement.
 */
export function listerDocumentsG29(html: string, pageUrl: string): DocumentG29Liste[] {
  const documents = new Map<string, DocumentG29Liste>();
  // La page liste chaque document dans un `<li>` ; le numéro WP est parfois
  // dans un `<strong>` et le lien pointe son successeur EDPB. Lire le bloc
  // entier garde le numéro WP et la cible réelle.
  const motif = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  for (const bloc of html.matchAll(motif)) {
    const contenu = bloc[1] ?? "";
    const complet = texteVisible(contenu).replace(/\s+/g, " ").trim();
    if (complet === "" || complet.length > 600) continue;
    if (/endorsement of gdpr|legacy|read more|télécharger|download/i.test(complet)) continue;
    // `WP251rev.01` n'a pas de frontière après les chiffres.
    const wp = /\bwp\s?(\d{2,4})(?!\d)/i.exec(complet)?.[1];
    const reconnu =
      /^(?:guidelines?|recommendations?|position paper|working document|adequacy referential)\b/i.test(
        complet,
      );
    if (wp === undefined && !reconnu) continue;
    const ancre = /<a\b[^>]*href=["']([^"']+)["']/i.exec(contenu);
    let url: URL;
    try {
      url = new URL(normaliserUrlWayback(ancre?.[1] ?? pageUrl), pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const hote = url.hostname.toLowerCase();
    const hebergement: HebergementG29 = hote.endsWith("edpb.europa.eu")
      ? "cepd"
      : hote.endsWith("ec.europa.eu") || hote.endsWith("europa.eu")
        ? "commission"
        : "autre";
    const titre = (complet.split(/\bsuperseded by\b/i)[0] ?? complet).trim();
    const document: DocumentG29Liste = {
      titre,
      url: url.href,
      wp: wp === undefined ? null : `WP${String(Number(wp))}`,
      numero: numeroDepuisUrlG29(url.href),
      hebergement,
    };
    const cle = document.wp ?? titre.toLowerCase();
    if (!documents.has(cle)) documents.set(cle, document);
  }
  return [...documents.values()];
}

/**
 * Source primaire : l'index de sitemaps, puis ses pages 1 à 5. Les URL `_fr`
 * et `_en` des quatre rubriques retenues sont lues, regroupées par document :
 * la page française gagne quand elle existe, l'anglaise sert de repli. Les
 * autres langues et les autres rubriques sont écartées. Les pages n'ont ni
 * titre ni date : le document est enrichi ensuite depuis sa page.
 */
export async function listerDocumentsSitemap(
  descripteur: DescripteurCePd,
  options: OptionsHttp = {},
): Promise<ResultatListe> {
  const journal = options.journal ?? [];
  let pagesSitemap: string[] = [];

  try {
    const index = await chargerTexte(descripteur.url_sitemap, {
      ...options,
      journal,
      via: "direct",
    });
    pagesSitemap = locs(index).filter((url) => /[?&]page=\d+/.test(url));
  } catch (error) {
    if (!(error instanceof ErreurHttp)) throw error;
  }

  if (pagesSitemap.length === 0) {
    pagesSitemap = Array.from(
      { length: descripteur.pages_sitemap },
      (_, index) => `${descripteur.url_sitemap}?page=${index + 1}`,
    );
  }

  const types = new Set(descripteur.types);
  const groupes = new Map<string, { url: string; type: TypeDocument; langue: LanguePage }>();
  for (const pageUrl of pagesSitemap) {
    const xml = await chargerTexte(pageUrl, { ...options, journal, via: "direct" });
    for (const loc of locs(xml)) {
      let url: URL;
      try {
        url = new URL(loc);
      } catch {
        continue;
      }
      const type = typeDepuisChemin(url.pathname);
      const langue = /_(fr|en)$/i.exec(url.pathname)?.[1]?.toLowerCase();
      if (
        type === null ||
        !types.has(type) ||
        (langue !== "fr" && langue !== "en")
      ) {
        continue;
      }
      url.hash = "";
      const base = url.pathname.replace(/_(fr|en)$/i, "");
      const cle = `${type}|${base}`;
      const existant = groupes.get(cle);
      // La version française gagne ; une `_en` déjà vue ne la remplace pas.
      if (existant !== undefined && (existant.langue === "fr" || langue === "en")) continue;
      groupes.set(cle, { url: url.href, type, langue });
    }
  }

  const documents = new Map<string, DocumentListe>();
  for (const { url, type, langue } of groupes.values()) {
    documents.set(url, { type, url, titre: "", date: null, pdfUrl: null, langue });
  }

  if (documents.size === 0) {
    throw new ErreurHttp(
      descripteur.url_sitemap,
      `aucun document ${descripteur.langue.toLowerCase()} ou en`,
      0,
    );
  }
  return {
    documents: [...documents.values()],
    pages: pagesSitemap.length,
    via: "sitemap",
    sitemapPages: pagesSitemap,
    tentatives: journal,
  };
}
