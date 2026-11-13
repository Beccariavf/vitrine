import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { derniereMiseAJour, sourcesCorpus } from "../src/lib/corpus.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const racines: string[] = [];

function racineTemporaire(): string {
  const racine = mkdtempSync(join(tmpdir(), "vitrine-corpus-site-"));
  racines.push(racine);
  return racine;
}

function ecrireManifeste(racine: string, corpus: string, manifeste: Record<string, unknown>): void {
  const dossier = join(racine, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "manifest.json"), JSON.stringify(manifeste), "utf8");
}

after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

describe("sourcesCorpus", () => {
  it("rend les huit collections committées dans l'ordre textes, autorités, juridictions", () => {
    const sources = sourcesCorpus(ROOT);
    assert.deepEqual(
      sources.map((source) => source.libelle),
      [
        "RGPD",
        "AI Act",
        "Loi Informatique et Libertés",
        "CNIL",
        "CEPD",
        "CJUE",
        "Conseil d'État",
        "Cour de cassation",
      ],
    );
    assert.ok(sources.every((source) => source.documents > 0));
  });

  it("rend une liste vide sans data/corpus/", () => {
    const racine = racineTemporaire();
    assert.deepEqual(sourcesCorpus(racine), []);
    assert.equal(derniereMiseAJour(sourcesCorpus(racine)), null);
  });

  it("laisse un corpus inconnu à son identifiant, après les connus", () => {
    const racine = racineTemporaire();
    ecrireManifeste(racine, "zz", { documents: 2, date_extraction: "2026-01-01" });
    ecrireManifeste(racine, "cnil", { documents: 3, arrete_le: "2026-02-01" });
    assert.deepEqual(
      sourcesCorpus(racine).map((source) => [source.corpus, source.libelle]),
      [
        ["cnil", "CNIL"],
        ["zz", "zz"],
      ],
    );
  });

  it("prend la date des autres corpus quand le RGPD n'en porte pas", () => {
    const racine = racineTemporaire();
    ecrireManifeste(racine, "rgpd", { unites: 272 });
    ecrireManifeste(racine, "cnil", { documents: 3, arrete_le: "2026-10-30" });
    ecrireManifeste(racine, "cc", { documents: 4, date_extraction: "2026-11-11" });
    const sources = sourcesCorpus(racine);
    assert.equal(sources[0]?.libelle, "RGPD");
    assert.equal(sources[0]?.arrete_le, null);
    assert.equal(derniereMiseAJour(sources), "2026-11-11");
  });
});
