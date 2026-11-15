import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { normaliser } from "../mcp/embed/embedder.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { buildIndex } from "../mcp/index/build.ts";
import { openIndex } from "../mcp/index/search.ts";
import type { Index } from "../mcp/index/search.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import { search } from "../mcp/tools.ts";
import type { Unite } from "../mcp/corpus/parse.ts";
import { AVERTISSEMENT_METADONNEES, avecMarquageMetadonnees } from "../mcp/corpus/metadonnees/mention.ts";
import {
  classerRegistre,
  fusionnerCedh,
  lirePageCedh,
  lireRegistre,
  totalRegistre,
  unitesCedh,
  unitesRegistre,
  urlRequeteCedh,
  validerNotices,
} from "../mcp/corpus/metadonnees/liste.ts";
import type {
  DescripteurMetadonnees,
  EntreeCedh,
  EntreeRegistre,
} from "../mcp/corpus/metadonnees/liste.ts";
import { lireDescripteurMetadonnees, syncMetadonnees } from "../mcp/corpus/metadonnees/sync.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURES = join(ROOT, "tests", "fixtures", "metadonnees");

const DESCRIPTEUR: DescripteurMetadonnees = lireDescripteurMetadonnees(
  join(ROOT, "mcp", "corpus", "metadonnees", "descripteur.json"),
);

function fixture(nom: string): string {
  return readFileSync(join(FIXTURES, nom), "utf8");
}

/** Phrase du corps d'un arrêt : elle ne doit jamais entrer au corpus. */
const CORPS_ARRET = "LA COUR, après avoir délibéré";

const racines: string[] = [];

function racineTemporaire(): string {
  const racine = mkdtempSync(join(tmpdir(), "vitrine-metadonnees-"));
  racines.push(racine);
  return racine;
}

after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

/** Embedder factice : tous les textes reçoivent le même vecteur, donc la similarité 1. */
function embedderUniforme(): Embedder {
  const vecteur = normaliser(new Array<number>(8).fill(0.5));
  return {
    model: "factice",
    dim: 8,
    embedPassages: async (textes) => textes.map(() => vecteur),
    embedQuery: async () => vecteur,
  };
}

function fiche(champs: Partial<EntreeCedh>): EntreeCedh {
  return {
    itemid: "001-000000",
    docname: "AFFAIRE TEST c. FRANCE",
    appno: "1234/15",
    date: "2020-01-01",
    branche: "CHAMBER",
    langue: "FRE",
    doctype: "HFJUD",
    ...champs,
  };
}

