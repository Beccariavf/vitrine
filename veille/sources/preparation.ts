/**
 * Veille des changements de statut des textes en préparation et des affaires
 * pendantes du corpus `preparation`.
 *
 * Les documents suivis sont les unités du corpus lui-même (`unites.jsonl`) :
 * une proposition `PROP_PENDING` et une affaire `PENDANT`. La source relit leur
 * statut dans CELLAR par SPARQL, avec les requêtes du corpus réutilisées en
 * import, et n'écrit une entrée que pour un changement : dossier adopté (avec
 * l'acte `3…` membre du dossier), retiré ou rejeté, affaire fermée par une
 * décision `CJ`/`CO`/`TJ`/`TO` de même numéro.
 *
 * L'entrée porte le statut d'avant et d'après, et la suite du corpus : un acte
 * adopté qui modifie ou remplace un acte d'un corpus de textes porte son corpus
 * (`corpus_vise`), sinon il est « hors corpus » ; une décision rendue porte son
 * CELEX pour que `cjue:sync` l'accueille ou l'ajoute aux CELEX complémentaires.
 *
 * Le délai entre un arrêt rendu et sa présence dans CELLAR n'est pas mesuré :
 * `date_acte` porte la date de l'acte, `publishedAt` la date de détection.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FetchLike } from "../fetch.ts";
import type { Entry } from "../types.ts";
import { typeCelex } from "../../mcp/corpus/cjue/liste.ts";
import {
  celexDeJonction,
  cleAffaire,
  dateIso,
  lignesSparql,
  posterSparql,
  requeteDecisions,
} from "../../mcp/corpus/preparation/liste.ts";
import type { DescripteurPreparation } from "../../mcp/corpus/preparation/liste.ts";
import { lireDescripteurPreparation } from "../../mcp/corpus/preparation/sync.ts";
import { actesSuivis, dateFr } from "./eurlex.ts";

/** Identifiant de la source de veille. */
export const SOURCE_ID = "preparation";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Dossier du corpus de préparation, relatif à la racine du dépôt. */
export const DOSSIER_CORPUS = join("data", "corpus", "preparation");
/** Descripteur et corpus des actes suivis : du code, lu depuis ce fichier. */
export const DESCRIPTEUR_PREPARATION = join(
  ICI,
  "..",
  "..",
  "mcp",
  "corpus",
  "preparation",
  "descripteur.json",
);
export const DOSSIER_DESCRIPTEURS = join(ICI, "..", "..", "mcp", "corpus");

/**
 * Ordre de préférence quand un acte adopté touche plusieurs corpus de textes :
 * l'acte de base de la protection des données d'abord, puis ses voisins.
 */
const ORDRE_CORPUS_ACTES = [
  "rgpd",
  "aiact",
  "eprivacy",
  "police",
  "eudpr",
  "rgpdproc",
  "ccs",
  "donnees",
  "sante_ue",
];

/**
 * Un document suivi, lu dans le corpus de préparation. Son statut de corpus
 * (`PROPOSE`, `PENDANT`) n'est pas recopié : `statut_avant` porte le libellé du
 * dossier CELLAR (`PROP_PENDING`, `PENDANT`), celui que la requête compare.
 */
export type Suivi = {
  document: string;
  niveau: "proposition" | "affaire";
  /** Référence de procédure (`2025/0360/COD`) ou numéro d'affaire (`C-703/25 P`). */
  numero: string;
  /** Titre CELLAR de la proposition, quand le corpus le porte. */
  titre?: string;
};

/** Statut CELLAR d'une proposition suivie, toutes lignes réunies. */
export type StatutLu = {
  /** Statuts de dossier observés (`PROP_PENDING`, `PROP_ADOPTED`…). */
  statuts: Set<string>;
  /** Vrai quand le dossier marque la proposition comme retirée. */
  retire: boolean;
  /** Actes adoptés membres du dossier, avec leur date (`null` si absente). */
  actes: Map<string, string | null>;
  /** Actes du corpus que la proposition ou l'acte adopté modifie ou remplace. */
  bases: Set<string>;
};

/** Corpus de textes visé par un acte adopté. */
export type CorpusVise = { corpus: string; nom: string };

