import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { criteresTrouves } from "../mcp/corpus/pertinence.ts";
import type { CritereElargi } from "../mcp/corpus/pertinence.ts";

function critere(corpus: string, cle: string): CritereElargi {
  const descripteur = JSON.parse(
    readFileSync(new URL(`../mcp/corpus/${corpus}/descripteur.json`, import.meta.url), "utf8"),
  ) as { criteres_elargis?: CritereElargi[] };
  const trouve = descripteur.criteres_elargis?.find((element) => element.cle === cle);
  if (trouve === undefined) throw new Error(`Critère ${cle} absent de ${corpus}`);
  return trouve;
}

function cles(texte: string, critereElargi: CritereElargi): string[] {
  return criteresTrouves(texte, [critereElargi]).map((trouve) => trouve.cle);
}

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

  it("borne la proximité du nom du texte à 160 caractères", () => {
    // Forme normalisée : « l 321 1 » (7), une espace, P caractères, une espace,
    // puis « code des relations » (18). La fenêtre s'étend de 160 après
    // l'article, soit jusqu'à l'indice 167 : 9 + P + 18 ≤ 167, donc P = 140
    // passe et P = 141 ne passe plus.
    const proche = `L. 321-1 ${"x".repeat(140)} code des relations`;
    const loin = `L. 321-1 ${"x".repeat(141)} code des relations`;
    assert.deepEqual(criteresTrouves(proche, [CRPA]).map((c) => c.cle), ["crpa-livre-iii"]);
    assert.deepEqual(criteresTrouves(loin, [CRPA]), []);
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

  it("refuse un critère vide ou un motif vide plutôt que de tout retenir", () => {
    assert.throws(
      () => criteresTrouves("Un texte.", [{ cle: "vide", libelle: "vide" }]),
      /sans article ni expression/,
    );
    assert.throws(
      () =>
        criteresTrouves("Un texte.", [
          { cle: "motif", libelle: "motif", articles: "  " },
        ]),
      /motif d'articles vide/,
    );
    assert.throws(
      () =>
        criteresTrouves("Un texte.", [
          { cle: "expression", libelle: "expression", expressions: ["—"] },
        ]),
      /expression vide/,
    );
    assert.throws(
      () =>
        criteresTrouves("Un texte.", [
          { cle: "contexte", libelle: "contexte", articles: "l 321 1", contexte: " " },
        ]),
      /motif de contexte vide/,
    );
    assert.throws(
      () =>
        criteresTrouves("Un texte.", [
          { cle: "seuil", libelle: "seuil", expressions: ["secret"], occurrences_min: 0 },
        ]),
      /occurrences_min/,
    );
  });
});

describe("les resserrements du filtre élargi (#143)", () => {
  const penal = critere("ce", "penal-226-13");
  const patrimoine = critere("ce", "patrimoine-livre-ii");
  const crpa = critere("ce", "crpa-livre-iii");
  const secret = critere("ce", "secret-des-affaires");
  const commerce = critere("ce", "commerce-secret-affaires");

  it("ne retient 226-13 qu'avec un contexte de santé à portée", () => {
    assert.deepEqual(
      cles(
        "Le médecin a révélé, en violation de l'article 226-13 du code pénal, " +
          "l'état de santé de son patient.",
        penal,
      ),
      ["penal-226-13"],
    );
    assert.deepEqual(
      cles(
        "L'article 226-13 du code pénal protège le secret professionnel de l'avocat, " +
          "qui ne peut divulguer les confidences reçues.",
        penal,
      ),
      [],
      "un secret professionnel hors santé ne suffit pas",
    );
  });

  it("borne le code du patrimoine au livre II (archives)", () => {
    assert.deepEqual(
      cles(
        "L'article L. 211-1 du code du patrimoine range ces pièces parmi les archives " +
          "publiques ; l'article R. 212-1 en règle la communication.",
        patrimoine,
      ),
      ["patrimoine-livre-ii"],
    );
    assert.deepEqual(
      cles(
        "L'article L. 111-1 du code du patrimoine protège les biens culturels et les " +
          "trésors nationaux.",
        patrimoine,
      ),
      [],
      "une citation du livre I (biens culturels) ne suffit pas",
    );
  });

  it("n'ouvre le CRPA livre III qu'à un contexte d'accès ou de réutilisation", () => {
    assert.deepEqual(
      cles(
        "La communication des documents administratifs est régie par l'article L. 321-1 " +
          "du code des relations entre le public et l'administration.",
        crpa,
      ),
      ["crpa-livre-iii"],
    );
    assert.deepEqual(
      cles(
        "L'article L. 312-2 du code des relations entre le public et l'administration " +
          "prévoit la publication des circulaires ; le litige porte sur un titre de séjour " +
          "et sur la régularité de la procédure devant le juge administratif.",
        crpa,
      ),
      [],
      "une publication de circulaire sans litige d'accès ne suffit pas",
    );
  });

  it("exige deux mentions du secret des affaires, ou une citation du texte", () => {
    assert.deepEqual(cles("Le secret des affaires est invoqué.", secret), []);
    assert.deepEqual(
      cles(
        "Le secret des affaires couvre les comptes ; la cour a écarté le secret des " +
          "affaires pour les pièces comptables.",
        secret,
      ),
      ["secret-des-affaires"],
    );
    assert.deepEqual(
      cles("L'article L. 151-1 du code de commerce protège le secret des affaires.", commerce),
      ["commerce-secret-affaires"],
    );
  });
});
