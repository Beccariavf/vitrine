/**
 * Métadonnées de sanction d'une délibération CNIL, lues dans son dispositif.
 *
 * Le dispositif est la partie qui suit « PAR CES MOTIFS ». On n'y cherche ni
 * le sens ni un résumé : seulement le type de sanction, le montant de la
 * sanction pécuniaire (amende ou liquidation) et la présence d'une injonction.
 * Les montants d'astreinte (« par jour de retard ») ne sont jamais comptés.
 */

export type TypeSanction =
  | "amende"
  | "avertissement"
  | "rappel"
  | "injonction"
  | "liquidation"
  | "interruption"
  | "autre";

export type MetaSanction = {
  type_sanction: TypeSanction;
  /** Montant de la sanction pécuniaire en euros (amende ou liquidation), `null` si absent ou masqué. */
  montant: number | null;
  injonction: boolean;
};

const UNITES: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  cent: 100,
};

const MOTS_NOMBRE =
  "zéro|zero|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|" +
  "treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent|" +
  "mille|millions?|milliards?|et";

/** Phrase de nombre français, du plus long au plus court, sans « et ». */
const PHRASE_NOMBRE = new RegExp(
  `(?:${MOTS_NOMBRE})(?:[\\s-]+(?:${MOTS_NOMBRE}))*`,
  "gi",
);

/**
 * Position du début de la partie opératoire, dans le texte reçu.
 *
 * Le dernier « PAR CES MOTIFS » fait foi ; à défaut, la dernière conclusion
 * (« En conséquence », « décide de faire application »), puis la dernière
 * formule de sanction, puis les 2 500 derniers caractères. Seul l'espace
 * insécable est remplacé, ce qui conserve la longueur : la position rendue
 * reste valable dans le texte d'origine, y compris pour y découper des
 * fragments.
 */
export function debutDispositif(texte: string): number {
  const brut = texte.replace(/\u00a0/g, " ");
  const minuscules = brut.toLowerCase();

  const marque = minuscules.lastIndexOf("par ces motifs");
  if (marque !== -1) return marque;

  const conclusion = Math.max(
    minuscules.lastIndexOf("en conséquence"),
    minuscules.lastIndexOf("décide de faire application"),
  );
  if (conclusion !== -1) return conclusion;

  const sanction = Math.max(
    minuscules.lastIndexOf("sanction pécuniaire"),
    minuscules.lastIndexOf("amende administrative"),
    minuscules.lastIndexOf("adresse un avertissement"),
    minuscules.lastIndexOf("adresser un avertissement"),
    minuscules.lastIndexOf("rappel à l'ordre"),
    minuscules.lastIndexOf("injonction"),
  );
  if (sanction !== -1) return sanction;

  return Math.max(0, brut.length - 2500);
}

/** Découpe le texte à la partie opératoire ; à défaut, garde la fin. */
function dispositif(texte: string): string {
  const normalise = texte.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const repli = normalise.slice(debutDispositif(normalise));
  // La publication ne répète les montants que dans un vrai dispositif ; sur une
  // fin sans marqueur, « communiqué » peut précéder l'avertissement.
  const publication = normalise.toLowerCase().includes("par ces motifs")
    ? /\brendre\b[^.;]{0,40}\bpublique\b|\bcommuniqu[ée]\b/i.exec(repli)
    : null;
  return publication === null ? repli : repli.slice(0, publication.index);
}

/** Retire les clauses d'astreinte : leur montant n'est pas une amende. */
function sansAstreinte(texte: string): string {
  return texte
    .split(/(?<=[.;])\s+/)
    .filter((clause) => !/par jour de retard/i.test(clause))
    .join(" ; ");
}

/** Valeur d'un nombre écrit en mots, ou `null` si la phrase n'en porte aucun. */
export function nombreEnMots(phrase: string): number | null {
  const mots = phrase
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((mot) => mot !== "" && mot !== "et");

  let total = 0;
  let courant = 0;
  let vu = false;

  for (let index = 0; index < mots.length; index += 1) {
    const mot = mots[index] ?? "";
    // Quatre-vingt(-dix) et soixante-dix se lisent comme des blocs.
    if (mot === "quatre" && mots[index + 1] === "vingt") {
      const dix = mots[index + 2] === "dix";
      courant += dix ? 90 : 80;
      index += dix ? 2 : 1;
      vu = true;
      continue;
    }
    if (mot === "soixante" && mots[index + 1] === "dix") {
      courant += 70;
      index += 1;
      vu = true;
      continue;
    }

    if (mot === "million" || mot === "millions") {
      total += (courant === 0 ? 1 : courant) * 1_000_000;
      courant = 0;
      vu = true;
      continue;
    }
    if (mot === "milliard" || mot === "milliards") {
      total += (courant === 0 ? 1 : courant) * 1_000_000_000;
      courant = 0;
      vu = true;
      continue;
    }
    if (mot === "mille") {
      total += (courant === 0 ? 1 : courant) * 1_000;
      courant = 0;
      vu = true;
      continue;
    }
    if (mot === "cent" || mot === "cents") {
      courant = (courant === 0 ? 1 : courant) * 100;
      vu = true;
      continue;
    }

    const valeur = UNITES[mot];
    if (valeur !== undefined) {
      courant += valeur;
      vu = true;
    }
  }

  return vu ? total + courant : null;
}

