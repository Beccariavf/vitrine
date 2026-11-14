/**
 * Synchronise le corpus du Conseil constitutionnel depuis l'archive CONSTIT.
 *
 * L'archive est un instantané complet, pas un incrément : elle est lue en flux,
 * décision par décision, puis le corpus n'est écrit qu'après validation. Un
 * second passage sur la même archive et la même empreinte ne relit rien et ne
 * réécrit rien. Aucun incrément CONSTIT n'est publié : le manifeste porte la
 * date de la décision la plus récente pour que le retard reste lisible.
 */

import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Unite } from "../parse.ts";
import {
  dateDuJour,
  ecrireSiChange,
  listerArchives,
  sha256Fichier,
  telechargerArchive,
} from "../dila.ts";
import type { FetchTexte } from "../dila.ts";
import { validerUnites } from "../ce/parse.ts";
import { lireEntreesConstit } from "./archive.ts";
import {
  ECARTES_VIDES,
  classerDecision,
  natureRetenue,
  parseDecisionConstit,
  unitesConstit,
} from "./parse.ts";
import type { DescripteurConstit, Ecartes } from "./parse.ts";
import type { FetchFlux } from "../tar.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Dossier du corpus CONSTIT sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "constit");
/** Dossier de l'archive brute, non commitée. */
export const DOSSIER_BRUT = join("data", "raw", "constit");

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** État de reprise : l'archive déjà lue et son empreinte. */
export type EtatConstit = {
  archive: string | null;
  sha256: string | null;
  lu_le: string | null;
  /** Empreinte du filtre (natures, mots-clés, expressions). */
  filtre_sha256: string | null;
};

export const ETAT_VIDE: EtatConstit = {
  archive: null,
  sha256: null,
  lu_le: null,
  filtre_sha256: null,
};

/** Comptes d'une nature retenue ou écartée. */
export type Comptes = Record<string, number>;

/** Manifeste du corpus : identité, comptes, écarts et couverture déclarée. */
export type ManifesteConstit = {
  corpus: string;
  nom: string;
  titre: string;
  archive: string;
  archive_sha256: string;
  archive_url: string;
  date_extraction: string;
  natures_retenues: string[];
  mots_cles: string[];
  terme_vie_privee: string;
  expressions_vie_privee: string[];
  licence: string;
  /** Entrées XML lues dans l'archive, toutes natures confondues. */
  documents_lus: number;
  /** Décisions DC et QPC valablement datées, toutes dates, avant mot-clé. */
  documents_dc_qpc: number;
  /** Décisions retenues après filtrage et dédoublonnage. */
  documents: number;
  fragments: number;
  /** Décisions retenues en double, écartées au profit de l'identifiant le plus récent. */
  doublons: number;
  ecartes: Ecartes;
  natures_ecartees: Comptes;
  couverture: {
    source: string;
    archive: {
      nom: string;
      sha256: string;
      url: string;
      date: string | null;
      /** Date de la décision la plus récente de l'archive, toutes natures. */
      derniere_decision: string | null;
    };
    stock: { documents_lus: number; documents_dc_qpc: number };
    lecture: { filtre: string; unites: string };
    filtre: {
      natures_retenues: string[];
      mots_cles: string[];
      terme_vie_privee: string;
      expressions_vie_privee: string[];
    };
    comptes: { documents: number; fragments: number; doublons: number };
    par_nature: Comptes;
    periode: { date_min: string | null; date_max: string | null };
    retard_archive: {
      derniere_decision: string | null;
      archive_date: string | null;
      /** Jours entre la dernière décision de l'archive et la date d'extraction. */
      jours_au: number | null;
    };
    exclusions: {
      natures: { motif: string; comptes: Comptes };
      motifs: Ecartes;
    };
    licence: { nom: string; source: string };
  };
};

