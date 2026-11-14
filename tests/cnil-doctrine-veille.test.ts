import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import type { DescripteurDoctrine, FetchHtml } from "../mcp/corpus/cnil-doctrine/liste.ts";
import { lireDescripteur } from "../mcp/corpus/cnil-doctrine/liste.ts";
import {
  cleTitre,
  identifiant,
  passeDoctrine,
  urlComparable,
} from "../veille/sources/cnil-doctrine.ts";

const ICI = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = join(ICI, "fixtures", "cnil-doctrine");
const DESCRIPTEUR_REEL = join(ICI, "..", "mcp", "corpus", "cnil-doctrine", "descripteur.json");
const MANIFESTE_REEL = join(ICI, "..", "data", "corpus", "cnil_doctrine", "manifest.json");

const URL_GUIDES = "https://www.cnil.fr/fr/mediatheque?field_scald_collection_tid=29";
const URL_LISTES =
  "https://www.cnil.fr/fr/listes-des-traitements-pour-lesquels-une-aipd-est-requise-ou-non";
const PDF_COLLECTIVITES =
  "https://www.cnil.fr/sites/default/files/2026-11/guide_pratique_rgpd_collectivites_territoriales.pdf";
const TITRE_COLLECTIVITES = "Guide pratique RGPD pour les collectivités territoriales";

function fixture(nom: string): string {
  return readFileSync(join(FIXTURES, nom), "utf8");
}

/** Descripteur réduit à la page de référence demandée : une seule requête par test. */
function descripteur(...references: DescripteurDoctrine["pages_reference"]): DescripteurDoctrine {
  return { ...lireDescripteur(DESCRIPTEUR_REEL), delai_ms: 0, pages_reference: references };
}

const REFERENCE_GUIDES: DescripteurDoctrine["pages_reference"][number] = {
  type: "guide",
  url: URL_GUIDES,
  pages_max: 1,
  liens: "pdf",
};

const REFERENCE_LISTES: DescripteurDoctrine["pages_reference"][number] = {
  type: "liste_aipd",
  url: URL_LISTES,
  pages_max: 1,
  liens: "page",
  motif_page: "aipd",
  motif_pdf: "liste-traitements-aipd",
};

/** Pages servies : la référence demandée, tout le reste en 404. */
function pageFetch(pages: Record<string, string>): FetchHtml {
  return async (url) => {
    const html = pages[url];
    if (html === undefined) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => html };
  };
}

const racines: string[] = [];
after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

type Manifeste = {
  documents_par_type: Record<string, { slug: string; titre: string; url: string }[]>;
  couverts_par_cnil: { type: string; titre: string; url: string }[];
  documents_ecartes: { url: string; titre: string; raison: string }[];
};

function manifesteReel(): Manifeste {
  return JSON.parse(readFileSync(MANIFESTE_REEL, "utf8")) as Manifeste;
}

/** Racine temporaire qui porte le manifeste donné ; `null` n'écrit aucun manifeste. */
function racineAvecManifeste(manifeste: Manifeste | null): string {
  const racine = mkdtempSync(join(tmpdir(), "cnil-doctrine-veille-"));
  racines.push(racine);
  if (manifeste !== null) {
    mkdirSync(join(racine, "data", "corpus", "cnil_doctrine"), { recursive: true });
    writeFileSync(
      join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"),
      `${JSON.stringify(manifeste, null, 2)}\n`,
      "utf8",
    );
  }
  return racine;
}

const PASSE = new Date("2026-11-14T12:00:00.000Z");

function passe(racine: string, descripteurUtilise: DescripteurDoctrine, pages: Record<string, string>) {
  return passeDoctrine({
    rootDir: racine,
    descripteur: descripteurUtilise,
    fetchHtml: pageFetch(pages),
    attendre: async () => {},
    maintenant: PASSE,
  });
}

