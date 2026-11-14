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
import { dateOuNull, lireLegiPart, objet, texte, unitesLil } from "../lil/parse.ts";
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
  /**
   * Date du texte `AAAA-MM-JJ` : `date_acte` d'un article dont la DILA ne donne
   * pas la date de début (date ouverte). Sa `date_debut` reste alors vide :
   * jamais la date de la version consolidée.
   */
  date_texte?: string;
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

/**
 * Vrai quand le numéro tombe dans la plage `[premier, dernier]` du même code.
 * Un suffixe de lettre (`226-16-1-A`) est comparé par son corps numérique.
 */
export function dansPlage(num: string, premier: string, dernier: string): boolean {
  const article = formeArticle(num.trim().replace(/-[A-Z]+$/i, ""));
  const debut = formeArticle(premier);
  const fin = formeArticle(dernier);
  if (article === null || debut === null || fin === null) return false;
  if (article.prefixe !== debut.prefixe || article.prefixe !== fin.prefixe) return false;
  return comparerCorps(debut.corps, article.corps) <= 0 && comparerCorps(article.corps, fin.corps) <= 0;
}

/** Titre de section nettoyé des espaces de la DILA. */
function titreSection(valeur: unknown): string {
  return texte(valeur).replace(/\s+/g, " ");
}

/**
 * La section `sctCid` de la réponse `/consult/code` et les titres qui y mènent.
 * Seule cette section porte le texte de ses articles ; le reste de l'arbre du
 * code n'a que des numéros.
 */
function sectionCiblee(
  sections: unknown,
  sctCid: string,
  chemin: string[] = [],
): { section: Record<string, unknown>; titres: string[] } | null {
  if (!Array.isArray(sections)) return null;
  for (const valeur of sections) {
    const section = objet(valeur);
    if (section === null) continue;
    const titres = [...chemin, titreSection(section.title)].filter((titre) => titre !== "");
    if (texte(section.cid) === sctCid || texte(section.id) === sctCid) return { section, titres };
    const trouvee = sectionCiblee(section.sections, sctCid, titres);
    if (trouvee !== null) return trouvee;
  }
  return null;
}

/**
 * Lit la réponse `/consult/code` réduite à la section `sctCid` : ses articles,
 * tous états confondus, portent le chemin de la section.
 */
export function lireSectionDeCode(brut: unknown, sctCid: string): LegiPart {
  const racine = objet(brut);
  if (racine === null) throw new Error("Réponse code illisible : objet attendu");
  const trouvee = sectionCiblee(racine.sections, sctCid);
  if (trouvee === null) throw new Error(`Réponse code sans la section ${sctCid}`);
  const part = lireLegiPart({ ...racine, articles: [], sections: [trouvee.section] });
  return {
    ...part,
    articles: part.articles.map((article) => ({
      ...article,
      pathTitle: article.pathTitle.length > 0 ? article.pathTitle : trouvee.titres,
    })),
  };
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
  const titresTM = objet(article.context)?.titresTM;
  const titres = Array.isArray(titresTM)
    ? titresTM.map((titre) => titreSection(objet(titre)?.titre)).filter((titre) => titre !== "")
    : [];
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
 * Lit la réponse d'un texte selon sa route (la section visée pour un code),
 * puis mappe les articles en vigueur en unités. Un article en vigueur sans
 * texte lève : la capture est refusée avant toute écriture. Le périmètre d'une
 * plage est vérifié par `validerLectures`.
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
  } else if (route.type === "code") {
    part = lireSectionDeCode(reponse, route.sctCid);
  } else {
    part = lireLegiPart(reponse);
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
  // Une date de début ouverte n'est pas celle de la version : la date du texte
  // date l'acte, la date de début reste vide plutôt que fausse.
  const sansDebut = new Set(part.articles.filter((article) => article.dateDebut === null).map((article) => article.id));
  const datees = unites.map((unite) =>
    sansDebut.has(unite.ref)
      ? { ...unite, date_acte: texteFr.date_texte ?? unite.date_acte, date_debut: "" }
      : unite,
  );
  return { texte: texteFr, version: part.version, dateDebutVersion: part.dateDebutVersion, unites: datees, abroges };
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
    const route = texteFr.route;
    if (route.type === "code") {
      for (const unite of unites) {
        if (!dansPlage(unite.numero, route.premier, route.dernier)) {
          erreurs.push(`${texteFr.nom} : article ${unite.numero} hors de ${route.premier} à ${route.dernier}`);
        }
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
