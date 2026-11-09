import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MARGE, SEUIL_BAS, SEUIL_HAUT, niveauConfiance } from "../confidence.ts";
import { createOllamaEmbedder } from "../embed/embedder.ts";
import type { Embedder } from "../embed/embedder.ts";
import { cheminIndex, lireUnites } from "../index/build.ts";
import { openIndex } from "../index/search.ts";
import type { Index } from "../index/search.ts";
import { referenceExacte, search } from "../tools.ts";

const ICI = dirname(fileURLToPath(import.meta.url));
const QUESTIONS = join(ICI, "questions.csv");
const RACINE = fileURLToPath(new URL("../..", import.meta.url));

/** Un pli de validation croisée : blocs contigus de `ceil(n / 4)`. */
export const NB_PLIS = 4;

export type Split = "dev" | "test";
export type FiltreSplit = Split | "all";
export type ModeRecherche = "dense" | "hybride";

export type TypeQuestion = "reference" | "conceptuelle" | "piege";

export type Question = {
  question: string;
  type: TypeQuestion;
  attendues: string[];
  piege: boolean;
  split: Split;
  /** Corpus visé ; absent, il se déduit du préfixe des références attendues. */
  corpus?: string;
};

export type Seuils = { bas: number; haut: number; marge: number };

export type Classement = { attendues: string[]; rendus: string[] };
export type ClassementPiege = { piege: boolean; refusee: boolean };

/** Un jeu de questions et la présence éventuelle de la colonne `split`. */
export type Jeu = {
  questions: Question[];
  /** Faux pour un jeu sans split : le rapport le dit et n'ajuste aucun seuil. */
  avecSplit: boolean;
};

const ENTETE = "question,type,sources_attendues,piege,split";
const ENTETE_SANS_SPLIT = "question,type,sources_attendues,piege";
/** En-têtes avec une colonne `corpus` finale : le jeu dit sa collection. */
const ENTETE_CORPUS = "question,type,sources_attendues,piege,corpus";
const ENTETE_SPLIT_CORPUS = "question,type,sources_attendues,piege,split,corpus";

type Entete = { avecSplit: boolean; avecCorpus: boolean };

/** Reconnaît les quatre en-têtes admis ; `null` sinon. */
function lireEntete(entete: string | undefined): Entete | null {
  switch (entete) {
    case ENTETE:
      return { avecSplit: true, avecCorpus: false };
    case ENTETE_SANS_SPLIT:
      return { avecSplit: false, avecCorpus: false };
    case ENTETE_CORPUS:
      return { avecSplit: false, avecCorpus: true };
    case ENTETE_SPLIT_CORPUS:
      return { avecSplit: true, avecCorpus: true };
    default:
      return null;
  }
}

const TYPES: TypeQuestion[] = ["reference", "conceptuelle", "piege"];
const SPLITS: Split[] = ["dev", "test"];

/**
 * Lit un CSV de questions ; lève sur une ligne mal formée. Un en-tête à quatre
 * colonnes (`question,type,sources_attendues,piege`) décrit un jeu sans split :
 * ses lignes valent `dev` pour le filtrage, sans prétendre à une calibration.
 * Une colonne `corpus` finale nomme la collection visée.
 */
export function lireJeu(csv: string): Jeu {
  const lignes = csv
    .split(/\r?\n/)
    .filter((ligne) => ligne.trim() !== "");
  const entete = lignes.shift();
  const reconnu = lireEntete(entete);
  if (reconnu === null) {
    throw new Error(`En-tête inattendu : ${entete ?? "(vide)"}`);
  }
  const { avecSplit, avecCorpus } = reconnu;

  const questions = lignes.map((ligne, index) => {
    const champs = ligne.split(",");
    const attendu = 4 + (avecSplit ? 1 : 0) + (avecCorpus ? 1 : 0);
    if (champs.length !== attendu) {
      throw new Error(`Ligne ${index + 2} illisible : ${ligne}`);
    }
    const [question = "", type = "", sources = "", piege = ""] = champs;
    const split = avecSplit ? (champs[4] ?? "") : "dev";
    const corpus = avecCorpus ? (champs[avecSplit ? 5 : 4] ?? "") : "";
    if (!TYPES.includes(type as TypeQuestion)) {
      throw new Error(`Ligne ${index + 2} : type inconnu « ${type} »`);
    }
    if (piege !== "oui" && piege !== "non") {
      throw new Error(`Ligne ${index + 2} : colonne piege attendue oui ou non`);
    }
    if (piege === "oui" && sources !== "") {
      throw new Error(
        `Ligne ${index + 2} : un piège ne cite pas de source attendue (« ${sources} »)`,
      );
    }
    if (!SPLITS.includes(split as Split)) {
      throw new Error(`Ligne ${index + 2} : split attendu dev ou test, reçu « ${split} »`);
    }
    return {
      question,
      type: type as TypeQuestion,
      attendues: sources === "" ? [] : sources.split("|"),
      piege: piege === "oui",
      split: split as Split,
      ...(corpus === "" ? {} : { corpus }),
    };
  });

  return { questions, avecSplit };
}

/** Lit `questions.csv` ; lève sur une ligne mal formée. */
export function lireQuestions(csv: string): Question[] {
  return lireJeu(csv).questions;
}

/** Document d'une référence : le préfixe avant `#`. */
function documentDe(ref: string): string {
  const document = ref.split("#")[0] ?? "";
  if (document === "") throw new Error(`Référence sans document : « ${ref} »`);
  return document;
}

