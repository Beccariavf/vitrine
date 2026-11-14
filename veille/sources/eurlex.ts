/**
 * Détection des actes de l'Union du périmètre : nouvelles versions consolidées
 * des actes du corpus et nouveaux actes (décision d'adéquation, clauses types,
 * acte modifiant un acte suivi).
 *
 * Tout se lit dans CELLAR par SPARQL — EUR-Lex bloque les robots. Trois requêtes
 * groupées suffisent, une par catégorie : aucune n'est faite acte par acte.
 * Le module est hors ligne : l'appelant fournit `fetchImpl` ou les réponses.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FetchLike } from "../fetch.ts";
import type { Entry } from "../types.ts";
import type { Descripteur } from "../../mcp/corpus/parse.ts";
import type { DescripteurAdequation } from "../../mcp/corpus/adequation/parse.ts";
import { paysDeTitre } from "../../mcp/corpus/adequation/parse.ts";
import { celexDeBase, dateDeConsolidation } from "../../mcp/corpus/versions.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Dossier des descripteurs d'actes ; `adequation/` porte sa propre liste. */
export const DOSSIER_CORPUS = join(ICI, "..", "..", "mcp", "corpus");
export const DESCRIPTEUR_ADEQUATION = join(DOSSIER_CORPUS, "adequation", "descripteur.json");

/** Identifiant de la source de veille. */
export const SOURCE_ID = "eurlex";

/** Matière unique : tous les actes suivis portent la protection des données. */
export const THEME = "donnees-personnelles";

/** Point d'accès SPARQL de CELLAR, partagé avec le corpus CJUE. */
export const ENDPOINT_SPARQL = "https://publications.europa.eu/webapi/rdf/sparql";

/**
 * Début de la veille des nouveaux actes. Les consolidations, elles, se comparent
 * au descripteur : une consolidation plus récente est signalée quelle que soit
 * sa date, parce que le corpus peut avoir été construit longtemps avant.
 */
export const DATE_MIN = "2026-11-14";

/** Actes dont une décision d'adéquation peut être prise : RGPD et 2016/680. */
export const BASES_ADEQUATION = ["32016R0679", "32016L0680"] as const;

/** Actes dont la modification déclenche une entrée. */
export const ACTES_MODIFIES = ["32016R0679", "32002L0058", "32016L0680", "32018R1725"] as const;

/** Un acte de base suivi, lu dans son descripteur. */
export type ActeSuivi = {
  corpus: string;
  document: string;
  nom: string;
  titre: string;
  /** Consolidation actuellement rendue, `null` quand l'acte d'origine l'est. */
  version: string | null;
  datePublication: string;
};

/** Nouvel acte listé par CELLAR, avant classement. */
export type ActeListe = {
  celex: string;
  date: string;
  titre: string | null;
  /** CELEX de la décision abrogée, quand CELLAR la déclare. */
  abroge: string | null;
};

/** Acte modificatif listé par CELLAR. */
export type Modification = {
  celex: string;
  date: string;
  titre: string | null;
  /** CELEX de l'acte modifié. */
  document: string;
};

type Binding = { value?: unknown };
type ReponseSparql = { results?: { bindings?: unknown } };

function bindings(reponse: unknown): Array<Record<string, Binding>> {
  if (typeof reponse !== "object" || reponse === null) return [];
  const results = (reponse as ReponseSparql).results;
  if (typeof results !== "object" || results === null) return [];
  const liste = (results as { bindings?: unknown }).bindings;
  return Array.isArray(liste) ? (liste as Array<Record<string, Binding>>) : [];
}

/** `2026-11-14` → `14/11/2026`. */
export function dateFr(date: string): string {
  const [annee, mois, jour] = date.split("-");
  return annee === undefined || mois === undefined || jour === undefined
    ? date
    : `${jour}/${mois}/${annee}`;
}

/**
 * Actes de base suivis : les descripteurs `mcp/corpus/*.json` dont le CELEX
 * commence par `3`. Une `version` qui n'est pas une consolidation (l'acte
 * d'origine) vaut `null` : le corpus rend alors le texte non consolidé.
 */
