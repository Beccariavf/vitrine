import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { aligner, analyser, decider, formater, pValueMcNemar } from "../mcp/eval/compare.ts";
import { resume } from "../mcp/eval/run.ts";
import type { ObjetMesureJson } from "../mcp/eval/run.ts";

const REF = "32016R0679#art_17";
const AUTRE = "32016R0679#art_5";
const SEUILS = { bas: 0.6, haut: 0.7, marge: 0.01 };

type Resultat = {
  question: string;
  top1: boolean;
  top5?: boolean;
  niveau?: "confiant" | "incertain" | "aucun_resultat_fiable";
};

function mesure(modele: string, resultats: Resultat[]): ObjetMesureJson {
  return {
    date: "2026-11-05",
    modele,
    dimensions: 1024,
    split: "test",
    corpus: "rgpd",
    recherche: "dense",
    seuils: SEUILS,
    questions: resultats.map((resultat) => {
      const top5 = resultat.top5 ?? resultat.top1;
      const refs = top5 ? (resultat.top1 ? [REF, AUTRE] : [AUTRE, REF]) : [AUTRE];
      return {
        question: resultat.question,
        type: "conceptuelle",
        piege: false,
        attendues: [REF],
        refs,
        rangs: [top5 ? (resultat.top1 ? 1 : 2) : 0],
        similarites: refs.map(() => 0.5),
        niveau: resultat.niveau ?? "confiant",
      };
    }),
    agregats: resume([], SEUILS),
  };
}

/** `gagnant` : questions réussies par le candidat seul ; `perdant` : par la base seule. */
function paireDiscordante(gagnant: number, perdant: number, communes = 0) {
  const resultatsBase: Resultat[] = [];
  const resultatsCandidat: Resultat[] = [];
  for (let index = 0; index < gagnant + perdant + communes; index += 1) {
    const texte = `question ${index + 1}`;
    const candidatSeul = index < gagnant;
    const baseSeul = index >= gagnant && index < gagnant + perdant;
    resultatsBase.push({ question: texte, top1: baseSeul || index >= gagnant + perdant });
    resultatsCandidat.push({
      question: texte,
      top1: candidatSeul || index >= gagnant + perdant,
    });
  }
  return {
    base: mesure("qwen3-embedding:0.6b", resultatsBase),
    candidat: mesure("qwen3-embedding:4b", resultatsCandidat),
  };
}

describe("le test exact de McNemar", () => {
  it("rend les valeurs calculées à la main", () => {
    assert.equal(pValueMcNemar(5, 1), 14 / 64);
    assert.ok(Math.abs(pValueMcNemar(9, 1) - 0.021484375) < 1e-12);
    assert.equal(pValueMcNemar(2, 1), 1);
    assert.equal(pValueMcNemar(1, 1), 1);
    assert.equal(pValueMcNemar(0, 0), 1);
    assert.equal(pValueMcNemar(0, 3), 0.25);
  });

  it("plafonne la p-value à 1", () => {
    assert.equal(pValueMcNemar(1, 1), 1);
    assert.equal(pValueMcNemar(0, 1), 1);
  });
});

