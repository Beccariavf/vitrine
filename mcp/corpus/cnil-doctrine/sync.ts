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
  extraireDocuments,
  lireDescripteur,
  parcourirReference,
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
  dateDuDocument,
  deliberationDuDocument,
  deliberationsCitees,
  mentionContraire,
  slugDe,
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
  date_source: "document" | "extraction";
  date_extraction: string;
  fragments: number;
};

export type CouvertParCnil = {
  type: TypeDoctrine;
  titre: string;
  url: string;
  numero: string;
  document: string;
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
  liste_reference: { type: TypeDoctrine; url: string; consulte_le: string; documents: number }[];
  consulte_le: string;
  date_extraction: string;
  documents: number;
  fragments: number;
  types: Record<TypeDoctrine, number>;
  /** Documents de chaque type laissés au corpus `cnil` : ni dupliqués ni recomptés. */
  couverts_par_type: Record<TypeDoctrine, number>;
  documents_par_type: Record<TypeDoctrine, DocumentManifeste[]>;
  couverts_par_cnil: CouvertParCnil[];
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
    types: Record<TypeDoctrine, number>;
    couverts_par_type: Record<TypeDoctrine, number>;
    couverts_par_cnil: number;
    documents_ecartes: number;
    mentions_contraires: number;
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
  /** Extraction injectable : les tests remplacent unpdf par un texte de fixture. */
  extraireTexte?: (octets: Uint8Array, url: string) => Promise<string>;
  /** Texte injectable des pages de référence, pour éviter le réseau en test. */
  lirePage?: (url: string) => Promise<string>;
};

