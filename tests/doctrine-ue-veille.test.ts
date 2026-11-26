import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import type { FetchHtml } from "../mcp/corpus/cnil-doctrine/liste.ts";
import type { DescripteurDoctrineUe } from "../mcp/corpus/doctrine-ue/liste.ts";
import { lireDescripteur } from "../mcp/corpus/doctrine-ue/liste.ts";
import { passeDoctrineUe, SOURCE_ID } from "../veille/sources/doctrine-ue.ts";

const ICI = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = join(ICI, "fixtures", "doctrine-ue", "veille");
const DESCRIPTEUR_REEL = join(ICI, "..", "mcp", "corpus", "doctrine-ue", "descripteur.json");

const URL_REFERENCE = "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai";
const URL_POLITIQUE = "https://digital-strategy.ec.europa.eu/en/policies/data-act";
const URL_ETUDE = "https://digital-strategy.ec.europa.eu/en/library/study-on-the-impact-of-ai";
const URL_CONNU =
  "https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-prohibited-artificial-intelligence-ai-practices-defined-ai-act";
const URL_NOUVEAU = "https://digital-strategy.ec.europa.eu/en/library/new-guidelines-sample";
const PDF_NOUVEAU = "https://digital-strategy.ec.europa.eu/sites/default/files/new-sample.pdf";
const URL_ALIAS = "https://digital-strategy.ec.europa.eu/en/library/alias-guidelines-ai-system-definition";
const SOURCE_CONNUE = "https://ec.europa.eu/newsroom/dae/redirection/document/118623";
const URL_DEPLACE = "https://digital-strategy.ec.europa.eu/en/library/guidelines-prohibited-relocated";
const TITRE_SOURCE_ART_5 =
  "Guidelines on prohibited artificial intelligence practices established by Regulation (EU) 2024/1689 (AI Act)";

const PASSE = new Date("2026-11-26T12:00:00.000Z");

function fixture(nom: string): string {
  return readFileSync(join(FIXTURES, nom), "utf8");
}

/** Descripteur réduit à une page de référence : une seule requête de liste par test. */
function descripteur(url: string): DescripteurDoctrineUe {
  return {
    ...lireDescripteur(DESCRIPTEUR_REEL),
    delai_ms: 0,
    liste_reference: [{ titre: "Référence de test", url, consulte_le: "2026-11-25" }],
  };
}

const racines: string[] = [];
after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

/** Racine temporaire sans manifeste : le descripteur seul dit quels documents sont connus. */
function racineTemporaire(): string {
  const racine = mkdtempSync(join(tmpdir(), "doctrine-ue-veille-"));
  racines.push(racine);
  return racine;
}

type PageServie = { html?: string; statut?: number };

type Serveur = { fetchHtml: FetchHtml; demandes: string[] };

/** Pages servies par URL ; une page absente répond 404, sauf statut explicite. */
function serveur(pages: Record<string, PageServie>): Serveur {
  const demandes: string[] = [];
  return {
    demandes,
    fetchHtml: async (url) => {
      demandes.push(url);
      const page = pages[url];
      if (page?.html === undefined) {
        return { ok: false, status: page?.statut ?? 404, text: async () => "" };
      }
      return { ok: true, status: page.statut ?? 200, text: async () => page.html ?? "" };
    },
  };
}

function passe(
  url: string,
  pages: Record<string, PageServie>,
): { resultat: ReturnType<typeof passeDoctrineUe>; demandes: string[] } {
  const { fetchHtml, demandes } = serveur(pages);
  const resultat = passeDoctrineUe({
    rootDir: racineTemporaire(),
    descripteur: descripteur(url),
    fetchHtml,
    attendre: async () => {},
    maintenant: PASSE,
  });
  return { resultat, demandes };
}

