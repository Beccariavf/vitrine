/**
 * Télécharge et extrait le texte des PDF du CEPD.
 *
 * Le texte officiel n'existe qu'en PDF. Un PDF sans texte (scanné), trop court
 * ou majoritairement non alphabétique est refusé en nommant son URL : il ne doit
 * jamais produire de fragments vides ou illisibles.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { extractText } from "unpdf";
import { MAX_FRAGMENT } from "../cnil/parse.ts";
import { ErreurHttp, normaliserUrlWayback } from "./liste.ts";
import type { OptionsHttp } from "./liste.ts";

/** Réponse binaire minimale d'un `fetch`, injectable en test. */
export type FetchPdf = (url: string) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  headers?: { get(name: string): string | null };
}>;

export type OptionsPdf = OptionsHttp & {
  fetchPdf?: FetchPdf;
  /** Hôtes admis ; `web.archive.org` n'est ajouté que pour un repli Wayback. */
  hotesAutorises?: string[];
  dryRun?: boolean;
};

/** Nombre minimal de caractères d'un PDF retenu. */
export const MIN_CARACTERES = 2000;

/** Part minimale de lettres dans le texte extrait. */
export const MIN_PART_LETTRES = 0.5;

/** Erreur d'un PDF refusé : l'URL est toujours nommée. */
export class ErreurPdf extends Error {
  readonly url: string;

  constructor(url: string, raison: string) {
    super(`${url} : ${raison}`);
    this.name = "ErreurPdf";
    this.url = url;
  }
}

/** Langue d'un PDF, lue sur son nom de fichier. */
export type LanguePdf = "fr" | "en" | "autre";

/** Langue d'un PDF : `fr`, `en` ou `autre`. */
export function languePdf(url: string): LanguePdf {
  let chemin: string;
  try {
    chemin = new URL(url).pathname.toLowerCase();
  } catch {
    return "autre";
  }
  const nom = chemin.split("/").at(-1) ?? "";
  if (/[_-]fr(?:[_-]|\.pdf$)/i.test(nom)) return "fr";
  if (/[_-]en(?:[_-]|\.pdf$)/i.test(nom)) return "en";
  return "autre";
}

/**
 * Choisit le PDF d'une page de document : le français `_fr.pdf` quand il existe,
 * sinon le premier PDF de la version courante. Les PDF de consultation
 * publique sont écartés dès qu'un PDF courant existe, pour ne pas retenir une
 * version antérieure.
 */
