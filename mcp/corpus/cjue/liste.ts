/**
 * Liste les décisions CJUE relatives aux données personnelles depuis une borne,
 * par SPARQL sur CELLAR, et lit la réponse en entrées classées.
 *
 * La matière est un identifiant officiel de CELLAR (`PDON`, protection des
 * données personnelles). Le type de décision vient du suffixe CELEX : `CJ` et
 * `TJ` sont des arrêts, `CO` et `TO` des ordonnances, `CC` les conclusions d'un
 * avocat général, qui ne sont pas des décisions de justice.
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
  /** Notion fine de la jurisprudence, complément de la matière. */
  notion: { uri: string; libelle: string };
  /** CELEX ajoutés à la main, hors classement CELLAR. */
  celex_complementaires: string[];
  date_min: string;
  langue: string;
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
  | "avant_borne"
  | "date_invalide"
  | "avis_avocat_general"
  | "autre_type"
  | "version_francaise_absente"
  | "echec_telechargement"
  | "texte_vide";

export type EcartesCjue = Record<MotifEcartCjue, number>;

export const ECARTES_CJUE_VIDES: EcartesCjue = {
  avant_borne: 0,
  date_invalide: 0,
  avis_avocat_general: 0,
  autre_type: 0,
  version_francaise_absente: 0,
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

type Selection = Pick<DescripteurCjue, "matiere" | "notion">;

/** Bloc SPARQL qui réunit la matière grossière et la notion fine. */
function selection({ matiere, notion }: Selection): string {
  return `{ ?work cdm:resource_legal_is_about_subject-matter <${matiere}> }
  UNION
  { ?work cdm:case-law_is_about_concept_new_case-law <${notion.uri}> }`;
}

/** Requête SPARQL des décisions de la matière après la borne. */
export function requeteListe(descripteur: Selection, dateMin: string): string {
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?celex ?date WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_date_document ?date .
  ${selection(descripteur)}
  FILTER(STRSTARTS(STR(?celex), "6"))
  FILTER(?date >= "${dateMin}"^^xsd:date)
}`;
}

/** Requête SPARQL du nombre de décisions de la sélection avant la borne. */
export function requeteAvantBorne(descripteur: Selection, dateMin: string): string {
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT (COUNT(DISTINCT ?celex) AS ?n) WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_date_document ?date .
  ${selection(descripteur)}
  FILTER(STRSTARTS(STR(?celex), "6"))
  FILTER(REGEX(STR(?celex), "^6[0-9]{4}(CJ|TJ|CO|TO)"))
  FILTER(?date < "${dateMin}"^^xsd:date)
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

/** Nombre de décisions avant la borne annoncé par la requête de comptage. */
export function lireNombre(reponse: unknown): number {
  for (const ligne of bindings(reponse)) {
    const valeur = ligne.n?.value;
    const nombre = typeof valeur === "string" ? Number(valeur) : Number.NaN;
    if (Number.isFinite(nombre)) return nombre;
  }
  return 0;
}

/** Classe une entrée : borne de date, type retenu, ou motif d'écart. */
export function classerEntree(
  entree: EntreeCjue,
  descripteur: DescripteurCjue,
  dateMin = descripteur.date_min,
): { retenue: true } | { retenue: false; motif: MotifEcartCjue } {
  if (!DATE_ISO.test(entree.date) || Number.isNaN(Date.parse(entree.date))) {
    return { retenue: false, motif: "date_invalide" };
  }
  if (entree.date < dateMin) return { retenue: false, motif: "avant_borne" };
  if (entree.type === "CC") return { retenue: false, motif: "avis_avocat_general" };
  if (!(entree.type in descripteur.types_retenus)) {
    return { retenue: false, motif: "autre_type" };
  }
  return { retenue: true };
}

/** Lit la liste des décisions de la matière par SPARQL. */
export async function fetchListe(
  descripteur: DescripteurCjue,
  dateMin: string,
  fetchImpl: FetchLike = fetch,
): Promise<unknown> {
  const reponse = await fetchImpl(descripteur.endpoint_sparql, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: requeteListe(descripteur, dateMin) }).toString(),
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

/** Lit le nombre de décisions antérieures à la borne ; une panne rend `null`. */
export async function fetchAvantBorne(
  descripteur: DescripteurCjue,
  dateMin: string,
  fetchImpl: FetchLike = fetch,
): Promise<number | null> {
  try {
    const reponse = await fetchImpl(descripteur.endpoint_sparql, {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        query: requeteAvantBorne(descripteur, dateMin),
      }).toString(),
    });
    if (!reponse.ok) return null;
    return lireNombre(JSON.parse(await reponse.text()) as unknown);
  } catch {
    return null;
  }
}
