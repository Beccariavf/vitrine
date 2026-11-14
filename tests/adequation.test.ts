import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildAdequation } from "../mcp/corpus/adequation/build.ts";
import type { DescripteurAdequation } from "../mcp/corpus/adequation/parse.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import { getArticle } from "../mcp/tools.ts";
import type { FetchLike } from "../veille/fetch.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = readFileSync(
  new URL("./fixtures/eurlex/adequation-safe-harbour.html", import.meta.url),
  "utf8",
);

const DESCRIPTEUR: DescripteurAdequation = {
  corpus: "adequation",
  nom: "Décisions d'adéquation",
  liste_reference: "https://exemple.test/adequacy-decisions",
  consulte_le: "2026-11-14",
  decisions: [
    {
      cle: "safe-harbour",
      pays: "États-Unis",
      titre: "Décision 2000/520/CE",
      celex: "32000D0520",
      url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32000D0520",
      date_acte: "2000-07-26",
      date_fin: "2015-10-06",
      statut: "ABROGE",
      motif: "invalidée par C-362/14",
      articles: 6,
    },
  ],
};

describe("corpus des décisions d'adéquation", () => {
  it("écrit une unité par article et le manifeste qui porte la liste de référence", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-adequation-"));
    const descripteurPath = join(root, "descripteur.json");
    writeFileSync(descripteurPath, JSON.stringify(DESCRIPTEUR), "utf8");
    const demandes: string[] = [];
    const fetchImpl: FetchLike = async (url, init) => {
      demandes.push(`${init?.headers?.Accept ?? ""} ${url}`);
      // Le premier appel, en XHTML, échoue : la capture ancienne n'est servie qu'en HTML.
      return {
        ok: demandes.length > 1,
        status: demandes.length > 1 ? 200 : 404,
        text: async () => FIXTURE,
      };
    };
    try {
      const resultat = await buildAdequation({ rootDir: root, descripteurPath, fetchImpl });
      const manifeste = JSON.parse(
        readFileSync(join(root, "data", "corpus", "adequation", "manifest.json"), "utf8"),
      ) as {
        liste_reference: string;
        consulte_le: string;
        documents: number;
        unites: number;
        decisions: Array<{ celex: string; statut: string; motif?: string; snapshot: string }>;
      };

      assert.equal(demandes.length, 2);
      assert.match(demandes[0] ?? "", /application\/xhtml\+xml/);
      assert.match(demandes[1] ?? "", /text\/html/);
      assert.equal(resultat.unites.length, 6);
      assert.equal(manifeste.liste_reference, DESCRIPTEUR.liste_reference);
      assert.equal(manifeste.consulte_le, "2026-11-14");
      assert.equal(manifeste.documents, 1);
      assert.equal(manifeste.unites, 6);
      assert.equal(manifeste.decisions[0]?.celex, "32000D0520");
      assert.equal(manifeste.decisions[0]?.statut, "ABROGE");
      assert.equal(manifeste.decisions[0]?.motif, "invalidée par C-362/14");
      assert.match(manifeste.decisions[0]?.snapshot ?? "", /\.html$/);
      assert.ok(resultat.unites.every((unite) => unite.statut === "ABROGE"));
      assert.deepEqual(
        resultat.unites.map((unite) => unite.ref),
        Array.from({ length: 6 }, (_, index) => `32000D0520#art_${index + 1}`),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("corpus d'adéquation committé", () => {
  const manifeste = JSON.parse(
    readFileSync(join(ROOT, "data", "corpus", "adequation", "manifest.json"), "utf8"),
  ) as {
    liste_reference: string;
    consulte_le: string;
    documents: number;
    unites: number;
    decisions: Array<{
      celex: string;
      pays: string;
      date_acte: string;
      url: string;
      statut: string;
      motif?: string;
      articles: number;
    }>;
  };

  it("déclare la liste de référence et sa date de consultation", () => {
    assert.match(manifeste.liste_reference, /^https:\/\/commission\.europa\.eu\//);
    assert.match(manifeste.consulte_le, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(manifeste.documents, 22);
    assert.equal(manifeste.unites, 120);
    assert.ok(
      manifeste.decisions.every(
        (decision) =>
          decision.pays !== "" &&
          /^\d{4}-\d{2}-\d{2}$/.test(decision.date_acte) &&
          decision.url.startsWith("https://eur-lex.europa.eu/"),
      ),
    );
  });

  it("porte les décisions en vigueur, dont le cadre UE–États-Unis, le Royaume-Uni, la Corée, le Japon et le Brésil", () => {
    const enVigueur = new Set(
      manifeste.decisions
        .filter((decision) => decision.statut === "en_vigueur")
        .map((decision) => decision.celex),
    );
    for (const celex of [
      "32023D1795",
      "32021D1772",
      "32021D1773",
      "32025D2574",
      "32025D2571",
      "32022D0254",
      "32019D0419",
      "32026D0179",
      "32025D1382",
      "32010D0625",
      "32012D0484",
    ]) {
      assert.ok(enVigueur.has(celex), celex);
    }
  });

  it("rend les décisions invalidées abrogées, jamais applicables", () => {
    for (const [celex, motif] of [
      ["32000D0520", /C-362\/14/],
      ["32016D1250", /C-311\/18/],
    ] as const) {
      const decision = manifeste.decisions.find((candidat) => candidat.celex === celex);
      assert.ok(decision, celex);
      assert.equal(decision.statut, "ABROGE");
      assert.match(decision.motif ?? "", motif);
      const article = getArticle(ROOT, { document: celex, numero: "1" });
      assert.ok(article.trouve, celex);
      assert.equal(article.statut_application, "abroge");
      assert.deepEqual(
        article.perimetre.corpus.map((entree) => entree.corpus),
        ["adequation"],
      );
    }
  });

  it("n'écrit jamais un statut en vigueur pour une décision abrogée", () => {
    const unites = readFileSync(join(ROOT, "data", "corpus", "adequation", "unites.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((ligne) => JSON.parse(ligne) as { document: string; statut: string });
    for (const celex of ["32000D0520", "32016D1250"]) {
      const duDocument = unites.filter((unite) => unite.document === celex);
      assert.ok(duDocument.length > 0, celex);
      assert.ok(duDocument.every((unite) => unite.statut === "ABROGE"), celex);
    }
    assert.equal(statutApplication("adequation", "ABROGE"), "abroge");
    assert.equal(statutApplication("adequation", "en_vigueur"), "en_vigueur");
  });
});
