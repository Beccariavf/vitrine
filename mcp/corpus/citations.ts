/**
 * Citations d'une décision : les instruments et les articles que son texte
 * nomme, lus au niveau du document et attribués par la proposition qui les
 * porte.
 *
 * La précision prime. Un article n'est retenu que si son instrument suit
 * immédiatement le connecteur français (`du`, `de la`, `de l'`, `des`) — ou,
 * forme anglaise, `of` —, ou si l'instrument précède sa liste dans la même
 * proposition ou le même en-tête. Un instrument hors périmètre, un article de
 * code pénal antérieur à 226-16 ou une anaphore ambiguë ne produisent rien :
 * une liste vide est préférée à une attribution inventée.
 *
 * L'extraction se fait à la lecture, sans index ni stockage. Le cache ne garde
 * que les citations par document, jamais le texte.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Unite } from "./parse.ts";

/** Un instrument cité, avec ses articles et son lien officiel. */
export type Citation = {
  /** Libellé court : `RGPD`, `loi 78-17`, `CPCE`… */
  instrument: string;
  /** Articles normalisés, dans l'ordre de rencontre et sans doublon. */
  articles: string[];
  /** Forme affichable : `RGPD · art. 6, 12`. */
  reference: string;
  /** Lien officiel de l'instrument ; `null` quand il n'en a pas. */
  url: string | null;
};

/** Une citation telle que la mesure la relit : sa référence et son passage. */
export type Attribution = {
  reference: string;
  /** Le passage du document qui a produit la citation. */
  extrait: string;
};

/** Nature d'un instrument : le mot qui porte son type, pour une anaphore. */
type Nature = "règlement" | "directive" | "loi" | "code";

type Instrument = {
  /** Libellé court rendu, aussi court que la forme citée. */
  libelle: string;
  nature: Nature;
  url: string | null;
  /**
   * Formes reconnues, en sources de regex : elles sont groupées et ancrées par
   * les fonctions ci-dessous, jamais employées telles quelles.
   */
  alias: readonly string[];
  /**
   * Sigles admis sans connecteur après l'article, forme anglaise
   * (`Article 6 GDPR`) ou tableau (`article 82 LIL`).
   */
  sigle?: readonly string[];
};

/**
 * Le périmètre fermé, dans l'ordre de rendu : un article d'un autre instrument
 * n'est jamais rendu, même correctement attribué.
 */
const INSTRUMENTS: readonly Instrument[] = [
  {
    libelle: "RGPD",
    nature: "règlement",
    url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679",
    alias: [
      "RGPD",
      "GDPR",
      "règlement général sur la protection des données",
      "règlement \\((?:UE|CE)\\) (?:général sur la protection des données|(?:n[o°] ?)?2016/679)",
      "règlement (?:(?:UE|CE) )?(?:n[o°] ?)?2016/679",
      "Regulation \\(EU\\) (?:n[o°] ?)?2016/679",
      "Regulation 2016/679",
    ],
    sigle: ["RGPD", "GDPR"],
  },
  {
    libelle: "directive 95/46/CE",
    nature: "directive",
    url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:31995L0046",
    alias: [
      "directive (?:\\((?:CE|UE|CEE)\\) )?(?:n[o°] ?)?95/46(?:/(?:CE|EC))?",
      "directive (?:du Parlement européen et du Conseil )?(?:n[o°] ?)?du 24 octobre 1995",
    ],
  },
  {
    libelle: "ePrivacy",
    nature: "directive",
    url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32002L0058",
    alias: [
      "directive (?:\\((?:CE|UE)\\) )?(?:n[o°] ?)?2002/58(?:/(?:CE|EC))?",
      "directive e-?privacy",
      "directive (?:du Parlement européen et du Conseil )?(?:n[o°] ?)?du 12 juillet 2002",
      "e-?privacy",
    ],
    sigle: ["e-?privacy"],
  },
  {
    libelle: "2016/680",
    nature: "directive",
    url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016L0680",
    alias: ["directive (?:\\((?:UE|CE)\\) )?(?:n[o°] ?)?2016/680"],
  },
  {
    libelle: "2018/1725",
    nature: "règlement",
    url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32018R1725",
    alias: ["règlement (?:\\((?:UE|CE)\\) )?(?:n[o°] ?)?2018/1725"],
  },
  {
    libelle: "loi 78-17",
    nature: "loi",
    url: "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006068624",
    alias: [
      "loi (?:n[o°] ?)?78-17",
      "loi informatique et libertés",
      "loi (?:n[o°] ?78-17 )?(?:du )?6 janvier 1978",
    ],
  },
  {
    libelle: "CPCE",
    nature: "code",
    url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070987",
    alias: [
      "code des postes et des communications électroniques",
      "code des postes et télécommunications",
      "CPCE",
    ],
    sigle: ["CPCE"],
  },
  {
    libelle: "code pénal",
    nature: "code",
    url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070719",
    alias: ["code pénal"],
  },
];

