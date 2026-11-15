/**
 * Lit les deux sources du corpus `metadonnees` et les range en unités.
 *
 * Aucune de ces sources ne livre de texte au corpus : HUDOC rend une fiche
 * (identifiant, intitulé, requête, date, formation, langue) et le registre du
 * CEPD une ligne par décision définitive du guichet unique. L'unité porte donc
 * une ligne de métadonnées, jamais l'arrêt ni la décision, et son rendu le dit.
 *
 * Le critère CEDH est déclaré au descripteur, jamais déduit : article 8 de la
 * Convention **et** un mot-clé de données personnelles, collections `JUDGMENTS`
 * et `DECISIONS` (les communications sont hors périmètre), versions française
 * et anglaise seulement. Une décision est ensuite une seule unité : la version
 * française quand elle existe, l'anglaise sinon.
 */

import type { Unite } from "../parse.ts";
import { decoderEntites } from "../parse.ts";

/** Métadonnées du corpus, lues depuis `mcp/corpus/metadonnees/descripteur.json`. */
export type DescripteurMetadonnees = {
  corpus: string;
  nom: string;
  titre: string;
  /** Attente entre deux requêtes, en millisecondes. */
  delai_ms: number;
  user_agent: string;
  /** Durée de validité du cache des pages ; `--refresh` le force. */
  cache_validite_jours: number;
  /** Attentes avant de réessayer un refus transitoire de la source (403, 429, 5xx). */
  reprises_ms: number[];
  cedh: {
    endpoint: string;
    url_source: string;
    /** Préfixe du lien officiel d'une fiche : `…/fre?i=001-90052`. */
    url_item: string;
    ranking_model: string;
    taille_page: number;
    select: string;
    requete: string;
    criteres: string;
    mots_cles: string[];
    /** Requêtes dont la rétention est vérifiée par les tests. */
    cas_connus_retenus: string[];
    autorite: string;
    formations: Record<string, string>;
    types: Record<string, string>;
    /** Branches HUDOC hors périmètre, avec leur motif. */
    branches_ecartees: Record<string, string>;
    /**
     * Source arrêtée, avec son motif et sa preuve ; `null` quand elle est lue.
     * Le critère et le code de lecture restent, la passe ne demande plus rien.
     */
    abandonnee: { le: string; motif: string; preuve: string; reprise: string } | null;
    licence: string;
    licence_url: string;
  };
  registre: {
    url_modele: string;
    /** Page du registre filtrée sur un identifiant, pour une ligne sans PDF. */
    url_notice: string;
    base: string;
    criteres: string;
    autorite_prefixe: string;
    titre_prefixe: string;
    licence: string;
    licence_url: string;
  };
  pays: Record<string, string>;
};

/** Une fiche HUDOC, avant fusion des versions linguistiques. */
export type EntreeCedh = {
  itemid: string;
  docname: string;
  appno: string;
  date: string;
  /** `GRANDCHAMBER`, `CHAMBER`, `COMMITTEE`, `ADMISSIBILITY`… */
  branche: string;
  /** `FRE` ou `ENG`. */
  langue: string;
  /** `HFJUD`, `HEJUD`, `HFDEC`, `HEDEC`. */
  doctype: string;
};

/** Une décision CEDH après fusion : une par requête et par date. */
export type DecisionCedh = EntreeCedh;

export type MotifEcartCedh =
  | "date_invalide"
  | "reference_absente"
  | "langue_hors_perimetre"
  | "commission"
  | "communication"
  | "hors_perimetre";

/** Motif propre à une branche HUDOC écartée : l'ancienne Commission, les communications. */
const MOTIF_PAR_BRANCHE: Record<string, MotifEcartCedh> = {
  DECCOMMISSION: "commission",
  COMMUNICATEDCASES: "communication",
};

export type EcartesCedh = Record<MotifEcartCedh, number>;

export const ECARTES_CEDH_VIDES: EcartesCedh = {
  date_invalide: 0,
  reference_absente: 0,
  langue_hors_perimetre: 0,
  commission: 0,
  communication: 0,
  hors_perimetre: 0,
};

/** Une ligne du registre des décisions définitives du guichet unique. */
export type EntreeRegistre = {
  /** Identifiant officiel, par exemple `EDPBI:NO:OSS:D:2026:4219`. */
  id: string;
  date: string;
  /** Autorité chef de file telle que le registre la nomme ; `null` si la ligne ne la porte pas. */
  autorite: string | null;
  /** Code pays du chef de file, par exemple `no`. */
  pays: string | null;
  /** Lien du PDF officiel, ou la page du registre filtrée quand la ligne n'en porte pas. */
  url: string;
  /** D'où vient `url` : le PDF officiel, ou la page du registre. */
  lien: "pdf" | "registre";
  /** Sujets déclarés par le registre, jamais un résumé de la décision. */
  sujets: string[];
};

