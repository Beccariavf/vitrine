/**
 * Descripteur du corpus `doctrine_ue` : une liste explicite de documents.
 *
 * Aucune découverte automatique : chaque document est déclaré avec son
 * identifiant, sa date, sa version, son statut, sa langue, son lien officiel et
 * sa source. Le descripteur porte aussi la liste de référence et sa date de
 * consultation, les documents écartés et les documents listés mais non
 * récupérés, avec leur raison.
 *
 * Les domaines admis sont ceux que le plan fixe : la stratégie numérique de la
 * Commission, son site institutionnel, la plateforme du guichet unique du
 * règlement sur l'IA et CELLAR. `eur-lex.europa.eu` est refusé (202 vide aux
 * robots).
 */

import { readFileSync } from "node:fs";
import { texteVisible } from "../parse.ts";

/** Type d'un document de doctrine de la Commission. */
export type TypeDoctrineUe =
  | "lignes_directrices"
  | "projet_lignes_directrices"
  | "code_de_bonne_pratique"
  | "modele"
  | "questions_reponses";

/** État du document : version finale adoptée, ou projet soumis à consultation. */
export type StatutDoctrineUe = "final" | "projet";

/** D'où vient la date du document. */
export type DateSourceDoctrineUe = "document" | "page" | "extraction";

/** Comment le texte est récupéré. */
export type FormatDoctrineUe = "pdf" | "html" | "cellar";

export type DocumentDoctrineUe = {
  /** Identifiant stable du document : slug des unités et du manifeste. */
  cle: string;
  type: TypeDoctrineUe;
  titre: string;
  /** Intitulé exact de la source, quand le titre est traduit ou abrégé. */
  titre_source?: string;
  statut: StatutDoctrineUe;
  date_acte: string;
  date_source: DateSourceDoctrineUe;
  /** Date de première publication de la page, distincte de la date de l'acte. */
  date_publication: string | null;
  version: string;
  /** Chaîne dont la présence dans le texte prouve la version ; absente, pas de contrôle. */
  verifier?: string;
  langue: string;
  format: FormatDoctrineUe;
  /** CELEX du rendu CELLAR, pour `format: "cellar"`. */
  celex?: string;
  /** Page officielle du document. */
  url: string;
  /** Fichier ou rendu effectivement récupéré. */
  source: string;
  /** Licence propre au document ; sinon celle du descripteur. */
  licence?: string;
  licence_url?: string;
  /** Projet que cette version finale remplace. */
  remplace?: string[];
  /** Version finale qui remplace ce projet. */
  remplace_par?: string;
  /**
   * Page vivante : son contenu peut être réédité sous la même URL. Un contenu
   * inchangé garde sa date ; une réédition prend la date de la passe.
   */
  vivante?: boolean;
};

export type NonRecupere = {
  titre: string;
  url: string;
  raison: string;
};

export type DocumentEcartDeclare = {
  url: string;
  titre: string;
  raison: string;
};

export type ReferenceDoctrineUe = {
  titre: string;
  url: string;
  consulte_le: string;
};

export type DescripteurDoctrineUe = {
  corpus: string;
  nom: string;
  titre: string;
  source: string;
  mention: string;
  licence: string;
  licence_url: string;
  licence_note: string;
  validite_jours: number;
  tentatives: number;
  delai_ms: number;
  liste_reference: ReferenceDoctrineUe[];
  documents_ecartes: DocumentEcartDeclare[];
  non_recuperes: NonRecupere[];
  documents: DocumentDoctrineUe[];
};

/** Libellé du chemin, par type de document. */
export const LIBELLES_TYPE: Record<TypeDoctrineUe, string> = {
  lignes_directrices: "Lignes directrices",
  projet_lignes_directrices: "Projets de lignes directrices",
  code_de_bonne_pratique: "Codes de bonne pratique",
  modele: "Modèles",
  questions_reponses: "Questions-réponses",
};