const PAR_LIBELLE = new Map(INSTRUMENTS.map((instrument) => [instrument.libelle, instrument]));

/** Les corpus dont les documents sont des décisions, seuls porteurs de citations. */
export const CORPUS_DECISIONS: readonly string[] = ["cnil", "ce", "cc", "cjue", "cepd"];

/** Vrai si le corpus porte des décisions citant des textes. */
export function estCorpusDecision(corpus: string): boolean {
  return CORPUS_DECISIONS.includes(corpus);
}

/** Lien officiel d'un instrument, `null` quand le libellé est inconnu. */
export function urlOfficielle(libelle: string): string | null {
  return PAR_LIBELLE.get(libelle)?.url ?? null;
}

/** Regex groupée d'un instrument, pour balayer tout le texte. */
function balayage(instrument: Instrument): RegExp {
  return new RegExp(`(?:${instrument.alias.join("|")})`, "gi");
}

/** Regex ancrée : l'alias doit commencer à la position testée. */
function ancrage(alias: readonly string[]): RegExp {
  return new RegExp(`^(?:${alias.join("|")})`, "i");
}

/** Un alias ancré par instrument, évalué après le connecteur ou sans lui. */
const ANCRAGES = new Map(INSTRUMENTS.map((instrument) => [instrument.libelle, ancrage(instrument.alias)]));
const ANCRAGES_SIGLES = new Map(
  INSTRUMENTS.filter((instrument) => (instrument.sigle ?? []).length > 0).map((instrument) => [
    instrument.libelle,
    ancrage(instrument.sigle ?? []),
  ]),
);

const BALAYAGES = INSTRUMENTS.map((instrument) => ({ instrument, motif: balayage(instrument) }));

/**
 * Numéro d'article : `6`, `1er`, `L. 34-5`, `226-16`, `6.1`, `R. 431-5`.
 * Un groupe suivi de `°` est un point d'énumération, pas un sous-numéro :
 * « l'article 4-2° de la loi » cite l'article 4, point 2°.
 */
const NUMERO = "(?:[LRD]\\. ?)?\\d{1,4}(?:er)?(?:[.-]\\d{1,4}(?!°))*";

/** Liste ou plage d'articles, « et suivants » compris. */
const LISTE = `${NUMERO}(?: ?(?:,|et|ou|à|–) ?${NUMERO}| +- +${NUMERO})*(?: et suivants?)?`;

/** `article 6`, `articles 8 et 20`, `art. L. 34-5`, `Article 6` : la liste seule. */
const ARTICLE = new RegExp(`\\b(?:articles?|art\\.?) (${LISTE})`, "gi");

/** La liste ancrée, pour l'en-tête « Directive 95/46/CE — Articles 2, 4 ». */
const LISTE_ANCRÉE = new RegExp(`^(?:${LISTE})`, "i");

