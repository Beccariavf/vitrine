/**
 * Transforme un document de doctrine de la CNIL en fragments adressables.
 *
 * Le texte vient du PDF officiel ou de la page ; seule la conversion technique
 * de format est faite (espaces, césures, lignes). Un fragment n'est jamais
 * réécrit : il est une tranche du texte extrait, et le serveur ne produit ni
 * résumé ni reformulation. Une délibération déjà présente au corpus `cnil`
 * n'est pas dupliquée : son numéro est relevé dans la page ou le PDF, puis
 * vérifié contre le corpus (voir `sync.ts`).
 */

import { decouperParagraphes } from "../cnil/parse.ts";
import type { Unite } from "../parse.ts";
import { paragraphesDepuisTexte } from "../cepd/pdf.ts";
import type { DescripteurDoctrine, TypeDoctrine } from "./liste.ts";

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Libellé du chemin, par type de document. */
const LIBELLES: Record<TypeDoctrine, string> = {
  guide: "Guides",
  referentiel: "Référentiels",
  liste_aipd: "Listes AIPD",
};

/** Marques d'une licence contraire à la CC BY-ND, cherchées dans le texte. */
const MENTIONS_CONTRAIRES: ReadonlyArray<{ motif: RegExp; raison: string }> = [
  { motif: /tous\s+droits\s+r[ée]serv[ée]s/i, raison: "mention contraire : tous droits réservés" },
  {
    motif: /reproduction\s+(?:est\s+)?interdite/i,
    raison: "mention contraire : reproduction interdite",
  },
  { motif: /all\s+rights\s+reserved/i, raison: "mention contraire : all rights reserved" },
  {
    motif: /sous\s+r[ée]serve\s+de\s+droits\s+d['’]auteur/i,
    raison: "mention contraire : droits d'auteur réservés",
  },
];

/**
 * Mention contraire à la licence du site, ou `null`. L'heuristique ne retient
 * que les formules explicites : une citation du mot « copyright » ne suffit pas.
 */
export function mentionContraire(texte: string): string | null {
  for (const mention of MENTIONS_CONTRAIRES) {
    if (mention.motif.test(texte)) return mention.raison;
  }
  return null;
}

const MOIS: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  février: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  août: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
  décembre: "12",
};

