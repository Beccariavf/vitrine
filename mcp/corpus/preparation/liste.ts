/**
 * Liste les textes de l'Union en préparation et les affaires pendantes
 * relatives aux données personnelles, par SPARQL sur CELLAR, et lit les
 * réponses en entrées classées.
 *
 * Une proposition est rattachée à son dossier par deux propriétés — l'acte
 * initie le dossier, ou le dossier contient l'acte —, et un dossier peut porter
 * plusieurs propositions, dont un corrigendum : une seule proposition par
 * dossier est retenue. Seuls les dossiers en cours (`PROP_PENDING`) et non
 * retirés entrent au corpus ; tout le reste est écarté avec son motif. Une
 * affaire n'est écartée que si une décision `CJ`/`CO` (Cour) ou `TJ`/`TO`
 * (Tribunal) de même année et de même numéro CELEX a été rendue : le corpus ne
 * présente jamais comme pendante une affaire jugée, ni comme rendue une affaire
 * pendante.
 */

import type { FetchLike } from "../../../veille/fetch.ts";

/** Métadonnées du corpus, lues depuis `mcp/corpus/preparation/descripteur.json`. */
export type DescripteurPreparation = {
  corpus: string;
  nom: string;
  titre: string;
  endpoint_sparql: string;
  /** URI de la matière CELLAR, par exemple `.../subject-matter/PDON`. */
  matiere: string;
  matiere_libelle: string;
  /** Actes dont la proposition de modification entre au corpus, avec leur libellé court. */
  actes_du_corpus: Array<{ celex: string; libelle: string }>;
  /** Notions Eurovoc qui marquent une affaire de données personnelles. */
  eurovoc: string[];
  /** Borne basse des affaires listées, incluse. */
  depuis_affaires: string;
  /** Au-delà de ce nombre d'années sans décision, une affaire est dite présumée pendante. */
  presomption_annees: number;
  licence: string;
  /** URL Curia d'un numéro d'affaire, `{numero}` remplacé à l'écriture. */
  url_curia: string;
  /** Attente entre deux téléchargements, en millisecondes. */
  delai_ms: number;
  langues: string[];
};

/** Une proposition lue, avant regroupement par dossier. */
export type PropositionListee = {
  /** URI du dossier de procédure. */
  dossier: string;
  /** Référence interinstitutionnelle, par exemple `2025/0360/COD`. */
  ref: string;
  celex: string;
  /** Statut du dossier, lu en fin d'URI (`PROP_PENDING`…) ; `null` s'il est absent. */
  statut: string | null;
  /** Vrai quand le dossier marque la proposition comme retirée. */
  retire: boolean;
  date: string | null;
  titre: string | null;
  /** Langue du titre retenu ; `fr` est préférée, un titre anglais sert de repli. */
  langueTitre: string | null;
  /** CELEX des actes que la proposition propose de modifier, dédoublonnés. */
  actesVises: string[];
};

/** Une étape de la procédure d'un dossier. */
export type EtapeDossier = {
  dossier: string;
  date: string;
  /** Type lu en fin d'URI (`event_legal_type`) ; `null` si l'étape n'est pas typée. */
  type: string | null;
};

/** Une affaire listée par CELLAR, avant lecture de sa communication. */
export type AffaireListee = {
  celex: string;
  date: string;
  /** `CN` devant la Cour, `TN` devant le Tribunal. */
  type: "CN" | "TN";
  /** Types de procédure portés par la communication (`fd_100/PVOI` pour un pourvoi). */
  procedures: string[];
  /** CELEX de la décision attaquée, quand la communication le déclare. */
  attackedCelex: string | null;
};

/** Motif d'écart d'un document, proposition ou affaire. */
export type MotifEcartPreparation =
  | "retiree"
  | "adoptee"
  | "rejetee"
  | "statut_absent"
  | "autre"
  | "decision_rendue"
  | "capture_absente"
  | "date_invalide"
  | "texte_vide";

/** Comptes par motif ; toutes les clés sont présentes, à zéro. */
export type EcartesPreparation = Record<MotifEcartPreparation, number>;

export const ECARTES_PREPARATION_VIDES: EcartesPreparation = {
  retiree: 0,
  adoptee: 0,
  rejetee: 0,
  statut_absent: 0,
  autre: 0,
  decision_rendue: 0,
  capture_absente: 0,
  date_invalide: 0,
  texte_vide: 0,
};

