import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Unite } from "../mcp/corpus/parse.ts";
import { citeArticle, decisionsCitant, formeArticle } from "../mcp/corpus/citants.ts";

const RGPD = "32016R0679";
const LIL = "LEGITEXT000006068624";
const CPCE = "LEGITEXT000006070987";
const EPRIVACY = "32002L0058";

function article(document: string, corpus: string, numero: string): Unite {
  return {
    ref: `${document}#art_${numero}`,
    document,
    corpus,
    niveau: "article",
    numero,
    chemin: corpus,
    texte: `article ${numero}`,
    date_acte: "2016-04-27",
    date_debut: "2018-05-25",
    date_fin: null,
    statut: "en_vigueur",
    url: `https://exemple.test/${document}/${numero}`,
  };
}

function decision(corpus: string, document: string, date: string, texte: string, chemin: string): Unite {
  return {
    ref: `${document}#f0`,
    document,
    corpus,
    niveau: "fragment",
    numero: corpus === "cc" ? "visa" : "1",
    chemin,
    texte,
    date_acte: date,
    date_debut: date,
    date_fin: null,
    statut: "VIGUEUR",
    url: `https://exemple.test/${document}`,
  };
}

function ecrireCorpus(root: string, corpus: string, unites: Unite[], manifeste: Record<string, string>): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "manifest.json"), JSON.stringify(manifeste));
  writeFileSync(join(dossier, "unites.jsonl"), `${unites.map((u) => JSON.stringify(u)).join("\n")}\n`);
}

function racine(): string {
  const root = mkdtempSync(join(tmpdir(), "vitrine-citants-"));
  ecrireCorpus(
    root,
    "rgpd",
    ["8", "9", "10", "11"].map((numero) => article(RGPD, "rgpd", numero)),
    { document: RGPD },
  );
  ecrireCorpus(
    root,
    "lil",
    ["1", "26", "26-1"].map((numero) => article(LIL, "lil", numero)),
    { text_id: LIL },
  );
  ecrireCorpus(
    root,
    "cnil",
    [
      decision("cnil", "CNILTEXT1", "2024-01-10", "en application de l'article 9(2) du RGPD", "CNIL > Sanctions > Délibération SAN-2024-001"),
      decision("cnil", "CNILTEXT2", "2025-03-01", "les articles 8 à 10 du RGPD", "CNIL > Avis > Délibération 2025-010"),
      decision("cnil", "CNILTEXT3", "2023-06-01", "Vu l'article 26-1 de la loi n° 78-17 du 6 janvier 1978.", "CNIL > Avis > Délibération 2023-050"),
      decision("cnil", "CNILTEXT4", "2022-02-02", "l'article L. 34-5 du code des postes et des communications électroniques", "CNIL > Sanctions > Délibération SAN-2022-002"),
    ],
    { corpus: "cnil" },
  );
  ecrireCorpus(
    root,
    "cc",
    [
      decision("cc", "jud1", "2025-03-01", "Vu l'article 9 du RGPD et l'article 1er de la loi n° 78-17 du 6 janvier 1978.", "Cour de cassation > Chambre sociale > Décision du 1 mars 2025 > Visa"),
    ],
    { corpus: "cc" },
  );
  return root;
}

describe("formes d'article", () => {
  it("reconnaît les écritures courantes d'un numéro", () => {
    for (const forme of ["9", "art. 9", "article 9", "Article 9", "09"]) {
      assert.deepEqual(formeArticle(forme), { prefixe: "", corps: "9" }, forme);
    }
    assert.deepEqual(formeArticle("1er"), { prefixe: "", corps: "1" });
    assert.deepEqual(formeArticle("L.34-5"), { prefixe: "L. ", corps: "34-5" });
    assert.deepEqual(formeArticle("L. 34-5"), { prefixe: "L. ", corps: "34-5" });
    assert.equal(formeArticle("considérant"), null);
  });

  it("compte l'alinéa et la plage, jamais l'article à tiret", () => {
    const neuf = formeArticle("9");
    const vingtSix = formeArticle("26");
    assert.ok(neuf !== null && vingtSix !== null);
    assert.equal(citeArticle("9(2)", neuf), true);
    assert.equal(citeArticle("9.2", neuf), true);
    assert.equal(citeArticle("8–10", neuf), true);
    assert.equal(citeArticle("10–12", neuf), false);
    assert.equal(citeArticle("26-1", vingtSix), false);
    assert.equal(citeArticle("L. 9", neuf), false);
  });
});

