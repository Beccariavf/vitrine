/**
 * Parse une décision du fonds JADE (`TEXTE_JURI_ADMIN`) et la filtre.
 *
 * JADE publie dans le même dossier les décisions du Conseil d'État, des cours
 * administratives d'appel et des tribunaux administratifs. Seules les décisions
 * du Conseil d'État, datées au moins du `date_min` et portant un mot-clé du
 * descripteur, deviennent des unités. Une décision écartée est comptée par
 * motif, jamais devinée.
 */

import { XMLParser } from "fast-xml-parser";
import { texteVisible } from "../parse.ts";
import type { Unite } from "../parse.ts";
import { decouperParagraphes } from "../cnil/parse.ts";

/** Métadonnées du corpus CE, lues depuis `mcp/corpus/ce/descripteur.json`. */
export type DescripteurCe = {
  corpus: string;
  nom: string;
  titre: string;
  url_liste: string;
  motif_archive: string;
  url_texte: string;
  date_min: string;
  juridiction: string;
  juridictions_exclues: string[];
  mots_cles: string[];
  licence: string;
  max_entree_octets: number;
};

/** Une décision telle que JADE la publie, avant filtrage. */
export type DecisionJade = {
  id: string;
  titre: string;
  date: string;
  juridiction: string;
  numero: string;
  solution: string;
  publiRecueil: string;
  /** Paragraphes non vides, dans l'ordre du document. */
  paragraphes: string[];
};

/** Motif d'écart d'une décision, tel que le manifeste le compte. */
export type MotifEcart =
  | "autre_juridiction"
  | "avant_borne"
  | "date_invalide"
  | "sans_mot_cle"
  | "texte_vide";

export type Ecartes = Record<MotifEcart, number>;

export const ECARTES_VIDES: Ecartes = {
  autre_juridiction: 0,
  avant_borne: 0,
  date_invalide: 0,
  sans_mot_cle: 0,
  texte_vide: 0,
};

export type Verdict =
  | { retenue: true; decision: DecisionJade }
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

/**
 * Forme comparable d'une chaîne : minuscules, sans diacritiques, ponctuation
 * ramenée à une espace. « Conseil d'État » y devient « conseil d etat ».
 */
export function normaliserComparaison(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function contientExpression(texte: string, expression: string): boolean {
  return ` ${texte} `.includes(` ${expression} `);
}

/** Vrai si la juridiction est exactement le Conseil d'État, exclusions comprises. */
export function estConseilEtat(juridiction: string, descripteur: DescripteurCe): boolean {
  const forme = normaliserComparaison(juridiction);
  for (const exclue of descripteur.juridictions_exclues) {
    if (contientExpression(forme, normaliserComparaison(exclue))) return false;
  }
  return forme === normaliserComparaison(descripteur.juridiction);
}

/** Vrai si le texte contient au moins un mot-clé, à la casse et aux accents près. */
export function contientMotCle(texte: string, motsCles: readonly string[]): boolean {
  const forme = normaliserComparaison(texte);
  return motsCles.some((motCle) => {
    const cherche = normaliserComparaison(motCle);
    return cherche !== "" && forme.includes(cherche);
  });
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

/**
 * Lit une décision JADE. Lève si l'identifiant manque : une entrée sans
 * identité ne peut pas devenir une référence citable.
 */
export function parseDecisionJade(xml: string, nomFichier = "TEXTE_JURI_ADMIN"): DecisionJade {
  const document = objet(parseur.parse(xml));
  const racine = objet(document?.TEXTE_JURI_ADMIN);
  if (racine === null) throw new Error(`${nomFichier} : XML illisible ou sans TEXTE_JURI_ADMIN`);

  const meta = objet(racine.META);
  const commun = objet(meta?.META_COMMUN);
  const spec = objet(meta?.META_SPEC);
  const juri = objet(spec?.META_JURI);
  const texte = objet(racine.TEXTE);
  const bloc = objet(texte?.BLOC_TEXTUEL);

  const id = texteDe(commun?.ID);
  if (id === "") throw new Error(`${nomFichier} : META_COMMUN/ID absent`);

  const contenu = texteDe(bloc?.CONTENU);
  return {
    id,
    titre: texteDe(juri?.TITRE),
    date: texteDe(juri?.DATE_DEC).slice(0, 10),
    juridiction: texteDe(juri?.JURIDICTION),
    numero: texteDe(juri?.NUMERO),
    solution: texteDe(juri?.SOLUTION),
    publiRecueil: texteDe(juri?.PUBLI_RECUEIL),
    paragraphes: paragraphesContenu(contenu),
  };
}

/**
 * Classe une décision. L'ordre des motifs est stable : juridiction, date,
 * texte, mots-clés ; une décision n'est comptée que dans la première catégorie
 * qui la concerne.
 */
export function classerDecision(
  decision: DecisionJade,
  descripteur: DescripteurCe,
  dateMin: string = descripteur.date_min,
): Verdict {
  if (!estConseilEtat(decision.juridiction, descripteur)) {
    return { retenue: false, motif: "autre_juridiction" };
  }
  if (!DATE_ISO.test(decision.date) || Number.isNaN(Date.parse(decision.date))) {
    return { retenue: false, motif: "date_invalide" };
  }
  if (decision.date < dateMin) return { retenue: false, motif: "avant_borne" };
  if (decision.paragraphes.length === 0) return { retenue: false, motif: "texte_vide" };
  if (!contientMotCle(decision.paragraphes.join(" "), descripteur.mots_cles)) {
    return { retenue: false, motif: "sans_mot_cle" };
  }
  return { retenue: true, decision };
}

/**
 * Mappe une décision retenue en fragments adressables. Le découpage est local
 * (600 à 1 200 caractères) ; la référence porte l'identifiant JADE et le rang
 * du fragment, et l'URL est celle de Légifrance.
 */
export function unitesJade(decision: DecisionJade, descripteur: DescripteurCe): Unite[] {
  const numero = decision.numero === "" ? decision.id : decision.numero;
  const chemin = `${descripteur.nom} > Décision ${numero}`;
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
    statut: decision.solution === "" ? "Publié" : decision.solution,
    url: descripteur.url_texte.replace("{id}", decision.id),
  }));
}

/**
 * Valide un corpus complet avant écriture : références uniques, textes non
 * vides, dates ISO. Lève en nommant les défauts, sans toucher aux fichiers.
 */
export function validerUnites(unites: readonly Unite[]): void {
  const erreurs: string[] = [];
  const vues = new Set<string>();
  for (const unite of unites) {
    if (unite.ref.trim() === "") {
      erreurs.push("référence vide");
      continue;
    }
    if (vues.has(unite.ref)) erreurs.push(`référence dupliquée : ${unite.ref}`);
    vues.add(unite.ref);
    if (unite.texte.trim() === "") erreurs.push(`texte vide : ${unite.ref}`);
    if (unite.document.trim() === "") erreurs.push(`document vide : ${unite.ref}`);
    if (unite.corpus.trim() === "") erreurs.push(`corpus vide : ${unite.ref}`);
    if (!DATE_ISO.test(unite.date_acte) || Number.isNaN(Date.parse(unite.date_acte))) {
      erreurs.push(`date non ISO : ${unite.ref} (${unite.date_acte || "vide"})`);
    }
  }
  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 10).join(" ; ");
    const reste = erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : "";
    throw new Error(`Corpus CE invalide, rien n'est écrit : ${liste}${reste}`);
  }
}
