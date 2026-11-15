/**
 * Délai entre la publication d'une nouveauté et son entrée au corpus.
 *
 * Trois dates par cas : la publication (`date_acte`), la détection par la veille
 * (`publishedAt` de la première entrée de `data/entries/` qui désigne le
 * document) et l'entrée au corpus (premier commit git qui ajoute la version de
 * la nouveauté, sinon l'unité, à défaut la date d'extraction du manifeste). Le
 * délai mesuré est celui de la publication à l'entrée au corpus ; les deux étapes
 * sont rendues séparément quand la détection est connue.
 *
 * Aucun chiffre n'est inventé : une date absente rend l'étape inconnue, et un
 * corpus sans cas mesurable est dit tel quel. Le calcul est en lecture seule sur
 * `data/` ; seule la commande écrit son rapport et le résumé de `coverage.md`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  corpusDeLEntree,
  documentsDeLEntree,
  indexerSnapshots,
  lireEntrees,
} from "./veille.ts";
import { dateValide, ecrireJsonAtomique } from "./lectures.ts";
import { inventaireCorpus, lireManifestes } from "./sync-rapport.ts";

/** Racine du dépôt, résolue depuis ce fichier et non depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("../..", import.meta.url));

/** Rapport daté des délais. */
export const CHEMIN_DELAIS = join("data", "corpus", "delais.json");

/** Résumé publié, dans le tableau de synthèse des corpus. */
export const CHEMIN_COUVERTURE = join(
  "aidd_docs",
  "tasks",
  "2026_11",
  "2026_11_11_corpus-cassation-cjue",
  "coverage.md",
);

/**
 * Sources dont `publishedAt` est la date de la passe de veille, donc la date de
 * détection. Les autres datent la publication de l'actualité : leur entrée ne
 * dit pas quand la veille l'a lue, et l'étape reste inconnue.
 */
export const SOURCES_DATE_PASSE: readonly string[] = [
  "eurlex",
  "legi",
  "constit",
  "cepd",
  "cnil_doctrine",
  "preparation",
];

/** Documents les plus récents mesurés par corpus, en plus des entrées de veille. */
export const ECHANTILLON = 3;

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const DEBUT_RESUME = "<!-- delais:start -->";
const FIN_RESUME = "<!-- delais:end -->";

/** Nombre de jours entiers entre deux dates `AAAA-MM-JJ`, `null` si l'une manque. */
export function joursEntre(debut: string | null, fin: string | null): number | null {
  if (debut === null || fin === null) return null;
  if (dateValide(debut) === null || dateValide(fin) === null) return null;
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000);
}

/** Un cas mesuré ou mesurable : trois dates, dont deux peuvent manquer. */
export type CasDelai = {
  corpus: string;
  document: string;
  /** Date de l'acte ou de la décision. */
  date_acte: string | null;
  /** Date de la première entrée de veille qui désigne ce document. */
  date_veille: string | null;
  /** Date d'entrée au corpus. */
  date_corpus: string | null;
  /** D'où vient `date_corpus` : le premier commit, ou le manifeste à défaut. */
  origine_corpus: "git" | "manifeste" | null;
  /** Vrai quand une entrée de veille a désigné le document (nouveauté détectée). */
  entree_veille: boolean;
};

/** Un cas rendu : le délai et ses deux étapes. */
export type ExempleDelai = CasDelai & {
  jours: number;
  /** Publication → détection ; `null` quand la veille ne date pas sa lecture. */
  jours_publication_veille: number | null;
  /** Détection → corpus ; `null` quand la détection est inconnue. */
  jours_veille_corpus: number | null;
};

/** Le délai d'un corpus : compte, médiane, maximum et exemples. */
export type DelaiCorpus = {
  corpus: string;
  cas_mesures: number;
  mediane_jours: number | null;
  max_jours: number | null;
  /** Le cas qui porte `max_jours`, jamais un autre : le tableau ne se contredit pas. */
  max_exemple: ExempleDelai | null;
  exemples: ExempleDelai[];
  /** Présent quand aucun cas n'est mesurable : la raison, jamais un chiffre. */
  sans_cas?: string;
};

