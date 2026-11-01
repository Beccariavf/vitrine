import type { Entry } from "../types.ts";
import type { FetchLike } from "../fetch.ts";
import { extractVisaReferences } from "../references.ts";
import { toSummary } from "../summary.ts";
import type { Theme } from "../themes.ts";
import { activeThemes, instrumentOf, themeQueries } from "../themes.ts";
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

  return {
    id,
    title,
    officialTitle: title,
    url: `https://www.courdecassation.fr/decision/${id}`,
    publishedAt: `${decisionDate}T12:00:00.000Z`,
    summary,
    references: [],
    themes: [],
    source: SOURCE_ID,
  };
}

type ApiContext = {
  fetchImpl: FetchLike;
  themes: Theme[];
  now?: Date;
};

/** Titres du visa d'une décision ; un visa absent rend un tableau vide. */
function visaTitles(decision: unknown): string[] {
  if (typeof decision !== "object" || decision === null) return [];
  const visa = (decision as { visa?: unknown }).visa;
  if (!Array.isArray(visa)) return [];

  return visa
    .map((item) => (typeof item === "object" && item !== null ? (item as { title?: unknown }).title : null))
    .filter((title): title is string => typeof title === "string" && title.trim() !== "");
}

/** Instruments des matières rattachées à l'entrée : le visa ne peut citer qu'eux. */
function followedInstruments(entry: Entry, themes: Theme[]): Set<string> {
  const instruments = new Set<string>();
  for (const theme of themes) {
    if (!entry.themes.includes(theme.id)) continue;
    for (const instrument of theme.instruments) instruments.add(instrument);
  }
  return instruments;
}

type JudilibreApiResult = {
  raw: string[];
  entries: Entry[];
  warnings: string[];
  enrich?: (entry: Entry) => Promise<string[] | null>;
};

/**
 * Une recherche par matière sur les 30 derniers jours, dédupliquée par décision.
 * Les références viennent ensuite du visa, lu décision par décision après le
 * rattachement : la recherche ne le porte pas.
 */
export async function fetchEntries({
  fetchImpl,
  themes,
  now = new Date(),
}: ApiContext): Promise<JudilibreApiResult> {
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
  const warnings: string[] = [];
  const byId = new Map<string, Entry>();

  for (const theme of activeThemes(themes)) {
    for (const term of themeQueries(theme)) {
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

        // La requête est un indice de matière : une décision trouvée par une
        // matière doit survivre au rattachement même si son résumé la tait.
        const existing = byId.get(entry.id);
        if (existing === undefined) {
          byId.set(entry.id, { ...entry, themes: [theme.id] });
        } else if (!existing.themes.includes(theme.id)) {
          existing.themes.push(theme.id);
        }
      }
    }
  }

  return {
    raw,
    entries: [...byId.values()],
    warnings,
    /** Lit le visa d'une décision retenue, sous le budget restant de la passe. */
    async enrich(entry: Entry): Promise<string[] | null> {
      if (session.remainingCalls() <= 0) {
        warnings.push(`judilibre decision ${entry.id}: PISTE call budget exhausted, entry deferred`);
        return null;
      }

      const response = await session.judilibreDecision(fetchImpl, entry.id);
      raw.push(JSON.stringify(response, null, 2));

      const instruments = followedInstruments(entry, themes);
      return extractVisaReferences(visaTitles(response)).filter((reference) =>
        instruments.has(instrumentOf(reference)),
      );
    },
  };
}
