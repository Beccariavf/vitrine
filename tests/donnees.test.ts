import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { actesSuivis, requeteConsolidations } from "../veille/sources/eurlex.ts";
import { synchroniserActeUe } from "../mcp/corpus/actes-ue.ts";
import { lireDescripteurs } from "../mcp/corpus/build.ts";
import { documentsPresents, extraireCitations, marquerPresence } from "../mcp/corpus/citations.ts";
import { parseDonnees } from "../mcp/corpus/donnees/parse.ts";
import type { Descripteur, Unite } from "../mcp/corpus/parse.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import { documentsNommes, getArticle, referenceExacte } from "../mcp/tools.ts";
import { writeCorpusMulti } from "../mcp/corpus/write.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = readFileSync(new URL("./fixtures/eurlex/donnees.xhtml", import.meta.url), "utf8");

const CELEX = [
  "32023R2854",
  "32022R0868",
  "32019L1024",
  "32023R0138",
  "32018R1807",
  "32026H2394",
  "32023R1622",
];

function descripteurReduit(surcharge: Partial<Descripteur> = {}): Descripteur {
  return {
    document: "32000R0001",
    corpus: "donnees",
    nom: "Capture réduite",
    titre: "Acte de test",
    langue: "fra",
    url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32000R0001",
    licence: "Réutilisation autorisée par la décision 2011/833/UE (CC BY 4.0)",
    date_acte: "2026-01-01",
    date_publication: "2026-01-02",
    date_debut: "2026-01-03",
    date_fin: null,
    statut: "en_vigueur",
    articles_attendus: 2,
    considerants_attendus: 2,
    points_attendus: 2,
    annexes_attendues: 2,
    parseur: "donnees",
    ...surcharge,
  };
}

function corpusConstruit(root: string, descripteurs: Descripteur[]): Unite[] {
  const documents = descripteurs.map((descripteur, index) => {
    const snapshotPath = join(root, `capture-${index}.xhtml`);
    writeFileSync(snapshotPath, FIXTURE, "utf8");
    return { descripteur, unites: parseDonnees(FIXTURE, descripteur), snapshotPath };
  });
  writeCorpusMulti(root, "donnees", "Textes UE de l'économie des données", documents);
  return documents.flatMap((document) => document.unites);
}

