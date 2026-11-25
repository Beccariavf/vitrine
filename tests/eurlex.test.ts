import { strict as assert } from "node:assert";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { Entry } from "../veille/types.ts";
import type { FetchLike } from "../veille/fetch.ts";
import {
  ACTES_MODIFIES,
  BASE_ACTES_EXECUTION_SANTE,
  BASES_ADEQUATION,
  DATE_MIN,
  DATE_MIN_ACTES_EXECUTION,
  actesSuivis,
  detecterActesExecution,
  detecterConsolidations,
  detecterModifications,
  detecterNouveauxActes,
  estAdequation,
  estClausesTypes,
  lireConsolidations,
  lireDescripteurAdequation,
  dateMinDe,
  lireModifications,
  lireNouveauxActes,
  passeEurlex,
  requeteActesExecution,
  requeteConsolidations,
  requeteModifications,
  requeteNouveauxActes,
} from "../veille/sources/eurlex.ts";
import type { ActeSuivi, Modification } from "../veille/sources/eurlex.ts";
import type { Descripteur } from "../mcp/corpus/parse.ts";
import type { DescripteurAdequation } from "../mcp/corpus/adequation/parse.ts";
import { compterArticlesDecision, paysDeTitre, titreDeCapture } from "../mcp/corpus/adequation/parse.ts";
import { synchroniserActeUe, synchroniserAdequation } from "../mcp/corpus/actes-ue.ts";
import { syncCorpus } from "../mcp/corpus/sync.ts";
import type { AgentSync } from "../mcp/corpus/sync.ts";
import { corpusDeLEntree, documentsDeLEntree } from "../mcp/corpus/veille.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { normaliser } from "../mcp/embed/embedder.ts";

const fixture = (chemin: string): unknown =>
  JSON.parse(readFileSync(new URL(chemin, import.meta.url), "utf8"));

const CONSOLIDATIONS = fixture("./fixtures/eurlex/consolidations.json");
const NOUVEAUX = fixture("./fixtures/eurlex/nouveaux-actes.json");
const ACTES_EXECUTION = fixture("./fixtures/eurlex/actes-execution-sante.json");
const MODIFICATIONS = fixture("./fixtures/eurlex/modifications.json");
const XHTML = readFileSync(new URL("./fixtures/eurlex/adequation-nouvelle.xhtml", import.meta.url), "utf8");

const DATE_PASSE = "2026-11-14";

/** Consolidation synthétique : deux articles, aucun préambule. */
const CONSOLIDE_DEUX_ARTICLES = [
  "<html><body>",
  '<p class="title-article-norm">Article premier</p>',
  "<p>Objet de la consolidation.</p>",
  '<p class="title-article-norm">Article 2</p>',
  "<p>Champ d'application de la consolidation.</p>",
  "</body></html>",
].join("\n");

function fetchConsolide(): FetchLike {
  return async () => ({ ok: true, status: 200, text: async () => CONSOLIDE_DEUX_ARTICLES });
}

function acte(surcharge: Partial<ActeSuivi> = {}): ActeSuivi {
  return {
    corpus: "aiact",
    document: "32024R1689",
    nom: "AI Act",
    titre: "Règlement (UE) 2024/1689",
    version: null,
    datePublication: "2024-07-12",
    ...surcharge,
  };
}

function entreeEurlex(surcharge: Partial<Entry> = {}): Entry {
  return {
    id: "eurlex-1",
    title: "AI Act : nouvelle version consolidée du 27/07/2026",
    officialTitle: "Règlement (UE) 2024/1689",
    url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727",
    publishedAt: "2026-11-14T12:00:00.000Z",
    summary: null,
    references: [],
    themes: ["donnees-personnelles"],
    source: "eurlex",
    document: "32024R1689",
    version: "02024R1689-20260727",
    categorie: "consolidation",
    ...surcharge,
  };
}

function racine(): string {
  return mkdtempSync(join(tmpdir(), "vitrine-eurlex-"));
}

function embedderFactice(): Embedder {
  const vecteur = (texte: string): number[] => {
    const valeurs = new Array<number>(8).fill(0);
    for (const [index, caractere] of [...texte].entries()) {
      valeurs[index % 8] = (valeurs[index % 8] ?? 0) + (caractere.codePointAt(0) ?? 0);
    }
    return normaliser(valeurs);
  };
  return {
    model: "factice",
    dim: 8,
    async embedPassages(textes: string[]) {
      return textes.map(vecteur);
    },
    async embedQuery(texte: string) {
      return vecteur(texte);
    },
  };
}

