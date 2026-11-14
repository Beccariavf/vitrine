import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { DescripteurCePd, FetchHtml } from "../mcp/corpus/cepd/liste.ts";
import type { FetchPdf } from "../mcp/corpus/cepd/pdf.ts";
import { syncCePd } from "../mcp/corpus/cepd/sync.ts";
import { readThemes } from "../veille/themes.ts";
import type { Entry } from "../veille/types.ts";
import { SOURCES, run } from "../veille/main.ts";
import {
  FEED_URL,
  identifiantDeDocument,
  parseFeed,
  passeDocumentsCePd,
  resumeDepuisPage,
} from "../veille/sources/cepd.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const THEMES = readThemes(ROOT);
const FIXTURES = new URL("./fixtures/cepd/", import.meta.url);
const NEWS = readFileSync(new URL("news.xml", FIXTURES), "utf8");
const SITEMAP_INDEX = readFileSync(new URL("veille-sitemap-index.xml", FIXTURES), "utf8");
const SITEMAP_PAGE1 = readFileSync(new URL("veille-sitemap-page1.xml", FIXTURES), "utf8");
const DOCUMENT = readFileSync(new URL("veille-document.html", FIXTURES), "utf8");

const SITEMAP = "https://www.edpb.europa.eu/sitemap.xml";
const BASE = "https://www.edpb.europa.eu";
const DOC =
  `${BASE}/documents/guideline/guidelines-062026-on-the-processing-of-personal-data_fr`;
const SLUG = "guidelines-062026-on-the-processing-of-personal-data";
const DATE_PASSE = new Date("2026-11-14T09:30:00.000Z");
const DATE_LISTE = "2026-11-14";
const PDF = new Uint8Array(readFileSync(new URL("guideline.pdf", FIXTURES)));
const TEXTE = readFileSync(new URL("guideline.txt", FIXTURES), "utf8");
const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/cepd/descripteur.json", import.meta.url), "utf8"),
) as DescripteurCePd;

function racine(): string {
  return mkdtempSync(join(tmpdir(), "cepd-veille-"));
}

/** Index de sitemap puis une page d'URL, comme le site les sert. */
function urlset(entrees: { url: string; lastmod?: string }[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    entrees
      .map(
        (entree) =>
          `<url><loc>${entree.url}</loc>` +
          (entree.lastmod === undefined ? "" : `<lastmod>${entree.lastmod}</lastmod>`) +
          "</url>",
      )
      .join("") +
    "</urlset>"
  );
}

/** `fetch` simulé : chaque URL sert son corps, une URL inconnue répond 404. */
function servir(pages: Map<string, string>): { fetchHtml: FetchHtml; appels: string[] } {
  const appels: string[] = [];
  const fetchHtml: FetchHtml = async (url) => {
    appels.push(url);
    const corps = pages.get(url);
    if (corps === undefined) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => corps };
  };
  return { fetchHtml, appels };
}

/** PDF simulé : la fixture servie pour toute URL. */
function fauxPdf(octets: Uint8Array): FetchPdf {
  return async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () =>
      octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer,
  });
}

/** Carte de pages : index, page 1, puis les pages de documents demandées. */
function pagesSitemap(
  entrees: { url: string; lastmod?: string; page?: string }[],
): Map<string, string> {
  const pages = new Map<string, string>([
    [SITEMAP, SITEMAP_INDEX],
    [`${SITEMAP}?page=1`, urlset(entrees)],
  ]);
  for (const entree of entrees) {
    if (entree.page !== undefined) pages.set(entree.url, entree.page);
  }
  return pages;
}

function ecrireManifeste(root: string, manifeste: unknown): void {
  mkdirSync(join(root, "data", "corpus", "cepd"), { recursive: true });
  writeFileSync(
    join(root, "data", "corpus", "cepd", "manifest.json"),
    `${JSON.stringify(manifeste, null, 2)}\n`,
    "utf8",
  );
}

function pagesDeDocument(url: string): Map<string, string> {
  return pagesSitemap([{ url, lastmod: "2026-11-12", page: DOCUMENT }]);
}

