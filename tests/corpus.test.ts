import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildCorpus, buildCorpusSet, lireDescripteurs } from "../mcp/corpus/build.ts";
import { fetchCellar } from "../mcp/corpus/fetch.ts";
import { parseCellar, parseRgpd, texteVisible } from "../mcp/corpus/parse.ts";
import type { Descripteur } from "../mcp/corpus/parse.ts";
import type { FetchInit, FetchLike } from "../veille/fetch.ts";

const FIXTURE_URL = new URL("./fixtures/eurlex/rgpd.xhtml", import.meta.url);
const FIXTURE = readFileSync(FIXTURE_URL, "utf8");
const FIXTURE_PATH = fileURLToPath(FIXTURE_URL);
const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/rgpd.json", import.meta.url), "utf8"),
) as Descripteur;

const FIXTURE_AIAct_URL = new URL("./fixtures/eurlex/aiact.xhtml", import.meta.url);
const FIXTURE_AIAct = readFileSync(FIXTURE_AIAct_URL, "utf8");
const FIXTURE_AIAct_PATH = fileURLToPath(FIXTURE_AIAct_URL);
const DESCRIPTEUR_AIAct = JSON.parse(
  readFileSync(new URL("../mcp/corpus/aiact.json", import.meta.url), "utf8"),
) as Descripteur;

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "vitrine-corpus-"));
}

/** Liste récursive des fichiers, en chemins relatifs à la racine. */
function listFiles(root: string, prefix = ""): string[] {
  const fichiers: string[] = [];
  for (const entree of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const chemin = join(prefix, entree.name);
    if (entree.isDirectory()) fichiers.push(...listFiles(root, chemin));
    else fichiers.push(chemin);
  }
  return fichiers.sort();
}

describe("fetchCellar", () => {
  it("demande le XHTML en français et rend le corps", async () => {
    let url = "";
    let init: FetchInit | undefined;
    const fetchImpl: FetchLike = async (demande, options) => {
      url = demande;
      init = options;
      return { ok: true, status: 200, text: async () => FIXTURE };
    };

    const corps = await fetchCellar("32016R0679", "fra", fetchImpl);

    assert.equal(corps, FIXTURE);
    assert.equal(url, "https://publications.europa.eu/resource/celex/32016R0679");
    assert.equal(init?.headers?.Accept, "application/xhtml+xml");
    assert.equal(init?.headers?.["Accept-Language"], "fra");
  });

  it("lève sur un statut non 2xx", async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 400, text: async () => "" });

    await assert.rejects(fetchCellar("32016R0679", "fra", fetchImpl), /HTTP 400/);
  });
});

describe("parseRgpd", () => {
  const unites = parseRgpd(FIXTURE, DESCRIPTEUR);

  it("rend 99 articles et 173 considérants", () => {
    assert.equal(unites.filter((unite) => unite.niveau === "article").length, 99);
    assert.equal(unites.filter((unite) => unite.niveau === "considérant").length, 173);
    assert.equal(unites.length, 272);
    assert.equal(new Set(unites.map((unite) => unite.ref)).size, 272);
  });

  it("remplit l'article 17 et nomme son chapitre", () => {
    const article17 = unites.find((unite) => unite.ref === "32016R0679#art_17");
    assert.ok(article17);
    assert.equal(article17.niveau, "article");
    assert.equal(article17.numero, "17");
    assert.match(article17.texte, /effacement/);
    assert.match(article17.chemin, /Chapitre III/);
  });

  it("range les considérants sous le nom de l'acte", () => {
    const considerant = unites.find((unite) => unite.ref === "32016R0679#rct_1");
    assert.ok(considerant);
    assert.equal(considerant.chemin, "RGPD > Considérants");
    assert.match(considerant.texte, /^\(1\) La protection des personnes physiques/);
  });

  it("copie les dates et le statut du descripteur", () => {
    const article = unites.find((unite) => unite.ref === "32016R0679#art_1");
    assert.ok(article);
    assert.equal(article.date_acte, "2016-04-27");
    assert.equal(article.date_debut, "2018-05-25");
    assert.equal(article.date_fin, null);
    assert.equal(article.statut, "en_vigueur");
    assert.equal(article.url, `${DESCRIPTEUR.url}#art_1`);
  });

  it("nomme le corpus sur chaque unité", () => {
    assert.ok(unites.every((unite) => unite.corpus === "rgpd"));
  });

  it("lève en nommant l'ancre absente", () => {
    const ampute = FIXTURE.replace('id="art_17"', 'id="art_inconnu"');

    assert.throws(() => parseRgpd(ampute, DESCRIPTEUR), /art_17 absente/);
  });

  it("normalise les espaces sans réécrire les mots", () => {
    assert.equal(texteVisible("<p>l’article   17</p>"), "l’article 17");
    assert.equal(texteVisible("<p>européenne .</p>"), "européenne.");
  });
});