/** Libellé d'une étape que la source ne type pas. */
export const ETAPE_NON_TYPEE = "étape non typée";

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
/** CELEX d'une affaire ou d'une décision : `6` + année + type + numéro. */
const CELEX_JURIDICTION = /^6(\d{4})([A-Z]{2})(\d{4})/;

type Binding = { value?: unknown };
type ReponseSparql = { results?: { bindings?: unknown } };

/** Lignes d'une réponse SPARQL ; vide quand la réponse n'a pas la forme attendue. */
export function lignesSparql(reponse: unknown): Array<Record<string, Binding>> {
  if (typeof reponse !== "object" || reponse === null) return [];
  const results = (reponse as ReponseSparql).results;
  if (typeof results !== "object" || results === null) return [];
  const liste = (results as { bindings?: unknown }).bindings;
  return Array.isArray(liste) ? (liste as Array<Record<string, Binding>>) : [];
}

/** Valeur textuelle non vide d'une variable ; `null` sinon. */
function valeur(ligne: Record<string, Binding>, nom: string): string | null {
  const brut = ligne[nom]?.value;
  return typeof brut === "string" && brut.trim() !== "" ? brut : null;
}

/** Dernier segment d'une URI, ou la valeur telle quelle quand ce n'en est pas une. */
function valeurCourte(valeurBrute: string): string {
  if (!/^https?:\/\//i.test(valeurBrute)) return valeurBrute;
  const sansFin = valeurBrute.replace(/\/+$/, "");
  const index = sansFin.lastIndexOf("/");
  return index < 0 ? sansFin : sansFin.slice(index + 1);
}

/**
 * Référence interinstitutionnelle d'un dossier. CELLAR la sert en littéral
 * (`2025/0360/COD`) ou en URI, dont le code garde ses barres obliques : le motif
 * est cherché dans l'URI avant de retomber sur son dernier segment.
 */
function referenceProcedure(valeurBrute: string): string {
  const motif = /(\d{4}\/\d{4}\/[A-Z]{3})/.exec(valeurBrute);
  return motif?.[1] ?? valeurCourte(valeurBrute);
}

/** Jour ISO d'une date ou d'un horodatage CELLAR ; `null` si la date est illisible. */
export function dateIso(valeurBrute: string | null): string | null {
  if (valeurBrute === null) return null;
  const jour = valeurBrute.slice(0, 10);
  return DATE_ISO.test(jour) && !Number.isNaN(Date.parse(jour)) ? jour : null;
}

/**
 * Requête SPARQL des propositions : les deux propriétés de rattachement au
 * dossier, restreintes à la matière PDON ou aux actes du corpus. Le filtre sur
 * `amendCelex` garde les propositions de modification d'un acte du corpus,
 * même quand CELLAR ne les classe pas dans la matière.
 */
export function requetePropositions(descripteur: DescripteurPreparation): string {
  const actes = descripteur.actes_du_corpus.map((acte) => `"${acte.celex}"`).join(",");
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?dossier ?ref ?statut ?retire ?celex ?date ?titre ?langue ?amendCelex WHERE {
  { ?celexWork cdm:act_preparatory_initiates_dossier ?dossier }
  UNION
  { ?dossier cdm:dossier_contains_work ?celexWork }
  ?celexWork cdm:resource_legal_type ?type .
  FILTER(STR(?type) = "PC")
  ?celexWork cdm:resource_legal_id_celex ?celex .
  ?dossier cdm:procedure_code_interinstitutional_reference_procedure ?ref .
  OPTIONAL { ?dossier cdm:procedure_code_interinstitutional_has_status_file-status ?statut }
  OPTIONAL { ?dossier cdm:dossier_withdrawn-proposal ?retire }
  OPTIONAL { ?celexWork cdm:work_date_document ?date }
  OPTIONAL { ?celexWork cdm:work_title ?titre . BIND(LANG(?titre) AS ?langue) }
  OPTIONAL { ?celexWork cdm:resource_legal_proposes_to_amend_resource_legal ?amend . ?amend cdm:resource_legal_id_celex ?amendCelex }
  BIND(EXISTS { ?celexWork cdm:resource_legal_is_about_subject-matter <${descripteur.matiere}> } AS ?pdon)
  FILTER(?pdon = true || STR(?amendCelex) IN (${actes}))
}`;
}

/** Requête SPARQL des étapes des dossiers retenus. */
export function requeteEvenements(dossiers: readonly string[]): string {
  const valeurs = dossiers.map((dossier) => `<${dossier}>`).join(" ");
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?dossier ?date ?type WHERE {
  VALUES ?dossier { ${valeurs} }
  ?evenement cdm:event_legal_part_of_dossier ?dossier .
  ?evenement cdm:event_legal_date ?date .
  OPTIONAL { ?evenement cdm:event_legal_type ?type }
}`;
}

/** Requête SPARQL des affaires pendantes de la matière, depuis la borne du descripteur. */
export function requeteAffaires(descripteur: DescripteurPreparation): string {
  const eurovoc = descripteur.eurovoc
    .map((uri) => `STR(?ev) = "${uri}"`)
    .join(" || ");
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?date ?type ?procedure ?attackedCelex WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:resource_legal_type ?type .
  FILTER(STR(?type) = "CN" || STR(?type) = "TN")
  ?work cdm:work_date_document ?date .
  FILTER(STR(?date) >= "${descripteur.depuis_affaires}")
  ?work cdm:work_is_about_concept_eurovoc ?ev .
  FILTER(${eurovoc})
  OPTIONAL { ?work cdm:communication_cjeu_has_type_procedure_concept_type_procedure ?procedure }
  OPTIONAL { ?work cdm:communication_case_new_requests_review_of_decision_case-law ?attacked . ?attacked cdm:resource_legal_id_celex ?attackedCelex }
}`;
}

/** Requête SPARQL des décisions rendues une année donnée, pour apparier les affaires. */
export function requeteDecisions(annee: string): string {
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(REGEX(STR(?celex), "^6${annee}(CJ|CO|TJ|TO)"))
}`;
}

