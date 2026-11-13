import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  MARGE,
  SEUILS_PAR_CORPUS,
  SEUILS_REPLI,
  SEUIL_BAS,
  SEUIL_HAUT,
  niveauConfiance,
  seuilsDuCorpus,
} from "../mcp/confidence.ts";
import { normaliser } from "../mcp/embed/embedder.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { buildIndex } from "../mcp/index/build.ts";
import { BANDE_ARTICLE, openIndex, rangerPassages } from "../mcp/index/search.ts";
import type { Index, ResultatRecherche } from "../mcp/index/search.ts";
import { createServer } from "../mcp/server.ts";
import { CANDIDATS_RERANK } from "../mcp/rerank/reranker.ts";
import type { Reranker } from "../mcp/rerank/reranker.ts";
import { corpusDeNiveau, documentNomme, documentsNommes, getArticle, getDecision, search } from "../mcp/tools.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const DOCUMENT = "32016R0679";
const DOCUMENT_AIAct = "32024R1689";

function unite(numero: number, texte: string, document = DOCUMENT): Unite {
  return {
    ref: `${document}#art_${numero}`,
    document,
    corpus: document === DOCUMENT ? "rgpd" : "aiact",
    niveau: "article",
    numero: String(numero),
    chemin: "RGPD > Chapitre III > Droits de la personne concernée",
    texte,
    date_acte: "2016-04-27",
    date_debut: "2018-05-25",
    date_fin: null,
    statut: "en_vigueur",
    url: `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${document}#art_${numero}`,
  };
}

const SIX: Unite[] = [
  unite(1, "objet et objectifs du règlement"),
  unite(2, "champ d'application matériel du règlement"),
  unite(3, "droit d'accès de la personne concernée aux données"),
  unite(4, "droit de rectification des données inexactes"),
  unite(5, "principes relatifs au traitement des données"),
  unite(6, "licéité du traitement des données personnelles"),
];

/** Corpus réduit portant l'article 17, pour le serveur sans index. */
const SIX_ET_17: Unite[] = [...SIX, unite(17, "droit à l'effacement des données personnelles")];

const ECHELLE = "LEGITEXT000006068624";

/** Un article de la LIL, réduit au strict nécessaire pour les outils. */
function unitLil(numero: number, texte: string): Unite {
  return {
    ref: `LEGIARTI0000000${String(numero).padStart(2, "0")}`,
    document: ECHELLE,
    corpus: "lil",
    niveau: "article",
    numero: String(numero),
    chemin: "LIL > Titre Ier > Chapitre Ier : Principes et définitions",
    texte,
    date_acte: "2019-06-01",
    date_debut: "2019-06-01",
    date_fin: null,
    statut: "VIGUEUR",
    url: `https://www.legifrance.gouv.fr/loda/id/LEGIARTI0000000${String(numero).padStart(2, "0")}`,
  };
}

/** Embedder déterministe : sac de mots hachés, 8 dimensions, aucun réseau. */
function embedderFactice(): Embedder {
  const vecteur = (texte: string): number[] => {
    const valeurs = new Array<number>(8).fill(0);
    for (const mot of texte.toLowerCase().split(/\s+/)) {
      if (mot === "") continue;
      let empreinte = 7;
      for (const caractere of mot) empreinte = (empreinte * 31 + (caractere.codePointAt(0) ?? 0)) % 1_000_003;
      valeurs[empreinte % 8] = (valeurs[empreinte % 8] ?? 0) + 1;
    }
    return normaliser(valeurs);
  };
  return {
    model: "factice",
    dim: 8,
    embedPassages: async (textes) => textes.map(vecteur),
    embedQuery: async (texte) => vecteur(texte),
  };
}

/** Un vecteur négatif : la similarité cosinus de tout passage reste sous le seuil bas. */
const EMBEDDER_HORS_SUJET: Embedder = {
  model: "factice",
  dim: 8,
  embedPassages: async (textes) => textes.map(() => normaliser(new Array<number>(8).fill(-1))),
  embedQuery: async () => normaliser(new Array<number>(8).fill(-1)),
};

const EMBEDDER_INTERDIT: Embedder = {
  model: "factice",
  dim: 8,
  embedPassages: async () => {
    throw new Error("l'embedder ne doit pas être appelé");
  },
  embedQuery: async () => {
    throw new Error("l'embedder ne doit pas être appelé");
  },
};

