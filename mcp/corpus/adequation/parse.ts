/**
 * Découpe une décision d'adéquation en unités, une par article.
 *
 * Les décisions récentes sont servies en XHTML CELLAR avec des ancres ELI ; les
 * plus anciennes ne sont servies qu'en HTML, sans ancre. Les deux formes sont
 * ramenées à leur texte visible, puis les articles sont délimités par leurs
 * intitulés (« Article premier », « Article 2 ») entre l'arrêt de la décision
 * (« A ARRÊTÉ LA PRÉSENTE DÉCISION ») et la première annexe ou la signature.
 * Le nombre attendu vient du descripteur : une capture incomplète lève avant
 * toute écriture.
 */

import { decoderEntites } from "../parse.ts";
import type { Unite } from "../parse.ts";

/** Une décision d'adéquation déclarée au descripteur-liste. */
export type DecisionAdequation = {
  cle: string;
  pays: string;
  titre: string;
  celex: string;
  url: string;
  date_acte: string;
  date_fin: string | null;
  statut: string;
  /** Motif d'abrogation ou d'invalidation, quand le statut n'est pas en vigueur. */
  motif?: string;
  note?: string;
  articles: number;
};

export type DescripteurAdequation = {
  corpus: string;
  nom: string;
  liste_reference: string;
  consulte_le: string;
  decisions: DecisionAdequation[];
};

/** Décision déclarée, sous la forme qu'attend le parseur d'articles. */
export type SourceDecision = {
  document: string;
  corpus: string;
  nom: string;
  url: string;
  date_acte: string;
  date_debut: string;
  date_fin: string | null;
  statut: string;
  articles_attendus: number;
  considerants_attendus: number;
};

/** Texte visible découpé en lignes de bloc, sans balise ni entité. */
export function lignesVisibles(contenu: string): string[] {
  const sansScript = contenu
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const avecRetours = sansScript
    .replace(/<(?:br|\/p|\/tr|\/td|\/div|\/li|\/h[1-6]|\/table|\/tbody)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decoderEntites(avecRetours)
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((ligne) => ligne.replace(/\s+/g, " ").trim())
    .filter((ligne) => ligne !== "");
}

const INTITULE_ARTICLE = /^ARTICLE\s+(PREMIER|1ER|\d+)$/;

/**
 * Rend les articles d'une décision, dans l'ordre du document. Le texte d'une
 * unité inclut son intitulé, comme `parseCellar` ; les annexes et la signature
 * n'entrent dans aucune unité.
 */
export function parseArticlesDecision(contenu: string, descripteur: SourceDecision): Unite[] {
  const unites = decouperArticles(contenu, descripteur);
  if (unites.length !== descripteur.articles_attendus) {
    throw new Error(
      `Capture ${descripteur.document} : ${unites.length} articles au lieu de ` +
        `${descripteur.articles_attendus} attendus`,
    );
  }
  return unites;
}

/**
 * Nombre d'articles d'une capture, sans compte attendu : la synchronisation
 * l'écrit au descripteur avant de relancer la construction.
 */
export function compterArticlesDecision(contenu: string, descripteur: SourceDecision): number {
  return decouperArticles(contenu, descripteur).length;
}

function decouperArticles(contenu: string, descripteur: SourceDecision): Unite[] {
  const lignes = lignesVisibles(contenu);
  const debut = lignes.findIndex((ligne) =>
    /^A\s+(?:ARR[ÊE]T[ÉE]|ADOPT[ÉE])\s+LA\s+PR[ÉE]SENTE\s+D[ÉE]CISION/.test(ligne.toUpperCase()),
  );
  if (debut < 0) {
    throw new Error(`Capture ${descripteur.document} : arrêt de la décision introuvable`);
  }

  const unites: Unite[] = [];
  let courant: { numero: string; lignes: string[] } | null = null;
  const pousser = (): void => {
    if (courant === null) return;
    const texte = courant.lignes.join(" ").trim();
    if (texte === "") throw new Error(`Article ${courant.numero} vide dans ${descripteur.document}`);
    unites.push({
      ref: `${descripteur.document}#art_${courant.numero}`,
      document: descripteur.document,
      corpus: descripteur.corpus,
      niveau: "article",
      numero: courant.numero,
      chemin: `${descripteur.nom} > Article ${courant.numero}`,
      texte,
      date_acte: descripteur.date_acte,
      date_debut: descripteur.date_debut,
      date_fin: descripteur.date_fin,
      statut: descripteur.statut,
      url: descripteur.url,
    });
    courant = null;
  };

  for (const ligne of lignes.slice(debut)) {
    const intitule = INTITULE_ARTICLE.exec(ligne.toUpperCase());
    if (intitule !== null) {
      pousser();
      const numero = intitule[1] ?? "";
      courant = {
        numero: numero === "PREMIER" || numero === "1ER" ? "1" : String(Number(numero)),
        lignes: [ligne],
      };
      continue;
    }
    if (courant !== null && (/^ANNEXES?\b/.test(ligne.toUpperCase()) || /^FAIT\s+[ÀA]\b/.test(ligne.toUpperCase()))) {
      pousser();
      break;
    }
    if (courant !== null) courant.lignes.push(ligne);
  }
  pousser();

  return unites;
}

/** Pays d'une décision d'adéquation, lu dans la fin de son titre. */
export function paysDeTitre(titre: string | null): string | null {
  if (titre === null) return null;
  const trouve = /\b(?:by|par)\s+(?:la\s+|le\s+|les\s+|l')?(.+?)\.?$/i.exec(titre.trim());
  const pays = trouve?.[1]?.trim();
  return pays === undefined || pays === "" ? null : pays;
}

/** Descripteur d'un acte CELLAR ordinaire, pour réutiliser `texteVisible` sans le parseur d'ancres. */
export function descripteurDepuisDecision(decision: DecisionAdequation, corpus: string): SourceDecision {
  return {
    document: decision.celex,
    corpus,
    nom: decision.pays,
    url: decision.url,
    date_acte: decision.date_acte,
    date_debut: decision.date_acte,
    date_fin: decision.date_fin,
    statut: decision.statut,
    articles_attendus: decision.articles,
    considerants_attendus: 0,
  };
}
