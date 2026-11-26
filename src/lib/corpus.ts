import { inventaireCorpus } from "../../mcp/corpus/sync-rapport.ts";
import { NOMS_SITE, CORPUS } from "../../mcp/corpus/registre.ts";
import { familleDeSource, type FamilleId } from "./familles.ts";

/** Une collection du connecteur, telle que le site l'affiche. */
export type SourceCorpus = {
  /** Identifiant du dossier sous `data/corpus/`. */
  corpus: string;
  /** Libellé lisible ; l'identifiant quand le corpus est inconnu. */
  libelle: string;
  documents: number;
  /** Unités indexées : articles, considérants ou fragments. */
  unites: number;
  /** Date d'arrêté de la collection ; `null` pour un texte consolidé sans date. */
  arrete_le: string | null;
};

/** Ordre et libellés du registre : textes, autorités, juridictions. */
const RANG = new Map<string, number>(NOMS_SITE.map((nom, index) => [nom, index]));
const LIBELLE = new Map<string, string>(CORPUS.map((corpus) => [corpus.nom, corpus.libelle]));

/**
 * Les collections présentes sous `data/corpus/`, lues par `inventaireCorpus` :
 * la même règle de date et de compte que l'outil `etat_corpus`. Aucun réseau.
 * Un corpus inconnu garde son identifiant et passe après les connus.
 */
export function sourcesCorpus(rootDir: string = process.cwd()): SourceCorpus[] {
  return inventaireCorpus(rootDir)
    .map((item) => ({
      corpus: item.corpus,
      libelle: LIBELLE.get(item.corpus) ?? item.corpus,
      documents: item.documents,
      unites: item.unites,
      arrete_le: item.arrete_le,
    }))
    .sort(
      (gauche, droite) =>
        (RANG.get(gauche.corpus) ?? NOMS_SITE.length) -
          (RANG.get(droite.corpus) ?? NOMS_SITE.length) ||
        gauche.corpus.localeCompare(droite.corpus),
    );
}

/** Une famille nommée et ses collections, dans l'ordre d'affichage du connecteur. */
export type FamilleResume = {
  famille: FamilleId;
  collections: SourceCorpus[];
  documents: number;
  passages: number;
};

/** Les chiffres de la page du connecteur, tous calculés au build. */
export type ResumeCorpus = {
  collections: number;
  documents: number;
  /** Unités indexées, tous corpus confondus. */
  passages: number;
  /** Date d'arrêté la plus récente, `null` quand aucune collection n'en porte. */
  derniereMiseAJour: string | null;
  /** Familles nommées seulement, dans l'ordre `FAMILLES_RESUME` ; une famille vide est omise. */
  familles: FamilleResume[];
};

/** Les quatre familles nommées, dans l'ordre d'affichage ; `autre` n'en fait pas partie. */
export const FAMILLES_RESUME: readonly FamilleId[] = ["textes", "autorites", "ue", "juridictions"];

function somme(sources: SourceCorpus[], valeur: (source: SourceCorpus) => number): number {
  return sources.reduce((total, source) => total + valeur(source), 0);
}

/** Les dates d'arrêté sont ISO : l'horodatage les ordonne sans dépendre du fuseau. */
function derniereDate(sources: SourceCorpus[]): string | null {
  let derniere: string | null = null;
  for (const source of sources) {
    const date = source.arrete_le;
    if (date === null) continue;
    if (derniere === null || Date.parse(date) > Date.parse(derniere)) derniere = date;
  }
  return derniere;
}

/**
 * Résume une liste de collections : totaux, dernière mise à jour et familles nommées
 * non vides. La famille `autre` (métadonnées du guichet unique) compte dans les totaux
 * mais ne forme pas de rangée : elle n'a pas de couleur de famille.
 */
export function resumeCorpus(sources: SourceCorpus[]): ResumeCorpus {
  const familles = FAMILLES_RESUME.map((famille) => {
    const collections = sources.filter((source) => familleDeSource(source.corpus).id === famille);
    return {
      famille,
      collections,
      documents: somme(collections, (source) => source.documents),
      passages: somme(collections, (source) => source.unites),
    };
  }).filter((famille) => famille.collections.length > 0);

  return {
    collections: sources.length,
    documents: somme(sources, (source) => source.documents),
    passages: somme(sources, (source) => source.unites),
    derniereMiseAJour: derniereDate(sources),
    familles,
  };
}

/** Étages les plus hauts d'une colonne de la façade ; la plus basse en a un. */
export const ETAGES_MAX = 5;

/**
 * Hauteur d'une colonne de la façade du corpus : `ceil(log10(unités))`, bornée à [1, 5].
 * L'échelle log garde les textes (quelques centaines d'unités) visibles face aux fragments CNIL.
 */
export function etagesFacade(unites: number): number {
  if (!(unites > 1)) return 1;
  return Math.min(ETAGES_MAX, Math.ceil(Math.log10(unites)));
}
