/**
 * Correspondance entre une actualité de la veille et un document du corpus.
 *
 * La veille ne stocke que des entrées normalisées, jamais les textes intégraux :
 * le seul lien stable est l'identifiant officiel. Il est porté directement par
 * l'entrée pour le Conseil d'État et la Cour de cassation, par le CELEX de l'URL
 * pour la CJUE, et par les liens Légifrance de la page CNIL conservée en
 * snapshot. Aucune requête réseau n'est faite ici.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Entry } from "../../veille/types.ts";

/** Sources de veille dont l'identifiant désigne un document du corpus. */
export type CorpusVeille = "cnil" | "ce" | "cc" | "cjue";

const CORPUS_PAR_SOURCE: Record<string, CorpusVeille> = {
  cnil: "cnil",
  cetat: "ce",
  judilibre: "cc",
  cjeu: "cjue",
};

const ID_CETAT = /^CETATEXT\d+$/;
const ID_JUDILIBRE = /^[0-9a-f]{24}$/;
const CELEX = /^6\d{4}[A-Z]{2}\d{1,4}(?:\(\d+\))?$/;
const LIEN_CNIL = /https?:\/\/www\.legifrance\.gouv\.fr\/cnil\/id\/(CNILTEXT\d+)/g;

/**
 * Motifs d'exclusion durables : une conclusion d'avocat général, un autre type
 * ou un XHTML absent dans toutes les langues ne seront pas réparés par une
 * nouvelle passe. Un échec de téléchargement, lui, reste transitoire.
 * `version_francaise_absente` est l'ancien nom de `xhtml_absent` : les
 * manifestes déjà écrits le portent et restent durables.
 */
const MOTIFS_DURABLES = new Set([
  "avis_avocat_general",
  "autre_type",
  "xhtml_absent",
  "version_francaise_absente",
]);

/** Corpus visé par une source de veille, ou `null` si elle n'alimente aucun corpus. */
export function corpusDeLEntree(entry: Pick<Entry, "source">): CorpusVeille | null {
  return CORPUS_PAR_SOURCE[entry.source] ?? null;
}

/** Forme comparable d'une URL : sans barre finale, sans fragment ni requête. */
export function normaliserUrl(url: string): string {
  const coupe = url.split("#")[0] ?? url;
  const sansRequete = coupe.split("?")[0] ?? coupe;
  return sansRequete.replace(/\/+$/, "");
}

/** Lit un fichier, ou `null` s'il est absent ou illisible. */
function lireTexte(chemin: string): string | null {
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
}

/** Date `AAAA-MM-JJ` d'une entrée ISO, ou `null`. */
function dateEntree(entry: Entry): string | null {
  if (typeof entry.publishedAt !== "string") return null;
  const date = entry.publishedAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : null;
}

function entreesSous(dossier: string): string[] {
  const chemins: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      chemins.push(...entreesSous(chemin));
    } else if (entree.name.endsWith(".json")) {
      chemins.push(chemin);
    }
  }
  return chemins;
}

/**
 * Entrées de veille publiées depuis `depuis` inclus, triées par date puis par
 * identifiant. Un fichier illisible ou une entrée sans date exploitable est
 * ignoré sans faire échouer la lecture.
 */
export function lireEntrees(rootDir: string, depuis?: string): Entry[] {
  const racine = join(rootDir, "data", "entries");
  if (!existsSync(racine)) return [];

  const entrees: Entry[] = [];
  for (const chemin of entreesSous(racine)) {
    const texte = lireTexte(chemin);
    if (texte === null) continue;
    let valeur: unknown;
    try {
      valeur = JSON.parse(texte);
    } catch {
      continue;
    }
    for (const element of Array.isArray(valeur) ? valeur : [valeur]) {
      if (typeof element !== "object" || element === null) continue;
      const entry = element as Partial<Entry>;
      if (
        typeof entry.id !== "string" ||
        typeof entry.source !== "string" ||
        typeof entry.title !== "string" ||
        typeof entry.url !== "string"
      ) {
        continue;
      }
      const date = dateEntree(entry as Entry);
      if (date === null) continue;
      if (depuis !== undefined && date < depuis) continue;
      entrees.push(entry as Entry);
    }
  }

  return entrees.sort((gauche, droite) => {
    const da = dateEntree(gauche) ?? "";
    const db = dateEntree(droite) ?? "";
    return da === db ? gauche.id.localeCompare(droite.id) : da.localeCompare(db);
  });
}

function attribut(balise: string, nom: string): string | null {
  const trouve = new RegExp(`\\b${nom}\\s*=\\s*["']([^"']+)["']`, "i").exec(balise);
  return trouve?.[1] ?? null;
}

