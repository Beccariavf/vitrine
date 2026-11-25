import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { actesSuivis, requeteConsolidations } from "../veille/sources/eurlex.ts";
import { synchroniserActeUe } from "../mcp/corpus/actes-ue.ts";
import { buildCorpusSet, lireDescripteurs } from "../mcp/corpus/build.ts";
import { documentsPresents, extraireCitations, marquerPresence } from "../mcp/corpus/citations.ts";
import { corpusDeLEntree } from "../mcp/corpus/veille.ts";
import type { Descripteur, Unite } from "../mcp/corpus/parse.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { documentsNommes, getArticle, referenceExacte, search } from "../mcp/tools.ts";
import type { FetchLike } from "../veille/fetch.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Actes d'application de l'AI Act, distincts de la consolidation `32024R1689`. */
const ACTES = ["32026R2487", "32025R0454", "32026D2274"];
const AI_ACT = "32024R1689";

type ManifesteAiact = {
  documents: {
    document: string;
    version: string;
    snapshot: string;
    snapshot_considerants?: string;
    unites: number;
    couverture: { comptes: Record<string, number> };
  }[];
  unites: number;
};

function manifesteAiact(): ManifesteAiact {
  return JSON.parse(
    readFileSync(join(ROOT, "data", "corpus", "aiact", "manifest.json"), "utf8"),
  ) as ManifesteAiact;
}

