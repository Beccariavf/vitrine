import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Entry } from "../veille/types.ts";
import type { Unite } from "../mcp/corpus/parse.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { normaliser } from "../mcp/embed/embedder.ts";
import { cheminIndex } from "../mcp/index/build.ts";
import { openIndex } from "../mcp/index/search.ts";
import { etatCorpus, search } from "../mcp/tools.ts";
import { agentsParDefaut, syncCorpus } from "../mcp/corpus/sync.ts";
import type { AgentSync } from "../mcp/corpus/sync.ts";
import {
  corpusDeLEntree,
  documentsDeLEntree,
  documentsEcartes,
  indexerDocumentsCorpus,
  indexerSnapshots,
  lireEntrees,
  normaliserUrl,
  urlCanonique,
} from "../mcp/corpus/veille.ts";
import {
  ecrireRapport,
  formaterRapport,
  inventaireCorpus,
  lireRapport,
} from "../mcp/corpus/sync-rapport.ts";
import type { RapportSync } from "../mcp/corpus/sync-rapport.ts";
import {
  ETIQUETTE,
  INTERVALLE_TROIS_JOURS,
  commandesLaunchctl,
  installerPlanificateur,
  plistCorpusSync,
} from "../mcp/corpus/sync-planificateur.ts";

function racine(): string {
  return mkdtempSync(join(tmpdir(), "corpus-sync-"));
}