describe("le critère CEDH", () => {
  const page = lirePageCedh(JSON.parse(fixture("hudoc.json")) as unknown);

  it("lit une page HUDOC réelle : total annoncé et fiches", () => {
    assert.equal(page.total, 5);
    assert.equal(page.entrees.length, 5);
    const marper = page.entrees.find((entree) => entree.itemid === "001-90052");
    assert.ok(marper !== undefined);
    assert.equal(marper.appno, "30562/04;30566/04");
    assert.equal(marper.date, "2008-12-04");
    assert.equal(marper.langue, "FRE");
    assert.equal(marper.branche, "GRANDCHAMBER");
  });

  it("porte le critère déclaré dans la requête : article 8, mots-clés, collections, langues", () => {
    const url = new URL(urlRequeteCedh(DESCRIPTEUR, 500, 500));
    const requete = url.searchParams.get("query") ?? "";
    assert.match(requete, /article:8/);
    for (const mot of DESCRIPTEUR.cedh.mots_cles) {
      assert.ok(requete.includes(`"${mot}"`) || requete.includes(mot), mot);
    }
    assert.match(requete, /documentcollectionid2:"JUDGMENTS" OR documentcollectionid2:"DECISIONS"/);
    assert.match(requete, /languageisocode:"FRE" OR languageisocode:"ENG"/);
    assert.equal(requete.includes("COMMUNICATEDCASES"), false);
    assert.equal(url.searchParams.get("start"), "500");
    assert.equal(url.searchParams.get("length"), "500");
  });

  it("retient les cinq affaires de référence et écarte une communication", () => {
    const fiches: EntreeCedh[] = [
      ...DESCRIPTEUR.cedh.cas_connus_retenus.map((appno, index) =>
        fiche({ itemid: `001-00000${index}`, appno, date: "2020-01-01" }),
      ),
      fiche({ itemid: "001-999999", appno: "9999/20", branche: "COMMUNICATEDCASES" }),
    ];
    const { decisions, ecartes } = fusionnerCedh(fiches, DESCRIPTEUR);
    assert.equal(decisions.length, DESCRIPTEUR.cedh.cas_connus_retenus.length);
    assert.equal(ecartes.communication, 1);
    assert.equal(ecartes.commission, 0);
  });

  it("fusionne les versions française et anglaise en une décision, la française gagnant", () => {
    const { decisions, ecartes } = fusionnerCedh(page.entrees, DESCRIPTEUR);
    assert.equal(decisions.length, 2);
    assert.deepEqual(
      decisions.map((decision) => [decision.appno, decision.langue]),
      [
        ["30562/04;30566/04", "FRE"],
        ["58170/13;62322/14;24960/15", "FRE"],
      ],
    );
    // La décision de l'ancienne Commission est écartée, avec son motif.
    assert.equal(ecartes.commission, 1);
  });

  it("ignore un corps de décision servi dans les colonnes de la fiche", () => {
    const page = JSON.parse(fixture("hudoc.json")) as {
      resultcount: number;
      results: Array<{ columns: Record<string, string> }>;
    };
    const premiere = page.results[0];
    assert.ok(premiere !== undefined);
    const chargee = {
      ...page,
      results: [{ columns: { ...premiere.columns, text: CORPS_ARRET } }, ...page.results.slice(1)],
    };
    const unites = unitesCedh(fusionnerCedh(lirePageCedh(chargee).entrees, DESCRIPTEUR).decisions, DESCRIPTEUR);
    assert.ok(unites.length > 0);
    for (const unite of unites) assert.equal(unite.texte.includes(CORPS_ARRET), false);
  });

  it("écarte une langue hors périmètre et une date invalide en les nommant", () => {
    const { decisions, ecartes, exclusions } = fusionnerCedh(
      [
        fiche({ itemid: "001-1", appno: "1/01", langue: "RUS" }),
        fiche({ itemid: "001-2", appno: "2/02", date: "2020-02-30" }),
        fiche({ itemid: "001-3", appno: "" }),
      ],
      DESCRIPTEUR,
    );
    assert.deepEqual(decisions, []);
    assert.equal(ecartes.langue_hors_perimetre, 1);
    assert.equal(ecartes.date_invalide, 1);
    assert.equal(ecartes.reference_absente, 1);
    assert.deepEqual(
      exclusions.map((exclusion) => exclusion.motif).sort(),
      ["date_invalide", "langue_hors_perimetre", "reference_absente"],
    );
  });

  it("rend une notice par décision : statut, nature, lien officiel, sans texte", () => {
    const { decisions } = fusionnerCedh(page.entrees, DESCRIPTEUR);
    const unites = unitesCedh(decisions, DESCRIPTEUR);
    assert.equal(unites.length, 2);
    const marper = unites.find((unite) => unite.document === "30562/04;30566/04");
    assert.ok(marper !== undefined);
    assert.equal(marper.ref, "30562/04;30566/04#2008-12-04");
    assert.equal(marper.numero, "30562/04;30566/04");
    assert.equal(marper.niveau, "notice");
    assert.equal(marper.statut, "Arrêt");
    assert.equal(marper.nature, "juridiction");
    assert.equal(marper.metadonnees_seulement, true);
    assert.equal(marper.date_acte, "2008-12-04");
    assert.equal(marper.url, "https://hudoc.echr.coe.int/fre?i=001-90052");
    assert.equal(marper.titre, "AFFAIRE S. ET MARPER c. ROYAUME-UNI");
    assert.equal(marper.autorite, DESCRIPTEUR.cedh.autorite);
    assert.equal(
      marper.texte,
      "AFFAIRE S. ET MARPER c. ROYAUME-UNI — Cour européenne des droits de l'homme " +
        "(Grande chambre) — 2008-12-04 — requête 30562/04;30566/04",
    );
  });
});

