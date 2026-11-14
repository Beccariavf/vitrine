/**
 * Transforme une ligne directrice listée en fragments adressables.
 *
 * Le numéro (`Guidelines 05/2022`) et la date viennent du titre ou de la liste ;
 * le slug vient de l'URL. Une version finale remplace les projets et versions
 * antérieures portant le même numéro. Le texte est copié, jamais reformulé.
 */

import { decouperParagraphes } from "../cnil/parse.ts";
import { texteVisible } from "../parse.ts";
import type { Unite } from "../parse.ts";
import { LIBELLES_TYPE, dateDansTexte } from "./liste.ts";
import type { DescripteurCePd, DocumentListe, TypeDocument } from "./liste.ts";
import { paragraphesDepuisTexte, trouverPdfDocument } from "./pdf.ts";

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Une ligne directrice prête à produire des unités. */
export type DocumentPrepare = DocumentListe & {
  slug: string;
  numero: string;
  date: string;
  statut: "finale" | "projet";
  version: string | null;
};

/** Slug stable déduit du dernier segment de l'URL. */
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
    .replace(/_(en|fr)$/i, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (slug === "") throw new Error(`Slug introuvable pour « ${url} »`);
  return slug;
}

/** Préfixe canonique du numéro, par type de document. */
export function prefixeNumero(titre: string, type: TypeDocument): string {
  if (type === "avis_art64") return "Avis";
  if (type === "decision_art65") {
    return /\b(?:urgent|urgence|d['’]urgence)\b/i.test(titre)
      ? "Décision contraignante d'urgence"
      : "Décision contraignante";
  }
  if (type === "recommandation") return "Recommandation";
  return "Guidelines";
}

/**
 * Numéro canonique, par exemple `Guidelines 05/2022`, `Avis 28/2022`,
 * `Décision contraignante 1/2021` ou `WP260` pour un document du groupe
 * Article 29. Le numéro WP vient du nom du PDF quand le titre est muet.
 */
export function numeroDepuisTitre(titre: string, type: TypeDocument, url?: string): string {
  const wp = /\bwp[-_ ]?(\d{2,4})/i.exec(`${titre} ${url ?? ""}`);
  if (wp?.[1] !== undefined && type !== "avis_art64" && type !== "decision_art65") {
    return `WP${String(Number(wp[1]))}`;
  }
  const rubrique =
    type === "decision_art65"
      ? "(?:d[ée]cisions?(?:\\s+contraignantes?)?(?:\\s+d['’]urgence)?|binding\\s+decisions?|urgent\\s+binding\\s+decisions?)"
      : "(?:guidelines?|lignes?\\s+directrices?|recommendations?|recommandations?|avis|opinions?|d[ée]cisions?\\s+contraignantes?(?:\\s+d['’]urgence)?|binding\\s+decisions?|urgent\\s+binding\\s+decisions?)";
  const trouve = new RegExp(
    `\\b${rubrique}\\s+(?:n[°ºo]\\s*)?(\\d{1,2})\\s*\\/\\s*(\\d{4})\\b`,
    "i",
  ).exec(titre);
  if (trouve !== null) {
    const prefixe = prefixeNumero(titre, type);
    return `${prefixe} ${String(Number(trouve[1])).padStart(2, "0")}/${trouve[2]}`;
  }
  if (wp?.[1] !== undefined) return `WP${String(Number(wp[1]))}`;
  const slug = slugDe(url ?? titre);
  return slug.replace(/-/g, " ").replace(/\b\w/g, (caractere) => caractere.toUpperCase());
}

/** Date de la ligne directrice : celle de la liste, sinon celle du titre. */
export function dateDocument(document: DocumentListe): string {
  const date = document.date ?? dateDansTexte(document.titre);
  if (date === null || !DATE_ISO.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`Date absente ou non ISO pour « ${document.url} »`);
  }
  return date;
}

/** Titre lisible d'une page de document : `h1`, `og:title`, puis `<title>`. */
export function titreDepuisPage(html: string): string {
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1 !== null) {
    const titre = texteVisible(h1[1] ?? "");
    if (titre !== "") return titre;
  }
  const og = /<meta\b[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (og !== null) {
    const titre = texteVisible(og[1] ?? "");
    if (titre !== "") return titre;
  }
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title !== null) {
    return texteVisible(title[1] ?? "")
      .replace(/\s*\|\s*European Data Protection Board\s*$/i, "")
      .trim();
  }
  return "";
}

