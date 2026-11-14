import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildCorpusSet, lireDescripteurs } from "../mcp/corpus/build.ts";
import { parseCcs } from "../mcp/corpus/ccs/parse.ts";
import type { Descripteur } from "../mcp/corpus/parse.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import { documentsNommes, getArticle, referenceExacte } from "../mcp/tools.ts";
import { lireUnites } from "../mcp/index/build.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = readFileSync(new URL("./fixtures/eurlex/ccs.xhtml", import.meta.url), "utf8");

function descripteur(): Descripteur {
  const trouve = lireDescripteurs().find((candidat) => candidat.corpus === "ccs");
  assert.ok(trouve);
  return trouve;
}

describe("décision 2021/914 sur les clauses contractuelles types", () => {
  it("déclare son parseur dédié et ses trois comptes", () => {
    const lu = descripteur();
    assert.equal(lu.document, "32021D0914");
    assert.equal(lu.parseur, "ccs");
    assert.equal(lu.clauses_attendues, 52);
    assert.equal(lu.articles_attendus, 4);
    assert.equal(lu.considerants_attendus, 26);
  });

  it("rend 4 articles, 26 considérants et 52 clauses", () => {
    const unites = parseCcs(FIXTURE, descripteur());
    assert.equal(unites.filter((unite) => unite.niveau === "article").length, 4);
    assert.equal(unites.filter((unite) => unite.niveau === "considérant").length, 26);
    assert.equal(unites.filter((unite) => unite.niveau === "clause").length, 52);
    assert.equal(new Set(unites.map((unite) => unite.ref)).size, unites.length);
    assert.ok(unites.every((unite) => unite.texte.trim() !== ""));
  });

  it("donne une unité par module pour la clause 8.1, avec le module dans le texte et le chemin", () => {
    const clauses = parseCcs(FIXTURE, descripteur()).filter((unite) => unite.niveau === "clause");
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
    const clauses = parseCcs(FIXTURE, descripteur()).filter((unite) => unite.niveau === "clause");
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
      () => parseCcs(FIXTURE, { ...descripteur(), clauses_attendues: 51 }),
      /52 clauses au lieu de 51 attendues/,
    );
  });
});

describe("construction du corpus ccs", () => {
  it("écrit les clauses au manifeste et dans les unités", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-ccs-"));
    try {
      const [resultat] = await buildCorpusSet({
        rootDir: root,
        document: "ccs",
        fixturePath: fileURLToPath(new URL("./fixtures/eurlex/ccs.xhtml", import.meta.url)),
      });
      const manifeste = JSON.parse(
        readFileSync(join(root, "data", "corpus", "ccs", "manifest.json"), "utf8"),
      ) as { couverture: { types_retenus: string[]; comptes: Record<string, number> } };
      assert.equal(resultat?.unites.length, 82);
      assert.deepEqual(manifeste.couverture.types_retenus, ["article", "considérant", "clause"]);
      assert.deepEqual(manifeste.couverture.comptes, { articles: 4, considerants: 26, clauses: 52 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("lecture du corpus ccs réel", () => {
  it("sert l'article 1 et laisse lire les clauses au corpus", () => {
    const article = getArticle(ROOT, { document: "32021D0914", numero: "1" });
    assert.ok(article.trouve);
    assert.equal(article.ref, "32021D0914#art_1");
    assert.equal(article.statut_application, "en_vigueur");

    const clauses = lireUnites(ROOT).filter(
      (unite) => unite.corpus === "ccs" && unite.niveau === "clause",
    );
    assert.equal(clauses.length, 52);
    assert.ok(clauses.some((unite) => unite.ref === "32021D0914#clause_8.1_m2"));
  });

  it("nomme la décision par ses clauses et son CELEX", () => {
    assert.deepEqual(documentsNommes("les clauses contractuelles types"), ["32021D0914"]);
    assert.deepEqual(documentsNommes("décision 2021/914"), ["32021D0914"]);
    assert.equal(referenceExacte("article 1 des clauses contractuelles types"), "1");
  });

  it("rend le statut d'application du corpus", () => {
    assert.equal(statutApplication("ccs", "en_vigueur"), "en_vigueur");
  });
});