/** Un changement de statut détecté, avant mise en entrée. */
export type Changement =
  | {
      genre: "adoption";
      suivi: Suivi;
      statutAvant: string;
      statutApres: "PROP_ADOPTED";
      /** CELEX de l'acte adopté, absent quand le dossier n'en sert aucun. */
      acte?: string;
      dateActe: string | null;
      corpus: CorpusVise | null;
    }
  | {
      genre: "retrait" | "rejet";
      suivi: Suivi;
      statutAvant: string;
      statutApres: "RETIRE" | "PROP_REJECTED";
    }
  | {
      genre: "arret";
      suivi: Suivi;
      statutAvant: string;
      statutApres: string;
      decision: string;
      dateActe: string | null;
    };

/** Réponses SPARQL déjà lues : les tests remplacent le réseau. */
export type ReponsesPreparationVeille = {
  propositions?: unknown;
  /** Réponse des décisions rendues, par année observée. */
  decisions?: Record<string, unknown>;
  /** Réponse des dates des décisions retenues, une seule requête groupée. */
  dates?: unknown;
};

export type PassePreparationOptions = {
  rootDir: string;
  fetchImpl?: FetchLike;
  /** Date de la passe : `publishedAt` de chaque entrée. */
  maintenant?: Date;
  /** Documents suivis déjà lus, pour les tests. */
  suivis?: Suivi[];
  /** Corpus des actes de textes suivi, CELEX → corpus, pour les tests. */
  corpusActes?: Map<string, CorpusVise>;
  reponses?: ReponsesPreparationVeille;
  /** Attente entre deux requêtes SPARQL, en millisecondes. */
  delaiMs?: number;
};

export type ResultatPassePreparation = {
  suivis: Suivi[];
  entries: Entry[];
  warnings: string[];
  notes: string[];
};

const CELEX_DECISION = /^6\d{4}[A-Z]{2}\d{4}(?:\(\d+\))?$/;

type Binding = { value?: unknown };

function valeur(ligne: Record<string, Binding>, nom: string): string | null {
  const brut = ligne[nom]?.value;
  return typeof brut === "string" && brut.trim() !== "" ? brut : null;
}

