/**
 * Références juridiques principales d'un arrêt, extraites de son titre officiel.
 * Aucune invention : on ne rend que les instruments et articles réellement cités.
 */

/** Instrument : règlement, directive, décision, avec son numéro officiel. */
const INSTRUMENT =
  /\b(Règlement|Directive|Décision|Décision-cadre|Recommandation)\s*(?:\((UE|CE|CEE|Euratom|UE,\s*Euratom)\))?\s*(?:n[o°]\s*)?(\d{1,4}\/\d{1,4}(?:\/[A-Z]{1,4})?)/gi;

/** Article ou liste d'articles : « Article 5 », « articles 5 et 6 », « articles 5 à 7 ». */
const ARTICLE = /\bArticles?\s+(\d+(?:\s*(?:,|et|à|-|–)\s*\d+)*)/gi;

/** Une mention de charte ou de traité avant l'article ne relève pas de l'instrument courant. */
const OTHER_INSTRUMENT = /\bcharte\b|\btrait[ée]\b|\bTFUE\b|\bTUE\b/i;

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
