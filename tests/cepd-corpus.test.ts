import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  ErreurHttp,
  chargerTexte,
  entreesSitemap,
  extraireDocuments,
  listerDocuments,
  listerDocumentsG29,
  listerDocumentsSitemap,
  listerDocumentsWayback,
  normaliserUrlWayback,
  snapshotWayback,
  trouverLienPdf,
  typeDepuisChemin,
} from "../mcp/corpus/cepd/liste.ts";
import type {
  DescripteurCePd,
  FetchHtml,
  FetchJson,
  Tentative,
} from "../mcp/corpus/cepd/liste.ts";
import {
  choisirVersions,
  consultationDepuisPage,
  dateDocument,
  enrichirDocument,
  estG29,
  numeroDepuisTitre,
  preparerDocument,
  signatureVersion,
  slugDe,
  statutDepuisTitre,
  titreDepuisPage,
  unitesCePd,
  validerUnites,
  versionDepuisTitre,
} from "../mcp/corpus/cepd/parse.ts";
import {
  ErreurPdf,
  estPdf,
  estUrlAutorisee,
  extraireTextePdf,
  languePdf,
  paragraphesDepuisTexte,
  partLettres,
  telechargerPdf,
  texteValide,
  trouverPdfDocument,
} from "../mcp/corpus/cepd/pdf.ts";
import type { FetchPdf } from "../mcp/corpus/cepd/pdf.ts";
import { syncCePd } from "../mcp/corpus/cepd/sync.ts";
import type { ManifesteCePd } from "../mcp/corpus/cepd/sync.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const lire = (nom: string): string =>
  readFileSync(new URL(`./fixtures/cepd/${nom}`, import.meta.url), "utf8");

const TEXTE = lire("guideline.txt");
const PDF = new Uint8Array(readFileSync(new URL("./fixtures/cepd/guideline.pdf", import.meta.url)));
const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/cepd/descripteur.json", import.meta.url), "utf8"),
) as DescripteurCePd;
const URL_LISTE = DESCRIPTEUR.url_liste;
const PAGE0 = lire("liste-page0.html");
const PAGE1 = lire("liste-page1.html");
const DOCUMENT = lire("document.html");
const DOCUMENT_SANS_PDF = lire("document-sans-pdf.html");
const BASE = "https://www.edpb.europa.eu";
const DOC_01 =
  `${BASE}/our-work-tools/our-documents/guidelines/guidelines-012023-article-37-law-enforcement-directive_fr`;
const DOC_02 = `${BASE}/our-work-tools/our-documents/guidelines/guidelines-022024-article-48-gdpr_fr`;
const DOC_03 = `${BASE}/our-work-tools/our-documents/guidelines/guidelines-032021-application-article-651a-gdpr_fr`;
const DOC_04 = `${BASE}/our-work-tools/our-documents/guidelines/guidelines-042025-pseudonymisation_fr`;
const PDF_URL = `${BASE}/system/files/2024-06/edpb-guidelines-202301.pdf`;
const DATE = "2026-11-09";
const SITEMAP_INDEX = lire("sitemap-index.xml");
const SITEMAP_PAGE1 = lire("sitemap-page1.xml");
const SITEMAP_DOC_01 = `${BASE}/documents/guideline/guidelines-012023-article-37-law-enforcement-directive_fr`;
const SITEMAP_DOC_02 = `${BASE}/documents/guideline/guidelines-022024-article-48-gdpr_fr`;
const SITEMAP_DOC_03 = `${BASE}/documents/guideline/guidelines-032021-application-article-651a-gdpr_fr`;
const SITEMAP_DOC_04 = `${BASE}/documents/guideline/guidelines-042025-pseudonymisation_fr`;
const SITEMAP_RECO =
  `${BASE}/documents/recommendation/recommendation-012024_fr`;

/** Page de document minimale : titre, date, PDF courant et PDF de consultation. */
function pageDocumentHtml(
  numero: string,
  date: string,
  pdf: string | null,
  options: { consultation?: string } = {},
): string {
  const consultation = options.consultation === undefined
    ? ""
    : `<a href="${options.consultation}">Consultation</a>`;
  const fichier = pdf === null ? "" : `<a href="${pdf}">Télécharger</a>`;
  return [
    "<html><body><main>",
    `<h1>Lignes directrices ${numero}</h1>`,
    `<time datetime="${date}T12:00:00Z">${date}</time>`,
    consultation,
    fichier,
    "</main></body></html>",
  ].join("");
}

const SITEMAP_DOC_PAGES = new Map<string, string>([
  [
    SITEMAP_DOC_01,
    pageDocumentHtml("01/2023 sur l'article 37", "2023-09-15", "/system/files/documents/2023/g012023_fr.pdf", {
      consultation: "/system/files/consultation/g012023_en.pdf",
    }),
  ],
  [
    SITEMAP_DOC_02,
    pageDocumentHtml("02/2024 sur l'article 48", "2024-06-20", "/system/files/documents/2024/g022024_fr.pdf"),
  ],
  [
    SITEMAP_DOC_03,
    pageDocumentHtml("03/2021 sur l'article 65", "2021-05-01", "/system/files/documents/2021/g032021_fr.pdf"),
  ],
  [SITEMAP_DOC_04, pageDocumentHtml("04/2025 sur la pseudonymisation", "2025-02-20", null)],
  [
    SITEMAP_RECO,
    pageDocumentHtml("01/2024 sur un référentiel", "2024-02-01", "/system/files/2024/r012024_fr.pdf"),
  ],
]);

const SYNC_PAGES = new Map<string, string>([
  [DESCRIPTEUR.url_sitemap, SITEMAP_INDEX],
  [`${DESCRIPTEUR.url_sitemap}?page=1`, SITEMAP_PAGE1],
  ...SITEMAP_DOC_PAGES,
]);

const PAGES = new Map<string, string>([
  [URL_LISTE, PAGE0],
  [`${URL_LISTE}?page=1`, PAGE1],
  [DOC_01, DOCUMENT],
  [DOC_02, DOCUMENT],
  [DOC_03, DOCUMENT],
  [DOC_04, DOCUMENT_SANS_PDF],
]);

function fauxHtml(pages: Map<string, string>): FetchHtml {
  return async (url) => {
    const corps = pages.get(url);
    if (corps === undefined) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => corps };
  };
}

function fauxPdf(octets: Uint8Array, echec = false): FetchPdf {
  return async (url) => {
    if (echec) return { ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) };
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer,
    };
  };
}

function racineTemporaire(): string {
  return mkdtempSync(join(tmpdir(), "cepd-corpus-"));
}

function documentPrepare(titre: string, date = "2023-09-15") {
  return preparerDocument({
    type: "lignes_directrices",
    url: DOC_01,
    titre,
    date,
    pdfUrl: null,
  });
}

