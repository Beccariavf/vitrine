import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  calculerDelais,
  casDuDepot,
  ecrireResume,
  joursEntre,
  mediane,
  mesurerDelais,
  resumerDelais,
  retardsArchive,
} from "../mcp/corpus/delais.ts";
import type { CasDelai } from "../mcp/corpus/delais.ts";

const RACINE_DEPOT = fileURLToPath(new URL("..", import.meta.url));

function racine(): string {
  return mkdtempSync(join(tmpdir(), "corpus-delais-"));
}

function ecrireCorpus(
  root: string,
  corpus: string,
  manifeste: Record<string, unknown> = {},
): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "manifest.json"), `${JSON.stringify({ corpus, ...manifeste }, null, 2)}\n`);
}

function ecrireUnites(root: string, corpus: string, lignes: Record<string, unknown>[]): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(
    join(dossier, "unites.jsonl"),
    `${lignes.map((ligne) => JSON.stringify(ligne)).join("\n")}\n`,
    "utf8",
  );
}

function ecrireEntree(root: string, entree: Record<string, unknown>, date: string): void {
  const dossier = join(root, "data", "entries", date.slice(0, 4), date.slice(5, 7));
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, `${String(entree.id)}.json`), `${JSON.stringify(entree, null, 2)}\n`);
}