function ecrireCorpus(root: string, unites: Unite[] = SIX, nom = "rgpd"): void {
  const dossier = join(root, "data", "corpus", nom);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(
    join(dossier, "unites.jsonl"),
    `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    "utf8",
  );
}

function contenu(resultat: unknown): Record<string, unknown> {
  const bloc = (resultat as { content?: { type: string; text?: string }[] }).content?.[0];
  assert.ok(bloc?.text, "le résultat doit porter un bloc texte");
  return JSON.parse(bloc.text) as Record<string, unknown>;
}

describe("les outils, sans transport", () => {
  it("lit un article exact de la LIL", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root, [unitLil(1, "les fichiers doivent être créés dans l'intérêt des personnes")], "lil");
      const article = getArticle(root, { document: ECHELLE, numero: "1" });

      assert.equal(article.trouve, true);
      assert.equal(article.corpus, "lil");
      assert.equal(article.document, ECHELLE);
      assert.match(article.texte, /intérêt des personnes/);
      assert.equal(article.statut, "VIGUEUR");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend l'article de la LIL quand la question la nomme", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root, [unitLil(1, "les fichiers doivent être créés dans l'intérêt des personnes")], "lil");
      ecrireCorpus(root);
      const resultat = await search(
        root,
        { question: "Que prévoit l'article 1 de la LIL ?" },
        { embedder: EMBEDDER_INTERDIT },
      );

      assert.equal(resultat.niveau_confiance, "confiant");
      assert.equal(resultat.passages.length, 1);
      assert.equal(resultat.passages[0]?.corpus, "lil");
      assert.equal(resultat.passages[0]?.document, ECHELLE);
      assert.equal(resultat.passages[0]?.numero, "1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend un article exact", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root);
      const article = getArticle(root, { document: DOCUMENT, numero: "3" });

      assert.equal(article.trouve, true);
      assert.equal(article.ref, `${DOCUMENT}#art_3`);
      assert.equal(article.niveau, "article");
      assert.match(article.texte, /droit d'accès/);
      assert.equal(article.date_acte, "2016-04-27");
      assert.equal(article.url, SIX[2]?.url);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("dit introuvable plutôt que de rendre une chaîne vide", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root);
      const article = getArticle(root, { document: DOCUMENT, numero: "99" });

      assert.equal(article.trouve, false);
      assert.equal("texte" in article, false);
      assert.match(article.message, /99/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend confiant sur une référence exacte sans interroger l'index", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root);
      const resultat = await search(
        root,
        { question: "article 3 du RGPD" },
        { embedder: EMBEDDER_INTERDIT },
      );

      assert.equal(resultat.niveau_confiance, "confiant");
      assert.equal(resultat.passages.length, 1);
      assert.equal(resultat.passages[0]?.ref, `${DOCUMENT}#art_3`);
      assert.equal(resultat.passages[0]?.document, DOCUMENT);
      assert.equal(resultat.message, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend tous les articles quand le même numéro existe dans deux documents", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root, [unite(5, "principes relatifs au traitement des données")]);
      ecrireCorpus(
        root,
        [unite(5, "pratiques d'IA interdites", DOCUMENT_AIAct)],
        "aiact",
      );
      const resultat = await search(
        root,
        { question: "Que prévoit l'article 5 ?" },
        { embedder: EMBEDDER_INTERDIT },
      );

      assert.equal(resultat.niveau_confiance, "incertain");
      assert.deepEqual(
        resultat.passages.map((passage) => passage.ref).sort(),
        [`${DOCUMENT}#art_5`, `${DOCUMENT_AIAct}#art_5`].sort(),
      );
      assert.deepEqual(
        resultat.passages.map((passage) => passage.document).sort(),
        [DOCUMENT, DOCUMENT_AIAct].sort(),
      );
      assert.match(resultat.message ?? "", /plusieurs documents/);
      assert.match(resultat.message ?? "", /document/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne rend que le document demandé quand le numéro est ambigu", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root, [unite(5, "principes relatifs au traitement des données")]);
      ecrireCorpus(
        root,
        [unite(5, "pratiques d'IA interdites", DOCUMENT_AIAct)],
        "aiact",
      );
      const resultat = await search(
        root,
        { question: "Que prévoit l'article 5 ?", document: DOCUMENT_AIAct },
        { embedder: EMBEDDER_INTERDIT },
      );

      assert.equal(resultat.niveau_confiance, "confiant");
      assert.deepEqual(
        resultat.passages.map((passage) => passage.ref),
        [`${DOCUMENT_AIAct}#art_5`],
      );
      assert.equal(resultat.message, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse une question hors corpus sans rendre de passage", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root);
      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const resultat = await search(
          root,
          { question: "Quel est le tarif d'une place de stationnement ?" },
          { embedder: EMBEDDER_HORS_SUJET, index },
        );

        assert.equal(resultat.niveau_confiance, "aucun_resultat_fiable");
        assert.deepEqual(resultat.passages, []);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("nomme l'article absent quand la question le cite", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root);
      const resultat = await search(root, { question: "article 999 du RGPD" }, { embedder: EMBEDDER_INTERDIT });

      assert.equal(resultat.niveau_confiance, "aucun_resultat_fiable");
      assert.deepEqual(resultat.passages, []);
      assert.match(resultat.message ?? "", /article 999/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("transmet le document à l'embedder de requête", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tools-"));
    try {
      ecrireCorpus(root);
      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      const base = embedderFactice();
      const vus: (string | undefined)[] = [];
      const embedder: Embedder = {
        ...base,
        embedQuery: async (texte, document) => {
          vus.push(document);
          return base.embedQuery(texte);
        },
      };
      try {
        await search(
          root,
          { question: "droit d'accès de la personne concernée aux données", document: DOCUMENT },
          { embedder, index },
        );

        assert.deepEqual(vus, [DOCUMENT]);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("les alias de document", () => {
  it("reconnaît les sigles et les noms complets du RGPD", () => {
    for (const question of [
      "le RGPD",
      "le R.G.P.D.",
      "le règlement général sur la protection des données",
      "le règlement général",
      "le règlement (UE) 2016/679",
      "la décision 2016/679",
      "le règlement 32016R0679",
    ]) {
      assert.equal(documentNomme(question), "32016R0679", question);
    }
  });

  it("reconnaît les sigles et les noms complets de l'AI Act", () => {
    for (const question of [
      "l'AI Act",
      "l'IA Act",
      "le règlement IA",
      "le règlement sur l'intelligence artificielle",
      "le règlement européen sur l'intelligence artificielle",
      "le règlement (UE) 2024/1689",
      "la décision 2024/1689",
      "le règlement 32024R1689",
    ]) {
      assert.equal(documentNomme(question), "32024R1689", question);
    }
  });

  it("reconnaît les alias de la LIL", () => {
    for (const question of [
      "la LIL",
      "la loi informatique et libertés",
      "la loi 78-17",
      "la loi n° 78-17",
      "la loi n°78-17",
    ]) {
      assert.equal(documentNomme(question), "LEGITEXT000006068624", question);
    }
  });

  it("n'infère rien quand la LIL et un autre corpus sont nommés", () => {
    assert.equal(documentNomme("l'article 5 de la LIL et du RGPD"), null);
    assert.equal(documentsNommes("l'article 5 de la LIL et du RGPD").length, 2);
  });

  it("n'infère rien sans alias ou quand deux corpus sont nommés", () => {
    assert.equal(documentNomme("Que prévoit l'article 5 ?"), null);
    assert.equal(documentNomme("Que prévoit l'article 5 du RGPD et de l'AI Act ?"), null);
  });

  it("ne lit pas « IA » à l'intérieur d'un mot comme un corpus", () => {
    assert.equal(documentNomme("un traitement spécial de l'article 5"), null);
  });
});

describe("le document nommé dans la question", () => {
  let root: string;
  let index: Index;

  before(async () => {
    root = mkdtempSync(join(tmpdir(), "vitrine-documents-"));
    ecrireCorpus(root, [
      unite(5, "principes relatifs au traitement des données personnelles"),
      unite(17, "droit à l'effacement des données personnelles"),
    ]);
    ecrireCorpus(
      root,
      [
        unite(5, "pratiques d'IA interdites", DOCUMENT_AIAct),
        unite(17, "système de gestion de la qualité", DOCUMENT_AIAct),
        unite(100, "mesures d'appui pour l'innovation", DOCUMENT_AIAct),
      ],
      "aiact",
    );
    const construit = await buildIndex(root, embedderFactice());
    index = openIndex(construit.chemin);
  });

  after(() => {
    index.db.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("refuse l'article 100 absent du RGPD nommé au lieu de rendre celui de l'AI Act", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 100 du RGPD ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "aucun_resultat_fiable");
    assert.deepEqual(resultat.passages, []);
    assert.match(resultat.message ?? "", /article 100/);
    assert.match(resultat.message ?? "", /32016R0679/);
    assert.equal((resultat.message ?? "").includes(DOCUMENT_AIAct), false);
  });

  it("refuse l'article 100 quand la question dit « règlement général »", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 100 du règlement général ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "aucun_resultat_fiable");
    assert.deepEqual(resultat.passages, []);
    assert.match(resultat.message ?? "", /article 100/);
    assert.match(resultat.message ?? "", /32016R0679/);
    assert.equal((resultat.message ?? "").includes(DOCUMENT_AIAct), false);
  });

  it("refuse l'article 100 quand la question dit « règlement (UE) 2016/679 »", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 100 du règlement (UE) 2016/679 ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "aucun_resultat_fiable");
    assert.deepEqual(resultat.passages, []);
    assert.match(resultat.message ?? "", /article 100/);
    assert.match(resultat.message ?? "", /32016R0679/);
    assert.equal((resultat.message ?? "").includes(DOCUMENT_AIAct), false);
  });

  it("rend incertain et nomme l'AI Act pour l'article 100 sans document nommé", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 100 ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "incertain");
    assert.deepEqual(
      resultat.passages.map((passage) => passage.ref),
      [`${DOCUMENT_AIAct}#art_100`],
    );
    assert.match(resultat.message ?? "", /AI Act/);
    assert.match(resultat.message ?? "", /32024R1689/);
  });

  it("garde l'ambiguïté pour l'article 17 sans document nommé", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 17 ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "incertain");
    assert.deepEqual(
      resultat.passages.map((passage) => passage.ref).sort(),
      [`${DOCUMENT}#art_17`, `${DOCUMENT_AIAct}#art_17`].sort(),
    );
    assert.match(resultat.message ?? "", /plusieurs documents/);
  });

  it("rend l'article 5 du RGPD quand la question nomme le RGPD", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 5 du RGPD ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "confiant");
    assert.deepEqual(
      resultat.passages.map((passage) => passage.ref),
      [`${DOCUMENT}#art_5`],
    );
  });

  it("rend l'article 5 de l'AI Act quand la question nomme l'AI Act", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 5 de l'AI Act ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "confiant");
    assert.deepEqual(
      resultat.passages.map((passage) => passage.ref),
      [`${DOCUMENT_AIAct}#art_5`],
    );
  });

  it("garde l'ambiguïté quand aucun document n'est nommé", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 5 ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "incertain");
    assert.deepEqual(
      resultat.passages.map((passage) => passage.ref).sort(),
      [`${DOCUMENT}#art_5`, `${DOCUMENT_AIAct}#art_5`].sort(),
    );
    assert.match(resultat.message ?? "", /plusieurs documents/);
  });

  it("n'infère rien quand la question nomme les deux documents", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 5 du RGPD et de l'AI Act ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "incertain");
    assert.deepEqual(
      resultat.passages.map((passage) => passage.ref).sort(),
      [`${DOCUMENT}#art_5`, `${DOCUMENT_AIAct}#art_5`].sort(),
    );
  });

  it("n'affirme pas qu'aucun document n'est nommé quand deux le sont", async () => {
    const resultat = await search(
      root,
      { question: "Que prévoit l'article 100 du RGPD et de l'AI Act ?" },
      { embedder: EMBEDDER_INTERDIT, index },
    );

    assert.equal(resultat.niveau_confiance, "incertain");
    assert.deepEqual(
      resultat.passages.map((passage) => passage.ref),
      [`${DOCUMENT_AIAct}#art_100`],
    );
    assert.doesNotMatch(resultat.message ?? "", /ne nomme aucun document/);
    assert.match(resultat.message ?? "", /plusieurs documents/);
  });

  it("filtre la recherche sémantique sur le document nommé", async () => {
    const base = embedderFactice();
    const vus: (string | undefined)[] = [];
    const embedder: Embedder = {
      ...base,
      embedQuery: async (texte, document) => {
        vus.push(document);
        return base.embedQuery(texte);
      },
    };

    const resultat = await search(
      root,
      { question: "principes relatifs au traitement des données personnelles du RGPD" },
      { embedder, index, seuils: { bas: -1, haut: 2, marge: 0 } },
    );

    assert.deepEqual(vus, [DOCUMENT]);
    assert.ok(resultat.passages.length > 0);
    assert.ok(resultat.passages.every((passage) => passage.document === DOCUMENT));
  });

  it("filtre la recherche sémantique sur le nom complet de l'AI Act", async () => {
    const base = embedderFactice();
    const vus: (string | undefined)[] = [];
    const embedder: Embedder = {
      ...base,
      embedQuery: async (texte, document) => {
        vus.push(document);
        return base.embedQuery(texte);
      },
    };

    const resultat = await search(
      root,
      { question: "obligations de transparence du règlement européen sur l'intelligence artificielle" },
      { embedder, index, seuils: { bas: -1, haut: 2, marge: 0 } },
    );

    assert.deepEqual(vus, [DOCUMENT_AIAct]);
    assert.ok(resultat.passages.length > 0);
    assert.ok(resultat.passages.every((passage) => passage.document === DOCUMENT_AIAct));
  });
});