/** Propositions d'une réponse SPARQL, dédupliquées par dossier et CELEX. */
export function lirePropositions(reponse: unknown): PropositionListee[] {
  const parCle = new Map<string, PropositionListee>();
  for (const ligne of lignesSparql(reponse)) {
    const dossier = valeur(ligne, "dossier");
    const celex = valeur(ligne, "celex");
    if (dossier === null || celex === null) continue;
    const cle = `${dossier}\t${celex}`;
    const amend = valeur(ligne, "amendCelex");
    const titre = valeur(ligne, "titre");
    const langue = valeur(ligne, "langue");
    const connue = parCle.get(cle);
    if (connue !== undefined) {
      // Une proposition modifie souvent plusieurs actes : chaque ligne apporte
      // le sien ; le titre français l'emporte sur un titre dans une autre langue.
      if (amend !== null && !connue.actesVises.includes(amend)) connue.actesVises.push(amend);
      if (titre !== null && (connue.titre === null || (langue === "fr" && connue.langueTitre !== "fr"))) {
        connue.titre = titre;
        connue.langueTitre = langue;
      }
      continue;
    }
    const statut = valeur(ligne, "statut");
    const retire = valeur(ligne, "retire");
    parCle.set(cle, {
      dossier,
      ref: referenceProcedure(valeur(ligne, "ref") ?? ""),
      celex,
      statut: statut === null ? null : valeurCourte(statut),
      retire: retire !== null && (retire === "1" || retire.toLowerCase() === "true"),
      date: dateIso(valeur(ligne, "date")),
      titre,
      langueTitre: langue,
      actesVises: amend === null ? [] : [amend],
    });
  }
  return [...parCle.values()];
}

/** Propositions regroupées par dossier. */
export function regrouperParDossier(
  propositions: readonly PropositionListee[],
): Map<string, PropositionListee[]> {
  const groupes = new Map<string, PropositionListee[]>();
  for (const proposition of propositions) {
    const groupe = groupes.get(proposition.dossier);
    if (groupe === undefined) groupes.set(proposition.dossier, [proposition]);
    else groupe.push(proposition);
  }
  return groupes;
}

/**
 * Un corrigendum (`R(01)`) corrige la proposition de base sans la remplacer :
 * il n'est choisi que si le dossier n'en porte aucune autre.
 */
function estCorrigendum(celex: string): boolean {
  return /R\(\d+\)$/.test(celex);
}

/**
 * Une seule proposition par dossier : le CELEX de base d'abord, puis l'ordre
 * des identifiants et des dates. Le choix est stable d'une passe à l'autre.
 */
