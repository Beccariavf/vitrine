import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { lireDescripteurs } from "../mcp/corpus/build.ts";
import {
  absenceDuDocument,
  avecPresence,
  documentsPresents,
  extraireCitations,
} from "../mcp/corpus/citations.ts";
import { INSTRUCTION_FRONTIERES, INSTRUCTIONS_REQUETE } from "../mcp/embed/embedder.ts";
import { considerantsOrigine, considerantsPatrimoniaux, parseFrontieres } from "../mcp/corpus/frontieres/parse.ts";
import type { Descripteur, Unite } from "../mcp/corpus/parse.ts";
import { documentsNommes, getArticle } from "../mcp/tools.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Les dix actes du corpus, dans l'ordre du ticket #139. */
const CELEX = [
  "32019R1020",
  "32024L2853",
  "32024R2847",
  "32023R1230",
  "31996L0009",
  "32016L0943",
  "32019L0790",
  "32022R2065",
  "32024L2831",
  "32023L2225",
];

/** Ceux dont CELLAR sert la consolidation française ; les autres sont rendus dans leur acte d'origine. */
const CONSOLIDES = [
  "32019R1020",
  "32024L2853",
  "32024R2847",
  "32023R1230",
  "31996L0009",
  "32022R2065",
  "32023L2225",
];

const ORIGINAUX = ["32016L0943", "32019L0790", "32024L2831"];

const CONSOLIDE = readFileSync(new URL("./fixtures/eurlex/frontieres.xhtml", import.meta.url), "utf8");
const ANCRE = readFileSync(new URL("./fixtures/eurlex/donnees.xhtml", import.meta.url), "utf8");

type DocumentManifeste = {
  document: string;
  version?: string;
  date_consolidation?: string | null;
  considerants_source?: string;
  snapshot: string;
  snapshot_considerants?: string;
  couverture: { comptes: Record<string, number> };
};

type Manifeste = {
  documents: DocumentManifeste[];
  unites: number;
  couverture: { comptes: Record<string, number> };
};

function descripteurs(): Descripteur[] {
  return lireDescripteurs().filter((descripteur) => descripteur.corpus === "frontieres");
}

function descripteur(document: string): Descripteur {
  const trouve = descripteurs().find((candidat) => candidat.document === document);
  assert.ok(trouve, `descripteur ${document}`);
  return trouve;
}

function manifeste(): Manifeste {
  return JSON.parse(
    readFileSync(join(ROOT, "data", "corpus", "frontieres", "manifest.json"), "utf8"),
  ) as Manifeste;
}

