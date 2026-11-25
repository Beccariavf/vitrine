/**
 * Synchronise le corpus `doctrine_ue` : lignes directrices, codes de bonne
 * pratique, modèles et questions-réponses de la Commission européenne sur l'IA
 * et les données.
 *
 * La liste est explicite (descripteur `descripteur.json`) : aucun document
 * n'entre par découverte automatique. Chaque document est récupéré depuis sa
 * page officielle — PDF de la Commission ou rendu XHTML de CELLAR pour un acte
 * publié au Journal officiel —, adressé par son `sha256` sous `data/raw/`, puis
 * découpé en fragments mot pour mot. Un document listé mais non récupéré est
 * déclaré au manifeste avec sa raison ; une source qui change de version est
 * refusée si la version déclarée n'est plus dans le texte.
 *
 * Le corpus n'est écrit qu'après validation de tous les fragments. Le cache de
 * `data/raw/doctrine-ue/cache.json` rend une relance sans réseau.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractText } from "unpdf";
import { estPdf, normaliserTextePdf } from "../cepd/pdf.ts";
import type { Unite } from "../parse.ts";
import { chargerPdf, chargerTexte } from "../cnil-doctrine/liste.ts";
import type { FetchHtml, FetchPdf, OptionsHttp } from "../cnil-doctrine/liste.ts";
import { LIBELLES_TYPE, lireDescripteur } from "./liste.ts";
import type {
  DescripteurDoctrineUe,
  DocumentDoctrineUe,
  DocumentEcartDeclare,
  NonRecupere,
  TypeDoctrineUe,
} from "./liste.ts";
import { texteDepuisHtml, unitesDoctrineUe, validerUnites, verifierPage, verifierVersion } from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "doctrine_ue");
/** Dossier des PDF, des pages et du cache, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "doctrine-ue");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const AGENT = "vitrine/0.1 (veille juridique; +https://github.com/Beccariavf/vitrine)";

/** Une entrée du cache : le fichier écrit et l'empreinte de son contenu. */
export type EntreeCache = { fichier: string; sha256: string; consulte_le: string };

export type Cache = Record<string, EntreeCache>;

export type DocumentManifeste = {
  cle: string;
  /** Alias historique de `cle`, forme attendue par le marquage de doctrine. */
  slug: string;
  type: TypeDoctrineUe;
  type_libelle: string;
  titre: string;
  titre_source?: string;
  statut: string;
  date_acte: string;
  date_source: string;
  date_publication: string | null;
  version: string;
  langue: string;
  format: string;
  /** Page officielle du document. */
  url: string;
  /** Fichier ou rendu effectivement lu. */
  url_texte: string;
  snapshot: string;
  date_extraction: string;
  fragments: number;
  licence: string;
  licence_url: string;
  source: string;
  remplace?: string[];
  remplace_par?: string;
};

export type Remplacement = { projet: string; finale: string };

export type ManifesteDoctrineUe = {
  corpus: string;
  nom: string;
  titre: string;
  consulte_le: string;
  date_extraction: string;
  /** Pages de référence et date de leur consultation. */
  liste_reference: DescripteurDoctrineUe["liste_reference"];
  /** Documents listés par le descripteur, retenus ou non. */
  documents_liste: number;
  documents: number;
  fragments: number;
  types: Record<TypeDoctrineUe, number>;
  documents_par_type: Record<TypeDoctrineUe, DocumentManifeste[]>;
  non_recuperes: NonRecupere[];
  documents_ecartes: DocumentEcartDeclare[];
  remplacements: Remplacement[];
  mention: string;
  licence: string;
  licence_url: string;
  licence_note: string;
  source: string;
  couverture: {
    source: string;
    date_liste: string;
    date_extraction: string;
    pages_reference: string[];
    documents_liste: number;
    documents: number;
    non_recuperes: number;
    documents_ecartes: number;
    remplacements: number;
    regle_texte: string;
    licence_note: string;
  };
};

export type SyncDoctrineUeOptions = {
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
  pauseEntreMs?: number;
  /** Force la relecture de toutes les sources, sans attendre l'expiration du cache. */
  rafraichir?: boolean;
  /** Durée de validité du cache, en jours ; par défaut celle du descripteur. */
  validite_jours?: number;
  /** Extraction injectable : les tests la remplacent par un texte de fixture. */
  extraireTexte?: (octets: Uint8Array, url: string) => Promise<string>;
  /** Lecture CELLAR injectable : les tests la remplacent par un XHTML de fixture. */
  lireCellar?: (celex: string) => Promise<string>;
};

export type ResultatDoctrineUe = {
  documents: number;
  fragments: number;
  nonRecuperes: number;
  ecartes: number;
  ecrit: boolean;
};

