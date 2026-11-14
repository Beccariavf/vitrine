/**
 * Veille du Conseil constitutionnel depuis l'archive CONSTIT de la DILA.
 *
 * Aucun incrément CONSTIT n'est publié : la source relit l'archive globale
 * (`Freemium_constit_global_*.tar.gz`, ≈ 13 Mo) et ne la retélécharge pas quand
 * son nom est celui déjà lu par `constit:sync` (manifeste du corpus). Une
 * décision ne peut donc apparaître qu'à la publication d'une nouvelle archive.
 *
 * La lecture, le filtre et le dédoublonnage sont ceux du corpus (#50) : seules
 * les décisions DC et QPC retenues par le descripteur produisent une entrée, et
 * une décision déjà au corpus n'en produit aucune. Aucun résumé n'est inventé :
 * le titre vient des métadonnées, l'extrait du texte de la décision.
 *
 * Le retard de l'archive est signalé à chaque passe : la date de la décision la
 * plus récente de l'archive (toutes natures) face à la date de la passe. Au-delà
 * de 45 jours, la passe porte un avertissement explicite.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import type { Entry } from "../types.ts";
import type { FetchTexte } from "../../mcp/corpus/dila.ts";
import type { FetchFlux } from "../../mcp/corpus/tar.ts";
import { listerArchives } from "../../mcp/corpus/dila.ts";
import { lireEntreesConstit } from "../../mcp/corpus/constit/archive.ts";
import { classerDecision, decisionsUniques, parseDecisionConstit } from "../../mcp/corpus/constit/parse.ts";
import type { DecisionConstit, DescripteurConstit } from "../../mcp/corpus/constit/parse.ts";
import { joursEntre } from "../../mcp/corpus/constit/sync.ts";
import { indexerDocumentsCorpus } from "../../mcp/corpus/veille.ts";
import { toSummary } from "../summary.ts";

/** Identifiant stable de la source, écrit dans chaque entrée. */
export const SOURCE_ID = "constit";

/** Matière unique : le corpus ne retient que les décisions sur les données personnelles. */
export const THEME = "donnees-personnelles";

/** Retard au-delà duquel l'archive est signalée comme anormalement ancienne. */
export const RETARD_MAX_JOURS = 45;

/** Descripteur du corpus, partagé avec `constit:sync` : même filtre, mêmes natures. */
export const DESCRIPTEUR = fileURLToPath(
  new URL("../../mcp/corpus/constit/descripteur.json", import.meta.url),
);

/** Manifeste du corpus : son `archive` dit celle déjà lue. */
export const MANIFESTE = join("data", "corpus", "constit", "manifest.json");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Lu du manifeste : l'archive déjà lue et la dernière décision qu'elle porte. */
type ManifesteLu = {
  archive?: unknown;
  couverture?: { archive?: { derniere_decision?: unknown } };
};

/** Lit le descripteur CONSTIT. */
export function lireDescripteur(chemin: string = DESCRIPTEUR): DescripteurConstit {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurConstit;
}

/** Lit le manifeste du corpus ; `null` s'il est absent ou illisible. */
export function lireManifeste(chemin: string): ManifesteLu | null {
  if (!existsSync(chemin)) return null;
  try {
    const valeur: unknown = JSON.parse(readFileSync(chemin, "utf8"));
    return typeof valeur === "object" && valeur !== null ? (valeur as ManifesteLu) : null;
  } catch {
    return null;
  }
}

/** `2010-07-22` → `22/07/2010`. */
export function dateFr(date: string): string {
  const [annee, mois, jour] = date.split("-");
  return annee === undefined || mois === undefined || jour === undefined
    ? date
    : `${jour}/${mois}/${annee}`;
}

/** Identifiant d'une entrée : stable, adressé par le document du corpus. */
export function identifiant(document: string): string {
  return createHash("sha256").update(`${SOURCE_ID}|${document}`, "utf8").digest("hex").slice(0, 16);
}

/**
 * Entrée d'une décision retenue. `publishedAt` est la date de la passe, comme
 * pour `legi` et `eurlex` : l'archive a ≈ 4 semaines de retard, et une entrée
 * datée de la décision sortirait de la fenêtre de `corpus:sync`. La date de la
 * décision reste dans `date_acte`, dans le titre et dans `numero`.
 */
export function entreeDeDecision(decision: DecisionConstit, datePasse: string): Entry {
  const numero = `${decision.numero} ${decision.nature}`.trim();
  const jour = DATE_ISO.test(decision.date) ? ` du ${dateFr(decision.date)}` : "";
  const titre = decision.titre === "" ? "" : ` : ${decision.titre}`;
  return {
    id: identifiant(decision.id),
    title: `Décision n° ${numero}${jour}${titre}`,
    officialTitle: decision.titre === "" ? `Décision n° ${numero}${jour}` : decision.titre,
    url: decision.url,
    publishedAt: `${datePasse}T12:00:00.000Z`,
    summary: toSummary(decision.paragraphes[0] ?? null),
    references: [],
    themes: [THEME],
    source: SOURCE_ID,
    document: decision.id,
    numero,
    nature: decision.nature,
    date_acte: decision.date,
  };
}

/**
 * Ligne de rapport et avertissement éventuel du retard de l'archive. Le retard
 * se compte jusqu'à la date de la passe : c'est la fraîcheur de la source, pas
 * la date de la dernière décision retenue.
 */