export type MotifEcartRegistre = "identifiant_absent" | "date_invalide" | "doublon";

export type EcartesRegistre = Record<MotifEcartRegistre, number>;

export const ECARTES_REGISTRE_VIDES: EcartesRegistre = {
  identifiant_absent: 0,
  date_invalide: 0,
  doublon: 0,
};

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai pour une date `AAAA-MM-JJ` réellement existante. */
export function dateValide(date: string): boolean {
  if (!DATE_ISO.test(date)) return false;
  const instant = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(instant) && new Date(instant).toISOString().slice(0, 10) === date;
}

/** URL de la requête HUDOC d'une page : la même interface que le site utilise. */
export function urlRequeteCedh(
  descripteur: DescripteurMetadonnees,
  debut: number,
  taille: number,
): string {
  const parametres = new URLSearchParams({
    query: descripteur.cedh.requete,
    select: descripteur.cedh.select,
    sort: "kpdateAscending",
    start: String(debut),
    length: String(taille),
    rankingModelId: descripteur.cedh.ranking_model,
  });
  return `${descripteur.cedh.endpoint}?${parametres.toString()}`;
}

type Binding = { value?: unknown };
type ReponseHudoc = { resultcount?: unknown; results?: unknown };

/**
 * Colonnes d'une fiche HUDOC : la réponse sert des chaînes, une variante
 * enveloppe la valeur dans `{ value }` ; les deux formes sont lues.
 */
function valeurColonne(valeur: unknown): string | null {
  if (typeof valeur === "string") return valeur;
  if (typeof valeur === "object" && valeur !== null) {
    const interne = (valeur as Binding).value;
    if (typeof interne === "string") return interne;
  }
  return null;
}

function colonnes(reponse: unknown): {
  total: number;
  fiches: Array<Record<string, string>>;
} {
  if (typeof reponse !== "object" || reponse === null) return { total: 0, fiches: [] };
  const { resultcount, results } = reponse as ReponseHudoc;
  const total = typeof resultcount === "number" && Number.isFinite(resultcount) ? resultcount : 0;
  if (!Array.isArray(results)) return { total, fiches: [] };
  const fiches: Array<Record<string, string>> = [];
  for (const resultat of results) {
    if (typeof resultat !== "object" || resultat === null) continue;
    const brutes = (resultat as { columns?: unknown }).columns;
    if (typeof brutes !== "object" || brutes === null) continue;
    const fiche: Record<string, string> = {};
    for (const [cle, valeur] of Object.entries(brutes as Record<string, unknown>)) {
      const texte = valeurColonne(valeur);
      if (texte !== null) fiche[cle] = texte;
    }
    fiches.push(fiche);
  }
  return { total, fiches };
}

/** Lit une page de la réponse HUDOC : total annoncé et fiches de la page. */
export function lirePageCedh(reponse: unknown): { total: number; entrees: EntreeCedh[] } {
  const { total, fiches } = colonnes(reponse);
  const entrees: EntreeCedh[] = [];
  for (const fiche of fiches) {
    entrees.push({
      itemid: fiche.itemid ?? "",
      docname: fiche.docname ?? "",
      appno: fiche.appno ?? "",
      date: (fiche.kpdate ?? "").slice(0, 10),
      branche: fiche.doctypebranch ?? "",
      langue: (fiche.languageisocode ?? "").toUpperCase(),
      doctype: fiche.doctype ?? "",
    });
  }
  return { total, entrees };
}

/** Motif d'une branche hors périmètre, `null` quand la branche est retenue. */
function brancheEcartee(
  branche: string,
  descripteur: DescripteurMetadonnees,
): MotifEcartCedh | null {
  if (!(branche in descripteur.cedh.branches_ecartees)) return null;
  return MOTIF_PAR_BRANCHE[branche] ?? "hors_perimetre";
}

/**
 * Fusionne les pages HUDOC en une décision par couple (requête, date) et
 * applique le périmètre. La version française gagne sur l'anglaise ; une fiche
 * dont la branche est écartée au descripteur l'est avec son motif. Les comptes
 * portent sur les fiches lues, pas sur les décisions retenues : une décision
 * rendue en deux langues compte deux fiches pour une unité.
 */
