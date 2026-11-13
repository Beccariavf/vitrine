import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Unite } from "../mcp/corpus/parse.ts";
import {
  FAMILLES,
  decisionsCitantDecision,
  decisionsCitees,
  extraireReferences,
  lireReference,
} from "../mcp/corpus/citations-decisions.ts";

const TOUTES = new Set(FAMILLES);

function unite(corpus: string, document: string, numero: string, chemin: string, date: string, texte: string): Unite {
  return {
    ref: `${document}#f0`,
    document,
    corpus,
    niveau: "fragment",
    numero,
    chemin,
    texte,
    date_acte: date,
    date_debut: date,
    date_fin: null,
    statut: "VIGUEUR",
    url: `https://exemple.test/${document}`,
  };
}

function ecrire(root: string, corpus: string, unites: Unite[]): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "unites.jsonl"), `${unites.map((u) => JSON.stringify(u)).join("\n")}\n`);
}

function racine(): string {
  const root = mkdtempSync(join(tmpdir(), "vitrine-cit-dec-"));
  ecrire(root, "cjue", [
    unite("cjue", "62018CJ0311", "entête", "CJUE > Arrêt de la Cour C-311/18 > En-tête", "2020-07-16", "Affaire C‑311/18, Facebook Ireland et Schrems."),
  ]);
  ecrire(root, "ce", [
    unite("ce", "CE2018", "393099", "Conseil d'État > Décision 393099", "2018-07-26", "texte"),
    unite("ce", "CE2021", "393099", "Conseil d'État > Décision 393099", "2021-04-21", "1° Sous le n° 393099 ... 2° Sous le n° 394922, par une requête"),
  ]);
  ecrire(root, "cc", [
    unite("cc", "jud1", "0", "Cour de cassation > Chambre sociale > Décision du 25 novembre 2020 > 17-19.523 > Texte", "2020-11-25",
      "Pourvoi n° X 17-19.523. Vu l'arrêt CJUE du 16 juillet 2020, C-311/18 ; (CE, 21 avril 2021, French Data Network, n° 393099, point 58) ; Soc., 3 avril 2019, pourvoi n° 18-11.293."),
  ]);
  ecrire(root, "cnil", [
    unite("cnil", "CNIL1", "SAN-2019-001", "CNIL > Sanctions > Délibération SAN-2019-001", "2019-06-01",
      "Vu la délibération n° 91-045 du 11 juin 1991 ; vu l'arrêt C-311/18 et la délibération SAN-2019-001 ; Conseil d'État, 21 avril 2021, n° 394922 ; n° 123456 du registre."),
    unite("cnil", "CNIL2", "91-045", "CNIL > Avis > Délibération 91-045", "1991-06-11", "texte"),
  ]);
  return root;
}