const TYPES: readonly TypeDoctrineUe[] = Object.keys(LIBELLES_TYPE) as TypeDoctrineUe[];
const STATUTS: readonly StatutDoctrineUe[] = ["final", "projet"];
const SOURCES_DATE: readonly DateSourceDoctrineUe[] = ["document", "page", "extraction"];
const FORMATS: readonly FormatDoctrineUe[] = ["pdf", "html", "cellar"];

/** Domaines admis pour un lien de document. */
export const DOMAINES_ADMIS: readonly string[] = [
  "digital-strategy.ec.europa.eu",
  "ec.europa.eu",
  "commission.europa.eu",
  "ai-act-service-desk.ec.europa.eu",
  "publications.europa.eu",
];

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const CLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Vrai pour un hôte admis, avec ou sans sous-domaine. */
export function domaineAdmis(url: string): boolean {
  let hote: string;
  try {
    hote = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hote === "eur-lex.europa.eu" || hote.endsWith(".eur-lex.europa.eu")) return false;
  return DOMAINES_ADMIS.some(
    (domaine) => hote === domaine || hote.endsWith(`.${domaine}`),
  );
}

/** Vrai pour une URL absolue https sur un domaine admis. */
function urlAdmise(url: string): boolean {
  try {
    return new URL(url).protocol === "https:" && domaineAdmis(url);
  } catch {
    return false;
  }
}

/** Vérifie la forme d'une date ISO réelle. */
function dateIso(valeur: unknown): boolean {
  return (
    typeof valeur === "string" && DATE_ISO.test(valeur) && !Number.isNaN(Date.parse(valeur))
  );
}

/**
 * Valide le descripteur avant toute lecture réseau : un document mal déclaré
 * arrête la passe en le nommant. Les liens de remplacement doivent être
 * réciproques et cohérents — un projet remplacé par une finale, une finale qui
 * déclare le projet qu'elle remplace.
 */
export function validerDescripteur(descripteur: DescripteurDoctrineUe): void {
  const erreurs: string[] = [];
  if (descripteur.corpus !== "doctrine_ue") {
    erreurs.push(`corpus attendu « doctrine_ue », reçu « ${descripteur.corpus} »`);
  }
  if (descripteur.licence.trim() === "") erreurs.push("licence absente du descripteur");
  if (descripteur.liste_reference.length === 0) erreurs.push("liste de référence vide");
  for (const reference of descripteur.liste_reference) {
    if (!urlAdmise(reference.url)) {
      erreurs.push(`liste de référence hors domaine admis : ${reference.url}`);
    }
    if (!dateIso(reference.consulte_le)) {
      erreurs.push(`date de consultation non ISO : ${reference.url}`);
    }
  }

  const parCle = new Map<string, DocumentDoctrineUe>();
  for (const document of descripteur.documents) {
    const nom = document.cle === "" ? "(sans clé)" : document.cle;
    if (!CLE.test(document.cle)) erreurs.push(`${nom} : clé non canonique`);
    if (parCle.has(document.cle)) erreurs.push(`${nom} : clé dupliquée`);
    parCle.set(document.cle, document);
    if (!TYPES.includes(document.type)) erreurs.push(`${nom} : type inconnu « ${document.type} »`);
    if (!STATUTS.includes(document.statut)) {
      erreurs.push(`${nom} : statut inconnu « ${document.statut} »`);
    }
    if (!SOURCES_DATE.includes(document.date_source)) {
      erreurs.push(`${nom} : provenance de date inconnue « ${document.date_source} »`);
    }
    if (!dateIso(document.date_acte)) erreurs.push(`${nom} : date d'acte non ISO`);
    if (document.date_publication !== null && !dateIso(document.date_publication)) {
      erreurs.push(`${nom} : date de publication non ISO`);
    }
    if (document.version.trim() === "") erreurs.push(`${nom} : version absente`);
    if (!FORMATS.includes(document.format)) {
      erreurs.push(`${nom} : format inconnu « ${document.format} »`);
    }
    if (!urlAdmise(document.url)) erreurs.push(`${nom} : page officielle hors domaine admis`);
    if (!urlAdmise(document.source)) erreurs.push(`${nom} : source hors domaine admis`);
    if (document.format === "cellar" && (document.celex ?? "") === "") {
      erreurs.push(`${nom} : CELEX absent pour un rendu CELLAR`);
    }
    if (document.licence !== undefined && document.licence.trim() === "") {
      erreurs.push(`${nom} : licence vide`);
    }
  }

  for (const document of descripteur.documents) {
    for (const cible of document.remplace ?? []) {
      const remplace = parCle.get(cible);
      if (remplace === undefined) {
        erreurs.push(`${document.cle} : remplace « ${cible} », absent du descripteur`);
        continue;
      }
      if (remplace.statut !== "projet") {
        erreurs.push(`${document.cle} : remplace « ${cible} », qui n'est pas un projet`);
      }
      if (remplace.remplace_par !== document.cle) {
        erreurs.push(`${document.cle} : « ${cible} » ne déclare pas être remplacé par lui`);
      }
    }
    if (document.remplace_par !== undefined) {
      const finale = parCle.get(document.remplace_par);
      if (finale === undefined) {
        erreurs.push(`${document.cle} : remplacé par « ${document.remplace_par} », absent`);
        continue;
      }
      if (document.statut !== "projet") {
        erreurs.push(`${document.cle} : remplacé par une finale sans être un projet`);
      }
      if (finale.statut !== "final") {
        erreurs.push(`${document.cle} : remplacé par « ${finale.cle} », qui n'est pas finale`);
      }
      if (!(finale.remplace ?? []).includes(document.cle)) {
        erreurs.push(`${document.cle} : « ${finale.cle} » ne déclare pas le remplacer`);
      }
    }
  }

  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 12).join(" ; ");
    const reste = erreurs.length > 12 ? ` ; et ${erreurs.length - 12} autre(s)` : "";
    throw new Error(`Descripteur doctrine_ue invalide : ${liste}${reste}`);
  }
}

