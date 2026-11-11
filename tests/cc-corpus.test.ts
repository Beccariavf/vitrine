import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { FetchLike } from "../veille/fetch.ts";
import { resetUsage } from "../veille/piste.ts";
import {
  classerDecisionCc,
  compterMotsCles,
  unitesCc,
} from "../mcp/corpus/cc/parse.ts";
import type { DescripteurCc } from "../mcp/corpus/cc/parse.ts";
import { entreesVeille, syncCc } from "../mcp/corpus/cc/sync.ts";
import type { ManifesteCc } from "../mcp/corpus/cc/sync.ts";
import { validerUnitesCorpus } from "../mcp/corpus/parse.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/cc/descripteur.json", import.meta.url), "utf8"),
) as DescripteurCc;
const PERTINENT = JSON.parse(
  readFileSync(new URL("./fixtures/cc/decision-pertinent.json", import.meta.url), "utf8"),
) as Record<string, unknown>;
const HORS_SUJET = JSON.parse(
  readFileSync(new URL("./fixtures/cc/decision-hors-sujet.json", import.meta.url), "utf8"),
) as Record<string, unknown>;
const RECHERCHE = JSON.parse(
  readFileSync(new URL("./fixtures/cc/search.json", import.meta.url), "utf8"),
) as unknown;
const RACINE = fileURLToPath(new URL("..", import.meta.url));

const ID_PERTINENT = String(PERTINENT.id);
const ID_HORS_SUJET = String(HORS_SUJET.id);

function racineTemporaire(): string {
  return mkdtempSync(join(tmpdir(), "cc-corpus-"));
}

function ecrire(racine: string, relatif: string, contenu: string): void {
  const chemin = join(racine, relatif);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu, "utf8");
}

function commandeRecherche(): unknown {
  return {
    page: 0,
    page_size: 50,
    total: 2,
    results: [
      { id: ID_PERTINENT, decision_date: "2026-11-10", chamber: "soc", number: "25-14.493" },
      { id: ID_HORS_SUJET, decision_date: "2026-11-05", chamber: "civ2", number: "25-12.778" },
    ],
  };
}

const CONFIG = { clientId: "client", clientSecret: "secret", keyId: "key" };

function reponse(status: number, body: string) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

beforeEach(() => resetUsage());
afterEach(() => resetUsage());

