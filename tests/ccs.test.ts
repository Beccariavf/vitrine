import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildCorpusSet, lireDescripteurs } from "../mcp/corpus/build.ts";
import { parseCcs } from "../mcp/corpus/ccs/parse.ts";
import { documentsPresents, extraireCitations, identifiantsDuManifeste, marquerPresence } from "../mcp/corpus/citations.ts";
import type { Descripteur } from "../mcp/corpus/parse.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import { corpusNomme, documentsNommes, getArticle, referenceExacte } from "../mcp/tools.ts";
import { inventaireCorpus } from "../mcp/corpus/sync-rapport.ts";
import { lireUnites } from "../mcp/index/build.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE_914 = readFileSync(new URL("./fixtures/eurlex/ccs.xhtml", import.meta.url), "utf8");
const FIXTURE_915 = readFileSync(new URL("./fixtures/eurlex/ccs-915.xhtml", import.meta.url), "utf8");

function descripteur(document: string): Descripteur {
  const trouve = lireDescripteurs().find(
    (candidat) => candidat.corpus === "ccs" && candidat.document === document,
  );
  assert.ok(trouve, `descripteur ${document} absent`);
  return trouve;
}

describe("décision 2021/914 sur les clauses contractuelles types", () => {
  it("déclare son parseur dédié et ses trois comptes", () => {
    const lu = descripteur("32021D0914");
    assert.equal(lu.parseur, "ccs");
    assert.equal(lu.clauses_attendues, 52);
    assert.equal(lu.articles_attendus, 4);
    assert.equal(lu.considerants_attendus, 26);
  });

  it("rend 4 articles, 26 considérants et 52 clauses", () => {
    const unites = parseCcs(FIXTURE_914, descripteur("32021D0914"));
    assert.equal(unites.filter((unite) => unite.niveau === "article").length, 4);
    assert.equal(unites.filter((unite) => unite.niveau === "considérant").length, 26);
    assert.equal(unites.filter((unite) => unite.niveau === "clause").length, 52);
    assert.equal(new Set(unites.map((unite) => unite.ref)).size, unites.length);
    assert.ok(unites.every((unite) => unite.texte.trim() !== ""));
  });

  it("donne une unité par module pour la clause 8.1, avec le module dans le texte et le chemin", () => {
    const clauses = parseCcs(FIXTURE_914, descripteur("32021D0914")).filter(
      (unite) => unite.niveau === "clause",
    );
    const huitUn = clauses.filter((unite) => unite.numero === "8.1");
    assert.deepEqual(
      huitUn.map((unite) => unite.ref),
      [
        "32021D0914#clause_8.1_m1",
        "32021D0914#clause_8.1_m2",
        "32021D0914#clause_8.1_m3",
        "32021D0914#clause_8.1_m4",
      ],
    );
    assert.equal(
      huitUn[1]?.chemin,
      "Décision (UE) 2021/914 > Annexe > Clauses contractuelles types > Clause 8.1, module 2",
    );
    assert.match(huitUn[1]?.texte ?? "", /^MODULE 2: transfert de responsable du traitement à sous-traitant 8\.1\. Instructions/);
    assert.match(huitUn[0]?.texte ?? "", /^MODULE 1: transfert de responsable du traitement à responsable du traitement 8\.1\. Limitation des finalités/);
  });

  it("garde une unité pour les clauses générales et deux pour la clause 15", () => {
    const clauses = parseCcs(FIXTURE_914, descripteur("32021D0914")).filter(
      (unite) => unite.niveau === "clause",
    );
    assert.deepEqual(
      clauses.filter((unite) => unite.numero === "2").map((unite) => unite.ref),
      ["32021D0914#clause_2"],
    );
    assert.deepEqual(
      clauses.filter((unite) => unite.numero.startsWith("15.")).map((unite) => unite.ref),
      ["32021D0914#clause_15.1", "32021D0914#clause_15.2"],
    );
    assert.deepEqual(
      clauses.filter((unite) => unite.numero === "9").map((unite) => unite.ref),
      ["32021D0914#clause_9_m2", "32021D0914#clause_9_m3"],
    );
  });

  it("lève quand le nombre de clauses diffère du descripteur", () => {
    assert.throws(
      () => parseCcs(FIXTURE_914, { ...descripteur("32021D0914"), clauses_attendues: 51 }),
      /52 clauses au lieu de 51 attendues/,
    );
  });
});

