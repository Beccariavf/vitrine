import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { intervalleWilson } from "../mcp/eval/run.ts";
import type { EntreeQuestionJson, ObjetMesureJson, TypeQuestion } from "../mcp/eval/run.ts";
import {
  BAS_MAX,
  BAS_MIN,
  HAUT_MAX,
  HAUT_MIN,
  MARGES,
  courbeRefus,
  grilleRisque,
  ligneSeuils,
  mesurerRisque,
  questionsSemantiques,
} from "../mcp/eval/risque.ts";

const PRODUIT = { bas: 0.69, haut: 0.74, marge: 0.01 };

function entree(options: {
  question: string;
  attendues?: string[];
  refs?: string[];
  similarites: number[];
  piege?: boolean;
  type?: TypeQuestion;
}): EntreeQuestionJson {
  const attendues = options.attendues ?? [];
  return {
    question: options.question,
    type: options.type ?? "conceptuelle",
    piege: options.piege ?? false,
    attendues,
    refs: options.refs ?? [],
    rangs: attendues.map(() => 0),
    similarites: options.similarites,
    niveau: "incertain",
  };
}

/** Quatre questions sémantiques : deux confiantes, dont une fausse. */
function jeuSimple(): EntreeQuestionJson[] {
  return [
    entree({
      question: "quelles garanties pour un traitement de santé ?",
      attendues: ["CNILTEXT000000001"],
      refs: ["CNILTEXT000000001#f1", "CNILTEXT000000002#f3"],
      similarites: [0.9, 0.7],
    }),
    entree({
      question: "quelles règles pour un dispositif de vidéosurveillance ?",
      attendues: ["CNILTEXT000000003"],
      refs: ["CNILTEXT000000004#f2", "CNILTEXT000000006#f1"],
      similarites: [0.88, 0.6],
    }),
    entree({
      question: "comment sécuriser un mot de passe ?",
      attendues: ["CNILTEXT000000005"],
      refs: ["CNILTEXT000000005#f1", "CNILTEXT000000006#f1"],
      similarites: [0.8, 0.795],
    }),
    entree({
      question: "que recommande la CNIL sur les cookies ?",
      attendues: ["CNILTEXT000000007"],
      refs: ["CNILTEXT000000007#f1"],
      similarites: [0.7],
    }),
  ];
}

describe("la couverture de l'étiquette", () => {
  it("compte les seules réponses confiantes sur les questions sémantiques", () => {
    const mesure = mesurerRisque(jeuSimple(), PRODUIT);

    assert.equal(mesure.semantiques, 4);
    assert.equal(mesure.confiantes, 2);
    assert.equal(mesure.couverture, 0.5);
  });

  it("ne compte pas une question sous le seuil haut, même sans second passage", () => {
    const mesure = mesurerRisque(jeuSimple(), PRODUIT);

    assert.equal(mesure.confiantes, 2, "les deux questions sous 0,74 restent incertaines");
  });
});

describe("le risque de l'étiquette", () => {
  it("rapporte les erreurs aux seules confiantes, pas à la taille du jeu", () => {
    const mesure = mesurerRisque(jeuSimple(), PRODUIT);

    assert.equal(mesure.erreurs, 1, "une confiante n'a pas sa référence au top 5");
    assert.equal(mesure.risque, 0.5);
  });

  it("satisfait un document entier pour la CNIL et un article exact pour le RGPD", () => {
    const doc = entree({
      question: "que dit la CNIL sur l'open data ?",
      attendues: ["CNILTEXT000000001"],
      refs: ["CNILTEXT000000001#f9", "CNILTEXT000000002#f1"],
      similarites: [0.9, 0.7],
    });
    const article = entree({
      question: "quelles conditions pour le consentement ?",
      attendues: ["32016R0679#art_7"],
      refs: ["32016R0679#art_7", "32016R0679#art_8"],
      similarites: [0.9, 0.7],
    });
    const faux = entree({
      question: "quel est le rôle du délégué ?",
      attendues: ["32016R0679#art_37"],
      refs: ["32016R0679#art_38"],
      similarites: [0.9, 0.7],
    });

    const mesure = mesurerRisque([doc, article, faux], PRODUIT);

    assert.equal(mesure.confiantes, 3);
    assert.equal(mesure.erreurs, 1, "art_38 ne satisfait pas art_37");
  });

  it("calcule la borne de Wilson sur les confiantes, jamais sur le jeu", () => {
    const entrees = [
      ...Array.from({ length: 5 }, (_, index) =>
        entree({
          question: `juste ${index}`,
          attendues: ["CNILTEXT000000001"],
          refs: ["CNILTEXT000000001#f1"],
          similarites: [0.9, 0.7],
        }),
      ),
      ...[0, 1].map((index) =>
        entree({
          question: `fausse ${index}`,
          attendues: ["CNILTEXT000000002"],
          refs: ["CNILTEXT000000003#f1"],
          similarites: [0.9, 0.7],
        }),
      ),
      ...[0, 1, 2, 3].map((index) =>
        entree({
          question: `incertaine ${index}`,
          attendues: ["CNILTEXT000000004"],
          refs: ["CNILTEXT000000004#f1"],
          similarites: [0.7],
        }),
      ),
    ];

    const mesure = mesurerRisque(entrees, PRODUIT);

    assert.equal(mesure.semantiques, 11);
    assert.equal(mesure.confiantes, 7);
    assert.equal(mesure.erreurs, 2);
    assert.equal(mesure.risque, 2 / 7);
    assert.deepEqual(mesure.borneHaute, intervalleWilson(2, 7)[1]);
    assert.notDeepEqual(mesure.borneHaute, intervalleWilson(2, 11)[1]);
  });
});

