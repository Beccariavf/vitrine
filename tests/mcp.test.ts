import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SEUIL_BAS, SEUIL_HAUT, niveauConfiance } from "../mcp/confidence.ts";
import { normaliser } from "../mcp/embed/embedder.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { buildIndex } from "../mcp/index/build.ts";
import { BANDE_ARTICLE, openIndex, rangerPassages } from "../mcp/index/search.ts";
import type { Index, ResultatRecherche } from "../mcp/index/search.ts";
import { createServer } from "../mcp/server.ts";
import { documentNomme, getArticle, search } from "../mcp/tools.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const DOCUMENT = "32016R0679";
const DOCUMENT_AIAct = "32024R1689";

function unite(numero: number, texte: string, document = DOCUMENT): Unite {
  return {
    ref: `${document}#art_${numero}`,
    document,
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
  it("lit un article exact", () => {
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

  it("expose exactement get_article et search", async () => {
    const { tools } = await client.listTools();

    assert.deepEqual(
      tools.map((outil) => outil.name).sort(),
      ["get_article", "search"],
    );
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
