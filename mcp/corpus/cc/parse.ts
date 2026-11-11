/**
 * Lit une décision Judilibre et la découpe en unités indexables.
 *
 * Le filtre de pertinence est déterministe et compté : une décision est retenue
 * quand son visa cite un instrument de protection des données, ou quand son
 * texte porte au moins `occurrences_min` expressions centrales. Une décision
 * antérieure à la borne, hors sujet ou sans texte est écartée avec son motif.
 */

import { texteVisible } from "../parse.ts";
import type { Unite } from "../parse.ts";
import { decouperParagraphes } from "../cnil/parse.ts";

/** Métadonnées du corpus, lues depuis `mcp/corpus/cc/descripteur.json`. */
export type DescripteurCc = {
  corpus: string;
  nom: string;
  titre: string;
  url_texte: string;
  date_min: string;
  champs: string;
  /** Phrases exactes envoyées à Judilibre, sans guillemets. */
  requetes: string[];
  /** Expressions dont le nombre d'occurrences décide de la pertinence. */
  mots_cles: string[];
  occurrences_min: number;
  licence: string;
  max_appels: number;
  taille_page: number;
};

/** Décision Judilibre telle que `/decision` la rend. */
export type DecisionJudilibre = {
  id?: unknown;
  jurisdiction?: unknown;
  chamber?: unknown;
  number?: unknown;
  numbers?: unknown;
  decision_date?: unknown;
  solution?: unknown;
  type?: unknown;
  publication?: unknown;
  ecli?: unknown;
  summary?: unknown;
  themes?: unknown;
  text?: unknown;
  visa?: unknown;
};

export type MotifEcartCc = "avant_borne" | "date_invalide" | "hors_sujet" | "texte_vide";

export type EcartesCc = Record<MotifEcartCc, number>;

export const ECARTES_CC_VIDES: EcartesCc = {
  avant_borne: 0,
  date_invalide: 0,
  hors_sujet: 0,
  texte_vide: 0,
};

export type VerdictCc =
  | { retenue: true; decision: DecisionCc }
  | { retenue: false; motif: MotifEcartCc };

export type DecisionCc = {
  id: string;
  chambre: string;
  numero: string;
  date: string;
  statut: string;
  url: string;
  /** Chemin d'affichage : juridiction, chambre, type et date. */
  chemin: string;
  visa: string[];
  paragraphes: string[];
  /** Nombre d'expressions centrales rencontrées dans le texte. */
  occurrences: number;
  /** Vrai si le visa cite un instrument de protection des données. */
  visaPertinent: boolean;
};

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const CHAMBRES: Record<string, string> = {
  pl: "Assemblée plénière",
  mi: "Chambre mixte",
  civ1: "Première chambre civile",
  civ2: "Deuxième chambre civile",
  civ3: "Troisième chambre civile",
  comm: "Chambre commerciale financière et économique",
  soc: "Chambre sociale",
  cr: "Chambre criminelle",
  creun: "Chambres réunies",
  ordo: "Première présidence (Ordonnance)",
  allciv: "Toutes les chambres civiles",
  other: "Autre chambre",
};

const PUBLICATIONS: Record<string, string> = {
  b: "Publié au Bulletin",
  r: "Publié au Rapport",
  l: "Publié aux Lettres de chambre",
  c: "Communiqué",
  n: "Non publié au Bulletin",
};

const SOLUTIONS: Record<string, string> = {
  cassation: "Cassation",
  rejet: "Rejet",
  annulation: "Annulation",
  avis: "Avis",
  decheance: "Déchéance",
  designation: "Désignation de juridiction",
  irrecevabilite: "Irrecevabilité",
  nonlieu: "Non-lieu à statuer",
  qpc: "QPC renvoi",
  qpcother: "QPC autres",
  rabat: "Rabat",
  reglement: "Règlement des juges",
  renvoi: "Renvoi",
  other: "Autre",
};

const TYPES: Record<string, string> = {
  arret: "Arrêt",
  avis: "Avis",
  qpc: "QPC",
  ordonnance: "Ordonnance",
  saisie: "Saisie",
  other: "Décision",
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "UTC",
});