/**
 * Vrai pour un document du groupe Article 29 que le CEPD a repris. Le titre ou
 * le slug portent le numéro WP, ou la page dit l'endossement ; le pied de page
 * du site nomme « Article 29 » partout et ne compte donc pas.
 */
export function estG29(titre: string, url: string, html: string): boolean {
  const endossement = /endorsed the GDPR[- ]related WP29 Guidelines/i.test(html);
  const marque =
    /\barticle[\s-]29\s+(?:working party|data protection working party)\b|\bwp[-_ ]?\d{2,4}(?!\d)|\bworking party\b/i;
  return endossement || marque.test(`${titre} ${url}`);
}

/**
 * Vrai quand la page de document porte la mention « Public consultation
 * ongoing/closed » sans « Final version ». La zone lue va du titre au bloc des
 * documents téléchargeables : le pied de page et les documents voisins ne
 * comptent pas. Cette mention est le seul signal de version de consultation
 * pour les pages dont le titre ne le dit pas.
 */
export function consultationDepuisPage(html: string): boolean {
  const debut = html.search(/document-full__title|<h1/i);
  if (debut < 0) return false;
  const fin = html.indexOf("Downloadable documents", debut);
  const zone = html.slice(debut, fin > debut ? fin : debut + 20_000);
  if (/Final version|after public consultation/i.test(zone)) return false;
  return /Public consultation (?:ongoing|closed)/i.test(zone);
}

/**
 * Enrichit une entrée de sitemap avec le titre, la date, le PDF courant et la
 * version lus sur sa page. Le PDF français est préféré ; les PDF de
 * consultation sont écartés dès qu'un PDF courant existe. Une ligne directrice
 * du G29 reprise par le CEPD prend son type propre.
 */
export function enrichirDocument(document: DocumentListe, html: string): DocumentListe {
  const titre = titreDepuisPage(html) || document.titre;
  const date = dateDansTexte(html) ?? document.date;
  const pdf = trouverPdfDocument(html, document.url);
  const pdfUrl = pdf?.url ?? document.pdfUrl;
  const version = versionDepuisTitre(titre, pdfUrl ?? document.url) ?? document.version ?? null;
  const type =
    document.type === "lignes_directrices" && estG29(titre, document.url, html)
      ? "g29_repris"
      : document.type;
  return {
    ...document,
    type,
    titre,
    date,
    pdfUrl,
    version,
    consultation: consultationDepuisPage(html),
  };
}

/** Version explicite du titre ou du nom de PDF, par exemple `2.0` ou `rev01`. */
export function versionDepuisTitre(titre: string, url?: string): string | null {
  const texte = `${titre} ${url ?? ""}`;
  const version = /\bversion\s+(\d+(?:\.\d+)?)/i.exec(titre);
  if (version?.[1] !== undefined) return version[1];
  const v = /\bv(\d+(?:\.\d+)?)\b/i.exec(texte);
  if (v?.[1] !== undefined) return v[1];
  const rev = /rev[-_.]?(\d+)/i.exec(texte);
  return rev?.[1] === undefined ? null : `rev${rev[1]}`;
}

/**
 * Une version finale est retenue ; un projet ou une consultation est signalé.
 * Le titre d'un avis porte souvent « projet de décision » : c'est l'objet de
 * l'avis, pas son état. Seuls les libellés qui qualifient le document lui-même
 * (« draft guidelines », « projet d'avis », « for public consultation ») en
 * font un projet.
 */
