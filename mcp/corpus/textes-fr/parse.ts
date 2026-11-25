/**
 * Lit les textes français d'application rendus par PISTE : un texte entier
 * (`/consult/legiPart`), une section de code (`/consult/code`), un ou plusieurs
 * articles cités par leur numéro (`/consult/getArticleWithIdAndNum`), ou des
 * numéros prélevés dans des sections datées quand la route par numéro ne sert
 * pas l'article en vigueur.
 *
 * Chaque article est copié, jamais reformulé : seul le HTML est ramené à son
 * texte visible. Seuls les articles `VIGUEUR` deviennent des unités ; les autres
 * sont comptés et écartés, comme pour la loi 78-17.
 */

import type { Unite } from "../parse.ts";
import { comparerCorps, formeArticle, normaliserNumero } from "../articles.ts";
import { dateOuNull, lireLegiPart, objet, texte, unitesLil } from "../lil/parse.ts";
import type { ArticleLil, LegiPart } from "../lil/parse.ts";

/**
 * Comment PISTE rend un texte : en entier, une section de code, un article, une
 * liste de numéros lus un par un, ou des numéros prélevés dans des sections
 * datées quand la route par numéro ne sert pas l'article en vigueur.
 */
export type RouteTexte =
  | { type: "legiPart"; plage?: { premier: string; dernier: string } }
  | { type: "code"; sctCid: string; premier: string; dernier: string }
  | { type: "article"; num: string }
  | { type: "articles"; nums: string[] }
  | { type: "codeArticles"; sections: Array<{ sctCid: string; nums: string[] }> };

/** Marge fixe du budget d'une passe, au-dessus des appels calculés. */
export const MARGE_APPELS_PISTE = 5;

/** Nombre d'appels PISTE qu'une route coûte : un par numéro ou par section. */
export function appelsRoute(route: {
  type: string;
  nums?: readonly string[];
  sections?: readonly unknown[];
}): number {
  if (route.type === "articles" && Array.isArray(route.nums)) return route.nums.length;
  if (route.type === "codeArticles" && Array.isArray(route.sections)) return route.sections.length;
  return 1;
}

/** Budget d'une passe : un jeton, un appel par entrée, puis la marge fixe. */
export function budgetPasse(
  entrees: readonly {
    route: { type: string; nums?: readonly string[]; sections?: readonly unknown[] };
  }[],
): number {
  return (
    1 + entrees.reduce((total, entree) => total + appelsRoute(entree.route), 0) + MARGE_APPELS_PISTE
  );
}

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
   * Numéros déjà couverts par un autre bloc du même texte, retirés de la
   * lecture : le CRPA L311-3-1 a son bloc d'article et ne doit pas entrer deux
   * fois dans le corpus quand le livre III est lu par sa section.
   */
  exclure?: readonly string[];
  /**
   * Route de détection de nouvelle version, quand elle diffère de `route` : la
   * recherche `LODA_DATE` ne rend que l'identifiant de la version consolidée,
   * là où `legiPart` rend le texte entier.
   */
  detection?: { fond: string; num: string };
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
  // La DILA écrit parfois le suffixe de lettre détaché (« L1121-16-1 A ») : il
  // ne change pas le corps numérique comparé ici.
  const article = formeArticle(num.trim().replace(/(?:-|\s)[A-Z]+$/i, ""));
  const debut = formeArticle(premier);
  const fin = formeArticle(dernier);
  if (article === null || debut === null || fin === null) return false;
  // Le préfixe n'est pas comparé : un chapitre réglementaire porte aussi ses
  // décrets d'application (D1110-3-1 dans une plage R1110-1 à R1110-16).
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
 *
 * Un même `cid` peut désigner deux branches de l'arbre — l'ancienne et la
 * nouvelle version d'un chapitre recodifié. La branche retenue est celle dont
 * les articles portent un texte ; la première trouvée sert de repli quand
 * aucune n'en porte.
 */
function sectionCiblee(
  sections: unknown,
  sctCid: string,
  chemin: string[] = [],
): { section: Record<string, unknown>; titres: string[] } | null {
  const trouvees: Array<{ section: Record<string, unknown>; titres: string[] }> = [];
  const collecter = (valeurs: unknown, titres: string[]): void => {
    if (!Array.isArray(valeurs)) return;
    for (const valeur of valeurs) {
      const section = objet(valeur);
      if (section === null) continue;
      const siens = [...titres, titreSection(section.title)].filter((titre) => titre !== "");
      if (texte(section.cid) === sctCid || texte(section.id) === sctCid) {
        trouvees.push({ section, titres: siens });
      }
      collecter(section.sections, siens);
    }
  };
  collecter(sections, chemin);
  return trouvees.find((trouvee) => porteDuTexte(trouvee.section)) ?? trouvees[0] ?? null;
}

