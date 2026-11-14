/**
 * Parse une décision du fonds CONSTIT (`TEXTE_JURI_CONSTIT`) et la filtre.
 *
 * L'archive contient toutes les décisions du Conseil constitutionnel : le
 * contentieux électoral (AN, SEN), les lois organiques (ORGA), les lois (L) et
 * les autres natures n'entrent pas au corpus. Seules les décisions DC et QPC,
 * datées valablement, portant un mot-clé du descripteur ou l'association « vie
 * privée » + une expression de traitement de données, deviennent des unités.
 *
 * Le filtre de pertinence lit le texte publié entier (décision, saisines,
 * observations), parce que la saisine porte souvent la formulation « données
 * personnelles » que les motifs reprennent en termes généraux. Les unités, elles,
 * sont découpées dans le `BLOC_TEXTUEL` seul : les saisines et observations sont
 * des écritures de parties, hors du périmètre du corpus.
 */

import { XMLParser } from "fast-xml-parser";
import type { Unite } from "../parse.ts";
import { texteVisible } from "../parse.ts";
import { decouperParagraphes } from "../cnil/parse.ts";
import { contientMotCle, normaliserComparaison } from "../texte.ts";

/** Métadonnées du corpus Conseil constitutionnel, lues depuis `descripteur.json`. */
export type DescripteurConstit = {
  corpus: string;
  nom: string;
  titre: string;
  url_liste: string;
  motif_archive: string;
  natures_retenues: string[];
  mots_cles: string[];
  terme_vie_privee: string;
  expressions_vie_privee: string[];
  licence: string;
  licence_source: string;
  max_entree_octets: number;
};

/** Une décision telle que CONSTIT la publie, avant filtrage. */
export type DecisionConstit = {
  id: string;
  nature: string;
  numero: string;
  titre: string;
  date: string;
  solution: string;
  juridiction: string;
  ecli: string;
  url: string;
  /** Paragraphes de la décision seule, dans l'ordre du document. */
  paragraphes: string[];
  /** Texte publié entier, saisines et observations comprises : support du filtre. */
  textePublie: string;
};

/** Motif d'écart d'une décision, tel que le manifeste le compte. */
export type MotifEcart =
  | "nature_ecartee"
  | "date_invalide"
  | "texte_vide"
  | "sans_mot_cle";

export type Ecartes = Record<MotifEcart, number>;

export const ECARTES_VIDES: Ecartes = {
  nature_ecartee: 0,
  date_invalide: 0,
  texte_vide: 0,
  sans_mot_cle: 0,
};

export type Verdict =
  | { retenue: true; decision: DecisionConstit }
  | { retenue: false; motif: MotifEcart };

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const parseur = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  stopNodes: ["*.CONTENU"],
});

function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : null;
}

/** Premier élément quand la DILA répète une balise, sinon la valeur elle-même. */
function premier(valeur: unknown): unknown {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}

function texteDe(valeur: unknown): string {
  const brut = premier(valeur);
  if (typeof brut === "string") return brut.trim();
  if (typeof brut === "number") return String(brut);
  const porteur = objet(brut);
  const texte = porteur?.["#text"];
  return typeof texte === "string" ? texte.trim() : "";
}

