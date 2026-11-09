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
import { dateDansTexte } from "./liste.ts";
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

/**
 * Numéro canonique, par exemple `Guidelines 05/2022`, `Recommendation 01/2022`
 * ou `WP260` pour une ligne directrice du groupe Article 29 qui n'a pas de
 * numéro EDPB. Le numéro WP vient du nom du PDF quand le titre est muet.
 */
export function numeroDepuisTitre(titre: string, type: TypeDocument, url?: string): string {
  const trouve =
    /\b(?:guidelines?|lignes?\s+directrices?|recommendations?|recommandations?)\s+(?:n[°o]\s*)?(\d{1,2})\s*\/\s*(\d{4})\b/i.exec(
      titre,
    );
  if (trouve !== null) {
    const prefixe = type === "recommendation" ? "Recommendation" : "Guidelines";
    return `${prefixe} ${String(Number(trouve[1])).padStart(2, "0")}/${trouve[2]}`;
  }
  const wp = /\bwp[-_ ]?(\d{2,4})/i.exec(`${titre} ${url ?? ""}`);
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
 * Enrichit une entrée de sitemap avec le titre, la date, le PDF courant et la
 * version lus sur sa page. Le PDF français est préféré ; les PDF de
 * consultation sont écartés dès qu'un PDF courant existe.
 */
export function enrichirDocument(document: DocumentListe, html: string): DocumentListe {
  const titre = titreDepuisPage(html) || document.titre;
  const date = dateDansTexte(html) ?? document.date;
  const pdf = trouverPdfDocument(html, document.url);
  const pdfUrl = pdf?.url ?? document.pdfUrl;
  const version = versionDepuisTitre(titre, pdfUrl ?? document.url) ?? document.version ?? null;
  return { ...document, titre, date, pdfUrl, version };
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

/** Une version finale est retenue ; un projet ou une consultation est signalé. */
export function statutDepuisTitre(titre: string): "finale" | "projet" {
  const projet =
    /\b(?:draft|projet|consultation|public consultation|for public consultation|version provisoire)\b/i.test(
      titre,
    );
  const finale = /\b(?:final|finale|adopted|adoptée|adoptee|endorsed)\b/i.test(titre);
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
    statut: statutDepuisTitre(document.titre),
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
    const groupe = groupes.get(document.numero) ?? [];
    groupe.push(document);
    groupes.set(document.numero, groupe);
  }

  const retenus: DocumentPrepare[] = [];
  const ecartes: DocumentPrepare[] = [];
  for (const groupe of groupes.values()) {
    const tries = [...groupe].sort(
      (gauche, droite) =>
        droite.date.localeCompare(gauche.date) ||
        versionNumerique(droite.version) - versionNumerique(gauche.version) ||
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
    chemin: `CEPD > Lignes directrices > ${document.titre}`,
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