describe("veille de la doctrine CNIL", () => {
  it("signale un document absent du manifeste comme nouveau", async () => {
    const manifeste = manifesteReel();
    manifeste.documents_par_type.guide = (manifeste.documents_par_type.guide ?? []).filter(
      (document) => cleTitre(document.titre) !== cleTitre(TITRE_COLLECTIVITES),
    );
    const racine = racineAvecManifeste(manifeste);

    const resultat = await passe(racine, descripteur(REFERENCE_GUIDES), {
      [URL_GUIDES]: fixture("mediatheque-guides.html"),
    });

    assert.equal(resultat.entries.length, 1);
    const [entree] = resultat.entries;
    assert.ok(entree !== undefined);
    assert.equal(entree.motif, "nouveau");
    assert.equal(entree.type, "guide");
    assert.equal(entree.document, "guide-pratique-rgpd-collectivites-territoriales");
    assert.equal(entree.id, identifiant("guide-pratique-rgpd-collectivites-territoriales"));
    assert.equal(entree.title, TITRE_COLLECTIVITES);
    assert.equal(entree.officialTitle, TITRE_COLLECTIVITES);
    assert.equal(entree.url, PDF_COLLECTIVITES);
    assert.equal(entree.version, PDF_COLLECTIVITES);
    assert.equal(entree.summary, null, "aucun résumé : le régime ND interdit la reformulation");
    assert.equal(entree.publishedAt, "2026-11-14T12:00:00.000Z");
    assert.equal(entree.source, "cnil_doctrine");
    assert.deepEqual(entree.themes, ["donnees-personnelles"]);
    assert.match(resultat.notes.join(" "), /1 nouveau\(x\)/);
  });

  it("signale une réédition sous une autre URL comme modifiée", async () => {
    const manifeste = manifesteReel();
    const guide = manifeste.documents_par_type.guide?.find(
      (document) => cleTitre(document.titre) === cleTitre(TITRE_COLLECTIVITES),
    );
    assert.ok(guide !== undefined);
    guide.url = "https://cnil.fr/sites/default/files/2025-01/guide_precedent.pdf";
    const racine = racineAvecManifeste(manifeste);

    const resultat = await passe(racine, descripteur(REFERENCE_GUIDES), {
      [URL_GUIDES]: fixture("mediatheque-guides.html"),
    });

    const entree = resultat.entries.find(
      (candidate) => candidate.document === "guide-pratique-rgpd-collectivites-territoriales",
    );
    assert.ok(entree !== undefined);
    assert.equal(entree.motif, "modifie");
    assert.equal(entree.version, PDF_COLLECTIVITES, "l'URL du PDF est la version constatée");
    assert.equal(
      resultat.entries.filter((candidate) => candidate.motif === "modifie").length,
      1,
      "les deux autres guides restent inchangés",
    );
  });

  it("n'écrit rien quand les documents sont déjà au corpus", async () => {
    const racine = racineAvecManifeste(manifesteReel());

    const resultat = await passe(racine, descripteur(REFERENCE_GUIDES), {
      [URL_GUIDES]: fixture("mediatheque-guides.html"),
    });

    assert.deepEqual(resultat.entries, []);
    assert.match(resultat.notes.join(" "), /3 inchangé\(s\)/);
  });

  it("ne signale pas une liste AIPD déjà couverte par le corpus cnil", async () => {
    const racine = racineAvecManifeste(manifesteReel());

    const resultat = await passe(racine, descripteur(REFERENCE_LISTES), {
      [URL_LISTES]: fixture("listes-aipd.html"),
      "https://www.cnil.fr/liste-traitements-aipd-requise": fixture("page-liste-aipd-requise.html"),
      "https://www.cnil.fr/fr/liste-traitements-aipd-non-requise": fixture(
        "page-liste-aipd-requise.html",
      ),
    });

    assert.deepEqual(resultat.entries, []);
    assert.match(resultat.notes.join(" "), /1 couvert\(s\) par le corpus CNIL/);
  });

  it("ne signale pas un document que la synchronisation a écarté", async () => {
    const manifeste = manifesteReel();
    manifeste.documents_ecartes = [
      { url: PDF_COLLECTIVITES, titre: TITRE_COLLECTIVITES, raison: "PDF sans texte" },
    ];
    const racine = racineAvecManifeste(manifeste);

    const resultat = await passe(racine, descripteur(REFERENCE_GUIDES), {
      [URL_GUIDES]: fixture("mediatheque-guides.html"),
    });

    assert.deepEqual(resultat.entries, []);
    assert.match(resultat.notes.join(" "), /1 écarté\(s\) par la synchronisation/);
  });

  it("compte un premier corpus comme entièrement nouveau, sans manifeste", async () => {
    const racine = racineAvecManifeste(null);

    const resultat = await passe(racine, descripteur(REFERENCE_GUIDES), {
      [URL_GUIDES]: fixture("mediatheque-guides.html"),
    });

    assert.equal(resultat.entries.length, 3);
    assert.ok(resultat.entries.every((entree) => entree.motif === "nouveau"));
  });

  it("signale un manifeste illisible plutôt que d'annoncer tout le corpus comme nouveau", async () => {
    const racine = mkdtempSync(join(tmpdir(), "cnil-doctrine-veille-"));
    racines.push(racine);
    mkdirSync(join(racine, "data", "corpus", "cnil_doctrine"), { recursive: true });
    writeFileSync(
      join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"),
      "{ pas du json",
      "utf8",
    );

    await assert.rejects(
      passe(racine, descripteur(REFERENCE_GUIDES), {
        [URL_GUIDES]: fixture("mediatheque-guides.html"),
      }),
      /Manifeste illisible/,
    );
  });

  it("rejette une date de passe hors ISO", async () => {
    const racine = racineAvecManifeste(null);
    await assert.rejects(
      passeDoctrine({
        rootDir: racine,
        descripteur: descripteur(REFERENCE_GUIDES),
        fetchHtml: pageFetch({}),
        attendre: async () => {},
        maintenant: new Date("date invalide"),
      }),
      /Date de passe attendue/,
    );
  });
});

describe("comparaison des documents de doctrine", () => {
  it("compare un intitulé sans casse, diacritiques ni ponctuation", () => {
    assert.equal(
      cleTitre("Guide pratique - Les violations de données dans l’éducation"),
      cleTitre("Guide pratique - Les violations de donnees dans l'education"),
    );
  });

  it("compare une URL de PDF sans www, fragment ni requête", () => {
    assert.equal(
      urlComparable("https://cnil.fr/sites/default/files/guide.pdf#page=2"),
      urlComparable("https://www.cnil.fr/sites/default/files/guide.pdf"),
    );
    assert.notEqual(
      urlComparable("https://www.cnil.fr/sites/default/files/2025-01/guide.pdf"),
      urlComparable("https://www.cnil.fr/sites/default/files/2026-11/guide.pdf"),
    );
  });
});
