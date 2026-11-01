import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Entry } from "../veille/types.ts";
import type { FetchLike } from "../veille/fetch.ts";
import { MAX_CALLS_PER_RUN, PisteSession, resetUsage } from "../veille/piste.ts";
import { decisionText, fetchEntries, JUDILIBRE_SEARCH_RESERVE, parseCetatDate } from "../veille/sources/cetat.ts";
import { assignThemes, readThemes } from "../veille/themes.ts";
import type { Theme } from "../veille/themes.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const THEMES = readThemes(ROOT);
const SEARCH = readFileSync(new URL("./fixtures/cetat/search.json", import.meta.url), "utf8");
const CONSULT = readFileSync(new URL("./fixtures/cetat/consult.json", import.meta.url), "utf8");
const NOW = new Date("2023-05-10T00:00:00.000Z");
const saved = { ...process.env };

/** L'identifiant porté par `consult.json` : la décision 511155. */
const CONSULT_ID = "CETATEXT000055005484";

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

function fakeFetch(calls: string[], consult = CONSULT): FetchLike {
  return async (url) => {
    calls.push(url);
    if (url.includes("oauth")) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: "token", expires_in: 3600 }) };
    }
    if (url.includes("consult")) {
      return { ok: true, status: 200, text: async () => consult };
    }
    return { ok: true, status: 200, text: async () => SEARCH };
  };
}

/** Une décision retenue par la recherche, rattachée aux matières données. */
function decisionEntry(themes: string[]): Entry {
  return {
    id: CONSULT_ID,
    title: "Conseil d'État, 10ème chambre jugeant seule, 20/10/2026, 511155, Inédit au recueil Lebon",
    officialTitle: "Conseil d'État, 10ème chambre jugeant seule, 20/10/2026, 511155, Inédit au recueil Lebon",
    url: `https://www.legifrance.gouv.fr/ceta/id/${CONSULT_ID}`,
    publishedAt: "2026-10-20T12:00:00.000Z",
    summary: null,
    references: [],
    themes,
    source: "cetat",
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

  it("construit une entrée avec résumé, URL et matière, sans référence", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: only("donnees-personnelles"), now: NOW });

    assert.equal(result.entries.length, 1);
    const entry = result.entries[0];
    assert.ok(entry);
    assert.equal(entry.source, "cetat");
    assert.equal(entry.publishedAt, "2023-05-04T12:00:00.000Z");
    assert.equal(entry.url, "https://www.legifrance.gouv.fr/ceta/id/CETATEXT000047525048");
    assert.match(entry.summary ?? "", /RGPD/);
    assert.deepEqual(entry.references, []);
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

  it("interroge les deux requêtes de plateformes et déduplique", async () => {
    const bodies: string[] = [];
    let oauth = 0;
    const fetchImpl: FetchLike = async (url, init) => {
      if (url.includes("oauth")) {
        oauth += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: "token", expires_in: 3600 }),
        };
      }
      bodies.push(String(init?.body ?? ""));
      return { ok: true, status: 200, text: async () => SEARCH };
    };

    const result = await fetchEntries({
      fetchImpl,
      themes: only("plateformes"),
      now: NOW,
    });

    assert.equal(bodies.length, 2);
    assert.ok(bodies.some((body) => body.includes("2022/2065")));
    assert.ok(bodies.some((body) => body.includes("2022/1925")));
    assert.equal(oauth, 1);
    assert.equal(result.entries.length, 1);
    assert.equal(result.raw.length, 2);
  });

  it("reste sous le plafond avec cinq matières", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: THEMES, now: NOW });

    assert.equal(calls.filter((url) => url.includes("search")).length, 6);
    assert.equal(calls.filter((url) => url.includes("oauth")).length, 1);
    assert.equal(calls.length, 7);
    assert.equal(result.entries.length, 1);
  });

  it("enrichit une décision des articles lus dans son texte", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: only("donnees-personnelles"), now: NOW });
    assert.ok(result.enrich);

    const references = await result.enrich(decisionEntry(["donnees-personnelles"]));

    assert.deepEqual(references, ["Règlement (UE) 2016/679 · art. 15"]);
    assert.equal(calls.filter((url) => url.includes("consult")).length, 1);
    assert.ok(result.raw.some((body) => body.includes(`"${CONSULT_ID}"`)));
  });

  it("écarte un instrument hors des matières de l'entrée", async () => {
    const calls: string[] = [];
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls), themes: only("donnees-personnelles"), now: NOW });
    assert.ok(result.enrich);

    assert.deepEqual(await result.enrich(decisionEntry(["ia"])), []);
  });

  it("rend un tableau vide pour un texte sans formule", async () => {
    const calls: string[] = [];
    const empty = JSON.stringify({ text: { id: CONSULT_ID, texte: "" } });
    const result = await fetchEntries({ fetchImpl: fakeFetch(calls, empty), themes: only("donnees-personnelles"), now: NOW });
    assert.ok(result.enrich);

    assert.deepEqual(await result.enrich(decisionEntry(["donnees-personnelles"])), []);
  });

  it("diffère une décision quand le budget restant est réservé à Judilibre", async () => {
    const calls: string[] = [];
    const fetchImpl = fakeFetch(calls);
    const session = new PisteSession({ clientId: "client", clientSecret: "secret", keyId: "key" });

    const burnt = MAX_CALLS_PER_RUN - JUDILIBRE_SEARCH_RESERVE - 2;
    for (let index = 0; index < burnt; index += 1) await session.judilibreDecision(fetchImpl, "abc");

    const result = await fetchEntries({ fetchImpl, themes: only("donnees-personnelles"), now: NOW });
    assert.ok(result.enrich);

    assert.equal(await result.enrich(decisionEntry(["donnees-personnelles"])), null);
    assert.equal(calls.filter((url) => url.includes("consult")).length, 0);
    assert.match(
      result.warnings[0] ?? "",
      new RegExp(`budget reserved for ${JUDILIBRE_SEARCH_RESERVE} Judilibre searches`),
    );
  });

  it("lit le texte intégral de la réponse de consultation", () => {
    assert.match(decisionText(JSON.parse(CONSULT)), /Aux termes du paragraphe 3 de l’article 15 du RGPD/);
    assert.equal(decisionText({ text: {} }), "");
    assert.equal(decisionText(null), "");
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