export type ResultatDoctrine = {
  documents: number;
  fragments: number;
  couverts: number;
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
  texte(url: string): Promise<{ contenu: string; sha256: string }>;
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
  };

  const memoriser = (url: string, fichier: string, empreinte: string, date: string): void => {
    cache[url] = { fichier, sha256: empreinte, consulte_le: date };
    if (ecrire) {
      ecrireSiChange(join(brutDir, "cache.json"), `${JSON.stringify(cache, null, 2)}\n`);
    }
  };

  const cacheValide = (url: string): EntreeCache | null => {
    const entree = cache[url];
    if (entree === undefined) return null;
    return existsSync(join(brutDir, entree.fichier)) ? entree : null;
  };

  const date = options.date ?? dateDuJour();

  return {
    async texte(url) {
      const entree = cacheValide(url);
      if (entree !== null) {
        return { contenu: readFileSync(join(brutDir, entree.fichier), "utf8"), sha256: entree.sha256 };
      }
      const contenu = await chargerTexte(url, http);
      const empreinte = sha256(contenu);
      const fichier = join("pages", `${empreinte}.html`);
      if (ecrire) {
        ecrireOctets(join(brutDir, fichier), Buffer.from(contenu, "utf8"));
        memoriser(url, fichier, empreinte, date);
      }
      return { contenu, sha256: empreinte };
    },
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

/** Texte lisible d'une page de document : sa zone principale, balises retirées. */
export function texteDePage(html: string): string {
  const main = /<main\b[\s\S]*?<\/main>/i.exec(html);
  return texteVisible(main === null ? html : main[0]).replace(/\s+/g, " ").trim();
}

/** Un candidat de document, avant téléchargement de son PDF. */
type Candidat = {
  type: TypeDoctrine;
  pdf: LienDocument;
  /** Page qui porte le PDF, quand la référence liste des pages. */
  page: string | null;
  /** Texte de cette page, pour y lire une délibération. */
  pageTexte: string | null;
  reference: PageReference;
};

/** Un document retenu, son PDF, son empreinte et son texte. */
type DocumentLu = {
  candidat: Candidat;
  slug: string;
  titre: string;
  date_acte: string;
  date_source: "document" | "extraction";
  snapshot: string;
  texte: string;
};

/** Slug unique : un doublon de nom de fichier reçoit un suffixe d'URL. */
function slugUnique(url: string, pris: Set<string>): string {
  const base = slugDe(url);
  if (!pris.has(base)) {
    pris.add(base);
    return base;
  }
  const suffixe = sha256(url).slice(0, 8);
  const unique = `${base}-${suffixe}`;
  pris.add(unique);
  return unique;
}

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
  const telechargeur = creerTelechargeur(brutDir, cache, { ...options, date }, ecrire);
  const lirePage =
    options.lirePage ?? ((url: string) => telechargeur.texte(url).then((lu) => lu.contenu));

  const candidats: Candidat[] = [];
  const references: ManifesteDoctrine["liste_reference"] = [];
  let pagesLues = 0;

  for (const reference of descripteur.pages_reference) {
    const http = {
      ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
      ...(options.fetchPdf === undefined ? {} : { fetchPdf: options.fetchPdf }),
      ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
      ...(options.tentatives === undefined ? {} : { tentatives: options.tentatives }),
      ...(options.delaiMs === undefined ? {} : { delaiMs: options.delaiMs }),
    };
    const liste = await parcourirReference(reference, descripteur.domaine, http);
    pagesLues += liste.pagesLues;
    references.push({
      type: reference.type,
      url: reference.url,
      consulte_le: date,
      documents: 0,
    });
    for (const pdf of liste.pdfs) {
      candidats.push({ type: reference.type, pdf, page: null, pageTexte: null, reference });
    }
    for (const page of liste.pages) {
      const html = await lirePage(page.url);
      const trouves = extraireDocuments(
        html,
        page.url,
        { type: reference.type, url: reference.url, pages_max: reference.pages_max, liens: "pdf", ...(reference.motif_pdf === undefined ? {} : { motif_pdf: reference.motif_pdf }) },
        descripteur.domaine,
      );
      const pageTexte = texteDePage(html);
      for (const pdf of trouves.pdfs) {
        candidats.push({ type: reference.type, pdf, page: page.url, pageTexte, reference });
      }
    }
  }

  const vus = new Set<string>();
  const uniques = candidats.filter((candidat) => {
    if (vus.has(candidat.pdf.url)) return false;
    vus.add(candidat.pdf.url);
    return true;
  });
  if (uniques.length === 0) {
    throw new Error("Aucun document de doctrine listé : les pages de référence ont changé ?");
  }

  const corpusCnil = lireCorpusCnil(rootDir);
  const extraireTexte = options.extraireTexte ?? extraireTextePdf;
  const unites: Unite[] = [];
  const documentsParType: Record<TypeDoctrine, DocumentManifeste[]> = {
    guide: [],
    referentiel: [],
    liste_aipd: [],
  };
  const couverts: CouvertParCnil[] = [];
  const ecartes: DocumentEcart[] = [];
  const pris = new Set<string>();

  for (const candidat of uniques) {
    const url = candidat.pdf.url;
    const titre = candidat.pdf.titre.trim();
    let octets: Uint8Array;
    let empreinte: string;
    let texte: string;
    try {
      const fichier = await telechargeur.pdf(url);
      octets = fichier.octets;
      empreinte = fichier.sha256;
      texte = await extraireTexte(octets, url);
    } catch (error) {
      // Un PDF dont l'extraction échoue ne doit pas rester au cache : la passe
      // suivante le redemande au lieu d'échouer sur le même fichier.
      telechargeur.oublier(url);
      ecartes.push({
        url,
        titre,
        raison: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const contraire = mentionContraire(texte);
    if (contraire !== null) {
      ecartes.push({ url, titre, raison: contraire });
      continue;
    }

    const citees = [
      ...deliberationsCitees(candidat.pageTexte ?? ""),
      ...deliberationsCitees(texte),
    ];
    const couvert = deliberationDuDocument(titre, citees, corpusCnil);
    if (couvert !== null) {
      couverts.push({ type: candidat.type, titre, url, ...couvert });
      continue;
    }

    const dateDocument = dateDuDocument(texte);
    const dateActe = dateDocument ?? date;
    const slug = slugUnique(url, pris);
    const lu: DocumentLu = {
      candidat,
      slug,
      titre: titre === "" ? slug : titre,
      date_acte: dateActe,
      date_source: dateDocument === null ? "extraction" : "document",
      snapshot: empreinte,
      texte,
    };
    const fragments = unitesDoctrine(
      {
        type: lu.candidat.type,
        url,
        titre: lu.titre,
        slug: lu.slug,
        date_acte: lu.date_acte,
        date_source: lu.date_source,
        date_extraction: date,
        snapshot: lu.snapshot,
      },
      texte,
      descripteur,
    );
    unites.push(...fragments);
    documentsParType[candidat.type].push({
      slug: lu.slug,
      type: candidat.type,
      titre: lu.titre,
      url,
      snapshot: lu.snapshot,
      date_acte: lu.date_acte,
      date_source: lu.date_source,
      date_extraction: date,
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
  };
  const couvertsParType: Record<TypeDoctrine, number> = {
    guide: couverts.filter((couvert) => couvert.type === "guide").length,
    referentiel: couverts.filter((couvert) => couvert.type === "referentiel").length,
    liste_aipd: couverts.filter((couvert) => couvert.type === "liste_aipd").length,
  };
  const compteParReference = new Map<PageReference, number>();
  for (const document of [
    ...documentsParType.guide,
    ...documentsParType.referentiel,
    ...documentsParType.liste_aipd,
  ]) {
    const candidat = uniques.find((entree) => entree.pdf.url === document.url);
    if (candidat === undefined) continue;
    compteParReference.set(candidat.reference, (compteParReference.get(candidat.reference) ?? 0) + 1);
  }
  for (const couvert of couverts) {
    const candidat = uniques.find((entree) => entree.pdf.url === couvert.url);
    if (candidat === undefined) continue;
    compteParReference.set(candidat.reference, (compteParReference.get(candidat.reference) ?? 0) + 1);
  }
  const listeReference = references.map((entree, index) => {
    const reference = descripteur.pages_reference[index];
    return {
      ...entree,
      documents: reference === undefined ? 0 : compteParReference.get(reference) ?? 0,
    };
  });

  const manifeste: ManifesteDoctrine = {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    liste_reference: listeReference,
    consulte_le: date,
    date_extraction: date,
    documents,
    fragments: unites.length,
    types,
    couverts_par_type: couvertsParType,
    documents_par_type: documentsParType,
    couverts_par_cnil: couverts,
    documents_ecartes: ecartes,
    mention: descripteur.mention,
    licence: descripteur.licence,
    licence_url: descripteur.licence_url,
    source: descripteur.source,
    couverture: {
      source: "CNIL — guides, référentiels et listes AIPD (cnil.fr)",
      date_liste: date,
      date_extraction: date,
      pages_reference: descripteur.pages_reference.map((reference) => reference.url),
      types,
      couverts_par_type: couvertsParType,
      couverts_par_cnil: couverts.length,
      documents_ecartes: ecartes.length,
      mentions_contraires: ecartes.filter((ecarte) => ecarte.raison.startsWith("mention contraire")).length,
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
    ecartes: ecartes.length,
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
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const date = valeurDe("--date", argv);

  try {
    const resultat = await syncDoctrine({
      ...(rootDir === undefined ? {} : { rootDir }),
      ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
      ...(date === undefined ? {} : { date }),
      dryRun,
    });
    process.stderr.write(
      `${resultat.documents} document(s), ${resultat.fragments} fragment(s), ` +
        `${resultat.couverts} couvert(s) par le corpus CNIL, ${resultat.ecartes} écarté(s), ` +
        `${resultat.pagesLues} page(s) de référence` +
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
