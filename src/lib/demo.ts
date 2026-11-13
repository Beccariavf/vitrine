import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Chemin de la capture, relatif à la racine du dépôt. */
export const CHEMIN_DEMO = join("src", "demo", "demo.json");

/** Une source citée par la réponse avec connecteur. */
export type SourceDemo = {
  libelle: string;
  /** Texte officiel, toujours en `https`. */
  url: string;
};

/** Une capture réelle : la même question posée sans puis avec le connecteur. */
export type Demo = {
  question: string;
  /** Date de la capture, `AAAA-MM-JJ`. */
  capturee_le: string;
  /** Modèle utilisé pour les deux réponses. */
  modele: string;
  /** Réponse sans connecteur, copiée mot pour mot. */
  sans: string;
  /** Réponse avec connecteur, copiée mot pour mot. */
  avec: string;
  sources: SourceDemo[];
};

const CHAMPS_TEXTE = ["question", "capturee_le", "modele", "sans", "avec"] as const;

function texte(valeur: unknown): valeur is string {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

function estHttps(valeur: string): boolean {
  try {
    return new URL(valeur).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Lit la démo capturée ; `null` quand le fichier manque, pour que les pages se
 * construisent sans emplacement vide. Une démo incomplète lève en nommant le
 * champ fautif : le build échoue plutôt que de publier une preuve partielle.
 */
export function lireDemo(rootDir: string = process.cwd()): Demo | null {
  const chemin = join(rootDir, CHEMIN_DEMO);
  if (!existsSync(chemin)) return null;

  let valeur: unknown;
  try {
    valeur = JSON.parse(readFileSync(chemin, "utf8"));
  } catch (erreur) {
    const raison = erreur instanceof Error ? erreur.message : String(erreur);
    throw new Error(`Démo invalide ${CHEMIN_DEMO} : JSON illisible (${raison})`, { cause: erreur });
  }
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) {
    throw new Error(`Démo invalide ${CHEMIN_DEMO} : objet JSON attendu`);
  }

  const record = valeur as Record<string, unknown>;
  for (const champ of CHAMPS_TEXTE) {
    if (!texte(record[champ])) {
      throw new Error(`Démo invalide ${CHEMIN_DEMO} : champ "${champ}" absent ou vide`);
    }
  }
  const capturee = record.capturee_le as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(capturee) || Number.isNaN(Date.parse(capturee))) {
    throw new Error(`Démo invalide ${CHEMIN_DEMO} : champ "capturee_le" doit être une date AAAA-MM-JJ`);
  }

  const sources = record.sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error(`Démo invalide ${CHEMIN_DEMO} : champ "sources" absent ou vide`);
  }
  const lues = sources.map((source: unknown, index): SourceDemo => {
    const element = (typeof source === "object" && source !== null ? source : {}) as Record<string, unknown>;
    if (!texte(element.libelle)) {
      throw new Error(`Démo invalide ${CHEMIN_DEMO} : champ "sources[${index}].libelle" absent ou vide`);
    }
    if (!texte(element.url) || !estHttps(element.url)) {
      throw new Error(`Démo invalide ${CHEMIN_DEMO} : champ "sources[${index}].url" doit être une URL https`);
    }
    return { libelle: element.libelle, url: element.url };
  });

  return {
    question: record.question as string,
    capturee_le: capturee,
    modele: record.modele as string,
    sans: record.sans as string,
    avec: record.avec as string,
    sources: lues,
  };
}
