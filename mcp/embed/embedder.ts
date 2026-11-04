import type { FetchLike } from "../../veille/fetch.ts";

/** Ce que l'index attend d'un fournisseur d'embeddings : trois membres, rien de plus. */
export type Embedder = {
  readonly model: string;
  readonly dim: number;
  embedPassages(textes: string[]): Promise<number[][]>;
  embedQuery(texte: string): Promise<number[]>;
};

export const MODELE_DEFAUT = "qwen3-embedding:0.6b";
export const HOTE_DEFAUT = "http://127.0.0.1:11434";
export const DIM_DEFAUT = 1024;

export type OllamaEmbedderOptions = {
  host?: string;
  model?: string;
  dim?: number;
  fetchImpl?: FetchLike;
};

/** Ramène un vecteur à la norme 2 = 1 ; un vecteur nul reste nul. */
export function normaliser(vecteur: number[]): number[] {
  const norme = Math.sqrt(vecteur.reduce((total, valeur) => total + valeur * valeur, 0));
  return norme === 0 ? vecteur.slice() : vecteur.map((valeur) => valeur / norme);
}

function messageErreur(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validerVecteur(valeur: unknown, dim: number, index: number): number[] {
  if (!Array.isArray(valeur) || valeur.some((composante) => typeof composante !== "number")) {
    throw new Error(`Ollama : embedding ${index} mal formé`);
  }
  if (valeur.length !== dim) {
    throw new Error(
      `Ollama : embedding ${index} de ${valeur.length} dimensions, ${dim} attendues ; ` +
        "le modèle et la dimension de l'index doivent rester d'accord",
    );
  }
  return normaliser(valeur as number[]);
}

/**
 * Adaptateur HTTP d'Ollama sur `POST /api/embed`. La normalisation est faite
 * ici : l'API la garantit aujourd'hui, le cosinus et les seuils n'y comptent pas.
 */
export function createOllamaEmbedder(options: OllamaEmbedderOptions = {}): Embedder {
  const host = options.host ?? HOTE_DEFAUT;
  const model = options.model ?? MODELE_DEFAUT;
  const dim = options.dim ?? DIM_DEFAUT;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function embarquer(textes: string[]): Promise<number[][]> {
    let reponse;
    try {
      reponse = await fetchImpl(`${host}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: textes }),
      });
    } catch (error) {
      throw new Error(
        `Ollama injoignable sur ${host} : ${messageErreur(error)}. ` +
          `Lancez « ollama serve » puis « ollama pull ${model} ».`,
      );
    }

    if (!reponse.ok) {
      const cause = reponse.status === 404 ? `modèle absent (${model})` : `HTTP ${reponse.status}`;
      throw new Error(`Ollama a refusé l'embedding sur ${host} : ${cause}. Lancez « ollama pull ${model} ».`);
    }

    let corps: unknown;
    try {
      corps = JSON.parse(await reponse.text());
    } catch {
      throw new Error(`Ollama a rendu une réponse illisible sur ${host}.`);
    }

    const embeddings = (corps as { embeddings?: unknown }).embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== textes.length) {
      throw new Error(
        `Ollama a rendu ${Array.isArray(embeddings) ? embeddings.length : 0} embeddings ` +
          `pour ${textes.length} textes sur ${host}.`,
      );
    }
    return embeddings.map((vecteur, index) => validerVecteur(vecteur, dim, index));
  }

  return {
    model,
    dim,
    embedPassages: embarquer,
    async embedQuery(texte: string): Promise<number[]> {
      const [vecteur] = await embarquer([texte]);
      if (vecteur === undefined) throw new Error("Ollama n'a rendu aucun embedding pour la requête");
      return vecteur;
    },
  };
}
