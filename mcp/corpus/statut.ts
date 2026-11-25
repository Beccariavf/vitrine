/**
 * Statut d'application d'une unité : ce que le serveur peut affirmer de son
 * applicabilité, distinct du statut que porte la source.
 *
 * La table est lue au rendu, par `mcp/tools.ts`, à partir des champs déjà
 * présents sur chaque unité (`corpus`, `statut`, `nature`) : aucun réindex,
 * aucune synchronisation, aucune écriture dans `data/`. Le statut source n'est
 * jamais réécrit — un statut de publication, un type d'acte ou un statut
 * Légifrance restent lisibles à côté —, et une valeur non reconnue rend
 * `inconnu`, jamais `en_vigueur` : le serveur n'affirme pas ce qu'il n'a pas
 * vérifié. `propose` porte les documents CEPD soumis à consultation et les
 * textes en préparation ; `pendant` les affaires pendantes (#56).
 */

/** Vocabulaire uniforme du statut d'application, sans accents comme les autres valeurs du serveur. */
export type StatutApplication =
  | "en_vigueur"
  | "abroge"
  | "propose"
  | "pendant"
  | "rendue"
  | "adoptee"
  | "inconnu";

/** Les sept valeurs, dans l'ordre du contrat. */
export const STATUTS_APPLICATION: readonly StatutApplication[] = [
  "en_vigueur",
  "abroge",
  "propose",
  "pendant",
  "rendue",
  "adoptee",
  "inconnu",
];

/**
 * Mise en garde rendue avec chaque passage du corpus `preparation` : un texte
 * proposé n'est pas applicable, une affaire pendante n'est pas une décision
 * rendue. Le libellé est un champ frère de `texte`, jamais un préfixe.
 */
export function mentionPreparation(statut: StatutApplication): string {
  if (statut === "propose") return "Texte non applicable — proposition en cours de procédure";
  if (statut === "pendant") return "Affaire pendante — aucune décision rendue";
  return "Texte en préparation — statut non reconnu";
}

/** Corpus dont le statut source dit l'applicabilité du texte. */
const CORPUS_TEXTES: readonly string[] = [
  "rgpd",
  "aiact",
  "lil",
  "eprivacy",
  "police",
  "eudpr",
  "rgpdproc",
  "textes_fr",
  "ccs",
  "adequation",
  "donnees",
];

/** Corpus dont chaque unité est une décision rendue, quel que soit le statut source. */
const CORPUS_JURIDICTIONNELS: readonly string[] = ["ce", "constit", "cc", "cjue"];

/** Statuts de source d'un texte, ramenés au vocabulaire uniforme. */
const STATUTS_TEXTES = new Map<string, StatutApplication>([
  ["EN_VIGUEUR", "en_vigueur"],
  ["VIGUEUR", "en_vigueur"],
  ["ABROGE", "abroge"],
  // Une recommandation n'a pas de force obligatoire : elle est adoptée, pas en vigueur.
  ["ADOPTEE", "adoptee"],
  ["PROJET", "propose"],
  ["PROPOSE", "propose"],
  ["PROPOSITION", "propose"],
  ["PENDANT", "pendant"],
]);

/** Nature CNIL d'une sanction : elle est rendue. */
const NATURE_SANCTION = "SANCTION";

/** Nature d'une unité du corpus `metadonnees` : une décision juridictionnelle, rendue. */
const NATURE_JURIDICTION = "JURIDICTION";

/** Nature d'une unité du corpus `metadonnees` : une décision d'autorité, adoptée. */
const NATURE_AUTORITE = "AUTORITE";

/** Natures CNIL d'une doctrine — avis, recommandation, lignes directrices, référentiel — : elle est adoptée. */
const NATURES_DOCTRINE: readonly string[] = [
  "AVIS",
  "RECOMMANDATION",
  "RECOMMANDATION_LIGNES_DIRECTRICES",
  "REFERENTIEL_REGLEMENT_TYPE_NORME",
];

/** Préfixe du statut posé sur une MR remplacée : « Remplacée par 2026-050 ». */
const STATUT_REMPLACEE = "REMPLACEE_PAR";

/**
 * Forme comparable d'une valeur de source : majuscules, sans diacritique,
 * séparateurs — espaces, tirets, ponctuation — ramenés à `_`. « Abrogé »,
 * « abroge » et « EN-VIGUEUR » se comparent ainsi.
 */
