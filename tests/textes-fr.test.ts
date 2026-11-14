import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { citationAuCorpus, documentsPresents } from "../mcp/corpus/citations.ts";
import { classerCitations } from "../mcp/corpus/hors-corpus.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import { dansPlage, lireArticleParNumero, lireSectionDeCode } from "../mcp/corpus/textes-fr/parse.ts";
import type { DescripteurTextesFr } from "../mcp/corpus/textes-fr/parse.ts";
import { syncTextesFr } from "../mcp/corpus/textes-fr/sync.ts";
import type { ManifesteTextesFr } from "../mcp/corpus/textes-fr/sync.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { normaliser } from "../mcp/embed/embedder.ts";
import { buildIndex } from "../mcp/index/build.ts";
import { openIndex } from "../mcp/index/search.ts";
import { documentsNommes, getArticle, referenceExacte, search } from "../mcp/tools.ts";

const fixture = (nom: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/textes-fr/${nom}.json`, import.meta.url), "utf8"));

const REPONSES = {
  "decret-2019-536": fixture("decret"),
  "code-penal-226-16": fixture("code-penal"),
  "cpce-l34-5": fixture("cpce"),
};

const DESCRIPTEUR_REEL = JSON.parse(
  readFileSync(new URL("../mcp/corpus/textes-fr/descripteur.json", import.meta.url), "utf8"),
) as DescripteurTextesFr;

const DECRET = "LEGITEXT000038567662";
const PENAL = "LEGITEXT000006070719";
const CPCE = "LEGITEXT000006070987";

/** Le descripteur réel, aux comptes des captures réduites : 1 article du décret, 2 du Code pénal. */
function descripteurReduit(root: string): string {
  const descripteur: DescripteurTextesFr = {
    ...DESCRIPTEUR_REEL,
    textes: DESCRIPTEUR_REEL.textes.map((texte) => ({
      ...texte,
      attendus: { articles: texte.route.type === "legiPart" ? 1 : texte.route.type === "code" ? 2 : 1 },
    })),
  };
  const chemin = join(root, "descripteur.json");
  writeFileSync(chemin, JSON.stringify(descripteur), "utf8");
  return chemin;
}

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

/** Embedder déterministe : sac de mots hachés, 8 dimensions, aucun réseau. */
function embedderFactice(): Embedder {
  const vecteur = (texte: string): number[] => {
    const valeurs = new Array<number>(8).fill(0);
    for (const mot of texte.toLowerCase().split(/\s+/)) {
      if (mot === "") continue;
      let empreinte = 7;
      for (const caractere of mot) empreinte = (empreinte * 31 + (caractere.codePointAt(0) ?? 0)) % 1_000_003;
      valeurs[empreinte % 8] = (valeurs[empreinte % 8] ?? 0) + 1;
    }
    return normaliser(valeurs);
  };
  return { model: "factice", dim: 8, embedPassages: async (t) => t.map(vecteur), embedQuery: async (t) => vecteur(t) };
}

/** Racine temporaire portant le corpus des captures réduites. */
async function racineSynchronisee(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "vitrine-textes-fr-"));
  await syncTextesFr({ rootDir: root, descripteurPath: descripteurReduit(root), date: "2026-11-14", reponses: REPONSES, config: null });
  return root;
}

describe("la lecture des textes français d'application", () => {
  it("borne une plage de code, suffixe de lettre compris", () => {
    assert.equal(dansPlage("226-16", "226-16", "226-24"), true);
    assert.equal(dansPlage("226-22-2", "226-16", "226-24"), true);
    assert.equal(dansPlage("226-16-1-A", "226-16", "226-24"), true);
    assert.equal(dansPlage("226-15", "226-16", "226-24"), false);
    assert.equal(dansPlage("226-25", "226-16", "226-24"), false);
    assert.equal(dansPlage("L34-5", "226-16", "226-24"), false);
  });

  it("ne garde que la section visée du Code pénal, avec son chemin", () => {
    const part = lireSectionDeCode(fixture("code-penal"), "LEGISCTA000006165313");
    assert.deepEqual(part.articles.map((article) => article.num), ["226-16", "226-16-1-A", "226-24"]);
    assert.match(part.articles[0]?.pathTitle.at(-1) ?? "", /^Section 5 : Des atteintes aux droits de la personne/);
    assert.throws(() => lireSectionDeCode(fixture("code-penal"), "LEGISCTA000000000000"), /sans la section/);
  });

  it("lit l'article du CPCE avec son contexte", () => {
    const part = lireArticleParNumero(fixture("cpce"));
    const [article] = part.articles;
    assert.equal(article?.num, "L34-5");
    assert.equal(article?.etat, "VIGUEUR");
    assert.equal(article?.dateDebut, "2020-07-26");
    assert.equal(article?.dateFin, null);
    assert.equal(article?.pathTitle[0], "Partie législative");
    assert.throws(() => lireArticleParNumero({}), /sans article/);
  });
});

describe("la synchronisation des textes français d'application", () => {
  it("écrit les unités en vigueur et compte les abrogés au manifeste", async () => {
    const root = await racineSynchronisee();
    try {
      const unites = readFileSync(join(root, "data/corpus/textes_fr/unites.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((ligne) => JSON.parse(ligne) as Record<string, unknown>);
      assert.deepEqual(unites.map((unite) => unite.numero), ["151-1", "226-16", "226-24", "L34-5"]);
      assert.ok(unites.every((unite) => unite.corpus === "textes_fr" && unite.statut === "VIGUEUR"));
      const cpce = unites.find((unite) => unite.numero === "L34-5");
      assert.equal(cpce?.document, CPCE);
      assert.equal(cpce?.url, "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042155961");
      assert.match(String(cpce?.chemin), /^CPCE > Partie législative > /);

      const manifeste = JSON.parse(
        readFileSync(join(root, "data/corpus/textes_fr/manifest.json"), "utf8"),
      ) as ManifesteTextesFr;
      assert.equal(manifeste.documents, 3);
      assert.equal(manifeste.unites, 4);
      assert.equal(manifeste.couverture.articles_abroges_ecartes, 2);
      assert.deepEqual(
        manifeste.textes.map((texte) => [texte.text_id, texte.articles_couverts, texte.articles_abroges_ecartes]),
        [
          [DECRET, null, 1],
          [PENAL, ["226-16", "226-24"], 1],
          [CPCE, ["L34-5"], 0],
        ],
      );
      // Le cache brut n'est pas écrit pour des réponses fournies par l'appelant.
      assert.equal(existsSync(join(root, "data/raw/textes_fr")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("relit le cache du jour sans appel réseau", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-textes-fr-"));
    try {
      const dossier = join(root, "data/raw/textes_fr/2026-11-14");
      mkdirSync(dossier, { recursive: true });
      for (const [cle, reponse] of Object.entries(REPONSES)) {
        writeFileSync(join(dossier, `${cle}.json`), JSON.stringify(reponse), "utf8");
      }
      const resultat = await syncTextesFr({
        rootDir: root,
        descripteurPath: descripteurReduit(root),
        date: "2026-11-14",
        config: null,
        fetchImpl: async () => {
          throw new Error("aucun appel attendu");
        },
      });
      assert.deepEqual(resultat.appeles, []);
      assert.equal(resultat.ecrit, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse une capture amputée sans rien écrire", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-textes-fr-"));
    try {
      await assert.rejects(
        syncTextesFr({ rootDir: root, date: "2026-11-14", reponses: REPONSES, config: null }),
        /Corpus textes_fr invalide, rien n'est écrit : Décret 2019-536 : 1 articles en vigueur au lieu de 166/,
      );
      assert.equal(existsSync(join(root, "data/corpus/textes_fr")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse un appel réseau sans configuration PISTE", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-textes-fr-"));
    try {
      await assert.rejects(syncTextesFr({ rootDir: root, date: "2026-11-14", config: null }), /Configuration PISTE absente/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("les outils sur les textes français d'application", () => {
  it("lit un article par son numéro de code, tiret et préfixe compris", async () => {
    const root = await racineSynchronisee();
    try {
      for (const numero of ["L34-5", "L. 34-5", "l.34-5", "article L34-5"]) {
        const article = getArticle(root, { document: CPCE, numero });
        assert.equal(article.trouve, true, numero);
        assert.equal(article.trouve && article.statut_application, "en_vigueur");
        assert.equal(article.trouve && article.ref, "LEGIARTI000042155961");
      }
      const penal = getArticle(root, { document: PENAL, numero: "226-24" });
      assert.equal(penal.trouve && penal.numero, "226-24");
      assert.equal(penal.perimetre.corpus[0]?.corpus, "textes_fr");
      // « 226 » n'est pas « 226-16 » : le tiret fait partie du numéro.
      assert.equal(getArticle(root, { document: PENAL, numero: "226" }).trouve, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("distingue l'article 20-1 de l'article 20 de la LIL, sur le corpus réel", () => {
    const racine = new URL("..", import.meta.url).pathname;
    const lil = "LEGITEXT000006068624";
    const tiret = getArticle(racine, { document: lil, numero: "20-1" });
    const simple = getArticle(racine, { document: lil, numero: "Article 20" });
    assert.equal(tiret.trouve && tiret.numero, "20-1");
    assert.equal(simple.trouve && simple.numero, "20");
  });

  it("dit hors du corpus un article non couvert d'un texte partiel", async () => {
    const root = await racineSynchronisee();
    try {
      const absent = getArticle(root, { document: CPCE, numero: "L34-1" });
      assert.equal(absent.trouve, false);
      assert.equal(
        !absent.trouve && absent.message,
        `Article L34-1 hors du corpus : seuls les articles L34-5 du CPCE (${CPCE}) y figurent.`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend l'article cité quand la question nomme le texte", async () => {
    const root = await racineSynchronisee();
    try {
      const resultat = await search(
        root,
        { question: "Que dit l'article L. 34-5 du code des postes et des communications électroniques ?" },
        { embedder: EMBEDDER_INTERDIT },
      );
      assert.equal(resultat.niveau_confiance, "confiant");
      assert.equal(resultat.passages[0]?.document, CPCE);
      assert.equal(resultat.perimetre.document, CPCE);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("borne la recherche sémantique au corpus et à un texte", async () => {
    const root = await racineSynchronisee();
    try {
      const { chemin } = await buildIndex(root, embedderFactice());
      const index = openIndex(chemin);
      try {
        const corpus = await search(
          root,
          { question: "prospection directe par courrier électronique", corpus: "textes_fr", k: 10 },
          { embedder: embedderFactice(), index, seuils: { bas: -1, haut: -1, marge: 0 } },
        );
        assert.ok(corpus.passages.length > 0);
        assert.ok(corpus.passages.every((passage) => passage.corpus === "textes_fr"));
        const decret = await search(
          root,
          { question: "prospection directe par courrier électronique", document: DECRET, k: 10 },
          { embedder: embedderFactice(), index, seuils: { bas: -1, haut: -1, marge: 0 } },
        );
        assert.ok(decret.passages.length > 0);
        assert.ok(decret.passages.every((passage) => passage.document === DECRET));
        assert.equal(decret.perimetre.corpus[0]?.corpus, "textes_fr");
      } finally {
        index.db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reconnaît les références et les noms des textes", () => {
    assert.equal(referenceExacte("article L. 34-5 du CPCE"), "L. 34-5");
    assert.equal(referenceExacte("art. 226-16 du code pénal"), "226-16");
    assert.equal(referenceExacte("l'article 17 du RGPD"), "17");
    assert.deepEqual(documentsNommes("le décret n° 2019-536"), [DECRET]);
    assert.deepEqual(documentsNommes("selon le CPCE"), [CPCE]);
    assert.deepEqual(documentsNommes("l'article 226-16 du Code pénal"), [PENAL]);
    assert.equal(statutApplication("textes_fr", "VIGUEUR"), "en_vigueur");
    assert.equal(statutApplication("textes_fr", "ABROGE"), "abroge");
  });
});

describe("la présence d'un texte couvert en partie", () => {
  it("marque au corpus seulement les articles couverts", async () => {
    const root = await racineSynchronisee();
    try {
      const presents = documentsPresents(root);
      const couverts = new Map([[CPCE, ["L34-5"]], [PENAL, ["226-16", "226-24"]]]);
      const cite = (document: string, articles: string[]) => citationAuCorpus(presents, { document, articles }, couverts);
      assert.equal(cite(CPCE, ["L. 34-5"]), true);
      assert.equal(cite(CPCE, ["L. 34-1"]), false);
      assert.equal(cite(CPCE, []), false);
      assert.equal(cite(PENAL, ["226-16–226-24"]), true);
      assert.equal(cite(PENAL, ["226-1"]), false);
      assert.equal(cite(DECRET, []), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("garde au classement hors corpus les citations non couvertes", () => {
    const presents = new Set([CPCE]);
    const couverts = new Map([[CPCE, ["L34-5"]]]);
    const citation = (articles: string[]) => ({ instrument: "CPCE", document: CPCE, articles, reference: "", url: null });
    const classement = classerCitations(
      [{ corpus: "cnil", citations: new Map([["a", [citation(["L. 34-5"])]], ["b", [citation(["L. 34-1"])]]]) }],
      presents,
      new Set(),
      couverts,
    );
    assert.deepEqual(classement.map((document) => [document.document, document.citations]), [[CPCE, 1]]);
  });
});