describe("le registre du guichet unique", () => {
  const html = fixture("registre.html");
  const lignes = lireRegistre(html, DESCRIPTEUR);

  it("lit le total annoncé et une ligne par décision", () => {
    assert.equal(totalRegistre(html), 1603);
    assert.deepEqual(
      lignes.map((ligne) => ligne.id),
      ["EDPBI:EE:OSS:D:2024:1561", "EDPBI:IE:OSS:D:2024:1557", "EDPBI:IE:OSS:D:2024:1559"],
    );
  });

  it("prend l'identifiant, la date, l'autorité chef de file et le lien du PDF officiel", () => {
    const premiere = lignes[0];
    assert.ok(premiere !== undefined);
    assert.equal(premiere.date, "2024-12-18");
    assert.equal(premiere.pays, "ee");
    assert.match(premiere.url, /^https:\/\/www\.edpb\.europa\.eu\/system\/files\/.+\.pdf$/);
    assert.equal(premiere.lien, "pdf");
    assert.ok(premiere.sujets.length > 0);
  });

  it("lit un PDF servi en majuscules et garde deux décisions sous un même identifiant", () => {
    const html = `<div class="view-foss-decisions-overview-overview__row">
      <div class="foss-decision-teaser__summary">
        <div class="foss-decision-foss-decision-teaser__id">EDPBI:NO:OSS:D:2023:850</div>
        <time datetime="2023-06-01T12:00:00Z">1 juin 2023</time>
        <div class="foss-decision-foss-decision-teaser__lead-sa">
          <div class="member-country-token__code">no</div>
        </div>
        <a href="/system/files/2024-03/no-sa-2023-june-decisionpublic.PDF">PDF</a>
      </div></div>
      <div class="view-foss-decisions-overview-overview__row">
      <div class="foss-decision-teaser__summary">
        <div class="foss-decision-foss-decision-teaser__id">EDPBI:SE:OSS:D:2024:1</div>
        <time datetime="2024-02-01T12:00:00Z">1 février 2024</time>
        <div class="foss-decision-foss-decision-teaser__lead-sa">
          <div class="member-country-token__code">se</div>
        </div>
      </div></div>
      <div class="view-foss-decisions-overview-overview__row">
      <div class="foss-decision-teaser__summary">
        <div class="foss-decision-foss-decision-teaser__id">EDPBI:IE:OSS:D:2025:3850</div>
        <time datetime="2025-11-04T12:00:00Z">4 novembre 2025</time>
        <div class="foss-decision-foss-decision-teaser__lead-sa">
          <div class="member-country-token__code">ie</div>
        </div>
        <a href="/system/files/2026-11/decision-no-3850.pdf">PDF</a>
      </div></div>
      <div class="view-foss-decisions-overview-overview__row">
      <div class="foss-decision-teaser__summary">
        <div class="foss-decision-foss-decision-teaser__id">EDPBI:IE:OSS:D:2025:3850</div>
        <time datetime="2025-11-04T12:00:00Z">4 novembre 2025</time>
        <div class="foss-decision-foss-decision-teaser__lead-sa">
          <div class="member-country-token__code">ie</div>
        </div>
        <a href="/system/files/2026-11/decision-no-3851_1.pdf">PDF</a>
      </div></div>`;
    const lignes = lireRegistre(html, DESCRIPTEUR);
    assert.equal(lignes[0]?.url, "https://www.edpb.europa.eu/system/files/2024-03/no-sa-2023-june-decisionpublic.PDF");
    // Une ligne sans PDF garde la page du registre filtrée sur son identifiant.
    assert.equal(lignes[1]?.lien, "registre");
    assert.equal(
      lignes[1]?.url,
      "https://www.edpb.europa.eu/registers/register-of-final-one-stop-shop-decisions_fr?keys=EDPBI%3ASE%3AOSS%3AD%3A2024%3A1",
    );
    const { retenues, ecartes } = classerRegistre(lignes);
    assert.equal(retenues.length, 4);
    assert.equal(ecartes.doublon, 0);
    const unites = unitesRegistre(retenues, DESCRIPTEUR);
    assert.deepEqual(
      unites.map((unite) => unite.ref),
      [
        "EDPBI:IE:OSS:D:2025:3850",
        "EDPBI:IE:OSS:D:2025:3850#2",
        "EDPBI:NO:OSS:D:2023:850",
        "EDPBI:SE:OSS:D:2024:1",
      ],
    );
    // La seconde décision d'un identifiant partagé porte le numéro de son PDF.
    const seconde = unites[1];
    assert.equal(seconde?.numero, "3851");
    assert.match(seconde?.texte ?? "", /guichet unique n° 3851/);
    assert.equal(seconde?.document, "EDPBI:IE:OSS:D:2025:3850");
  });

  it("compte comme doublon la même décision servie sous deux noms de fichier", () => {
    const decision = (nom: string): EntreeRegistre => ({
      id: "EDPBI:IE:OSS:D:2022:577",
      date: "2022-12-01",
      autorite: null,
      pays: "ie",
      url: `https://www.edpb.europa.eu/system/files/2022-12/${nom}`,
      lien: "pdf",
      sujets: [],
    });
    const { retenues, ecartes } = classerRegistre([
      decision("ie-2022-12-decisionpublic_redacted_en_1.pdf"),
      decision("ie_2022-12_decisionpublic_redacted_2.pdf"),
    ]);
    assert.equal(retenues.length, 1);
    assert.equal(ecartes.doublon, 1);
  });

  it("refuse une notice qui ne respecte pas le contrat des métadonnées", () => {
    const [unite] = unitesRegistre(lignes, DESCRIPTEUR);
    assert.ok(unite !== undefined);
    assert.doesNotThrow(() => validerNotices([unite]));
    assert.throws(
      () => validerNotices([{ ...unite, texte: `${unite.texte}\nsuite` }]),
      /texte multiligne/,
    );
    assert.throws(() => validerNotices([{ ...unite, titre: "" }]), /titre absent/);
    const { metadonnees_seulement: _omis, ...sansMarque } = unite;
    assert.throws(() => validerNotices([sansMarque]), /metadonnees_seulement absent/);
  });

  it("ne retient que les lignes identifiées et datées, une fois par identifiant", () => {
    const { retenues, ecartes } = classerRegistre([
      ...lignes,
      lignes[0] as EntreeRegistre,
      { ...(lignes[0] as EntreeRegistre), id: "" },
      { ...(lignes[0] as EntreeRegistre), id: "EDPBI:FR:OSS:D:2024:1", date: "2024-13-01" },
    ]);
    assert.equal(retenues.length, 3);
    assert.equal(ecartes.identifiant_absent, 1);
    assert.equal(ecartes.date_invalide, 1);
  });

  it("rend une notice par décision, avec son autorité et ses sujets", () => {
    const unites = unitesRegistre(lignes, DESCRIPTEUR);
    const premiere = unites[0];
    assert.ok(premiere !== undefined);
    assert.equal(premiere.ref, "EDPBI:EE:OSS:D:2024:1561");
    assert.equal(premiere.numero, "1561");
    assert.equal(premiere.statut, "Décision définitive");
    assert.equal(premiere.nature, "autorite");
    assert.equal(premiere.metadonnees_seulement, true);
    assert.match(premiere.autorite ?? "", /^Autorité chef de file : Estonie$/);
    assert.match(premiere.texte, /^Décision définitive du guichet unique n° 1561 — /);
    assert.match(premiere.texte, /sujets : /);
  });
});