/** Garde les questions d'un split ; `all` les garde toutes. */
export function filtrerSplit(questions: Question[], split: FiltreSplit): Question[] {
  return split === "all" ? questions : questions.filter((question) => question.split === split);
}

/** Corpus d'une référence, déduit du préfixe de son document. */
export function corpusDeReference(ref: string): string {
  const document = documentDe(ref);
  if (document === "32016R0679") return "rgpd";
  if (document === "32024R1689") return "aiact";
  if (/^CNILTEXT/i.test(document)) return "cnil";
  throw new Error(`Corpus inconnu pour la référence « ${ref} »`);
}

/**
 * Un jeu ne couvre qu'un corpus : un rapport ne mélange jamais deux collections.
 * La colonne `corpus` fait foi quand elle existe ; sinon le préfixe des
 * références attendues la donne. Une question qui viserait deux corpus lève.
 */
export function corpusDuJeu(questions: Question[]): string {
  const corpus = new Set<string>();
  for (const question of questions) {
    const deduits = new Set(
      question.attendues.map((ref) => (question.corpus ?? corpusDeReference(ref))),
    );
    if (deduits.size > 1) {
      throw new Error(
        `La question « ${question.question} » vise plusieurs corpus : ` +
          `${[...deduits].sort().join(", ")}`,
      );
    }
    for (const valeur of deduits) corpus.add(valeur);
  }
  if (corpus.size === 0) {
    throw new Error("Aucune référence attendue : impossible de déduire le corpus du jeu");
  }
  if (corpus.size > 1) {
    throw new Error(`Questions de plusieurs corpus : ${[...corpus].sort().join(", ")}`);
  }
  return [...corpus][0] ?? "";
}

/**
 * Échoue avant toute mesure si une référence attendue manque au corpus. Une
 * référence sans `#` vise un document entier : `documents` porte alors les
 * identifiants de document du corpus.
 */
export function validerReferences(
  questions: Question[],
  refs: Set<string>,
  documents?: Set<string>,
): void {
  for (const question of questions) {
    for (const ref of question.attendues) {
      if (refs.has(ref)) continue;
      if (documents !== undefined && !ref.includes("#") && documents.has(ref)) continue;
      throw new Error(`Référence attendue absente du corpus : ${ref} (${question.question})`);
    }
  }
}

/**
 * Vrai si une référence rendue satisfait une attendue : égalité exacte quand
 * l'attendue porte un `#`, appartenance au même document sinon.
 */
export function refSatisfaite(rendue: string, attendue: string): boolean {
  return attendue.includes("#") ? rendue === attendue : rendue.split("#")[0] === attendue;
}

/** Vrai si l'une des attendues est satisfaite par `rendue`. */
function satisfait(rendue: string, attendues: string[]): boolean {
  return attendues.some((attendue) => refSatisfaite(rendue, attendue));
}

/** Part des questions à référence dont une attendue figure dans les cinq premiers. */
export function recallAt5(classements: Classement[]): number {
  const pertinents = classements.filter((classement) => classement.attendues.length > 0);
  if (pertinents.length === 0) return 0;
  const trouves = pertinents.filter((classement) =>
    classement.rendus.slice(0, 5).some((ref) => satisfait(ref, classement.attendues)),
  ).length;
  return trouves / pertinents.length;
}

/** Part des questions dont le premier passage rendu est une référence attendue. */
export function precisionAt1(classements: Classement[]): number {
  const pertinents = classements.filter((classement) => classement.attendues.length > 0);
  if (pertinents.length === 0) return 0;
  const justes = pertinents.filter((classement) =>
    satisfait(classement.rendus[0] ?? "", classement.attendues),
  ).length;
  return justes / pertinents.length;
}

/** Moyenne de l'inverse du rang de la première référence attendue. */
export function mrr(classements: Classement[]): number {
  const pertinents = classements.filter((classement) => classement.attendues.length > 0);
  if (pertinents.length === 0) return 0;
  const somme = pertinents.reduce((total, classement) => {
    const rang = classement.rendus.findIndex((ref) => satisfait(ref, classement.attendues));
    return total + (rang === -1 ? 0 : 1 / (rang + 1));
  }, 0);
  return somme / pertinents.length;
}

/**
 * Part des pièges qui rendent au moins un passage. Un pli sans piège vaut zéro
 * par convention ; l'appelant rapporte alors le nombre de pièges mesurés.
 */
export function tauxCitationsInvalides(classements: ClassementPiege[]): number {
  const pieges = classements.filter((classement) => classement.piege);
  if (pieges.length === 0) return 0;
  return pieges.filter((classement) => !classement.refusee).length / pieges.length;
}

/** Intervalle de confiance à 95 % d'une proportion, méthode de Wilson. */
export function intervalleWilson(succes: number, total: number): [number, number] {
  if (total === 0) return [0, 0];
  const z = 1.959963984540054;
  const proportion = succes / total;
  const denominateur = 1 + (z * z) / total;
  const centre = (proportion + (z * z) / (2 * total)) / denominateur;
  const demiLargeur =
    (z * Math.sqrt((proportion * (1 - proportion)) / total + (z * z) / (4 * total * total))) /
    denominateur;
  return [Math.max(0, centre - demiLargeur), Math.min(1, centre + demiLargeur)];
}

