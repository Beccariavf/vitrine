/**
 * Essai de recherche par mots du connecteur : la logique de l'encart, pure et testée
 * sans navigateur. L'API (`GET /recherche?q=`) est servie hors du site (#116) ; le
 * script du composant ne fait qu'appeler ces fonctions et poser le rendu.
 */
import { FAMILLES } from "./familles.ts";

/** Adresse par défaut, fixée au build par `PUBLIC_RECHERCHE_URL`. */
export const BASE_RECHERCHE_PAR_DEFAUT = "http://127.0.0.1:8787";

/** Commande qui allume le service de démonstration. */
export const COMMANDE_DEMO = "npm run mcp:http";

/** Début du message quand le service ne répond pas ; la commande suit, en `<code>`. */
export const MESSAGE_INDISPONIBLE = "Le service de démonstration est éteint :";

/** Un passage tel que l'API le rend, réduit aux champs affichés. */
export type Passage = {
  rang: number;
  ref: string;
  corpus: string;
  chemin: string;
  date: string;
  extrait: string;
  url: string;
};

/** Ce que l'encart affiche après une requête. */
export type Resultat =
  | { etat: "resultats"; passages: Passage[] }
  | { etat: "erreur"; message: string }
  | { etat: "indisponible"; message: string };

/** URL de la recherche : base du build, question encodée, aucun autre paramètre. */
export function urlRecherche(base: string, question: string): string {
  return `${base.replace(/\/+$/, "")}/recherche?q=${encodeURIComponent(question.trim())}`;
}

/** Une URL n'est suivie que si elle est `http:` ou `https:` ; tout le reste est refusé. */
export function urlOfficielle(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  let url: URL;
  try {
    url = new URL(valeur);
  } catch {
    return null;
  }
  return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
}

/**
 * Lit la réponse de l'API : 200 rend les passages (liste vide comprise), les autres
 * statuts un message lisible. Un passage sans lien officiel est écarté.
 */
export function lireReponse(statut: number, corps: unknown): Resultat {
  if (statut === 200) {
    const passages = passagesLus(corps);
    if (passages === null) return { etat: "erreur", message: "La réponse de la recherche est illisible." };
    return { etat: "resultats", passages };
  }

  const erreur = champTexte(corps, "erreur");
  if (statut === 400) {
    return {
      etat: "erreur",
      message: erreur === null ? "La question n'a pas été acceptée." : `La question n'a pas été acceptée : ${erreur}`,
    };
  }
  if (statut === 429) {
    const secondes = champNombre(corps, "reessayer_dans_s");
    return {
      etat: "erreur",
      message: `Trop de requêtes : réessayez dans ${secondes === null ? "un instant" : `${secondes} s`}.`,
    };
  }
  if (statut === 503) {
    return {
      etat: "erreur",
      message: erreur === null ? "La démonstration est indisponible." : `La démonstration est indisponible : ${erreur}`,
    };
  }
  return {
    etat: "erreur",
    message: erreur === null ? `La recherche a échoué (${statut}).` : `La recherche a échoué (${statut}) : ${erreur}`,
  };
}

/** Libellé, famille et pastille d'un corpus, calculés au build ; inconnu → libellé brut et « autre ». */
export type CorpusAffiche = { libelle: string; famille: string; pastille: string };

export function corpusAffiche(corpus: string, table: Readonly<Record<string, CorpusAffiche>>): CorpusAffiche {
  const connu = Object.hasOwn(table, corpus) ? table[corpus] : undefined;
  return connu ?? { libelle: corpus, famille: FAMILLES.autre.libelle, pastille: FAMILLES.autre.classePastille };
}

/** Journée d'une date ISO en français ; toute autre forme est rendue telle quelle. */
export function dateLisible(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(date)) return date;
  const valeur = new Date(date);
  return Number.isNaN(valeur.getTime()) ? date : FORMAT_DATE.format(valeur);
}

/** Dates en français, à l'heure UTC : les mêmes au build comme en test. */
const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function passagesLus(corps: unknown): Passage[] | null {
  if (typeof corps !== "object" || corps === null) return null;
  const passages = (corps as { passages?: unknown }).passages;
  if (!Array.isArray(passages)) return null;
  const propres: Passage[] = [];
  for (const [index, brut] of passages.entries()) {
    const passage = passageLu(brut, index);
    if (passage !== null) propres.push(passage);
  }
  return propres;
}

function passageLu(brut: unknown, index: number): Passage | null {
  if (typeof brut !== "object" || brut === null) return null;
  const champs = brut as Record<string, unknown>;
  const url = urlOfficielle(champs.url);
  if (url === null) return null;
  return {
    rang: typeof champs.rang === "number" && Number.isFinite(champs.rang) ? champs.rang : index + 1,
    ref: texte(champs.ref),
    corpus: texte(champs.corpus),
    chemin: texte(champs.chemin),
    date: texte(champs.date),
    extrait: texte(champs.extrait),
    url,
  };
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur : "";
}

function champTexte(corps: unknown, nom: string): string | null {
  if (typeof corps !== "object" || corps === null) return null;
  const valeur = (corps as Record<string, unknown>)[nom];
  return typeof valeur === "string" && valeur.trim() !== "" ? valeur : null;
}

function champNombre(corps: unknown, nom: string): number | null {
  if (typeof corps !== "object" || corps === null) return null;
  const valeur = (corps as Record<string, unknown>)[nom];
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : null;
}
