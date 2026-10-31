import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { extractCnilReferences, extractReferences } from "../veille/references.ts";

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

describe("les références CNIL", () => {
  it("lit l'article avant l'instrument, comme sur la page FNAC", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article 82 de la loi Informatique et Libertés (règles pour les cookies et autres traceurs)",
      ]),
      ["Loi Informatique et Libertés · art. 82"],
    );
  });

  it("canonise RGPD et regroupe ses articles", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article 6 du RGPD (bases légales)",
        "Article 7 du RGPD (conditions applicables au consentement)",
        "Article 21 du RGPD (droit d'opposition)",
        "Article 4.11 du règlement général sur la protection des données (définition du consentement)",
      ]),
      ["Règlement (UE) 2016/679 · art. 6, 7, 21, 4.11"],
    );
  });

  it("reconnaît le Code de la consommation et ignore les décrets", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article L.223-1 du code de la consommation - Légifrance",
        "Décret n°2026-662 du 23 juillet 2026 relatif aux modalités de recueil",
        "Articles 134 à 137 du décret n°2019-539 du 29 mai 2019 (droit des personnes)",
      ]),
      ["Code de la consommation · art. L. 223-1"],
    );
  });

  it("reconnaît les alias d'instruments et les directives citées", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article L. 34-5 du Code des postes et des communications électroniques",
        "Article 7 de la directive 95/46/CE",
        "Article 5 de la directive 2002/58/CE",
        "Article 5 de la directive ePrivacy",
        "Article 82 de la loi n° 78-17 du 6 janvier 1978",
      ]),
      [
        "Code des postes et des communications électroniques · art. L. 34-5",
        "Directive 95/46/CE · art. 7",
        "Directive 2002/58/CE · art. 5",
        "Loi Informatique et Libertés · art. 82",
      ],
    );
  });

  it("conserve le suffixe « et suivants »", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article L. 34-5 et suivants du Code des postes et des communications électroniques",
      ]),
      ["Code des postes et des communications électroniques · art. L. 34-5 et suivants"],
    );
  });

  it("rend les plages, les articles 1er et le dédoublonnage", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Articles 134 à 137 du Code de la consommation",
        "Article 1er du Code de la consommation",
        "Article 6 du RGPD",
        "Article 6 du RGPD",
      ]),
      ["Code de la consommation · art. 134–137, 1er", "Règlement (UE) 2016/679 · art. 6"],
    );
  });

  it("ignore un instrument inconnu ou un instrument sans article", () => {
    assert.deepEqual(extractCnilReferences(["Décret n°2026-662 du 23 juillet 2026"]), []);
    assert.deepEqual(extractCnilReferences(["Article 5 du décret n°2019-539"]), []);
    assert.deepEqual(extractCnilReferences(["Règlement (UE) 2016/679"]), []);
  });
});