function ecrireEntree(root: string, entry: Entry): void {
  const date = entry.publishedAt ?? "2026-01-01T00:00:00.000Z";
  const dossier = join(root, "data", "entries", date.slice(0, 4), date.slice(5, 7));
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, `${entry.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

function entreeCnil(id: string, url: string, date = "2026-11-10T12:00:00.000Z"): Entry {
  return {
    id,
    title: `Actualité ${id}`,
    officialTitle: `Actualité ${id}`,
    url,
    publishedAt: date,
    summary: null,
    references: [],
    themes: ["donnees-personnelles"],
    source: "cnil",
  };
}

function entree(source: string, id: string, url: string, date = "2026-11-10T12:00:00.000Z"): Entry {
  return {
    id,
    title: `Actualité ${id}`,
    officialTitle: `Actualité ${id}`,
    url,
    publishedAt: date,
    summary: null,
    references: [],
    themes: ["donnees-personnelles"],
    source,
  };
}

function ecrireSnapshot(root: string, url: string, ids: string[]): void {
  const liens = ids
    .map((id) => `<a href="https://www.legifrance.gouv.fr/cnil/id/${id}">${id}</a>`)
    .join("");
  const html = `<!doctype html><html><head><link rel="canonical" href="${url}"></head><body>${liens}</body></html>`;
  const hash = createHash("sha256").update(html).digest("hex");
  const dossier = join(root, "data", "raw", hash.slice(0, 2));
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, `${hash}.html`), html, "utf8");
}

function uniteCnil(document: string, texte = "sanction relative aux cookies traceurs"): Unite {
  return {
    ref: `${document}#f0`,
    document,
    corpus: "cnil",
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
    `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
    "utf8",
  );
  writeFileSync(
    join(dossier, "manifest.json"),
    `${JSON.stringify(
      {
        corpus,
        nom: corpus,
        documents: new Set(unites.map((unite) => unite.document)).size,
        unites: unites.length,
        arrete_le: "2026-11-10",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function ajouterUnite(root: string, corpus: string, unite: Unite): void {
  const chemin = join(root, "data", "corpus", corpus, "unites.jsonl");
  const existant = existsSync(chemin) ? readFileSync(chemin, "utf8") : "";
  writeFileSync(chemin, `${existant}${JSON.stringify(unite)}\n`, "utf8");
}

/** Embedder déterministe : sac de mots hachés, sans modèle ni réseau. */
function embedderFactice(dim = 8, model = "factice"): Embedder {
  const vecteur = (texte: string): number[] => {
    const valeurs = new Array<number>(dim).fill(0);
    for (const mot of texte.toLowerCase().split(/\s+/)) {
      if (mot === "") continue;
      let empreinte = 7;
      for (const caractere of mot) empreinte = (empreinte * 31 + (caractere.codePointAt(0) ?? 0)) % 1_000_003;
      valeurs[empreinte % dim] = (valeurs[empreinte % dim] ?? 0) + 1;
    }
    return normaliser(valeurs);
  };
  return {
    model,
    dim,
    embedPassages: async (textes) => textes.map(vecteur),
    embedQuery: async (texte) => vecteur(texte),
  };
}

function agentFactice(
  action?: () => void,
  ecrit = false,
): { agent: AgentSync; appels: { n: number } } {
  const appels = { n: 0 };
  return {
    appels,
    agent: async () => {
      appels.n += 1;
      action?.();
      return { ecrit, message: "agent factice" };
    },
  };
}

function agents(
  cnil: AgentSync,
  ce: AgentSync,
  cc: AgentSync,
  cjue: AgentSync,
): Record<"cnil" | "ce" | "cc" | "cjue", AgentSync> {
  return { cnil, ce, cc, cjue };
}

const INERTE: AgentSync = async () => ({ ecrit: false, message: "inactif" });

describe("correspondance veille → corpus", () => {
  it("lit les entrées depuis une borne, triées et sans date nulle", () => {
    const root = racine();
    try {
      ecrireEntree(root, entree("cnil", "bbb", "https://www.cnil.fr/fr/b", "2026-11-10T08:00:00.000Z"));
      ecrireEntree(root, entree("cnil", "aaa", "https://www.cnil.fr/fr/a", "2026-11-10T08:00:00.000Z"));
      ecrireEntree(root, entree("cnil", "ccc", "https://www.cnil.fr/fr/c", "2026-10-01T08:00:00.000Z"));
      ecrireEntree(root, { ...entree("cnil", "ddd", "https://www.cnil.fr/fr/d"), publishedAt: null });
      mkdirSync(join(root, "data", "entries", "2026", "11"), { recursive: true });
      writeFileSync(join(root, "data", "entries", "2026", "11", "cassee.json"), "{", "utf8");

      const entrees = lireEntrees(root, "2026-11-01");
      assert.deepEqual(
        entrees.map((entry) => entry.id),
        ["aaa", "bbb"],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lit l'URL canonique quel que soit l'ordre des attributs, puis og:url", () => {
    assert.equal(
      urlCanonique('<link rel="canonical" href="https://www.cnil.fr/fr/x">'),
      "https://www.cnil.fr/fr/x",
    );
    assert.equal(
      urlCanonique('<link href="https://www.cnil.fr/fr/y" rel="canonical">'),
      "https://www.cnil.fr/fr/y",
    );
    assert.equal(
      urlCanonique('<meta content="https://www.cnil.fr/fr/z" property="og:url">'),
      "https://www.cnil.fr/fr/z",
    );
    assert.equal(urlCanonique("<html></html>"), null);
  });

  it("indexe les identifiants CNILTEXT des snapshots, dédoublonnés", () => {
    const root = racine();
    try {
      ecrireSnapshot(root, "https://www.cnil.fr/fr/sanction", [
        "CNILTEXT000000000002",
        "CNILTEXT000000000001",
        "CNILTEXT000000000001",
      ]);
      ecrireSnapshot(root, "https://www.cnil.fr/fr/sans-identifiant", []);
      const snapshots = indexerSnapshots(root);
      assert.deepEqual(
        snapshots.get("https://www.cnil.fr/fr/sanction"),
        ["CNILTEXT000000000001", "CNILTEXT000000000002"],
      );
      assert.equal(snapshots.has("https://www.cnil.fr/fr/sans-identifiant"), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("mappe les quatre sources et laisse les autres hors corpus", () => {
    const snapshots = new Map([["https://www.cnil.fr/fr/sanction", ["CNILTEXT000000000001"]]]);
    assert.equal(corpusDeLEntree({ source: "cnil" }), "cnil");
    assert.equal(corpusDeLEntree({ source: "cetat" }), "ce");
    assert.equal(corpusDeLEntree({ source: "judilibre" }), "cc");
    assert.equal(corpusDeLEntree({ source: "cjeu" }), "cjue");
    assert.equal(corpusDeLEntree({ source: "anssi" }), null);

    assert.deepEqual(
      documentsDeLEntree(
        { source: "cnil", id: "x", url: "https://www.cnil.fr/fr/sanction/" },
        snapshots,
      ),
      ["CNILTEXT000000000001"],
    );
    assert.deepEqual(
      documentsDeLEntree({ source: "cetat", id: "CETATEXT000000000001", url: "" }, snapshots),
      ["CETATEXT000000000001"],
    );
    assert.deepEqual(
      documentsDeLEntree({ source: "judilibre", id: "6ac6079ec27382d099f5a06e", url: "" }, snapshots),
      ["6ac6079ec27382d099f5a06e"],
    );
    assert.deepEqual(
      documentsDeLEntree(
        {
          source: "cjeu",
          id: "e39c8aff89686342",
          url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62024CA0798",
        },
        snapshots,
      ),
      ["62024CA0798"],
    );
    assert.deepEqual(documentsDeLEntree({ source: "cnil", id: "x", url: "https://autre" }, snapshots), []);
    assert.deepEqual(
      documentsDeLEntree({ source: "judilibre", id: "6AC6079EC27382D099F5A06E", url: "" }, snapshots),
      [],
    );
    assert.deepEqual(
      documentsDeLEntree({ source: "cetat", id: "CETAT-1", url: "" }, snapshots),
      [],
    );
    assert.deepEqual(
      documentsDeLEntree(
        { source: "cjeu", id: "x", url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:garbage" },
        snapshots,
      ),
      [],
    );
  });

  it("lit les documents présents et les exclusions CJUE", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      mkdirSync(join(root, "data", "corpus", "cjue"), { recursive: true });
      writeFileSync(
        join(root, "data", "corpus", "cjue", "manifest.json"),
        JSON.stringify({
          couverture: {
            documents_ecartes: [
              { celex: "62013CC0127", motif: "avis_avocat_general" },
              { celex: "62024CJ0001", motif: "echec_telechargement" },
              { celex: "62024CJ0002", motif: "xhtml_absent" },
            ],
          },
        }),
        "utf8",
      );
      assert.deepEqual(
        [...(indexerDocumentsCorpus(root).get("cnil") ?? [])],
        ["CNILTEXT000000000001"],
      );
      assert.equal(documentsEcartes(root, "cjue").get("62013CC0127"), "avis_avocat_general");
      assert.equal(documentsEcartes(root, "cjue").get("62024CJ0002"), "xhtml_absent");
      assert.equal(documentsEcartes(root, "cjue").has("62024CJ0001"), false);
      assert.equal(documentsEcartes(root, "cnil").size, 0);
      assert.equal(normaliserUrl("https://www.cnil.fr/fr/x/?q=1#a"), "https://www.cnil.fr/fr/x");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("rapport de synchronisation", () => {
  it("inventorie les huit corpus avec la date d'arrêté de chacun", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      const manifestes: Record<string, unknown> = {
        aiact: { unites: 293, date_publication: "2024-07-12" },
        cc: { documents: 352, fragments: 7048, date_extraction: "2026-11-11" },
        ce: { documents: 3, fragments: 30, date_extraction: "2026-11-09" },
        cjue: { documents: 151, fragments: 14700, date_extraction: "2026-11-11" },
        lil: { documents: 1, unites: 133, couverture: { date: "2026-11-09" } },
        cepd: { documents: 36, fragments: 5443, couverture: { date_liste: "2026-11-09" } },
        rgpd: { unites: 272, date_publication: "2016-05-04" },
      };
      for (const [corpus, manifeste] of Object.entries(manifestes)) {
        mkdirSync(join(root, "data", "corpus", corpus), { recursive: true });
        writeFileSync(
          join(root, "data", "corpus", corpus, "manifest.json"),
          JSON.stringify(manifeste),
          "utf8",
        );
      }
      const inventaire = inventaireCorpus(root);
      assert.deepEqual(
        inventaire.map((corpus) => corpus.corpus),
        ["aiact", "cc", "ce", "cepd", "cjue", "cnil", "lil", "rgpd"],
      );
      assert.equal(inventaire.find((corpus) => corpus.corpus === "cnil")?.arrete_le, "2026-11-10");
      assert.equal(inventaire.find((corpus) => corpus.corpus === "ce")?.unites, 30);
      assert.equal(inventaire.find((corpus) => corpus.corpus === "cc")?.arrete_le, "2026-11-11");
      assert.equal(inventaire.find((corpus) => corpus.corpus === "cjue")?.arrete_le, "2026-11-11");
      assert.equal(inventaire.find((corpus) => corpus.corpus === "lil")?.arrete_le, "2026-11-09");
      assert.equal(inventaire.find((corpus) => corpus.corpus === "cepd")?.arrete_le, "2026-11-09");
      assert.equal(inventaire.find((corpus) => corpus.corpus === "rgpd")?.arrete_le, null);
      assert.equal(inventaire.find((corpus) => corpus.corpus === "aiact")?.documents, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("écrit le rapport une seule fois et le formate avec manquants et pannes", () => {
    const root = racine();
    try {
      const rapport: RapportSync = {
        version: 1,
        a_jour_au: "2026-11-11",
        derniere_tentative: "2026-11-11",
        depuis: "2026-11-04",
        entrees_lues: 1,
        comptes: { presents: 0, manquants: 1, ecartes: 0, non_mappes: 0 },
        documents: [
          {
            entree: "x",
            source: "cnil",
            document: "CNILTEXT000000000001",
            corpus: "cnil",
            statut: "manquant",
          },
        ],
        corpus: [],
        sources: [{ source: "cnil", statut: "panne", message: "HTTP 500" }],
        index: { statut: "ignoree", message: "corpus inchangé" },
      };
      assert.equal(ecrireRapport(root, rapport), true);
      assert.equal(ecrireRapport(root, rapport), false);
      assert.deepEqual(lireRapport(root), rapport);
      const texte = formaterRapport(rapport);
      assert.match(texte, /Corpus à jour au 2026-11-11/);
      assert.match(texte, /CNILTEXT000000000001 \(cnil\)/);
      assert.match(texte, /cnil : panne — HTTP 500/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("expose l'état sans rapport et le message qui nomme la commande", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      const etat = etatCorpus(root);
      assert.equal(etat.a_jour_au, null);
      assert.equal(etat.corpus.length, 1);
      assert.match(etat.message ?? "", /corpus:sync/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignore un rapport de forme inconnue au lieu de lever", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      mkdirSync(join(root, "data", "corpus"), { recursive: true });
      writeFileSync(join(root, "data", "corpus", "sync.json"), "{}", "utf8");
      assert.equal(lireRapport(root), null);
      const etat = etatCorpus(root);
      assert.equal(etat.a_jour_au, null);
      assert.deepEqual(etat.manquants, []);
      assert.match(etat.message ?? "", /corpus:sync/);

      writeFileSync(
        join(root, "data", "corpus", "sync.json"),
        JSON.stringify({ version: 1, documents: [null], corpus: [], sources: [], depuis: "2026-01-01" }),
        "utf8",
      );
      assert.equal(lireRapport(root), null);
      assert.deepEqual(etatCorpus(root).manquants, []);

      writeFileSync(
        join(root, "data", "corpus", "sync.json"),
        JSON.stringify({
          version: 1,
          documents: [],
          corpus: [],
          sources: [null],
          index: { statut: "ok" },
          depuis: "2026-01-01",
        }),
        "utf8",
      );
      assert.equal(lireRapport(root), null);

      writeFileSync(
        join(root, "data", "corpus", "sync.json"),
        JSON.stringify({ version: 1, documents: [], corpus: [], sources: [], depuis: "2026-01-01" }),
        "utf8",
      );
      assert.equal(lireRapport(root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("synchronisation du corpus", () => {
  it("ajoute une sanction CNIL puis la rend cherchable", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      ecrireEntree(
        root,
        entreeCnil("entree-sanction", "https://www.cnil.fr/fr/sanction-test"),
      );
      ecrireSnapshot(root, "https://www.cnil.fr/fr/sanction-test", ["CNILTEXT000000000002"]);

      const cnil = agentFactice(
        () => ajouterUnite(root, "cnil", uniteCnil("CNILTEXT000000000002", "sanction cookies traceurs")),
        true,
      );
      const ce = agentFactice();
      const cc = agentFactice();
      const cjue = agentFactice();
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: agents(cnil.agent, ce.agent, cc.agent, cjue.agent),
        embedder: embedderFactice(),
      });

      assert.equal(rapport.a_jour_au, "2026-11-11");
      assert.equal(rapport.comptes.presents, 1);
      assert.equal(rapport.comptes.manquants, 0);
      assert.equal(rapport.sources.find((source) => source.source === "cnil")?.statut, "ok");
      assert.equal(rapport.index.statut, "ok");
      assert.equal(rapport.index.mode, "complet");
      assert.equal(cnil.appels.n, 1);
      assert.equal(ce.appels.n + cc.appels.n + cjue.appels.n, 0);
      assert.deepEqual(lireRapport(root), rapport);

      const index = openIndex(cheminIndex(root));
      try {
        const resultat = await search(
          root,
          { question: "sanction cookies traceurs" },
          { embedder: embedderFactice(), index, seuils: { bas: 0, haut: 0, marge: 0 } },
        );
        assert.ok(
          resultat.passages.some((passage) => passage.document === "CNILTEXT000000000002"),
          "la sanction ajoutée doit être cherchable",
        );
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne relance aucune source quand le document est déjà présent", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      ecrireEntree(root, entreeCnil("entree-presente", "https://www.cnil.fr/fr/presente"));
      ecrireSnapshot(root, "https://www.cnil.fr/fr/presente", ["CNILTEXT000000000001"]);

      const appels = { n: 0 };
      const inerte = async (): Promise<{ ecrit: boolean; message: string }> => {
        appels.n += 1;
        return { ecrit: false, message: "appelé" };
      };
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: agents(inerte, inerte, inerte, inerte),
        embedder: embedderFactice(),
      });
      assert.equal(appels.n, 0);
      assert.equal(rapport.sources.every((source) => source.statut === "ignoree"), true);
      assert.equal(rapport.index.statut, "ok");
      assert.equal(rapport.a_jour_au, "2026-11-11");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("laisse le corpus intact et n'avance pas la fraîcheur quand la source échoue", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      const chemin = join(root, "data", "corpus", "cnil", "unites.jsonl");
      const avant = readFileSync(chemin);
      ecrireEntree(root, entreeCnil("entree-panne", "https://www.cnil.fr/fr/panne"));
      ecrireSnapshot(root, "https://www.cnil.fr/fr/panne", ["CNILTEXT000000000002"]);

      const panne: AgentSync = async () => {
        throw new Error("HTTP 500");
      };
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: agents(panne, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.deepEqual(readFileSync(chemin), avant);
      assert.equal(rapport.a_jour_au, null);
      assert.equal(rapport.sources.find((source) => source.source === "cnil")?.statut, "panne");
      assert.match(formaterRapport(rapport), /cnil : panne — HTTP 500/);
      assert.equal(lireRapport(root)?.sources[0]?.statut, "panne");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne fait rien en dry-run et n'écrit ni rapport ni index", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      ecrireEntree(root, entreeCnil("entree-dry", "https://www.cnil.fr/fr/dry"));
      ecrireSnapshot(root, "https://www.cnil.fr/fr/dry", ["CNILTEXT000000000002"]);

      const appels = { n: 0 };
      const inerte = async (): Promise<{ ecrit: boolean; message: string }> => {
        appels.n += 1;
        return { ecrit: false, message: "appelé" };
      };
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        dryRun: true,
        agents: agents(inerte, inerte, inerte, inerte),
        embedder: embedderFactice(),
      });
      assert.equal(appels.n, 0);
      assert.equal(existsSync(join(root, "data", "corpus", "sync.json")), false);
      assert.equal(existsSync(cheminIndex(root)), false);
      assert.equal(rapport.a_jour_au, null);
      assert.equal(rapport.sources.find((source) => source.source === "cnil")?.message, "dry-run : serait lancé");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("écarte un CELEX déclaré par le manifeste sans relancer CJUE", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cjue", [{ ...uniteCnil("62012CJ0131"), corpus: "cjue" }]);
      mkdirSync(join(root, "data", "corpus", "cjue"), { recursive: true });
      writeFileSync(
        join(root, "data", "corpus", "cjue", "manifest.json"),
        JSON.stringify({
          corpus: "cjue",
          documents: 1,
          fragments: 1,
          date_extraction: "2026-11-10",
          couverture: {
            documents_ecartes: [{ celex: "62024CA0798", motif: "autre_type" }],
          },
        }),
        "utf8",
      );
      ecrireEntree(
        root,
        entree(
          "cjeu",
          "entree-cjue",
          "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62024CA0798",
        ),
      );
      const appels = { n: 0 };
      const inerte = async (): Promise<{ ecrit: boolean; message: string }> => {
        appels.n += 1;
        return { ecrit: false, message: "appelé" };
      };
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: agents(INERTE, INERTE, INERTE, inerte),
        embedder: embedderFactice(),
      });
      assert.equal(appels.n, 0);
      assert.equal(rapport.comptes.ecartes, 1);
      assert.equal(
        rapport.documents.find((document) => document.document === "62024CA0798")?.motif,
        "autre_type",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("classe un document xhtml_absent en écarté, pas en manquant", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cjue", [{ ...uniteCnil("62012CJ0131"), corpus: "cjue" }]);
      mkdirSync(join(root, "data", "corpus", "cjue"), { recursive: true });
      writeFileSync(
        join(root, "data", "corpus", "cjue", "manifest.json"),
        JSON.stringify({
          corpus: "cjue",
          documents: 1,
          fragments: 1,
          date_extraction: "2026-11-12",
          couverture: {
            documents_ecartes: [{ celex: "62023CJ0413", motif: "xhtml_absent" }],
          },
        }),
        "utf8",
      );
      ecrireEntree(
        root,
        entree(
          "cjeu",
          "entree-cjue-anglaise",
          "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62023CJ0413",
        ),
      );
      let appels = 0;
      const inerte = async (): Promise<{ ecrit: boolean; message: string }> => {
        appels += 1;
        return { ecrit: false, message: "appelé" };
      };
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-13",
        depuis: "2026-11-01",
        agents: agents(INERTE, INERTE, INERTE, inerte),
        embedder: embedderFactice(),
      });
      assert.equal(appels, 0, "un XHTML absent ne relance pas la CJUE");
      assert.equal(rapport.comptes.ecartes, 1);
      assert.equal(rapport.comptes.manquants, 0);
      const document = rapport.documents.find((element) => element.document === "62023CJ0413");
      assert.equal(document?.statut, "ecarte");
      assert.equal(document?.motif, "xhtml_absent");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("avance la fenêtre et reprend une entrée après une panne", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      ecrireEntree(root, entreeCnil("entree-1", "https://www.cnil.fr/fr/1", "2026-11-01T12:00:00.000Z"));
      ecrireSnapshot(root, "https://www.cnil.fr/fr/1", ["CNILTEXT000000000001"]);

      const premier = await syncCorpus({
        rootDir: root,
        date: "2026-11-02",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(premier.a_jour_au, "2026-11-02");

      ecrireEntree(root, entreeCnil("entree-2", "https://www.cnil.fr/fr/2", "2026-11-03T12:00:00.000Z"));
      ecrireSnapshot(root, "https://www.cnil.fr/fr/2", ["CNILTEXT000000000002"]);
      const panne: AgentSync = async () => {
        throw new Error("réseau");
      };
      const deuxieme = await syncCorpus({
        rootDir: root,
        date: "2026-11-04",
        agents: agents(panne, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(deuxieme.depuis, "2026-10-28");
      assert.equal(deuxieme.a_jour_au, "2026-11-02");
      assert.equal(deuxieme.derniere_tentative, "2026-11-04");

      const troisieme = await syncCorpus({
        rootDir: root,
        date: "2026-11-05",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(troisieme.depuis, "2026-10-28");
      assert.equal(troisieme.comptes.manquants, 1);
      assert.equal(troisieme.a_jour_au, "2026-11-05");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("réessaie l'index à la passe suivante après une panne d'Ollama", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      const premiere = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
        construireIndex: async () => {
          throw new Error("Ollama absent");
        },
      });
      assert.equal(premiere.index.statut, "panne");
      assert.equal(premiere.a_jour_au, null);

      const seconde = await syncCorpus({
        rootDir: root,
        date: "2026-11-12",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(seconde.index.statut, "ok");
      assert.equal(seconde.a_jour_au, "2026-11-12");
      assert.equal(existsSync(cheminIndex(root)), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("garde un document manquant visible quand la fenêtre avance", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      ecrireEntree(
        root,
        entreeCnil("entree-manquante", "https://www.cnil.fr/fr/manquante", "2026-11-01T12:00:00.000Z"),
      );
      ecrireSnapshot(root, "https://www.cnil.fr/fr/manquante", ["CNILTEXT000000000002"]);

      const premiere = await syncCorpus({
        rootDir: root,
        date: "2026-11-02",
        depuis: "2026-11-01",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(premiere.comptes.manquants, 1);

      const seconde = await syncCorpus({
        rootDir: root,
        date: "2026-11-12",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(seconde.entrees_lues, 0);
      assert.equal(seconde.comptes.manquants, 1);
      assert.equal(etatCorpus(root).manquants.length, 1);

      ajouterUnite(root, "cnil", uniteCnil("CNILTEXT000000000002"));
      const troisieme = await syncCorpus({
        rootDir: root,
        date: "2026-11-13",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(troisieme.comptes.manquants, 0);
      assert.equal(etatCorpus(root).manquants.length, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reprend la fenêtre d'un premier échec", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      ecrireEntree(
        root,
        entreeCnil("entree-reprise", "https://www.cnil.fr/fr/reprise", "2026-11-04T12:00:00.000Z"),
      );
      ecrireSnapshot(root, "https://www.cnil.fr/fr/reprise", ["CNILTEXT000000000002"]);

      const appels = { n: 0 };
      const panne: AgentSync = async () => {
        appels.n += 1;
        throw new Error("réseau");
      };
      const premiere = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        agents: agents(panne, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(premiere.depuis, "2026-11-04");
      assert.equal(premiere.a_jour_au, null);

      const seconde = await syncCorpus({
        rootDir: root,
        date: "2026-11-12",
        agents: agents(panne, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(seconde.depuis, "2026-11-04");
      assert.equal(seconde.entrees_lues, 1);
      assert.equal(appels.n, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("relit une entrée publiée avant la passe mais écrite après", async () => {
    const root = racine();
    try {
      const premiere = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(premiere.a_jour_au, "2026-11-11");

      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      ecrireEntree(
        root,
        entreeCnil("entree-tardive", "https://www.cnil.fr/fr/tardive", "2026-11-10T12:00:00.000Z"),
      );
      ecrireSnapshot(root, "https://www.cnil.fr/fr/tardive", ["CNILTEXT000000000002"]);

      const seconde = await syncCorpus({
        rootDir: root,
        date: "2026-11-12",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(seconde.depuis, "2026-11-05");
      assert.equal(seconde.entrees_lues, 1);
      assert.equal(seconde.comptes.manquants, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("poursuit les sources après une panne et garde l'ordre déclaré", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      ecrireCorpus(root, "ce", [{ ...uniteCnil("CETATEXT000000000001"), corpus: "ce" }]);
      ecrireEntree(root, entreeCnil("entree-cnil", "https://www.cnil.fr/fr/ordre"));
      ecrireSnapshot(root, "https://www.cnil.fr/fr/ordre", ["CNILTEXT000000000002"]);
      ecrireEntree(
        root,
        entree(
          "cetat",
          "CETATEXT000000000002",
          "https://www.legifrance.gouv.fr/ceta/id/CETATEXT000000000002",
        ),
      );

      const cnil: AgentSync = async () => {
        throw new Error("CNIL HS");
      };
      const ce = agentFactice();
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: agents(cnil, ce.agent, INERTE, INERTE),
        embedder: embedderFactice(),
      });

      assert.deepEqual(
        rapport.sources.map((source) => source.source),
        ["cnil", "ce", "cc", "cjue"],
      );
      assert.equal(rapport.sources[0]?.statut, "panne");
      assert.equal(rapport.sources[1]?.statut, "ok");
      assert.equal(ce.appels.n, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne réextrait pas un document ajouté à la passe précédente", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      ecrireEntree(root, entreeCnil("entree-suite", "https://www.cnil.fr/fr/suite"));
      ecrireSnapshot(root, "https://www.cnil.fr/fr/suite", ["CNILTEXT000000000002"]);

      const cnil = agentFactice(
        () => ajouterUnite(root, "cnil", uniteCnil("CNILTEXT000000000002", "sanction cookies")),
        true,
      );
      await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: agents(cnil.agent, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(cnil.appels.n, 1);

      const seconde = await syncCorpus({
        rootDir: root,
        date: "2026-11-12",
        agents: agents(cnil.agent, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(cnil.appels.n, 1);
      assert.equal(seconde.comptes.presents, 1);
      assert.equal(seconde.sources[0]?.statut, "ignoree");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reprend une panne survenue le même jour qu'un succès", async () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil", [uniteCnil("CNILTEXT000000000001")]);
      const premiere = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(premiere.a_jour_au, "2026-11-11");

      ecrireEntree(
        root,
        entreeCnil("entree-tard", "https://www.cnil.fr/fr/tard", "2026-10-15T12:00:00.000Z"),
      );
      ecrireSnapshot(root, "https://www.cnil.fr/fr/tard", ["CNILTEXT000000000002"]);
      const appels = { n: 0 };
      const panne: AgentSync = async () => {
        appels.n += 1;
        throw new Error("réseau");
      };
      const echouee = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-10-01",
        agents: agents(panne, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(echouee.a_jour_au, "2026-11-11");
      assert.equal(echouee.sources[0]?.statut, "panne");

      const reprise = await syncCorpus({
        rootDir: root,
        date: "2026-11-12",
        agents: agents(panne, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(reprise.depuis, "2026-10-01");
      assert.equal(reprise.entrees_lues, 1);
      assert.equal(appels.n, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("signale un journal d'usage en panne sans faire échouer cc", async () => {
    let racineVue = "";
    const agents = agentsParDefaut("/tmp/depot", {
      syncCc: async (options) => {
        racineVue = options.rootDir;
        return { ecrit: true, documentsLus: 2, documents: 1, enAttente: 0 };
      },
      flushUsage: () => {
        throw new Error("disque plein");
      },
    });
    assert.deepEqual(Object.keys(agents).sort(), ["cc", "ce", "cjue", "cnil"]);
    const resultat = await agents.cc();
    assert.equal(racineVue, "/tmp/depot");
    assert.equal(resultat.ecrit, true);
    assert.match(resultat.message, /journal d'usage non écrit \(disque plein\)/);
  });

  it("écrit un rapport vide et avance quand aucune entrée n'est dans la fenêtre", async () => {
    const root = racine();
    try {
      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-04",
        agents: agents(INERTE, INERTE, INERTE, INERTE),
        embedder: embedderFactice(),
      });
      assert.equal(rapport.entrees_lues, 0);
      assert.equal(rapport.a_jour_au, "2026-11-11");
      assert.equal(rapport.sources.every((source) => source.statut === "ignoree"), true);
      assert.equal(existsSync(join(root, "data", "corpus", "sync.json")), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("ordonnanceur launchd", () => {
  it("génère un agent de trois jours, chemins échappés", () => {
    const plist = plistCorpusSync({
      rootDir: "/tmp/a&b",
      nodePath: "/usr/local/bin/node",
      homeDir: "/Users/test",
    });
    assert.match(plist, new RegExp(`<string>${ETIQUETTE}</string>`));
    assert.match(plist, new RegExp(`<integer>${INTERVALLE_TROIS_JOURS}</integer>`));
    assert.match(plist, /<string>\/tmp\/a&amp;b<\/string>/);
    assert.match(plist, /mcp\/corpus\/sync\.ts/);
    assert.match(plist, /vitrine-corpus-sync\.log/);
    assert.match(plist, /vitrine-corpus-sync\.err/);
  });

  it("écrit le plist dans le dossier demandé, sans charger l'agent", () => {
    const root = racine();
    try {
      const dossier = join(root, "LaunchAgents");
      const chemin = installerPlanificateur({
        rootDir: "/tmp/depot",
        nodePath: "/usr/local/bin/node",
        homeDir: root,
        dossier,
      });
      assert.equal(chemin, join(dossier, `${ETIQUETTE}.plist`));
      assert.equal(existsSync(chemin), true);
      assert.match(readFileSync(chemin, "utf8"), /StartInterval/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'écrit rien en dry-run et cite les chemins launchctl", () => {
    const root = racine();
    try {
      const dossier = join(root, "LaunchAgents");
      const chemin = installerPlanificateur({
        rootDir: "/tmp/depot",
        nodePath: "/usr/local/bin/node",
        homeDir: root,
        dossier,
        dryRun: true,
      });
      assert.equal(existsSync(chemin), false);
      const commandes = commandesLaunchctl("/tmp/avec espace/fr.vitrine.plist");
      assert.match(commandes.installer, /'\/tmp\/avec espace\/fr\.vitrine\.plist'$/);
      assert.match(commandes.retirer, /bootout/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
