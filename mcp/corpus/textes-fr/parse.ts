/**
 * Lit les textes français d'application rendus par PISTE : le décret
 * n° 2019-536 (`/consult/legiPart`), la section 5 du chapitre VI du titre II du
 * livre II du Code pénal (`/consult/code`, articles 226-16 à 226-24) et
 * l'article L34-5 du CPCE (`/consult/getArticleWithIdAndNum`).
 *
 * Chaque article est copié, jamais reformulé : seul le HTML est ramené à son
 * texte visible. Seuls les articles `VIGUEUR` deviennent des unités ; les autres
 * sont comptés et écartés, comme pour la loi 78-17.
 */

import type { Unite } from "../parse.ts";
import { comparerCorps, formeArticle } from "../articles.ts";
import { lireLegiPart, unitesLil } from "../lil/parse.ts";
import type { ArticleLil, LegiPart } from "../lil/parse.ts";

/** Comment PISTE rend un texte : en entier, une section de code, ou un article. */
export type RouteTexte =
  | { type: "legiPart" }
  | { type: "code"; sctCid: string; premier: string; dernier: string }
  | { type: "article"; num: string };

/** Un texte du corpus, tel que le descripteur le déclare. */
export type TexteFr = {
  /** Nom du snapshot brut sous `data/raw/textes_fr/<date>/`. */
  cle: string;
  /** Libellé court, tête du chemin de chaque article. */
  nom: string;
  titre: string;
  /** Identifiant Légifrance du texte : `document` de ses unités. */
  textId: string;
  url: string;
  /** Modèle d'URL d'article portant `{id}`. */
  url_article: string;
  /** Ce que le corpus couvre du texte, en clair : `texte entier`, `article L34-5`. */
  perimetre: string;
  route: RouteTexte;
  /** Articles en vigueur attendus : une réponse amputée est refusée. */
  attendus: { articles: number };
};

export type DescripteurTextesFr = {
  corpus: string;
  nom: string;
  licence: string;
  textes: TexteFr[];
};

/** Un texte lu : sa version, ses unités en vigueur et ses articles écartés. */
export type LectureTexte = {
  texte: TexteFr;
  /** Identifiant de version rendu par PISTE (`LEGITEXT…_JJ-MM-AAAA`, `LEGIARTI…`). */
  version: string;
  dateDebutVersion: string | null;
  unites: Unite[];
  abroges: number;
};

function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === "object" && valeur !== null ? (valeur as Record<string, unknown>) : null;
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** Vrai quand le numéro tombe dans la plage `[premier, dernier]` du même code. */
export function dansPlage(num: string, premier: string, dernier: string): boolean {
  const article = formeArticle(num);
  const debut = formeArticle(premier);
  const fin = formeArticle(dernier);
  if (article === null || debut === null || fin === null) return false;
  if (article.prefixe !== debut.prefixe || article.prefixe !== fin.prefixe) return false;
  return comparerCorps(debut.corps, article.corps) <= 0 && comparerCorps(article.corps, fin.corps) <= 0;
}

/** Sentinelle DILA d'une date de fin ouverte, en millisecondes (an 2999). */
const FIN_OUVERTE = 32_472_144_000_000;

function dateOuNull(valeur: unknown): string | null {
  if (typeof valeur === "number" && Number.isFinite(valeur)) {
    if (valeur >= FIN_OUVERTE) return null;
    return new Date(valeur).toISOString().slice(0, 10);
  }
  const brut = texte(valeur);
  if (brut === "" || brut.startsWith("2999-") || brut.startsWith("9999-")) return null;
  return brut;
}

/**
 * Lit la réponse `getArticleWithIdAndNum` : un objet `article` portant la
 * version rendue. Lève si l'article ou son identifiant manque.
 */
export function lireArticleParNumero(brut: unknown): LegiPart {
  const article = objet(objet(brut)?.article);
  if (article === null) {
    throw new Error("Réponse getArticleWithIdAndNum sans article");
  }
  const id = texte(article.id);
  if (id === "") throw new Error("Réponse getArticleWithIdAndNum sans identifiant d'article");
  const contexte = objet(article.context);
  const titres = Array.isArray(objet(contexte?.titreTxt)?.titres) ? [] : [];
  const lu: ArticleLil = {
    id,
    num: texte(article.num),
    content:
      typeof article.texteHtml === "string" && article.texteHtml.trim() !== ""
        ? article.texteHtml
        : typeof article.texte === "string"
          ? article.texte
          : "",
    pathTitle: titres,
    etat: texte(article.etat),
    dateDebut: dateOuNull(article.dateDebut),
    dateFin: dateOuNull(article.dateFin),
  };
  return { version: id, titre: "", dateDebutVersion: lu.dateDebut, sections: 0, articles: [lu] };
}

/**
 * Lit la réponse d'un texte selon sa route, garde les articles de son
 * périmètre, puis mappe ceux en vigueur en unités. Un article en vigueur sans
 * texte lève : la capture est refusée avant toute écriture.
 */
export function lireTexte(
  texteFr: TexteFr,
  reponse: unknown,
  corpus: string,
  dateConsultation: string,
): LectureTexte {
  const route = texteFr.route;
  let part: LegiPart;
  if (route.type === "article") {
    part = lireArticleParNumero(reponse);
  } else {
    part = lireLegiPart(reponse);
    if (route.type === "code") {
      part = {
        ...part,
        articles: part.articles.filter((article) => dansPlage(article.num, route.premier, route.dernier)),
      };
    }
  }
  const { unites, abroges } = unitesLil(part, {
    textId: texteFr.textId,
    corpus,
    nom: texteFr.nom,
    titre: texteFr.titre,
    url: texteFr.url,
    url_article: texteFr.url_article,
    licence: "",
    date_consultation: dateConsultation,
    sections_attendues: 0,
    articles_attendus: 0,
  });
  return { texte: texteFr, version: part.version, dateDebutVersion: part.dateDebutVersion, unites, abroges };
}

/**
 * Valide toutes les lectures avant écriture : références uniques dans le
 * corpus, numéros dans le périmètre, comptes attendus. Lève en nommant chaque
 * défaut.
 */
export function validerLectures(lectures: readonly LectureTexte[]): void {
  const erreurs: string[] = [];
  const vues = new Set<string>();
  for (const lecture of lectures) {
    const { texte: texteFr, unites } = lecture;
    for (const unite of unites) {
      if (vues.has(unite.ref)) erreurs.push(`référence dupliquée : ${unite.ref}`);
      vues.add(unite.ref);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(unite.date_acte)) {
        erreurs.push(`date non ISO : ${unite.ref} (${unite.date_acte || "vide"})`);
      }
    }
    if (texteFr.route.type === "article") {
      const attendu = formeArticle(texteFr.route.num);
      const autre = unites.find((unite) => {
        const forme = formeArticle(unite.numero);
        return forme === null || attendu === null || forme.prefixe !== attendu.prefixe || forme.corps !== attendu.corps;
      });
      if (autre !== undefined) {
        erreurs.push(`${texteFr.nom} : article ${autre.numero} rendu au lieu de ${texteFr.route.num}`);
      }
    }
    if (unites.length !== texteFr.attendus.articles) {
      erreurs.push(
        `${texteFr.nom} : ${unites.length} articles en vigueur au lieu de ${texteFr.attendus.articles} attendus`,
      );
    }
  }
  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 10).join(" ; ");
    const reste = erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : "";
    throw new Error(`Corpus textes_fr invalide, rien n'est écrit : ${liste}${reste}`);
  }
}