/** Forme comparable : minuscules, sans diacritiques, apostrophes droites. */
export function normaliserCc(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nombre d'expressions centrales rencontrées dans un texte. L'alternance prend
 * l'expression la plus longue à chaque position : une occurrence ne compte
 * qu'une fois, même quand elle appartient à deux expressions.
 */
export function compterMotsCles(texte: string, motsCles: readonly string[]): number {
  const expressions = motsCles
    .map((motCle) => normaliserCc(motCle))
    .filter((motCle) => motCle !== "")
    .sort((gauche, droite) => droite.length - gauche.length)
    .map((motCle) => motCle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (expressions.length === 0) return 0;
  const motif = new RegExp(expressions.join("|"), "g");
  return [...normaliserCc(texte).matchAll(motif)].length;
}

/** Titres du visa, balises retirées ; un visa absent rend un tableau vide. */
export function visaTitres(decision: DecisionJudilibre): string[] {
  if (!Array.isArray(decision.visa)) return [];
  return decision.visa
    .map((entree) => {
      if (typeof entree !== "object" || entree === null) return "";
      const titre = (entree as { title?: unknown }).title;
      return typeof titre === "string" ? texteVisible(titre) : "";
    })
    .filter((titre) => titre.trim() !== "");
}

function chaine(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** Date lisible d'une décision ; `null` quand elle est invalide. */
export function dateLisible(date: string): string | null {
  if (!DATE_ISO.test(date)) return null;
  const valeur = new Date(`${date}T12:00:00.000Z`);
  return Number.isNaN(valeur.getTime()) ? null : dateFormat.format(valeur);
}

/** Libellé de statut : publication au recueil, puis solution. */
export function statutCc(decision: DecisionJudilibre): string {
  const publications = Array.isArray(decision.publication)
    ? decision.publication.filter((code): code is string => typeof code === "string")
    : [];
  const publication =
    publications.map((code) => PUBLICATIONS[code]).find((libelle) => libelle !== undefined) ??
    PUBLICATIONS.n ??
    "Non publié au Bulletin";
  const solution = SOLUTIONS[chaine(decision.solution)] ?? chaine(decision.solution);
  return solution === "" ? publication : `${publication} · ${solution}`;
}

/** Chemin d'affichage d'une décision : chambre, type et date. */
export function cheminCc(decision: DecisionJudilibre): string {
  const chambre = CHAMBRES[chaine(decision.chamber)] ?? "Chambre inconnue";
  const type = TYPES[chaine(decision.type)] ?? "Décision";
  const date = dateLisible(chaine(decision.decision_date));
  return ["Cour de cassation", chambre, date === null ? type : `${type} du ${date}`].join(" > ");
}

/** Paragraphes non vides d'un texte Judilibre. */
export function paragraphesDecision(texte: string): string[] {
  return texte
    .split(/\n+/)
    .map((paragraphe) => paragraphe.replace(/\s+/g, " ").trim())
    .filter((paragraphe) => paragraphe !== "");
}

/**
 * Classe une décision : borne de date, texte, puis pertinence. La décision
 * retenue porte son visa, ses paragraphes et le compte qui l'a fait retenir.
 */
export function classerDecisionCc(
  brute: DecisionJudilibre,
  descripteur: DescripteurCc,
  dateMin = descripteur.date_min,
  /** Une décision publiée par la veille est retenue hors filtre de pertinence. */
  forcer = false,
): VerdictCc {
  const id = chaine(brute.id);
  const date = chaine(brute.decision_date);
  if (id === "" || !DATE_ISO.test(date) || Number.isNaN(Date.parse(date))) {
    return { retenue: false, motif: "date_invalide" };
  }
  if (date < dateMin) return { retenue: false, motif: "avant_borne" };

  const texte = typeof brute.text === "string" ? brute.text : "";
  const paragraphes = paragraphesDecision(texte);
  if (paragraphes.length === 0) return { retenue: false, motif: "texte_vide" };

  const visa = visaTitres(brute);
  const visaPertinent = compterMotsCles(visa.join(" ; "), descripteur.mots_cles) > 0;
  const occurrences = compterMotsCles(texte, descripteur.mots_cles);
  if (!forcer && !visaPertinent && occurrences < descripteur.occurrences_min) {
    return { retenue: false, motif: "hors_sujet" };
  }

  return {
    retenue: true,
    decision: {
      id,
      chambre: CHAMBRES[chaine(brute.chamber)] ?? "Chambre inconnue",
      numero: chaine(brute.number),
      date,
      statut: statutCc(brute),
      url: descripteur.url_texte.replace("{id}", id),
      chemin: cheminCc(brute),
      visa,
      paragraphes,
      occurrences,
      visaPertinent,
    },
  };
}

/**
 * Unités d'une décision : le visa, puis les fragments du texte découpé par
 * paragraphes. La numérotation des fragments est la nôtre, dite par le chemin.
 */
export function unitesCc(decision: DecisionCc, descripteur: DescripteurCc): Unite[] {
  const chemin = decision.chemin;
  const unites: Unite[] = [];
  const base = {
    document: decision.id,
    corpus: descripteur.corpus,
    niveau: "fragment" as const,
    date_acte: decision.date,
    date_debut: decision.date,
    date_fin: null,
    statut: decision.statut,
    url: decision.url,
  };

  if (decision.visa.length > 0) {
    unites.push({
      ...base,
      ref: `${decision.id}#visa`,
      numero: "visa",
      chemin: `${chemin} > Visa`,
      texte: decision.visa.join(" ; "),
    });
  }

  decouperParagraphes(decision.paragraphes).forEach((texte, index) => {
    unites.push({
      ...base,
      ref: `${decision.id}#f${index}`,
      numero: String(index),
      chemin: `${
        decision.numero === "" ? chemin : `${chemin} > ${decision.numero}`
      } > Texte`,
      texte,
    });
  });

  return unites;
}
