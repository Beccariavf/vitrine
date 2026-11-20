/**
 * Collage de l'accueil : une sélection de publications réelles par source,
 * réparties en quatre colonnes fixes. La sélection est pure ; seules les
 * lectures de corpus touchent au disque, et un fichier absent rend `null`
 * plutôt que de faire échouer le build.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Entry } from "../../veille/types.ts";
import type { FamilleId } from "./familles.ts";
import { referenceLabel } from "./references.ts";

export type CarteArticle = { document: string; numero: string; titre: string; extrait: string };

/** Article de code lu dans Légifrance : le code, sa section, l'article et sa version. */
export type CarteCode = { code: string; section: string; numero: string; depuis: string | null; extrait: string };

export type EtapePreparation = { libelle: string; fait: boolean };

export type CartePreparation = { procedure: string; titre: string; etapes: EtapePreparation[] };

export type CarteCollage =
  | { genre: "matieres"; source: "Matières suivies"; famille: "textes"; matieres: string[] }
  | {
      genre: "photo";
      source: "Conseil d'État";
      famille: "juridictions";
      date: string | null;
      titre: string;
      numero: string | null;
    }
  | {
      genre: "sanction";
      source: "CNIL";
      famille: "autorites";
      date: string | null;
      titre: string;
      references: string[];
    }
  | {
      genre: "texte";
      source: string;
      famille: FamilleId;
      date: string | null;
      montant: string | null;
      titre: string;
      extrait: string | null;
      references: string[];
    }
  | { genre: "pilule"; source: string; famille: FamilleId; texte: string }
  | {
      genre: "article";
      source: "EUR-Lex";
      famille: "textes";
      document: string;
      numero: string;
      titre: string;
      extrait: string;
    }
  | {
      genre: "code";
      source: "Légifrance";
      famille: "textes";
      code: string;
      section: string;
      numero: string;
      depuis: string | null;
      extrait: string;
    }
  | {
      genre: "preparation";
      source: "Textes en préparation";
      famille: "ue";
      procedure: string;
      titre: string;
      etapes: EtapePreparation[];
    };

/** Contenus que la veille ne porte pas : lus dans le corpus au build. */
export type Complements = {
  article: CarteArticle | null;
  preparation: CartePreparation | null;
  matieres: string[];
  /** Article de code Légifrance ; absent, la carte est omise. */
  code?: CarteCode | null;
};

/**
 * Compare deux entrées comme la veille : date décroissante, les entrées sans
 * date en dernier, puis titre. Une chaîne ISO 8601 UTC se compare sans conversion.
 */
function compare(a: Entry, b: Entry): number {
  if (a.publishedAt !== b.publishedAt) {
    if (a.publishedAt === null) return 1;
    if (b.publishedAt === null) return -1;
    return a.publishedAt < b.publishedAt ? 1 : -1;
  }
  return a.title.localeCompare(b.title, "fr");
}

/** Titre ramené sur une ligne et coupé sur un mot, sans dépasser `maximum` caractères. */
function tronque(texte: string, maximum = 60): string {
  const propre = texte.trim().replace(/\s+/g, " ");
  if (propre.length <= maximum) return propre;
  const coupe = propre.slice(0, maximum);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > 0 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

/** Montant en euros d'un titre, rendu tel que le site l'affiche ; `null` sans montant. */
export function montantEnEuros(titre: string): string | null {
  const texte = titre.replace(/\u2019/g, "'");

  const millions = /(\d[\d\s\u00a0\u202f.,]*)\s*(millions?|milliards?)\s+d'euros/i.exec(texte);
  if (millions !== null) return avecEchelle(millions[1], millions[2]);

  const eurosEchelle = /EUR\s*(\d[\d\s\u00a0\u202f.,]*)\s*(millions?|milliards?)/i.exec(texte);
  if (eurosEchelle !== null) return avecEchelle(eurosEchelle[1], eurosEchelle[2]);

  const euros = /EUR\s*(\d[\d\s\u00a0\u202f.,]*)/i.exec(texte);
  if (euros !== null) {
    const valeur = nombreDe(euros[1] ?? "");
    return valeur === null ? null : eurosSimples(valeur);
  }

  return null;
}

/** Montant sans échelle dans le titre : million et milliard ronds se lisent en `M€`/`Md€`. */
function eurosSimples(valeur: number): string {
  if (valeur >= 1e9 && valeur % 1e9 === 0) return `${nombreFr(valeur / 1e9)}\u00a0Md€`;
  if (valeur >= 1e6 && valeur % 1e6 === 0) return `${nombreFr(valeur / 1e6)}\u00a0M€`;
  return `${nombreFr(valeur)}\u00a0€`;
}

/** Nombre d'un groupe de chiffres : espaces de milliers, virgule décimale française. */
function nombreDe(texte: string): number | null {
  const propre = texte.replace(/[\s\u00a0\u202f]/g, "").replace(/[.,]+$/, "");
  if (propre === "") return null;
  const valeur = propre.includes(",") ? Number(propre.replace(/\./g, "").replace(",", ".")) : Number(propre.replace(/\./g, ""));
  return Number.isFinite(valeur) ? valeur : null;
}

/** Format français, espaces insécables comprises : `39 000`, `5,5`. */
function nombreFr(valeur: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })
    .format(valeur)
    .replace(/[\u202f\u00a0]/g, "\u00a0");
}

