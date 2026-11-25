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
