/**
 * Lecture des lignes du jeu « Avis et conseils de la CADA » et découpage en
 * fragments.
 *
 * Un document est un avis ou un conseil ; son numéro de dossier est son
 * identifiant. Le texte est copié, jamais reformulé : le découpage reprend
 * celui des incréments DILA de la CNIL (`decouperParagraphes`) — les
 * paragraphes sont regroupés jusqu'à 1 200 caractères, un paragraphe plus long
 * reste seul, et un fragment plus court que 600 apparaît quand le paragraphe
 * suivant ne tient pas. Aucun caractère n'est perdu ; les blancs sont
 * normalisés.
 */

import { readFileSync } from "node:fs";
import { decouperParagraphes } from "../cnil/parse.ts";
import type { Unite } from "../parse.ts";

/** Descripteur du corpus, partagé avec `cada:sync` et la veille. */
export type DescripteurCada = {
  corpus: string;
  nom: string;
  jeu: { id: string; url: string; api: string };
  ressource: { id: string; titre: string; url: string; sha1: string; modifiee_le: string };
  licence: string;
  /** Sélection thématique déclarée, appliquée à toutes les dates. */
  selection: {
    /** Expression régulière, insensible à la casse. */
    motif: string;
    /** Colonnes du CSV où chercher le motif. */
    champs: string[];
    /** Seuils de date appliqués dans l'ordre si la sélection dépasse le plafond. */
    date_min: string[];
  };
  volume: { unites_index: number; fragments_max: number };
  /** Motif d'URL officielle, `{numero}` remplacé par le numéro de dossier. */
  url_texte: string;
  url_texte_verifiee: boolean;
  url_texte_note: string;
};

/** Colonnes du CSV consolidé, dans l'ordre attendu. */
export const COLONNES = [
  "Numéro de dossier",
  "Administration",
  "Type",
  "Année",
  "Séance",
  "Objet",
  "Thème et sous thème",
  "Mots clés",
  "Sens et motivation",
  "Partie",
  "Avis",
] as const;

/** Un avis ou conseil retenu, avant découpage. */
export type DocumentCada = {
  numero: string;
  administration: string;
  nature: string;
  /** Date de séance en ISO (`AAAA-MM-JJ`). */
  date: string;
  theme: string;
  motsCles: string[];
  sens: string;
  motivation: string;
  texte: string;
};

/** Une ligne écartée, groupée par motif. */
export type ExclusionCada = { motif: string; lignes: number };

/** Anomalie de typage déclarée, jamais renommée. */
export type AnomalieCada = { constat: string; lignes: number; traitement: string };

/** Décision de volume : la sélection thématique seule, ou bornée par une date. */
export type DecisionVolume = "selection" | "selection_date";

/** Ce que la règle de volume a mesuré et retenu, et la règle appliquée. */
export type VolumeCada = {
  /** Fragments de tout le corpus valide, toutes dates. */
  fragments_total: number;
  /** Fragments de la seule sélection thématique, toutes dates. */
  fragments_selection: number;
  fragments_retenus: number;
  plafond: number;
  /** Part des unités déjà indexées que les fragments retenus représenteraient. */
  part_index: number;
  decision: DecisionVolume;
  /** Seuil de date appliqué en plus du motif ; `null` quand toutes les dates sont gardées. */
  date_min: string | null;
  /** Règle effectivement appliquée, dite au manifeste. */
  regle: string;
  /** Fragments au-delà du plafond quand le dernier seuil ne suffit pas ; zéro sinon. */
  depassement: number;
};

/** Lit le descripteur ; le chemin par défaut est celui du dépôt. */
export function lireDescripteur(chemin: string): DescripteurCada {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurCada;
}

const DATE_SOURCE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const NUMERO = /^\d{6,12}$/;

/** `03/03/1984` → `1984-03-03` ; `null` si la date n'est pas exploitable. */
export function dateIso(seance: string): string | null {
  const trouve = DATE_SOURCE.exec(seance.trim());
  if (trouve === null) return null;
  const [, jour, mois, annee] = trouve;
  const date = `${annee}-${mois}-${jour}`;
  return Number.isNaN(Date.parse(date)) ? null : date;
}

/** Sens lu avant la barre : « Défavorable/Défense » → « Défavorable ». */
export function sensDe(source: string): string {
  return (source.split("/")[0] ?? "").trim();
}

/** Motivation lue après la barre, vide quand la source n'en porte pas. */
export function motivationDe(source: string): string {
  const index = source.indexOf("/");
  return index < 0 ? "" : source.slice(index + 1).trim();
}