/** Un montant à l'échelle du titre : millions en `M€`, milliards en `Md€`. */
function avecEchelle(nombre: string | undefined, unite: string | undefined): string | null {
  const valeur = nombreDe(nombre ?? "");
  if (valeur === null) return null;
  const suffixe = (unite ?? "").toLowerCase().startsWith("milliard") ? "Md€" : "M€";
  return `${nombreFr(valeur)}\u00a0${suffixe}`;
}

/** Carte CNIL : la sanction la plus récente, jamais la dernière publication CNIL. */
function carteSanction(entry: Entry): CarteCollage {
  return {
    genre: "sanction",
    source: "CNIL",
    famille: "autorites",
    date: entry.publishedAt,
    titre: entry.title,
    references: entry.references.map(referenceLabel),
  };
}

/** Carte Conseil d'État : la formation et le numéro quand le titre les porte. */
function carteConseilEtat(entry: Entry): CarteCollage {
  const reconnu = /^Conseil d['\u2019]État,\s*([^,]+?),\s*\d{1,2}\/\d{1,2}\/\d{4},\s*([^,\s]+)/.exec(entry.title);
  const formation = reconnu?.[1]?.trim();
  return {
    genre: "photo",
    source: "Conseil d'État",
    famille: "juridictions",
    date: entry.publishedAt,
    titre: formation !== undefined && formation !== "" ? formation : tronque(entry.title),
    numero: reconnu?.[2] ?? null,
  };
}

/** Carte CJUE : le titre avant le cadratin, l'arrêt après, le numéro d'affaire retiré. */
function carteCjue(entry: Entry): CarteCollage {
  const separateur = entry.title.indexOf(" — ");
  const avant = separateur === -1 ? entry.title : entry.title.slice(0, separateur);
  const apres = separateur === -1 ? "" : entry.title.slice(separateur + 3).trim();
  return {
    genre: "texte",
    source: "CJUE",
    famille: "ue",
    date: entry.publishedAt,
    montant: montantEnEuros(entry.title),
    titre: avant.replace(/\s*\([A-Z]-\d+\/\d+\)\s*$/, "").trim(),
    extrait: apres === "" ? null : apres,
    references: entry.references.map(referenceLabel),
  };
}

/** Carte Cour de cassation : la chambre et le pourvoi quand le titre les porte. */
function carteCassation(entry: Entry): CarteCollage {
  const reconnu = /^Cour de cassation,\s*([^,]+?),\s*\d{1,2}(?:er)?\s+\S+\s+\d{4},\s*(\S+)\s*$/.exec(entry.title);
  const chambre = reconnu?.[1];
  const numero = reconnu?.[2];
  const deduit = chambre !== undefined && numero !== undefined;
  return {
    genre: "texte",
    source: "Cour de cassation",
    famille: "juridictions",
    date: entry.publishedAt,
    montant: montantEnEuros(entry.title),
    titre: deduit ? `${chambre.charAt(0).toUpperCase()}${chambre.slice(1)}` : tronque(entry.title),
    extrait: null,
    references: deduit ? [`Pourvoi n° ${numero}`] : entry.references.map(referenceLabel),
  };
}

/** Carte d'une source d'actualité : le titre de l'entrée, son résumé, ses références. */
function carteTexte(entry: Entry, source: string, famille: FamilleId): CarteCollage {
  return {
    genre: "texte",
    source,
    famille,
    date: entry.publishedAt,
    montant: montantEnEuros(entry.title),
    titre: entry.title,
    extrait: entry.summary,
    references: entry.references.map(referenceLabel),
  };
}

/** Carte ANSSI : la pilule du bulletin, réduite à son identifiant CERT-FR. */
function carteAnssi(entry: Entry): CarteCollage {
  const identifiant = /CERTFR-\d{4}-[A-Z]+-\d+/.exec(entry.title);
  return {
    genre: "pilule",
    source: "ANSSI",
    famille: "autorites",
    texte: identifiant === null ? `ANSSI · ${tronque(entry.title)}` : `ANSSI · ${identifiant[0]}`,
  };
}

/**
 * Les cinq colonnes du collage, dans leur ordre d'affichage : assez pour couvrir
 * toute la largeur de l'écran. Une source sans
 * entrée est omise sans laisser de trou ; la répartition des colonnes ne bouge pas.
 */
export function cartesCollage(entrees: Entry[], complements?: Complements): CarteCollage[][] {
  const triees = [...entrees].sort(compare);
  const derniere = (source: string): Entry | undefined => triees.find((entry) => entry.source === source);
  const matieres = (complements?.matieres ?? []).filter((matiere) => matiere.trim() !== "");

  const sanction = triees.find((entry) => entry.source === "cnil" && entry.title.toLowerCase().includes("sanction"));
  const cepd = derniere("cepd");
  const cjue = derniere("cjeu");
  const cetat = derniere("cetat");
  const anssi = derniere("anssi");
  const commission = derniere("commission");
  const cassation = derniere("judilibre");

  const colonne1: CarteCollage[] = [];
  if (matieres.length > 0) {
    colonne1.push({ genre: "matieres", source: "Matières suivies", famille: "textes", matieres });
  }
  if (sanction !== undefined) colonne1.push(carteSanction(sanction));

  const colonne2: CarteCollage[] = [];
  if (cepd !== undefined) colonne2.push(carteTexte(cepd, "CEPD", "ue"));
  if (complements?.article != null) {
    colonne2.push({ genre: "article", source: "EUR-Lex", famille: "textes", ...complements.article });
  }

  const colonne3: CarteCollage[] = [];
  if (cetat !== undefined) colonne3.push(carteConseilEtat(cetat));
  if (cjue !== undefined) colonne3.push(carteCjue(cjue));

  const colonne4: CarteCollage[] = [];
  if (complements?.preparation != null) {
    colonne4.push({ genre: "preparation", source: "Textes en préparation", famille: "ue", ...complements.preparation });
  }
  if (commission !== undefined) colonne4.push(carteTexte(commission, "Commission européenne", "ue"));

  const colonne5: CarteCollage[] = [];
  if (anssi !== undefined) colonne5.push(carteAnssi(anssi));
  if (cassation !== undefined) colonne5.push(carteCassation(cassation));
  if (complements?.code != null) {
    colonne5.push({ genre: "code", source: "Légifrance", famille: "textes", ...complements.code });
  }

  return [colonne1, colonne2, colonne3, colonne4, colonne5];
}

/** Lignes d'un fichier JSONL ; un fichier absent rend une liste vide. */
function lignesDe(chemin: string): string[] {
  try {
    return readFileSync(chemin, "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
}

/** Objet d'une ligne JSONL ; une ligne vide ou illisible est ignorée. */
function objetDe(ligne: string): Record<string, unknown> | null {
  if (ligne.trim() === "") return null;
  let valeur: unknown;
  try {
    valeur = JSON.parse(ligne);
  } catch {
    return null;
  }
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : null;
}

/** Chaîne non vide d'une unité, ou `null`. */
function chaine(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur.trim() !== "" ? valeur.trim() : null;
}

/**
 * Article 32 du RGPD, lu au premier objet du corpus. Un fichier absent ou une
 * unité inexploitable rend `null` : la carte est omise, le build continue.
 */
export function lireArticleRgpd32(rootDir: string = process.cwd()): CarteArticle | null {
  for (const ligne of lignesDe(join(rootDir, "data", "corpus", "rgpd", "unites.jsonl"))) {
    const unite = objetDe(ligne);
    if (unite === null || unite["niveau"] !== "article" || unite["numero"] !== "32") continue;
    const texte = chaine(unite["texte"]);
    if (texte === null) return null;

    const parties = /^Article\s+32\s+(.+?)\s+(\d+\..*)$/s.exec(texte);
    const titre = parties?.[1]?.trim();
    const corps = parties?.[2];
    if (titre === undefined || titre === "" || corps === undefined) return null;

    return {
      document: chaine(unite["document"]) ?? "32016R0679",
      numero: "32",
      titre,
      extrait: tronque(corps, 180),
    };
  }
  return null;
}

/** Le CPCE, seul code du corpus `textes_fr` (article L34-5 seulement). */
const CPCE = "LEGITEXT000006070987";

/**
 * Article L34-5 du CPCE (prospection directe), lu dans le corpus `textes_fr`.
 * La section est le dernier segment du chemin ; la date de version n'est rendue
 * que pour une version en vigueur sans date de fin. Un fichier absent ou une
 * unité inexploitable rend `null` : la carte est omise, le build continue.
 */
export function lireArticleCpceL345(rootDir: string = process.cwd()): CarteCode | null {
  for (const ligne of lignesDe(join(rootDir, "data", "corpus", "textes_fr", "unites.jsonl"))) {
    const unite = objetDe(ligne);
    if (unite === null || unite["niveau"] !== "article" || unite["numero"] !== "L34-5") continue;
    if (unite["document"] !== CPCE) continue;
    const texte = chaine(unite["texte"]);
    const section = chaine(unite["chemin"])?.split(" > ").at(-1)?.trim();
    if (texte === null || section === undefined || section === "") return null;

    const enVigueur = unite["statut"] === "VIGUEUR" && unite["date_fin"] == null;
    return {
      code: "Code des postes et des communications électroniques",
      section: section.replace(/\.$/, ""),
      numero: "L34-5",
      depuis: enVigueur ? chaine(unite["date_debut"]) : null,
      extrait: tronque(texte, 170),
    };
  }
  return null;
}

/**
 * Objet d'une proposition sans sa formule d'introduction en capitales
 * (« Proposal for a REGULATION OF THE EUROPEAN PARLIAMENT AND OF THE COUNCIL on … ») :
 * la carte n'a la place que pour l'objet. Un titre sans cette formule reste tel quel.
 */
export function titreCourtProposition(titre: string): string {
  const objet = titre.replace(
    /^Proposal for an? [A-Z][A-Z ,]*?\s(?:on\s)?(?=[a-z])/,
    "",
  );
  return objet === titre ? titre : `${objet.charAt(0).toUpperCase()}${objet.slice(1)}`;
}

/**
 * Première proposition du corpus « Textes en préparation », son titre réel et
 * les trois étapes du parcours. Aucune traduction, aucune inférence au-delà du
 * statut d'amendement déjà inscrit dans `derniere_etape`.
 */
export function lirePreparationProposee(rootDir: string = process.cwd()): CartePreparation | null {
  for (const ligne of lignesDe(join(rootDir, "data", "corpus", "preparation", "unites.jsonl"))) {
    const unite = objetDe(ligne);
    if (unite === null || unite["statut"] !== "PROPOSE") continue;

    const procedure = chaine(unite["numero"]);
    const titre = chaine(unite["titre"]);
    if (procedure === null || titre === null) continue;

    const derniereEtape = unite["derniere_etape"];
    const amendements = typeof derniereEtape === "string" && derniereEtape.includes("AMEND");

    return {
      procedure,
      titre: titreCourtProposition(titre),
      etapes: [
        { libelle: "Proposition", fait: true },
        { libelle: "Amendements PE", fait: amendements },
        { libelle: "Adoption", fait: false },
      ],
    };
  }
  return null;
}