describe("références de décisions", () => {
  it("reconnaît les cinq familles et normalise tirets et années", () => {
    const refs = extraireReferences(
      "C‑311/18 ; T-435/16 P ; ECLI:EU:C:2019:801. ; SAN-2019-001 ; délibération n° 91-045 ; " +
        "CE, 12 mars 2014, n° 353066 ; Cass. soc., 3 avril 2019, n° 18-11.293",
    );
    assert.deepEqual(
      refs.map((r) => [r.famille, r.cle]),
      [
        ["affaire_ue", "C-311/18"],
        ["affaire_ue", "T-435/16"],
        ["ecli", "ECLI:EU:C:2019:801"],
        ["deliberation_cnil", "SAN-2019-001"],
        ["deliberation_cnil", "1991-045"],
        ["requete_ce", "353066"],
        ["pourvoi_cc", "18-11.293"],
      ],
    );
    assert.equal(refs.find((r) => r.famille === "requete_ce")?.date, "2014-03-12");
  });

  it("date la référence par la date qui la suit avant celle qui la précède", () => {
    const [ref] = extraireReferences("Vu la loi du 6 janvier 1978 et la délibération n° 80-20 du 24 juin 1980");
    assert.equal(ref?.date, "1980-06-24");
    const [pourvoi] = extraireReferences("Crim., 12 juill. 2022, n° 21-83.710");
    assert.equal(pourvoi?.date, "2022-07-12");
    assert.equal(extraireReferences("Lindqvist, C-101/2001")[0]?.cle, "C-101/01");
    assert.deepEqual(extraireReferences("CE, section de l'intérieur, avis n° 393836"), []);
  });

  it("distingue conclusions et ordonnance de l'arrêt, sans prendre le mot « conclusions » seul", () => {
    const acte = (t: string) => extraireReferences(t).map((r) => [r.cle, r.acte]);
    assert.deepEqual(acte("(CJUE, conclusions de l’avocat général M. BOBEK, 13 janvier 2021, C-645/19)"), [["C-645/19", "conclusions"]]);
    assert.deepEqual(acte("ordonnance du président de la Cour du 29 novembre 2023, C-413/23 P"), [["C-413/23", "ordonnance"]]);
    assert.deepEqual(acte("pour en tirer des conclusions précises, arrêt du 2 octobre 2018, C-207/16"), [["C-207/16", undefined]]);
    assert.equal(extraireReferences("conclusions de l’avocat général M. BOBEK, 13 janvier 2021, C-645/19")[0]?.date, "2021-01-13");
  });

  it("ignore un décret dans une délibération et la Communauté européenne", () => {
    assert.deepEqual(extraireReferences("délibération portant avis sur le décret n° 2018-687"), []);
    assert.deepEqual(extraireReferences("directive 95/46/CE, n° 123456"), []);
    assert.deepEqual(extraireReferences("(CE, 21 avril 2021, n° 393099)").map((r) => r.cle), ["393099"]);
  });

  it("ignore un numéro à six chiffres sans Conseil d'État, « Sous le n° » et l'en-tête de pourvoi", () => {
    assert.deepEqual(extraireReferences("déclaration n° 123456 auprès de la CNIL"), []);
    assert.deepEqual(extraireReferences("Conseil d'État. 1° Sous le n° 465652, par un pourvoi"), []);
    assert.deepEqual(extraireReferences("Pourvoi n° X 17-19.523"), []);
  });

  it("lit une référence saisie par l'appelant", () => {
    assert.deepEqual(lireReference("353066"), { famille: "requete_ce", cle: "353066", reference: "n° 353066" });
    assert.equal(lireReference("2019-001")?.cle, "2019-001");
    assert.equal(lireReference("SAN-2019-001")?.famille, "deliberation_cnil");
    assert.equal(lireReference("C‑311/18")?.cle, "C-311/18");
    assert.equal(lireReference("Pourvoi n° Q 19-17.278")?.cle, "19-17.278");
    assert.equal(lireReference("CE, 353066")?.cle, "353066");
    assert.equal(lireReference("bonjour"), null);
  });
});

