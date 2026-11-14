import { XMLParser, XMLValidator } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Entry } from "../types.ts";
import { canonicalUrl, hashId } from "../normalize.ts";
import { toSummary } from "../summary.ts";
import { toIsoUtc } from "./cnil.ts";
import { chargerTexte, listerDocumentsSitemap } from "../../mcp/corpus/cepd/liste.ts";
import type { FetchHtml } from "../../mcp/corpus/cepd/liste.ts";
import {
  enrichirDocument,
  signatureVersion,
  slugDe,
  statutDocument,
} from "../../mcp/corpus/cepd/parse.ts";
import { lireDescripteur } from "../../mcp/corpus/cepd/sync.ts";
import { statutApplication } from "../../mcp/corpus/statut.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "cepd";

/** Flux d'actualités du Comité européen de la protection des données. */
export const FEED_URL = "https://www.edpb.europa.eu/feed/news_fr";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

type Unknown = Record<string, unknown>;

function isObject(value: unknown): value is Unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (isObject(value) && typeof value["#text"] === "string") return value["#text"].trim();
  return null;
}

const TRUSTED_HOSTS = new Set(["www.edpb.europa.eu", "edpb.europa.eu"]);

function assertTrustedLink(link: string, index: number): void {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new Error(`CEPD feed item #${index} has an unparsable link: ${link}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`CEPD feed item #${index} link is not https: ${link}`);
  }
  if (!TRUSTED_HOSTS.has(parsed.hostname)) {
    throw new Error(`CEPD feed item #${index} link leaves edpb.europa.eu: ${link}`);
  }
}

/** Transforme le flux CEPD en entrées normalisées. */
export function parseFeed(xml: string): Entry[] {
  const validity = XMLValidator.validate(xml);
  if (validity !== true) {
    throw new Error(`CEPD feed is not valid XML: ${validity.err.msg}`);
  }

  const document = parser.parse(xml) as unknown;
  const root = isObject(document) ? document["rss"] : undefined;
  const channel = isObject(root) ? root["channel"] : undefined;
  if (!isObject(channel)) {
    throw new Error("CEPD feed has no <rss><channel> root");
  }

  const rawItems = channel["item"];
  const items = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
  if (items.length === 0) {
    throw new Error("CEPD feed has no item");
  }

  const entries: Entry[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (!isObject(item)) {
      throw new Error(`CEPD feed item #${index} is not an element`);
    }

    const title = textOf(item["title"]);
    if (title === null || title === "") {
      throw new Error(`CEPD feed item #${index} has no title`);
    }

    const link = textOf(item["link"]);
    if (link === null || link === "") {
      throw new Error(`CEPD feed item #${index} has no link`);
    }
    assertTrustedLink(link, index);

    const url = canonicalUrl(link);
    if (seen.has(url)) return;
    seen.add(url);

    entries.push({
      id: hashId(url),
      title,
      officialTitle: title,
      url,
      publishedAt: toIsoUtc(textOf(item["pubDate"])),
      summary: toSummary(textOf(item["description"])),
      references: [],
      themes: [],
      source: SOURCE_ID,
    });
  });

  return entries;
}

/**
 * Veille des documents du CEPD, en plus du flux d'actualités.
 *
 * La liste, la reconnaissance des rubriques et l'enrichissement de page sont
 * ceux du corpus (#52) : `listerDocumentsSitemap` lit le sitemap, `slugDe` fixe
 * l'identité du document et `enrichirDocument` lit titre, date, version, PDF et
 * mention de consultation. Aucun PDF n'est téléchargé : le corpus reste la
 * source des textes, la veille ne fait que signaler ce qui n'y est pas encore.
 *
 * Un document absent du corpus est une nouveauté ; un document présent n'est
 * une nouveauté que si le sitemap l'a modifié depuis le corpus et que sa page
 * porte une autre signature de version (version explicite, sinon `finale` ou
 * `projet`). Un corpus pas encore resynchronisé (manifeste sans versions ou
 * sans `lastmod`) n'est pas comparé : la passe le dit et ne devine rien ; un
 * manifeste absent fait échouer la passe plutôt que de tout dire nouveau.
 */

/** Matière unique : le corpus ne retient que les documents sur les données personnelles. */
export const THEME = "donnees-personnelles";

/** Manifeste du corpus : il dit quels documents sont déjà entrés, dans quelle version. */
export const MANIFESTE = join("data", "corpus", "cepd", "manifest.json");

/** Descripteur du corpus, partagé avec `cepd:sync`. */
export const DESCRIPTEUR = fileURLToPath(
  new URL("../../mcp/corpus/cepd/descripteur.json", import.meta.url),
);

