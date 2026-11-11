/**
 * Nature d'une délibération CNIL : sanction, avis ou recommandation.
 *
 * La nature est une métadonnée filtrante, pas un corpus : elle est comparée
 * sans casse (`AVIS` vaut `Avis`) et conserve l'étiquette déclarée par le
 * descripteur, seule forme citée dans les chemins et le manifeste.
 */

/** Nature qui porte les métadonnées de sanction. */
export const SANCTION = "Sanction";

/** Forme comparable d'une nature : espaces retirés, casse ignorée. */
export function natureComparable(nature: string | null | undefined): string {
  return String(nature ?? "")
    .trim()
    .toLocaleLowerCase("fr");
}

/** Vrai si `nature` appartient à l'ensemble demandé, à la casse près. */
export function natureDemandee(
  nature: string | null | undefined,
  natures: readonly string[],
): boolean {
  const cherchee = natureComparable(nature);
  if (cherchee === "") return false;
  return natures.some((valeur) => natureComparable(valeur) === cherchee);
}

/** Vrai si la nature est une sanction : seules celles-ci portent type, montant et injonction. */
export function estSanction(nature: string | null | undefined): boolean {
  return natureComparable(nature) === natureComparable(SANCTION);
}

/**
 * Étiquette d'une nature : celle du descripteur quand elle y figure, sinon la
 * valeur de la source. Une nature absente rend `""`.
 */
export function libelleNature(
  nature: string | null | undefined,
  natures: readonly string[],
): string {
  const brute = String(nature ?? "").trim();
  if (brute === "") return "";
  return natures.find((valeur) => natureComparable(valeur) === natureComparable(brute)) ?? brute;
}
