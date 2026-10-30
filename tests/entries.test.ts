import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { getEntries, isRedundantSummary } from "../src/lib/entries.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Nombre de fichiers `.json` sous `dir`, compté sans passer par le lecteur. */
function countEntryFiles(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((total, item) => {
    if (item.isDirectory()) return total + countEntryFiles(join(dir, item.name));
    return item.isFile() && item.name.endsWith(".json") ? total + 1 : total;
  }, 0);
}

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "vitrine-entries-"));
}

/** Écrit `content` sous `data/entries/2026/10/<name>.json` et rend le chemin. */
function writeEntry(root: string, name: string, content: unknown): string {
  const dir = join(root, "data", "entries", "2026", "10");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.json`);
  writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content), "utf8");
  return path;
}

/** Une entrée conforme, surchargeable champ par champ. */
function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "0123456789abcdef",
    title: "Titre",
    url: "https://www.cnil.fr/fr/titre",
    publishedAt: "2026-10-01T12:00:00.000Z",
    summary: "Un résumé.",
    source: "cnil",
    ...overrides,
  };
}

describe("les entrées committées", () => {
  const entries = getEntries(ROOT);

  it("rend une entrée par fichier de data/entries", () => {
    assert.ok(entries.length > 0, "data/ doit contenir au moins une entrée");
    assert.equal(entries.length, countEntryFiles(join(ROOT, "data", "entries")));
  });

  it("respecte les six champs du contrat", () => {
    for (const item of entries) {
      assert.equal(typeof item.id, "string");
      assert.equal(typeof item.title, "string");
      assert.ok(item.url.startsWith("https://www.cnil.fr/"));
      assert.equal(typeof item.source, "string");
      assert.ok(item.publishedAt === null || typeof item.publishedAt === "string");
      assert.ok(item.summary === null || (typeof item.summary === "string" && item.summary.length > 0));
    }
  });

  it("ne laisse dans le résumé ni balise, ni entité, ni double espace", () => {
    for (const item of entries) {
      if (item.summary === null) continue;
      assert.ok(!/[<>&]/.test(item.summary), `résumé à nettoyer : ${item.summary}`);
      assert.ok(!/\s{2}/.test(item.summary), `espaces à normaliser : ${item.summary}`);
      assert.ok(item.summary.length <= 200);
    }
  });

  it("trie de la plus récente à la plus ancienne, sans date en dernier", () => {
    const published = entries
      .map((item) => item.publishedAt)
      .filter((date): date is string => date !== null);
    assert.deepEqual(published, [...published].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)));

    const firstNull = entries.findIndex((item) => item.publishedAt === null);
    if (firstNull !== -1) {
      assert.ok(entries.slice(firstNull).every((item) => item.publishedAt === null));
    }
  });
});

describe("le tri du lecteur", () => {
  let root: string;

  before(() => {
    root = tempRoot();
    writeEntry(root, "a", entry({ title: "Zèbre", publishedAt: "2026-10-01T12:00:00.000Z" }));
    writeEntry(root, "b", entry({ title: "Abeille", publishedAt: null }));
    writeEntry(root, "c", entry({ title: "Bison", publishedAt: "2026-10-01T12:00:00.000Z" }));
    writeEntry(root, "d", entry({ title: "Castor", publishedAt: "2026-12-24T08:00:00.000Z" }));
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("ordonne par date décroissante, puis par titre, dates nulles en dernier", () => {
    assert.deepEqual(
      getEntries(root).map((item) => item.title),
      ["Castor", "Bison", "Zèbre", "Abeille"],
    );
  });
});

describe("un résumé redondant", () => {
  it("masque un résumé qui répète une longue expression du titre", () => {
    const title =
      "Cookies et application mobile : sanctions de 7 millions d’euros à l’encontre des sociétés FNAC DARTY PARTICIPATIONS ET SERVICES et FNAC DIRECT";
    const summary =
      "Le 22 octobre 2026, la CNIL a sanctionné les sociétés FNAC DARTY PARTICIPATIONS ET SERVICES et FNAC DIRECT d’une amende de 7 millions d’euros pour non-respect des règles applicables en matière de traceurs (cookies).";

    assert.equal(isRedundantSummary(title, summary), true);
  });

  it("laisse passer un résumé qui apporte une information nouvelle", () => {
    assert.equal(
      isRedundantSummary(
        "Journée RGPD à Poitiers : cybersécurité, IA et conformité",
        "La CNIL organise une nouvelle Journée RGPD à Poitiers le 1er décembre 2026.",
      ),
      false,
    );
  });

  it("laisse passer une courte expression commune", () => {
    assert.equal(isRedundantSummary("Ordre du jour de la séance", "Ordre du jour : adoption du procès-verbal."), false);
  });
});

describe("un data/entries vide", () => {
  it("lève une erreur explicite au lieu de rendre une page vide", () => {
    const root = tempRoot();
    try {
      mkdirSync(join(root, "data", "entries"), { recursive: true });
      assert.throws(() => getEntries(root), /No entry in data\/entries/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("une entrée illisible", () => {
  it("lève une erreur qui nomme le fichier quand le JSON est corrompu", () => {
    const root = tempRoot();
    try {
      const path = writeEntry(root, "corrompue", "{ pas du JSON");

      assert.throws(
        () => getEntries(root),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.startsWith("Invalid entry"));
          assert.ok(error.message.includes(path), "le message doit nommer le fichier");
          return true;
        },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lève une erreur quand un champ du contrat manque", () => {
    const root = tempRoot();
    try {
      const path = writeEntry(root, "incomplete", entry({ publishedAt: undefined }));

      assert.throws(
        () => getEntries(root),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.includes(path));
          assert.match(error.message, /publishedAt/);
          return true;
        },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lève une erreur quand le résumé manque", () => {
    const root = tempRoot();
    try {
      const path = writeEntry(root, "sans-resume", entry({ summary: undefined }));

      assert.throws(
        () => getEntries(root),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.includes(path));
          assert.match(error.message, /summary/);
          return true;
        },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lève une erreur quand le résumé est vide ou d'un autre type", () => {
    const root = tempRoot();
    try {
      writeEntry(root, "resume-vide", entry({ summary: "" }));
      assert.throws(() => getEntries(root), /"summary" must be a non-empty string or null/);

      writeEntry(root, "resume-nombre", entry({ summary: 42 }));
      assert.throws(() => getEntries(root), /"summary" must be a non-empty string or null/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepte un résumé nul et le rend tel quel", () => {
    const root = tempRoot();
    try {
      writeEntry(root, "resume-nul", entry({ summary: null }));

      assert.equal(getEntries(root)[0]?.summary, null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("un dépôt sans données", () => {
  it("lève une erreur qui renvoie vers npm run veille", () => {
    const root = tempRoot();
    try {
      assert.throws(() => getEntries(root), /run npm run veille/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
