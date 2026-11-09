import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  ErreurHttp,
  chargerTexte,
  extraireDocuments,
  listerDocuments,
  listerDocumentsSitemap,
  listerDocumentsWayback,
  normaliserUrlWayback,
  snapshotWayback,
  trouverLienPdf,
} from "../mcp/corpus/cepd/liste.ts";
import type {
  DescripteurCePd,
  FetchHtml,
  FetchJson,
  Tentative,
} from "../mcp/corpus/cepd/liste.ts";
import {
  choisirVersions,
  dateDocument,
  enrichirDocument,
  numeroDepuisTitre,
  preparerDocument,
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
    type: "guideline",
    url: DOC_01,
    titre,
    date,
    pdfUrl: null,
  });
}

describe("la liste CEPD", () => {
  it("extrait les lignes directrices et ignore consultations et autres types", () => {
    const documents = extraireDocuments(PAGE0, URL_LISTE);

    assert.equal(documents.length, 5);
    assert.equal(documents.every((document) => document.type === "guideline"), true);
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

  it("ne garde du sitemap que les URL _fr de documents/guideline", async () => {
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
    assert.equal(liste.documents.length, 4);
    assert.equal(liste.documents.every((document) => document.url.endsWith("_fr")), true);
    assert.equal(
      liste.documents.some(
        (document) => document.url.endsWith("_en") || document.url.endsWith("_de"),
      ),
      false,
    );
    assert.equal(
      liste.documents.some((document) => document.url.includes("/opinion/")),
      false,
    );
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
      numeroDepuisTitre("Lignes directrices 01/2023 sur l'article 37", "guideline"),
      "Guidelines 01/2023",
    );
    assert.equal(
      numeroDepuisTitre("Recommendation 02/2020 on the European Essential Guarantees", "recommendation"),
      "Recommendation 02/2020",
    );
    assert.equal(versionDepuisTitre("Guidelines 01/2023 - Version 2.1"), "2.1");
    assert.equal(
      numeroDepuisTitre(
        "Transparence",
        "guideline",
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
    assert.equal(
      dateDocument({
        type: "guideline",
        url: DOC_01,
        titre: "Lignes directrices 01/2023 du 15 septembre 2023",
        date: null,
        pdfUrl: null,
      }),
      "2023-09-15",
    );
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
  });

  it("enrichit une page de sitemap avec titre, date, version et PDF", () => {
    const document = {
      type: "guideline" as const,
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
      assert.equal(resultat.documents, 3);
      assert.equal(resultat.fragments, parDocument * 3);
      assert.equal(resultat.versionsEcartees, 0);
      assert.equal(resultat.documentsSansTexte, 1);
      assert.equal(resultat.ecrit, true);

      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cepd", "manifest.json"), "utf8"),
      ) as ManifesteCePd;
      assert.equal(manifeste.corpus, "cepd");
      assert.equal(manifeste.via, "sitemap");
      assert.deepEqual(manifeste.sitemap_pages, [`${DESCRIPTEUR.url_sitemap}?page=1`]);
      assert.equal(manifeste.documents, 3);
      assert.equal(manifeste.fragments, parDocument * 3);
      assert.equal(manifeste.versions_ecartees, 0);
      assert.equal(manifeste.documents_sans_texte_ecartes, 1);
      assert.deepEqual(manifeste.types_retenus, ["guideline"]);
      assert.equal(manifeste.langues_pdf.fr, 3);
      assert.equal(manifeste.langues_pdf.en, 0);
      assert.equal(manifeste.langues_pdf.autre, 0);
      assert.equal(manifeste.couverture.pages_lues, 1);
      assert.equal(manifeste.couverture.periode.date_min, "2021-05-01");
      assert.equal(manifeste.couverture.periode.date_max, "2024-06-20");
      assert.match(manifeste.licence, /À vérifier/);

      const unites = readFileSync(
        join(racine, "data", "corpus", "cepd", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);
      assert.equal(unites.length, parDocument * 3);
      assert.equal(new Set(unites.map((unite) => unite.document)).size, 3);
      assert.equal(existsSync(join(racine, "data", "raw", "cepd")), true);
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
    assert.equal(manifeste.documents_sans_texte_ecartes, 6);
    assert.deepEqual(manifeste.langues_pdf, { fr: 36, en: 0, autre: 0 });
    assert.deepEqual(manifeste.types_retenus, ["guideline"]);
    assert.doesNotThrow(() => validerUnites(unites));
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

      assert.equal(resultat.documents, 1);
      assert.equal(resultat.fragments, parDocument);
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
      assert.equal(resultat.documentsSansTexte, 1);
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
