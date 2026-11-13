import { inventaireCorpus } from "../../mcp/corpus/sync-rapport.ts";

/** Une collection du connecteur, telle que le site l'affiche. */
export type SourceCorpus = {
  /** Identifiant du dossier sous `data/corpus/`. */
  corpus: string;
  /** Libellé lisible ; l'identifiant quand le corpus est inconnu. */
  libelle: string;
  documents: number;
  /** Date d'arrêté de la collection ; `null` pour un texte consolidé sans date. */
  arrete_le: string | null;
};

/** Ordre fixe : textes, autorités, juridictions. */
const LIBELLES: ReadonlyArray<readonly [string, string]> = [
  ["rgpd", "RGPD"],
  ["aiact", "AI Act"],
  ["lil", "Loi Informatique et Libertés"],
  ["cnil", "CNIL"],
  ["cepd", "CEPD"],
  ["cjue", "CJUE"],
  ["ce", "Conseil d'État"],
  ["cc", "Cour de cassation"],
];

const RANG = new Map(LIBELLES.map(([corpus], index) => [corpus, index]));
const LIBELLE = new Map(LIBELLES);

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
      arrete_le: item.arrete_le,
    }))
    .sort(
      (gauche, droite) =>
        (RANG.get(gauche.corpus) ?? LIBELLES.length) - (RANG.get(droite.corpus) ?? LIBELLES.length) ||
        gauche.corpus.localeCompare(droite.corpus),
    );
}