/** Date du jour en UTC, forme `AAAA-MM-JJ`. */
export function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/** Empreinte `sha256` d'octets ou d'un texte. */
function sha256(contenu: Uint8Array | string): string {
  return createHash("sha256").update(contenu).digest("hex");
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

/** Extrait le texte d'un PDF sans plancher arbitraire ; refuse un PDF sans lettre. */
export async function extraireTextePdf(octets: Uint8Array, url: string): Promise<string> {
  if (!estPdf(octets)) throw new Error(`${url} : le fichier n'est pas un PDF`);
  const resultat = await extractText(new Uint8Array(octets), { mergePages: false });
  const texte = normaliserTextePdf(resultat.text.join("\n\n"));
  if (!/\p{L}/u.test(texte)) throw new Error(`${url} : PDF sans texte (scanné ou vide)`);
  return texte;
}

/** Rend le XHTML français d'un acte du Journal officiel depuis CELLAR. */
async function lireCellarCellar(celex: string): Promise<string> {
  const reponse = await fetch(`https://publications.europa.eu/resource/celex/${celex}`, {
    headers: {
      Accept: "application/xhtml+xml",
      "Accept-Language": "fra",
      "user-agent": AGENT,
    },
  });
  if (!reponse.ok) throw new Error(`CELLAR ${celex} : HTTP ${reponse.status}`);
  return reponse.text();
}

/**
 * Téléchargeur avec cache par URL : une ressource déjà lue n'est pas
 * redemandée tant que son fichier est présent et que le cache n'a pas expiré.
 * Le cache est réécrit après chaque nouvelle entrée pour qu'une passe
 * interrompue reprene au dernier document.
 */
function creerTelechargeur(
  brutDir: string,
  cache: Cache,
  options: SyncDoctrineUeOptions,
  ecrire: boolean,
  date: string,
  validite: number,
  tentatives: number,
): {
  pdf(url: string): Promise<{ octets: Uint8Array; sha256: string }>;
  texte(
    url: string,
    genre: "page" | "cellar",
    celex?: string,
  ): Promise<{ texte: string; sha256: string }>;
  oublier(url: string): void;
} {
  const http: OptionsHttp = {
    ...(options.fetchHtml === undefined ? {} : { fetchHtml: options.fetchHtml }),
    ...(options.fetchPdf === undefined ? {} : { fetchPdf: options.fetchPdf }),
    ...(options.attendre === undefined ? {} : { attendre: options.attendre }),
    ...(options.delaiMs === undefined ? {} : { delaiMs: options.delaiMs }),
    ...(options.pauseEntreMs === undefined ? {} : { pauseEntreMs: options.pauseEntreMs }),
    tentatives,
    userAgent: AGENT,
  };
  const memoriser = (url: string, fichier: string, empreinte: string): void => {
    cache[url] = { fichier, sha256: empreinte, consulte_le: date };
    if (ecrire) {
      ecrireSiChange(join(brutDir, "cache.json"), `${JSON.stringify(cache, null, 2)}\n`);
    }
  };
  const valide = (url: string): EntreeCache | null => {
    const entree = cache[url];
    if (entree === undefined) return null;
    if (!existsSync(join(brutDir, entree.fichier))) return null;
    const veille = Date.parse(`${entree.consulte_le}T00:00:00Z`);
    if (Number.isNaN(veille)) return null;
    const jour = Date.parse(`${date}T00:00:00Z`);
    return (jour - veille) / 86_400_000 >= validite ? null : entree;
  };

  return {
    async pdf(url) {
      const entree = valide(url);
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
        memoriser(url, fichier, empreinte);
      }
      return { octets, sha256: empreinte };
    },
    async texte(url, genre, celex) {
      const entree = valide(url);
      if (entree !== null) {
        return {
          texte: readFileSync(join(brutDir, entree.fichier), "utf8"),
          sha256: entree.sha256,
        };
      }
      const contenu =
        genre === "cellar"
          ? await (options.lireCellar ?? lireCellarCellar)(celex ?? "")
          : await chargerTexte(url, http);
      const empreinte = sha256(contenu);
      const fichier = join(genre === "cellar" ? "cellar" : "page", `${empreinte}.html`);
      if (ecrire) {
        ecrireOctets(join(brutDir, fichier), new TextEncoder().encode(contenu));
        memoriser(url, fichier, empreinte);
      }
      return { texte: contenu, sha256: empreinte };
    },
    oublier(url) {
      delete cache[url];
      if (ecrire) {
        ecrireSiChange(join(brutDir, "cache.json"), `${JSON.stringify(cache, null, 2)}\n`);
      }
    },
  };
}