/** Un passage synthétique à une similarité donnée, pour la bande article. */
function passage(niveau: "article" | "considérant", similarite: number, numero = "1"): ResultatRecherche {
  return {
    ref: `${DOCUMENT}#${niveau === "article" ? "art" : "rct"}_${numero}`,
    document: DOCUMENT,
    corpus: "rgpd",
    niveau,
    numero,
    texte: "texte",
    chemin: "RGPD > Chapitre I",
    url: "https://eur-lex.europa.eu/",
    date_acte: "2016-04-27",
    date_debut: "2018-05-25",
    date_fin: null,
    statut: "en_vigueur",
    distance: 1 - similarite,
  };
}

describe("la bande article", () => {
  it("fait passer un article à 0,79 devant un considérant à 0,80", () => {
    const ordre = rangerPassages([passage("considérant", 0.8), passage("article", 0.79)], 2);

    assert.deepEqual(
      ordre.map((resultat) => resultat.niveau),
      ["article", "considérant"],
    );
    assert.ok(Math.abs((ordre[0]?.distance ?? 0) - (1 - 0.79)) < 1e-12);
    assert.ok(Math.abs((ordre[1]?.distance ?? 0) - (1 - 0.8)) < 1e-12);
  });

  it("laisse un considérant à 0,90 devant un article à 0,70", () => {
    const ordre = rangerPassages([passage("article", 0.7), passage("considérant", 0.9)], 2);

    assert.deepEqual(
      ordre.map((resultat) => resultat.niveau),
      ["considérant", "article"],
    );
  });

  it("garde l'ordre de similarité entre deux articles", () => {
    const ordre = rangerPassages(
      [passage("article", 0.79, "2"), passage("article", 0.8, "1")],
      2,
    );

    assert.deepEqual(
      ordre.map((resultat) => resultat.numero),
      ["1", "2"],
    );
  });

  it("ne retire jamais un considérant sans article comparable et garde son étiquette", () => {
    const ordre = rangerPassages([passage("article", 0.9), passage("considérant", 0.3, "7")], 5);

    assert.equal(ordre.length, 2);
    assert.equal(ordre[1]?.niveau, "considérant");
    assert.equal(ordre[1]?.numero, "7");
    assert.equal(BANDE_ARTICLE, 0.02);
  });
});

