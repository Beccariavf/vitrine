import type { Entry } from "../types.ts";
import type { FetchLike } from "../fetch.ts";
import { extractCnilReferences } from "../references.ts";
import { toSummary } from "../summary.ts";
import type { Theme } from "../themes.ts";
import { activeThemes } from "../themes.ts";
import { PisteSession, readPisteConfig } from "../piste.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "judilibre";

/** Les décisions sont publiées avec du retard : une semaine raterait des arrêts. */
export const WINDOW_DAYS = 30;

const CHAMBERS: Record<string, string> = {
  soc: "sociale",
  civ1: "première civile",
  civ2: "deuxième civile",
  civ3: "troisième civile",
  com: "commerciale",
  crim: "criminelle",
  mixte: "mixte",
  pleniere: "plénière",
  ordo: "ordonnance",
};

type JudilibreResult = {
  id?: unknown;
  number?: unknown;
  chamber?: unknown;
  decision_date?: unknown;
  summary?: unknown;
  highlights?: unknown;
  ecli?: unknown;
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "UTC",
});

function dateWindow(now: Date): { start: string; end: string } {
  const end = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { start: startDate.toISOString().slice(0, 10), end };
}

function formatDecisionDate(value: string): string | null {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormat.format(date);
}

function highlightText(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const text = (value as { text?: unknown }).text;
  if (!Array.isArray(text)) return null;
  return text.find((item): item is string => typeof item === "string" && item.trim() !== "") ?? null;
}

function toEntry(result: JudilibreResult): Entry | null {
  const id = typeof result.id === "string" ? result.id : null;
  const decisionDate = typeof result.decision_date === "string" ? result.decision_date : null;
  if (id === null || decisionDate === null) return null;

  const number = typeof result.number === "string" ? result.number : null;
  const chamber = typeof result.chamber === "string" ? result.chamber : null;
  const chamberLabel = chamber === null ? "chambre inconnue" : CHAMBERS[chamber] ?? chamber;
  const readableDate = formatDecisionDate(decisionDate);
  if (readableDate === null) return null;

  const title = `Cour de cassation, chambre ${chamberLabel}, ${readableDate}${number === null ? "" : `, ${number}`}`;
  const rawSummary = highlightText(result.highlights) ?? (typeof result.summary === "string" ? result.summary : null);
  const summary = toSummary(rawSummary);
  const references = extractCnilReferences([`${title} ${rawSummary ?? ""}`]);

  return {
    id,
    title,
    officialTitle: title,
    url: `https://www.courdecassation.fr/decision/${id}`,
    publishedAt: `${decisionDate}T12:00:00.000Z`,
    summary,
    references,
    themes: [],
    source: SOURCE_ID,
  };
}

type ApiContext = {
  fetchImpl: FetchLike;
  themes: Theme[];
  now?: Date;
};

/** Une recherche par matière sur les 30 derniers jours, dédupliquée par décision. */
export async function fetchEntries({
  fetchImpl,
  themes,
  now = new Date(),
}: ApiContext): Promise<{ raw: string[]; entries: Entry[]; warnings: string[] }> {
  const config = readPisteConfig();
  if (config === null) {
    return {
      raw: [],
      entries: [],
      warnings: ["PISTE configuration missing (PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_KEY_ID); skipping CETAT and Judilibre"],
    };
  }

  const session = new PisteSession(config);
  const { start, end } = dateWindow(now);
  const raw: string[] = [];
  const byId = new Map<string, Entry>();

  for (const theme of activeThemes(themes)) {
    const term = theme.terms[0] ?? theme.instruments[0] ?? theme.label;
    const params = new URLSearchParams({
      query: `"${term}"`,
      operator: "and",
      field: "text",
      date_start: start,
      date_end: end,
      sort: "date",
      order: "desc",
      page_size: "50",
    });

    const response = await session.judilibre(fetchImpl, params);
    raw.push(JSON.stringify(response, null, 2));

    const results = typeof response === "object" && response !== null && Array.isArray((response as { results?: unknown }).results)
      ? ((response as { results: unknown[] }).results as JudilibreResult[])
      : [];

    for (const result of results) {
      const entry = toEntry(result);
      if (entry === null) continue;
      if (!byId.has(entry.id)) byId.set(entry.id, entry);
    }
  }

  return { raw, entries: [...byId.values()], warnings: [] };
}