/** Dernier segment d'une URI, ou la valeur telle quelle quand ce n'en est pas une. */
function valeurCourte(valeurBrute: string): string {
  if (!/^https?:\/\//i.test(valeurBrute)) return valeurBrute;
  const sansFin = valeurBrute.replace(/\/+$/, "");
  const index = sansFin.lastIndexOf("/");
  return index < 0 ? sansFin : sansFin.slice(index + 1);
}

function attendre(ms: number): Promise<void> {
  return new Promise((reussir) => setTimeout(reussir, ms));
}

/**
 * Documents suivis du corpus : une proposition et une affaire par unité, triées
 * par identifiant. Un corpus absent ou illisible fait échouer la passe en
 * nommant le chemin, plutôt que de conclure à l'absence de changement.
 */
export function documentsSuivis(rootDir: string): Suivi[] {
  const chemin = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  let texte: string;
  try {
    texte = readFileSync(chemin, "utf8");
  } catch (error) {
    throw new Error(
      `Corpus preparation illisible (${chemin}) : lancez npm run preparation:sync`,
      { cause: error },
    );
  }
  const suivis: Suivi[] = [];
  for (const ligne of texte.split("\n")) {
    if (ligne.trim() === "") continue;
    let unite: Record<string, unknown>;
    try {
      const valeurLue: unknown = JSON.parse(ligne);
      if (typeof valeurLue !== "object" || valeurLue === null) continue;
      unite = valeurLue as Record<string, unknown>;
    } catch {
      continue;
    }
    if (typeof unite.document !== "string" || typeof unite.numero !== "string") continue;
    if (unite.niveau !== "proposition" && unite.niveau !== "affaire") continue;
    suivis.push({
      document: unite.document,
      niveau: unite.niveau,
      numero: unite.numero,
      ...(typeof unite.titre === "string" ? { titre: unite.titre } : {}),
    });
  }
  return suivis.sort((gauche, droite) => gauche.document.localeCompare(droite.document));
}

/**
 * Requête du statut des propositions suivies : le dossier de chaque proposition,
 * son statut, son retrait, l'acte `3…` qu'il contient et les actes visés par la
 * proposition ou par l'acte adopté. `FILTER(STR(?celex) IN …)` plutôt que
 * `VALUES` : CELLAR sert ses CELEX en `xsd:string`, qu'un littéral simple ne
 * rejoint pas.
 */
export function requeteStatuts(propositions: readonly string[]): string {
  const valeurs = propositions.map((proposition) => `"${proposition}"`).join(",");
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?statut ?retire ?acteAdopte ?acteDate ?proposeCelex ?amendCelex ?remplaceCelex WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(STR(?celex) IN (${valeurs}))
  { ?work cdm:act_preparatory_initiates_dossier ?dossier }
  UNION
  { ?dossier cdm:dossier_contains_work ?work }
  OPTIONAL { ?dossier cdm:procedure_code_interinstitutional_has_status_file-status ?statut }
  OPTIONAL { ?dossier cdm:dossier_withdrawn-proposal ?retire }
  OPTIONAL {
    ?work cdm:resource_legal_proposes_to_amend_resource_legal ?baseP .
    ?baseP cdm:resource_legal_id_celex ?proposeCelex
  }
  OPTIONAL {
    ?dossier cdm:dossier_contains_work ?acte .
    ?acte cdm:resource_legal_id_celex ?acteAdopte .
    FILTER(STRSTARTS(STR(?acteAdopte), "3"))
    OPTIONAL { ?acte cdm:work_date_document ?acteDate }
    OPTIONAL {
      ?acte cdm:resource_legal_amends_resource_legal ?baseA .
      ?baseA cdm:resource_legal_id_celex ?amendCelex
    }
    OPTIONAL {
      ?acte cdm:resource_legal_repeals_resource_legal ?baseR .
      ?baseR cdm:resource_legal_id_celex ?remplaceCelex
    }
  }
}`;
}

/** Statuts des propositions d'une réponse SPARQL, réunis par CELEX. */
export function lireStatuts(reponse: unknown): Map<string, StatutLu> {
  const statuts = new Map<string, StatutLu>();
  for (const ligne of lignesSparql(reponse)) {
    const celex = valeur(ligne, "celex");
    if (celex === null) continue;
    const actuel = statuts.get(celex) ?? {
      statuts: new Set<string>(),
      retire: false,
      actes: new Map<string, string | null>(),
      bases: new Set<string>(),
    };
    const statut = valeur(ligne, "statut");
    if (statut !== null) actuel.statuts.add(valeurCourte(statut));
    const retire = valeur(ligne, "retire");
    if (retire === "1" || retire?.toLowerCase() === "true") actuel.retire = true;
    const acte = valeur(ligne, "acteAdopte");
    if (acte !== null) {
      const date = dateIso(valeur(ligne, "acteDate"));
      const connue = actuel.actes.get(acte);
      actuel.actes.set(acte, connue ?? date);
    }
    // Trois propriétés distinctes : la proposition propose de modifier, l'acte
    // adopté modifie ou remplace. Des variables séparées, sans quoi CELLAR ne
    // sert pas la proposition quand l'acte adopté ne porte aucune des deux.
    for (const variable of ["proposeCelex", "amendCelex", "remplaceCelex"]) {
      const base = valeur(ligne, variable);
      if (base !== null) actuel.bases.add(base);
    }
    statuts.set(celex, actuel);
  }
  return statuts;
}

/** Requête des dates des décisions retenues par la veille. */
export function requeteDatesArrets(celex: readonly string[]): string {
  const valeurs = celex.map((identifiant) => `"${identifiant}"`).join(",");
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?date WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(STR(?celex) IN (${valeurs}))
  ?work cdm:work_date_document ?date .
}`;
}

/** Dates d'une réponse SPARQL, par CELEX ; une date illisible est ignorée. */
export function lireDates(reponse: unknown): Map<string, string> {
  const dates = new Map<string, string>();
  for (const ligne of lignesSparql(reponse)) {
    const celex = valeur(ligne, "celex");
    const date = dateIso(valeur(ligne, "date"));
    if (celex !== null && date !== null && !dates.has(celex)) dates.set(celex, date);
  }
  return dates;
}

/**
 * Décisions rendues d'une réponse SPARQL, par clé d'affaire. Une affaire jointe
 * est fermée par le CELEX de l'arrêt principal, que `case-law_joins_case_court`
 * relie à son numéro. Un arrêt prime sur une ordonnance, un CELEX de base sur un
 * corrigendum, et un résumé (`_SUM`) ou un extrait (`_RES`) n'est jamais la
 * décision : il ne se télécharge pas.
 */