describe("décision 2021/915 sur les clauses de sous-traitance", () => {
  it("déclare ses comptes relevés sur la capture", () => {
    const lu = descripteur("32021D0915");
    assert.equal(lu.parseur, "ccs");
    assert.equal(lu.articles_attendus, 4);
    assert.equal(lu.considerants_attendus, 14);
    assert.equal(lu.clauses_attendues, 18);
    assert.equal(lu.date_acte, "2021-06-04");
    assert.equal(lu.date_debut, "2021-06-27");
    assert.equal(lu.statut, "en_vigueur");
    assert.equal(lu.url, "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32021D0915");
  });

  it("rend 4 articles, 14 considérants et 18 clauses", () => {
    const unites = parseCcs(FIXTURE_915, descripteur("32021D0915"));
    assert.equal(unites.filter((unite) => unite.niveau === "article").length, 4);
    assert.equal(unites.filter((unite) => unite.niveau === "considérant").length, 14);
    assert.equal(unites.filter((unite) => unite.niveau === "clause").length, 18);
    assert.equal(new Set(unites.map((unite) => unite.ref)).size, unites.length);
    assert.ok(unites.every((unite) => unite.texte.trim() !== ""));
  });

  it("découpe l'annexe en clauses citables par leur ref", () => {
    const clauses = parseCcs(FIXTURE_915, descripteur("32021D0915")).filter(
      (unite) => unite.niveau === "clause",
    );
    assert.deepEqual(
      clauses.map((unite) => unite.ref),
      [
        "32021D0915#clause_1",
        "32021D0915#clause_2",
        "32021D0915#clause_3",
        "32021D0915#clause_4",
        "32021D0915#clause_5",
        "32021D0915#clause_6",
        "32021D0915#clause_7.1",
        "32021D0915#clause_7.2",
        "32021D0915#clause_7.3",
        "32021D0915#clause_7.4",
        "32021D0915#clause_7.5",
        "32021D0915#clause_7.6",
        "32021D0915#clause_7.7",
        "32021D0915#clause_7.8",
        "32021D0915#clause_8",
        "32021D0915#clause_9.1",
        "32021D0915#clause_9.2",
        "32021D0915#clause_10",
      ],
    );
    const instructions = clauses.find((unite) => unite.ref === "32021D0915#clause_7.1");
    assert.equal(
      instructions?.chemin,
      "Décision (UE) 2021/915 > Annexe > Clauses contractuelles types > Clause 7.1",
    );
    assert.match(instructions?.texte ?? "", /^7\.1\. Instructions/);
  });
});