export function choisirProposition(candidats: readonly PropositionListee[]): PropositionListee {
  const triees = [...candidats].sort(
    (gauche, droite) =>
      Number(estCorrigendum(gauche.celex)) - Number(estCorrigendum(droite.celex)) ||
      gauche.celex.localeCompare(droite.celex) ||
      (gauche.date ?? "").localeCompare(droite.date ?? ""),
  );
  const premiere = triees[0];
  if (premiere === undefined) throw new Error("Aucune proposition à choisir pour un dossier");
  return premiere;
}

/**
 * Classe une proposition. Un retrait prime sur le statut : un dossier retiré
 * n'est jamais en cours, quel que soit le statut affiché. Puis `PROP_PENDING`
 * est retenu, `PROP_REJECTED` et `PROP_ADOPTED` sont écartés, un statut absent
 * et tout autre statut aussi.
 */
export function classerProposition(
  proposition: PropositionListee,
):
  | { retenue: true }
  | { retenue: false; motif: MotifEcartPreparation } {
  if (proposition.retire) return { retenue: false, motif: "retiree" };
  if (proposition.statut === "PROP_PENDING") return { retenue: true };
  if (proposition.statut === null) return { retenue: false, motif: "statut_absent" };
  if (proposition.statut === "PROP_REJECTED") return { retenue: false, motif: "rejetee" };
  if (proposition.statut === "PROP_ADOPTED") return { retenue: false, motif: "adoptee" };
  return { retenue: false, motif: "autre" };
}

/** Étapes d'une réponse SPARQL, dédupliquées ; une date illisible est ignorée. */
export function lireEvenements(reponse: unknown): EtapeDossier[] {
  const parCle = new Map<string, EtapeDossier>();
  for (const ligne of lignesSparql(reponse)) {
    const dossier = valeur(ligne, "dossier");
    const date = dateIso(valeur(ligne, "date"));
    if (dossier === null || date === null) continue;
    const typeBrut = valeur(ligne, "type");
    const type = typeBrut === null ? null : valeurCourte(typeBrut);
    const cle = `${dossier}\t${date}\t${type ?? ""}`;
    if (parCle.has(cle)) continue;
    parCle.set(cle, { dossier, date, type });
  }
  return [...parCle.values()];
}

/**
 * Dernière étape d'un dossier à la date de la passe : l'événement de date
 * maximale qui n'est pas postérieur à cette date, les étapes planifiées étant
 * ignorées. À date égale, l'ordre des types tranche.
 */
export function derniereEtape(
  etapes: readonly EtapeDossier[],
  dateDePasse: string,
): EtapeDossier | null {
  const passees = etapes
    .filter((etape) => etape.date <= dateDePasse)
    .sort(
      (gauche, droite) =>
        gauche.date.localeCompare(droite.date) ||
        (gauche.type ?? "").localeCompare(droite.type ?? ""),
    );
  return passees[passees.length - 1] ?? null;
}

/** Affaires d'une réponse SPARQL, dédupliquées par CELEX. */
export function lireAffaires(reponse: unknown): AffaireListee[] {
  const parCle = new Map<string, AffaireListee>();
  for (const ligne of lignesSparql(reponse)) {
    const celex = valeur(ligne, "celex");
    if (celex === null) continue;
    const detail = CELEX_JURIDICTION.exec(celex);
    if (detail === null) continue;
    const type = detail[2] === "TN" ? "TN" : detail[2] === "CN" ? "CN" : null;
    const date = dateIso(valeur(ligne, "date"));
    if (type === null || date === null) continue;

    const procedureBrut = valeur(ligne, "procedure");
    const attaque = valeur(ligne, "attackedCelex");
    const connue = parCle.get(celex);
    if (connue === undefined) {
      parCle.set(celex, {
        celex,
        date,
        type,
        procedures: procedureBrut === null ? [] : [procedureBrut],
        attackedCelex: attaque,
      });
      continue;
    }
    // Une communication peut porter plusieurs types de procédure et plusieurs
    // décisions attaquées : la première ligne ne suffit pas.
    if (procedureBrut !== null && !connue.procedures.includes(procedureBrut)) {
      connue.procedures.push(procedureBrut);
    }
    connue.attackedCelex ??= attaque;
  }
  return [...parCle.values()];
}

/** Lettre de juridiction d'un type CELEX : Cour (`C`) ou Tribunal (`T`). */
const LETTRES_JURIDICTION: Record<string, string> = {
  CJ: "C",
  CO: "C",
  CC: "C",
  CN: "C",
  TJ: "T",
  TO: "T",
  TN: "T",
};