export function decisionsParCle(reponse: unknown): Map<string, string> {
  const decisions = new Map<string, string>();
  const retenir = (cle: string, celex: string): void => {
    const connue = decisions.get(cle);
    if (
      connue === undefined ||
      rangDecision(celex) < rangDecision(connue) ||
      (rangDecision(celex) === rangDecision(connue) && celex < connue)
    ) {
      decisions.set(cle, celex);
    }
  };
  for (const ligne of lignesSparql(reponse)) {
    const celex = valeur(ligne, "celex");
    if (celex === null || !CELEX_DECISION.test(celex)) continue;
    const cle = cleAffaire(celex);
    if (cle !== null) retenir(cle, celex);
    const joined = valeur(ligne, "joined");
    const joint = joined === null ? null : celexDeJonction(joined);
    const cleJointe = joint === null ? null : cleAffaire(joint);
    if (cleJointe !== null && cleJointe !== cle) retenir(cleJointe, celex);
  }
  return decisions;
}

/** Un arrêt prime sur une ordonnance, un CELEX de base sur son corrigendum. */
function rangDecision(celex: string): number {
  const nature = /^6\d{4}([A-Z]{2})/.exec(celex)?.[1] ?? "";
  return (celex.includes("(") ? 2 : 0) + (nature.endsWith("O") ? 1 : 0);
}

/** Années des affaires suivies, triées. */
export function anneesSuivies(suivis: readonly Suivi[]): string[] {
  return [
    ...new Set(
      suivis
        .filter((suivi) => suivi.niveau === "affaire")
        .map((suivi) => suivi.document.slice(1, 5))
        .filter((annee) => /^\d{4}$/.test(annee)),
    ),
  ].sort();
}

/** Corpus de textes suivi : CELEX de l'acte de base → corpus et libellé. */
export function corpusDesActes(dossier: string): Map<string, CorpusVise> {
  const corpus = new Map<string, CorpusVise>();
  for (const acte of actesSuivis(dossier)) {
    corpus.set(acte.document, { corpus: acte.corpus, nom: acte.nom });
  }
  return corpus;
}

/**
 * Corpus de textes touché par une proposition ou son acte adopté. Un acte qui en
 * touche plusieurs est signalé par le premier corpus dans l'ordre de
 * `ORDRE_CORPUS_ACTES` ; le rapport n'en nomme qu'un.
 */
export function corpusVise(
  bases: Iterable<string>,
  corpus: ReadonlyMap<string, CorpusVise>,
): CorpusVise | null {
  const touchés = [...new Set(bases)]
    .map((base) => corpus.get(base))
    .filter((vise): vise is CorpusVise => vise !== undefined);
  const rangs = touchés
    .map((vise) => ({ vise, rang: ORDRE_CORPUS_ACTES.indexOf(vise.corpus) }))
    .filter(({ rang }) => rang >= 0)
    .sort((gauche, droite) => gauche.rang - droite.rang || gauche.vise.corpus.localeCompare(droite.vise.corpus));
  return rangs[0]?.vise ?? null;
}

/**
 * Acte adopté d'un dossier : le premier par CELEX (le CELEX de base précède son
 * corrigendum), avec sa date et le corpus de textes visé par la proposition ou
 * par l'acte.
 */
export function choisirActeAdopte(
  statut: StatutLu,
  corpus: ReadonlyMap<string, CorpusVise>,
): { acte: string; date: string | null; corpus: CorpusVise | null } | null {
  const actes = [...statut.actes.entries()].sort(([gauche], [droite]) =>
    gauche.localeCompare(droite),
  );
  const choisi = actes[0];
  if (choisi === undefined) return null;
  return { acte: choisi[0], date: choisi[1], corpus: corpusVise(statut.bases, corpus) };
}

/** Entrées et notes d'une liste de changements. */
export function entreesDesChangements(
  changements: readonly Changement[],
  datePasse: string,
): Entry[] {
  return changements.map((changement) => entreeDeChangement(changement, datePasse));
}

function idDeChangement(changement: Changement): string {
  const suite =
    changement.genre === "adoption"
      ? (changement.acte ?? "")
      : changement.genre === "arret"
        ? changement.decision
        : "";
  return createHash("sha256")
    .update(
      `${SOURCE_ID}|${changement.genre}|${changement.suivi.document}|${changement.statutApres}|${suite}`,
      "utf8",
    )
    .digest("hex")
    .slice(0, 16);
}