export function trouverPdfDocument(
  html: string,
  pageUrl: string,
): { url: string; langue: LanguePdf } | null {
  const bruts: string[] = [];
  const motifs = [
    /<meta\b[^>]*name=["']citation_pdf_url["'][^>]*content=["']([^"']+)["']/gi,
    /href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi,
    /data-url=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi,
  ];
  for (const motif of motifs) {
    for (const trouve of html.matchAll(motif)) {
      if (trouve[1] !== undefined) bruts.push(trouve[1]);
    }
  }

  const urls: string[] = [];
  for (const brut of bruts) {
    try {
      const url = new URL(normaliserUrlWayback(brut), pageUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (!url.pathname.toLowerCase().endsWith(".pdf")) continue;
      urls.push(url.href);
    } catch {
      // Lien illisible : on essaie le suivant.
    }
  }
  const uniques = [...new Set(urls)];
  const courants = uniques.filter(
    (url) => !new URL(url).pathname.toLowerCase().includes("/consultation/"),
  );
  const candidats = courants.length > 0 ? courants : uniques;
  const francais = candidats.find((url) => languePdf(url) === "fr");
  const choisi = francais ?? candidats[0];
  return choisi === undefined ? null : { url: choisi, langue: languePdf(choisi) };
}

/** Vrai si l'hôte appartient à l'un des domaines admis. */
export function estUrlAutorisee(url: string, hotes: readonly string[] = ["edpb.europa.eu"]): boolean {
  let hote: string;
  try {
    hote = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return hotes.some((domaine) => {
    const attendu = domaine.toLowerCase();
    return hote === attendu || hote.endsWith(`.${attendu}`);
  });
}

/** Vrai si les octets commencent par la signature PDF. */
export function estPdf(octets: Uint8Array): boolean {
  return (
    octets.length >= 5 &&
    octets[0] === 0x25 &&
    octets[1] === 0x50 &&
    octets[2] === 0x44 &&
    octets[3] === 0x46 &&
    octets[4] === 0x2d
  );
}

function attendreMs(ms: number): Promise<void> {
  return new Promise((reussir) => setTimeout(reussir, ms));
}

/**
 * Télécharge un PDF par fichier temporaire puis renommage. Un PDF déjà présent
 * est réutilisé. Les réponses 429 et 503 sont retentées trois fois.
 */
export async function telechargerPdf(
  url: string,
  chemin: string,
  options: OptionsPdf = {},
): Promise<Uint8Array> {
  if (!estUrlAutorisee(url, options.hotesAutorises)) {
    throw new ErreurPdf(url, "document hors du domaine autorisé");
  }
  if (existsSync(chemin) && statSync(chemin).size > 0) {
    return new Uint8Array(readFileSync(chemin));
  }

  const fetchImpl = options.fetchPdf ?? (fetch as unknown as FetchPdf);
  const tentatives = options.tentatives ?? 3;
  const delai = options.delaiMs ?? 2000;
  const attendre = options.attendre ?? attendreMs;
  const via = options.via ?? "direct";
  let statut: number | string = "réseau";

  for (let tentative = 1; tentative <= tentatives; tentative += 1) {
    const reponse = await fetchImpl(url);
    statut = reponse.status;
    options.journal?.push({ via, url, tentative, statut });
    if (reponse.ok) {
      const octets = new Uint8Array(await reponse.arrayBuffer());
      if (!estPdf(octets)) {
        throw new ErreurPdf(url, "le fichier téléchargé n'est pas un PDF");
      }
      if (options.dryRun !== true) {
        mkdirSync(dirname(chemin), { recursive: true });
        const temporaire = `${chemin}.tmp`;
        try {
          writeFileSync(temporaire, octets);
          renameSync(temporaire, chemin);
        } finally {
          if (existsSync(temporaire)) rmSync(temporaire, { force: true });
        }
      }
      return octets;
    }
    if (reponse.status !== 429 && reponse.status !== 503) {
      throw new ErreurHttp(url, reponse.status, tentative);
    }
    if (tentative < tentatives) await attendre(delai * 2 ** (tentative - 1));
  }
  throw new ErreurHttp(url, statut, tentatives);
}

/** Normalise les espaces, les coupures de mots et les lignes d'un texte PDF. */
export function normaliserTextePdf(texte: string): string {
  return texte
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u00ad/g, "")
    .replace(/-\n(?=\p{Ll})/gu, "")
    .split("\n")
    .map((ligne) => ligne.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Part des caractères qui sont des lettres. */
export function partLettres(texte: string): number {
  if (texte.length === 0) return 0;
  return (texte.match(/\p{L}/gu) ?? []).length / texte.length;
}

/** Vrai si le texte satisfait les deux seuils de qualité. */
export function texteValide(texte: string): boolean {
  return texte.length >= MIN_CARACTERES && partLettres(texte) >= MIN_PART_LETTRES;
}

/**
 * Découpe un texte PDF en paragraphes. Les blocs séparés par une ligne vide
 * restent des paragraphes ; un bloc trop long est découpé à ses phrases pour
 * que `decouperParagraphes` puisse ensuite viser 600 à 1 200 caractères.
 */
export function paragraphesDepuisTexte(texte: string): string[] {
  const paragraphes: string[] = [];
  const blocs = texte
    .split(/\n\s*\n+/)
    .map((bloc) => bloc.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim())
    .filter((bloc) => bloc !== "");

  for (const bloc of blocs) {
    if (bloc.length <= MAX_FRAGMENT) {
      paragraphes.push(bloc);
      continue;
    }
    const phrases = bloc
      .split(/(?<=[.!?;:])\s+/u)
      .map((phrase) => phrase.trim())
      .filter((phrase) => phrase !== "");
    if (phrases.length <= 1) paragraphes.push(bloc);
    else paragraphes.push(...phrases);
  }
  return paragraphes;
}

/** Extrait le texte page par page et refuse un PDF vide, trop court ou non alphabétique. */
export async function extraireTextePdf(octets: Uint8Array, url: string): Promise<string> {
  if (!estPdf(octets)) throw new ErreurPdf(url, "le fichier n'est pas un PDF");
  let pages: string[];
  try {
    const resultat = await extractText(new Uint8Array(octets), { mergePages: false });
    pages = resultat.text;
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new ErreurPdf(url, `extraction impossible (${cause})`);
  }
  const texte = normaliserTextePdf(pages.join("\n\n"));
  if (texte === "") throw new ErreurPdf(url, "PDF sans texte (scanné ou vide)");
  if (texte.length < MIN_CARACTERES) {
    throw new ErreurPdf(
      url,
      `texte trop court (${texte.length} caractères, minimum ${MIN_CARACTERES})`,
    );
  }
  const part = partLettres(texte);
  if (part < MIN_PART_LETTRES) {
    throw new ErreurPdf(
      url,
      `part de lettres insuffisante (${(part * 100).toFixed(1)} %, minimum ` +
        `${(MIN_PART_LETTRES * 100).toFixed(0)} %)`,
    );
  }
  return texte;
}