describe("decisions_citees", () => {
  it("résout vers le corpus, filtre par date et exclut l'auto-citation", () => {
    const root = racine();
    try {
      const citees = decisionsCitees(root, "cc", "jud1", TOUTES);
      assert.deepEqual(
        citees.map((c) => [c.reference, c.cibles.map((cible) => cible.document)]),
        [
          ["C-311/18", ["62018CJ0311"]],
          ["n° 393099", ["CE2021"]],
          ["18-11.293", []],
        ],
      );
      const cnil = decisionsCitees(root, "cnil", "CNIL1", TOUTES);
      assert.deepEqual(
        cnil.map((c) => [c.reference, c.cibles.map((cible) => cible.document)]),
        [
          ["délibération n° 1991-045", ["CNIL2"]],
          ["C-311/18", ["62018CJ0311"]],
          ["n° 394922", ["CE2021"]],
        ],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend les candidats marqués quand la date citée ne correspond à aucun", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-cit-dec-"));
    try {
      ecrire(root, "cjue", [
        unite("cjue", "62017CJ0673", "entête", "CJUE > Arrêt de la Cour C-673/17 > En-tête", "2019-10-01", "texte"),
        unite("cjue", "62012CJ0446", "entête", "CJUE > Arrêt de la Cour C-447/12 > En-tête", "2015-04-16",
          "Dans les affaires jointes C‑446/12 à C‑449/12, ayant pour objet des demandes parvenues à la Cour le 5 octobre 2012, C‑447/12"),
      ]);
      ecrire(root, "ce", [
        unite("ce", "CE1", "451423", "Conseil d'État > Décision 451423", "2022-06-27",
          "arrêt du 12 septembre 2019, C-673/17"),
      ]);
      const citees = decisionsCitees(root, "ce", "CE1", TOUTES);
      const planet = citees.find((c) => c.reference === "C-673/17");
      assert.deepEqual(planet?.cibles.map((c) => c.document), ["62017CJ0673"]);
      assert.equal(planet?.date_divergente, true);
      assert.equal(planet?.date_citee, "2019-09-12");
      // Une date proche de son propre numéro ne fait pas revenir l'arrêt comme citation de lui-même.
      assert.deepEqual(decisionsCitees(root, "cjue", "62012CJ0446", TOUTES), []);
      // La fenêtre ne coupe jamais un jour : « 12 septembre 2024 », pas « 2 septembre ».
      assert.equal(extraireReferences(`${"x".repeat(80)} 12 septembre 2024, C-1/24`)[0]?.date, "2024-09-12");
      // Une parenthèse ou un « et » ouvre la citation suivante : sa date n'est pas celle de C-673/17.
      assert.equal(extraireReferences("Planet49 (C-673/17) et dans son arrêt du 15 juin 2021")[0]?.date, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend tous les candidats d'une référence ambiguë sans date", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-cit-dec-"));
    try {
      ecrire(root, "ce", [
        unite("ce", "CE2018", "393099", "Conseil d'État > Décision 393099", "2018-07-26", "texte"),
        unite("ce", "CE2021", "393099", "Conseil d'État > Décision 393099", "2021-04-21", "texte"),
      ]);
      ecrire(root, "cnil", [unite("cnil", "CNIL9", "2022-001", "CNIL", "2022-01-01", "voir Conseil d'État, n° 393099")]);
      const [citee] = decisionsCitees(root, "cnil", "CNIL9", TOUTES);
      assert.deepEqual(citee?.cibles.map((c) => c.document), ["CE2018", "CE2021"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne rend que les familles exposées", () => {
    const root = racine();
    try {
      assert.deepEqual(decisionsCitees(root, "cc", "jud1", new Set()), []);
      assert.deepEqual(
        decisionsCitees(root, "cc", "jud1", new Set(["affaire_ue"] as const)).map((c) => c.famille),
        ["affaire_ue"],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("decisions_citant_decision", () => {
  it("rend les citants triés, les cibles et les comptes, sans l'arrêt lui-même", () => {
    const root = racine();
    try {
      const resultat = decisionsCitantDecision(root, { reference: "C‑311/18" }, TOUTES);

      assert.equal(resultat.trouve, true);
      assert.deepEqual(resultat.cibles.map((c) => c.document), ["62018CJ0311"]);
      assert.deepEqual(resultat.decisions.map((d) => [d.document, d.autorite]), [
        ["jud1", "Cour de cassation"],
        ["CNIL1", "CNIL"],
      ]);
      assert.equal(resultat.total, 2);
      assert.deepEqual(resultat.decisions[0]?.cite.cibles.map((c) => c.document), ["62018CJ0311"]);

      // Des conclusions citées avant l'arrêt ne masquent pas l'arrêt dans l'outil inverse.
      ecrire(root, "cnil", [
        unite("cnil", "CNIL3", "2023-001", "CNIL", "2023-01-01",
          "conclusions de l’avocat général dans l’affaire C-311/18 ; arrêt du 16 juillet 2020, C-311/18"),
      ]);
      const direct = decisionsCitees(root, "cnil", "CNIL3", TOUTES);
      assert.deepEqual(direct.map((c) => [c.acte, c.cibles.length]), [["conclusions", 0], [undefined, 1]]);
      const inverse = decisionsCitantDecision(root, { reference: "C-311/18" }, TOUTES);
      assert.deepEqual(
        inverse.decisions.find((d) => d.document === "CNIL3")?.cite.cibles.map((c) => c.document),
        ["62018CJ0311"],
      );
      assert.equal(resultat.par_autorite.length, 2);
      assert.equal(decisionsCitantDecision(root, { reference: "C-311/18", limite: 1 }, TOUTES).tronque, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("dit une référence hors corpus, une liste vide, une famille non exposée et une saisie illisible", () => {
    const root = racine();
    try {
      const hors = decisionsCitantDecision(root, { reference: "18-11.293" }, TOUTES);
      assert.deepEqual(hors.cibles, []);
      assert.equal(hors.total, 1);
      assert.match(hors.message ?? "", /n'est pas une décision du corpus/);

      const vide = decisionsCitantDecision(root, { reference: "C-1/99" }, TOUTES);
      assert.equal(vide.total, 0);
      assert.match(vide.message ?? "", /non exhaustive/);

      const masquee = decisionsCitantDecision(root, { reference: "C-311/18" }, new Set());
      assert.equal(masquee.trouve, false);
      assert.match(masquee.message ?? "", /n'est pas exposée/);

      assert.equal(decisionsCitantDecision(root, { reference: "bonjour" }, TOUTES).trouve, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