describe("corpus donnees", () => {
  it("déclare les sept actes retenus, lus sur CELLAR", () => {
    const descripteurs = lireDescripteurs().filter((descripteur) => descripteur.corpus === "donnees");
    assert.deepEqual(
      descripteurs.map((descripteur) => descripteur.document).sort(),
      [...CELEX].sort(),
    );
    assert.ok(descripteurs.every((descripteur) => descripteur.parseur === "donnees"));
  });

  it("construit les articles, considérants, points et annexes d'une capture réduite", () => {
    const unites = parseDonnees(FIXTURE, descripteurReduit());

    assert.deepEqual(
      unites.map((unite) => [unite.ref, unite.niveau]),
      [
        ["32000R0001#rct_1", "considérant"],
        ["32000R0001#rct_2", "considérant"],
        ["32000R0001#art_1", "article"],
        ["32000R0001#art_2", "article"],
        ["32000R0001#point_1", "point"],
        ["32000R0001#point_2", "point"],
        ["32000R0001#anx_I", "annexe"],
        ["32000R0001#anx_1", "annexe"],
      ],
    );
    const article = unites.find((unite) => unite.ref === "32000R0001#art_2");
    assert.equal(article?.chemin, "Capture réduite > Chapitre I > OBJET ET DÉFINITIONS");
    assert.equal(article?.numero, "2");
    assert.equal(unites.find((unite) => unite.niveau === "point")?.numero, "1");
    assert.equal(unites.find((unite) => unite.niveau === "annexe")?.chemin, "Capture réduite > Annexe I");
  });

  it("refuse une capture dont un compte attendu ne correspond pas", () => {
    assert.throws(
      () => parseDonnees(FIXTURE, descripteurReduit({ annexes_attendues: 1 })),
      /2 annexe\(s\) au lieu de 1 attendues/,
    );
    assert.throws(
      () => parseDonnees(FIXTURE, descripteurReduit({ considerants_attendus: 3 })),
      /ancre rct_3 absente \(2 considérants au lieu de 3\)/,
    );
  });

  it("écrit un manifeste multi-documents sans qu'un document écrase l'autre", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-donnees-"));
    try {
      const unites = corpusConstruit(root, [
        descripteurReduit(),
        descripteurReduit({ document: "32000R0002", nom: "Deuxième acte" }),
      ]);
      const manifeste = JSON.parse(
        readFileSync(join(root, "data", "corpus", "donnees", "manifest.json"), "utf8"),
      ) as {
        documents: { document: string }[];
        unites: number;
        couverture: { comptes: Record<string, number> };
      };
      assert.deepEqual(
        manifeste.documents.map((document) => document.document),
        ["32000R0001", "32000R0002"],
      );
      assert.equal(manifeste.unites, unites.length);
      assert.deepEqual(manifeste.couverture.comptes, {
        documents: 2,
        articles: 4,
        considerants: 4,
        points: 4,
        annexes: 4,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("commite le manifeste des sept documents et leurs CELEX", () => {
    const manifeste = JSON.parse(
      readFileSync(join(ROOT, "data", "corpus", "donnees", "manifest.json"), "utf8"),
    ) as { documents: { document: string }[] };
    assert.deepEqual(
      manifeste.documents.map((document) => document.document).sort(),
      [...CELEX].sort(),
    );
  });

  it("attribue l'article 4 du Data Act et le dit présent au corpus", () => {
    const citations = extraireCitations("l'article 4 du règlement (UE) 2023/2854");
    assert.equal(citations.length, 1);
    assert.equal(citations[0]?.instrument, "Data Act");
    assert.equal(citations[0]?.document, "32023R2854");
    assert.equal(citations[0]?.reference, "Data Act · art. 4");

    const rendues = marquerPresence(documentsPresents(ROOT), citations);
    assert.equal(rendues[0]?.hors_corpus, false);
  });

  it("suit les sept CELEX dans la requête de consolidations de la veille", () => {
    const requete = requeteConsolidations(actesSuivis());
    for (const celex of CELEX) {
      assert.match(requete, new RegExp(`"0${celex.slice(1)}"`), celex);
    }
  });

  it("rend le statut d'application des textes et de la recommandation", () => {
    assert.equal(statutApplication("donnees", "EN_VIGUEUR"), "en_vigueur");
    assert.equal(statutApplication("donnees", "ADOPTEE"), "adoptee");
    assert.equal(statutApplication("donnees", "ABROGE"), "abroge");
  });

  it("retrouve l'article unique des logos DGA par son numéro", () => {
    const article = getArticle(ROOT, { document: "32023R1622", numero: "unique" });
    assert.equal(article.trouve, true);
    assert.equal(article.trouve ? article.numero : null, "unique");
    assert.equal(article.trouve ? article.corpus : null, "donnees");
  });

  it("n'exige pas de descripteur à plat quand aucune consolidation n'est à appliquer", async () => {
    const resultat = await synchroniserActeUe({ rootDir: ROOT, corpus: "donnees" });
    assert.equal(resultat.ecrit, false);
    assert.match(resultat.message, /aucune version consolidée à appliquer/);
  });

  it("résout le nom des actes dans les outils", () => {
    assert.deepEqual(documentsNommes("le Data Act et la DGA"), ["32023R2854", "32022R0868"]);
    assert.deepEqual(documentsNommes("l'article 24 du Data Act"), ["32023R2854"]);
    assert.equal(referenceExacte("l'article 24 du Data Act"), "24");

    const article = getArticle(ROOT, { document: "Data Act", numero: "24" });
    assert.equal(article.trouve, true);
    assert.equal(article.trouve ? article.corpus : null, "donnees");
  });

  it("extrait et attribue une citation de l'article unique des logos DGA", () => {
    const citations = extraireCitations(
      "l'article unique du règlement d'exécution (UE) 2023/1622",
    );
    assert.equal(citations.length, 1);
    assert.equal(citations[0]?.document, "32023R1622");
    assert.deepEqual(citations[0]?.articles, ["unique"]);
    assert.equal(marquerPresence(documentsPresents(ROOT), citations)[0]?.hors_corpus, false);
  });

  it("pointe chaque unité par une ancre qui existe dans sa capture", () => {
    const manifeste = JSON.parse(
      readFileSync(join(ROOT, "data", "corpus", "donnees", "manifest.json"), "utf8"),
    ) as { documents: { document: string; snapshot: string }[] };
    const captures = new Map(
      manifeste.documents.map((document) => [
        document.document,
        readFileSync(
          join(ROOT, "data", "raw", document.snapshot.slice(0, 2), document.snapshot),
          "utf8",
        ),
      ]),
    );
    const unites = readFileSync(join(ROOT, "data", "corpus", "donnees", "unites.jsonl"), "utf8")
      .split("\n")
      .filter((ligne) => ligne.trim() !== "")
      .map((ligne) => JSON.parse(ligne) as Unite);
    assert.equal(unites.length, 470);

    for (const unite of unites) {
      const fragment = unite.url.split("#")[1];
      const capture = captures.get(unite.document);
      assert.ok(fragment !== undefined && capture !== undefined, unite.ref);
      assert.ok(capture?.includes(`id="${fragment}"`), `${unite.ref} → #${fragment}`);
    }
  });
});