export type SyncConstitOptions = {
  rootDir?: string;
  descripteurPath?: string;
  /** Archive locale ; par défaut, la plus récente de la liste DILA est téléchargée. */
  archive?: string;
  dryRun?: boolean;
  /** Date d'extraction consignée ; par défaut, le jour courant. */
  date?: string;
  fetchTexte?: FetchTexte;
  fetchFlux?: FetchFlux;
  /** Plafond d'une entrée XML, pour les tests. */
  maxOctets?: number;
};

export type ResultatConstit = {
  archive: string;
  sha256: string;
  archiveUrl: string;
  /** Vrai quand l'état portait déjà cette archive et cette empreinte. */
  ignore: boolean;
  ecrit: boolean;
  documentsLus: number;
  documentsDcQpc: number;
  documents: number;
  fragments: number;
  doublons: number;
  ecartes: Ecartes;
  naturesEcartees: Comptes;
  parNature: Comptes;
};

/** Lit le descripteur CONSTIT. */
export function lireDescripteurConstit(chemin: string): DescripteurConstit {
  return JSON.parse(readFileSync(chemin, "utf8")) as DescripteurConstit;
}

/** Lit l'état de reprise ; un état absent vaut l'état vide. */
export function lireEtat(chemin: string): EtatConstit {
  if (!existsSync(chemin)) return { ...ETAT_VIDE };
  try {
    return { ...ETAT_VIDE, ...(JSON.parse(readFileSync(chemin, "utf8")) as Partial<EtatConstit>) };
  } catch {
    return { ...ETAT_VIDE };
  }
}

/** Empreinte de la configuration : changer une nature, un mot-clé ou une expression force une relecture. */
export function empreinteFiltre(descripteur: DescripteurConstit): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 1,
        titre: descripteur.titre,
        natures_retenues: descripteur.natures_retenues,
        mots_cles: descripteur.mots_cles,
        terme_vie_privee: descripteur.terme_vie_privee,
        expressions_vie_privee: descripteur.expressions_vie_privee,
      }),
      "utf8",
    )
    .digest("hex");
}

/** Date `AAAAMMJJ` du nom d'archive, ou `null`. */
export function dateArchive(nom: string): string | null {
  const trouve = /(\d{4})(\d{2})(\d{2})-\d{6}/.exec(nom);
  if (trouve === null) return null;
  return `${trouve[1]}-${trouve[2]}-${trouve[3]}`;
}