function titreDeChangement(changement: Changement): string {
  const { suivi, statutAvant, statutApres } = changement;
  if (changement.genre === "adoption") {
    const date = changement.dateActe === null ? "" : ` le ${dateFr(changement.dateActe)}`;
    const acte =
      changement.acte === undefined ? "acte non identifié" : `acte ${changement.acte}`;
    const prefixe =
      changement.corpus === null ? "Texte adopté" : `${changement.corpus.nom} : texte adopté`;
    return `${prefixe}${date} — ${suivi.numero}, ${statutAvant} → ${statutApres} (${acte})`;
  }
  if (changement.genre === "arret") {
    const date = changement.dateActe === null ? "" : ` le ${dateFr(changement.dateActe)}`;
    return `Affaire jugée${date} — ${suivi.numero}, ${statutAvant} → ${changement.decision}`;
  }
  const verbe = changement.genre === "retrait" ? "retirée" : "rejetée";
  return `Proposition ${verbe} — ${suivi.numero}, ${statutAvant} → ${statutApres}`;
}

function urlDeChangement(changement: Changement): string {
  if (changement.genre === "adoption" && changement.acte !== undefined) {
    return `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${changement.acte}`;
  }
  if (changement.genre === "arret") {
    return `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${changement.decision}`;
  }
  return `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${changement.suivi.document}`;
}

function entreeDeChangement(changement: Changement, datePasse: string): Entry {
  const titre = titreDeChangement(changement);
  const corpusVise = changement.genre === "adoption" ? changement.corpus : null;
  const decision = changement.genre === "arret" ? changement.decision : undefined;
  const acte = changement.genre === "adoption" ? changement.acte : undefined;
  const dateActe =
    changement.genre === "adoption" || changement.genre === "arret"
      ? changement.dateActe
      : null;
  return {
    id: idDeChangement(changement),
    title: titre,
    officialTitle: changement.suivi.titre ?? titre,
    url: urlDeChangement(changement),
    // La date de la passe est celle de la détection : l'entrée entre dans la
    // fenêtre de `corpus:sync` même quand l'acte ou l'arrêt est plus ancien.
    publishedAt: `${datePasse}T12:00:00.000Z`,
    summary: null,
    references: [],
    themes: [corpusVise?.corpus === "aiact" ? "ia" : "donnees-personnelles"],
    source: SOURCE_ID,
    document: changement.suivi.document,
    version: changement.statutApres,
    numero: changement.suivi.numero,
    statut_avant: changement.statutAvant,
    statut_apres: changement.statutApres,
    ...(dateActe === null ? {} : { date_acte: dateActe }),
    ...(acte === undefined ? {} : { acte_adopte: acte }),
    ...(decision === undefined ? {} : { decision }),
    ...(corpusVise === null ? {} : { corpus_vise: corpusVise.corpus }),
  };
}

/** Changements d'une liste de suivis et des réponses déjà lues. */
export function detecterChangements(
  suivis: readonly Suivi[],
  statuts: ReadonlyMap<string, StatutLu>,
  decisions: ReadonlyMap<string, string>,
  dates: ReadonlyMap<string, string>,
  corpus: ReadonlyMap<string, CorpusVise>,
): Changement[] {
  const changements: Changement[] = [];
  for (const suivi of suivis) {
    if (suivi.niveau === "proposition") {
      const statut = statuts.get(suivi.document);
      if (statut === undefined) continue;
      const statutAvant = "PROP_PENDING";
      if (statut.retire) {
        changements.push({
          genre: "retrait",
          suivi,
          statutAvant,
          statutApres: "RETIRE",
        });
        continue;
      }
      if (statut.statuts.has("PROP_ADOPTED")) {
        const acte = choisirActeAdopte(statut, corpus);
        changements.push({
          genre: "adoption",
          suivi,
          statutAvant,
          statutApres: "PROP_ADOPTED",
          dateActe: acte?.date ?? null,
          corpus: acte?.corpus ?? null,
          ...(acte === null ? {} : { acte: acte.acte }),
        });
        continue;
      }
      if (statut.statuts.has("PROP_REJECTED")) {
        changements.push({
          genre: "rejet",
          suivi,
          statutAvant,
          statutApres: "PROP_REJECTED",
        });
      }
      continue;
    }
    const cle = cleAffaire(suivi.document);
    const decision = cle === null ? undefined : decisions.get(cle);
    if (decision === undefined) continue;
    changements.push({
      genre: "arret",
      suivi,
      statutAvant: "PENDANT",
      statutApres: typeCelex(decision),
      decision,
      dateActe: dates.get(decision) ?? null,
    });
  }
  return changements;
}