describe("la liste CEPD", () => {
  it("extrait les lignes directrices et ignore les pages de consultation publique", () => {
    const documents = extraireDocuments(PAGE0, URL_LISTE);

    assert.equal(documents.length, 5);
    assert.equal(documents.every((document) => document.type === "lignes_directrices"), true);
    assert.equal(
      documents.some((document) => document.url.includes("public-consultations")),
      false,
    );
    assert.equal(
      documents.some((document) => document.url.includes("/opinions/")),
      false,
    );
    const premier = documents[0];
    assert.ok(premier);
    assert.equal(premier.url, DOC_01);
    assert.match(premier.titre, /01\/2023/);
    assert.equal(premier.date, "2023-09-15");
  });

  it("reconnaît les quatre rubriques du sitemap et la version française d'abord", async () => {
    assert.deepEqual(DESCRIPTEUR.types, [
      "lignes_directrices",
      "avis_art64",
      "decision_art65",
      "recommandation",
    ]);
    const html = [
      `<a href="${BASE}/documents/guideline/guidelines-012024_fr">Lignes directrices 01/2024</a>`,
      `<a href="${BASE}/documents/opinion-of-the-board-art-64/opinion-012024_en">Opinion 01/2024</a>`,
      `<a href="${BASE}/documents/opinion-of-the-board-art-64/opinion-012024_fr">Avis 01/2024</a>`,
      `<a href="${BASE}/documents/edpb-binding-decisions/binding-decision-12021_en">Binding decision 1/2021</a>`,
      `<a href="${BASE}/documents/recommendation/recommendation-012024_fr">Recommendation 01/2024</a>`,
    ].join("");
    const documents = extraireDocuments(html, URL_LISTE);
    const parType = new Map(documents.map((document) => [document.type, document]));

    assert.equal(documents.length, 4);
    assert.equal(parType.get("lignes_directrices")?.url.endsWith("_fr"), true);
    assert.equal(parType.get("avis_art64")?.url.endsWith("_fr"), true);
    assert.equal(parType.get("decision_art65")?.langue, "en");
    assert.equal(parType.get("recommandation")?.langue, "fr");
  });

  it("lit la liste d'endossement du G29 et l'hébergement de chaque document", () => {
    const html = [
      "<ul>",
      '<li><a href="/our-work-tools/our-documents/guidelines/edpb-guidelines-052020-consent-under-regulation-2016679_en">',
      "Guidelines on consent under Regulation 2016/679, WP259 rev.01</a></li>",
      '<li><a href="http://ec.europa.eu/newsroom/article29/item-detail.cfm?item_id=611236">',
      "Guidelines on Data Protection Impact Assessment (DPIA), WP248</a></li>",
      '<li><a href="http://ec.europa.eu/newsroom/article29/item-detail.cfm?item_id=612053">',
      "Guidelines on Automated individual decision-making, WP251rev.01</a></li>",
      "<li><strong>Working Document Setting Forth a Co-Operation Procedure, WP 263 rev.01</strong>",
      " superseded by ",
      '<a href="https://www.edpb.europa.eu/our-work-tools/our-documents/procedure/edpb-document-cooperation_en">',
      "EDPB Document Setting Forth a Co-Operation procedure</a></li>",
      '<li><a href="/about-edpb/legacy-art-29-working-party_en">Legacy: Art. 29 Working Party</a></li>',
      "</ul>",
    ].join("");
    const items = listerDocumentsG29(
      html,
      "https://www.edpb.europa.eu/endorsed-wp29-guidelines_en",
    );

    assert.equal(items.length, 4);
    assert.deepEqual(items[0], {
      titre: "Guidelines on consent under Regulation 2016/679, WP259 rev.01",
      url: `${BASE}/our-work-tools/our-documents/guidelines/edpb-guidelines-052020-consent-under-regulation-2016679_en`,
      wp: "WP259",
      numero: "05/2020",
      hebergement: "cepd",
    });
    assert.equal(items[1]?.wp, "WP248");
    assert.equal(items[1]?.hebergement, "commission");
    assert.equal(items[1]?.numero, null);
    // `WP251rev.01` n'a pas de frontière après les chiffres.
    assert.equal(items[2]?.wp, "WP251");
    assert.equal(items[3]?.wp, "WP263");
    assert.equal(items[3]?.titre.includes("superseded"), false);
    assert.equal(items[3]?.hebergement, "cepd");
  });

  it("ne garde du sitemap que les URL _fr et _en des rubriques retenues", async () => {
    const pages = new Map<string, string>([
      [DESCRIPTEUR.url_sitemap, SITEMAP_INDEX],
      [`${DESCRIPTEUR.url_sitemap}?page=1`, SITEMAP_PAGE1],
    ]);
    const liste = await listerDocumentsSitemap(DESCRIPTEUR, {
      fetchHtml: fauxHtml(pages),
      attendre: async () => {},
      tentatives: 1,
    });

    assert.equal(liste.via, "sitemap");
    assert.equal(liste.pages, 1);
    assert.equal(liste.sitemapPages.length, 1);
    assert.equal(liste.documents.length, 5);
    assert.equal(
      liste.documents.every(
        (document) => document.url.endsWith("_fr") || document.url.endsWith("_en"),
      ),
      true,
    );
    assert.equal(
      liste.documents.some((document) => document.url.endsWith("_de")),
      false,
    );
    assert.deepEqual(
      [...new Set(liste.documents.map((document) => document.type))].sort(),
      ["lignes_directrices", "recommandation"],
    );
  });

  it("lit un bloc <url> et retombe sur les <loc> plats", () => {
    assert.deepEqual(
      entreesSitemap(
        "<urlset><url><loc>https://www.edpb.europa.eu/documents/guideline/a_fr</loc>" +
          "<lastmod>2026-11-12</lastmod></url></urlset>",
      ),
      [{ loc: "https://www.edpb.europa.eu/documents/guideline/a_fr", lastmod: "2026-11-12" }],
    );
    assert.deepEqual(
      entreesSitemap(
        "<sitemapindex><sitemap><loc>https://www.edpb.europa.eu/sitemap.xml?page=1</loc></sitemap></sitemapindex>",
      ),
      [{ loc: "https://www.edpb.europa.eu/sitemap.xml?page=1", lastmod: null }],
    );
  });

  it("porte le lastmod du bloc <url>, le plus récent des deux langues", async () => {
    const fetchHtml: FetchHtml = async (url) => {
      if (url === DESCRIPTEUR.url_sitemap) {
        return { ok: true, status: 200, text: async () => SITEMAP_INDEX };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          "<urlset>" +
          `<url><loc>${BASE}/documents/guideline/guidelines-012023_fr</loc>` +
          "<lastmod>2026-01-01</lastmod></url>" +
          `<url><loc>${BASE}/documents/guideline/guidelines-012023_en</loc>` +
          "<lastmod>2026-03-01</lastmod></url>" +
          `<url><loc>${BASE}/documents/guideline/guidelines-sans-date_fr</loc></url>` +
          "</urlset>",
      };
    };
    const liste = await listerDocumentsSitemap(DESCRIPTEUR, {
      fetchHtml,
      attendre: async () => {},
      tentatives: 1,
    });

    const parUrl = new Map(
      liste.documents.map((document) => [document.url, document.lastmod]),
    );
    // Le groupe garde l'URL française et la modification anglaise, plus récente.
    assert.equal(parUrl.get(`${BASE}/documents/guideline/guidelines-012023_fr`), "2026-03-01");
    assert.equal(
      parUrl.has(`${BASE}/documents/guideline/guidelines-012023_en`),
      false,
    );
    assert.equal(parUrl.get(`${BASE}/documents/guideline/guidelines-sans-date_fr`), null);
  });

  it("garde une page _fr sans numéro, comme la transparence", async () => {
    const fetchHtml: FetchHtml = async (url) => {
      if (url === DESCRIPTEUR.url_sitemap) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            `<sitemapindex><sitemap><loc>${DESCRIPTEUR.url_sitemap}?page=1</loc></sitemap></sitemapindex>`,
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          "<urlset>" +
          `<url><loc>${BASE}/documents/guideline/transparency_fr</loc></url>` +
          `<url><loc>${BASE}/documents/guideline/transparency_en</loc></url>` +
          "</urlset>",
      };
    };
    const liste = await listerDocumentsSitemap(DESCRIPTEUR, {
      fetchHtml,
      attendre: async () => {},
      tentatives: 1,
    });

    assert.equal(liste.documents.length, 1);
    assert.match(liste.documents[0]?.url ?? "", /transparency_fr$/);
  });

  it("parcourt les pages ?page=N jusqu'à la première page sans document", async () => {
    const journal: Tentative[] = [];
    const liste = await listerDocuments(DESCRIPTEUR, {
      fetchHtml: fauxHtml(PAGES),
      attendre: async () => {},
      journal,
    });

    assert.equal(liste.pages, 2);
    assert.equal(liste.documents.length, 6);
    assert.equal(journal.filter((entree) => entree.statut === 404).length, 1);
  });

  it("retente trois fois un 503 et nomme l'URL", async () => {
    const journal: Tentative[] = [];
    const fetchHtml: FetchHtml = async () => ({
      ok: false,
      status: 503,
      text: async () => "",
    });

    await assert.rejects(
      listerDocuments(DESCRIPTEUR, {
        fetchHtml,
        attendre: async () => {},
        tentatives: 3,
        delaiMs: 1,
        journal,
      }),
      /HTTP 503 après 3 tentative\(s\)/,
    );
    assert.equal(journal.length, 3);
  });

  it("lit la date de la ligne quand le lien final est dans une alerte voisine", () => {
    const html = [
      '<div class="views-row">',
      '<span class="news-date">23 November 2018</span>',
      '<a href="/our-work-tools/our-documents/guidelines/guidelines-32018-territorial-scope-gdpr-article-3-version_fr">',
      "Guidelines 3/2018 on the territorial scope of the GDPR (Article 3)",
      "</a>",
      "</div>",
    ].join("");
    const documents = extraireDocuments(html, URL_LISTE);
    assert.equal(documents.length, 1);
    assert.equal(documents[0]?.date, "2018-11-23");
  });

  it("prend le titre de la ligne quand l'ancre est un bouton générique", () => {
    const html = [
      '<a href="/our-work-tools/our-documents/opinions/opinion-012024_en">Opinion 01/2024</a>',
      '<div class="views-row">',
      '<h4 class="node__title">',
      '<a href="/our-work-tools/our-documents/guidelines/guidelines-022024-article-48-gdpr_en">',
      "Guidelines 02/2024 on Article 48 GDPR",
      "</a>",
      "</h4>",
      '<a href="/our-work-tools/our-documents/guidelines/guidelines-022024-article-48-gdpr_en">',
      "Final version of this publication",
      "</a>",
      "</div>",
    ].join("");
    const documents = extraireDocuments(html, URL_LISTE);
    assert.equal(documents.length, 1);
    assert.match(documents[0]?.titre ?? "", /Guidelines 02\/2024/);
  });

  it("normalise une URL Wayback vers son original", () => {
    const original = "https://www.edpb.europa.eu/documents/guideline/x_en";
    assert.equal(
      normaliserUrlWayback(`https://web.archive.org/web/20260101120000/${original}`),
      original,
    );
    assert.equal(normaliserUrlWayback(`/web/20260101120000/${original}`), original);
    assert.equal(
      normaliserUrlWayback(`https://www.edpb.europa.eu/web/20260101120000/${original}`),
      original,
    );
  });

  it("trouve le PDF d'une page de document", () => {
    assert.equal(trouverLienPdf(DOCUMENT, DOC_01), PDF_URL);
    assert.equal(trouverLienPdf(DOCUMENT_SANS_PDF, DOC_04), null);
  });

  it("lit une liste par le Wayback Machine quand le direct échoue", async () => {
    const journal: Tentative[] = [];
    const snapshots = (url: string): string =>
      `https://web.archive.org/snap/${encodeURIComponent(url)}`;
    const original = (url: string): string =>
      decodeURIComponent(url.slice("https://web.archive.org/snap/".length));
    const fetchJson: FetchJson = async (api) => {
      const url = new URL(api).searchParams.get("url") ?? "";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          archived_snapshots: { closest: { available: true, url: snapshots(url) } },
        }),
      };
    };
    const fetchHtml: FetchHtml = async (url) => {
      if (url.startsWith("https://web.archive.org/snap/")) {
        const corps = PAGES.get(original(url));
        if (corps !== undefined) return { ok: true, status: 200, text: async () => corps };
      }
      return { ok: false, status: 503, text: async () => "" };
    };

    const liste = await listerDocumentsWayback(DESCRIPTEUR, {
      fetchHtml,
      fetchJson,
      attendre: async () => {},
      tentatives: 1,
      delaiMs: 1,
      pageMax: 1,
      journal,
    });

    assert.equal(liste.pages, 2);
    assert.equal(liste.documents.length, 6);
    assert.equal(journal.some((entree) => entree.via === "wayback"), true);
  });

  it("nomme l'API Wayback quand elle reste indisponible", async () => {
    const fetchJson: FetchJson = async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    await assert.rejects(
      snapshotWayback(URL_LISTE, DESCRIPTEUR, {
        fetchJson,
        attendre: async () => {},
        tentatives: 2,
        delaiMs: 1,
      }),
      /HTTP 429 après 2 tentative\(s\)/,
    );
  });

  it("retente un 503 sur le texte direct", async () => {
    let appels = 0;
    await assert.rejects(
      chargerTexte(URL_LISTE, {
        fetchHtml: async () => {
          appels += 1;
          return { ok: false, status: 503, text: async () => "" };
        },
        attendre: async () => {},
        tentatives: 2,
        delaiMs: 1,
      }),
      /HTTP 503 après 2 tentative\(s\)/,
    );
    assert.equal(appels, 2);
  });
});

