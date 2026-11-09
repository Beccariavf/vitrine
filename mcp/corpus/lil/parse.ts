/**
 * Parse la version consolidée d'un texte LEGI rendue par `/consult/legiPart`.
 *
 * La réponse est un arbre de `sections`, chacune portant ses `articles` puis ses
 * `sections` filles. Chaque article est copié, jamais reformulé : seul le HTML
 * de `content` est ramené à son texte visible. Seuls les articles `VIGUEUR`
 * deviennent des unités ; les autres sont comptés, jamais devinés.
 */

import { texteVisible } from "../parse.ts";
import type { Unite } from "../parse.ts";

/** Métadonnées de la LIL, lues depuis `mcp/corpus/lil/descripteur.json`. */
export type DescripteurLil = {
  textId: string;
  corpus: string;
  nom: string;
  titre: string;
  /** URL Légifrance du texte, et modèle d'URL d'article portant `{id}`. */
  url: string;
  url_article: string;
  licence: string;
  date_consultation: string;
  sections_attendues: number;
  articles_attendus: number;
};

/** Un article du texte, tel que la DILA le publie. */
export type ArticleLil = {
  id: string;
  num: string;
  content: string;
  pathTitle: string[];
  etat: string;
  dateDebut: string | null;
  dateFin: string | null;
};

/** Une réponse `legiPart` réduite à ce que le corpus lit. */
export type LegiPart = {
  /** Identifiant de la version consolidée, par exemple `LEGITEXT…_01-10-2026`. */
  version: string;
  titre: string;
  dateDebutVersion: string | null;
  /** Nombre de sections parcourues, racine exclue. */
  sections: number;
  /** Articles dans l'ordre du document, tous états confondus. */
  articles: ArticleLil[];
};

function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === "object" && valeur !== null ? (valeur as Record<string, unknown>) : null;
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** Titres de section nettoyés : espaces et retours de ligne de la DILA. */
function titres(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur
    .filter((element): element is string => typeof element === "string")
    .map((element) => element.replace(/\s+/g, " ").trim())
    .filter((element) => element !== "");
}

/** Sentinelle DILA d'une date de fin ouverte, en millisecondes (an 2999). */
const FIN_OUVERTE = 32_472_144_000_000;

/**
 * Date d'un article : la DILA rend des millisecondes epoch, parfois déjà une
 * chaîne ISO. La sentinelle de fin ouverte devient `null`, jamais une date.
 */
function dateOuNull(valeur: unknown): string | null {
  if (typeof valeur === "number" && Number.isFinite(valeur)) {
    if (valeur >= FIN_OUVERTE) return null;
    return new Date(valeur).toISOString().slice(0, 10);
  }
  const texteDate = texte(valeur);
  if (texteDate === "" || texteDate.startsWith("2999-") || texteDate.startsWith("9999-")) {
    return null;
  }
  return texteDate;
}

/** Un article de la réponse ; `null` si son identifiant manque. */
function lireArticle(valeur: unknown): ArticleLil | null {
  const article = objet(valeur);
  if (article === null) return null;
  const id = texte(article.id);
  if (id === "") return null;
  return {
    id,
    num: texte(article.num),
    content: typeof article.content === "string" ? article.content : "",
    pathTitle: titres(article.pathTitle),
    etat: texte(article.etat),
    dateDebut: dateOuNull(article.dateDebut),
    dateFin: dateOuNull(article.dateFin),
  };
}

/**
 * Lit la réponse `legiPart`. Lève si les `sections` manquent : une réponse
 * amputée ne doit jamais produire un corpus vide sans le dire.
 */