/** Libellé d'un changement pour la sortie de la passe. */
export function noteDeChangement(changement: Changement): string {
  const commun = `${changement.suivi.numero} — ${changement.statutAvant} → ${changement.statutApres}`;
  if (changement.genre === "adoption") {
    const acte = changement.acte === undefined ? "acte non identifié" : `acte ${changement.acte}`;
    const suite =
      changement.corpus === null
        ? "hors corpus, aucune création"
        : `corpus ${changement.corpus.corpus} : en attente de consolidation`;
    return `${SOURCE_ID} : ${commun}, ${acte}, ${suite}`;
  }
  if (changement.genre === "arret") {
    return `${SOURCE_ID} : ${commun}, décision ${changement.decision}, à verser à la CJUE`;
  }
  return `${SOURCE_ID} : ${commun}`;
}

/** Lit une réponse, ou l'interroge ; seule une requête réseau attend son tour. */
async function lireOuDemander(
  fournie: unknown,
  requete: () => string,
  interroger: (requete: string) => Promise<unknown>,
  politesse: () => Promise<void>,
): Promise<unknown> {
  if (fournie !== undefined) return fournie;
  await politesse();
  return interroger(requete());
}

/**
 * Une passe : relit le statut des documents suivis, puis les décisions des
 * années observées, et ne rend que les changements. Aucun changement n'écrit
 * rien. La date de décision n'est demandée que si une affaire est jugée.
 */
export async function passePreparation(
  options: PassePreparationOptions,
): Promise<ResultatPassePreparation> {
  const datePasse = (options.maintenant ?? new Date()).toISOString().slice(0, 10);
  const suivis = options.suivis ?? documentsSuivis(options.rootDir);
  const corpus = options.corpusActes ?? corpusDesActes(DOSSIER_DESCRIPTEURS);
  const descripteur: DescripteurPreparation = lireDescripteurPreparation(
    DESCRIPTEUR_PREPARATION,
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  const delai = options.delaiMs ?? descripteur.delai_ms;
  const reponses = options.reponses ?? {};

  let derniereRequete = false;
  const politesse = async (): Promise<void> => {
    if (derniereRequete && delai > 0) await attendre(delai);
    derniereRequete = true;
  };
  const interroger = (requete: string): Promise<unknown> =>
    posterSparql(descripteur, requete, fetchImpl);

  const notes: string[] = [
    `${SOURCE_ID} : ${suivis.length} document(s) suivi(s) — ` +
      `${suivis.filter((suivi) => suivi.niveau === "proposition").length} proposition(s), ` +
      `${suivis.filter((suivi) => suivi.niveau === "affaire").length} affaire(s)`,
  ];
  const warnings: string[] = [];
  const propositions = suivis
    .filter((suivi) => suivi.niveau === "proposition")
    .map((suivi) => suivi.document);

  let statuts = new Map<string, StatutLu>();
  if (propositions.length > 0) {
    const reponse = await lireOuDemander(
      reponses.propositions,
      () => requeteStatuts(propositions),
      interroger,
      politesse,
    );
    statuts = lireStatuts(reponse);
    for (const proposition of propositions) {
      if (!statuts.has(proposition)) {
        warnings.push(`${SOURCE_ID} : ${proposition} absent de la réponse CELLAR`);
      }
    }
  }

  const decisions = new Map<string, string>();
  for (const annee of anneesSuivies(suivis)) {
    const reponse = await lireOuDemander(
      reponses.decisions?.[annee],
      () => requeteDecisions(annee),
      interroger,
      politesse,
    );
    for (const [cle, celex] of decisionsParCle(reponse)) {
      if (!decisions.has(cle)) decisions.set(cle, celex);
    }
  }

  let changements = detecterChangements(suivis, statuts, decisions, new Map(), corpus);
  const arrets = changements.filter(
    (changement): changement is Extract<Changement, { genre: "arret" }> =>
      changement.genre === "arret",
  );
  let dates = new Map<string, string>();
  if (arrets.length > 0) {
    const celex = [...new Set(arrets.map((arret) => arret.decision))].sort();
    const reponse = await lireOuDemander(
      reponses.dates,
      () => requeteDatesArrets(celex),
      interroger,
      politesse,
    );
    dates = lireDates(reponse);
    changements = detecterChangements(suivis, statuts, decisions, dates, corpus);
  }

  for (const changement of changements) {
    if (changement.genre === "adoption" && changement.acte === undefined) {
      warnings.push(
        `${SOURCE_ID} : ${changement.suivi.numero} adopté sans acte identifié au dossier`,
      );
    }
    notes.push(noteDeChangement(changement));
  }
  if (changements.length === 0) notes.push(`${SOURCE_ID} : aucun changement de statut`);

  return {
    suivis,
    entries: entreesDesChangements(changements, datePasse),
    warnings,
    notes,
  };
}
