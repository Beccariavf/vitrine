import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, describe, it } from "node:test";
import type { FetchLike } from "../veille/fetch.ts";
import { resetUsage } from "../veille/piste.ts";
import { fetchEntries, WINDOW_DAYS } from "../veille/sources/judilibre.ts";
import { assignThemes, readThemes } from "../veille/themes.ts";
import type { Theme } from "../veille/themes.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const THEMES = readThemes(ROOT);
const SEARCH = readFileSync(new URL("./fixtures/judilibre/search.json", import.meta.url), "utf8");
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

function fakeFetch(calls: string[]): FetchLike {
  return async (url) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => SEARCH };
  };
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
    assert.ok((entry.summary ?? "").startsWith("En application des articles"));
    assert.ok((entry.summary ?? "").length <= 200);
    assert.ok(entry.references.some((reference) => reference.includes("2016/679")));
    assert.deepEqual(assignThemes([entry], THEMES)[0]?.themes, ["donnees-personnelles"]);
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

  it("reste sous le plafond avec cinq matières", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: THEMES, now: NOW });

    assert.equal(calls.length, 6);
    assert.equal(result.entries.length, 1);
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
