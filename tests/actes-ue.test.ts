import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildCorpus, buildCorpusSet, lireDescripteurs } from "../mcp/corpus/build.ts";
import {
  compterArticlesConsolide,
  compterConsiderantsConsolide,
  estConsolide,
  numeroArticleConsolide,
  parseConsolide,
} from "../mcp/corpus/parse.ts";
import type { Descripteur } from "../mcp/corpus/parse.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { documentsNommes, getArticle, referenceExacte, search } from "../mcp/tools.ts";
import type { FetchLike } from "../veille/fetch.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EPRIVACY_URL = new URL("./fixtures/eurlex/eprivacy-consolide.xhtml", import.meta.url);
const POLICE_URL = new URL("./fixtures/eurlex/police-consolide.xhtml", import.meta.url);
const EPRIVACY_PATH = fileURLToPath(EPRIVACY_URL);

/** Consolidation synthétique sans préambule : deux articles, aucun considérant. */
const CONSOLIDE_SANS_PREAMBULE = [
  "<html><body>",
  '<p class="title-article-norm">Article premier</p>',
  "<p>Objet de la consolidation.</p>",
  '<p class="title-article-norm">Article 2</p>',
  "<p>Champ d'application de la consolidation.</p>",
  "</body></html>",
].join("\n");

/** Acte d'origine synthétique : deux considérants et deux articles ancrés. */
const ORIGINE_DEUX_ANCRES = [
  "<html><body>",
  '<div><p id="rct_1">(1) Premier considérant de l\'acte d\'origine.</p></div>',
  '<div><p id="rct_2">(2) Deuxième considérant de l\'acte d\'origine.</p></div>',
  '<div><p id="art_1">Article premier de l\'acte d\'origine.</p></div>',
  '<div><p id="art_2">Article 2 de l\'acte d\'origine.</p></div>',
  "</body></html>",
].join("\n");

