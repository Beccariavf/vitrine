import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { normaliser } from "../mcp/embed/embedder.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { buildIndex } from "../mcp/index/build.ts";
import { openIndex } from "../mcp/index/search.ts";
import type { Index, ResultatRecherche } from "../mcp/index/search.ts";
import { PLACES_TEXTE, reserverPlacesTexte, search, viseJurisprudence } from "../mcp/tools.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const DOCUMENT = "32016R0679";
const DOCUMENT_AIA = "32024R1689";
const DECISION = "CNILTEXT000000000001";

function passage(
  ref: string,
  corpus: string,
  distance: number,
  niveau = "article",
): ResultatRecherche {
  return {
    ref,
    document: ref.split("#")[0] ?? ref,
    corpus,
    niveau,
    numero: "",
    texte: ref,
    chemin: "",
    url: "",
    date_acte: "",
    date_debut: "",
    date_fin: null,
    statut: "",
    distance,
  };
}

const decision = (rang: number): ResultatRecherche =>
  passage(`${DECISION}#f${rang}`, "cnil", 0.1 + rang / 100, "fragment");
const regle = (rang: number, corpus = "rgpd"): ResultatRecherche =>
  passage(`${DOCUMENT}#art_${rang}`, corpus, 0.3 + rang / 100);

describe("la réserve de places pour les textes", () => {
  it("réserve deux places quand aucun texte n'est classé", () => {
    const ordre = [1, 2, 3, 4, 5].map(decision);
    const resultat = reserverPlacesTexte(ordre, [regle(5), regle(17)], 5);

    assert.deepEqual(
      resultat.map((entree) => entree.ref),
      [`${DECISION}#f1`, `${DECISION}#f2`, `${DECISION}#f3`, `${DOCUMENT}#art_5`, `${DOCUMENT}#art_17`],
    );
    assert.equal(resultat[0]?.place_reservee, undefined);
    assert.equal(resultat[2]?.place_reservee, undefined);
    assert.equal(resultat[3]?.place_reservee, "texte");
    assert.equal(resultat[4]?.place_reservee, "texte");
  });

  it("ne réserve qu'une place quand un texte est déjà classé", () => {
    const ordre = [decision(1), decision(2), decision(3), decision(4), regle(17)];
    const resultat = reserverPlacesTexte(ordre, [regle(5)], 5);

    assert.deepEqual(
      resultat.map((entree) => entree.ref),
      [`${DECISION}#f1`, `${DECISION}#f2`, `${DECISION}#f3`, `${DOCUMENT}#art_17`, `${DOCUMENT}#art_5`],
    );
    assert.equal(resultat[3]?.place_reservee, undefined, "un texte déjà classé n'est pas marqué");
    assert.equal(resultat[4]?.place_reservee, "texte");
  });

  it("ne touche à rien quand deux textes sont déjà classés", () => {
    const ordre = [decision(1), decision(2), decision(3), regle(17), regle(5)];
    const resultat = reserverPlacesTexte(ordre, [regle(4)], 5);

    assert.deepEqual(resultat, ordre);
    assert.equal(resultat.some((entree) => entree.place_reservee !== undefined), false);
  });

  it("n'applique aucun quota pour k < 3", () => {
    const ordre = [decision(1), decision(2)];
    assert.deepEqual(reserverPlacesTexte(ordre, [regle(17)], 2), ordre);
  });

  it("ne remplace jamais le rang 1", () => {
    const ordre = [decision(1), decision(2), decision(3)];
    const resultat = reserverPlacesTexte(ordre, [regle(17), regle(5)], 3);

    assert.equal(resultat[0]?.ref, `${DECISION}#f1`);
    assert.deepEqual(
      resultat.map((entree) => entree.ref),
      [`${DECISION}#f1`, `${DOCUMENT}#art_5`, `${DOCUMENT}#art_17`],
    );
  });

  it("n'insère pas de doublon de ref et ignore un considérant", () => {
    const ordre = [decision(1), decision(2), regle(17)];
    const candidats = [
      regle(17),
      passage(`${DOCUMENT}#rct_65`, "rgpd", 0.01, "considérant"),
      regle(5),
    ];
    const resultat = reserverPlacesTexte(ordre, candidats, 5);

    assert.deepEqual(
      resultat.map((entree) => entree.ref),
      [`${DECISION}#f1`, `${DECISION}#f2`, `${DOCUMENT}#art_17`, `${DOCUMENT}#art_5`],
    );
    assert.equal(resultat.filter((entree) => entree.ref === `${DOCUMENT}#art_17`).length, 1);
  });

  it("place les passages réservés en fin de liste, par similarité décroissante", () => {
    const ordre = [decision(1), decision(2), decision(3), decision(4), decision(5)];
    const resultat = reserverPlacesTexte(ordre, [regle(5, "rgpd"), regle(17, "rgpd")], 5);

    assert.deepEqual(
      resultat.slice(3).map((entree) => entree.ref),
      [`${DOCUMENT}#art_5`, `${DOCUMENT}#art_17`],
    );
  });

  it("ne retire pas un texte pour faire de la place", () => {
    const ordre = [decision(1), decision(2), decision(3), regle(17)];
    const resultat = reserverPlacesTexte(ordre, [regle(5)], 4);

    assert.deepEqual(
      resultat.map((entree) => entree.ref),
      [`${DECISION}#f1`, `${DECISION}#f2`, `${DOCUMENT}#art_17`, `${DOCUMENT}#art_5`],
    );
    assert.equal(resultat[2]?.place_reservee, undefined);
    assert.equal(resultat[3]?.place_reservee, "texte");
  });

  it("exporte la constante de deux places", () => {
    assert.equal(PLACES_TEXTE, 2);
  });
});

