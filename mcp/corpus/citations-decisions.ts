/**
 * Citations entre décisions : les références de décisions qu'un texte du corpus
 * nomme, résolues vers le corpus quand c'est possible.
 *
 * Cinq familles, reconnues par leurs références usuelles : affaire de l'Union
 * (`C-311/18`), ECLI, délibération CNIL (`SAN-2019-001`, `délibération n°
 * 2019-001`), requête du Conseil d'État (`n° 353066` près d'une mention du
 * Conseil d'État) et pourvoi de la Cour de cassation (`19-17.278`). Le lien dit
 * seulement « cite » : aucune qualification.
 *
 * Une famille n'est exposée que si sa précision, mesurée sur un échantillon
 * relu, a une borne basse de Wilson à 95 % d'au moins 90 % (seuil fixé par
 * l'utilisateur, #30). La mesure vit dans `MESURES` et dans
 * `aidd_docs/tasks/2026_11/2026_11_13_citations-entre-decisions/mesure.md`.
 *
 * Extraction à la lecture, sans index ni stockage ; le cache suit le fichier de
 * chaque corpus et ne garde que les références.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Unite } from "./parse.ts";
import { CORPUS_DECISIONS } from "./citations.ts";
import { autoriteDe } from "./hors-corpus.ts";
import { intervalleWilson } from "../statistiques.ts";

export type Famille = "affaire_ue" | "ecli" | "deliberation_cnil" | "requete_ce" | "pourvoi_cc";

export const FAMILLES: readonly Famille[] = [
  "affaire_ue",
  "ecli",
  "deliberation_cnil",
  "requete_ce",
  "pourvoi_cc",
];

/**
 * Une référence reconnue dans un texte : sa forme lisible, sa clé de résolution
 * et, quand le texte la donne juste avant, la date de la décision citée.
 */
export type ReferenceDecision = {
  famille: Famille;
  cle: string;
  reference: string;
  date?: string;
  /**
   * Affaire de l'Union citée par un acte qui n'est pas l'arrêt : des conclusions
   * d'avocat général ou une ordonnance partagent le numéro de l'affaire.
   */
  acte?: "conclusions" | "ordonnance";
};

/** Une décision du corpus qu'une référence désigne. */
export type CibleDecision = {
  document: string;
  corpus: string;
  intitule: string;
  date_acte: string;
  url: string;
};

/**
 * Une décision citée, telle que les outils la rendent ; `cibles` vide hors corpus.
 * `date_divergente` signale que le texte date la décision citée (`date_citee`)
 * autrement que toutes les décisions du corpus de ce numéro : elles sont rendues
 * quand même, à vérifier, plutôt qu'une absence qui serait fausse.
 */
export type DecisionCitee = {
  reference: string;
  famille: Famille;
  /** Présent quand le texte cite des conclusions d'avocat général ou une ordonnance, pas l'arrêt. */
  acte?: "conclusions" | "ordonnance";
  cibles: CibleDecision[];
  date_citee?: string;
  date_divergente?: true;
};

/**
 * Précision relevée par famille sur l'échantillon relu (`mesure.md`). Une famille
 * absente n'a pas été mesurée : elle n'est pas exposée.
 */
export type Mesure = {
  justes: number;
  relues: number;
  /**
   * Strate « date divergente » relue à part quand l'échantillon n'en contient
   * pas : `part` est sa fraction des citations de la famille au jour de la mesure.
   */
  divergentes?: { justes: number; relues: number; part: number };
};

export const MESURES: Partial<Record<Famille, Mesure>> = {
  affaire_ue: { justes: 60, relues: 60, divergentes: { justes: 1, relues: 1, part: 1 / 2838 } },
  ecli: { justes: 34, relues: 55 },
  deliberation_cnil: { justes: 60, relues: 60, divergentes: { justes: 38, relues: 51, part: 51 / 2408 } },
  requete_ce: { justes: 119, relues: 119 },
  pourvoi_cc: { justes: 60, relues: 60 },
};

/** Seuil fixé par l'utilisateur : borne basse de Wilson à 95 %. */
export const SEUIL_BORNE_BASSE = 0.9;