export function statutDepuisTitre(titre: string): "finale" | "projet" {
  const projet =
    /\b(?:draft\s+(?:guidelines?|opinion|recommendation)|projet\s+(?:de\s+|d['’])?(?:lignes?\s+directrices?|directives?|avis|opinion|recommandations?)|for\s+(?:a\s+)?public\s+consultation|public\s+consultation\s+draft|consultation\s+draft|version\s+provisoire)\b/i.test(
      titre,
    );
  const finale = /\b(?:final|finale|adopted|adoptée|adoptee|endorsed|endossé|approved|approuvé)\b/i.test(
    titre,
  );
  return projet && !finale ? "projet" : "finale";
}

/** Complète une entrée de liste avec les métadonnées nécessaires au corpus. */
export function preparerDocument(document: DocumentListe): DocumentPrepare {
  const source = document.pdfUrl ?? document.url;
  return {
    ...document,
    slug: slugDe(document.url),
    numero: numeroDepuisTitre(document.titre, document.type, source),
    date: dateDocument(document),
    // La page de consultation prime sur le titre : un document peut s'appeler
    // « Guidelines 02/2026 » et n'être encore qu'une version de consultation.
    statut: document.consultation === true ? "projet" : statutDepuisTitre(document.titre),
    version: document.version ?? versionDepuisTitre(document.titre, source),
  };
}

function versionNumerique(version: string | null): number {
  if (version === null) return 0;
  const valeur = Number.parseFloat(version);
  return Number.isFinite(valeur) ? valeur : 0;
}

/**
 * Écarte les versions obsolètes : pour un même numéro, une version finale
 * gagne ; à défaut, la plus récente reste. Les autres sont comptées.
 */
export function choisirVersions(documents: DocumentPrepare[]): {
  retenus: DocumentPrepare[];
  ecartes: DocumentPrepare[];
} {
  const groupes = new Map<string, DocumentPrepare[]>();
  for (const document of documents) {
    // Le type départage deux documents qui portent le même numéro : un avis
    // 01/2022 et une ligne directrice 01/2022 ne sont pas deux versions.
    const cle = `${document.type}|${document.numero}`;
    const groupe = groupes.get(cle) ?? [];
    groupe.push(document);
    groupes.set(cle, groupe);
  }

  const retenus: DocumentPrepare[] = [];
  const ecartes: DocumentPrepare[] = [];
  for (const groupe of groupes.values()) {
    const tries = [...groupe].sort(
      (gauche, droite) =>
        droite.date.localeCompare(gauche.date) ||
        versionNumerique(droite.version) - versionNumerique(gauche.version) ||
        // À version égale, la page française gagne : le corpus préfère le
        // français quand il existe.
        Number(droite.langue === "fr") - Number(gauche.langue === "fr") ||
        gauche.slug.localeCompare(droite.slug),
    );
    const finales = tries.filter((document) => document.statut === "finale");
    const retenu = finales[0] ?? tries[0];
    if (retenu === undefined) continue;
    retenus.push(retenu);
    ecartes.push(...tries.filter((document) => document !== retenu));
  }

  retenus.sort(
    (gauche, droite) =>
      droite.date.localeCompare(gauche.date) || gauche.slug.localeCompare(droite.slug),
  );
  return { retenus, ecartes };
}

/** Mappe une ligne directrice en fragments adressables. */
export function unitesCePd(
  document: DocumentPrepare,
  texte: string,
  descripteur: DescripteurCePd,
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
    numero: document.numero,
    chemin: `CEPD > ${LIBELLES_TYPE[document.type]} > ${document.titre}`,
    texte: fragment,
    date_acte: document.date,
    date_debut: document.date,
    date_fin: null,
    statut: document.statut,
    url: document.url,
  }));
}

/** Valide le corpus complet avant écriture ; lève en nommant les défauts. */
export function validerUnites(unites: readonly Unite[]): void {
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
    if (unite.corpus.trim() === "") erreurs.push(`corpus vide : ${unite.ref}`);
    if (unite.numero.trim() === "") erreurs.push(`numéro vide : ${unite.ref}`);
    if (!DATE_ISO.test(unite.date_acte) || Number.isNaN(Date.parse(unite.date_acte))) {
      erreurs.push(`date non ISO : ${unite.ref} (${unite.date_acte || "vide"})`);
    }
  }
  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 10).join(" ; ");
    const reste = erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : "";
    throw new Error(`Corpus CEPD invalide, rien n'est écrit : ${liste}${reste}`);
  }
}