/** Une mesure du test, appendue au marqueur v3 : un modèle, ses seuils, ses chiffres. */
export type MesureMarqueur = {
  modele: string;
  dimensions: number;
  date: string;
  seuils: Seuils;
  agregats: Resume;
};

/** Marqueur v3 : une empreinte de questions, et une mesure par modèle pré-déclaré. */
export type MarqueurV3 = {
  note: string;
  questions_sha256: string;
  mesures: MesureMarqueur[];
};

/** `questions-v2.csv` → `questions-v2.test-consomme.json`, dans le même dossier. */
export function cheminMarqueur(cheminQuestions: string): string {
  const nom = basename(cheminQuestions).replace(/\.csv$/i, "");
  return join(dirname(cheminQuestions), `${nom}.test-consomme.json`);
}

type MarqueurLu =
  | { format: "absent" }
  | { format: "illisible"; date: string; hash: string }
  | { format: "v2"; date: string; hash: string }
  | { format: "v3"; marqueur: MarqueurV3 };

/** Lit le marqueur ; un fichier à plat (v2) est reconnu comme consommé, pas comme v3. */
function lireMarqueur(cheminMarqueurPath: string): MarqueurLu {
  if (!existsSync(cheminMarqueurPath)) return { format: "absent" };
  let brut: unknown;
  try {
    brut = JSON.parse(readFileSync(cheminMarqueurPath, "utf8"));
  } catch {
    return { format: "illisible", date: "date inconnue", hash: "empreinte inconnue" };
  }
  if (typeof brut !== "object" || brut === null) {
    return { format: "illisible", date: "date inconnue", hash: "empreinte inconnue" };
  }
  const objet = brut as Record<string, unknown>;
  const date = typeof objet.date === "string" ? objet.date : "date inconnue";
  const hash = typeof objet.questions_sha256 === "string" ? objet.questions_sha256 : "empreinte inconnue";
  if (!Array.isArray(objet.mesures)) return { format: "v2", date, hash };
  return {
    format: "v3",
    marqueur: {
      note: typeof objet.note === "string" ? objet.note : "",
      questions_sha256: hash,
      mesures: objet.mesures as MesureMarqueur[],
    },
  };
}

/**
 * Refuse une seconde mesure du test pour le même modèle et la même empreinte de
 * questions. Un autre modèle pré-déclaré reste accepté. Un marqueur à plat (v2)
 * est refusé quel que soit le modèle : ce test-là est consommé.
 */
export function verifierTestNonConsomme(
  cheminMarqueurPath: string,
  questionsSha: string,
  modele: string,
): void {
  const lu = lireMarqueur(cheminMarqueurPath);
  if (lu.format === "absent") return;
  if (lu.format === "illisible") {
    throw new Error(
      `Test déjà consommé (marqueur illisible, marqueur ${cheminMarqueurPath}). ` +
        "Le test ne se mesure qu'une fois.",
    );
  }
  if (lu.format === "v2") {
    throw new Error(
      `Test déjà consommé le ${lu.date} (marqueur v2 à plat, questions ${lu.hash}, ` +
        `marqueur ${cheminMarqueurPath}). Le test v2 est consommé quel que soit le modèle ; ` +
        "un marqueur v3 est exigé.",
    );
  }
  if (lu.marqueur.questions_sha256 !== questionsSha) {
    throw new Error(
      `Marqueur lié à une autre empreinte de questions (${lu.marqueur.questions_sha256}, ` +
        `attendu ${questionsSha}, marqueur ${cheminMarqueurPath}). Le jeu figé ne se modifie plus.`,
    );
  }
  const deja = lu.marqueur.mesures.find((mesure) => mesure.modele === modele);
  if (deja !== undefined) {
    throw new Error(
      `Test déjà consommé pour le modèle « ${modele} » le ${deja.date} ` +
        `(questions ${questionsSha}, marqueur ${cheminMarqueurPath}). ` +
        "Chaque modèle ne se mesure qu'une fois.",
    );
  }
}

/**
 * Ajoute une mesure au marqueur sans effacer les précédentes. `note` dit d'où
 * viennent les chiffres ; elle est fournie par l'appelant.
 */
export function ecrireMesureTest(
  cheminMarqueurPath: string,
  questionsSha: string,
  mesure: MesureMarqueur,
  note: string,
): void {
  const lu = lireMarqueur(cheminMarqueurPath);
  if (lu.format === "v2" || lu.format === "illisible") {
    throw new Error(
      `Marqueur existant non convertible (${cheminMarqueurPath}). ` +
        "Le marqueur v2 à plat ne reçoit aucune mesure v3.",
    );
  }
  const mesures = lu.format === "absent" ? [] : lu.marqueur.mesures;
  const existant: MarqueurV3 =
    lu.format === "absent"
      ? { note, questions_sha256: questionsSha, mesures }
      : lu.marqueur;
  if (existant.questions_sha256 !== questionsSha) {
    throw new Error(
      `Marqueur lié à une autre empreinte de questions (${existant.questions_sha256}, ` +
        `attendu ${questionsSha}).`,
    );
  }
  const marqueur: MarqueurV3 = {
    note,
    questions_sha256: questionsSha,
    mesures: [...existant.mesures, mesure],
  };
  writeFileSync(cheminMarqueurPath, `${JSON.stringify(marqueur, null, 2)}\n`, "utf8");
}

