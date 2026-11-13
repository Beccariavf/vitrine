import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Embedder } from "../mcp/embed/embedder.ts";
import type { Unite } from "../mcp/corpus/parse.ts";
import { RENVOI_EXCLUSIONS, etatCorpus, getArticle, getDecision, search } from "../mcp/tools.ts";

const RGPD = "32016R0679";
const AIACT = "32024R1689";
const SANCTION = "CNILTEXT000055022778";

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

function article(numero: number, document = RGPD): Unite {
  return {
    ref: `${document}#art_${numero}`,
    document,
    corpus: document === RGPD ? "rgpd" : "aiact",
    niveau: "article",
    numero: String(numero),
    chemin: "RGPD",
    texte: `article ${numero}`,
    date_acte: "2016-04-27",
    date_debut: "2018-05-25",
    date_fin: null,
    statut: "en_vigueur",
    url: `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${document}#art_${numero}`,
  };
}

const SANCTION_UNITE: Unite = {
  ref: `${SANCTION}#f0`,
  document: SANCTION,
  corpus: "cnil",
  niveau: "fragment",
  numero: "SAN-2026-015",
  chemin: "CNIL > Sanctions",
  texte: "La formation restreinte prononce une amende.",
  date_acte: "2026-10-22",
  date_debut: "2026-10-22",
  date_fin: null,
  statut: "VIGUEUR",
  url: `https://www.legifrance.gouv.fr/cnil/id/${SANCTION}`,
  origine: "dinum",
  nature: "Sanction",
};

function ecrire(root: string, chemin: string, valeur: unknown): void {
  const complet = join(root, "data", "corpus", chemin);
  mkdirSync(join(complet, ".."), { recursive: true });
  writeFileSync(complet, `${JSON.stringify(valeur)}\n`, "utf8");
}

const RGPD_STATIQUE = { corpus: "rgpd", veille: false, a_jour_au: null, arrete_le: null };
const AIACT_STATIQUE = { corpus: "aiact", veille: false, a_jour_au: null, arrete_le: "2026-11-01" };
const CNIL_VEILLE = { corpus: "cnil", veille: true, a_jour_au: "2026-11-12", arrete_le: "2026-10-30" };

/** Trois corpus déclarés, avec leur couverture ; un rapport `sync.json` si `aJourAu` est donné. */
function racine(aJourAu?: string | null): string {
  const root = mkdtempSync(join(tmpdir(), "vitrine-perimetre-"));
  ecrire(root, "rgpd/manifest.json", {
    document: RGPD,
    couverture: { source: "CELLAR", exclusions: [] },
  });
  writeFileSync(
    join(root, "data", "corpus", "rgpd", "unites.jsonl"),
    `${[article(3)].map((unite) => JSON.stringify(unite)).join("\n")}\n`,
  );
  ecrire(root, "aiact/manifest.json", { document: AIACT, date_extraction: "2026-11-01" });
  writeFileSync(
    join(root, "data", "corpus", "aiact", "unites.jsonl"),
    `${JSON.stringify(article(3, AIACT))}\n`,
  );
  ecrire(root, "cnil/manifest.json", {
    corpus: "cnil",
    documents: 1,
    unites: 1,
    arrete_le: "2026-10-30",
    couverture: { exclusions: [{ nature: "Autre autorisation", lignes: 3 }] },
  });
  writeFileSync(
    join(root, "data", "corpus", "cnil", "unites.jsonl"),
    `${JSON.stringify(SANCTION_UNITE)}\n`,
  );
  if (aJourAu !== undefined) {
    ecrire(root, "sync.json", {
      version: 1,
      a_jour_au: aJourAu,
      derniere_tentative: "2026-11-12",
      depuis: "2026-11-05",
      entrees_lues: 0,
      comptes: { presents: 0, manquants: 0, ecartes: 0, non_mappes: 0 },
      documents: [],
      corpus: [],
      sources: [],
      index: { statut: "ok" },
    });
  }
  return root;
}

