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

/** Instrument trouvé dans un visa : son libellé canonique et sa position. */
type VisaInstrument = { label: string; index: number; end: number };

/** Un instrument nommé (RGPD, LIL, CPCE, ePrivacy, Code de la consommation) ou un acte européen. */
function visaInstruments(text: string): VisaInstrument[] {
  const matches: VisaInstrument[] = [];

  for (const instrument of CNIL_INSTRUMENTS) {
    const flags = instrument.pattern.flags.includes("g") ? instrument.pattern.flags : `${instrument.pattern.flags}g`;
    for (const match of text.matchAll(new RegExp(instrument.pattern.source, flags))) {
      const index = match.index ?? 0;
      matches.push({ label: instrument.label, index, end: index + match[0].length });
    }
  }

  for (const match of text.matchAll(INSTRUMENT)) {
    const index = match.index ?? 0;
    const end = index + match[0].length;
    if (matches.some((known) => index < known.end && end > known.index)) continue;
    matches.push({
      label: instrumentLabel(match[1] ?? "", match[2], match[3] ?? ""),
      index,
      end,
    });
  }

  return matches.sort((a, b) => a.index - b.index);
}

/**
 * Références d'un visa : chaque instrument ne reçoit que les articles de sa
 * fenêtre. La fenêtre s'arrête au prochain instrument, ou à la liste « et
 * articles … » qui introduit ses articles.
 */
