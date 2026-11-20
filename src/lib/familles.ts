/**
 * Une couleur = une famille de source : la même partout (veille, accueil, façade).
 * La couleur ne porte jamais seule le sens : chaque famille a aussi son libellé.
 */
export type FamilleId = "textes" | "autorites" | "ue" | "juridictions" | "autre";

export type Famille = {
  id: FamilleId;
  /** Libellé lisible, porté par la légende. */
  libelle: string;
  /** Jeton de `global.css` de la pastille, non textuelle (3:1 vérifié par `tests/familles.test.ts`). */
  pastille: string;
  /**
   * Anciens jetons texte sur aplat, encore lus par la veille (retirés en phase 4).
   * `fond` contraste avec les quatre pastilles dans les deux thèmes ; `encre` sur `filet`.
   */
  fond: string;
  texte: string;
  /** Classes Tailwind écrites en entier pour que le build les détecte. */
  classePastille: string;
  classeFond: string;
  classeTexte: string;
};

export const FAMILLES: Readonly<Record<FamilleId, Famille>> = {
  textes: {
    id: "textes",
    libelle: "Textes",
    pastille: "textes",
    fond: "textes",
    texte: "fond",
    classePastille: "bg-textes",
    classeFond: "bg-textes",
    classeTexte: "text-fond",
  },
  autorites: {
    id: "autorites",
    libelle: "Autorités françaises",
    pastille: "autorites",
    fond: "autorites",
    texte: "fond",
    classePastille: "bg-autorites",
    classeFond: "bg-autorites",
    classeTexte: "text-fond",
  },
  ue: {
    id: "ue",
    libelle: "Union européenne",
    pastille: "ue",
    fond: "ue",
    texte: "fond",
    classePastille: "bg-ue",
    classeFond: "bg-ue",
    classeTexte: "text-fond",
  },
  juridictions: {
    id: "juridictions",
    libelle: "Juridictions françaises",
    pastille: "juridictions",
    fond: "juridictions",
    texte: "fond",
    classePastille: "bg-juridictions",
    classeFond: "bg-juridictions",
    classeTexte: "text-fond",
  },
  autre: {
    id: "autre",
    libelle: "Autres",
    pastille: "filet",
    fond: "filet",
    texte: "encre",
    classePastille: "bg-filet",
    classeFond: "bg-filet",
    classeTexte: "text-encre",
  },
};

/** Les quatre familles nommées par la légende, dans l'ordre d'affichage. */
export const FAMILLES_LEGENDE: readonly Famille[] = [FAMILLES.textes, FAMILLES.autorites, FAMILLES.ue, FAMILLES.juridictions];

/** Sources de veille (`data/entries/`) et corpus du connecteur (`data/corpus/`). */
const FAMILLE_DE_SOURCE: Readonly<Record<string, FamilleId>> = {
  rgpd: "textes",
  aiact: "textes",
  eprivacy: "textes",
  police: "textes",
  eudpr: "textes",
  rgpdproc: "textes",
  ccs: "textes",
  lil: "textes",
  textes_fr: "textes",
  preparation: "ue",
  adequation: "ue",
  cnil: "autorites",
  cnil_doctrine: "autorites",
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
  constit: "juridictions",
  cc: "juridictions",
  metadonnees: "autre",
  legi: "textes",
  eurlex: "ue",
};

/** Famille d'une source de veille ou d'un corpus ; un identifiant inconnu rend `autre`. */
export function familleDeSource(id: string): Famille {
  return FAMILLES[FAMILLE_DE_SOURCE[id] ?? "autre"];
}
