/**
 * Synchronise le corpus de préparation : les textes de l'Union en préparation
 * et les affaires pendantes relatives aux données personnelles.
 *
 * Les propositions viennent d'une requête SPARQL sur les dossiers de procédure,
 * leur dernière étape d'une seconde requête sur les événements du dossier, les
 * affaires pendantes d'une troisième ; chaque année observée est ensuite
 * interrogée pour savoir si la décision de même numéro a été rendue. Le texte
 * d'une communication est lu en XHTML et gardé sous `data/raw/preparation/`.
 *
 * Rien n'est écrit au corpus avant que toutes les unités ne soient validées :
 * une panne réseau ou un 5xx interrompt la passe et laisse le corpus existant
 * intact. Une communication absente (404) écarte l'affaire et se compte.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FetchLike } from "../../../veille/fetch.ts";
import { validerUnitesCorpus } from "../parse.ts";
import type { Unite } from "../parse.ts";
import {
  ECARTES_PREPARATION_VIDES,
  ETAPE_NON_TYPEE,
  anneesObservees,
  choisirProposition,
  classerProposition,
  clesDecisions,
  decisionRendue,
  derniereEtape,
  lireAffaires,
  lireEvenements,
  lirePropositions,
  numeroAffaire,
  numeroDepuisCelex,
  pendantPresume,
  posterSparql,
  regrouperParDossier,
  requeteAffaires,
  requeteDecisions,
  requeteEvenements,
  requetePropositions,
} from "./liste.ts";
import type {
  AffaireListee,
  DescripteurPreparation,
  EcartesPreparation,
  EtapeDossier,
  MotifEcartPreparation,
  PropositionListee,
} from "./liste.ts";
import { extraireCommunication, nomFichierCache } from "./parse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "preparation");
/** Dossier du cache des communications, non commité. */
export const DOSSIER_BRUT = join("data", "raw", "preparation");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const BASE_CELEX = "https://publications.europa.eu/resource/celex";
const BASE_EURLEX = "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:";

/** Provenance écrite au manifeste. */
const SOURCE =
  "CELLAR / EUR-Lex — SPARQL (dossiers de procédure, affaires pendantes) et " +
  "communications du Journal officiel en XHTML";
/** Mention de licence rendue avec le corpus. */
const MENTION =
  "Source : CELLAR / EUR-Lex, réutilisation autorisée par la décision 2011/833/UE (CC BY 4.0)";

/** Réponse SPARQL déjà lue : les tests remplacent le réseau. */
export type ReponsesPreparation = {
  propositions?: unknown;
  evenements?: unknown;
  affaires?: unknown;
  /** Réponse de décisions par année observée. */
  decisions?: Record<string, unknown>;
};

export type SyncPreparationOptions = {
  rootDir?: string;
  /** Date de la passe `AAAA-MM-JJ` ; les étapes postérieures sont ignorées. */
  date?: string;
  descripteurPath?: string;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
  reponses?: ReponsesPreparation;
  /** XHTML des communications par CELEX, quand l'appelant connaît déjà les captures. */
  captures?: Record<string, string>;
};

/** Comptes du corpus. */
export type ComptesPreparation = {
  propositions: number;
  affaires: number;
  affaires_presumees: number;
};

/** Bornes d'une période observée. */
export type PeriodePreparation = { min: string | null; max: string | null };

export type DocumentEcartPreparation = { document: string; motif: MotifEcartPreparation };

/** Requêtes SPARQL exactement envoyées, telles quelles au manifeste. */
export type RequetesPreparation = {
  propositions: string;
  evenements: string;
  affaires: string;
  decisions: Record<string, string>;
};