function ecrireUniteAiact(root: string): void {
  const dossier = join(root, "data", "corpus", "aiact");
  mkdirSync(dossier, { recursive: true });
  writeFileSync(
    join(dossier, "unites.jsonl"),
    `${JSON.stringify({
      ref: "art_1",
      document: "32024R1689",
      corpus: "aiact",
      niveau: "article",
      numero: "1",
      chemin: "AI Act > Article 1",
      texte: "objet",
      date_acte: "2024-06-13",
      date_debut: "2024-08-01",
      date_fin: null,
      statut: "en_vigueur",
      url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
    })}\n`,
    "utf8",
  );
  writeFileSync(
    join(dossier, "manifest.json"),
    `${JSON.stringify({
      document: "32024R1689",
      corpus: "aiact",
      version: "02024R1689-20240712",
      date_consolidation: "2024-07-12",
      unites: 1,
    })}\n`,
    "utf8",
  );
}

function ecrireEntree(root: string, entry: Entry): void {
  const date = entry.publishedAt ?? "2026-11-14T00:00:00.000Z";
  const dossier = join(root, "data", "entries", date.slice(0, 4), date.slice(5, 7));
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, `${entry.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

describe("requêtes CELLAR des actes de l'Union", () => {
  it("groupe les consolidations, les nouveaux actes et les modifications", () => {
    const actes = actesSuivis();
    const consolidations = requeteConsolidations(actes);
    for (const acteSuivi of actes) {
      assert.match(consolidations, new RegExp(`0${acteSuivi.document.slice(1)}`));
    }
    assert.match(consolidations, /VALUES \?base/);
    assert.match(consolidations, /STRSTARTS/);

    const nouveaux = requeteNouveauxActes(DATE_MIN);
    for (const base of BASES_ADEQUATION) assert.match(nouveaux, new RegExp(base));
    assert.match(nouveaux, new RegExp(DATE_MIN));
    assert.match(nouveaux, /resource_legal_based_on_resource_legal/);
    assert.match(nouveaux, /"D"/);

    const actesExecution = requeteActesExecution();
    assert.match(actesExecution, new RegExp(BASE_ACTES_EXECUTION_SANTE));
    assert.match(actesExecution, new RegExp(DATE_MIN_ACTES_EXECUTION));
    assert.match(actesExecution, /resource_legal_based_on_resource_legal/);
    assert.match(actesExecution, /"R"/);

    const modifications = requeteModifications(DATE_MIN);
    for (const base of ACTES_MODIFIES) assert.match(modifications, new RegExp(base));
    assert.match(modifications, /resource_legal_amends_resource_legal/);
  });

  it("borne les nouveaux actes à la date de consultation de la liste d'adéquation", () => {
    const adequation = lireDescripteurAdequation();
    assert.equal(dateMinDe({ ...adequation, consulte_le: "2025-06-01" }), "2025-06-01");
    assert.equal(dateMinDe({ ...adequation, consulte_le: "pas une date" }), DATE_MIN);
  });

  it("lit la dernière consolidation de chaque acte", () => {
    const consolidations = lireConsolidations(CONSOLIDATIONS);
    assert.deepEqual(consolidations.get("32024R1689"), {
      version: "02024R1689-20260727",
      date: "2026-07-27",
    });
    assert.deepEqual(consolidations.get("32002L0058"), {
      version: "02002L0058-20091219",
      date: "2009-12-19",
    });
  });

  it("classe un titre : adéquation, clauses types, ni l'un ni l'autre", () => {
    assert.equal(
      estAdequation("DECISION on the adequate level of protection of personal data by Brazil"),
      true,
    );
    assert.equal(
      estAdequation("DECISION amending Decision (EU) 2021/1772 on the adequate protection of data"),
      false,
    );
    assert.equal(estClausesTypes("DECISION on standard contractual clauses for transfers"), true);
    assert.equal(estClausesTypes("DECISION amending standard contractual clauses"), false);
    assert.equal(estAdequation("DECISION on the processing of personal data by the ECB"), false);
    assert.equal(paysDeTitre("adequate protection of personal data by Brazil"), "Brazil");
    assert.equal(paysDeTitre("niveau de protection adéquat assuré par le Brésil"), "Brésil");
    assert.equal(paysDeTitre(null), null);
  });
});

describe("détection des actes de l'Union", () => {
  it("ne signale rien quand la consolidation du descripteur est la dernière", () => {
    const entrees = detecterConsolidations(
      [
        acte({ corpus: "eprivacy", document: "32002L0058", version: "02002L0058-20091219" }),
        acte({ corpus: "police", document: "32016L0680", version: "02016L0680-20160504" }),
        acte({ corpus: "rgpd", document: "32016R0679", version: "02016R0679-20160504" }),
      ],
      lireConsolidations(CONSOLIDATIONS),
      DATE_PASSE,
    );
    assert.deepEqual(entrees, []);
  });

  it("ne prend pas la consolidation du jour de publication pour une nouveauté", () => {
    const entrees = detecterConsolidations(
      [acte({ corpus: "eudpr", document: "32018R1725", nom: "2018/1725" })],
      lireConsolidations(CONSOLIDATIONS),
      DATE_PASSE,
    );
    assert.deepEqual(entrees, []);
  });

  it("signale une nouvelle consolidation avec son document, sa version et sa date", () => {
    const entrees = detecterConsolidations([acte()], lireConsolidations(CONSOLIDATIONS), DATE_PASSE);
    assert.equal(entrees.length, 1);
    const [consolidation] = entrees;
    assert.equal(consolidation?.source, "eurlex");
    assert.equal(consolidation?.categorie, "consolidation");
    assert.equal(consolidation?.document, "32024R1689");
    assert.equal(consolidation?.version, "02024R1689-20260727");
    assert.equal(consolidation?.title, "AI Act : nouvelle version consolidée du 27/07/2026");
    assert.equal(consolidation?.publishedAt, `${DATE_PASSE}T12:00:00.000Z`);
    assert.equal(consolidation?.date_acte, "2026-07-27");
    assert.deepEqual(consolidation?.themes, ["ia"]);
    assert.match(consolidation?.url ?? "", /CELEX:02024R1689-20260727$/);
  });

  it("signale une consolidation devenue disponible pour un acte non consolidé", () => {
    const entrees = detecterConsolidations(
      [acte({ corpus: "eprivacy", document: "32002L0058", version: null, datePublication: "2002-07-31" })],
      lireConsolidations(CONSOLIDATIONS),
      DATE_PASSE,
    );
    assert.equal(entrees.length, 1);
    assert.equal(entrees[0]?.version, "02002L0058-20091219");
  });

  it("ajoute une décision d'adéquation absente, ignore les connues et signale le hors-périmètre", () => {
    const adequation = lireDescripteurAdequation();
    const { entrees, avertissements } = detecterNouveauxActes(
      actesSuivis(),
      adequation,
      lireNouveauxActes(NOUVEAUX),
      DATE_PASSE,
    );
    const adequations = entrees.filter((entree) => entree.categorie === "adequation");
    assert.deepEqual(
      adequations.map((entree) => entree.document),
      ["32026D0400", "32026D0401"],
    );
    assert.equal(adequations[0]?.title, "Décision d'adéquation : Brazil (10/02/2026)");
    assert.equal(adequations[1]?.abroge, "32016D1250");
    const clauses = entrees.filter((entree) => entree.categorie === "clauses_types");
    assert.deepEqual(clauses.map((entree) => entree.document), ["32026D0402"]);
    assert.equal(avertissements.length, 1);
    assert.match(avertissements[0] ?? "", /32026D0403/);
  });

  it("signale un acte d'exécution pris sur le fondement de l'EHDS et l'écarte une fois au corpus", () => {
    const entrees = detecterActesExecution(
      actesSuivis(),
      lireNouveauxActes(ACTES_EXECUTION),
      DATE_PASSE,
    );
    assert.deepEqual(
      entrees.map((entree) => [entree.categorie, entree.document]),
      [["acte_execution", "32027R0001"]],
    );
    assert.equal(entrees[0]?.title, "Acte d'exécution de l'EHDS (15/01/2027)");
    assert.equal(entrees[0]?.publishedAt, `${DATE_PASSE}T12:00:00.000Z`);
    assert.equal(
      corpusDeLEntree({ source: "eurlex", document: "32027R0001", categorie: "acte_execution" }),
      "sante_ue",
    );
  });

  it("n'ajoute pas une décision déjà déclarée au descripteur d'adéquation", () => {
    const adequation: DescripteurAdequation = {
      ...lireDescripteurAdequation(),
      decisions: [
        ...lireDescripteurAdequation().decisions,
        {
          cle: "brazil",
          pays: "Brésil",
          titre: "Décision d'adéquation : Brésil",
          celex: "32026D0400",
          url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32026D0400",
          date_acte: "2026-02-10",
          date_fin: null,
          statut: "en_vigueur",
          articles: 3,
        },
      ],
    };
    const { entrees } = detecterNouveauxActes(
      actesSuivis(),
      adequation,
      lireNouveauxActes(NOUVEAUX),
      DATE_PASSE,
    );
    assert.equal(entrees.some((entree) => entree.document === "32026D0400"), false);
  });

  it("signale chaque acte modificatif, une entrée par acte", () => {
    const modifications = lireModifications(MODIFICATIONS);
    assert.deepEqual(modifications.map((modification) => modification.celex), [
      "32026L0501",
      "32026R0500",
    ]);
    const entrees = detecterModifications(
      actesSuivis(),
      lireConsolidations(CONSOLIDATIONS),
      modifications,
      DATE_PASSE,
    );
    assert.equal(entrees.length, 2);
    assert.deepEqual(
      entrees.map((entree) => entree.document),
      ["32002L0058", "32016R0679"],
    );
    // La dernière consolidation du RGPD précède l'acte modificatif : elle ne le porte pas.
    assert.equal(entrees.every((entree) => entree.version === undefined), true);
    assert.equal(entrees[1]?.categorie, "modification");
  });

  it("porte la consolidation postérieure à l'acte modificatif", () => {
    const modification: Modification = {
      celex: "32026R0500",
      date: "2026-07-27",
      titre: "REGULATION amending the AI Act",
      document: "32024R1689",
    };
    const entrees = detecterModifications(
      [acte()],
      new Map([["32024R1689", { version: "02024R1689-20260727", date: "2026-07-27" }]]),
      [modification],
      DATE_PASSE,
    );
    assert.equal(entrees[0]?.version, "02024R1689-20260727");
  });
});

describe("passe de veille eurlex", () => {
  it("compose les trois catégories hors ligne", async () => {
    // Le descripteur de l'AI Act est consolidé depuis #86 : ce test copie les
    // descripteurs réels et ramène l'AI Act à son acte d'origine, pour que la
    // consolidation de la fixture reste neuve.
    const dossier = mkdtempSync(join(tmpdir(), "vitrine-eurlex-descripteurs-"));
    cpSync(fileURLToPath(new URL("../mcp/corpus", import.meta.url)), dossier, { recursive: true });
    const cheminAiact = join(dossier, "aiact.json");
    const aiact = JSON.parse(readFileSync(cheminAiact, "utf8")) as Descripteur;
    writeFileSync(
      cheminAiact,
      `${JSON.stringify(
        { ...aiact, version: "32024R1689", date_consolidation: null },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const resultat = await passeEurlex({
      maintenant: new Date(`${DATE_PASSE}T09:00:00Z`),
      dossierCorpus: dossier,
      reponses: {
        consolidations: CONSOLIDATIONS,
        nouveaux: NOUVEAUX,
        actesExecution: ACTES_EXECUTION,
        modifications: MODIFICATIONS,
      },
    });
    rmSync(dossier, { recursive: true, force: true });
    assert.equal(resultat.raw.length, 4);
    assert.equal(resultat.warnings.length, 1);
    const categories = resultat.entries.map((entree) => entree.categorie);
    assert.deepEqual(categories, [
      "consolidation",
      "modification",
      "modification",
      "acte_execution",
      "adequation",
      "adequation",
      "clauses_types",
    ]);
    assert.equal(resultat.entries.every((entree) => entree.publishedAt === `${DATE_PASSE}T12:00:00.000Z`), true);
  });

  it("échoue quand CELLAR ne répond pas", async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 503, text: async () => "" });
    await assert.rejects(
      () => passeEurlex({ fetchImpl, maintenant: new Date(`${DATE_PASSE}T09:00:00Z`) }),
      /CELLAR SPARQL consolidations : HTTP 503/,
    );
  });

  it("échoue quand la réponse SPARQL est illisible", async () => {
    const fetchImpl: FetchLike = async () => ({ ok: true, status: 200, text: async () => "pas du JSON" });
    await assert.rejects(
      () => passeEurlex({ fetchImpl, maintenant: new Date(`${DATE_PASSE}T09:00:00Z`) }),
      /réponse illisible/,
    );
  });
});

