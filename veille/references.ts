/**
 * Références juridiques principales : titre officiel des arrêts CJUE, section
 * « Textes de référence » des pages CNIL, visa de la Cour de cassation. Aucune
 * invention : on ne rend que les instruments et articles réellement cités.
 */

import { toPlainText } from "./summary.ts";

/** Instrument : règlement, directive, décision, avec son numéro officiel. */
const INSTRUMENT =
  /\b(Règlement|Directive|Décision|Décision-cadre|Recommandation)\s*(?:\((UE|CE|CEE|Euratom|UE,\s*Euratom)\))?\s*(?:n[o°]\s*)?(\d{1,4}\/\d{1,4}(?:\/[A-Z]{1,4})?)/gi;

/** Article ou liste d'articles : « Article 5 », « articles 5 et 6 », « articles 5 à 7 ». */
const ARTICLE = /\bArticles?\s+(\d+(?:\s*(?:,|et|à|-|–)\s*\d+)*)/gi;

/** Une mention de charte ou de traité avant l'article ne relève pas de l'instrument courant. */
const OTHER_INSTRUMENT = /\bcharte\b|\btrait[ée]\b|\bTFUE\b|\bTUE\b|\bconvention\b|\baccord\b|\bprotocole\b|\bpacte\b|\bstatut\b/i;

function normalize(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function instrumentLabel(type: string, institution: string | undefined, number: string): string {
  const capitalized = type[0]?.toUpperCase() + type.slice(1).toLowerCase();
  return institution === undefined
    ? `${capitalized} ${number}`
    : `${capitalized} (${institution}) ${number}`;
}

/** Extrait les numéros d'articles d'un fragment, plages comprises. */
function articleNumbers(body: string): string[] {
  const numbers = [...body.matchAll(/\d+/g)].map((match) => match[0]);
  if (numbers.length === 2 && /^\d+\s*(?:à|-|–)\s*\d+$/.test(body)) {
    return [`${numbers[0]}–${numbers[1]}`];
  }
  return numbers;
}

/** Instruments CNIL nommés, avec leur libellé canonique. */
const CNIL_INSTRUMENTS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  {
    pattern: /\b(?:RGPD|règlement général sur la protection des données|règlement\s*\(UE\)\s*(?:n[o°]\s*)?2016\/679)\b/i,
    label: "Règlement (UE) 2016/679",
  },
  {
    pattern: /\b(?:loi\s+Informatique\s+et\s+Libertés|loi\s+n[o°]\s*78-17)\b/i,
    label: "Loi Informatique et Libertés",
  },
  {
    pattern: /\b(?:Code\s+des\s+postes\s+et\s+des\s+communications\s+électroniques|CPCE)\b/i,
    label: "Code des postes et des communications électroniques",
  },
  {
    pattern: /\bdirective\s+ePrivacy\b/i,
    label: "Directive 2002/58/CE",
  },
  {
    pattern: /\bCode\s+de\s+la\s+consommation\b/i,
    label: "Code de la consommation",
  },
];

/** Directive générique : « Directive (UE) 2016/680 », « Directive 95/46/CE ». */
const CNIL_DIRECTIVE =
  /\bDirective\s*(?:\((UE|CE|CEE|Euratom)\))?\s*(?:n[o°]\s*)?(\d{1,4}\/\d{1,4}(?:\/[A-Z]{1,4})?)/i;

/** Article CNIL : simple, L./R./D., point, 1er, liste, plage, « et suivants ». */
const CNIL_ARTICLE =
  /\bArticles?\s+((?:[LRD]\.\s*)?\d+(?:er)?(?:[.-]\d+)*(?:\s*(?:,|et|à|-|–)\s*(?:[LRD]\.\s*)?\d+(?:er)?(?:[.-]\d+)*)*(?:\s+et\s+suivants?)?)/gi;

/** Numéro d'article normalisé : `L.223-1` devient `L. 223-1`. */
function normalizeCnilArticle(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^([LRD])\.\s*/i, "$1. ")
    .trim();
}

/** Découpe une liste ou une plage d'articles CNIL, suffixe « et suivants » compris. */
function cnilArticleNumbers(body: string): string[] {
  const suffixMatch = body.match(/\s+et\s+suivants?$/i);
  const suffix = suffixMatch ? " et suivants" : "";
  const core = suffixMatch ? body.slice(0, suffixMatch.index) : body;
  const parts = [...core.matchAll(/[LRD]\.\s*\d+(?:er)?(?:[.-]\d+)*|\d+(?:er)?(?:[.-]\d+)*/gi)].map(
    (match) => normalizeCnilArticle(match[0]),
  );

  if (
    parts.length === 2 &&
    /^(?:[LRD]\.\s*)?\d+(?:er)?(?:[.-]\d+)*\s*(?:à|-|–)\s*(?:[LRD]\.\s*)?\d+(?:er)?(?:[.-]\d+)*$/i.test(
      core.trim(),
    )
  ) {
    return [`${parts[0]}–${parts[1]}${suffix}`];
  }

  if (suffix && parts.length > 0) parts[parts.length - 1] += suffix;
  return parts;
}

/** Instrument CNIL reconnu dans un item, ou `null`. */
function cnilInstrument(text: string): string | null {
  for (const instrument of CNIL_INSTRUMENTS) {
    if (instrument.pattern.test(text)) return instrument.label;
  }

  const directive = CNIL_DIRECTIVE.exec(text);
  if (directive === null) return null;
  return instrumentLabel("Directive", directive[1], directive[2] ?? "");
}