/** Découpe en `plis` blocs contigus de `ceil(n / plis)`. */
export function repartirPlis<T>(elements: T[], plis = NB_PLIS): T[][] {
  const blocs: T[][] = [];
  const taille = Math.ceil(elements.length / plis);
  for (let debut = 0; debut < elements.length; debut += taille) {
    blocs.push(elements.slice(debut, debut + taille));
  }
  return blocs;
}

/** Une mesure sans seuil : rang et similarités bruts, réutilisables par chaque grille. */
export type Mesure = {
  question: Question;
  refs: string[];
  distances: number[];
};

function grille(debut: number, fin: number, pas: number): number[] {
  const valeurs: number[] = [];
  for (let valeur = debut; valeur <= fin + 1e-9; valeur += pas) {
    valeurs.push(Number(valeur.toFixed(2)));
  }
  return valeurs;
}

function refusee(mesure: Mesure, seuils: Seuils): boolean {
  return niveauConfiance(mesure.distances.map((distance) => ({ distance })), false, seuils) ===
    "aucun_resultat_fiable";
}

/**
 * Choisit les seuils sur un jeu de mesures : d'abord le plus de décisions
 * justes (piège refusé, question à référence rendue), puis le moins de pièges
 * cités, puis le plus de références exactes rendues « confiant », puis les
 * seuils les plus prudents. Une question `test` fait lever : le split tenu à
 * l'écart ne règle aucun seuil.
 */
export function calibrer(mesures: Mesure[]): Seuils {
  const fuite = mesures.find((mesure) => mesure.question.split === "test");
  if (fuite !== undefined) {
    throw new Error(`Calibration interdite sur une question test : « ${fuite.question.question} »`);
  }

  let meilleur: { seuils: Seuils; score: number[] } | null = null;

  for (const bas of grille(0.2, 0.8, 0.01)) {
    for (const haut of grille(bas + 0.05, 0.95, 0.05)) {
      for (const marge of [0.01, 0.02, 0.05]) {
        const seuils: Seuils = { bas, haut, marge };
        let corrects = 0;
        let invalides = 0;
        let confiants = 0;
        for (const mesure of mesures) {
          const niveau = niveauConfiance(
            mesure.distances.map((distance) => ({ distance })),
            false,
            seuils,
          );
          const refusee = niveau === "aucun_resultat_fiable";
          if (mesure.question.piege) {
            if (!refusee) invalides += 1;
            else corrects += 1;
          } else {
            if (!refusee) corrects += 1;
            if (
              niveau === "confiant" &&
              mesure.refs.slice(0, 5).some((ref) => satisfait(ref, mesure.question.attendues))
            ) {
              confiants += 1;
            }
          }
        }
        const score = [-corrects, invalides, -confiants, -bas, -marge, -haut];
        if (meilleur === null || comparer(score, meilleur.score) < 0) meilleur = { seuils, score };
      }
    }
  }

  if (meilleur === null) throw new Error("Aucun seuil candidat");
  return meilleur.seuils;
}