function formeComparable(valeur: string | null | undefined): string {
  return String(valeur ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Statuts de source qui disent qu'une unité ne s'applique plus. */
const STATUTS_SANS_EFFET: readonly string[] = ["ABROGE", "ANNULE"];

/** Statuts d'un document CEPD adopté : ligne directrice, avis, décision, recommandation. */
const STATUTS_CEPD_ADOPTES: readonly string[] = [
  "FINALE",
  "ADOPTE",
  "ADOPTEE",
  "ADOPTED",
  "ENDOSSE",
  "ENDORSED",
  "APPROUVE",
  "APPROVED",
];

/** Statuts d'un document CEPD encore soumis à consultation. */
const STATUTS_CEPD_CONSULTATION: readonly string[] = [
  "PROJET",
  "PROJET_DE_CONSULTATION",
  "DRAFT",
  "CONSULTATION",
  "PUBLIC_CONSULTATION",
  "EN_CONSULTATION",
];

/**
 * Statut d'application d'une unité. Le corpus décide d'abord : les textes
 * suivent leur statut source, les décisions juridictionnelles sont rendues, la
 * doctrine publiée de la CNIL est adoptée. Le corpus `metadonnees` n'a que des
 * métadonnées : sa nature tranche — une décision de la CEDH est rendue, une
 * décision du guichet unique est adoptée —, sans jamais lire de texte. Pour
 * la CNIL et le CEPD, un statut sans effet (`ABROGE`, `ANNULE`) prime sur la
 * nature — une recommandation abrogée ne s'applique plus —, puis la nature ou la
 * version tranche. Un statut modifié rend `inconnu` : la version rendue n'est pas
 * nécessairement celle en vigueur. Tout le reste — corpus inconnu, statut non
 * reconnu, nature CNIL absente — rend `inconnu`, jamais `en_vigueur`, sans lever.
 */
export function statutApplication(
  corpus: string,
  statut: string,
  nature?: string,
): StatutApplication {
  const collection = String(corpus ?? "")
    .trim()
    .toLowerCase();
  const source = formeComparable(statut);
  // La préparation ne rend jamais applicable un texte proposé, ni rendue une
  // affaire pendante : la branche précède les textes et ne connaît que ces deux
  // statuts ; tout le reste est `inconnu`.
  if (collection === "preparation") {
    if (source === "PROPOSE") return "propose";
    if (source === "PENDANT") return "pendant";
    return "inconnu";
  }
  if (CORPUS_TEXTES.includes(collection)) {
    return STATUTS_TEXTES.get(source) ?? "inconnu";
  }
  if (CORPUS_JURIDICTIONNELS.includes(collection)) return "rendue";
  // La doctrine publiée (guides, référentiels, listes AIPD) est adoptée par la
  // CNIL ; un statut sans effet la retire. Le reste n'est pas reconnu.
  if (collection === "cnil_doctrine") {
    if (STATUTS_SANS_EFFET.includes(source)) return "abroge";
    return source === "PUBLIE" ? "adoptee" : "inconnu";
  }
  if (collection === "cnil") {
    if (STATUTS_SANS_EFFET.includes(source)) return "abroge";
    // Une MR remplacée garde son texte : elle ne s'applique plus.
    if (source.startsWith(STATUT_REMPLACEE)) return "abroge";
    // Une délibération modifiée n'est rendue ici que dans sa version d'origine.
    if (source !== "VIGUEUR") return "inconnu";
    const natureComparable = formeComparable(nature);
    if (natureComparable === NATURE_SANCTION) return "rendue";
    if (NATURES_DOCTRINE.includes(natureComparable)) return "adoptee";
    // Une nature absente ou inconnue ne dit pas si la délibération est rendue ou adoptée.
    return "inconnu";
  }
  if (collection === "cepd") {
    if (STATUTS_SANS_EFFET.includes(source)) return "abroge";
    // Un avis art. 64, une décision art. 65, une recommandation ou une ligne
    // directrice adoptés sont adoptés ; un texte en consultation n'est pas adopté.
    if (STATUTS_CEPD_ADOPTES.includes(source)) return "adoptee";
    if (STATUTS_CEPD_CONSULTATION.includes(source)) return "propose";
    return "inconnu";
  }
  if (collection === "metadonnees") {
    // Le corpus ne porte que des métadonnées : le statut suit la nature du
    // document cité, jamais son texte, que le serveur ne connaît pas.
    const natureComparable = formeComparable(nature);
    if (natureComparable === NATURE_JURIDICTION) return "rendue";
    if (natureComparable === NATURE_AUTORITE) return "adoptee";
    return "inconnu";
  }
  return "inconnu";
}