/** URL canonique déclarée par une page HTML, ou `null`. */
export function urlCanonique(html: string): string | null {
  for (const balise of html.matchAll(/<link\b[^>]*>/gi)) {
    const texte = balise[0];
    const rel = attribut(texte, "rel");
    if (rel === null || rel.toLowerCase() !== "canonical") continue;
    const href = attribut(texte, "href");
    if (href !== null && href.trim() !== "") return href.trim();
  }
  for (const balise of html.matchAll(/<meta\b[^>]*>/gi)) {
    const texte = balise[0];
    const propriete = attribut(texte, "property");
    if (propriete === null || propriete.toLowerCase() !== "og:url") continue;
    const content = attribut(texte, "content");
    if (content !== null && content.trim() !== "") return content.trim();
  }
  return null;
}

/**
 * Identifiants `CNILTEXT…` d'une page CNIL, par URL canonique. Seules les pages
 * snapshotées par la veille entrent dans la carte : aucune page n'est relue.
 */
export function indexerSnapshots(rootDir: string): Map<string, string[]> {
  const snapshots = new Map<string, string[]>();
  const racine = join(rootDir, "data", "raw");
  if (!existsSync(racine)) return snapshots;

  for (const sousDossier of readdirSync(racine, { withFileTypes: true })) {
    if (!sousDossier.isDirectory()) continue;
    const dossier = join(racine, sousDossier.name);
    for (const fichier of readdirSync(dossier, { withFileTypes: true })) {
      if (!fichier.isFile() || !fichier.name.endsWith(".html")) continue;
      const html = lireTexte(join(dossier, fichier.name));
      if (html === null) continue;
      const canonique = urlCanonique(html);
      if (canonique === null) continue;
      const ids = [...new Set([...html.matchAll(LIEN_CNIL)].map((lien) => lien[1] ?? ""))]
        .filter((id) => id !== "")
        .sort();
      if (ids.length === 0) continue;
      const cle = normaliserUrl(canonique);
      const existants = snapshots.get(cle) ?? [];
      snapshots.set(cle, [...new Set([...existants, ...ids])].sort());
    }
  }
  return snapshots;
}

/** Identifiants de documents d'une entrée, dans la forme du corpus. */
export function documentsDeLEntree(
  entry: Pick<Entry, "source" | "id" | "url">,
  snapshots: Map<string, string[]>,
): string[] {
  switch (entry.source) {
    case "cnil":
      return snapshots.get(normaliserUrl(entry.url)) ?? [];
    case "cetat":
      return ID_CETAT.test(entry.id) ? [entry.id] : [];
    case "judilibre":
      return ID_JUDILIBRE.test(entry.id) ? [entry.id] : [];
    case "cjeu": {
      const celex = /CELEX:([^/?#&]+)/.exec(entry.url)?.[1];
      if (celex === undefined) return [];
      let decode: string;
      try {
        decode = decodeURIComponent(celex);
      } catch {
        decode = celex;
      }
      return CELEX.test(decode) ? [decode] : [];
    }
    default:
      return [];
  }
}

/** Documents distincts présents dans chaque corpus, lus dans `unites.jsonl`. */
export function indexerDocumentsCorpus(rootDir: string): Map<string, Set<string>> {
  const documents = new Map<string, Set<string>>();
  const racine = join(rootDir, "data", "corpus");
  if (!existsSync(racine)) return documents;

  for (const dossier of readdirSync(racine, { withFileTypes: true })) {
    if (!dossier.isDirectory()) continue;
    const chemin = join(racine, dossier.name, "unites.jsonl");
    if (!existsSync(chemin)) continue;
    const ensemble = new Set<string>();
    for (const ligne of (lireTexte(chemin) ?? "").split("\n")) {
      if (ligne.trim() === "") continue;
      try {
        const unite = JSON.parse(ligne) as { document?: unknown };
        if (typeof unite.document === "string" && unite.document !== "") ensemble.add(unite.document);
      } catch {
        // Une ligne illisible ne doit pas masquer les autres documents.
      }
    }
    documents.set(dossier.name, ensemble);
  }
  return documents;
}

/**
 * Documents explicitement écartés par un corpus, avec leur motif. Seule la CJUE
 * publie une liste par identifiant ; les comptes des autres corpus ne disent pas
 * quel document a été écarté.
 */
export function documentsEcartes(rootDir: string, corpus: string): Map<string, string> {
  const ecartes = new Map<string, string>();
  if (corpus !== "cjue") return ecartes;
  const chemin = join(rootDir, "data", "corpus", corpus, "manifest.json");
  const texte = lireTexte(chemin);
  if (texte === null) return ecartes;
  try {
    const manifeste = JSON.parse(texte) as {
      couverture?: { documents_ecartes?: { celex?: unknown; motif?: unknown }[] };
    };
    for (const document of manifeste.couverture?.documents_ecartes ?? []) {
      if (
        typeof document.celex === "string" &&
        typeof document.motif === "string" &&
        MOTIFS_DURABLES.has(document.motif)
      ) {
        ecartes.set(document.celex, document.motif);
      }
    }
  } catch {
    // Un manifeste illisible laisse la carte vide : les documents sont alors manquants.
  }
  return ecartes;
}