describe("le parse CEPD", () => {
  it("déduit le slug, le numéro, la date et la version", () => {
    assert.equal(slugDe(DOC_01), "guidelines-012023-article-37-law-enforcement-directive");
    assert.equal(
      numeroDepuisTitre("Lignes directrices 01/2023 sur l'article 37", "lignes_directrices"),
      "Guidelines 01/2023",
    );
    assert.equal(
      numeroDepuisTitre("Recommandation 02/2021 sur la base juridique", "recommandation"),
      "Recommandation 02/2021",
    );
    assert.equal(
      numeroDepuisTitre("Avis nº 32/2023 sur le projet de décision", "avis_art64"),
      "Avis 32/2023",
    );
    assert.equal(
      numeroDepuisTitre("Décision contraignante 1/2021 concernant WhatsApp", "decision_art65"),
      "Décision contraignante 01/2021",
    );
    assert.equal(
      numeroDepuisTitre("Décision contraignante d'urgence 01/2021", "decision_art65"),
      "Décision contraignante d'urgence 01/2021",
    );
    assert.equal(
      numeroDepuisTitre("Décision 01/2020 concernant le litige", "decision_art65"),
      "Décision contraignante 01/2020",
    );
    assert.equal(
      numeroDepuisTitre("Recommendation 02/2020 on the European Essential Guarantees", "recommandation"),
      "Recommandation 02/2020",
    );
    assert.equal(versionDepuisTitre("Guidelines 01/2023 - Version 2.1"), "2.1");
    assert.equal(
      numeroDepuisTitre(
        "Transparence",
        "g29_repris",
        `${BASE}/system/files/documents/2023-09/wp260rev01_fr.pdf`,
      ),
      "WP260",
    );
    assert.equal(
      versionDepuisTitre(
        "Transparence",
        `${BASE}/system/files/documents/2023-09/wp260rev01_fr.pdf`,
      ),
      "rev01",
    );
    assert.equal(statutDepuisTitre("Guidelines 01/2023 - draft for public consultation"), "projet");
    assert.equal(statutDepuisTitre("Guidelines 01/2023 - final version"), "finale");
    assert.equal(statutDepuisTitre("Projet de lignes directrices 01/2023"), "projet");
    assert.equal(statutDepuisTitre("Avis 24/2020 relatif au projet de décision de l'autorité"), "finale");
    assert.equal(statutDepuisTitre("Décision contraignante 1/2021 concernant le litige"), "finale");
    assert.equal(
      dateDocument({
        type: "lignes_directrices",
        url: DOC_01,
        titre: "Lignes directrices 01/2023 du 15 septembre 2023",
        date: null,
        pdfUrl: null,
      }),
      "2023-09-15",
    );
  });

  it("donne une signature de version explicite, sinon l'état publié", () => {
    assert.equal(signatureVersion({ version: "2.0", statut: "finale" }), "2.0");
    assert.equal(signatureVersion({ version: "rev01", statut: "projet" }), "rev01");
    assert.equal(signatureVersion({ version: null, statut: "finale" }), "finale");
    assert.equal(signatureVersion({ version: null, statut: "projet" }), "projet");
    assert.equal(signatureVersion({ version: "", statut: "finale" }), "finale");
  });

  it("écarte le projet quand une version finale porte le même numéro", () => {
    const finale = documentPrepare("Lignes directrices 01/2023 sur l'article 37", "2023-09-15");
    const projet = documentPrepare(
      "Guidelines 01/2023 on Article 37 - draft for public consultation",
      "2023-02-01",
    );
    const { retenus, ecartes } = choisirVersions([projet, finale]);

    assert.equal(retenus.length, 1);
    assert.equal(retenus[0]?.statut, "finale");
    assert.equal(ecartes.length, 1);
    assert.equal(ecartes[0]?.statut, "projet");
  });

  it("produit des fragments adressables avec numéro, date et URL", () => {
    const document = documentPrepare("Lignes directrices 01/2023 sur l'article 37");
    const unites = unitesCePd(document, TEXTE, DESCRIPTEUR);

    assert.ok(unites.length > 0);
    for (const [index, unite] of unites.entries()) {
      assert.equal(unite.ref, `${document.slug}#f${index}`);
      assert.equal(unite.document, document.slug);
      assert.equal(unite.corpus, "cepd");
      assert.equal(unite.niveau, "fragment");
      assert.equal(unite.numero, "Guidelines 01/2023");
      assert.equal(unite.date_acte, "2023-09-15");
      assert.equal(unite.statut, "finale");
      assert.equal(unite.url, DOC_01);
      assert.match(unite.chemin, /^CEPD > Lignes directrices > /);
      assert.equal(unite.texte.includes("<"), false);
    }
  });

  it("refuse une référence dupliquée, une date non ISO ou un texte vide", () => {
    const base: Unite = {
      ref: "guidelines-012023#f0",
      document: "guidelines-012023",
      corpus: "cepd",
      niveau: "fragment",
      numero: "Guidelines 01/2023",
      chemin: "CEPD > Lignes directrices > Test",
      texte: "Un texte.",
      date_acte: "2023-09-15",
      date_debut: "2023-09-15",
      date_fin: null,
      statut: "finale",
      url: DOC_01,
    };

    assert.doesNotThrow(() => validerUnites([base]));
    assert.throws(() => validerUnites([base, { ...base }]), /référence dupliquée/);
    assert.throws(() => validerUnites([{ ...base, date_acte: "15/09/2023" }]), /date non ISO/);
    assert.throws(() => validerUnites([{ ...base, texte: "  " }]), /texte vide/);
  });
});

