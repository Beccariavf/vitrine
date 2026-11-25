import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Entry } from "../veille/types.ts";
import type { FetchLike } from "../veille/fetch.ts";
import {
  SOURCE_ID,
  corpsRechercheLoda,
  dateDeVersionIdentifiant,
  etatsCorpus,
  maxCallsPasse,
  textesSuivis,
  versionDeRecherche,
} from "../veille/sources/legi.ts";
import { resetUsage } from "../veille/piste.ts";
import { passeTextesFr } from "../veille/textes-fr.ts";
import type { DescripteurTextesFr } from "../mcp/corpus/textes-fr/parse.ts";
import { syncLil } from "../mcp/corpus/lil/sync.ts";
import { syncTextesFr } from "../mcp/corpus/textes-fr/sync.ts";
import { syncCorpus } from "../mcp/corpus/sync.ts";
import type { AgentSync } from "../mcp/corpus/sync.ts";
import { formaterRapport } from "../mcp/corpus/sync-rapport.ts";
import { lireLectures } from "../mcp/corpus/lectures.ts";
import { corpusDeLEntree, documentsDeLEntree } from "../mcp/corpus/veille.ts";
import type { Unite } from "../mcp/corpus/parse.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { normaliser } from "../mcp/embed/embedder.ts";
import { reponseParCorps, reponsesSynthetiques } from "./fixtures/textes-fr/synthetiques.ts";

const fixture = (chemin: string): unknown =>
  JSON.parse(readFileSync(new URL(chemin, import.meta.url), "utf8"));

const LIL = fixture("./fixtures/lil/legi-part.json");
const DECRET = fixture("./fixtures/textes-fr/decret.json");
const PENAL = fixture("./fixtures/textes-fr/code-penal.json");
const CPCE = fixture("./fixtures/textes-fr/cpce.json");
const DECRET_RECHERCHE = fixture("./fixtures/legi/decret-recherche.json");
/** La réponse brute `data/raw/89/891668c1….json` réduite aux identifiants, dans son ordre réel. */
const DECRET_RECHERCHE_MELANGEE = fixture("./fixtures/legi/decret-recherche-melangee.json");

const LIL_DOC = "LEGITEXT000006068624";
const DECRET_DOC = "LEGITEXT000038567662";
const PENAL_DOC = "LEGITEXT000006070719";
const CPCE_DOC = "LEGITEXT000006070987";
const TRAVAIL_DOC = "LEGITEXT000006072050";

const CONFIG = { clientId: "client", clientSecret: "secret", keyId: "key" };
const DATE = "2026-11-14";

const DESCRIPTEUR_REEL = JSON.parse(
  readFileSync(new URL("../mcp/corpus/textes-fr/descripteur.json", import.meta.url), "utf8"),
) as DescripteurTextesFr;

/** Les trois captures réelles ; les autres entrées reçoivent leur réponse synthétique. */
const REPONSES_TEXTES = reponsesSynthetiques(DESCRIPTEUR_REEL, {
  "decret-2019-536": DECRET,
  "code-penal-226-16": PENAL,
  "cpce-l34-5": CPCE,
});

const REPONSES_INCHANGEES: Readonly<Record<string, unknown>> = {
  lil: LIL,
  ...REPONSES_TEXTES,
  // La veille compare le décret par sa version consolidée, pas par son texte entier.
  "decret-2019-536": DECRET_RECHERCHE,
};

/** Nombre d'articles d'une réponse réduite : 2 pour une section, toute la liste sinon. */
function compteReduit(texte: DescripteurTextesFr["textes"][number]): number {
  const route = texte.route;
  if (route.type === "articles") return route.nums.length;
  if (route.type === "codeArticles") return route.sections.reduce((total, section) => total + section.nums.length, 0);
  if (route.type === "code") return new Set([route.premier, route.dernier]).size;
  if (route.type === "legiPart") return 2;
  return 1;
}