/** Paragraphes d'un `CONTENU` : les `<p>` quand il y en a, sinon les `<br/>`. */
function paragraphesContenu(contenu: string): string[] {
  const avecP = [...contenu.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((trouve) => texteVisible(trouve[1] ?? ""))
    .filter((texte) => texte !== "");
  if (avecP.length > 0) return avecP;

  const parBr = contenu
    .split(/<br\s*\/?>/i)
    .map((segment) => texteVisible(segment))
    .filter((texte) => texte !== "");
  if (parBr.length > 0) return parBr;

  const entier = texteVisible(contenu);
  return entier === "" ? [] : [entier];
}

/** Contenu textuel d'un bloc `<CONTENU>` d'un `<TEXTE>` CONSTIT. */
function contenuDe(bloc: Record<string, unknown> | null): string {
  return bloc === null ? "" : texteDe(bloc.CONTENU);
}

/**
 * URL officielle de la décision. La DILA publie `URL_CC` en `http` ; la même
 * adresse répond en `https`. À défaut, l'URL Légifrance `cons/id/<id>` est
 * déclarée, non vérifiée (403 aux robots).
 */
export function urlOfficielleConstit(id: string, urlCc: string): string {
  const propre = urlCc.trim();
  if (propre !== "") return propre.replace(/^http:\/\//i, "https://");
  return `https://www.legifrance.gouv.fr/cons/id/${id}`;
}

/**
 * Lit une décision CONSTIT. Lève si l'identifiant manque : une entrée sans
 * identité ne peut pas devenir une référence citable.
 */
export function parseDecisionConstit(
  xml: string,
  nomFichier = "TEXTE_JURI_CONSTIT",
): DecisionConstit {
  const document = objet(parseur.parse(xml));
  const racine = objet(document?.TEXTE_JURI_CONSTIT);
  if (racine === null) throw new Error(`${nomFichier} : XML illisible ou sans TEXTE_JURI_CONSTIT`);

  const meta = objet(racine.META);
  const commun = objet(meta?.META_COMMUN);
  const spec = objet(meta?.META_SPEC);
  const juri = objet(spec?.META_JURI);
  const juriConstit = objet(spec?.META_JURI_CONSTIT);
  const texte = objet(racine.TEXTE);
  const bloc = objet(texte?.BLOC_TEXTUEL);
  const saisines = objet(texte?.SAISINES);
  const observations = objet(texte?.OBSERVATIONS);

  const id = texteDe(commun?.ID);
  if (id === "") throw new Error(`${nomFichier} : META_COMMUN/ID absent`);

  const contenu = contenuDe(bloc);
  return {
    id,
    nature: texteDe(commun?.NATURE).toUpperCase(),
    numero: texteDe(juri?.NUMERO),
    titre: texteDe(juri?.TITRE),
    date: texteDe(juri?.DATE_DEC).slice(0, 10),
    solution: texteDe(juri?.SOLUTION),
    juridiction: texteDe(juri?.JURIDICTION),
    ecli: texteDe(juriConstit?.ECLI),
    url: urlOfficielleConstit(id, texteDe(juriConstit?.URL_CC)),
    paragraphes: paragraphesContenu(contenu),
    textePublie: [contenu, contenuDe(saisines), contenuDe(observations)]
      .filter((partie) => partie !== "")
      .join("\n"),
  };
}

/** Vrai si la nature fait partie des natures retenues par le descripteur. */
export function natureRetenue(nature: string, descripteur: DescripteurConstit): boolean {
  const forme = normaliserComparaison(nature);
  return descripteur.natures_retenues.some(
    (retenue) => normaliserComparaison(retenue) === forme,
  );
}

/**
 * Filtre de pertinence du spike : un mot-clé du corpus Conseil d'État, ou
 * « vie privée » associé à une expression de traitement de données. La
 * comparaison ignore casse et accents ; elle reste volontairement large, un
 * tiers des retenues ne citant un mot-clé qu'une fois.
 */
export function pertinent(texte: string, descripteur: DescripteurConstit): boolean {
  if (contientMotCle(texte, descripteur.mots_cles)) return true;
  return (
    contientMotCle(texte, [descripteur.terme_vie_privee]) &&
    contientMotCle(texte, descripteur.expressions_vie_privee)
  );
}

/**
 * Classe une décision. L'ordre des motifs est stable : nature, date, texte,
 * filtre ; une décision n'est comptée que dans la première catégorie qui la
 * concerne. Aucune date n'est écartée pour son ancienneté.
 */
export function classerDecision(
  decision: DecisionConstit,
  descripteur: DescripteurConstit,
): Verdict {
  if (!natureRetenue(decision.nature, descripteur)) {
    return { retenue: false, motif: "nature_ecartee" };
  }
  if (!DATE_ISO.test(decision.date) || Number.isNaN(Date.parse(decision.date))) {
    return { retenue: false, motif: "date_invalide" };
  }
  if (decision.paragraphes.length === 0) return { retenue: false, motif: "texte_vide" };
  if (!pertinent(decision.textePublie, descripteur)) {
    return { retenue: false, motif: "sans_mot_cle" };
  }
  return { retenue: true, decision };
}

/**
 * Mappe une décision retenue en fragments adressables. Le découpage est local
 * (600 à 1 200 caractères) ; la référence porte l'identifiant CONSTIT et le
 * rang du fragment. Le numéro inclut la nature (`2018-765 DC`), pour que deux
 * décisions de même numéro restent distinctes.
 */
export function unitesConstit(
  decision: DecisionConstit,
  descripteur: DescripteurConstit,
): Unite[] {
  const numero = `${decision.numero} ${decision.nature}`.trim();
  const chemin = `${descripteur.nom} > Décision ${numero}`;
  const statut =
    decision.solution === ""
      ? `Décision ${decision.nature}`
      : `Décision ${decision.nature} · ${decision.solution}`;
  return decouperParagraphes(decision.paragraphes).map((texte, index) => ({
    ref: `${decision.id}#f${index}`,
    document: decision.id,
    corpus: descripteur.corpus,
    niveau: "fragment",
    numero,
    chemin,
    texte,
    date_acte: decision.date,
    date_debut: decision.date,
    date_fin: null,
    statut,
    url: decision.url,
    nature: decision.nature,
  }));
}