/** Médiane d'une liste non vide, moyenne des deux valeurs centrales si le compte est pair. */
export function mediane(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null;
  const triees = [...valeurs].sort((gauche, droite) => gauche - droite);
  const milieu = Math.floor(triees.length / 2);
  if (triees.length % 2 === 1) return triees[milieu] ?? null;
  const bas = triees[milieu - 1];
  const haut = triees[milieu];
  return bas === undefined || haut === undefined ? null : (bas + haut) / 2;
}

function raisonSansCas(cas: readonly CasDelai[]): string {
  if (cas.length === 0) return "aucun document daté dans le corpus";
  if (cas.every((element) => element.date_corpus === null)) {
    return "aucune date d'entrée au corpus (ni commit, ni date d'extraction au manifeste)";
  }
  return "aucune date de publication pour les documents datés";
}

/**
 * Groupe les cas par corpus et calcule médiane et maximum sur les seuls cas où
 * la publication et l'entrée au corpus sont datées. Les exemples sont les trois
 * cas les plus récents ; un corpus sans cas mesurable porte sa raison.
 */
export function calculerDelais(
  cas: readonly CasDelai[],
  raisonAbsente?: string,
): DelaiCorpus[] {
  const parCorpus = new Map<string, CasDelai[]>();
  for (const element of cas) {
    const liste = parCorpus.get(element.corpus) ?? [];
    liste.push(element);
    parCorpus.set(element.corpus, liste);
  }
  return [...parCorpus.entries()]
    .sort(([gauche], [droite]) => gauche.localeCompare(droite))
    .map(([corpus, liste]) => {
      const mesures: ExempleDelai[] = [];
      for (const element of liste) {
        const jours = joursEntre(element.date_acte, element.date_corpus);
        if (jours === null) continue;
        mesures.push({
          ...element,
          jours,
          jours_publication_veille: joursEntre(element.date_acte, element.date_veille),
          jours_veille_corpus: joursEntre(element.date_veille, element.date_corpus),
        });
      }
      if (mesures.length === 0) {
        return {
          corpus,
          cas_mesures: 0,
          mediane_jours: null,
          max_jours: null,
          max_exemple: null,
          exemples: [],
          sans_cas:
            liste.length === 0 && raisonAbsente !== undefined
              ? raisonAbsente
              : raisonSansCas(liste),
        };
      }
      const exemples = [...mesures]
        .sort(
          (gauche, droite) =>
            (droite.date_acte ?? "").localeCompare(gauche.date_acte ?? "") ||
            gauche.document.localeCompare(droite.document),
        )
        .slice(0, 3);
      // Le maximum est porté par son propre exemple : la table ne peut pas
      // afficher un maximum que l'exemple contredit.
      const maxExemple = mesures.reduce((maximum, element) =>
        element.jours > maximum.jours ? element : maximum,
      );
      return {
        corpus,
        cas_mesures: mesures.length,
        mediane_jours: mediane(mesures.map((element) => element.jours)),
        max_jours: maxExemple.jours,
        max_exemple: maxExemple,
        exemples,
      };
    });
}

/** Retard de l'archive d'une source, quand son manifeste le déclare. */
export type RetardArchive = {
  corpus: string;
  derniere_decision: string;
  archive: string;
  /**
   * Retard déclaré au manifeste : dernière décision → date d'extraction du
   * corpus. Il est recopié, jamais recalculé ; à défaut, il est compté jusqu'à
   * la date de l'archive.
   */
  jours_declares: number | null;
  /** Dernière décision → date de l'archive. */
  jours_avant_archive: number;
  /** Date d'extraction du corpus, quand elle est datée. */
  extraction: string | null;
  /** Date de l'archive → extraction du corpus. */
  jours_archive_extraction: number | null;
};