/** Montant d'une écriture en chiffres : `6 000 000`, `2,5 millions`, `50 (cinquante) millions`. */
function montantChiffres(texte: string): number | null {
  const motif =
    /(\d{1,3}(?:[ .]\d{3})+|\d+)(?:,(\d+))?\s*\)?\s*(?:\([^)]*\)\s*)?(millions?|milliards?)?\s*(?:d[’']?euros?|euros?|€)/gi;
  const trouves: { valeur: number; index: number; fin: number }[] = [];
  for (const correspondance of texte.matchAll(motif)) {
    const entier = (correspondance[1] ?? "").replace(/[ .]/g, "");
    const decimales = correspondance[2] ?? "";
    const echelle = correspondance[3]?.toLowerCase();
    const multiplicateur =
      echelle === undefined ? 1 : echelle.startsWith("milliard") ? 1_000_000_000 : 1_000_000;
    const base = decimales === "" ? Number(entier) : Number(`${entier}.${decimales}`);
    const valeur = base * multiplicateur;
    if (!Number.isFinite(valeur) || valeur <= 0) continue;
    const index = correspondance.index ?? 0;
    const fin = index + correspondance[0].length;
    const precedent = trouves.at(-1);
    // « 1 euro (1 euro) » répète la même sanction : on ne la compte pas deux fois.
    if (precedent !== undefined && index - precedent.fin < 30 && precedent.valeur === valeur) {
      precedent.fin = fin;
      continue;
    }
    trouves.push({ valeur, index, fin });
  }
  if (trouves.length === 0) return null;

  // Un montant total suivi de sa décomposition, ou annoncé comme somme totale,
  // ne s'additionne pas à ses composantes.
  for (const trouve of trouves) {
    const avant = texte.slice(Math.max(0, trouve.index - 80), trouve.index);
    const suite = texte.slice(trouve.fin, trouve.fin + 180);
    if (/ensemble des manquements|se d[ée]compose/i.test(suite) || /somme totale/i.test(avant)) {
      return Math.round(trouve.valeur);
    }
  }

  return Math.round(trouves.reduce((total, trouve) => total + trouve.valeur, 0));
}

/** Montant écrit uniquement en mots, dans la dernière phrase avant « euros ». */
function montantMots(texte: string): number | null {
  let meilleur: number | null = null;
  for (const correspondance of texte.matchAll(PHRASE_NOMBRE)) {
    const suite = texte.slice(
      (correspondance.index ?? 0) + correspondance[0].length,
      (correspondance.index ?? 0) + correspondance[0].length + 40,
    );
    if (!/^\s*(?:\([^)]*\)\s*)?(?:d[’']?euros?|euros?|€)/i.test(suite)) continue;
    const valeur = nombreEnMots(correspondance[0]);
    if (valeur !== null && valeur > 0) meilleur = valeur;
  }
  return meilleur;
}

/** Type de sanction du dispositif, par ordre de priorité. */
function typeSanction(texte: string): TypeSanction {
  if (
    /\bamende\s+administrative|sanction\s+p[ée]cuniaire|sanction\s+d[’']un\s+montant/i.test(texte)
  ) {
    return "amende";
  }
  if (
    /liquidation\s+de\s+l[’']astreinte|(?:n[’']y\s+avoir|n[’']y\s+a\s+pas)\s+lieu\s+[àa]\s+liquidation|pas\s+lieu\s+[àa]\s+liquidation/i.test(
      texte,
    )
  ) {
    return "liquidation";
  }
  if (/ordonner\s+l[’']interruption/i.test(texte)) return "interruption";
  if (/\bavertissement\b/i.test(texte)) return "avertissement";
  if (/rappel\s+[àa]\s+l[’']ordre/i.test(texte)) return "rappel";
  if (/\binjonction\b/i.test(texte)) return "injonction";
  return "autre";
}

/**
 * Lit le dispositif d'une décision CNIL. Le type et l'injonction sont toujours
 * rendus ; le montant ne l'est que pour une amende ou une liquidation, et vaut
 * `null` quand le dispositif le masque (`[…]`) ou n'en porte aucun.
 */
export function extraireMetaSanction(texte: string): MetaSanction {
  const corps = dispositif(texte);
  const type_sanction = typeSanction(corps);
  const injonction = /\binjonction\b|\benjoi(?:nt|ndre|gne|gn)/i.test(corps);
  const utile = sansAstreinte(corps);
  const montant =
    type_sanction === "amende" || type_sanction === "liquidation"
      ? (montantChiffres(utile) ?? montantMots(utile))
      : null;
  return { type_sanction, montant, injonction };
}

/** Valeur entière non négative pour les colonnes `vec0` ; `-1` si inconnue. */
export function montantIndex(montant: number | null): number {
  return montant === null ? -1 : Math.max(0, Math.trunc(montant));
}

/** Date ISO en `AAAAMMJJ` pour un filtre de plage dans `vec0` ; `0` si illisible. */
export function dateIndex(date: string): number {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (correspondance === null) return 0;
  const annee = Number(correspondance[1]);
  const mois = Number(correspondance[2]);
  const jour = Number(correspondance[3]);
  const valeur = new Date(Date.UTC(annee, mois - 1, jour));
  if (
    valeur.getUTCFullYear() !== annee ||
    valeur.getUTCMonth() !== mois - 1 ||
    valeur.getUTCDate() !== jour
  ) {
    return 0;
  }
  return annee * 10_000 + mois * 100 + jour;
}

/** Numéro comparable pour `vec0` : tirets normalisés, majuscules. */
export function numeroIndex(numero: string): string {
  return numero.replace(/[–—]/g, "-").trim().toUpperCase();
}
