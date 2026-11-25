/**
 * Liste les documents de doctrine depuis les pages de référence de cnil.fr.
 *
 * Une page de référence déclare son type (`guide`, `referentiel`, `liste_aipd`,
 * `fiche_ia`) et la façon dont elle liste ses documents : des PDF directs, des
 * pages qui portent elles-mêmes le PDF, ou des fiches rangées ligne par ligne
 * avec leur libellé et leur titre. Les pages de résultats sont parcourues par
 * `?page=N` jusqu'à ce qu'elles ne rendent plus rien de nouveau. Seuls les liens
 * de la zone de contenu sont retenus : la navigation, les étiquettes et les
 * médiathèques ne sont pas des documents.
 */

import { readFileSync } from "node:fs";
import { decoderEntites, texteVisible } from "../parse.ts";
import { chevauchement } from "./parse.ts";

/**
 * Texte d'un intitulé : balises retirées, entités décodées, blancs normalisés.
 * `texteVisible` resserre aussi la ponctuation (« d’IA: »), ce qui altérerait
 * l'intitulé officiel ; un titre garde donc ses espaces.
 */
function titreVisible(fragment: string): string {
  return decoderEntites(fragment.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Type de doctrine retenu. */
export type TypeDoctrine = "guide" | "referentiel" | "liste_aipd" | "fiche_ia" | "doctrine_ia";

/** Comment une page de référence expose ses documents. */
export type ModeLiens = "pdf" | "page" | "fiches" | "urls";

/**
 * Un document déclaré en liste explicite : sa page, ou son PDF, et le PDF
 * officiel qui porte son texte quand la page ne sert qu'à le présenter.
 */
export type DocumentExplicite = LienDocument & { pdf?: string };

/** Une page de référence déclarée au descripteur. */
export type PageReference = {
  type: TypeDoctrine;
  /** Page consultée ; pour `liens: "urls"`, la rubrique qui a établi la liste. */
  url: string;
  /** Nombre de pages de résultats essayées au plus. */
  pages_max: number;
  liens: ModeLiens;
  /** Motif du chemin d'une page de document, pour `liens: "page"`. */
  motif_page?: string;
  /** Motif du nom de fichier PDF retenu, tous modes confondus. */
  motif_pdf?: string;
  /** Documents d'une liste explicite, pour `liens: "urls"`. */
  urls?: DocumentExplicite[];
  /** Une page ou un PDF plus court que ce seuil est déclaré et non retenu. */
  seuil_lettres?: number;
  /** Nombre de documents retenus au plus ; les autres sont déclarés. */
  plafond?: number;
};

/** Un document écarté avant même d'être lu, déclaré au descripteur. */
export type DocumentEcartDeclare = {
  url: string;
  titre: string;
  raison: string;
};

export type DescripteurDoctrine = {
  corpus: string;
  nom: string;
  titre: string;
  domaine: string;
  source: string;
  /** Préfixe de la ligne de licence ; la licence du document la complète. */
  mention: string;
  licence: string;
  licence_url: string;
  /** Durée de validité du cache des PDF, en jours ; `--refresh` la ramène à zéro. */
  validite_jours: number;
  tentatives: number;
  delai_ms: number;
  pages_reference: PageReference[];
  /** Pages ou PDF examinés puis écartés, avec leur motif, hors des pages de référence. */
  documents_ecartes?: DocumentEcartDeclare[];
};

/** Réponse texte minimale d'un `fetch`, injectable en test. */
export type FetchHtml = (url: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** Réponse binaire minimale d'un `fetch`, injectable en test. */
export type FetchPdf = (url: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

/** Un lien retenu sur une page de référence, avec son intitulé. */
export type LienDocument = {
  url: string;
  titre: string;
};

/** Erreur HTTP qui porte l'URL et le statut. */
export class ErreurHttp extends Error {
  readonly url: string;
  readonly statut: number | string;

  constructor(url: string, statut: number | string) {
    super(`${url} : HTTP ${statut}`);
    this.name = "ErreurHttp";
    this.url = url;
    this.statut = statut;
  }
}

/** Contenu de la zone principale d'une page : `<main>` quand elle existe. */
function zonePrincipale(html: string): string {
  const main = /<main\b[\s\S]*?<\/main>/i.exec(html);
  if (main !== null) return main[0];
  const article = /<article\b[\s\S]*?<\/article>/i.exec(html);
  return article === null ? html : article[0];
}

/** URL absolue sans fragment, ou `null` si elle n'est pas http(s). */
export function urlAbsolue(brut: string, base: string): string | null {
  try {
    const url = new URL(brut, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

/** Nom de fichier d'une URL, décodé. */
export function nomFichier(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "");
  } catch {
    return "";
  }
}

/** Vrai si l'URL appartient au domaine déclaré, avec ou sans `www`. */
export function estDomaine(url: string, domaine: string): boolean {
  try {
    const hote = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const attendu = domaine.toLowerCase().replace(/^www\./, "");
    return hote === attendu || hote.endsWith(`.${attendu}`);
  } catch {
    return false;
  }
}

/** Vrai si le lien est un PDF servi par le domaine déclaré (avec ou sans `www`). */
export function estPdf(url: string, domaine: string): boolean {
  if (!estDomaine(url, domaine)) return false;
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/**
 * PDF préféré quand le même fichier est servi sous `/sites/cnil/files/` et
 * `/sites/default/files/` : le chemin générique reste stable.
 */
function preferencePdf(url: string): number {
  return new URL(url).pathname.includes("/sites/default/files/") ? 0 : 1;
}

/** Une ancre de la zone principale, son texte, son attribut `title` et son bloc. */
type Ancre = { url: string; texte: string; titre: string };

function ancres(html: string, pageUrl: string): Ancre[] {
  const zone = zonePrincipale(html);
  const liens: Ancre[] = [];
  const motif = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  for (let trouve = motif.exec(zone); trouve !== null; trouve = motif.exec(zone)) {
    const attributs = trouve[1] ?? "";
    const url = urlAbsolue(/href=["']([^"']+)["']/i.exec(attributs)?.[1] ?? "", pageUrl);
    if (url === null) continue;
    const texte = texteVisible(trouve[2] ?? "").replace(/\s+/g, " ").trim();
    const titre = texteVisible(/title=["']([^"']*)["']/i.exec(attributs)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    liens.push({ url, texte, titre });
  }
  return liens;
}

/** Vrai pour un lien de navigation qui ne désigne pas un document. */
function lienDeNavigation(url: string, pageUrl: string): boolean {
  const chemin = new URL(url).pathname;
  if (chemin === "/fr" || chemin === "/fr/" || chemin === "/") return true;
  if (chemin.startsWith("/fr/tag/")) return true;
  if (chemin.startsWith("/fr/mediatheque") && !chemin.endsWith(".pdf")) return true;
  if (chemin.startsWith("/fr/actualites/")) return true;
  return url.split("#")[0] === pageUrl.split("#")[0];
}

/**
 * Fiches listées par une page de référence, reconnues à leurs lignes : chaque
 * document y porte un libellé (`Fiche 3`, `Fiche 8 bis`, `Introduction`,
 * `Liste de vérification`) et le lien de sa page ou de son PDF. Un lien qui ne
 * mène pas au domaine déclaré n'est pas une fiche.
 */
export function extraireFiches(
  html: string,
  pageUrl: string,
  domaine: string,
): { pdfs: LienDocument[]; pages: LienDocument[] } {
  const zone = zonePrincipale(html);
  const pdfs = new Map<string, LienDocument>();
  const pages = new Map<string, LienDocument>();
  const etiquettes = [...zone.matchAll(/<p\b[^>]*class=["'][^"']*\bnumber\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi)];

  for (let index = 0; index < etiquettes.length; index += 1) {
    const etiquette = etiquettes[index];
    if (etiquette === undefined || etiquette.index === undefined) continue;
    const debut = etiquette.index;
    const fin = etiquettes[index + 1]?.index ?? zone.length;
    const ligne = zone.slice(debut, fin);
    const libelle = texteVisible(etiquette[1] ?? "").replace(/\s+/g, " ").trim();
    const href = /<a\b[^>]*href=["']([^"']+)["']/i.exec(ligne)?.[1];
    if (href === undefined) continue;
    const url = urlAbsolue(href, pageUrl);
    if (url === null || !estDomaine(url, domaine)) continue;
    const titre =
      titreVisible(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(ligne)?.[1] ?? "") ||
      titreVisible(/<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(ligne)?.[1] ?? "") ||
      libelle;
    if (titre === "") continue;
    if (estPdf(url, domaine)) {
      if (!pdfs.has(url)) pdfs.set(url, { url, titre });
    } else if (!pages.has(url)) {
      pages.set(url, { url, titre });
    }
  }

  // Chaque libellé de la page est un document : un libellé sans lien ou hors
  // domaine signale que le balisage a changé, et aucune fiche ne doit
  // disparaître en silence.
  if (pages.size + pdfs.size < etiquettes.length) {
    throw new Error(
      `Fiches listées non reconnues : ${etiquettes.length} libellé(s) pour ` +
        `${pages.size + pdfs.size} document(s) — la page de référence a changé ?`,
    );
  }

  return { pdfs: [...pdfs.values()], pages: [...pages.values()] };
}

/** Jetons communs exigés entre l'intitulé de la fiche et celui de son PDF. */
const SEUIL_PDF_FICHE = 3;

/**
 * PDF officiel de la même fiche, quand la page en publie une version. Le lien
 * porte la mention « Consulter la version PDF » et un `title` qui reprend
 * l'intitulé du document ; le rapprochement des intitulés évite de prendre le
 * schéma d'une autre fiche ou d'une fiche voisine pour la version de celle-ci.
 */
export function pdfVersionFiche(
  html: string,
  pageUrl: string,
  domaine: string,
  titre: string,
): LienDocument | null {
  for (const ancre of ancres(html, pageUrl)) {
    if (!estPdf(ancre.url, domaine)) continue;
    if (!/^consulter\s+la\s+version\s+pdf/i.test(ancre.texte)) continue;
    if (chevauchement(titre, ancre.titre) < SEUIL_PDF_FICHE) continue;
    return { url: ancre.url, titre };
  }
  return null;
}

/**
 * Documents listés par une page de référence.
 *
 * `liens: "pdf"` retient les PDF de la page. `liens: "page"` retient les pages
 * dont le chemin ou l'intitulé porte `motif_page` ; leurs PDF sont lus ensuite.
 * `liens: "fiches"` retient les fiches rangées par libellé, pages ou PDF.
 * Un PDF dont le nom ne porte pas `motif_pdf` (quand il est déclaré) est écarté.
 */
export function extraireDocuments(
  html: string,
  pageUrl: string,
  reference: PageReference,
  domaine: string,
): { pdfs: LienDocument[]; pages: LienDocument[] } {
  if (reference.liens === "fiches") return extraireFiches(html, pageUrl, domaine);
  if (reference.liens === "urls") return { pdfs: [], pages: [] };
  const pdfs = new Map<string, LienDocument>();
  const pages = new Map<string, LienDocument>();
  const motifPage =
    reference.motif_page === undefined ? null : new RegExp(reference.motif_page, "i");
  const motifPdf =
    reference.motif_pdf === undefined ? null : new RegExp(reference.motif_pdf, "i");

  for (const ancre of ancres(html, pageUrl)) {
    if (estPdf(ancre.url, domaine)) {
      const nom = nomFichier(ancre.url);
      if (motifPdf !== null && !motifPdf.test(nom)) continue;
      if (ancre.texte === "") continue;
      const existant = pdfs.get(nom);
      if (existant === undefined || preferencePdf(ancre.url) < preferencePdf(existant.url)) {
        pdfs.set(nom, { url: ancre.url, titre: ancre.texte });
      }
      continue;
    }
    if (reference.liens !== "page" || lienDeNavigation(ancre.url, pageUrl) || ancre.texte === "") {
      continue;
    }
    // Une page de document vient du même domaine que ses PDF : une page tierce
    // ne doit pas faire entrer un document dans le corpus.
    if (!estDomaine(ancre.url, domaine)) continue;
    const motif = motifPage ?? /aipd/i;
    if (!motif.test(new URL(ancre.url).pathname) && !motif.test(ancre.texte)) continue;
    if (!pages.has(ancre.url)) pages.set(ancre.url, { url: ancre.url, titre: ancre.texte });
  }

  return { pdfs: [...pdfs.values()], pages: [...pages.values()] };
}

/** URL de la page `page` de résultats ; la première garde l'URL déclarée. */
export function urlPage(base: string, page: number): string {
  if (page === 0) return base;
  const separateur = base.includes("?") ? "&" : "?";
  return `${base}${separateur}page=${page}`;
}

function attendreMs(ms: number): Promise<void> {
  return new Promise((reussir) => setTimeout(reussir, ms));
}

export type OptionsHttp = {
  fetchHtml?: FetchHtml;
  fetchPdf?: FetchPdf;
  tentatives?: number;
  delaiMs?: number;
  /** Attente avant chaque requête, pour ne pas marteler la source. */
  pauseEntreMs?: number;
  /** Attente injectable : les tests la remplacent par une fonction vide. */
  attendre?: (ms: number) => Promise<void>;
  /** En-tête `User-Agent` envoyé aux deux types de requête. */
  userAgent?: string;
};

const AGENT_PAR_DEFAUT = "vitrine/0.1 (veille juridique; +https://github.com/Beccariavf/vitrine)";

/** Requête HTTP avec reprise sur 429 et 503 et délai entre deux essais. */
async function requete<T>(
  url: string,
  options: OptionsHttp,
  demander: (url: string, agent: string) => Promise<T>,
  statutDe: (reponse: T) => number,
  estOk: (reponse: T) => boolean,
): Promise<T> {
  const tentatives = Math.max(1, options.tentatives ?? 3);
  const delai = options.delaiMs ?? 1000;
  const attendre = options.attendre ?? attendreMs;
  const agent = options.userAgent ?? AGENT_PAR_DEFAUT;
  let statut = 0;

  for (let tentative = 1; tentative <= tentatives; tentative += 1) {
    const reponse = await demander(url, agent);
    statut = statutDe(reponse);
    if (estOk(reponse)) return reponse;
    if (statut !== 429 && statut !== 503) break;
    if (tentative < tentatives) await attendre(delai * 2 ** (tentative - 1));
  }
  throw new ErreurHttp(url, statut);
}

/** Charge une page HTML, avec reprise sur 429 et 503. */
export async function chargerTexte(url: string, options: OptionsHttp = {}): Promise<string> {
  const pause = options.pauseEntreMs ?? 0;
  if (pause > 0) await (options.attendre ?? attendreMs)(pause);
  const fetchImpl = options.fetchHtml ?? (fetch as unknown as FetchHtml);
  const reponse = await requete(
    url,
    options,
    (adresse, agent) => fetchImpl(adresse, { headers: { "user-agent": agent } }),
    (valeur) => valeur.status,
    (valeur) => valeur.ok,
  );
  return reponse.text();
}

/** Télécharge un PDF et vérifie sa signature. */
export async function chargerPdf(
  url: string,
  options: OptionsHttp = {},
): Promise<Uint8Array> {
  const pause = options.pauseEntreMs ?? 0;
  if (pause > 0) await (options.attendre ?? attendreMs)(pause);
  const fetchImpl = options.fetchPdf ?? (fetch as unknown as FetchPdf);
  const reponse = await requete(
    url,
    options,
    (adresse, agent) => fetchImpl(adresse, { headers: { "user-agent": agent } }),
    (valeur) => valeur.status,
    (valeur) => valeur.ok,
  );
  const octets = new Uint8Array(await reponse.arrayBuffer());
  if (
    octets.length < 5 ||
    octets[0] !== 0x25 ||
    octets[1] !== 0x50 ||
    octets[2] !== 0x44 ||
    octets[3] !== 0x46 ||
    octets[4] !== 0x2d
  ) {
    throw new Error(`${url} : le fichier téléchargé n'est pas un PDF`);
  }
  return octets;
}

/** Parcourt les pages de résultats d'une page de référence. */
export async function parcourirReference(
  reference: PageReference,
  domaine: string,
  options: OptionsHttp = {},
): Promise<{
  pdfs: LienDocument[];
  pages: LienDocument[];
  documents: DocumentExplicite[];
  pagesLues: number;
}> {
  if (reference.liens === "urls") {
    const documents = documentsExplicites(reference, domaine);
    return { pdfs: [], pages: [], documents, pagesLues: 0 };
  }
  const pdfs = new Map<string, LienDocument>();
  const pages = new Map<string, LienDocument>();
  let pagesLues = 0;

  for (let page = 0; page < Math.max(1, reference.pages_max); page += 1) {
    const adresse = urlPage(reference.url, page);
    let html: string;
    try {
      html = await chargerTexte(adresse, options);
    } catch (error) {
      // Une page de résultats au-delà de la première peut manquer : la liste s'arrête.
      if (page > 0 && error instanceof ErreurHttp) break;
      throw error;
    }
    pagesLues += 1;
    const trouves = extraireDocuments(html, adresse, reference, domaine);
    let nouveaux = 0;
    for (const pdf of trouves.pdfs) {
      const cle = nomFichier(pdf.url);
      if (!pdfs.has(cle)) {
        pdfs.set(cle, pdf);
        nouveaux += 1;
      }
    }
    for (const document of trouves.pages) {
      if (!pages.has(document.url)) {
        pages.set(document.url, document);
        nouveaux += 1;
      }
    }
    if (nouveaux === 0) break;
  }

  return { pdfs: [...pdfs.values()], pages: [...pages.values()], documents: [], pagesLues };
}

/**
 * Documents d'une liste explicite : URL rendue absolue, domaine vérifié,
 * première occurrence gardée. Le PDF officiel éventuel est vérifié de même.
 * Une liste vide ou une URL hors domaine lève plutôt que de perdre un document.
 */
export function documentsExplicites(
  reference: PageReference,
  domaine: string,
): DocumentExplicite[] {
  const declares = reference.urls ?? [];
  if (declares.length === 0) {
    throw new Error(`Liste explicite vide pour « ${reference.url} »`);
  }
  const documents = new Map<string, DocumentExplicite>();
  for (const declare of declares) {
    const url = urlAbsolue(declare.url, reference.url);
    if (url === null || !estDomaine(url, domaine)) {
      throw new Error(`Document hors du domaine ${domaine} : « ${declare.url} »`);
    }
    const titre = declare.titre.trim();
    if (titre === "") throw new Error(`Document sans intitulé : « ${declare.url} »`);
    if (documents.has(url)) continue;
    let pdf: string | undefined;
    if (declare.pdf !== undefined) {
      const absolu = urlAbsolue(declare.pdf, reference.url);
      if (absolu === null || !estDomaine(absolu, domaine) || !estPdf(absolu, domaine)) {
        throw new Error(`PDF hors du domaine ${domaine} : « ${declare.pdf} »`);
      }
      pdf = absolu;
    }
    documents.set(url, pdf === undefined ? { url, titre } : { url, titre, pdf });
  }
  return [...documents.values()];
}

/** Lit le descripteur de la doctrine CNIL. */
export function lireDescripteur(chemin: string): DescripteurDoctrine {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurDoctrine;
}
