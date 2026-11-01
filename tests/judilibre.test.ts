import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, describe, it } from "node:test";
import type { FetchLike } from "../veille/fetch.ts";
import { MAX_CALLS_PER_RUN, PisteSession, resetUsage } from "../veille/piste.ts";
import { fetchEntries, WINDOW_DAYS } from "../veille/sources/judilibre.ts";
import { assignThemes, readThemes } from "../veille/themes.ts";
import type { Theme } from "../veille/themes.ts";
import type { Entry } from "../veille/types.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const THEMES = readThemes(ROOT);
const SEARCH = readFileSync(new URL("./fixtures/judilibre/search.json", import.meta.url), "utf8");
const DECISION = readFileSync(new URL("./fixtures/judilibre/decision.json", import.meta.url), "utf8");
const NOW = new Date("2026-10-31T00:00:00.000Z");
const saved = { ...process.env };

before(() => {
  process.env.PISTE_CLIENT_ID = "client";
  process.env.PISTE_CLIENT_SECRET = "secret";
  process.env.PISTE_KEY_ID = "key";
});

const KEYS = ["PISTE_CLIENT_ID", "PISTE_CLIENT_SECRET", "PISTE_KEY_ID"];

function restoreEnv(source: NodeJS.ProcessEnv): void {
  for (const key of KEYS) {
    const value = source[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

after(() => {
  restoreEnv(saved);
});

beforeEach(() => {
  resetUsage();
});

function only(id: string): Theme[] {
  return THEMES.map((theme) => ({ ...theme, active: theme.id === id }));
}

/** Un `fetch` simulé : la recherche d'un côté, la décision de l'autre. */
function fakeFetch(calls: string[], decision = DECISION): FetchLike {
  return async (url) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => (url.includes("/decision") ? decision : SEARCH) };
  };
}

/** L'enrichissement d'une source qui en rend un, ou l'échec explicite du test. */
function enrichOf(result: { enrich?: (entry: Entry) => Promise<string[]> }): (entry: Entry) => Promise<string[]> {
  assert.ok(result.enrich, "la source Judilibre doit porter un enrichissement");
  return result.enrich;
}

describe("la source Judilibre", () => {
  it("construit une entrée datée, titrée, sourcée et rattachée", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({
      fetchImpl: fakeFetch(calls),
      themes: only("donnees-personnelles"),
      now: NOW,
    });

    assert.equal(result.entries.length, 1);
    const entry = result.entries[0];
    assert.ok(entry);
    assert.equal(entry.source, "judilibre");
    assert.equal(entry.publishedAt, "2026-10-07T12:00:00.000Z");
    assert.equal(entry.url, "https://www.courdecassation.fr/decision/6ac6079ec27382d099f5a06e");
    assert.match(entry.title, /Cour de cassation, chambre sociale, 7 octobre 2026, 25-10\.664/);
    assert.ok((entry.summary ?? "").startsWith("des personnes physiques à l'égard du traitement des données"));
    assert.ok((entry.summary ?? "").length <= 200);
    assert.deepEqual(entry.references, []);
    assert.deepEqual(assignThemes([entry], THEMES)[0]?.themes, ["donnees-personnelles"]);
  });

  it("lit le visa de la décision après le rattachement", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({
      fetchImpl: fakeFetch(calls),
      themes: only("donnees-personnelles"),
      now: NOW,
    });

    const entry = assignThemes(result.entries, THEMES)[0];
    assert.ok(entry);
    const references = await enrichOf(result)(entry);

    assert.deepEqual(references, ["Règlement (UE) 2016/679 · art. 4, 5, 6"]);
    const decision = calls.find((url) => url.includes("/decision"));
    assert.equal(
      decision,
      "https://api.piste.gouv.fr/cassation/judilibre/v1.0/decision?id=6ac6079ec27382d099f5a06e",
    );
    assert.equal(result.raw.length, 2);
  });

  it("borne la recherche aux 30 derniers jours", async () => {
    const calls: string[] = [];
    await fetchEntries({ fetchImpl: fakeFetch(calls), themes: only("donnees-personnelles"), now: NOW });

    const search = calls.find((url) => url.includes("/search"));
    assert.ok(search);
    assert.ok(search.includes("date_start=2026-10-01"));
    assert.ok(search.includes("date_end=2026-10-31"));
    assert.equal(WINDOW_DAYS, 30);
  });

  it("déduplique une décision trouvée par deux matières", async () => {
    const calls: string[] = [];
    const two = THEMES.map((theme) => ({
      ...theme,
      active: theme.id === "donnees-personnelles" || theme.id === "ia",
    }));
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: two, now: NOW });

    assert.equal(result.entries.length, 1);
    assert.deepEqual(assignThemes(result.entries, THEMES)[0]?.themes, ["donnees-personnelles"]);
  });

  it("interroge les deux requêtes de plateformes et déduplique", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({
      fetchImpl: fakeFetch(calls),
      themes: only("plateformes"),
      now: NOW,
    });

    assert.equal(calls.length, 2);
    const queries = calls.map((url) => new URL(url).searchParams.get("query"));
    assert.deepEqual(queries.sort(), ['"2022/1925"', '"2022/2065"']);
    assert.equal(result.entries.length, 1);
    assert.equal(result.raw.length, 2);
  });

  it("reste sous le plafond avec cinq matières, visa compris", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: THEMES, now: NOW });

    assert.equal(calls.length, 6);
    assert.equal(result.entries.length, 1);

    const entry = assignThemes(result.entries, THEMES)[0];
    assert.ok(entry);
    await enrichOf(result)(entry);
    assert.equal(calls.length, 7);
    assert.ok(calls.length < MAX_CALLS_PER_RUN);
  });

  it("ne rend aucune référence pour un visa vide", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({
      fetchImpl: fakeFetch(calls, JSON.stringify({ id: "6ac6079ec27382d099f5a06e" })),
      themes: only("donnees-personnelles"),
      now: NOW,
    });

    const entry = assignThemes(result.entries, THEMES)[0];
    assert.ok(entry);
    assert.deepEqual(await enrichOf(result)(entry), []);
  });

  it("écarte un instrument hors des matières de l'entrée", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({
      fetchImpl: fakeFetch(calls),
      themes: THEMES,
      now: NOW,
    });

    const entry = assignThemes(result.entries, THEMES)[0];
    assert.ok(entry);
    assert.deepEqual(await enrichOf(result)({ ...entry, themes: ["ia"] }), []);
  });

  it("n'appelle plus la décision quand le plafond est atteint et avertit", async () => {
    const session = new PisteSession({ clientId: "c", clientSecret: "s", keyId: "k" });
    const noop: FetchLike = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ results: [] }) });
    for (let index = 1; index < MAX_CALLS_PER_RUN; index += 1) {
      await session.judilibre(noop, new URLSearchParams());
    }
    assert.equal(session.remainingCalls(), 1);

    const calls: string[] = [];
    const result = await fetchEntries({
      fetchImpl: fakeFetch(calls),
      themes: only("donnees-personnelles"),
      now: NOW,
    });

    assert.equal(session.remainingCalls(), 0);
    const entry = assignThemes(result.entries, THEMES)[0];
    assert.ok(entry);
    assert.deepEqual(await enrichOf(result)(entry), []);
    assert.equal(calls.filter((url) => url.includes("/decision")).length, 0);
    assert.match(result.warnings[0] ?? "", /budget exhausted/);
  });

  it("avertit et n'appelle rien sans secrets", async () => {
    const previous = { ...process.env };
    delete process.env.PISTE_CLIENT_ID;
    delete process.env.PISTE_CLIENT_SECRET;
    delete process.env.PISTE_KEY_ID;
    try {
      const calls: string[] = [];
      const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: only("donnees-personnelles"), now: NOW });
      assert.equal(calls.length, 0);
      assert.equal(result.entries.length, 0);
      assert.match(result.warnings[0] ?? "", /PISTE configuration missing/);
    } finally {
      restoreEnv(previous);
    }
  });
});