/** Lit `couverture.retard_archive` des manifestes ; aucun chiffre n'est déduit. */
export function retardsArchive(
  manifestes: ReadonlyMap<string, Record<string, unknown>>,
): RetardArchive[] {
  const retards: RetardArchive[] = [];
  for (const [corpus, manifeste] of [...manifestes.entries()].sort(([gauche], [droite]) =>
    gauche.localeCompare(droite),
  )) {
    const couverture = manifeste.couverture;
    if (typeof couverture !== "object" || couverture === null) continue;
    const bloc = (couverture as { retard_archive?: unknown }).retard_archive;
    if (typeof bloc !== "object" || bloc === null) continue;
    const retard = bloc as { derniere_decision?: unknown; archive_date?: unknown; jours_au?: unknown };
    const derniere = dateValide(retard.derniere_decision);
    const archive = dateValide(retard.archive_date);
    if (derniere === null || archive === null) continue;
    const extraction = dateValide(manifeste.date_extraction);
    retards.push({
      corpus,
      derniere_decision: derniere,
      archive,
      jours_declares:
        typeof retard.jours_au === "number" && Number.isFinite(retard.jours_au)
          ? retard.jours_au
          : joursEntre(derniere, extraction ?? archive),
      jours_avant_archive: joursEntre(derniere, archive) ?? 0,
      extraction,
      jours_archive_extraction: joursEntre(archive, extraction),
    });
  }
  return retards;
}

/** Une unité lue pour la mesure : son document, sa première `ref` et sa date. */
type DocumentUnite = { document: string; ref: string; date_acte: string | null };

/**
 * Première unité de chaque document d'un corpus : sa `ref` sert à retrouver le
 * commit qui l'a ajoutée, sa `date_acte` à dater la publication.
 */
export function documentsDates(rootDir: string, corpus: string): DocumentUnite[] {
  const chemin = join(rootDir, "data", "corpus", corpus, "unites.jsonl");
  if (!existsSync(chemin)) return [];
  const documents = new Map<string, DocumentUnite>();
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    if (ligne.trim() === "") continue;
    try {
      const unite = JSON.parse(ligne) as {
        document?: unknown;
        ref?: unknown;
        date_acte?: unknown;
      };
      if (typeof unite.document !== "string" || unite.document === "") continue;
      if (typeof unite.ref !== "string" || unite.ref === "") continue;
      const connu = documents.get(unite.document);
      if (connu !== undefined) continue;
      documents.set(unite.document, {
        document: unite.document,
        ref: unite.ref,
        date_acte: dateValide(unite.date_acte),
      });
    } catch {
      // Une ligne illisible ne masque pas les documents des autres lignes.
    }
  }
  return [...documents.values()];
}

/**
 * Date du premier commit qui ajoute un repère (`ref` d'unité, version de
 * consolidation) dans le fichier des unités d'un corpus, lue par `git log -S`.
 * Lecture seule ; `null` sans git, sans historique ou quand le repère n'est pas
 * encore commité.
 */
