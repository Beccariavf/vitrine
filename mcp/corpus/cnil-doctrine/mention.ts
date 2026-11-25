/**
 * Marquage de licence des fragments de doctrine, lu au rendu.
 *
 * La CC BY-ND 4.0 exige, pour chaque extrait partagé, la mention « extrait non
 * modifié », le lien de la licence, le titre du document, la source et la date
 * d'extraction. Le marquage est porté par le manifeste du corpus et recopié sur
 * chaque passage rendu : aucun réindex, aucune écriture dans `data/`. Le texte
 * du fragment, lui, reste mot pour mot celui de la source.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Ce qu'un passage de doctrine rend avec son extrait. */
export type MentionDoctrine = {
  /** Ligne exigée : « extrait non modifié · CC BY-ND 4.0 · <lien> ». */
  mention: string;
  titre: string;
  /** Crédit exigé par les mentions légales de cnil.fr. */
  source: string;
  /** Date d'extraction, forme `JJ/MM/AAAA`. */
  date_extraction: string;
  licence: string;
  licence_url: string;
};

type DocumentManifeste = {
  slug: string;
  titre: string;
  url: string;
  date_extraction: string;
  licence?: unknown;
  licence_url?: unknown;
  source?: unknown;
};

type ManifesteDoctrine = {
  mention?: unknown;
  source?: unknown;
  licence?: unknown;
  licence_url?: unknown;
  documents_par_type?: unknown;
};

/** Forme `JJ/MM/AAAA` d'une date ISO ; la valeur rendue telle quelle sinon. */
export function dateFr(iso: string): string {
  const trouve = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return trouve === null ? iso : `${trouve[3]}/${trouve[2]}/${trouve[1]}`;
}

/** Vrai pour un objet non nul qui n'est pas un tableau. */
function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

/**
 * Marquage par slug de document, lu dans le manifeste d'un corpus de doctrine.
 * Un manifeste absent ou illisible rend une carte vide : le corpus n'est alors
 * pas interrogeable, et aucun passage ne peut être rendu sans marquage.
 */
export function mentionsDoctrine(
  rootDir: string,
  corpus: string = "cnil_doctrine",
): Map<string, MentionDoctrine> {
  const mentions = new Map<string, MentionDoctrine>();
  const chemin = join(rootDir, "data", "corpus", corpus, "manifest.json");
  if (!existsSync(chemin)) return mentions;
  let manifeste: ManifesteDoctrine;
  try {
    manifeste = JSON.parse(readFileSync(chemin, "utf8")) as ManifesteDoctrine;
  } catch {
    return mentions;
  }
  const mention = typeof manifeste.mention === "string" ? manifeste.mention : "";
  const source = typeof manifeste.source === "string" ? manifeste.source : "";
  const licence = typeof manifeste.licence === "string" ? manifeste.licence : "";
  const licenceUrl = typeof manifeste.licence_url === "string" ? manifeste.licence_url : "";
  if (mention === "" || source === "" || licence === "") return mentions;

  const groupes = manifeste.documents_par_type;
  if (!estObjet(groupes)) return mentions;
  for (const liste of Object.values(groupes)) {
    if (!Array.isArray(liste)) continue;
    for (const valeur of liste) {
      if (!estObjet(valeur)) continue;
      const document = valeur as Partial<DocumentManifeste>;
      if (
        typeof document.slug !== "string" ||
        typeof document.titre !== "string" ||
        typeof document.url !== "string" ||
        typeof document.date_extraction !== "string"
      ) {
        continue;
      }
      // La licence du document prime sur celle du manifeste : un document peut
      // un jour relever d'un autre régime, et le crédit le suit.
      const licenceDocument =
        typeof document.licence === "string" ? document.licence : licence;
      const licenceUrlDocument =
        typeof document.licence_url === "string" ? document.licence_url : licenceUrl;
      const sourceDocument = typeof document.source === "string" ? document.source : source;
      mentions.set(document.slug, {
        mention: `${mention} · ${licenceDocument} · ${document.url}`,
        titre: document.titre,
        source: sourceDocument,
        date_extraction: dateFr(document.date_extraction),
        licence: licenceDocument,
        licence_url: licenceUrlDocument,
      });
    }
  }
  return mentions;
}
