import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { etagesFacade, sourcesCorpus } from "../src/lib/corpus.ts";

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

  it("laisse le RGPD sans date quand son manifeste n'en porte pas", () => {
    const racine = racineTemporaire();
    ecrireManifeste(racine, "rgpd", { unites: 272 });
    ecrireManifeste(racine, "cnil", { documents: 3, arrete_le: "2026-10-30" });
    ecrireManifeste(racine, "cc", { documents: 4, date_extraction: "2026-11-11" });
    const sources = sourcesCorpus(racine);
    assert.equal(sources[0]?.libelle, "RGPD");
    assert.equal(sources[0]?.arrete_le, null);
    assert.equal(sources.find((source) => source.corpus === "cc")?.arrete_le, "2026-11-11");
  });
});

describe("unités et étages de la façade", () => {
  it("rend les unités indexées de chaque collection committée", () => {
    const unites = new Map(sourcesCorpus(ROOT).map((source) => [source.corpus, source.unites]));
    assert.equal(unites.get("rgpd"), 272);
    assert.equal(unites.get("aiact"), 293);
    assert.equal(unites.get("cnil"), 29299);
    assert.ok([...unites.values()].every((nombre) => nombre > 0));
  });

  it("lit les fragments quand le manifeste ne porte pas d'unités", () => {
    const racine = racineTemporaire();
    ecrireManifeste(racine, "cc", { documents: 4, fragments: 70 });
    ecrireManifeste(racine, "zz", { documents: 1 });
    const unites = new Map(sourcesCorpus(racine).map((source) => [source.corpus, source.unites]));
    assert.equal(unites.get("cc"), 70);
    assert.equal(unites.get("zz"), 0);
  });

  it("donne ceil(log10(unités)) étages, bornés entre 1 et 5", () => {
    assert.equal(etagesFacade(272), 3);
    assert.equal(etagesFacade(29299), 5);
    assert.equal(etagesFacade(7048), 4);
    assert.equal(etagesFacade(1000), 3);
    assert.equal(etagesFacade(1001), 4);
    assert.equal(etagesFacade(5_000_000), 5);
    assert.equal(etagesFacade(10), 1);
    assert.equal(etagesFacade(1), 1);
    assert.equal(etagesFacade(0), 1);
  });
});
