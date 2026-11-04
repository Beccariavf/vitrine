import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { niveauConfiance, SEUIL_BAS, SEUIL_HAUT } from "../confidence.ts";
import { createOllamaEmbedder } from "../embed/embedder.ts";
import type { Embedder } from "../embed/embedder.ts";
import { cheminIndex, lireUnites } from "../index/build.ts";
import { openIndex } from "../index/search.ts";
import type { Index } from "../index/search.ts";
import { referenceExacte, search } from "../tools.ts";

const ICI = dirname(fileURLToPath(import.meta.url));
const QUESTIONS = join(ICI, "questions.csv");
const RACINE = fileURLToPath(new URL("../..", import.meta.url));

/** Un pli de validation croisée : quatre plis aussi égaux que possible. */
export const NB_PLIS = 4;

export type TypeQuestion = "reference" | "conceptuelle" | "piege";

export type Question = {
  question: string;
  type: TypeQuestion;
  attendues: string[];
  piege: boolean;
};

export type Seuils = { bas: number; haut: number; marge: number };

export type Classement = { attendues: string[]; rendus: string[] };
export type ClassementPiege = { piege: boolean; refusee: boolean };

const ENTETE = "question,type,sources_attendues,piege";
const TYPES: TypeQuestion[] = ["reference", "conceptuelle", "piege"];

/** Lit `questions.csv` ; lève sur une ligne mal formée. */
export function lireQuestions(csv: string): Question[] {
  const lignes = csv
    .split(/\r?\n/)
    .filter((ligne) => ligne.trim() !== "");
  const entete = lignes.shift();
  if (entete !== ENTETE) throw new Error(`En-tête inattendu : ${entete ?? "(vide)"}`);

  return lignes.map((ligne, index) => {
    const champs = ligne.split(",");
    if (champs.length !== 4) throw new Error(`Ligne ${index + 2} illisible : ${ligne}`);
    const [question = "", type = "", sources = "", piege = ""] = champs;
    if (!TYPES.includes(type as TypeQuestion)) {
      throw new Error(`Ligne ${index + 2} : type inconnu « ${type} »`);
    }
    if (piege !== "oui" && piege !== "non") {
      throw new Error(`Ligne ${index + 2} : colonne piege attendue oui ou non`);
    }
    return {
      question,
      type: type as TypeQuestion,
      attendues: sources === "" ? [] : sources.split("|"),
      piege: piege === "oui",
    };
  });
}

/** Échoue avant toute mesure si une référence attendue manque au corpus. */
export function validerReferences(questions: Question[], refs: Set<string>): void {
  for (const question of questions) {
    for (const ref of question.attendues) {
      if (!refs.has(ref)) {
        throw new Error(`Référence attendue absente du corpus : ${ref} (${question.question})`);
      }
    }
  }
}

/** Part des questions à référence dont une attendue figure dans les cinq premiers. */
export function recallAt5(classements: Classement[]): number {
  const pertinents = classements.filter((classement) => classement.attendues.length > 0);
  if (pertinents.length === 0) return 0;
  const trouves = pertinents.filter((classement) =>
    classement.rendus.slice(0, 5).some((ref) => classement.attendues.includes(ref)),
  ).length;
  return trouves / pertinents.length;
}

/** Part des questions dont le premier passage rendu est une référence attendue. */
export function precisionAt1(classements: Classement[]): number {
  const pertinents = classements.filter((classement) => classement.attendues.length > 0);
  if (pertinents.length === 0) return 0;
  const justes = pertinents.filter((classement) =>
    classement.attendues.includes(classement.rendus[0] ?? ""),
  ).length;
  return justes / pertinents.length;
}