describe("viseJurisprudence", () => {
  const positifs = [
    "Qu'a jugé la CJUE sur le droit à l'effacement ?",
    "La Cour de justice a-t-elle validé ce transfert ?",
    "Le Tribunal de l'Union a rendu une ordonnance.",
    "Le Conseil d'État a annulé la sanction.",
    "La Cour de cassation a jugé que le visa manquait.",
    "Le Conseil constitutionnel a censuré cette disposition.",
    "La CEDH condamne la surveillance de masse.",
    "Quel est l'avis de la CADA sur ce document ?",
    "Quelle jurisprudence s'applique aux transferts ?",
    "La CNIL a prononcé une sanction contre la société.",
    "Que dit la délibération SAN-2026-015 ?",
    "L'affaire C-311/18 a posé le principe.",
    "L'arrêt ECLI:EU:C:2020:559 fait référence.",
    "Un pourvoi a été formé contre cette décision.",
    "La décision n° 2024-123 a été rendue.",
  ];

  const negatifs = [
    "article 9 du RGPD",
    "données de santé",
    "Quelles sanctions prévoit le RGPD en cas de violation ?",
    "Quel est le rôle du délégué à la protection des données ?",
    "Comment obtenir l'effacement d'un contenu ?",
    "Quelles règles pour un transfert hors Union européenne ?",
    "La CNIL publie des recommandations sur les cookies.",
    "Qu'est-ce qu'une décision automatisée ?",
    "Une décision n'était pas entièrement automatisée.",
    "Un arrêt de travail peut-il dépasser trois jours ?",
    "Le règlement général sur la protection des données s'applique-t-il ?",
    "Comment notifier une violation de données ?",
    "Quelles obligations pour l'IA à haut risque ?",
  ];

  for (const question of positifs) {
    it(`reconnaît une question qui vise une juridiction : « ${question} »`, () => {
      assert.equal(viseJurisprudence(question), true);
    });
  }

  for (const question of negatifs) {
    it(`laisse la règle à une question de fond : « ${question} »`, () => {
      assert.equal(viseJurisprudence(question), false);
    });
  }
});

/** Un vecteur de 8 dimensions : la première porte la question, la seconde le rang. */
function vecteurDe(texte: string): number[] {
  const valeurs = new Array<number>(8).fill(0);
  valeurs[0] = 1;
  const decision = /^decision (\d+)$/.exec(texte);
  if (decision !== null) valeurs[1] = Number(decision[1]) * 0.01;
  if (texte === "regle une") valeurs[1] = 0.3;
  if (texte === "regle deux") valeurs[1] = 0.4;
  if (texte === "eclairage") valeurs[1] = 0.6;
  return normaliser(valeurs);
}

