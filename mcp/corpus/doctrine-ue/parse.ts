/**
 * Transforme un document de doctrine de la Commission en fragments adressables.
 *
 * Le texte vient du PDF officiel, du rendu XHTML du Journal officiel ou de la
 * page HTML ; seule la conversion technique de format est faite (balises,
 * entités, espaces, césures). Un fragment est une tranche du texte extrait,
 * jamais une réécriture : le serveur ne produit ni résumé ni reformulation.
 * Les éléments de navigation, les formulaires et le mobilier de page sont
 * retirés avant découpage ; aucun paragraphe de fond n'est supprimé.
 */

import { decouperParagraphes } from "../cnil/parse.ts";
import type { Unite } from "../parse.ts";
import { decoderEntites } from "../parse.ts";
import { paragraphesDepuisTexte } from "../cepd/pdf.ts";
import type { DocumentDoctrineUe, TypeDoctrineUe } from "./liste.ts";
import { LIBELLES_TYPE } from "./liste.ts";

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type OptionsTexteHtml = {
  /** Rend un acte du Journal officiel : son en-tête `oj-hd-*` n'est pas du texte. */
  cellar?: boolean;
};

/** Bloc de la page qui porte le document : `<article>`, sinon `<main>`, sinon la page. */
function zoneDocument(html: string): string {
  const main = /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] ?? html;
  return /<article\b[\s\S]*?<\/article>/i.exec(main)?.[0] ?? main;
}

/** Retire un élément et son contenu, pour les balises qui encadrent du mobilier. */
function sansElement(html: string, balise: string): string {
  return html.replace(new RegExp(`<${balise}\\b[\\s\\S]*?</${balise}\\s*>`, "gi"), " ");
}

/** Retire les paragraphes d'en-tête du Journal officiel (`oj-hd-*`). */
function sansEnteteJournalOfficiel(html: string): string {
  return html.replace(
    /<p\b[^>]*class=["'][^"']*\boj-hd-[^"']*["'][^>]*>[\s\S]*?<\/p\s*>/gi,
    " ",
  );
}

/**
 * Texte lisible d'une page : le corps de l'article, ses intertitres et ses
 * paragraphes, sans navigation, sans formulaire, sans image ni légende. La
 * conversion est technique ; le texte lui-même n'est jamais réécrit.
 */
export function texteDepuisHtml(html: string, options: OptionsTexteHtml = {}): string {
  let zone = zoneDocument(html);
  if (options.cellar === true) zone = sansEnteteJournalOfficiel(zone);
  for (const balise of ["script", "style", "nav", "form", "button", "select", "figure"]) {
    zone = sansElement(zone, balise);
  }
  const sansImages = zone.replace(/<img\b[^>]*>/gi, " ");
  const avecSauts = sansImages
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(?:p|div|h[1-6]|li|ul|ol|td|th|tr|section|blockquote|dd|dt|table|figcaption)>/gi,
      "\n\n",
    )
    .replace(/<[^>]*>/g, " ");
  return decoderEntites(avecSauts)
    .split("\n")
    .map((ligne) => ligne.replace(/\s+/g, " ").trim())
    .filter((ligne) => ligne !== "")
    .join("\n\n");
}

/**
 * Vérifie que le texte récupéré porte bien la version déclarée au descripteur.
 * Une source qui sert une autre version arrête la passe en nommant le document,
 * plutôt que d'ingérer un texte non identifié.
 */
export function verifierVersion(document: DocumentDoctrineUe, texte: string): void {
  if (document.verifier === undefined) return;
  const normalise = texte.replace(/\s+/g, " ");
  if (!normalise.includes(document.verifier)) {
    throw new Error(
      `${document.cle} : la version « ${document.verifier} » est absente du texte récupéré ` +
        "(la source a-t-elle changé ?)",
    );
  }
}

/** Statut porté par l'unité : un projet remplacé est marqué comme tel. */
export function statutUnite(document: DocumentDoctrineUe): string {
  return document.remplace_par === undefined
    ? document.statut
    : `Projet remplacé par ${document.remplace_par}`;
}

/**
 * Fragments d'un document : chaque fragment est une tranche du texte extrait,
 * sans réécriture. Un fragment sans aucune lettre (ponctuation seule, numéro de
 * page) est écarté : il ne porte aucun texte citable. Le chemin nomme le type et
 * le titre ; l'URL est celle de la page officielle du document.
 */
export function unitesDoctrineUe(
  document: DocumentDoctrineUe,
  texte: string,
  nomCorpus: string,
  nomCollection: string,
): Unite[] {
  const fragments = decouperParagraphes(paragraphesDepuisTexte(texte)).filter((fragment) =>
    /\p{L}/u.test(fragment),
  );
  if (fragments.length === 0) {
    throw new Error(`Aucun fragment pour ${document.cle} : le texte extrait est vide`);
  }
  const statut = statutUnite(document);
  return fragments.map((fragment, index) => ({
    ref: `${document.cle}#f${index}`,
    document: document.cle,
    corpus: nomCorpus,
    niveau: "fragment",
    numero: document.cle,
    chemin: `${nomCollection} > ${LIBELLES_TYPE[document.type]} > ${document.titre}`,
    texte: fragment,
    date_acte: document.date_acte,
    date_debut: document.date_acte,
    date_fin: null,
    statut,
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
    if (unite.statut.trim() === "") erreurs.push(`statut vide : ${unite.ref}`);
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

/** Libellé d'un type, pour les tests et les comptes du manifeste. */
export function libelleType(type: TypeDoctrineUe): string {
  return LIBELLES_TYPE[type];
}
