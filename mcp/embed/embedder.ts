import type { FetchLike } from "../../veille/fetch.ts";

/** Ce que l'index attend d'un fournisseur d'embeddings : trois membres, rien de plus. */
export type Embedder = {
  readonly model: string;
  readonly dim: number;
  embedPassages(textes: string[]): Promise<number[][]>;
  /** `portee` est le document ou le corpus qui choisit l'instruction de requête. */
  embedQuery(texte: string, portee?: string): Promise<number[]>;
};

export const MODELE_DEFAUT = "leoipulsar/harrier-0.6b";
export const HOTE_DEFAUT = "http://127.0.0.1:11434";
export const DIM_DEFAUT = 1024;

/**
 * Instruction de requête mesurée en phase 4 pour le RGPD : elle porte le
 * rapprochement de « effacement et moteurs de recherche » au rang 1 et écarte
 * les similarités de près de 0,15. Les passages, eux, ne portent jamais
 * d'instruction.
 */
export const INSTRUCTION_REQUETE =
  "Instruction : retrouve les passages du RGPD qui répondent à la question\nRequête : ";

/** Instruction de requête propre à l'AI Act, de la même forme que celle du RGPD. */
export const INSTRUCTION_AIAct =
  "Instruction : retrouve les passages du règlement européen sur l'intelligence artificielle qui répondent à la question\nRequête : ";

/** Instruction de requête propre aux sanctions CNIL, de la même forme. */
export const INSTRUCTION_CNIL =
  "Instruction : retrouve les passages d'une délibération de sanction de la CNIL qui répondent à la question\nRequête : ";

/** Instructions connues par identifiant CELEX et par nom de corpus. */
export const INSTRUCTIONS_REQUETE: Record<string, string> = {
  "32016R0679": INSTRUCTION_REQUETE,
  "32024R1689": INSTRUCTION_AIAct,
  rgpd: INSTRUCTION_REQUETE,
  aiact: INSTRUCTION_AIAct,
  cnil: INSTRUCTION_CNIL,
};

export type OllamaEmbedderOptions = {
  host?: string;
  model?: string;
  dim?: number;
  /** Instructions par identifiant CELEX ; `defaut` s'applique aux autres documents. */
  instructions?: Record<string, string>;
  /** Instruction de repli, et du document non nommé. */
  defaut?: string;
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
  const instructions = options.instructions ?? INSTRUCTIONS_REQUETE;
  const defaut = options.defaut ?? INSTRUCTION_REQUETE;
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
    async embedQuery(texte: string, portee?: string): Promise<number[]> {
      const instruction = portee === undefined ? defaut : (instructions[portee] ?? defaut);
      const [vecteur] = await embarquer([`${instruction}${texte}`]);
      if (vecteur === undefined) throw new Error("Ollama n'a rendu aucun embedding pour la requête");
      return vecteur;
    },
  };
}