function unitesAiact(): Unite[] {
  return readFileSync(join(ROOT, "data", "corpus", "aiact", "unites.jsonl"), "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim() !== "")
    .map((ligne) => JSON.parse(ligne) as Unite);
}

/** Chemin du snapshot brut d'un document, adressé par son `sha256`. */
function snapshot(nom: string): string {
  return join(ROOT, "data", "raw", nom.slice(0, 2), nom);
}

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

describe("corpus aiact multi-documents", () => {
  it("déclare les trois actes d'application avec la consolidation de l'AI Act", () => {
    const descripteurs = lireDescripteurs().filter(
      (descripteur) => descripteur.corpus === "aiact",
    );
    assert.deepEqual(
      descripteurs.map((descripteur) => descripteur.document).sort(),
      [...ACTES, AI_ACT].sort(),
    );
    for (const descripteur of descripteurs.filter((candidat) => ACTES.includes(candidat.document))) {
      assert.equal(descripteur.parseur, "donnees", descripteur.document);
      assert.equal(descripteur.version, descripteur.document);
      assert.equal(descripteur.date_consolidation, null);
    }
  });

  it("garde la consolidation de l'AI Act telle quelle", () => {
    const descripteur = lireDescripteurs().find(
      (candidat) => candidat.corpus === "aiact" && candidat.document === AI_ACT,
    );
    assert.ok(descripteur);
    assert.equal(descripteur.version, "02024R1689-20260727");
    assert.equal(descripteur.date_consolidation, "2026-07-27");
    assert.equal(descripteur.articles_attendus, 119);
    assert.equal(descripteur.considerants_attendus, 180);
  });

  it("compte chaque document au manifeste et 377 unités au total", () => {
    const manifeste = manifesteAiact();
    assert.equal(manifeste.unites, 377);
    assert.deepEqual(
      manifeste.documents.map((document) => document.document).sort(),
      [AI_ACT, ...ACTES].sort(),
    );
    const comptes = Object.fromEntries(
      manifeste.documents.map((document) => [document.document, document.couverture.comptes]),
    );
    assert.deepEqual(comptes[AI_ACT], { articles: 119, considerants: 180 });
    assert.deepEqual(comptes["32026R2487"], { articles: 10, considerants: 26 });
    assert.deepEqual(comptes["32025R0454"], { articles: 20, considerants: 13 });
    assert.deepEqual(comptes["32026D2274"], { articles: 2, considerants: 6, annexes: 1 });
  });

  it("ne touche pas aux 299 unités de l'AI Act", () => {
    const unites = unitesAiact().filter((unite) => unite.document === AI_ACT);
    assert.equal(unites.length, 299);
    assert.equal(unites.filter((unite) => unite.niveau === "article").length, 119);
    assert.equal(unites.filter((unite) => unite.niveau === "considérant").length, 180);
    const article5 = unites.find((unite) => unite.ref === `${AI_ACT}#art_5`);
    assert.ok(article5);
    assert.equal(
      article5.url,
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727",
    );
    assert.ok(article5.texte.startsWith("Article 5"));
  });

  it("suit les trois CELEX dans la requête de consolidations", () => {
    const requete = requeteConsolidations(actesSuivis());
    for (const celex of ACTES) {
      assert.match(requete, new RegExp(`"0${celex.slice(1)}"`), celex);
    }
  });

  it("raccorde une entrée de consolidation de chaque acte au corpus aiact", () => {
    for (const celex of ACTES) {
      assert.equal(
        corpusDeLEntree({ source: "eurlex", document: celex, categorie: "consolidation" }),
        "aiact",
        celex,
      );
    }
  });

  it("attribue chaque acte par son numéro, et le dit présent au corpus", () => {
    const attendus: Array<[string, string, string[]]> = [
      ["l'article 3 du règlement d'exécution (UE) 2026/2487", "32026R2487", ["3"]],
      ["l'article 5 du règlement d'exécution (UE) 2025/454", "32025R0454", ["5"]],
      ["l'article 2 de la décision d'exécution (UE) 2026/2274", "32026D2274", ["2"]],
    ];
    const presents = documentsPresents(ROOT);
    for (const [question, document, articles] of attendus) {
      const citations = extraireCitations(question);
      assert.equal(citations.length, 1, question);
      assert.equal(citations[0]?.document, document, question);
      assert.deepEqual(citations[0]?.articles, articles, question);
      assert.equal(marquerPresence(presents, citations)[0]?.hors_corpus, false, question);
    }
  });

  it("laisse « article 5 de l'AI Act » à l'AI Act, jamais à un acte d'application", () => {
    assert.deepEqual(documentsNommes("l'article 5 de l'AI Act"), [AI_ACT]);
    const article = getArticle(ROOT, { document: "AI Act", numero: "5" });
    assert.equal(article.trouve, true);
    assert.equal(article.trouve ? article.ref : null, `${AI_ACT}#art_5`);
    assert.equal(article.trouve ? article.document : null, AI_ACT);
  });

  it("lit un acte d'application par son numéro ou son nom", () => {
    for (const celex of ACTES) {
      const descripteur = lireDescripteurs().find((candidat) => candidat.document === celex);
      assert.ok(descripteur, celex);
      const nom = String(descripteur.nom);
      assert.deepEqual(documentsNommes(nom), [celex], nom);
      const article = getArticle(ROOT, { document: nom, numero: "1" });
      assert.equal(article.trouve, true, nom);
      assert.equal(article.trouve ? article.document : null, celex, nom);
    }
    assert.equal(referenceExacte("l'article 3 du règlement d'exécution (UE) 2026/2487"), "3");
  });

  it("borne la recherche à un acte d'application quand la question le nomme", async () => {
    const resultat = await search(
      ROOT,
      { question: "l'article 3", document: "règlement d'exécution (UE) 2026/2487" },
      { embedder: EMBEDDER_INTERDIT },
    );
    assert.equal(resultat.niveau_confiance, "confiant");
    assert.deepEqual(resultat.passages.map((passage) => passage.ref), ["32026R2487#art_3"]);
  });

  it("garde les trois actes quand une consolidation de l'AI Act est relue", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-aiact-"));
    try {
      const manifeste = manifesteAiact();
      const aiAct = manifeste.documents.find((document) => document.document === AI_ACT);
      assert.ok(aiAct?.snapshot_considerants);
      const captures = new Map<string, string>();
      for (const document of manifeste.documents) {
        captures.set(document.version, snapshot(document.snapshot));
      }
      const origine = snapshot(aiAct.snapshot_considerants);

      // Consolidation simulée : 119 articles, aucun préambule, comme la vraie.
      const consolide = [
        "<html><body>",
        ...Array.from(
          { length: 119 },
          (_, rang) =>
            `<p class="title-article-norm">Article ${rang + 1}</p><p>Texte de l'article ${rang + 1}.</p>`,
        ),
        "</body></html>",
      ].join("\n");

      const fetchImpl: FetchLike = async (url) => {
        const celex = url.split("/").at(-1) ?? "";
        if (celex === "02024R1689-20260728") {
          return { ok: true, status: 200, text: async () => consolide };
        }
        const chemin = celex === AI_ACT ? origine : captures.get(celex);
        if (chemin === undefined || !existsSync(chemin)) {
          return { ok: false, status: 404, text: async () => "" };
        }
        return { ok: true, status: 200, text: async () => readFileSync(chemin, "utf8") };
      };

      const descripteurPath = join(root, "aiact.json");
      const descripteur = JSON.parse(
        readFileSync(join(ROOT, "mcp", "corpus", "aiact.json"), "utf8"),
      ) as Descripteur;
      writeFileSync(descripteurPath, `${JSON.stringify(descripteur, null, 2)}\n`, "utf8");

      const resultat = await synchroniserActeUe({
        rootDir: root,
        corpus: "aiact",
        version: "02024R1689-20260728",
        descripteurPath,
        fetchImpl,
        construire: async ({ rootDir, document }) => {
          assert.equal(document, "aiact");
          return buildCorpusSet({ rootDir, document, fetchImpl });
        },
      });

      const apres = JSON.parse(
        readFileSync(join(root, "data", "corpus", "aiact", "manifest.json"), "utf8"),
      ) as ManifesteAiact;
      assert.deepEqual(
        apres.documents.map((document) => document.document).sort(),
        [AI_ACT, ...ACTES].sort(),
      );
      assert.equal(apres.unites, 377);
      for (const celex of ACTES) {
        const document = apres.documents.find((candidat) => candidat.document === celex);
        assert.ok(document, celex);
        assert.ok(document.unites > 0, celex);
      }
      assert.match(String(resultat.message), /02024R1689-20260728/);
      const misAJour = JSON.parse(readFileSync(descripteurPath, "utf8")) as Descripteur;
      assert.equal(misAJour.version, "02024R1689-20260728");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