describe("la veille des documents du CEPD", () => {
  it("rend une entrée typée pour un document absent du corpus", async () => {
    const root = racine();
    try {
      ecrireManifeste(root, {
        documents: 0,
        documents_types: {},
        documents_versions: {},
        documents_lastmod: {},
      });
      const { fetchHtml } = servir(pagesDeDocument(DOC));

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.equal(resultat.entries.length, 1);
      const entree = resultat.entries[0];
      assert.ok(entree);
      assert.equal(entree.source, "cepd");
      assert.equal(entree.document, SLUG);
      assert.equal(entree.type, "lignes_directrices");
      assert.equal(
        entree.title,
        "Lignes directrices 06/2026 sur le traitement des données personnelles",
      );
      assert.equal(entree.officialTitle, entree.title);
      assert.equal(entree.url, DOC);
      assert.equal(entree.publishedAt, "2026-11-14T12:00:00.000Z");
      assert.equal(entree.date_acte, "2026-11-12");
      assert.equal(
        entree.summary,
        "Lignes directrices du CEPD sur le traitement des données personnelles " +
          "dans le cadre des services de messagerie.",
      );
      assert.deepEqual(entree.references, []);
      assert.deepEqual(entree.themes, ["donnees-personnelles"]);
      // Aucune version explicite : la signature est l'état publié.
      assert.equal(entree.version, "finale");
      assert.equal(entree.consultation, undefined);
      assert.equal(entree.id, identifiantDeDocument(SLUG, "finale"));
      assert.deepEqual(resultat.warnings, []);
      assert.match(
        resultat.notes.join("\n"),
        /cepd : 1 document\(s\) listé\(s\), 1 candidat\(s\), 1 entrée\(s\) de veille, 0 en consultation/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("signale une nouvelle version adoptée quand la page en porte une autre", async () => {
    const root = racine();
    try {
      ecrireManifeste(root, {
        documents_types: { [SLUG]: "lignes_directrices" },
        documents_versions: { [SLUG]: "1.0" },
        documents_lastmod: { [SLUG]: "2026-01-01" },
      });
      const page = [
        "<html><body><main>",
        '<h1 id="document-full-title">Lignes directrices 06/2026 - Version 2.0</h1>',
        '<time datetime="2026-11-12T12:00:00Z">12 novembre 2026</time>',
        "</main></body></html>",
      ].join("");
      const { fetchHtml } = servir(
        pagesSitemap([{ url: DOC, lastmod: "2026-11-12", page }]),
      );

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.equal(resultat.entries.length, 1);
      const entree = resultat.entries[0];
      assert.ok(entree);
      assert.equal(entree.version, "2.0");
      assert.equal(entree.consultation, undefined);
      assert.equal(entree.document, SLUG);
      assert.equal(entree.id, identifiantDeDocument(SLUG, "2.0"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne relit pas la page d'un document déjà au corpus dans la même version", async () => {
    const root = racine();
    try {
      ecrireManifeste(root, {
        documents_types: { [SLUG]: "lignes_directrices" },
        documents_versions: { [SLUG]: "2.0" },
        documents_lastmod: { [SLUG]: "2026-11-12" },
      });
      // Aucune page de document n'est servie : une requête se verrait.
      const { fetchHtml, appels } = servir(
        pagesSitemap([{ url: DOC, lastmod: "2026-11-12" }]),
      );

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.deepEqual(resultat.entries, []);
      assert.deepEqual(resultat.warnings, []);
      assert.equal(appels.includes(DOC), false, "la page du document ne doit pas être lue");
      assert.match(resultat.notes.join("\n"), /0 candidat\(s\), 0 entrée\(s\) de veille/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne rend rien quand la page modifiée porte la même version que le corpus", async () => {
    const root = racine();
    try {
      ecrireManifeste(root, {
        documents_types: { [SLUG]: "lignes_directrices" },
        documents_versions: { [SLUG]: "2.0" },
        documents_lastmod: { [SLUG]: "2026-01-01" },
      });
      const page = [
        "<html><body><main>",
        '<h1 id="document-full-title">Lignes directrices 06/2026 - Version 2.0</h1>',
        '<time datetime="2026-11-12T12:00:00Z">12 novembre 2026</time>',
        "</main></body></html>",
      ].join("");
      const { fetchHtml, appels } = servir(
        pagesSitemap([{ url: DOC, lastmod: "2026-11-12", page }]),
      );

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.deepEqual(resultat.entries, []);
      assert.equal(appels.includes(DOC), true, "la page modifiée est relue une fois");
      assert.match(resultat.notes.join("\n"), /1 candidat\(s\), 0 entrée\(s\) de veille/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("signale un projet devenu version finale sans version explicite", async () => {
    const root = racine();
    try {
      ecrireManifeste(root, {
        documents_types: { [SLUG]: "lignes_directrices" },
        documents_versions: { [SLUG]: "projet" },
        documents_lastmod: { [SLUG]: "2026-01-01" },
      });
      // La page était un projet de consultation ; elle est devenue la version
      // finale, sans nommer de version : seul l'état publié a changé.
      const page = [
        "<html><body><main>",
        '<h1 id="document-full-title">Guidelines 08/2026 on Anonymisation</h1>',
        '<time datetime="2026-11-12T12:00:00Z">12 November 2026</time>',
        "</main></body></html>",
      ].join("");
      const { fetchHtml } = servir(
        pagesSitemap([{ url: DOC, lastmod: "2026-11-12", page }]),
      );

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.equal(resultat.entries.length, 1);
      const entree = resultat.entries[0];
      assert.ok(entree);
      assert.equal(entree.version, "finale");
      assert.equal(entree.consultation, undefined);
      assert.equal(entree.id, identifiantDeDocument(SLUG, "finale"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne signale rien quand le statut publié n'a pas changé", async () => {
    const root = racine();
    try {
      ecrireManifeste(root, {
        documents_types: { [SLUG]: "lignes_directrices" },
        documents_versions: { [SLUG]: "projet" },
        documents_lastmod: { [SLUG]: "2026-01-01" },
      });
      const page = [
        "<html><body><main>",
        '<h1 id="document-full-title">Guidelines 08/2026 on Anonymisation</h1>',
        '<time datetime="2026-11-12T12:00:00Z">12 November 2026</time>',
        "<p>Public consultation ongoing</p>",
        "</main></body></html>",
      ].join("");
      const { fetchHtml, appels } = servir(
        pagesSitemap([{ url: DOC, lastmod: "2026-11-12", page }]),
      );

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.deepEqual(resultat.entries, []);
      assert.equal(appels.includes(DOC), true, "la page modifiée est relue une fois");
      assert.match(resultat.notes.join("\n"), /1 candidat\(s\), 0 entrée\(s\) de veille/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("marque une version de consultation, par la page ou par son titre", async () => {
    const root = racine();
    const parPage =
      `${BASE}/documents/guideline/guidelines-072026-on-anonymisation_fr`;
    const parTitre =
      `${BASE}/documents/guideline/guidelines-082026-on-anonymisation_fr`;
    const pageConsultation = [
      "<html><body><main>",
      '<h1 id="document-full-title">Guidelines 07/2026 on Anonymisation</h1>',
      '<time datetime="2026-07-08T12:00:00Z">8 July 2026</time>',
      "<p>Guideline 08 July 2026 Public consultation ongoing</p>",
      '<a href="/system/files/g072026_en.pdf">PDF</a>',
      "</main></body></html>",
    ].join("");
    const pageProjet = [
      "<html><body><main>",
      '<h1 id="document-full-title">Draft guidelines 08/2026 on Anonymisation</h1>',
      '<time datetime="2026-07-08T12:00:00Z">8 July 2026</time>',
      "</main></body></html>",
    ].join("");
    try {
      ecrireManifeste(root, {
        documents_types: {},
        documents_versions: {},
        documents_lastmod: {},
      });
      const { fetchHtml } = servir(
        pagesSitemap([
          { url: parPage, lastmod: "2026-07-08", page: pageConsultation },
          { url: parTitre, lastmod: "2026-07-08", page: pageProjet },
        ]),
      );

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.equal(resultat.entries.length, 2);
      assert.equal(resultat.entries.every((entree) => entree.consultation === true), true);
      assert.equal(resultat.entries.every((entree) => entree.version === "projet"), true);
      assert.match(resultat.notes.join("\n"), /2 entrée\(s\) de veille, 2 en consultation/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("échoue fermé quand le manifeste du corpus manque", async () => {
    const root = racine();
    try {
      const { fetchHtml, appels } = servir(pagesDeDocument(DOC));

      await assert.rejects(
        passeDocumentsCePd({
          rootDir: root,
          fetchImpl: fetchHtml,
          attendre: async () => {},
          maintenant: DATE_PASSE,
        }),
        /Manifeste CEPD absent ou illisible : .*manifest\.json \(lancer cepd:sync\)/,
      );
      assert.deepEqual(appels, [], "aucune requête sans manifeste : tout serait « nouveau »");

      mkdirSync(join(root, "data", "corpus", "cepd"), { recursive: true });
      writeFileSync(join(root, "data", "corpus", "cepd", "manifest.json"), "{", "utf8");
      await assert.rejects(
        passeDocumentsCePd({
          rootDir: root,
          fetchImpl: fetchHtml,
          attendre: async () => {},
          maintenant: DATE_PASSE,
        }),
        /Manifeste CEPD absent ou illisible/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne produit rien pour un document que le corpus a écarté", async () => {
    const root = racine();
    try {
      ecrireManifeste(root, {
        documents_types: {},
        documents_versions: {},
        documents_lastmod: {},
        couverture: {
          documents_ecartes: [
            { url: DOC, slug: SLUG, type: "lignes_directrices", raison: "version obsolète" },
          ],
        },
      });
      const { fetchHtml, appels } = servir(
        pagesSitemap([{ url: DOC, lastmod: "2026-11-12" }]),
      );

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.deepEqual(resultat.entries, []);
      assert.equal(appels.includes(DOC), false, "un document écarté ne doit pas être relu");
      assert.match(
        resultat.notes.join("\n"),
        /1 document\(s\) listé\(s\), 1 écarté\(s\) par le corpus, 0 candidat\(s\), 0 entrée\(s\) de veille/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne vérifie aucun document présent quand le manifeste ne porte pas les versions", async () => {
    const root = racine();
    try {
      // Manifeste tel que le corpus commité le porte aujourd'hui.
      ecrireManifeste(root, {
        documents: 1,
        documents_types: { [SLUG]: "lignes_directrices" },
        couverture: { documents_types: { [SLUG]: "lignes_directrices" } },
      });
      const { fetchHtml, appels } = servir(
        pagesSitemap([{ url: DOC, lastmod: "2026-11-12" }]),
      );

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.deepEqual(resultat.entries, []);
      assert.equal(appels.includes(DOC), false, "rien n'est relu sans version au manifeste");
      assert.match(
        resultat.notes.join("\n"),
        /cepd : manifeste sans versions \(relancer cepd:sync\), 1 document\(s\) non vérifié\(s\)/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("avertit et continue quand la page d'un document est illisible", async () => {
    const root = racine();
    try {
      ecrireManifeste(root, {
        documents_types: {},
        documents_versions: {},
        documents_lastmod: {},
      });
      const { fetchHtml } = servir(pagesSitemap([{ url: DOC, lastmod: "2026-11-12" }]));

      const resultat = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.deepEqual(resultat.entries, []);
      assert.equal(resultat.warnings.length, 1);
      assert.match(resultat.warnings[0] ?? "", new RegExp(DOC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(resultat.warnings[0] ?? "", /HTTP 404/);
      assert.match(resultat.notes.join("\n"), /0 entrée\(s\) de veille/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ajoute les documents aux entrées du flux dans la passe", async () => {
    const root = racine();
    try {
      ecrireManifeste(root, {
        documents_types: {},
        documents_versions: {},
        documents_lastmod: {},
      });
      const pages = new Map<string, string>([
        [FEED_URL, NEWS],
        [SITEMAP, SITEMAP_INDEX],
        [`${SITEMAP}?page=1`, SITEMAP_PAGE1],
        [DOC, DOCUMENT],
        [`${BASE}/documents/recommendation/recommendation-022026-on-a-referential_fr`, DOCUMENT],
      ]);
      const { fetchHtml } = servir(pages);
      const source = SOURCES.filter((element) => element.id === "cepd");
      assert.equal(source.length, 1);

      const resultat = await run({
        fetchImpl: fetchHtml,
        rootDir: root,
        sources: source,
        themes: THEMES,
        now: DATE_PASSE,
      });

      const flux = parseFeed(NEWS);
      assert.equal(flux.length, 1);
      const attendu = { ...flux[0], themes: ["donnees-personnelles"] } as Entry;
      assert.equal(resultat.entryPaths.length, 3);

      const ecrites = resultat.entryPaths.map(
        (chemin) => JSON.parse(readFileSync(chemin, "utf8")) as Entry,
      );
      const duFlux = ecrites.find((entree) => entree.id === attendu.id);
      assert.deepEqual(duFlux, attendu);

      const documents = ecrites.filter((entree) => entree.document !== undefined);
      assert.deepEqual(
        documents.map((entree) => [entree.document, entree.type]).sort(),
        [
          ["guidelines-062026-on-the-processing-of-personal-data", "lignes_directrices"],
          ["recommendation-022026-on-a-referential", "recommandation"],
        ],
      );
      assert.equal(documents.every((entree) => entree.source === "cepd"), true);

      // Le snapshot du flux reste écrit, et la source reste une seule entrée.
      assert.equal(existsSync(resultat.sources[0]?.rawPath ?? ""), true);
      assert.equal(
        readFileSync(resultat.sources[0]?.rawPath ?? "", "utf8"),
        NEWS.endsWith("\n") ? NEWS : `${NEWS}\n`,
      );
      assert.match(resultat.notes.join("\n"), /cepd : 2 document\(s\) listé\(s\)/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("calcule la même signature des deux côtés, corpus et veille", async () => {
    const root = racine();
    const slug = "guidelines-082026-on-anonymisation";
    const page = `${BASE}/documents/guideline/${slug}_fr`;
    // Page de consultation : aucun marqueur de version, « Public consultation ongoing ».
    const consultation = [
      "<html><body><main>",
      '<h1 id="document-full-title">Guidelines 08/2026 on Anonymisation</h1>',
      '<time datetime="2026-07-08T12:00:00Z">8 July 2026</time>',
      "<p>Guideline 08 July 2026 Public consultation ongoing</p>",
      '<a href="/system/files/g082026_en.pdf">PDF</a>',
      "</main></body></html>",
    ].join("");
    const finale = [
      "<html><body><main>",
      '<h1 id="document-full-title">Guidelines 08/2026 on Anonymisation</h1>',
      '<time datetime="2026-11-12T12:00:00Z">12 November 2026</time>',
      '<a href="/system/files/g082026_en.pdf">PDF</a>',
      "</main></body></html>",
    ].join("");
    const pages = new Map<string, string>([
      [DESCRIPTEUR.url_sitemap, SITEMAP_INDEX],
      [`${DESCRIPTEUR.url_sitemap}?page=1`, urlset([{ url: page, lastmod: "2026-07-08" }])],
      [page, consultation],
    ]);
    try {
      const { fetchHtml, appels } = servir(pages);
      await syncCePd({
        rootDir: root,
        date: DATE_LISTE,
        fetchHtml,
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      const manifeste = JSON.parse(
        readFileSync(join(root, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as {
        documents_versions: Record<string, string>;
        documents_lastmod: Record<string, string | null>;
      };
      assert.deepEqual(manifeste.documents_versions, { [slug]: "projet" });
      assert.deepEqual(manifeste.documents_lastmod, { [slug]: "2026-07-08" });

      // Le sitemap a bougé, la page est donc relue, mais elle porte encore le
      // statut de consultation : la veille recalcule la même signature et n'écrit rien.
      pages.set(
        `${DESCRIPTEUR.url_sitemap}?page=1`,
        urlset([{ url: page, lastmod: "2026-09-01" }]),
      );
      const avant = appels.length;
      const identique = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });
      assert.equal(appels.slice(avant).includes(page), true, "la page déplacée doit être relue");
      assert.deepEqual(identique.entries, []);

      // Même slug, page devenue finale sans version explicite : le sitemap l'a datée.
      pages.set(
        `${DESCRIPTEUR.url_sitemap}?page=1`,
        urlset([{ url: page, lastmod: "2026-11-12" }]),
      );
      pages.set(page, finale);
      const changee = await passeDocumentsCePd({
        rootDir: root,
        fetchImpl: fetchHtml,
        attendre: async () => {},
        maintenant: DATE_PASSE,
      });

      assert.equal(changee.entries.length, 1);
      const entree = changee.entries[0];
      assert.ok(entree);
      assert.equal(entree.document, slug);
      assert.equal(entree.version, "finale");
      assert.equal(entree.consultation, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lit une description de page sans inventer de résumé", () => {
    assert.equal(
      resumeDepuisPage(
        '<meta name="description" content="Un extrait &amp; sa suite.">',
      ),
      "Un extrait & sa suite.",
    );
    assert.equal(resumeDepuisPage('<meta content="x" property="og:title">'), null);
    assert.equal(resumeDepuisPage("<html></html>"), null);
  });
});