/** Lu du manifeste : les cartes par document, et les écarts déclarés au corpus. */
type ManifesteLu = {
  documents_types?: unknown;
  documents_versions?: unknown;
  documents_lastmod?: unknown;
  couverture?: { documents_ecartes?: unknown };
};

/** Lit le manifeste du corpus ; `null` s'il est absent ou illisible. */
export function lireManifeste(chemin: string): ManifesteLu | null {
  if (!existsSync(chemin)) return null;
  try {
    const valeur: unknown = JSON.parse(readFileSync(chemin, "utf8"));
    return typeof valeur === "object" && valeur !== null ? (valeur as ManifesteLu) : null;
  } catch {
    return null;
  }
}

/** Carte `document → chaîne ou null` d'un manifeste ; `null` quand la carte manque. */
function carteDeChaines(valeur: unknown): Record<string, string | null> | null {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return null;
  const carte: Record<string, string | null> = {};
  for (const [cle, element] of Object.entries(valeur)) {
    carte[cle] = typeof element === "string" ? element : null;
  }
  return carte;
}

/**
 * Slugs et URL des documents que le corpus a explicitement écartés. La veille
 * les ignore **tous**, y compris les écarts transitoires : l'entrée écrite quand
 * le document était neuf reste dans la fenêtre de `corpus:sync` et suffit à le
 * faire réessayer, tandis que re-signaler chaque semaine un document que le
 * corpus a délibérément laissé de côté serait du bruit.
 */
function ecartesDuManifeste(manifeste: ManifesteLu | null): Set<string> {
  const ecartes = new Set<string>();
  const tableau = manifeste?.couverture?.documents_ecartes;
  if (!Array.isArray(tableau)) return ecartes;
  for (const element of tableau) {
    if (typeof element !== "object" || element === null) continue;
    const { url, slug } = element as { url?: unknown; slug?: unknown };
    if (typeof slug === "string" && slug !== "") ecartes.add(slug);
    if (typeof url === "string" && url !== "") ecartes.add(url);
  }
  return ecartes;
}

/** Identifiant stable d'une entrée : adressé par le document et sa version. */
export function identifiantDeDocument(slug: string, version: string | null): string {
  return createHash("sha256")
    .update(`${SOURCE_ID}|${slug}|${version ?? ""}`, "utf8")
    .digest("hex")
    .slice(0, 16);
}