describe("les questions écartées", () => {
  it("écarte les pièges du dénominateur et du risque", () => {
    const piege = entree({
      question: "quel est le délai de prescription pour un licenciement ?",
      similarites: [0.99, 0.7],
      refs: ["CNILTEXT000000009#f1"],
      piege: true,
      type: "piege",
    });

    const mesure = mesurerRisque([...jeuSimple(), piege], PRODUIT);

    assert.equal(mesure.semantiques, 4);
    assert.equal(mesure.confiantes, 2);
    assert.equal(mesure.erreurs, 1, "un piège confiant n'est pas une erreur de la promesse");
  });

  it("écarte une référence exacte d'article, servie sans vecteurs", () => {
    const exacte = entree({
      question: "Que prévoit l'article 5 du RGPD ?",
      attendues: ["32016R0679#art_5"],
      refs: ["32016R0679#art_5"],
      similarites: [0.99, 0.7],
      type: "reference",
    });

    const mesure = mesurerRisque([...jeuSimple(), exacte], PRODUIT);

    assert.equal(mesure.semantiques, 4);
    assert.equal(questionsSemantiques([exacte]).length, 0);
  });
});

describe("l'effet de la marge", () => {
  it("retire l'étiquette quand le second passage se rapproche", () => {
    const proche = [
      entree({
        question: "premier passage proche du second",
        attendues: ["CNILTEXT000000001"],
        refs: ["CNILTEXT000000001#f1", "CNILTEXT000000002#f1"],
        similarites: [0.8, 0.785],
      }),
      entree({
        question: "second passage distinct",
        attendues: ["CNILTEXT000000003"],
        refs: ["CNILTEXT000000003#f1", "CNILTEXT000000004#f1"],
        similarites: [0.8, 0.7],
      }),
    ];

    const lignes = grilleRisque(proche).filter((ligne) => ligne.haut === PRODUIT.haut);
    const parMarge = new Map(lignes.map((ligne) => [ligne.marge, ligne.confiantes]));

    assert.deepEqual(
      MARGES.map((marge) => parMarge.get(marge)),
      [2, 1, 1],
      "un écart de 0,015 ne passe que la marge de 0,01",
    );
  });
});

describe("la grille", () => {
  it("parcourt 0,30 à 0,95 par pas de 0,01 et les trois marges", () => {
    const lignes = grilleRisque(jeuSimple());
    const hauts = [...new Set(lignes.map((ligne) => ligne.haut))];

    assert.equal(lignes.length, 66 * 3);
    assert.equal(hauts.length, 66);
    assert.equal(hauts[0], HAUT_MIN);
    assert.equal(hauts.at(-1), HAUT_MAX);
    assert.deepEqual([...new Set(lignes.map((ligne) => ligne.marge))], [...MARGES]);
    assert.deepEqual(
      lignes.slice(0, 3).map((ligne) => [ligne.bas, ligne.haut, ligne.marge]),
      [
        [0, 0.3, 0.01],
        [0, 0.3, 0.02],
        [0, 0.3, 0.05],
      ],
    );
  });

  it("rend la même grille deux fois", () => {
    assert.deepEqual(grilleRisque(jeuSimple()), grilleRisque(jeuSimple()));
  });

  it("ne fait jamais remonter la couverture quand le seuil haut monte", () => {
    const lignes = grilleRisque(jeuSimple()).filter((ligne) => ligne.marge === 0.01);

    for (let index = 1; index < lignes.length; index += 1) {
      const precedente = lignes[index - 1];
      const courante = lignes[index];
      assert.ok(precedente !== undefined && courante !== undefined);
      assert.ok(courante.couverture <= precedente.couverture, `haut ${courante.haut}`);
    }
  });
});