/** Moyenne de l'inverse du rang de la première référence attendue. */
export function mrr(classements: Classement[]): number {
  const pertinents = classements.filter((classement) => classement.attendues.length > 0);
  if (pertinents.length === 0) return 0;
  const somme = pertinents.reduce((total, classement) => {
    const rang = classement.rendus.findIndex((ref) => classement.attendues.includes(ref));
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

/** Découpe en `plis` blocs contigus de taille aussi égale que possible. */
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
 * seuils les plus prudents. Aucune mesure tenue à l'écart n'entre ici.
 */
export function calibrer(mesures: Mesure[]): Seuils {
  let meilleur: { seuils: Seuils; score: number[] } | null = null;

  for (const bas of grille(0.2, 0.8, 0.01)) {
    for (const haut of grille(bas + 0.05, 0.95, 0.05)) {
      for (const marge of [0, 0.01, 0.02, 0.05]) {
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
              mesure.refs.slice(0, 5).some((ref) => mesure.question.attendues.includes(ref))
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
): Promise<Mesure[]> {
  const mesures: Mesure[] = [];
  for (const question of questions) {
    const resultat = await search(
      rootDir,
      { question: question.question, k: 5 },
      { embedder, index, seuils: { bas: -1, haut: 2, marge: 0 } },
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
  return ref.split("#")[1] ?? ref;
}

type PositionAttendue = { question: Question; rang: number; similarite: number | null };

/** Rang et similarité de la première référence attendue, `rang = 0` si absente. */
function positionAttendue(mesure: Mesure): PositionAttendue {
  const index = mesure.refs.findIndex((ref) => mesure.question.attendues.includes(ref));
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
  if (premier === undefined || mesure.question.attendues.includes(premier)) return null;
  const attendues = mesure.question.attendues.map(refCourte).join("|");
  return `${attendues} ← ${refCourte(premier)}`;
}

/** Rang de `ref` dans les passages rendus, `0` si absent. */
function rangDe(mesure: Mesure | undefined, ref: string): number {
  if (mesure === undefined) return 0;
  return mesure.refs.indexOf(ref) + 1;
}

async function main(): Promise<void> {
  const questions = lireQuestions(readFileSync(QUESTIONS, "utf8"));
  const unites = lireUnites(RACINE);
  validerReferences(questions, new Set(unites.map((unite) => unite.ref)));

  const embedder = createOllamaEmbedder();
  const index = openIndex(cheminIndex(RACINE));
  try {
    const mesures = await mesurer(RACINE, questions, embedder, index);
    const plis = validerCroise(mesures);
    const seuils = calibrer(mesures);

    const exactes = mesures.filter((mesure) => !mesure.question.piege && estExacte(mesure));
    const semantiques = mesures.filter((mesure) => !mesure.question.piege && !estExacte(mesure));
    const classementsSemantiques = classer(semantiques);
    const trouveesSemantiques = classementsSemantiques.filter((classement) =>
      classement.rendus.slice(0, 5).some((ref) => classement.attendues.includes(ref)),
    ).length;
    const justesTop1 = classementsSemantiques.filter((classement) =>
      classement.attendues.includes(classement.rendus[0] ?? ""),
    ).length;
    const positions = semantiques.map(positionAttendue);
    const considerants = semantiques.filter(teteConsiderant);
    const inattendues = semantiques
      .map(teteInattendue)
      .filter((valeur): valeur is string => valeur !== null);

    const piegesSeuil = mesures.filter((mesure) => mesure.question.piege && !estExacte(mesure));
    const piegesDeterministes = mesures.filter((mesure) => mesure.question.piege && estExacte(mesure));

    const similariteMaxPieges = Math.max(...piegesSeuil.map(premiereSimilarite));
    const similariteMinSemantiques = Math.min(...semantiques.map(premiereSimilarite));
    const margeBasse = SEUIL_BAS - similariteMaxPieges;
    const margeHaute = similariteMinSemantiques - SEUIL_HAUT;
    const incertaines = semantiques.filter(
      (mesure) =>
        niveauConfiance(
          mesure.distances.map((distance) => ({ distance })),
          false,
          seuils,
        ) === "incertain",
    ).length;

    const effacement = mesures.find((mesure) => mesure.question.question === "effacement");
    const rangEffacement = rangDe(effacement, "32016R0679#art_17");
    const effacementLong = mesures.find(
      (mesure) => mesure.question.question === "effacement et moteurs de recherche",
    );
    const rangEffacementLong = rangDe(effacementLong, "32016R0679#art_17");
    const paraphrase = mesures.find(
      (mesure) => mesure.question.question === "droit de récupérer mes données",
    );
    const rangParaphrase = rangDe(paraphrase, "32016R0679#art_20");
    const piegesEchoues = mesures
      .filter((mesure) => mesure.question.piege && !refusee(mesure, seuils))
      .map((mesure) => mesure.question.question);

    const taux = plis.map((pli) => pli.taux);
    const minimum = Math.min(...taux);
    const maximum = Math.max(...taux);
    const moyenne = taux.reduce((total, valeur) => total + valeur, 0) / taux.length;

    const lignes = [
      `date : ${new Date().toISOString().slice(0, 10)}`,
      `modèle : ${embedder.model} (${embedder.dim} dimensions)`,
      `jeu : ${questions.length} questions (${compter(mesures, "reference")} références, ` +
        `${compter(mesures, "conceptuelle")} conceptuelles, ${compter(mesures, "piege")} pièges)`,
      `seuils finaux : bas=${arrondi(seuils.bas)} haut=${arrondi(seuils.haut)} marge=${arrondi(seuils.marge)}`,
      `références exactes : ${exactes.length} questions, rang 1 par construction ` +
        `(recall@5 ${arrondi(recallAt5(classer(exactes)))}, MRR ${arrondi(mrr(classer(exactes)))})`,
      `recherche sémantique : ${semantiques.length} questions, recall@5 ` +
        `${arrondi(recallAt5(classementsSemantiques))} ` +
        `(${trouveesSemantiques}/${semantiques.length}), ` +
        `MRR ${arrondi(mrr(classementsSemantiques))}`,
      `top-1 sémantique : ${pourcentage(precisionAt1(classementsSemantiques))} ` +
        `(${justesTop1}/${semantiques.length})`,
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
      `pièges : ${piegesSeuil.length} par seuil, ${piegesDeterministes.length} déterministe ` +
        `(${piegesDeterministes.map((mesure) => mesure.question.question).join(" · ") || "aucun"})`,
      `similarité : max des pièges par seuil ${arrondi(similariteMaxPieges)}, ` +
        `min des questions sémantiques ${arrondi(similariteMinSemantiques)}`,
      `marges : basse ${arrondi(margeBasse)} (piège max → SEUIL_BAS), ` +
        `haute ${arrondi(margeHaute)} (SEUIL_HAUT → premier passage sémantique le plus faible)`,
      `confiance : « confiant » ne dit que la similarité du premier passage, jamais que ` +
        `l'article attendu est en tête ; marge calibrée ${arrondi(seuils.marge)}, ` +
        `${incertaines} question(s) sémantique(s) incertaine(s)`,
      `citations invalides par pli : ${plis.map((pli) => `${pourcentage(pli.taux)} (${pli.cites}/${pli.pieges})`).join(" · ")}`,
      `moyenne des plis : ${pourcentage(moyenne)} (min–max ${pourcentage(minimum)}–${pourcentage(maximum)})`,
      `rangs d'« effacement » : « effacement » ${rangEffacement === 0 ? "absent" : rangEffacement}, ` +
        `« effacement et moteurs de recherche » ${rangEffacementLong === 0 ? "absent" : rangEffacementLong}`,
      `paraphrase inédite « droit de récupérer mes données » → art_20 : ` +
        `${rangParaphrase === 0 ? "hors des cinq premiers (top 5 : non)" : `rang ${rangParaphrase} (top 5 : oui)`}`,
      `pièges échoués aux seuils finaux : ${piegesEchoues.length === 0 ? "aucun" : piegesEchoues.join(" · ")}`,
    ];
    process.stdout.write(`${lignes.join("\n")}\n`);
  } finally {
    index.db.close();
  }
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
