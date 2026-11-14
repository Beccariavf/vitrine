/**
 * Contrôle la couverture du corpus CJUE par la fiche thématique Curia
 * « Protection des données à caractère personnel ».
 *
 * La fiche est téléchargée en PDF, conservée sous `data/raw/` par son `sha256`,
 * puis lue hors ligne. Chaque numéro d'affaire est converti en CELEX d'arrêt ;
 * une affaire jointe porte le CELEX du premier numéro, vérifié par SPARQL
 * CELLAR quand le CELEX déduit n'existe pas. Un arrêt absent sans motif durable
 * est ajouté aux CELEX complémentaires du descripteur et la synchronisation est
 * relancée ; le rapport est écrit avec l'URL, la date de consultation, les
 * arrêts présents, ajoutés et absents avec leur raison. Un manquant sans raison
 * fait sortir la commande en erreur.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractText, getDocumentProxy } from "unpdf";
import { writeRaw } from "../../../veille/write.ts";
import type { FetchLike } from "../../../veille/fetch.ts";
import { lireRefus, syncCjue } from "./sync.ts";
import type { SyncCjueOptions } from "./sync.ts";
import type { DescripteurCjue, MotifEcartCjue } from "./liste.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus CJUE sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "cjue");
/** Rapport de contrôle, écrit par la commande. */
export const RAPPORT_RELATIF = "data/corpus/cjue/controle-curia.json";
export const RAPPORT = join("data", "corpus", "cjue", "controle-curia.json");
/** Résumé lisible, tenu à jour dans la couverture des corpus. */
export const COUVERTURE = join(
  "aidd_docs",
  "tasks",
  "2026_11",
  "2026_11_11_corpus-cassation-cjue",
  "coverage.md",
);

/** Fiche thématique de référence, en français. */
export const FICHE = {
  titre: "Protection des données à caractère personnel",
  page: "https://curia.europa.eu/site/jcms/d2_5127/fr/fiches-thematiques",
  url: "https://curia.europa.eu/site/upload/docs/application/pdf/2018-10/fiche_thematique_-_donnees_personnelles_-_fr.pdf",
};