export function actesSuivis(dossier: string = DOSSIER_CORPUS): ActeSuivi[] {
  const actes: ActeSuivi[] = [];
  for (const fichier of readdirSync(dossier).sort()) {
    if (!fichier.endsWith(".json")) continue;
    const descripteur = JSON.parse(readFileSync(join(dossier, fichier), "utf8")) as Descripteur;
    if (typeof descripteur.document !== "string" || !descripteur.document.startsWith("3")) continue;
    actes.push({
      corpus: descripteur.corpus,
      document: descripteur.document,
      nom: descripteur.nom,
      titre: descripteur.titre,
      version:
        typeof descripteur.version === "string" && descripteur.version.startsWith("0")
          ? descripteur.version
          : null,
      datePublication: descripteur.date_publication,
    });
  }
  return actes;
}

export function lireDescripteurAdequation(chemin: string = DESCRIPTEUR_ADEQUATION): DescripteurAdequation {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurAdequation;
}

/** Requête des consolidations : une seule pour tous les actes suivis. */
export function requeteConsolidations(actes: readonly ActeSuivi[]): string {
  // Une version consolidée porte le préfixe `0` là où l'acte de base porte `3`.
  const bases = actes.map((acte) => `"0${acte.document.slice(1)}"`).join(" ");
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex WHERE {
  VALUES ?base { ${bases} }
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(STRSTARTS(STR(?celex), ?base))
}`;
}

/**
 * Requête des nouveaux actes : les décisions prises sur le fondement du RGPD ou
 * de la directive 2016/680 (adéquation et clauses types), depuis la borne.
 */
export function requeteNouveauxActes(dateMin: string = DATE_MIN): string {
  const bases = BASES_ADEQUATION.map((celex) => `"${celex}"`).join(" ");
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?celex ?date ?title ?lang ?repealsCelex WHERE {
  VALUES ?baseCelex { ${bases} }
  ?work cdm:resource_legal_based_on_resource_legal ?base .
  ?base cdm:resource_legal_id_celex ?baseId .
  FILTER(STR(?baseId) = STR(?baseCelex))
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_date_document ?date .
  ?work cdm:resource_legal_type ?type .
  FILTER(STR(?type) = "D")
  FILTER(STRSTARTS(STR(?celex), "3"))
  FILTER(?date >= "${dateMin}"^^xsd:date)
  OPTIONAL { ?work cdm:work_title ?title . BIND(LANG(?title) AS ?lang) }
  OPTIONAL {
    ?work cdm:resource_legal_repeals_resource_legal ?repeals .
    OPTIONAL { ?repeals cdm:resource_legal_id_celex ?repealsCelex }
  }
}`;
}

