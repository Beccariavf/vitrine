import type { FetchLike } from "../../veille/fetch.ts";
import {
  DIM_DEFAUT,
  INSTRUCTION_REQUETE,
  INSTRUCTIONS_REQUETE,
  normaliser,
} from "./embedder.ts";
import type { Embedder } from "./embedder.ts";

/** URL par défaut d'Unsloth Studio, qui expose `POST /v1/embeddings`. */
export const URL_OPENAI_DEFAUT = "http://127.0.0.1:8888";

export type OpenAIEmbedderOptions = {
  url?: string;
  /** Nom demandé au service : aucun modèle n'est supposé, la réponse le contrôle. */
  model: string;
  dim?: number;
  /** Instructions par identifiant CELEX ; `defaut` s'applique aux autres documents. */
  instructions?: Record<string, string>;
  /** Instruction de repli, et du document non nommé. */
  defaut?: string;
  fetchImpl?: FetchLike;
};

function messageErreur(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validerVecteur(valeur: unknown, dim: number, index: number): number[] {
  if (!Array.isArray(valeur) || valeur.some((composante) => typeof composante !== "number")) {
    throw new Error(`OpenAI : embedding ${index} mal formé`);
  }
  if (valeur.length !== dim) {
    throw new Error(
      `OpenAI : embedding ${index} de ${valeur.length} dimensions, ${dim} attendues ; ` +
        "le modèle et la dimension de l'index doivent rester d'accord",
    );
  }
  return normaliser(valeur as number[]);
}

/**
 * Adaptateur HTTP de `POST /v1/embeddings` (forme OpenAI). Le champ `model` de
 * la réponse et la longueur de chaque vecteur sont refusés dès qu'ils diffèrent
 * de la demande : un service peut servir un autre modèle sans changer de code.
 */
export function createOpenAIEmbedder(options: OpenAIEmbedderOptions): Embedder {
  const url = (options.url ?? URL_OPENAI_DEFAUT).replace(/\/+$/, "");
  const model = options.model;
  const dim = options.dim ?? DIM_DEFAUT;
  const instructions = options.instructions ?? INSTRUCTIONS_REQUETE;
  const defaut = options.defaut ?? INSTRUCTION_REQUETE;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function embarquer(textes: string[]): Promise<number[][]> {
    let reponse;
    try {
      reponse = await fetchImpl(`${url}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: textes }),
      });
    } catch (error) {
      throw new Error(
        `Service d'embeddings injoignable sur ${url} : ${messageErreur(error)}. ` +
          `Vérifiez que le modèle ${model} est chargé.`,
      );
    }

    if (!reponse.ok) {
      throw new Error(
        `Service d'embeddings a refusé la requête sur ${url}/v1/embeddings : ` +
          `HTTP ${reponse.status}, ${textes.length} vecteurs attendus.`,
      );
    }

    let corps: unknown;
    try {
      corps = JSON.parse(await reponse.text());
    } catch {
      throw new Error(`Service d'embeddings a rendu une réponse illisible sur ${url}.`);
    }

    const servi = (corps as { model?: unknown }).model;
    if (typeof servi !== "string" || servi !== model) {
      throw new Error(
        `Service d'embeddings sur ${url} : modèle reçu « ${typeof servi === "string" ? servi : "(absent)"} », ` +
          `« ${model} » demandé ; la réponse vient d'un autre modèle.`,
      );
    }

    const data = (corps as { data?: unknown }).data;
    if (!Array.isArray(data) || data.length !== textes.length) {
      throw new Error(
        `Service d'embeddings a rendu ${Array.isArray(data) ? data.length : 0} vecteurs ` +
          `pour ${textes.length} textes sur ${url}.`,
      );
    }
    return data.map((entree, index) =>
      validerVecteur((entree as { embedding?: unknown } | null)?.embedding, dim, index),
    );
  }

  return {
    model,
    dim,
    embedPassages: embarquer,
    async embedQuery(texte: string, portee?: string): Promise<number[]> {
      const instruction = portee === undefined ? defaut : (instructions[portee] ?? defaut);
      const [vecteur] = await embarquer([`${instruction}${texte}`]);
      if (vecteur === undefined) {
        throw new Error("Service d'embeddings n'a rendu aucun vecteur pour la requête");
      }
      return vecteur;
    },
  };
}
