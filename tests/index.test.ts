import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import * as sqliteVec from "sqlite-vec";
import {
  buildIndex,
  cheminIndex,
  empreinteUnite,
  formaterJournal,
  migrerVecteurs,
} from "../mcp/index/build.ts";
import { search } from "../mcp/tools.ts";
import {
  CANDIDATS_VOIE,
  RRF_K,
  openIndex,
  rechercheHybride,
  requeteLexicale,
  searchIndex,
} from "../mcp/index/search.ts";
import {
  INSTRUCTION_AIAct,
  INSTRUCTION_REQUETE,
  createOllamaEmbedder,
  normaliser,
} from "../mcp/embed/embedder.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import type { Unite } from "../mcp/corpus/parse.ts";
import type { FetchLike } from "../veille/fetch.ts";

const DOCUMENT = "32016R0679";
const AUTRE = "32022R2065";

/** Embedder déterministe : sac de mots hachés, sans modèle ni réseau. */
function embedderFactice(dim = 8, model = "factice"): Embedder {
  const vecteur = (texte: string): number[] => {
    const valeurs = new Array<number>(dim).fill(0);
    for (const mot of texte.toLowerCase().split(/\s+/)) {
      if (mot === "") continue;
      let empreinte = 7;
      for (const caractere of mot) empreinte = (empreinte * 31 + (caractere.codePointAt(0) ?? 0)) % 1_000_003;
      valeurs[empreinte % dim] = (valeurs[empreinte % dim] ?? 0) + 1;
    }
    return normaliser(valeurs);
  };
  return {
    model,
    dim,
    embedPassages: async (textes) => textes.map(vecteur),
    embedQuery: async (texte) => vecteur(texte),
  };
}

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "vitrine-index-"));
}

/** Embedder qui compte les passages reçus et délègue au vecteur déterministe. */
function embedderCompteur(dim = 8, model = "factice"): {
  embedder: Embedder;
  compteur: { passages: number };
  textes: string[];
} {
  const base = embedderFactice(dim, model);
  const compteur = { passages: 0 };
  const textes: string[] = [];
  return {
    compteur,
    textes,
    embedder: {
      model,
      dim,
      embedPassages: async (entrees) => {
        compteur.passages += entrees.length;
        textes.push(...entrees);
        return base.embedPassages(entrees);
      },
      embedQuery: base.embedQuery,
    },
  };
}

/** Vecteurs de l'index, par `ref`, en hexadécimal pour comparer les octets. */
function vecteurs(chemin: string): Map<string, string> {
  const db = new DatabaseSync(chemin, { allowExtension: true });
  try {
    sqliteVec.load(db);
    const lignes = db
      .prepare(
        `SELECT u.ref AS ref, v.embedding AS embedding
           FROM unites u JOIN vec_unites v ON v.rowid = u.rowid
          ORDER BY u.ref`,
      )
      .all() as { ref: string; embedding: Uint8Array }[];
    return new Map(lignes.map((ligne) => [ligne.ref, Buffer.from(ligne.embedding).toString("hex")]));
  } finally {
    db.close();
  }
}

/** `ref → rowid` de l'index. */
function rowids(chemin: string): Map<string, number> {
  const db = new DatabaseSync(chemin);
  try {
    const lignes = db.prepare("SELECT ref, rowid FROM unites ORDER BY ref").all() as {
      ref: string;
      rowid: number | bigint;
    }[];
    return new Map(lignes.map((ligne) => [ligne.ref, Number(ligne.rowid)]));
  } finally {
    db.close();
  }
}

function unite(
  numero: number,
  texte: string,
  document = DOCUMENT,
  niveau: Unite["niveau"] = "article",
): Unite {
  return {
    ref: `${document}#${niveau === "article" ? "art" : "rct"}_${numero}`,
    document,
    corpus: document === DOCUMENT ? "rgpd" : "dsa",
    niveau,
    numero: String(numero),
    chemin: "RGPD > Chapitre I > Dispositions générales",
    texte,
    date_acte: "2016-04-27",
    date_debut: "2018-05-25",
    date_fin: null,
    statut: "en_vigueur",
    url: `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${document}#art_${numero}`,
  };
}

/** Écrit `data/corpus/<corpus>/unites.jsonl` sous la racine temporaire. */
function ecrireCorpus(root: string, corpus: string, unites: Unite[]): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(
    join(dossier, "unites.jsonl"),
    `${unites.map((u) => JSON.stringify(u)).join("\n")}\n`,
    "utf8",
  );
}