/** Borne basse de Wilson d'une famille ; `null` si elle n'a pas été mesurée. */
export function borneBasse(famille: Famille): number | null {
  const mesure = MESURES[famille];
  if (mesure === undefined) return null;
  const echantillon = intervalleWilson(mesure.justes, mesure.relues)[0];
  const strate = mesure.divergentes;
  // Somme pondérée des bornes basses de chaque strate : plus prudente qu'un intervalle joint.
  return strate === undefined
    ? echantillon
    : (1 - strate.part) * echantillon + strate.part * intervalleWilson(strate.justes, strate.relues)[0];
}

/** Familles dont la borne basse atteint le seuil : les seules rendues par les outils. */
export function famillesExposees(): ReadonlySet<Famille> {
  return new Set(
    FAMILLES.filter((famille) => {
      const borne = borneBasse(famille);
      return borne !== null && borne >= SEUIL_BORNE_BASSE;
    }),
  );
}

/** Tirets typographiques ramenés au trait d'union : `C‑131/12` devient `C-131/12`. */
function tirets(texte: string): string {
  return texte.replace(/[‐‑‒−]/g, "-");
}

const AFFAIRE = /\b([CTF])\s?-\s?(\d{1,4})\/(?:\d{2})?(\d{2})(?!\d)(\s?P\b)?/g;
const ECLI = /\bECLI:[A-Z]{2}:[A-Z]+:\d{4}:[0-9A-Z]+(?:\.[0-9A-Z]+)*/g;
const SAN = /\bSAN-(\d{4})-(\d{1,3})\b/g;
const DELIBERATION = /\bdélibération(?:s)?\s+((?:[^.;]{0,40}?\s)?)n[°o]s?\s?(\d{2}|\d{4})-(\d{2,3})\b/gi;
/** « délibération portant avis sur le décret n° 2018-687 » : le numéro est celui d'un autre acte. */
const AUTRE_ACTE = /\b(?:loi|décret|arrêté|ordonnance|directive|règlement)\b/i;
const REQUETE = /\bn°s?\s?(\d{6})\b/g;
/** « /CE » et « (CE) » nomment la Communauté européenne, pas le Conseil d'État. */
const CONTEXTE_CE = /Conseil d['’]État|(?<!\/)(?<!\()\bCE\b(?!\))|\(CE,|\bC\.E\.|\breq\.\s?$/;
/** Un avis administratif du Conseil d'État porte un numéro qui n'est pas une requête. */
const AVIS_CE = /section (?:de l['’]intérieur|des finances|sociale|des travaux publics|de l['’]administration)|Assemblée générale|\bint\.,|\bavis\b/i;
const SOUS_LE = /Sous les?\s*$/i;
const POURVOI = /\b(?:([A-Z])\s)?(\d{2})-(\d{2})\.(\d{3})\b/g;

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
/** Abréviations usuelles des recueils : « 12 juill. 2022 », « 3 janv. 2019 ». */
const ABREGES = ["janv\\.", "févr\\.", "avr\\.", "juill\\.", "sept\\.", "oct\\.", "nov\\.", "déc\\."];
const DATE = new RegExp(
  `\\b(\\d{1,2})(?:er)?\\s+(${[...MOIS, ...ABREGES].join("|")})(?![a-zé])\\s*(\\d{4})\\b`,
  "gi",
);

function iso(trouve: RegExpMatchArray): string {
  const nom = (trouve[2] ?? "").toLowerCase().replace(/\.$/, "");
  // « juill » et « juin » partagent « jui » : le préfixe complet de l'abréviation tranche.
  const mois = MOIS.findIndex((m) => m.startsWith(nom)) + 1;
  return `${trouve[3]}-${String(mois).padStart(2, "0")}-${(trouve[1] ?? "").padStart(2, "0")}`;
}

/**
 * Fin de proposition : point suivi d'une majuscule, point-virgule, ou une autre
 * mention « n° ». Un point d'abréviation (« juill. 2022 », « Cass. crim. »)
 * ne coupe pas.
 */
const COUPURE = /(?<!\b(?:[A-Z]|Mme|Mlle|MM))\.\s(?=[A-ZÀ-Ý])|;|\bn°/g;
/** Fin de phrase seule, pour borner le contexte d'une requête du Conseil d'État. */
const FIN_PHRASE = /\.\s(?=[A-ZÀ-Ý])|;|\n/g;

/**
 * Date de la décision citée. D'abord la date qui suit la référence (« n° 80-20
 * du 24 juin 1980 »), puis la dernière date des 90 caractères qui la précèdent
 * (« CE, 21 avril 2021, n° 393099 »), sans franchir une fin de proposition ni
 * une autre mention « n° » : la date d'un autre acte ne date pas la référence.
 */
function dateDe(texte: string, position: number, longueur: number): string | undefined {
  // Seule une virgule sépare la référence de sa date : « n° 80-20 du 24 juin 1980 ».
  // Une parenthèse ou un « et » ouvrirait la citation suivante.
  // Le nom des parties peut s'intercaler : « C-212/13, František Ryneš, 11 décembre 2014 ».
  const apres = new RegExp(
    `^\\s*(?:,\\s*[^,.;()\\d]{1,80})?,?\\s*(?:du\\s+|en date du\\s+)?${DATE.source}`,
    "i",
  ).exec(texte.slice(position + longueur, position + longueur + 140));
  if (apres !== null) {
    const date = new RegExp(DATE.source, "i").exec(apres[0]);
    if (date !== null) return iso(date);
  }
  // Le « n° » qui annonce la référence elle-même ne coupe pas.
  // La fenêtre commence à une frontière de mot : « 12 septembre » ne devient jamais « 2 septembre ».
  let debut = Math.max(0, position - 90);
  while (debut > 0 && /\S/.test(texte[debut - 1] ?? "")) debut -= 1;
  const fenetre = texte.slice(debut, position).replace(/(?:pourvoi\s+)?n°s?\s*$/i, "");
  const coupures = [...fenetre.matchAll(COUPURE)];
  const derniere = coupures[coupures.length - 1];
  const proposition = derniere === undefined ? fenetre : fenetre.slice((derniere.index ?? 0) + derniere[0].length);
  const dates = [...proposition.matchAll(DATE)];
  const date = dates[dates.length - 1];
  return date === undefined ? undefined : iso(date);
}

/**
 * Acte d'une affaire de l'Union nommé dans la proposition qui précède la
 * référence : « conclusions de l'avocat général … dans l'affaire C-645/19 »,
 * « ordonnance du président … C-413/23 P ».
 */
function acteAvant(texte: string, position: number): "conclusions" | "ordonnance" | undefined {
  let debut = Math.max(0, position - 120);
  while (debut > 0 && /\S/.test(texte[debut - 1] ?? "")) debut -= 1;
  const fenetre = texte.slice(debut, position);
  const coupures = [...fenetre.matchAll(COUPURE)];
  const derniere = coupures[coupures.length - 1];
  const proposition = derniere === undefined ? fenetre : fenetre.slice((derniere.index ?? 0) + derniere[0].length);
  // « Conclusions » seul est un mot courant (« conclusions des parties ») : seul l'avocat général compte.
  const conclusions = dernierIndice(proposition, /\bavocat général\b|\badvocate general\b|\bses conclusions\b/gi);
  const ordonnance = dernierIndice(proposition, /\bordonnance\b|\border of\b/gi);
  if (conclusions < 0 && ordonnance < 0) return undefined;
  // Le mot le plus proche de la référence l'emporte.
  return conclusions > ordonnance ? "conclusions" : "ordonnance";
}

/** Position de la dernière occurrence d'un motif ; -1 s'il n'y en a pas. */
function dernierIndice(texte: string, motif: RegExp): number {
  const trouves = [...texte.matchAll(motif)];
  return trouves.length === 0 ? -1 : (trouves[trouves.length - 1]?.index ?? -1);
}

/** Année sur quatre chiffres : `06` devient `2006`, `86` devient `1986`. */
function annee(valeur: string): string {
  if (valeur.length === 4) return valeur;
  const nombre = Number(valeur);
  return String(nombre >= 78 ? 1900 + nombre : 2000 + nombre);
}

/** Clé d'une délibération CNIL : `SAN-2019-001` ou `2019-001`. */
export function cleDeliberation(numero: string): string | null {
  const brut = tirets(numero).replace(/[–]/g, "-").trim().toUpperCase();
  const san = /^SAN-(\d{4})-(\d{1,3})$/.exec(brut);
  if (san !== null) return `SAN-${san[1]}-${(san[2] ?? "").padStart(3, "0")}`;
  const simple = /^(\d{2}|\d{4})-(\d{2,3})$/.exec(brut);
  if (simple === null) return null;
  return `${annee(simple[1] ?? "")}-${(simple[2] ?? "").padStart(3, "0")}`;
}

/**
 * Références de décisions nommées par un texte, sans doublon de clé, dans l'ordre
 * de rencontre. Une requête du Conseil d'État n'est retenue que si une mention
 * du Conseil d'État la précède dans la même phrase ; « Sous le n° » annonce le
 * numéro du document lui-même ; un pourvoi précédé d'une lettre (« Pourvoi n° X
 * 17-19.523 ») est l'en-tête de l'arrêt, pas une citation.
 */
export function extraireReferences(texteBrut: string): ReferenceDecision[] {
  return referencesPositionnees(texteBrut).map(({ position: _position, ...reference }) => reference);
}

/**
 * Comme `extraireReferences`, avec la position de la première occurrence dans le
 * texte aux tirets normalisés : le support de la relecture (`mcp/eval`).
 */
export function referencesPositionnees(
  texteBrut: string,
): (ReferenceDecision & { position: number })[] {
  const texte = tirets(texteBrut);
  const trouvees: (ReferenceDecision & { position: number })[] = [];
  const pousser = (
    position: number,
    longueur: number,
    famille: Famille,
    cle: string,
    reference: string,
  ): void => {
    const date = dateDe(texte, position, longueur);
    trouvees.push({ position, famille, cle, reference, ...(date === undefined ? {} : { date }) });
  };

  for (const m of texte.matchAll(AFFAIRE)) {
    const cle = `${m[1]}-${Number(m[2])}/${m[3]}`;
    pousser(m.index, m[0].length, "affaire_ue", cle, m[4] === undefined ? cle : `${cle} P`);
    const acte = acteAvant(texte, m.index);
    const derniere = trouvees[trouvees.length - 1];
    if (acte !== undefined && derniere !== undefined) derniere.acte = acte;
  }
  for (const m of texte.matchAll(ECLI)) pousser(m.index, m[0].length, "ecli", m[0], m[0]);
  for (const m of texte.matchAll(SAN)) {
    const cle = `SAN-${m[1]}-${(m[2] ?? "").padStart(3, "0")}`;
    pousser(m.index, m[0].length, "deliberation_cnil", cle, cle);
  }
  for (const m of texte.matchAll(DELIBERATION)) {
    if (AUTRE_ACTE.test(m[1] ?? "")) continue;
    const cle = cleDeliberation(`${m[2]}-${m[3]}`);
    if (cle !== null) pousser(m.index, m[0].length, "deliberation_cnil", cle, `délibération n° ${cle}`);
  }
  for (const m of texte.matchAll(REQUETE)) {
    const avant = texte.slice(Math.max(0, m.index - 160), m.index);
    if (SOUS_LE.test(avant)) continue;
    const fins = [...avant.matchAll(FIN_PHRASE)];
    const fin = fins[fins.length - 1];
    const phrase = fin === undefined ? avant : avant.slice((fin.index ?? 0) + fin[0].length);
    if (!CONTEXTE_CE.test(phrase) || AVIS_CE.test(phrase)) continue;
    pousser(m.index, m[0].length, "requete_ce", m[1] ?? "", `n° ${m[1]}`);
  }
  for (const m of texte.matchAll(POURVOI)) {
    if (m[1] !== undefined) continue;
    const cle = `${m[2]}-${m[3]}.${m[4]}`;
    pousser(m.index, m[0].length, "pourvoi_cc", cle, cle);
  }

  const vues = new Set<string>();
  return trouvees
    .sort((gauche, droite) => gauche.position - droite.position)
    .filter(({ famille, cle, acte }) => {
      const clef = `${famille}|${cle}|${acte ?? ""}`;
      if (vues.has(clef)) return false;
      vues.add(clef);
      return true;
    });
}

/**
 * Référence saisie par un appelant : une seule, sans exiger le contexte d'un
 * texte. Un nombre à six chiffres seul vaut requête du Conseil d'État.
 */
export function lireReference(saisie: string): ReferenceDecision | null {
  const texte = tirets(saisie).trim();
  if (/^(?:n°\s?)?\d{6}$/.test(texte)) {
    const numero = texte.replace(/\D/g, "");
    return { famille: "requete_ce", cle: numero, reference: `n° ${numero}` };
  }
  const deliberation = cleDeliberation(texte.replace(/^délibération\s+n°\s?/i, ""));
  if (deliberation !== null) {
    return {
      famille: "deliberation_cnil",
      cle: deliberation,
      reference: deliberation.startsWith("SAN") ? deliberation : `délibération n° ${deliberation}`,
    };
  }
  // « Pourvoi n° Q 19-17.278 » se copie depuis l'en-tête d'un arrêt ; « CE, 353066 » aussi.
  const pourvoi = /^(?:Pourvoi\s+n°\s?)?(?:[A-Z]\s)?(\d{2}-\d{2}\.\d{3})$/i.exec(texte);
  if (pourvoi !== null) return { famille: "pourvoi_cc", cle: pourvoi[1] ?? "", reference: pourvoi[1] ?? "" };
  const requete = /^(?:CE|Conseil d['’]État)\s*,?\s*(?:n°\s?)?(\d{6})$/i.exec(texte);
  if (requete !== null) return { famille: "requete_ce", cle: requete[1] ?? "", reference: `n° ${requete[1]}` };
  const references = extraireReferences(texte);
  return references.length === 1 ? (references[0] ?? null) : null;
}

/** Intitulé d'une décision : le chemin de son unité, sans la section du fragment. */
function intitule(unite: Unite): string {
  const segments = unite.chemin.split(" > ");
  if (unite.corpus === "cjue" && segments.length > 2) return segments.slice(0, 2).join(" > ");
  if (unite.corpus === "cc") return segments.filter((s) => s !== "Texte" && s !== "Visa").join(" > ");
  return unite.chemin;
}

/** Clés de résolution qu'une unité porte comme décision citée. */
function clesPropres(unite: Unite): ReferenceDecision[] {
  switch (unite.corpus) {
    case "cjue": {
      const propres = extraireReferences(unite.chemin).filter((r) => r.famille === "affaire_ue").slice(0, 1);
      // Les affaires jointes s'annoncent à l'en-tête : « Dans les affaires jointes C‑293/12 et C‑594/12, ».
      if (unite.numero === "entête") {
        const annonce = /Dans les? affaires?(?: jointes)?\s+([^,]*(?:,\s*[CTF]\s?-\s?\d[^,]*)*)/i.exec(tirets(unite.texte));
        if (annonce !== null) {
          propres.push(...extraireReferences(annonce[1] ?? "").filter((r) => r.famille === "affaire_ue"));
          // « C‑446/12 à C‑449/12 » joint aussi les affaires intermédiaires.
          for (const plage of (annonce[1] ?? "").matchAll(/([CTF])\s?-\s?(\d+)\/(\d{2})\s+à\s+[CTF]\s?-\s?(\d+)\/\3/g)) {
            for (let n = Number(plage[2]) + 1; n < Number(plage[4]) && n - Number(plage[2]) < 20; n += 1) {
              const cle = `${plage[1]}-${n}/${plage[3]}`;
              propres.push({ famille: "affaire_ue", cle, reference: cle });
            }
          }
        }
      }
      return propres.map(({ date: _date, ...reference }) => reference);
    }
    case "cnil": {
      const cle = cleDeliberation(unite.numero);
      return cle === null ? [] : [{ famille: "deliberation_cnil", cle, reference: cle }];
    }
    case "ce": {
      // Les requêtes jointes s'annoncent dans le texte : « 2° Sous le n° 394922 ».
      const numeros = new Set(/^\d{6}$/.test(unite.numero) ? [unite.numero] : []);
      for (const m of tirets(unite.texte).matchAll(/Sous les? n°s?\s?(\d{6})\b/gi)) numeros.add(m[1] ?? "");
      return [...numeros].map((numero) => ({ famille: "requete_ce", cle: numero, reference: `n° ${numero}` }));
    }
    case "cc": {
      // Les pourvois joints figurent à l'en-tête, précédés d'une lettre : « Pourvoi n° X 17-19.523 ».
      const cles = new Set(extraireReferences(unite.chemin).filter((r) => r.famille === "pourvoi_cc").map((r) => r.cle));
      for (const m of tirets(unite.texte).matchAll(/\b[A-Z]\s(\d{2}-\d{2}\.\d{3})\b/g)) cles.add(m[1] ?? "");
      return [...cles].map((cle) => ({ famille: "pourvoi_cc", cle, reference: cle }));
    }
    default:
      return [];
  }
}

type CorpusDecisions = {
  signature: string;
  /** Références citées par document, auto-citations comprises : la résolution les retire. */
  references: Map<string, ReferenceDecision[]>;
  /** Clé `famille|cle` → décisions de ce corpus qui la portent. */
  cibles: Map<string, CibleDecision[]>;
  /** Première unité de chaque document : date, URL et intitulé. */
  premieres: Map<string, Unite>;
};

const CACHE = new Map<string, CorpusDecisions>();

/** Lit un corpus de décisions une fois par modification de son fichier. */
function lireCorpusDecisions(rootDir: string, corpus: string): CorpusDecisions {
  const chemin = join(rootDir, "data", "corpus", corpus, "unites.jsonl");
  let signature: string;
  try {
    const etat = statSync(chemin);
    signature = `${etat.mtimeMs}|${etat.size}`;
  } catch {
    return { signature: "", references: new Map(), cibles: new Map(), premieres: new Map() };
  }
  const cache = CACHE.get(chemin);
  if (cache !== undefined && cache.signature === signature) return cache;

  const textes = new Map<string, string[]>();
  const premieres = new Map<string, Unite>();
  const cibles = new Map<string, CibleDecision[]>();
  const cibleesParDocument = new Map<string, Set<string>>();
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    if (ligne.trim() === "") continue;
    const unite = JSON.parse(ligne) as Unite;
    if (!premieres.has(unite.document)) premieres.set(unite.document, unite);
    const liste = textes.get(unite.document) ?? [];
    liste.push(unite.texte);
    textes.set(unite.document, liste);
    for (const propre of clesPropres(unite)) {
      const clef = `${propre.famille}|${propre.cle}`;
      const deja = cibleesParDocument.get(unite.document) ?? new Set<string>();
      if (deja.has(clef)) continue;
      deja.add(clef);
      cibleesParDocument.set(unite.document, deja);
      const premiere = premieres.get(unite.document) ?? unite;
      const candidats = cibles.get(clef) ?? [];
      candidats.push({
        document: unite.document,
        corpus,
        intitule: intitule(unite),
        date_acte: premiere.date_acte,
        url: premiere.url,
      });
      cibles.set(clef, candidats);
    }
  }
  const references = new Map<string, ReferenceDecision[]>();
  for (const [document, parties] of textes) references.set(document, extraireReferences(parties.join("\n")));
  const etat = { signature, references, cibles, premieres };
  CACHE.set(chemin, etat);
  return etat;
}

/** Toutes les décisions du corpus qui portent une clé, sans regarder la date. */
function candidats(rootDir: string, reference: Pick<ReferenceDecision, "famille" | "cle">): CibleDecision[] {
  const clef = `${reference.famille}|${reference.cle}`;
  return CORPUS_DECISIONS.flatMap((corpus) => lireCorpusDecisions(rootDir, corpus).cibles.get(clef) ?? []);
}

/**
 * Résolution d'une référence citée par `document`, partagée par les deux outils.
 * `null` quand elle désigne le document lui-même, décidé avant tout filtre de
 * date : une date proche de son propre numéro ne doit pas le faire revenir sans
 * cible. Une date donnée par le texte garde les seules décisions de cette date ;
 * si aucune ne la porte, toutes sont rendues avec `date_divergente`.
 */
function resolution(
  rootDir: string,
  reference: ReferenceDecision,
  document: string,
): Omit<DecisionCitee, "reference" | "famille"> | null {
  const numero = candidats(rootDir, reference);
  // Des conclusions ne sont jamais au corpus ; une ordonnance n'y est que si une ordonnance porte ce numéro.
  const tous =
    reference.acte === "conclusions"
      ? []
      : reference.acte === "ordonnance"
        ? numero.filter((cible) => /ordonnance/i.test(cible.intitule))
        : numero;
  if (tous.length < numero.length && numero.some((cible) => cible.document === document)) return null;
  const dates = reference.date === undefined ? tous : tous.filter((c) => c.date_acte === reference.date);
  if (dates.some((cible) => cible.document === document)) return null;
  if (dates.length === 0 && tous.some((cible) => cible.document === document)) return null;
  if (dates.length > 0 || reference.date === undefined) return { cibles: dates };
  if (tous.length === 0) return { cibles: [], date_citee: reference.date };
  return { cibles: tous, date_citee: reference.date, date_divergente: true };
}

/**
 * Décisions citées par un document, résolues vers le corpus. Une référence qui
 * désigne le document lui-même est retirée ; `familles` borne les familles
 * rendues (les familles exposées par défaut).
 */
export function decisionsCitees(
  rootDir: string,
  corpus: string,
  document: string,
  familles: ReadonlySet<Famille> = famillesExposees(),
): DecisionCitee[] {
  const references = lireCorpusDecisions(rootDir, corpus).references.get(document) ?? [];
  const rendues: DecisionCitee[] = [];
  for (const reference of references) {
    if (!familles.has(reference.famille)) continue;
    const resolue = resolution(rootDir, reference, document);
    if (resolue === null) continue;
    rendues.push({
      reference: reference.reference,
      famille: reference.famille,
      ...(reference.acte === undefined ? {} : { acte: reference.acte }),
      ...resolue,
    });
  }
  return rendues;
}

export const LIMITE_DEFAUT = 50;
export const LIMITE_MAX = 500;

/**
 * Une décision citante, et ce que sa citation désigne selon la même résolution
 * que `decisions_citees` : les deux outils ne se contredisent pas.
 */
export type DecisionCitante = CibleDecision & {
  autorite: string;
  cite: Omit<DecisionCitee, "reference" | "famille">;
};

export type ResultatCitantsDecision = {
  trouve: boolean;
  reference: string;
  famille?: Famille;
  /** Décisions du corpus que la référence désigne ; plusieurs quand elle est ambiguë. */
  cibles: CibleDecision[];
  total: number;
  par_autorite: { autorite: string; decisions: number }[];
  decisions: DecisionCitante[];
  decalage: number;
  tronque: boolean;
  message?: string;
};

/** Phrase qui publie la mesure d'une famille. */
export function chiffreFamille(famille: Famille): string {
  const mesure = MESURES[famille];
  const borne = borneBasse(famille);
  if (mesure === undefined || borne === null) return `${famille} : non mesurée`;
  const strate =
    mesure.divergentes === undefined
      ? ""
      : `, dont date divergente ${mesure.divergentes.justes}/${mesure.divergentes.relues}`;
  return (
    `${famille} : ${mesure.justes}/${mesure.relues} justes${strate}, borne basse ` +
    `${(borne * 100).toFixed(1).replace(".", ",")} %`
  );
}

/**
 * Les décisions du corpus qui citent une référence, triées par date
 * décroissante, avec le total et le compte par autorité avant pagination.
 */
export function decisionsCitantDecision(
  rootDir: string,
  demande: { reference: string; limite?: number; decalage?: number },
  familles: ReadonlySet<Famille> = famillesExposees(),
): ResultatCitantsDecision {
  const limite = Math.min(LIMITE_MAX, Math.max(1, Math.trunc(demande.limite ?? LIMITE_DEFAUT)));
  const decalage = Math.max(0, Math.trunc(demande.decalage ?? 0));
  const vide = {
    reference: demande.reference,
    cibles: [],
    total: 0,
    par_autorite: [],
    decisions: [],
    decalage,
    tronque: false,
  };
  const lue = lireReference(demande.reference);
  if (lue === null) {
    return {
      ...vide,
      trouve: false,
      message:
        `« ${demande.reference} » n'est pas une référence reconnue : numéro d'affaire (C-311/18), ` +
        "ECLI, délibération CNIL (SAN-2019-001, 2019-001), requête du Conseil d'État (353066) " +
        "ou pourvoi (19-17.278).",
    };
  }
  if (!familles.has(lue.famille)) {
    return {
      ...vide,
      trouve: false,
      reference: lue.reference,
      famille: lue.famille,
      message:
        `La famille ${lue.famille} n'est pas exposée : sa précision mesurée n'atteint pas le seuil ` +
        `(borne basse de Wilson ≥ 90 %). ${chiffreFamille(lue.famille)}.`,
    };
  }

  const cibles = candidats(rootDir, lue);
  const citantes: DecisionCitante[] = [];
  for (const corpus of CORPUS_DECISIONS) {
    const etat = lireCorpusDecisions(rootDir, corpus);
    for (const [document, references] of etat.references) {
      // Un document peut citer l'arrêt et les conclusions sous le même numéro : toutes les mentions
      // sont résolues, et la plus précise est rendue — cibles à la bonne date, puis cibles, puis aucune.
      const mentions = references.filter((r) => r.famille === lue.famille && r.cle === lue.cle);
      if (mentions.length === 0) continue;
      const resolues = mentions.map((mention) => {
        const resolue = resolution(rootDir, mention, document);
        // Chaque mention garde son acte : « cite » dit pourquoi des conclusions n'ont pas de cible.
        return resolue === null ? null : { ...(mention.acte === undefined ? {} : { acte: mention.acte }), ...resolue };
      });
      const unite = etat.premieres.get(document);
      if (resolues.some((r) => r === null) || unite === undefined) continue;
      const valides = resolues.filter((r) => r !== null);
      const cite =
        valides.find((r) => r.cibles.length > 0 && r.date_divergente !== true) ??
        valides.find((r) => r.cibles.length > 0) ??
        valides[0];
      if (cite === undefined) continue;
      citantes.push({
        cite,
        document,
        corpus,
        autorite: autoriteDe(corpus),
        intitule: intitule(unite),
        date_acte: unite.date_acte,
        url: unite.url,
      });
    }
  }
  citantes.sort(
    (gauche, droite) =>
      droite.date_acte.localeCompare(gauche.date_acte) || gauche.document.localeCompare(droite.document),
  );
  const comptes = new Map<string, number>();
  for (const citante of citantes) comptes.set(citante.autorite, (comptes.get(citante.autorite) ?? 0) + 1);

  const messages = [
    cibles.length === 0 ? `${lue.reference} n'est pas une décision du corpus : elle est rendue sans cible.` : null,
    cibles.length > 1 ? `${lue.reference} désigne ${cibles.length} décisions du corpus : toutes sont rendues.` : null,
    citantes.length === 0
      ? `Aucune décision du corpus ne cite ${lue.reference} parmi les références reconnues ; ` +
        "la liste est non exhaustive et ne prouve pas qu'elle n'est jamais citée."
      : null,
  ].filter((partie) => partie !== null);

  return {
    ...vide,
    trouve: true,
    reference: lue.reference,
    famille: lue.famille,
    cibles,
    total: citantes.length,
    par_autorite: [...comptes.entries()]
      .map(([autorite, decisions]) => ({ autorite, decisions }))
      .sort((g, d) => d.decisions - g.decisions || g.autorite.localeCompare(d.autorite)),
    decisions: citantes.slice(decalage, decalage + limite),
    tronque: decalage + limite < citantes.length,
    ...(messages.length === 0 ? {} : { message: messages.join(" ") }),
  };
}
