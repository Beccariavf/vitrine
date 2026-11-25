import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  articlesCouverts,
  avecPresence,
  citationAuCorpus,
  documentsPresents,
  extraireCitations,
} from "../mcp/corpus/citations.ts";
import { classerCitations } from "../mcp/corpus/hors-corpus.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import {
  dansPlage,
  lireArticleParNumero,
  lireArticlesDeSections,
  lireSectionDeCode,
  lireTexte,
} from "../mcp/corpus/textes-fr/parse.ts";
import type { DescripteurTextesFr, TexteFr } from "../mcp/corpus/textes-fr/parse.ts";
import { syncTextesFr } from "../mcp/corpus/textes-fr/sync.ts";
import type { ManifesteTextesFr } from "../mcp/corpus/textes-fr/sync.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { normaliser } from "../mcp/embed/embedder.ts";
import { buildIndex } from "../mcp/index/build.ts";
import { openIndex } from "../mcp/index/search.ts";
import { documentsNommes, getArticle, referenceExacte, search } from "../mcp/tools.ts";
import {
  articleSynthetique,
  identifiantSynthetique,
  reponsesSynthetiques,
  sectionSynthetique,
} from "./fixtures/textes-fr/synthetiques.ts";

const fixture = (nom: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/textes-fr/${nom}.json`, import.meta.url), "utf8"));

const DESCRIPTEUR_REEL = JSON.parse(
  readFileSync(new URL("../mcp/corpus/textes-fr/descripteur.json", import.meta.url), "utf8"),
) as DescripteurTextesFr;

/** Les trois captures réelles ; toutes les autres entrées sont synthétiques. */
const REPONSES = reponsesSynthetiques(DESCRIPTEUR_REEL, {
  "decret-2019-536": fixture("decret"),
  "code-penal-226-16": fixture("code-penal"),
  "cpce-l34-5": fixture("cpce"),
});

const DECRET = "LEGITEXT000038567662";
const PENAL = "LEGITEXT000006070719";
const CPCE = "LEGITEXT000006070987";
const TRAVAIL = "LEGITEXT000006072050";
const CSP = "LEGITEXT000006072665";
const CSI = "LEGITEXT000025503132";
const CMF = "LEGITEXT000006072026";
const CRPA = "LEGITEXT000031366350";
const CIVIL = "LEGITEXT000006070721";

/** Nombre d'articles d'une réponse réduite : 2 pour une section, toute la liste sinon. */
function compteReduit(texte: TexteFr): number {
  const route = texte.route;
  if (route.type === "articles") return route.nums.length;
  if (route.type === "codeArticles") return route.sections.reduce((total, section) => total + section.nums.length, 0);
  if (route.type === "code") return new Set([route.premier, route.dernier]).size;
  if (route.type === "legiPart") return 2;
  return 1;
}

/** Le descripteur réel, aux comptes des réponses réduites et synthétiques. */
function descripteurReduit(root: string): string {
  const descripteur: DescripteurTextesFr = {
    ...DESCRIPTEUR_REEL,
    textes: DESCRIPTEUR_REEL.textes.map((texte) => ({ ...texte, attendus: { articles: compteReduit(texte) } })),
  };
  const chemin = join(root, "descripteur.json");
  writeFileSync(chemin, JSON.stringify(descripteur), "utf8");
  return chemin;
}

/**
 * Numéros attendus d'une réponse réduite, lus sur le descripteur : les bornes de
 * la section pour une route `code`, la liste pour `articles`, l'article pour
 * `article`. Une capture réelle (décret, Code pénal 226-16, CPCE L34-5) garde
 * ses numéros, écrits ici.
 */
function numerosAttendus(texte: TexteFr): string[] {
  const route = texte.route;
  if (route.type === "code") return [...new Set([route.premier, route.dernier])];
  if (route.type === "articles") return [...route.nums];
  if (route.type === "article") return [route.num];
  if (route.type === "codeArticles") return route.sections.flatMap((section) => section.nums);
  return [];
}

const CAPTURES_REELLES: Readonly<Record<string, string[]>> = {
  "decret-2019-536": ["151-1", "157"],
  "code-penal-226-16": ["226-16", "226-24"],
  "cpce-l34-5": ["L34-5"],
};

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
    // Un chapitre réglementaire porte aussi ses décrets d'application.
    assert.equal(dansPlage("D1110-3-1", "R1110-1", "R1110-16"), true);
    // La DILA détache parfois le suffixe de lettre par une espace.
    assert.equal(dansPlage("L1121-16-1 A", "L1121-1", "L1121-17"), true);
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
      const attendues = DESCRIPTEUR_REEL.textes.flatMap((texte) => CAPTURES_REELLES[texte.cle] ?? numerosAttendus(texte));
      assert.deepEqual(unites.map((unite) => unite.numero), attendues);
      assert.equal(new Set(unites.map((unite) => unite.ref)).size, unites.length);
      assert.ok(unites.every((unite) => unite.corpus === "textes_fr" && unite.statut === "VIGUEUR"));
      const cpce = unites.find((unite) => unite.numero === "L34-5");
      assert.equal(cpce?.document, CPCE);
      assert.equal(cpce?.url, "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042155961");
      assert.match(String(cpce?.chemin), /^CPCE > Partie législative > /);

      const manifeste = JSON.parse(
        readFileSync(join(root, "data/corpus/textes_fr/manifest.json"), "utf8"),
      ) as ManifesteTextesFr;
      // Un document par `text_id` distinct, un bloc par entrée du descripteur.
      const documents = new Set(DESCRIPTEUR_REEL.textes.map((texte) => texte.textId));
      assert.equal(manifeste.documents, documents.size);
      assert.equal(manifeste.textes.length, DESCRIPTEUR_REEL.textes.length);
      assert.equal(manifeste.unites, attendues.length);
      assert.equal(
        new Set(manifeste.textes.map((texte) => texte.cle)).size,
        DESCRIPTEUR_REEL.textes.length,
      );
      // Article 157 : date de début ouverte à la DILA, datée par le texte, jamais par la version.
      const final = unites.find((unite) => unite.numero === "157");
      assert.equal(final?.date_acte, "2019-05-29");
      assert.equal(final?.date_debut, "");
      assert.equal(manifeste.couverture.articles_abroges_ecartes, 2);
      assert.deepEqual(
        manifeste.textes.map((texte) => texte.text_id),
        DESCRIPTEUR_REEL.textes.map((texte) => texte.textId),
      );
      // Une liste porte ses numéros, dans l'ordre du descripteur.
      const travail = manifeste.textes.find((texte) => texte.cle === "code-travail");
      assert.deepEqual(travail?.articles_couverts, ["L1121-1", "L1222-4", "L1226-2", "L2312-38", "L4624-8"]);
      const penal226 = manifeste.textes.find((texte) => texte.cle === "code-penal-226");
      assert.deepEqual(penal226?.articles_couverts, ["226-1", "226-8-1", "226-13"]);
      // Les trois entrées d'origine gardent leur périmètre et leurs comptes.
      assert.deepEqual(
        manifeste.textes.slice(0, 3).map((texte) => [
          texte.perimetre,
          texte.articles_en_vigueur,
          texte.articles_abroges_ecartes,
        ]),
        [
          ["texte entier", 2, 1],
          ["articles 226-16 à 226-24", 2, 1],
          ["article L34-5", 1, 0],
        ],
      );
      // Le cache brut n'est pas écrit pour des réponses fournies par l'appelant.
      assert.equal(existsSync(join(root, "data/raw/textes_fr")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("agrège une liste de numéros en une seule lecture et un seul snapshot", async () => {
    const root = await racineSynchronisee();
    try {
      const manifeste = JSON.parse(
        readFileSync(join(root, "data/corpus/textes_fr/manifest.json"), "utf8"),
      ) as ManifesteTextesFr;
      const travail = manifeste.textes.find((texte) => texte.cle === "code-travail");
      assert.ok(travail !== undefined);
      const numerosTravail = ["L1121-1", "L1222-4", "L1226-2", "L2312-38", "L4624-8"];
      // Une version par identifiant lu, dans l'ordre du descripteur, jointe par `+`.
      assert.equal(
        travail.version,
        numerosTravail.map((numero) => identifiantSynthetique(TRAVAIL, numero)).join("+"),
      );
      assert.equal(travail.date_debut_version, null);
      assert.equal(travail.articles_en_vigueur, numerosTravail.length);
      assert.equal(travail.snapshot, "2026-11-14/code-travail.json");

      const unites = readFileSync(join(root, "data/corpus/textes_fr/unites.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((ligne) => JSON.parse(ligne) as Record<string, unknown>)
        .filter((unite) => unite.document === TRAVAIL);
      assert.deepEqual(
        unites.map((unite) => unite.url),
        numerosTravail.map(
          (numero) => `https://www.legifrance.gouv.fr/codes/article_lc/${identifiantSynthetique(TRAVAIL, numero)}`,
        ),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse une liste dont un article n'est pas en vigueur, ou porte un autre numéro", () => {
    const texte: TexteFr = {
      cle: "code-travail",
      nom: "Code du travail",
      titre: "Code du travail, article L1222-4",
      textId: TRAVAIL,
      url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072050",
      url_article: "https://www.legifrance.gouv.fr/codes/article_lc/{id}",
      perimetre: "article L1222-4",
      route: { type: "articles", nums: ["L1222-4"] },
      attendus: { articles: 1 },
    };
    const abroge = structuredClone(articleSynthetique(TRAVAIL, "L1222-4")) as {
      article: { etat: string };
    };
    abroge.article.etat = "ABROGE_DIFF";
    assert.throws(
      () => lireTexte(texte, [abroge], "textes_fr", "2026-11-14"),
      /Code du travail : article L1222-4 rendu ABROGE_DIFF, pas VIGUEUR/,
    );

    const autre = articleSynthetique(TRAVAIL, "L1121-1");
    assert.throws(
      () => lireTexte(texte, [autre], "textes_fr", "2026-11-14"),
      /Code du travail : article L1121-1 rendu au lieu de L1222-4/,
    );

    assert.throws(
      () => lireTexte(texte, [], "textes_fr", "2026-11-14"),
      /Code du travail : 0 réponse\(s\) pour 1 article\(s\) demandé\(s\)/,
    );
    assert.throws(
      () => lireTexte(texte, {}, "textes_fr", "2026-11-14"),
      /Code du travail : réponse getArticleWithIdAndNum illisible/,
    );
  });

  it("prélève des numéros datés dans des sections et y trouve L1111-7", () => {
    const texte: TexteFr = {
      cle: "csp",
      nom: "Code de la santé publique",
      titre: "Code de la santé publique, articles L1110-4, L1111-7 et L1111-8",
      textId: CSP,
      url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072665",
      url_article: "https://www.legifrance.gouv.fr/codes/article_lc/{id}",
      perimetre: "articles L1110-4, L1111-7 et L1111-8",
      route: {
        type: "codeArticles",
        sections: [
          { sctCid: "SECTION-A", nums: ["L1110-4"] },
          { sctCid: "SECTION-B", nums: ["L1111-7", "L1111-8"] },
        ],
      },
      attendus: { articles: 3 },
    };
    const route = texte.route;
    if (route.type !== "codeArticles") throw new Error("route codeArticles attendue");
    // La première section porte un article de plus : il reste hors de la lecture.
    const sectionA = sectionSynthetique(texte, "SECTION-A", ["L1110-3", "L1110-4"]);
    const sectionB = sectionSynthetique(texte, "SECTION-B", ["L1111-7", "L1111-8"]);
    const part = lireArticlesDeSections([sectionA, sectionB], route.sections, texte.nom);
    assert.deepEqual(part.articles.map((article) => article.num), ["L1110-4", "L1111-7", "L1111-8"]);
    assert.equal(
      part.version,
      ["L1110-4", "L1111-7", "L1111-8"]
        .map((numero) => identifiantSynthetique(CSP, numero))
        .join("+"),
    );
    assert.equal(part.dateDebutVersion, null);

    // Un numéro absent de sa section ou un article non VIGUEUR fait refuser la capture.
    assert.throws(
      () =>
        lireArticlesDeSections(
          [sectionA, sectionSynthetique(texte, "SECTION-B", ["L1111-8"])],
          route.sections,
          texte.nom,
        ),
      /Code de la santé publique : article L1111-7 absent de la section SECTION-B/,
    );
    const abroge = sectionSynthetique(texte, "SECTION-B", ["L1111-7", "L1111-8"]) as {
      sections: { articles: { etat: string; num: string }[] }[];
    };
    const article = abroge.sections[0]?.articles.find((element) => element.num === "L1111-7");
    assert.ok(article !== undefined);
    article.etat = "ABROGE_DIFF";
    assert.throws(
      () => lireArticlesDeSections([sectionA, abroge], route.sections, texte.nom),
      /Code de la santé publique : article L1111-7 rendu ABROGE_DIFF, pas VIGUEUR/,
    );
  });

  it("relit du cache une liste d'articles, sans appel réseau", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-textes-fr-"));
    try {
      const dossier = join(root, "data/raw/textes_fr/2026-11-14");
      mkdirSync(dossier, { recursive: true });
      for (const [cle, reponse] of Object.entries(REPONSES)) {
        writeFileSync(join(dossier, `${cle}.json`), JSON.stringify(reponse), "utf8");
      }
      // Le snapshot d'une liste est un tableau JSON, dans l'ordre du descripteur.
      const cache = JSON.parse(readFileSync(join(dossier, "code-travail.json"), "utf8")) as {
        article: { num: string };
      }[];
      assert.deepEqual(
        cache.map((element) => element.article.num),
        ["L1121-1", "L1222-4", "L1226-2", "L2312-38", "L4624-8"],
      );
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

  it("garde l'historique des versions remplacées du décret", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-textes-fr-"));
    try {
      await syncTextesFr({
        rootDir: root,
        descripteurPath: descripteurReduit(root),
        date: "2026-11-14",
        reponses: REPONSES,
        config: null,
      });
      const nouveau = structuredClone(REPONSES) as unknown as Record<
        string,
        { id: string; dateDebutVersion: string }
      >;
      const decret = nouveau["decret-2019-536"];
      assert.ok(decret !== undefined);
      decret.id = "LEGITEXT000038567662_01-01-2026";
      decret.dateDebutVersion = "2026-01-01";

      await syncTextesFr({
        rootDir: root,
        descripteurPath: descripteurReduit(root),
        date: "2026-11-20",
        reponses: nouveau,
        config: null,
      });

      const manifeste = JSON.parse(
        readFileSync(join(root, "data", "corpus", "textes_fr", "manifest.json"), "utf8"),
      ) as ManifesteTextesFr;
      const texteFr = manifeste.textes.find((texte) => texte.cle === "decret-2019-536");
      assert.ok(texteFr !== undefined);
      assert.equal(texteFr.version, "LEGITEXT000038567662_01-01-2026");
      assert.deepEqual(texteFr.versions_remplacees, [
        {
          identifiant: "LEGITEXT000038567662_07-09-2025",
          date_debut: "2025-09-07",
          date_fin: "2025-12-31",
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reprend l'historique d'un manifeste antérieur, sans clé de bloc", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-textes-fr-"));
    try {
      // Un manifeste écrit avant #124 : des blocs sans `cle`, datés d'une version
      // antérieure du décret. Le rejeu doit la ranger dans `versions_remplacees`.
      const ancien = {
        corpus: "textes_fr",
        nom: "Textes français d'application",
        licence: "Licence Ouverte 2.0 (Etalab)",
        date_consultation: "2024-01-01",
        documents: 1,
        unites: 0,
        textes: [
          {
            text_id: DECRET,
            nom: "Décret 2019-536",
            titre: "Décret n° 2019-536",
            url: "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000038567662",
            version: "LEGITEXT000038567662_01-01-2024",
            date_debut_version: "2024-01-01",
            perimetre: "texte entier",
            articles_couverts: null,
            articles_en_vigueur: 166,
            articles_abroges_ecartes: 0,
            versions_remplacees: [],
            snapshot: "2024-01-01/decret-2019-536.json",
            snapshot_sha256: "",
          },
        ],
        couverture: { source: "", date: "2024-01-01", articles_en_vigueur: 0, articles_abroges_ecartes: 0, perimetre: [] },
      };
      mkdirSync(join(root, "data", "corpus", "textes_fr"), { recursive: true });
      writeFileSync(
        join(root, "data", "corpus", "textes_fr", "manifest.json"),
        JSON.stringify(ancien),
        "utf8",
      );

      await syncTextesFr({
        rootDir: root,
        descripteurPath: descripteurReduit(root),
        date: "2026-11-14",
        reponses: REPONSES,
        config: null,
      });

      const manifeste = JSON.parse(
        readFileSync(join(root, "data", "corpus", "textes_fr", "manifest.json"), "utf8"),
      ) as ManifesteTextesFr;
      const decret = manifeste.textes.find((texte) => texte.cle === "decret-2019-536");
      assert.ok(decret !== undefined);
      assert.deepEqual(decret.versions_remplacees, [
        {
          identifiant: "LEGITEXT000038567662_01-01-2024",
          date_debut: "2024-01-01",
          date_fin: "2025-09-06",
        },
      ]);
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
        /Corpus textes_fr invalide, rien n'est écrit : Décret 2019-536 : 2 articles en vigueur au lieu de 166/,
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
      // « 226 » n'est pas « 226-16 », ni « 226-16-1-A » (abrogé) « 226-16 » : tiret et suffixe comptent.
      assert.equal(getArticle(root, { document: PENAL, numero: "226" }).trouve, false);
      assert.equal(getArticle(root, { document: PENAL, numero: "226-16-1-A" }).trouve, false);
      assert.equal(getArticle(root, { document: PENAL, numero: "n° 226-24" }).trouve, true);
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
      const absent = getArticle(root, { document: CPCE, numero: "L33-1" });
      assert.equal(absent.trouve, false);
      assert.equal(
        !absent.trouve && absent.message,
        `Article L33-1 hors du corpus : seuls les articles L34-5, L32-3, L34-1 du CPCE (${CPCE}) y figurent.`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lit les articles des codes ajoutés, sur le corpus réel", () => {
    const racine = new URL("..", import.meta.url).pathname;
    const attendus: [string, string][] = [
      [TRAVAIL, "L1222-4"],
      [CSI, "L251-2"],
      [CIVIL, "9"],
      [CPCE, "L34-1"],
    ];
    for (const [document, numero] of attendus) {
      const article = getArticle(racine, { document, numero });
      assert.equal(article.trouve, true, `${document} ${numero}`);
      const trouve = article.trouve ? article : null;
      assert.equal(trouve?.numero, numero);
      assert.equal(trouve?.url, `https://www.legifrance.gouv.fr/codes/article_lc/${trouve?.ref}`);
      assert.equal(trouve?.statut_application, "en_vigueur");
    }
    // Un article de code couvert porte son lien `codes/article_lc/…`.
    const civil = getArticle(racine, { document: CIVIL, numero: "9" });
    assert.match(civil.trouve ? String(civil.url) : "", /^https:\/\/www\.legifrance\.gouv\.fr\/codes\/article_lc\/LEGIARTI\d+$/);
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

  it("cherche par le sens une question qui cite L. 34-5 dans un corpus de décisions", async () => {
    const root = await racineSynchronisee();
    try {
      const marqueur = EMBEDDER_INTERDIT;
      await assert.rejects(
        search(
          root,
          { question: "manquement à l'article L. 34-5 du CPCE", corpus: "ce" },
          {
            embedder: marqueur,
            index: () => {
              throw new Error("recherche sémantique");
            },
          },
        ),
        /recherche sémantique/,
      );
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
    assert.deepEqual(
      documentsNommes("le décret n° 2019-536 du 29 mai 2019 pris pour l'application de la loi n° 78-17 du 6 janvier 1978"),
      [DECRET],
    );
    assert.equal(documentsNommes("le décret 2019-536 et la loi 78-17").length, 2);
    assert.deepEqual(documentsNommes("l'article 226-16 du Code pénal"), [PENAL]);
    assert.deepEqual(documentsNommes("l'article L1222-4 du code du travail"), [TRAVAIL]);
    assert.deepEqual(documentsNommes("le secret médical et le code de la santé publique"), [CSP]);
    assert.deepEqual(documentsNommes("la vidéoprotection au titre du code de la sécurité intérieure"), [CSI]);
    assert.deepEqual(documentsNommes("le code monétaire et financier"), [CMF]);
    assert.deepEqual(
      documentsNommes("le code des relations entre le public et l'administration"),
      [CRPA],
    );
    assert.deepEqual(documentsNommes("l'article 9 du code civil"), [CIVIL]);
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

  it("fusionne les articles couverts des blocs d'un même texte", async () => {
    const root = await racineSynchronisee();
    try {
      const couverts = articlesCouverts(root);
      // Le Code pénal a trois blocs : 226-16 à 226-24, 226-1, 226-8-1 et 226-13, 323. Aucun n'efface les autres.
      assert.deepEqual(couverts.get(PENAL), ["226-16", "226-24", "226-1", "226-8-1", "226-13", "323-1", "323-8"]);
      assert.deepEqual(couverts.get(CPCE), ["L34-5", "L32-3", "L34-1"]);
      assert.deepEqual(couverts.get(TRAVAIL), ["L1121-1", "L1222-4", "L1226-2", "L2312-38", "L4624-8"]);
      // Un texte entier (le décret) reste hors de la carte.
      assert.equal(couverts.has(DECRET), false);

      const presents = documentsPresents(root);
      const cite = (articles: string[]) => citationAuCorpus(presents, { document: PENAL, articles }, couverts);
      assert.equal(cite(["226-16"]), true);
      assert.equal(cite(["226-1"]), true);
      assert.equal(cite(["323-4"]), false);
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

describe("les articles de santé ajoutés et les articles existants", () => {
  const RACINE = new URL("..", import.meta.url).pathname;

  it("garde ref, texte et url des articles déjà au corpus avant #133", () => {
    const attendus = JSON.parse(
      readFileSync(new URL("./fixtures/textes-fr/articles-existants.json", import.meta.url), "utf8"),
    ) as { document: string; numero: string; ref: string; url: string; texte_sha256: string }[];
    const unites = readFileSync(join(RACINE, "data/corpus/textes_fr/unites.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((ligne) => JSON.parse(ligne) as { document: string; numero: string; ref: string; url: string; texte: string });
    for (const attendu of attendus) {
      const unite = unites.find(
        (candidat) => candidat.document === attendu.document && candidat.numero === attendu.numero,
      );
      assert.ok(unite !== undefined, `${attendu.document} ${attendu.numero} absent`);
      assert.equal(unite.ref, attendu.ref, `${attendu.numero} : ref`);
      assert.equal(unite.url, attendu.url, `${attendu.numero} : url`);
      assert.equal(
        createHash("sha256").update(unite.texte, "utf8").digest("hex"),
        attendu.texte_sha256,
        `${attendu.numero} : texte`,
      );
    }
  });

  it("attribue les articles ajoutés et les dit au corpus", () => {
    const citation = (texte: string) => avecPresence(RACINE, extraireCitations(texte));
    const snds = citation("L'article L. 1461-1 du code de la santé publique définit le SNDS.");
    assert.deepEqual(
      snds.map((element) => [element.document, element.articles, element.hors_corpus]),
      [[CSP, ["L. 1461-1"], false]],
    );
    const secret = citation("L'article 226-13 du code pénal punit la révélation du secret.");
    assert.deepEqual(
      secret.map((element) => [element.document, element.articles, element.hors_corpus]),
      [[PENAL, ["226-13"], false]],
    );
    for (const [texte, document] of [
      ["L'article L. 161-28-1 du code de la sécurité sociale crée le SNIIRAM.", "LEGITEXT000006073189"],
      ["L'article L. 2223-42 du code général des collectivités territoriales vise le certificat de décès.", "LEGITEXT000006070633"],
      ["L'article L. 113-2 du code des assurances impose la déclaration du risque.", "LEGITEXT000006073984"],
    ] as const) {
      const rendues = citation(texte);
      assert.deepEqual(
        rendues.map((element) => [element.document, element.hors_corpus]),
        [[document, false]],
      );
    }
  });
});
