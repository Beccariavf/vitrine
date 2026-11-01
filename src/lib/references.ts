/**
 * Texte officiel d'une référence juridique : une table statique, dérivée au
 * build. Le site ne lit aucune API au runtime ; une référence inconnue reste
 * un texte, jamais un lien deviné.
 */

import { instrumentOf } from "../../veille/themes.ts";

/** Instruments nommés, avec leur texte officiel : Légifrance pour les codes, EUR-Lex pour l'Union. */
const OFFICIAL: Readonly<Record<string, string>> = {
  "Règlement (UE) 2016/679": "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679",
  "Loi Informatique et Libertés": "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006068624",
  "Code des postes et des communications électroniques":
    "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070987",
  "Directive 2002/58/CE": "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32002L0058",
  "Code de la consommation": "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069565",
};

/** `Règlement (UE) 2024/1689`, `Directive 2002/58/CE` : un acte dérivé, adressé par son numéro CELEX. */
const EUROPEAN_ACT =
  /^(Règlement|Directive)\s*(?:\((?:UE|CE|CEE|Euratom)\))?\s*(?:n[o°]\s*)?(\d{1,4})\/(\d{1,4})(?:\/[A-Z]+)?$/;

/** CELEX d'un acte dérivé : `3` + année sur quatre chiffres + `L` ou `R` + numéro sur quatre. */
function celexUrl(type: string, year: string, number: string): string {
  const fullYear = String(year.length < 4 ? 1900 + Number(year) : Number(year));
  const letter = type === "Directive" ? "L" : "R";
  return `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:3${fullYear}${letter}${number.padStart(4, "0")}`;
}

/**
 * URL du texte officiel d'une référence (`Instrument · art. …`), ou `null` quand
 * l'instrument n'est pas connu : la pastille reste alors un texte.
 */
export function referenceUrl(reference: string): string | null {
  const instrument = instrumentOf(reference).trim();
  const known = OFFICIAL[instrument];
  if (known !== undefined) return known;

  const act = EUROPEAN_ACT.exec(instrument);
  if (act === null) return null;
  return celexUrl(act[1] ?? "", act[2] ?? "", act[3] ?? "");
}
