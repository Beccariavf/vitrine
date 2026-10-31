import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import type { FetchLike } from "../veille/fetch.ts";
import { fetchEntries, parseCetatDate } from "../veille/sources/cetat.ts";
import { assignThemes, readThemes } from "../veille/themes.ts";
import type { Theme } from "../veille/themes.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const THEMES = readThemes(ROOT);
const SEARCH = readFileSync(new URL("./fixtures/cetat/search.json", import.meta.url), "utf8");
const NOW = new Date("2023-05-10T00:00:00.000Z");
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

function only(id: string): Theme[] {
  return THEMES.map((theme) => ({ ...theme, active: theme.id === id }));
}

function fakeFetch(calls: string[]): FetchLike {
  return async (url) => {
    calls.push(url);
    if (url.includes("oauth")) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: "token", expires_in: 3600 }) };
    }
    return { ok: true, status: 200, text: async () => SEARCH };
  };
}

describe("la source CETAT", () => {
  it("lit la date du titre", () => {
    assert.equal(
      parseCetatDate("Conseil d'État, 10ème - 9ème chambres réunies, 04/05/2023, 464445"),
      "2023-05-04T12:00:00.000Z",
    );
    assert.equal(parseCetatDate("Conseil d'État, sans date"), null);
    assert.equal(parseCetatDate("Conseil d'État, 31/02/2023, 1"), null);
  });

  it("construit une entrée avec résumé, URL et matière", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: only("donnees-personnelles"), now: NOW });

    assert.equal(result.entries.length, 1);
    const entry = result.entries[0];
    assert.ok(entry);
    assert.equal(entry.source, "cetat");
    assert.equal(entry.publishedAt, "2023-05-04T12:00:00.000Z");
    assert.equal(entry.url, "https://www.legifrance.gouv.fr/ceta/id/CETATEXT000047525048");
    assert.match(entry.summary ?? "", /RGPD/);
    assert.ok(entry.references.some((reference) => reference.includes("2016/679")));
    assert.deepEqual(assignThemes([entry], THEMES)[0]?.themes, ["donnees-personnelles"]);
    assert.equal(result.raw.length, 1);
  });

  it("réutilise le jeton et fusionne les matières d'une même décision", async () => {
    const calls: string[] = [];
    const two = THEMES.map((theme) => ({
      ...theme,
      active: theme.id === "donnees-personnelles" || theme.id === "ia",
    }));
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: two, now: NOW });

    assert.equal(calls.filter((url) => url.includes("oauth")).length, 1);
    assert.equal(result.entries.length, 1);
    assert.deepEqual(assignThemes(result.entries, THEMES)[0]?.themes, ["donnees-personnelles"]);
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
