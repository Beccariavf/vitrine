/**
 * Historique des versions remplacées d'un texte suivi.
 *
 * Un corpus ne porte qu'une version en vigueur : quand une synchronisation en
 * lit une nouvelle, l'identifiant précédent ne doit pas disparaître du
 * manifeste. Il y reste avec ses dates de début et de fin, tandis que le
 * snapshot brut de la version remplacée reste sous `data/raw/`. La lecture par
 * date est hors de ce lot ; ici, seule la perte est empêchée.
 */

import { existsSync, readFileSync } from "node:fs";

/** Une version qui n'est plus la version courante du corpus. */
export type VersionRemplacee = {
  /** Identifiant de version : `LEGITEXT…_JJ-MM-AAAA` ou `LEGIARTI…`. */
  identifiant: string;
  /** Date de début de cette version, quand la source la donne. */
  date_debut: string | null;
  /** Veille du début de la version qui l'a remplacée, sinon `null`. */
  date_fin: string | null;
};

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Date `AAAA-MM-JJ` portée par un CELEX de version consolidée
 * (`02016R0679-20180525`), ou `null` si l'identifiant n'en est pas une.
 */
export function dateDeConsolidation(celex: string): string | null {
  const trouve = /^0\d{4}[A-Z]\d+-(\d{4})(\d{2})(\d{2})$/.exec(celex);
  if (trouve === null) return null;
  const [, annee, mois, jour] = trouve;
  if (annee === undefined || mois === undefined || jour === undefined) return null;
  const date = new Date(Date.UTC(Number(annee), Number(mois) - 1, Number(jour)));
  if (
    date.getUTCFullYear() !== Number(annee) ||
    date.getUTCMonth() !== Number(mois) - 1 ||
    date.getUTCDate() !== Number(jour)
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** CELEX de base d'une version consolidée : `02016R0679-20180525` → `32016R0679`. */
export function celexDeBase(version: string): string | null {
  const tiret = version.indexOf("-");
  if (tiret < 0 || !version.startsWith("0")) return null;
  return `3${version.slice(1, tiret)}`;
}

/** Manifeste déjà écrit, ou `null` s'il est absent ou illisible. */
export function lireManifeste(chemin: string): Record<string, unknown> | null {
  if (!existsSync(chemin)) return null;
  try {
    const valeur: unknown = JSON.parse(readFileSync(chemin, "utf8"));
    return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
      ? (valeur as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Relit une liste d'historique ; toute entrée mal formée est écartée. */
export function lireHistorique(valeur: unknown): VersionRemplacee[] {
  if (!Array.isArray(valeur)) return [];
  const historique: VersionRemplacee[] = [];
  for (const element of valeur) {
    if (typeof element !== "object" || element === null) continue;
    const version = element as Partial<VersionRemplacee>;
    if (typeof version.identifiant !== "string" || version.identifiant === "") continue;
    historique.push({
      identifiant: version.identifiant,
      date_debut: typeof version.date_debut === "string" ? version.date_debut : null,
      date_fin: typeof version.date_fin === "string" ? version.date_fin : null,
    });
  }
  return historique;
}

/** Date `AAAA-MM-JJ` reculée d'un jour ; `null` si la date n'est pas exploitable. */
export function veilleDe(date: string | null): string | null {
  if (date === null || !DATE_ISO.test(date)) return null;
  const instant = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(instant)) return null;
  return new Date(instant - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Historique à écrire au manifeste : celui du précédent, augmenté de sa version
 * courante quand la nouvelle diffère. Rejouer la même version ne change rien.
 */
export function historiqueVersions(
  precedent: Record<string, unknown> | null,
  nouveau: { version: string; dateDebutVersion: string | null },
): VersionRemplacee[] {
  const historique = lireHistorique(precedent?.versions_remplacees);
  const ancienne = typeof precedent?.version === "string" ? precedent.version : "";
  if (ancienne === "" || ancienne === nouveau.version) return historique;
  if (historique.some((version) => version.identifiant === ancienne)) return historique;
  return [
    ...historique,
    {
      identifiant: ancienne,
      date_debut:
        typeof precedent?.date_debut_version === "string" ? precedent.date_debut_version : null,
      date_fin: veilleDe(nouveau.dateDebutVersion),
    },
  ];
}