/** Le descripteur réel, aux comptes des captures réduites et synthétiques. */
function descripteurReduit(root: string): string {
  const descripteur: DescripteurTextesFr = {
    ...DESCRIPTEUR_REEL,
    textes: DESCRIPTEUR_REEL.textes.map((texte) => ({ ...texte, attendus: { articles: compteReduit(texte) } })),
  };
  const chemin = join(root, "descripteur.json");
  writeFileSync(chemin, JSON.stringify(descripteur), "utf8");
  return chemin;
}

/** Racine temporaire portant le corpus des captures réduites (lil + textes_fr). */
async function racineCorpus(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "vitrine-legi-"));
  await syncLil({ rootDir: root, reponse: LIL, date: "2026-11-09", attendus: { sections: 3, articles: 4 } });
  await syncTextesFr({
    rootDir: root,
    descripteurPath: descripteurReduit(root),
    date: DATE,
    reponses: REPONSES_TEXTES,
    config: null,
  });
  return root;
}

/**
 * `fetch` simulé qui répond à chaque route PISTE depuis les réponses fournies :
 * `legiPart` pour la LIL, `LODA_DATE` pour le décret, `code` et
 * `getArticleWithIdAndNum` pour les autres entrées.
 */
function fetchDesReponses(
  appels: string[],
  reponses: Readonly<Record<string, unknown>> = REPONSES_INCHANGEES,
): FetchLike {
  return async (url, init) => {
    appels.push(url);
    if (url.includes("oauth")) return response(200, { access_token: "t", expires_in: 3600 });
    const corps = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
    if (url.endsWith("/legiPart")) return response(200, LIL);
    if (url.endsWith("/search")) return response(200, DECRET_RECHERCHE);
    const trouve = reponseParCorps(DESCRIPTEUR_REEL, reponses, corps);
    if (trouve === null || trouve === undefined) throw new Error(`appel inattendu : ${url} ${String(init?.body)}`);
    return response(200, trouve);
  };
}

/** Le premier article portant ce numéro, où qu'il soit dans l'arbre. */
function articleNumero(valeur: unknown, numero: string): Record<string, unknown> | null {
  if (Array.isArray(valeur)) {
    for (const element of valeur) {
      const trouve = articleNumero(element, numero);
      if (trouve !== null) return trouve;
    }
    return null;
  }
  if (typeof valeur !== "object" || valeur === null) return null;
  const objet = valeur as Record<string, unknown>;
  if (objet.num === numero && typeof objet.id === "string") return objet;
  for (const contenu of Object.values(objet)) {
    const trouve = articleNumero(contenu, numero);
    if (trouve !== null) return trouve;
  }
  return null;
}

function copie(valeur: unknown): Record<string, unknown> {
  return structuredClone(valeur) as Record<string, unknown>;
}

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

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

const INERTE: AgentSync = async () => ({ ecrit: false, message: "inactif" });

function agentFactice(action?: () => void): { agent: AgentSync; appels: { n: number } } {
  const appels = { n: 0 };
  return {
    appels,
    agent: async () => {
      appels.n += 1;
      action?.();
      return { ecrit: true, message: "agent factice" };
    },
  };
}

function ajouterUnite(root: string, corpus: string, unite: Unite): void {
  const chemin = join(root, "data", "corpus", corpus, "unites.jsonl");
  writeFileSync(chemin, `${readFileSync(chemin, "utf8")}${JSON.stringify(unite)}\n`, "utf8");
}

function uniteArticle(ref: string, document: string, numero: string, corpus: "lil" | "textes_fr"): Unite {
  return {
    ref,
    document,
    corpus,
    niveau: "article",
    numero,
    chemin: `${document} > ${numero}`,
    texte: "Texte de l'article.",
    date_acte: "2026-11-01",
    date_debut: "2026-11-01",
    date_fin: null,
    statut: "VIGUEUR",
    url: `https://www.legifrance.gouv.fr/codes/article_lc/${ref}`,
  };
}