function visaItemReferences(text: string): string[] {
  const instruments = visaInstruments(text);
  const byInstrument = new Map<string, string[]>();
  let cursor = 0;

  instruments.forEach((instrument, index) => {
    const start = cursor;
    let end = index + 1 < instruments.length ? (instruments[index + 1]?.index ?? text.length) : text.length;

    const between = text.slice(start, end);
    const nextList =
      index + 1 < instruments.length
        ? between.search(
            /\bet\s+(?:l['’])?articles?\b|,\s*(?:et\s+)?(?:l['’])?articles?\b|ainsi\s+que\s+(?:l['’])?articles?\b/i,
          )
        : -1;
    if (nextList !== -1) end = start + nextList;

    const window = text.slice(start, end);
    cursor = end;

    const articles: string[] = [];
    for (const article of window.matchAll(CNIL_ARTICLE)) {
      const at = article.index ?? 0;
      const before = window.slice(Math.max(0, at - 40), at);
      if (OTHER_INSTRUMENT.test(before)) continue;
      articles.push(...cnilArticleNumbers(article[1] ?? ""));
    }
    if (articles.length === 0) return;

    const existing = byInstrument.get(instrument.label) ?? [];
    for (const article of articles) {
      if (!existing.includes(article)) existing.push(article);
    }
    byInstrument.set(instrument.label, existing);
  });

  return [...byInstrument].map(([instrument, articles]) => `${instrument} · art. ${articles.join(", ")}`);
}

/**
 * Extrait les références du visa d'une décision de la Cour de cassation.
 * Chaque visa est nettoyé puis découpé par instrument : les instruments
 * français nommés (LIL, CPCE, ePrivacy, Code de la consommation) et les actes
 * européens génériques (règlements, directives, décisions) sont reconnus. Un
 * texte de procédure ou un code non suivi est ignoré.
 */
export function extractVisaReferences(items: readonly string[]): string[] {
  return mergeReferences(...items.map((item) => visaItemReferences(cleanVisaItem(item))));
}

/** Formule d'application qui introduit un article dans les motifs d'une décision administrative. */
const CETAT_FORMULA = /\b(?:aux termes|il résulte|en vertu|en application|sur le fondement)\b/gi;

/**
 * La loi Informatique et Libertés, telle que le Conseil d'État la nomme : par sa
 * date et son objet, pas par son numéro seul. La forme longue est ramenée au
 * libellé canonique pour que `visaInstruments` la reconnaisse.
 */
const CETAT_LIL =
  /\bloi\s+(?:n[o°]\s*78-17\s+)?du\s+6\s+janvier\s+1978(?:\s+relative\s+à\s+l['’]informatique,\s*aux\s+fichiers\s+et\s+aux\s+libertés)?/gi;

/**
 * La directive ePrivacy, nommée par sa date dans les motifs : « la directive du
 * Parlement européen et du Conseil du 12 juillet 2002 ». La date est ramenée au
 * numéro que `visaInstruments` reconnaît.
 */
const CETAT_EPRIVACY =
  /\bdirective\s+(?:du Parlement européen et du Conseil\s+)?du\s+12\s+juillet\s+2002\b/gi;

/** Verbe d'application qui suit l'instrument dans une phrase de considérant. */
const CETAT_VERB =
  /^(?:garantit|permet|prévoit|dispose|oblige|impose|interdit|exige|confère|ouvre|accorde|définit|fixe|soumet|autorise|protège|énonce)\b/i;

/** Anaphore d'un instrument déjà nommé : « du même règlement », « de la même loi ». */
const CETAT_ANAPHORA = /\b(?:du|de\s+la|de\s+l['’]|des)\s+même\s+(règlement|loi|code|directive)\b/i;

/** « L'article 15 du RGPD … » : l'article nomme son instrument, sans anaphore. */
const CETAT_ARTICLE_OPENING = /\bL['’]articles?\s+((?:[LRD]\.\s*)?\d+(?:er)?(?:[.-]\d+)*)/g;

/** Ouverture de phrase : début du texte, après une ponctuation forte ou un numéro de point. */
const CETAT_SENTENCE_START = /(?:^|[.!?;:»]\s+|\d+\.\s+)$/;

/** Verbes de grief : ce qu'une partie reproche n'est pas ce que la décision applique. */
const CETAT_GRIEVANCE =
  /\b(?:soutient|soutiennent|est soutenu|sont soutenus|allègue|allèguent|invoque|invoquent|fait valoir|font valoir|reproche|reprochent|conteste|contestent|se plaint|se plaignent)\b\s*(?:(?:qu['’]|que|de ce que)\s*)?,?\s*$/iu;

/** « Selon la requérante » : le locuteur d'un grief, à distinguer d'une formule appliquée. */
const CETAT_SELON_PARTY =
  /\bselon\s+(?:l['’]|la\s+|le\s+|les\s+|un\s+|une\s+|cette\s+|ces\s+)?(?:requérant(?:e)?s?|société?s?|partie?s?|ministre?s?|administration?s?|CNIL|défendeur(?:e)?s?|défenderesse?s?|demandeur(?:e)?s?|demanderesse?s?|elles|elle|eux|lui)(?![\p{L}\p{N}])[^.;:]{0,40},\s*$/iu;

/** Marqueur de discours rapporté qui introduit directement la formule : la suite est un grief. */
const CETAT_REPORTED = new RegExp(
  `${CETAT_GRIEVANCE.source}|${CETAT_SELON_PARTY.source}|\\b(?:moyen|grief)\\s+tiré\\s+de\\s+ce\\s+que\\s*,?\\s*$`,
  "iu",
);

/** Ponctuation qui ferme une proposition : l'instrument doit la précéder. */
const CETAT_CLAUSE_END = /[.;:,«»]/;

/**
 * Les motifs commencent à « Considérant ce qui suit » : avant, ce sont les visas
 * et les moyens des parties, où une formule d'application peut n'être qu'un grief.
 * Sans ce repère, rien n'est extrait plutôt que de risquer un grief.
 */
function reasoningPart(text: string): string {
  const match = text.match(/Considérant ce qui suit\s*[.:]?/i);
  return match === null ? "" : text.slice((match.index ?? 0) + match[0].length);
}

/** Ramène le texte de la décision à la forme que lisent les motifs. */
function normalizeCetatText(text: string): string {
  return normalize(text)
    .replace(CETAT_LIL, "loi Informatique et Libertés")
    .replace(CETAT_EPRIVACY, "directive 2002/58/CE");
}

/** Nature d'un instrument : le mot qui porte son type, pour résoudre une anaphore. */
function instrumentNature(label: string): string {
  return (label.split(" ")[0] ?? "").toLowerCase();
}

/** Ajoute des articles à un instrument, sans doublon et dans l'ordre de rencontre. */
function addArticles(byInstrument: Map<string, string[]>, label: string, articles: readonly string[]): void {
  const existing = byInstrument.get(label) ?? [];
  for (const article of articles) {
    if (!existing.includes(article)) existing.push(article);
  }
  byInstrument.set(label, existing);
}

/**
 * Articles introduits par une formule d'application : « aux termes de l'article
 * 82 de la loi … », « il résulte des dispositions combinées des articles 8 et 20
 * de la loi … ». La formule doit porter sur le premier article de la proposition,
 * et l'instrument est celui qui le suit immédiatement.
 */
function formulaReferences(text: string): Map<string, string[]> {
  const byInstrument = new Map<string, string[]>();

  for (const formula of text.matchAll(CETAT_FORMULA)) {
    const start = (formula.index ?? 0) + formula[0].length;
    const rest = text.slice(start);
    const article = [...rest.matchAll(CNIL_ARTICLE)][0];
    if (article === undefined) continue;

    const gap = rest.slice(0, article.index ?? 0);
    if (CETAT_CLAUSE_END.test(gap)) continue;

    // « Il résulte de l'instruction que … » n'énonce pas une règle appliquée :
    // la formule doit porter sur un article ou sur ses dispositions.
    if (/^il résulte$/i.test(formula[0]) && !/^\s*(?:de\s+l['’]articles?|des\s+dispositions)/i.test(rest)) {
      continue;
    }

    // Une formule directement introduite par « soutient que » ou « est soutenu »
    // énonce un grief, même dans les motifs.
    const before = text.slice(Math.max(0, (formula.index ?? 0) - 40), formula.index ?? 0);
    if (CETAT_REPORTED.test(before)) continue;

    const articles = cnilArticleNumbers(article[1] ?? "");
    if (articles.length === 0) continue;

    const after = rest.slice((article.index ?? 0) + article[0].length);
    const instrument = visaInstruments(after)[0];
    if (instrument === undefined) continue;
    if (CETAT_CLAUSE_END.test(after.slice(0, instrument.index))) continue;

    addArticles(byInstrument, instrument.label, articles);
  }

  return byInstrument;
}

/**
 * Articles introduits par une phrase de considérant : « L'article 15 du RGPD
 * garantit … », « L'article 16 du même règlement permet … ». Seule une phrase
 * qui ouvre la proposition et qu'un verbe d'application suit compte.
 */
function considerantReferences(text: string): Map<string, string[]> {
  const byInstrument = new Map<string, string[]>();

  for (const match of text.matchAll(CETAT_ARTICLE_OPENING)) {
    const index = match.index ?? 0;
    if (!CETAT_SENTENCE_START.test(text.slice(0, index))) continue;

    const start = index + match[0].length;
    const tail = text.slice(start, start + 120);
    const end = tail.search(CETAT_CLAUSE_END);
    const clause = end === -1 ? tail : tail.slice(0, end);

    let label: string | null = null;
    let instrumentEnd = 0;

    const anaphora = CETAT_ANAPHORA.exec(clause);
    if (anaphora !== null) {
      const nature = anaphora[1] ?? "";
      const named = visaInstruments(text.slice(0, index)).filter(
        (instrument) => instrumentNature(instrument.label) === nature,
      );
      const previous = named[named.length - 1];
      if (previous === undefined) continue;
      label = previous.label;
      instrumentEnd = (anaphora.index ?? 0) + anaphora[0].length;
    } else {
      const named = visaInstruments(clause)[0];
      if (named === undefined) continue;
      label = named.label;
      instrumentEnd = named.end;
    }

    if (!CETAT_VERB.test(clause.slice(instrumentEnd).trimStart())) continue;

    const articles = cnilArticleNumbers(match[1] ?? "");
    if (articles.length === 0) continue;
    addArticles(byInstrument, label, articles);
  }

  return byInstrument;
}

/**
 * Extrait les articles que la décision du Conseil d'État applique, lus dans son
 * texte intégral : formules d'application (« aux termes », « il résulte », « en
 * vertu », « en application », « sur le fondement »), phrases de considérant et
 * leur anaphore. Un article cité au titre d'un grief n'est pas retenu : la
 * tournure « les dispositions de l'article » ne déclenche rien.
 */
export function extractCetatReferences(text: string): string[] {
  const reasoning = reasoningPart(normalizeCetatText(text));
  if (reasoning === "") return [];

  const byInstrument = formulaReferences(reasoning);

  for (const [label, articles] of considerantReferences(reasoning)) {
    addArticles(byInstrument, label, articles);
  }

  return [...byInstrument].map(([instrument, articles]) => `${instrument} · art. ${articles.join(", ")}`);
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