describe("decisions_citant", () => {
  it("rend les décisions citantes triées, avec autorité, intitulé, date, lien et comptes", () => {
    const root = racine();
    try {
      const resultat = decisionsCitant(root, { document: RGPD, numero: "art. 9" });

      assert.equal(resultat.trouve, true);
      assert.equal(resultat.article_au_corpus, true);
      assert.equal(resultat.total, 3);
      assert.deepEqual(resultat.par_autorite, [
        { autorite: "CNIL", decisions: 2 },
        { autorite: "Cour de cassation", decisions: 1 },
      ]);
      assert.deepEqual(
        resultat.decisions.map((d) => [d.document, d.date_acte]),
        [
          ["CNILTEXT2", "2025-03-01"],
          ["jud1", "2025-03-01"],
          ["CNILTEXT1", "2024-01-10"],
        ],
      );
      const cassation = resultat.decisions.find((d) => d.corpus === "cc");
      assert.equal(cassation?.autorite, "Cour de cassation");
      assert.equal(cassation?.intitule, "Cour de cassation > Chambre sociale > Décision du 1 mars 2025");
      assert.equal(cassation?.url, "https://exemple.test/jud1");
      assert.match(cassation?.reference ?? "", /RGPD · art\. 9/);
      assert.equal(resultat.message, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("pagine sans changer le total ni les comptes", () => {
    const root = racine();
    try {
      const page = decisionsCitant(root, { document: RGPD, numero: "9", limite: 1, decalage: 1 });

      assert.equal(page.total, 3);
      assert.equal(page.par_autorite.length, 2);
      assert.deepEqual(page.decisions.map((d) => d.document), ["jud1"]);
      assert.equal(page.decalage, 1);
      assert.equal(page.tronque, true);
      assert.equal(decisionsCitant(root, { document: RGPD, numero: "9", decalage: 2 }).tronque, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("distingue 26-1 de 26 et lit 1er comme 1", () => {
    const root = racine();
    try {
      assert.equal(decisionsCitant(root, { document: LIL, numero: "26" }).total, 0);
      assert.deepEqual(
        decisionsCitant(root, { document: LIL, numero: "26-1" }).decisions.map((d) => d.document),
        ["CNILTEXT3"],
      );
      assert.deepEqual(
        decisionsCitant(root, { document: LIL, numero: "1" }).decisions.map((d) => d.document),
        ["jud1"],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("un article au corpus jamais cité rend une liste vide dite explicitement, non exhaustive", () => {
    const root = racine();
    try {
      const resultat = decisionsCitant(root, { document: RGPD, numero: "11" });

      assert.equal(resultat.article_au_corpus, true);
      assert.equal(resultat.total, 0);
      assert.deepEqual(resultat.decisions, []);
      assert.match(resultat.message ?? "", /Aucune décision du corpus ne cite l'article 11 du RGPD/);
      assert.match(resultat.message ?? "", /non exhaustive/);
      assert.doesNotMatch(resultat.message ?? "", /absent/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("un article absent du corpus est dit absent, jamais seulement « non cité »", () => {
    const root = racine();
    try {
      const resultat = decisionsCitant(root, { document: RGPD, numero: "200" });

      assert.equal(resultat.trouve, true);
      assert.equal(resultat.article_au_corpus, false);
      assert.match(resultat.message ?? "", /L'article 200 du RGPD est absent du corpus/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("un instrument connu absent du corpus garde ses citants et la phrase d'absence", () => {
    const root = racine();
    try {
      const resultat = decisionsCitant(root, { document: CPCE, numero: "L.34-5" });

      assert.equal(resultat.article_au_corpus, false);
      assert.deepEqual(resultat.decisions.map((d) => d.document), ["CNILTEXT4"]);
      assert.match(resultat.message ?? "", /absent de mon corpus \(périmètre :/);

      const eprivacy = decisionsCitant(root, { document: EPRIVACY, numero: "5" });
      assert.equal(eprivacy.total, 0);
      assert.match(eprivacy.message ?? "", /absent de mon corpus/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("un identifiant inconnu ou un numéro illisible est refusé", () => {
    const root = racine();
    try {
      const inconnu = decisionsCitant(root, { document: "INCONNU", numero: "1" });
      assert.equal(inconnu.trouve, false);
      assert.match(inconnu.message ?? "", /inconnu/);

      const illisible = decisionsCitant(root, { document: RGPD, numero: "considérant" });
      assert.equal(illisible.trouve, false);
      assert.match(illisible.message ?? "", /n'est pas un numéro d'article/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
