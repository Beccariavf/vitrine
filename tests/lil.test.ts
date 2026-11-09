import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { lireLegiPart, unitesLil, validerCapture } from "../mcp/corpus/lil/parse.ts";
import type { DescripteurLil, LegiPart } from "../mcp/corpus/lil/parse.ts";
import { syncLil } from "../mcp/corpus/lil/sync.ts";
import type { ManifesteLil } from "../mcp/corpus/lil/sync.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const BRUT = JSON.parse(
  readFileSync(new URL("./fixtures/lil/legi-part.json", import.meta.url), "utf8"),
) as unknown;
const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/lil/descripteur.json", import.meta.url), "utf8"),
) as DescripteurLil;

const DATE = "2026-11-09";
const ATTENDUS = { sections: 3, articles: 4 };

describe("le parse legiPart", () => {
  const part = lireLegiPart(BRUT);

  it("parcourt les sections récursivement et garde l'ordre du document", () => {
    assert.equal(part.version, "LEGITEXT000006068624_01-10-2026");
    assert.equal(part.dateDebutVersion, "2026-10-01");
    assert.equal(part.sections, 3);
    assert.deepEqual(
      part.articles.map((article) => article.num),
      ["115", "116", "117", "30", "15 bis"],
    );
  });

  it("lit num, id, content, pathTitle et etat de chaque article", () => {
    const article = part.articles.find((element) => element.id === "LEGIARTI000037817715");

    assert.ok(article);
    assert.equal(article.num, "116");
    assert.equal(article.etat, "VIGUEUR");
    assert.equal(article.pathTitle.length, 2);
    assert.match(article.pathTitle[0] ?? "", /^Titre IV/);
    assert.match(article.content, /<p>/);
    assert.equal(article.dateDebut, "2019-06-01");
    assert.equal(article.dateFin, null, "la sentinelle de fin ouverte devient null");
  });

  it("lève sur une réponse sans sections", () => {
    assert.throws(
      () => lireLegiPart({ id: "LEGITEXT000006068624_01-10-2026" }),
      /sans sections/,
    );
    assert.throws(() => lireLegiPart(null), /illisible/);
    assert.throws(() => lireLegiPart({}), /sans identifiant de version/);
  });
});

describe("les unités LIL", () => {
  const part = lireLegiPart(BRUT);
  const { unites, abroges } = unitesLil(part, DESCRIPTEUR);

  it("rend un article en vigueur par unité citable", () => {
    assert.equal(unites.length, 4);
    assert.equal(abroges, 1);

    const premier = unites[0];
    assert.ok(premier);
    assert.equal(premier.ref, "LEGIARTI000037817711");
    assert.equal(premier.document, "LEGITEXT000006068624");
    assert.equal(premier.corpus, "lil");
    assert.equal(premier.niveau, "article");
    assert.equal(premier.numero, "115");
    assert.equal(
      premier.chemin,
      "LIL > Titre IV : Dispositions applicables aux traitements intéressant la sûreté de l'Etat et la défense",
    );
    assert.equal(premier.date_acte, "2019-06-01");
    assert.equal(premier.date_debut, "2019-06-01");
    assert.equal(premier.date_fin, null);
    assert.equal(premier.statut, "VIGUEUR");
    assert.equal(
      premier.url,
      "https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037817711",
    );
  });

  it("nomme la section parente dans le chemin d'un article imbriqué", () => {
    const article = unites.find((unite) => unite.ref === "LEGIARTI000037817715");

    assert.ok(article);
    assert.equal(
      article.chemin,
      "LIL > Titre IV : Dispositions applicables aux traitements intéressant la sûreté de " +
        "l'Etat et la défense > Chapitre Ier : Droits de la personne concernée",
    );
  });

  it("copie le texte sans balise ni entité", () => {
    for (const unite of unites) {
      assert.equal(unite.texte.includes("<"), false, unite.ref);
      assert.equal(unite.texte.includes("&"), false, unite.ref);
      assert.ok(unite.texte.length > 20, unite.ref);
    }
  });

  it("écarte l'article abrogé", () => {
    assert.equal(
      unites.some((unite) => unite.ref === "LEGIARTI000033205694"),
      false,
    );
  });

  it("lève sur un article en vigueur sans content", () => {
    const casse: LegiPart = {
      ...part,
      articles: part.articles.map((article) =>
        article.id === "LEGIARTI000037817711" ? { ...article, content: "" } : article,
      ),
    };

    assert.throws(
      () => unitesLil(casse, DESCRIPTEUR),
      /Article LEGIARTI000037817711 \(115\) sans content/,
    );
  });

  it("refuse une référence dupliquée et des comptes faux", () => {
    assert.throws(
      () => validerCapture(part, [...unites, unites[0]!], ATTENDUS),
      /référence dupliquée : LEGIARTI000037817711/,
    );
    assert.throws(
      () => validerCapture(part, unites, { sections: 3, articles: 133 }),
      /4 articles en vigueur au lieu de 133 attendus/,
    );
    assert.throws(
      () => validerCapture(part, unites, { sections: 50, articles: 4 }),
      /3 sections au lieu de 50 attendues/,
    );
  });
});

