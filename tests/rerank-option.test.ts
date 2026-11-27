import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CANDIDATS_RERANK,
  CANDIDATS_RERANK_MAX,
  CANDIDATS_RERANK_MIN,
  LOT_RERANK,
  TRONCATURE_RERANK,
  createLlamaReranker,
} from "../mcp/rerank/reranker.ts";
import type { Reranker } from "../mcp/rerank/reranker.ts";
import type { FetchLike, FetchResponse } from "../veille/fetch.ts";
import {
  MODELE_RERANK_PAR_DEFAUT,
  VARIABLE_RERANK_URL,
  avecSignalementPanne,
  lireCandidatsRerank,
  lireConfigRerank,
} from "../mcp/server.ts";
import { lireCandidatsOption, mediane } from "../mcp/eval/run.ts";

const RACINE = fileURLToPath(new URL("..", import.meta.url));

/** Réponse HTTP minimale, de la forme que `createLlamaReranker` attend. */
function reponse(corps: unknown, statut = 200): FetchResponse {
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    text: async () => JSON.stringify(corps),
  };
}

/** Résultats d'un lot, rendus dans l'ordre inverse : l'index seul fait foi. */
function resultats(taille: number, decalage: number): { results: unknown[] } {
  return {
    results: Array.from({ length: taille }, (_, index) => ({
      index: taille - 1 - index,
      relevance_score: decalage + (taille - 1 - index),
    })),
  };
}

describe("le découpage des passages du reranker", () => {
  it("tronque chaque passage et envoie des lots successifs recollés dans l'ordre", async () => {
    const appels: Array<{ documents: string[]; signal: AbortSignal | undefined }> = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      const documents = (JSON.parse(init?.body ?? "{}") as { documents: string[] }).documents;
      appels.push({ documents, signal: init?.signal });
      return reponse(resultats(documents.length, appels.length * 100));
    };
    const reranker = createLlamaReranker({
      url: "http://127.0.0.1:8080/",
      model: "factice",
      fetchImpl,
    });

    const passages = Array.from({ length: 60 }, (_, index) =>
      `${index}`.padEnd(TRONCATURE_RERANK + 50, "x"),
    );
    const scores = await reranker.score("question", passages);

    assert.equal(appels.length, 3, "60 passages partent en trois lots de 25");
    assert.deepEqual(
      appels.map((appel) => appel.documents.length),
      [LOT_RERANK, LOT_RERANK, 10],
    );
    for (const appel of appels) {
      for (const document of appel.documents) {
        assert.equal(document.length, TRONCATURE_RERANK);
      }
      assert.ok(appel.signal instanceof AbortSignal, "chaque lot porte un délai maximal");
    }
    assert.deepEqual(
      scores,
      Array.from({ length: 60 }, (_, index) => {
        const lot = Math.floor(index / LOT_RERANK);
        return (lot + 1) * 100 + (index % LOT_RERANK);
      }),
      "les scores des lots se recollent dans l'ordre d'entrée",
    );
  });

  it("nomme un délai dépassé", async () => {
    const reranker = createLlamaReranker({
      url: "http://127.0.0.1:8080",
      model: "factice",
      fetchImpl: async () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      },
    });

    await assert.rejects(() => reranker.score("question", ["passage"]), /injoignable.*timeout/);
  });
});