/**
 * Découpe un texte en fragments : paragraphes regroupés jusqu'à 1 200
 * caractères, un paragraphe long restant seul, fragment court possible quand le
 * suivant ne tient pas ; aucun caractère n'est perdu, les blancs sont normalisés.
 */
export function decouperAvis(texte: string): string[] {
  const paragraphes = texte
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((paragraphe) => paragraphe.trim())
    .filter((paragraphe) => paragraphe !== "");
  return decouperParagraphes(paragraphes);
}

/** Position des colonnes lues, par leur nom d'en-tête. */
export function colonnesDe(enTete: readonly string[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const colonne of COLONNES) {
    const position = enTete.findIndex((nom) => nom.trim() === colonne);
    if (position < 0) throw new Error(`Colonne « ${colonne} » absente du CSV de la CADA.`);
    index.set(colonne, position);
  }
  return index;
}

/** Compile le motif déclaré de la sélection thématique, insensible à la casse. */
export function motifSelection(descripteur: DescripteurCada): RegExp {
  return new RegExp(descripteur.selection.motif, "i");
}

/**
 * Vrai si un des champs déclarés de la ligne porte le motif de sélection. Le
 * motif s'applique toutes dates confondues ; une colonne déclarée absente est
 * une erreur de descripteur, jamais un silence.
 */
export function estSelectionne(
  champs: readonly string[],
  colonnes: Map<string, number>,
  motif: RegExp,
  descripteur: DescripteurCada,
): boolean {
  for (const champ of descripteur.selection.champs) {
    const position = colonnes.get(champ);
    if (position === undefined) {
      throw new Error(`Colonne « ${champ} » de la sélection absente du CSV de la CADA.`);
    }
    if (motif.test(champs[position] ?? "")) return true;
  }
  return false;
}

/** Une ligne mappée ou le motif de son rejet. */
export type LectureLigne =
  | { genre: "document"; document: DocumentCada }
  | { genre: "exclue"; motif: string };

/**
 * Mappe une ligne du CSV. Une ligne sans numéro exploitable, sans date ou sans
 * texte est écartée avec son motif, jamais devinée.
 */
export function lireLigne(champs: readonly string[], colonnes: Map<string, number>): LectureLigne {
  const valeur = (colonne: (typeof COLONNES)[number]): string =>
    (champs[colonnes.get(colonne) ?? -1] ?? "").trim();

  const numero = valeur("Numéro de dossier");
  if (!NUMERO.test(numero)) return { genre: "exclue", motif: "numéro invalide" };

  const seance = valeur("Séance");
  const date = dateIso(seance);
  if (date === null) return { genre: "exclue", motif: "date invalide" };

  const texte = valeur("Avis");
  if (texte === "") return { genre: "exclue", motif: "texte vide" };

  const sensSource = valeur("Sens et motivation");
  return {
    genre: "document",
    document: {
      numero,
      administration: valeur("Administration"),
      nature: valeur("Type"),
      date,
      theme: valeur("Thème et sous thème"),
      motsCles: valeur("Mots clés")
        .split(",")
        .map((mot) => mot.trim())
        .filter((mot) => mot !== ""),
      sens: sensDe(sensSource),
      motivation: motivationDe(sensSource),
      texte,
    },
  };
}

/** Les natures attendues ; toute autre valeur est déclarée comme anomalie. */
export const NATURES = ["Avis", "Conseil"] as const;

/** Vrai si la nature est une anomalie de typage de la source. */
export function estAnomalie(nature: string): boolean {
  return !(NATURES as readonly string[]).includes(nature);
}

/**
 * Forme canonique d'un numéro de dossier sur cada.fr : neuf chiffres, l'année
 * puis cinq chiffres. Les fiches à huit chiffres redirigent en 301 vers cette
 * forme ; `19840002` → `198400002`, `202402142` inchangé.
 */
export function numeroCanonique(numero: string): string {
  const annee = numero.slice(0, 4);
  const reste = numero.slice(4).padStart(5, "0");
  return `${annee}${reste}`;
}

/**
 * Une unité par fragment. `chemin` porte la nature, le numéro, l'administration
 * et le sens ; la ref est `<numéro>#f<n>`, la numérotation venant de nous.
 */
