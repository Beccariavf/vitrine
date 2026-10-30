import { strict as assert } from "node:assert";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { run } from "../veille/main.ts";
import type { FetchLike } from "../veille/main.ts";
import { writeEntries } from "../veille/write.ts";

const FULL = readFileSync(new URL("./fixtures/cnil/feed.xml", import.meta.url), "utf8");
const REDUCED = readFileSync(new URL("./fixtures/cnil/feed-reduced.xml", import.meta.url), "utf8");

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
    const result = await run({ fetchImpl: fetchReturning(FULL), rootDir: root });

    assert.equal(result.entryPaths.length, 10);
    const raw = readFileSync(result.rawPath, "utf8");
    assert.equal(raw, FULL);

    const files = listFiles(root);
    const entryFiles = files.filter((file) => file.includes("entries"));
    assert.equal(entryFiles.length, 10);
    assert.equal(files.length, 11);
  });

  it("adresse le snapshot par son contenu", async () => {
    const first = await run({ fetchImpl: fetchReturning(FULL), rootDir: root });

    const other = tempRoot();
    try {
      const second = await run({ fetchImpl: fetchReturning(FULL), rootDir: other });
      assert.equal(second.rawPath.replace(other, ""), first.rawPath.replace(root, ""));
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it("range chaque entrée à la date UTC de publication", async () => {
    const result = await run({ fetchImpl: fetchReturning(FULL), rootDir: root });

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

    await run({ fetchImpl: fetchReturning(FULL), rootDir: root });

    assert.deepEqual(snapshotFiles(root), before);
    assert.deepEqual(
      listFiles(root).map((file) => statSync(join(root, file)).mtimeMs),
      stamps,
    );
  });

  it("conserve les entrées antérieures quand le flux se réduit", async () => {
    const before = snapshotFiles(root);

    const result = await run({ fetchImpl: fetchReturning(REDUCED), rootDir: root });

    assert.equal(result.entryPaths.length, 3);
    const after = snapshotFiles(root);
    for (const [file, content] of Object.entries(before)) {
      assert.equal(after[file], content);
    }
    assert.equal(listFiles(root).filter((file) => file.includes("entries")).length, 10);
  });
});

describe("une entrée sans date", () => {
  it("est écrite sous unknown/", () => {
    const root = tempRoot();
    try {
      const entry = {
        id: "0123456789abcdef",
        title: "Sans date",
        url: "https://www.cnil.fr/fr/sans-date",
        publishedAt: null,
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
      run({ fetchImpl: fetchFailing(), rootDir: root }),
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
      run({ fetchImpl: fetchHttpError, rootDir: root }),
      /HTTP 503/,
    );
    assert.deepEqual(listFiles(root), []);
  });

  it("lève une erreur et n'écrit aucun fichier quand le flux est illisible", async () => {
    await assert.rejects(
      run({ fetchImpl: fetchReturning("<rss><channel><item></rss>"), rootDir: root }),
      /not valid XML/,
    );
    assert.deepEqual(listFiles(root), []);
  });
});
