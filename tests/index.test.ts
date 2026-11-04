import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import * as sqliteVec from "sqlite-vec";
import { buildIndex, cheminIndex } from "../mcp/index/build.ts";
import { openIndex, searchIndex } from "../mcp/index/search.ts";
import { INSTRUCTION_REQUETE, createOllamaEmbedder, normaliser } from "../mcp/embed/embedder.ts";
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

function unite(
  numero: number,
  texte: string,
  document = DOCUMENT,
  niveau: Unite["niveau"] = "article",
): Unite {
  return {
    ref: `${document}#${niveau === "article" ? "art" : "rct"}_${numero}`,
    document,
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
        db.prepare("INSERT INTO vec_unites (rowid, embedding) VALUES (?, ?)").run(
          BigInt(1000),
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

  it("refuse de réutiliser un index d'une autre dimension", async () => {
    const root = tempRoot();
    try {
      ecrireCorpus(root, "rgpd", SIX);
      await buildIndex(root, embedderFactice(8));

      await assert.rejects(
        buildIndex(root, embedderFactice(4)),
        /Index existant construit avec factice \(8 dimensions\).*supprimez/s,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("indexe un second descripteur et le filtre par document", async () => {
    const root = tempRoot();
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
