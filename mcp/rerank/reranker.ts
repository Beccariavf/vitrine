import type { FetchLike } from "../../veille/fetch.ts";

/**
 * Ce que `search` attend d'un second étage : un modèle, un score par passage.
 * Ces scores ne sont pas des cosinus : ils ne se comparent ni aux seuils de
 * `niveauConfiance`, ni entre modèles.
 */
export type Reranker = {
  readonly model: string;
  score(question: string, passages: string[]): Promise<number[]>;
};

/** Fenêtre dense offerte au reranker : 50 candidats coûtent ≈ 3,6 s sur `llama-server`. */
export const CANDIDATS_RERANK = 50;

export type LlamaRerankerOptions = {
  url: string;
  model: string;
  fetchImpl?: FetchLike;
};

function messageErreur(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Remet les scores dans l'ordre d'entrée par `results[].index` : llama.cpp
 * rend ses résultats triés et tronqués par `top_n`, jamais dans l'ordre reçu.
 */
function replacerScores(
  results: unknown[],
  attendus: number,
  url: string,
  statut: number,
): number[] {
  const scores = new Array<number | undefined>(attendus).fill(undefined);
  for (const resultat of results) {
    const { index, relevance_score: score } = (resultat ?? {}) as {
      index?: unknown;
      relevance_score?: unknown;
    };
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= attendus) {
      throw new Error(
        `Reranker ${url} : index ${String(index)} hors bornes pour ${attendus} passages (HTTP ${statut}).`,
      );
    }
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new Error(
        `Reranker ${url} : score non numérique pour l'index ${index} (HTTP ${statut}).`,
      );
    }
    if (scores[index] !== undefined) {
      throw new Error(`Reranker ${url} : index ${index} rendu deux fois (HTTP ${statut}).`);
    }
    scores[index] = score;
  }
  const manquants = scores
    .map((score, index) => (score === undefined ? index : -1))
    .filter((index) => index >= 0);
  if (manquants.length > 0) {
    throw new Error(
      `Reranker ${url} : ${results.length} scores pour ${attendus} passages (HTTP ${statut}), ` +
        `index manquants ${manquants.join(", ")}.`,
    );
  }
  return scores as number[];
}

/**
 * Adaptateur HTTP de `llama-server --reranking` sur `POST /reranking`, de forme
 * Jina : `{results: [{index, relevance_score}]}`. Sans le drapeau, le serveur
 * répond 501 et l'erreur le dit : aucun score n'est supposé.
 */
export function createLlamaReranker(options: LlamaRerankerOptions): Reranker {
  const url = options.url.replace(/\/+$/, "");
  const model = options.model;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    model,
    async score(question: string, passages: string[]): Promise<number[]> {
      if (passages.length === 0) return [];

      let reponse;
      try {
        reponse = await fetchImpl(`${url}/reranking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, query: question, documents: passages }),
        });
      } catch (error) {
        throw new Error(`Reranker injoignable sur ${url} : ${messageErreur(error)}.`);
      }

      if (!reponse.ok) {
        const cause =
          reponse.status === 501
            ? "serveur lancé sans --reranking (HTTP 501)"
            : `HTTP ${reponse.status}`;
        throw new Error(
          `Reranker a refusé la requête sur ${url}/reranking : ${cause}, ` +
            `${passages.length} scores attendus.`,
        );
      }

      let corps: unknown;
      try {
        corps = JSON.parse(await reponse.text());
      } catch {
        throw new Error(`Reranker a rendu une réponse illisible sur ${url}.`);
      }

      const results = (corps as { results?: unknown }).results;
      if (!Array.isArray(results)) {
        throw new Error(
          `Reranker ${url} : réponse sans « results », ` +
            `${passages.length} scores attendus (HTTP ${reponse.status}).`,
        );
      }
      return replacerScores(results, passages.length, url, reponse.status);
    },
  };
}