describe("la synchronisation LIL", () => {
  const fixture = BRUT;

  it("écrit le snapshot, le corpus et le manifeste, puis ne réécrit rien", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-lil-"));
    try {
      const premier = await syncLil({
        rootDir: root,
        reponse: fixture,
        date: DATE,
        attendus: ATTENDUS,
      });
      const cheminUnites = join(root, "data", "corpus", "lil", "unites.jsonl");
      const cheminManifeste = join(root, "data", "corpus", "lil", "manifest.json");
      const cheminSnapshot = join(root, "data", "raw", "lil", `legi-part-${DATE}.json`);

      assert.equal(premier.ecrit, true);
      assert.equal(premier.unites, 4);
      assert.equal(premier.sections, 3);
      assert.equal(premier.abroges, 1);
      assert.ok(existsSync(cheminUnites));
      assert.ok(existsSync(cheminSnapshot));

      const manifeste = JSON.parse(readFileSync(cheminManifeste, "utf8")) as ManifesteLil;
      assert.equal(manifeste.corpus, "lil");
      assert.equal(manifeste.text_id, "LEGITEXT000006068624");
      assert.equal(manifeste.version, "LEGITEXT000006068624_01-10-2026");
      assert.equal(manifeste.date_consultation, DATE);
      assert.equal(manifeste.date_debut_version, "2026-10-01");
      assert.equal(manifeste.licence, "Licence Ouverte 2.0 (Etalab)");
      assert.equal(manifeste.documents, 1);
      assert.equal(manifeste.unites, 4);
      assert.deepEqual(manifeste.couverture, {
        source: "PISTE — Légifrance /consult/legiPart",
        date: DATE,
        sections: 3,
        articles_en_vigueur: 4,
        articles_abroges_ecartes: 1,
      });
      assert.equal(manifeste.snapshot, `legi-part-${DATE}.json`);
      assert.equal(manifeste.snapshot_sha256.length, 64);

      const avant = statSync(cheminUnites).mtimeMs;
      const avantSnapshot = statSync(cheminSnapshot).mtimeMs;
      const second = await syncLil({
        rootDir: root,
        reponse: fixture,
        date: DATE,
        attendus: ATTENDUS,
      });

      assert.equal(second.ecrit, false);
      assert.equal(statSync(cheminUnites).mtimeMs, avant);
      assert.equal(statSync(cheminSnapshot).mtimeMs, avantSnapshot);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("--dry-run ne crée aucun fichier mais compte", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-lil-"));
    try {
      const resultat = await syncLil({
        rootDir: root,
        reponse: fixture,
        date: DATE,
        attendus: ATTENDUS,
        dryRun: true,
      });

      assert.equal(resultat.ecrit, false);
      assert.equal(resultat.unites, 4);
      assert.equal(existsSync(join(root, "data")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'écrit rien quand la réponse est invalide", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-lil-"));
    const casse = structuredClone(fixture) as {
      sections: { articles: { content: string }[] }[];
    };
    const premier = casse.sections[0]?.articles[0];
    assert.ok(premier);
    premier.content = "";
    try {
      await assert.rejects(
        syncLil({ rootDir: root, reponse: casse, date: DATE, attendus: ATTENDUS }),
        /sans content/,
      );
      assert.equal(existsSync(join(root, "data")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse une date qui n'est pas AAAA-MM-JJ", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-lil-"));
    try {
      await assert.rejects(
        syncLil({ rootDir: root, reponse: fixture, date: "9 novembre 2026" }),
        /Date de consultation attendue AAAA-MM-JJ/,
      );
      assert.equal(existsSync(join(root, "data")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("le corpus commité porte les comptes de son manifeste", () => {
    const manifeste = JSON.parse(
      readFileSync(new URL("../data/corpus/lil/manifest.json", import.meta.url), "utf8"),
    ) as ManifesteLil;
    const unites = readFileSync(
      new URL("../data/corpus/lil/unites.jsonl", import.meta.url),
      "utf8",
    )
      .trimEnd()
      .split("\n")
      .map((ligne) => JSON.parse(ligne) as Unite);

    assert.equal(unites.length, manifeste.unites);
    assert.equal(new Set(unites.map((unite) => unite.ref)).size, unites.length);
    assert.ok(unites.every((unite) => unite.corpus === "lil"));
    assert.ok(unites.every((unite) => unite.document === manifeste.text_id));
    assert.ok(unites.every((unite) => unite.niveau === "article"));
    assert.ok(unites.every((unite) => unite.statut === "VIGUEUR"));
  });
});