describe("veille de la doctrine de la Commission", () => {
  it("signale un document inconnu listé comme nouveau", async () => {
    const { resultat, demandes } = passe(URL_REFERENCE, {
      [URL_REFERENCE]: { html: fixture("reference-nouveau.html") },
      [URL_NOUVEAU]: { html: fixture("document-nouveau.html") },
    });

    const r = await resultat;
    assert.equal(r.entries.length, 1);
    const [entree] = r.entries;
    assert.ok(entree !== undefined);
    assert.equal(entree.motif, "nouveau");
    assert.equal(entree.source, SOURCE_ID);
    assert.equal(entree.url, URL_NOUVEAU);
    assert.equal(entree.title, "Guidelines on sample obligations");
    assert.equal(entree.officialTitle, "Guidelines on sample obligations");
    assert.equal(entree.document, "new-guidelines-sample");
    assert.equal(entree.summary, null);
    assert.ok(entree.themes.length > 0);
    assert.deepEqual(entree.publishedAt, "2026-11-26T12:00:00.000Z");
    assert.equal(
      entree.version,
      createHash("sha256").update(PDF_NOUVEAU, "utf8").digest("hex").slice(0, 16),
      "les liens de téléchargement triés sont l'empreinte du document",
    );
    assert.deepEqual(demandes.sort(), [URL_REFERENCE, URL_NOUVEAU].sort());
  });

  it("ignore un document déjà déclaré au descripteur", async () => {
    const { resultat, demandes } = passe(URL_REFERENCE, {
      [URL_REFERENCE]: { html: fixture("reference-connu.html") },
    });

    const r = await resultat;
    assert.deepEqual(r.entries, []);
    assert.match(r.notes.join(" "), /0 nouveau\(x\)/);
    assert.match(r.notes.join(" "), /1 inchangé\(s\)/);
    assert.deepEqual(demandes, [URL_REFERENCE], "un document connu ne relit pas sa page");
  });

  it("ignore une page de politique et un intitulé hors motif, sans les demander", async () => {
    const { resultat, demandes } = passe(URL_REFERENCE, {
      [URL_REFERENCE]: { html: fixture("reference-bruit.html") },
    });

    const r = await resultat;
    assert.deepEqual(r.entries, []);
    assert.ok(!demandes.includes(URL_POLITIQUE), "la page de politique n'est pas une page de document");
    assert.ok(!demandes.includes(URL_ETUDE), "un intitulé sans motif de document ne produit rien");
    assert.deepEqual(demandes, [URL_REFERENCE]);
  });

  it("déclare en échec une page de référence bloquée, sans contournement", async () => {
    const bloque = passe(URL_REFERENCE, { [URL_REFERENCE]: { statut: 403 } });
    await assert.rejects(bloque.resultat, /HTTP 403/);

    const defi = passe(URL_REFERENCE, {
      [URL_REFERENCE]: {
        html:
          "<html><body><main><p>Access check: are you a robot? Please enable JavaScript " +
          "in your browser and reload this page to reach the requested Commission content.</p>" +
          "</main></body></html>",
      },
    });
    await assert.rejects(defi.resultat, /défi|accès refusé/);
  });

  it("ignore une page qui ne publie qu'un fichier déjà connu", async () => {
    const { resultat } = passe(URL_REFERENCE, {
      [URL_REFERENCE]: { html: fixture("reference-alias.html") },
      [URL_ALIAS]: { html: fixture("document-alias.html") },
    });

    const r = await resultat;
    assert.deepEqual(r.entries, []);
    assert.match(r.notes.join(" "), /1 alias ignoré\(s\)/);
    assert.ok(
      fixture("document-alias.html").includes(SOURCE_CONNUE),
      "l'alias pointe la source connue d'un document du descripteur",
    );
  });

  it("signale comme modifié un intitulé connu servi sous une autre URL", async () => {
    const { resultat } = passe(URL_REFERENCE, {
      [URL_REFERENCE]: { html: fixture("reference-modifie.html") },
      [URL_DEPLACE]: { html: fixture("document-modifie.html") },
    });

    const r = await resultat;
    assert.equal(r.entries.length, 1);
    const [entree] = r.entries;
    assert.ok(entree !== undefined);
    assert.equal(entree.motif, "modifie");
    assert.equal(entree.url, URL_DEPLACE);
    assert.equal(entree.title, TITRE_SOURCE_ART_5);
    assert.equal(entree.version, URL_DEPLACE, "sans fichier, la page est la version constatée");
  });

  it("rejette une page de référence qui ne liste plus aucun document", async () => {
    const { resultat } = passe(URL_REFERENCE, {
      [URL_REFERENCE]: { html: fixture("reference-vide.html") },
    });

    await assert.rejects(resultat, /Aucun document de doctrine listé/);
  });
});