function entreeLegi(document: string, version: string, numero: string): Entry {
  return {
    id: `legi-${document}-${numero}-${version}`,
    title: `Nouvelle version de l'article ${numero}`,
    officialTitle: document,
    url: "https://www.legifrance.gouv.fr/",
    publishedAt: "2026-11-10T12:00:00.000Z",
    summary: null,
    references: [],
    themes: ["donnees-personnelles"],
    source: SOURCE_ID,
    document,
    version,
  };
}

function ecrireEntree(root: string, entry: Entry): void {
  const dossier = join(root, "data", "entries", "2026", "11");
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, `${entry.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

describe("la détection des versions des textes français", () => {
  it("ne produit aucune entrée quand les identifiants de version sont inchangés", async () => {
    const root = await racineCorpus();
    try {
      const resultat = await passeTextesFr({ rootDir: root, date: DATE, reponses: REPONSES_INCHANGEES, config: null });
      assert.deepEqual(resultat.entrees, []);
      assert.deepEqual(resultat.echecs, []);
      assert.equal(resultat.appels, 0);
      assert.equal(resultat.ecrit, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publie une entrée pour une nouvelle version d'article du Code pénal", async () => {
    const root = await racineCorpus();
    try {
      const penal = copie(PENAL);
      const article = articleNumero(penal, "226-16");
      assert.ok(article !== null);
      article.id = "LEGIARTI000099999999";
      article.dateDebut = "2026-11-01";

      const resultat = await passeTextesFr({
        rootDir: root,
        date: DATE,
        reponses: { ...REPONSES_INCHANGEES, "code-penal-226-16": penal },
        config: null,
      });

      assert.equal(resultat.entrees.length, 1);
      const [entree] = resultat.entrees;
      assert.ok(entree !== undefined);
      assert.equal(entree.source, "legi");
      assert.equal(entree.document, PENAL_DOC);
      assert.equal(entree.version, "LEGIARTI000099999999");
      assert.equal(entree.title, "Code pénal, art. 226-16 : nouvelle version en vigueur au 01/11/2026");
      assert.equal(entree.url, "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000099999999");
      assert.equal(entree.publishedAt, "2026-11-14T12:00:00.000Z");
      assert.deepEqual(entree.themes, ["donnees-personnelles"]);
      assert.equal(resultat.ecrit, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("suit la loi 78-17 article par article", async () => {
    const root = await racineCorpus();
    try {
      const lil = copie(LIL);
      const article = articleNumero(lil, "115");
      assert.ok(article !== null);
      article.id = "LEGIARTI000099999998";
      article.dateDebut = "2026-10-01";

      const resultat = await passeTextesFr({
        rootDir: root,
        date: DATE,
        reponses: { ...REPONSES_INCHANGEES, lil },
        config: null,
      });

      assert.equal(resultat.entrees.length, 1);
      assert.equal(resultat.entrees[0]?.document, LIL_DOC);
      assert.equal(resultat.entrees[0]?.version, "LEGIARTI000099999998");
      assert.equal(resultat.entrees[0]?.title, "LIL, art. 115 : nouvelle version en vigueur au 01/10/2026");
      assert.equal(resultat.entrees[0]?.url, "https://www.legifrance.gouv.fr/loda/id/LEGIARTI000099999998");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("compare le décret par son identifiant consolidé", async () => {
    const root = await racineCorpus();
    try {
      const recherche = {
        totalResultNumber: 1,
        results: [{ titles: [{ id: "LEGITEXT000038567662_01-01-2026" }] }],
      };
      const resultat = await passeTextesFr({
        rootDir: root,
        date: DATE,
        reponses: { ...REPONSES_INCHANGEES, "decret-2019-536": recherche },
        config: null,
      });

      assert.equal(resultat.entrees.length, 1);
      assert.equal(resultat.entrees[0]?.document, DECRET_DOC);
      assert.equal(resultat.entrees[0]?.version, "LEGITEXT000038567662_01-01-2026");
      assert.equal(resultat.entrees[0]?.title, "Décret 2019-536 : nouvelle version en vigueur au 01/01/2026");
      assert.equal(resultat.entrees[0]?.publishedAt, "2026-11-14T12:00:00.000Z");
      assert.equal(resultat.entrees[0]?.url, "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000038567662");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne signale plus le décret périmé sur la réponse réelle mélangée", async () => {
    const root = await racineCorpus();
    try {
      const resultat = await passeTextesFr({
        rootDir: root,
        date: DATE,
        reponses: { ...REPONSES_INCHANGEES, "decret-2019-536": DECRET_RECHERCHE_MELANGEE },
        config: null,
      });

      assert.deepEqual(resultat.entrees, []);
      assert.deepEqual(resultat.echecs, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("signale un article retiré de la version en vigueur", async () => {
    const root = await racineCorpus();
    try {
      const penal = copie(PENAL);
      penal.id = "LEGITEXT000006070719_01-01-2027";
      penal.dateDebutVersion = "2027-01-01";
      // La section cible est imbriquée : retirer 226-24 de l'arbre entier.
      const retirer = (valeur: unknown): void => {
        if (Array.isArray(valeur)) {
          valeur.splice(
            0,
            valeur.length,
            ...valeur.filter((element) => (element as { num?: unknown }).num !== "226-24"),
          );
          for (const element of valeur) retirer(element);
          return;
        }
        if (typeof valeur !== "object" || valeur === null) return;
        for (const contenu of Object.values(valeur as Record<string, unknown>)) retirer(contenu);
      };
      retirer(penal);
      assert.equal(articleNumero(penal, "226-24"), null);

      const resultat = await passeTextesFr({
        rootDir: root,
        date: DATE,
        reponses: { ...REPONSES_INCHANGEES, "code-penal-226-16": penal },
        config: null,
      });

      assert.equal(resultat.entrees.length, 1);
      assert.equal(
        resultat.entrees[0]?.title,
        "Code pénal, art. 226-24 : article retiré de la version en vigueur au 01/01/2027",
      );
      assert.equal(resultat.entrees[0]?.version, "LEGITEXT000006070719_01-01-2027");
      assert.equal(resultat.entrees[0]?.url, "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070719/LEGISCTA000006165313/");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("suit chaque bloc d'un même code sans retrait dans les autres", async () => {
    const root = await racineCorpus();
    try {
      // L'état du corpus est par clé de bloc : les trois blocs du Code pénal et les trois du CPCE.
      const etats = etatsCorpus(root);
      const penal226 = etats.get("code-penal-226");
      const penal323 = etats.get("code-penal-323");
      assert.deepEqual([...(penal226?.articles.keys() ?? [])], ["226-1", "226-8-1", "226-13"]);
      assert.deepEqual([...(penal323?.articles.keys() ?? [])], ["323-1", "323-8"]);
      assert.equal(penal226?.document, PENAL_DOC);
      assert.deepEqual([...(etats.get("cpce-l34-1")?.articles.keys() ?? [])], ["L34-1"]);

      const reponse = structuredClone(REPONSES_INCHANGEES["code-penal-226"]) as {
        article: { id: string; dateDebut: string };
      }[];
      const premier = reponse[0];
      assert.ok(premier !== undefined);
      premier.article.id = "LEGIARTI000099999997";
      premier.article.dateDebut = "2026-11-01";

      const resultat = await passeTextesFr({
        rootDir: root,
        date: DATE,
        reponses: { ...REPONSES_INCHANGEES, "code-penal-226": reponse },
        config: null,
      });

      // Une seule version nouvelle : les articles des deux autres blocs ne sont pas « retirés ».
      assert.deepEqual(
        resultat.entrees.map((entree) => entree.title),
        ["Code pénal, art. 226-1 : nouvelle version en vigueur au 01/11/2026"],
      );
      assert.deepEqual(resultat.echecs, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("consomme le budget PISTE calculé sur les entrées, jeton compris", async () => {
    const root = await racineCorpus();
    resetUsage();
    try {
      const appels: string[] = [];
      const resultat = await passeTextesFr({
        rootDir: root,
        date: DATE,
        config: CONFIG,
        fetchImpl: fetchDesReponses(appels),
      });
      // Un jeton, la loi 78-17, puis un appel par entrée et par numéro de liste.
      assert.equal(appels.length, 53);
      assert.equal(resultat.appels, 53);
      // 1 jeton + 52 appels + 5 de marge.
      assert.equal(maxCallsPasse(), 58);
      assert.equal(textesSuivis().length, 41);
      assert.deepEqual(resultat.echecs, []);
    } finally {
      resetUsage();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("nomme une entrée en panne sans empêcher les autres comparaisons", async () => {
    const root = await racineCorpus();
    resetUsage();
    try {
      const fetchImpl: FetchLike = async (url, init) => {
        if (url.includes("oauth")) return response(200, { access_token: "t", expires_in: 3600 });
        if (url.endsWith("/code")) return response(500, {});
        const corps = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
        if (url.endsWith("/legiPart")) return response(200, LIL);
        if (url.endsWith("/search")) return response(200, DECRET_RECHERCHE);
        const trouve = reponseParCorps(DESCRIPTEUR_REEL, REPONSES_INCHANGEES, corps);
        if (trouve === null || trouve === undefined) throw new Error(`appel inattendu : ${url}`);
        return response(200, trouve);
      };

      const resultat = await passeTextesFr({ rootDir: root, date: DATE, config: CONFIG, fetchImpl });
      assert.equal(resultat.entrees.length, 0);
      // Chaque entrée qui lit une section de code échoue, sans empêcher les autres.
      assert.equal(resultat.echecs.length, 26);
      assert.match(resultat.echecs[0] ?? "", /Code pénal : Légifrance code: HTTP 500/);
      assert.equal(resultat.appels, 53);
    } finally {
      resetUsage();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("note la lecture réussie de legi, et pas une passe où un texte a échoué", async () => {
    const root = await racineCorpus();
    try {
      await passeTextesFr({
        rootDir: root,
        date: DATE,
        reponses: REPONSES_INCHANGEES,
        config: null,
      });
      assert.deepEqual([...lireLectures(root).entries()], [["legi", DATE]]);

      const partiel = { ...REPONSES_INCHANGEES };
      delete (partiel as Record<string, unknown>)[textesSuivis()[0]?.cle ?? ""];
      const resultat = await passeTextesFr({
        rootDir: root,
        date: "2026-11-12",
        reponses: partiel,
        config: CONFIG,
        fetchImpl: async () => ({ ok: false, status: 500, text: async () => "" }),
      });
      assert.ok(resultat.echecs.length > 0);
      assert.equal(lireLectures(root).get("legi"), DATE);
    } finally {
      resetUsage();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse de conclure quand le corpus du texte est absent", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-legi-"));
    try {
      const resultat = await passeTextesFr({ rootDir: root, date: DATE, reponses: REPONSES_INCHANGEES, config: null });
      assert.equal(resultat.entrees.length, 0);
      assert.equal(resultat.echecs.length, 41);
      assert.match(resultat.echecs[0] ?? "", /corpus LEGITEXT000006068624 absent/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lit la date d'un identifiant de version consolidée", () => {
    assert.equal(dateDeVersionIdentifiant("LEGITEXT000038567662_07-09-2025"), "2025-09-07");
    assert.equal(dateDeVersionIdentifiant("LEGIARTI000042155961"), null);
    assert.equal(dateDeVersionIdentifiant("LEGITEXT000038567662_31-02-2025"), null);
    assert.equal(textesSuivis().length, 41);
  });

  it("retient la version la plus récente sans dépasser la passe, quel que soit l'ordre", () => {
    const lue = versionDeRecherche(DECRET_RECHERCHE_MELANGEE, DECRET_DOC, DATE);
    assert.equal(lue.version, "LEGITEXT000038567662_07-09-2025");
    assert.equal(lue.dateDebut, "2025-09-07");

    const resultat = versionDeRecherche(
      {
        results: [
          { titles: [{ id: "LEGITEXT000038567662_26-08-2026" }] },
          { titles: [{ id: "LEGITEXT000038567662_07-09-2025" }] },
        ],
      },
      DECRET_DOC,
      "2025-12-31",
    );
    assert.equal(resultat.version, "LEGITEXT000038567662_07-09-2025");

    // Une version datée du jour même de la passe est admissible : le filtre est
    // `≤`, pas `<`.
    const egalite = versionDeRecherche(
      {
        results: [
          { titles: [{ id: "LEGITEXT000038567662_07-09-2025" }] },
          { titles: [{ id: "LEGITEXT000038567662_24-04-2025" }] },
        ],
      },
      DECRET_DOC,
      "2025-04-24",
    );
    assert.equal(egalite.version, "LEGITEXT000038567662_24-04-2025");

    // Un identifiant sans date et un texte dont le préfixe allonge le nôtre sont écartés.
    assert.throws(
      () =>
        versionDeRecherche(
          {
            results: [
              { titles: [{ id: "LEGITEXT000038567662" }] },
              { titles: [{ id: "LEGITEXT0000385676621_07-09-2025" }] },
            ],
          },
          DECRET_DOC,
          DATE,
        ),
      /Réponse search sans version consolidée de LEGITEXT000038567662/,
    );
  });

  it("refuse une recherche sans version admissible", () => {
    assert.throws(
      () =>
        versionDeRecherche(
          {
            results: [
              { titles: [{ id: "LEGITEXT000038567662_26-08-2026" }] },
              { titles: [{ id: "LEGITEXT000006070719_01-01-2020" }] },
            ],
          },
          DECRET_DOC,
          "2025-12-31",
        ),
      /Réponse search sans version consolidée de LEGITEXT000038567662/,
    );
  });

  it("demande toutes les versions à la recherche LODA", () => {
    const corps = corpsRechercheLoda("LODA_DATE", "2019-536") as {
      recherche: { pageSize: number };
    };
    assert.equal(corps.recherche.pageSize, 100);
  });
});

describe("la correspondance des entrées legi avec le corpus", () => {
  it("range chaque texte dans son corpus et lit son identifiant de document", () => {
    assert.equal(corpusDeLEntree({ source: "legi", document: LIL_DOC }), "lil");
    assert.equal(corpusDeLEntree({ source: "legi", document: PENAL_DOC }), "textes_fr");
    assert.equal(corpusDeLEntree({ source: "legi", document: DECRET_DOC }), "textes_fr");
    assert.equal(corpusDeLEntree({ source: "legi", document: "inconnu" }), null);
    assert.equal(corpusDeLEntree({ source: "legi" }), null);
    assert.deepEqual(
      documentsDeLEntree({ source: "legi", id: "x", url: "", document: PENAL_DOC }, new Map()),
      [PENAL_DOC],
    );
    assert.deepEqual(documentsDeLEntree({ source: "legi", id: "x", url: "" }, new Map()), []);
  });

  it("relance la synchronisation des textes français pour une version périmée", async () => {
    const root = await racineCorpus();
    try {
      const nouvelle = "LEGIARTI000099999999";
      ecrireEntree(root, entreeLegi(PENAL_DOC, nouvelle, "226-16"));
      const textesFr = agentFactice(() =>
        ajouterUnite(root, "textes_fr", uniteArticle(nouvelle, PENAL_DOC, "226-16", "textes_fr")),
      );
      const lil = agentFactice();

      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: {
          cnil: INERTE,
          ce: INERTE,
          cc: INERTE,
          cjue: INERTE,
          lil: lil.agent,
          textes_fr: textesFr.agent,
        },
        embedder: embedderFactice(),
      });

      assert.equal(textesFr.appels.n, 1);
      assert.equal(lil.appels.n, 0);
      assert.equal(rapport.comptes.perimes, 0);
      assert.equal(rapport.comptes.presents, 1);
      assert.equal(rapport.documents[0]?.statut, "present");
      assert.equal(rapport.a_jour_au, "2026-11-11");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("relance la synchronisation LIL pour une version périmée", async () => {
    const root = await racineCorpus();
    try {
      const nouvelle = "LEGIARTI000099999998";
      ecrireEntree(root, entreeLegi(LIL_DOC, nouvelle, "115"));
      const lil = agentFactice(() =>
        ajouterUnite(root, "lil", uniteArticle(nouvelle, LIL_DOC, "115", "lil")),
      );
      const textesFr = agentFactice();

      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: {
          cnil: INERTE,
          ce: INERTE,
          cc: INERTE,
          cjue: INERTE,
          lil: lil.agent,
          textes_fr: textesFr.agent,
        },
        embedder: embedderFactice(),
      });

      assert.equal(lil.appels.n, 1);
      assert.equal(textesFr.appels.n, 0);
      assert.equal(rapport.comptes.presents, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne relance rien quand la version est déjà au corpus", async () => {
    const root = await racineCorpus();
    try {
      const unites = readFileSync(join(root, "data", "corpus", "textes_fr", "unites.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((ligne) => JSON.parse(ligne) as Unite);
      const penal = unites.find((unite) => unite.numero === "226-16");
      assert.ok(penal !== undefined);
      ecrireEntree(root, entreeLegi(PENAL_DOC, penal.ref, "226-16"));
      const textesFr = agentFactice();

      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: {
          cnil: INERTE,
          ce: INERTE,
          cc: INERTE,
          cjue: INERTE,
          lil: INERTE,
          textes_fr: textesFr.agent,
        },
        embedder: embedderFactice(),
      });

      assert.equal(textesFr.appels.n, 0);
      assert.equal(rapport.comptes.presents, 1);
      assert.equal(rapport.sources.every((source) => source.statut === "ignoree"), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'avance pas la fraîcheur quand la synchronisation du texte échoue", async () => {
    const root = await racineCorpus();
    try {
      ecrireEntree(root, entreeLegi(PENAL_DOC, "LEGIARTI000099999999", "226-16"));
      const panne: AgentSync = async () => {
        throw new Error("HTTP 500");
      };

      const rapport = await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: {
          cnil: INERTE,
          ce: INERTE,
          cc: INERTE,
          cjue: INERTE,
          lil: INERTE,
          textes_fr: panne,
        },
        embedder: embedderFactice(),
      });

      assert.equal(rapport.a_jour_au, null);
      assert.equal(rapport.comptes.perimes, 1);
      assert.equal(rapport.sources.find((source) => source.source === "textes_fr")?.statut, "panne");
      assert.match(formaterRapport(rapport), /Périmés :/);
      assert.match(formaterRapport(rapport), /version du corpus antérieure/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("garde une version périmée après la fenêtre tant qu'elle n'entre pas au corpus", async () => {
    const root = await racineCorpus();
    try {
      const nouvelle = "LEGIARTI000099999999";
      ecrireEntree(root, entreeLegi(PENAL_DOC, nouvelle, "226-16"));

      await syncCorpus({
        rootDir: root,
        date: "2026-11-11",
        depuis: "2026-11-01",
        agents: {
          cnil: INERTE,
          ce: INERTE,
          cc: INERTE,
          cjue: INERTE,
          lil: INERTE,
          textes_fr: INERTE,
        },
        embedder: embedderFactice(),
      });

      const seconde = await syncCorpus({
        rootDir: root,
        date: "2026-11-20",
        agents: {
          cnil: INERTE,
          ce: INERTE,
          cc: INERTE,
          cjue: INERTE,
          lil: INERTE,
          textes_fr: INERTE,
        },
        embedder: embedderFactice(),
      });

      assert.equal(seconde.entrees_lues, 0);
      assert.equal(seconde.comptes.perimes, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
