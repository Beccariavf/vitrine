import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { FetchLike } from "../veille/fetch.ts";
import {
  classerEntree,
  lireListe,
  lireNombre,
  requeteAvantBorne,
  requeteListe,
  typeCelex,
} from "../mcp/corpus/cjue/liste.ts";
import type { DescripteurCjue } from "../mcp/corpus/cjue/liste.ts";
import { unitesCjue } from "../mcp/corpus/cjue/parse.ts";
import { entreesVeilleCjue, syncCjue } from "../mcp/corpus/cjue/sync.ts";
import type { ManifesteCjue } from "../mcp/corpus/cjue/sync.ts";
import { validerUnitesCorpus } from "../mcp/corpus/parse.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/cjue/descripteur.json", import.meta.url), "utf8"),
) as DescripteurCjue;
const LISTE = JSON.parse(
  readFileSync(new URL("./fixtures/cjue/liste.json", import.meta.url), "utf8"),
) as unknown;
const ARRET = readFileSync(
  new URL("./fixtures/cjue/62012CJ0131.xhtml", import.meta.url),
  "utf8",
);
const RACINE = fileURLToPath(new URL("..", import.meta.url));
const CELEX_ARRET = "62012CJ0131";

function racineTemporaire(): string {
  return mkdtempSync(join(tmpdir(), "cjue-corpus-"));
}

function ecrire(racine: string, relatif: string, contenu: string): void {
  const chemin = join(racine, relatif);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu, "utf8");
}

function reponse(status: number, body: string) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

describe("la liste CELLAR de la CJUE", () => {
  it("classe les identifiants par type CELEX et compte la matière avant la borne", () => {
    assert.equal(typeCelex("62012CJ0131"), "CJ");
    assert.equal(typeCelex("62023TO0562(01)"), "TO");
    assert.equal(typeCelex("62014CC0362"), "CC");
    assert.equal(typeCelex("62012AA0001"), "autre");
    assert.equal(lireNombre({ results: { bindings: [{ n: { value: "42" } }] } }), 42);
    assert.equal(lireNombre({ results: { bindings: [] } }), 0);
  });

  it("réunit la matière PDON et la notion fine de protection des données", () => {
    const liste = requeteListe(DESCRIPTEUR, "2014-01-01");
    assert.match(liste, /subject-matter\/PDON/);
    assert.match(liste, /fd_578\/4\.11\.01/);
    assert.match(liste, /UNION/);
    const avant = requeteAvantBorne(DESCRIPTEUR, "2014-01-01");
    assert.match(avant, /fd_578\/4\.11\.01/);
    assert.match(avant, /CJ\|TJ\|CO\|TO/);
  });

  it("déduplique et trie les entrées de la réponse SPARQL", () => {
    const entrees = lireListe(LISTE);
    assert.equal(entrees.length, 6);
    assert.deepEqual(
      entrees.map((entree) => entree.celex),
      [...entrees.map((entree) => entree.celex)].sort(),
    );
    assert.equal(entrees.find((entree) => entree.celex === CELEX_ARRET)?.date, "2014-05-13");
  });

  it("écarte avant la borne, conclusions d'avocat général et types inconnus", () => {
    const cas = (celex: string, date: string) => ({
      celex,
      date,
      type: typeCelex(celex),
    });
    assert.deepEqual(classerEntree(cas("62012CJ0131", "2014-05-13"), DESCRIPTEUR), {
      retenue: true,
    });
    assert.deepEqual(classerEntree(cas("62013CJ0123", "2013-12-19"), DESCRIPTEUR), {
      retenue: false,
      motif: "avant_borne",
    });
    assert.deepEqual(classerEntree(cas("62014CC0362", "2015-10-06"), DESCRIPTEUR), {
      retenue: false,
      motif: "avis_avocat_general",
    });
    assert.deepEqual(classerEntree(cas("62012AA0001", "2016-02-02"), DESCRIPTEUR), {
      retenue: false,
      motif: "autre_type",
    });
  });
});