describe("périmètre et fraîcheur dans chaque réponse", () => {
  it("get_article porte le corpus du document, statique et non daté, et le renvoi aux exclusions", () => {
    const root = racine("2026-11-12");
    try {
      const trouve = getArticle(root, { document: RGPD, numero: "3" });
      const absent = getArticle(root, { document: RGPD, numero: "42" });

      for (const resultat of [trouve, absent]) {
        // Un rapport réussi existe, mais le RGPD n'est pas sous veille : aucune date de veille.
        assert.deepEqual(resultat.perimetre, {
          corpus: [RGPD_STATIQUE],
          document: RGPD,
          exclusions: RENVOI_EXCLUSIONS,
        });
      }
      assert.equal(trouve.trouve, true);
      assert.equal(absent.trouve, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("get_decision sans corpus interroge tous les corpus de l'inventaire", () => {
    const root = racine("2026-11-12");
    try {
      const resultat = getDecision(root, { numero: "SAN-2026-015" });

      assert.equal(resultat.trouve, true);
      assert.deepEqual(resultat.perimetre.corpus, [AIACT_STATIQUE, CNIL_VEILLE, RGPD_STATIQUE]);
      assert.equal(resultat.perimetre.document, undefined);
      assert.equal(resultat.perimetre.avertissement, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("get_decision borné à un corpus ne rend que lui, même sans décision", () => {
    const root = racine("2026-11-12");
    try {
      const resultat = getDecision(root, { numero: "SAN-1999-001", corpus: "cnil" });

      assert.equal(resultat.trouve, false);
      assert.deepEqual(resultat.perimetre.corpus, [CNIL_VEILLE]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("un document non déclaré par un manifeste garde tous les corpus et nomme le document", () => {
    const root = racine("2026-11-12");
    try {
      const resultat = getDecision(root, { document: SANCTION });

      assert.equal(resultat.perimetre.corpus.length, 3);
      assert.equal(resultat.perimetre.document, SANCTION);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a_jour_au d'un corpus sous veille vaut null sans rapport ou avant la première passe réussie", () => {
    for (const aJourAu of [undefined, null]) {
      const root = racine(aJourAu);
      try {
        const [cnil] = getDecision(root, { numero: "SAN-2026-015", corpus: "cnil" }).perimetre.corpus;
        assert.deepEqual(cnil, { ...CNIL_VEILLE, a_jour_au: null });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("search confiant porte le périmètre sans avertissement", async () => {
    const root = racine("2026-11-12");
    try {
      const resultat = await search(
        root,
        { question: "article 3 du RGPD" },
        { embedder: EMBEDDER_INTERDIT },
      );

      assert.equal(resultat.niveau_confiance, "confiant");
      assert.deepEqual(resultat.perimetre.corpus, [RGPD_STATIQUE]);
      assert.equal(resultat.perimetre.document, RGPD);
      assert.equal(resultat.perimetre.avertissement, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("search sans résultat fiable rappelle le périmètre et ne conclut pas à l'inexistence", async () => {
    const root = racine("2026-11-12");
    try {
      const resultat = await search(
        root,
        { question: "article 999", corpus: "rgpd" },
        { embedder: EMBEDDER_INTERDIT },
      );

      assert.equal(resultat.niveau_confiance, "aucun_resultat_fiable");
      assert.equal(resultat.message, "La question cite l'article 999, absent du corpus rgpd.");
      const avertissement = resultat.perimetre.avertissement ?? "";
      assert.match(avertissement, /périmètre interrogé \(rgpd : instantané fixe non daté, jamais revérifié\)/);
      assert.doesNotMatch(avertissement, /2026-11-12/);
      assert.match(avertissement, /ne prouve pas que la règle n'existe pas/);
      assert.ok(avertissement.includes(RENVOI_EXCLUSIONS));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("l'avertissement date chaque corpus selon sa veille", async () => {
    for (const [aJourAu, cnil] of [
      ["2026-11-12", /cnil : sous veille, à jour au 2026-11-12/],
      [undefined, /cnil : sous veille, aucune synchronisation réussie/],
    ] as const) {
      const root = racine(aJourAu);
      try {
        const resultat = await search(
          root,
          { question: "article 999" },
          { embedder: EMBEDDER_INTERDIT },
        );
        const avertissement = resultat.perimetre.avertissement ?? "";

        assert.equal(resultat.niveau_confiance, "aucun_resultat_fiable");
        assert.match(avertissement, cnil);
        assert.match(avertissement, /aiact : instantané fixe arrêté le 2026-11-01, jamais revérifié/);
        assert.match(avertissement, /rgpd : instantané fixe non daté/);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("search incertain porte le périmètre sans avertissement", async () => {
    const root = racine("2026-11-12");
    try {
      const resultat = await search(
        root,
        { question: "article 3" },
        { embedder: EMBEDDER_INTERDIT },
      );

      assert.equal(resultat.niveau_confiance, "incertain");
      assert.equal(resultat.perimetre.avertissement, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("etat_corpus rend la couverture déclarée de chaque corpus, cible du renvoi", () => {
    const root = racine("2026-11-12");
    try {
      const etat = etatCorpus(root);

      assert.deepEqual(
        etat.corpus.map(({ corpus, couverture }) => ({ corpus, couverture })),
        [
          { corpus: "aiact", couverture: null },
          { corpus: "cnil", couverture: { exclusions: [{ nature: "Autre autorisation", lignes: 3 }] } },
          { corpus: "rgpd", couverture: { source: "CELLAR", exclusions: [] } },
        ],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
