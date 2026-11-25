import { inventaireCorpus } from "../../mcp/corpus/sync-rapport.ts";
import { NOMS_SITE, CORPUS } from "../../mcp/corpus/registre.ts";

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