/** Jours entiers entre deux dates ISO ; `null` si l'une manque. */
export function joursEntre(debut: string | null, fin: string | null): number | null {
  if (debut === null || fin === null) return null;
  const a = Date.parse(`${debut}T00:00:00Z`);
  const b = Date.parse(`${fin}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Manifeste du corpus, à partir des comptes mesurés. */
export function manifesteConstit(
  descripteur: DescripteurConstit,
  archive: string,
  archiveUrl: string,
  sha256: string,
  dateExtraction: string,
  comptes: {
    documentsLus: number;
    documentsDcQpc: number;
    documents: number;
    fragments: number;
    doublons: number;
    ecartes: Ecartes;
    naturesEcartees: Comptes;
    parNature: Comptes;
    dateMin: string | null;
    dateMax: string | null;
    derniereDecisionArchive: string | null;
  },
): ManifesteConstit {
  const archiveDate = dateArchive(archive);
  return {
    corpus: descripteur.corpus,
    nom: descripteur.nom,
    titre: descripteur.titre,
    archive,
    archive_sha256: sha256,
    archive_url: archiveUrl,
    date_extraction: dateExtraction,
    natures_retenues: descripteur.natures_retenues,
    mots_cles: descripteur.mots_cles,
    terme_vie_privee: descripteur.terme_vie_privee,
    expressions_vie_privee: descripteur.expressions_vie_privee,
    licence: descripteur.licence,
    documents_lus: comptes.documentsLus,
    documents_dc_qpc: comptes.documentsDcQpc,
    documents: comptes.documents,
    fragments: comptes.fragments,
    doublons: comptes.doublons,
    ecartes: comptes.ecartes,
    natures_ecartees: comptes.naturesEcartees,
    couverture: {
      source: "DILA — CONSTIT (OPENDATA), XML Légifrance",
      archive: {
        nom: archive,
        sha256,
        url: archiveUrl,
        date: archiveDate,
        derniere_decision: comptes.derniereDecisionArchive,
      },
      stock: {
        documents_lus: comptes.documentsLus,
        documents_dc_qpc: comptes.documentsDcQpc,
      },
      lecture: {
        filtre: "TEXTE (BLOC_TEXTUEL, saisines, observations)",
        unites: "BLOC_TEXTUEL (décision seule)",
      },
      filtre: {
        natures_retenues: descripteur.natures_retenues,
        mots_cles: descripteur.mots_cles,
        terme_vie_privee: descripteur.terme_vie_privee,
        expressions_vie_privee: descripteur.expressions_vie_privee,
      },
      comptes: {
        documents: comptes.documents,
        fragments: comptes.fragments,
        doublons: comptes.doublons,
      },
      par_nature: comptes.parNature,
      periode: { date_min: comptes.dateMin, date_max: comptes.dateMax },
      retard_archive: {
        derniere_decision: comptes.derniereDecisionArchive,
        archive_date: archiveDate,
        jours_au: joursEntre(comptes.derniereDecisionArchive, dateExtraction),
      },
      exclusions: {
        natures: {
          motif:
            "hors périmètre : seules les natures DC et QPC entrent au corpus " +
            "(contentieux électoral, lois organiques, lois et autres natures écartés)",
          comptes: comptes.naturesEcartees,
        },
        motifs: comptes.ecartes,
      },
      licence: { nom: descripteur.licence, source: descripteur.licence_source },
    },
  };
}

/** Lit le manifeste existant, pour rapporter un corpus inchangé. */
function lireManifeste(chemin: string): ManifesteConstit | null {
  if (!existsSync(chemin)) return null;
  try {
    return JSON.parse(readFileSync(chemin, "utf8")) as ManifesteConstit;
  } catch {
    return null;
  }
}

/**
 * Synchronise le corpus CONSTIT. Une archive identique (nom et empreinte) est
 * ignorée ; sinon l'archive est lue en flux, les décisions sont filtrées, puis
 * le corpus est validé et écrit. Aucune borne de date n'est appliquée. Un
 * `--dry-run` ne crée aucun fichier.
 */
export async function syncConstit(
  options: SyncConstitOptions = {},
): Promise<ResultatConstit> {
  const rootDir = options.rootDir ?? RACINE;
  const descripteur = lireDescripteurConstit(
    options.descripteurPath ?? join(ICI, "descripteur.json"),
  );
  const dateExtraction = options.date ?? dateDuJour();
  if (!DATE_ISO.test(dateExtraction) || Number.isNaN(Date.parse(dateExtraction))) {
    throw new Error(`Date d'extraction attendue AAAA-MM-JJ ; reçue « ${dateExtraction} »`);
  }
  const filtreSha256 = empreinteFiltre(descripteur);

  const cheminEtat = join(rootDir, DOSSIER_CORPUS, "etat.json");
  const cheminUnites = join(rootDir, DOSSIER_CORPUS, "unites.jsonl");
  const cheminManifeste = join(rootDir, DOSSIER_CORPUS, "manifest.json");
  const etat = lireEtat(cheminEtat);

  let cheminArchive: string;
  let archiveUrl: string;
  if (options.archive !== undefined) {
    cheminArchive = isAbsolute(options.archive)
      ? options.archive
      : resolve(rootDir, options.archive);
    if (!existsSync(cheminArchive) || statSync(cheminArchive).size === 0) {
      throw new Error(`Archive CONSTIT absente ou vide : ${cheminArchive}`);
    }
    const nom = basename(cheminArchive);
    archiveUrl = new URL(nom, descripteur.url_liste).href;
  } else {
    const liste = await listerArchives(
      descripteur.url_liste,
      descripteur.motif_archive,
      options.fetchTexte,
      "CONSTIT",
    );
    const nom = liste.at(-1);
    if (nom === undefined) {
      throw new Error(`Aucune archive ${descripteur.motif_archive} dans ${descripteur.url_liste}`);
    }
    cheminArchive = join(rootDir, DOSSIER_BRUT, nom);
    archiveUrl = new URL(nom, descripteur.url_liste).href;
    if (!existsSync(cheminArchive) || statSync(cheminArchive).size === 0) {
      await telechargerArchive(archiveUrl, cheminArchive, options.fetchFlux, "CONSTIT");
    }
  }

  const archive = basename(cheminArchive);
  const sha256 = await sha256Fichier(cheminArchive);
  if (etat.archive === archive && etat.sha256 !== null && etat.sha256 !== sha256) {
    throw new Error(
      `Archive ${archive} : empreinte ${sha256} différente de celle de l'état ` +
        `(${etat.sha256}). Le fichier local est corrompu ou a été remplacé ; ` +
        `supprimez-le pour retélécharger.`,
    );
  }

  const manifesteExistant = lireManifeste(cheminManifeste);
  if (
    etat.archive === archive &&
    etat.sha256 === sha256 &&
    etat.filtre_sha256 === filtreSha256 &&
    manifesteExistant !== null &&
    existsSync(cheminUnites)
  ) {
    return {
      archive,
      sha256,
      archiveUrl,
      ignore: true,
      ecrit: false,
      documentsLus: manifesteExistant.documents_lus,
      documentsDcQpc: manifesteExistant.documents_dc_qpc,
      documents: manifesteExistant.documents,
      fragments: manifesteExistant.fragments,
      doublons: manifesteExistant.doublons,
      ecartes: manifesteExistant.ecartes,
      naturesEcartees: manifesteExistant.natures_ecartees,
      parNature: manifesteExistant.couverture.par_nature,
    };
  }

  const ecartes: Ecartes = { ...ECARTES_VIDES };
  const naturesEcartees: Comptes = {};
  /** Décisions retenues, par numéro + nature ; l'identifiant le plus récent gagne. */
  const retenues = new Map<string, ReturnType<typeof parseDecisionConstit>>();
  let documentsLus = 0;
  let documentsDcQpc = 0;
  let doublons = 0;
  let derniereDecisionArchive: string | null = null;

  for await (const entree of lireEntreesConstit(createReadStream(cheminArchive), {
    nomArchive: archive,
    ...(options.maxOctets === undefined ? {} : { maxOctets: options.maxOctets }),
  })) {
    documentsLus += 1;
    const decision = parseDecisionConstit(entree.donnees.toString("utf8"), entree.nom);

    if (
      DATE_ISO.test(decision.date) &&
      !Number.isNaN(Date.parse(decision.date)) &&
      (derniereDecisionArchive === null || decision.date > derniereDecisionArchive)
    ) {
      derniereDecisionArchive = decision.date;
    }
    if (natureRetenue(decision.nature, descripteur)) documentsDcQpc += 1;

    const verdict = classerDecision(decision, descripteur);
    if (!verdict.retenue) {
      ecartes[verdict.motif] += 1;
      if (verdict.motif === "nature_ecartee") {
        const nature = decision.nature === "" ? "(vide)" : decision.nature;
        naturesEcartees[nature] = (naturesEcartees[nature] ?? 0) + 1;
      }
      continue;
    }

    const cle = `${decision.numero} ${decision.nature}`;
    const deja = retenues.get(cle);
    if (deja === undefined) {
      retenues.set(cle, decision);
    } else {
      doublons += 1;
      if (decision.id > deja.id) retenues.set(cle, decision);
    }
  }

  const retenuesTriees = [...retenues.values()].sort((gauche, droite) =>
    gauche.id.localeCompare(droite.id),
  );
  const unites: Unite[] = [];
  const parNature: Comptes = {};
  let dateMin: string | null = null;
  let dateMax: string | null = null;
  for (const decision of retenuesTriees) {
    parNature[decision.nature] = (parNature[decision.nature] ?? 0) + 1;
    for (const unite of unitesConstit(decision, descripteur)) {
      unites.push(unite);
      if (dateMax === null || unite.date_acte > dateMax) dateMax = unite.date_acte;
      if (dateMin === null || unite.date_acte < dateMin) dateMin = unite.date_acte;
    }
  }

  validerUnites(unites, "Conseil constitutionnel");

  const documents = new Set(unites.map((unite) => unite.document)).size;
  const manifeste = manifesteConstit(
    descripteur,
    archive,
    archiveUrl,
    sha256,
    dateExtraction,
    {
      documentsLus,
      documentsDcQpc,
      documents,
      fragments: unites.length,
      doublons,
      ecartes,
      naturesEcartees,
      parNature,
      dateMin,
      dateMax,
      derniereDecisionArchive,
    },
  );
  const etatEcrit: EtatConstit = {
    archive,
    sha256,
    lu_le: dateExtraction,
    filtre_sha256: filtreSha256,
  };

  let ecrit = false;
  if (options.dryRun !== true) {
    const ecritUnites = ecrireSiChange(
      cheminUnites,
      `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    );
    const ecritManifeste = ecrireSiChange(
      cheminManifeste,
      `${JSON.stringify(manifeste, null, 2)}\n`,
    );
    const ecritEtat = ecrireSiChange(cheminEtat, `${JSON.stringify(etatEcrit, null, 2)}\n`);
    ecrit = ecritUnites || ecritManifeste || ecritEtat;
  }

  return {
    archive,
    sha256,
    archiveUrl,
    ignore: false,
    ecrit,
    documentsLus,
    documentsDcQpc,
    documents,
    fragments: unites.length,
    doublons,
    ecartes,
    naturesEcartees,
    parNature,
  };
}

/** Valeur qui suit `--nom`, ou `undefined`. */
function valeurDe(nom: string, argv: string[]): string | undefined {
  const index = argv.indexOf(nom);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const archive = valeurDe("--archive", argv);
  const rootDir = valeurDe("--root", argv);
  const descripteur = valeurDe("--descripteur", argv);
  const date = valeurDe("--date", argv);

  const resultat = await syncConstit({
    ...(rootDir === undefined ? {} : { rootDir }),
    ...(descripteur === undefined ? {} : { descripteurPath: descripteur }),
    ...(archive === undefined ? {} : { archive }),
    ...(date === undefined ? {} : { date }),
    dryRun,
  });

  const details = resultat.ignore
    ? `archive déjà lue, rien relu (${resultat.documents} décisions, ` +
      `${resultat.fragments} fragments au manifeste)`
    : `${resultat.documentsLus} entrées lues, ` +
      `${resultat.documentsDcQpc} décisions DC/QPC toutes dates, ` +
      `${resultat.documents} retenues (${Object.entries(resultat.parNature)
        .map(([nature, compte]) => `${nature}=${compte}`)
        .join(", ")}), ${resultat.fragments} fragments ; ` +
      `doublons ${resultat.doublons} ; ` +
      `écartées ${Object.entries(resultat.ecartes)
        .map(([motif, compte]) => `${motif}=${compte}`)
        .join(", ")}`;
  process.stderr.write(
    `${resultat.archive} : ${details}` +
      `${dryRun ? " — dry-run, rien n'est écrit" : resultat.ignore ? "" : resultat.ecrit ? " — corpus réécrit" : " — corpus inchangé"}\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
