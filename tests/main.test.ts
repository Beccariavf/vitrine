import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import type { ApiSource, FetchLike } from "../veille/main.ts";
import { run } from "../veille/main.ts";
import { readThemes } from "../veille/themes.ts";
import type { Entry } from "../veille/types.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const THEMES = readThemes(ROOT);
const VISA = "Règlement (UE) 2016/679 · art. 6";

/** Le `fetch` d'une source API n'est jamais appelé par le pipeline lui-même. */
const NO_FETCH: FetchLike = async () => {
  throw new Error("aucun appel réseau attendu");
};

/** Une entrée qui se rattache à « Données personnelles » par son titre. */
function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "0123456789abcdef",
    title: "Décision sur la protection des données",
    officialTitle: "Décision sur la protection des données",
    url: "https://exemple.fr/decision",
    publishedAt: "2026-10-07T12:00:00.000Z",
    summary: "Un résumé.",
    references: [],
    themes: [],
    source: "factice",
    ...overrides,
  };
}

/**
 * Une source API factice : une entrée, une réponse brute, et un enrichissement
 * qui note chaque appel et ajoute sa propre réponse brute.
 */
function apiSource(
  options: { entry?: Entry; references?: string[]; fail?: boolean; calls?: string[] } = {},
): ApiSource {
  const calls = options.calls ?? [];
  const source: ApiSource = {
    kind: "api",
    id: "factice",
    async fetchEntries() {
      const raw = ['{"results":[]}'];
      return {
        raw,
        entries: [options.entry ?? entry()],
        warnings: [],
        async enrich(current: Entry): Promise<string[]> {
          calls.push(current.id);
          if (options.fail === true) throw new Error("HTTP 503");
          raw.push('{"visa":[{"title":"Article 6 du RGPD"}]}');
          return options.references ?? [VISA];
        },
      };
    },
  };
  return source;
}

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "vitrine-main-"));
}

function entryPath(root: string, id: string): string {
  return join(root, "data", "entries", "2026", "10", `${id}.json`);
}

function readWritten(root: string, id: string): Entry {
  return JSON.parse(readFileSync(entryPath(root, id), "utf8")) as Entry;
}

function writePrevious(root: string, value: Entry): void {
  const dir = join(root, "data", "entries", "2026", "10");
  mkdirSync(dir, { recursive: true });
  writeFileSync(entryPath(root, value.id), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function withRoot(body: (root: string) => Promise<void>): () => Promise<void> {
  return async () => {
    const root = tempRoot();
    try {
      await body(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
}

describe("l'enrichissement d'une source API", () => {
  let root: string;

  before(() => {
    root = tempRoot();
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("écrit le visa d'une entrée nouvelle après le rattachement", async () => {
    const calls: string[] = [];
    await run({
      fetchImpl: NO_FETCH,
      rootDir: root,
      sources: [apiSource({ calls })],
      themes: THEMES,
    });

    const written = readWritten(root, "0123456789abcdef");
    assert.deepEqual(written.references, [VISA]);
    assert.deepEqual(written.themes, ["donnees-personnelles"]);
    assert.deepEqual(calls, ["0123456789abcdef"], "l'entrée est enrichie après le rattachement");
  });

  it(
    "réutilise les références déjà écrites sans rappeler la source",
    withRoot(async (temp) => {
      const calls: string[] = [];
      writePrevious(temp, entry({ references: ["Règlement (UE) 2016/679 · art. 99"] }));

      await run({
        fetchImpl: NO_FETCH,
        rootDir: temp,
        sources: [apiSource({ calls })],
        themes: THEMES,
      });

      assert.deepEqual(calls, []);
      assert.deepEqual(readWritten(temp, "0123456789abcdef").references, [
        "Règlement (UE) 2016/679 · art. 99",
      ]);
    }),
  );

  it(
    "enrichit une entrée existante laissée sans référence",
    withRoot(async (temp) => {
      const calls: string[] = [];
      writePrevious(temp, entry({ references: [] }));

      await run({
        fetchImpl: NO_FETCH,
        rootDir: temp,
        sources: [apiSource({ calls })],
        themes: THEMES,
      });

      assert.deepEqual(calls, ["0123456789abcdef"]);
      assert.deepEqual(readWritten(temp, "0123456789abcdef").references, [VISA]);
    }),
  );

  it(
    "garde l'entrée sans référence et avertit quand l'enrichissement échoue",
    withRoot(async (temp) => {
      const result = await run({
        fetchImpl: NO_FETCH,
        rootDir: temp,
        sources: [apiSource({ fail: true })],
        themes: THEMES,
      });

      assert.deepEqual(readWritten(temp, "0123456789abcdef").references, []);
      assert.match(result.warnings.join(" "), /factice entry 0123456789abcdef: HTTP 503/);
    }),
  );

  it("écrit le snapshot brut de l'enrichissement", async () => {
    const temp = tempRoot();
    try {
      const result = await run({
        fetchImpl: NO_FETCH,
        rootDir: temp,
        sources: [apiSource()],
        themes: THEMES,
      });

      const rawPaths = result.sources[0]?.rawPaths ?? [];
      assert.equal(rawPaths.length, 2);
      assert.match(readFileSync(rawPaths[1] ?? "", "utf8"), /visa/);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it(
    "ne rattache rien quand aucune matière ne correspond",
    withRoot(async (temp) => {
      const calls: string[] = [];
      await run({
        fetchImpl: NO_FETCH,
        rootDir: temp,
        sources: [apiSource({ entry: entry({ title: "Avis sans rapport", officialTitle: "Avis sans rapport" }), calls })],
        themes: THEMES,
      });

      assert.deepEqual(calls, [], "une entrée écartée n'est pas enrichie");
      assert.throws(() => readFileSync(entryPath(temp, "0123456789abcdef")), /ENOENT/);
    }),
  );
});