export type CouverturePreparation = {
  source: string;
  requetes: RequetesPreparation;
  consulte_le: string;
  comptes: ComptesPreparation;
  presomption_annees: number;
  /** Critère de sélection en clair, pour l'audit du manifeste. */
  selection: string;
  /** CELEX des actes dont la modification suffit à faire entrer une unité. */
  actes_suivis: string[];
  /** CELEX des propositions retenues par leur numéro COM. */
  propositions_ajoutees: string[];
  /** Règle d'appariement affaire → décision, pour l'audit du manifeste. */
  appariement: string;
  exclusions: EcartesPreparation;
  documents_ecartes: DocumentEcartPreparation[];
  /** Affaires sans décision depuis plus de `presomption_annees`, dites présumées. */
  presumees: Array<{ document: string; numero: string }>;
  periode: { propositions: PeriodePreparation; affaires: PeriodePreparation };
  mention: string;
};

export type ManifestePreparation = {
  corpus: string;
  nom: string;
  titre: string;
  source: string;
  date_extraction: string;
  licence: string;
  documents: number;
  unites: number;
  couverture: CouverturePreparation;
};

export type ResultatPreparation = {
  propositions: number;
  affaires: number;
  affairesPresumees: number;
  unites: number;
  exclusions: EcartesPreparation;
  documentsEcartes: DocumentEcartPreparation[];
  telechargements: number;
  ecrit: boolean;
  manifestPath: string;
  unitesPath: string;
};