const DESCRIPTEUR_SYNTHETIQUE: Descripteur = {
  document: "32000R0001",
  version: "02000R0001-20260101",
  date_consolidation: "2026-01-01",
  corpus: "synthetique",
  nom: "Acte synthétique",
  titre: "Règlement (UE) 2000/1",
  langue: "fra",
  url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32000R0001",
  licence: "CC BY 4.0",
  date_acte: "2000-01-01",
  date_publication: "2000-01-05",
  date_debut: "2000-01-01",
  date_fin: null,
  statut: "en_vigueur",
  articles_attendus: 2,
  considerants_attendus: 2,
};

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
    // Le point e) de l'article 2, supprimé par 2009/136, garde sa marque de suppression.
    assert.match(articles.find((unite) => unite.numero === "2")?.texte ?? "", /la reçoit; —————/);
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

  it("lit un titre d'article porté par un attribut, comme dans les consolidations récentes", () => {
    const xhtml = [
      "<html><body>",
      '<p class="title-division-1">CHAPITRE I</p>',
      '<p class="title-article-norm" id="id-abc">Article premier</p>',
      "<p>Objet du texte.</p>",
      '<hr class="separator-short"/>',
      "</body></html>",
    ].join("\n");
    const unites = parseConsolide(xhtml, {
      ...descripteur("eprivacy"),
      version: "02002L0058-20200101",
      date_consolidation: "2020-01-01",
      articles_attendus: 1,
      considerants_attendus: 0,
    });
    assert.equal(unites.length, 1);
    assert.equal(unites[0]?.numero, "1");
    assert.match(unites[0]?.texte ?? "", /^Article premier Objet du texte\./);
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
      assert.equal(manifeste.couverture.version, "02016L0680-20160504");
      assert.equal(manifeste.couverture.date_consolidation, "2016-05-04");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("comptage d'une consolidation", () => {
  it("compte les considérants et les articles sans valider les comptes du descripteur", () => {
    const eprivacy = readFileSync(EPRIVACY_URL, "utf8");
    assert.equal(compterConsiderantsConsolide(eprivacy), 49);
    assert.equal(compterConsiderantsConsolide(CONSOLIDE_SANS_PREAMBULE), 0);
    assert.equal(compterArticlesConsolide(eprivacy), 23);
    assert.equal(compterArticlesConsolide(CONSOLIDE_SANS_PREAMBULE), 2);
  });
});

describe("fusion avec l'acte d'origine", () => {
  it("reprend les considérants de l'acte d'origine quand la consolidation n'a pas de préambule", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-actes-ue-"));
    try {
      const consolidePath = join(root, "consolide.xhtml");
      const originePath = join(root, "origine.xhtml");
      const descripteurPath = join(root, "descripteur.json");
      writeFileSync(consolidePath, CONSOLIDE_SANS_PREAMBULE, "utf8");
      writeFileSync(originePath, ORIGINE_DEUX_ANCRES, "utf8");
      writeFileSync(descripteurPath, `${JSON.stringify(DESCRIPTEUR_SYNTHETIQUE, null, 2)}\n`, "utf8");

      const resultat = await buildCorpus({
        rootDir: root,
        descripteurPath,
        fixturePath: consolidePath,
        origineFixturePath: originePath,
      });

      assert.equal(resultat.unites.length, 4);
      const considerants = resultat.unites.filter((unite) => unite.niveau === "considérant");
      const articles = resultat.unites.filter((unite) => unite.niveau === "article");
      assert.deepEqual(
        considerants.map((unite) => unite.ref),
        ["32000R0001#rct_1", "32000R0001#rct_2"],
      );
      assert.match(considerants[0]?.texte ?? "", /^\(1\) Premier considérant de l'acte d'origine\.$/);
      assert.equal(considerants[0]?.url, `${DESCRIPTEUR_SYNTHETIQUE.url}#rct_1`);
      assert.deepEqual(
        articles.map((unite) => unite.texte),
        [
          "Article premier Objet de la consolidation.",
          "Article 2 Champ d'application de la consolidation.",
        ],
      );
      assert.ok(
        articles.every(
          (unite) =>
            unite.url ===
            "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02000R0001-20260101",
        ),
      );

      const manifeste = JSON.parse(readFileSync(resultat.manifestPath, "utf8")) as Record<string, unknown> & {
        couverture: { comptes: Record<string, number> };
      };
      assert.equal(manifeste.version, "02000R0001-20260101");
      assert.equal(manifeste.date_consolidation, "2026-01-01");
      assert.equal(manifeste.considerants_source, "32000R0001");
      assert.notEqual(manifeste.snapshot, manifeste.snapshot_considerants);
      for (const [champ, attendu] of [
        ["snapshot", CONSOLIDE_SANS_PREAMBULE],
        ["snapshot_considerants", ORIGINE_DEUX_ANCRES],
      ] as const) {
        const nom = manifeste[champ] as string;
        const chemin = join(root, "data", "raw", nom.slice(0, 2), nom);
        assert.ok(existsSync(chemin), `${champ} présent sous data/raw/`);
        assert.equal(readFileSync(chemin, "utf8").trimEnd(), attendu);
        const hash = createHash("sha256").update(readFileSync(chemin)).digest("hex");
        assert.equal(nom, `${hash}.xhtml`);
      }
      assert.deepEqual(manifeste.couverture.comptes, { articles: 2, considerants: 2 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("garde les considérants de la consolidation quand elle en porte", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-actes-ue-"));
    const fetchImpl: FetchLike = async () => {
      throw new Error("aucun appel réseau attendu");
    };
    try {
      const resultats = await buildCorpusSet({
        rootDir: root,
        document: "eprivacy",
        fixturePath: EPRIVACY_PATH,
        fetchImpl,
      });

      assert.equal(resultats.length, 1);
      const unites = resultats[0]?.unites ?? [];
      assert.equal(unites.filter((unite) => unite.niveau === "article").length, 23);
      assert.equal(unites.filter((unite) => unite.niveau === "considérant").length, 49);
      assert.equal(unites.length, 72);

      const manifeste = JSON.parse(readFileSync(resultats[0]?.manifestPath ?? "", "utf8")) as Record<
        string,
        unknown
      >;
      assert.equal("considerants_source" in manifeste, false);
      assert.equal("snapshot_considerants" in manifeste, false);
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
    assert.equal(getArticle(ROOT, { document: "32002L0058", numero: "15a" }).trouve, false);
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
    assert.deepEqual(documentsNommes("corpus rgpdproc"), ["32025R2518"]);
  });

  it("ne prend pas un numéro ou un règlement procédural quelconque pour un acte", () => {
    assert.deepEqual(documentsNommes("le règlement de procédure de la Cour de justice"), []);
    assert.deepEqual(documentsNommes("le règlement procédural de la Cour de justice"), []);
    assert.deepEqual(documentsNommes("la loi n° 2002-58"), []);
    assert.deepEqual(documentsNommes("en 2016, 680 dossiers"), []);
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
