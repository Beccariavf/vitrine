import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  calibrer,
  cheminMarqueur,
  documentDuJeu,
  ecrireMarqueurTest,
  filtrerSplit,
  intervalleWilson,
  lireJeu,
  lireQuestions,
  mrr,
  precisionAt1,
  recallAt5,
  repartirPlis,
  resoudreQuestions,
  resume,
  tauxCitationsInvalides,
  validerCroise,
  validerReferences,
  verifierAutorisationTest,
  verifierTestNonConsomme,
} from "../mcp/eval/run.ts";
import type { Marqueur, Mesure, Question, Split } from "../mcp/eval/run.ts";

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

  it("ne mélange pas deux documents", () => {
    assert.equal(documentDuJeu(questions), "32016R0679");
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

describe("le document du jeu", () => {
  it("déduit le document du préfixe des références attendues", () => {
    const questions = lireQuestions(QUESTIONS_V2);
    assert.equal(documentDuJeu(questions), "32016R0679");
  });

  it("refuse un jeu qui mélange deux documents", () => {
    const questions: Question[] = [
      {
        question: "une question RGPD",
        type: "conceptuelle",
        attendues: ["32016R0679#art_17"],
        piege: false,
        split: "dev",
      },
      {
        question: "une question AI Act",
        type: "conceptuelle",
        attendues: ["32024R1689#art_6"],
        piege: false,
        split: "dev",
      },
    ];

    assert.throws(() => documentDuJeu(questions), /plusieurs documents.*32016R0679.*32024R1689/);
  });

  it("refuse un jeu sans référence qui ne dit pas son document", () => {
    const questions: Question[] = [
      { question: "piège seul", type: "piege", attendues: [], piege: true, split: "dev" },
    ];

    assert.throws(() => documentDuJeu(questions), /impossible de déduire le document/);
  });

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

  it("refuse une seconde mesure quand le marqueur existe", () => {
    const dossier = mkdtempSync(join(tmpdir(), "vitrine-eval-"));
    try {
      const marqueurPath = join(dossier, "questions-v2.test-consomme.json");
      const marqueur: Marqueur = {
        date: "2026-11-05",
        note: "marqueur de test",
        questions_sha256: "abc",
        modele: "qwen3-embedding:0.6b",
        dimensions: 1024,
        recherche: "hybride",
        split: "test",
        top5_semantique_brut: 0.9,
        semantiques: 19,
        top1_semantique_brut: 0.8,
        mrr_semantique_brut: 0.85,
        top5_global_brut: 0.9,
        top5_rendu: 0.85,
        top1_rendu: 0.75,
        mrr_rendu: 0.8,
        top5_global_rendu: 0.88,
        referencees: 25,
        pieges_cites: 0,
        pieges_mesures: 4,
        niveaux: { confiant: 14, incertain: 2, aucun_resultat_fiable: 1 },
        pieges_confiants: 0,
        seuils: { bas: 0.69, haut: 0.74, marge: 0.01 },
        bande_article: 0.02,
        intervalles: {
          top5_global_brut: [0.8, 0.99],
          top5_semantique_brut: [0.75, 0.99],
          pieges_cites: [0.03, 0.62],
        },
        snapshots: { "32016R0679": "rgpd.xhtml", "32024R1689": "aiact.xhtml" },
        unites_index: 565,
      };

      verifierTestNonConsomme(marqueurPath);
      ecrireMarqueurTest(marqueurPath, marqueur, "note fournie par l'appelant");
      const ecrit = JSON.parse(readFileSync(marqueurPath, "utf8")) as Marqueur;
      assert.equal(ecrit.note, "note fournie par l'appelant");
      assert.ok(existsSync(marqueurPath));
      assert.throws(() => verifierTestNonConsomme(marqueurPath), /Test déjà consommé le 2026-11-05/);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("dérive le marqueur du nom du fichier de questions", () => {
    assert.match(
      cheminMarqueur("/tmp/questions-v2.csv"),
      /\/tmp\/questions-v2\.test-consomme\.json$/,
    );
  });

  it("le marqueur commité porte les preuves de la mesure", () => {
    const marqueur = JSON.parse(
      readFileSync(
        new URL("../mcp/eval/questions-v2.test-consomme.json", import.meta.url),
        "utf8",
      ),
    ) as Marqueur;
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

  it("chercherait chaque question dans le document 32024R1689", () => {
    assert.equal(documentDuJeu(questions), "32024R1689");
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

    assert.throws(() => documentDuJeu(melange), /plusieurs documents/);
  });

  it("ne laisse aucune référence RGPD dans le rapport AI Act", () => {
    const rapport = readFileSync(
      new URL("../aidd_docs/tasks/2026_11/2026_11_05_qualite-v2-aiact/eval-aiact.md", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(rapport, /32016R0679/);
  });
});