/**
 * Extrait les références des items de la section CNIL « Textes de référence ».
 * Un item sans instrument reconnu ou sans article est ignoré ; les articles d'un
 * même instrument sont regroupés, comme pour les arrêts CJUE.
 */
export function extractCnilReferences(items: readonly string[]): string[] {
  const byInstrument = new Map<string, string[]>();

  for (const item of items) {
    const text = normalize(item);
    const instrument = cnilInstrument(text);
    if (instrument === null) continue;

    const articles: string[] = [];
    for (const match of text.matchAll(CNIL_ARTICLE)) {
      articles.push(...cnilArticleNumbers(match[1] ?? ""));
    }
    if (articles.length === 0) continue;

    const existing = byInstrument.get(instrument) ?? [];
    for (const article of articles) {
      if (!existing.includes(article)) existing.push(article);
    }
    byInstrument.set(instrument, existing);
  }

  return [...byInstrument].map(([instrument, articles]) => `${instrument} · art. ${articles.join(", ")}`);
}

/** Paragraphe d'un visa : « § 1 » qualifie l'article, il ne le numérote pas. */
const VISA_PARAGRAPH = /\s*§\s*\d+/g;

/** Deux virgules qui se suivent après la suppression d'un paragraphe. */
const VISA_DOUBLE_COMMA = /(?:,\s*){2,}/g;

/** Virgule laissée devant la conjonction après la suppression d'un paragraphe. */
const VISA_CONJUNCTION_COMMA = /,\s*(?=(?:et|ou)\s)/gi;

/** Virgule qui sépare la liste d'articles de l'instrument qu'elle vise. */
const VISA_INSTRUMENT_COMMA = /,\s*(?=(?:du\s|de\s+la\s|des\s|de\s+l['’]|d['’]|de\s))/gi;

/**
 * Ramène un visa de la Cour de cassation à la liste de ses articles : le champ
 * porte des titres HTML et des paragraphes, pas une phrase lisible.
 */
function cleanVisaItem(item: string): string {
  return toPlainText(item)
    .replace(VISA_PARAGRAPH, "")
    .replace(VISA_DOUBLE_COMMA, ", ")
    .replace(VISA_CONJUNCTION_COMMA, " ")
    .replace(VISA_INSTRUMENT_COMMA, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fusionne des listes `instrument · art. …` : mêmes instruments regroupés,
 * articles dédoublonnés, ordre de première rencontre conservé.
 */
function mergeReferences(...lists: readonly string[][]): string[] {
  const byInstrument = new Map<string, string[]>();

  for (const list of lists) {
    for (const reference of list) {
      const separator = reference.indexOf(" · art. ");
      if (separator === -1) continue;

      const instrument = reference.slice(0, separator);
      const articles = reference.slice(separator + " · art. ".length).split(", ");
      const existing = byInstrument.get(instrument) ?? [];
      for (const article of articles) {
        if (article !== "" && !existing.includes(article)) existing.push(article);
      }
      byInstrument.set(instrument, existing);
    }
  }

  return [...byInstrument].map(([instrument, articles]) => `${instrument} · art. ${articles.join(", ")}`);
}

/**
 * Extrait les références du visa d'une décision de la Cour de cassation.
 * Chaque visa est nettoyé puis passé aux deux extracteurs : les instruments
 * français nommés (LIL, CPCE, ePrivacy, Code de la consommation) et les actes
 * européens génériques (règlements, directives, décisions). Les résultats sont
 * fusionnés par instrument ; un texte de procédure ou un code non suivi est ignoré.
 */
export function extractVisaReferences(items: readonly string[]): string[] {
  const lists: string[][] = [];
  for (const item of items) {
    const cleaned = cleanVisaItem(item);
    lists.push(extractCnilReferences([cleaned]), extractReferences(cleaned));
  }
  return mergeReferences(...lists);
}

/**
 * Extrait les références principales d'un titre officiel.
 * Seuls les instruments suivis d'au moins un article sont rendus, pour éviter
 * les entrées purement décoratives.
 */
export function extractReferences(title: string): string[] {
  const text = normalize(title);
  const instruments = [...text.matchAll(INSTRUMENT)];
  if (instruments.length === 0) return [];

  const byInstrument = new Map<string, string[]>();

  instruments.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < instruments.length ? (instruments[index + 1]?.index ?? text.length) : text.length;
    const segment = text.slice(start, end);

    const articles: string[] = [];
    const beforeSegment = index === 0 ? text.slice(0, match.index ?? 0) : "";
    for (const article of beforeSegment.matchAll(ARTICLE)) {
      const startIndex = article.index ?? 0;
      const before = beforeSegment.slice(Math.max(0, startIndex - 40), startIndex);
      if (OTHER_INSTRUMENT.test(before)) continue;
      articles.push(...articleNumbers(article[1] ?? ""));
    }

    for (const article of segment.matchAll(ARTICLE)) {
      const index = article.index ?? 0;
      const before = segment.slice(Math.max(0, index - 40), index);
      if (OTHER_INSTRUMENT.test(before)) continue;
      articles.push(...articleNumbers(article[1] ?? ""));
    }

    if (articles.length === 0) return;

    const label = instrumentLabel(match[1] ?? "", match[2], match[3] ?? "");
    const existing = byInstrument.get(label) ?? [];
    for (const value of articles) {
      if (!existing.includes(value)) existing.push(value);
    }
    byInstrument.set(label, existing);
  });

  return [...byInstrument].map(([instrument, articles]) => `${instrument} · art. ${articles.join(", ")}`);
}