export function unitesCada(document: DocumentCada, descripteur: DescripteurCada): Unite[] {
  const url = descripteur.url_texte.replace("{numero}", numeroCanonique(document.numero));
  return decouperAvis(document.texte).map((texte, index) => ({
    ref: `${document.numero}#f${index}`,
    document: document.numero,
    corpus: descripteur.corpus,
    niveau: "fragment",
    numero: document.numero,
    chemin:
      `${descripteur.nom} > ${document.nature} > ${document.numero}` +
      (document.administration === "" ? "" : ` > ${document.administration}`) +
      (document.sens === "" ? "" : ` > ${document.sens}`),
    texte,
    date_acte: document.date,
    date_debut: document.date,
    date_fin: null,
    statut: document.nature,
    url,
    nature: document.nature,
    ...(document.administration === "" ? {} : { administration: document.administration }),
    ...(document.sens === "" ? {} : { sens: document.sens }),
  }));
}

/** Résultat du premier passage : comptes et volumétrie, sans unités gardées. */
export type MesureCada = {
  lignes_lues: number;
  /** Fragments par numéro de dossier, pour toutes les lignes valides. */
  fragments: Map<string, number>;
  /** Dates des lignes valides, par numéro de dossier. */
  dates: Map<string, string>;
  /** Numéros de dossier retenus par la sélection thématique. */
  selection: Set<string>;
  /** Documents valides, toutes dates et tous thèmes. */
  documents: number;
  /** Documents retenus par la sélection thématique, toutes dates. */
  documents_selection: number;
  /** Fragments de tous les documents valides. */
  fragments_total: number;
  /** Fragments de la seule sélection thématique. */
  fragments_selection: number;
  motifs: Map<string, number>;
  anomalies: Map<string, number>;
  borne_min: string | null;
  borne_max: string | null;
};

/** Une mesure vide, à nourrir ligne par ligne par un flux. */
export function creerMesure(): MesureCada {
  return {
    lignes_lues: 0,
    fragments: new Map(),
    dates: new Map(),
    selection: new Set(),
    documents: 0,
    documents_selection: 0,
    fragments_total: 0,
    fragments_selection: 0,
    motifs: new Map(),
    anomalies: new Map(),
    borne_min: null,
    borne_max: null,
  };
}

/**
 * Ajoute une ligne à la mesure ; une ligne invalide est comptée par son motif,
 * et une ligne valide hors sélection thématique est comptée à part, sans
 * jamais entrer dans les fragments du corpus.
 */
export function ajouterLigne(
  mesure: MesureCada,
  champs: readonly string[],
  colonnes: Map<string, number>,
  motif: RegExp,
  descripteur: DescripteurCada,
): void {
  if (champs.length === 0) return;
  mesure.lignes_lues += 1;
  const lecture = lireLigne(champs, colonnes);
  if (lecture.genre === "exclue") {
    mesure.motifs.set(lecture.motif, (mesure.motifs.get(lecture.motif) ?? 0) + 1);
    return;
  }
  const { document } = lecture;
  if (mesure.fragments.has(document.numero)) {
    mesure.motifs.set("numéro dupliqué", (mesure.motifs.get("numéro dupliqué") ?? 0) + 1);
    return;
  }
  const fragments = decouperAvis(document.texte).length;
  mesure.fragments.set(document.numero, fragments);
  mesure.dates.set(document.numero, document.date);
  mesure.documents += 1;
  mesure.fragments_total += fragments;
  if (estAnomalie(document.nature)) {
    mesure.anomalies.set(document.nature, (mesure.anomalies.get(document.nature) ?? 0) + 1);
  }
  if (mesure.borne_min === null || document.date < mesure.borne_min) mesure.borne_min = document.date;
  if (mesure.borne_max === null || document.date > mesure.borne_max) mesure.borne_max = document.date;
  if (!estSelectionne(champs, colonnes, motif, descripteur)) return;
  mesure.selection.add(document.numero);
  mesure.documents_selection += 1;
  mesure.fragments_selection += fragments;
}

/**
 * Mesure le corpus sans garder les textes : lignes lues, fragments par
 * document, sélection thématique, exclusions et anomalies. C'est ce passage qui
 * tranche le volume avant toute écriture.
 */
export function mesurer(
  lignes: Iterable<readonly string[]>,
  colonnes: Map<string, number>,
  descripteur: DescripteurCada,
): MesureCada {
  const mesure = creerMesure();
  const motif = motifSelection(descripteur);
  for (const champs of lignes) ajouterLigne(mesure, champs, colonnes, motif, descripteur);
  return mesure;
}

/**
 * Exclusions triées : motif puis nombre décroissant, comme les autres corpus.
 * La sélection thématique et le seuil de date appliqué sont comptés à part,
 * chaque ligne écartée ne l'étant qu'une fois.
 */