/** Requête des actes modificatifs : une seule pour les quatre actes suivis. */
export function requeteModifications(dateMin: string = DATE_MIN): string {
  const bases = ACTES_MODIFIES.map((celex) => `"${celex}"`).join(" ");
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?celex ?date ?title ?lang ?baseCelex WHERE {
  VALUES ?cible { ${bases} }
  ?work cdm:resource_legal_amends_resource_legal ?base .
  ?base cdm:resource_legal_id_celex ?baseCelex .
  FILTER(STR(?baseCelex) = STR(?cible))
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_date_document ?date .
  FILTER(STRSTARTS(STR(?celex), "3"))
  FILTER(?date >= "${dateMin}"^^xsd:date)
  OPTIONAL { ?work cdm:work_title ?title . BIND(LANG(?title) AS ?lang) }
}`;
}

/**
 * Dernière consolidation de chaque acte, par CELEX de base.
 * La plus récente date de consolidation l'emporte.
 */
export function lireConsolidations(reponse: unknown): Map<string, { version: string; date: string }> {
  const consolidations = new Map<string, { version: string; date: string }>();
  for (const ligne of bindings(reponse)) {
    const version = ligne.celex?.value;
    if (typeof version !== "string") continue;
    const date = dateDeConsolidation(version);
    const base = celexDeBase(version);
    if (date === null || base === null) continue;
    const connue = consolidations.get(base);
    if (connue === undefined || date > connue.date) consolidations.set(base, { version, date });
  }
  return consolidations;
}

/** Titre retenu pour un CELEX : le français d'abord, sinon le premier non vide. */
function titresParCelex(reponse: unknown): Map<string, { titre: string | null; abroge: string | null }> {
  const titres = new Map<string, { titre: string | null; abroge: string | null; francais: boolean }>();
  for (const ligne of bindings(reponse)) {
    const celex = ligne.celex?.value;
    if (typeof celex !== "string") continue;
    const titre = typeof ligne.title?.value === "string" ? ligne.title.value.trim() : null;
    const langue = typeof ligne.lang?.value === "string" ? ligne.lang.value : null;
    const abroge = typeof ligne.repealsCelex?.value === "string" ? ligne.repealsCelex.value : null;
    const actuel = titres.get(celex) ?? { titre: null, abroge: null, francais: false };
    if (titre !== null && (actuel.titre === null || (langue === "fr" && !actuel.francais))) {
      actuel.titre = titre;
      actuel.francais = langue === "fr";
    }
    if (actuel.abroge === null && abroge !== null) actuel.abroge = abroge;
    titres.set(celex, actuel);
  }
  return new Map(
    [...titres.entries()].map(([celex, valeur]) => [celex, { titre: valeur.titre, abroge: valeur.abroge }]),
  );
}

/** Nouveaux actes d'une réponse SPARQL, dédupliqués par CELEX. */
export function lireNouveauxActes(reponse: unknown): ActeListe[] {
  const dates = new Map<string, string>();
  for (const ligne of bindings(reponse)) {
    const celex = ligne.celex?.value;
    const date = ligne.date?.value;
    if (typeof celex !== "string" || typeof date !== "string") continue;
    if (!dates.has(celex)) dates.set(celex, date);
  }
  const titres = titresParCelex(reponse);
  return [...dates.entries()]
    .map(([celex, date]) => ({
      celex,
      date,
      titre: titres.get(celex)?.titre ?? null,
      abroge: titres.get(celex)?.abroge ?? null,
    }))
    .sort((gauche, droite) => gauche.date.localeCompare(droite.date) || gauche.celex.localeCompare(droite.celex));
}

/** Modifications d'une réponse SPARQL, dédupliquées par couple (acte, cible). */
export function lireModifications(reponse: unknown): Modification[] {
  const vues = new Map<string, { date: string; base: string }>();
  for (const ligne of bindings(reponse)) {
    const celex = ligne.celex?.value;
    const date = ligne.date?.value;
    const base = ligne.baseCelex?.value;
    if (typeof celex !== "string" || typeof date !== "string" || typeof base !== "string") continue;
    vues.set(`${celex}|${base}`, { date, base });
  }
  const titres = titresParCelex(reponse);
  return [...vues.entries()]
    .map(([cle, valeur]) => ({
      celex: cle.slice(0, cle.indexOf("|")),
      date: valeur.date,
      titre: titres.get(cle.slice(0, cle.indexOf("|")))?.titre ?? null,
      document: valeur.base,
    }))
    .sort((gauche, droite) => gauche.date.localeCompare(droite.date) || gauche.celex.localeCompare(droite.celex));
}

/** Vrai si le titre annonce une décision d'adéquation qui en constate une. */
export function estAdequation(titre: string | null): boolean {
  if (titre === null) return false;
  if (/\bamending\b|\bmodifiant\b/i.test(titre)) return false;
  return /adequate (?:level of )?protection|niveau de protection ad[ée]quat/i.test(titre);
}

/** Vrai si le titre annonce de nouvelles clauses contractuelles types. */
export function estClausesTypes(titre: string | null): boolean {
  if (titre === null) return false;
  if (/\bamending\b|\bmodifiant\b/i.test(titre)) return false;
  return /standard contractual clauses|clauses contractuelles types/i.test(titre);
}

function identifiant(categorie: string, document: string, reference: string, version: string | null): string {
  return createHash("sha256")
    .update(`${SOURCE_ID}|${categorie}|${document}|${reference}|${version ?? ""}`, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function urlEurLex(celex: string): string {
  return `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${celex}`;
}

function entree(params: {
  categorie: NonNullable<Entry["categorie"]>;
  document: string;
  reference: string;
  date: string;
  datePasse: string;
  title: string;
  officialTitle: string;
  version?: string;
  abroge?: string;
}): Entry {
  return {
    id: identifiant(params.categorie, params.document, params.reference, params.version ?? null),
    title: params.title,
    officialTitle: params.officialTitle,
    url: urlEurLex(params.reference),
    // La date de la passe est celle de la détection : l'entrée doit entrer dans
    // la fenêtre de `corpus:sync` même quand l'acte est plus ancien. Sa date
    // reste dans le titre.
    publishedAt: `${params.datePasse}T12:00:00.000Z`,
    summary: null,
    references: [],
    themes: [THEME],
    source: SOURCE_ID,
    document: params.document,
    categorie: params.categorie,
    date_acte: params.date,
    ...(params.version === undefined ? {} : { version: params.version }),
    ...(params.abroge === undefined || params.abroge === "" ? {} : { abroge: params.abroge }),
  };
}

/** Entrées des consolidations plus récentes que celles des descripteurs. */
export function detecterConsolidations(
  actes: readonly ActeSuivi[],
  consolidations: ReadonlyMap<string, { version: string; date: string }>,
  datePasse: string,
): Entry[] {
  const entrees: Entry[] = [];
  for (const acte of actes) {
    const derniere = consolidations.get(acte.document);
    if (derniere === undefined) continue;
    if (acte.version === derniere.version) continue;
    // Un acte jamais consolidé ne devient nouveau que si la consolidation est
    // postérieure à sa publication : celle du jour de publication n'apporte rien.
    if (acte.version === null && derniere.date <= acte.datePublication) continue;
    entrees.push(
      entree({
        categorie: "consolidation",
        document: acte.document,
        reference: derniere.version,
        date: derniere.date,
        datePasse,
        title: `${acte.nom} : nouvelle version consolidée du ${dateFr(derniere.date)}`,
        officialTitle: acte.titre,
        version: derniere.version,
      }),
    );
  }
  return entrees;
}

/**
 * Entrées des nouveaux actes absents des descripteurs. Une décision qui ne
 * constate pas l'adéquation et n'adopte pas de clauses types est signalée comme
 * hors périmètre, jamais publiée.
 */
export function detecterNouveauxActes(
  actes: readonly ActeSuivi[],
  adequation: DescripteurAdequation,
  actesListes: readonly ActeListe[],
  datePasse: string,
): { entrees: Entry[]; avertissements: string[] } {
  const connus = new Set([
    ...actes.map((acte) => acte.document),
    ...adequation.decisions.map((decision) => decision.celex),
  ]);
  const entrees: Entry[] = [];
  const avertissements: string[] = [];

  for (const acte of actesListes) {
    if (connus.has(acte.celex)) continue;
    if (estAdequation(acte.titre)) {
      const pays = paysDeTitre(acte.titre);
      entrees.push(
        entree({
          categorie: "adequation",
          document: acte.celex,
          reference: acte.celex,
          date: acte.date,
          datePasse,
          title: `Décision d'adéquation${pays === null ? "" : ` : ${pays}`} (${dateFr(acte.date)})`,
          officialTitle: acte.titre ?? `Décision d'adéquation ${acte.celex}`,
          ...(acte.abroge === null ? {} : { abroge: acte.abroge }),
        }),
      );
      continue;
    }
    if (estClausesTypes(acte.titre)) {
      entrees.push(
        entree({
          categorie: "clauses_types",
          document: acte.celex,
          reference: acte.celex,
          date: acte.date,
          datePasse,
          title: `Nouvelles clauses contractuelles types (${dateFr(acte.date)})`,
          officialTitle: acte.titre ?? `Clauses contractuelles types ${acte.celex}`,
        }),
      );
      continue;
    }
    avertissements.push(
      `eurlex : décision ${acte.celex} du ${acte.date} hors périmètre (ni adéquation ni clauses types)`,
    );
  }
  return { entrees, avertissements };
}