describe("la configuration du reranker lue dans l'environnement", () => {
  it("reste absente sans VITRINE_RERANK_URL", () => {
    assert.equal(lireConfigRerank({}, "dense"), undefined);
    assert.equal(lireConfigRerank({}, "lexicale"), undefined);
  });

  it("active bge par défaut, sur 50 candidats", () => {
    const config = lireConfigRerank({ [VARIABLE_RERANK_URL]: "http://127.0.0.1:8080" }, "dense");

    assert.equal(config?.reranker.model, MODELE_RERANK_PAR_DEFAUT);
    assert.equal(config?.candidats, CANDIDATS_RERANK);
    assert.equal(MODELE_RERANK_PAR_DEFAUT, "bge-reranker-v2-m3");
  });

  it("lit le modèle et les candidats demandés", () => {
    const config = lireConfigRerank(
      {
        [VARIABLE_RERANK_URL]: "http://127.0.0.1:8080",
        VITRINE_RERANK_MODELE: "autre-modele",
        VITRINE_RERANK_CANDIDATS: "20",
      },
      "dense",
    );

    assert.equal(config?.reranker.model, "autre-modele");
    assert.equal(config?.candidats, 20);
  });

  it("arrête le démarrage sur un nombre de candidats invalide", () => {
    for (const valeur of ["4", "101", "20.5", "vingt", "", " 20"]) {
      assert.throws(
        () => lireCandidatsRerank(valeur),
        /VITRINE_RERANK_CANDIDATS attendu un entier de 5 à 100/,
      );
    }
    assert.equal(lireCandidatsRerank(String(CANDIDATS_RERANK_MIN)), CANDIDATS_RERANK_MIN);
    assert.equal(lireCandidatsRerank(String(CANDIDATS_RERANK_MAX)), CANDIDATS_RERANK_MAX);
  });

  it("refuse un nombre de candidats invalide même sans URL de rerank", () => {
    assert.throws(
      () => lireConfigRerank({ VITRINE_RERANK_CANDIDATS: "3" }, "dense"),
      /VITRINE_RERANK_CANDIDATS attendu un entier de 5 à 100/,
    );
  });

  it("arrête le démarrage sur une URL vide", () => {
    assert.throws(
      () => lireConfigRerank({ [VARIABLE_RERANK_URL]: "   " }, "dense"),
      /VITRINE_RERANK_URL est vide/,
    );
  });

  it("ignore le reranker en recherche lexicale et le dit une fois", () => {
    const messages: string[] = [];
    const config = lireConfigRerank(
      { [VARIABLE_RERANK_URL]: "http://127.0.0.1:8080" },
      "lexicale",
      (texte) => messages.push(texte),
    );

    assert.equal(config, undefined);
    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? "", /recherche est lexicale.*reranker ignoré/);
  });

  it("arrête le démarrage du serveur sur une variable invalide", () => {
    const resultat = spawnSync(process.execPath, ["mcp/server.ts"], {
      cwd: RACINE,
      env: {
        ...process.env,
        VITRINE_RECHERCHE: "dense",
        [VARIABLE_RERANK_URL]: "http://127.0.0.1:8080",
        VITRINE_RERANK_CANDIDATS: "3",
      },
      encoding: "utf8",
      timeout: 20_000,
    });

    assert.equal(resultat.status, 1);
    assert.match(resultat.stderr, /VITRINE_RERANK_CANDIDATS attendu un entier de 5 à 100/);
  });
});

describe("le signalement de la panne du reranker", () => {
  it("n'écrit qu'un message pour plusieurs échecs et propage l'erreur", async () => {
    const messages: string[] = [];
    const enPanne: Reranker = {
      model: "factice",
      score: async () => {
        throw new Error("injoignable");
      },
    };
    const signale = avecSignalementPanne(enPanne, (texte) => messages.push(texte));

    await assert.rejects(() => signale.score("q", ["a"]), /injoignable/);
    await assert.rejects(() => signale.score("q", ["a"]), /injoignable/);

    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? "", /Reranker factice indisponible/);
  });
});

describe("le harnais d'évaluation", () => {
  it("lit --candidats avec les mêmes bornes que le serveur", () => {
    assert.equal(lireCandidatsOption(undefined), CANDIDATS_RERANK);
    assert.equal(lireCandidatsOption("20"), 20);
    assert.throws(() => lireCandidatsOption("3"), /--candidats attendu un entier de 5 à 100/);
  });

  it("calcule une latence médiane", () => {
    assert.equal(mediane([]), 0);
    assert.equal(mediane([3_600]), 3_600);
    assert.equal(mediane([3_600, 3_692]), 3_646);
    assert.equal(mediane([5_000, 1_000, 3_000]), 3_000);
  });
});