describe("niveauConfiance", () => {
  it("est confiant sur une référence exacte, même sans résultat", () => {
    assert.equal(niveauConfiance([], true), "confiant");
  });

  it("est confiant au-dessus du seuil haut avec la marge", () => {
    assert.equal(niveauConfiance([{ distance: 0.2 }, { distance: 0.4 }], false), "confiant");
  });

  it("reste incertain quand la marge manque", () => {
    assert.equal(
      niveauConfiance([{ distance: 0.2 }, { distance: 0.21 }], false, { marge: 0.02 }),
      "incertain",
    );
  });

  it("passe de incertain à confiant au-delà de la marge", () => {
    const resultats = [{ distance: 0.25 }, { distance: 0.5 }];

    assert.equal(
      niveauConfiance(resultats, false, { bas: 0.5, haut: 0.7, marge: 0.25 }),
      "incertain",
    );
    assert.equal(
      niveauConfiance(resultats, false, { bas: 0.5, haut: 0.7, marge: 0.24 }),
      "confiant",
    );
  });

  it("reste incertain entre les deux seuils", () => {
    const entre = (SEUIL_BAS + SEUIL_HAUT) / 2;
    assert.equal(niveauConfiance([{ distance: 1 - entre }], false), "incertain");
  });

  it("ne rend aucun résultat fiable sous le seuil bas ou sans résultat", () => {
    assert.equal(niveauConfiance([{ distance: 1 - (SEUIL_BAS - 0.05) }], false), "aucun_resultat_fiable");
    assert.equal(niveauConfiance([], false), "aucun_resultat_fiable");
  });

  it("laisse les seuils se régler", () => {
    assert.equal(niveauConfiance([{ distance: 0.2 }], false, { haut: 1.1 }), "incertain");
    assert.equal(niveauConfiance([{ distance: 0.2 }], false, { haut: 0.5, marge: 0 }), "confiant");
    assert.equal(
      niveauConfiance([{ distance: 1 - (SEUIL_HAUT + 0.1) }], false, { bas: 0.9 }),
      "aucun_resultat_fiable",
    );
  });
});

/** Triplet `0,73 / 0,73 / 0,01` lu dans une ligne de `promesse.md`. */
function tripletMarkdown(ligne: string): [number, number, number] | null {
  const trouve = /(\d+),(\d+)\s*\/\s*(\d+),(\d+)\s*\/\s*(\d+),(\d+)/.exec(ligne);
  if (trouve === null) return null;
  const valeur = (entier: string | undefined, decimal: string | undefined): number =>
    Number(`${entier ?? ""}.${decimal ?? ""}`);
  return [
    valeur(trouve[1], trouve[2]),
    valeur(trouve[3], trouve[4]),
    valeur(trouve[5], trouve[6]),
  ];
}

describe("la table de confiance par corpus", () => {
  it("ne porte que la CNIL et laisse le repli à tout le reste", () => {
    assert.deepEqual(Object.keys(SEUILS_PAR_CORPUS), ["cnil"]);
    assert.deepEqual(SEUILS_PAR_CORPUS.cnil, { bas: 0.73, haut: 0.73, marge: 0.01 });
    for (const corpus of ["rgpd", "aiact", "lil", "ce", "cepd", "cc", "cjue", "inconnu"]) {
      assert.equal(SEUILS_PAR_CORPUS[corpus], undefined, corpus);
    }
    assert.deepEqual(
      { bas: SEUIL_BAS, haut: SEUIL_HAUT, marge: MARGE },
      { bas: 0.69, haut: 0.74, marge: 0.01 },
    );
  });

  it("applique la table CNIL quand le corpus est demandé", () => {
    // 0,735 : au-dessus du haut CNIL (0,73), sous le haut du repli (0,74).
    const resultats = [{ distance: 1 - 0.735 }, { distance: 1 - 0.5 }];

    assert.equal(niveauConfiance(resultats, false, { corpus: "cnil" }), "confiant");
    assert.equal(niveauConfiance(resultats, false), "incertain");
  });

  it("suit le repli sans corpus et sur un corpus inconnu", () => {
    // 0,735 : confiant à la table CNIL, incertain au repli (haut 0,74).
    const resultats = [{ distance: 1 - 0.735 }, { distance: 1 - 0.5 }];

    assert.equal(niveauConfiance(resultats, false, { corpus: "cnil" }), "confiant");
    assert.equal(niveauConfiance(resultats, false, { corpus: "rgpd" }), "incertain");
    assert.equal(niveauConfiance(resultats, false), "incertain");
  });

  it("fait primer les seuils fournis par l'appelant sur la table", () => {
    const resultats = [{ distance: 1 - 0.735 }, { distance: 1 - 0.5 }];

    assert.equal(niveauConfiance(resultats, false, { haut: 0.75, corpus: "cnil" }), "incertain");
    assert.equal(
      niveauConfiance(resultats, false, { bas: 0.74, corpus: "cnil" }),
      "aucun_resultat_fiable",
    );
    assert.equal(niveauConfiance(resultats, false, { marge: 0.3, corpus: "cnil" }), "incertain");
  });

  it("place les frontières bas et haut de la CNIL à 0,73", () => {
    assert.equal(
      niveauConfiance([{ distance: 1 - 0.729 }, { distance: 1 - 0.5 }], false, { corpus: "cnil" }),
      "aucun_resultat_fiable",
    );
    assert.equal(
      niveauConfiance([{ distance: 1 - 0.73 }, { distance: 1 - 0.5 }], false, { corpus: "cnil" }),
      "confiant",
    );
  });

  it("exige la marge de 0,01 de la CNIL", () => {
    assert.equal(
      niveauConfiance([{ distance: 1 - 0.73 }, { distance: 1 - 0.725 }], false, { corpus: "cnil" }),
      "incertain",
    );
    assert.equal(
      niveauConfiance([{ distance: 1 - 0.73 }, { distance: 1 - 0.71 }], false, { corpus: "cnil" }),
      "confiant",
    );
  });

  it("garde « exact » confiant sans lire la table", () => {
    assert.equal(niveauConfiance([], true), "confiant");
    assert.equal(niveauConfiance([], true, { corpus: "cnil" }), "confiant");
    assert.equal(niveauConfiance([{ distance: 1 }], true, { corpus: "cnil" }), "confiant");
  });

  it("ne lit pas une propriété héritée du prototype", () => {
    assert.deepEqual(seuilsDuCorpus("constructor"), SEUILS_REPLI);
    assert.deepEqual(seuilsDuCorpus("toString"), SEUILS_REPLI);
    // 0,735 : confiant à la table CNIL, incertain au repli — `constructor` ne doit pas la rendre.
    const resultats = [{ distance: 1 - 0.735 }, { distance: 1 - 0.5 }];
    assert.equal(niveauConfiance(resultats, false, { corpus: "constructor" }), "incertain");
  });

  it("code exactement les valeurs écrites dans promesse.md", () => {
    const promesse = readFileSync(
      new URL(
        "../aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/promesse.md",
        import.meta.url,
      ),
      "utf8",
    ).split("\n");
    const ligneSeuils = promesse.find((ligne) => ligne.includes("Seuils retenus"));
    const ligneRepli = promesse.find((ligne) => ligne.includes("Repli des autres corpus"));

    assert.ok(ligneSeuils !== undefined, "promesse.md doit porter la ligne « Seuils retenus »");
    assert.ok(
      ligneRepli !== undefined,
      "promesse.md doit porter la ligne « Repli des autres corpus »",
    );

    const triplet = ligneSeuils === undefined ? null : tripletMarkdown(ligneSeuils);
    const repli = ligneRepli === undefined ? null : tripletMarkdown(ligneRepli);
    assert.ok(triplet !== null, "la ligne « Seuils retenus » doit porter un triplet");
    assert.ok(repli !== null, "la ligne « Repli des autres corpus » doit porter un triplet");

    assert.deepEqual(
      triplet,
      [SEUILS_PAR_CORPUS.cnil?.bas, SEUILS_PAR_CORPUS.cnil?.haut, SEUILS_PAR_CORPUS.cnil?.marge],
      "le triplet CNIL du code doit être celui de promesse.md",
    );
    assert.deepEqual(
      repli,
      [SEUIL_BAS, SEUIL_HAUT, MARGE],
      "le repli du code doit être celui de promesse.md",
    );
  });
});