const SIX = [
  unite(1, "objet et objectifs du règlement"),
  unite(2, "champ d'application matériel"),
  unite(3, "droit d'accès de la personne concernée aux données"),
  unite(4, "droit de rectification des données inexactes"),
  unite(5, "principes relatifs au traitement des données"),
  unite(6, "licéité du traitement des données personnelles"),
];

describe("l'adaptateur Ollama", () => {
  it("appelle /api/embed et normalise les vecteurs", async () => {
    let url = "";
    let corps = "";
    const fetchImpl: FetchLike = async (demande, init) => {
      url = demande;
      corps = init?.body ?? "";
      return { ok: true, status: 200, text: async () => JSON.stringify({ embeddings: [[3, 4]] }) };
    };

    const embedder = createOllamaEmbedder({ host: "http://127.0.0.1:9999", dim: 2, fetchImpl });
    const vecteur = await embedder.embedQuery("test");

    assert.equal(url, "http://127.0.0.1:9999/api/embed");
    assert.deepEqual(JSON.parse(corps), {
      model: "qwen3-embedding:0.6b",
      input: [`${INSTRUCTION_REQUETE}test`],
    });
    assert.deepEqual(vecteur, [0.6, 0.8]);
    assert.equal(embedder.dim, 2);
  });

  it("préfixe la requête sans toucher aux passages", async () => {
    const entrees: unknown[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      entrees.push(JSON.parse(init?.body ?? "{}").input);
      return { ok: true, status: 200, text: async () => JSON.stringify({ embeddings: [[1, 0]] }) };
    };
    const embedder = createOllamaEmbedder({ dim: 2, fetchImpl });

    await embedder.embedQuery("question");
    await embedder.embedPassages(["passage"]);

    assert.deepEqual(entrees, [[`${INSTRUCTION_REQUETE}question`], ["passage"]]);
  });

  it("choisit l'instruction du document et retombe sur le défaut", async () => {
    const entrees: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      entrees.push((JSON.parse(init?.body ?? "{}").input as string[])[0] ?? "");
      return { ok: true, status: 200, text: async () => JSON.stringify({ embeddings: [[1, 0]] }) };
    };
    const embedder = createOllamaEmbedder({ dim: 2, fetchImpl });

    await embedder.embedQuery("même question", "32024R1689");
    await embedder.embedQuery("même question", "32016R0679");
    await embedder.embedQuery("même question", "document-inconnu");
    await embedder.embedQuery("même question");

    assert.deepEqual(entrees, [
      `${INSTRUCTION_AIAct}même question`,
      `${INSTRUCTION_REQUETE}même question`,
      `${INSTRUCTION_REQUETE}même question`,
      `${INSTRUCTION_REQUETE}même question`,
    ]);
  });

  it("laisse choisir les instructions et le défaut", async () => {
    const entrees: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      entrees.push((JSON.parse(init?.body ?? "{}").input as string[])[0] ?? "");
      return { ok: true, status: 200, text: async () => JSON.stringify({ embeddings: [[1, 0]] }) };
    };
    const embedder = createOllamaEmbedder({
      dim: 2,
      fetchImpl,
      instructions: { X: "Instruction X : " },
      defaut: "Instruction par défaut : ",
    });

    await embedder.embedQuery("q", "X");
    await embedder.embedQuery("q", "Y");

    assert.deepEqual(entrees, ["Instruction X : q", "Instruction par défaut : q"]);
  });

  it("nomme ollama pull quand le modèle manque", async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 404, text: async () => "" });
    const embedder = createOllamaEmbedder({ dim: 2, fetchImpl });

    await assert.rejects(embedder.embedQuery("test"), /ollama pull qwen3-embedding:0\.6b/);
  });

  it("nomme ollama pull quand l'hôte ne répond pas", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("ECONNREFUSED");
    };
    const embedder = createOllamaEmbedder({ dim: 2, fetchImpl });

    await assert.rejects(embedder.embedQuery("test"), /ollama pull qwen3-embedding:0\.6b/);
  });

  it("refuse une dimension inattendue", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ embeddings: [[1, 2, 3]] }),
    });
    const embedder = createOllamaEmbedder({ dim: 2, fetchImpl });

    await assert.rejects(embedder.embedQuery("test"), /3 dimensions, 2 attendues/);
  });

  it(
    "contrôle le vrai modèle quand MCP_TEST_OLLAMA=1",
    { skip: process.env.MCP_TEST_OLLAMA !== "1" },
    async () => {
      const embedder = createOllamaEmbedder(
        process.env.OLLAMA_HOST === undefined ? {} : { host: process.env.OLLAMA_HOST },
      );
      const vecteur = await embedder.embedQuery("effacement");

      assert.equal(vecteur.length, 1024);
      const norme = Math.sqrt(vecteur.reduce((total, valeur) => total + valeur * valeur, 0));
      assert.ok(Math.abs(norme - 1) < 1e-5);
    },
  );
});