function unites(): Unite[] {
  return readFileSync(join(ROOT, "data", "corpus", "frontieres", "unites.jsonl"), "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim() !== "")
    .map((ligne) => JSON.parse(ligne) as Unite);
}

/** Capture brute conservée par `writeRaw`, adressée par son `sha256`. */
function capture(nom: string): string {
  return readFileSync(join(ROOT, "data", "raw", nom.slice(0, 2), nom), "utf8");
}

function reduit(surcharge: Partial<Descripteur> = {}): Descripteur {
  return {
    document: "32000R0001",
    corpus: "frontieres",
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
    considerants_attendus: 0,
    annexes_attendues: 2,
    parseur: "frontieres",
    ...surcharge,
  };
}

/** Descripteur de la capture réduite consolidée : `estConsolide` lit `version`. */
function consolide(surcharge: Partial<Descripteur> = {}): Descripteur {
  return reduit({
    version: "02000R0001-20260102",
    date_consolidation: "2026-01-02",
    ...surcharge,
  });
}

describe("corpus frontieres", () => {
  it("déclare les dix actes du ticket, lus sur CELLAR", () => {
    assert.deepEqual(
      descripteurs().map((declaration) => declaration.document).sort(),
      [...CELEX].sort(),
    );
    for (const declaration of descripteurs()) {
      assert.equal(declaration.parseur, "frontieres", declaration.document);
      assert.equal(declaration.langue, "fra", declaration.document);
      assert.equal(declaration.statut, "en_vigueur", declaration.document);
      assert.match(declaration.url, /CELEX:/, declaration.document);
    }
  });

  it("sert la consolidation française quand elle existe, l'acte d'origine sinon", () => {
    const parDocument = new Map(
      descripteurs().map((declaration) => [declaration.document, declaration]),
    );
    for (const document of CONSOLIDES) {
      const declaration = parDocument.get(document);
      assert.match(declaration?.version ?? "", /^0/, `${document} : consolidation`);
      assert.match(declaration?.date_consolidation ?? "", /^\d{4}-\d{2}-\d{2}$/, document);
    }
    for (const document of ORIGINAUX) {
      const declaration = parDocument.get(document);
      assert.equal(declaration?.version, document, `${document} : acte d'origine`);
      assert.equal(declaration?.date_consolidation, null, document);
    }
  });

  it("écrit un manifeste à dix documents et les comptes de chaque acte", () => {
    const relu = manifeste();
    assert.deepEqual(
      relu.documents.map((document) => document.document).sort(),
      [...CELEX].sort(),
    );
    assert.equal(relu.documents.length, 10);
    assert.equal(relu.unites, 1332);
    assert.deepEqual(relu.couverture.comptes, {
      documents: 10,
      articles: 443,
      considerants: 861,
      annexes: 28,
    });

    const comptes = new Map(
      relu.documents.map((document) => [document.document, document.couverture.comptes]),
    );
    assert.deepEqual(comptes.get("32024R2847"), { articles: 71, considerants: 130, annexes: 8 });
    assert.deepEqual(comptes.get("31996L0009"), { articles: 17, considerants: 60 });
    assert.deepEqual(comptes.get("32023R1230"), { articles: 59, considerants: 86, annexes: 12 });
    assert.deepEqual(comptes.get("32019R1020"), { articles: 44, considerants: 68, annexes: 3 });
    assert.deepEqual(comptes.get("32024L2853"), { articles: 24, considerants: 64, annexes: 1 });
    assert.deepEqual(comptes.get("32022R2065"), { articles: 93, considerants: 156 });
    assert.deepEqual(comptes.get("32023L2225"), { articles: 50, considerants: 98, annexes: 4 });
    assert.deepEqual(comptes.get("32016L0943"), { articles: 21, considerants: 40 });
    assert.deepEqual(comptes.get("32019L0790"), { articles: 32, considerants: 86 });
    assert.deepEqual(comptes.get("32024L2831"), { articles: 32, considerants: 73 });
  });

  it("déclare l'acte d'origine des considérants quand la consolidation n'a pas de préambule", () => {
    const parDocument = new Map(manifeste().documents.map((document) => [document.document, document]));
    for (const document of CONSOLIDES) {
      const entree = parDocument.get(document);
      assert.equal(entree?.considerants_source, document, `${document} : source des considérants`);
      assert.ok(entree?.snapshot_considerants, `${document} : capture des considérants`);
    }
    for (const document of ORIGINAUX) {
      assert.equal(parDocument.get(document)?.considerants_source, undefined, document);
    }
  });

  it("découpe articles, chapitres et annexes d'une consolidation", () => {
    const decoupees = parseFrontieres(CONSOLIDE, consolide());

    assert.deepEqual(
      decoupees.map((unite) => [unite.ref, unite.niveau]),
      [
        ["32000R0001#art_1", "article"],
        ["32000R0001#art_2", "article"],
        ["32000R0001#anx_I", "annexe"],
        ["32000R0001#anx_II", "annexe"],
      ],
    );
    assert.equal(decoupees[0]?.chemin, "Capture réduite > Chapitre I > OBJET");
    assert.equal(decoupees[1]?.numero, "2");
    assert.equal(decoupees[2]?.chemin, "Capture réduite > Annexe I");
    assert.match(decoupees[2]?.texte ?? "", /^ANNEXE I Texte de l'annexe I/);
    assert.equal(
      decoupees[0]?.url,
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02000R0001-20260102",
    );
  });

  it("découpe un acte d'origine par ses ancres ELI, annexes comprises", () => {
    const decoupees = parseFrontieres(ANCRE, reduit({ considerants_attendus: 2 }));

    assert.deepEqual(
      decoupees.map((unite) => unite.niveau),
      ["considérant", "considérant", "article", "article", "annexe", "annexe"],
    );
    assert.equal(decoupees[0]?.ref, "32000R0001#rct_1");
    assert.equal(decoupees[0]?.url, "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32000R0001#rct_1");
  });

  it("refuse une capture dont un compte attendu ne correspond pas", () => {
    assert.throws(
      () => parseFrontieres(CONSOLIDE, consolide({ articles_attendus: 3 })),
      /2 articles au lieu de 3 attendus/,
    );
    assert.throws(
      () => parseFrontieres(CONSOLIDE, consolide({ annexes_attendues: 1 })),
      /2 annexe\(s\) au lieu de 1 attendues/,
    );
  });

  it("lit les considérants de 96/9 dans son HTML patrimonial, sans ancre ELI", () => {
    const declaration = descripteur("31996L0009");
    const entree = manifeste().documents.find((document) => document.document === "31996L0009");
    assert.ok(entree?.snapshot_considerants, "capture des considérants");
    const origine = capture(entree.snapshot_considerants);

    const considerants = considerantsOrigine(origine, declaration);
    assert.equal(considerants.length, 60);
    assert.equal(considerants[0]?.ref, "31996L0009#rct_1");
    assert.equal(considerants[0]?.niveau, "considérant");
    assert.match(considerants[0]?.texte ?? "", /bases de données ne sont actuellement pas suffisamment protégées/);
    assert.equal(considerants[0]?.url, "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:31996L0009");
    assert.deepEqual(
      considerants.map((unite) => Number(unite.numero)),
      Array.from({ length: 60 }, (_, index) => index + 1),
    );
  });

  it("lève quand une ligne de considérant patrimonial manque", () => {
    const declaration = descripteur("31996L0009");
    const entree = manifeste().documents.find((document) => document.document === "31996L0009");
    assert.ok(entree?.snapshot_considerants);
    const ampute = capture(entree.snapshot_considerants).replace(
      /<tr>\s*<td[^>]*>\s*<p class="normal">\(7\)<\/p>[\s\S]*?<\/tr>/,
      "",
    );
    assert.throws(
      () => considerantsPatrimoniaux(ampute, declaration),
      /considérant \(7\) absent/,
    );
  });

  it("attribue les citations du CRA et de la directive 96/9/CE, et les dit présentes", () => {
    const citations = avecPresence(ROOT, [
      ...extraireCitations("l'article 13 du règlement (UE) 2024/2847"),
      ...extraireCitations("l'article 7 de la directive 96/9/CE"),
    ]);
    assert.deepEqual(
      citations.map((citation) => [citation.instrument, citation.document, citation.articles, citation.hors_corpus]),
      [
        ["CRA", "32024R2847", ["13"], false],
        ["directive bases de données", "31996L0009", ["7"], false],
      ],
    );
    for (const citation of citations) {
      assert.equal(absenceDuDocument(ROOT, citation.document), null, citation.document);
    }
  });

  it("n'attribue rien sur un préfixe de sigle ou de numéro", () => {
    for (const texte of [
      "L'article 18 du même règlement s'applique dans une société démocratique.",
      "l'article 5 de la directive 96/92/CE",
      "l'article 5 de la directive 96/94/CE",
      "l'article 40 du DSAC",
      "l'article 5 du règlement machines-outils",
    ]) {
      assert.deepEqual(extraireCitations(texte), [], texte);
    }
  });

  it("nomme un acte de frontière dans une question", () => {
    const cas: Array<[string, string]> = [
      ["l'article 14 du CRA", "32024R2847"],
      ["le Cyber Resilience Act", "32024R2847"],
      ["le règlement machines", "32023R1230"],
      ["le DSA", "32022R2065"],
      ["le règlement sur les services numériques", "32022R2065"],
      ["la directive bases de données", "31996L0009"],
      ["la directive secret des affaires", "32016L0943"],
      ["la directive droit d'auteur", "32019L0790"],
      ["la directive travail via une plateforme", "32024L2831"],
      ["la directive crédit à la consommation", "32023L2225"],
      ["le règlement surveillance du marché", "32019R1020"],
      ["la directive responsabilité du fait des produits", "32024L2853"],
    ];
    for (const [question, document] of cas) {
      assert.deepEqual(documentsNommes(question), [document], question);
    }
  });

  it("sert l'article 14 du CRA et l'article 7 de la directive 96/9/CE", () => {
    const cra = getArticle(ROOT, { document: "32024R2847", numero: "14" });
    assert.equal(cra.trouve, true);
    assert.match(cra.texte ?? "", /vulnérabilité activement exploitée/);

    const bases = getArticle(ROOT, { document: "31996L0009", numero: "7" });
    assert.equal(bases.trouve, true);
    assert.match(bases.texte ?? "", /fabricant d'une base de données/);
  });

  it("porte une instruction de requête pour le corpus et ses dix actes", () => {
    assert.equal(INSTRUCTIONS_REQUETE.frontieres, INSTRUCTION_FRONTIERES);
    for (const document of CELEX) {
      assert.equal(INSTRUCTIONS_REQUETE[document], INSTRUCTION_FRONTIERES, document);
    }
    assert.match(INSTRUCTION_FRONTIERES, /l'article du texte européen de frontière/);
  });

  it("garde chaque annexe adressable dans sa capture", () => {    const parDocument = new Map(manifeste().documents.map((document) => [document.document, document]));
    const captures = new Map(
      [...parDocument].map(([document, entree]) => [document, capture(entree.snapshot)]),
    );
    const annexes = unites().filter((unite) => unite.niveau === "annexe");
    assert.equal(annexes.length, 28);
    for (const annexe of annexes) {
      const html = captures.get(annexe.document);
      assert.ok(html, annexe.document);
      assert.ok(html.includes(`id="${annexe.ref.slice(annexe.document.length + 1)}"`), annexe.ref);
    }
  });
});
