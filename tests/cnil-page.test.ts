import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseCnilPageReferences } from "../veille/sources/cnil.ts";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/cnil/${name}`, import.meta.url), "utf8");
}

describe("la section « Textes de référence » d'une page CNIL", () => {
  it("lit la page FNAC et ignore la délibération et les liens pour approfondir", () => {
    assert.deepEqual(parseCnilPageReferences(fixture("page-fnac.html")), [
      "Loi Informatique et Libertés · art. 82",
    ]);
  });

  it("lit tous les items de la page webinaire et ignore le décret", () => {
    assert.deepEqual(parseCnilPageReferences(fixture("page-multi.html")), [
      "Code de la consommation · art. L. 223-1",
      "Règlement (UE) 2016/679 · art. 6, 7, 21, 4.11",
    ]);
  });

  it("accepte le titre singulier « Texte de référence »", () => {
    assert.deepEqual(parseCnilPageReferences(fixture("page-singular.html")), [
      "Règlement (UE) 2016/679 · art. 6",
    ]);
  });

  it("rend un tableau vide quand seule la section « Pour approfondir » existe", () => {
    assert.deepEqual(parseCnilPageReferences(fixture("page-no-references.html")), []);
  });

  it("accepte les attributs entre guillemets doubles", () => {
    const html = `<div class="ctn-gen-textes-references"><div class="ctn-gen-textes-references-contenu"><h2>Textes de référence</h2><ul><li><a>Article 6 du RGPD</a></li></ul></div></div>`;
    assert.deepEqual(parseCnilPageReferences(html), ["Règlement (UE) 2016/679 · art. 6"]);
  });

  it("rend un tableau vide sur une page sans section", () => {
    assert.deepEqual(parseCnilPageReferences("<html><body><p>Rien.</p></body></html>"), []);
  });
});
