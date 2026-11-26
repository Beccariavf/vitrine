import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { etagesFacade, resumeCorpus, sourcesCorpus, type SourceCorpus } from "../src/lib/corpus.ts";

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
  it("rend les vingt-quatre collections committées dans l'ordre textes, autorités, juridictions", () => {
    const sources = sourcesCorpus(ROOT);
    assert.deepEqual(
      sources.map((source) => source.libelle),
      [
        "RGPD",
        "AI Act",
        "Directive ePrivacy",
        "Directive police-justice",
        "Règlement 2018/1725",
        "Règlement procédural RGPD",
        "Textes UE de l'économie des données",
        "Espace européen des données de santé",
        "Textes UE de frontière (produits, responsabilité, propriété intellectuelle, plateformes)",
        "Clauses contractuelles types",
        "Loi Informatique et Libertés",
        "Textes français d'application",
        "Textes en préparation et affaires pendantes",
        "Décisions d'adéquation",
        "CNIL",
        "Doctrine CNIL",
        "CADA",
        "CEPD",
        "CJUE",
        "Conseil d'État",
        "Conseil constitutionnel",
        "Cour de cassation",
        "Guichet unique (métadonnées)",
        "Doctrine de la Commission",
      ],
    );
    assert.ok(sources.every((source) => source.documents > 0));
    assert.ok(sources.every((source) => source.unites > 0));
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
    assert.equal(unites.get("aiact"), 377);
    assert.equal(unites.get("cnil"), 29698);
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

describe("resumeCorpus", () => {
  function collection(
    corpus: string,
    documents: number,
    unites: number,
    arrete_le: string | null = null,
  ): SourceCorpus {
    return { corpus, libelle: corpus, documents, unites, arrete_le };
  }

  it("compte collections, documents et passages, et date la dernière mise à jour", () => {
    const resume = resumeCorpus([
      collection("rgpd", 1, 272),
      collection("aiact", 4, 377),
      collection("cnil", 3, 1000, "2026-11-17"),
      collection("cc", 4, 70, "2026-11-26"),
      collection("cjue", 2, 300, "2026-11-14"),
      collection("metadonnees", 1595, 1597, "2026-11-15"),
    ]);
    assert.equal(resume.collections, 6);
    assert.equal(resume.documents, 1609);
    assert.equal(resume.passages, 3616);
    assert.equal(resume.derniereMiseAJour, "2026-11-26");
    assert.deepEqual(resume.familles.map((famille) => famille.famille), [
      "textes",
      "autorites",
      "ue",
      "juridictions",
    ]);
    assert.deepEqual(
      resume.familles.map((famille) => [famille.documents, famille.passages]),
      [
        [5, 649],
        [3, 1000],
        [2, 300],
        [4, 70],
      ],
    );
  });

  it("omet une famille sans collection et laisse `autre` hors des familles", () => {
    const autorites = resumeCorpus([collection("cnil", 3, 1000, "2026-11-17")]);
    assert.deepEqual(autorites.familles.map((famille) => famille.famille), ["autorites"]);
    assert.equal(autorites.derniereMiseAJour, "2026-11-17");

    const metadonnees = resumeCorpus([collection("metadonnees", 1595, 1597, "2026-11-15")]);
    assert.deepEqual(metadonnees.familles, []);
    assert.equal(metadonnees.collections, 1);
    assert.equal(metadonnees.documents, 1595);
    assert.equal(metadonnees.passages, 1597);
    assert.equal(metadonnees.derniereMiseAJour, "2026-11-15");
  });

  it("rend des totaux nuls et aucune date sans collection", () => {
    assert.deepEqual(resumeCorpus([]), {
      collections: 0,
      documents: 0,
      passages: 0,
      derniereMiseAJour: null,
      familles: [],
    });
  });
});