describe("le cas sans question confiante", () => {
  it("déclare la couverture nulle et le risque non mesuré, sans lever", () => {
    const mesure = mesurerRisque(jeuSimple(), { bas: 0.69, haut: 0.99, marge: 0.01 });

    assert.equal(mesure.semantiques, 4);
    assert.equal(mesure.confiantes, 0);
    assert.equal(mesure.couverture, 0);
    assert.equal(mesure.risque, null);
    assert.equal(mesure.borneHaute, null);
  });

  it("affiche une seule ligne pour un triplet, risque non mesuré compris", () => {
    const sortie = ligneSeuils(jeuSimple(), { bas: 0.69, haut: 0.99, marge: 0.01 });

    assert.equal(sortie.split("\n").length, 1);
    assert.match(sortie, /^0\.690 {2}0\.990 {2}0\.010/);
    assert.match(sortie, /non mesuré/);
  });
});

describe("la courbe du plancher", () => {
  it("compte les refus et le coût des refus qui étaient justes", () => {
    const entrees = [
      entree({
        question: "sous le plancher, juste au top 5",
        attendues: ["CNILTEXT000000001"],
        refs: ["CNILTEXT000000001#f1", "CNILTEXT000000002#f1"],
        similarites: [0.5, 0.4],
      }),
      entree({
        question: "sous le plancher, faux au top 5",
        attendues: ["CNILTEXT000000003"],
        refs: ["CNILTEXT000000004#f1"],
        similarites: [0.6],
      }),
      entree({
        question: "au-dessus du plancher",
        attendues: ["CNILTEXT000000005"],
        refs: ["CNILTEXT000000005#f1"],
        similarites: [0.9, 0.7],
      }),
    ];

    const courbe = courbeRefus(entrees, [0.4, 0.55, 0.69]);

    assert.deepEqual(courbe, [
      { bas: 0.4, refusees: 0, justesRefusees: 0 },
      { bas: 0.55, refusees: 1, justesRefusees: 1 },
      { bas: 0.69, refusees: 2, justesRefusees: 1 },
    ]);
  });

  it("parcourt 0,20 à 0,95 et ne refuse que sous le premier passage", () => {
    const courbe = courbeRefus(jeuSimple());

    assert.equal(courbe.length, Math.round((BAS_MAX - BAS_MIN) * 100) + 1);
    assert.equal(courbe[0]?.bas, BAS_MIN);
    assert.equal(courbe.at(-1)?.bas, BAS_MAX);
    assert.ok(
      courbe.filter((ligne) => ligne.bas <= 0.7).every((ligne) => ligne.refusees === 0),
      "aucune question n'a un premier passage sous 0,70 ici",
    );
    assert.deepEqual(courbe.find((ligne) => ligne.bas === 0.71), {
      bas: 0.71,
      refusees: 1,
      justesRefusees: 1,
    });
    for (let index = 1; index < courbe.length; index += 1) {
      const precedente = courbe[index - 1];
      const courante = courbe[index];
      assert.ok(precedente !== undefined && courante !== undefined);
      assert.ok(courante.refusees >= precedente.refusees, `bas ${courante.bas}`);
    }
  });
});

describe("la ligne de commande", () => {
  it("lit un --json et imprime une seule ligne pour --seuils", () => {
    const dossier = mkdtempSync(join(tmpdir(), "vitrine-risque-"));
    try {
      const objet: ObjetMesureJson = {
        date: "2026-11-10",
        modele: "modele-de-test",
        dimensions: 3,
        split: "dev",
        corpus: "cnil",
        recherche: "dense",
        index: { chemin: "index.db", unites: 1 },
        seuils: PRODUIT,
        seuils_origine: "table (cnil)",
        questions: jeuSimple(),
        agregats: {
          semantiques: 4,
          top5_semantique_succes: 3,
          top1_semantique_succes: 1,
          mrr_semantique: 0.5,
          referencees: 4,
          top5_global_succes: 3,
          top5_rendu_succes: 3,
          top1_rendu_succes: 1,
          mrr_rendu: 0.5,
          top5_global_rendu_succes: 3,
          pieges_mesures: 0,
          pieges_cites: 0,
          confiant: 2,
          incertain: 2,
          aucun_resultat_fiable: 0,
          pieges_confiants: 0,
        },
      };
      const chemin = join(dossier, "mesure.json");
      writeFileSync(chemin, JSON.stringify(objet));

      const resultat = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL("../mcp/eval/risque.ts", import.meta.url)),
          chemin,
          "--seuils",
          "0.69,0.74,0.01",
        ],
        { encoding: "utf8", timeout: 30_000 },
      );

      assert.equal(resultat.status, 0, resultat.stderr);
      const lignes = resultat.stdout.trimEnd().split("\n");
      assert.equal(lignes.filter((ligne) => ligne.startsWith("0.690")).length, 1);
      assert.match(resultat.stdout, /confiantes/);
      assert.match(resultat.stdout, /50\.0 %/, "couverture 2 sur 4");
      assert.match(resultat.stdout, /50\.0 %/, "risque 1 sur 2");
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
