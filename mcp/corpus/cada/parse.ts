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
  /** Seuil de la règle de volume : les avis antérieurs ne sont pas retenus. */
  date_min: string;
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

/** Décision de volume : tout retenir, sous-ensemble indexable, ou sous-ensemble trop gros. */
export type DecisionVolume = "tout" | "sous_ensemble" | "sous_ensemble_non_indexe";

/** Ce que la règle de volume a mesuré. */
export type VolumeCada = {
  fragments_total: number;
  fragments_retenus: number;
  plafond: number;
  /** Part des unités déjà indexées que le sous-ensemble représenterait. */
  part_index: number;
  decision: DecisionVolume;
  indexable: boolean;
  motif: string;
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

/** Découpe un texte en fragments de 600 à 1 200 caractères, sans perte. */
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
    ...(document.motivation === "" ? {} : { motivation: document.motivation }),
    ...(document.theme === "" ? {} : { theme: document.theme }),
    ...(document.motsCles.length === 0 ? {} : { mots_cles: document.motsCles }),
  }));
}

/** Résultat du premier passage : comptes et volumétrie, sans unités gardées. */
export type MesureCada = {
  lignes_lues: number;
  /** Fragments par numéro de dossier, pour toutes les lignes valides. */
  fragments: Map<string, number>;
  /** Dates des lignes valides, par numéro de dossier. */
  dates: Map<string, string>;
  documents: number;
  fragments_total: number;
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
    documents: 0,
    fragments_total: 0,
    motifs: new Map(),
    anomalies: new Map(),
    borne_min: null,
    borne_max: null,
  };
}

/** Ajoute une ligne à la mesure ; une ligne invalide est comptée par son motif. */
export function ajouterLigne(
  mesure: MesureCada,
  champs: readonly string[],
  colonnes: Map<string, number>,
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
}

/**
 * Mesure le corpus sans garder les textes : lignes lues, fragments par
 * document, exclusions et anomalies. C'est ce passage qui tranche le volume
 * avant toute écriture.
 */
export function mesurer(
  lignes: Iterable<readonly string[]>,
  colonnes: Map<string, number>,
): MesureCada {
  const mesure = creerMesure();
  for (const champs of lignes) ajouterLigne(mesure, champs, colonnes);
  return mesure;
}

/** Exclusions triées : motif puis nombre décroissant, comme les autres corpus. */
export function exclusionsDe(mesure: MesureCada, dateMin: string): ExclusionCada[] {
  const exclusions: ExclusionCada[] = [...mesure.motifs.entries()].map(([motif, lignes]) => ({
    motif,
    lignes,
  }));
  if (dateMin !== "" && (mesure.fragments_total > 0 || mesure.documents > 0)) {
    let anterieurs = 0;
    for (const [numero, date] of mesure.dates) {
      if (date < dateMin) anterieurs += 1;
    }
    if (anterieurs > 0) exclusions.push({ motif: `antérieur au ${dateMin}`, lignes: anterieurs });
  }
  return exclusions.sort(
    (gauche, droite) => droite.lignes - gauche.lignes || gauche.motif.localeCompare(droite.motif, "fr"),
  );
}

/**
 * Tranche la règle de volume. Tout retenir quand le corpus tient sous le
 * plafond ; sinon retenir les documents au seuil `date_min` ; si le
 * sous-ensemble dépasse encore le plafond, il est conservé mais reste hors
 * index (le nombre est dit, rien n'est tronqué en silence).
 */
export function deciderVolume(mesure: MesureCada, descripteur: DescripteurCada): VolumeCada {
  const plafond = descripteur.volume.fragments_max;
  const part = (fragments: number): number =>
    descripteur.volume.unites_index === 0
      ? 0
      : fragments / descripteur.volume.unites_index;

  if (mesure.fragments_total <= plafond) {
    return {
      fragments_total: mesure.fragments_total,
      fragments_retenus: mesure.fragments_total,
      plafond,
      part_index: part(mesure.fragments_total),
      decision: "tout",
      indexable: true,
      motif: `${mesure.fragments_total} fragments ≤ ${plafond} : tout le corpus est retenu`,
    };
  }

  let retenus = 0;
  for (const [numero, fragments] of mesure.fragments) {
    const date = mesure.dates.get(numero);
    if (date !== undefined && date >= descripteur.date_min) retenus += fragments;
  }

  if (retenus <= plafond) {
    return {
      fragments_total: mesure.fragments_total,
      fragments_retenus: retenus,
      plafond,
      part_index: part(retenus),
      decision: "sous_ensemble",
      indexable: true,
      motif:
        `${mesure.fragments_total} fragments > ${plafond} : seuls les avis du ${descripteur.date_min} ` +
        `et après sont retenus (${retenus} fragments)`,
    };
  }

  return {
    fragments_total: mesure.fragments_total,
    fragments_retenus: retenus,
    plafond,
    part_index: part(retenus),
    decision: "sous_ensemble_non_indexe",
    indexable: false,
    motif:
      `${mesure.fragments_total} fragments > ${plafond} ; le sous-ensemble du ${descripteur.date_min} ` +
      `et après en compte encore ${retenus} > ${plafond} : il est conservé, l'index n'est pas construit`,
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
