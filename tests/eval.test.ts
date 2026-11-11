import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  calibrer,
  cheminMarqueur,
  corpusDuJeu,
  ecrireMesureTest,
  entreeQuestionJson,
  filtrerSplit,
  INSTRUCTION_CNIL_NEUTRE,
  instructionCnil,
  instructionsDeMesure,
  intervalleWilson,
  lireInstruction,
  lireJeu,
  lireQuestions,
  lireRegle,
  lireSeuils,
  mrr,
  moyenne,
  objetMesureJson,
  precisionAt1,
  recallAt5,
  refSatisfaite,
  repartirPlis,
  resoudreQuestions,
  resume,
  seuilsDeMesure,
  tauxCitationsInvalides,
  validerCroise,
  validerReferences,
  verifierAutorisationTest,
  verifierJsonSplit,
  verifierRegleSeuils,
  verifierTestNonConsomme,
} from "../mcp/eval/run.ts";
import type { MarqueurV3, Mesure, Question, Split } from "../mcp/eval/run.ts";
import {
  INSTRUCTION_AIAct,
  INSTRUCTION_CNIL,
  INSTRUCTION_REQUETE,
} from "../mcp/embed/embedder.ts";
import { referenceExacte } from "../mcp/tools.ts";

const QUESTIONS = readFileSync(new URL("../mcp/eval/questions.csv", import.meta.url), "utf8");
const QUESTIONS_V2 = readFileSync(new URL("../mcp/eval/questions-v2.csv", import.meta.url), "utf8");
const QUESTIONS_V3 = readFileSync(new URL("../mcp/eval/questions-v3.csv", import.meta.url), "utf8");
const QUESTIONS_AIAct = readFileSync(
  new URL("../mcp/eval/questions-aiact.csv", import.meta.url),
  "utf8",
);
const CORPUS = readFileSync(new URL("../data/corpus/rgpd/unites.jsonl", import.meta.url), "utf8")
  .trimEnd()
  .split("\n")
  .map((ligne) => JSON.parse(ligne) as { ref: string });