/** Embedder hors ligne : le texte de l'unité choisit son vecteur, la question aussi. */
function embedderTexte(): Embedder {
  const vecteur = (entree: string): number[] => vecteurDe(entree.split("\n").at(-1) ?? entree);
  return {
    model: "factice",
    dim: 8,
    embedPassages: async (textes) => textes.map(vecteur),
    embedQuery: async (texte) => vecteur(texte),
  };
}

function uniteQuota(
  ref: string,
  corpus: string,
  document: string,
  texte: string,
  niveau: Unite["niveau"],
  numero = "1",
): Unite {
  return {
    ref,
    document,
    corpus,
    niveau,
    numero,
    chemin: "test",
    texte,
    date_acte: "2026-01-01",
    date_debut: "2026-01-01",
    date_fin: null,
    statut: "VIGUEUR",
    url: `https://exemple.test/${ref}`,
  };
}

function ecrireCorpus(root: string, corpus: string, unites: Unite[]): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(
    join(dossier, "unites.jsonl"),
    `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    "utf8",
  );
}

type Montage = { root: string; index: Index; fermer: () => void };

async function monter(decisions: number, avecAiact = false): Promise<Montage> {
  const root = mkdtempSync(join(tmpdir(), "vitrine-quota-"));
  ecrireCorpus(root, "rgpd", [
    uniteQuota(`${DOCUMENT}#art_17`, "rgpd", DOCUMENT, "regle une", "article"),
    uniteQuota(`${DOCUMENT}#art_5`, "rgpd", DOCUMENT, "regle deux", "article"),
    uniteQuota(`${DOCUMENT}#rct_65`, "rgpd", DOCUMENT, "eclairage", "considérant"),
  ]);
  if (avecAiact) {
    ecrireCorpus(root, "aiact", [
      uniteQuota(`${DOCUMENT_AIA}#art_1`, "aiact", DOCUMENT_AIA, "regle une", "article"),
    ]);
  }
  ecrireCorpus(
    root,
    "cnil",
    Array.from({ length: decisions }, (_, position) =>
      uniteQuota(
        `${DECISION}#f${position + 1}`,
        "cnil",
        DECISION,
        `decision ${position + 1}`,
        "fragment",
        "SAN-2026-015",
      ),
    ),
  );
  const construit = await buildIndex(root, embedderTexte());
  const index = openIndex(construit.chemin);
  return {
    root,
    index,
    fermer: () => {
      index.db.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

describe("le quota de textes dans la recherche", () => {
  const embedder = embedderTexte();

  async function surMontage(
    decisions: number,
    essai: (montage: Montage) => Promise<void>,
    avecAiact = false,
  ): Promise<void> {
    const montage = await monter(decisions, avecAiact);
    try {
      await essai(montage);
    } finally {
      montage.fermer();
    }
  }

  it("réserve deux textes quand cinq décisions occupent le top", async () => {
    await surMontage(5, async ({ root, index }) => {
      const resultat = await search(root, { question: "question" }, { embedder, index });
      const refs = resultat.passages.map((entree) => entree.ref);

      assert.deepEqual(refs, [
        `${DECISION}#f1`,
        `${DECISION}#f2`,
        `${DECISION}#f3`,
        `${DOCUMENT}#art_17`,
        `${DOCUMENT}#art_5`,
      ]);
      assert.deepEqual(
        resultat.passages.map((entree) => entree.place_reservee),
        [undefined, undefined, undefined, "texte", "texte"],
      );
      assert.equal(resultat.passages[3]?.corpus, "rgpd");
      assert.equal(resultat.passages[3]?.niveau, "article");
    });
  });

  it("garde la même confiance avec et sans quota", async () => {
    await surMontage(5, async ({ root, index }) => {
      const sans = await search(
        root,
        { question: "question" },
        { embedder, index, quota_texte: false },
      );
      const avec = await search(root, { question: "question" }, { embedder, index });

      assert.equal(avec.niveau_confiance, sans.niveau_confiance);
      assert.equal(avec.niveau_confiance, "incertain");
    });
  });

  it("compte un texte déjà classé et n'en insère qu'un", async () => {
    await surMontage(4, async ({ root, index }) => {
      const resultat = await search(root, { question: "question" }, { embedder, index });

      assert.deepEqual(
        resultat.passages.map((entree) => entree.ref),
        [
          `${DECISION}#f1`,
          `${DECISION}#f2`,
          `${DECISION}#f3`,
          `${DOCUMENT}#art_17`,
          `${DOCUMENT}#art_5`,
        ],
      );
      assert.equal(resultat.passages[3]?.place_reservee, undefined);
      assert.equal(resultat.passages[4]?.place_reservee, "texte");
    });
  });

  it("ne touche pas au top quand deux textes y sont déjà", async () => {
    await surMontage(3, async ({ root, index }) => {
      const resultat = await search(root, { question: "question" }, { embedder, index });

      assert.deepEqual(
        resultat.passages.map((entree) => entree.ref),
        [
          `${DECISION}#f1`,
          `${DECISION}#f2`,
          `${DECISION}#f3`,
          `${DOCUMENT}#art_17`,
          `${DOCUMENT}#art_5`,
        ],
      );
      assert.equal(resultat.passages.some((entree) => entree.place_reservee !== undefined), false);
    });
  });

  it("n'applique pas le quota sous k = 2", async () => {
    await surMontage(5, async ({ root, index }) => {
      const resultat = await search(root, { question: "question", k: 2 }, { embedder, index });

      assert.equal(resultat.passages.length, 2);
      assert.equal(resultat.passages.some((entree) => entree.place_reservee !== undefined), false);
    });
  });

  it("n'applique pas le quota quand un corpus est demandé", async () => {
    await surMontage(5, async ({ root, index }) => {
      const resultat = await search(
        root,
        { question: "question", corpus: "cnil" },
        { embedder, index },
      );

      assert.equal(resultat.passages.length, 5);
      assert.equal(resultat.passages.every((entree) => entree.corpus === "cnil"), true);
      assert.equal(resultat.passages.some((entree) => entree.place_reservee !== undefined), false);
    });
  });

  it("n'applique pas le quota quand un document est demandé", async () => {
    await surMontage(5, async ({ root, index }) => {
      const resultat = await search(
        root,
        { question: "question", document: DECISION },
        { embedder, index },
      );

      assert.equal(resultat.passages.length, 5);
      assert.equal(resultat.passages.some((entree) => entree.place_reservee !== undefined), false);
    });
  });

  it("n'applique pas le quota quand un numéro de délibération est demandé", async () => {
    await surMontage(5, async ({ root, index }) => {
      const resultat = await search(
        root,
        { question: "question", numero: "SAN-2026-015" },
        { embedder, index },
      );

      assert.equal(resultat.passages.length, 5);
      assert.equal(resultat.passages.some((entree) => entree.place_reservee !== undefined), false);
    });
  });

  it("n'applique pas le quota quand la question nomme un document", async () => {
    await surMontage(
      5,
      async ({ root, index }) => {
        const resultat = await search(
          root,
          { question: "Que dit l'AI Act sur la question ?" },
          { embedder, index },
        );

        assert.equal(resultat.passages.every((entree) => entree.corpus === "aiact"), true);
        assert.equal(resultat.passages.some((entree) => entree.place_reservee !== undefined), false);
      },
      true,
    );
  });

  it("n'applique pas le quota en recherche lexicale", async () => {
    await surMontage(5, async ({ root, index }) => {
      const resultat = await search(
        root,
        { question: "decision un" },
        { embedder, index, recherche: "lexicale" },
      );

      assert.equal(resultat.recherche, "lexicale");
      assert.equal(resultat.passages.some((entree) => entree.place_reservee !== undefined), false);
    });
  });

  it("n'applique pas le quota à une question qui vise une juridiction", async () => {
    await surMontage(5, async ({ root, index }) => {
      const resultat = await search(
        root,
        { question: "Quelle jurisprudence pour l'effacement ?" },
        { embedder, index },
      );

      assert.equal(resultat.passages.length, 5);
      assert.equal(resultat.passages.some((entree) => entree.place_reservee !== undefined), false);
    });
  });
});
