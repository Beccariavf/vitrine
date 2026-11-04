import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  calibrer,
  lireQuestions,
  mrr,
  precisionAt1,
  recallAt5,
  repartirPlis,
  tauxCitationsInvalides,
  validerCroise,
  validerReferences,
} from "../mcp/eval/run.ts";
import type { Mesure, Question } from "../mcp/eval/run.ts";

const QUESTIONS = readFileSync(new URL("../mcp/eval/questions.csv", import.meta.url), "utf8");
const CORPUS = readFileSync(new URL("../data/corpus/rgpd/unites.jsonl", import.meta.url), "utf8")
  .trimEnd()
  .split("\n")
  .map((ligne) => JSON.parse(ligne) as { ref: string });

describe("questions.csv", () => {
  const questions = lireQuestions(QUESTIONS);

  it("porte vingt-deux lignes : huit références, neuf conceptuelles, cinq pièges", () => {
    assert.equal(questions.length, 22);
    assert.equal(questions.filter((question) => question.type === "reference").length, 8);
    assert.equal(questions.filter((question) => question.type === "conceptuelle").length, 9);
    assert.equal(questions.filter((question) => question.piege).length, 5);
  });

  it("n'attend que des références présentes dans le corpus", () => {
    validerReferences(questions, new Set(CORPUS.map((unite) => unite.ref)));
  });

  it("nomme la référence absente avant toute mesure", () => {
    const fautives: Question[] = [
      { question: "test", type: "conceptuelle", attendues: ["32016R0679#art_404"], piege: false },
    ];
    assert.throws(
      () => validerReferences(fautives, new Set(CORPUS.map((unite) => unite.ref))),
      /32016R0679#art_404/,
    );
  });

  it("garde « effacement » attendu sur l'article 17, court et long", () => {
    for (const texte of ["effacement", "effacement et moteurs de recherche"]) {
      const effacement = questions.find((question) => question.question === texte);
      assert.deepEqual(effacement?.attendues, ["32016R0679#art_17"], texte);
    }
  });

  it("porte la paraphrase inédite « droit de récupérer mes données » sur l'article 20", () => {
    const paraphrase = questions.find(
      (question) => question.question === "droit de récupérer mes données",
    );
    assert.deepEqual(paraphrase?.attendues, ["32016R0679#art_20"]);
  });
});

describe("les métriques", () => {
  const REF = "32016R0679#art_17";
  const AUTRE = "32016R0679#art_5";

  it("calcule recall@5 sur les questions à référence", () => {
    assert.equal(recallAt5([{ attendues: [REF], rendus: [REF] }]), 1);
    assert.equal(recallAt5([{ attendues: [REF], rendus: [AUTRE, REF] }]), 1);
    assert.equal(recallAt5([{ attendues: [REF], rendus: [AUTRE] }]), 0);
    assert.equal(recallAt5([{ attendues: [], rendus: [] }]), 0);
    assert.equal(
      recallAt5([
        { attendues: [REF], rendus: [REF] },
        { attendues: [REF], rendus: [AUTRE] },
      ]),
      0.5,
    );
  });

  it("calcule la précision au rang 1 sur les questions à référence", () => {
    assert.equal(precisionAt1([{ attendues: [REF], rendus: [REF] }]), 1);
    assert.equal(precisionAt1([{ attendues: [REF], rendus: [AUTRE, REF] }]), 0);
    assert.equal(
      precisionAt1([
        { attendues: [REF], rendus: [REF] },
        { attendues: [REF], rendus: [AUTRE, REF] },
      ]),
      0.5,
    );
    assert.equal(precisionAt1([{ attendues: [], rendus: [AUTRE] }]), 0);
  });

  it("ne compte pas au-delà du cinquième rang", () => {
    assert.equal(recallAt5([{ attendues: [REF], rendus: [AUTRE, AUTRE, AUTRE, AUTRE, AUTRE, REF] }]), 0);
  });

  it("calcule le MRR sur le rang de la première référence", () => {
    assert.equal(mrr([{ attendues: [REF], rendus: [REF] }]), 1);
    assert.equal(mrr([{ attendues: [REF], rendus: [AUTRE, REF] }]), 0.5);
    assert.equal(mrr([{ attendues: [REF], rendus: [AUTRE] }]), 0);
    assert.equal(
      mrr([
        { attendues: [REF], rendus: [REF] },
        { attendues: [REF], rendus: [AUTRE, AUTRE, REF] },
      ]),
      (1 + 1 / 3) / 2,
    );
  });

  it("ne compte un piège comme citation invalide que s'il rend un passage", () => {
    assert.equal(tauxCitationsInvalides([{ piege: true, refusee: true }]), 0);
    assert.equal(tauxCitationsInvalides([{ piege: true, refusee: false }]), 1);
    assert.equal(
      tauxCitationsInvalides([
        { piege: true, refusee: true },
        { piege: true, refusee: false },
        { piege: false, refusee: false },
      ]),
      0.5,
    );
    assert.equal(tauxCitationsInvalides([{ piege: false, refusee: false }]), 0);
  });
});

function question(texte: string, piege: boolean, attendues: string[] = []): Question {
  return { question: texte, type: piege ? "piege" : "conceptuelle", attendues, piege };
}

function mesure(texte: string, piege: boolean, distance: number, attendues: string[] = []): Mesure {
  return { question: question(texte, piege, attendues), refs: attendues, distances: [distance] };
}

describe("la calibration", () => {
  it("sépare les pièges des questions à référence", () => {
    const mesures: Mesure[] = [
      ...Array.from({ length: 6 }, (_, index) =>
        mesure(`question ${index}`, false, 0.1, ["32016R0679#art_17"]),
      ),
      ...Array.from({ length: 4 }, (_, index) => mesure(`piège ${index}`, true, 0.5)),
    ];
    const seuils = calibrer(mesures);

    assert.ok(seuils.bas > 0.5, `bas ${seuils.bas} doit refuser les pièges`);
    assert.ok(seuils.bas <= 0.9, `bas ${seuils.bas} doit rendre les questions`);
  });

  it("découpe vingt mesures en quatre plis de cinq", () => {
    const mesures = Array.from({ length: 20 }, (_, index) => mesure(`q${index}`, index % 5 === 4, 0.1));
    const plis = repartirPlis(mesures, 4);

    assert.equal(plis.length, 4);
    assert.deepEqual(
      plis.map((pli) => pli.length),
      [5, 5, 5, 5],
    );
  });

  it("mesure les citations invalides sur les plis tenus à l'écart", () => {
    const nonPieges = Array.from({ length: 8 }, (_, index) =>
      mesure(`question ${index}`, false, 0.1, ["32016R0679#art_17"]),
    );
    const pieges = Array.from({ length: 4 }, (_, index) => mesure(`piège ${index}`, true, 0.5));
    const mesures: Mesure[] = [
      nonPieges[0]!,
      nonPieges[1]!,
      pieges[0]!,
      nonPieges[2]!,
      nonPieges[3]!,
      pieges[1]!,
      nonPieges[4]!,
      nonPieges[5]!,
      pieges[2]!,
      nonPieges[6]!,
      nonPieges[7]!,
      pieges[3]!,
    ];

    const plis = validerCroise(mesures, 4);

    assert.equal(plis.length, 4);
    assert.ok(plis.every((pli) => pli.pieges >= 1));
    assert.ok(plis.every((pli) => pli.taux === 0));
  });
});