describe("questions.csv", () => {
  const questions = lireQuestions(QUESTIONS);
  const dev = filtrerSplit(questions, "dev");
  const test = filtrerSplit(questions, "test");

  it("porte cinquante lignes : douze références, vingt-huit conceptuelles, dix pièges", () => {
    assert.equal(questions.length, 50);
    assert.equal(questions.filter((question) => question.type === "reference").length, 12);
    assert.equal(questions.filter((question) => question.type === "conceptuelle").length, 28);
    assert.equal(questions.filter((question) => question.piege).length, 10);
  });

  it("répartit trente-cinq questions en dev et quinze en test", () => {
    assert.equal(dev.length, 35);
    assert.equal(test.length, 15);
    assert.ok(dev.every((question) => question.split === "dev"));
    assert.ok(test.every((question) => question.split === "test"));
    assert.equal(dev.filter((question) => question.type === "reference").length, 8);
    assert.equal(dev.filter((question) => question.type === "conceptuelle").length, 20);
    assert.equal(dev.filter((question) => question.piege).length, 7);
    assert.equal(test.filter((question) => question.type === "reference").length, 4);
    assert.equal(test.filter((question) => question.type === "conceptuelle").length, 8);
    assert.equal(test.filter((question) => question.piege).length, 3);
  });

  it("n'attend que des références présentes dans le corpus", () => {
    validerReferences(questions, new Set(CORPUS.map((unite) => unite.ref)));
  });

  it("nomme la référence absente avant toute mesure", () => {
    const fautives: Question[] = [
      {
        question: "test",
        type: "conceptuelle",
        attendues: ["32016R0679#art_404"],
        piege: false,
        split: "dev",
      },
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

  it("porte la paraphrase inédite « droit de récupérer mes données » en test sur l'article 20", () => {
    const paraphrase = questions.find(
      (question) => question.question === "droit de récupérer mes données",
    );
    assert.equal(paraphrase?.split, "test");
    assert.deepEqual(paraphrase?.attendues, ["32016R0679#art_20"]);
  });

  it("filtre chaque split sans mélanger les lignes", () => {
    assert.deepEqual(
      filtrerSplit(questions, "all").map((question) => question.question),
      questions.map((question) => question.question),
    );
    assert.equal(
      filtrerSplit(questions, "dev").some((question) => question.split === "test"),
      false,
    );
    assert.equal(
      filtrerSplit(questions, "test").some((question) => question.split === "dev"),
      false,
    );
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

function question(
  texte: string,
  piege: boolean,
  attendues: string[] = [],
  split: Split = "dev",
): Question {
  return { question: texte, type: piege ? "piege" : "conceptuelle", attendues, piege, split };
}

function mesure(
  texte: string,
  piege: boolean,
  distance: number,
  attendues: string[] = [],
  split: Split = "dev",
): Mesure {
  return { question: question(texte, piege, attendues, split), refs: attendues, distances: [distance] };
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

  it("refuse de calibrer sur une question test en la nommant", () => {
    const mesures: Mesure[] = [
      mesure("question dev", false, 0.1, ["32016R0679#art_17"], "dev"),
      mesure("fuite de test", true, 0.5, [], "test"),
    ];

    assert.throws(() => calibrer(mesures), /Calibration interdite.*fuite de test/);
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

describe("les seuils figés", () => {
  it("lit trois nombres dans [0, 1]", () => {
    assert.deepEqual(lireSeuils("0.61,0.7,0.02"), { bas: 0.61, haut: 0.7, marge: 0.02 });
    assert.equal(lireSeuils(undefined), null);
    assert.deepEqual(lireSeuils("0,1,0"), { bas: 0, haut: 1, marge: 0 });
  });

  it("refuse une forme courte en nommant la valeur reçue", () => {
    assert.throws(() => lireSeuils("0.6,0.7"), /reçu « 0\.6,0\.7 »/);
    assert.throws(() => lireSeuils("0.6,0.7,0.01,0.2"), /reçu « 0\.6,0\.7,0\.01,0\.2 »/);
  });

  it("nomme une valeur non numérique", () => {
    assert.throws(() => lireSeuils("0.6,abc,0.01"), /valeur non numérique « abc »/);
    assert.throws(() => lireSeuils("0.6,,0.01"), /valeur non numérique « \(vide\) »/);
  });

  it("nomme une valeur hors de [0, 1]", () => {
    assert.throws(() => lireSeuils("1.2,0.7,0.01"), /hors de \[0, 1\] « 1\.2 »/);
    assert.throws(() => lireSeuils("0.6,0.7,1.5"), /hors de \[0, 1\] « 1\.5 »/);
    assert.throws(() => lireSeuils("-0.1,0.7,0.01"), /hors de \[0, 1\] « -0\.1 »/);
  });

  it("nomme une marge négative", () => {
    assert.throws(() => lireSeuils("0.6,0.7,-0.01"), /marge négative « -0\.01 »/);
  });

  it("refuse un bas au-dessus du haut", () => {
    assert.throws(() => lireSeuils("0.8,0.7,0.01"), /bas \(0\.8\) dépasse haut \(0\.7\)/);
  });

  it("garde la calibration dev quand --seuils est fourni", () => {
    const mesures: Mesure[] = [
      ...Array.from({ length: 6 }, (_, index) =>
        mesure(`question ${index}`, false, 0.1, ["32016R0679#art_17"]),
      ),
      ...Array.from({ length: 4 }, (_, index) => mesure(`piège ${index}`, true, 0.5)),
    ];
    const calibration = calibrer(mesures);
    const retenus = seuilsDeMesure({
      split: "dev",
      avecSplit: true,
      mesuresDev: mesures,
      explicites: { bas: 0.5, haut: 0.6, marge: 0.01 },
    });

    assert.deepEqual(retenus.seuils, { bas: 0.5, haut: 0.6, marge: 0.01 });
    assert.deepEqual(retenus.calibration, calibration);
    assert.match(retenus.origine, /fournis par --seuils.*calibration dev/);
  });

  it("accepte --seuils sur le test sans calibrer", () => {
    const retenus = seuilsDeMesure({
      split: "test",
      avecSplit: true,
      mesuresDev: [],
      explicites: { bas: 0.7, haut: 0.8, marge: 0.03 },
    });

    assert.deepEqual(retenus.seuils, { bas: 0.7, haut: 0.8, marge: 0.03 });
    assert.equal(retenus.calibration, null);
    assert.equal(retenus.origine, "fournis par --seuils");
  });

  it("garde les constantes figées sur le test sans --seuils", () => {
    const retenus = seuilsDeMesure({
      split: "test",
      avecSplit: true,
      mesuresDev: [],
      explicites: null,
    });

    assert.equal(retenus.origine, "figés avant la mesure");
    assert.equal(retenus.seuils.bas, 0.69);
    assert.equal(retenus.seuils.haut, 0.74);
    assert.equal(retenus.seuils.marge, 0.01);
  });

  it("refuse --seuils mal formé avant toute mesure", () => {
    const run = fileURLToPath(new URL("../mcp/eval/run.ts", import.meta.url));
    const racine = fileURLToPath(new URL("..", import.meta.url));
    const resultat = spawnSync(
      process.execPath,
      [
        run,
        "--questions",
        "questions-v3.csv",
        "--split",
        "dev",
        "--seuils",
        "1.2,0.7,0.01",
      ],
      { cwd: racine, encoding: "utf8", timeout: 30_000 },
    );

    assert.notEqual(resultat.status, 0);
    assert.equal(resultat.stdout, "", "le refus précède toute mesure");
    assert.match(resultat.stderr, /hors de \[0, 1\] « 1\.2 »/);
  });
});

describe("la règle du produit", () => {
  it("rend la table du corpus CNIL avec l'origine table", () => {
    const retenus = seuilsDeMesure({
      split: "dev",
      avecSplit: true,
      mesuresDev: [],
      explicites: null,
      regle: "produit",
      corpus: "cnil",
    });

    assert.deepEqual(retenus.seuils, { bas: 0.73, haut: 0.73, marge: 0.01 });
    assert.equal(retenus.calibration, null, "aucune grille ne tourne sous la règle du produit");
    assert.match(retenus.origine, /table \(cnil\)/);
  });

  it("suit le repli pour un corpus sans promesse, en le nommant", () => {
    const retenus = seuilsDeMesure({
      split: "dev",
      avecSplit: true,
      mesuresDev: [],
      explicites: null,
      regle: "produit",
      corpus: "rgpd",
    });

    assert.deepEqual(retenus.seuils, { bas: 0.69, haut: 0.74, marge: 0.01 });
    assert.equal(retenus.calibration, null);
    assert.match(retenus.origine, /table \(repli, rgpd\)/);
  });

  it("refuse --seuils en même temps, en nommant le conflit", () => {
    assert.throws(
      () => verifierRegleSeuils("produit", { bas: 0.6, haut: 0.7, marge: 0.01 }),
      /--regle produit refuse --seuils/,
    );
    verifierRegleSeuils("calibree", { bas: 0.6, haut: 0.7, marge: 0.01 });
    verifierRegleSeuils("produit", null);
  });

  it("refuse le conflit au niveau CLI, avant toute mesure", () => {
    const run = fileURLToPath(new URL("../mcp/eval/run.ts", import.meta.url));
    const racine = fileURLToPath(new URL("..", import.meta.url));
    const resultat = spawnSync(
      process.execPath,
      [run, "--regle", "produit", "--seuils", "0.6,0.7,0.01"],
      { cwd: racine, encoding: "utf8", timeout: 30_000 },
    );

    assert.notEqual(resultat.status, 0);
    assert.equal(resultat.stdout, "", "le refus précède toute mesure");
    assert.match(resultat.stderr, /--regle produit refuse --seuils/);
  });

  it("refuse une règle inconnue en la nommant", () => {
    assert.equal(lireRegle(undefined), "calibree");
    assert.equal(lireRegle("calibree"), "calibree");
    assert.equal(lireRegle("produit"), "produit");
    assert.throws(() => lireRegle("grille"), /--regle attendu calibree ou produit ; reçu « grille »/);
    assert.throws(() => lireRegle(""), /--regle attendu calibree ou produit ; reçu « \(vide\) »/);
  });

  it("garde les refs d'une mesure dev quand seule la règle change", () => {
    const mesures: Mesure[] = [
      {
        question: {
          question: "une sanction récente sur les cookies",
          type: "conceptuelle",
          attendues: ["CNILTEXT000055000001"],
          piege: false,
          split: "dev",
        },
        refs: ["CNILTEXT000055000002#f0", "CNILTEXT000055000001#f1"],
        distances: [0.265, 0.5],
      },
    ];
    const commun = {
      date: "2026-11-10",
      modele: "qwen3-embedding:0.6b",
      dimensions: 1024,
      split: "dev" as const,
      corpus: "cnil",
      recherche: "dense" as const,
      index: { chemin: "/tmp/corpus/index/index.db", unites: 53_143 },
      mesures,
    };
    const calibree = objetMesureJson({
      ...commun,
      seuils: { bas: 0.69, haut: 0.74, marge: 0.01 },
      seuilsOrigine: "calibrés sur dev",
    });
    const produit = objetMesureJson({
      ...commun,
      seuils: { bas: 0.73, haut: 0.73, marge: 0.01 },
      seuilsOrigine: "table (cnil)",
    });

    assert.equal(calibree.seuils_origine, "calibrés sur dev");
    assert.equal(produit.seuils_origine, "table (cnil)");

    assert.deepEqual(
      produit.questions.map((entree) => entree.refs),
      calibree.questions.map((entree) => entree.refs),
      "la règle ne touche pas ce que la recherche a rendu",
    );
    assert.deepEqual(
      produit.questions.map((entree) => entree.similarites),
      calibree.questions.map((entree) => entree.similarites),
    );
    assert.equal(calibree.questions[0]?.niveau, "incertain");
    assert.equal(produit.questions[0]?.niveau, "confiant");
  });
});

describe("l'instruction de requête mesurée", () => {
  it("choisit l'instruction du produit quand --instruction est absent", () => {
    assert.equal(lireInstruction(undefined), "actuelle");
    assert.equal(instructionCnil(lireInstruction(undefined)), INSTRUCTION_CNIL);
  });

  it("rend la variante neutre sur --instruction neutre", () => {
    assert.equal(lireInstruction("neutre"), "neutre");
    assert.equal(instructionCnil("neutre"), INSTRUCTION_CNIL_NEUTRE);
  });

  it("garde la forme de l'instruction CNIL sans nommer la sanction", () => {
    assert.equal(
      INSTRUCTION_CNIL_NEUTRE,
      "Instruction : retrouve les passages d'une délibération de la CNIL qui répondent à la question\nRequête : ",
    );
    assert.match(INSTRUCTION_CNIL_NEUTRE, /^Instruction : .*CNIL.*\nRequête : $/);
    assert.doesNotMatch(INSTRUCTION_CNIL_NEUTRE, /sanction/i);
    assert.match(INSTRUCTION_CNIL, /sanction/i, "l'instruction du produit, elle, nomme la sanction");
    assert.notEqual(INSTRUCTION_CNIL_NEUTRE, INSTRUCTION_CNIL);
  });

  it("ne change que l'instruction CNIL, jamais celles du RGPD ni de l'AI Act", () => {
    const neutre = instructionsDeMesure("neutre");
    const actuelle = instructionsDeMesure("actuelle");

    assert.equal(neutre.cnil, INSTRUCTION_CNIL_NEUTRE);
    assert.equal(actuelle.cnil, INSTRUCTION_CNIL);
    assert.equal(neutre.rgpd, INSTRUCTION_REQUETE);
    assert.equal(neutre.aiact, INSTRUCTION_AIAct);
    assert.equal(neutre["32016R0679"], INSTRUCTION_REQUETE);
    assert.equal(neutre["32024R1689"], INSTRUCTION_AIAct);
  });

  it("refuse une valeur inconnue en la nommant", () => {
    assert.throws(
      () => lireInstruction("moderee"),
      /--instruction attendu actuelle ou neutre ; reçu « moderee »/,
    );
    assert.throws(
      () => lireInstruction(""),
      /--instruction attendu actuelle ou neutre ; reçu « \(vide\) »/,
    );
  });

  it("refuse --instruction inconnu au niveau CLI, avant toute mesure", () => {
    const run = fileURLToPath(new URL("../mcp/eval/run.ts", import.meta.url));
    const racine = fileURLToPath(new URL("..", import.meta.url));
    const resultat = spawnSync(
      process.execPath,
      [run, "--questions", "questions-v3.csv", "--split", "dev", "--instruction", "moderee"],
      { cwd: racine, encoding: "utf8", timeout: 30_000 },
    );

    assert.notEqual(resultat.status, 0);
    assert.equal(resultat.stdout, "", "le refus précède toute mesure");
    assert.match(resultat.stderr, /--instruction attendu actuelle ou neutre ; reçu « moderee »/);
  });
});

describe("le résumé du marqueur", () => {
  it("déduit les agrégats rendus du refus du premier passage", () => {
    const mesures: Mesure[] = [
      {
        question: question("garde", false, ["32016R0679#art_17"]),
        refs: ["32016R0679#art_17"],
        distances: [0.1],
      },
      {
        question: question("refus", false, ["32016R0679#art_80"]),
        refs: ["32016R0679#art_80"],
        distances: [0.4],
      },
    ];
    const chiffres = resume(mesures, { bas: 0.69, haut: 0.74, marge: 0.01 });

    assert.equal(chiffres.semantiques, 2);
    assert.equal(chiffres.top5_semantique_succes, 2);
    assert.equal(chiffres.top5_rendu_succes, 1);
    assert.equal(chiffres.top1_semantique_succes, 2);
    assert.equal(chiffres.top1_rendu_succes, 1);
    assert.equal(chiffres.mrr_semantique, 1);
    assert.equal(chiffres.mrr_rendu, 0.5);
    assert.equal(chiffres.top5_global_succes, 2);
    assert.equal(chiffres.top5_global_rendu_succes, 1);
    assert.equal(chiffres.aucun_resultat_fiable, 1);
  });
});

describe("questions-v2.csv", () => {
  const questions = lireQuestions(QUESTIONS_V2);
  const refs = new Set(CORPUS.map((unite) => unite.ref));

  it("porte soixante lignes : douze références, trente-huit conceptuelles, dix pièges", () => {
    assert.equal(questions.length, 60);
    assert.equal(questions.filter((question) => question.type === "reference").length, 12);
    assert.equal(questions.filter((question) => question.type === "conceptuelle").length, 38);
    assert.equal(questions.filter((question) => question.piege).length, 10);
  });

  it("répartit trente questions en dev et trente en test", () => {
    const dev = filtrerSplit(questions, "dev");
    const test = filtrerSplit(questions, "test");

    assert.equal(dev.length, 30);
    assert.equal(test.length, 30);
    assert.equal(dev.filter((question) => question.piege).length, 5);
    assert.equal(test.filter((question) => question.piege).length, 5);
  });

  it("n'attend que des références présentes dans le corpus", () => {
    validerReferences(questions, refs);
  });

  it("garde au moins un piège sur un numéro d'article plausible mais absent", () => {
    const pieges = questions.filter((question) => question.piege);
    const numeros = pieges
      .map((question) => /\b(?:article|art\.?)\s*(\d+)/i.exec(question.question))
      .filter((trouve): trouve is RegExpExecArray => trouve !== null)
      .map((trouve) => Number(trouve[1]));

    assert.ok(numeros.length >= 1);
    assert.ok(numeros.every((numero) => !refs.has(`32016R0679#art_${numero}`)));
  });

  it("garde la paraphrase « droit de récupérer mes données » en test sur l'article 20", () => {
    const paraphrase = questions.find(
      (question) => question.question === "droit de récupérer mes données",
    );

    assert.equal(paraphrase?.split, "test");
    assert.deepEqual(paraphrase?.attendues, ["32016R0679#art_20"]);
  });
});

describe("questions-v3.csv", () => {
  const questions = lireQuestions(QUESTIONS_V3);
  const dev = filtrerSplit(questions, "dev");
  const test = filtrerSplit(questions, "test");
  const unites = readFileSync(
    new URL("../data/corpus/rgpd/unites.jsonl", import.meta.url),
    "utf8",
  )
    .trimEnd()
    .split("\n")
    .map((ligne) => JSON.parse(ligne) as { ref: string; chemin: string });
  const refs = new Set(unites.map((unite) => unite.ref));

  it("porte quatre-vingts lignes : six références, soixante-huit conceptuelles, six pièges", () => {
    assert.equal(questions.length, 80);
    assert.equal(questions.filter((question) => question.type === "reference").length, 6);
    assert.equal(questions.filter((question) => question.type === "conceptuelle").length, 68);
    assert.equal(questions.filter((question) => question.piege).length, 6);
  });

  it("répartit quarante questions en dev et quarante en test", () => {
    assert.equal(dev.length, 40);
    assert.equal(test.length, 40);
    for (const split of [dev, test]) {
      assert.equal(split.filter((question) => question.type === "conceptuelle").length, 34);
      assert.equal(split.filter((question) => question.type === "reference").length, 3);
      assert.equal(split.filter((question) => question.piege).length, 3);
    }
  });

  it("n'attend que des références présentes dans le corpus", () => {
    validerReferences(questions, refs);
  });

  it("ne donne aucune source attendue à un piège", () => {
    for (const piege of questions.filter((question) => question.piege)) {
      assert.deepEqual(piege.attendues, [], piege.question);
    }
  });

  it("ne réutilise aucune question des jeux v1 et v2", () => {
    const dejaPosees = new Set(
      [...lireQuestions(QUESTIONS), ...lireQuestions(QUESTIONS_V2)].map(
        (question) => question.question,
      ),
    );
    for (const question of questions) {
      assert.equal(dejaPosees.has(question.question), false, question.question);
    }
  });

  it("couvre les onze chapitres du RGPD", () => {
    const chapitres = new Set(
      questions
        .flatMap((question) => question.attendues)
        .map((ref) => unites.find((unite) => unite.ref === ref)?.chemin ?? "")
        .map((chemin) => /Chapitre [IVX]+/.exec(chemin)?.[0] ?? chemin),
    );

    assert.equal(chapitres.size, 11);
  });

  it("classe une question sans référence ni piège en sémantique sans lever", () => {
    const jeu = lireJeu(
      "question,type,sources_attendues,piege,split\nune question sans source,conceptuelle,,non,dev\n",
    );

    assert.equal(jeu.questions[0]?.attendues.length, 0);
    assert.equal(jeu.questions[0]?.piege, false);
  });

  it("refuse un piège qui cite une source attendue", () => {
    assert.throws(
      () =>
        lireJeu(
          "question,type,sources_attendues,piege,split\nun faux piège,piege,32016R0679#art_17,oui,dev\n",
        ),
      /un piège ne cite pas de source attendue/,
    );
  });
});

describe("le corpus du jeu", () => {
  it("déduit le corpus du préfixe des références", () => {
    assert.equal(corpusDuJeu(lireQuestions(QUESTIONS_V2)), "rgpd");
    assert.equal(corpusDuJeu(lireQuestions(QUESTIONS_AIAct)), "aiact");
    assert.equal(corpusDuJeu(lireQuestions(QUESTIONS_V3)), "rgpd");
  });

  it("refuse une question qui viserait deux corpus", () => {
    const questions: Question[] = [
      {
        question: "une question qui mélange",
        type: "conceptuelle",
        attendues: ["32016R0679#art_17", "32024R1689#art_6"],
        piege: false,
        split: "dev",
      },
    ];

    assert.throws(() => corpusDuJeu(questions), /plusieurs corpus.*aiact, rgpd/);
  });

  it("lit un jeu qui déclare sa colonne corpus", () => {
    const jeu = lireJeu(
      "question,type,sources_attendues,piege,corpus\n" +
        "une sanction récente,reference,CNILTEXT000012345,non,cnil\n",
    );

    assert.equal(jeu.avecSplit, false);
    assert.equal(jeu.questions[0]?.corpus, "cnil");
    assert.equal(corpusDuJeu(jeu.questions), "cnil");
  });

  it("accepte une référence au document entier sans `#`", () => {
    const refs = new Set(["CNILTEXT000012345#f0", "CNILTEXT000012345#f1"]);
    const documents = new Set(["CNILTEXT000012345"]);
    const questions: Question[] = [
      {
        question: "que reproche la CNIL à cette société",
        type: "reference",
        attendues: ["CNILTEXT000012345"],
        piege: false,
        split: "dev",
      },
    ];

    validerReferences(questions, refs, documents);
    assert.throws(() => validerReferences(questions, refs), /absente du corpus/);
    assert.throws(
      () => validerReferences(questions, refs, new Set(["CNILTEXT000099999"])),
      /absente du corpus/,
    );
  });

  it("juge le succès au document quand l'attendue n'a pas de `#`", () => {
    assert.equal(refSatisfaite("CNILTEXT000012345#f7", "CNILTEXT000012345"), true);
    assert.equal(refSatisfaite("CNILTEXT000099999#f7", "CNILTEXT000012345"), false);
    assert.equal(refSatisfaite("32016R0679#art_17", "32016R0679#art_18"), false);

    const classements = [
      {
        attendues: ["CNILTEXT000012345"],
        rendus: ["CNILTEXT000099999#f0", "CNILTEXT000012345#f3"],
      },
    ];

    assert.equal(recallAt5(classements), 1);
    assert.equal(precisionAt1(classements), 0);
  });
});

describe("la lecture d'un jeu", () => {
  it("lit un jeu à quatre colonnes comme un jeu sans split", () => {
    const jeu = lireJeu("question,type,sources_attendues,piege\nune question,conceptuelle,32024R1689#art_1,non\n");

    assert.equal(jeu.avecSplit, false);
    assert.equal(jeu.questions[0]?.split, "dev");
  });
});

describe("le verrou du test", () => {
  it("exige --mesurer-test pour le split test et pour all", () => {
    assert.throws(() => verifierAutorisationTest("test", false), /exige --mesurer-test/);
    assert.throws(() => verifierAutorisationTest("all", false), /exige --mesurer-test/);
    verifierAutorisationTest("test", true);
    verifierAutorisationTest("dev", false);
  });

  it("ajoute une mesure et refuse le même modèle sans effacer la première", () => {
    const dossier = mkdtempSync(join(tmpdir(), "vitrine-eval-"));
    try {
      const marqueurPath = join(dossier, "questions-v3.test-consomme.json");
      const seuils = { bas: 0.61, haut: 0.7, marge: 0.02 };
      const agregats = resume([], seuils);
      const modele06 = "qwen3-embedding:0.6b";
      const modele4b = "qwen3-embedding:4b";

      verifierTestNonConsomme(marqueurPath, "abc", modele06);
      ecrireMesureTest(
        marqueurPath,
        "abc",
        { modele: modele06, dimensions: 1024, date: "2026-11-05", seuils, agregats },
        "note fournie par l'appelant",
      );

      assert.throws(
        () => verifierTestNonConsomme(marqueurPath, "abc", modele06),
        /Test déjà consommé pour le modèle « qwen3-embedding:0\.6b » le 2026-11-05/,
      );

      verifierTestNonConsomme(marqueurPath, "abc", modele4b);
      ecrireMesureTest(
        marqueurPath,
        "abc",
        { modele: modele4b, dimensions: 2560, date: "2026-11-05", seuils, agregats },
        "note fournie par l'appelant",
      );

      const ecrit = JSON.parse(readFileSync(marqueurPath, "utf8")) as MarqueurV3;
      assert.equal(ecrit.note, "note fournie par l'appelant");
      assert.equal(ecrit.questions_sha256, "abc");
      assert.deepEqual(
        ecrit.mesures.map((mesure) => mesure.modele),
        [modele06, modele4b],
      );
      assert.equal(ecrit.mesures[0]?.dimensions, 1024);
      assert.deepEqual(ecrit.mesures[0]?.seuils, seuils);
      assert.equal(ecrit.mesures[1]?.dimensions, 2560);
      assert.throws(
        () => verifierTestNonConsomme(marqueurPath, "abc", modele4b),
        /qwen3-embedding:4b/,
      );
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("refuse un marqueur v2 à plat quel que soit le modèle", () => {
    const dossier = mkdtempSync(join(tmpdir(), "vitrine-eval-"));
    try {
      const marqueurPath = join(dossier, "questions-v2.test-consomme.json");
      writeFileSync(
        marqueurPath,
        JSON.stringify({
          date: "2026-11-05",
          questions_sha256: "v2",
          modele: "qwen3-embedding:0.6b",
        }),
      );

      assert.throws(
        () => verifierTestNonConsomme(marqueurPath, "v3", "qwen3-embedding:4b"),
        /marqueur v2 à plat/,
      );
      assert.throws(
        () => verifierTestNonConsomme(marqueurPath, "v3", "qwen3-embedding:4b"),
        /Test déjà consommé le 2026-11-05/,
      );
      assert.throws(
        () =>
          ecrireMesureTest(
            marqueurPath,
            "v3",
            {
              modele: "qwen3-embedding:4b",
              dimensions: 2560,
              date: "2026-11-05",
              seuils: { bas: 0.6, haut: 0.7, marge: 0.01 },
              agregats: resume([], { bas: 0.6, haut: 0.7, marge: 0.01 }),
            },
            "note",
          ),
        /marqueur v2 à plat ne reçoit aucune mesure v3/,
      );
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("refuse un marqueur lié à une autre empreinte de questions", () => {
    const dossier = mkdtempSync(join(tmpdir(), "vitrine-eval-"));
    try {
      const marqueurPath = join(dossier, "questions-v3.test-consomme.json");
      ecrireMesureTest(
        marqueurPath,
        "abc",
        {
          modele: "qwen3-embedding:0.6b",
          dimensions: 1024,
          date: "2026-11-05",
          seuils: { bas: 0.6, haut: 0.7, marge: 0.01 },
          agregats: resume([], { bas: 0.6, haut: 0.7, marge: 0.01 }),
        },
        "note",
      );

      assert.throws(
        () => verifierTestNonConsomme(marqueurPath, "def", "qwen3-embedding:4b"),
        /autre empreinte de questions/,
      );
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("rend une entrée JSON par question avec rangs et similarités alignés", () => {
    const seuils = { bas: 0.6, haut: 0.7, marge: 0.01 };
    const mesures: Mesure[] = [
      {
        question: {
          question: "une question à référence",
          type: "conceptuelle",
          attendues: ["32016R0679#art_17"],
          piege: false,
          split: "test",
        },
        refs: ["32016R0679#art_5", "32016R0679#art_17"],
        distances: [0.2, 0.3],
      },
      {
        question: {
          question: "un piège",
          type: "piege",
          attendues: [],
          piege: true,
          split: "test",
        },
        refs: ["32016R0679#art_7"],
        distances: [0.4],
      },
    ];

    const objet = objetMesureJson({
      date: "2026-11-05",
      modele: "qwen3-embedding:0.6b",
      dimensions: 1024,
      split: "test",
      corpus: "rgpd",
      recherche: "dense",
      index: { chemin: "/tmp/corpus/index/index.db", unites: 12 },
      seuils,
      seuilsOrigine: "fournis par --seuils",
      mesures,
    });

    assert.equal(objet.questions.length, 2);
    assert.deepEqual(objet.questions[0]?.refs, ["32016R0679#art_5", "32016R0679#art_17"]);
    assert.deepEqual(objet.questions[0]?.rangs, [2]);
    assert.deepEqual(objet.questions[0]?.similarites, [0.8, 0.7]);
    assert.equal(objet.questions[0]?.niveau, "confiant");
    assert.deepEqual(objet.questions[1]?.attendues, []);
    assert.deepEqual(objet.questions[1]?.rangs, []);
    assert.equal(objet.questions[1]?.piege, true);
    assert.equal(objet.agregats.semantiques, 1);
    assert.equal(objet.agregats.pieges_mesures, 1);
    assert.deepEqual(objet.index, { chemin: "/tmp/corpus/index/index.db", unites: 12 });
    assert.equal("rerank" in objet, false);
    assert.equal(entreeQuestionJson(mesures[0]!, seuils).rangs[0], 2);
  });

  it("porte le bloc rerank seulement quand l'étage a tourné", () => {
    const commun = {
      date: "2026-11-05",
      modele: "qwen3-embedding:0.6b",
      dimensions: 1024,
      split: "test" as const,
      corpus: "cnil",
      recherche: "dense" as const,
      index: { chemin: "/tmp/corpus/index/index.db", unites: 29_299 },
      seuils: { bas: 0.6, haut: 0.7, marge: 0.01 },
      seuilsOrigine: "figés avant la mesure",
      mesures: [],
    };

    assert.equal("rerank" in objetMesureJson(commun), false);

    const objet = objetMesureJson({
      ...commun,
      rerank: {
        modele: "qwen3-reranker-0.6b",
        url: "http://127.0.0.1:8080",
        latence_ms_moyenne: moyenne([3600, 3692]),
      },
    });

    assert.deepEqual(objet.rerank, {
      modele: "qwen3-reranker-0.6b",
      url: "http://127.0.0.1:8080",
      latence_ms_moyenne: 3646,
    });
    assert.equal(objet.index.unites, 29_299);
    assert.equal(moyenne([]), 0);
  });

  it("compte une référence documentaire satisfaite par un fragment", () => {
    const mesure: Mesure = {
      question: {
        question: "quelle décision vise ce document ?",
        type: "conceptuelle",
        attendues: ["CNILTEXT000000001"],
        piege: false,
        split: "test",
      },
      refs: ["CNILTEXT000000001#f18"],
      distances: [0.2],
    };
    const entree = entreeQuestionJson(mesure, { bas: 0.6, haut: 0.7, marge: 0.01 });

    assert.deepEqual(entree.rangs, [1]);
  });

  it("refuse --json avec --split all", () => {
    assert.throws(() => verifierJsonSplit("all", true), /--json refuse --split all/);
    verifierJsonSplit("dev", true);
    verifierJsonSplit("test", true);
    verifierJsonSplit("all", false);
  });

  it("dérive le marqueur du nom du fichier de questions", () => {
    assert.match(
      cheminMarqueur("/tmp/questions-v2.csv"),
      /\/tmp\/questions-v2\.test-consomme\.json$/,
    );
  });

  it("le marqueur v2 commité porte les preuves de la mesure", () => {
    type MarqueurV2 = {
      date: string;
      note: string;
      questions_sha256: string;
      modele: string;
      top5_semantique_brut: number;
      top1_semantique_brut: number;
      mrr_semantique_brut: number;
      top5_global_brut: number;
      top5_rendu: number;
      top1_rendu: number;
      mrr_rendu: number;
      top5_global_rendu: number;
      niveaux: { confiant: number; incertain: number; aucun_resultat_fiable: number };
      pieges_confiants: number;
      seuils: { bas: number; haut: number; marge: number };
      bande_article: number;
      unites_index: number;
      snapshots: Record<string, string>;
      intervalles: {
        top5_global_brut: [number, number];
        top5_semantique_brut: [number, number];
        pieges_cites: [number, number];
      };
    };
    const marqueur = JSON.parse(
      readFileSync(
        new URL("../mcp/eval/questions-v2.test-consomme.json", import.meta.url),
        "utf8",
      ),
    ) as MarqueurV2;
    const sha = createHash("sha256").update(QUESTIONS_V2, "utf8").digest("hex");

    assert.equal(marqueur.questions_sha256, sha);
    assert.match(marqueur.note, /transcrit/);
    assert.equal(marqueur.top5_semantique_brut, 18 / 19);
    assert.equal(marqueur.top1_semantique_brut, 17 / 19);
    assert.equal(marqueur.mrr_semantique_brut, 0.9052631578947368);
    assert.equal(marqueur.top5_global_brut, 24 / 25);
    assert.equal(marqueur.top5_rendu, 17 / 19);
    assert.equal(marqueur.top1_rendu, 16 / 19);
    assert.equal(marqueur.mrr_rendu, 16.2 / 19);
    assert.equal(marqueur.top5_global_rendu, 23 / 25);
    assert.deepEqual(marqueur.niveaux, {
      confiant: 14,
      incertain: 4,
      aucun_resultat_fiable: 1,
    });
    assert.equal(marqueur.pieges_confiants, 0);
    assert.deepEqual(marqueur.seuils, { bas: 0.69, haut: 0.74, marge: 0.01 });
    assert.equal(marqueur.bande_article, 0.02);
    assert.equal(marqueur.unites_index, 565);
    assert.deepEqual(Object.keys(marqueur.snapshots).sort(), ["32016R0679", "32024R1689"]);
    assert.equal(marqueur.intervalles.top5_global_brut.length, 2);
    assert.equal(marqueur.intervalles.top5_semantique_brut.length, 2);
    assert.deepEqual(marqueur.intervalles.top5_global_brut, intervalleWilson(24, 25));
    assert.deepEqual(marqueur.intervalles.top5_semantique_brut, intervalleWilson(18, 19));
    assert.deepEqual(marqueur.intervalles.pieges_cites, intervalleWilson(1, 5));
  });

  it("refuse le test consommé au niveau CLI, même avec --marqueur", () => {
    const run = fileURLToPath(new URL("../mcp/eval/run.ts", import.meta.url));
    const racine = fileURLToPath(new URL("..", import.meta.url));
    const resultat = spawnSync(
      process.execPath,
      [
        run,
        "--questions",
        "questions-v2.csv",
        "--split",
        "test",
        "--mesurer-test",
        "--marqueur",
        join(tmpdir(), "vitrine-jamais-consomme.json"),
      ],
      { cwd: racine, encoding: "utf8", timeout: 30_000 },
    );

    assert.notEqual(resultat.status, 0);
    assert.equal(resultat.stdout, "", "le refus précède toute mesure");
    assert.match(resultat.stderr, /Test déjà consommé le 2026-11-05/);
    assert.match(resultat.stderr, /questions-v2\.test-consomme\.json/);
  });
});

describe("l'intervalle de Wilson", () => {
  it("encadre la proportion observée et reste dans [0, 1]", () => {
    const [bas, haut] = intervalleWilson(20, 25);

    assert.ok(bas < 20 / 25 && 20 / 25 < haut);
    assert.ok(bas >= 0 && haut <= 1);
    assert.deepEqual(intervalleWilson(0, 0), [0, 0]);
  });
});

describe("la résolution du fichier de questions", () => {
  it("trouve le jeu livré dans mcp/eval", () => {
    assert.equal(resoudreQuestions("questions-v2.csv"), new URL("../mcp/eval/questions-v2.csv", import.meta.url).pathname);
  });
});

describe("questions-aiact.csv", () => {
  const questions = lireQuestions(QUESTIONS_AIAct);
  const refs = new Set(
    readFileSync(new URL("../data/corpus/aiact/unites.jsonl", import.meta.url), "utf8")
      .trimEnd()
      .split("\n")
      .map((ligne) => (JSON.parse(ligne) as { ref: string }).ref),
  );

  it("porte douze lignes : sept références, trois conceptuelles, deux pièges", () => {
    assert.equal(questions.length, 12);
    assert.equal(questions.filter((question) => question.type === "reference").length, 7);
    assert.equal(questions.filter((question) => question.type === "conceptuelle").length, 3);
    assert.equal(questions.filter((question) => question.piege).length, 2);
  });

  it("n'attend que des références présentes dans l'AI Act", () => {
    validerReferences(questions, refs);
    assert.ok(questions.flatMap((question) => question.attendues).every((ref) => ref.startsWith("32024R1689#")));
  });

  it("refuse une question RGPD glissée dans le jeu AI Act", () => {
    const melange: Question[] = [
      ...questions,
      {
        question: "Que prévoit l'article 17 du RGPD ?",
        type: "reference",
        attendues: ["32016R0679#art_17"],
        piege: false,
        split: "dev",
      },
    ];

    assert.throws(() => corpusDuJeu(melange), /plusieurs corpus|vise plusieurs corpus/);
  });

  it("ne laisse aucune référence RGPD dans le rapport AI Act", () => {
    const rapport = readFileSync(
      new URL("../aidd_docs/tasks/2026_11/2026_11_05_qualite-v2-aiact/eval-aiact.md", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(rapport, /32016R0679/);
  });
});

describe("questions-cnil.csv", () => {
  const CSV = readFileSync(new URL("../mcp/eval/questions-cnil.csv", import.meta.url), "utf8");
  const jeu = lireJeu(CSV);
  const questions = jeu.questions;
  const unites = (
    JSON.parse(
      `[${readFileSync(
        new URL("../data/corpus/cnil/unites.jsonl", import.meta.url),
        "utf8",
      )
        .trimEnd()
        .split("\n")
        .join(",")}]`,
    ) as { ref: string; document: string }[]
  );
  const refs = new Set(unites.map((unite) => unite.ref));
  const documents = new Set(unites.map((unite) => unite.document));

  it("porte vingt lignes : douze documents, six conceptuelles, deux pièges", () => {
    assert.equal(questions.length, 20);
    assert.equal(questions.filter((question) => question.type === "reference").length, 12);
    assert.equal(questions.filter((question) => question.type === "conceptuelle").length, 6);
    assert.equal(questions.filter((question) => question.piege).length, 2);
  });

  it("vise le corpus cnil sur chaque ligne", () => {
    assert.equal(corpusDuJeu(questions), "cnil");
    assert.ok(questions.every((question) => question.corpus === "cnil"));
    assert.equal(jeu.avecSplit, false);
  });

  it("n'attend que des références présentes, toutes au document", () => {
    validerReferences(questions, refs, documents);

    const documentaires = questions
      .flatMap((question) => question.attendues)
      .filter((ref) => !ref.includes("#"));
    assert.equal(documentaires.length, 18);
    assert.ok(documentaires.every((ref) => documents.has(ref)));
  });

  it("ne donne aucune source attendue à un piège", () => {
    for (const piege of questions.filter((question) => question.piege)) {
      assert.deepEqual(piege.attendues, [], piege.question);
    }
  });

  it("n'emploie de référence d'article singulière que dans le piège déterministe", () => {
    const singulieres = questions.filter((question) => referenceExacte(question.question) !== null);

    assert.deepEqual(
      singulieres.map((question) => question.question),
      ["Quel est le plafond de l'amende prévue à l'article 84 du RGPD ?"],
    );
  });
});

describe("questions-cnil-v2.csv", () => {
  const CSV = readFileSync(new URL("../mcp/eval/questions-cnil-v2.csv", import.meta.url), "utf8");
  const jeu = lireJeu(CSV);
  const questions = jeu.questions;
  const unites = (
    JSON.parse(
      `[${readFileSync(
        new URL("../data/corpus/cnil/unites.jsonl", import.meta.url),
        "utf8",
      )
        .trimEnd()
        .split("\n")
        .join(",")}]`,
    ) as { document: string; numero: string }[]
  );
  const documents = new Set(unites.map((unite) => unite.document));
  const numeros = new Map(unites.map((unite) => [unite.document, unite.numero]));
  const autres = [
    QUESTIONS,
    QUESTIONS_V2,
    QUESTIONS_V3,
    QUESTIONS_AIAct,
    readFileSync(new URL("../mcp/eval/questions-cnil.csv", import.meta.url), "utf8"),
  ].flatMap((csv) => lireQuestions(csv));

  it("porte cinquante questions documentaires réparties en 25 dev et 25 test", () => {
    assert.equal(questions.length, 50);
    assert.equal(questions.filter((question) => question.type === "reference").length, 50);
    assert.equal(questions.filter((question) => question.split === "dev").length, 25);
    assert.equal(questions.filter((question) => question.split === "test").length, 25);
    assert.equal(questions.filter((question) => question.piege).length, 0);
  });

  it("vise le corpus cnil sur chaque ligne et porte un split", () => {
    assert.equal(corpusDuJeu(questions), "cnil");
    assert.ok(questions.every((question) => question.corpus === "cnil"));
    assert.equal(jeu.avecSplit, true);
  });

  it("n'attend que des documents présents, un seul par question", () => {
    validerReferences(questions, new Set(), documents);

    const cibles = questions.flatMap((question) => question.attendues);
    assert.equal(cibles.length, 50);
    assert.ok(cibles.every((ref) => !ref.includes("#") && documents.has(ref)));
    assert.equal(new Set(cibles).size, 50);
  });

  it("ne nomme ni l'identifiant ni le numéro de la décision visée", () => {
    for (const question of questions) {
      const cible = question.attendues[0] ?? "";
      const numero = (numeros.get(cible) ?? "").replace(/[–—]/g, "-");
      assert.ok(!question.question.includes(cible), question.question);
      assert.ok(!question.question.includes(numero), question.question);
      assert.ok(!question.question.replace(/[–—]/g, "-").includes(numero), question.question);
    }
  });

  it("ne contient aucune référence d'article numérotée", () => {
    for (const question of questions) {
      assert.equal(referenceExacte(question.question), null, question.question);
    }
  });

  it("ne réutilise aucune question des autres jeux", () => {
    const connues = new Set(autres.map((question) => question.question));
    for (const question of questions) {
      assert.ok(!connues.has(question.question), question.question);
    }
  });
});

describe("questions-cnil-etendu.csv", () => {
  const CSV = readFileSync(new URL("../mcp/eval/questions-cnil-etendu.csv", import.meta.url), "utf8");
  const jeu = lireJeu(CSV);
  const questions = jeu.questions;
  const lignes = CSV.trimEnd().split(/\r?\n/);
  const unites = (
    JSON.parse(
      `[${readFileSync(
        new URL("../data/corpus/cnil/unites.jsonl", import.meta.url),
        "utf8",
      )
        .trimEnd()
        .split("\n")
        .join(",")}]`,
    ) as { document: string; numero: string; nature: string }[]
  );
  const documents = new Set(unites.map((unite) => unite.document));
  const natures = new Map(unites.map((unite) => [unite.document, unite.nature]));
  const numeros = new Map(unites.map((unite) => [unite.document, unite.numero]));
  const autres = [
    QUESTIONS,
    QUESTIONS_V2,
    QUESTIONS_V3,
    QUESTIONS_AIAct,
    readFileSync(new URL("../mcp/eval/questions-cnil.csv", import.meta.url), "utf8"),
    readFileSync(new URL("../mcp/eval/questions-cnil-v2.csv", import.meta.url), "utf8"),
    readFileSync(new URL("../mcp/eval/questions-cnil-doctrine.csv", import.meta.url), "utf8"),
  ].flatMap((csv) => lireQuestions(csv));
  const natureDe = (question: Question) => natures.get(question.attendues[0] ?? "");

  it("garde l'en-tête à six colonnes", () => {
    assert.equal(lignes[0], "question,type,sources_attendues,piege,split,corpus");
    assert.equal(jeu.avecSplit, true);
    for (const ligne of lignes.slice(1)) {
      assert.equal(ligne.split(",").length, 6, ligne);
    }
  });

  it("vise le corpus cnil sur chaque ligne et porte un split", () => {
    assert.equal(corpusDuJeu(questions), "cnil");
    assert.ok(questions.every((question) => question.corpus === "cnil"));
    assert.ok(questions.every((question) => question.split === "dev" || question.split === "test"));
  });

  it("n'attend que des documents présents, un seul par question et tous distincts", () => {
    validerReferences(questions, new Set(), documents);

    const cibles = questions.flatMap((question) => question.attendues);
    assert.equal(cibles.length, 108);
    assert.ok(cibles.every((ref) => !ref.includes("#") && documents.has(ref)));
    assert.equal(new Set(cibles).size, 108);
  });

  it("ne donne aucune source attendue à un piège", () => {
    const pieges = questions.filter((question) => question.piege);

    assert.equal(pieges.length, 12);
    for (const piege of pieges) {
      assert.deepEqual(piege.attendues, [], piege.question);
    }
  });

  it("ne nomme ni l'identifiant ni le numéro de la décision visée", () => {
    for (const question of questions) {
      const cible = question.attendues[0] ?? "";
      if (cible === "") continue;
      const numero = (numeros.get(cible) ?? "").replace(/[–—]/g, "-");
      assert.ok(!question.question.includes(cible), question.question);
      assert.ok(
        !question.question.replace(/[–—]/g, "-").includes(numero),
        `${question.question} nomme ${numero}`,
      );
    }
  });

  it("ne contient aucune référence d'article numérotée", () => {
    for (const question of questions) {
      assert.equal(referenceExacte(question.question), null, question.question);
    }
  });

  it("ne réutilise aucune question des autres jeux", () => {
    const connues = new Set(autres.map((question) => question.question));
    for (const question of questions) {
      assert.ok(!connues.has(question.question), question.question);
    }
  });

  it("compte au moins 27 avis ou recommandations et 27 sanctions parmi les documents visés", () => {
    const doctrinaires = questions.filter(
      (question) =>
        natureDe(question) === "Avis" ||
        natureDe(question) === "Recommandation/Lignes directrices",
    );
    const sanctions = questions.filter((question) => natureDe(question) === "Sanction");

    assert.equal(doctrinaires.length, 54);
    assert.equal(sanctions.length, 54);
  });

  it("porte cent vingt questions : 27 doctrine, 27 sanctions et 6 pièges par split", () => {
    assert.equal(questions.length, 120);
    for (const split of ["dev", "test"] as const) {
      const duSplit = filtrerSplit(questions, split);

      assert.equal(duSplit.length, 60, split);
      assert.equal(duSplit.filter((question) => question.piege).length, 6, split);
      assert.equal(
        duSplit.filter(
          (question) =>
            !question.piege &&
            (natureDe(question) === "Avis" ||
              natureDe(question) === "Recommandation/Lignes directrices"),
        ).length,
        27,
        split,
      );
      assert.equal(
        duSplit.filter((question) => !question.piege && natureDe(question) === "Sanction").length,
        27,
        split,
      );
    }
  });

  it("mixe les avis et les recommandations à l'identique dans les deux splits", () => {
    const attendu = {
      dev: { avis: 20, recommandations: 7 },
      test: { avis: 21, recommandations: 6 },
    } as const;

    for (const split of ["dev", "test"] as const) {
      const duSplit = filtrerSplit(questions, split).filter((question) => !question.piege);
      const compter = (nature: string) =>
        duSplit.filter((question) => natureDe(question) === nature).length;

      assert.equal(compter("Avis"), attendu[split].avis, split);
      assert.equal(
        compter("Recommandation/Lignes directrices"),
        attendu[split].recommandations,
        split,
      );
      assert.equal(compter("Sanction"), 27, split);
    }
    assert.equal(questions.filter((question) => natureDe(question) === "Avis").length, 41, "Avis");
    assert.equal(
      questions.filter((question) => natureDe(question) === "Recommandation/Lignes directrices")
        .length,
      13,
      "Recommandation",
    );
  });
});