describe("le filtre de pertinence de la Cour de cassation", () => {
  it("compte les expressions centrales, la plus longue gagnant à chaque position", () => {
    assert.equal(compterMotsCles("Le RGPD et le RGPD.", DESCRIPTEUR.mots_cles), 2);
    assert.equal(
      compterMotsCles(
        "Le règlement général sur la protection des données s'applique.",
        DESCRIPTEUR.mots_cles,
      ),
      1,
      "une occurrence ne compte pas deux fois",
    );
    assert.equal(compterMotsCles("Le code du travail s'applique.", DESCRIPTEUR.mots_cles), 0);
  });

  it("retient une décision dont le visa cite un instrument de protection des données", () => {
    const verdict = classerDecisionCc(PERTINENT, DESCRIPTEUR);
    assert.equal(verdict.retenue, true);
    if (!verdict.retenue) return;
    assert.equal(verdict.decision.visaPertinent, true);
    assert.equal(verdict.decision.chemin.startsWith("Cour de cassation > "), true);
    assert.equal(verdict.decision.url, `https://www.courdecassation.fr/decision/${ID_PERTINENT}`);
  });

  it("écarte une décision hors sujet, une décision avant 2014 et un texte vide", () => {
    assert.deepEqual(classerDecisionCc(HORS_SUJET, DESCRIPTEUR), {
      retenue: false,
      motif: "hors_sujet",
    });
    assert.deepEqual(
      classerDecisionCc({ ...PERTINENT, decision_date: "2013-12-31" }, DESCRIPTEUR),
      { retenue: false, motif: "avant_borne" },
    );
    assert.deepEqual(
      classerDecisionCc({ ...PERTINENT, text: "" }, DESCRIPTEUR),
      { retenue: false, motif: "texte_vide" },
    );
  });

  it("rend le visa puis les fragments du texte, tous citables", () => {
    const verdict = classerDecisionCc(PERTINENT, DESCRIPTEUR);
    assert.equal(verdict.retenue, true);
    if (!verdict.retenue) return;

    const unites = unitesCc(verdict.decision, DESCRIPTEUR);
    assert.equal(unites[0]?.ref, `${ID_PERTINENT}#visa`);
    assert.equal(unites[0]?.numero, "visa");
    assert.match(unites[0]?.chemin ?? "", /Visa$/);
    assert.equal(unites[1]?.ref, `${ID_PERTINENT}#f0`);
    assert.equal(unites[1]?.corpus, "cc");
    assert.equal(unites[1]?.date_acte, "2026-11-10");
    assert.doesNotThrow(() => validerUnitesCorpus(unites, "Cour de cassation"));
    for (const unite of unites) {
      assert.notEqual(unite.texte.trim(), "");
      assert.match(unite.url, /^https:\/\/www\.courdecassation\.fr\/decision\//);
    }
  });
});

describe("la synchronisation du corpus Cour de cassation", () => {
  it("recherche, lit, filtre et écrit un corpus idempotent", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncCc({
        rootDir: racine,
        date: "2026-11-11",
        reponsesRecherche: { "données personnelles": commandeRecherche() },
        reponsesDecision: {
          [ID_PERTINENT]: PERTINENT,
          [ID_HORS_SUJET]: HORS_SUJET,
        },
      });

      assert.equal(resultat.documentsLus, 2);
      assert.equal(resultat.documents, 1);
      assert.equal(resultat.enAttente, 0);
      assert.deepEqual(resultat.ecartes, {
        avant_borne: 0,
        date_invalide: 0,
        hors_sujet: 1,
        texte_vide: 0,
      });
      assert.equal(existsSync(join(racine, "data", "corpus", "cc", "unites.jsonl")), true);

      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cc", "manifest.json"), "utf8"),
      ) as ManifesteCc;
      const unites = readFileSync(
        join(racine, "data", "corpus", "cc", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);

      assert.equal(manifeste.fragments, unites.length);
      assert.equal(manifeste.documents, new Set(unites.map((unite) => unite.document)).size);
      assert.equal(
        manifeste.documents + Object.values(manifeste.exclusions).reduce((a, b) => a + b, 0),
        manifeste.documents_lus,
      );
      assert.equal(manifeste.couverture.reprise.en_cache, 2);
      assert.equal(resultat.appels.decision, 2);
      assert.doesNotThrow(() => validerUnitesCorpus(unites, "Cour de cassation"));

      const seconde = await syncCc({
        rootDir: racine,
        date: "2026-11-11",
        reponsesRecherche: { "données personnelles": commandeRecherche() },
        reponsesDecision: {},
      });
      assert.equal(seconde.ecrit, false);
      assert.equal(seconde.appels.decision, 0, "le cache évite toute relecture");
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ne réécrit rien le lendemain quand le corpus n'a pas changé", async () => {
    const racine = racineTemporaire();
    try {
      await syncCc({
        rootDir: racine,
        date: "2026-11-11",
        reponsesRecherche: { "données personnelles": commandeRecherche() },
        reponsesDecision: { [ID_PERTINENT]: PERTINENT, [ID_HORS_SUJET]: HORS_SUJET },
      });
      const lendemain = await syncCc({
        rootDir: racine,
        date: "2026-11-12",
        reponsesRecherche: { "données personnelles": commandeRecherche() },
        reponsesDecision: {},
      });
      assert.equal(lendemain.ecrit, false);
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cc", "manifest.json"), "utf8"),
      ) as ManifesteCc;
      assert.equal(manifeste.date_extraction, "2026-11-11");
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("inclut les décisions publiées par la veille", async () => {
    const racine = racineTemporaire();
    try {
      ecrire(
        racine,
        "data/entries/2026/11/entree.json",
        JSON.stringify({ source: "judilibre", id: ID_HORS_SUJET, url: "https://exemple" }),
      );
      const ids = entreesVeille(racine, "judilibre");
      assert.deepEqual(ids, [ID_HORS_SUJET]);

      const resultat = await syncCc({
        rootDir: racine,
        date: "2026-11-11",
        reponsesRecherche: {
          "données personnelles": { total: 1, results: [{ id: ID_PERTINENT }] },
        },
        reponsesDecision: {
          [ID_PERTINENT]: PERTINENT,
          [ID_HORS_SUJET]: HORS_SUJET,
        },
      });

      assert.equal(resultat.documentsLus, 2);
      assert.equal(resultat.documents, 2, "la décision de la veille est retenue hors filtre");
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cc", "manifest.json"), "utf8"),
      ) as ManifesteCc;
      assert.deepEqual(manifeste.couverture.veille, { entrees: 1, ajoutees: 1, retenues: 1 });
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("refuse d'écrire un corpus tronqué quand la recherche est interrompue", async () => {
    const racine = racineTemporaire();
    try {
      await syncCc({
        rootDir: racine,
        date: "2026-11-11",
        reponsesRecherche: { "données personnelles": commandeRecherche() },
        reponsesDecision: {
          [ID_PERTINENT]: PERTINENT,
          [ID_HORS_SUJET]: HORS_SUJET,
        },
      });
      const corpus = readFileSync(
        join(racine, "data", "corpus", "cc", "unites.jsonl"),
        "utf8",
      );

      resetUsage();
      let recherche = 0;
      const fetchImpl: FetchLike = async (url) => {
        if (url.includes("/search")) {
          recherche += 1;
          if (recherche === 1) return reponse(200, JSON.stringify(commandeRecherche()));
          return reponse(429, "quota");
        }
        return reponse(200, JSON.stringify(PERTINENT));
      };
      await assert.rejects(
        async () =>
          syncCc({
            rootDir: racine,
            date: "2026-11-11",
            config: CONFIG,
            fetchImpl,
          }),
        /Recherche Judilibre interrompue/,
      );
      assert.equal(
        readFileSync(join(racine, "data", "corpus", "cc", "unites.jsonl"), "utf8"),
        corpus,
        "le corpus existant reste intact",
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("refuse de tronquer un corpus existant quand le budget s'épuise", async () => {
    const racine = racineTemporaire();
    try {
      await syncCc({
        rootDir: racine,
        date: "2026-11-11",
        reponsesRecherche: { "données personnelles": commandeRecherche() },
        reponsesDecision: { [ID_PERTINENT]: PERTINENT, [ID_HORS_SUJET]: HORS_SUJET },
      });
      const corpus = readFileSync(join(racine, "data", "corpus", "cc", "unites.jsonl"), "utf8");
      rmSync(join(racine, "data", "raw", "cc"), { recursive: true, force: true });

      resetUsage();
      const fetchImpl: FetchLike = async (url) => {
        if (url.includes("/search")) return reponse(200, JSON.stringify(commandeRecherche()));
        return reponse(200, JSON.stringify(PERTINENT));
      };
      await assert.rejects(
        async () =>
          syncCc({
            rootDir: racine,
            date: "2026-11-11",
            config: CONFIG,
            fetchImpl,
            maxAppels: 23,
          }),
        /Budget PISTE épuisé avec 1 décision/,
      );
      assert.equal(
        readFileSync(join(racine, "data", "corpus", "cc", "unites.jsonl"), "utf8"),
        corpus,
        "le corpus existant reste intact",
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("s'arrête au budget sans perdre le corpus et reprend au cache", async () => {
    const racine = racineTemporaire();
    const appels: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      appels.push(url);
      if (url.includes("/search")) return reponse(200, JSON.stringify(commandeRecherche()));
      const id = new URL(url).searchParams.get("id") ?? "";
      if (id === ID_PERTINENT) return reponse(200, JSON.stringify(PERTINENT));
      if (id === ID_HORS_SUJET) return reponse(200, JSON.stringify(HORS_SUJET));
      return reponse(404, "");
    };

    try {
      resetUsage();
      const interrompue = await syncCc({
        rootDir: racine,
        date: "2026-11-11",
        config: CONFIG,
        fetchImpl,
        maxAppels: 23,
      });
      assert.equal(interrompue.enAttente, 1, "le budget s'épuise après la première décision");
      assert.equal(interrompue.appels.decision, 1);

      resetUsage();
      const reprise = await syncCc({
        rootDir: racine,
        date: "2026-11-11",
        config: CONFIG,
        fetchImpl,
        maxAppels: 30,
      });
      assert.equal(reprise.enAttente, 0);
      assert.equal(reprise.documents, 1);
      assert.ok(appels.some((url) => url.includes(`id=${ID_PERTINENT}`)));
    } finally {
      resetUsage();
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("le corpus commité porte les comptes de son manifeste", () => {
    const manifeste = JSON.parse(
      readFileSync(join(RACINE, "data", "corpus", "cc", "manifest.json"), "utf8"),
    ) as ManifesteCc;
    const unites = readFileSync(join(RACINE, "data", "corpus", "cc", "unites.jsonl"), "utf8")
      .split("\n")
      .filter((ligne) => ligne !== "")
      .map((ligne) => JSON.parse(ligne) as Unite);

    assert.equal(unites.length, manifeste.fragments);
    assert.equal(new Set(unites.map((unite) => unite.document)).size, manifeste.documents);
    assert.doesNotThrow(() => validerUnitesCorpus(unites, "Cour de cassation"));
  });
});
