import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { etatCorpus } from "../mcp/tools.ts";
import {
  CHEMIN_ETAT_LECTURES,
  lireLectures,
  noterLectures,
} from "../mcp/corpus/lectures.ts";
import {
  CORPUS_SANS_VEILLE,
  SOURCES_PAR_CORPUS,
  corpusDeLEntree,
} from "../mcp/corpus/veille.ts";
import { lireManifestes } from "../mcp/corpus/sync-rapport.ts";

const RACINE_DEPOT = fileURLToPath(new URL("..", import.meta.url));

/** Sources de veille du dépôt : un identifiant inconnu serait une faute de table. */
const SOURCES_CONNUES = new Set([
  "cnil",
  "cnil_doctrine",
  "cetat",
  "constit",
  "judilibre",
  "cjeu",
  "cepd",
  "preparation",
  "legi",
  "eurlex",
]);

function racine(): string {
  return mkdtempSync(join(tmpdir(), "veille-couverture-"));
}

function ecrireCorpus(
  root: string,
  corpus: string,
  manifeste: Record<string, unknown> = {},
): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "manifest.json"), `${JSON.stringify({ corpus, ...manifeste }, null, 2)}\n`);
}

describe("table corpus → sources", () => {
  it("couvre chaque corpus du dépôt par une source ou une raison d'absence", () => {
    const manifestes = lireManifestes(RACINE_DEPOT);
    assert.ok(manifestes.size >= 19, `manifestes lus : ${manifestes.size}`);
    for (const corpus of manifestes.keys()) {
      const sources = SOURCES_PAR_CORPUS[corpus] ?? [];
      const raison = CORPUS_SANS_VEILLE[corpus];
      assert.ok(
        sources.length > 0 || raison !== undefined,
        `corpus « ${corpus} » sans source de veille et sans raison déclarée`,
      );
      assert.equal(
        sources.length > 0 && raison !== undefined,
        false,
        `corpus « ${corpus} » a la fois des sources et une raison d'absence`,
      );
    }
    assert.equal(manifestes.size, Object.keys(SOURCES_PAR_CORPUS).length + Object.keys(CORPUS_SANS_VEILLE).length);
  });

  it("ne nomme que des sources de veille connues et les raccorde correctement", () => {
    for (const [corpus, sources] of Object.entries(SOURCES_PAR_CORPUS)) {
      assert.ok(sources.length > 0, `corpus « ${corpus} » sans source`);
      for (const source of sources) {
        assert.ok(SOURCES_CONNUES.has(source), `source inconnue « ${source} » pour « ${corpus} »`);
      }
    }
    assert.deepEqual(SOURCES_PAR_CORPUS.ce, ["cetat"]);
    assert.deepEqual(SOURCES_PAR_CORPUS.cc, ["judilibre"]);
    assert.deepEqual(SOURCES_PAR_CORPUS.lil, ["legi"]);
    assert.deepEqual(SOURCES_PAR_CORPUS.textes_fr, ["legi"]);
    assert.deepEqual(SOURCES_PAR_CORPUS.ccs, ["eurlex"]);
    assert.deepEqual(SOURCES_PAR_CORPUS.adequation, ["eurlex"]);
    assert.deepEqual(SOURCES_PAR_CORPUS.metadonnees, undefined);
    assert.match(CORPUS_SANS_VEILLE.metadonnees ?? "", /metadonnees:sync/);
  });

  it("raccorde un corpus sans source à sa raison, jamais au silence", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "metadonnees");
      ecrireCorpus(root, "corpus-inconnu");
      const etat = etatCorpus(root);
      const metadonnees = etat.corpus.find((entree) => entree.corpus === "metadonnees");
      const inconnu = etat.corpus.find((entree) => entree.corpus === "corpus-inconnu");
      assert.deepEqual(metadonnees?.veille.sources, []);
      assert.match(metadonnees?.veille.absente?.raison ?? "", /metadonnees:sync/);
      assert.deepEqual(inconnu?.veille.sources, []);
      assert.match(inconnu?.veille.absente?.raison ?? "", /aucune source de veille déclarée/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("raccorde l'entrée eurlex de clauses types au corpus ccs", () => {
    assert.equal(
      corpusDeLEntree({ source: "eurlex", document: "32026D0402", categorie: "clauses_types" }),
      "ccs",
    );
    assert.equal(
      corpusDeLEntree({ source: "eurlex", document: "32026D0400", categorie: "adequation" }),
      "adequation",
    );
  });
});

describe("dernière lecture réussie", () => {
  it("rend null quand la veille n'a jamais été lue ici", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil");
      const [corpus] = etatCorpus(root).corpus;
      assert.deepEqual(corpus?.veille.sources, [{ id: "cnil", derniere_lecture_reussie: null }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("note la lecture réussie d'une source sans effacer celle des autres", () => {
    const root = racine();
    try {
      noterLectures(root, ["cnil", "cetat"], "2026-11-14");
      noterLectures(root, ["cetat"], "2026-11-20");
      assert.deepEqual([...lireLectures(root).entries()], [
        ["cetat", "2026-11-20"],
        ["cnil", "2026-11-14"],
      ]);
      const contenu = JSON.parse(readFileSync(join(root, CHEMIN_ETAT_LECTURES), "utf8")) as {
        sources: Record<string, string>;
      };
      assert.equal(contenu.sources.cnil, "2026-11-14");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse une date invalide et ignore un état illisible", () => {
    const root = racine();
    try {
      assert.throws(() => noterLectures(root, ["cnil"], "14/11/2026"), /AAAA-MM-JJ/);
      mkdirSync(join(root, "data", "veille"), { recursive: true });
      writeFileSync(join(root, CHEMIN_ETAT_LECTURES), "{", "utf8");
      assert.equal(lireLectures(root).size, 0);
      writeFileSync(
        join(root, CHEMIN_ETAT_LECTURES),
        JSON.stringify({ version: 1, sources: { cnil: "2026-13-45", cetat: "2026-11-14" } }),
        "utf8",
      );
      assert.deepEqual([...lireLectures(root).entries()], [["cetat", "2026-11-14"]]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("etat_corpus rend la source et sa dernière lecture réussie", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil");
      ecrireCorpus(root, "cc");
      noterLectures(root, ["cnil", "judilibre"], "2026-11-15");
      const etat = etatCorpus(root);
      const cnil = etat.corpus.find((entree) => entree.corpus === "cnil");
      const cc = etat.corpus.find((entree) => entree.corpus === "cc");
      assert.equal(cnil?.veille.absente, undefined);
      assert.deepEqual(cnil?.veille, {
        sources: [{ id: "cnil", derniere_lecture_reussie: "2026-11-15" }],
      });
      assert.deepEqual(cc?.veille, {
        sources: [{ id: "judilibre", derniere_lecture_reussie: "2026-11-15" }],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