describe("buildCorpus", () => {
  it("écrit le snapshot, le manifeste et 272 unités", async () => {
    const root = tempRoot();
    try {
      const resultat = await buildCorpus({ rootDir: root, fixturePath: FIXTURE_PATH });

      assert.equal(resultat.unites.length, 272);
      const manifeste = JSON.parse(readFileSync(resultat.manifestPath, "utf8")) as Record<string, unknown>;
      assert.deepEqual(
        {
          document: manifeste.document,
          langue: manifeste.langue,
          url: manifeste.url,
          date_acte: manifeste.date_acte,
          date_publication: manifeste.date_publication,
          date_debut: manifeste.date_debut,
          unites: manifeste.unites,
        },
        {
          document: "32016R0679",
          langue: "fra",
          url: DESCRIPTEUR.url,
          date_acte: "2016-04-27",
          date_publication: "2016-05-04",
          date_debut: "2018-05-25",
          unites: 272,
        },
      );

      const lignes = readFileSync(resultat.unitesPath, "utf8").trimEnd().split("\n");
      assert.equal(lignes.length, 272);
      assert.ok(lignes.some((ligne) => (JSON.parse(ligne) as { ref: string }).ref === "32016R0679#art_17"));

      const hash = createHash("sha256").update(readFileSync(resultat.snapshotPath)).digest("hex");
      assert.equal(basename(resultat.snapshotPath), `${hash}.xhtml`);
      assert.equal(manifeste.snapshot, `${hash}.xhtml`);
      assert.equal(manifeste.date_fin, null);
      assert.equal(manifeste.statut, "en_vigueur");
      const couverture = manifeste.couverture as Record<string, unknown>;
      assert.equal(couverture.source, "CELLAR — publications.europa.eu/resource/celex/32016R0679");
      assert.deepEqual(couverture.bornes, { debut: "2018-05-25", fin: null });
      assert.deepEqual(couverture.types_retenus, ["article", "considérant"]);
      assert.deepEqual(couverture.comptes, { articles: 99, considerants: 173 });
      assert.deepEqual(couverture.exclusions, []);
      assert.ok(resultat.snapshotPath.startsWith(join(root, "data", "raw")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend les mêmes octets à la seconde passe", async () => {
    const root = tempRoot();
    try {
      await buildCorpus({ rootDir: root, fixturePath: FIXTURE_PATH });
      const avant = listFiles(root).map((fichier) => join(root, fichier));
      const contenus = avant.map((fichier) => readFileSync(fichier, "utf8"));
      const dates = avant.map((fichier) => statSync(fichier).mtimeMs);

      await buildCorpus({ rootDir: root, fixturePath: FIXTURE_PATH });

      assert.deepEqual(
        listFiles(root).map((fichier) => join(root, fichier)),
        avant,
      );
      assert.deepEqual(
        avant.map((fichier) => readFileSync(fichier, "utf8")),
        contenus,
      );
      assert.deepEqual(
        avant.map((fichier) => statSync(fichier).mtimeMs),
        dates,
      );
      assert.ok(!avant.some((fichier) => fichier.endsWith(".tmp")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'écrit rien quand la capture est amputée", async () => {
    const root = tempRoot();
    const ampute = join(root, "ampute.xhtml");
    try {
      writeFileSync(ampute, FIXTURE.replace('id="art_17"', 'id="art_inconnu"'), "utf8");

      await assert.rejects(
        buildCorpus({ rootDir: root, fixturePath: ampute }),
        /art_17 absente/,
      );
      assert.equal(existsSync(join(root, "data")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("les descripteurs", () => {
  it("lit le RGPD et l'AI Act avec leurs comptes attendus", () => {
    const descripteurs = lireDescripteurs();
    const rgpd = descripteurs.find((descripteur) => descripteur.corpus === "rgpd");
    const aiact = descripteurs.find((descripteur) => descripteur.corpus === "aiact");

    assert.equal(descripteurs.length, 2);
    assert.deepEqual(
      { articles: rgpd?.articles_attendus, considerants: rgpd?.considerants_attendus },
      { articles: 99, considerants: 173 },
    );
    assert.deepEqual(
      {
        document: aiact?.document,
        nom: aiact?.nom,
        articles: aiact?.articles_attendus,
        considerants: aiact?.considerants_attendus,
        date_acte: aiact?.date_acte,
        date_publication: aiact?.date_publication,
        date_debut: aiact?.date_debut,
      },
      {
        document: "32024R1689",
        nom: "AI Act",
        articles: 113,
        considerants: 180,
        date_acte: "2024-06-13",
        date_publication: "2024-07-12",
        date_debut: "2024-08-01",
      },
    );
  });
});

describe("parseCellar sur l'AI Act", () => {
  const unites = parseCellar(FIXTURE_AIAct, DESCRIPTEUR_AIAct);

  it("rend 113 articles et 180 considérants", () => {
    assert.equal(unites.filter((unite) => unite.niveau === "article").length, 113);
    assert.equal(unites.filter((unite) => unite.niveau === "considérant").length, 180);
    assert.equal(unites.length, 293);
    assert.equal(new Set(unites.map((unite) => unite.ref)).size, 293);
  });

  it("remplit l'article 1 et nomme le chapitre I", () => {
    const article1 = unites.find((unite) => unite.ref === "32024R1689#art_1");

    assert.ok(article1);
    assert.equal(article1.niveau, "article");
    assert.equal(article1.numero, "1");
    assert.ok(article1.texte.length > 0);
    assert.match(article1.chemin, /^AI Act > Chapitre I/);
  });

  it("range les considérants sous le nom de l'acte", () => {
    const considerant = unites.find((unite) => unite.ref === "32024R1689#rct_1");

    assert.ok(considerant);
    assert.equal(considerant.chemin, "AI Act > Considérants");
    assert.ok(considerant.texte.startsWith("(1)"));
  });

  it("nomme le corpus sur chaque unité", () => {
    assert.ok(unites.every((unite) => unite.corpus === "aiact"));
  });

  it("copie les trois dates et le statut du descripteur", () => {
    const article = unites.find((unite) => unite.ref === "32024R1689#art_113");

    assert.ok(article);
    assert.equal(article.date_acte, "2024-06-13");
    assert.equal(article.date_debut, "2024-08-01");
    assert.equal(article.date_fin, null);
    assert.equal(article.statut, "en_vigueur");
    assert.equal(article.url, `${DESCRIPTEUR_AIAct.url}#art_113`);
  });
});

describe("les comptes du descripteur", () => {
  it("lève quand un article manque en nommant le document et le compte", () => {
    assert.throws(
      () => parseCellar(FIXTURE, { ...DESCRIPTEUR, articles_attendus: 100 }),
      /Capture 32016R0679 incomplète : ancre art_100 absente \(99 articles au lieu de 100\)/,
    );
  });

  it("lève quand le descripteur annonce trop peu d'articles", () => {
    assert.throws(
      () => parseCellar(FIXTURE, { ...DESCRIPTEUR, articles_attendus: 98 }),
      /Capture 32016R0679 : 99 articles au lieu de 98 attendus/,
    );
  });

  it("lève quand un considérant manque en nommant le compte", () => {
    assert.throws(
      () => parseCellar(FIXTURE, { ...DESCRIPTEUR, considerants_attendus: 174 }),
      /Capture 32016R0679 incomplète : ancre rct_174 absente \(173 considérants au lieu de 174\)/,
    );
  });
});

describe("buildCorpusSet", () => {
  it("ne construit que le corpus demandé", async () => {
    const root = tempRoot();
    try {
      const resultats = await buildCorpusSet({
        rootDir: root,
        document: "aiact",
        fixturePath: FIXTURE_AIAct_PATH,
      });

      assert.equal(resultats.length, 1);
      assert.equal(resultats[0]?.unites.length, 293);
      assert.ok(existsSync(join(root, "data", "corpus", "aiact", "unites.jsonl")));
      assert.equal(existsSync(join(root, "data", "corpus", "rgpd")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("nomme les corpus disponibles quand le document est inconnu", async () => {
    const root = tempRoot();
    try {
      await assert.rejects(
        buildCorpusSet({ rootDir: root, document: "lil" }),
        /Aucun descripteur pour « lil » : aiact, rgpd/,
      );
      assert.equal(existsSync(join(root, "data")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
