/**
 * Classement des documents cités par les décisions et absents du corpus.
 *
 * Le calcul se fait à la synchronisation, une seule fois par passe : le coût est
 * celui de l'extraction des citations, déjà payé par la lecture du corpus. Le
 * bloc qui en sort vit dans `data/corpus/sync.json` ; `etat_corpus` le lit, il ne
 * recalcule jamais. Aucune écriture ici, aucun index, aucun réseau.
 *
 * L'unité comptée est la citation rendue (décision × instrument), le même
 * dénominateur que la mesure des citations. Un document hors corpus ne porte
 * aucun texte ni résumé : le classement ne rend que son identifiant, son
 * libellé, son lien, son statut et les autorités qui le citent.
 */

import {
  CORPUS_DECISIONS,
  citationsDuCorpus,
  documentDeclare,
  documentsExclus,
  documentsPresents,
  normaliserIdentifiant,
} from "./citations.ts";
import type { Citation } from "./citations.ts";

/** Citations d'une autorité citante, pour un document hors corpus. */
export type AutoriteCitations = { autorite: string; citations: number };

/**
 * Un document cité et absent du corpus, ou déclaré hors du périmètre au
 * catalogue (`exclu`). Jamais de texte ni de résumé : un rang d'ajout, pas un
 * contenu.
 */
export type DocumentHorsCorpus = {
  document: string;
  instrument: string;
  url: string | null;
  statut: "absent" | "exclu";
  citations: number;
  autorites: AutoriteCitations[];
};

/** Le classement tel qu'il est écrit dans `data/corpus/sync.json`. */
export type ClassementHorsCorpus = { calcule_le: string; documents: DocumentHorsCorpus[] };

/** Citations déjà extraites, corpus par corpus, pour le calcul pur. */
export type CitationsParCorpus = readonly {
  corpus: string;
  citations: ReadonlyMap<string, readonly Citation[]>;
}[];

/**
 * Libellé humain d'une autorité citante : `etat_corpus` s'adresse à un juriste,
 * les identifiants de corpus restent ceux de l'inventaire.
 */
const AUTORITES: Readonly<Record<string, string>> = {
  cnil: "CNIL",
  ce: "Conseil d'État",
  cc: "Cour de cassation",
  cjue: "CJUE",
  cepd: "CEPD",
};

/** Libellé d'une autorité ; un corpus inconnu garde son identifiant. */
function autoriteDe(corpus: string): string {
  return AUTORITES[corpus] ?? corpus;
}

/** Autorités citantes triées par compte décroissant, puis par libellé. */
function trierAutorites(comptes: ReadonlyMap<string, number>): AutoriteCitations[] {
  return [...comptes.entries()]
    .map(([autorite, citations]) => ({ autorite, citations }))
    .sort(
      (gauche, droite) =>
        droite.citations - gauche.citations || gauche.autorite.localeCompare(droite.autorite),
    );
}

/**
 * Classement pur : compte chaque citation rendue par document normalisé, écarte
 * les documents présents, marque `exclu` ceux que le catalogue déclare hors
 * périmètre, puis trie par citations décroissantes et identifiant croissant. Le
 * libellé et le lien viennent du catalogue, jamais de la décision citante.
 */
export function classerCitations(
  citationsParCorpus: CitationsParCorpus,
  presents: ReadonlySet<string>,
  exclusions: ReadonlySet<string>,
): DocumentHorsCorpus[] {
  const parDocument = new Map<string, Map<string, number>>();
  const citationsParDocument = new Map<string, number>();

  for (const { corpus, citations } of citationsParCorpus) {
    const autorite = autoriteDe(corpus);
    for (const citationsDuDocument of citations.values()) {
      for (const citation of citationsDuDocument) {
        const document = normaliserIdentifiant(citation.document);
        if (presents.has(document)) continue;
        citationsParDocument.set(document, (citationsParDocument.get(document) ?? 0) + 1);
        const comptes = parDocument.get(document) ?? new Map<string, number>();
        comptes.set(autorite, (comptes.get(autorite) ?? 0) + 1);
        parDocument.set(document, comptes);
      }
    }
  }

  return [...citationsParDocument.entries()]
    .map(([document, citations]) => {
      const declare = documentDeclare(document);
      return {
        document,
        instrument: declare?.libelle ?? document,
        url: declare?.url ?? null,
        statut: exclusions.has(document) ? ("exclu" as const) : ("absent" as const),
        citations,
        autorites: trierAutorites(parDocument.get(document) ?? new Map<string, number>()),
      };
    })
    .sort(
      (gauche, droite) =>
        droite.citations - gauche.citations || gauche.document.localeCompare(droite.document),
    );
}

/** Citations d'un corpus de décisions ; un corpus illisible n'en donne aucune. */
function citationsLisibles(
  rootDir: string,
  corpus: string,
): ReadonlyMap<string, readonly Citation[]> {
  try {
    return citationsDuCorpus(rootDir, corpus);
  } catch {
    // Un corpus illisible ne fait pas échouer la passe : il ne cite rien.
    return new Map();
  }
}

/**
 * Le classement des cinq corpus de décisions, daté. Un corpus sans fichier
 * lisible est ignoré ; la présence et les exclusions se lisent aux manifestes et
 * au catalogue, comme pour les citations.
 */
export function classementHorsCorpus(rootDir: string, date: string): ClassementHorsCorpus {
  const citations: CitationsParCorpus = CORPUS_DECISIONS.map((corpus) => ({
    corpus,
    citations: citationsLisibles(rootDir, corpus),
  }));
  return {
    calcule_le: date,
    documents: classerCitations(citations, documentsPresents(rootDir), documentsExclus()),
  };
}