/**
 * Entrées des actes modificatifs. `document` reste l'acte modifié ; la version
 * consolidée connue à la passe est portée quand elle existe, pour que la
 * synchronisation sache quelle version construire.
 */
export function detecterModifications(
  actes: readonly ActeSuivi[],
  consolidations: ReadonlyMap<string, { version: string; date: string }>,
  modifications: readonly Modification[],
  datePasse: string,
): Entry[] {
  const entrees: Entry[] = [];
  const parDocument = new Map(actes.map((acte) => [acte.document, acte]));
  for (const modification of modifications) {
    const acte = parDocument.get(modification.document);
    if (acte === undefined) continue;
    const derniere = consolidations.get(acte.document);
    // Seule une consolidation postérieure à l'acte modificatif peut le porter :
    // une version plus ancienne ne dirait rien de la modification.
    const version = derniere === undefined || derniere.date < modification.date ? undefined : derniere.version;
    entrees.push(
      entree({
        categorie: "modification",
        document: acte.document,
        reference: modification.celex,
        date: modification.date,
        datePasse,
        title: `${acte.nom} : acte modificatif ${modification.celex} du ${dateFr(modification.date)}`,
        officialTitle: modification.titre ?? acte.titre,
        ...(version === undefined ? {} : { version }),
      }),
    );
  }
  return entrees;
}

