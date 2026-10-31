import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { run, SOURCES } from "../veille/main.ts";
import type { FetchLike, Source } from "../veille/main.ts";
import { readTags } from "../veille/tags.ts";
import { writeEntries, writeRaw } from "../veille/write.ts";

const FULL = readFileSync(new URL("./fixtures/cnil/feed.xml", import.meta.url), "utf8");
const REDUCED = readFileSync(new URL("./fixtures/cnil/feed-reduced.xml", import.meta.url), "utf8");
const CJUE_FEED = readFileSync(new URL("./fixtures/cjeu/feed.xml", import.meta.url), "utf8");
const CJUE_REDUCED = CJUE_FEED.replace(/<item>\s*<title>CELEX:62024CA0798[\s\S]*?<\/item>/, "");
const CJUE_EMPTY =
  '<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>';
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TOPIC_TAGS = readTags(ROOT);

const CNIL = SOURCES.find((source) => source.id === "cnil") as Source;
const CJEU = SOURCES.find((source) => source.id === "cjeu") as Source;

/** Identifiant de l'actualité FNAC, calculé hors test à partir de `feed.xml`. */
const FNAC_ID = "1fb831fb8c3243d4";
const FNAC_URL = "https://www.cnil.fr/fr/sanction-cookies-app-fnac";
const RECONSTITUTION_URL =
  "https://www.cnil.fr/fr/reconstitution-adresses-professionnelles-quel-cadre";
const FNAC_PUB_DATE = "Thu, 29 Oct 2026 13:00:00 +0100";
const FNAC_PAGE = readFileSync(new URL("./fixtures/cnil/page-fnac.html", import.meta.url), "utf8");
const SINGULAR_PAGE = readFileSync(
  new URL("./fixtures/cnil/page-singular.html", import.meta.url),
  "utf8",
);
const EMPTY_PAGE = readFileSync(
  new URL("./fixtures/cnil/page-no-references.html", import.meta.url),
  "utf8",
);
const CNIL_PAGES = CNIL.parse(FULL, []).map((entry) => [entry.url, EMPTY_PAGE] as const);

/** Le même flux, avec la date de l'actualité FNAC décalée d'un mois. */
const SHIFTED = FULL.replace(FNAC_PUB_DATE, "Sun, 29 Nov 2026 13:00:00 +0100");

/** Le même flux, avec l'actualité FNAC privée de sa date. */
const UNDATED = FULL.replace(`<pubDate>${FNAC_PUB_DATE}</pubDate>`, "");

/** Un `fetch` simulé : aucune requête réseau n'est émise par la suite. */
function fetchReturning(body: string): FetchLike {
  return async () => ({ ok: true, status: 200, text: async () => body });
}

function fetchFailing(): FetchLike {
  return async () => {
    throw new Error("network down");
  };
}

/** Liste récursive des fichiers, triée, en chemins relatifs à la racine. */
function listFiles(root: string, prefix = ""): string[] {
  const files: string[] = [];
  for (const name of readdirSync(join(root, prefix), { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = join(prefix, name.name);
    if (name.isDirectory()) files.push(...listFiles(root, path));
    else files.push(path);
  }
  return files;
}

/** Contenu de tous les fichiers : prouve que rien n'a bougé d'un octet. */
function snapshotFiles(root: string): Record<string, string> {
  const contents: Record<string, string> = {};
  for (const file of listFiles(root)) contents[file] = readFileSync(join(root, file), "utf8");
  return contents;
}

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "vitrine-veille-"));
}

