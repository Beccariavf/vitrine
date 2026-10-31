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
import { writeEntries } from "../veille/write.ts";

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
const FNAC_PUB_DATE = "Thu, 29 Oct 2026 13:00:00 +0100";

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
function entrySources(root: string): Array<{ source: string; title: string; id: string }> {
  return listFiles(root)
    .filter((file) => file.includes("entries"))
    .map((file) => JSON.parse(readFileSync(join(root, file), "utf8")) as { source: string; title: string; id: string });
}

describe("deux sources", () => {
  let root: string;
  const both = new Map([
    [CNIL.feedUrl, FULL],
    [CJEU.feedUrl, CJUE_FEED],
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
    const reduced = new Map([
      [CNIL.feedUrl, FULL],
      [CJEU.feedUrl, CJUE_REDUCED],
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