/** Entrée du manifeste précédent, gardée pour ne pas redater un texte inchangé. */
type DocumentPrecedent = DocumentManifeste & Record<string, unknown>;

/** Documents du manifeste précédent, par clé. */
function lireDocumentsPrecedents(rootDir: string): Map<string, DocumentPrecedent> {
  const chemin = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  const documents = new Map<string, DocumentPrecedent>();
  if (!existsSync(chemin)) return documents;
  let manifeste: unknown;
  try {
    manifeste = JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    return documents;
  }
  const parType = (manifeste as { documents_par_type?: unknown }).documents_par_type;
  if (typeof parType !== "object" || parType === null) return documents;
  for (const liste of Object.values(parType)) {
    if (!Array.isArray(liste)) continue;
    for (const document of liste) {
      if (typeof document !== "object" || document === null) continue;
      const cle = (document as { cle?: unknown }).cle;
      if (typeof cle !== "string") continue;
      documents.set(cle, document as DocumentPrecedent);
    }
  }
  return documents;
}

/** Une ressource lue : son texte, son empreinte et la source effective. */
type Ressource = { texte: string; snapshot: string; source: string };

/** Lit un document selon son format déclaré. */
async function lireDocument(
  document: DocumentDoctrineUe,
  telechargeur: ReturnType<typeof creerTelechargeur>,
  extraireTexte: (octets: Uint8Array, url: string) => Promise<string>,
): Promise<Ressource> {
  if (document.format === "pdf") {
    const fichier = await telechargeur.pdf(document.source);
    const texte = await extraireTexte(fichier.octets, document.source);
    return { texte, snapshot: fichier.sha256, source: document.source };
  }
  if (document.format === "cellar") {
    const celex = document.celex ?? "";
    const url = `https://publications.europa.eu/resource/celex/${celex}`;
    const lu = await telechargeur.texte(url, "cellar", celex);
    const texte = texteDepuisHtml(lu.texte, { cellar: true });
    verifierPage(texte, url);
    return { texte, snapshot: lu.sha256, source: url };
  }
  const lu = await telechargeur.texte(document.source, "page");
  const texte = texteDepuisHtml(lu.texte);
  verifierPage(texte, document.source);
  return { texte, snapshot: lu.sha256, source: document.source };
}

