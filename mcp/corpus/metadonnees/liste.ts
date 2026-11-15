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
  | "commission";

export type EcartesCedh = Record<MotifEcartCedh, number>;

export const ECARTES_CEDH_VIDES: EcartesCedh = {
  date_invalide: 0,
  reference_absente: 0,
  langue_hors_perimetre: 0,
  commission: 0,
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
  /** Lien du PDF officiel, ou la page du registre quand la ligne n'en porte pas. */
  url: string;
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

/** Vrai pour une branche hors périmètre, avec son motif lu au descripteur. */
function brancheEcartee(
  branche: string,
  descripteur: DescripteurMetadonnees,
): MotifEcartCedh | null {
  if (branche in descripteur.cedh.branches_ecartees) return "commission";
  return null;
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
    const pdf = /href="(\/system\/files\/[^"]+?\.pdf)"/.exec(resume)?.[1];
    const sujets = [...morceau.matchAll(/relevant-topics-list-item-link"[^>]*>([^<]+)</g)]
      .map((trouve) => texteHtml(trouve[1] ?? ""))
      .filter((sujet) => sujet !== "");
    lignes.push({
      id: identifiant ?? "",
      date: date === "" ? "" : date.slice(0, 10),
      autorite: nomAutorite === undefined ? null : texteHtml(nomAutorite),
      pays: codePays === undefined ? null : codePays.toLowerCase(),
      url:
        pdf === undefined
          ? descripteur.registre.url_modele.replace("{page}", "0")
          : `${descripteur.registre.base}${pdf}`,
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

/** Unités du registre : une notice par décision définitive, sans texte. */
export function unitesRegistre(
  entrees: readonly EntreeRegistre[],
  descripteur: DescripteurMetadonnees,
): Unite[] {
  return entrees.map((entree) => ({
    ref: entree.id,
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
  }));
}

/** Classe les lignes du registre : identifiant et date valides, doublons fusionnés. */
export function classerRegistre(
  lignes: readonly EntreeRegistre[],
): { retenues: EntreeRegistre[]; ecartes: EcartesRegistre } {
  const ecartes: EcartesRegistre = { ...ECARTES_REGISTRE_VIDES };
  const parId = new Map<string, EntreeRegistre>();
  for (const ligne of lignes) {
    if (ligne.id.trim() === "") {
      ecartes.identifiant_absent += 1;
      continue;
    }
    if (!dateValide(ligne.date)) {
      ecartes.date_invalide += 1;
      continue;
    }
    if (parId.has(ligne.id)) {
      // Le registre n'a pas d'ordre stable entre deux pages : une même ligne peut
      // se déplacer d'une page à l'autre pendant la passe.
      ecartes.doublon += 1;
      continue;
    }
    parId.set(ligne.id, ligne);
  }
  const retenues = [...parId.values()].sort((gauche, droite) => gauche.id.localeCompare(droite.id));
  return { retenues, ecartes };
}