describe("la synchronisation des métadonnées", () => {
  it("écrit les unités et le manifeste sans télécharger aucune décision", async () => {
    const root = racineTemporaire();
    const urls: string[] = [];
    const resultat = await syncMetadonnees({
      rootDir: root,
      date: "2026-11-15",
      pagesCedh: { 0: JSON.parse(fixture("hudoc.json")) as unknown },
      pagesRegistre: { 0: fixture("registre.html"), 1: "" },
      sansAttente: true,
      fetchImpl: async (url) => {
        urls.push(String(url));
        throw new Error("aucune requête réseau attendue");
      },
    });

    // Aucun appel : toutes les pages sont fournies, aucune décision n'est lue.
    assert.deepEqual(urls, []);
    assert.equal(resultat.appels, 0);
    assert.equal(resultat.cedh.retenues, 2);
    assert.equal(resultat.registre.retenues, 3);
    assert.equal(resultat.unites, 5);
    assert.equal(resultat.ecrit, true);

    const unites = readFileSync(join(root, "data", "corpus", "metadonnees", "unites.jsonl"), "utf8")
      .split("\n")
      .filter((ligne) => ligne.trim() !== "")
      .map((ligne) => JSON.parse(ligne) as Unite);
    assert.equal(unites.length, 5);
    for (const unite of unites) {
      assert.equal(unite.metadonnees_seulement, true);
      assert.equal(unite.niveau, "notice");
      assert.equal(unite.corpus, "metadonnees");
      // Une ligne de métadonnées, jamais un texte de décision : les libellés de
      // sujets et de base juridique du registre tiennent la ligne sous 700 signes.
      assert.equal(unite.texte.includes("\n"), false);
      assert.ok(unite.texte.length < 700, unite.texte);
      assert.equal(unite.texte.includes(CORPS_ARRET), false);
    }

    assert.equal(
      unites.some((unite) => unite.texte.includes(CORPS_ARRET)),
      false,
      "le corps d'une décision ne doit jamais entrer dans une notice",
    );

    const manifeste = JSON.parse(
      readFileSync(join(root, "data", "corpus", "metadonnees", "manifest.json"), "utf8"),
    ) as {
      metadonnees_seulement: boolean;
      documents: number;
      unites: number;
      date_extraction: string;
      couverture: {
        perimetre: { cedh: { mots_cles: string[]; branches_ecartees: Record<string, string> }; registre: { criteres: string } };
        sources: Array<{
          source: string;
          statut: string;
          retenues: number;
          elements_lus: number;
          licence: string;
        }>;
        exclusions: { cedh: Record<string, number>; registre: Record<string, number> };
      };
    };
    assert.equal(manifeste.metadonnees_seulement, true);
    assert.equal(manifeste.documents, 5);
    assert.equal(manifeste.unites, 5);
    assert.equal(manifeste.date_extraction, "2026-11-15");
    assert.deepEqual(manifeste.couverture.perimetre.cedh.mots_cles, DESCRIPTEUR.cedh.mots_cles);
    assert.match(manifeste.couverture.perimetre.registre.criteres, /guichet unique/);
    assert.equal(
      manifeste.couverture.perimetre.cedh.branches_ecartees.DECCOMMISSION !== undefined,
      true,
    );
    assert.equal(manifeste.couverture.sources.length, 2);
    assert.equal(manifeste.couverture.sources[0]?.statut, "lue");
    assert.equal(manifeste.couverture.sources[0]?.retenues, 2);
    assert.equal(manifeste.couverture.sources[0]?.elements_lus, 5);
    assert.ok((manifeste.couverture.sources[0]?.licence ?? "") !== "");
    assert.equal(manifeste.couverture.exclusions.cedh.commission, 1);
  });

  it("n'interroge pas la source arrêtée au descripteur et dit pourquoi au manifeste", async () => {
    const root = racineTemporaire();
    const urls: string[] = [];
    const resultat = await syncMetadonnees({
      rootDir: root,
      date: "2026-11-15",
      pagesRegistre: { 0: fixture("registre.html"), 1: "" },
      sansAttente: true,
      fetchImpl: async (url) => {
        urls.push(String(url));
        throw new Error("aucune requête attendue");
      },
    });
    assert.deepEqual(urls, []);
    assert.equal(resultat.cedh.retenues, 0);
    assert.equal(resultat.unites, 3);

    const manifeste = JSON.parse(
      readFileSync(join(root, "data", "corpus", "metadonnees", "manifest.json"), "utf8"),
    ) as {
      couverture: {
        sources: Array<{ source: string; statut: string; motif?: string; retenues: number }>;
        perimetre: { cedh_abandonnee: { le: string; motif: string; reprise: string } | null };
      };
    };
    const cedh = manifeste.couverture.sources[0];
    assert.equal(cedh?.source, "HUDOC — Cour européenne des droits de l'homme");
    assert.equal(cedh?.statut, "abandonnee");
    assert.equal(cedh?.retenues, 0);
    assert.match(cedh?.motif ?? "", /HUDOC/);
    assert.equal(manifeste.couverture.perimetre.cedh_abandonnee?.le, "2026-11-15");
    assert.match(manifeste.couverture.perimetre.cedh_abandonnee?.reprise ?? "", /metadonnees:sync/);
  });

  it("compte sans écrire en dry-run", async () => {
    const root = racineTemporaire();
    const resultat = await syncMetadonnees({
      rootDir: root,
      date: "2026-11-15",
      dryRun: true,
      pagesCedh: { 0: JSON.parse(fixture("hudoc.json")) as unknown },
      pagesRegistre: { 0: fixture("registre.html"), 1: "" },
      sansAttente: true,
    });
    assert.equal(resultat.ecrit, false);
    assert.equal(resultat.unites, 5);
    assert.equal(existsSync(join(root, "data")), false);
  });

  it("laisse une source en panne nommer son URL sans toucher au corpus", async () => {
    const root = racineTemporaire();
    await assert.rejects(
      syncMetadonnees({
        rootDir: root,
        pagesCedh: { 0: JSON.parse(fixture("hudoc.json")) as unknown },
        sansAttente: true,
        fetchImpl: async () => new Response("", { status: 503 }),
      }),
      /Registre du guichet unique : HTTP 503/,
    );
    assert.equal(existsSync(join(root, "data", "corpus", "metadonnees")), false);
  });
});