/** Vrai quand la branche porte au moins un article avec du texte. */
function porteDuTexte(section: Record<string, unknown>): boolean {
  const articles = Array.isArray(section.articles) ? section.articles : [];
  for (const valeur of articles) {
    const article = objet(valeur);
    if (article === null) continue;
    if (typeof article.content === "string" && article.content.trim() !== "") return true;
    if (typeof article.texteHtml === "string" && article.texteHtml.trim() !== "") return true;
  }
  return Array.isArray(section.sections) && section.sections.some((valeur) => {
    const enfant = objet(valeur);
    return enfant !== null && porteDuTexte(enfant);
  });
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
 * Lit les réponses d'une liste de numéros agrégées en une seule lecture. Chaque
 * réponse est celle de `getArticleWithIdAndNum`, dans l'ordre du descripteur :
 * un numéro qui revient non `VIGUEUR` ou sous un autre numéro fait lever la
 * capture en le nommant, avant toute écriture. La version est la suite des
 * identifiants lus, jointe par `+` ; `dateDebutVersion` reste `null`, chaque
 * article portant sa propre date de début.
 */
export function lireArticlesParNumero(
  reponse: unknown,
  nums: readonly string[],
  nom: string,
): LegiPart {
  if (!Array.isArray(reponse)) {
    throw new Error(`${nom} : réponse getArticleWithIdAndNum illisible (tableau attendu)`);
  }
  if (reponse.length !== nums.length) {
    throw new Error(`${nom} : ${reponse.length} réponse(s) pour ${nums.length} article(s) demandé(s)`);
  }
  const parts = reponse.map((element, rang): LegiPart => {
    const numero = nums[rang] ?? "";
    const part = lireArticleParNumero(element);
    const article = part.articles[0];
    if (article === undefined) throw new Error(`${nom} : article ${numero} absent de la réponse`);
    if (normaliserNumero(article.num) !== normaliserNumero(numero)) {
      throw new Error(`${nom} : article ${article.num || "sans numéro"} rendu au lieu de ${numero}`);
    }
    if (article.etat.trim().toUpperCase() !== "VIGUEUR") {
      throw new Error(`${nom} : article ${numero} rendu ${article.etat || "sans état"}, pas VIGUEUR`);
    }
    return part;
  });
  return {
    version: parts.map((part) => part.version).join("+"),
    titre: "",
    dateDebutVersion: null,
    sections: 0,
    articles: parts.flatMap((part) => part.articles),
  };
}

/**
 * Lit des sections datées d'un code et n'en garde que les numéros demandés :
 * la route par numéro ne sert pas toujours l'article en vigueur (une version
 * dont l'abrogation est différée, comme CSP L1111-7, n'est rendue qu'à la date
 * de consultation). Chaque section coûte un appel ; un numéro demandé absent de
 * sa section ou non `VIGUEUR` fait lever la capture en le nommant.
 */
export function lireArticlesDeSections(
  reponse: unknown,
  sections: readonly { sctCid: string; nums: readonly string[] }[],
  nom: string,
): LegiPart {
  if (!Array.isArray(reponse)) {
    throw new Error(`${nom} : réponses de sections illisibles (tableau attendu)`);
  }
  if (reponse.length !== sections.length) {
    throw new Error(`${nom} : ${reponse.length} réponse(s) pour ${sections.length} section(s) demandée(s)`);
  }
  const parties = reponse.map((element, rang): LegiPart => {
    const section = sections[rang];
    if (section === undefined) throw new Error(`${nom} : section ${rang} absente du descripteur`);
    const part = lireSectionDeCode(element, section.sctCid);
    const voulus = new Set(section.nums.map(normaliserNumero));
    const articles = part.articles.filter((article) => voulus.has(normaliserNumero(article.num)));
    for (const numero of section.nums) {
      const article = articles.find((candidat) => normaliserNumero(candidat.num) === normaliserNumero(numero));
      if (article === undefined) {
        throw new Error(`${nom} : article ${numero} absent de la section ${section.sctCid}`);
      }
      if (article.etat.trim().toUpperCase() !== "VIGUEUR") {
        throw new Error(`${nom} : article ${numero} rendu ${article.etat || "sans état"}, pas VIGUEUR`);
      }
    }
    return { ...part, articles };
  });
  return {
    version: parties
      .flatMap((part) => part.articles)
      .map((article) => article.id)
      .join("+"),
    titre: "",
    dateDebutVersion: null,
    sections: 0,
    articles: parties.flatMap((part) => part.articles),
  };
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
  } else if (route.type === "articles") {
    part = lireArticlesParNumero(reponse, route.nums, texteFr.nom);
  } else if (route.type === "codeArticles") {
    part = lireArticlesDeSections(reponse, route.sections, texteFr.nom);
  } else if (route.type === "code") {
    part = lireSectionDeCode(reponse, route.sctCid);
  } else {
    part = lireLegiPart(reponse);
  }
  // Une loi se lit en entier, puis se borne à sa plage : `/consult/code` ne
  // rend pas le texte d'une section de loi, et `getArticleWithIdAndNum` ne sert
  // pas les articles modificatifs (SREN 34 et 39).
  if (route.type === "legiPart" && route.plage !== undefined) {
    const { premier, dernier } = route.plage;
    part = {
      ...part,
      articles: part.articles.filter((article) => dansPlage(article.num, premier, dernier)),
    };
  }
  if ((texteFr.exclure ?? []).length > 0) {
    const exclus = new Set((texteFr.exclure ?? []).map(normaliserNumero));
    part = {
      ...part,
      articles: part.articles.filter((article) => !exclus.has(normaliserNumero(article.num))),
    };
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
    if (route.type === "legiPart" && route.plage !== undefined) {
      for (const unite of unites) {
        if (!dansPlage(unite.numero, route.plage.premier, route.plage.dernier)) {
          erreurs.push(
            `${texteFr.nom} : article ${unite.numero} hors de ${route.plage.premier} à ${route.plage.dernier}`,
          );
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
    if (route.type === "codeArticles") {
      const voulus = new Set(route.sections.flatMap((section) => section.nums).map(normaliserNumero));
      for (const unite of unites) {
        if (!voulus.has(normaliserNumero(unite.numero))) {
          erreurs.push(`${texteFr.nom} : article ${unite.numero} hors des numéros demandés`);
        }
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
