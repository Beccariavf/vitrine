import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { criteresTrouves } from "../mcp/corpus/pertinence.ts";
import type { CritereElargi } from "../mcp/corpus/pertinence.ts";

const CRPA: CritereElargi = {
  cle: "crpa-livre-iii",
  libelle: "CRPA, livre III",
  articles: "\\bl 3(?:0\\d|1\\d|2[0-7]) \\d+",
  contexte: "\\bcode des relations\\b",
};

describe("les critères d'un filtre élargi", () => {
  it("exige le nom du texte à portée de l'article cité", () => {
    const proche = criteresTrouves(
      "Aux termes de l'article L. 321-1 du code des relations entre le public et " +
        "l'administration, la réutilisation est possible.",
      [CRPA],
    );
    assert.deepEqual(proche.map((critere) => critere.cle), ["crpa-livre-iii"]);

    const loin = criteresTrouves(
      "L'article L. 321-1 du code de l'éducation s'applique au litige, qui porte sur " +
        "l'inscription d'un élève dans un établissement scolaire et sur la décision du " +
        "chef d'établissement prise à ce titre, sans qu'aucune question de communication " +
        "ou de réutilisation de documents ne soit en cause devant le juge. Le code des " +
        "relations entre le public et l'administration est visé par ailleurs, dans un " +
        "moyen sans rapport avec cette disposition, et la décision ne l'applique pas.",
      [CRPA],
    );
    assert.deepEqual(loin, [], "un numéro d'article d'un autre code ne suffit pas");
  });

  it("satisfait une expression, ou toutes quand le critère l'exige", () => {
    const textes: CritereElargi[] = [
      { cle: "simple", libelle: "une expression", expressions: ["secret des affaires"] },
      {
        cle: "paire",
        libelle: "deux expressions",
        expressions: ["base de données", "producteur"],
        toutes: true,
      },
    ];
    assert.deepEqual(
      criteresTrouves("Le secret des affaires protège une base de données.", textes).map(
        (critere) => critere.cle,
      ),
      ["simple"],
    );
    assert.deepEqual(
      criteresTrouves("Le producteur d'une base de données agit en justice.", textes).map(
        (critere) => critere.cle,
      ),
      ["paire"],
    );
  });

  it("refuse un critère vide plutôt que de tout retenir", () => {
    assert.throws(
      () => criteresTrouves("Un texte.", [{ cle: "vide", libelle: "vide" }]),
      /sans article ni expression/,
    );
  });
});