/** Raison lisible d'une erreur. */
function raison(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Synchronise le corpus `doctrine_ue`. Chaque document de la liste est lu ;
 * un échec ne fait pas perdre les autres, mais il est déclaré aux
 * `non_recuperes` avec sa raison. Rien n'est écrit avant validation de tous
 * les fragments retenus.
 */
export async function syncDoctrineUe(
  options: SyncDoctrineUeOptions = {},
): Promise<ResultatDoctrineUe> {
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
  const validite = options.rafraichir === true ? 0 : Math.max(0, options.validite_jours ?? descripteur.validite_jours);
  const telechargeur = creerTelechargeur(
    brutDir,
    cache,
    options,
    ecrire,
    date,
    validite,
    options.tentatives ?? descripteur.tentatives,
  );
  const extraireTexte = options.extraireTexte ?? extraireTextePdf;
  const precedents = lireDocumentsPrecedents(rootDir);

  const documentsParType: Record<TypeDoctrineUe, DocumentManifeste[]> = {
    lignes_directrices: [],
    projet_lignes_directrices: [],
    code_de_bonne_pratique: [],
    modele: [],
    questions_reponses: [],
  };
  const nonRecuperes: NonRecupere[] = [...(descripteur.non_recuperes ?? [])];
  const unites: Unite[] = [];
  const remplacements: Remplacement[] = [];

  for (const document of descripteur.documents) {
    let ressource: Ressource;
    try {
      ressource = await lireDocument(document, telechargeur, extraireTexte);
      verifierVersion(document, ressource.texte);
    } catch (error) {
      telechargeur.oublier(document.source);
      nonRecuperes.push({ titre: document.titre, url: document.url, raison: raison(error) });
      continue;
    }

    // Une page vivante est datée du jour où son contenu a été lu pour la
    // première fois : un texte inchangé garde sa date, une réédition la renouvelle.
    const precedent = precedents.get(document.cle);
    const memeContenu = precedent !== undefined && precedent.snapshot === ressource.snapshot;
    const dateActe =
      document.vivante === true
        ? precedent === undefined
          ? document.date_acte
          : memeContenu
            ? (precedent.date_acte ?? date)
            : date
        : document.date_acte;
    let fragments: Unite[];
    try {
      fragments = unitesDoctrineUe(
        document,
        ressource.texte,
        descripteur.corpus,
        descripteur.nom,
        dateActe,
      );
    } catch (error) {
      nonRecuperes.push({ titre: document.titre, url: document.url, raison: raison(error) });
      continue;
    }
    unites.push(...fragments);
    const entree: DocumentManifeste = {
      cle: document.cle,
      slug: document.cle,
      type: document.type,
      type_libelle: LIBELLES_TYPE[document.type],
      titre: document.titre,
      ...(document.titre_source === undefined ? {} : { titre_source: document.titre_source }),
      statut: document.statut,
      date_acte: dateActe,
      date_source: document.date_source,
      date_publication: document.date_publication,
      version: document.version,
      langue: document.langue,
      format: document.format,
      url: document.url,
      url_texte: ressource.source,
      snapshot: ressource.snapshot,
      date_extraction: memeContenu ? (precedent.date_extraction ?? date) : date,
      fragments: fragments.length,
      licence: document.licence ?? descripteur.licence,
      licence_url: document.licence_url ?? descripteur.licence_url,
      source: descripteur.source,
      ...(document.remplace === undefined ? {} : { remplace: [...document.remplace] }),
      ...(document.remplace_par === undefined ? {} : { remplace_par: document.remplace_par }),
    };
    documentsParType[document.type].push(entree);
    if (document.remplace_par !== undefined) {
      remplacements.push({ projet: document.cle, finale: document.remplace_par });
    }
  }

  if (unites.length === 0) {
    throw new Error(
      `Aucun fragment de doctrine produit : ${descripteur.documents.length} document(s) listé(s), ` +
        `${nonRecuperes.length} non récupéré(s)`,
    );
  }
  validerUnites(unites, descripteur.corpus);

  const documents = new Set(unites.map((unite) => unite.document)).size;
  const types = Object.fromEntries(
    (Object.keys(LIBELLES_TYPE) as TypeDoctrineUe[]).map((type) => [type, documentsParType[type].length]),
  ) as Record<TypeDoctrineUe, number>;
  const ecartesParUrl = new Map<string, DocumentEcartDeclare>();
  for (const declare of descripteur.documents_ecartes ?? []) ecartesParUrl.set(declare.url, declare);
  const documentsEcartes = [...ecartesParUrl.values()];
  const nonRecuperesParUrl = new Map<string, NonRecupere>();
  for (const declare of nonRecuperes) nonRecuperesParUrl.set(declare.url, declare);
  // Un document listé au descripteur compte une fois, qu'il soit récupéré ou
  // déclaré non récupéré ; un document absent de la liste (un DOCX écarté)
  // s'ajoute au compte.
  const urlsListees = new Set(descripteur.documents.map((document) => document.url));
  const nonRecuperesHorsListe = [...nonRecuperesParUrl.values()].filter(
    (entree) => !urlsListees.has(entree.url),
  ).length;
  const documentsListe = descripteur.documents.length + nonRecuperesHorsListe;

  const manifeste: ManifesteDoctrineUe = {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    consulte_le: date,
    date_extraction: date,
    liste_reference: descripteur.liste_reference,
    documents_liste: documentsListe,
    documents,
    fragments: unites.length,
    types,
    documents_par_type: documentsParType,
    non_recuperes: [...nonRecuperesParUrl.values()],
    documents_ecartes: documentsEcartes,
    remplacements,
    mention: descripteur.mention,
    licence: descripteur.licence,
    licence_url: descripteur.licence_url,
    licence_note: descripteur.licence_note,
    source: descripteur.source,
    couverture: {
      source: "Commission européenne — Bureau de l'IA (DG CNECT) et DG CNECT pour le Data Act",
      date_liste: date,
      date_extraction: date,
      pages_reference: descripteur.liste_reference.map((reference) => reference.url),
      documents_liste: documentsListe,
      documents,
      non_recuperes: nonRecuperesParUrl.size,
      documents_ecartes: documentsEcartes.length,
      remplacements: remplacements.length,
      regle_texte:
        "aucun plafond de documents ni de caractères ; un document sans aucune lettre est refusé et déclaré",
      licence_note: descripteur.licence_note,
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
    nonRecuperes: nonRecuperesParUrl.size,
    ecartes: documentsEcartes.length,
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
    const resultat = await syncDoctrineUe({
      ...(rootDir === undefined ? {} : { rootDir }),
      ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
      ...(date === undefined ? {} : { date }),
      dryRun,
      rafraichir,
    });
    process.stderr.write(
      `${resultat.documents} document(s), ${resultat.fragments} fragment(s), ` +
        `${resultat.nonRecuperes} non récupéré(s), ${resultat.ecartes} écarté(s)` +
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