export function lireLegiPart(brut: unknown): LegiPart {
  const racine = objet(brut);
  if (racine === null) {
    throw new Error("Réponse legiPart illisible : objet attendu");
  }
  const version = texte(racine.id);
  if (version === "") {
    throw new Error("Réponse legiPart sans identifiant de version (id)");
  }
  const sections = racine.sections;
  if (!Array.isArray(sections)) {
    throw new Error(`Réponse legiPart ${version} sans sections`);
  }

  const articles: ArticleLil[] = [];
  let nombreSections = 0;

  const parcourirArticles = (liste: unknown): void => {
    if (!Array.isArray(liste)) return;
    for (const valeur of liste) {
      const article = lireArticle(valeur);
      if (article !== null) articles.push(article);
    }
  };

  const parcourirSection = (valeur: unknown): void => {
    const section = objet(valeur);
    if (section === null) return;
    nombreSections += 1;
    parcourirArticles(section.articles);
    const filles = section.sections;
    if (Array.isArray(filles)) for (const fille of filles) parcourirSection(fille);
  };

  parcourirArticles(racine.articles);
  for (const section of sections) parcourirSection(section);

  return {
    version,
    titre: texte(racine.title),
    dateDebutVersion: dateOuNull(racine.dateDebutVersion),
    sections: nombreSections,
    articles,
  };
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mappe les articles en vigueur en unités adressables. Un article sans
 * `content` en vigueur lève : la capture est alors refusée avant toute
 * écriture. Les articles abrogés sont comptés et écartés.
 */
export function unitesLil(
  part: LegiPart,
  descripteur: DescripteurLil,
): { unites: Unite[]; abroges: number } {
  const unites: Unite[] = [];
  let abroges = 0;
  const vues = new Set<string>();

  for (const article of part.articles) {
    if (article.etat.trim().toUpperCase() !== "VIGUEUR") {
      abroges += 1;
      continue;
    }
    if (vues.has(article.id)) {
      throw new Error(`Article ${article.id} présent deux fois dans la réponse legiPart`);
    }
    vues.add(article.id);
    if (article.content.trim() === "") {
      throw new Error(`Article ${article.id} (${article.num || "sans numéro"}) sans content`);
    }
    const corps = texteVisible(article.content);
    if (corps === "") {
      throw new Error(`Article ${article.id} (${article.num || "sans numéro"}) au texte vide`);
    }
    if (article.num.trim() === "") {
      throw new Error(`Article ${article.id} sans numéro`);
    }
    const date = article.dateDebut ?? part.dateDebutVersion ?? descripteur.date_consultation;
    const chemin = [descripteur.nom, ...article.pathTitle].join(" > ");
    unites.push({
      ref: article.id,
      document: descripteur.textId,
      corpus: descripteur.corpus,
      niveau: "article",
      numero: article.num.trim(),
      chemin,
      texte: corps,
      date_acte: date,
      date_debut: date,
      date_fin: article.dateFin,
      statut: article.etat,
      url: descripteur.url_article.replace("{id}", article.id),
    });
  }

  return { unites, abroges };
}

/**
 * Valide une capture complète avant écriture : références uniques, textes et
 * dates non vides, puis comptes attendus. Lève en nommant chaque défaut.
 */
export function validerCapture(
  part: LegiPart,
  unites: Unite[],
  attendus: { sections: number; articles: number },
): void {
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
    if (unite.numero.trim() === "") erreurs.push(`numéro vide : ${unite.ref}`);
    if (unite.document.trim() === "") erreurs.push(`document vide : ${unite.ref}`);
    if (unite.corpus.trim() === "") erreurs.push(`corpus vide : ${unite.ref}`);
    if (!DATE_ISO.test(unite.date_acte) || Number.isNaN(Date.parse(unite.date_acte))) {
      erreurs.push(`date non ISO : ${unite.ref} (${unite.date_acte || "vide"})`);
    }
  }
  if (part.sections !== attendus.sections) {
    erreurs.push(`${part.sections} sections au lieu de ${attendus.sections} attendues`);
  }
  if (unites.length !== attendus.articles) {
    erreurs.push(`${unites.length} articles en vigueur au lieu de ${attendus.articles} attendus`);
  }
  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 10).join(" ; ");
    const reste = erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : "";
    throw new Error(`Corpus LIL invalide, rien n'est écrit : ${liste}${reste}`);
  }
}