export function datePremierCommit(rootDir: string, corpus: string, repere: string): string | null {
  if (repere === "") return null;
  try {
    const sortie = execFileSync(
      "git",
      [
        "log",
        "--reverse",
        "--format=%ad",
        "--date=short",
        `-S${repere}`,
        "--",
        join("data", "corpus", corpus, "unites.jsonl"),
      ],
      { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const premiere = sortie.split("\n").find((ligne) => ligne.trim() !== "");
    return dateValide(premiere?.trim());
  } catch {
    return null;
  }
}

export type OptionsDelais = {
  rootDir?: string;
  /** Date du rapport ; les tests la fixent. */
  aujourdHui?: string;
  /** Taille de l'échantillon par corpus ; les tests la fixent. */
  echantillon?: number;
};

export type RapportDelais = {
  version: 1;
  calcule_le: string;
  methode: {
    publication: string;
    veille: string;
    corpus: string;
    echantillon: string;
    jours: string;
  };
  /**
   * La chaîne complète : publication → détection par la veille → entrée au
   * corpus. Seuls ces cas mesurent la réactivité de la veille.
   */
  corpus: DelaiCorpus[];
  /**
   * Documents récents sans entrée de veille : publication → entrée au corpus,
   * c'est-à-dire la collecte initiale du corpus, pas une nouveauté détectée.
   */
  collecte_initiale: DelaiCorpus[];
  retards_archive: RetardArchive[];
};

/**
 * Réunit les cas du dépôt : toutes les entrées de veille qui désignent un
 * document, puis les documents les plus récents de chaque corpus. Un document
 * déjà vu par une entrée n'est pas compté deux fois.
 */
export function casDuDepot(rootDir: string, echantillon: number = ECHANTILLON): CasDelai[] {
  const snapshots = indexerSnapshots(rootDir);
  const manifestes = lireManifestes(rootDir);
  const extractions = new Map(
    inventaireCorpus(rootDir, manifestes).map((entree) => [entree.corpus, entree.arrete_le]),
  );
  const unites = new Map<string, DocumentUnite[]>();
  for (const corpus of manifestes.keys()) unites.set(corpus, documentsDates(rootDir, corpus));

  const cas: CasDelai[] = [];
  const vus = new Set<string>();
  // Repère cherché dans l'historique git : la version de la nouveauté quand
  // l'entrée la porte, sinon la première unité du document.
  const reperes = new Map<string, string[]>();
  const ajouter = (element: CasDelai, reperesPossibles: (string | undefined)[]): void => {
    const cle = `${element.corpus}:${element.document}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    cas.push(element);
    reperes.set(
      cle,
      reperesPossibles.filter((repere): repere is string => repere !== undefined && repere !== ""),
    );
  };

  for (const entry of lireEntrees(rootDir)) {
    const corpus = corpusDeLEntree(entry);
    if (corpus === null) continue;
    const sansPublication = documentsSansDatePubliee(manifestes.get(corpus));
    // Une page peut désigner plusieurs documents (une actualité CNIL cite les
    // décisions qu'elle commente) : chacun est un cas, et celui qu'aucune unité
    // ne porte n'est pas mesurable.
    const documents = unites.get(corpus) ?? [];
    for (const document of documentsDeLEntree(entry, snapshots)) {
      const unite = documents.find((element) => element.document === document);
      if (unite === undefined) continue;
      // Un document daté par l'extraction n'a pas de date de publication.
      if (sansPublication.has(document)) continue;
      // Une entrée de flux ne porte pas `date_acte` : la date de publication est
      // celle de l'unité qu'elle désigne, lue au corpus.
      const dateActe = dateValide(entry.date_acte) ?? unite.date_acte;
      const published =
        typeof entry.publishedAt === "string" ? dateValide(entry.publishedAt.slice(0, 10)) : null;
      ajouter(
        {
          corpus,
          document,
          date_acte: dateActe,
          date_veille: SOURCES_DATE_PASSE.includes(entry.source) ? published : null,
          date_corpus: null,
          origine_corpus: null,
          entree_veille: true,
        },
        [entry.version],
      );
    }
  }

  for (const corpus of [...manifestes.keys()].sort()) {
    // Un document dont la date est celle de l'extraction (doctrine CNIL) n'a pas
    // de date de publication : son délai mesurerait zéro par construction.
    const sansPublication = documentsSansDatePubliee(manifestes.get(corpus));
    const documents = (unites.get(corpus) ?? [])
      .filter((document) => document.date_acte !== null && !sansPublication.has(document.document))
      .sort(
        (gauche, droite) =>
          (droite.date_acte ?? "").localeCompare(gauche.date_acte ?? "") ||
          gauche.document.localeCompare(droite.document),
      )
      .slice(0, Math.max(0, echantillon));
    for (const document of documents) {
      ajouter(
        {
          corpus,
          document: document.document,
          date_acte: document.date_acte,
          date_veille: null,
          date_corpus: null,
          origine_corpus: null,
          entree_veille: false,
        },
        [],
      );
    }
  }

  // L'entrée au corpus ferme la mesure : premier commit qui ajoute le repère de
  // la nouveauté, puis celui de l'unité, à défaut la date d'arrêté du manifeste.
  const entreesCorpus = new Map<string, { date: string | null; origine: "git" | "manifeste" | null }>();
  for (const element of cas) {
    const cle = `${element.corpus}:${element.document}`;
    if (entreesCorpus.has(cle)) continue;
    const ref = (unites.get(element.corpus) ?? []).find(
      (document) => document.document === element.document,
    )?.ref;
    const reperesPossibles = [...(reperes.get(cle) ?? []), ...(ref === undefined ? [] : [ref])];
    let commit: string | null = null;
    for (const repere of reperesPossibles) {
      commit = datePremierCommit(rootDir, element.corpus, repere);
      if (commit !== null) break;
    }
    const secours = extractions.get(element.corpus) ?? null;
    entreesCorpus.set(cle, {
      date: commit ?? secours,
      origine: commit !== null ? "git" : secours === null ? null : "manifeste",
    });
  }
  return cas.map((element) => {
    const entree = entreesCorpus.get(`${element.corpus}:${element.document}`);
    return entree === undefined
      ? element
      : { ...element, date_corpus: entree.date, origine_corpus: entree.origine };
  });
}

/**
 * Documents d'un manifeste dont la date d'acte est celle de l'extraction : la
 * doctrine CNIL déclare `date_source: "extraction"` pour un document sans date
 * publiée. Leur délai de publication serait nul par construction.
 */
export function documentsSansDatePubliee(
  manifeste: Record<string, unknown> | undefined,
): Set<string> {
  const documents = new Set<string>();
  const parType = manifeste?.documents_par_type;
  if (typeof parType !== "object" || parType === null) return documents;
  for (const liste of Object.values(parType)) {
    if (!Array.isArray(liste)) continue;
    for (const element of liste) {
      if (typeof element !== "object" || element === null) continue;
      const document = element as { slug?: unknown; date_source?: unknown };
      if (typeof document.slug === "string" && document.date_source === "extraction") {
        documents.add(document.slug);
      }
    }
  }
  return documents;
}

/** Rapport complet : les cas mesurés et les retards d'archive déclarés. */
export function mesurerDelais(options: OptionsDelais = {}): RapportDelais {
  const rootDir = options.rootDir ?? RACINE;
  const aujourdHui = dateValide(options.aujourdHui) ?? new Date().toISOString().slice(0, 10);
  const manifestes = lireManifestes(rootDir);
  const cas = casDuDepot(rootDir, options.echantillon);
  const sansDetection = "aucune entrée de veille ne désigne un document de ce corpus";
  return {
    version: 1,
    calcule_le: aujourdHui,
    methode: {
      publication:
        "date_acte de l'entrée de veille, sinon de l'unité qu'elle désigne ; " +
        "les documents dont la date est celle de l'extraction (doctrine CNIL) sont écartés",
      veille:
        "publishedAt de la première entrée de data/entries qui désigne le document ; " +
        `null quand la source ne date pas sa lecture (${SOURCES_DATE_PASSE.join(", ")} le font)`,
      corpus:
        "premier commit git qui ajoute la version de la nouveauté, sinon l'unité " +
        "(git log -S), à défaut la date d'arrêté du manifeste",
      echantillon: `${options.echantillon ?? ECHANTILLON} document(s) le(s) plus récent(s) par corpus, plus toutes les entrées de veille qui désignent un document`,
      jours: "date d'entrée au corpus moins date de publication, en jours",
    },
    corpus: calculerDelais(
      cas.filter((element) => element.entree_veille),
      sansDetection,
    ),
    collecte_initiale: calculerDelais(
      cas.filter((element) => !element.entree_veille),
      sansDetection,
    ),
    retards_archive: retardsArchive(manifestes),
  };
}

/** Tableau publié dans `coverage.md` : un chiffre par corpus, jamais un chiffre inventé. */
export function resumerDelais(rapport: RapportDelais): string {
  const lignes = [
    DEBUT_RESUME,
    "## Délais publication → corpus",
    "",
    `Mesure du ${rapport.calcule_le} par \`npm run veille:delais\` (rapport daté : \`data/corpus/delais.json\`). ` +
      "Délai = date d'entrée au corpus moins `date_acte` ; la détection par la veille est rendue à part quand la source date sa lecture. " +
      "Aucun chiffre n'est déduit : un corpus sans cas mesurable le dit. " +
      "Un cas dont la publication précède la mise en route de la veille mesure ce démarrage, pas sa réactivité à l'état stable.",
    "",
    "Cas détectés par la veille — publication, détection, entrée au corpus. La détection n'est datée que par les sources qui datent leur passe ; sinon l'étape publication → veille n'est pas chiffrée.",
    "",
    "| Corpus | Cas mesurés | Médiane (jours) | Maximum (jours) | Exemple le plus long |",
    "|---|---:|---:|---:|---|",
  ];
  for (const delai of rapport.corpus) {
    if (delai.cas_mesures === 0) {
      lignes.push(`| \`${delai.corpus}\` | 0 | — | — | ${delai.sans_cas ?? "aucun cas mesurable"} |`);
      continue;
    }
    lignes.push(
      `| \`${delai.corpus}\` | ${delai.cas_mesures} | ${delai.mediane_jours ?? "—"} | ${delai.max_jours ?? "—"} | ${exempleLePlusLong(delai)} |`,
    );
  }
  if (rapport.collecte_initiale.length > 0) {
    lignes.push(
      "",
      "Collecte initiale — documents récents qu'aucune entrée de veille ne désigne, publication → entrée au corpus. " +
        "Ce n'est pas le délai d'une nouveauté : le corpus les a lus en une passe.",
      "",
      "| Corpus | Documents | Médiane (jours) | Maximum (jours) | Document le plus long |",
      "|---|---:|---:|---:|---|",
    );
    for (const delai of rapport.collecte_initiale) {
      if (delai.cas_mesures === 0) {
        lignes.push(`| \`${delai.corpus}\` | 0 | — | — | ${delai.sans_cas ?? "aucun cas mesurable"} |`);
        continue;
      }
      lignes.push(
        `| \`${delai.corpus}\` | ${delai.cas_mesures} | ${delai.mediane_jours ?? "—"} | ${delai.max_jours ?? "—"} | ${exempleLePlusLong(delai, false)} |`,
      );
    }
  }
  if (rapport.retards_archive.length > 0) {
    lignes.push("", "Retards d'archive déclarés par les manifestes :", "");
    for (const retard of rapport.retards_archive) {
      lignes.push(
        `- \`${retard.corpus}\` : dernière décision du ${retard.derniere_decision}, archive du ${retard.archive}, ` +
          `soit ${retard.jours_avant_archive} jours jusqu'à l'archive` +
          (retard.jours_declares === null ? "" : ` et ${retard.jours_declares} jours jusqu'à l'extraction`) +
          (retard.jours_archive_extraction === null
            ? ""
            : ` (${retard.jours_archive_extraction} jours de plus entre l'archive et l'extraction du ${retard.extraction})`) +
          ".",
      );
    }
  }
  lignes.push(FIN_RESUME);
  return lignes.join("\n");
}

/** L'exemple au plus long délai d'un corpus, avec ses deux étapes quand elles sont datées. */
function exempleLePlusLong(delai: DelaiCorpus, avecDetection = true): string {
  const plusLong = delai.max_exemple;
  if (plusLong === null) return "—";
  if (!avecDetection) return `${plusLong.document} : ${plusLong.jours} jours`;
  return (
    `${plusLong.document} : ${plusLong.jours} jours` +
    (plusLong.jours_publication_veille === null
      ? " (détection par la veille non datée)"
      : ` (publication → veille ${plusLong.jours_publication_veille} j, veille → corpus ${plusLong.jours_veille_corpus ?? "?"} j)`)
  );
}

/** Remplace le résumé existant, ou l'ajoute à la fin du document. */
export function ecrireResume(chemin: string, resume: string): boolean {
  let texte: string;
  try {
    texte = readFileSync(chemin, "utf8");
  } catch {
    throw new Error(`Tableau de couverture introuvable : ${chemin}`);
  }
  const debut = texte.indexOf(DEBUT_RESUME);
  const fin = texte.indexOf(FIN_RESUME);
  const suivant =
    debut >= 0 && fin > debut
      ? `${texte.slice(0, debut)}${resume}${texte.slice(fin + FIN_RESUME.length)}`
      : `${texte.trimEnd()}\n\n${resume}\n`;
  if (suivant === texte) return false;
  writeFileSync(chemin, suivant, "utf8");
  return true;
}

function phrase(delai: DelaiCorpus): string {
  if (delai.cas_mesures === 0) {
    return `${delai.corpus} : aucun cas mesurable — ${delai.sans_cas ?? "raison inconnue"}`;
  }
  return (
    `${delai.corpus} : ${delai.cas_mesures} cas, médiane ${delai.mediane_jours ?? "—"} jour(s), ` +
    `maximum ${delai.max_jours ?? "—"} jour(s)`
  );
}

async function main(argv: string[]): Promise<void> {
  const racineIndex = argv.indexOf("--root");
  const rootDir = racineIndex >= 0 ? (argv[racineIndex + 1] ?? RACINE) : RACINE;
  const dateIndex = argv.indexOf("--date");
  const date = dateIndex >= 0 ? dateValide(argv[dateIndex + 1]) : null;
  if (dateIndex >= 0 && date === null) {
    throw new Error(`Date de rapport attendue AAAA-MM-JJ ; reçu « ${argv[dateIndex + 1] ?? ""} »`);
  }
  const dryRun = argv.includes("--dry-run");
  const rapport = mesurerDelais({
    rootDir,
    ...(date === null ? {} : { aujourdHui: date }),
  });

  process.stdout.write(`Délais publication → corpus, mesurés le ${rapport.calcule_le}\n`);
  process.stdout.write("Cas détectés par la veille :\n");
  if (rapport.corpus.length === 0) process.stdout.write("  aucun cas mesurable\n");
  for (const delai of rapport.corpus) process.stdout.write(`${phrase(delai)}\n`);
  if (rapport.collecte_initiale.length > 0) {
    process.stdout.write("Collecte initiale (hors veille) :\n");
    for (const delai of rapport.collecte_initiale) process.stdout.write(`${phrase(delai)}\n`);
  }
  for (const retard of rapport.retards_archive) {
    process.stdout.write(
      `retard d'archive ${retard.corpus} : ${retard.jours_declares ?? retard.jours_avant_archive} jour(s) ` +
        `(dernière décision ${retard.derniere_decision}, archive ${retard.archive})\n`,
    );
  }

  if (dryRun) {
    process.stdout.write("dry-run : ni rapport ni résumé écrits\n");
    return;
  }
  if (ecrireJsonAtomique(join(rootDir, CHEMIN_DELAIS), rapport)) {
    process.stdout.write(`rapport : ${CHEMIN_DELAIS}\n`);
  }
  const cheminResume = join(rootDir, CHEMIN_COUVERTURE);
  if (ecrireResume(cheminResume, resumerDelais(rapport))) {
    process.stdout.write(`résumé : ${CHEMIN_COUVERTURE}\n`);
  }
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