/** Lit et valide le descripteur. */
export function lireDescripteur(chemin: string): DescripteurDoctrineUe {
  const descripteur = JSON.parse(readFileSync(chemin, "utf8")) as DescripteurDoctrineUe;
  validerDescripteur(descripteur);
  return descripteur;
}

/** Un document listé par une page de référence de la Commission. */
export type LienListe = { url: string; titre: string };

/**
 * Motifs d'intitulé d'un document de doctrine : lignes directrices, codes de
 * bonne pratique, modèles, questions-réponses et conseils. Une page de
 * politique peut porter « guidelines » dans son texte ; l'intitulé du lien,
 * lui, désigne le document. « Frequently Asked Questions », « Questions and
 * answers » et « Questions-réponses » sont les formes longues de FAQ et Q&R.
 */
export const TITRE_DOCUMENT: RegExp =
  /guidelines?|lignes directrices|code of practice|template|faq|q\s*&\s*a|q\s*&\s*r|frequently asked questions|questions?\s+(?:and|&)\s+answers?|questions?\s*[-\/]\s*r[ée]ponses?|guidance/i;

/**
 * Chemin d'une page qui porte un document, par opposition à une page de
 * politique : bibliothèque, questions-réponses, consultations et, pour un
 * document servi sous cette forme, page de politique (le corpus y prend déjà
 * `code-practice-ai-generated-content` et `data-act-legal-helpdesk`). Les pages
 * d'actualité et d'agenda ne sont pas des documents.
 */
export function cheminDocument(url: string): boolean {
  if (!domaineAdmis(url)) return false;
  let chemin: string;
  try {
    chemin = new URL(url).pathname;
  } catch {
    return false;
  }
  return (
    chemin.startsWith("/en/library/") ||
    chemin.startsWith("/en/faqs/") ||
    chemin.startsWith("/en/faq") ||
    chemin.startsWith("/en/policies/") ||
    chemin.startsWith("/en/consultations/")
  );
}

