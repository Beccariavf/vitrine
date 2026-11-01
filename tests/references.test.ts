import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { extractCnilReferences, extractReferences, extractVisaReferences } from "../veille/references.ts";

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

/** Le visa réel de la décision 25-10.664, tel que rendu par Judilibre. */
const VISA_25_10_664 = [
  'Articles L. <a href="https://www.legifrance.gouv.fr/search/code?query=2315-34" target="_blank">2315-34</a> ' +
    'et D. <a href="https://www.legifrance.gouv.fr/search/code?query=2315-27" target="_blank">2315-27</a> ' +
    "du code du travail.",
  "Articles 4, § 1, 5 et 6, § 1, du règlement (UE) n° 2016/679 du Parlement européen et du Conseil du " +
    "27 avril 2016, relatif à la protection des personnes physiques à l'égard du traitement des données " +
    "à caractère personnel et à la libre circulation de ces données.",
];

describe("les références du visa de la Cour de cassation", () => {
  it("lit le visa de 25-10.664 et ignore le code du travail", () => {
    assert.deepEqual(extractVisaReferences(VISA_25_10_664), [
      "Règlement (UE) 2016/679 · art. 4, 5, 6",
    ]);
  });

  it("nettoie les balises, les paragraphes et les virgules du visa", () => {
    assert.deepEqual(
      extractVisaReferences([
        'Articles 5, § 1, et 6, § 2, du <a href="#">règlement (UE) n° 2016/679</a>.',
      ]),
      ["Règlement (UE) 2016/679 · art. 5, 6"],
    );
  });

  it("reconnaît la LIL, le CPCE et une directive", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Article 82, de la loi n° 78-17 du 6 janvier 1978 relative à l'informatique, aux fichiers et aux libertés.",
        "Article L. 34-5 du code des postes et des communications électroniques.",
        "Article 5, § 3, de la directive 2002/58/CE du Parlement européen et du Conseil.",
      ]),
      [
        "Loi Informatique et Libertés · art. 82",
        "Code des postes et des communications électroniques · art. L. 34-5",
        "Directive 2002/58/CE · art. 5",
      ],
    );
  });

  it("reconnaît les actes européens des autres matières", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Article 6 du règlement (UE) 2024/1689.",
        "Article 5 du règlement (UE) 2022/1925.",
        "Article 13 du règlement (UE) 2022/2065.",
        "Article 7 du règlement (UE) 2022/2554.",
        "Article 21 de la directive (UE) 2022/2555.",
      ]),
      [
        "Règlement (UE) 2024/1689 · art. 6",
        "Règlement (UE) 2022/1925 · art. 5",
        "Règlement (UE) 2022/2065 · art. 13",
        "Règlement (UE) 2022/2554 · art. 7",
        "Directive (UE) 2022/2555 · art. 21",
      ],
    );
  });

  it("rattache chaque liste d'articles à son instrument", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Articles 4 et 5 du règlement (UE) 2016/679 et articles 6 et 7 de la directive 2002/58/CE",
      ]),
      [
        "Règlement (UE) 2016/679 · art. 4, 5",
        "Directive 2002/58/CE · art. 6, 7",
      ],
    );
  });

  it("ne donne pas l'article de l'instrument précédent au suivant", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Règlement (UE) 2016/679 – Article 5 – Directive 2002/58/CE – Article 6",
      ]),
      [
        "Règlement (UE) 2016/679 · art. 5",
        "Directive 2002/58/CE · art. 6",
      ],
    );
  });

  it("sépare aussi une liste introduite par une virgule ou « ainsi que »", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Articles 4 et 5 du règlement (UE) 2016/679, articles 6 et 7 de la directive 2002/58/CE",
      ]),
      [
        "Règlement (UE) 2016/679 · art. 4, 5",
        "Directive 2002/58/CE · art. 6, 7",
      ],
    );
    assert.deepEqual(
      extractVisaReferences([
        "Articles 4 et 5 du règlement (UE) 2016/679 ainsi que l'article 6 de la directive 2002/58/CE",
      ]),
      [
        "Règlement (UE) 2016/679 · art. 4, 5",
        "Directive 2002/58/CE · art. 6",
      ],
    );
  });

  it("ne rend qu'un article par doublon", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Article 6 du règlement (UE) n° 2016/679.",
        "Articles 6, § 1, du règlement (UE) n° 2016/679.",
      ]),
      ["Règlement (UE) 2016/679 · art. 6"],
    );
  });

  it("n'invente rien sans article, ni pour un code non suivi", () => {
    assert.deepEqual(
      extractVisaReferences(["Règlement (UE) n° 2016/679 du Parlement européen et du Conseil."]),
      [],
    );
    assert.deepEqual(
      extractVisaReferences(["Article 1er du code de justice administrative."]),
      [],
    );
    assert.deepEqual(extractVisaReferences([]), []);
  });
});
