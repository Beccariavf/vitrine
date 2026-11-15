/**
 * Versement au corpus CJUE d'un arrêt rendu qu'une affaire suivie par la veille
 * de préparation a désigné.
 *
 * La synchronisation ordinaire décide seule de ce qu'elle retient : l'arrêt
 * entre par le filtre CJUE (matière `PDON`, notions, type) quand il y passe. Un
 * arrêt suivi qui n'y passe pas est ajouté aux CELEX complémentaires du
 * descripteur — par ce module, jamais à la main —, puis la synchronisation est
 * relancée. Le descripteur est rétabli si le corpus ne suit pas.
 */

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { typeCelex } from "./liste.ts";
import type { DescripteurCjue } from "./liste.ts";
import { syncCjue } from "./sync.ts";
import type { SyncCjueOptions } from "./sync.ts";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Dossier du corpus CJUE sous `data/corpus/`. */
export const DOSSIER_CORPUS = join("data", "corpus", "cjue");

export type IncorporerArretOptions = {
  rootDir: string;
  /** CELEX de la décision rendue, désigné par l'affaire suivie. */
  celex: string;
  descripteurPath?: string;
  /** Date de la passe, pour la synchronisation. */
  date?: string;
  /** Remplaçable en test : la synchronisation réelle lit CELLAR. */
  syncImpl?: (options: SyncCjueOptions) => Promise<unknown>;
};

export type ResultatArretVeille = {
  ecrit: boolean;
  message: string;
  /** Vrai quand l'arrêt est entré par la liste complémentaire, hors filtre CJUE. */
  complementaire: boolean;
};

/** Écrit un fichier UTF-8 s'il n'a pas déjà exactement ce contenu. */
function ecrireSiChange(chemin: string, contenu: string): boolean {
  try {
    if (readFileSync(chemin, "utf8") === contenu) return false;
  } catch {
    // Absent : on l'écrit plus bas.
  }
  const temporaire = `${chemin}.tmp`;
  writeFileSync(temporaire, contenu, "utf8");
  renameSync(temporaire, chemin);
  return true;
}

function ecritPar(resultat: unknown): boolean {
  return (
    typeof resultat === "object" &&
    resultat !== null &&
    (resultat as { ecrit?: unknown }).ecrit === true
  );
}

/** Documents présents dans le corpus CJUE, lus dans `unites.jsonl`. */
export function documentsCjue(rootDir: string): Set<string> {
  const documents = new Set<string>();
  try {
    for (const ligne of readFileSync(
      join(rootDir, DOSSIER_CORPUS, "unites.jsonl"),
      "utf8",
    ).split("\n")) {
      if (ligne.trim() === "") continue;
      try {
        const unite = JSON.parse(ligne) as { document?: unknown };
        if (typeof unite.document === "string") documents.add(unite.document);
      } catch {
        // Une ligne illisible ne masque pas les autres documents.
      }
    }
  } catch {
    // Corpus absent : aucun document n'est présent.
  }
  return documents;
}

/**
 * Verse un arrêt au corpus : il entre par le filtre CJUE, sinon par la liste
 * complémentaire du descripteur. Un arrêt déjà présent n'est pas relu.
 */
export async function incorporerArretVeille(
  options: IncorporerArretOptions,
): Promise<ResultatArretVeille> {
  const chemin = options.descripteurPath ?? join(ICI, "descripteur.json");
  const avant = readFileSync(chemin, "utf8");
  const descripteur = JSON.parse(avant) as DescripteurCjue;
  const type = typeCelex(options.celex);
  if (!(type in descripteur.types_retenus)) {
    return {
      ecrit: false,
      complementaire: false,
      message: `${options.celex} : type ${type} non retenu par la CJUE, non ajouté`,
    };
  }
  if (documentsCjue(options.rootDir).has(options.celex)) {
    return {
      ecrit: false,
      complementaire: false,
      message: `${options.celex} déjà au corpus CJUE`,
    };
  }

  const synchroniser = async (): Promise<boolean> => {
    const resultat = await (options.syncImpl ?? syncCjue)({
      rootDir: options.rootDir,
      descripteurPath: chemin,
      ...(options.date === undefined ? {} : { date: options.date }),
    });
    return ecritPar(resultat);
  };

  let ecrit = await synchroniser();
  if (documentsCjue(options.rootDir).has(options.celex)) {
    return {
      ecrit,
      complementaire: false,
      message: `${options.celex} entré au corpus CJUE par le filtre`,
    };
  }

  const existants = descripteur.celex_complementaires ?? [];
  if (!existants.includes(options.celex)) {
    descripteur.celex_complementaires = [...existants, options.celex];
    ecrit =
      ecrireSiChange(chemin, `${JSON.stringify(descripteur, null, 2)}\n`) || ecrit;
  }

  try {
    ecrit = (await synchroniser()) || ecrit;
  } catch (error) {
    // Le corpus n'a pas suivi : le descripteur revient à son état antérieur.
    ecrireSiChange(chemin, avant);
    throw error;
  }
  if (!documentsCjue(options.rootDir).has(options.celex)) {
    ecrireSiChange(chemin, avant);
    throw new Error(
      `${options.celex} : arrêt suivi absent du corpus CJUE après synchronisation ` +
        "et ajout aux CELEX complémentaires",
    );
  }
  return {
    ecrit,
    complementaire: true,
    message: `${options.celex} entré au corpus CJUE par les CELEX complémentaires`,
  };
}