/** Numéro lisible d'un CELEX de juridiction (`62025CN0703` → `C-703/25`). */
export function numeroDepuisCelex(celex: string): string | null {
  const detail = CELEX_JURIDICTION.exec(celex);
  if (detail === null) return null;
  const [, annee, type, numero] = detail;
  if (annee === undefined || type === undefined || numero === undefined) return null;
  const lettre = LETTRES_JURIDICTION[type];
  if (lettre === undefined) return null;
  return `${lettre}-${Number(numero)}/${annee.slice(2)}`;
}

/** Vrai quand la procédure marque un pourvoi (`fd_100/PVOI`). */
export function estPourvoi(procedures: readonly string[]): boolean {
  return procedures.some((procedure) => procedure.includes("/fd_100/PVOI"));
}

/** Numéro d'affaire lisible, suffixé ` P` devant la formation de pourvoi. */
export function numeroAffaire(affaire: AffaireListee): string {
  const numero = numeroDepuisCelex(affaire.celex);
  if (numero === null) return affaire.celex;
  return estPourvoi(affaire.procedures) ? `${numero} P` : numero;
}

/**
 * Clé d'appariement d'une affaire avec sa décision : juridiction, année et
 * numéro CELEX. La lettre de juridiction est indispensable — `C-1/19` et
 * `T-1/19` sont deux affaires différentes —, et le numéro CELEX vaut mieux que
 * le dossier, absent avant 2023.
 */
export function cleAffaire(celex: string): string | null {
  const detail = CELEX_JURIDICTION.exec(celex);
  if (detail === null) return null;
  const [, annee, type, numero] = detail;
  if (annee === undefined || type === undefined || numero === undefined) return null;
  const lettre = LETTRES_JURIDICTION[type];
  return lettre === undefined ? null : `${lettre}${annee}${numero}`;
}

/** Clés des décisions rendues (`CJ`, `CO`, `TJ`, `TO`), appareillables aux affaires. */
export function clesDecisions(reponse: unknown): Set<string> {
  const cles = new Set<string>();
  for (const ligne of lignesSparql(reponse)) {
    const celex = valeur(ligne, "celex");
    if (celex === null) continue;
    const cle = cleAffaire(celex);
    if (cle !== null) cles.add(cle);
  }
  return cles;
}

/** Vrai quand une décision de même année et de même numéro a été rendue. */
export function decisionRendue(
  affaire: AffaireListee,
  decisions: ReadonlySet<string>,
): boolean {
  const cle = cleAffaire(affaire.celex);
  return cle !== null && decisions.has(cle);
}

/**
 * Vrai quand l'affaire dure depuis plus de `annees` années à la date de la
 * passe : comparaison en UTC, jour pour jour.
 */
export function pendantPresume(
  dateActe: string,
  dateDePasse: string,
  annees: number,
): boolean {
  const acte = Date.parse(`${dateActe}T00:00:00Z`);
  const passe = new Date(`${dateDePasse}T00:00:00Z`);
  if (Number.isNaN(acte) || Number.isNaN(passe.getTime())) return false;
  const seuil = Date.UTC(
    passe.getUTCFullYear() - annees,
    passe.getUTCMonth(),
    passe.getUTCDate(),
  );
  return acte < seuil;
}

/** Années des affaires observées, triées, pour interroger les décisions rendues. */
export function anneesObservees(affaires: readonly AffaireListee[]): string[] {
  return [...new Set(affaires.map((affaire) => affaire.celex.slice(1, 5)))].sort();
}

/** Envoie une requête SPARQL à CELLAR et rend la réponse JSON lue. */
export async function posterSparql(
  descripteur: DescripteurPreparation,
  requete: string,
  fetchImpl: FetchLike = fetch,
): Promise<unknown> {
  const reponse = await fetchImpl(descripteur.endpoint_sparql, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: requete }).toString(),
  });
  if (!reponse.ok) throw new Error(`CELLAR SPARQL : HTTP ${reponse.status}`);
  const texte = await reponse.text();
  try {
    return JSON.parse(texte) as unknown;
  } catch (error) {
    const raison = error instanceof Error ? error.message : String(error);
    throw new Error(`CELLAR SPARQL : réponse illisible (${raison})`, { cause: error });
  }
}