describe("le découpage d'une décision CJUE", () => {
  it("rend l'en-tête, les points de motivation et le dispositif", () => {
    const unites = unitesCjue(ARRET, CELEX_ARRET, "2014-05-13", DESCRIPTEUR);

    assert.equal(unites[0]?.ref, `${CELEX_ARRET}#h0`);
    assert.equal(unites[0]?.numero, "entête");
    const point1 = unites.find((unite) => unite.ref === `${CELEX_ARRET}#point1`);
    assert.ok(point1, "le point 1 est indexé");
    assert.equal(point1.numero, "1");
    assert.match(point1.chemin, /Arrêt de la Cour C-131\/12 > Motifs$/);
    assert.match(point1.texte, /demande de décision préjudicielle/);
    assert.equal(/^\d/.test(point1.texte), false, "le numéro du point est retiré du texte");

    const dispositif = unites.find((unite) => unite.numero === "dispositif");
    assert.ok(dispositif);
    assert.match(dispositif.texte, /^Par ces motifs/);
    assert.equal(dispositif.statut, "Arrêt de la Cour");
    assert.equal(dispositif.date_acte, "2014-05-13");
    assert.equal(
      dispositif.url,
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62012CJ0131",
    );
    assert.doesNotThrow(() => validerUnitesCorpus(unites, "CJUE"));
  });

  it("lit les rendus récents, dont les classes portent le préfixe coj-", () => {
    const xhtml = `<html><body>
      <p class="coj-sum-title-1">ARRÊT DE LA COUR</p>
      <p class="coj-index">« Protection des données »</p>
      <p class="coj-normal">Dans l’affaire C-42/24,</p>
      <table><tr><td><p class="coj-count" id="point1">1</p></td><td><p class="coj-normal">Le règlement 2016/679 s’applique.</p></td></tr></table>
      <p class="coj-normal">Par ces motifs, la Cour dit pour droit que le traitement est licite.</p>
    </body></html>`;
    const unites = unitesCjue(xhtml, "62024CJ0042", "2024-03-01", DESCRIPTEUR);
    assert.ok(unites.some((unite) => unite.ref === "62024CJ0042#point1"));
    assert.ok(unites.some((unite) => unite.numero === "dispositif"));
    assert.ok(unites.some((unite) => /Protection des données/.test(unite.texte)));
  });

  it("retombe sur des fragments quand la décision n'a pas de points numérotés", () => {
    const xhtml = "<html><body><p class=\"sum-title-1\">ORDONNANCE</p><p class=\"normal\">La Cour ordonne que le litige soit rayé.</p></body></html>";
    const unites = unitesCjue(xhtml, "62015CO0001", "2015-03-01", DESCRIPTEUR);
    assert.ok(unites.length > 0);
    assert.equal(unites[0]?.ref, "62015CO0001#h");
    assert.match(unites[0]?.texte ?? "", /rayé/);
  });
});