/** Lit une réponse SPARQL ; toute panne est reformulée avec sa catégorie. */
export async function fetchSparql(
  endpoint: string,
  requete: string,
  categorie: string,
  fetchImpl: FetchLike = fetch,
): Promise<unknown> {
  let reponse: Awaited<ReturnType<FetchLike>>;
  try {
    reponse = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query: requete }).toString(),
    });
  } catch (error) {
    const raison = error instanceof Error ? error.message : String(error);
    throw new Error(`CELLAR SPARQL ${categorie} : ${raison}`, { cause: error });
  }
  if (!reponse.ok) throw new Error(`CELLAR SPARQL ${categorie} : HTTP ${reponse.status}`);
  const texte = await reponse.text();
  try {
    return JSON.parse(texte) as unknown;
  } catch (error) {
    const raison = error instanceof Error ? error.message : String(error);
    throw new Error(`CELLAR SPARQL ${categorie} : réponse illisible (${raison})`, { cause: error });
  }
}

/** Réponses déjà lues, pour les tests : elles remplacent le réseau. */
export type ReponsesEurlex = {
  consolidations?: unknown;
  nouveaux?: unknown;
  modifications?: unknown;
};

export type PasseEurlexOptions = {
  fetchImpl?: FetchLike;
  /** Date de la passe : `publishedAt` de chaque entrée. */
  maintenant?: Date;
  dossierCorpus?: string;
  descripteurAdequation?: string;
  endpoint?: string;
  dateMin?: string;
  reponses?: ReponsesEurlex;
};

export type ResultatPasseEurlex = {
  raw: string[];
  entries: Entry[];
  warnings: string[];
};

/**
 * Une passe : trois requêtes groupées, puis comparaison aux descripteurs. Une
 * seule requête en panne fait échouer la passe entière : aucune entrée partielle
 * n'est écrite, et `a_jour_au` ne peut pas avancer sur une lecture incomplète.
 */
export async function passeEurlex(options: PasseEurlexOptions = {}): Promise<ResultatPasseEurlex> {
  const actes = actesSuivis(options.dossierCorpus);
  const adequation = lireDescripteurAdequation(options.descripteurAdequation);
  const endpoint = options.endpoint ?? ENDPOINT_SPARQL;
  const dateMin = options.dateMin ?? DATE_MIN;
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const datePasse = (options.maintenant ?? new Date()).toISOString().slice(0, 10);

  const lire = async (categorie: keyof ReponsesEurlex, requete: string): Promise<unknown> => {
    const fournie = options.reponses?.[categorie];
    return fournie !== undefined ? fournie : fetchSparql(endpoint, requete, categorie, fetchImpl);
  };

  const [consolidationsLues, nouveauxLus, modificationsLues] = await Promise.all([
    lire("consolidations", requeteConsolidations(actes)),
    lire("nouveaux", requeteNouveauxActes(dateMin)),
    lire("modifications", requeteModifications(dateMin)),
  ]);

  const consolidations = lireConsolidations(consolidationsLues);
  const { entrees: nouvelles, avertissements } = detecterNouveauxActes(
    actes,
    adequation,
    lireNouveauxActes(nouveauxLus),
    datePasse,
  );

  return {
    raw: [consolidationsLues, nouveauxLus, modificationsLues].map((reponse) =>
      JSON.stringify(reponse, null, 2),
    ),
    entries: [
      ...detecterConsolidations(actes, consolidations, datePasse),
      ...detecterModifications(actes, consolidations, lireModifications(modificationsLues), datePasse),
      ...nouvelles,
    ],
    warnings: avertissements,
  };
}