/** Réponse minimale d'un téléchargement binaire. */
export type ReponseBinaire = {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

/** `fetch` restreint au téléchargement de la fiche. */
export type FetchBinaire = (url: string) => Promise<ReponseBinaire>;

/** Motifs durables : un arrêt qui les porte n'est pas réessayé à chaque contrôle. */
const MOTIFS_DURABLES = new Set<MotifEcartCjue>([
  "xhtml_absent",
  "autre_type",
  "avis_avocat_general",
  "date_invalide",
  "texte_vide",
]);

const AFFAIRE = /[CT]-\d+\/\d+/g;
/** Deux numéros séparés par une virgule ou « et » seulement forment une jonction. */
const SEPARATEUR = /^\s*(?:,|et)\s*$/;

/** Un numéro d'affaire de la fiche et les numéros qui lui sont joints. */
export type AffaireFiche = {
  numero: string;
  groupe: string[];
  /** La citation porte un ECLI : la jonction est certaine, même sans CELLAR. */
  groupeAvecEcli: boolean;
};

/** CELEX d'arrêt déduit d'un numéro d'affaire : `CJ` pour la Cour, `TJ` pour le Tribunal. */
export function celexArret(numero: string): string {
  const correspondance = /^([CT])-(\d+)\/(\d+)$/.exec(numero);
  if (correspondance === null) {
    throw new Error(`Numéro d'affaire illisible : « ${numero} »`);
  }
  const [, juridiction, rang, annee] = correspondance;
  const prefixe = juridiction === "C" ? "CJ" : "TJ";
  // L'année du numéro d'affaire est sur deux chiffres ; les affaires d'avant
  // 1950 n'existent pas, la pivot à 50 sépare 19xx de 20xx.
  const siecle = Number(annee) >= 50 ? 1900 : 2000;
  return `6${siecle + Number(annee)}${prefixe}${(rang ?? "").padStart(4, "0")}`;
}

/**
 * Numéros d'affaire de la fiche, dans l'ordre de première apparition. Deux
 * numéros voisins séparés par une virgule ou « et » forment une jonction : leur
 * arrêt est unique. Une jonction n'est tenue pour certaine que si la citation
 * porte un ECLI ; sans lui, le repli hors ligne ne l'utilise pas.
 */
export function extraireAffaires(texte: string): AffaireFiche[] {
  const apparitions = [...texte.matchAll(AFFAIRE)].map((correspondance) => ({
    numero: correspondance[0],
    debut: correspondance.index ?? 0,
    fin: (correspondance.index ?? 0) + correspondance[0].length,
  }));
  const groupes: Array<{ numeros: string[]; fin: number }> = [];
  let groupe: { numeros: string[]; fin: number } = { numeros: [], fin: 0 };
  let precedent: (typeof apparitions)[number] | null = null;
  for (const apparition of apparitions) {
    const joint =
      precedent !== null && SEPARATEUR.test(texte.slice(precedent.fin, apparition.debut));
    if (!joint) {
      groupe = { numeros: [], fin: apparition.fin };
      groupes.push(groupe);
    }
    if (!groupe.numeros.includes(apparition.numero)) groupe.numeros.push(apparition.numero);
    groupe.fin = apparition.fin;
    precedent = apparition;
  }
  const parNumero = new Map<string, AffaireFiche>();
  for (const groupeCourant of groupes) {
    const avecEcli = /^\s*,?\s*EU:[CT]:\d+:\d+/.test(texte.slice(groupeCourant.fin));
    for (const numero of groupeCourant.numeros) {
      if (!parNumero.has(numero)) {
        parNumero.set(numero, {
          numero,
          groupe: groupeCourant.numeros,
          groupeAvecEcli: avecEcli,
        });
      }
    }
  }
  return [...parNumero.values()];
}

/** Télécharge la fiche en PDF. */
export async function telechargerFiche(fetchImpl: FetchBinaire = fetch): Promise<Uint8Array> {
  const reponse = await fetchImpl(FICHE.url);
  if (!reponse.ok) {
    throw new Error(`Curia : la fiche thématique répond HTTP ${reponse.status}`);
  }
  return new Uint8Array(await reponse.arrayBuffer());
}

/** Texte de toutes les pages du PDF, joint par un saut de ligne. */
export async function extraireTexteFiche(pdf: Uint8Array): Promise<string> {
  const document = await getDocumentProxy(pdf);
  const { text } = await extractText(document, { mergePages: false });
  return text.join("\n");
}

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
].join("|");

/** Édition imprimée de la fiche (« Juillet 2024 »), `null` quand elle est illisible. */
export function extraireEdition(texte: string): string | null {
  const correspondance = new RegExp(`\\b(${MOIS})\\s+(\\d{4})\\b`).exec(texte);
  return correspondance === null ? null : `${correspondance[1]} ${correspondance[2]}`;
}

type Binding = { value?: unknown };

/**
 * CELEX de l'arrêt qui porte ce numéro d'affaire, quand le CELEX déduit
 * n'existe pas : la décision existe sous un autre CELEX (affaire jointe) ou
 * n'existe pas du tout. `null` quand CELLAR ne répond rien d'exploitable.
 */