describe("le rendu des métadonnées", () => {
  it("rend « rendue » pour une décision de la CEDH et « adoptee » pour une décision d'autorité", () => {
    assert.equal(statutApplication("metadonnees", "Arrêt", "juridiction"), "rendue");
    assert.equal(statutApplication("metadonnees", "Décision", "juridiction"), "rendue");
    assert.equal(statutApplication("metadonnees", "Décision définitive", "autorite"), "adoptee");
    assert.equal(statutApplication("metadonnees", "Décision définitive"), "inconnu");
  });

  it("marque les passages du corpus sans toucher aux autres", () => {
    const passages = avecMarquageMetadonnees([
      { corpus: "metadonnees", texte: "une notice" },
      { corpus: "rgpd", texte: "un article" },
    ]);
    assert.equal(passages[0]?.metadonnees_seulement, true);
    assert.equal(passages[0]?.avertissement_contenu, AVERTISSEMENT_METADONNEES);
    assert.equal(passages[1]?.avertissement_contenu, undefined);
  });

  it("fait porter le marquage à chaque passage d'une recherche bornée", async () => {
    const root = racineTemporaire();
    const { decisions } = fusionnerCedh(lirePageCedh(JSON.parse(fixture("hudoc.json")) as unknown).entrees, DESCRIPTEUR);
    const unites = unitesCedh(decisions, DESCRIPTEUR);
    const dossier = join(root, "data", "corpus", "metadonnees");
    mkdirSync(dossier, { recursive: true });
    writeFileSync(
      join(dossier, "unites.jsonl"),
      `${unites.map((unite) => JSON.stringify(unite)).join("\n")}\n`,
      "utf8",
    );
    writeFileSync(
      join(dossier, "manifest.json"),
      `${JSON.stringify({ corpus: "metadonnees", date_extraction: "2026-11-15" }, null, 2)}\n`,
      "utf8",
    );
    const construit = await buildIndex(root, embedderUniforme());
    const index: Index = openIndex(construit.chemin);
    try {
      const resultat = await search(
        root,
        { question: "conservation des empreintes et des données personnelles", corpus: "metadonnees" },
        { embedder: embedderUniforme(), index },
      );
      assert.ok(resultat.passages.length > 0);
      for (const passage of resultat.passages) {
        assert.equal(passage.metadonnees_seulement, true);
        assert.equal(passage.avertissement_contenu, AVERTISSEMENT_METADONNEES);
        assert.equal(passage.statut_application, "rendue");
        assert.match(passage.url, /^https:\/\/hudoc\.echr\.coe\.int\/fre\?i=/);
      }
      // Une question qui cite un article ne doit pas être court-circuitée : le
      // corpus ne porte aucun article, il porte des notices.
      for (const question of [
        "article 8 de la Convention et surveillance des données personnelles",
        "article 60 du RGPD et décision du guichet unique",
      ]) {
        const parArticle = await search(root, { question, corpus: "metadonnees" }, { embedder: embedderUniforme(), index });
        assert.ok(parArticle.passages.length > 0, question);
        assert.equal((parArticle.message ?? "").includes("absent du corpus"), false, question);
      }
    } finally {
      index.db.close();
    }
  });
});