/** Comparaison lexicographique de deux scores. */
function comparer(gauche: number[], droite: number[]): number {
  for (let index = 0; index < Math.max(gauche.length, droite.length); index += 1) {
    const difference = (gauche[index] ?? 0) - (droite[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export type Pli = {
  numero: number;
  seuils: Seuils;
  pieges: number;
  cites: number;
  taux: number;
};

/** Calibre sur trois plis, mesure les citations invalides sur le quatrième. */
export function validerCroise(mesures: Mesure[], plis = NB_PLIS): Pli[] {
  return repartirPlis(mesures, plis).map((pli, index) => {
    const tenusAEcart = new Set(pli);
    const entrainement = mesures.filter((mesure) => !tenusAEcart.has(mesure));
    const seuils = calibrer(entrainement);
    // « article 100 » est refusé par le court-circuit exact, pas par les seuils :
    // il ne doit pas gonfler le dénominateur des pièges mesurés.
    const classements: ClassementPiege[] = pli
      .filter((mesure) => !estExacte(mesure))
      .map((mesure) => ({
        piege: mesure.question.piege,
        refusee: refusee(mesure, seuils),
      }));
    const pieges = classements.filter((classement) => classement.piege);
    return {
      numero: index + 1,
      seuils,
      pieges: pieges.length,
      cites: pieges.filter((classement) => !classement.refusee).length,
      taux: tauxCitationsInvalides(classements),
    };
  });
}

function pourcentage(valeur: number): string {
  return `${(valeur * 100).toFixed(1)} %`;
}

function arrondi(valeur: number): string {
  return valeur.toFixed(3);
}

/** Une mesure par question, sans seuil : les passages sont toujours rendus. */
async function mesurer(
  rootDir: string,
  questions: Question[],
  embedder: Embedder,
  index: Index,
  corpus: string,
  recherche: ModeRecherche,
): Promise<Mesure[]> {
  const mesures: Mesure[] = [];
  for (const question of questions) {
    const resultat = await search(
      rootDir,
      { question: question.question, k: 5, corpus },
      { embedder, index, seuils: { bas: -1, haut: 2, marge: 0 }, recherche },
    );
    mesures.push({
      question,
      refs: resultat.passages.map((passage) => passage.ref),
      distances: resultat.passages.map((passage) => passage.distance),
    });
  }
  return mesures;
}

function compter(mesures: Mesure[], type: TypeQuestion): number {
  return mesures.filter((mesure) => mesure.question.type === type).length;
}

/** Vrai si la question est servie par le court-circuit exact, sans vecteurs. */
function estExacte(mesure: Mesure): boolean {
  return referenceExacte(mesure.question.question) !== null;
}

function classer(mesures: Mesure[]): Classement[] {
  return mesures.map((mesure) => ({ attendues: mesure.question.attendues, rendus: mesure.refs }));
}

/** Similarité du premier passage, seule à décider du niveau de confiance. */
function premiereSimilarite(mesure: Mesure): number {
  return 1 - (mesure.distances[0] ?? Number.POSITIVE_INFINITY);
}

/** Nom court d'une référence : `art_17` plutôt que `32016R0679#art_17`. */
function refCourte(ref: string): string {
  const courte = ref.split("#")[1] ?? ref;
  return /^f\d+$/.test(courte) ? ref : courte;
}

type PositionAttendue = { question: Question; rang: number; similarite: number | null };

/** Rang et similarité de la première référence attendue, `rang = 0` si absente. */
function positionAttendue(mesure: Mesure): PositionAttendue {
  const index = mesure.refs.findIndex((ref) => satisfait(ref, mesure.question.attendues));
  return {
    question: mesure.question,
    rang: index === -1 ? 0 : index + 1,
    similarite:
      index === -1
        ? null
        : 1 - (mesure.distances[index] ?? Number.POSITIVE_INFINITY),
  };
}

/** Vrai si le premier passage est un considérant alors qu'un article était attendu. */
function teteConsiderant(mesure: Mesure): boolean {
  return (
    (mesure.refs[0] ?? "").includes("#rct_") &&
    mesure.question.attendues.some((ref) => ref.includes("#art_"))
  );
}

/** Décrit un premier passage inattendu : `attendu ← rendu`, ou `null` s'il est attendu. */
function teteInattendue(mesure: Mesure): string | null {
  const premier = mesure.refs[0];
  if (premier === undefined || satisfait(premier, mesure.question.attendues)) return null;
  const attendues = mesure.question.attendues.map(refCourte).join("|");
  return `${attendues} ← ${refCourte(premier)}`;
}

/** Rang de `ref` dans les passages rendus, `0` si absent. */
function rangDe(mesure: Mesure | undefined, ref: string): number {
  if (mesure === undefined) return 0;
  return mesure.refs.indexOf(ref) + 1;
}

function niveau(mesure: Mesure, seuils: Seuils) {
  return niveauConfiance(
    mesure.distances.map((distance) => ({ distance })),
    false,
    seuils,
  );
}

/** Le rapport d'un split : `dev` règle, `test` constate avec les seuils figés. */
function rapport(mesures: Mesure[], seuils: Seuils, origineSeuils: string): string[] {
  const exactes = mesures.filter((mesure) => !mesure.question.piege && estExacte(mesure));
  const semantiques = mesures.filter((mesure) => !mesure.question.piege && !estExacte(mesure));
  const classementsSemantiques = classer(semantiques);
  const positions = semantiques.map(positionAttendue);
  const considerants = semantiques.filter(teteConsiderant);
  const inattendues = semantiques
    .map(teteInattendue)
    .filter((valeur): valeur is string => valeur !== null);

  const piegesSeuil = mesures.filter((mesure) => mesure.question.piege && !estExacte(mesure));
  const piegesDeterministes = mesures.filter((mesure) => mesure.question.piege && estExacte(mesure));
  const piegesCites = piegesSeuil.filter((mesure) => !refusee(mesure, seuils));
  const piegesConfiants = piegesSeuil.filter((mesure) => niveau(mesure, seuils) === "confiant");
  const incertaines = semantiques.filter((mesure) => niveau(mesure, seuils) === "incertain");
  const confiantes = semantiques.filter((mesure) => niveau(mesure, seuils) === "confiant");
  const refusees = semantiques.filter((mesure) => refusee(mesure, seuils));

  const paraphrase = mesures.find(
    (mesure) => mesure.question.question === "droit de récupérer mes données",
  );
  const rangParaphrase = rangDe(paraphrase, "32016R0679#art_20");

  return [
    `jeu : ${mesures.length} questions (${compter(mesures, "reference")} références, ` +
      `${compter(mesures, "conceptuelle")} conceptuelles, ${compter(mesures, "piege")} pièges)`,
    `seuils : bas=${arrondi(seuils.bas)} haut=${arrondi(seuils.haut)} marge=${arrondi(seuils.marge)} (${origineSeuils})`,
    `références exactes : ${exactes.length} questions, rang 1 par construction ` +
      `(recall@5 ${arrondi(recallAt5(classer(exactes)))}, MRR ${arrondi(mrr(classer(exactes)))})`,
    `recherche sémantique : ${semantiques.length} questions, recall@5 ` +
      `${arrondi(recallAt5(classementsSemantiques))} ` +
      `(${classementsSemantiques.filter((classement) => classement.rendus.slice(0, 5).some((ref) => satisfait(ref, classement.attendues))).length}/${semantiques.length}), ` +
      `MRR ${arrondi(mrr(classementsSemantiques))}`,
    `top-1 sémantique : ${pourcentage(precisionAt1(classementsSemantiques))}`,
    `niveaux sémantiques : ${confiantes.length} confiant, ${incertaines.length} incertain, ${refusees.length} aucun_resultat_fiable`,
    `pièges : ${piegesSeuil.length} par seuil, ${piegesDeterministes.length} déterministe ` +
      `(${piegesDeterministes.map((mesure) => mesure.question.question).join(" · ") || "aucun"})`,
    `pièges cités : ${piegesCites.length}/${piegesSeuil.length}` +
      `${piegesCites.length === 0 ? "" : ` (${piegesCites.map((mesure) => mesure.question.question).join(" · ")})`}`,
    `pièges confiants : ${piegesConfiants.length}` +
      `${piegesConfiants.length === 0 ? "" : ` (${piegesConfiants.map((mesure) => mesure.question.question).join(" · ")})`}`,
    `référence attendue, rang et similarité :`,
    ...(positions.length === 0
      ? ["  aucune question sémantique"]
      : positions.map(
          (position) =>
            `  ${position.question.question} → ` +
            `${position.question.attendues.map(refCourte).join("|")} : rang ` +
            `${position.rang === 0 ? "absent" : position.rang}` +
            `${position.similarite === null ? "" : ` (${arrondi(position.similarite)})`}`,
        )),
    `premiers passages inattendus : ${inattendues.length === 0 ? "aucun" : inattendues.join(" · ")}`,
    `têtes considérant pour un article attendu : ${considerants.length}/${semantiques.length}` +
      (considerants.length === 0
        ? ""
        : ` (${considerants
            .map(
              (mesure) =>
                `${mesure.question.attendues.map(refCourte).join("|")} ← ` +
                `${refCourte(mesure.refs[0] ?? "")}`,
            )
            .join(" · ")})`),
    `paraphrase « droit de récupérer mes données » → art_20 : ` +
      (paraphrase === undefined
        ? "question absente de ce split"
        : rangParaphrase === 0
          ? "hors des cinq premiers (top 5 : non)"
          : `rang ${rangParaphrase} (top 5 : oui)`),
  ];
}

/** Chiffres de tête, sans mise en forme : ils alimentent le marqueur du test. */
export type Resume = {
  semantiques: number;
  top5_semantique_succes: number;
  top1_semantique_succes: number;
  mrr_semantique: number;
  referencees: number;
  top5_global_succes: number;
  top5_rendu_succes: number;
  top1_rendu_succes: number;
  mrr_rendu: number;
  top5_global_rendu_succes: number;
  pieges_mesures: number;
  pieges_cites: number;
  confiant: number;
  incertain: number;
  aucun_resultat_fiable: number;
  pieges_confiants: number;
};

export function resume(mesures: Mesure[], seuils: Seuils): Resume {
  const semantiques = mesures.filter((mesure) => !mesure.question.piege && !estExacte(mesure));
  const referencees = mesures.filter((mesure) => !mesure.question.piege);
  const classementsSemantiques = classer(semantiques);
  const classementsGlobaux = classer(referencees);
  const classementsRendus = semantiques.map((mesure) => ({
    attendues: mesure.question.attendues,
    rendus: refusee(mesure, seuils) ? [] : mesure.refs,
  }));
  const classementsGlobauxRendus = referencees.map((mesure) => ({
    attendues: mesure.question.attendues,
    rendus: refusee(mesure, seuils) ? [] : mesure.refs,
  }));
  const pieges = mesures.filter((mesure) => mesure.question.piege && !estExacte(mesure));

  const niveaux = semantiques.map((mesure) => niveau(mesure, seuils));

  return {
    semantiques: semantiques.length,
    top5_semantique_succes: classementsSemantiques.filter((classement) =>
      classement.rendus.slice(0, 5).some((ref) => satisfait(ref, classement.attendues)),
    ).length,
    top1_semantique_succes: classementsSemantiques.filter((classement) =>
      satisfait(classement.rendus[0] ?? "", classement.attendues),
    ).length,
    mrr_semantique: mrr(classementsSemantiques),
    referencees: referencees.length,
    top5_global_succes: classementsGlobaux.filter((classement) =>
      classement.rendus.slice(0, 5).some((ref) => satisfait(ref, classement.attendues)),
    ).length,
    top5_rendu_succes: classementsRendus.filter((classement) =>
      classement.rendus.slice(0, 5).some((ref) => satisfait(ref, classement.attendues)),
    ).length,
    top1_rendu_succes: classementsRendus.filter((classement) =>
      satisfait(classement.rendus[0] ?? "", classement.attendues),
    ).length,
    mrr_rendu: mrr(classementsRendus),
    top5_global_rendu_succes: classementsGlobauxRendus.filter((classement) =>
      classement.rendus.slice(0, 5).some((ref) => satisfait(ref, classement.attendues)),
    ).length,
    pieges_mesures: pieges.length,
    pieges_cites: pieges.filter((mesure) => !refusee(mesure, seuils)).length,
    confiant: niveaux.filter((valeur) => valeur === "confiant").length,
    incertain: niveaux.filter((valeur) => valeur === "incertain").length,
    aucun_resultat_fiable: niveaux.filter((valeur) => valeur === "aucun_resultat_fiable").length,
    pieges_confiants: pieges.filter((mesure) => niveau(mesure, seuils) === "confiant").length,
  };
}

function lireSplit(argv: string[]): FiltreSplit {
  const index = argv.indexOf("--split");
  const valeur = index >= 0 ? argv[index + 1] : "dev";
  if (valeur !== "dev" && valeur !== "test" && valeur !== "all") {
    throw new Error(`--split attendu dev, test ou all ; reçu « ${valeur ?? "(vide)"} »`);
  }
  return valeur;
}

function lireRecherche(argv: string[]): ModeRecherche {
  const index = argv.indexOf("--recherche");
  const valeur = index >= 0 ? argv[index + 1] : "dense";
  if (valeur !== "dense" && valeur !== "hybride") {
    throw new Error(`--recherche attendu dense ou hybride ; reçu « ${valeur ?? "(vide)"} »`);
  }
  return valeur;
}

/** Le split `test` ne s'exécute que sur autorisation explicite. */
export function verifierAutorisationTest(split: FiltreSplit, mesurerTest: boolean): void {
  if ((split === "test" || split === "all") && !mesurerTest) {
    throw new Error(
      `Le split ${split} exige --mesurer-test : le test ne se mesure qu'une fois, ` +
        "après la fin des corrections.",
    );
  }
}

/**
 * Lit `--seuils bas,haut,marge`. Trois nombres dans `[0, 1]`, marge non
 * négative, `bas` au plus égal à `haut`. La valeur fautive est nommée.
 */
export function lireSeuils(valeur: string | undefined): Seuils | null {
  if (valeur === undefined) return null;
  const parties = valeur.split(",");
  if (parties.length !== 3) {
    throw new Error(
      `--seuils attendu bas,haut,marge (trois nombres) ; reçu « ${valeur} »`,
    );
  }
  const nombres = parties.map((partie, position) => {
    const nombre = Number(partie);
    if (partie.trim() === "" || !Number.isFinite(nombre)) {
      throw new Error(
        `--seuils : valeur non numérique « ${partie.trim() === "" ? "(vide)" : partie} »`,
      );
    }
    if (position === 2 && nombre < 0) {
      throw new Error(`--seuils : marge négative « ${partie} »`);
    }
    if (nombre < 0 || nombre > 1) {
      throw new Error(`--seuils : valeur hors de [0, 1] « ${partie} »`);
    }
    return nombre;
  });
  const [bas, haut, marge] = nombres;
  if (bas === undefined || haut === undefined || marge === undefined) {
    throw new Error(`--seuils attendu bas,haut,marge ; reçu « ${valeur} »`);
  }
  if (marge < 0) {
    throw new Error(`--seuils : marge négative « ${marge} »`);
  }
  if (bas > haut) {
    throw new Error(`--seuils : bas (${bas}) dépasse haut (${haut})`);
  }
  return { bas, haut, marge };
}

/**
 * Seuils d'une mesure et leur origine. Sans `--seuils`, `dev` calibre et
 * `test` garde les constantes figées. Avec `--seuils`, la calibration `dev`
 * est quand même calculée et rapportée, sans changer les seuils retenus.
 */
export function seuilsDeMesure(args: {
  split: FiltreSplit;
  avecSplit: boolean;
  mesuresDev: Mesure[];
  explicites: Seuils | null;
}): { seuils: Seuils; origine: string; calibration: Seuils | null } {
  const calibration =
    !args.avecSplit || args.split === "test" ? null : calibrer(args.mesuresDev);
  if (args.explicites !== null) {
    const detail =
      calibration === null
        ? ""
        : ` ; calibration dev bas=${calibration.bas.toFixed(3)} haut=${calibration.haut.toFixed(3)} marge=${calibration.marge.toFixed(3)}`;
    return { seuils: args.explicites, origine: `fournis par --seuils${detail}`, calibration };
  }
  if (calibration !== null) {
    return { seuils: calibration, origine: "calibrés sur dev", calibration };
  }
  return {
    seuils: { bas: SEUIL_BAS, haut: SEUIL_HAUT, marge: MARGE },
    origine: args.avecSplit ? "figés avant la mesure" : "figés (jeu sans split)",
    calibration,
  };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

function sha256(contenu: string): string {
  return createHash("sha256").update(contenu, "utf8").digest("hex");
}

/** Résout `--questions` : chemin absolu, puis `mcp/eval/`, puis le répertoire courant. */
export function resoudreQuestions(chemin: string): string {
  if (isAbsolute(chemin)) return chemin;
  const local = join(ICI, chemin);
  if (existsSync(local)) return local;
  return resolve(process.cwd(), chemin);
}

function pourcentIntervalle(succes: number, total: number): string {
  const [bas, haut] = intervalleWilson(succes, total);
  return `${pourcentage(total === 0 ? 0 : succes / total)} ` +
    `(IC 95 % ${pourcentage(bas)}–${pourcentage(haut)})`;
}

/** Une entrée JSON par question : ce qui a été rendu, où, et avec quel niveau. */
export type EntreeQuestionJson = {
  question: string;
  type: TypeQuestion;
  piege: boolean;
  attendues: string[];
  refs: string[];
  rangs: number[];
  similarites: number[];
  niveau: ReturnType<typeof niveauConfiance>;
};

export function entreeQuestionJson(mesure: Mesure, seuils: Seuils): EntreeQuestionJson {
  return {
    question: mesure.question.question,
    type: mesure.question.type,
    piege: mesure.question.piege,
    attendues: [...mesure.question.attendues],
    refs: [...mesure.refs],
    rangs: mesure.question.attendues.map((ref) => rangDe(mesure, ref)),
    similarites: mesure.distances.map((distance) => 1 - distance),
    niveau: niveau(mesure, seuils),
  };
}

export type ObjetMesureJson = {
  date: string;
  modele: string;
  dimensions: number;
  split: Split;
  /** Collection mesurée : `rgpd`, `aiact`, `cnil`, `lil`, `ce`, `cepd`. */
  corpus: string;
  recherche: ModeRecherche;
  seuils: Seuils;
  questions: EntreeQuestionJson[];
  agregats: Resume;
};

export function objetMesureJson(args: {
  date: string;
  modele: string;
  dimensions: number;
  split: Split;
  corpus: string;
  recherche: ModeRecherche;
  seuils: Seuils;
  mesures: Mesure[];
}): ObjetMesureJson {
  return {
    date: args.date,
    modele: args.modele,
    dimensions: args.dimensions,
    split: args.split,
    corpus: args.corpus,
    recherche: args.recherche,
    seuils: args.seuils,
    questions: args.mesures.map((mesure) => entreeQuestionJson(mesure, args.seuils)),
    agregats: resume(args.mesures, args.seuils),
  };
}

/** `--json` ne rend qu'un split : `all` mélangerait deux jeux dans un objet. */
export function verifierJsonSplit(split: FiltreSplit, json: boolean): void {
  if (json && split === "all") {
    throw new Error("--json refuse --split all : un objet ne porte qu'un seul split.");
  }
}

async function main(argv: string[]): Promise<void> {
  const split = lireSplit(argv);
  const recherche = lireRecherche(argv);
  const json = argv.includes("--json");
  verifierJsonSplit(split, json);
  verifierAutorisationTest(split, argv.includes("--mesurer-test"));
  const seuilsExplicites = lireSeuils(valeurDe("--seuils", argv));
  const date = new Date().toISOString().slice(0, 10);
  // Racine alternative : permet de mesurer un autre index sans toucher le corpus
  // ni l'index du produit (expérience de modèle, par exemple).
  const rootDir = resolve(valeurDe("--root", argv) ?? RACINE);

  const cheminQuestions = resoudreQuestions(valeurDe("--questions", argv) ?? basename(QUESTIONS));
  const contenu = readFileSync(cheminQuestions, "utf8");
  const jeu = lireJeu(contenu);
  const questions = jeu.questions;
  const corpus = corpusDuJeu(questions);
  const unites = lireUnites(rootDir);
  validerReferences(
    questions,
    new Set(unites.map((unite) => unite.ref)),
    new Set(unites.map((unite) => unite.document)),
  );

  const modele = valeurDe("--modele", argv);
  const dim = valeurDe("--dim", argv);
  const embedder = createOllamaEmbedder({
    ...(modele === undefined ? {} : { model: modele }),
    ...(dim === undefined ? {} : { dim: Number(dim) }),
  });

  const consommeTest = split === "test" || split === "all";
  const marqueurPath = cheminMarqueur(cheminQuestions);
  if (consommeTest) {
    verifierTestNonConsomme(marqueurPath, sha256(contenu), embedder.model);
  }

  const index = openIndex(cheminIndex(rootDir));
  try {
    const demandees = filtrerSplit(questions, split);
    const mesures = await mesurer(rootDir, demandees, embedder, index, corpus, recherche);

    const mesuresDev =
      split === "all" ? mesures.filter((mesure) => mesure.question.split === "dev") : mesures;
    const { seuils, origine } = seuilsDeMesure({
      split,
      avecSplit: jeu.avecSplit,
      mesuresDev,
      explicites: seuilsExplicites,
    });

    const lignes = [
      `date : ${date}`,
      `modèle : ${embedder.model} (${embedder.dim} dimensions)`,
      `corpus : ${corpus}`,
      `recherche : ${recherche}`,
      `split : ${split}`,
      ...(split === "all"
        ? [
            "",
            "== dev ==",
            ...rapport(mesures.filter((mesure) => mesure.question.split === "dev"), seuils, origine),
            "",
            "== test ==",
            ...rapport(mesures.filter((mesure) => mesure.question.split === "test"), seuils, origine),
          ]
        : rapport(mesures, seuils, origine)),
    ];

    if (consommeTest) {
      const mesuresTest =
        split === "test"
          ? mesures
          : mesures.filter((mesure) => mesure.question.split === "test");
      const chiffres = resume(mesuresTest, seuils);
      if (!json) {
        lignes.push(
          "",
          `intervalle 95 % (Wilson) : top 5 global ` +
            pourcentIntervalle(chiffres.top5_global_succes, chiffres.referencees) +
            ` ; top 5 sémantique ` +
            pourcentIntervalle(chiffres.top5_semantique_succes, chiffres.semantiques) +
            ` ; pièges cités ` +
            pourcentIntervalle(chiffres.pieges_cites, chiffres.pieges_mesures),
        );
      }

      ecrireMesureTest(
        marqueurPath,
        sha256(contenu),
        {
          modele: embedder.model,
          dimensions: embedder.dim,
          date,
          seuils,
          agregats: chiffres,
        },
        `Mesures du ${date}, produites par cette exécution ; ` +
          "aucune valeur n'est transcrite d'un autre rapport.",
      );
    }

    if (json) {
      if (split === "all") throw new Error("--json refuse --split all.");
      const objet = objetMesureJson({
        date,
        modele: embedder.model,
        dimensions: embedder.dim,
        split,
        corpus,
        recherche,
        seuils,
        mesures,
      });
      process.stdout.write(`${JSON.stringify(objet, null, 2)}\n`);
    } else {
      process.stdout.write(`${lignes.join("\n")}\n`);
    }
  } finally {
    index.db.close();
  }
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
