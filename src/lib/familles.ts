/**
 * Une couleur = une famille de source : la même partout (veille, accueil, façade).
 * La couleur ne porte jamais seule le sens : chaque famille a aussi son libellé.
 */
export type FamilleId = "textes" | "autorites" | "ue" | "juridictions" | "autre";

export type Famille = {
  id: FamilleId;
  /** Libellé lisible, porté par la légende. */
  libelle: string;
  /** Jetons de `global.css` : fond et texte contrasté (paire vérifiée par `tests/familles.test.ts`). */
  fond: string;
  texte: string;
  /** Classes Tailwind écrites en entier pour que le build les détecte. */
  classeFond: string;
  classeTexte: string;
};

export const FAMILLES: Readonly<Record<FamilleId, Famille>> = {
  textes: { id: "textes", libelle: "Textes", fond: "blue", texte: "paper", classeFond: "bg-blue", classeTexte: "text-paper" },
  autorites: {
    id: "autorites",
    libelle: "Autorités françaises",
    fond: "red",
    texte: "paper",
    classeFond: "bg-red",
    classeTexte: "text-paper",
  },
  ue: { id: "ue", libelle: "Union européenne", fond: "green", texte: "paper", classeFond: "bg-green", classeTexte: "text-paper" },
  juridictions: {
    id: "juridictions",
    libelle: "Juridictions françaises",
    fond: "yellow",
    texte: "ink",
    classeFond: "bg-yellow",
    classeTexte: "text-ink",
  },
  autre: { id: "autre", libelle: "Autres", fond: "concrete", texte: "ink", classeFond: "bg-concrete", classeTexte: "text-ink" },
};

/** Les quatre familles nommées par la légende, dans l'ordre d'affichage. */
export const FAMILLES_LEGENDE: readonly Famille[] = [FAMILLES.textes, FAMILLES.autorites, FAMILLES.ue, FAMILLES.juridictions];

/** Sources de veille (`data/entries/`) et corpus du connecteur (`data/corpus/`). */
const FAMILLE_DE_SOURCE: Readonly<Record<string, FamilleId>> = {
  rgpd: "textes",
  aiact: "textes",
  lil: "textes",
  cnil: "autorites",
  anssi: "autorites",
  arcep: "autorites",
  arcom: "autorites",
  cepd: "ue",
  cjue: "ue",
  cjeu: "ue",
  commission: "ue",
  "commission-dma": "ue",
  cetat: "juridictions",
  judilibre: "juridictions",
  ce: "juridictions",
  cc: "juridictions",
};

/** Famille d'une source de veille ou d'un corpus ; un identifiant inconnu rend `autre`. */
export function familleDeSource(id: string): Famille {
  return FAMILLES[FAMILLE_DE_SOURCE[id] ?? "autre"];
}
