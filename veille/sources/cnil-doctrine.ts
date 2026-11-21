/**
 * Veille de la doctrine de la CNIL : guides, référentiels, fiches IA et listes AIPD.
 *
 * La source relit les pages de référence déclarées au descripteur par la même
 * reconnaissance que le corpus `cnil_doctrine` (#54) — `liste.ts`, réutilisé en
 * import — et compare ce qu'elle y trouve au manifeste du corpus. Les PDF ne
 * sont jamais téléchargés : seule leur URL dit qu'un document existe.
 *
 * Une publication nouvelle est un document absent du manifeste ; une publication
 * modifiée garde son intitulé mais change de fichier (les guides CNIL sont
 * réédités sous un nouveau PDF, dans un dossier daté). Un document déjà couvert
 * par une délibération du corpus `cnil`, ou écarté par la synchronisation, ne
 * produit aucune entrée. Aucun résumé : l'intitulé seul est repris, le régime
 * CC BY-ND interdisant toute reformulation.
 *
 * Limite déclarée : les pages de référence ne portent aucune date par document,
 * et la veille ne lit pas les PDF. Une réédition servie sous la même URL n'est
 * donc pas détectable ici ; `cnil-doctrine:sync` la voit à la synchronisation
 * suivante, par le contenu.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chargerTexte, extraireDocuments, lireDescripteur, parcourirReference } from "../../mcp/corpus/cnil-doctrine/liste.ts";
import type {
  DescripteurDoctrine,
  FetchHtml,
  LienDocument,
  PageReference,
  TypeDoctrine,
} from "../../mcp/corpus/cnil-doctrine/liste.ts";
import { slugUnique } from "../../mcp/corpus/cnil-doctrine/parse.ts";
import type { Entry } from "../types.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "cnil_doctrine";

/** Matière unique : la doctrine CNIL porte sur les données personnelles. */
export const THEME = "donnees-personnelles";

/** Descripteur du corpus, partagé avec `cnil-doctrine:sync` : mêmes pages, même reconnaissance. */
export const DESCRIPTEUR = fileURLToPath(
  new URL("../../mcp/corpus/cnil-doctrine/descripteur.json", import.meta.url),
);

/** Manifeste du corpus : il dit quels documents y sont déjà. */
export const MANIFESTE = join("data", "corpus", "cnil_doctrine", "manifest.json");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Document du manifeste utile à la comparaison. */
export type DocumentManifeste = {
  slug?: unknown;
  type?: unknown;
  titre?: unknown;
  url?: unknown;
};

/** Délibération du corpus `cnil` : ni dupliquée ni signalée par la veille. */
type CouvertParCnil = { type?: unknown; titre?: unknown; url?: unknown };

/** Document que la synchronisation a écarté ; il ne sera pas ingesté. */
type DocumentEcart = { url?: unknown; titre?: unknown };

/** Manifeste lu ; ses blocs absents ou mal formés ne lèvent pas. */
export type ManifesteDoctrineLu = {
  documents_par_type?: Partial<Record<TypeDoctrine, DocumentManifeste[]>>;
  couverts_par_cnil?: CouvertParCnil[];
  documents_ecartes?: DocumentEcart[];
};

/** Un document listé, avant comparaison au manifeste. */
export type DocumentListe = {
  type: TypeDoctrine;
  pdf: LienDocument;
};

export type PasseDoctrineOptions = {
  /** Racine du dépôt : `data/` y est lu. */
  rootDir?: string;
  /** Pages de référence et de document, simulées en test. */
  fetchHtml?: FetchHtml;
  /** Attente injectable : les tests la remplacent par une fonction vide. */
  attendre?: (ms: number) => Promise<void>;
  /** Date de la passe : `publishedAt` des entrées. */
  maintenant?: Date;
  descripteur?: DescripteurDoctrine;
  /** Manifeste du corpus ; par défaut `data/corpus/cnil_doctrine/manifest.json`. */
  manifestePath?: string;
};

export type ResultatPasseDoctrine = {
  /** Rien à conserver : la veille ne lit que des pages de référence, relues à chaque passe. */
  raw: string[];
  entries: Entry[];
  warnings: string[];
  notes: string[];
};

/** Lecteur du descripteur : celui de `liste.ts`, partagé avec `cnil-doctrine:sync`. */
export { lireDescripteur };