describe("délais publication → corpus", () => {
  it("compte les jours entre deux dates et refuse le reste", () => {
    assert.equal(joursEntre("2026-07-27", "2026-11-14"), 110);
    assert.equal(joursEntre("2026-11-14", "2026-11-14"), 0);
    assert.equal(joursEntre(null, "2026-11-14"), null);
    assert.equal(joursEntre("2026-11-14", "14/11/2026"), null);
  });

  it("calcule la médiane paire et impaire", () => {
    assert.equal(mediane([30, 10, 20]), 20);
    assert.equal(mediane([20, 10]), 15);
    assert.equal(mediane([10]), 10);
    assert.equal(mediane([]), null);
  });

  it("rend médiane, maximum et exemples par corpus, et dit un corpus sans cas", () => {
    const cas: CasDelai[] = [
      casDe("aiact", "32024R1689", "2026-07-27", "2026-11-14", "2026-11-14"),
      casDe("ce", "CETATEXT1", "2026-10-01", null, "2026-11-09"),
      casDe("ce", "CETATEXT2", "2026-10-20", null, "2026-11-09"),
      casDe("ce", "CETATEXT3", "2026-11-01", null, "2026-11-09"),
      casDe("cjue", "62020CJ0339", "2022-09-20", null, null),
    ];
    const delais = calculerDelais(cas);
    const aiact = delais.find((delai) => delai.corpus === "aiact");
    const ce = delais.find((delai) => delai.corpus === "ce");
    const cjue = delais.find((delai) => delai.corpus === "cjue");

    assert.equal(aiact?.cas_mesures, 1);
    assert.equal(aiact?.mediane_jours, 110);
    assert.equal(aiact?.max_jours, 110);
    assert.equal(aiact?.exemples[0]?.jours_publication_veille, 110);
    assert.equal(aiact?.exemples[0]?.jours_veille_corpus, 0);
    assert.equal(ce?.cas_mesures, 3);
    assert.equal(ce?.mediane_jours, 20);
    assert.equal(ce?.max_jours, 39);
    assert.equal(ce?.exemples.length, 3);
    assert.equal(cjue?.cas_mesures, 0);
    assert.equal(cjue?.mediane_jours, null);
    assert.match(cjue?.sans_cas ?? "", /date d'entrée au corpus/);
  });

  function casDe(
    corpus: string,
    document: string,
    date_acte: string,
    date_veille: string | null,
    date_corpus: string | null,
  ): CasDelai {
    return {
      corpus,
      document,
      date_acte,
      date_veille,
      date_corpus,
      origine_corpus: date_corpus === null ? null : "git",
      entree_veille: date_veille !== null,
    };
  }

  it("lit les cas du dépôt et retombe sur la date du manifeste sans commit", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "aiact", {
        documents: 1,
        unites: 2,
        date_extraction: "2026-11-14",
      });
      ecrireUnites(root, "aiact", [
        { ref: "32024R1689#rct_1", document: "32024R1689", corpus: "aiact", date_acte: "2024-06-13" },
        { ref: "32024R1689#art_1", document: "32024R1689", corpus: "aiact", date_acte: "2024-06-13" },
      ]);
      const cas = casDuDepot(root, 3);
      assert.equal(cas.length, 1);
      assert.equal(cas[0]?.document, "32024R1689");
      assert.equal(cas[0]?.date_acte, "2024-06-13");
      assert.equal(cas[0]?.date_veille, null);
      assert.equal(cas[0]?.date_corpus, "2026-11-14");
      assert.equal(cas[0]?.origine_corpus, "manifeste");

      const rapport = mesurerDelais({ rootDir: root, aujourdHui: "2026-11-15" });
      assert.equal(rapport.calcule_le, "2026-11-15");
      assert.deepEqual(rapport.corpus, []);
      assert.equal(rapport.collecte_initiale[0]?.corpus, "aiact");
      assert.equal(
        rapport.collecte_initiale[0]?.mediane_jours,
        joursEntre("2024-06-13", "2026-11-14"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prend la date de détection d'une entrée de veille datée par la passe", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "aiact", { date_extraction: "2026-11-14" });
      ecrireUnites(root, "aiact", [
        { ref: "32024R1689#rct_1", document: "32024R1689", corpus: "aiact", date_acte: "2024-06-13" },
      ]);
      ecrireEntree(
        root,
        {
          id: "eurlex-1",
          title: "AI Act : nouvelle version consolidée",
          officialTitle: "AI Act",
          url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727",
          publishedAt: "2026-11-14T12:00:00.000Z",
          summary: null,
          references: [],
          themes: ["ia"],
          source: "eurlex",
          document: "32024R1689",
          categorie: "consolidation",
          version: "02024R1689-20260727",
          date_acte: "2026-07-27",
        },
        "2026-11-14",
      );
      const cas = casDuDepot(root, 3);
      assert.equal(cas.length, 1);
      assert.equal(cas[0]?.date_veille, "2026-11-14");
      const rapport = mesurerDelais({ rootDir: root, aujourdHui: "2026-11-15" });
      assert.equal(rapport.corpus[0]?.corpus, "aiact");
      assert.equal(rapport.corpus[0]?.exemples[0]?.jours_publication_veille, 110);
      assert.deepEqual(rapport.collecte_initiale, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prend la date de publication de l'unité quand l'entrée de flux n'en porte pas", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "ce", { date_extraction: "2026-11-09" });
      ecrireUnites(root, "ce", [
        {
          ref: "CETATEXT000055005472#f1",
          document: "CETATEXT000055005472",
          corpus: "ce",
          date_acte: "2026-10-20",
        },
      ]);
      ecrireEntree(
        root,
        {
          id: "CETATEXT000055005472",
          title: "Décision du Conseil d'État",
          officialTitle: "Décision du Conseil d'État",
          url: "https://www.legifrance.gouv.fr/ceta/id/CETATEXT000055005472",
          publishedAt: "2026-10-21T12:00:00.000Z",
          summary: null,
          references: [],
          themes: ["donnees-personnelles"],
          source: "cetat",
        },
        "2026-10-21",
      );
      const rapport = mesurerDelais({ rootDir: root, aujourdHui: "2026-11-15" });
      const ce = rapport.corpus.find((delai) => delai.corpus === "ce");
      assert.equal(ce?.cas_mesures, 1);
      assert.equal(ce?.mediane_jours, joursEntre("2026-10-20", "2026-11-09"));
      // La source `cetat` ne date pas sa passe : la détection reste inconnue.
      assert.equal(ce?.exemples[0]?.date_veille, null);
      assert.equal(ce?.exemples[0]?.jours_publication_veille, null);
      assert.deepEqual(rapport.collecte_initiale, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("écarte un document daté par l'extraction, dont le délai serait nul", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil_doctrine", {
        date_extraction: "2026-11-14",
        documents_par_type: {
          guide: [
            { slug: "guide-sans-date", date_acte: "2026-11-14", date_source: "extraction" },
            { slug: "guide-date", date_acte: "2025-03-01", date_source: "entete" },
          ],
        },
      });
      ecrireUnites(root, "cnil_doctrine", [
        { ref: "guide-sans-date#f1", document: "guide-sans-date", date_acte: "2026-11-14" },
        { ref: "guide-date#f1", document: "guide-date", date_acte: "2025-03-01" },
      ]);
      const cas = casDuDepot(root, 3);
      assert.deepEqual(
        cas.map((element) => element.document),
        ["guide-date"],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lit le retard d'archive déclaré au manifeste, sans le déduire", () => {
    const manifestes = new Map<string, Record<string, unknown>>([
      [
        "constit",
        {
          date_extraction: "2026-11-14",
          couverture: {
            retard_archive: {
              derniere_decision: "2026-10-16",
              archive_date: "2026-11-08",
              jours_au: 29,
            },
          },
        },
      ],
      ["rgpd", { document: "32016R0679" }],
    ]);
    assert.deepEqual(retardsArchive(manifestes), [
      {
        corpus: "constit",
        derniere_decision: "2026-10-16",
        archive: "2026-11-08",
        jours_declares: 29,
        jours_avant_archive: 23,
        extraction: "2026-11-14",
        jours_archive_extraction: 6,
      },
    ]);
  });

  it("résume les délais et remplace son résumé à la seconde écriture", () => {
    const rapport = mesurerDelais({
      rootDir: RACINE_DEPOT,
      aujourdHui: "2026-11-15",
      echantillon: 1,
    });
    const resume = resumerDelais(rapport);
    assert.match(resume, /<!-- delais:start -->/);
    assert.match(resume, /Délai = date d'entrée au corpus moins `date_acte`/);
    assert.match(resume, /Collecte initiale/);
    assert.match(resume, /constit/);
    const root = racine();
    try {
      const chemin = join(root, "coverage.md");
      writeFileSync(chemin, "# Couverture\n", "utf8");
      assert.equal(ecrireResume(chemin, resume), true);
      assert.equal(ecrireResume(chemin, resume), false);
      const texte = readFileSync(chemin, "utf8");
      assert.equal(texte.split("<!-- delais:start -->").length - 1, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