describe("construction du corpus ccs multi-documents", () => {
  it("écrit un manifeste à deux documents et les unités des deux décisions", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-ccs-"));
    try {
      const resultats = await buildCorpusSet({
        rootDir: root,
        document: "ccs",
        fixtures: {
          "32021D0914": fileURLToPath(new URL("./fixtures/eurlex/ccs.xhtml", import.meta.url)),
          "32021D0915": fileURLToPath(new URL("./fixtures/eurlex/ccs-915.xhtml", import.meta.url)),
        },
      });
      const manifeste = JSON.parse(
        readFileSync(join(root, "data", "corpus", "ccs", "manifest.json"), "utf8"),
      ) as {
        documents: { document: string; unites: number; snapshot: string }[];
        unites: number;
        couverture: { types_retenus: string[]; comptes: Record<string, number> };
      };
      assert.deepEqual(
        resultats.map((resultat) => resultat.unites.length).sort((gauche, droite) => droite - gauche),
        [82, 36],
      );
      assert.deepEqual(
        manifeste.documents.map((document) => document.document),
        ["32021D0914", "32021D0915"],
      );
      assert.deepEqual(
        manifeste.documents.map((document) => document.unites),
        [82, 36],
      );
      assert.equal(manifeste.unites, 118);
      assert.deepEqual(manifeste.couverture.types_retenus, ["article", "considérant", "clause"]);
      assert.deepEqual(manifeste.couverture.comptes, {
        documents: 2,
        articles: 8,
        considerants: 40,
        clauses: 70,
      });
      assert.ok(manifeste.documents.every((document) => document.snapshot.endsWith(".xhtml")));

      const ecrites = readFileSync(join(root, "data", "corpus", "ccs", "unites.jsonl"), "utf8")
        .split("\n")
        .filter((ligne) => ligne.trim() !== "")
        .map((ligne) => JSON.parse(ligne) as { ref: string });
      assert.equal(ecrites.length, 118);
      assert.deepEqual(
        ecrites.slice(0, 82).map((unite) => unite.ref),
        parseCcs(FIXTURE_914, descripteur("32021D0914")).map((unite) => unite.ref),
      );
      assert.ok(ecrites.some((unite) => unite.ref === "32021D0915#clause_7.1"));
      assert.ok(documentsPresents(root).has("32021D0914"));
      assert.ok(documentsPresents(root).has("32021D0915"));
      assert.deepEqual(identifiantsDuManifeste(manifeste), ["32021D0914", "32021D0915"]);
      const inventaire = inventaireCorpus(root).find((entree) => entree.corpus === "ccs");
      assert.deepEqual(
        { documents: inventaire?.documents, unites: inventaire?.unites },
        { documents: 2, unites: 118 },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejoue la même construction sans réécrire", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-ccs-"));
    try {
      const options = {
        rootDir: root,
        document: "ccs",
        fixtures: {
          "32021D0914": fileURLToPath(new URL("./fixtures/eurlex/ccs.xhtml", import.meta.url)),
          "32021D0915": fileURLToPath(new URL("./fixtures/eurlex/ccs-915.xhtml", import.meta.url)),
        },
      };
      await buildCorpusSet(options);
      const avant = readFileSync(join(root, "data", "corpus", "ccs", "unites.jsonl"), "utf8");
      await buildCorpusSet(options);
      assert.equal(readFileSync(join(root, "data", "corpus", "ccs", "unites.jsonl"), "utf8"), avant);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("lecture du corpus ccs réel", () => {
  it("sert l'article 1 des deux décisions et laisse lire leurs clauses au corpus", () => {
    for (const document of ["32021D0914", "32021D0915"]) {
      const article = getArticle(ROOT, { document, numero: "1" });
      assert.ok(article.trouve, `article 1 de ${document} introuvable`);
      assert.equal(article.ref, `${document}#art_1`);
      assert.equal(article.statut_application, "en_vigueur");
    }

    const clauses = lireUnites(ROOT).filter(
      (unite) => unite.corpus === "ccs" && unite.niveau === "clause",
    );
    assert.equal(clauses.length, 70);
    assert.ok(clauses.some((unite) => unite.ref === "32021D0914#clause_8.1_m2"));
    assert.ok(clauses.some((unite) => unite.ref === "32021D0915#clause_7.1"));
  });

  it("nomme chaque décision par ses clauses et son CELEX", () => {
    assert.deepEqual(documentsNommes("décision 2021/914"), ["32021D0914"]);
    assert.deepEqual(documentsNommes("décision 2021/915"), ["32021D0915"]);
    assert.deepEqual(
      documentsNommes("les clauses contractuelles types entre responsables du traitement et sous-traitants"),
      ["32021D0915"],
    );
    // La formule générique ne choisit pas une décision : elle borne au corpus `ccs`.
    assert.deepEqual(documentsNommes("les clauses contractuelles types"), []);
    assert.equal(corpusNomme("les clauses contractuelles types"), "ccs");
    assert.equal(corpusNomme("obligations du sous-traitant"), null);
    assert.equal(referenceExacte("article 1 des clauses contractuelles types"), "1");
  });

  it("extrait une citation d'article de chaque décision et la marque au corpus", () => {
    const citations = extraireCitations(
      "l'article 7.1 de la décision d'exécution (UE) 2021/915 et l'article 8.1 de la " +
        "décision d'exécution (UE) 2021/914",
    );
    assert.deepEqual(
      citations
        .map((citation) => [citation.document, citation.articles.join(",")])
        .sort((gauche, droite) => String(gauche[0]).localeCompare(String(droite[0]))),
      [
        ["32021D0914", "8.1"],
        ["32021D0915", "7.1"],
      ],
    );
    const rendues = marquerPresence(documentsPresents(ROOT), citations);
    assert.deepEqual(
      rendues.map((citation) => citation.hors_corpus),
      [false, false],
    );
  });

  it("rend le statut d'application du corpus", () => {
    assert.equal(statutApplication("ccs", "en_vigueur"), "en_vigueur");
  });
});
