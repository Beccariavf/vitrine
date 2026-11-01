import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { referenceUrl } from "../src/lib/references.ts";

const EPRIVACY = "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32002L0058";

describe("l'URL du texte officiel d'une référence", () => {
  it("renvoie au texte officiel des instruments suivis", () => {
    assert.equal(
      referenceUrl("Règlement (UE) 2016/679 · art. 4, 5, 6"),
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679",
    );
    assert.equal(
      referenceUrl("Loi Informatique et Libertés · art. 82"),
      "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006068624",
    );
    assert.equal(
      referenceUrl("Code des postes et des communications électroniques · art. L. 34-5"),
      "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070987",
    );
    assert.equal(referenceUrl("Directive 2002/58/CE · art. 5"), EPRIVACY);
    assert.equal(
      referenceUrl("Code de la consommation · art. L. 223-1"),
      "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069565",
    );
  });

  it("adresse un règlement ou une directive par son numéro CELEX", () => {
    assert.equal(
      referenceUrl("Règlement (UE) 2024/1689 · art. 6"),
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
    );
    assert.equal(
      referenceUrl("Directive (UE) 2022/2555 · art. 21"),
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32022L2555",
    );
    assert.equal(
      referenceUrl("Règlement (UE) 2022/1925 · art. 5"),
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32022R1925",
    );
    assert.equal(
      referenceUrl("Directive 95/46/CE · art. 7"),
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:31995L0046",
    );
  });

  it("ne devine aucun lien pour un instrument inconnu", () => {
    assert.equal(referenceUrl("Code du travail · art. L. 2315-34"), null);
    assert.equal(referenceUrl("Décret n° 2019-539 · art. 5"), null);
    assert.equal(referenceUrl(""), null);
  });
});
