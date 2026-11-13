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
export type ReferenceDecision = { famille: Famille; cle: string; reference: string; date?: string };

/** Une décision du corpus qu'une référence désigne. */
export type CibleDecision = {
  document: string;
  corpus: string;
  intitule: string;
  date_acte: string;
  url: string;
};

/** Une décision citée, telle que les outils la rendent ; `cibles` vide hors corpus. */
export type DecisionCitee = { reference: string; famille: Famille; cibles: CibleDecision[] };

/**
 * Précision relevée par famille sur l'échantillon relu (`mesure.md`). Une famille
 * absente n'a pas été mesurée : elle n'est pas exposée.
 */
export const MESURES: Partial<Record<Famille, { justes: number; relues: number }>> = {
  affaire_ue: { justes: 60, relues: 60 },
  ecli: { justes: 34, relues: 55 },
  deliberation_cnil: { justes: 60, relues: 60 },
  requete_ce: { justes: 59, relues: 60 },
  pourvoi_cc: { justes: 60, relues: 60 },
};

/** Seuil fixé par l'utilisateur : borne basse de Wilson à 95 %. */
export const SEUIL_BORNE_BASSE = 0.9;

/** Borne basse de Wilson d'une famille ; `null` si elle n'a pas été mesurée. */
export function borneBasse(famille: Famille): number | null {
  const mesure = MESURES[famille];
  return mesure === undefined ? null : intervalleWilson(mesure.justes, mesure.relues)[0];
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
const DELIBERATION = /\bdélibération(?:s)?\s+(?:[^.;]{0,40}?\s)?n[°o]s?\s?(\d{2}|\d{4})-(\d{2,3})\b/gi;
const REQUETE = /\bn°s?\s?(\d{6})\b/g;
const CONTEXTE_CE = /Conseil d['’]État|\bCE\b|\bC\.E\.|\breq\.\s?$/;
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
const COUPURE = /\.\s(?=[A-ZÀ-Ý])|;|\bn°/g;
/** Fin de phrase seule, pour borner le contexte d'une requête du Conseil d'État. */
const FIN_PHRASE = /\.\s(?=[A-ZÀ-Ý])|;|\n/g;

/**
 * Date de la décision citée. D'abord la date qui suit la référence (« n° 80-20
 * du 24 juin 1980 »), puis la dernière date des 90 caractères qui la précèdent
 * (« CE, 21 avril 2021, n° 393099 »), sans franchir une fin de proposition ni
 * une autre mention « n° » : la date d'un autre acte ne date pas la référence.
 */
function dateDe(texte: string, position: number, longueur: number): string | undefined {
  const apres = /^[^.;]{0,20}?\b(?:du|en date du)\s+/i.exec(texte.slice(position + longueur, position + longueur + 60));
  if (apres !== null) {
    const suite = texte.slice(position + longueur + apres[0].length);
    const date = new RegExp(`^${DATE.source}`, "i").exec(suite);
    if (date !== null) return iso(date);
  }
  // Le « n° » qui annonce la référence elle-même ne coupe pas.
  const fenetre = texte.slice(Math.max(0, position - 90), position).replace(/(?:pourvoi\s+)?n°s?\s*$/i, "");
  const coupures = [...fenetre.matchAll(COUPURE)];
  const derniere = coupures[coupures.length - 1];
  const proposition = derniere === undefined ? fenetre : fenetre.slice((derniere.index ?? 0) + derniere[0].length);
  const dates = [...proposition.matchAll(DATE)];
  const date = dates[dates.length - 1];
  return date === undefined ? undefined : iso(date);
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
  }
  for (const m of texte.matchAll(ECLI)) pousser(m.index, m[0].length, "ecli", m[0], m[0]);
  for (const m of texte.matchAll(SAN)) {
    const cle = `SAN-${m[1]}-${(m[2] ?? "").padStart(3, "0")}`;
    pousser(m.index, m[0].length, "deliberation_cnil", cle, cle);
  }
  for (const m of texte.matchAll(DELIBERATION)) {
    const cle = cleDeliberation(`${m[1]}-${m[2]}`);
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
    .filter(({ famille, cle }) => {
      const clef = `${famille}|${cle}`;
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
  const references = extraireReferences(texte.replace(/^Pourvoi\s+n°\s?/i, ""));
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

type EtatCorpus = {
  signature: string;
  /** Références citées par document, auto-citations comprises : la résolution les retire. */
  references: Map<string, ReferenceDecision[]>;
  /** Clé `famille|cle` → décisions de ce corpus qui la portent. */
  cibles: Map<string, CibleDecision[]>;
  /** Première unité de chaque document : date, URL et intitulé. */
  premieres: Map<string, Unite>;
};

const CACHE = new Map<string, EtatCorpus>();

/** Lit un corpus de décisions une fois par modification de son fichier. */
function etatCorpus(rootDir: string, corpus: string): EtatCorpus {
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

/**
 * Les décisions du corpus qu'une clé désigne, tous corpus confondus. Quand le
 * texte date la décision citée, seules les décisions de cette date restent : un
 * numéro de requête ou de pourvoi porte souvent plusieurs décisions, et aucune
 * cible ne vaut mieux qu'une décision d'une autre date.
 */
function resoudre(rootDir: string, reference: ReferenceDecision): CibleDecision[] {
  const clef = `${reference.famille}|${reference.cle}`;
  const candidats = CORPUS_DECISIONS.flatMap((corpus) => etatCorpus(rootDir, corpus).cibles.get(clef) ?? []);
  return reference.date === undefined
    ? candidats
    : candidats.filter((cible) => cible.date_acte === reference.date);
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
  const references = etatCorpus(rootDir, corpus).references.get(document) ?? [];
  const rendues: DecisionCitee[] = [];
  for (const reference of references) {
    if (!familles.has(reference.famille)) continue;
    const cibles = resoudre(rootDir, reference);
    if (cibles.some((cible) => cible.document === document)) continue;
    rendues.push({ reference: reference.reference, famille: reference.famille, cibles });
  }
  return rendues;
}

export const LIMITE_DEFAUT = 50;
export const LIMITE_MAX = 500;

export type DecisionCitante = CibleDecision & { autorite: string };

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
  return (
    `${famille} : ${mesure.justes}/${mesure.relues} justes, borne basse ` +
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

  const cibles = resoudre(rootDir, lue);
  const citantes: DecisionCitante[] = [];
  for (const corpus of CORPUS_DECISIONS) {
    const etat = etatCorpus(rootDir, corpus);
    for (const [document, references] of etat.references) {
      if (cibles.some((cible) => cible.document === document)) continue;
      if (!references.some((r) => r.famille === lue.famille && r.cle === lue.cle)) continue;
      const unite = etat.premieres.get(document);
      if (unite === undefined) continue;
      citantes.push({
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
