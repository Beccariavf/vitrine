import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CANDIDATS_RERANK, createLlamaReranker } from "../mcp/rerank/reranker.ts";
import type { FetchInit, FetchResponse } from "../veille/fetch.ts";

const URL_RERANK = "http://127.0.0.1:8080";
const PASSAGES = [
  "droit à l'effacement des données",
  "dépôt de cookies sans consentement",
  "compteur Linky et données de consommation",
  "vidéosurveillance d'un lieu de travail",
  "traitement de données de santé",
];

type Appel = { url: string; method: string; body: string };

/** Un `fetch` factice : aucun réseau, le corps et le statut sont fournis. */
function fetchFactice(corps: unknown, statut = 200, appels: Appel[] = []) {
  return async (url: string, init?: FetchInit): Promise<FetchResponse> => {
    appels.push({ url, method: init?.method ?? "", body: init?.body ?? "" });
    return {
      ok: statut >= 200 && statut < 300,
      status: statut,
      text: async () => JSON.stringify(corps),
    };
  };
}

function reranker(corps: unknown, statut = 200, appels: Appel[] = []) {
  return createLlamaReranker({
    url: URL_RERANK,
    model: "qwen3-reranker-0.6b",
    fetchImpl: fetchFactice(corps, statut, appels),
  });
}

describe("l'adaptateur de rerank llama.cpp", () => {
  it("poste le corps attendu et replace les scores par index", async () => {
    const appels: Appel[] = [];
    // Réponse triée par score, donc dans un ordre étranger à celui de l'envoi.
    const rerank = reranker(
      {
        model: "qwen3-reranker-0.6b",
        results: [
          { index: 3, relevance_score: 0.99 },
          { index: 0, relevance_score: 0.5 },
          { index: 4, relevance_score: 0.25 },
          { index: 2, relevance_score: 0.1 },
          { index: 1, relevance_score: 0.01 },
        ],
      },
      200,
      appels,
    );

    const scores = await rerank.score("droit à l'effacement", PASSAGES);

    assert.equal(appels.length, 1);
    assert.equal(appels[0]?.url, `${URL_RERANK}/reranking`);
    assert.equal(appels[0]?.method, "POST");
    assert.deepEqual(JSON.parse(appels[0]?.body ?? "{}"), {
      model: "qwen3-reranker-0.6b",
      query: "droit à l'effacement",
      documents: PASSAGES,
    });
    assert.deepEqual(scores, [0.5, 0.01, 0.1, 0.99, 0.25]);
    // Le meilleur passage est le quatrième envoyé : c'est bien un remappage par index.
    assert.deepEqual(
      scores
        .map((score, index) => ({ score, index }))
        .sort((gauche, droite) => droite.score - gauche.score)
        .map((entree) => entree.index),
      [3, 0, 4, 2, 1],
    );
  });

  it("lève sur une réponse tronquée par top_n en nommant l'URL et le compte attendu", async () => {
    const rerank = reranker(
      {
        results: [
          { index: 0, relevance_score: 0.9 },
          { index: 1, relevance_score: 0.4 },
        ],
      },
      200,
    );

    await assert.rejects(
      () => rerank.score("effacement", PASSAGES),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /http:\/\/127\.0\.0\.1:8080/);
        assert.match(message, /2 scores pour 5 passages/);
        assert.match(message, /HTTP 200/);
        assert.match(message, /index manquants 2, 3, 4/);
        return true;
      },
    );
  });

  it("lève sur un index dupliqué", async () => {
    const rerank = reranker({
      results: [
        { index: 0, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.4 },
        { index: 1, relevance_score: 0.3 },
        { index: 2, relevance_score: 0.2 },
        { index: 3, relevance_score: 0.1 },
      ],
    });

    await assert.rejects(() => rerank.score("effacement", PASSAGES), /index 1 rendu deux fois/);
  });

  it("lève sur un index hors bornes", async () => {
    const rerank = reranker({
      results: [
        { index: 0, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.4 },
        { index: 2, relevance_score: 0.3 },
        { index: 3, relevance_score: 0.2 },
        { index: 9, relevance_score: 0.1 },
      ],
    });

    await assert.rejects(() => rerank.score("effacement", PASSAGES), /index 9 hors bornes/);
  });

  it("lève sur un score non numérique", async () => {
    const rerank = reranker({
      results: [
        { index: 0, relevance_score: 0.9 },
        { index: 1, relevance_score: null },
        { index: 2, relevance_score: 0.3 },
        { index: 3, relevance_score: 0.2 },
        { index: 4, relevance_score: 0.1 },
      ],
    });

    await assert.rejects(() => rerank.score("effacement", PASSAGES), /score non numérique/);
  });

  it("nomme l'URL, le statut et le compte attendu sur un HTTP 500", async () => {
    const rerank = reranker({ error: { code: 500 } }, 500);

    await assert.rejects(
      () => rerank.score("effacement", PASSAGES),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /http:\/\/127\.0\.0\.1:8080\/reranking/);
        assert.match(message, /HTTP 500/);
        assert.match(message, /5 scores attendus/);
        return true;
      },
    );
  });

  it("nomme le statut d'un serveur lancé sans --reranking", async () => {
    const rerank = reranker(
      { error: { code: 501, message: "This server does not support reranking" } },
      501,
    );

    await assert.rejects(
      () => rerank.score("effacement", PASSAGES),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /http:\/\/127\.0\.0\.1:8080\/reranking/);
        assert.match(message, /HTTP 501/);
        assert.match(message, /--reranking/);
        assert.match(message, /5 scores attendus/);
        return true;
      },
    );
  });

  it("nomme l'URL d'un serveur injoignable", async () => {
    const rerank = createLlamaReranker({
      url: URL_RERANK,
      model: "qwen3-reranker-0.6b",
      fetchImpl: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });

    await assert.rejects(
      () => rerank.score("effacement", PASSAGES),
      /Reranker injoignable sur http:\/\/127\.0\.0\.1:8080 : connect ECONNREFUSED/,
    );
  });

  it("n'appelle pas le serveur sans passage", async () => {
    const appels: Appel[] = [];
    const rerank = reranker({ results: [] }, 200, appels);

    assert.deepEqual(await rerank.score("effacement", []), []);
    assert.equal(appels.length, 0);
  });

  it("offre cinquante candidats à l'étage", () => {
    assert.equal(CANDIDATS_RERANK, 50);
  });
});