/**
 * Chemin d'une page de politique générale. Elle peut porter seule un document
 * (le corpus y prend `code-practice-ai-generated-content` et
 * `data-act-legal-helpdesk`), mais c'est aussi le chemin des pages de
 * présentation qui renvoient un document déjà connu.
 */
export function cheminPolitique(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith("/en/policies/");
  } catch {
    return false;
  }
}

/** Zone de contenu d'une page : `<main>`, sinon `<article>`, sinon le corps. */
function zonePrincipale(html: string): string {
  const main = /<main\b[\s\S]*?<\/main>/i.exec(html);
  if (main !== null) return main[0];
  const article = /<article\b[\s\S]*?<\/article>/i.exec(html);
  if (article !== null) return article[0];
  return /<body\b[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
}

/** URL absolue sans fragment, ou `null` si elle n'est pas http(s). */
function urlAbsolue(brut: string, base: string): string | null {
  try {
    const url = new URL(brut, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

/** Une ancre d'une zone, son URL absolue et son texte visible. */
type Ancre = { url: string; texte: string };

function ancres(zone: string, pageUrl: string): Ancre[] {
  const liens: Ancre[] = [];
  const motif = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  for (let trouve = motif.exec(zone); trouve !== null; trouve = motif.exec(zone)) {
    const attributs = trouve[1] ?? "";
    const url = urlAbsolue(/href=["']([^"']+)["']/i.exec(attributs)?.[1] ?? "", pageUrl);
    if (url === null) continue;
    const texte = texteVisible(trouve[2] ?? "").replace(/\s+/g, " ").trim();
    liens.push({ url, texte });
  }
  return liens;
}

/**
 * Documents listés par une page de référence : ancres de la zone principale
 * dont l'intitulé porte un motif de document et dont le chemin est un chemin de
 * document. Dédupliqué par URL comparable (fragment retiré), première rencontre
 * gagnante.
 */
export function extraireDocumentsListes(html: string, pageUrl: string): LienListe[] {
  const documents: LienListe[] = [];
  const vus = new Set<string>();
  for (const ancre of ancres(zonePrincipale(html), pageUrl)) {
    if (ancre.texte === "") continue;
    if (!TITRE_DOCUMENT.test(ancre.texte)) continue;
    if (!cheminDocument(ancre.url)) continue;
    if (vus.has(ancre.url)) continue;
    vus.add(ancre.url);
    documents.push({ url: ancre.url, titre: ancre.texte });
  }
  return documents;
}

/** Vrai pour un lien qui sert un fichier : PDF, redirection newsroom ou rendu CELLAR. */
function lienTelechargement(url: string): boolean {
  let chemin: string;
  try {
    chemin = new URL(url).pathname;
  } catch {
    return false;
  }
  return (
    chemin.toLowerCase().endsWith(".pdf") ||
    chemin.includes("/newsroom/dae/redirection/document/") ||
    chemin.includes("/resource/celex/")
  );
}

/**
 * Liens de téléchargement publiés par une page de document : PDF, redirections
 * `ec.europa.eu/newsroom/dae/redirection/document/…`, rendus CELLAR
 * `publications.europa.eu/resource/celex/…`. Sert d'empreinte du document et de
 * reconnaissance d'un alias (même fichier, autre page).
 */
export function liensTelechargement(html: string, pageUrl: string): string[] {
  const liens = new Set<string>();
  for (const ancre of ancres(html, pageUrl)) {
    if (!lienTelechargement(ancre.url)) continue;
    liens.add(ancre.url);
  }
  return [...liens].sort();
}

/**
 * URLs absolues de toutes les ancres d'une page, triées : une page de
 * présentation se reconnaît à ce qu'elle renvoie vers un document déjà déclaré.
 */
export function liensPage(html: string, pageUrl: string): string[] {
  return [...new Set(ancres(html, pageUrl).map((ancre) => ancre.url))].sort();
}
