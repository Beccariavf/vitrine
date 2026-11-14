/**
 * Liste les décisions CJUE relatives aux données personnelles, par SPARQL sur
 * CELLAR, et lit la réponse en entrées classées.
 *
 * La matière est un identifiant officiel de CELLAR (`PDON`, protection des
 * données personnelles) ; les notions fines la complètent, `4.11.01` pour la
 * protection des données et `2.04` pour le contentieux des institutions de
 * l'Union (CEPD c. SRB). Aucune borne de date : la jurisprudence fondatrice
 * (Lindqvist, 2003) reste au corpus. Le type de décision vient du suffixe
 * CELEX : `CJ` et `TJ` sont des arrêts, `CO` et `TO` des ordonnances, `CC` les
 * conclusions d'un avocat général, qui ne sont pas des décisions de justice.
 */

import type { FetchLike } from "../../../veille/fetch.ts";

/** Métadonnées du corpus CJUE, lues depuis `mcp/corpus/cjue/descripteur.json`. */
export type DescripteurCjue = {
  corpus: string;
  nom: string;
  titre: string;
  url_texte: string;
  endpoint_sparql: string;
  /** URI de la matière CELLAR, par exemple `.../subject-matter/PDON`. */
  matiere: string;
  matiere_libelle: string;
  /** Notions fines de la jurisprudence, compléments de la matière. */
  notions: Array<{ uri: string; libelle: string }>;
  /** CELEX ajoutés à la main, hors classement CELLAR. */
  celex_complementaires: string[];
  /** Langues de lecture, dans l'ordre essayé : la première disponible fait foi. */
  langues: string[];
  /** Types CELEX retenus, avec leur libellé. */
  types_retenus: Record<string, string>;
  licence: string;
};

export type TypeCjue = "CJ" | "TJ" | "CO" | "TO" | "CC" | "autre";

/** Une décision listée par CELLAR, avant lecture du texte. */
export type EntreeCjue = {
  celex: string;
  date: string;
  type: TypeCjue;
};

export type MotifEcartCjue =
  | "date_invalide"
  | "avis_avocat_general"
  | "autre_type"
  | "xhtml_absent"
  | "echec_telechargement"
  | "texte_vide";

export type EcartesCjue = Record<MotifEcartCjue, number>;

export const ECARTES_CJUE_VIDES: EcartesCjue = {
  date_invalide: 0,
  avis_avocat_general: 0,
  autre_type: 0,
  xhtml_absent: 0,
  echec_telechargement: 0,
  texte_vide: 0,
};

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Type CELEX d'un identifiant de jurisprudence, `autre` sinon. */
export function typeCelex(celex: string): TypeCjue {
  const suffixe = /^6\d{4}([A-Z]{2})/.exec(celex)?.[1];
  switch (suffixe) {
    case "CJ":
    case "TJ":
    case "CO":
    case "TO":
    case "CC":
      return suffixe;
    default:
      return "autre";
  }
}

type Selection = Pick<DescripteurCjue, "matiere" | "notions">;

/** Bloc SPARQL qui réunit la matière grossière et chaque notion fine. */
function selection({ matiere, notions }: Selection): string {
  const groupes = [
    `{ ?work cdm:resource_legal_is_about_subject-matter <${matiere}> }`,
    ...notions.map(
      (notion) => `{ ?work cdm:case-law_is_about_concept_new_case-law <${notion.uri}> }`,
    ),
  ];
  return groupes.join("\n  UNION\n  ");
}

/** Requête SPARQL des décisions de la matière. */
export function requeteListe(descripteur: Selection): string {
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?date WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_date_document ?date .
  ${selection(descripteur)}
  FILTER(STRSTARTS(STR(?celex), "6"))
}`;
}

type Binding = { value?: unknown };
type ReponseSparql = {
  results?: { bindings?: unknown };
};

function bindings(reponse: unknown): Array<Record<string, Binding>> {
  if (typeof reponse !== "object" || reponse === null) return [];
  const results = (reponse as ReponseSparql).results;
  if (typeof results !== "object" || results === null) return [];
  const liste = (results as { bindings?: unknown }).bindings;
  return Array.isArray(liste) ? (liste as Array<Record<string, Binding>>) : [];
}

/** Entrées d'une réponse SPARQL, dédupliquées par CELEX et triées. */
export function lireListe(reponse: unknown): EntreeCjue[] {
  const parCelex = new Map<string, EntreeCjue>();
  for (const ligne of bindings(reponse)) {
    const celex = ligne.celex?.value;
    const date = ligne.date?.value;
    if (typeof celex !== "string" || typeof date !== "string") continue;
    if (parCelex.has(celex)) continue;
    parCelex.set(celex, { celex, date, type: typeCelex(celex) });
  }
  return [...parCelex.values()].sort((gauche, droite) => gauche.celex.localeCompare(droite.celex));
}

/** Classe une entrée : type retenu, ou motif d'écart. */
export function classerEntree(
  entree: EntreeCjue,
  descripteur: DescripteurCjue,
): { retenue: true } | { retenue: false; motif: MotifEcartCjue } {
  if (!DATE_ISO.test(entree.date) || Number.isNaN(Date.parse(entree.date))) {
    return { retenue: false, motif: "date_invalide" };
  }
  if (entree.type === "CC") return { retenue: false, motif: "avis_avocat_general" };
  if (!(entree.type in descripteur.types_retenus)) {
    return { retenue: false, motif: "autre_type" };
  }
  return { retenue: true };
}

/** Lit la liste des décisions de la matière par SPARQL. */
export async function fetchListe(
  descripteur: DescripteurCjue,
  fetchImpl: FetchLike = fetch,
): Promise<unknown> {
  const reponse = await fetchImpl(descripteur.endpoint_sparql, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: requeteListe(descripteur) }).toString(),
  });
  if (!reponse.ok) {
    throw new Error(`CELLAR SPARQL : HTTP ${reponse.status}`);
  }
  const texte = await reponse.text();
  try {
    return JSON.parse(texte) as unknown;
  } catch (error) {
    const raison = error instanceof Error ? error.message : String(error);
    throw new Error(`CELLAR SPARQL : réponse illisible (${raison})`, { cause: error });
  }
}