export function exclusionsDe(mesure: MesureCada, volume: VolumeCada): ExclusionCada[] {
  const exclusions: ExclusionCada[] = [...mesure.motifs.entries()].map(([motif, lignes]) => ({
    motif,
    lignes,
  }));
  const horsSelection = mesure.documents - mesure.documents_selection;
  if (horsSelection > 0) {
    exclusions.push({ motif: "hors sélection thématique", lignes: horsSelection });
  }
  if (volume.date_min !== null) {
    let anterieurs = 0;
    for (const numero of mesure.selection) {
      const date = mesure.dates.get(numero);
      if (date !== undefined && date < volume.date_min) anterieurs += 1;
    }
    if (anterieurs > 0) {
      exclusions.push({ motif: `antérieur au ${volume.date_min}`, lignes: anterieurs });
    }
  }
  return exclusions.sort(
    (gauche, droite) => droite.lignes - gauche.lignes || gauche.motif.localeCompare(droite.motif, "fr"),
  );
}

/** Fragments de la sélection dont la date atteint un seuil. */
function fragmentsDepuis(mesure: MesureCada, seuil: string): number {
  let retenus = 0;
  for (const numero of mesure.selection) {
    const date = mesure.dates.get(numero);
    if (date !== undefined && date >= seuil) retenus += mesure.fragments.get(numero) ?? 0;
  }
  return retenus;
}

/**
 * Tranche la règle de volume. Retenir la sélection thématique, toutes dates
 * confondues ; si elle dépasse le plafond, appliquer les seuils de date déclarés
 * dans l'ordre jusqu'à repasser sous le plafond. Si le dernier seuil ne suffit
 * pas, la règle s'arrête là, le dépassement est déclaré et rien n'est tronqué en
 * silence.
 */
export function deciderVolume(mesure: MesureCada, descripteur: DescripteurCada): VolumeCada {
  const plafond = descripteur.volume.fragments_max;
  const part = (fragments: number): number =>
    descripteur.volume.unites_index === 0 ? 0 : fragments / descripteur.volume.unites_index;
  const base = {
    fragments_total: mesure.fragments_total,
    fragments_selection: mesure.fragments_selection,
    plafond,
  };

  const selection =
    `${mesure.documents_selection} document(s), ${mesure.fragments_selection} fragment(s)`;
  if (mesure.fragments_selection <= plafond) {
    return {
      ...base,
      fragments_retenus: mesure.fragments_selection,
      part_index: part(mesure.fragments_selection),
      decision: "selection",
      date_min: null,
      regle: `sélection thématique (${selection}) ≤ ${plafond} : toutes dates retenues`,
      depassement: 0,
    };
  }

  let dernierSeuil: string | null = null;
  let dernierCompte = mesure.fragments_selection;
  for (const seuil of descripteur.selection.date_min) {
    dernierSeuil = seuil;
    dernierCompte = fragmentsDepuis(mesure, seuil);
    if (dernierCompte <= plafond) {
      return {
        ...base,
        fragments_retenus: dernierCompte,
        part_index: part(dernierCompte),
        decision: "selection_date",
        date_min: seuil,
        regle:
          `sélection thématique (${selection}) > ${plafond} : seuls les avis du ${seuil} ` +
          `et après sont retenus (${dernierCompte} fragments)`,
        depassement: 0,
      };
    }
  }

  return {
    ...base,
    fragments_retenus: dernierCompte,
    part_index: part(dernierCompte),
    decision: "selection_date",
    date_min: dernierSeuil,
    regle:
      `sélection thématique (${selection}) > ${plafond} ; ` +
      (dernierSeuil === null
        ? `aucun seuil de date n'est déclaré`
        : `avec le seuil du ${dernierSeuil} elle compte encore ${dernierCompte} fragments`) +
      ` : dépassement de ${dernierCompte - plafond} fragment(s) déclaré, rien n'est tronqué`,
    depassement: dernierCompte - plafond,
  };
}

/** Anomalies déclarées, avec le traitement appliqué (valeur source conservée). */
export function anomaliesDe(mesure: MesureCada): AnomalieCada[] {
  return [...mesure.anomalies.entries()]
    .sort(([gauche], [droite]) => gauche.localeCompare(droite, "fr"))
    .map(([nature, lignes]) => ({
      constat: `${lignes} ligne(s) de type « ${nature} » : la CADA est consultative, ce type est un écart de la source`,
      lignes,
      traitement:
        "valeur source conservée, aucune ligne renommée ; le document est retenu ou écarté par la même règle que les autres",
    }));
}