/** Vecteur unitaire dont la similarité cosinus avec `(1, 0, …)` vaut `similarite`. */
function vecteurSimilarite(similarite: number): number[] {
  const valeurs = new Array<number>(8).fill(0);
  valeurs[0] = similarite;
  valeurs[1] = Math.sqrt(1 - similarite * similarite);
  return valeurs;
}

/** Embedder à similarités imposées : le marqueur présent dans le passage choisit la valeur. */
function embedderAvecSimilarites(parMarqueur: [string, number][]): Embedder {
  return {
    model: "factice-similarite",
    dim: 8,
    embedPassages: async (textes) =>
      textes.map((texte) => {
        const trouve = parMarqueur.find(([marqueur]) => texte.includes(marqueur));
        if (trouve === undefined) throw new Error(`Texte sans similarité prévue : ${texte}`);
        return vecteurSimilarite(trouve[1]);
      }),
    embedQuery: async () => vecteurSimilarite(1),
  };
}

describe("la table appliquée par search", () => {
  it("suit le corpus demandé et laisse le repli sans corpus", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-confiance-"));
    try {
      ecrireCorpus(
        root,
        [
          fragment("CNILTEXT000055000001", 0, "le passage proche de la question"),
          fragment("CNILTEXT000055000002", 0, "le passage voisin de la question"),
        ],
        "cnil",
      );
      const embedder = embedderAvecSimilarites([
        ["proche", 0.735],
        ["voisin", 0.5],
      ]);
      const construit = await buildIndex(root, embedder);
      const index = openIndex(construit.chemin);
      try {
        const question = "sanction relative au dépôt de cookies";
        const avecCorpus = await search(root, { question, corpus: "cnil" }, { embedder, index });
        const sansCorpus = await search(root, { question }, { embedder, index });

        assert.equal(avecCorpus.niveau_confiance, "confiant");
        assert.equal(sansCorpus.niveau_confiance, "incertain");
        assert.deepEqual(
          avecCorpus.passages.map((passage) => passage.ref),
          sansCorpus.passages.map((passage) => passage.ref),
          "le niveau change, jamais les passages rendus",
        );
        assert.ok(Math.abs((avecCorpus.passages[0]?.similarite ?? 0) - 0.735) < 1e-6);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("le serveur en mémoire", () => {
  let root: string;
  let index: Index;
  let client: Client;
  let serveur: ReturnType<typeof createServer>;

  before(async () => {
    root = mkdtempSync(join(tmpdir(), "vitrine-mcp-"));
    ecrireCorpus(root);
    const construit = await buildIndex(root, embedderFactice());
    index = openIndex(construit.chemin);
    serveur = createServer({ rootDir: root, embedder: embedderFactice(), index });
    client = new Client({ name: "test", version: "0.0.0" });

    const [transportClient, transportServeur] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(transportClient), serveur.connect(transportServeur)]);
  });

  after(async () => {
    await client.close();
    await serveur.close();
    index.db.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("expose exactement etat_corpus, get_article, get_decision et search", async () => {
    const { tools } = await client.listTools();

    assert.deepEqual(
      tools.map((outil) => outil.name).sort(),
      ["etat_corpus", "get_article", "get_decision", "search"],
    );
  });

  it("décrit les citations de search et get_decision, sans toucher à get_article", async () => {
    const { tools } = await client.listTools();
    const description = (nom: string): string =>
      tools.find((outil) => outil.name === nom)?.description ?? "";

    assert.match(description("search"), /citations/);
    assert.match(description("get_decision"), /citations/);
    assert.match(description("search"), /lien officiel/);
    assert.match(description("get_decision"), /lien officiel/);
    assert.equal(/citations/.test(description("get_article")), false);
  });

  it("rend l'état du corpus sans rapport par etat_corpus", async () => {
    const resultat = await client.callTool({ name: "etat_corpus", arguments: {} });
    const payload = contenu(resultat);

    assert.equal(payload.a_jour_au, null);
    assert.equal(Array.isArray(payload.corpus), true);
    assert.match(String(payload.message), /corpus:sync/);
  });

  it("rend l'article 3 par get_article", async () => {
    const resultat = await client.callTool({
      name: "get_article",
      arguments: { document: DOCUMENT, numero: "3" },
    });
    const payload = contenu(resultat);

    assert.equal(payload.trouve, true);
    assert.equal(payload.ref, `${DOCUMENT}#art_3`);
    assert.match(String(payload.texte), /droit d'accès/);
    assert.equal(payload.date_acte, "2016-04-27");
    assert.equal(payload.url, SIX[2]?.url);
  });

  it("répond introuvable pour un article absent", async () => {
    const resultat = await client.callTool({
      name: "get_article",
      arguments: { document: DOCUMENT, numero: "42" },
    });
    const payload = contenu(resultat);

    assert.equal(payload.trouve, false);
    assert.match(String(payload.message), /42/);
  });

  it("cherche par le sens et garde art_3 dans les cinq premiers", async () => {
    const resultat = await client.callTool({
      name: "search",
      arguments: { question: "droit d'accès de la personne concernée aux données" },
    });
    const payload = contenu(resultat);
    const passages = payload.passages as {
      ref: string;
      niveau: string;
      numero: string;
      chemin: string;
      similarite: number;
    }[];

    assert.ok(["confiant", "incertain"].includes(String(payload.niveau_confiance)));
    assert.ok(passages.length <= 5);
    assert.equal(passages[0]?.ref, `${DOCUMENT}#art_3`);
    assert.equal(passages[0]?.niveau, "article");
    assert.equal(passages[0]?.numero, "3");
    assert.equal(typeof passages[0]?.chemin, "string");
    assert.equal(typeof passages[0]?.similarite, "number");
  });

  it("court-circuite une référence exacte", async () => {
    const resultat = await client.callTool({
      name: "search",
      arguments: { question: "article 5 du RGPD" },
    });
    const payload = contenu(resultat);

    assert.equal(payload.niveau_confiance, "confiant");
    assert.equal((payload.passages as { ref: string }[])[0]?.ref, `${DOCUMENT}#art_5`);
  });
});

describe("le serveur sans index", () => {
  let root: string;
  let client: Client;
  let serveur: ReturnType<typeof createServer>;

  before(async () => {
    root = mkdtempSync(join(tmpdir(), "vitrine-mcp-sans-index-"));
    ecrireCorpus(root, SIX_ET_17);
    serveur = createServer({ rootDir: root, embedder: EMBEDDER_INTERDIT });
    client = new Client({ name: "test", version: "0.0.0" });

    const [transportClient, transportServeur] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(transportClient), serveur.connect(transportServeur)]);
  });

  after(async () => {
    await client.close();
    await serveur.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("sert « article 17 » sans index en nommant le corpus", async () => {
    const resultat = await client.callTool({
      name: "search",
      arguments: { question: "article 17" },
    });
    const payload = contenu(resultat);

    assert.equal(payload.niveau_confiance, "incertain");
    assert.equal((payload.passages as { ref: string }[])[0]?.ref, `${DOCUMENT}#art_17`);
    assert.match(String(payload.message), /RGPD/);
  });

  it("refuse « article 100 » sans accuser l'index absent", async () => {
    const resultat = await client.callTool({
      name: "search",
      arguments: { question: "article 100" },
    });
    const payload = contenu(resultat);
    const message = String(payload.message);

    assert.equal(payload.niveau_confiance, "aucun_resultat_fiable");
    assert.deepEqual(payload.passages, []);
    assert.match(message, /article 100/);
    assert.doesNotMatch(message, /Index introuvable/);
  });
});

describe("le code du serveur", () => {
  it("n'appelle fetch ni dans server.ts ni dans tools.ts", () => {
    for (const fichier of ["../mcp/server.ts", "../mcp/tools.ts"]) {
      const source = readFileSync(new URL(fichier, import.meta.url), "utf8");
      assert.equal(/\bfetch\b/.test(source), false, `${fichier} ne doit pas appeler le réseau`);
    }
  });
});

/** Un fragment CNIL synthétique, prêt à être écrit dans un corpus. */
function fragment(
  document: string,
  index: number,
  texte: string,
  numero = "SAN-2026-015",
  date = "2026-10-22",
): Unite {
  return {
    ref: `${document}#f${index}`,
    document,
    corpus: "cnil",
    niveau: "fragment",
    numero,
    chemin: `CNIL > Sanctions > Délibération ${numero}`,
    texte,
    date_acte: date,
    date_debut: date,
    date_fin: null,
    statut: "VIGUEUR",
    url: `https://www.legifrance.gouv.fr/cnil/id/${document}`,
    origine: "dinum",
    nature: "Sanction",
  };
}

describe("get_decision", () => {
  function racine(unites: Unite[]): string {
    const root = mkdtempSync(join(tmpdir(), "vitrine-decision-"));
    ecrireCorpus(root, unites, "cnil");
    return root;
  }

  it("rend tous les fragments d'un document dans l'ordre numérique", () => {
    const unites = Array.from({ length: 11 }, (_, index) =>
      fragment("CNILTEXT000055022778", index, `fragment ${index}`),
    );
    const root = racine([...unites].reverse());
    try {
      const resultat = getDecision(root, {
        document: "CNILTEXT000055022778",
        partie: "tous",
      });

      assert.equal(resultat.trouve, true);
      assert.equal(resultat.decisions.length, 1);
      const decision = resultat.decisions[0];
      assert.equal(decision?.numero, "SAN-2026-015");
      assert.equal(decision?.partie, "tous");
      assert.equal(decision?.fragments_total, 11);
      assert.equal(decision?.date_acte, "2026-10-22");
      assert.equal(decision?.statut, "VIGUEUR");
      assert.equal(decision?.origine, "dinum");
      assert.equal(decision?.nature, "Sanction");
      assert.deepEqual(
        decision?.fragments.map((element) => element.ref),
        Array.from({ length: 11 }, (_, index) => `CNILTEXT000055022778#f${index}`),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend la seule partie opératoire par défaut", () => {
    const unites = [
      fragment("CNILTEXT000055022778", 0, "Le considérant expose les faits."),
      fragment("CNILTEXT000055022778", 1, "La formation restreinte retient un manquement."),
      fragment(
        "CNILTEXT000055022778",
        2,
        "PAR CES MOTIFS La formation restreinte décide de prononcer une amende de 5 000 euros.",
      ),
      fragment("CNILTEXT000055022778", 3, "La décision sera rendue publique."),
    ];
    const root = racine(unites);
    try {
      const resultat = getDecision(root, { document: "CNILTEXT000055022778" });
      const decision = resultat.decisions[0];

      assert.equal(decision?.partie, "dispositif");
      assert.equal(decision?.fragments_total, 4);
      assert.deepEqual(
        decision?.fragments.map((element) => element.ref),
        ["CNILTEXT000055022778#f2", "CNILTEXT000055022778#f3"],
      );
      assert.match(decision?.fragments[0]?.texte ?? "", /amende de 5 000 euros/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("borne aussi une décision sans « PAR CES MOTIFS »", () => {
    const unites = [
      fragment("CNILTEXT000055022778", 0, "Les observations de la société contestent les faits."),
      fragment("CNILTEXT000055022778", 1, "Le rapporteur relève plusieurs manquements."),
      fragment(
        "CNILTEXT000055022778",
        2,
        "En conséquence, la Commission décide de prononcer une sanction pécuniaire de 15 000 euros.",
      ),
    ];
    const root = racine(unites);
    try {
      const decision = getDecision(root, { document: "CNILTEXT000055022778" }).decisions[0];

      assert.equal(decision?.partie, "dispositif");
      assert.deepEqual(
        decision?.fragments.map((element) => element.ref),
        ["CNILTEXT000055022778#f2"],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("trouve un numéro au tiret différent et rend les métadonnées", () => {
    const unite: Unite = {
      ...fragment("CNILTEXT000053408671", 0, "sanction", "SAN–2026-003", "2026-01-22"),
      type_sanction: "amende",
      montant: 5_000_000,
      injonction: true,
    };
    const root = racine([unite]);
    try {
      const resultat = getDecision(root, { numero: "SAN-2026-003" });
      const decision = resultat.decisions[0];
      assert.equal(resultat.trouve, true);
      assert.equal(decision?.numero, "SAN–2026-003");
      assert.equal(decision?.type_sanction, "amende");
      assert.equal(decision?.montant, 5_000_000);
      assert.equal(decision?.injonction, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("trouve une décision par son numéro", () => {
    const root = racine([
      fragment("CNILTEXT000055022778", 0, "premier"),
      fragment("CNILTEXT000099999999", 0, "autre", "SAN-2019-001", "2019-01-21"),
    ]);
    try {
      const resultat = getDecision(root, { numero: "san-2019-001" });

      assert.equal(resultat.trouve, true);
      assert.deepEqual(
        resultat.decisions.map((decision) => decision.document),
        ["CNILTEXT000099999999"],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend les deux documents quand un numéro est porté deux fois", () => {
    const root = racine([
      fragment("CNILTEXT000053352594", 0, "un", "SAN-2026-001", "2026-01-08"),
      fragment("CNILTEXT000053352664", 0, "deux", "SAN-2026-001", "2026-01-08"),
    ]);
    try {
      const resultat = getDecision(root, { numero: "SAN-2026-001" });

      assert.equal(resultat.decisions.length, 2);
      assert.deepEqual(
        resultat.decisions.map((decision) => decision.document).sort(),
        ["CNILTEXT000053352594", "CNILTEXT000053352664"],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse un avis et renvoie à search avec nature", () => {
    const avis: Unite = {
      ...fragment("CNILTEXT000053000001", 0, "avis sur un projet de décret", "AVIS-2026-001"),
      nature: "Avis",
    };
    const root = racine([avis]);
    try {
      const resultat = getDecision(root, { document: "CNILTEXT000053000001" });

      assert.equal(resultat.trouve, false);
      assert.deepEqual(resultat.decisions, []);
      assert.match(resultat.message ?? "", /Aucune sanction/);
      assert.match(resultat.message ?? "", /Avis/);
      assert.match(resultat.message ?? "", /« search »/);
      assert.match(resultat.message ?? "", /« nature »/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("dit l'absence sans inventer de fragment", () => {
    const root = racine([fragment("CNILTEXT000055022778", 0, "texte")]);
    try {
      const absent = getDecision(root, { document: "CNILTEXT000000000000" });
      const sansIdentifiant = getDecision(root, {});
      const autreCorpus = getDecision(root, { document: "CNILTEXT000055022778", corpus: "rgpd" });

      assert.equal(absent.trouve, false);
      assert.deepEqual(absent.decisions, []);
      assert.match(absent.message ?? "", /Aucune décision pour le document CNILTEXT000000000000/);
      assert.match(sansIdentifiant.message ?? "", /Précisez « document »/);
      assert.match(autreCorpus.message ?? "", /dans le corpus rgpd/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend les instruments et articles que la décision cite, avec leur lien", () => {
    const root = racine([
      fragment(
        "CNILTEXT000055022778",
        0,
        "La formation restreinte rappelle l'article 6 du règlement (UE) 2016/679 et " +
          "l'article 82 de la loi n° 78-17.",
      ),
      fragment("CNILTEXT000055022778", 1, "Le manquement est constitué."),
    ]);
    try {
      const decision = getDecision(root, { document: "CNILTEXT000055022778" }).decisions[0];

      assert.deepEqual(decision?.citations, [
        {
          instrument: "RGPD",
          articles: ["6"],
          reference: "RGPD · art. 6",
          url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679",
        },
        {
          instrument: "loi 78-17",
          articles: ["82"],
          reference: "loi 78-17 · art. 82",
          url: "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006068624",
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend une liste vide quand la décision ne cite rien de reconnu", () => {
    const root = racine([
      fragment("CNILTEXT000055022778", 0, "Le décret du 20 octobre 2005 n'est pas visé."),
    ]);
    try {
      const decision = getDecision(root, { document: "CNILTEXT000055022778" }).decisions[0];

      assert.deepEqual(decision?.citations, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("la recherche restreinte à une nature", () => {
  it("ne rend que la nature demandée, même quand elle est minoritaire", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-nature-filtre-"));
    try {
      const sanction: Unite = {
        ...fragment("CNILTEXT000055000001", 0, "sanction pécuniaire pour le dépôt de cookies", "SAN-2026-901"),
        type_sanction: "amende",
        montant: 100_000,
        injonction: true,
      };
      const avisCible: Unite = {
        ...fragment("CNILTEXT000055000002", 0, "avis sur la publicité ciblée et les cookies", "AVIS-2026-001"),
        nature: "Avis",
      };
      const bruit: Unite[] = Array.from({ length: 60 }, (_, index) => ({
        ...fragment(
          `CNILTEXT0000551${String(index).padStart(5, "0")}`,
          0,
          "question identique sur les cookies",
          `AVIS-2026-${String(index + 2).padStart(3, "0")}`,
        ),
        nature: "Avis",
      }));
      ecrireCorpus(root, [sanction, avisCible, ...bruit], "cnil");
      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const avis = await search(
          root,
          { question: "avis publicité ciblée cookies", corpus: "cnil", nature: "Avis", k: 5 },
          { embedder: embedderFactice(), index, seuils: { bas: -1, haut: 2, marge: 0 } },
        );

        assert.ok(avis.passages.length > 0);
        assert.ok(avis.passages.every((passage) => passage.nature === "Avis"));
        assert.equal(avis.passages[0]?.document, "CNILTEXT000055000002");
        assert.equal(avis.passages[0]?.montant, null, "un avis ne porte aucun montant de sanction");

        const sanctions = await search(
          root,
          { question: "question identique sur les cookies", corpus: "cnil", nature: "Sanction", k: 1 },
          { embedder: embedderFactice(), index, seuils: { bas: -1, haut: 2, marge: 0 } },
        );

        assert.equal(sanctions.passages.length, 1, "la fenêtre vectorielle doit être filtrée par nature");
        assert.equal(sanctions.passages[0]?.document, "CNILTEXT000055000001");
        assert.equal(sanctions.passages[0]?.montant, 100_000);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("les citations dans les réponses de search", () => {
  it("recopie sur le passage les citations du document, même si le passage ne les nomme pas", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-citations-search-"));
    try {
      ecrireCorpus(
        root,
        [
          fragment(
            "CNILTEXT000055022778",
            0,
            "La formation restreinte rappelle l'article 6 du règlement (UE) 2016/679 " +
              "et l'article 82 de la loi n° 78-17.",
          ),
          fragment("CNILTEXT000055022778", 1, "Le manquement est constitué et sera publié."),
        ],
        "cnil",
      );
      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const resultat = await search(
          root,
          { question: "manquement constitué et publié", corpus: "cnil", k: 5 },
          { embedder: embedderFactice(), index, seuils: { bas: -1, haut: 2, marge: 0 } },
        );

        const passage = resultat.passages[0];
        assert.ok(passage !== undefined);
        assert.equal(/article 6|article 82/.test(passage.texte), false);
        assert.deepEqual(
          passage.citations?.map((citation) => citation.reference),
          ["RGPD · art. 6", "loi 78-17 · art. 82"],
        );
        assert.equal(passage.citations?.[0]?.url, "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679");
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("laisse le champ absent hors des corpus de décisions", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-citations-search-"));
    try {
      ecrireCorpus(root);
      const resultat = await search(
        root,
        { question: "article 3 du RGPD" },
        { embedder: EMBEDDER_INTERDIT },
      );

      const passage = resultat.passages[0];
      assert.ok(passage !== undefined);
      assert.equal("citations" in passage, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("le second étage de rerank", () => {
  let root: string;
  let index: Index;

  const SEUILS = { bas: -1, haut: 2, marge: 0 };
  const QUESTION = "droit d'accès de la personne concernée aux données";

  before(async () => {
    root = mkdtempSync(join(tmpdir(), "vitrine-rerank-"));
    ecrireCorpus(root);
    const construit = await buildIndex(root, embedderFactice());
    index = openIndex(construit.chemin);
  });

  after(() => {
    index.db.close();
    rmSync(root, { recursive: true, force: true });
  });

  /** Reranker factice : inverse l'ordre reçu et retient la fenêtre offerte. */
  function rerankerInverse(vus: string[][] = []): Reranker {
    return {
      model: "factice-rerank",
      score: async (_question, passages) => {
        vus.push([...passages]);
        return passages.map((_, position) => position);
      },
    };
  }

  it("rend l'ordre du reranker, garde la distance dense et sa durée", async () => {
    const vus: string[][] = [];
    const dense = await search(
      root,
      { question: QUESTION, k: 5 },
      { embedder: embedderFactice(), index, seuils: SEUILS },
    );
    const tous = await search(
      root,
      { question: QUESTION, k: CANDIDATS_RERANK },
      { embedder: embedderFactice(), index, seuils: SEUILS },
    );
    const reranke = await search(
      root,
      { question: QUESTION, k: 5 },
      { embedder: embedderFactice(), index, seuils: SEUILS, rerank: rerankerInverse(vus) },
    );

    assert.equal("rerank" in dense, false, "sans reranker, aucun bloc rerank");
    assert.ok(tous.passages.length > dense.passages.length, "le second étage voit plus de k passages");
    assert.deepEqual(
      dense.passages.map((passage) => passage.ref),
      tous.passages.slice(0, 5).map((passage) => passage.ref),
      "la voie sans reranker rend le même ordre dense qu'avant",
    );
    assert.equal(vus[0]?.length, tous.passages.length);
    assert.deepEqual(
      reranke.passages.map((passage) => passage.ref),
      [...tous.passages].reverse().slice(0, 5).map((passage) => passage.ref),
      "les passages sortent dans l'ordre du reranker",
    );

    const distances = new Map(tous.passages.map((passage) => [passage.ref, passage.distance]));
    assert.deepEqual(
      reranke.passages.map((passage) => passage.distance),
      reranke.passages.map((passage) => distances.get(passage.ref)),
      "chaque passage garde sa distance dense",
    );
    assert.equal(reranke.rerank?.modele, "factice-rerank");
    assert.equal(typeof reranke.rerank?.duree_ms, "number");
    assert.ok((reranke.rerank?.duree_ms ?? -1) >= 0);
  });

  it("propage une erreur de rerank au lieu de servir le dense", async () => {
    const enPanne: Reranker = {
      model: "factice-rerank",
      score: async () => {
        throw new Error("serveur de rerank en panne");
      },
    };

    await assert.rejects(
      () =>
        search(
          root,
          { question: QUESTION, k: 5 },
          { embedder: embedderFactice(), index, seuils: SEUILS, rerank: enPanne },
        ),
      /serveur de rerank en panne/,
    );
  });

  it("refuse un reranker qui rend trop peu de scores", async () => {
    const incomplet: Reranker = {
      model: "factice-rerank",
      score: async (_question, passages) => passages.slice(1).map(() => 0.5),
    };

    await assert.rejects(
      () =>
        search(
          root,
          { question: QUESTION, k: 5 },
          { embedder: embedderFactice(), index, seuils: SEUILS, rerank: incomplet },
        ),
      /a rendu \d+ scores pour \d+ passages/,
    );
  });
});

describe("le corpus dont la table de confiance s'applique", () => {
  it("suit le corpus demandé, jamais un document fixé", () => {
    assert.equal(corpusDeNiveau({ corpus: "cnil" }), "cnil");
    assert.equal(corpusDeNiveau({}), undefined);
    assert.equal(corpusDeNiveau({ document: "CNILTEXT000055022778" }), undefined);
    assert.equal(
      corpusDeNiveau({ corpus: "cnil", document: "CNILTEXT000055022778" }),
      undefined,
    );
  });
});

describe("la recherche restreinte à un corpus", () => {
  it("ne rend aucun fragment d'un autre corpus", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-corpus-filtre-"));
    try {
      ecrireCorpus(root, SIX, "rgpd");
      ecrireCorpus(
        root,
        [
          fragment("CNILTEXT000055022778", 0, "sanction pécuniaire pour le dépôt de cookies"),
          fragment("CNILTEXT000055022778", 1, "la formation restreinte prononce une amende"),
        ],
        "cnil",
      );
      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const resultat = await search(
          root,
          { question: "sanction cookies amende", corpus: "cnil", k: 5 },
          { embedder: embedderFactice(), index, seuils: { bas: -1, haut: 2, marge: 0 } },
        );

        assert.ok(resultat.passages.length > 0);
        assert.ok(resultat.passages.every((passage) => passage.corpus === "cnil"));
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