export async function resoudreArret(
  numero: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ celex: string; via: "cellar" | "jonction" } | null> {
  const deduit = celexArret(numero);
  const requete = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex WHERE {
  { ?work cdm:resource_legal_id_celex ?deduit . FILTER(STR(?deduit) = "${deduit}")
    BIND("${deduit}" AS ?celex) }
  UNION
  { ?work cdm:case-law_joins_case_court <http://publications.europa.eu/resource/case/celex%3A${deduit}> .
    ?work cdm:resource_legal_id_celex ?celex . }
} LIMIT 5`;
  const reponse = await fetchImpl("https://publications.europa.eu/webapi/rdf/sparql", {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: requete }).toString(),
  }).catch(() => null);
  if (reponse === null || !reponse.ok) return null;
  let valeur: unknown;
  try {
    valeur = JSON.parse(await reponse.text());
  } catch {
    return null;
  }
  const bindings = (valeur as { results?: { bindings?: unknown } }).results?.bindings;
  if (!Array.isArray(bindings)) return null;
  const celex = (bindings as Array<Record<string, Binding>>)
    .map((ligne) => ligne.celex?.value)
    .find((element): element is string => typeof element === "string" && /^6/.test(element));
  if (celex === undefined) return null;
  return { celex, via: celex === deduit ? "cellar" : "jonction" };
}

/** Un arrêt de la fiche et son état dans le corpus. */
export type ArretControle = {
  celex: string;
  numeros: string[];
  /** Comment le CELEX a été obtenu : déduit du numéro, confirmé par CELLAR, ou jonction. */
  resolution: "deduit" | "cellar" | "jonction" | "groupe";
  etat: "present" | "ajoute" | "absent";
  /** Raison durable de l'absence ; absent des arrêts présents. */
  motif?: MotifEcartCjue;
};

export type RapportControle = {
  corpus: "cjue";
  fiche: {
    titre: string;
    page: string;
    url: string;
    snapshot: string | null;
    /** Édition imprimée de la fiche, lue dans le PDF ; `null` si illisible. */
    edition: string | null;
  };
  consulte_le: string;
  numeros_affaires: number;
  arrets_fiche: number;
  /** Arrêts de la fiche présents au corpus, ajoutés compris. */
  presents: number;
  /** Arrêts de la fiche entrés au corpus par les CELEX complémentaires du descripteur. */
  ajoutes: number;
  /** Part de `ajoutes` entrée lors de cette exécution, zéro sur un corpus déjà complet. */
  ajoutes_ce_passage: number;
  /** Arrêts absents, chacun avec sa raison durable. */
  absents: Array<{ celex: string; numeros: string[]; motif: MotifEcartCjue }>;
  /** Arrêts absents sans raison : la commande sort en erreur tant qu'il en reste. */
  manquants_sans_raison: number;
  arrets: ArretControle[];
  /** Erreur de la synchronisation déclenchée par un ajout, `null` sinon. */
  erreur_sync: string | null;
};

export type ControleOptions = {
  rootDir?: string;
  descripteurPath?: string;
  /** Date de consultation de la fiche, `AAAA-MM-JJ` ; aujourd'hui par défaut. */
  date?: string;
  fetchImpl?: FetchBinaire;
  fetchSparql?: FetchLike;
  syncImpl?: (options: SyncCjueOptions) => Promise<unknown>;
  /** Texte déjà extrait de la fiche : les tests n'ouvrent pas de PDF. */
  texteFiche?: string;
};

export type ResultatControle = {
  rapport: RapportControle;
  rapportPath: string;
  /** 0 quand aucun arrêt ne manque sans raison, 1 sinon. */
  code: number;
};

type EtatCorpus = {
  documents: Set<string>;
  motifs: Map<string, MotifEcartCjue>;
};

function lireEtatCorpus(rootDir: string): EtatCorpus {
  const dossier = join(rootDir, DOSSIER_CORPUS);
  const documents = new Set<string>();
  const motifs = new Map<string, MotifEcartCjue>();
  try {
    const lignes = readFileSync(join(dossier, "unites.jsonl"), "utf8").split("\n");
    for (const ligne of lignes) {
      if (ligne.trim() === "") continue;
      const valeur = JSON.parse(ligne) as { document?: unknown };
      if (typeof valeur.document === "string") documents.add(valeur.document);
    }
  } catch {
    // Corpus absent : tous les arrêts manquent.
  }
  try {
    const manifeste = JSON.parse(readFileSync(join(dossier, "manifest.json"), "utf8")) as {
      couverture?: { documents_ecartes?: unknown };
    };
    const ecartes = manifeste.couverture?.documents_ecartes;
    if (Array.isArray(ecartes)) {
      for (const ecarte of ecartes) {
        if (typeof ecarte !== "object" || ecarte === null) continue;
        const { celex, motif } = ecarte as { celex?: unknown; motif?: unknown };
        if (typeof celex === "string" && typeof motif === "string") {
          motifs.set(celex, motif as MotifEcartCjue);
        }
      }
    }
  } catch {
    // Un manifeste absent ne bloque pas : les marqueurs de refus restent lus.
  }
  return { documents, motifs };
}

/** Motif durable d'un CELEX : manifeste de la dernière synchronisation ou marqueur de refus. */
function motifDurable(
  rootDir: string,
  celex: string,
  motifs: Map<string, MotifEcartCjue>,
  complementaires: readonly string[],
): MotifEcartCjue | null {
  // Un CELEX ajouté pour la fiche n'a pas de raison durable : une déduction
  // fausse ne doit pas devenir un « absent expliqué » au passage suivant.
  if (complementaires.includes(celex)) return null;
  const duManifeste = motifs.get(celex);
  if (duManifeste !== undefined && MOTIFS_DURABLES.has(duManifeste)) return duManifeste;
  const refuse = lireRefus(rootDir, celex);
  return refuse !== null && MOTIFS_DURABLES.has(refuse) ? refuse : null;
}

/** Écrit un fichier UTF-8 s'il n'a pas déjà exactement ce contenu. */
function ecrireSiChange(chemin: string, contenu: string): void {
  try {
    if (readFileSync(chemin, "utf8") === contenu) return;
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
}

/** Ajoute les CELEX absents du descripteur et rend son contenu inchangé s'il l'est déjà. */
function ajouterComplementaires(descripteurPath: string, celex: readonly string[]): void {
  const descripteur = JSON.parse(readFileSync(descripteurPath, "utf8")) as DescripteurCjue;
  const existants = descripteur.celex_complementaires ?? [];
  const ajouts = celex.filter((valeur) => !existants.includes(valeur));
  if (ajouts.length === 0) return;
  descripteur.celex_complementaires = [...existants, ...ajouts];
  ecrireSiChange(descripteurPath, `${JSON.stringify(descripteur, null, 2)}\n`);
}

function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/** Résumé lisible du rapport, tenu dans le bloc délimité de `coverage.md`. */
export function resumeControle(rapport: RapportControle): string {
  const absents =
    rapport.absents.length === 0
      ? "aucun"
      : rapport.absents
          .map((absent) => `${absent.numeros.join(" et ")} (${absent.motif})`)
          .join(", ");
  return [
    "<!-- controle-curia:debut -->",
    "## Contrôle par la fiche thématique Curia",
    "",
    `Contrôle du ${rapport.consulte_le} : fiche « ${rapport.fiche.titre} »` +
      `${rapport.fiche.edition === null ? "" : ` (${rapport.fiche.edition})`}, ` +
      `${rapport.numeros_affaires} numéros d'affaires pour ${rapport.arrets_fiche} arrêts — ` +
      `${rapport.presents} présents, dont ${rapport.ajoutes} entré(s) par la liste complémentaire, ` +
      `${rapport.absents.length} absent(s) avec raison, ` +
      `${rapport.manquants_sans_raison} manquant(s) sans raison.`,
    "",
    `Fiche : <${rapport.fiche.url}> (page <${rapport.fiche.page}>), consultée le ${rapport.consulte_le}.`,
    `Absents avec raison : ${absents}.`,
    `Rapport : \`${RAPPORT_RELATIF}\`.`,
    "<!-- controle-curia:fin -->",
  ].join("\n");
}