describe("le PDF CEPD", () => {
  it("extrait un texte réel et alphabétique", async () => {
    const texte = await extraireTextePdf(PDF, PDF_URL);

    assert.ok(texte.length >= 2000);
    assert.ok(partLettres(texte) >= 0.5);
    assert.equal(texteValide(texte), true);
    assert.ok(paragraphesDepuisTexte(texte).length > 0);
  });

  it("préfère le PDF français courant et écarte la consultation", () => {
    const html = [
      `<a href="/system/files/consultation/g012023_en.pdf">Consultation</a>`,
      `<a href="/system/files/documents/g012023_en.pdf">English</a>`,
      `<a href="/system/files/documents/g012023_fr.pdf">Français</a>`,
    ].join("");
    const pdf = trouverPdfDocument(html, SITEMAP_DOC_01);

    assert.ok(pdf);
    assert.equal(pdf.langue, "fr");
    assert.match(pdf.url, /g012023_fr\.pdf$/);
    assert.equal(languePdf(`${BASE}/system/files/documents/x_en.pdf`), "en");
    assert.equal(languePdf(`${BASE}/system/files/documents/x_en_0.pdf`), "en");
    assert.equal(languePdf(`${BASE}/system/files/documents/x_fr_0.pdf`), "fr");
    assert.equal(languePdf(`${BASE}/system/files/documents/x.pdf`), "autre");
    // Le code pays `_fr_` avant le marqueur terminal ne fait pas la langue.
    assert.equal(
      languePdf(`${BASE}/system/files/edpb_opinion_242026_fr_sa_michelin_bcr-c_en_0.pdf`),
      "en",
    );
    assert.equal(
      languePdf(`${BASE}/system/files/edpb_opinion_201913_fr_35.5_dpia_list_en.pdf`),
      "en",
    );
    assert.equal(
      languePdf(`${BASE}/system/files/2026-06/edpb-opinion-202327-tessi-bcr-p-fr.pdf`),
      "fr",
    );
    assert.equal(
      languePdf(`${BASE}/system/files/2021-07/edpb_opinion_cgi_bcr-p_en_0.pdf`),
      "en",
    );
  });

  it("enrichit une page de sitemap avec titre, date, version et PDF", () => {
    const document = {
      type: "lignes_directrices" as const,
      url: SITEMAP_DOC_01,
      titre: "",
      date: null,
      pdfUrl: null,
    };
    const enrichi = enrichirDocument(document, SITEMAP_DOC_PAGES.get(SITEMAP_DOC_01) ?? "");

    assert.match(enrichi.titre, /^Lignes directrices 01\/2023/);
    assert.equal(enrichi.date, "2023-09-15");
    assert.match(enrichi.pdfUrl ?? "", /g012023_fr\.pdf$/);
    assert.equal(titreDepuisPage(SITEMAP_DOC_PAGES.get(SITEMAP_DOC_01) ?? ""), enrichi.titre);
  });

  it("reconnaît un document du G29 repris sans confondre le pied de page", () => {
    const piedDePage =
      "<footer><a href=\"/about-edpb/legacy-art-29-working-party_fr\">" +
      "Historique : groupe de travail « Article 29 »</a></footer>";
    assert.equal(
      estG29(
        "Article 29 Working Party - Guidelines on transparency",
        "https://www.edpb.europa.eu/documents/guideline/article-29-working-party-guidelines_fr",
        piedDePage,
      ),
      true,
    );
    assert.equal(
      estG29(
        "Lignes directrices 01/2023 sur l'article 37",
        "https://www.edpb.europa.eu/documents/guideline/guidelines-012023_fr",
        piedDePage,
      ),
      false,
    );
    assert.equal(
      estG29(
        "Guidelines on the right to data portability",
        "https://www.edpb.europa.eu/documents/guideline/guidelines-on-the-right-to-data-portability-wp242_en",
        piedDePage,
      ),
      true,
    );
    const enrichi = enrichirDocument(
      {
        type: "lignes_directrices",
        url: "https://www.edpb.europa.eu/documents/guideline/article-29-working-party-guidelines_fr",
        titre: "",
        date: null,
        pdfUrl: null,
      },
      `${piedDePage}<h1>Article 29 Working Party - Guidelines on transparency</h1>`,
    );
    assert.equal(enrichi.type, "g29_repris");
  });

  it("lit la mention de consultation de la page, pas le titre seul", () => {
    const projet = [
      '<h1 id="document-full-title">Guidelines 02/2026 on Anonymisation</h1>',
      '<time datetime="2026-07-08T12:00:00Z">8 July 2026</time>',
      '<p>Guideline 08 July 2026 Public consultation closed</p>',
      "<h2>Downloadable documents</h2>",
      '<a href="/system/files/g022026_en.pdf">PDF</a>',
    ].join("");
    const finale = [
      '<h1 id="document-full-title">Lignes directrices 9/2022</h1>',
      "<p>Directives 04 avril 2023 Final version</p>",
      "<p>Accéder à la consultation publique correspondante</p>",
      "<h2>Downloadable documents</h2>",
    ].join("");
    const finaleV2 = [
      '<h1 id="document-full-title">Guidelines 1/2024</h1>',
      '<p>Guideline 10 November 2026 Public consultation closed</p>',
      "<h2>Downloadable documents</h2>",
      "<p>Guidelines 1/2024 - Version 2.0</p>",
      '<a href="/system/files/g012024_v2_en.pdf">PDF</a>',
      "<h2>Related documents</h2>",
    ].join("");
    assert.equal(consultationDepuisPage(projet), true);
    assert.equal(consultationDepuisPage(finale), false);
    assert.equal(consultationDepuisPage(finaleV2), false);

    const prepare = preparerDocument(
      enrichirDocument(
        {
          type: "lignes_directrices",
          url: `${BASE}/documents/guideline/guidelines-022026-on-anonymisation_en`,
          titre: "",
          date: null,
          pdfUrl: null,
        },
        projet,
      ),
    );
    assert.equal(prepare.statut, "projet");
  });

  it("donne à chaque type son étage de chemin", () => {
    for (const [type, libelle] of [
      ["lignes_directrices", "Lignes directrices"],
      ["avis_art64", "Avis art. 64"],
      ["decision_art65", "Décisions contraignantes art. 65"],
      ["recommandation", "Recommandations"],
      ["g29_repris", "G29 repris"],
    ] as const) {
      const document = preparerDocument({
        type,
        url: DOC_01,
        titre: "Avis 01/2024 sur un projet",
        date: "2024-01-15",
        pdfUrl: null,
      });
      const unites = unitesCePd(document, TEXTE, DESCRIPTEUR);
      assert.match(unites[0]?.chemin ?? "", new RegExp(`^CEPD > ${libelle} > `));
    }
  });

  it("ne confond pas deux types qui portent le même numéro", () => {
    const avis = preparerDocument({
      type: "avis_art64",
      url: `${BASE}/documents/opinion-of-the-board-art-64/opinion-012024_fr`,
      titre: "Avis 01/2024 sur un projet de décision",
      date: "2024-01-15",
      pdfUrl: null,
    });
    const decision = preparerDocument({
      type: "decision_art65",
      url: `${BASE}/documents/edpb-binding-decisions/binding-decision-12024_fr`,
      titre: "Décision contraignante 01/2024 sur un litige",
      date: "2024-01-15",
      pdfUrl: null,
    });
    const { retenus } = choisirVersions([avis, decision]);

    assert.equal(retenus.length, 2);
    assert.deepEqual(
      retenus.map((document) => document.type).sort(),
      ["avis_art64", "decision_art65"],
    );
  });

  it("refuse un fichier qui n'est pas un PDF en nommant l'URL", async () => {
    await assert.rejects(
      extraireTextePdf(new Uint8Array(Buffer.from("pas un pdf")), PDF_URL),
      new RegExp(`${PDF_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*n'est pas un PDF`),
    );
  });

  it("refuse un hôte hors du domaine et un téléchargement non PDF", async () => {
    assert.equal(estUrlAutorisee(PDF_URL), true);
    assert.equal(estUrlAutorisee("https://example.com/x.pdf"), false);
    assert.equal(estUrlAutorisee("https://web.archive.org/web/2026/x", ["edpb.europa.eu"]), false);
    assert.equal(
      estUrlAutorisee("https://web.archive.org/web/2026/x", ["edpb.europa.eu", "web.archive.org"]),
      true,
    );

    const racine = racineTemporaire();
    try {
      await assert.rejects(
        telechargerPdf("https://example.com/x.pdf", join(racine, "x.pdf"), { dryRun: true }),
        /hors du domaine autorisé/,
      );
      await assert.rejects(
        telechargerPdf(PDF_URL, join(racine, "x.pdf"), {
          dryRun: true,
          fetchPdf: async () => ({
            ok: true,
            status: 200,
            arrayBuffer: async () => new TextEncoder().encode("pas un pdf").buffer,
          }),
        }),
        /n'est pas un PDF/,
      );
      assert.equal(estPdf(PDF), true);
      assert.equal(estPdf(new Uint8Array([1, 2, 3])), false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});

describe("la synchronisation CEPD", () => {
  it("écrit le corpus après extraction et compte les versions et les sans-PDF", async () => {
    const racine = racineTemporaire();
    try {
      const document = documentPrepare("Lignes directrices 01/2023 sur l'article 37");
      const parDocument = unitesCePd(document, TEXTE, DESCRIPTEUR).length;
      const resultat = await syncCePd({
        rootDir: racine,
        date: DATE,
        fetchHtml: fauxHtml(SYNC_PAGES),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });

      assert.equal(resultat.pages, 1);
      assert.equal(resultat.documents, 4);
      assert.equal(resultat.fragments, parDocument * 4);
      assert.equal(resultat.versionsEcartees, 0);
      assert.equal(resultat.documentsSansTexte, 1);
      assert.equal(resultat.ecrit, true);

      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as ManifesteCePd;
      assert.equal(manifeste.corpus, "cepd");
      assert.equal(manifeste.via, "sitemap");
      assert.deepEqual(manifeste.sitemap_pages, [`${DESCRIPTEUR.url_sitemap}?page=1`]);
      assert.equal(manifeste.documents, 4);
      assert.equal(manifeste.fragments, parDocument * 4);
      assert.equal(manifeste.versions_ecartees, 0);
      assert.equal(manifeste.documents_sans_texte_ecartes, 1);
      assert.deepEqual(manifeste.couverture.documents_ecartes, [
        {
          url: SITEMAP_DOC_04,
          slug: "guidelines-042025-pseudonymisation",
          type: "lignes_directrices",
          raison: "PDF absent",
        },
      ]);
      assert.deepEqual(manifeste.types_retenus, ["lignes_directrices", "recommandation"]);
      assert.equal(manifeste.comptes_par_type.lignes_directrices.documents, 3);
      assert.equal(
        manifeste.comptes_par_type.lignes_directrices.fragments,
        parDocument * 3,
      );
      assert.equal(manifeste.comptes_par_type.recommandation.documents, 1);
      assert.equal(manifeste.comptes_par_type.recommandation.fragments, parDocument);
      assert.equal(manifeste.comptes_par_type.avis_art64.documents, 0);
      assert.equal(manifeste.langues_pdf.fr, 4);
      assert.equal(manifeste.langues_pdf.en, 0);
      assert.equal(manifeste.langues_pdf.autre, 0);
      assert.deepEqual(Object.keys(manifeste.documents_langues).sort(), [
        "guidelines-012023-article-37-law-enforcement-directive",
        "guidelines-022024-article-48-gdpr",
        "guidelines-032021-application-article-651a-gdpr",
        "recommendation-012024",
      ]);
      // Le sitemap de la fixture ne porte pas de lastmod ; les cartes existent
      // pour les mêmes slugs que les types, et la signature y est l'état publié.
      assert.deepEqual(
        Object.keys(manifeste.documents_versions).sort(),
        Object.keys(manifeste.documents_types).sort(),
      );
      assert.deepEqual(
        Object.keys(manifeste.couverture.documents_lastmod).sort(),
        Object.keys(manifeste.documents_types).sort(),
      );
      assert.equal(
        Object.values(manifeste.documents_versions).every((signature) => signature === "finale"),
        true,
      );
      assert.equal(
        Object.values(manifeste.documents_lastmod).every((lastmod) => lastmod === null),
        true,
      );
      assert.equal(manifeste.couverture.pages_lues, 1);
      assert.equal(manifeste.couverture.periode.date_min, "2021-05-01");
      assert.equal(manifeste.couverture.periode.date_max, "2024-06-20");
      assert.match(manifeste.licence, /Régime ouvert/);

      const unites = readFileSync(
        join(racine, "data", "corpus", "cepd", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);
      assert.equal(unites.length, parDocument * 4);
      assert.equal(new Set(unites.map((unite) => unite.document)).size, 4);
      assert.equal(existsSync(join(racine, "data", "raw", "cepd")), true);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("consigne la version et le lastmod de chaque document retenu", async () => {
    const racine = racineTemporaire();
    const slug = "guidelines-012023-article-37-law-enforcement-directive";
    const pages = new Map<string, string>([
      [DESCRIPTEUR.url_sitemap, SITEMAP_INDEX],
      [
        `${DESCRIPTEUR.url_sitemap}?page=1`,
        `<urlset><url><loc>${SITEMAP_DOC_01}</loc>` +
          "<lastmod>2026-11-12</lastmod></url></urlset>",
      ],
      [
        SITEMAP_DOC_01,
        pageDocumentHtml(
          "01/2023 sur l'article 37 - Version 2.0",
          "2023-09-15",
          "/system/files/documents/2023/g012023_fr.pdf",
        ),
      ],
    ]);
    try {
      await syncCePd({
        rootDir: racine,
        date: DATE,
        fetchHtml: fauxHtml(pages),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as ManifesteCePd;

      assert.deepEqual(manifeste.documents_types, { [slug]: "lignes_directrices" });
      assert.deepEqual(manifeste.documents_versions, { [slug]: "2.0" });
      assert.deepEqual(manifeste.documents_lastmod, { [slug]: "2026-11-12" });
      assert.deepEqual(manifeste.couverture.documents_versions, { [slug]: "2.0" });
      assert.deepEqual(manifeste.couverture.documents_lastmod, { [slug]: "2026-11-12" });
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("le corpus commité porte les comptes de son manifeste", () => {
    const racine = fileURLToPath(new URL("..", import.meta.url));
    const manifeste = JSON.parse(
      readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
    ) as ManifesteCePd;
    const unites = readFileSync(join(racine, "data", "corpus", "cepd", "unites.jsonl"), "utf8")
      .split("\n")
      .filter((ligne) => ligne !== "")
      .map((ligne) => JSON.parse(ligne) as Unite);

    assert.equal(unites.length, manifeste.fragments);
    assert.equal(new Set(unites.map((unite) => unite.document)).size, manifeste.documents);
    assert.equal(manifeste.via, "sitemap");
    assert.equal(manifeste.couverture.via, "sitemap");
    assert.equal(manifeste.sitemap_pages.length, 5);
    assert.equal(manifeste.documents, 330);
    assert.equal(manifeste.fragments, 20509);
    assert.deepEqual(manifeste.types_retenus, [
      "lignes_directrices",
      "avis_art64",
      "avis_legislatif",
      "decision_art65",
      "recommandation",
      "g29_repris",
    ]);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(manifeste.comptes_par_type).map(([type, compte]) => [
          type,
          [compte.documents, compte.fragments],
        ]),
      ),
      {
        lignes_directrices: [43, 6914],
        avis_art64: [263, 7770],
        avis_legislatif: [2, 222],
        decision_art65: [12, 4571],
        recommandation: [9, 841],
        g29_repris: [1, 191],
      },
    );
    assert.equal(manifeste.documents_sans_texte_ecartes, 10);
    assert.equal(manifeste.versions_ecartees, 3);
    assert.equal(manifeste.couverture.documents_ecartes.length, 22);
    assert.equal(
      manifeste.couverture.documents_ecartes.filter(
        (document) => document.source === "endossement",
      ).length,
      9,
    );
    assert.deepEqual(manifeste.langues_pdf, { fr: 156, en: 174, autre: 0 });
    assert.equal(manifeste.couverture.periode.date_min, "2018-04-11");
    assert.equal(manifeste.couverture.periode.date_max, "2026-11-10");
    assert.match(manifeste.licence, /Régime ouvert/);
    assert.deepEqual(manifeste.g29?.comptes, {
      listes: 16,
      retenus: 6,
      successeurs: 5,
      ecartes: 10,
    });
    assert.equal(
      manifeste.g29?.documents.find((document) => document.wp === "WP256")?.document,
      "recommendations-12022-on-the-application-for-approval-and-on-the-elements",
    );
    assert.equal(
      manifeste.g29?.documents.find((document) => document.wp === "WP260")?.type,
      "g29_repris",
    );
    assert.equal(
      manifeste.g29?.documents.find((document) => document.wp === "WP244")?.successeur,
      true,
    );
    assert.equal(
      manifeste.documents_types["guidelines-052020-on-consent-under-regulation-2016679"],
      "lignes_directrices",
    );
    assert.equal(
      unites.filter((unite) => unite.statut === "projet").length,
      1268,
    );
    assert.equal(
      new Set(
        unites.filter((unite) => unite.statut === "projet").map((unite) => unite.document),
      ).size,
      7,
    );
    assert.ok(
      manifeste.couverture.documents_ecartes.every(
        (document) => document.raison.trim() !== "",
      ),
    );
    assert.doesNotThrow(() => validerUnites(unites));
  });

  it("retient le texte anglais quand la page française n'existe pas", async () => {
    const racine = racineTemporaire();
    const avisEn =
      `${BASE}/documents/opinion-of-the-board-art-64/opinion-012024-on-a-draft-decision_en`;
    const page = [
      "<html><body><main>",
      "<h1>Opinion 01/2024 on a draft decision</h1>",
      '<time datetime="2024-01-15T12:00:00Z">15 January 2024</time>',
      // PDF sans suffixe de langue : la page anglaise décide du repli.
      '<a href="/system/files/documents/2024/opinion_012024.pdf">Download</a>',
      "</main></body></html>",
    ].join("");
    const pages = new Map<string, string>([
      [DESCRIPTEUR.url_sitemap, SITEMAP_INDEX],
      [
        `${DESCRIPTEUR.url_sitemap}?page=1`,
        "<urlset>" +
          `<url><loc>${avisEn}</loc></url>` +
          "</urlset>",
      ],
      [avisEn, page],
    ]);
    try {
      await syncCePd({
        rootDir: racine,
        date: DATE,
        fetchHtml: fauxHtml(pages),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as ManifesteCePd;
      const unites = readFileSync(
        join(racine, "data", "corpus", "cepd", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);

      assert.equal(manifeste.documents, 1);
      assert.equal(manifeste.comptes_par_type.avis_art64.documents, 1);
      assert.deepEqual(manifeste.langues_pdf, { fr: 0, en: 1, autre: 0 });
      assert.deepEqual(manifeste.documents_langues, {
        "opinion-012024-on-a-draft-decision": "en",
      });
      assert.equal(manifeste.types_retenus.includes("avis_art64"), true);
      assert.match(unites[0]?.chemin ?? "", /^CEPD > Avis art\. 64 > /);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("rapproche la liste d'endossement du G29 et consigne les documents hors site", async () => {
    const racine = racineTemporaire();
    const consentement =
      `${BASE}/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_fr`;
    // Un avis homonyme 05/2020 ne doit pas capter le document du G29.
    const avis =
      `${BASE}/documents/opinion-of-the-board-art-64/opinion-052020-on-a-draft-decision_en`;
    const endossement = [
      "<ul>",
      '<li><a href="/our-work-tools/our-documents/guidelines/edpb-guidelines-052020-consent-under-regulation-2016679_en">',
      "Guidelines on consent under Regulation 2016/679, WP259 rev.01</a></li>",
      '<li><a href="https://ec.europa.eu/newsroom/article29/items/611236">',
      "Guidelines on Data Protection Impact Assessment (DPIA), WP248</a></li>",
      "</ul>",
    ].join("");
    const pages = new Map<string, string>([
      [DESCRIPTEUR.url_sitemap, SITEMAP_INDEX],
      [
        `${DESCRIPTEUR.url_sitemap}?page=1`,
        `<urlset><url><loc>${consentement}</loc></url><url><loc>${avis}</loc></url></urlset>`,
      ],
      [
        consentement,
        pageDocumentHtml(
          "05/2020 sur le consentement",
          "2020-05-04",
          "/system/files/documents/2020/g052020_fr.pdf",
        ),
      ],
      [
        avis,
        [
          "<html><body><main>",
          "<h1>Opinion 05/2020 on a draft decision</h1>",
          '<time datetime="2020-05-04T12:00:00Z">4 May 2020</time>',
          '<a href="/system/files/documents/2020/opinion_052020_en.pdf">Download</a>',
          "</main></body></html>",
        ].join(""),
      ],
      [DESCRIPTEUR.url_endossement ?? "", endossement],
    ]);
    try {
      await syncCePd({
        rootDir: racine,
        date: DATE,
        fetchHtml: fauxHtml(pages),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as ManifesteCePd;

      assert.equal(manifeste.g29?.comptes.listes, 2);
      assert.equal(manifeste.g29?.comptes.retenus, 1);
      assert.equal(manifeste.g29?.comptes.successeurs, 1);
      assert.equal(manifeste.g29?.comptes.ecartes, 1);
      assert.equal(manifeste.g29?.documents[0]?.statut, "retenu");
      assert.equal(manifeste.g29?.documents[0]?.successeur, true);
      assert.equal(
        manifeste.g29?.documents[0]?.document,
        "guidelines-052020-on-consent-under-regulation-2016679",
      );
      assert.equal(manifeste.g29?.documents[1]?.statut, "ecarte");
      assert.match(manifeste.g29?.documents[1]?.raison ?? "", /hors du site du CEPD/);
      const wp248 = manifeste.couverture.documents_ecartes.find(
        (document) => document.slug === "wp248",
      );
      assert.equal(wp248?.source, "endossement");
      assert.equal(wp248?.type, "g29_repris");
      assert.equal(manifeste.documents, 2);
      assert.deepEqual(manifeste.documents_types, {
        "guidelines-052020-on-consent-under-regulation-2016679": "lignes_directrices",
        "opinion-052020-on-a-draft-decision": "avis_art64",
      });
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("écarte une page illisible et un PDF absent sans perdre les autres", async () => {
    const racine = racineTemporaire();
    const lisible = `${BASE}/documents/recommendation/recommendation-012024_fr`;
    const illisible = `${BASE}/documents/recommendation/recommendation-022024_fr`;
    const sansPdf = `${BASE}/documents/recommendation/recommendation-032024_fr`;
    const pages = new Map<string, string>([
      [DESCRIPTEUR.url_sitemap, SITEMAP_INDEX],
      [
        `${DESCRIPTEUR.url_sitemap}?page=1`,
        "<urlset>" +
          `<url><loc>${lisible}</loc></url>` +
          `<url><loc>${illisible}</loc></url>` +
          `<url><loc>${sansPdf}</loc></url>` +
          "</urlset>",
      ],
      [
        lisible,
        pageDocumentHtml("01/2024 sur un référentiel", "2024-02-01", "/system/files/2024/r012024_fr.pdf"),
      ],
      [sansPdf, pageDocumentHtml("03/2024 sur un référentiel", "2024-03-01", null)],
    ]);
    try {
      const resultat = await syncCePd({
        rootDir: racine,
        date: DATE,
        fetchHtml: fauxHtml(pages),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as ManifesteCePd;

      assert.equal(resultat.documents, 1);
      assert.equal(resultat.documentsSansTexte, 2);
      const raisons = new Map(
        manifeste.couverture.documents_ecartes.map((document) => [
          document.slug,
          document.raison,
        ]),
      );
      assert.match(raisons.get("recommendation-022024") ?? "", /page illisible/);
      assert.equal(raisons.get("recommendation-032024"), "PDF absent");
      assert.ok(
        manifeste.couverture.documents_ecartes.every(
          (document) => document.type === "recommandation",
        ),
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("applique --limite après la sélection des versions", async () => {
    const racine = racineTemporaire();
    try {
      const document = documentPrepare("Lignes directrices 01/2023 sur l'article 37");
      const parDocument = unitesCePd(document, TEXTE, DESCRIPTEUR).length;
      const resultat = await syncCePd({
        rootDir: racine,
        date: DATE,
        limite: 3,
        fetchHtml: fauxHtml(SYNC_PAGES),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });

      assert.equal(resultat.documents, 2);
      assert.equal(resultat.fragments, parDocument * 2);
      assert.equal(resultat.documentsSansTexte, 1);
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as ManifesteCePd;
      assert.equal(manifeste.limite, 3);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("applique --depuis avant la sélection des versions", async () => {
    const racine = racineTemporaire();
    try {
      const document = documentPrepare("Lignes directrices 01/2023 sur l'article 37");
      const parDocument = unitesCePd(document, TEXTE, DESCRIPTEUR).length;
      const resultat = await syncCePd({
        rootDir: racine,
        date: DATE,
        depuis: "2024-01-01",
        fetchHtml: fauxHtml(SYNC_PAGES),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });

      assert.equal(resultat.documents, 2);
      assert.equal(resultat.fragments, parDocument * 2);
      assert.equal(resultat.documentsSansTexte, 1);
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as ManifesteCePd;
      assert.equal(manifeste.depuis, "2024-01-01");
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ne réécrit rien au second passage", async () => {
    const racine = racineTemporaire();
    try {
      const options = {
        rootDir: racine,
        date: DATE,
        fetchHtml: fauxHtml(SYNC_PAGES),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      };
      await syncCePd(options);
      const chemins = [
        join(racine, "data", "corpus", "cepd", "unites.jsonl"),
        join(racine, "data", "corpus", "cepd", "manifest.json"),
      ];
      const avant = chemins.map((chemin) => statSync(chemin).mtimeMs);

      const second = await syncCePd(options);

      assert.equal(second.ecrit, false);
      assert.deepEqual(
        chemins.map((chemin) => statSync(chemin).mtimeMs),
        avant,
        "aucun fichier ne doit être réécrit",
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ne crée aucun fichier en dry-run", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncCePd({
        rootDir: racine,
        date: DATE,
        dryRun: true,
        fetchHtml: fauxHtml(SYNC_PAGES),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });

      assert.equal(resultat.ecrit, false);
      assert.equal(existsSync(join(racine, "data")), false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("bascule entièrement sur Wayback quand le direct répond 503", async () => {
    const racine = racineTemporaire();
    try {
      const snapshots = (url: string): string =>
        `https://web.archive.org/snap/${encodeURIComponent(url)}`;
      const original = (url: string): string =>
        decodeURIComponent(url.slice("https://web.archive.org/snap/".length));
      const fetchJson: FetchJson = async (api) => {
        const url = new URL(api).searchParams.get("url") ?? "";
        return {
          ok: true,
          status: 200,
          json: async () => ({
            archived_snapshots: { closest: { available: true, url: snapshots(url) } },
          }),
        };
      };
      const fetchHtml: FetchHtml = async (url) => {
        if (url.startsWith("https://web.archive.org/snap/")) {
          const corps = PAGES.get(original(url));
          if (corps !== undefined) return { ok: true, status: 200, text: async () => corps };
        }
        return { ok: false, status: 503, text: async () => "" };
      };
      const fetchPdf: FetchPdf = async (url) => {
        if (url.startsWith("https://web.archive.org/snap/")) {
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () =>
              PDF.buffer.slice(PDF.byteOffset, PDF.byteOffset + PDF.byteLength) as ArrayBuffer,
          };
        }
        return { ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) };
      };
      const resultat = await syncCePd({
        rootDir: racine,
        date: DATE,
        pageMax: 1,
        fetchHtml,
        fetchJson,
        fetchPdf,
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });

      assert.equal(resultat.documents, 3);
      assert.equal(resultat.versionsEcartees, 1);
      assert.equal(resultat.documentsSansTexte, 2);
      assert.equal(resultat.tentatives.some((entree) => entree.via === "wayback"), true);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("dit le blocage et n'écrit rien quand direct et Wayback échouent", async () => {
    const racine = racineTemporaire();
    try {
      const journal: Tentative[] = [];
      await assert.rejects(
        syncCePd({
          rootDir: racine,
          date: DATE,
          tentatives: 2,
          attendre: async () => {},
          delaiMs: 1,
          fetchHtml: async () => ({ ok: false, status: 503, text: async () => "" }),
          fetchJson: async () => ({ ok: false, status: 429, json: async () => ({}) }),
          journal,
        }),
        /Liste CEPD indisponible/,
      );
      assert.equal(existsSync(join(racine, "data")), false);
      assert.equal(journal.length >= 4, true);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});

describe("les documents supplémentaires du CEPD", () => {
  const AVIS_LEGISLATIF =
    `${BASE}/documents/legislative-opinion/opinion-32019-concerning-the-questions-and-answers-on-the-interplay_en`;
  const PAGE_AVIS = [
    "<html><body><main>",
    "<h1>Opinion 3/2019 concerning the Questions and Answers on the interplay between the Clinical Trials Regulation (CTR) and the GDPR</h1>",
    '<time datetime="2019-01-23T12:00:00Z">23 January 2019</time>',
    '<a href="/system/files/documents/files/file1/edpb_opinionctrq_a_final_en.pdf">Download</a>',
    "</main></body></html>",
  ].join("");

  it("ajoute un avis législatif au corpus existant sans toucher aux autres documents", async () => {
    const racine = racineTemporaire();
    const descripteurPath = join(racine, "descripteur.json");
    try {
      await syncCePd({
        rootDir: racine,
        date: DATE,
        fetchHtml: fauxHtml(SYNC_PAGES),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      const avant = readFileSync(
        join(racine, "data", "corpus", "cepd", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);

      writeFileSync(
        descripteurPath,
        JSON.stringify({
          ...DESCRIPTEUR,
          documents_supplementaires: [{ url: AVIS_LEGISLATIF, type: "avis_legislatif" }],
        }),
      );
      const supplementaires = await syncCePd({
        rootDir: racine,
        descripteurPath,
        supplementairesSeulement: true,
        fetchHtml: fauxHtml(new Map([[AVIS_LEGISLATIF, PAGE_AVIS]])),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });

      assert.equal(supplementaires.documents, 5);
      const apres = readFileSync(
        join(racine, "data", "corpus", "cepd", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);
      assert.deepEqual(
        apres.filter((unite) => unite.document !== "opinion-32019-concerning-the-questions-and-answers-on-the-interplay"),
        avant,
        "les documents déjà présents gardent leurs unités",
      );

      const avis = apres.filter(
        (unite) =>
          unite.document === "opinion-32019-concerning-the-questions-and-answers-on-the-interplay",
      );
      assert.ok(avis.length > 0);
      assert.equal(avis[0]?.numero, "Avis 03/2019");
      assert.equal(avis[0]?.date_acte, "2019-01-23");
      assert.match(avis[0]?.chemin ?? "", /^CEPD > Avis législatifs > /);

      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as ManifesteCePd;
      assert.equal(manifeste.documents, 5);
      assert.equal(manifeste.comptes_par_type.avis_legislatif.documents, 1);
      assert.deepEqual(manifeste.couverture.documents_supplementaires, {
        declares: [{ url: AVIS_LEGISLATIF, type: "avis_legislatif" }],
        documents: ["opinion-32019-concerning-the-questions-and-answers-on-the-interplay"],
      });
      assert.equal(manifeste.date_liste, DATE, "la date de la liste d'origine est conservée");
      assert.equal(manifeste.couverture.pages_lues, 0);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("reste idempotent et survit à une synchronisation complète", async () => {
    const racine = racineTemporaire();
    const descripteurPath = join(racine, "descripteur.json");
    const lireUnites = (): Unite[] =>
      readFileSync(join(racine, "data", "corpus", "cepd", "unites.jsonl"), "utf8")
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);
    try {
      await syncCePd({
        rootDir: racine,
        date: DATE,
        fetchHtml: fauxHtml(SYNC_PAGES),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      writeFileSync(
        descripteurPath,
        JSON.stringify({
          ...DESCRIPTEUR,
          documents_supplementaires: [{ url: AVIS_LEGISLATIF, type: "avis_legislatif" }],
        }),
      );
      const ajout = await syncCePd({
        rootDir: racine,
        descripteurPath,
        supplementairesSeulement: true,
        fetchHtml: fauxHtml(new Map([[AVIS_LEGISLATIF, PAGE_AVIS]])),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      assert.equal(ajout.ecrit, true);
      const apresAjout = lireUnites();

      // Rejoué tel quel : rien à ajouter, rien n'est écrit ni demandé au réseau.
      const rejoue = await syncCePd({
        rootDir: racine,
        descripteurPath,
        supplementairesSeulement: true,
        fetchHtml: async () => ({ ok: false, status: 500, text: async () => "" }),
        fetchPdf: async () => ({ ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0) }),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      assert.equal(rejoue.ecrit, false);
      assert.equal(rejoue.documents, 5);
      assert.equal(rejoue.tentatives.length, 0, "aucune requête réseau n'est faite");
      assert.deepEqual(lireUnites(), apresAjout);

      // Une synchronisation complète ne relit pas les documents déclarés hors
      // sitemap : elle conserve leurs unités déjà validées.
      await syncCePd({
        rootDir: racine,
        descripteurPath,
        date: DATE,
        fetchHtml: fauxHtml(SYNC_PAGES),
        fetchPdf: fauxPdf(PDF),
        extraireTexte: async () => TEXTE,
        attendre: async () => {},
        tentatives: 1,
      });
      const apresComplete = lireUnites();
      assert.equal(new Set(apresComplete.map((unite) => unite.document)).size, 5);
      assert.deepEqual(
        apresComplete.filter((unite) => !unite.document.startsWith("opinion-32019")),
        apresAjout.filter((unite) => !unite.document.startsWith("opinion-32019")),
      );
      assert.deepEqual(
        apresComplete.filter((unite) => unite.document.startsWith("opinion-32019")),
        apresAjout.filter((unite) => unite.document.startsWith("opinion-32019")),
        "les unités de l'avis sont conservées à l'identique",
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});