/** Lit le manifeste du corpus ; `null` s'il est absent, une erreur de lecture s'il est illisible. */
export function lireManifeste(chemin: string): ManifesteDoctrineLu | null {
  if (!existsSync(chemin)) return null;
  let texte: string;
  try {
    texte = readFileSync(chemin, "utf8");
  } catch (error) {
    throw new Error(`Manifeste illisible ${chemin} : ${error instanceof Error ? error.message : String(error)}`);
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
  const manifeste = valeur as ManifesteDoctrineLu;
  return {
    ...(typeof manifeste.documents_par_type === "object" &&
    manifeste.documents_par_type !== null
      ? { documents_par_type: manifeste.documents_par_type }
      : {}),
    ...(Array.isArray(manifeste.couverts_par_cnil)
      ? { couverts_par_cnil: manifeste.couverts_par_cnil }
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

/** Clé d'identité d'un document : son type et son intitulé. */
function cleDocument(type: string, titre: string): string {
  return `${type}|${cleTitre(titre)}`;
}

/**
 * Forme comparable d'une URL de PDF : l'hôte perd son `www` (cnil.fr et
 * www.cnil.fr servent le même fichier), le fragment et la requête sont ignorés.
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

/** Documents du manifeste, à plat et par clé d'identité. */
export function documentsDuManifeste(
  manifeste: ManifesteDoctrineLu | null,
): Map<string, { slug: string; url: string }> {
  const documents = new Map<string, { slug: string; url: string }>();
  for (const [type, liste] of Object.entries(manifeste?.documents_par_type ?? {})) {
    if (!Array.isArray(liste)) continue;
    for (const document of liste) {
      if (typeof document.titre !== "string" || document.titre.trim() === "") continue;
      if (typeof document.slug !== "string" || typeof document.url !== "string") continue;
      documents.set(cleDocument(type, document.titre), {
        slug: document.slug,
        url: document.url,
      });
    }
  }
  return documents;
}

/** Médiathèque CNIL : intitulés expurgés ou réédités, comparés sans ponctuation. */
export function couvertsDuManifeste(manifeste: ManifesteDoctrineLu | null): Set<string> {
  const couverts = new Set<string>();
  for (const couvert of manifeste?.couverts_par_cnil ?? []) {
    if (typeof couvert.type !== "string" || typeof couvert.titre !== "string") continue;
    couverts.add(cleDocument(couvert.type, couvert.titre));
  }
  return couverts;
}

/** URLs des documents que la synchronisation a écartés : ils n'entreront pas. */
export function ecartesDuManifeste(manifeste: ManifesteDoctrineLu | null): Set<string> {
  const ecartes = new Set<string>();
  for (const ecarte of manifeste?.documents_ecartes ?? []) {
    if (typeof ecarte.url === "string" && ecarte.url !== "") ecartes.add(ecarte.url);
  }
  return ecartes;
}

/** Identifiant d'une entrée : stable, adressé par le document du corpus. */
export function identifiant(document: string): string {
  return createHash("sha256")
    .update(`${SOURCE_ID}|${document}`, "utf8")
    .digest("hex")
    .slice(0, 16);
}

/**
 * Entrée de veille d'un document. `publishedAt` est la date de la passe : la
 * publication n'est pas datée par les pages de référence, et une entrée datée
 * d'une ancienne édition sortirait de la fenêtre de `corpus:sync`. `version`
 * porte l'URL du PDF, seule version que la veille puisse constater.
 */
export function entreeDeDocument(
  document: DocumentListe & { slug: string },
  motif: "nouveau" | "modifie",
  datePasse: string,
): Entry {
  return {
    id: identifiant(document.slug),
    title: document.pdf.titre,
    officialTitle: document.pdf.titre,
    url: document.pdf.url,
    publishedAt: `${datePasse}T12:00:00.000Z`,
    summary: null,
    references: [],
    themes: [THEME],
    source: SOURCE_ID,
    document: document.slug,
    version: document.pdf.url,
    type: document.type,
    motif,
  };
}

/**
 * Documents listés par les pages de référence, dans l'ordre de la
 * synchronisation : PDF directs de chaque page, puis PDF portés par les pages
 * de document, dédoublonnés par URL — la première rencontre gagne.
 */
export async function documentsListes(
  descripteur: DescripteurDoctrine,
  options: PasseDoctrineOptions = {},
): Promise<{ documents: DocumentListe[]; pagesLues: number }> {
  const delai = descripteur.delai_ms;
  const http = {
    ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
    ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
    tentatives: descripteur.tentatives,
    delaiMs: delai,
    pauseEntreMs: delai,
  };
  const documents: DocumentListe[] = [];
  const vus = new Set<string>();
  let pagesLues = 0;

  const ajouter = (type: TypeDoctrine, pdf: LienDocument): void => {
    if (vus.has(pdf.url)) return;
    vus.add(pdf.url);
    documents.push({ type, pdf });
  };

  for (const reference of descripteur.pages_reference) {
    const liste = await parcourirReference(reference, descripteur.domaine, http);
    pagesLues += liste.pagesLues;
    for (const pdf of liste.pdfs) ajouter(reference.type, pdf);

    for (const page of liste.pages) {
      // Une fiche IA est la page elle-même : son PDF officiel peut changer sans
      // que son URL bouge, la veille ne lit pas le fichier.
      if (reference.liens === "fiches") {
        ajouter(reference.type, page);
        continue;
      }
      const html = await chargerTexte(page.url, http);
      const referencePdf: PageReference = {
        type: reference.type,
        url: reference.url,
        pages_max: reference.pages_max,
        liens: "pdf",
        ...(reference.motif_pdf === undefined ? {} : { motif_pdf: reference.motif_pdf }),
      };
      const trouves = extraireDocuments(html, page.url, referencePdf, descripteur.domaine);
      for (const pdf of trouves.pdfs) ajouter(reference.type, pdf);
    }
  }

  return { documents, pagesLues };
}

/**
 * Une passe : chaque document listé est comparé au manifeste. Absent du
 * manifeste et des délibérations couvertes, il est nouveau ; présent sous le
 * même intitulé mais sous une autre URL, il est modifié. Inchangé, couvert par
 * le corpus `cnil` ou écarté par la synchronisation, il ne produit rien.
 */
export async function passeDoctrine(
  options: PasseDoctrineOptions = {},
): Promise<ResultatPasseDoctrine> {
  const descripteur = options.descripteur ?? lireDescripteur(DESCRIPTEUR);
  const rootDir = options.rootDir ?? process.cwd();
  const instant = options.maintenant ?? new Date();
  const datePasse = Number.isNaN(instant.getTime()) ? "" : instant.toISOString().slice(0, 10);
  if (!DATE_ISO.test(datePasse) || Number.isNaN(Date.parse(datePasse))) {
    throw new Error(`Date de passe attendue AAAA-MM-JJ ; reçue « ${datePasse} »`);
  }

  const { documents, pagesLues } = await documentsListes(descripteur, options);
  if (documents.length === 0) {
    throw new Error("Aucun document de doctrine listé : les pages de référence ont changé ?");
  }

  const manifeste = lireManifeste(options.manifestePath ?? join(rootDir, MANIFESTE));
  const connus = documentsDuManifeste(manifeste);
  const couverts = couvertsDuManifeste(manifeste);
  const ecartes = ecartesDuManifeste(manifeste);

  const entries: Entry[] = [];
  const pris = new Set<string>();
  let inchanges = 0;
  let couvertsParCnil = 0;
  let ecartesConnus = 0;

  for (const document of documents) {
    const titre = document.pdf.titre.trim();
    const cle = cleDocument(document.type, titre);
    if (couverts.has(cle)) {
      couvertsParCnil += 1;
      continue;
    }
    if (ecartes.has(document.pdf.url)) {
      ecartesConnus += 1;
      continue;
    }

    const slug = slugUnique(document.pdf.url, pris);
    const liste = { ...document, pdf: { ...document.pdf, titre }, slug };
    const connu = connus.get(cle);
    if (connu === undefined) {
      entries.push(entreeDeDocument(liste, "nouveau", datePasse));
      continue;
    }
    if (urlComparable(connu.url) !== urlComparable(document.pdf.url)) {
      entries.push(entreeDeDocument(liste, "modifie", datePasse));
      continue;
    }
    inchanges += 1;
  }

  const nouveaux = entries.filter((entry) => entry.motif === "nouveau").length;
  const modifies = entries.length - nouveaux;
  return {
    raw: [],
    entries,
    warnings: [],
    notes: [
      `${SOURCE_ID} : ${documents.length} document(s) listé(s), ${nouveaux} nouveau(x), ` +
        `${modifies} modifié(s), ${inchanges} inchangé(s), ${couvertsParCnil} couvert(s) par le corpus CNIL, ` +
        `${ecartesConnus} écarté(s) par la synchronisation, ${pagesLues} page(s) lue(s)`,
    ],
  };
}