describe("une passe complète", () => {
  let root: string;

  before(() => {
    root = tempRoot();
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("écrit un snapshot brut et une entrée par actualité", async () => {
    const result = await run({ fetchImpl: fetchReturning(FULL), rootDir: root, sources: [CNIL] });

    assert.equal(result.entryPaths.length, 10);
    const rawPath = result.sources[0]?.rawPath;
    assert.ok(rawPath);
    const raw = readFileSync(rawPath, "utf8");
    assert.equal(raw, FULL);

    const files = listFiles(root);
    const entryFiles = files.filter((file) => file.includes("entries"));
    assert.equal(entryFiles.length, 10);
    assert.equal(files.length, 11);
    assert.ok(!files.some((file) => file.endsWith(".tmp")), "aucun fichier temporaire ne doit rester");
  });

  it("adresse le snapshot par son contenu", async () => {
    const result = await run({ fetchImpl: fetchReturning(FULL), rootDir: root, sources: [CNIL] });

    const rawPath = result.sources[0]?.rawPath;
    assert.ok(rawPath);
    const bytes = readFileSync(rawPath);
    const hash = createHash("sha256").update(bytes).digest("hex");
    assert.equal(basename(rawPath), `${hash}.xml`);
    assert.equal(basename(dirname(rawPath)), hash.slice(0, 2));
  });

  it("range chaque entrée à la date UTC de publication", async () => {
    const result = await run({ fetchImpl: fetchReturning(FULL), rootDir: root, sources: [CNIL] });

    for (const path of result.entryPaths) {
      const entry = JSON.parse(readFileSync(path, "utf8")) as { id: string; publishedAt: string };
      const relative = path.slice(root.length + 1);
      assert.equal(
        relative,
        join("data", "entries", entry.publishedAt.slice(0, 4), entry.publishedAt.slice(5, 7), `${entry.id}.json`),
      );
    }
  });

  it("ne change rien à la seconde passe sur le même flux", async () => {
    const before = snapshotFiles(root);
    const stamps = listFiles(root).map((file) => statSync(join(root, file)).mtimeMs);

    await run({ fetchImpl: fetchReturning(FULL), rootDir: root, sources: [CNIL] });

    assert.deepEqual(snapshotFiles(root), before);
    assert.deepEqual(
      listFiles(root).map((file) => statSync(join(root, file)).mtimeMs),
      stamps,
    );
  });

  it("conserve les entrées antérieures quand le flux se réduit", async () => {
    const before = snapshotFiles(root);

    const result = await run({ fetchImpl: fetchReturning(REDUCED), rootDir: root, sources: [CNIL] });

    assert.equal(result.entryPaths.length, 3);
    const after = snapshotFiles(root);
    for (const [file, content] of Object.entries(before)) {
      assert.equal(after[file], content);
    }
    assert.equal(listFiles(root).filter((file) => file.includes("entries")).length, 10);
  });
});

describe("une date corrigée", () => {
  it("remplace l'entrée au lieu d'en laisser une copie", async () => {
    const root = tempRoot();
    try {
      await run({ fetchImpl: fetchReturning(FULL), rootDir: root, sources: [CNIL] });
      const stalePath = join(root, "data", "entries", "2026", "10", `${FNAC_ID}.json`);
      assert.ok(existsSync(stalePath));

      const result = await run({ fetchImpl: fetchReturning(SHIFTED), rootDir: root, sources: [CNIL] });

      const movedPath = join(root, "data", "entries", "2026", "11", `${FNAC_ID}.json`);
      const copies = listFiles(root).filter((file) => basename(file) === `${FNAC_ID}.json`);
      assert.deepEqual(copies, [join("data", "entries", "2026", "11", `${FNAC_ID}.json`)]);
      assert.equal(existsSync(stalePath), false);
      assert.ok(result.entryPaths.includes(movedPath));
      assert.equal(listFiles(root).filter((file) => file.includes("entries")).length, 10);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("une actualité sans date dans le flux", () => {
  it("finit sous unknown/ et n'a qu'un seul fichier", async () => {
    const root = tempRoot();
    try {
      await run({ fetchImpl: fetchReturning(FULL), rootDir: root, sources: [CNIL] });

      const result = await run({ fetchImpl: fetchReturning(UNDATED), rootDir: root, sources: [CNIL] });

      const unknownPath = join(root, "data", "entries", "unknown", `${FNAC_ID}.json`);
      assert.ok(result.entryPaths.includes(unknownPath));
      assert.equal(JSON.parse(readFileSync(unknownPath, "utf8")).publishedAt, null);
      assert.deepEqual(
        listFiles(root).filter((file) => basename(file) === `${FNAC_ID}.json`),
        [join("data", "entries", "unknown", `${FNAC_ID}.json`)],
      );
      assert.equal(listFiles(root).filter((file) => file.includes("entries")).length, 10);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("une entrée sans date", () => {
  it("est écrite sous unknown/", () => {
    const root = tempRoot();
    try {
      const entry = {
        id: "0123456789abcdef",
        title: "Sans date",
        officialTitle: "Sans date",
        url: "https://www.cnil.fr/fr/sans-date",
        publishedAt: null,
        summary: "Une actualité sans date.",
        references: [],
        source: "cnil",
      };
      const [path] = writeEntries(root, [entry]);
      assert.equal(path, join(root, "data", "entries", "unknown", "0123456789abcdef.json"));
      assert.deepEqual(JSON.parse(readFileSync(path ?? "", "utf8")), entry);
      assert.ok(readFileSync(path ?? "", "utf8").endsWith("\n"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("une passe qui échoue", () => {
  let root: string;

  before(() => {
    root = tempRoot();
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("lève une erreur et n'écrit aucun fichier quand la source est injoignable", async () => {
    await assert.rejects(
      run({ fetchImpl: fetchFailing(), rootDir: root, sources: [CNIL] }),
      /network down/,
    );
    assert.deepEqual(listFiles(root), []);
  });

  it("lève une erreur et n'écrit aucun fichier quand la source répond en erreur", async () => {
    const fetchHttpError: FetchLike = async () => ({
      ok: false,
      status: 503,
      text: async () => "",
    });

    await assert.rejects(
      run({ fetchImpl: fetchHttpError, rootDir: root, sources: [CNIL] }),
      /HTTP 503/,
    );
    assert.deepEqual(listFiles(root), []);
  });

  it("conserve le snapshot brut et n'écrit aucune entrée quand le flux est illisible", async () => {
    await assert.rejects(
      run({ fetchImpl: fetchReturning("<rss><channel><item></rss>"), rootDir: root, sources: [CNIL] }),
      /not valid XML/,
    );

    const files = listFiles(root);
    assert.equal(files.filter((file) => file.startsWith(join("data", "raw"))).length, 1);
    assert.equal(files.filter((file) => file.includes("entries")).length, 0);
  });
});

/** Un `fetch` qui répond par URL : les deux flux n'ont pas le même corps. */
function fetchByUrl(bodies: Map<string, string>): FetchLike {
  return async (url) => {
    const body = bodies.get(url);
    if (body === undefined) throw new Error(`unexpected URL ${url}`);
    return { ok: true, status: 200, text: async () => body };
  };
}

/** Les entrées écrites, avec leur source, pour vérifier le mélange. */
function entrySources(
  root: string,
): Array<{ source: string; title: string; id: string; url: string; references: string[] }> {
  return listFiles(root)
    .filter((file) => file.includes("entries"))
    .map(
      (file) =>
        JSON.parse(readFileSync(join(root, file), "utf8")) as {
          source: string;
          title: string;
          id: string;
          url: string;
          references: string[];
        },
    );
}

describe("deux sources", () => {
  let root: string;
  const both = new Map<string, string>([
    [CNIL.feedUrl, FULL],
    [CJEU.feedUrl, CJUE_FEED],
    ...CNIL_PAGES,
  ]);

  before(() => {
    root = tempRoot();
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("écrit les deux snapshots et les entrées des deux sources", async () => {
    const result = await run({
      fetchImpl: fetchByUrl(both),
      rootDir: root,
      sources: SOURCES,
      tags: TOPIC_TAGS,
    });

    assert.equal(result.sources.length, 2);
    assert.equal(result.entryPaths.length, 13);
    const entries = entrySources(root);
    assert.equal(entries.filter((entry) => entry.source === "cnil").length, 10);
    assert.equal(entries.filter((entry) => entry.source === "cjeu").length, 3);
    assert.ok(entries.some((entry) => entry.source === "cjeu" && entry.title.startsWith("Jautiva")));
    assert.equal(listFiles(root).filter((file) => file.startsWith(join("data", "raw"))).length, 2);
    assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  });

  it("conserve un arrêt sorti du flux tant que son tag est actif", async () => {
    const reduced = new Map<string, string>([
      [CNIL.feedUrl, FULL],
      [CJEU.feedUrl, CJUE_REDUCED],
      ...CNIL_PAGES,
    ]);

    const result = await run({
      fetchImpl: fetchByUrl(reduced),
      rootDir: root,
      sources: SOURCES,
      tags: TOPIC_TAGS,
    });

    assert.equal(result.entryPaths.length, 12);
    const entries = entrySources(root);
    assert.ok(entries.some((entry) => entry.source === "cjeu" && entry.title.startsWith("Jautiva")));
    assert.equal(entries.filter((entry) => entry.source === "cjeu").length, 3);
  });

  it("retire les arrêts CJUE quand le tag RGPD est désactivé", async () => {
    const withoutRgpd = TOPIC_TAGS.map((tag) => (tag.id === "rgpd" ? { ...tag, active: false } : tag));

    const result = await run({
      fetchImpl: fetchByUrl(both),
      rootDir: root,
      sources: SOURCES,
      tags: withoutRgpd,
    });

    assert.equal(result.entryPaths.length, 10);
    const entries = entrySources(root);
    assert.equal(entries.filter((entry) => entry.source === "cjeu").length, 0);
    assert.equal(entries.filter((entry) => entry.source === "cnil").length, 10);
  });

  it("traite un flux CJUE vide comme une panne", async () => {
    const fresh = tempRoot();
    try {
      await run({ fetchImpl: fetchByUrl(both), rootDir: fresh, sources: SOURCES, tags: TOPIC_TAGS });
      assert.equal(entrySources(fresh).filter((entry) => entry.source === "cjeu").length, 3);

      const empty = new Map([
        [CNIL.feedUrl, FULL],
        [CJEU.feedUrl, CJUE_EMPTY],
        ...CNIL_PAGES,
      ]);

      await assert.rejects(
        run({ fetchImpl: fetchByUrl(empty), rootDir: fresh, sources: SOURCES, tags: TOPIC_TAGS }),
        /CJUE feed has no item/,
      );
      const entries = entrySources(fresh);
      assert.equal(entries.filter((entry) => entry.source === "cnil").length, 10);
      assert.equal(entries.filter((entry) => entry.source === "cjeu").length, 3);
      assert.ok(entries.some((entry) => entry.title.startsWith("Jautiva")));
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("conserve les entrées CNIL quand le flux CJUE échoue", async () => {
    const fresh = tempRoot();
    const fetchCjeuFails: FetchLike = async (url) => {
      if (url === CJEU.feedUrl) throw new Error("cjeu down");
      return { ok: true, status: 200, text: async () => FULL };
    };

    try {
      await assert.rejects(
        run({ fetchImpl: fetchCjeuFails, rootDir: fresh, sources: SOURCES, tags: TOPIC_TAGS }),
        /cjeu: cjeu feed fetch failed/,
      );
      const entries = entrySources(fresh);
      assert.equal(entries.filter((entry) => entry.source === "cnil").length, 10);
      assert.equal(entries.filter((entry) => entry.source === "cjeu").length, 0);
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });
});

describe("les pages CNIL dans la passe", () => {
  it("enrichit la FNAC et conserve sa page en snapshot HTML", async () => {
    const root = tempRoot();
    try {
      const bodies = new Map<string, string>([
        [CNIL.feedUrl, FULL],
        ...CNIL_PAGES.map(([url]) => [url, url === FNAC_URL ? FNAC_PAGE : EMPTY_PAGE] as const),
      ]);

      const result = await run({ fetchImpl: fetchByUrl(bodies), rootDir: root, sources: [CNIL] });
      const entries = entrySources(root);
      const fnac = entries.find((entry) => entry.url === FNAC_URL);
      const cepd = entries.find(
        (entry) => entry.url === "https://www.cnil.fr/fr/cepd-declaration-lunettes-connectees",
      );

      assert.deepEqual(fnac?.references, ["Loi Informatique et Libertés · art. 82"]);
      assert.deepEqual(cepd?.references, []);
      assert.deepEqual(result.warnings, []);
      assert.equal(result.sources[0]?.pagePaths.length, 1);

      const pagePath = result.sources[0]?.pagePaths[0] ?? "";
      assert.ok(pagePath.endsWith(".html"));
      assert.ok(
        readFileSync(pagePath, "utf8").includes("Article 82 de la loi Informatique et Libertés"),
      );
      assert.equal(
        listFiles(root).filter(
          (file) => file.startsWith(join("data", "raw")) && file.endsWith(".html"),
        ).length,
        1,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne réécrit pas de snapshot quand seules les parties volatiles changent", async () => {
    const root = tempRoot();
    try {
      const bodiesFor = (page: string) =>
        new Map<string, string>([
          [CNIL.feedUrl, FULL],
          ...CNIL_PAGES.map(([url]) => [url, url === FNAC_URL ? page : EMPTY_PAGE] as const),
        ]);

      await run({ fetchImpl: fetchByUrl(bodiesFor(FNAC_PAGE)), rootDir: root, sources: [CNIL] });
      const firstCount = listFiles(root).filter(
        (file) => file.startsWith(join("data", "raw")) && file.endsWith(".html"),
      ).length;
      assert.equal(firstCount, 1);

      const volatile = FNAC_PAGE.replace("<body>", '<body data-build="2">');
      const result = await run({
        fetchImpl: fetchByUrl(bodiesFor(volatile)),
        rootDir: root,
        sources: [CNIL],
      });

      assert.equal(result.sources[0]?.pagePaths.length, 0);
      assert.equal(
        listFiles(root).filter(
          (file) => file.startsWith(join("data", "raw")) && file.endsWith(".html"),
        ).length,
        firstCount,
      );
      const fnac = entrySources(root).find((entry) => entry.url === FNAC_URL);
      assert.deepEqual(fnac?.references, ["Loi Informatique et Libertés · art. 82"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  for (const mode of ["network", "http"] as const) {
    it(`conserve l'entrée avec [] quand la page échoue (${mode})`, async () => {
      const root = tempRoot();
      try {
        const bodies = new Map<string, string>([
          [CNIL.feedUrl, FULL],
          ...CNIL_PAGES.map(
            ([url]) => [url, url === RECONSTITUTION_URL ? SINGULAR_PAGE : EMPTY_PAGE] as const,
          ),
        ]);

        const fetchPageFailure: FetchLike = async (url) => {
          if (url === FNAC_URL) {
            if (mode === "network") throw new Error("page down");
            return { ok: false, status: 500, text: async () => "" };
          }
          const body = bodies.get(url);
          if (body === undefined) throw new Error(`unexpected URL ${url}`);
          return { ok: true, status: 200, text: async () => body };
        };

        const result = await run({
          fetchImpl: fetchPageFailure,
          rootDir: root,
          sources: [CNIL],
        });
        const entries = entrySources(root);
        const fnac = entries.find((entry) => entry.url === FNAC_URL);
        const reconstitution = entries.find((entry) => entry.url === RECONSTITUTION_URL);

        assert.deepEqual(fnac?.references, []);
        assert.deepEqual(reconstitution?.references, ["Règlement (UE) 2016/679 · art. 6"]);
        assert.ok(
          result.warnings.some(
            (warning) =>
              warning.includes(FNAC_URL) &&
              warning.includes(mode === "network" ? "page down" : "HTTP 500"),
          ),
        );
        assert.equal(result.sources[0]?.pagePaths.length, 1);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  it("adresse un snapshot HTML par son contenu", () => {
    const root = tempRoot();
    try {
      const path = writeRaw(root, "<html>page</html>", "html");
      assert.ok(path.endsWith(".html"));
      const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
      assert.equal(basename(path), `${hash}.html`);
      assert.equal(basename(dirname(path)), hash.slice(0, 2));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