/** `<meta name="description">` de la page, nettoyée ; `null` si elle n'en porte pas. */
export function resumeDepuisPage(html: string): string | null {
  for (const balise of html.matchAll(/<meta\b[^>]*>/gi)) {
    const texte = balise[0];
    if (!/\bname\s*=\s*["']description["']/i.test(texte)) continue;
    const contenu = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(texte)?.[1];
    if (contenu === undefined || contenu.trim() === "") return null;
    return toSummary(contenu);
  }
  return null;
}

/** Titre de repli, lisible, déduit du slug quand la page n'en donne aucun. */
function titreDepuisSlug(slug: string): string {
  return slug.replace(/-/g, " ").trim();
}

export type PasseDocumentsOptions = {
  /** Racine du dépôt : le manifeste du corpus y est lu. */
  rootDir?: string;
  /** `fetch` de la veille, injectable ; le corpus fournit son user-agent par défaut. */
  fetchImpl?: FetchHtml;
  /** Attente injectable entre deux pages. */
  attendre?: (ms: number) => Promise<void>;
  /** Date de la passe : `publishedAt` des entrées. */
  maintenant?: Date;
  /** Descripteur injectable, utile aux tests hors d'un dépôt complet. */
  descripteurPath?: string;
};

export type ResultatPasseDocuments = {
  entries: Entry[];
  /** Pages illisibles uniquement. */
  warnings: string[];
  /** Lignes informatives, imprimées sans préfixe d'avertissement. */
  notes: string[];
};

/**
 * Une passe : le sitemap donne les documents, le manifeste du corpus dit
 * lesquels y sont déjà. Chaque candidat est lu une fois à sa page, sans PDF.
 */
export async function passeDocumentsCePd(
  options: PasseDocumentsOptions = {},
): Promise<ResultatPasseDocuments> {
  const rootDir = options.rootDir ?? process.cwd();
  const descripteur = lireDescripteur(options.descripteurPath ?? DESCRIPTEUR);
  const datePasse = (options.maintenant ?? new Date()).toISOString().slice(0, 10);
  const cheminManifeste = join(rootDir, MANIFESTE);
  const manifeste = lireManifeste(cheminManifeste);
  // Sans manifeste, tous les documents du sitemap seraient « nouveaux » : on
  // échoue fermé plutôt que de publier 341 faux positifs.
  if (manifeste === null) {
    throw new Error(
      `Manifeste CEPD absent ou illisible : ${cheminManifeste} (lancer cepd:sync)`,
    );
  }
  const presents = new Set(Object.keys(carteDeChaines(manifeste.documents_types) ?? {}));
  const versions = carteDeChaines(manifeste.documents_versions);
  const lastmods = carteDeChaines(manifeste.documents_lastmod);
  const ecartes = ecartesDuManifeste(manifeste);
  // Les deux cartes sont écrites ensemble par `cepd:sync` : l'une sans l'autre
  // dit un corpus pas encore resynchronisé, dont rien n'est comparable.
  const manifesteSansVersions = versions === null || lastmods === null;

  const http = {
    ...(options.fetchImpl === undefined ? {} : { fetchHtml: options.fetchImpl }),
    ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
    tentatives: descripteur.tentatives,
    delaiMs: descripteur.delai_ms,
  };
  const liste = await listerDocumentsSitemap(descripteur, http);
  const delai = descripteur.delai_entre_requetes_ms ?? 0;
  const attendre =
    options.attendre ??
    ((ms: number): Promise<void> => new Promise((reussir) => setTimeout(reussir, ms)));

  const entries: Entry[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  let candidats = 0;
  let ecartesCorpus = 0;
  let enConsultation = 0;
  let nonVerifies = 0;

  for (const document of liste.documents) {
    let slug: string;
    try {
      slug = slugDe(document.url);
    } catch {
      // Une URL sans slug n'a pas d'identité au corpus : elle ne peut rien produire.
      continue;
    }
    // Un document écarté par le corpus n'est pas une nouveauté : il ne revient
    // pas à chaque passe.
    if (ecartes.has(slug) || ecartes.has(document.url)) {
      ecartesCorpus += 1;
      continue;
    }

    const present = presents.has(slug);
    if (present) {
      if (manifesteSansVersions) {
        nonVerifies += 1;
        continue;
      }
      const lastmodManifeste = lastmods === null ? undefined : lastmods[slug];
      // Sans `lastmod` au manifeste, la page n'est pas relue : seule une
      // modification déclarée par le sitemap peut annoncer une nouvelle version.
      if (lastmodManifeste === undefined || lastmodManifeste === (document.lastmod ?? null)) {
        continue;
      }
    }

    candidats += 1;
    let html: string;
    try {
      html = await chargerTexte(document.url, http);
    } catch (error) {
      const raison = error instanceof Error ? error.message : String(error);
      warnings.push(`${SOURCE_ID} page ${document.url}: ${raison}`);
      if (delai > 0) await attendre(delai);
      continue;
    }
    if (delai > 0) await attendre(delai);

    const enrichi = enrichirDocument(document, html);
    const statut = statutDocument(enrichi);
    const signature = signatureVersion({ version: enrichi.version ?? null, statut });
    // Un document déjà au corpus dans le même état n'est pas une nouveauté.
    if (present && versions !== null) {
      const versionCorpus = versions[slug];
      if (versionCorpus !== undefined && versionCorpus === signature) continue;
    }

    const consultation = statutApplication("cepd", statut) === "propose";
    if (consultation) enConsultation += 1;
    const titre = enrichi.titre === "" ? titreDepuisSlug(slug) : enrichi.titre;
    entries.push({
      id: identifiantDeDocument(slug, signature),
      title: titre,
      officialTitle: titre,
      url: document.url,
      publishedAt: `${datePasse}T12:00:00.000Z`,
      summary: resumeDepuisPage(html),
      references: [],
      themes: [THEME],
      source: SOURCE_ID,
      document: slug,
      type: enrichi.type,
      ...(enrichi.date === null ? {} : { date_acte: enrichi.date }),
      version: signature,
      ...(consultation ? { consultation: true } : {}),
    });
  }

  notes.push(
    `${SOURCE_ID} : ${liste.documents.length} document(s) listé(s), ` +
      (ecartesCorpus > 0 ? `${ecartesCorpus} écarté(s) par le corpus, ` : "") +
      `${candidats} candidat(s), ${entries.length} entrée(s) de veille, ` +
      `${enConsultation} en consultation`,
  );
  if (manifesteSansVersions && nonVerifies > 0) {
    notes.push(
      `${SOURCE_ID} : manifeste sans versions (relancer cepd:sync), ` +
        `${nonVerifies} document(s) non vérifié(s)`,
    );
  }

  return { entries, warnings, notes };
}