const MOTIF_DATE_FR =
  /(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i;

/**
 * Date du document, quand son en-tête la déclare (« Adopté le 21 novembre
 * 2019 », « Version du … », « Publié le … »). Une date de visa ou de citation
 * n'est pas la date du document : sans formule qui la déclare, `null`.
 */
export function dateDuDocument(texte: string): string | null {
  const entete = texte.slice(0, 3000);
  const declaree =
    /(?:adopt[ée]e?|version|mise\s+à\s+jour|mis\s+à\s+jour|publi[ée]e?|édition|edition)\s*(?:du\s+|le\s+|:\s*)?(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[a-zéûôà]+\s+\d{4})/i.exec(
      entete,
    );
  if (declaree?.[1] === undefined) return null;
  const valeur = declaree[1].trim();
  const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(valeur);
  if (iso?.[1] !== undefined && !Number.isNaN(Date.parse(iso[1]))) return iso[1];
  const francais = MOTIF_DATE_FR.exec(valeur);
  if (francais?.[1] === undefined || francais[2] === undefined || francais[3] === undefined) {
    return null;
  }
  const mois = MOIS[francais[2].toLocaleLowerCase("fr")];
  const jour = Number(francais[1]);
  if (mois === undefined || !Number.isInteger(jour) || jour < 1 || jour > 31) return null;
  const date = `${francais[3]}-${mois}-${String(jour).padStart(2, "0")}`;
  return Number.isNaN(Date.parse(date)) ? null : date;
}

/**
 * Numéros de délibération cités par un texte, normalisés (`2018-326`,
 * `2019-011`), sans doublon et dans l'ordre de lecture.
 */
export function deliberations(texte: string): string[] {
  return deliberationsCitees(texte).map((citee) => citee.numero);
}

/** Une délibération citée par une page, avec l'intitulé qui la suit. */
export type DeliberationCitee = { numero: string; libelle: string };

/**
 * Délibérations citées par une page, avec l'intitulé qui les suit
 * (« portant adoption de … »). Le libellé sert à rapprocher la délibération du
 * document qu'elle annonce. La fenêtre de lecture s'arrête à la délibération
 * suivante : une page peut en citer plusieurs à la suite.
 */
export function deliberationsCitees(texte: string): DeliberationCitee[] {
  const trouves = new Map<string, DeliberationCitee>();
  const motif = /[Dd][ée]lib[ée]ration\s+(?:n[°o]\s*)?(\d{4})\s*[-–]\s*(\d{1,4})/g;
  for (let trouve = motif.exec(texte); trouve !== null; trouve = motif.exec(texte)) {
    const annee = trouve[1];
    const numero = trouve[2];
    if (annee === undefined || numero === undefined) continue;
    const normalise = `${annee}-${String(Number(numero)).padStart(3, "0")}`;
    if (trouves.has(normalise)) continue;
    const debut = trouve.index + trouve[0].length;
    const fenetre = texte.slice(debut, debut + 300);
    const suivante = fenetre.search(/[Dd][ée]lib[ée]ration/);
    const suite = suivante < 0 ? fenetre : fenetre.slice(0, suivante);
    const libelle = /((?:portant|relatif|relative)[\s\S]*?)(?:\.\s|\.$|$)/.exec(suite)?.[1] ?? "";
    trouves.set(normalise, {
      numero: normalise,
      libelle: libelle.replace(/\s+/g, " ").trim().slice(0, 300),
    });
  }
  return [...trouves.values()];
}

/** Mots vides écartés de la comparaison de deux intitulés. */
const MOTS_VIDES = new Set([
  "de",
  "des",
  "du",
  "la",
  "le",
  "les",
  "l",
  "d",
  "un",
  "une",
  "et",
  "aux",
  "au",
  "a",
  "à",
  "en",
  "dans",
  "pour",
  "par",
  "sur",
  "est",
  "relatif",
  "relative",
  "relatifs",
  "relatives",
  "portant",
  "adoption",
  "objet",
]);

/** Jetons significatifs d'un intitulé, pour comparer deux libellés. */
export function jetons(titre: string): Set<string> {
  const normalise = titre
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return new Set(
    normalise
      .split(/\s+/)
      .filter((jeton) => jeton !== "" && !MOTS_VIDES.has(jeton)),
  );
}

/** Nombre de jetons significatifs communs à deux intitulés. */
export function chevauchement(gauche: string, droite: string): number {
  const a = jetons(gauche);
  const b = jetons(droite);
  let communs = 0;
  for (const jeton of a) {
    if (b.has(jeton)) communs += 1;
  }
  return communs;
}

/** Une délibération du corpus `cnil` : son numéro et son identifiant de document. */
export type DeliberationCorpus = { numero: string; document: string };

/** Seuil de jetons communs pour tenir une délibération pour celle du document. */
export const SEUIL_CHEVAUCHEMENT = 3;

/**
 * Délibération du corpus `cnil` qui porte ce document, ou `null`.
 *
 * Une délibération n'est retenue que si son intitulé rejoint celui du document
 * (au moins `SEUIL_CHEVAUCHEMENT` jetons communs). Une page peut citer une
 * délibération et lier d'autres PDF : sans ce rapprochement, aucun document
 * n'est tenu pour couvert.
 */
export function deliberationDuDocument(
  titre: string,
  citees: readonly DeliberationCitee[],
  corpus: ReadonlyMap<string, string>,
): DeliberationCorpus | null {
  let meilleur: DeliberationCorpus | null = null;
  let meilleurScore = 0;
  for (const citee of citees) {
    const document = corpus.get(citee.numero);
    if (document === undefined) continue;
    const score = chevauchement(titre, citee.libelle);
    if (score <= meilleurScore) continue;
    meilleur = { numero: citee.numero, document };
    meilleurScore = score;
  }
  return meilleurScore >= SEUIL_CHEVAUCHEMENT ? meilleur : null;
}

/** Slug stable déduit du dernier segment de l'URL, sans extension. */
export function slugDe(url: string): string {
  let chemin: string;
  try {
    chemin = new URL(url).pathname;
  } catch {
    chemin = url;
  }
  const segment = chemin.split("/").filter(Boolean).at(-1) ?? "";
  const slug = decodeURIComponent(segment)
    .replace(/\.(pdf|html?)$/i, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (slug === "") throw new Error(`Slug introuvable pour « ${url} »`);
  return slug;
}

/** Document prêt à produire des unités. */
export type DocumentDoctrine = {
  type: TypeDoctrine;
  url: string;
  titre: string;
  slug: string;
  /** Date du document, ou date d'extraction quand il ne se date pas. */
  date_acte: string;
  /** D'où vient `date_acte` : le document lui-même ou la passe d'extraction. */
  date_source: "document" | "extraction";
  date_extraction: string;
  snapshot: string;
};

/**
 * Fragments d'un document : chaque fragment est une tranche du texte extrait,
 * sans réécriture. Le chemin nomme le type et le titre ; l'URL est celle du
 * document.
 */
export function unitesDoctrine(
  document: DocumentDoctrine,
  texte: string,
  descripteur: DescripteurDoctrine,
): Unite[] {
  const fragments = decouperParagraphes(paragraphesDepuisTexte(texte));
  if (fragments.length === 0) {
    throw new Error(`Aucun fragment pour ${document.url} : le texte extrait est vide`);
  }
  return fragments.map((fragment, index) => ({
    ref: `${document.slug}#f${index}`,
    document: document.slug,
    corpus: descripteur.corpus,
    niveau: "fragment",
    numero: document.slug,
    chemin: `${descripteur.nom} > ${LIBELLES[document.type]} > ${document.titre}`,
    texte: fragment,
    date_acte: document.date_acte,
    date_debut: document.date_acte,
    date_fin: null,
    statut: "Publié",
    url: document.url,
  }));
}

/** Valide le corpus complet avant écriture ; lève en nommant les défauts. */
export function validerUnites(unites: readonly Unite[], corpus: string): void {
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
    if (unite.document.trim() === "") erreurs.push(`document vide : ${unite.ref}`);
    if (unite.corpus !== corpus) erreurs.push(`corpus inattendu : ${unite.ref} (${unite.corpus})`);
    if (unite.numero.trim() === "") erreurs.push(`numéro vide : ${unite.ref}`);
    if (!DATE_ISO.test(unite.date_acte) || Number.isNaN(Date.parse(unite.date_acte))) {
      erreurs.push(`date non ISO : ${unite.ref} (${unite.date_acte || "vide"})`);
    }
  }
  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 10).join(" ; ");
    const reste = erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : "";
    throw new Error(`Corpus ${corpus} invalide, rien n'est écrit : ${liste}${reste}`);
  }
}
