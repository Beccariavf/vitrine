import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { extractReferences } from "../veille/references.ts";

/** Le titre officiel de Jautiva, avec les espaces insécables du flux réel. */
const JAUTIVA =
  "Affaire C-798/24, Jautiva: Arrêt de la Cour (première chambre) du 3\u00a0septembre 2026 " +
  "(demande de décision préjudicielle de la Satversmes tiesa – Lettonie) – A e. a. " +
  "[Renvoi préjudiciel – Protection des personnes physiques à l'égard du traitement des données " +
  "à caractère personnel – Règlement (UE) 2016/679 – Article\u00a05 – Principes relatifs au traitement " +
  "des données à caractère personnel – Article 6 – Licéité du traitement – Droit des sociétés – " +
  "Directive (UE) 2017/1132 – Article 14 – Actes et indications soumis à publicité – Actionnaires minoritaires]";

describe("les références juridiques", () => {
  it("extrait les instruments et les articles du titre Jautiva", () => {
    assert.deepEqual(extractReferences(JAUTIVA), [
      "Règlement (UE) 2016/679 · art. 5, 6",
      "Directive (UE) 2017/1132 · art. 14",
    ]);
  });

  it("supporte les listes et les plages d'articles", () => {
    assert.deepEqual(
      extractReferences("Règlement (UE) 2016/679 – articles 5 et 6"),
      ["Règlement (UE) 2016/679 · art. 5, 6"],
    );
    assert.deepEqual(
      extractReferences("Règlement (UE) 2016/679 – articles 5 à 7"),
      ["Règlement (UE) 2016/679 · art. 5–7"],
    );
  });

  it("ne confond pas un article de la charte avec l'instrument précédent", () => {
    assert.deepEqual(
      extractReferences(
        "Règlement (UE) 2016/679 – Article 5 – Charte des droits fondamentaux – Article 47",
      ),
      ["Règlement (UE) 2016/679 · art. 5"],
    );
  });

  it("rattache un article placé avant le premier instrument", () => {
    assert.deepEqual(
      extractReferences("Manquement d'État – Protection des données – Article 5 – Règlement (UE) 2016/679"),
      ["Règlement (UE) 2016/679 · art. 5"],
    );
  });

  it("ne rattache pas à un instrument un article d'une convention voisine", () => {
    assert.deepEqual(
      extractReferences("Convention de Rome – Article 5 – Règlement (UE) 2016/679 – Article 6"),
      ["Règlement (UE) 2016/679 · art. 6"],
    );
  });

  it("gère une directive sans institution entre parenthèses", () => {
    assert.deepEqual(
      extractReferences("Directive 95/46/CE – Article 7 – Consentement"),
      ["Directive 95/46/CE · art. 7"],
    );
  });

  it("rend un tableau vide quand aucun instrument n'est reconnu", () => {
    assert.deepEqual(extractReferences("Arrêt de la Cour du 3 septembre 2026"), []);
    assert.deepEqual(extractReferences("Article 5 de la charte"), []);
  });

  it("ne duplique ni les instruments ni les articles", () => {
    assert.deepEqual(
      extractReferences(
        "Règlement (UE) 2016/679 – Article 5 – Article 5 – Article 6 – Règlement (UE) 2016/679 – Article 7",
      ),
      ["Règlement (UE) 2016/679 · art. 5, 6, 7"],
    );
  });
});
