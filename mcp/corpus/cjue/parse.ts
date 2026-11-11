/**
 * Découpe le rendu XHTML français d'une décision CJUE en unités indexables.
 *
 * Le texte de la Cour est structuré par points de motivation numérotés
 * (`point1`, `point2`…) : chaque point devient une unité citable. L'en-tête
 * (type d'arrêt, matière, parties) et le dispositif sont indexés à part. Une
 * décision sans point numéroté retombe sur un découpage de paragraphes : elle
 * n'est jamais perdue pour un défaut de structure.
 */

import { texteVisible } from "../parse.ts";
import type { Unite } from "../parse.ts";
import { decouperParagraphes } from "../cnil/parse.ts";
import type { DescripteurCjue } from "./liste.ts";

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const MOIS: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
};

/**
 * Date de la décision lue en tête du XHTML (« 13 mai 2014 »). Elle sert aux
 * décisions ajoutées par la veille, dont la date d'entrée n'est pas la date de
 * l'arrêt. `null` quand aucune date n'est reconnue.
 */
export function dateDecisionCjue(xhtml: string): string | null {
  const contenu = corps(xhtml);
  const enTete = [...contenu.matchAll(/<p[^>]*class="(?:coj-)?sum-title-1"[^>]*>([\s\S]*?)<\/p>/gi)]
    .slice(0, 2)
    .map((trouve) => texteVisible(trouve[1] ?? ""))
    .join(" ");
  return chercherDate(enTete) ?? chercherDate(texteVisible(contenu).slice(0, 4000));
}