export function fusionnerCedh(
  fiches: readonly EntreeCedh[],
  descripteur: DescripteurMetadonnees,
): {
  decisions: DecisionCedh[];
  ecartes: EcartesCedh;
  exclusions: Array<{ itemid: string; appno: string; motif: MotifEcartCedh }>;
} {
  const ecartes: EcartesCedh = { ...ECARTES_CEDH_VIDES };
  const exclusions: Array<{ itemid: string; appno: string; motif: MotifEcartCedh }> = [];
  const parDecision = new Map<string, DecisionCedh>();

  for (const fiche of fiches) {
    const motif =
      fiche.langue !== "FRE" && fiche.langue !== "ENG"
        ? "langue_hors_perimetre"
        : brancheEcartee(fiche.branche, descripteur);
    if (motif !== null) {
      ecartes[motif] += 1;
      exclusions.push({ itemid: fiche.itemid, appno: fiche.appno, motif });
      continue;
    }
    if (!dateValide(fiche.date)) {
      ecartes.date_invalide += 1;
      exclusions.push({ itemid: fiche.itemid, appno: fiche.appno, motif: "date_invalide" });
      continue;
    }
    if (fiche.appno.trim() === "") {
      ecartes.reference_absente += 1;
      exclusions.push({ itemid: fiche.itemid, appno: fiche.appno, motif: "reference_absente" });
      continue;
    }
    const cle = `${fiche.appno}\u0000${fiche.date}`;
    const connue = parDecision.get(cle);
    if (connue === undefined || (connue.langue !== "FRE" && fiche.langue === "FRE")) {
      parDecision.set(cle, { ...fiche });
    }
  }

  const decisions = [...parDecision.values()].sort(
    (gauche, droite) =>
      gauche.date.localeCompare(droite.date) ||
      gauche.appno.localeCompare(droite.appno) ||
      gauche.itemid.localeCompare(droite.itemid),
  );
  return { decisions, ecartes, exclusions };
}

/** Libellé de formation : celui du descripteur, sinon la branche brute. */
function formation(decision: DecisionCedh, descripteur: DescripteurMetadonnees): string {
  return descripteur.cedh.formations[decision.branche] ?? decision.branche;
}

/** Statut source d'une décision CEDH : « Arrêt » ou « Décision ». */
export function statutCedh(decision: DecisionCedh, descripteur: DescripteurMetadonnees): string {
  return descripteur.cedh.types[decision.doctype] ?? "Décision";
}

/**
 * Ligne de métadonnées d'une décision CEDH : intitulé officiel, autorité,
 * formation, date et numéro de requête. Elle est indexée telle quelle pour
 * rendre la décision trouvable ; aucun texte de l'arrêt n'y entre.
 */
export function ligneCedh(decision: DecisionCedh, descripteur: DescripteurMetadonnees): string {
  const titre = decision.docname.trim();
  return (
    `${titre} — ${descripteur.cedh.autorite} (${formation(decision, descripteur)}) — ` +
    `${decision.date} — requête ${decision.appno}`
  );
}

/** Unités du corpus CEDH : une notice par décision, sans texte. */
export function unitesCedh(
  decisions: readonly DecisionCedh[],
  descripteur: DescripteurMetadonnees,
): Unite[] {
  return decisions.map((decision) => {
    const statut = statutCedh(decision, descripteur);
    const titre = decision.docname.trim();
    return {
      ref: `${decision.appno}#${decision.date}`,
      document: decision.appno,
      corpus: descripteur.corpus,
      niveau: "notice",
      numero: decision.appno,
      chemin: `CEDH > ${statut} > ${formation(decision, descripteur)}`,
      texte: ligneCedh(decision, descripteur),
      date_acte: decision.date,
      date_debut: decision.date,
      date_fin: null,
      statut,
      url: `${descripteur.cedh.url_item}${decision.itemid}`,
      titre,
      autorite: descripteur.cedh.autorite,
      nature: "juridiction",
      metadonnees_seulement: true,
    };
  });
}

