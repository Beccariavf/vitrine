import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { referenceLabel, referenceUrl } from "../src/lib/references.ts";

const EPRIVACY = "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32002L0058";

describe("le libellé court d'une référence", () => {
  it("abrège chaque instrument suivi et garde les articles", () => {
    assert.equal(referenceLabel("Règlement (UE) 2016/679 · art. 5"), "RGPD · art. 5");
    assert.equal(referenceLabel("Loi Informatique et Libertés · art. 8, 82, 20"), "LIL · art. 8, 82, 20");
    assert.equal(
      referenceLabel("Code des postes et des communications électroniques · art. L. 34-5"),
      "CPCE · art. L. 34-5",
    );
    assert.equal(referenceLabel("Directive 2002/58/CE · art. 5"), "ePrivacy · art. 5");
    assert.equal(referenceLabel("Code de la consommation · art. L. 223-1"), "C. conso · art. L. 223-1");
    assert.equal(referenceLabel("Règlement (UE) 2024/1689 · art. 6"), "AI Act · art. 6");
    assert.equal(referenceLabel("Règlement (UE) 2022/2065 · art. 13"), "DSA · art. 13");
    assert.equal(referenceLabel("Règlement (UE) 2022/1925 · art. 5"), "DMA · art. 5");
    assert.equal(referenceLabel("Règlement (UE) 2022/2554 · art. 7"), "DORA · art. 7");
    assert.equal(referenceLabel("Directive (UE) 2022/2555 · art. 21"), "NIS2 · art. 21");
    assert.equal(referenceLabel("Règlement (UE) 2024/2847 · art. 13"), "CRA · art. 13");
    assert.equal(referenceLabel("Règlement (UE) 2023/2854 · art. 3"), "Data Act · art. 3");
  });

  it("rend la référence entière pour un instrument inconnu", () => {
    assert.equal(referenceLabel("Code du travail · art. L. 2315-34"), "Code du travail · art. L. 2315-34");
    assert.equal(referenceLabel("Directive 95/46/CE · art. 7"), "Directive 95/46/CE · art. 7");
    assert.equal(referenceLabel(""), "");
  });

  it("abrège un instrument cité sans article", () => {
    assert.equal(referenceLabel("Règlement (UE) 2016/679"), "RGPD");
  });

  it("laisse l'URL officielle inchangée, calculée depuis le libellé canonique", () => {
    const pairs: Array<[string, string]> = [
      [
        "Règlement (UE) 2016/679 · art. 5",
        "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679",
      ],
      ["Loi Informatique et Libertés · art. 82", "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006068624"],
      [
        "Code des postes et des communications électroniques · art. L. 34-5",
        "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070987",
      ],
      ["Directive 2002/58/CE · art. 5", EPRIVACY],
      [
        "Règlement (UE) 2024/1689 · art. 6",
        "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
      ],
    ];

    for (const [reference, url] of pairs) {
      assert.equal(referenceUrl(reference), url, reference);
    }
  });
});

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