describe("raccord eurlex → corpus", () => {
  it("range les entrées eurlex dans leur corpus", () => {
    assert.equal(corpusDeLEntree({ source: "eurlex", document: "32024R1689", categorie: "consolidation" }), "aiact");
    assert.equal(corpusDeLEntree({ source: "eurlex", document: "32016R0679", categorie: "modification" }), "rgpd");
    assert.equal(corpusDeLEntree({ source: "eurlex", document: "32026D0400", categorie: "adequation" }), "adequation");
    assert.equal(corpusDeLEntree({ source: "eurlex", document: "32026D0402", categorie: "clauses_types" }), "ccs");
    assert.equal(corpusDeLEntree({ source: "eurlex", document: "39999X9999", categorie: "consolidation" }), null);
    assert.deepEqual(documentsDeLEntree({ source: "eurlex", id: "x", url: "", document: "32024R1689" }, new Map()), [
      "32024R1689",
    ]);
  });

  it("met à jour le descripteur de l'acte puis reconstruit son corpus", async () => {
    const root = racine();
    try {
      const descripteurPath = join(root, "aiact.json");
      const descripteur: Descripteur = {
        document: "32024R1689",
        corpus: "aiact",
        nom: "AI Act",
        titre: "Règlement (UE) 2024/1689",
        langue: "fra",
        url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
        licence: "CC BY 4.0",
        date_acte: "2024-06-13",
        date_publication: "2024-07-12",
        date_debut: "2024-08-01",
        date_fin: null,
        statut: "en_vigueur",
        articles_attendus: 2,
        considerants_attendus: 180,
        version: "32024R1689",
        date_consolidation: null,
      };
      writeFileSync(descripteurPath, `${JSON.stringify(descripteur, null, 2)}\n`, "utf8");

      const appels: string[] = [];
      const resultat = await synchroniserActeUe({
        rootDir: root,
        corpus: "aiact",
        version: "02024R1689-20260727",
        descripteurPath,
        fetchImpl: fetchConsolide(),
        construire: async (options) => {
          appels.push(options.document);
          const relu = JSON.parse(readFileSync(descripteurPath, "utf8")) as Descripteur;
          assert.equal(relu.version, "02024R1689-20260727");
          assert.equal(relu.date_consolidation, "2026-07-27");
          return [{ unites: new Array(119).fill(null) } as never];
        },
      });
      assert.deepEqual(appels, ["aiact"]);
      assert.equal(resultat.ecrit, true);
      assert.match(resultat.message, /02024R1689-20260727 consolidée, 119 unité/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rétablit le descripteur quand la construction échoue", async () => {
    const root = racine();
    try {
      const descripteurPath = join(root, "aiact.json");
      const avant = `${JSON.stringify(
        { document: "32024R1689", corpus: "aiact", version: "32024R1689", articles_attendus: 2 },
        null,
        2,
      )}\n`;
      writeFileSync(descripteurPath, avant, "utf8");
      await assert.rejects(
        () =>
          synchroniserActeUe({
            rootDir: root,
            corpus: "aiact",
            version: "02024R1689-20260727",
            descripteurPath,
            fetchImpl: fetchConsolide(),
            construire: async () => {
              throw new Error("capture incomplète");
            },
          }),
        /construction aiact impossible pour 02024R1689-20260727 \(capture incomplète\)/,
      );
      assert.equal(readFileSync(descripteurPath, "utf8"), avant);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ajuste articles_attendus quand la consolidation sert plus d'articles", async () => {
    const root = racine();
    try {
      const descripteurPath = join(root, "aiact.json");
      writeFileSync(
        descripteurPath,
        `${JSON.stringify(
          { document: "32024R1689", corpus: "aiact", version: "32024R1689", articles_attendus: 1 },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const resultat = await synchroniserActeUe({
        rootDir: root,
        corpus: "aiact",
        version: "02024R1689-20260727",
        descripteurPath,
        fetchImpl: fetchConsolide(),
        construire: async () => {
          const relu = JSON.parse(readFileSync(descripteurPath, "utf8")) as Descripteur;
          assert.equal(relu.articles_attendus, 2);
          return [{ unites: new Array(4).fill(null) } as never];
        },
      });

      assert.equal(resultat.ecrit, true);
      const relu = JSON.parse(readFileSync(descripteurPath, "utf8")) as Descripteur;
      assert.equal(relu.articles_attendus, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse une baisse du nombre d'articles sans toucher au descripteur", async () => {
    const root = racine();
    try {
      const descripteurPath = join(root, "aiact.json");
      const avant = `${JSON.stringify(
        { document: "32024R1689", corpus: "aiact", version: "32024R1689", articles_attendus: 3 },
        null,
        2,
      )}\n`;
      writeFileSync(descripteurPath, avant, "utf8");

      await assert.rejects(
        () =>
          synchroniserActeUe({
            rootDir: root,
            corpus: "aiact",
            version: "02024R1689-20260727",
            descripteurPath,
            fetchImpl: fetchConsolide(),
            construire: async () => {
              throw new Error("ne doit pas être appelée");
            },
          }),
        /2 articles au lieu de 3.*refusée/,
      );
      assert.equal(readFileSync(descripteurPath, "utf8"), avant);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ajoute une décision d'adéquation, abroge celle qu'elle remplace et reconstruit", async () => {
    const root = racine();
    try {
      const descripteurPath = join(root, "descripteur.json");
      const descripteur: DescripteurAdequation = {
        corpus: "adequation",
        nom: "Décisions d'adéquation",
        liste_reference: "https://commission.europa.eu/adequacy",
        consulte_le: "2026-11-14",
        decisions: [
          {
            cle: "privacy-shield",
            pays: "États-Unis",
            titre: "Décision d'exécution (UE) 2016/1250",
            celex: "32016D1250",
            url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016D1250",
            date_acte: "2016-07-12",
            date_fin: "2020-07-16",
            statut: "ABROGE",
            motif: "invalidée par la CJUE",
            articles: 6,
          },
        ],
      };
      writeFileSync(descripteurPath, `${JSON.stringify(descripteur, null, 2)}\n`, "utf8");

      const fetchImpl: FetchLike = async () => ({ ok: true, status: 200, text: async () => XHTML });
      let construit = false;
      const resultat = await synchroniserAdequation({
        rootDir: root,
        descripteurPath,
        fetchImpl,
        entree: {
          document: "32026D0401",
          title: "Décision d'adéquation : Chile (01/03/2026)",
          officialTitle:
            "COMMISSION IMPLEMENTING DECISION pursuant to Regulation (EU) 2016/679 on the adequate level of protection of personal data by Chile",
          url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32026D0401",
          publishedAt: "2026-11-14T12:00:00.000Z",
          date_acte: "2026-03-01",
          abroge: "32016D1250",
        },
        construire: async () => {
          construit = true;
          return { unites: [], manifestPath: "", unitesPath: "", decisions: 2 };
        },
      });
      assert.equal(construit, true);
      assert.match(resultat.message, /32026D0401 ajoutée \(3 article\(s\)\), 32016D1250 abrogée, 2 décision\(s\)/);

      const relu = JSON.parse(readFileSync(descripteurPath, "utf8")) as DescripteurAdequation;
      const nouvelle = relu.decisions.find((decision) => decision.celex === "32026D0401");
      assert.equal(nouvelle?.statut, "en_vigueur");
      assert.equal(nouvelle?.date_acte, "2026-03-01");
      assert.equal(nouvelle?.pays, "Chili");
      assert.match(nouvelle?.titre ?? "", /^DÉCISION D’EXÉCUTION \(UE\) 2026\/401/);
      assert.equal(nouvelle?.articles, 3);
      const ancienne = relu.decisions.find((decision) => decision.celex === "32016D1250");
      assert.equal(ancienne?.statut, "ABROGE");
      assert.equal(ancienne?.date_fin, "2026-03-01");
      assert.match(ancienne?.motif ?? "", /32026D0401/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rétablit le descripteur d'adéquation quand la construction échoue", async () => {
    const root = racine();
    try {
      const descripteurPath = join(root, "descripteur.json");
      const avant = `${JSON.stringify({ corpus: "adequation", nom: "Décisions", liste_reference: "x", consulte_le: "2026-11-14", decisions: [] }, null, 2)}\n`;
      writeFileSync(descripteurPath, avant, "utf8");
      const fetchImpl: FetchLike = async () => ({ ok: true, status: 200, text: async () => XHTML });
      await assert.rejects(
        () =>
          synchroniserAdequation({
            rootDir: root,
            descripteurPath,
            fetchImpl,
            entree: {
              document: "32026D0400",
              title: "Décision d'adéquation : Brazil",
              officialTitle: "DECISION on the adequate level of protection of personal data by Brazil",
              url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32026D0400",
              publishedAt: "2026-11-14T12:00:00.000Z",
            },
            construire: async () => {
              throw new Error("capture incomplète");
            },
          }),
        /construction adequation impossible après 32026D0400 \(capture incomplète\)/,
      );
      assert.equal(readFileSync(descripteurPath, "utf8"), avant);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse une capture sans article et laisse le descripteur intact", async () => {
    const root = racine();
    try {
      const descripteurPath = join(root, "descripteur.json");
      const avant = `${JSON.stringify({ corpus: "adequation", nom: "Décisions", liste_reference: "x", consulte_le: "2026-11-14", decisions: [] }, null, 2)}\n`;
      writeFileSync(descripteurPath, avant, "utf8");
      const fetchImpl: FetchLike = async () => ({
        ok: true,
        status: 200,
        text: async () =>
          "<html><body><p>DÉCISION D'EXÉCUTION</p><p>A ARRÊTÉ LA PRÉSENTE DÉCISION :</p><p>FAIT À Bruxelles.</p></body></html>",
      });
      await assert.rejects(
        () =>
          synchroniserAdequation({
            rootDir: root,
            descripteurPath,
            fetchImpl,
            entree: {
              document: "32026D0400",
              title: "Décision d'adéquation : Brazil",
              officialTitle: "DECISION on the adequate level of protection of personal data by Brazil",
              url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32026D0400",
              publishedAt: "2026-11-14T12:00:00.000Z",
            },
            construire: async () => {
              throw new Error("ne doit pas être appelée");
            },
          }),
        /32026D0400 : capture sans article/,
      );
      assert.equal(readFileSync(descripteurPath, "utf8"), avant);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lit le titre français dans la capture et en tire le pays", () => {
    const titre = titreDeCapture(XHTML);
    assert.match(titre ?? "", /^DÉCISION D’EXÉCUTION \(UE\) 2026\/401 DE LA COMMISSION du 1er mars 2026 constatant/);
    assert.equal(paysDeTitre(titre), "Chili");
    assert.equal(titreDeCapture("<html><body><p>LA COMMISSION</p></body></html>"), null);
  });

  it("compte les articles d'une capture sans attendre un compte déclaré", () => {
    const articles = compterArticlesDecision(XHTML, {
      document: "32026D0400",
      corpus: "adequation",
      nom: "Décision",
      url: "https://example.test",
      date_acte: "2026-11-14",
      date_debut: "2026-11-14",
      date_fin: null,
      statut: "en_vigueur",
      articles_attendus: 0,
      considerants_attendus: 0,
    });
    assert.equal(articles, 3);
  });
});

describe("corpus:sync et les actes de l'Union", () => {
  it("marque le document périmé, lance la source et avance a_jour_au", async () => {
    const root = racine();
    try {
      ecrireUniteAiact(root);
      ecrireEntree(root, entreeEurlex());
      const cibles: Array<string | null> = [];
      const aiact: AgentSync = async (cible) => {
        cibles.push(cible?.entree?.document ?? null);
        return { ecrit: true, message: "02024R1689-20260727 consolidée, 119 unité(s)" };
      };
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-14",
        depuis: "2026-11-01",
        agents: { aiact },
        embedder: embedderFactice(),
      });
      assert.deepEqual(cibles, ["32024R1689"]);
      assert.equal(rapport.a_jour_au, "2026-11-14");
      assert.equal(rapport.documents[0]?.statut, "perime");
      assert.equal(rapport.documents[0]?.motif, "version du corpus antérieure");
      assert.equal(rapport.sources.find((source) => source.source === "aiact")?.statut, "ok");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("signale la panne d'une construction d'acte sans figer a_jour_au", async () => {
    const root = racine();
    try {
      ecrireUniteAiact(root);
      ecrireEntree(root, entreeEurlex());
      const aiact: AgentSync = async () => {
        throw new Error("capture incomplète : 119 articles au lieu de 113 attendus");
      };
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-14",
        depuis: "2026-11-01",
        agents: { aiact },
        embedder: embedderFactice(),
      });
      assert.equal(rapport.a_jour_au, "2026-11-14");
      assert.equal(rapport.sources.find((source) => source.source === "aiact")?.statut, "panne");
      assert.match(
        rapport.sources.find((source) => source.source === "aiact")?.message ?? "",
        /119 articles/,
      );
      // Le document reste périmé et sera rejoué à la passe suivante.
      assert.equal(rapport.documents[0]?.statut, "perime");

      const suivant = await syncCorpus({
        rootDir: root,
        date: "2026-11-17",
        agents: { aiact },
        embedder: embedderFactice(),
      });
      assert.equal(suivant.a_jour_au, "2026-11-17");
      // La fenêtre avance malgré la panne de l'acte : elle n'est pas épinglée.
      assert.equal(suivant.depuis, "2026-11-10");
      assert.equal(suivant.sources.find((source) => source.source === "aiact")?.statut, "panne");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne fait pas avancer a_jour_au quand une source de veille échoue", async () => {
    const root = racine();
    try {
      ecrireEntree(root, {
        id: "CETATEXT000000000002",
        source: "cetat",
        title: "Décision du Conseil d'État",
        officialTitle: "Décision du Conseil d'État",
        url: "https://www.legifrance.gouv.fr/ceta/id/CETATEXT000000000002",
        publishedAt: "2026-11-14T12:00:00.000Z",
        summary: null,
        references: [],
        themes: ["donnees-personnelles"],
      });
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-14",
        depuis: "2026-11-01",
        agents: {
          ce: async () => {
            throw new Error("CETAT indisponible");
          },
        },
        embedder: embedderFactice(),
      });
      assert.equal(rapport.a_jour_au, null);
      assert.equal(rapport.sources.find((source) => source.source === "ce")?.statut, "panne");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lance la source adéquation avec l'entrée eurlex détectée", async () => {
    const root = racine();
    try {
      ecrireEntree(root, {
        id: "eurlex-adequation",
        source: "eurlex",
        title: "Décision d'adéquation : Brazil (10/02/2026)",
        officialTitle:
          "COMMISSION IMPLEMENTING DECISION pursuant to Regulation (EU) 2016/679 on the adequate level of protection of personal data by Brazil",
        url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32026D0400",
        publishedAt: "2026-11-14T12:00:00.000Z",
        summary: null,
        references: [],
        themes: ["donnees-personnelles"],
        document: "32026D0400",
        categorie: "adequation",
        date_acte: "2026-02-10",
      });
      const cibles: Array<string | null> = [];
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-14",
        depuis: "2026-11-01",
        agents: {
          adequation: async (cible) => {
            cibles.push(cible?.entree?.document ?? null);
            return { ecrit: true, message: "32026D0400 ajoutée (4 article(s))" };
          },
        },
        embedder: embedderFactice(),
      });
      assert.deepEqual(cibles, ["32026D0400"]);
      assert.equal(rapport.sources.find((source) => source.source === "adequation")?.statut, "ok");
      assert.equal(rapport.documents[0]?.corpus, "adequation");
      assert.equal(rapport.documents[0]?.statut, "manquant");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("vise un acte d'exécution de l'EHDS au corpus sante_ue et le laisse manquant", async () => {
    const root = racine();
    try {
      ecrireEntree(root, {
        id: "eurlex-acte-execution",
        source: "eurlex",
        title: "Acte d'exécution de l'EHDS (15/01/2027)",
        officialTitle: "COMMISSION IMPLEMENTING REGULATION (EU) 2027/1",
        url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32027R0001",
        publishedAt: "2026-11-14T12:00:00.000Z",
        summary: null,
        references: [],
        themes: ["donnees-personnelles"],
        document: "32027R0001",
        categorie: "acte_execution",
        date_acte: "2027-01-15",
      });
      const cibles: Array<string | null> = [];
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-14",
        depuis: "2026-11-01",
        agents: {
          sante_ue: async (cible) => {
            cibles.push(cible?.entree?.document ?? null);
            return { ecrit: false, message: "acte d'exécution détecté, descripteur à ajouter à la main" };
          },
        },
        embedder: embedderFactice(),
      });
      assert.deepEqual(cibles, ["32027R0001"]);
      assert.equal(rapport.documents[0]?.corpus, "sante_ue");
      assert.equal(rapport.documents[0]?.statut, "manquant");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne relance rien quand la version consolidée est déjà au corpus", async () => {
    const root = racine();
    try {
      ecrireUniteAiact(root);
      const dossier = join(root, "data", "corpus", "aiact");
      writeFileSync(
        join(dossier, "manifest.json"),
        `${JSON.stringify({
          document: "32024R1689",
          version: "02024R1689-20260727",
          date_consolidation: "2026-07-27",
          unites: 1,
        })}\n`,
        "utf8",
      );
      ecrireEntree(root, entreeEurlex());
      let lancee = false;
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-14",
        depuis: "2026-11-01",
        agents: { aiact: async () => ((lancee = true), { ecrit: true, message: "x" }) },
        embedder: embedderFactice(),
      });
      assert.equal(lancee, false);
      assert.equal(rapport.documents[0]?.statut, "present");
      assert.equal(rapport.sources.find((source) => source.source === "aiact")?.statut, "ignoree");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