/** Lit le descripteur du corpus. */
export function lireDescripteurPreparation(chemin: string): DescripteurPreparation {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurPreparation;
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

/** Lit un fichier texte ; `null` s'il est absent. */
function lireFichier(chemin: string): string | null {
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
}

/** Nombre de lignes non vides d'un fichier ; `0` s'il est absent. */
function lireNombreLignes(chemin: string): number {
  return (lireFichier(chemin) ?? "").split("\n").filter((ligne) => ligne.trim() !== "").length;
}

function dateDuJour(instant = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

function attendre(ms: number): Promise<void> {
  return new Promise((reussir) => setTimeout(reussir, ms));
}

/** Chemin du cache d'une communication. */
export function cheminCache(rootDir: string, celex: string): string {
  return join(rootDir, DOSSIER_BRUT, nomFichierCache(celex));
}

/**
 * Télécharge la communication d'un CELEX depuis CELLAR, en français, en suivant
 * les redirections. Un 404 vaut `capture_absente` ; un 429 ou un 503 est retenté
 * trois fois avec un recul croissant ; une panne réseau ou un autre 5xx lève
 * après les tentatives, sans rien écrire.
 */
export async function telechargerCommunication(
  celex: string,
  descripteur: DescripteurPreparation,
  fetchImpl: FetchLike = fetch,
): Promise<{ texte: string } | { motif: "capture_absente" }> {
  const langue = descripteur.langues[0] ?? "fra";
  const tentatives = 3;
  let derniereRaison = "réponse illisible";

  for (let tentative = 1; tentative <= tentatives; tentative += 1) {
    let statut: number | null = null;
    try {
      const reponse = await fetchImpl(`${BASE_CELEX}/${celex}`, {
        headers: { Accept: "application/xhtml+xml", "Accept-Language": langue },
        redirect: "follow",
      });
      statut = reponse.status;
      if (statut === 404) return { motif: "capture_absente" };
      if (reponse.ok) {
        const texte = await reponse.text();
        return texte.trim() === "" ? { motif: "capture_absente" } : { texte };
      }
      derniereRaison = `HTTP ${statut}`;
    } catch (error) {
      derniereRaison = error instanceof Error ? error.message : String(error);
    }
    if (statut !== null && statut !== 429 && statut !== 503) break;
    if (tentative < tentatives) await attendre(descripteur.delai_ms * 2 ** (tentative - 1));
  }
  throw new Error(
    `CELLAR ${celex} : ${derniereRaison} — la passe s'arrête, le corpus existant reste intact`,
  );
}

/** `Protection des données personnelles` → `protection des données personnelles`. */
function minusculeInitiale(texte: string): string {
  return `${texte.charAt(0).toLowerCase()}${texte.slice(1)}`;
}

/** `2025-09-16` → `16/09/2025`. */
function dateFrancaise(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/**
 * Objet d'une proposition : sa matière et les actes du corpus qu'elle vise, avec
 * leur libellé court. Seuls les actes réellement modifiés par cette proposition
 * sont nommés. Une proposition ne peut pas être indexée par son texte intégral :
 * le corpus en donne l'objet et la dernière étape. Une proposition ajoutée par
 * son numéro COM prend son libellé propre en tête de l'objet.
 */
function objetProposition(
  proposition: PropositionListee,
  descripteur: DescripteurPreparation,
): string {
  const ajoutee = (descripteur.propositions_ajoutees ?? []).find(
    (candidate) => candidate.celex === proposition.celex,
  );
  if (ajoutee !== undefined) return `Objet : ${ajoutee.libelle}.`;
  // Une proposition hors PDON, retenue parce qu'elle modifie un acte suivi qui
  // n'appartient pas au socle, ne peut pas se dire « matière protection des
  // données personnelles » : elle nomme l'acte qui la fait entrer.
  const socle = new Set(descripteur.actes_du_corpus.map((acte) => acte.celex));
  const nouveaux = descripteur.actes_suivis.filter(
    (acte) => !socle.has(acte.celex) && proposition.actesVises.includes(acte.celex),
  );
  if (!proposition.pdon && nouveaux.length > 0) {
    return (
      "Hors matière protection des données personnelles, retenue parce qu'elle " +
      "modifie un acte suivi. Actes suivis visés : " +
      `${nouveaux.map((acte) => `${acte.libelle} (${acte.celex})`).join(", ")}.`
    );
  }
  const matiere = `Matière CELLAR : ${minusculeInitiale(descripteur.matiere_libelle)}.`;
  const vises = descripteur.actes_du_corpus.filter((acte) =>
    proposition.actesVises.includes(acte.celex),
  );
  if (vises.length === 0) return matiere;
  return (
    `${matiere} Actes du corpus visés : ` +
    `${vises.map((acte) => `${acte.libelle} (${acte.celex})`).join(", ")}.`
  );
}

/** Unité d'une proposition en préparation : jamais applicable, statut `PROPOSE`. */
export function uniteProposition(
  proposition: PropositionListee,
  etape: EtapeDossier | null,
  descripteur: DescripteurPreparation,
): Unite {
  if (proposition.date === null) {
    throw new Error(`Proposition ${proposition.celex} : date de document absente`);
  }
  const titre = proposition.titre ?? proposition.ref;
  const lignes = [titre, objetProposition(proposition, descripteur)];
  if (etape !== null) {
    lignes.push(
      `Dernière étape : ${etape.type ?? ETAPE_NON_TYPEE} le ${dateFrancaise(etape.date)}`,
    );
  }
  return {
    ref: `${proposition.celex}#proposition`,
    document: proposition.celex,
    corpus: descripteur.corpus,
    niveau: "proposition",
    numero: proposition.ref,
    chemin: `${descripteur.nom} > Textes en préparation > ${proposition.ref}`,
    texte: lignes.join("\n\n"),
    date_acte: proposition.date,
    date_debut: proposition.date,
    date_fin: null,
    statut: "PROPOSE",
    url: `${BASE_EURLEX}${proposition.celex}`,
    titre,
    ...(etape === null
      ? {}
      : { derniere_etape: `${etape.type ?? ETAPE_NON_TYPEE} — ${etape.date}` }),
  };
}

/**
 * Unité d'une affaire pendante : le texte de sa communication, son numéro lisible
 * et son lien Curia. Elle n'est jamais une décision rendue.
 */
export function uniteAffaire(
  affaire: AffaireListee,
  numero: string,
  texte: string,
  descripteur: DescripteurPreparation,
  datePasse: string,
): Unite {
  const attaquee =
    affaire.attackedCelex === null ? null : numeroDepuisCelex(affaire.attackedCelex);
  const decisionAttaquee =
    attaquee === null || affaire.attackedCelex === null
      ? null
      : `${attaquee} (${affaire.attackedCelex})`;
  return {
    ref: `${affaire.celex}#affaire`,
    document: affaire.celex,
    corpus: descripteur.corpus,
    niveau: "affaire",
    numero,
    chemin: `${descripteur.nom} > Affaires pendantes > ${numero}`,
    texte,
    date_acte: affaire.date,
    date_debut: affaire.date,
    date_fin: null,
    statut: "PENDANT",
    url: descripteur.url_curia.replace("{numero}", numero.replace(/\s+P$/, "")),
    ...(decisionAttaquee === null ? {} : { decision_attaquee: decisionAttaquee }),
    ...(pendantPresume(affaire.date, datePasse, descripteur.presomption_annees)
      ? { pendant_presume: true }
      : {}),
  };
}

/** Bornes de dates d'acte d'un ensemble d'unités. */
function bornes(unites: readonly Unite[]): PeriodePreparation {
  let min: string | null = null;
  let max: string | null = null;
  for (const unite of unites) {
    if (min === null || unite.date_acte < min) min = unite.date_acte;
    if (max === null || unite.date_acte > max) max = unite.date_acte;
  }
  return { min, max };
}

/** Ordre stable : propositions puis affaires, chacune par numéro. */
function ordonner(unites: readonly Unite[]): Unite[] {
  return [...unites].sort(
    (gauche, droite) =>
      (gauche.niveau === droite.niveau ? 0 : gauche.niveau === "proposition" ? -1 : 1) ||
      gauche.numero.localeCompare(droite.numero, "fr", { numeric: true }) ||
      gauche.ref.localeCompare(droite.ref),
  );
}

/**
 * Synchronise le corpus. Les listes sont toujours redemandées ; les
 * communications déjà en cache ne sont pas retéléchargées. Une passe identique
 * rend les mêmes octets et ne réécrit rien.
 */
export async function syncPreparation(
  options: SyncPreparationOptions = {},
): Promise<ResultatPreparation> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurPreparation(
    options.descripteurPath ?? join(ICI, "descripteur.json"),
  );
  const datePasse = options.date ?? dateDuJour();
  if (!DATE_ISO.test(datePasse) || Number.isNaN(Date.parse(datePasse))) {
    throw new Error(`Date de passe attendue AAAA-MM-JJ ; reçue « ${datePasse} »`);
  }
  const reponses = options.reponses ?? {};
  const fetchImpl = options.fetchImpl ?? fetch;

  const documentsEcartes: DocumentEcartPreparation[] = [];
  const ecarter = (document: string, motif: MotifEcartPreparation): void => {
    documentsEcartes.push({ document, motif });
  };
  /**
   * Un même document peut apparaître dans deux dossiers (par exemple
   * `52018PC0636`) : les exclusions sont comptées et listées par document, une
   * seule fois, pour que les comptes du manifeste se recoupent.
   */
  const bilan = (): {
    documentsEcartes: DocumentEcartPreparation[];
    exclusions: EcartesPreparation;
  } => {
    const parDocument = new Map<string, DocumentEcartPreparation>();
    for (const ecarte of documentsEcartes) {
      if (!parDocument.has(ecarte.document)) parDocument.set(ecarte.document, ecarte);
    }
    const liste = [...parDocument.values()].sort(
      (gauche, droite) =>
        gauche.document.localeCompare(droite.document) || gauche.motif.localeCompare(droite.motif),
    );
    const comptes: EcartesPreparation = { ...ECARTES_PREPARATION_VIDES };
    for (const ecarte of liste) comptes[ecarte.motif] += 1;
    return { documentsEcartes: liste, exclusions: comptes };
  };

  // 1. Propositions : une seule par dossier, puis classement. Les dossiers sont
  // parcourus dans un ordre stable pour que deux passes rendent les mêmes octets.
  const requeteP = requetePropositions(descripteur);
  const reponseP = reponses.propositions ?? (await posterSparql(descripteur, requeteP, fetchImpl));
  const retenues: PropositionListee[] = [];
  const celexRetenus = new Set<string>();
  const groupes = [...regrouperParDossier(lirePropositions(reponseP)).entries()].sort(
    (gauche, droite) => gauche[0].localeCompare(droite[0]),
  );
  for (const [, candidats] of groupes) {
    const proposition = choisirProposition(candidats);
    const verdict = classerProposition(proposition);
    if (!verdict.retenue) {
      ecarter(proposition.celex, verdict.motif);
      continue;
    }
    if (proposition.date === null) {
      ecarter(proposition.celex, "date_invalide");
      continue;
    }
    // Deux dossiers peuvent porter la même proposition : elle n'entre qu'une fois.
    if (celexRetenus.has(proposition.celex)) continue;
    celexRetenus.add(proposition.celex);
    retenues.push(proposition);
  }

  // 2. Dernière étape de chaque dossier retenu, à la date de la passe.
  const dossiers = retenues.map((proposition) => proposition.dossier);
  const requeteE = requeteEvenements(dossiers);
  const etapesParDossier = new Map<string, EtapeDossier[]>();
  if (dossiers.length > 0) {
    const reponseE = reponses.evenements ?? (await posterSparql(descripteur, requeteE, fetchImpl));
    for (const etape of lireEvenements(reponseE)) {
      const etapes = etapesParDossier.get(etape.dossier);
      if (etapes === undefined) etapesParDossier.set(etape.dossier, [etape]);
      else etapes.push(etape);
    }
  }

  // 3. Affaires pendantes, puis décisions rendues de chaque année observée.
  const requeteA = requeteAffaires(descripteur);
  const reponseA = reponses.affaires ?? (await posterSparql(descripteur, requeteA, fetchImpl));
  const affaires = lireAffaires(reponseA);
  const requetesDecisions: Record<string, string> = {};
  const decisions = new Set<string>();
  for (const annee of anneesObservees(affaires)) {
    const requete = requeteDecisions(annee);
    requetesDecisions[annee] = requete;
    const reponse =
      reponses.decisions?.[annee] ?? (await posterSparql(descripteur, requete, fetchImpl));
    for (const cle of clesDecisions(reponse)) decisions.add(cle);
  }
  const pendantes: AffaireListee[] = [];
  for (const affaire of affaires) {
    if (decisionRendue(affaire, decisions)) {
      ecarter(affaire.celex, "decision_rendue");
      continue;
    }
    pendantes.push(affaire);
  }
  pendantes.sort((gauche, droite) => gauche.celex.localeCompare(droite.celex));

  const unitesPath = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const manifestPath = join(rootDir, DOSSIER_CORPUS, "manifest.json");

  if (options.dryRun === true) {
    const etat = bilan();
    return {
      propositions: retenues.length,
      affaires: pendantes.length,
      affairesPresumees: pendantes.filter((affaire) =>
        pendantPresume(affaire.date, datePasse, descripteur.presomption_annees),
      ).length,
      unites: 0,
      exclusions: etat.exclusions,
      documentsEcartes: etat.documentsEcartes,
      telechargements: 0,
      ecrit: false,
      manifestPath,
      unitesPath,
    };
  }

  // 4. Unités : propositions d'abord, puis communications des affaires pendantes.
  const unites: Unite[] = [];
  for (const proposition of retenues) {
    const etapes = etapesParDossier.get(proposition.dossier) ?? [];
    unites.push(uniteProposition(proposition, derniereEtape(etapes, datePasse), descripteur));
  }

  let telechargements = 0;
  let premierTelechargement = true;
  for (const affaire of pendantes) {
    const cache = cheminCache(rootDir, affaire.celex);
    let capture = options.captures?.[affaire.celex] ?? lireFichier(cache);
    if (capture === null) {
      if (!premierTelechargement) await attendre(descripteur.delai_ms);
      premierTelechargement = false;
      const resultat = await telechargerCommunication(affaire.celex, descripteur, fetchImpl);
      telechargements += 1;
      if ("motif" in resultat) {
        ecarter(affaire.celex, resultat.motif);
        continue;
      }
      capture = resultat.texte;
    }
    ecrireSiChange(cache, capture);
    const communication = extraireCommunication(capture, affaire.celex);
    if (communication === null) {
      ecarter(affaire.celex, "texte_vide");
      continue;
    }
    const numero = communication.numero ?? numeroAffaire(affaire);
    unites.push(uniteAffaire(affaire, numero, communication.texte, descripteur, datePasse));
  }

  const ordonnees = ordonner(unites);
  validerUnitesCorpus(ordonnees, "préparation");
  if (ordonnees.length === 0 && lireNombreLignes(unitesPath) > 0) {
    throw new Error(
      "Aucune unité produite alors que le corpus existant n'est pas vide : " +
        "le corpus reste intact, vérifiez les listes CELLAR et les captures.",
    );
  }

  const etat = bilan();
  const propositionsUnites = ordonnees.filter((unite) => unite.niveau === "proposition");
  const affairesUnites = ordonnees.filter((unite) => unite.niveau === "affaire");
  const manifeste: ManifestePreparation = {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    source: SOURCE,
    date_extraction: datePasse,
    licence: descripteur.licence,
    documents: new Set(ordonnees.map((unite) => unite.document)).size,
    unites: ordonnees.length,
    couverture: {
      source: SOURCE,
      requetes: {
        propositions: requeteP,
        evenements: requeteE,
        affaires: requeteA,
        decisions: requetesDecisions,
      },
      consulte_le: datePasse,
      comptes: {
        propositions: propositionsUnites.length,
        affaires: affairesUnites.length,
        affaires_presumees: affairesUnites.filter((unite) => unite.pendant_presume === true)
          .length,
      },
      presomption_annees: descripteur.presomption_annees,
      selection:
        "matière CELLAR PDON, proposition modifiant un acte suivi ou proposition " +
        "ajoutée par son numéro COM ; affaire Eurovoc 5181/5595 ou question " +
        "préjudicielle portant sur un acte suivi",
      actes_suivis: descripteur.actes_suivis.map((acte) => acte.celex),
      propositions_ajoutees: (descripteur.propositions_ajoutees ?? []).map(
        (proposition) => proposition.celex,
      ),
      appariement:
        "juridiction (C/T) + année + numéro CELEX ; affaires jointes résolues par case-law_joins_case_court",
      exclusions: etat.exclusions,
      documents_ecartes: etat.documentsEcartes,
      presumees: affairesUnites
        .filter((unite) => unite.pendant_presume === true)
        .map((unite) => ({ document: unite.document, numero: unite.numero })),
      periode: {
        propositions: bornes(propositionsUnites),
        affaires: bornes(affairesUnites),
      },
      mention: MENTION,
    },
  };

  const ecritUnites = ecrireSiChange(
    unitesPath,
    `${ordonnees.map((unite) => JSON.stringify(unite)).join("\n")}${
      ordonnees.length === 0 ? "" : "\n"
    }`,
  );
  const ecritManifeste = ecrireSiChange(manifestPath, `${JSON.stringify(manifeste, null, 2)}\n`);

  return {
    propositions: propositionsUnites.length,
    affaires: affairesUnites.length,
    affairesPresumees: manifeste.couverture.comptes.affaires_presumees,
    unites: ordonnees.length,
    exclusions: etat.exclusions,
    documentsEcartes: etat.documentsEcartes,
    telechargements,
    ecrit: ecritUnites || ecritManifeste,
    manifestPath,
    unitesPath,
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

  const resultat = await syncPreparation({
    ...(rootDir === undefined ? {} : { rootDir }),
    ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
    ...(date === undefined ? {} : { date }),
    dryRun,
  });

  const ecartes = Object.entries(resultat.exclusions)
    .filter(([, compte]) => compte > 0)
    .map(([motif, compte]) => `${motif}=${compte}`)
    .join(", ");
  process.stderr.write(
    dryRun
      ? `dry-run : ${resultat.propositions} proposition(s) retenue(s), ` +
          `${resultat.affaires} affaire(s) pendante(s) à lire, rien n'est écrit\n`
      : `${resultat.propositions} proposition(s), ${resultat.affaires} affaire(s) pendante(s) ` +
          `(${resultat.affairesPresumees} présumée(s)), ${resultat.unites} unité(s), ` +
          `${resultat.telechargements} téléchargement(s) ; ` +
          `écartées ${ecartes || "aucune"}` +
          `${resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé"}\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