export function rapportDeRetard(
  archive: string,
  datePasse: string,
  derniere: string | null,
): { warnings: string[]; notes: string[] } {
  const jours = joursEntre(derniere, datePasse);
  return {
    warnings:
      jours !== null && jours > RETARD_MAX_JOURS
        ? [
            `${SOURCE_ID} : archive ${archive} en retard de ${jours} jours ` +
              `(dernière décision ${derniere}, date de la passe ${datePasse})`,
          ]
        : [],
    notes: [
      `${SOURCE_ID} : archive ${archive}, dernière décision ${derniere ?? "inconnue"}, ` +
        (jours === null ? "retard non calculable" : `retard ${jours} jour(s)`),
    ],
  };
}

export type PasseConstitOptions = {
  /** Racine du dépôt : `data/` y est lu. */
  rootDir?: string;
  /** Liste OPENDATA de la DILA. */
  fetchImpl?: FetchTexte;
  /** Archive téléchargée en flux, jamais chargée entière ; simulée en test. */
  fetchFlux?: FetchFlux;
  /** Date de la passe : `publishedAt` des entrées et calcul du retard. */
  maintenant?: Date;
  descripteur?: DescripteurConstit;
};

export type ResultatPasseConstit = {
  /** Rien à conserver : la veille ne fait que lire l'archive, dont `constit:sync` garde la copie. */
  raw: string[];
  entries: Entry[];
  warnings: string[];
  /** Lignes informatives de la passe, imprimées sans préfixe d'avertissement. */
  notes: string[];
};

/** Dernière décision lue dans un manifeste de corpus, ou `null`. */
function derniereDecisionDuManifeste(manifeste: ManifesteLu | null): string | null {
  const date = manifeste?.couverture?.archive?.derniere_decision;
  return typeof date === "string" && DATE_ISO.test(date) ? date : null;
}

/**
 * Une passe : la liste de la DILA donne la dernière archive ; si son nom est
 * celui du manifeste du corpus, elle n'est pas retéléchargée et seule la ligne
 * de retard est rendue. Sinon elle est lue en flux, filtrée par le descripteur
 * du corpus, et chaque décision retenue absente du corpus devient une entrée.
 */
export async function passeConstit(
  options: PasseConstitOptions = {},
): Promise<ResultatPasseConstit> {
  const descripteur = options.descripteur ?? lireDescripteur();
  const rootDir = options.rootDir ?? process.cwd();
  const datePasse = (options.maintenant ?? new Date()).toISOString().slice(0, 10);
  if (!DATE_ISO.test(datePasse) || Number.isNaN(Date.parse(datePasse))) {
    throw new Error(`Date de passe attendue AAAA-MM-JJ ; reçue « ${datePasse} »`);
  }

  const liste = await listerArchives(
    descripteur.url_liste,
    descripteur.motif_archive,
    options.fetchImpl,
    "CONSTIT",
  );
  const archive = liste.at(-1);
  if (archive === undefined) {
    throw new Error(
      `Aucune archive ${descripteur.motif_archive} dans ${descripteur.url_liste}`,
    );
  }

  const manifeste = lireManifeste(join(rootDir, MANIFESTE));
  if (manifeste?.archive === archive) {
    const rapport = rapportDeRetard(archive, datePasse, derniereDecisionDuManifeste(manifeste));
    return {
      raw: [],
      entries: [],
      warnings: rapport.warnings,
      notes: [`${SOURCE_ID} : archive ${archive} déjà lue, aucun téléchargement`, ...rapport.notes],
    };
  }

  const flux = options.fetchFlux ?? (fetch as unknown as FetchFlux);
  const reponse = await flux(new URL(archive, descripteur.url_liste).href);
  if (!reponse.ok) {
    throw new Error(`Archive ${archive} refusée (HTTP ${reponse.status})`);
  }
  if (reponse.body === null) {
    throw new Error(`Archive ${archive} sans corps lisible en flux`);
  }

  /** Décisions retenues de l'archive, avant dédoublonnage par numéro + nature. */
  const retenues: DecisionConstit[] = [];
  let documentsLus = 0;
  let derniere: string | null = null;

  for await (const entree of lireEntreesConstit(Readable.fromWeb(reponse.body), {
    nomArchive: archive,
    maxOctets: descripteur.max_entree_octets,
  })) {
    documentsLus += 1;
    const decision = parseDecisionConstit(entree.donnees.toString("utf8"), entree.nom);

    // Le retard porte sur l'archive entière, toutes natures : une décision
    // électorale publiée plus récemment dit la fraîcheur du stock.
    if (
      DATE_ISO.test(decision.date) &&
      !Number.isNaN(Date.parse(decision.date)) &&
      (derniere === null || decision.date > derniere)
    ) {
      derniere = decision.date;
    }

    if (!classerDecision(decision, descripteur).retenue) continue;
    retenues.push(decision);
  }

  const { decisions } = decisionsUniques(retenues);
  const documents = indexerDocumentsCorpus(rootDir).get("constit") ?? new Set<string>();
  const entries = decisions
    .sort((gauche, droite) => gauche.id.localeCompare(droite.id))
    .filter((decision) => !documents.has(decision.id))
    .map((decision) => entreeDeDecision(decision, datePasse));

  const rapport = rapportDeRetard(archive, datePasse, derniere);
  return {
    raw: [],
    entries,
    warnings: rapport.warnings,
    notes: [
      `${SOURCE_ID} : archive ${archive}, ${documentsLus} décision(s) lue(s), ` +
        `${decisions.length} retenue(s), ${entries.length} entrée(s) de veille`,
      ...rapport.notes,
    ],
  };
}