/** Première date française d'un texte ; « 1 er octobre 2015 » est reconnu. */
function chercherDate(texte: string): string | null {
  const normalise = texte
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  const trouve =
    /(\d{1,2})\s*(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/.exec(
      normalise,
    );
  if (trouve === null) return null;
  const [, jour, mois, annee] = trouve;
  const numeroMois = MOIS[mois ?? ""];
  if (numeroMois === undefined || jour === undefined || annee === undefined) return null;
  const date = `${annee}-${numeroMois}-${jour.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(date)) ? null : date;
}

/** Un point de motivation ou l'en-tête, avant mise en unité. */
export type BlocCjue = {
  /** `entete`, `point` ou `dispositif`. */
  genre: "entete" | "point" | "dispositif";
  /** Numéro du point ; vide pour l'en-tête et le dispositif. */
  numero: string;
  texte: string;
};

/** Corps du document, sans l'en-tête XHTML ni les scripts. */
function corps(xhtml: string): string {
  const debut = xhtml.indexOf("<body");
  const fin = xhtml.lastIndexOf("</body>");
  const contenu = debut >= 0 && fin > debut ? xhtml.slice(debut, fin) : xhtml;
  return contenu.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
}

/**
 * Texte du premier paragraphe d'une classe donnée, `null` s'il est absent.
 * Les rendus récents préfixent les classes par `coj-` (`coj-index`,
 * `coj-sum-title-1`) : le préfixe est facultatif.
 */
export function paragrapheClasse(xhtml: string, classe: string): string | null {
  const motif = new RegExp(
    `<p[^>]*class="(?:coj-)?${classe}"[^>]*>([\\s\\S]*?)</p>`,
    "i",
  );
  const trouve = motif.exec(xhtml);
  if (trouve === null) return null;
  const texte = texteVisible(trouve[1] ?? "");
  return texte === "" ? null : texte;
}

/** Numéro d'affaire (`C-131/12`, `T-…`) lu dans l'introduction. */
export function numeroAffaire(texte: string, celex: string): string {
  const trouve = /(?:dans\s+l['’]affaire|affaire)\s+((?:C|T)[‑–—-]\s?\d+\s*\/\s*\d+(?:\s+et\s+(?:C|T)[‑–—-]\s?\d+\s*\/\s*\d+)*)/i.exec(
    texte,
  );
  if (trouve?.[1] !== undefined) {
    return trouve[1].replace(/[‑–—]/g, "-").replace(/\s+/g, " ").trim();
  }
  // Repli : le CELEX porte l'année et le numéro, la lettre vient de la juridiction.
  const detail = /^6(\d{4})(CJ|TJ|CO|TO)(\d{4})/.exec(celex);
  if (detail === null) return celex;
  const [, annee, type, numero] = detail;
  const lettre = type === "TJ" || type === "TO" ? "T" : "C";
  return `${lettre}-${Number(numero)}/${String(Number(annee) - 2000)}`;
}

/** Type lisible d'une décision, déduit du suffixe CELEX. */
export function libelleType(celex: string, descripteur: DescripteurCjue): string {
  const suffixe = /^6\d{4}([A-Z]{2})/.exec(celex)?.[1] ?? "";
  return descripteur.types_retenus[suffixe] ?? "Décision";
}

/**
 * Blocs d'une décision : en-tête (titre, matière, introduction), points
 * numérotés et dispositif. Le découpage suit les ancres `pointN` du XHTML.
 */
export function blocsCjue(xhtml: string, celex: string): BlocCjue[] {
  const contenu = corps(xhtml);
  const titre = paragrapheClasse(contenu, "sum-title-1");
  const matiere = paragrapheClasse(contenu, "index");

  const marqueurs = [
    ...contenu.matchAll(/<p[^>]*class="(?:coj-)?count"[^>]*id="point(\d+)"[^>]*>/gi),
  ];
  const debutPremier = marqueurs[0]?.index ?? contenu.length;
  const introduction = texteVisible(contenu.slice(0, debutPremier))
    .replace(titre ?? "", " ")
    .replace(matiere ?? "", " ")
    .replace(/\s+/g, " ")
    .trim();

  const entete = [titre, matiere, introduction].filter((element) => element !== null && element !== "").join("\n");
  const blocs: BlocCjue[] = [];
  if (entete !== "") blocs.push({ genre: "entete", numero: "", texte: entete });

  let dispositif: string | null = null;
  for (let index = 0; index < marqueurs.length; index += 1) {
    const marqueur = marqueurs[index];
    if (marqueur?.index === undefined) continue;
    const numero = marqueur[1] ?? "";
    const suivant = marqueurs[index + 1]?.index ?? contenu.length;
    let morceau = contenu.slice(marqueur.index, suivant);

    if (index === marqueurs.length - 1) {
      const coupe = /\bpar ces motifs\b/i.exec(morceau);
      if (coupe !== null) {
        dispositif = texteVisible(morceau.slice(coupe.index)).trim();
        morceau = morceau.slice(0, coupe.index);
      }
    }

    const texte = texteVisible(morceau).replace(/^\d+\s*/, "").trim();
    if (texte !== "") blocs.push({ genre: "point", numero, texte });
  }

  if (dispositif === null) {
    const coupe = /\bpar ces motifs\b/i.exec(contenu);
    if (coupe !== null) dispositif = texteVisible(contenu.slice(coupe.index)).trim();
  }
  if (dispositif !== null && dispositif !== "") {
    blocs.push({ genre: "dispositif", numero: "", texte: dispositif });
  }

  if (blocs.length === 0) {
    const entier = texteVisible(contenu).trim();
    if (entier !== "") blocs.push({ genre: "entete", numero: "", texte: entier });
  }
  return blocs;
}

/**
 * Unités d'une décision. Les points gardent leur numéro officiel ; l'en-tête
 * et le dispositif sont découpés en fragments si leur texte est long.
 */
export function unitesCjue(
  xhtml: string,
  celex: string,
  date: string,
  descripteur: DescripteurCjue,
): Unite[] {
  if (!DATE_ISO.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`CJUE ${celex} : date attendue AAAA-MM-JJ ; reçu « ${date} »`);
  }
  const type = libelleType(celex, descripteur);
  const affaire = numeroAffaire(texteVisible(corps(xhtml)), celex);
  const chemin = `${descripteur.nom} > ${type} ${affaire}`;
  const url = descripteur.url_texte.replace("{celex}", celex);
  const base = {
    document: celex,
    corpus: descripteur.corpus,
    niveau: "fragment" as const,
    date_acte: date,
    date_debut: date,
    date_fin: null,
    statut: type,
    url,
  };

  const unites: Unite[] = [];
  for (const bloc of blocsCjue(xhtml, celex)) {
    if (bloc.genre === "point") {
      if (unites.some((unite) => unite.ref === `${celex}#point${bloc.numero}`)) continue;
      unites.push({
        ...base,
        ref: `${celex}#point${bloc.numero}`,
        numero: bloc.numero,
        chemin: `${chemin} > Motifs`,
        texte: bloc.texte,
      });
      continue;
    }
    const fragments = decouperParagraphes(bloc.texte.split(/\n+/));
    fragments.forEach((texte, index) => {
      const prefixe = bloc.genre === "entete" ? "h" : "dispositif";
      const suffixe = fragments.length === 1 ? "" : String(index);
      unites.push({
        ...base,
        ref: `${celex}#${prefixe}${suffixe}`,
        numero: bloc.genre === "entete" ? "entête" : "dispositif",
        chemin: `${chemin} > ${bloc.genre === "entete" ? "En-tête" : "Dispositif"}`,
        texte,
      });
    });
  }
  return unites;
}