describe("la comparaison appariée", () => {
  it("aligne deux jeux de six questions", () => {
    const { base, candidat } = paireDiscordante(5, 1);
    const paires = aligner(base, candidat);

    assert.equal(paires.length, 6);
    assert.deepEqual(
      paires.map((paire) => paire.question),
      ["question 1", "question 2", "question 3", "question 4", "question 5", "question 6"],
    );
  });

  it("compte 5 contre 1 sans conclure : p = 0,219", () => {
    const { base, candidat } = paireDiscordante(5, 1);
    const decision = analyser(base, candidat);

    assert.equal(decision.b, 5);
    assert.equal(decision.c, 1);
    assert.equal(decision.p, 14 / 64);
    assert.equal(decision.verdict, "non_etabli");
    assert.match(decision.raisons.join(" "), /p = 0\.2188 ≥ 0,05/);
  });

  it("adopte le candidat sur 9 contre 1 : p ≈ 0,021", () => {
    const { base, candidat } = paireDiscordante(9, 1);
    const decision = analyser(base, candidat);

    assert.equal(decision.b, 9);
    assert.equal(decision.c, 1);
    assert.ok(Math.abs(decision.p - 0.021484375) < 1e-12);
    assert.equal(decision.verdict, "adopter");
  });

  it("ne conclut pas sur 2 contre 1 ni sur 1 contre 1", () => {
    const cas: [number, number][] = [
      [2, 1],
      [1, 1],
    ];
    for (const [gagnant, perdant] of cas) {
      const { base, candidat } = paireDiscordante(gagnant, perdant);
      const decision = analyser(base, candidat);

      assert.equal(decision.p, 1);
      assert.equal(decision.verdict, "non_etabli", `${gagnant}/${perdant}`);
    }
  });

  it("dit « aucun désaccord » quand b + c = 0", () => {
    const { base, candidat } = paireDiscordante(0, 0, 6);
    const decision = analyser(base, candidat);

    assert.equal(decision.b, 0);
    assert.equal(decision.c, 0);
    assert.equal(decision.p, 1);
    assert.equal(decision.verdict, "non_etabli");
    assert.match(decision.raisons.join(" "), /aucun désaccord/);
  });

  it("distingue le succès au top 5 du succès au rang 1, brut et rendu", () => {
    const base = mesure("qwen3-embedding:0.6b", [
      { question: "q1", top1: false, top5: true },
      { question: "q2", top1: true, top5: true },
    ]);
    const candidat = mesure("qwen3-embedding:4b", [
      { question: "q1", top1: true, top5: true },
      { question: "q2", top1: false, top5: true },
    ]);
    const decision = analyser(base, candidat);

    assert.equal(decision.baseTop5Brut, 2);
    assert.equal(decision.candidatTop5Brut, 2);
    assert.equal(decision.baseTop1Brut, 1);
    assert.equal(decision.candidatTop1Brut, 1);
    assert.equal(decision.baseTop5Rendu, 2);
    assert.equal(decision.candidatTop5Rendu, 2);
    assert.equal(decision.baseTop1Rendu, 1);
    assert.equal(decision.candidatTop1Rendu, 1);
    assert.equal(decision.b, 1);
    assert.equal(decision.c, 1);
  });

  it("compte une question refusée dans le brut, jamais dans le rendu", () => {
    const base = mesure("qwen3-embedding:0.6b", [
      { question: "q1", top1: true, niveau: "aucun_resultat_fiable" },
      { question: "q2", top1: true },
    ]);
    const candidat = mesure("qwen3-embedding:4b", [
      { question: "q1", top1: false, top5: false },
      { question: "q2", top1: true },
    ]);
    const decision = analyser(base, candidat);

    // Brut : la référence classée reste comptée malgré le refus.
    assert.equal(decision.baseTop5Brut, 2);
    assert.equal(decision.baseTop1Brut, 2);
    // Rendu : le refus ne rend aucun passage, donc le succès disparaît.
    assert.equal(decision.baseTop5Rendu, 1);
    assert.equal(decision.baseTop1Rendu, 1);
    assert.equal(decision.candidatTop5Rendu, 1);
    assert.equal(decision.candidatTop1Rendu, 1);
    // La décision suit le rendu : plus aucune paire discordante.
    assert.equal(decision.b, 0);
    assert.equal(decision.c, 0);
    assert.equal(decision.verdict, "non_etabli");
    assert.match(decision.raisons.join(" "), /aucun désaccord/);
  });

  it("refuse deux jeux qui ne portent pas les mêmes questions", () => {
    const base = mesure("qwen3-embedding:0.6b", [
      { question: "question A", top1: true },
      { question: "question B", top1: true },
    ]);
    const candidat = mesure("qwen3-embedding:4b", [{ question: "question A", top1: true }]);

    assert.throws(() => aligner(base, candidat), /Question absente.*question B/);
  });

  it("refuse un décalage d'ordre en nommant les deux questions", () => {
    const base = mesure("qwen3-embedding:0.6b", [
      { question: "question A", top1: true },
      { question: "question B", top1: true },
    ]);
    const candidat = mesure("qwen3-embedding:4b", [
      { question: "question B", top1: true },
      { question: "question A", top1: true },
    ]);

    assert.throws(() => aligner(base, candidat), /Questions non appariées.*question A.*question B/);
  });
});

describe("la règle de décision", () => {
  it("applique le plancher de six paires discordantes", () => {
    const decision = decider({
      b: 5,
      c: 0,
      p: 0.001,
      baseTop5Rendu: 10,
      candidatTop5Rendu: 10,
    });

    assert.equal(decision.verdict, "non_etabli");
    assert.match(decision.raisons.join(" "), /moins de six paires discordantes \(5\)/);
  });

  it("refuse un gain qui dégrade le top 5 de plus d'une question", () => {
    const decision = decider({
      b: 9,
      c: 1,
      p: 0.02,
      baseTop5Rendu: 20,
      candidatTop5Rendu: 18,
    });

    assert.equal(decision.verdict, "conserver");
    assert.match(decision.raisons.join(" "), /top 5 rendu dégradé de 2 questions/);
  });

  it("conserve la référence quand le candidat ne gagne pas plus qu'il ne perd", () => {
    const decision = decider({
      b: 2,
      c: 5,
      p: 0.45,
      baseTop5Rendu: 20,
      candidatTop5Rendu: 20,
    });

    assert.equal(decision.verdict, "conserver");
  });

  it("n'adopte pas sur une p-value non significative", () => {
    const decision = decider({
      b: 6,
      c: 1,
      p: 0.06,
      baseTop5Rendu: 20,
      candidatTop5Rendu: 20,
    });

    assert.equal(decision.verdict, "non_etabli");
    assert.match(decision.raisons.join(" "), /p = 0\.0600 ≥ 0,05/);
  });
});

describe("la commande compare.ts", () => {
  it("rend le même rapport à chaque exécution", () => {
    const dossier = mkdtempSync(join(tmpdir(), "vitrine-compare-"));
    try {
      const { base, candidat } = paireDiscordante(9, 1);
      const cheminBase = join(dossier, "base.json");
      const cheminCandidat = join(dossier, "candidat.json");
      writeFileSync(cheminBase, JSON.stringify(base));
      writeFileSync(cheminCandidat, JSON.stringify(candidat));
      const script = fileURLToPath(new URL("../mcp/eval/compare.ts", import.meta.url));
      const lancer = () =>
        spawnSync(process.execPath, [script, cheminBase, cheminCandidat], {
          encoding: "utf8",
          timeout: 30_000,
        });

      const premier = lancer();
      const second = lancer();

      assert.equal(premier.status, 0);
      assert.equal(premier.stderr, "");
      assert.match(premier.stdout, /b = 9 .*c = 1/);
      assert.match(premier.stdout, /top 5 brut/);
      assert.match(premier.stdout, /top 5 rendu/);
      assert.match(premier.stdout, /McNemar exact : p = 0\.021484375/);
      assert.match(premier.stdout, /verdict \(rendu\) : adopter/);
      assert.equal(second.stdout, premier.stdout);

      const texte = formater(base, candidat, analyser(base, candidat));
      assert.match(texte, /questions alignées : 10/);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