const DEBUT = "<!-- controle-curia:debut -->";
const FIN = "<!-- controle-curia:fin -->";

/** Remplace le bloc de contrôle d'un markdown, ou l'ajoute à la fin. */
export function ecrireResume(chemin: string, resume: string): void {
  let existant = "";
  try {
    existant = readFileSync(chemin, "utf8");
  } catch {
    // Le fichier est créé plus bas.
  }
  const bloc = resume.slice(resume.indexOf(DEBUT), resume.indexOf(FIN) + FIN.length);
  const debut = existant.indexOf(DEBUT);
  const fin = existant.indexOf(FIN);
  let contenu: string;
  if (debut >= 0 && fin > debut) {
    contenu = `${existant.slice(0, debut)}${bloc}${existant.slice(fin + FIN.length)}`;
  } else {
    contenu = `${existant.trimEnd()}${existant.trimEnd() === "" ? "" : "\n\n"}${bloc}\n`;
  }
  ecrireSiChange(chemin, contenu);
}

/**
 * Compare la fiche au corpus et complète le corpus quand un arrêt lui manque
 * sans raison durable. Rien n'est ajouté quand tout est déjà couvert.
 */
export async function controleCuria(options: ControleOptions = {}): Promise<ResultatControle> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteurPath = options.descripteurPath ?? join(ICI, "descripteur.json");
  const consulteLe = options.date ?? dateDuJour();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(consulteLe) || Number.isNaN(Date.parse(consulteLe))) {
    throw new Error(`Date de consultation attendue AAAA-MM-JJ ; reçue « ${consulteLe} »`);
  }

  let snapshot: string | null = null;
  let texte = options.texteFiche;
  if (texte === undefined) {
    const pdf = await telechargerFiche(options.fetchImpl ?? fetch);
    snapshot = relative(rootDir, writeRaw(rootDir, pdf, "pdf"));
    texte = await extraireTexteFiche(pdf);
  }
  const affaires = extraireAffaires(texte);
  const edition = extraireEdition(texte);
  const fetchSparql =
    options.fetchSparql ?? (options.texteFiche === undefined ? fetch : null);
  const descripteur = JSON.parse(readFileSync(descripteurPath, "utf8")) as DescripteurCjue;
  const complementaires = descripteur.celex_complementaires ?? [];

  const resoudre = async (
    affaire: AffaireFiche,
    corpus: EtatCorpus,
  ): Promise<{ celex: string; resolution: ArretControle["resolution"] }> => {
    const deduit = celexArret(affaire.numero);
    if (
      corpus.documents.has(deduit) ||
      motifDurable(rootDir, deduit, corpus.motifs, complementaires) !== null
    ) {
      return { celex: deduit, resolution: "deduit" };
    }
    const resolue =
      fetchSparql === null
        ? null
        : await resoudreArret(affaire.numero, fetchSparql).catch(() => null);
    if (resolue !== null) return { celex: resolue.celex, resolution: resolue.via };
    // Le repli par groupe n'est admis que sur une citation qui porte un ECLI :
    // « les arrêts C-101/01 et C-999/99 » ne prouve pas que le second est joint.
    if (affaire.groupe.length > 1 && affaire.groupeAvecEcli) {
      const premier = celexArret(affaire.groupe[0] ?? affaire.numero);
      if (corpus.documents.has(premier)) return { celex: premier, resolution: "groupe" };
    }
    return { celex: deduit, resolution: "deduit" };
  };

  const etatInitial = lireEtatCorpus(rootDir);
  if (etatInitial.documents.size === 0) {
    throw new Error(
      "Corpus CJUE absent ou vide : lancez npm run cjue:sync avant le contrôle, " +
        "aucun CELEX n'est ajouté à l'aveugle",
    );
  }
  const resolutions: Array<{
    numero: string;
    celex: string;
    resolution: ArretControle["resolution"];
  }> = [];
  for (const affaire of affaires) {
    const { celex, resolution } = await resoudre(affaire, etatInitial);
    resolutions.push({ numero: affaire.numero, celex, resolution });
  }

  const grouper = (
    entrees: typeof resolutions,
    corpus: EtatCorpus,
    complementaires: readonly string[],
  ): ArretControle[] => {
    const parCelex = new Map<string, ArretControle>();
    for (const entree of entrees) {
      const existant = parCelex.get(entree.celex);
      if (existant === undefined) {
        const motif = motifDurable(rootDir, entree.celex, corpus.motifs, complementaires);
        parCelex.set(entree.celex, {
          celex: entree.celex,
          numeros: [entree.numero],
          resolution: entree.resolution,
          etat: corpus.documents.has(entree.celex)
            ? complementaires.includes(entree.celex)
              ? "ajoute"
              : "present"
            : "absent",
          ...(motif === null ? {} : { motif }),
        });
        continue;
      }
      existant.numeros.push(entree.numero);
    }
    return [...parCelex.values()].sort((gauche, droite) =>
      gauche.celex.localeCompare(droite.celex),
    );
  };

  let arrets = grouper(resolutions, etatInitial, complementaires);
  let erreurSync: string | null = null;

  const aAjouter = arrets
    .filter((arret) => arret.etat === "absent" && arret.motif === undefined)
    .map((arret) => arret.celex);
  let ajoutesCePassage = 0;
  if (aAjouter.length > 0) {
    ajouterComplementaires(descripteurPath, aAjouter);
    try {
      await (options.syncImpl ?? syncCjue)({
        rootDir,
        descripteurPath,
        date: consulteLe,
      });
    } catch (error) {
      erreurSync = error instanceof Error ? error.message : String(error);
    }
    const apres = lireEtatCorpus(rootDir);
    const enrichi = JSON.parse(readFileSync(descripteurPath, "utf8")) as DescripteurCjue;
    const complementairesEnrichis = enrichi.celex_complementaires ?? [];
    arrets = grouper(resolutions, apres, complementairesEnrichis);
    ajoutesCePassage = arrets.filter(
      (arret) =>
        arret.etat === "ajoute" && !complementaires.includes(arret.celex),
    ).length;
  }

  const presents = arrets.filter((arret) => arret.etat !== "absent").length;
  const ajoutes = arrets.filter((arret) => arret.etat === "ajoute").length;
  const absentsAvecRaison: RapportControle["absents"] = [];
  let manquantsSansRaison = 0;
  for (const arret of arrets) {
    if (arret.etat !== "absent") continue;
    if (arret.motif === undefined) {
      manquantsSansRaison += 1;
      continue;
    }
    absentsAvecRaison.push({
      celex: arret.celex,
      numeros: arret.numeros,
      motif: arret.motif,
    });
  }

  const rapport: RapportControle = {
    corpus: "cjue",
    fiche: {
      titre: FICHE.titre,
      page: FICHE.page,
      url: FICHE.url,
      snapshot,
      edition,
    },
    consulte_le: consulteLe,
    numeros_affaires: affaires.length,
    arrets_fiche: arrets.length,
    presents,
    ajoutes,
    ajoutes_ce_passage: ajoutesCePassage,
    absents: absentsAvecRaison,
    manquants_sans_raison: manquantsSansRaison,
    arrets,
    erreur_sync: erreurSync,
  };

  const rapportPath = join(rootDir, RAPPORT);
  ecrireSiChange(rapportPath, `${JSON.stringify(rapport, null, 2)}\n`);
  ecrireResume(join(rootDir, COUVERTURE), resumeControle(rapport));

  return { rapport, rapportPath, code: manquantsSansRaison > 0 ? 1 : 0 };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const date = valeurDe("--date", argv);

  const resultat = await controleCuria({
    ...(rootDir === undefined ? {} : { rootDir }),
    ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
    ...(date === undefined ? {} : { date }),
  });
  const { rapport } = resultat;
  process.stderr.write(
    `fiche Curia : ${rapport.numeros_affaires} numéros, ${rapport.arrets_fiche} arrêts, ` +
      `${rapport.presents} présents dont ${rapport.ajoutes} entré(s) par la liste complémentaire, ` +
      `${rapport.absents.length} absent(s) avec raison, ` +
      `${rapport.manquants_sans_raison} manquant(s) sans raison` +
      `${rapport.erreur_sync === null ? "" : ` — synchronisation en échec : ${rapport.erreur_sync}`}\n` +
      `rapport : ${relative(process.cwd(), resultat.rapportPath)}\n`,
  );
  if (rapport.ajoutes_ce_passage > 0) {
    process.stderr.write(
      `${rapport.ajoutes_ce_passage} arrêt(s) ajouté(s) : relancez npm run corpus:index (incrémental) ` +
        "pour les rendre cherchables\n",
    );
  }
  if (resultat.code !== 0) process.exitCode = 1;
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