/** Connecteur qui fait suivre l'article de son instrument. */
const CONNECTEUR = /^(?:du|de la|de l['’]|des|of) /i;

/** Anaphore : « du même règlement », « de la même directive ». */
const ANAPHORE = /^même (règlement|directive|loi|code)s?\b/i;

/** En-tête : l'instrument précède sa liste. */
const ENTETE =
  /^ ?(?:[—–,:] ?)?(?:et )?(?:notamment )?(?:(?:ses|son|en ses|dans ses|aux) )?(?:articles?|art\.?) /i;

/**
 * En-tête long : « la loi n° 78-17 du 6 janvier 1978 relative à …, notamment
 * son article 31 ». Le titre officiel sépare l'instrument de sa liste ; la
 * fenêtre s'arrête à la ponctuation forte et ne franchit aucun autre acte.
 */
const ENTETE_LONG =
  /^([^.;:!?]{0,120}?)(?:,? ?(?:et )?notamment (?:ses|son) articles? )/i;

/** Un acte qui enchâsse la mention : le titre du décret porte la loi qu'il applique. */
const ACTE_ENCHASSANT = /\b(?:décret|arrêté|ordonnance)\b/i;

/** Formule de renvoi qui fait de la mention le titre d'un autre acte. */
const RENVOI = /(?:application|modification|modifiant|modifiée? par|en application|conformément) (?:de )?(?:la |le |l')?$/i;

/** Un acte européen nommé : il compte pour une anaphore, il ne cite pas. */
const ACTE_GENERIQUE =
  /(règlement|directive) (?:\\((?:UE|CE|CEE|Euratom)\\) )?(?:n[o°] ?)?(\d{1,4}\/\d{1,4}(?:\/[A-Z]{2,4})?)/gi;

/** Une loi numérotée nommée hors du périmètre. */
const LOI_NUMEROTEE = /loi (?:n[o°] ?)?(\d{1,4}-\d{1,4})/gi;

/** Un code nommé, dans la limite de ce qu'un nom de code porte. */
const CODE_NOMME =
  /code (?:de la|de l['’]|des|du|pénal)(?: (?!et |ou |le |la |les |du |au |aux )[a-zéèêàâçùûôîïœ'’-]+){0,4}/gi;

/** Un acte nommé : sa présence dans un titre signale un autre texte que le périmètre. */
const AUTRE_ACTE =
  /\b(?:règlement|directive|loi|décret|arrêté|ordonnance|code|charte|convention|traité|constitution|RGPD|GDPR|CPCE|LIL|e-?privacy)\b/i;

/** Longueur maximale d'un nom d'instrument, en-tête et connecteur compris. */
const FENETRE = 120;

/** Fenêtre d'un en-tête : l'instrument, son titre officiel et sa liste d'articles. */
const FENETRE_ENTETE = 220;

/** Ramène le texte à une forme comparable : espaces simples, apostrophes droites. */
function normaliser(texte: string): string {
  return texte.replace(/[\u00a0\u00ad]/g, " ").replace(/[’‘]/g, "'").replace(/[ \t]+/g, " ");
}

/** Position du premier caractère non blanc, sans franchir une fin de fragment. */
function sansBlancs(texte: string, debut: number, limite: number): number {
  let position = debut;
  while (position < limite && texte[position] === " ") position += 1;
  return position;
}

/** Instrument reconnu à cette position, ou `null`. */
function instrumentEn(
  texte: string,
  position: number,
  sigleSeulement: boolean,
): { instrument: Instrument; fin: number } | null {
  const fenetre = texte.slice(position, position + FENETRE);
  const table = sigleSeulement ? ANCRAGES_SIGLES : ANCRAGES;
  for (const instrument of INSTRUMENTS) {
    const motif = table.get(instrument.libelle);
    if (motif === undefined) continue;
    const trouve = motif.exec(fenetre);
    if (trouve === null) continue;
    return { instrument, fin: position + trouve[0].length };
  }
  return null;
}

/** Normalise un numéro d'article : `L.34-5` devient `L. 34-5`. */
function normaliserArticle(valeur: string): string {
  return valeur.replace(/ +/g, " ").replace(/^([LRD])\. ?/i, "$1. ").trim();
}

/** Découpe une liste ou une plage d'articles, « et suivants » compris. */
function numerosArticles(liste: string): string[] {
  const suffixe = / et suivants?$/i.exec(liste);
  const coeur = suffixe === null ? liste : liste.slice(0, suffixe.index);
  const trouves = [
    ...coeur.matchAll(/[LRD]\. ?\d+(?:er)?(?:[.-]\d+)*|\d+(?:er)?(?:[.-]\d+)*/gi),
  ].map((trouve) => ({
    texte: normaliserArticle(trouve[0]),
    debut: trouve.index ?? 0,
    fin: (trouve.index ?? 0) + trouve[0].length,
  }));

  // « 12 à 22 » devient une plage, y compris au milieu d'une liste.
  const articles: string[] = [];
  for (let rang = 0; rang < trouves.length; rang += 1) {
    const courant = trouves[rang];
    const suivant = trouves[rang + 1];
    if (courant === undefined) continue;
    if (
      suivant !== undefined &&
      /^ ?(?:à|–|-) ?$/.test(coeur.slice(courant.fin, suivant.debut))
    ) {
      articles.push(`${courant.texte}–${suivant.texte}`);
      rang += 1;
      continue;
    }
    articles.push(courant.texte);
  }
  return articles;
}

/**
 * Article du code pénal retenu : la série 226 à partir de 226-16, seule visée
 * par le périmètre. Un article de la partie « atteintes aux systèmes » ou du
 * code de procédure pénale reste dehors.
 */
function articlePenalRetenu(article: string): boolean {
  const trouve = /^(\d+)(?:-(\d+))?/.exec(article);
  if (trouve === null) return false;
  const majeur = Number(trouve[1]);
  const mineur = trouve[2] === undefined ? 0 : Number(trouve[2]);
  return majeur === 226 && mineur >= 16;
}

/** Articles rendus pour un instrument : le code pénal garde son filtre. */
function articlesRetenus(instrument: Instrument, articles: readonly string[]): string[] {
  if (instrument.libelle !== "code pénal") return [...articles];
  return articles.filter(articlePenalRetenu);
}

/**
 * Un article simple déjà couvert par une plage du même instrument n'est pas
 * répété : « articles 12 à 22 … article 12 » rend `12–22`, pas `12–22, 12`.
 */
function sansDoublonsDePlage(articles: readonly string[]): string[] {
  const plages = articles.map((article) => {
    const trouve = /^(\d{1,4})(?:er)?–(\d{1,4})(?:er)?$/.exec(article);
    return trouve === null ? null : { debut: Number(trouve[1]), fin: Number(trouve[2]) };
  });
  return articles.filter((article, rang) => {
    const simple = /^(\d{1,4})(?:er)?$/.exec(article);
    if (simple === null) return true;
    const valeur = Number(simple[1]);
    return !plages.some(
      (plage, autre) =>
        plage !== null && autre !== rang && valeur >= plage.debut && valeur <= plage.fin,
    );
  });
}

/** Une attribution trouvée dans le texte, avant composition par instrument. */
type Trouvaille = { position: number; instrument: Instrument; articles: string[] };

/**
 * Vrai si la mention est le titre d'un autre acte : « le décret … pris pour
 * l'application de la loi du 6 janvier 1978 » ne cite pas l'article que ce
 * décret applique.
 */
function mentionEnchâssée(texte: string, debut: number): boolean {
  const avant = texte.slice(Math.max(0, debut - 120), debut);
  const coupe = Math.max(
    avant.lastIndexOf("."),
    avant.lastIndexOf(";"),
    avant.lastIndexOf(":"),
    avant.lastIndexOf("?"),
    avant.lastIndexOf("!"),
    avant.lastIndexOf("\n"),
  );
  const proposition = coupe === -1 ? avant : avant.slice(coupe + 1);
  return ACTE_ENCHASSANT.test(proposition) || RENVOI.test(proposition);
}

/** Ajoute les articles qui suivent une liste, à la position de cette liste. */
function pousserArticles(
  trouvailles: Trouvaille[],
  instrument: Instrument,
  reste: string,
  position: number,
): void {
  const liste = LISTE_ANCRÉE.exec(reste);
  if (liste === null) return;
  const articles = numerosArticles(liste[0]);
  if (articles.length > 0) trouvailles.push({ position, instrument, articles });
}

/** Identifiant d'un acte générique, ramené au libellé du catalogue s'il en est. */
function identifiantActe(nature: Nature, brut: string): string {
  for (const instrument of INSTRUMENTS) {
    if (instrument.nature !== nature) continue;
    const motif = ANCRAGES.get(instrument.libelle);
    if (motif !== undefined && motif.test(brut)) return instrument.libelle;
  }
  return brut.toLowerCase().replace(/ +/g, " ");
}

/** Libellé d'un code nommé : le catalogue s'il le connaît, le texte sinon. */
function identifiantCode(brut: string): string {
  for (const instrument of INSTRUMENTS) {
    if (instrument.nature !== "code") continue;
    const motif = ANCRAGES.get(instrument.libelle);
    if (motif !== undefined && motif.test(brut)) return instrument.libelle;
  }
  return brut.toLowerCase().replace(/ +/g, " ");
}

/**
 * Instruments nommés par le texte, par nature. Une anaphore ne se résout que
 * si une seule identité y figure : deux règlements nommés la laissent béante.
 */
function naturesNommees(texte: string): Map<Nature, Set<string>> {
  const parNature = new Map<Nature, Set<string>>([
    ["règlement", new Set<string>()],
    ["directive", new Set<string>()],
    ["loi", new Set<string>()],
    ["code", new Set<string>()],
  ]);
  const ajouter = (nature: Nature, identifiant: string): void => {
    parNature.get(nature)?.add(identifiant);
  };

  for (const { instrument, motif } of BALAYAGES) {
    for (const _trouve of texte.matchAll(motif)) ajouter(instrument.nature, instrument.libelle);
  }
  for (const trouve of texte.matchAll(ACTE_GENERIQUE)) {
    const nature = (trouve[1] ?? "").toLowerCase() as Nature;
    ajouter(nature, identifiantActe(nature, trouve[0]));
  }
  for (const trouve of texte.matchAll(LOI_NUMEROTEE)) {
    ajouter("loi", identifiantActe("loi", trouve[0]));
  }
  for (const trouve of texte.matchAll(CODE_NOMME)) ajouter("code", identifiantCode(trouve[0]));

  return parNature;
}

/** Instrument que désigne une anaphore, seulement si sa nature est univoque. */
function resoudreAnaphore(nature: Nature, nommes: Map<Nature, Set<string>>): Instrument | null {
  const identifiants = nommes.get(nature) ?? new Set<string>();
  if (identifiants.size !== 1) return null;
  const [identifiant] = identifiants;
  const instrument = PAR_LIBELLE.get(identifiant ?? "");
  return instrument === undefined || instrument.nature !== nature ? null : instrument;
}

/** Articles attribués par « l'article 6 du règlement … ». */
function articlesAvantInstrument(
  texte: string,
  nommes: Map<Nature, Set<string>>,
  trouvailles: Trouvaille[],
): void {
  for (const trouve of texte.matchAll(ARTICLE)) {
    const articles = numerosArticles(trouve[1] ?? "");
    if (articles.length === 0) continue;

    const position = trouve.index ?? 0;
    const finListe = position + trouve[0].length;
    const depart = sansBlancs(texte, finListe, finListe + 4);
    const connecteur = CONNECTEUR.exec(texte.slice(depart, depart + 8));
    if (connecteur === null) {
      // Sans connecteur, seul un sigle suffit : « Article 6 GDPR ».
      const sigle = instrumentEn(texte, depart, true);
      if (sigle !== null) trouvailles.push({ position, instrument: sigle.instrument, articles });
      continue;
    }

    const apres = depart + connecteur[0].length;
    const anaphore = ANAPHORE.exec(texte.slice(apres, apres + 20));
    if (anaphore !== null) {
      const nature = (anaphore[1] ?? "").toLowerCase() as Nature;
      const instrument = resoudreAnaphore(nature, nommes);
      if (instrument !== null) trouvailles.push({ position, instrument, articles });
      continue;
    }

    const cible = instrumentEn(texte, apres, false);
    if (cible !== null) trouvailles.push({ position, instrument: cible.instrument, articles });
  }
}

/** Articles attribués par « Directive 95/46/CE — Articles 2, 4, 12 et 14 ». */
function instrumentAvantArticles(texte: string, trouvailles: Trouvaille[]): void {
  for (const { instrument, motif } of BALAYAGES) {
    for (const trouve of texte.matchAll(motif)) {
      const debut = trouve.index ?? 0;
      // La loi citée dans le titre d'un décret n'est pas celle que le visa applique.
      if (mentionEnchâssée(texte, debut)) continue;

      const fin = debut + trouve[0].length;
      const fenetre = texte.slice(fin, fin + FENETRE_ENTETE);
      const entete = ENTETE.exec(fenetre);
      if (entete !== null) {
        pousserArticles(trouvailles, instrument, fenetre.slice(entete[0].length), fin + entete[0].length);
        continue;
      }

      const long = ENTETE_LONG.exec(fenetre);
      if (long === null) continue;
      // Le titre qui sépare l'instrument de sa liste ne doit porter aucun autre acte.
      if (AUTRE_ACTE.test(long[1] ?? "")) continue;
      pousserArticles(trouvailles, instrument, fenetre.slice(long[0].length), fin + long[0].length);
    }
  }
}

/** Toutes les attributions du texte, dans l'ordre de rencontre. */
function attributions(texte: string): Trouvaille[] {
  const normalise = normaliser(texte);
  const nommes = naturesNommees(normalise);
  const trouvailles: Trouvaille[] = [];
  articlesAvantInstrument(normalise, nommes, trouvailles);
  instrumentAvantArticles(normalise, trouvailles);
  return trouvailles.sort((gauche, droite) => gauche.position - droite.position);
}

/** Compose les citations : instruments dans l'ordre du périmètre, articles rencontrés. */
function composer(trouvailles: readonly Trouvaille[]): Citation[] {
  const parInstrument = new Map<string, string[]>();

  for (const trouvaille of trouvailles) {
    const retenus = articlesRetenus(trouvaille.instrument, trouvaille.articles);
    if (retenus.length === 0) continue;
    const articles = parInstrument.get(trouvaille.instrument.libelle) ?? [];
    for (const article of retenus) {
      if (!articles.includes(article)) articles.push(article);
    }
    parInstrument.set(trouvaille.instrument.libelle, articles);
  }

  const citations: Citation[] = [];
  for (const instrument of INSTRUMENTS) {
    const articles = sansDoublonsDePlage(parInstrument.get(instrument.libelle) ?? []);
    if (articles.length === 0) continue;
    citations.push({
      instrument: instrument.libelle,
      articles,
      reference: `${instrument.libelle} · art. ${articles.join(", ")}`,
      url: instrument.url,
    });
  }
  return citations;
}

/**
 * Extrait les instruments et articles que le texte nomme, chacun avec son lien
 * officiel. Un texte sans attribution reconnue rend `[]`.
 */
export function extraireCitations(texte: string): Citation[] {
  return composer(attributions(texte));
}

/** Passage qui porte l'attribution : la proposition, coupée court. */
function passageAutour(texte: string, position: number): string {
  const debut = Math.max(0, position - 100);
  const fin = Math.min(texte.length, position + 100);
  const extrait = texte.slice(debut, fin).replace(/ +/g, " ").trim();
  return `${debut > 0 ? "…" : ""}${extrait}${fin < texte.length ? "…" : ""}`;
}

/**
 * Les mêmes attributions, avec le passage qui les porte : c'est la vue que
 * relit la mesure, pour juger chaque citation sur son contexte.
 */
export function extraireAttributions(texte: string): Attribution[] {
  const normalise = normaliser(texte);
  const vues = new Set<string>();
  const attributionsUtiles: Attribution[] = [];
  for (const trouvaille of attributions(normalise)) {
    // La mesure relit ce qui est rendu : le filtre du code pénal s'applique ici aussi.
    const articles = articlesRetenus(trouvaille.instrument, trouvaille.articles);
    if (articles.length === 0) continue;
    const reference = `${trouvaille.instrument.libelle} · art. ${articles.join(", ")}`;
    const extrait = passageAutour(normalise, trouvaille.position);
    const cle = `${reference}\u0000${extrait}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    attributionsUtiles.push({ reference, extrait });
  }
  return attributionsUtiles;
}

/** Citations d'un document, lues dans ses unités. */
export function citationsDesUnites(unites: readonly Unite[]): Citation[] {
  if (unites.length === 0) return [];
  return extraireCitations(unites.map((unite) => unite.texte).join("\n"));
}

type CacheCorpus = {
  mtimeMs: number;
  taille: number;
  /** Carte partagée : elle est en lecture seule pour les appelants. */
  parDocument: ReadonlyMap<string, Citation[]>;
};

/** Cache par fichier de corpus : les seules citations, jamais le texte. */
const CACHE = new Map<string, CacheCorpus>();

/**
 * Citations de chaque document d'un corpus de décisions, indexées par
 * identifiant. Un corpus hors périmètre, ou un fichier absent, rend une carte
 * vide. Le cache suit le chemin du fichier et sa date de modification : deux
 * appels successifs ne relisent rien, une modification se voit à l'appel
 * suivant.
 */
export function citationsDuCorpus(rootDir: string, corpus: string): ReadonlyMap<string, Citation[]> {
  if (!estCorpusDecision(corpus)) return new Map();

  const chemin = join(rootDir, "data", "corpus", corpus, "unites.jsonl");
  let etat: ReturnType<typeof statSync>;
  try {
    etat = statSync(chemin);
  } catch {
    return new Map();
  }

  const cache = CACHE.get(chemin);
  if (cache !== undefined && cache.mtimeMs === etat.mtimeMs && cache.taille === etat.size) {
    return cache.parDocument;
  }

  const unites = new Map<string, Unite[]>();
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    if (ligne.trim() === "") continue;
    const unite = JSON.parse(ligne) as Unite;
    const liste = unites.get(unite.document) ?? [];
    liste.push(unite);
    unites.set(unite.document, liste);
  }

  const parDocument = new Map<string, Citation[]>();
  for (const [document, fragments] of unites) parDocument.set(document, citationsDesUnites(fragments));
  CACHE.set(chemin, { mtimeMs: etat.mtimeMs, taille: etat.size, parDocument });
  return parDocument;
}
