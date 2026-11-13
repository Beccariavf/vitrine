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
 * vérifié. `propose` et `pendant` sont déclarés sans porteur aujourd'hui ; les
 * textes proposés et les affaires pendantes les alimenteront (#24, #56).
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

/** Corpus dont le statut source dit l'applicabilité du texte. */
const CORPUS_TEXTES: readonly string[] = ["rgpd", "aiact", "lil"];

/** Corpus dont chaque unité est une décision rendue, quel que soit le statut source. */
const CORPUS_JURIDICTIONNELS: readonly string[] = ["ce", "cc", "cjue"];

/** Statuts de source d'un texte, ramenés au vocabulaire uniforme. */
const STATUTS_TEXTES = new Map<string, StatutApplication>([
  ["EN_VIGUEUR", "en_vigueur"],
  ["VIGUEUR", "en_vigueur"],
  ["ABROGE", "abroge"],
  ["PROJET", "propose"],
  ["PROPOSE", "propose"],
  ["PROPOSITION", "propose"],
  ["PENDANT", "pendant"],
]);

/** Nature CNIL d'une sanction : elle est rendue. */
const NATURE_SANCTION = "SANCTION";

/** Natures CNIL d'une doctrine — avis, recommandation, lignes directrices — : elle est adoptée. */
const NATURES_DOCTRINE: readonly string[] = [
  "AVIS",
  "RECOMMANDATION",
  "RECOMMANDATION_LIGNES_DIRECTRICES",
];

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

/**
 * Statut d'application d'une unité. Le corpus décide d'abord : les textes
 * suivent leur statut source, les décisions juridictionnelles sont rendues. Pour
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
  if (CORPUS_TEXTES.includes(collection)) {
    return STATUTS_TEXTES.get(source) ?? "inconnu";
  }
  if (CORPUS_JURIDICTIONNELS.includes(collection)) return "rendue";
  if (collection === "cnil") {
    if (STATUTS_SANS_EFFET.includes(source)) return "abroge";
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
    return source === "FINALE" ? "adoptee" : "inconnu";
  }
  return "inconnu";
}