/** Texte visible d'un fragment HTML : balises retirées, entités décodées. */
function texteHtml(fragment: string): string {
  return decoderEntites(fragment.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombre annoncé par l'en-tête du registre (« 1 603 éléments ») ; `null` sinon. */
export function totalRegistre(html: string): number | null {
  const trouve = /(\d[\d\s\u00a0\u202f]*)\s*éléments/.exec(html);
  if (trouve?.[1] === undefined) return null;
  const chiffres = trouve[1].replace(/\D/g, "");
  return chiffres === "" ? null : Number(chiffres);
}

/** Lignes d'une page du registre, dans l'ordre de la page. */
export function lireRegistre(html: string, descripteur: DescripteurMetadonnees): EntreeRegistre[] {
  const lignes: EntreeRegistre[] = [];
  const morceaux = html.split('class="view-foss-decisions-overview-overview__row"').slice(1);
  for (const morceau of morceaux) {
    const identifiant = /EDPBI:[A-Z0-9:]+/.exec(morceau)?.[0];
    const date = /<time datetime="(\d{4}-\d{2}-\d{2})/.exec(morceau)?.[1] ?? "";
    const resume = morceau.split("</summary>")[0] ?? morceau;
    const apresChef = resume.split("foss-decision-foss-decision-teaser__lead-sa")[1] ?? "";
    const nomAutorite = /member-state-token__name">\s*([^<]+?)\s*</.exec(apresChef)?.[1];
    const codePays = /member-country-token__code">\s*([a-z]{2})\s*</.exec(apresChef)?.[1];
    // L'extension est parfois servie en majuscules : `.PDF`.
    const pdf = /href="(\/system\/files\/[^"]+?\.pdf)"/i.exec(resume)?.[1];
    const sujets = [...morceau.matchAll(/relevant-topics-list-item-link"[^>]*>([^<]+)</g)]
      .map((trouve) => texteHtml(trouve[1] ?? ""))
      .filter((sujet) => sujet !== "");
    const id = identifiant ?? "";
    lignes.push({
      id,
      date: date === "" ? "" : date.slice(0, 10),
      autorite: nomAutorite === undefined ? null : texteHtml(nomAutorite),
      pays: codePays === undefined ? null : codePays.toLowerCase(),
      url:
        pdf === undefined
          ? descripteur.registre.url_notice.replace("{id}", encodeURIComponent(id))
          : `${descripteur.registre.base}${pdf}`,
      lien: pdf === undefined ? "registre" : "pdf",
      sujets: [...new Set(sujets)],
    });
  }
  return lignes;
}

/** Autorité chef de file lisible : le nom du registre, sinon le pays, sinon son code. */
export function autoriteRegistre(
  entree: EntreeRegistre,
  descripteur: DescripteurMetadonnees,
): string {
  const prefixe = descripteur.registre.autorite_prefixe;
  if (entree.autorite !== null && entree.autorite.trim() !== "") {
    return `${prefixe} : ${entree.autorite.trim()}`;
  }
  if (entree.pays === null) return `${prefixe} : non précisée`;
  return `${prefixe} : ${descripteur.pays[entree.pays] ?? entree.pays.toUpperCase()}`;
}

/** Numéro d'une décision : dernier segment de son identifiant EDPBI. */
export function numeroRegistre(id: string): string {
  const segments = id.split(":");
  return segments[segments.length - 1] ?? id;
}

/**
 * Ligne de métadonnées d'une décision du registre : intitulé, autorité chef de
 * file, date et sujets tels que le registre les publie. Sans eux, l'identifiant
 * seul ne rendrait la décision trouvable par aucun sujet.
 */
export function ligneRegistre(entree: EntreeRegistre, descripteur: DescripteurMetadonnees): string {
  const elements = [
    `${descripteur.registre.titre_prefixe} n° ${numeroRegistre(entree.id)}`,
    autoriteRegistre(entree, descripteur),
    entree.date,
    ...(entree.sujets.length === 0 ? [] : [`sujets : ${entree.sujets.join(" ; ")}`]),
  ];
  return elements.join(" — ");
}

/**
 * Unités du registre : une notice par décision définitive, sans texte. Un
 * identifiant que le registre porte deux fois donne deux notices : la première
 * garde l'identifiant pour référence, la suivante y ajoute son rang.
 */
export function unitesRegistre(
  entrees: readonly EntreeRegistre[],
  descripteur: DescripteurMetadonnees,
): Unite[] {
  const rangs = new Map<string, number>();
  return entrees.map((entree) => {
    const rang = rangs.get(entree.id) ?? 0;
    rangs.set(entree.id, rang + 1);
    return {
      ref: rang === 0 ? entree.id : `${entree.id}#${rang + 1}`,
      document: entree.id,
      corpus: descripteur.corpus,
      niveau: "notice",
      numero: numeroRegistre(entree.id),
      chemin: "Registre du guichet unique > Décisions définitives",
      texte: ligneRegistre(entree, descripteur),
      date_acte: entree.date,
      date_debut: entree.date,
      date_fin: null,
      statut: "Décision définitive",
      url: entree.url,
      titre: `${descripteur.registre.titre_prefixe} n° ${numeroRegistre(entree.id)}`,
      autorite: autoriteRegistre(entree, descripteur),
      nature: "autorite",
      metadonnees_seulement: true,
    };
  });
}

/**
 * Identité du document derrière un lien du registre. Un numéro de décision lu
 * dans le nom du fichier (`decision-no-3851_1.pdf`, `decision-no-973.pdf`) fait
 * foi ; à défaut, le nom est normalisé et son suffixe de version retiré, parce
 * que le registre sert la même décision sous deux noms (`…_redacted.pdf` et
 * `…_redacted_0.pdf`) ou depuis deux dossiers.
 */
export function cleDocument(url: string): string {
  const fichier = decodeURIComponent(url.split("/").pop() ?? "").replace(/\.pdf$/i, "");
  const numero = /(?:decision[-_]?no[-_]?|[-_]no[-_])(\d+)/i.exec(fichier)?.[1];
  if (numero !== undefined) return `no:${numero}`;
  let nom = fichier
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Le registre ajoute un suffixe de version (`_0`, `_1`) ou de langue (`_en`) :
  // deux noms qui ne diffèrent que par là désignent la même décision.
  for (;;) {
    const suivant = nom.replace(/-(?:\d+|en|fr|eng|fra)$/, "");
    if (suivant === nom || suivant === "") break;
    nom = suivant;
  }
  return `nom:${nom}`;
}

/**
 * Valide les notices avant écriture : le corpus ne promet que des métadonnées,
 * et une unité qui porterait un texte multiligne, un titre ou un lien manquant
 * le dirait trop tard. Lève en nommant la référence fautive.
 */
export function validerNotices(unites: readonly Unite[]): void {
  const erreurs: string[] = [];
  for (const unite of unites) {
    if (unite.niveau !== "notice") erreurs.push(`niveau non notice : ${unite.ref}`);
    if (unite.metadonnees_seulement !== true) {
      erreurs.push(`metadonnees_seulement absent : ${unite.ref}`);
    }
    if (unite.texte.includes("\n")) erreurs.push(`texte multiligne : ${unite.ref}`);
    if (unite.url.trim() === "") erreurs.push(`lien absent : ${unite.ref}`);
    if ((unite.titre ?? "").trim() === "") erreurs.push(`titre absent : ${unite.ref}`);
    if ((unite.autorite ?? "").trim() === "") erreurs.push(`autorité absente : ${unite.ref}`);
  }
  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 10).join(" ; ");
    const reste = erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : "";
    throw new Error(`Corpus METADONNEES : notices invalides, rien n'est écrit : ${liste}${reste}`);
  }
}