describe("buildIndex", () => {
  it("nomme le fichier quand une unité n'a pas de corpus", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const chemin = join(root, "data", "corpus", "rgpd", "unites.jsonl");
      const lignes = readFileSync(chemin, "utf8")
        .trimEnd()
        .split("\n")
        .map((ligne) => JSON.parse(ligne) as Record<string, unknown>);
      delete lignes[0]?.corpus;
      writeFileSync(chemin, `${lignes.map((ligne) => JSON.stringify(ligne)).join("\n")}\n`, "utf8");

      await assert.rejects(
        buildIndex(root, embedderFactice()),
        /Unité sans corpus.*corpus:build/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("construit l'index, son meta et ses six unités", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const resultat = await buildIndex(root, embedderFactice());

      assert.equal(resultat.unites, 6);
      assert.equal(resultat.chemin, cheminIndex(root));
      assert.ok(existsSync(resultat.chemin));
      assert.ok(!existsSync(`${resultat.chemin}.tmp`));

      const index = openIndex(resultat.chemin);
      try {
        assert.equal(index.model, "factice");
        assert.equal(index.dim, 8);
        const nombre = index.db.prepare("SELECT count(*) AS n FROM unites").get() as { n: number };
        assert.equal(Number(nombre.n), 6);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("insère un rowid explicite sans erreur d'entier", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { chemin } = await buildIndex(root, embedderFactice());

      const db = new DatabaseSync(chemin, { allowExtension: true });
      try {
        sqliteVec.load(db);
        db.prepare(
          "INSERT INTO vec_unites (rowid, corpus, document, date_num, type_sanction, montant, numero, injonction, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
          BigInt(1000),
          "rgpd",
          DOCUMENT,
          0n,
          "autre",
          -1n,
          "1",
          0n,
          JSON.stringify([1, 0, 0, 0, 0, 0, 0, 0]),
        );
        const nombre = db.prepare("SELECT count(*) AS n FROM vec_unites").get() as { n: number };
        assert.equal(Number(nombre.n), 7);
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reconstruit complètement un index d'une autre dimension", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      await buildIndex(root, embedderFactice(8));

      const { embedder, compteur } = embedderCompteur(4);
      const resultat = await buildIndex(root, embedder);

      assert.equal(resultat.mode, "complet");
      assert.match(resultat.raison ?? "", /index construit avec factice \(8 dimensions\)/);
      assert.deepEqual(resultat.delta, {
        ajoutees: 6,
        modifiees: 0,
        supprimees: 0,
        inchangees: 0,
      });
      assert.equal(compteur.passages, 6);
      const index = openIndex(resultat.chemin);
      try {
        assert.equal(index.dim, 4);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("indexe un second descripteur et le filtre par document", async () => {    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      ecrireCorpus(root, "dsa", [unite(1, "obligations des plateformes", AUTRE), unite(2, "publicité ciblée", AUTRE)]);

      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        assert.equal(index.unites, 8);
        const vecteur = await embedderFactice().embedQuery("publicité ciblée");
        const resultats = searchIndex(index, vecteur, { k: 2, document: AUTRE });

        assert.equal(resultats.length, 2);
        assert.ok(resultats.every((resultat) => resultat.document === AUTRE));
        assert.equal(resultats[0]?.ref, `${AUTRE}#art_2`);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("n'affame pas un corpus minoritaire quand un autre le domine", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", [unite(1, "sujet sans rapport", DOCUMENT)]);
      const bruit = Array.from({ length: 100 }, (_, index) =>
        unite(index + 1, "question identique", AUTRE),
      );
      ecrireCorpus(root, "dsa", bruit);

      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const vecteur = await embedderFactice().embedQuery("question identique");
        const rgpd = searchIndex(index, vecteur, { k: 1, corpus: "rgpd" });
        assert.equal(rgpd.length, 1, "la fenêtre vectorielle doit être filtrée par corpus");
        assert.equal(rgpd[0]?.ref, `${DOCUMENT}#art_1`);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("dégrade un index puis le migre sans ré-embarquer", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { chemin } = await buildIndex(root, embedderFactice());
      const vecteur = await embedderFactice().embedQuery("effacement des données");
      const avant = (() => {
        const index = openIndex(chemin);
        try {
          return searchIndex(index, vecteur, { k: 3 }).map((r) => r.ref);
        } finally {
          index.db.close();
        }
      })();

      const db = new DatabaseSync(chemin, { allowExtension: true });
      try {
        sqliteVec.load(db);
        const lignes = db
          .prepare("SELECT rowid, embedding FROM vec_unites")
          .all() as { rowid: number | bigint; embedding: Uint8Array }[];
        db.exec("DROP TABLE vec_unites");
        db.exec("CREATE VIRTUAL TABLE vec_unites USING vec0(embedding float[8] distance_metric=cosine)");
        const inserer = db.prepare("INSERT INTO vec_unites (rowid, embedding) VALUES (?, ?)");
        for (const ligne of lignes) inserer.run(BigInt(ligne.rowid), ligne.embedding);
        assert.throws(() => openIndex(chemin), /colonnes corpus\/métadonnées/);
        assert.equal(migrerVecteurs(db, 8, SIX.map((u) => ({ ...u, corpus: "rgpd" }))), true);
      } finally {
        db.close();
      }

      const index = openIndex(chemin);
      try {
        assert.equal(
          (index.db.prepare("SELECT count(*) AS n FROM vec_unites").get() as { n: number }).n,
          SIX.length,
        );
        assert.deepEqual(
          searchIndex(index, vecteur, { k: 3 }).map((r) => r.ref),
          avant,
          "la migration doit rendre les mêmes résultats",
        );
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'affame pas un document quand son corpus en porte beaucoup d'autres", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", [unite(1, "sujet sans rapport", DOCUMENT)]);
      const bruit = Array.from({ length: 100 }, (_, index) =>
        unite(index + 1, "question identique", AUTRE),
      );
      ecrireCorpus(root, "dsa", bruit);

      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const vecteur = await embedderFactice().embedQuery("question identique");
        const resultats = searchIndex(index, vecteur, { k: 1, document: DOCUMENT });
        assert.equal(resultats.length, 1, "la fenêtre vectorielle doit être filtrée par document");
        assert.equal(resultats[0]?.ref, `${DOCUMENT}#art_1`);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("filtre une décision CNIL par date, type, montant et numéro", async () => {
    const root = tempRoot();
    try {
      const decision = (
        id: string,
        texte: string,
        date: string,
        type_sanction: string,
        montant: number | null,
        numero: string,
      ): Unite => ({
        ref: `${id}#f1`,
        document: id,
        corpus: "cnil",
        niveau: "fragment",
        numero,
        chemin: `CNIL > Sanctions > Délibération ${numero}`,
        texte,
        date_acte: date,
        date_debut: date,
        date_fin: null,
        statut: "VIGUEUR",
        url: `https://example.test/${id}`,
        type_sanction,
        montant,
        injonction: false,
      });
      ecrireCorpus(root, "cnil", [
        decision("CNILTEXT000000001", "sanction cookies 2024", "2024-01-01", "amende", 100_000, "SAN-2024-001"),
        decision("CNILTEXT000000002", "avertissement 2025", "2025-01-01", "avertissement", null, "SAN-2025-001"),
        decision("CNILTEXT000000003", "amende 27 millions 2026", "2026-01-01", "amende", 27_000_000, "SAN-2026-001"),
      ]);

      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const vecteur = await embedderFactice().embedQuery("sanction cookies amende");
        const parDate = searchIndex(index, vecteur, {
          k: 5,
          corpus: "cnil",
          date_min: "2025-01-01",
          date_max: "2025-12-31",
        });
        assert.deepEqual(parDate.map((r) => r.document), ["CNILTEXT000000002"]);

        const parType = searchIndex(index, vecteur, { k: 5, corpus: "cnil", type_sanction: "amende" });
        assert.deepEqual(parType.map((r) => r.document).sort(), ["CNILTEXT000000001", "CNILTEXT000000003"]);

        const parMontant = searchIndex(index, vecteur, { k: 5, corpus: "cnil", montant_min: 1_000_000 });
        assert.deepEqual(parMontant.map((r) => r.document), ["CNILTEXT000000003"]);
        assert.equal(parMontant[0]?.montant, 27_000_000);

        const parNumero = searchIndex(index, vecteur, { k: 5, corpus: "cnil", numero: "SAN-2026-001" });
        assert.deepEqual(parNumero.map((r) => r.document), ["CNILTEXT000000003"]);

        assert.throws(
          () => searchIndex(index, vecteur, { k: 5, corpus: "cnil", date_min: "2025-13-40" }),
          /date_min attendu AAAA-MM-JJ/,
        );

        const outil = await search(
          root,
          { question: "sanction", k: 5, corpus: "cnil", type_sanction: "amende" },
          { embedder: embedderFactice(), index, seuils: { bas: -1, haut: 2, marge: 0 } },
        );
        assert.ok(outil.passages.length > 0);
        assert.ok(outil.passages.every((passage) => passage.type_sanction === "amende"));
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'affame pas un type minoritaire quand un autre le domine", async () => {
    const root = tempRoot();
    try {
      const cible: Unite = {
        ref: "CNILTEXT000000001#f1",
        document: "CNILTEXT000000001",
        corpus: "cnil",
        niveau: "fragment",
        numero: "SAN-2026-001",
        chemin: "CNIL > Sanctions > Délibération SAN-2026-001",
        texte: "sujet sans rapport",
        date_acte: "2026-01-01",
        date_debut: "2026-01-01",
        date_fin: null,
        statut: "VIGUEUR",
        url: "https://example.test/1",
        type_sanction: "amende",
        montant: 27_000_000,
        injonction: false,
      };
      const bruit: Unite[] = Array.from({ length: 100 }, (_, index) => ({
        ...cible,
        ref: `CNILTEXT0000001${String(index).padStart(2, "0")}#f1`,
        document: `CNILTEXT0000001${String(index).padStart(2, "0")}`,
        texte: "question identique",
        type_sanction: "avertissement",
        montant: null,
      }));
      ecrireCorpus(root, "cnil", [cible, ...bruit]);

      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const vecteur = await embedderFactice().embedQuery("question identique");
        const resultats = searchIndex(index, vecteur, { k: 1, corpus: "cnil", type_sanction: "amende" });
        assert.equal(resultats.length, 1, "la fenêtre vectorielle doit être filtrée par type");
        assert.equal(resultats[0]?.document, "CNILTEXT000000001");
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("filtre par corpus et laisse tous les corpus répondre sans filtre", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      ecrireCorpus(root, "dsa", [
        unite(1, "obligations des plateformes", AUTRE),
        unite(2, "publicité ciblée", AUTRE),
        unite(3, "publicité ciblée des plateformes", AUTRE),
      ]);

      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const vecteur = await embedderFactice().embedQuery("publicité ciblée");
        const rgpd = searchIndex(index, vecteur, { k: 9, corpus: "rgpd" });
        const dsa = searchIndex(index, vecteur, { k: 9, corpus: "dsa" });
        const tous = searchIndex(index, vecteur, { k: 9 });

        assert.equal(rgpd.length, 6);
        assert.ok(rgpd.every((resultat) => resultat.corpus === "rgpd"));
        assert.equal(dsa.length, 3);
        assert.ok(dsa.every((resultat) => resultat.corpus === "dsa"));
        assert.equal(tous.length, 9);
        assert.deepEqual(
          searchIndex(index, vecteur, { k: 9, corpus: "inconnu" }),
          [],
          "un corpus inconnu rend zéro résultat, jamais une erreur SQL",
        );
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse un index sans colonne corpus en nommant la commande", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { chemin } = await buildIndex(root, embedderFactice());

      const db = new DatabaseSync(chemin, { allowExtension: true });
      db.exec("DROP TABLE unites");
      db.exec("CREATE TABLE unites (ref TEXT, document TEXT, empreinte TEXT)");
      db.close();

      assert.throws(
        () => openIndex(chemin),
        /Index sans colonnes corpus\/métadonnées.*npm run corpus:index/,
      );

      const resultat = await buildIndex(root, embedderFactice());
      assert.equal(resultat.mode, "complet");
      assert.match(resultat.raison ?? "", /sans colonne corpus/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("buildIndex incrémental", () => {
  it("embarque six passages au premier passage puis zéro au second, vecteurs identiques", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { embedder, compteur } = embedderCompteur();
      const premier = await buildIndex(root, embedder);
      assert.equal(premier.mode, "complet");
      assert.equal(compteur.passages, 6);
      const avant = vecteurs(premier.chemin);

      const second = await buildIndex(root, embedder);
      assert.equal(second.mode, "incremental");
      assert.deepEqual(second.delta, {
        ajoutees: 0,
        modifiees: 0,
        supprimees: 0,
        inchangees: 6,
      });
      assert.equal(compteur.passages, 6);
      assert.deepEqual(vecteurs(second.chemin), avant);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'embarque que l'unité ajoutée et lui donne un rowid après le maximum", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { embedder, compteur } = embedderCompteur();
      const { chemin } = await buildIndex(root, embedder);
      const avant = rowids(chemin);
      const vecteursAvant = vecteurs(chemin);

      ecrireCorpus(root, "rgpd", [...SIX, unite(7, "droit à la portabilité des données")]);
      const resultat = await buildIndex(root, embedder);

      assert.deepEqual(resultat.delta, {
        ajoutees: 1,
        modifiees: 0,
        supprimees: 0,
        inchangees: 6,
      });
      assert.equal(compteur.passages, 7);
      const apres = rowids(chemin);
      for (const [ref, rowid] of avant) assert.equal(apres.get(ref), rowid, ref);
      assert.equal(apres.get(`${DOCUMENT}#art_7`), Math.max(...avant.values()) + 1);

      const vecteursApres = vecteurs(chemin);
      for (const [ref, vecteur] of vecteursAvant) assert.equal(vecteursApres.get(ref), vecteur, ref);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'embarque qu'une unité modifiée et garde les autres vecteurs identiques", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { embedder, compteur } = embedderCompteur();
      const { chemin } = await buildIndex(root, embedder);
      const vecteursAvant = vecteurs(chemin);

      ecrireCorpus(
        root,
        "rgpd",
        SIX.map((element, index) =>
          index === 2 ? { ...element, texte: "droit d'accès corrigé aux données" } : element,
        ),
      );
      const resultat = await buildIndex(root, embedder);

      assert.deepEqual(resultat.delta, {
        ajoutees: 0,
        modifiees: 1,
        supprimees: 0,
        inchangees: 5,
      });
      assert.equal(compteur.passages, 7);
      const vecteursApres = vecteurs(chemin);
      for (const [ref, vecteur] of vecteursAvant) {
        if (ref === `${DOCUMENT}#art_3`) assert.notEqual(vecteursApres.get(ref), vecteur, ref);
        else assert.equal(vecteursApres.get(ref), vecteur, ref);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("supprime la ligne et le vecteur sans rien embarquer", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { embedder, compteur } = embedderCompteur();
      const { chemin } = await buildIndex(root, embedder);

      ecrireCorpus(root, "rgpd", SIX.slice(0, 5));
      const resultat = await buildIndex(root, embedder);

      assert.deepEqual(resultat.delta, {
        ajoutees: 0,
        modifiees: 0,
        supprimees: 1,
        inchangees: 5,
      });
      assert.equal(compteur.passages, 6);
      assert.equal(rowids(chemin).has(`${DOCUMENT}#art_6`), false);
      assert.equal(vecteurs(chemin).has(`${DOCUMENT}#art_6`), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("attribue les nouveaux rowid hors de la position du corpus", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { embedder } = embedderCompteur();
      const { chemin } = await buildIndex(root, embedder);
      const avant = rowids(chemin);

      ecrireCorpus(root, "rgpd", [unite(7, "nouvelle unité en tête"), ...SIX]);
      await buildIndex(root, embedder);

      const apres = rowids(chemin);
      for (const [ref, rowid] of avant) assert.equal(apres.get(ref), rowid, ref);
      assert.equal(apres.get(`${DOCUMENT}#art_7`), Math.max(...avant.values()) + 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("annule tout le delta quand l'embedding échoue", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { embedder } = embedderCompteur();
      const { chemin } = await buildIndex(root, embedder);
      const avant = vecteurs(chemin);

      ecrireCorpus(
        root,
        "rgpd",
        SIX.map((element, index) =>
          index === 2 ? { ...element, texte: "texte qui ne doit jamais être écrit" } : element,
        ),
      );
      const enPanne: Embedder = {
        model: "factice",
        dim: 8,
        embedPassages: async () => {
          throw new Error("panne d'embedding");
        },
        embedQuery: async () => {
          throw new Error("panne d'embedding");
        },
      };

      await assert.rejects(buildIndex(root, enPanne), /panne d'embedding/);
      assert.deepEqual(vecteurs(chemin), avant);
      assert.ok(!existsSync(`${chemin}.tmp`));
      const index = openIndex(chemin);
      try {
        const ligne = index.db
          .prepare("SELECT texte FROM unites WHERE ref = ?")
          .get(`${DOCUMENT}#art_3`) as { texte: string };
        assert.match(ligne.texte, /droit d'accès de la personne concernée/);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fait dépendre l'empreinte du modèle, de la dimension et du passage", () => {
    const base = empreinteUnite(SIX[0]!, embedderFactice(8, "factice"));

    assert.notEqual(base, empreinteUnite(SIX[0]!, embedderFactice(8, "autre")));
    assert.notEqual(base, empreinteUnite(SIX[0]!, embedderFactice(4, "factice")));
    assert.notEqual(base, empreinteUnite({ ...SIX[0]!, texte: "autre texte" }, embedderFactice()));
    assert.equal(base, empreinteUnite(SIX[0]!, embedderFactice()));
  });

  it("journalise les quatre comptes du delta", () => {
    const journal = formaterJournal(
      {
        chemin: "/tmp/index.db",
        unites: 7,
        mode: "incremental",
        delta: { ajoutees: 1, modifiees: 2, supprimees: 3, inchangees: 4 },
      },
      embedderFactice(),
    );

    assert.match(journal, /1 ajoutées/);
    assert.match(journal, /2 modifiées/);
    assert.match(journal, /3 supprimées/);
    assert.match(journal, /4 inchangées/);
  });
});

describe("searchIndex", () => {
  it("rend les k meilleurs passages par distance croissante", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const embedder = embedderFactice();
      const { chemin } = await buildIndex(root, embedder);
      const index = openIndex(chemin);
      try {
        const vecteur = await embedder.embedQuery(SIX[2]?.texte ?? "");
        const resultats = searchIndex(index, vecteur, { k: 3 });

        assert.equal(resultats.length, 3);
        assert.equal(resultats[0]?.ref, `${DOCUMENT}#art_3`);
        assert.equal(resultats[0]?.document, DOCUMENT);
        assert.equal(resultats[0]?.date_acte, "2016-04-27");
        assert.equal(resultats[0]?.url, SIX[2]?.url);
        const distances = resultats.map((resultat) => resultat.distance);
        assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("nomme npm run corpus:index quand l'index manque", () => {
    const root = tempRoot();
    try {
      assert.throws(() => openIndex(join(root, "absent.db")), /npm run corpus:index/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse un vecteur d'une autre dimension que l'index", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        assert.throws(() => searchIndex(index, [1, 0, 0], { k: 2 }), /3 dimensions pour un index de 8/);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("l'index réel", () => {
  it("garde le fichier hors de git", () => {
    const ignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
    assert.match(ignore, /data\/corpus\/index\//);
  });
});

/** Rowids de `unites`, triés. */
function rowidsUnites(chemin: string): number[] {
  return [...rowids(chemin).values()].sort((gauche, droite) => gauche - droite);
}

/** Rowids rendus par FTS5 pour une requête (un seul mot), triés. */
function rowidsLexicaux(chemin: string, mot: string): number[] {
  const db = new DatabaseSync(chemin);
  try {
    const lignes = db
      .prepare("SELECT rowid FROM fts_unites WHERE fts_unites MATCH ? ORDER BY rowid")
      .all(`"${mot}"`) as { rowid: number | bigint }[];
    return lignes.map((ligne) => Number(ligne.rowid));
  } finally {
    db.close();
  }
}

function nombreFts(chemin: string): number {
  const db = new DatabaseSync(chemin);
  try {
    return Number((db.prepare("SELECT count(*) AS n FROM fts_unites").get() as { n: number }).n);
  } finally {
    db.close();
  }
}

describe("la table lexicale", () => {
  it("crée fts_unites avec le rowid de unites et retrouve « autorite chef de file »", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", [
        ...SIX,
        unite(7, "autorité chef de file pour les traitements transfrontaliers"),
      ]);
      const { chemin } = await buildIndex(root, embedderFactice());

      assert.deepEqual(rowidsLexicaux(chemin, "autorité"), rowidsUnites(chemin).filter((rowid) => rowid === 7));
      assert.equal(nombreFts(chemin), 7);
      assert.deepEqual(
        rowidsLexicaux(chemin, "chef"),
        rowidsLexicaux(chemin, "autorité"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("suit le delta : un ajout entre, une modification remplace, une suppression sort", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { embedder } = embedderCompteur();
      const premier = await buildIndex(root, embedder);
      assert.equal(nombreFts(premier.chemin), 6);
      assert.deepEqual(rowidsLexicaux(premier.chemin, "licéité"), [
        Number(rowids(premier.chemin).get(`${DOCUMENT}#art_6`)),
      ]);

      ecrireCorpus(root, "rgpd", [...SIX, unite(7, "nouveau terme lexical")]);
      const ajout = await buildIndex(root, embedder);
      assert.equal(nombreFts(ajout.chemin), 7);
      assert.deepEqual(rowidsLexicaux(ajout.chemin, "lexical"), [
        Number(rowids(ajout.chemin).get(`${DOCUMENT}#art_7`)),
      ]);

      ecrireCorpus(
        root,
        "rgpd",
        [...SIX, unite(7, "nouveau terme lexical")].map((element) =>
          element.ref === `${DOCUMENT}#art_3`
            ? { ...element, texte: "zirconium des données" }
            : element,
        ),
      );
      const modification = await buildIndex(root, embedder);
      assert.equal(nombreFts(modification.chemin), 7);
      assert.deepEqual(rowidsLexicaux(modification.chemin, "zirconium"), [
        Number(rowids(modification.chemin).get(`${DOCUMENT}#art_3`)),
      ]);
      assert.deepEqual(rowidsLexicaux(modification.chemin, "accès"), []);

      ecrireCorpus(root, "rgpd", [...SIX.slice(0, 5), unite(7, "nouveau terme lexical")]);
      const suppression = await buildIndex(root, embedder);
      assert.equal(nombreFts(suppression.chemin), 6);
      assert.deepEqual(rowidsLexicaux(suppression.chemin, "licéité"), []);
      assert.deepEqual(rowidsLexicaux(suppression.chemin, "lexical"), [
        Number(rowids(suppression.chemin).get(`${DOCUMENT}#art_7`)),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reconstruit un index sans table lexicale plutôt que de le compléter à moitié", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const premier = await buildIndex(root, embedderFactice());
      const db = new DatabaseSync(premier.chemin);
      try {
        db.exec("DROP TABLE fts_unites");
      } finally {
        db.close();
      }

      const { embedder, compteur } = embedderCompteur();
      const second = await buildIndex(root, embedder);

      assert.equal(second.mode, "complet");
      assert.match(second.raison ?? "", /sans table lexicale/);
      assert.equal(compteur.passages, 6);
      assert.equal(nombreFts(second.chemin), 6);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("la fusion hybride", () => {
  it("construit une requête FTS5 sans mots outils ni syntaxe brute", () => {
    assert.equal(requeteLexicale("Quel est le droit de récupérer mes données ?"), '"droit" OR "récupérer" OR "données"');
    assert.equal(requeteLexicale("le la les de des"), null);
    assert.equal(requeteLexicale('terme "cité"'), '"terme" OR "cité"');
  });

  it("retrouve par le lexical un terme rare absent du classement dense", async () => {
    const root = tempRoot();
    try {
      const corpus = [
        unite(1, "alpha beta"),
        unite(2, "gamma delta"),
        unite(3, "epsilon zirconium"),
      ];
      const embedder: Embedder = {
        model: "factice",
        dim: 4,
        embedPassages: async (textes) =>
          textes.map((texte) => (texte.includes("zirconium") ? [0, 1, 0, 0] : [1, 0, 0, 0])),
        embedQuery: async () => [1, 0, 0, 0],
      };
      ecrireCorpus(root, "rgpd", corpus);
      const { chemin } = await buildIndex(root, embedder);
      const index = openIndex(chemin);
      try {
        const vecteur = await embedder.embedQuery("zirconium");
        const dense = searchIndex(index, vecteur, { k: 3 });
        assert.notEqual(dense[0]?.ref, `${DOCUMENT}#art_3`);
        assert.equal(dense.at(-1)?.ref, `${DOCUMENT}#art_3`);

        const hybride = rechercheHybride(index, vecteur, "zirconium", { k: 3 });
        assert.equal(hybride[0]?.ref, `${DOCUMENT}#art_3`);
        assert.ok(Math.abs((hybride[0]?.distance ?? 0) - 1) < 1e-6);
        assert.equal(hybride.length, 3);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("place un passage classé par les deux voies devant un passage classé par une seule", async () => {
    const root = tempRoot();
    try {
      const corpus = [unite(1, "alpha"), unite(2, "beta")];
      const embedder: Embedder = {
        model: "factice",
        dim: 4,
        embedPassages: async (textes) =>
          textes.map((texte) => (texte.includes("alpha") ? [0, 1, 0, 0] : [1, 0, 0, 0])),
        embedQuery: async () => [1, 0, 0, 0],
      };
      ecrireCorpus(root, "rgpd", corpus);
      const { chemin } = await buildIndex(root, embedder);
      const index = openIndex(chemin);
      try {
        const vecteur = await embedder.embedQuery("alpha");
        const dense = searchIndex(index, vecteur, { k: 2 });
        assert.equal(dense[0]?.ref, `${DOCUMENT}#art_2`);

        const hybride = rechercheHybride(index, vecteur, "alpha", { k: 2 });
        assert.deepEqual(
          hybride.map((resultat) => resultat.ref),
          [`${DOCUMENT}#art_1`, `${DOCUMENT}#art_2`],
        );
        assert.ok(Math.abs((hybride[0]?.distance ?? 0) - 1) < 1e-6);
        assert.equal(CANDIDATS_VOIE, 50);
        assert.equal(RRF_K, 60);
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("laisse la voie dense seule décider quand aucun mot lexical ne subsiste", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      const { embedder } = embedderCompteur();
      const { chemin } = await buildIndex(root, embedder);
      const index = openIndex(chemin);
      try {
        const vecteur = await embedder.embedQuery("le la les de des");
        const dense = searchIndex(index, vecteur, { k: 3 });
        const hybride = rechercheHybride(index, vecteur, "le la les de des", { k: 3 });

        assert.deepEqual(
          hybride.map((resultat) => resultat.ref),
          dense.map((resultat) => resultat.ref),
        );
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
