import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { documentDeclare, documentsExclus } from "../mcp/corpus/citations.ts";
import type { Citation } from "../mcp/corpus/citations.ts";
import { classementHorsCorpus, classerCitations } from "../mcp/corpus/hors-corpus.ts";
import type { CitationsParCorpus } from "../mcp/corpus/hors-corpus.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const EPRIVACY = "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32002L0058";

/** Libellés du catalogue, pour des citations simulées lisibles. */
const LIBELLES: Readonly<Record<string, string>> = {
  "32002L0058": "ePrivacy",
  "LEGITEXT000006070987": "CPCE",
  "32016R0679": "RGPD",
  "31995L0046": "directive 95/46/CE",
};

/** Une citation rendue, sans passer par l'extraction : le cas du document × instrument. */
function citation(identifiant: string): Citation {
  const instrument = LIBELLES[identifiant] ?? identifiant;
  return {
    instrument,
    document: identifiant,
    articles: ["13"],
    reference: `${instrument} · art. 13`,
    url: null,
  };
}

/** Un corpus de décisions simulé : chaque décision cite un instrument. */
function corpusSimule(
  corpus: string,
  decisions: readonly (readonly [string, string])[],
): CitationsParCorpus[number] {
  const parDocument = new Map<string, Citation[]>();
  for (const [decision, instrument] of decisions) {
    parDocument.set(decision, [citation(instrument)]);
  }
  return { corpus, citations: parDocument };
}

/** Les deux corpus du scope : ePrivacy cité 4 fois par la CNIL et 1 fois par le CE. */
function corpusDuScope(): CitationsParCorpus {
  return [
    corpusSimule("cnil", [
      ["CNILTEXT000000000001", "32002L0058"],
      ["CNILTEXT000000000002", "32002L0058"],
      ["CNILTEXT000000000003", "32002L0058"],
      ["CNILTEXT000000000004", "32002L0058"],
    ]),
    corpusSimule("ce", [["CETATEXT000000000001", "32002L0058"]]),
    corpusSimule("cc", [
      ["5fca262d4504b03b8a33c16e", "LEGITEXT000006070987"],
      ["64085c8866b1bafb02f12088", "LEGITEXT000006070987"],
    ]),
  ];
}

function racine(): string {
  return mkdtempSync(join(tmpdir(), "hors-corpus-"));
}

function unite(document: string, corpus: string, texte: string): Unite {
  return {
    ref: `${document}#f0`,
    document,
    corpus,
    niveau: "fragment",
    numero: "SAN-2026-015",
    chemin: "CNIL > Sanction > Délibération SAN-2026-015",
    texte,
    date_acte: "2026-11-10",
    date_debut: "2026-11-10",
    date_fin: null,
    statut: "VIGUEUR",
    url: `https://www.legifrance.gouv.fr/cnil/id/${document}`,
    origine: "dila",
    nature: "Sanction",
  };
}

function ecrireCorpus(root: string, corpus: string, unites: Unite[]): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(
    join(dossier, "unites.jsonl"),
    `${unites.map((element) => JSON.stringify(element)).join("\n")}\n`,
    "utf8",
  );
  writeFileSync(
    join(dossier, "manifest.json"),
    `${JSON.stringify({ corpus, documents: unites.length, unites: unites.length }, null, 2)}\n`,
    "utf8",
  );
}

function ecrireManifeste(root: string, corpus: string, manifeste: Record<string, unknown>): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "manifest.json"), `${JSON.stringify(manifeste, null, 2)}\n`, "utf8");
}

describe("le classement des documents hors corpus", () => {
  it("compte les citations rendues et trie par compte décroissant", () => {
    const documents = classerCitations(corpusDuScope(), new Set<string>(), new Set<string>());

    assert.deepEqual(
      documents.map((document) => [document.document, document.citations]),
      [
        ["32002L0058", 5],
        ["LEGITEXT000006070987", 2],
      ],
    );
    assert.equal(documents[0]?.instrument, "ePrivacy");
    assert.equal(documents[0]?.url, EPRIVACY);
    assert.equal(documents[0]?.statut, "absent");
    assert.deepEqual(documents[0]?.autorites, [
      { autorite: "CNIL", citations: 4 },
      { autorite: "Conseil d'État", citations: 1 },
    ]);
    assert.equal(documents[1]?.instrument, "CPCE");
    assert.deepEqual(documents[1]?.autorites, [{ autorite: "Cour de cassation", citations: 2 }]);
  });

  it("écarte un document présent au corpus", () => {
    const citations: CitationsParCorpus = [
      corpusSimule("cnil", [
        ["CNILTEXT000000000001", "32016R0679"],
        ["CNILTEXT000000000002", "32002L0058"],
      ]),
    ];
    const documents = classerCitations(citations, new Set(["32016R0679"]), new Set<string>());

    assert.deepEqual(
      documents.map((document) => document.document),
      ["32002L0058"],
    );
  });

  it("marque `exclu` un document déclaré hors périmètre, sans le retirer du classement", () => {
    const documents = classerCitations(
      corpusDuScope(),
      new Set<string>(),
      new Set(["32002L0058"]),
    );

    const ePrivacy = documents.find((document) => document.document === "32002L0058");
    assert.equal(ePrivacy?.statut, "exclu");
    assert.equal(ePrivacy?.citations, 5);
    assert.equal(documents[0]?.document, "32002L0058");
  });

  it("trie à égalité de citations par identifiant croissant", () => {
    const citations: CitationsParCorpus = [
      corpusSimule("cnil", [
        ["CNILTEXT000000000001", "32016R0679"],
        ["CNILTEXT000000000002", "32002L0058"],
      ]),
    ];
    const documents = classerCitations(citations, new Set<string>(), new Set<string>());

    assert.deepEqual(
      documents.map((document) => document.document),
      ["32002L0058", "32016R0679"],
    );
  });

  it("déclare le libellé et le lien d'un instrument, et n'exclut rien aujourd'hui", () => {
    assert.deepEqual(documentDeclare("32002l0058"), { libelle: "ePrivacy", url: EPRIVACY });
    assert.equal(documentDeclare("inconnu"), null);
    // Le statut de périmètre ne se lit que là : vide tant que le catalogue n'exclut rien.
    assert.deepEqual(documentsExclus(), new Set<string>());
  });

  it("lit un corpus temporaire et le date", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [
        unite("CNILTEXT000000000001", "cnil", "l'article 13 de la directive ePrivacy"),
        unite(
          "CNILTEXT000000000002",
          "cnil",
          "l'article 13 de la directive ePrivacy et l'article 6 du règlement (UE) 2016/679",
        ),
      ]);
      ecrireCorpus(root, "ce", [
        unite("CETATEXT000000000001", "ce", "l'article 13 de la directive ePrivacy"),
      ]);
      // Le RGPD est au corpus : sa citation ne classe rien.
      ecrireManifeste(root, "rgpd", { document: "32016R0679", documents: 1, unites: 272 });

      const classement = classementHorsCorpus(root, "2026-11-13");

      assert.equal(classement.calcule_le, "2026-11-13");
      assert.deepEqual(
        classement.documents.map((document) => [document.document, document.citations]),
        [["32002L0058", 3]],
      );
      assert.deepEqual(classement.documents[0]?.autorites, [
        { autorite: "CNIL", citations: 2 },
        { autorite: "Conseil d'État", citations: 1 },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend un classement vide sur une racine sans corpus", () => {
    const root = racine();
    try {
      assert.deepEqual(classementHorsCorpus(root, "2026-11-13"), {
        calcule_le: "2026-11-13",
        documents: [],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