/**
 * Classe les lignes du registre. Une ligne est identifiée par son identifiant
 * EDPBI **et** par le document que son lien désigne : le registre n'a pas
 * d'ordre stable entre deux pages, il sert la même décision sous deux noms de
 * fichier, et il lui arrive de servir deux décisions distinctes sous un même
 * identifiant (`decision-no-3850.pdf` et `decision-no-3851_1.pdf`). Un même
 * identifiant et un même document sont un doublon ; deux documents différents
 * sont conservés tous les deux.
 */
export function classerRegistre(
  lignes: readonly EntreeRegistre[],
): { retenues: EntreeRegistre[]; ecartes: EcartesRegistre } {
  const ecartes: EcartesRegistre = { ...ECARTES_REGISTRE_VIDES };
  const parCle = new Map<string, EntreeRegistre>();
  for (const ligne of lignes) {
    if (ligne.id.trim() === "") {
      ecartes.identifiant_absent += 1;
      continue;
    }
    if (!dateValide(ligne.date)) {
      ecartes.date_invalide += 1;
      continue;
    }
    const cle = `${ligne.id}\u0000${cleDocument(ligne.url)}`;
    if (parCle.has(cle)) {
      ecartes.doublon += 1;
      continue;
    }
    parCle.set(cle, ligne);
  }
  const retenues = [...parCle.values()].sort(
    (gauche, droite) =>
      gauche.id.localeCompare(droite.id) ||
      gauche.date.localeCompare(droite.date) ||
      gauche.url.localeCompare(droite.url),
  );
  return { retenues, ecartes };
}
