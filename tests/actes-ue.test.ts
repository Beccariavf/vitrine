import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildCorpusSet, lireDescripteurs } from "../mcp/corpus/build.ts";
import { estConsolide, numeroArticleConsolide, parseConsolide } from "../mcp/corpus/parse.ts";
import type { Descripteur } from "../mcp/corpus/parse.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { documentsNommes, getArticle, referenceExacte, search } from "../mcp/tools.ts";
import type { FetchLike } from "../veille/fetch.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EPRIVACY_URL = new URL("./fixtures/eurlex/eprivacy-consolide.xhtml", import.meta.url);
const POLICE_URL = new URL("./fixtures/eurlex/police-consolide.xhtml", import.meta.url);

function descripteur(corpus: string): Descripteur {
  const trouve = lireDescripteurs().find((candidat) => candidat.corpus === corpus);
  assert.ok(trouve, corpus);
  return trouve;
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

describe("descripteurs des actes de l'Union", () => {
  it("rendent la version consolidée en vigueur ou, faute de consolidation, l'acte d'origine", () => {
    const versions = Object.fromEntries(
      ["eprivacy", "police", "eudpr", "rgpdproc"].map((corpus) => {
        const lu = descripteur(corpus);
        return [corpus, [lu.document, lu.version, lu.date_consolidation, estConsolide(lu)]];
      }),
    );
    assert.deepEqual(versions, {
      eprivacy: ["32002L0058", "02002L0058-20091219", "2009-12-19", true],
      police: ["32016L0680", "02016L0680-20160504", "2016-05-04", true],
      eudpr: ["32018R1725", "32018R1725", null, false],
      rgpdproc: ["32025R2518", "32025R2518", null, false],
    });
  });
});

describe("numeroArticleConsolide", () => {
  it("lit premier, un nombre et un suffixe latin", () => {
    assert.equal(numeroArticleConsolide("Article premier"), "1");
    assert.equal(numeroArticleConsolide("Article 21"), "21");
    assert.equal(numeroArticleConsolide("Article 15 bis"), "15 bis");
    assert.equal(numeroArticleConsolide("Annexe I"), null);
  });
});

describe("parseConsolide", () => {
  it("rend les 23 articles et 49 considérants d'ePrivacy, sans marqueurs de consolidation", () => {
    const unites = parseConsolide(readFileSync(EPRIVACY_URL, "utf8"), descripteur("eprivacy"));
    const articles = unites.filter((unite) => unite.niveau === "article");

    assert.equal(articles.length, 23);
    assert.equal(unites.length - articles.length, 49);
    assert.deepEqual(
      articles.map((unite) => unite.numero).slice(13, 17),
      ["14", "14 bis", "15", "15 bis"],
    );
    assert.ok(unites.every((unite) => !/[►◄▼]/.test(unite.texte)));
    const quinzeBis = articles.find((unite) => unite.numero === "15 bis");
    assert.equal(quinzeBis?.ref, "32002L0058#art_15bis");
    assert.match(quinzeBis?.texte ?? "", /^Article 15 bis Mise en œuvre et contrôle de l’application 1\./);
    // L'article 5, paragraphe 3, est celui de la directive 2009/136 : le consentement, pas le refus.
    const cinq = articles.find((unite) => unite.numero === "5");
    assert.match(cinq?.texte ?? "", /ait donné son accord/);
    assert.equal(cinq?.url, "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02002L0058-20091219");
    assert.equal(articles.at(-1)?.texte, "Article 21 Destinataires Les États membres sont destinataires de la présente directive.");
  });

  it("suit les chapitres de la directive 2016/680 et n'y trouve aucun considérant", () => {
    const unites = parseConsolide(readFileSync(POLICE_URL, "utf8"), descripteur("police"));

    assert.equal(unites.length, 65);
    assert.ok(unites.every((unite) => unite.niveau === "article"));
    assert.equal(
      unites.find((unite) => unite.numero === "5")?.chemin,
      "Directive police-justice > Chapitre II > Principes",
    );
  });

  it("lève quand le compte d'articles diffère du descripteur", () => {
    assert.throws(
      () =>
        parseConsolide(readFileSync(EPRIVACY_URL, "utf8"), { ...descripteur("eprivacy"), articles_attendus: 22 }),
      /02002L0058-20091219 : 23 articles au lieu de 22/,
    );
  });
});

describe("buildCorpusSet sur une version consolidée", () => {
  it("demande la version à CELLAR et écrit version, date de consolidation et exclusions au manifeste", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-actes-ue-"));
    let demande = "";
    const fetchImpl: FetchLike = async (url) => {
      demande = url;
      return { ok: true, status: 200, text: async () => readFileSync(POLICE_URL, "utf8") };
    };
    try {
      await buildCorpusSet({ rootDir: root, document: "police", fetchImpl });
      const manifeste = JSON.parse(
        readFileSync(join(root, "data", "corpus", "police", "manifest.json"), "utf8"),
      ) as Record<string, unknown> & { couverture: Record<string, unknown> };

      assert.equal(demande, "https://publications.europa.eu/resource/celex/02016L0680-20160504");
      assert.equal(manifeste.document, "32016L0680");
      assert.equal(manifeste.version, "02016L0680-20160504");
      assert.equal(manifeste.date_consolidation, "2016-05-04");
      assert.deepEqual(manifeste.couverture.exclusions, [
        "considérants : absents de la version consolidée 02016L0680-20160504",
      ]);
      assert.deepEqual(manifeste.couverture.types_retenus, ["article"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("lecture des actes de l'Union sur le corpus réel", () => {
  it("get_article distingue l'article 15 bis de l'article 15", () => {
    const quinze = getArticle(ROOT, { document: "32002L0058", numero: "15" });
    const quinzeBis = getArticle(ROOT, { document: "32002L0058", numero: "15 bis" });

    assert.equal(quinze.trouve && quinze.ref, "32002L0058#art_15");
    assert.equal(quinzeBis.trouve && quinzeBis.ref, "32002L0058#art_15bis");
    assert.equal(getArticle(ROOT, { document: "32016R0679", numero: "17 bis" }).trouve, false);
  });

  it("rend un article de chaque acte avec sa date, son lien EUR-Lex et son statut", () => {
    for (const [document, url] of [
      ["32002L0058", "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02002L0058-20091219"],
      ["32016L0680", "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02016L0680-20160504"],
      ["32018R1725", "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32018R1725#art_1"],
      ["32025R2518", "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32025R2518#art_1"],
    ] as const) {
      const article = getArticle(ROOT, { document, numero: "1" });
      assert.ok(article.trouve, document);
      assert.equal(article.url, url);
      assert.equal(article.statut_application, "en_vigueur");
      assert.match(article.date_acte, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("search rend l'article exact quand la question nomme l'acte et un article inséré", async () => {
    const resultat = await search(
      ROOT,
      { question: "Que dit l'article 15 bis de la directive ePrivacy ?" },
      { embedder: EMBEDDER_INTERDIT },
    );
    assert.equal(resultat.niveau_confiance, "confiant");
    assert.deepEqual(resultat.passages.map((passage) => passage.ref), ["32002L0058#art_15bis"]);
  });
});

describe("noms des actes de l'Union", () => {
  it("reconnaît chaque acte, et le règlement procédural sans le RGPD", () => {
    assert.deepEqual(documentsNommes("la directive e-Privacy"), ["32002L0058"]);
    assert.deepEqual(documentsNommes("directive 2002/58/CE"), ["32002L0058"]);
    assert.deepEqual(documentsNommes("la directive police-justice"), ["32016L0680"]);
    assert.deepEqual(documentsNommes("directive (UE) 2016/680"), ["32016L0680"]);
    assert.deepEqual(documentsNommes("règlement (UE) 2018/1725"), ["32018R1725"]);
    assert.deepEqual(documentsNommes("le règlement procédural RGPD"), ["32025R2518"]);
    assert.deepEqual(documentsNommes("le RGPD et le règlement 2025/2518").sort(), ["32016R0679", "32025R2518"]);
  });

  it("referenceExacte garde le suffixe latin", () => {
    assert.equal(referenceExacte("article 15 bis"), "15 bis");
    assert.equal(referenceExacte("art. 17"), "17");
  });

  it("statut d'application : les quatre corpus sont des textes", () => {
    for (const corpus of ["eprivacy", "police", "eudpr", "rgpdproc"]) {
      assert.equal(statutApplication(corpus, "en_vigueur"), "en_vigueur");
    }
  });
});