describe("la synchronisation du corpus CJUE", () => {
  function fetchCaptures(captures: Record<string, string>): FetchLike {
    return async (url) => {
      const celex = decodeURIComponent(url.split("/").at(-1) ?? "");
      const capture = captures[celex];
      return capture === undefined ? reponse(404, "") : reponse(200, capture);
    };
  }

  it("écrit un corpus filtré, compte les écarts et reste idempotent", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-11",
        reponseListe: LISTE,
        avantBorne: 42,
        complementaires: [],
        fetchImpl: fetchCaptures({
          [CELEX_ARRET]: ARRET,
          "62015CJ0001": ARRET,
        }),
      });

      assert.equal(resultat.documentsLus, 6);
      assert.equal(resultat.documents, 2);
      assert.deepEqual(resultat.ecartes, {
        avant_borne: 1,
        date_invalide: 0,
        avis_avocat_general: 1,
        autre_type: 1,
        version_francaise_absente: 1,
        echec_telechargement: 0,
        texte_vide: 0,
      });
      assert.equal(resultat.documentsEcartes.length, 3);

      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cjue", "manifest.json"), "utf8"),
      ) as ManifesteCjue;
      const unites = readFileSync(
        join(racine, "data", "corpus", "cjue", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);

      assert.equal(manifeste.fragments, unites.length);
      assert.equal(manifeste.documents, 2);
      assert.equal(manifeste.couverture.avant_borne, 42);
      assert.equal(manifeste.couverture.langue, "fra");
      assert.equal(
        manifeste.documents + Object.values(manifeste.exclusions).reduce((a, b) => a + b, 0),
        manifeste.documents_lus ?? resultat.documentsLus,
      );
      assert.equal(
        manifeste.documents + Object.values(manifeste.exclusions).reduce((a, b) => a + b, 0),
        resultat.documentsLus,
      );
      assert.doesNotThrow(() => validerUnitesCorpus(unites, "CJUE"));

      const seconde = await syncCjue({
        rootDir: racine,
        date: "2026-11-11",
        reponseListe: LISTE,
        avantBorne: 42,
        complementaires: [],
        fetchImpl: async () => {
          throw new Error("le cache doit éviter tout téléchargement");
        },
      });
      assert.equal(seconde.ecrit, false);
      assert.equal(seconde.appels.documents, 0);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ne réécrit rien le lendemain quand la liste n'a pas changé", async () => {
    const racine = racineTemporaire();
    try {
      await syncCjue({
        rootDir: racine,
        date: "2026-11-11",
        reponseListe: LISTE,
        avantBorne: 42,
        complementaires: [],
        fetchImpl: fetchCaptures({ [CELEX_ARRET]: ARRET, "62015CJ0001": ARRET }),
      });
      const lendemain = await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: LISTE,
        avantBorne: 42,
        complementaires: [],
        fetchImpl: async () => {
          throw new Error("le cache doit éviter tout téléchargement");
        },
      });
      assert.equal(lendemain.ecrit, false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("inclut une décision CJUE publiée par la veille", async () => {
    const racine = racineTemporaire();
    try {
      ecrire(
        racine,
        "data/entries/2026/11/entree.json",
        JSON.stringify({
          source: "cjue",
          url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62016CJ0111",
          publishedAt: "2016-05-01T12:00:00.000Z",
        }),
      );
      assert.deepEqual(entreesVeilleCjue(racine), [
        { celex: "62016CJ0111", date: "2016-05-01" },
      ]);

      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-11",
        reponseListe: { results: { bindings: [] } },
        avantBorne: 0,
        complementaires: [],
        fetchImpl: fetchCaptures({ "62016CJ0111": ARRET }),
      });
      assert.equal(resultat.documents, 1);
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cjue", "manifest.json"), "utf8"),
      ) as ManifesteCjue;
      assert.deepEqual(manifeste.couverture.veille, { entrees: 1, ajoutees: 1 });
      const unites = readFileSync(
        join(racine, "data", "corpus", "cjue", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);
      assert.equal(unites[0]?.date_acte, "2014-05-13", "la date vient du XHTML, pas de l'entrée");

      const entreeAvis = racineTemporaire();
      try {
        ecrire(
          entreeAvis,
          "data/entries/2026/11/avis.json",
          JSON.stringify({
            source: "cjue",
            url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62018CC0511",
            publishedAt: "2026-05-01T12:00:00.000Z",
          }),
        );
        const avis = await syncCjue({
          rootDir: entreeAvis,
          date: "2026-11-11",
          reponseListe: { results: { bindings: [] } },
          avantBorne: 0,
          complementaires: [],
          fetchImpl: async () => {
            throw new Error("une conclusion d'avocat général ne se télécharge pas");
          },
        });
        assert.equal(avis.documents, 0);
        assert.equal(avis.ecartes.avis_avocat_general, 1);
      } finally {
        rmSync(entreeAvis, { recursive: true, force: true });
      }
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ajoute un CELEX hors classement CELLAR, daté par son en-tête", async () => {
    const racine = racineTemporaire();
    const xhtml = `<html><body>
      <p class="sum-title-1">ARRÊT DE LA COUR</p>
      <p class="sum-title-1">2 mars 2021</p>
      <p class="index">« Protection des données »</p>
      <p class="normal">Dans l’affaire C-746/18,</p>
      <table><tr><td><p class="count" id="point1">1</p></td><td><p class="normal">Le traitement est licite.</p></td></tr></table>
      <p class="normal">Par ces motifs, la Cour dit pour droit que le traitement est licite.</p>
    </body></html>`;
    try {
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-11",
        reponseListe: { results: { bindings: [] } },
        avantBorne: 0,
        complementaires: ["62018CJ0746"],
        reponsesXhtml: { "62018CJ0746": xhtml },
      });
      assert.equal(resultat.documents, 1);
      assert.equal(resultat.documentsLus, 1);
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cjue", "manifest.json"), "utf8"),
      ) as ManifesteCjue;
      assert.equal(manifeste.couverture.complementaires_ajoutes, 1);
      assert.deepEqual(manifeste.couverture.celex_complementaires, ["62018CJ0746"]);
      const unites = readFileSync(
        join(racine, "data", "corpus", "cjue", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);
      assert.equal(unites[0]?.date_acte, "2021-03-02");
      assert.match(unites[0]?.chemin ?? "", /Arrêt de la Cour C-746\/18/);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ne crée aucun fichier en dry-run", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-11",
        reponseListe: LISTE,
        avantBorne: 42,
        complementaires: [],
        dryRun: true,
      });
      assert.equal(resultat.ecrit, false);
      assert.equal(existsSync(join(racine, "data")), false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("le corpus commité porte les comptes de son manifeste", () => {
    const manifeste = JSON.parse(
      readFileSync(join(RACINE, "data", "corpus", "cjue", "manifest.json"), "utf8"),
    ) as ManifesteCjue;
    const unites = readFileSync(join(RACINE, "data", "corpus", "cjue", "unites.jsonl"), "utf8")
      .split("\n")
      .filter((ligne) => ligne !== "")
      .map((ligne) => JSON.parse(ligne) as Unite);
    assert.equal(unites.length, manifeste.fragments);
    assert.equal(new Set(unites.map((unite) => unite.document)).size, manifeste.documents);
    assert.doesNotThrow(() => validerUnitesCorpus(unites, "CJUE"));
  });
});
