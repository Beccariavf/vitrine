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
  requeteListe,
  typeCelex,
} from "../mcp/corpus/cjue/liste.ts";
import type { DescripteurCjue } from "../mcp/corpus/cjue/liste.ts";
import { dateDecisionCjue, formatCapture, langueCapture, unitesCjue } from "../mcp/corpus/cjue/parse.ts";
import { empreinteListe, entreesVeilleCjue, syncCjue } from "../mcp/corpus/cjue/sync.ts";
import type { ManifesteCjue } from "../mcp/corpus/cjue/sync.ts";
import { validerUnitesCorpus } from "../mcp/corpus/parse.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/cjue/descripteur.json", import.meta.url), "utf8"),
) as DescripteurCjue;
const LISTE = JSON.parse(
  readFileSync(new URL("./fixtures/cjue/liste.json", import.meta.url), "utf8"),
) as unknown;
const LISTE_204 = JSON.parse(
  readFileSync(new URL("./fixtures/cjue/liste-204.json", import.meta.url), "utf8"),
) as unknown;
const ARRET = readFileSync(
  new URL("./fixtures/cjue/62012CJ0131.xhtml", import.meta.url),
  "utf8",
);
const ARRET_EN = readFileSync(
  new URL("./fixtures/cjue/62023CJ0413-en.xhtml", import.meta.url),
  "utf8",
);
const RACINE = fileURLToPath(new URL("..", import.meta.url));
const CELEX_ARRET = "62012CJ0131";
const CELEX_204 = "62023CJ0413";

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
  it("change l'empreinte de liste quand un CELEX complémentaire change", () => {
    const entrees = lireListe(LISTE);
    assert.notEqual(empreinteListe(entrees), empreinteListe(entrees, ["62018CJ0746"]));
    assert.notEqual(
      empreinteListe(entrees, ["62018CJ0746"]),
      empreinteListe(entrees, ["62018CJ0747"]),
    );
  });

  it("classe les identifiants par type CELEX", () => {
    assert.equal(typeCelex("62012CJ0131"), "CJ");
    assert.equal(typeCelex("62023TO0562(01)"), "TO");
    assert.equal(typeCelex("62014CC0362"), "CC");
    assert.equal(typeCelex("62012AA0001"), "autre");
  });

  it("expose les deux notions et les deux langues dans l'ordre", () => {
    assert.deepEqual(
      DESCRIPTEUR.notions.map((notion) => notion.uri),
      [
        "http://publications.europa.eu/resource/authority/fd_578/4.11.01",
        "http://publications.europa.eu/resource/authority/fd_578/2.04",
      ],
    );
    assert.equal(DESCRIPTEUR.notions[1]?.libelle, "Protection des données à caractère personnel par les institutions de l'Union");
    assert.deepEqual(DESCRIPTEUR.langues, ["fra", "eng"]);
  });

  it("réunit la matière PDON et les deux notions fines, sans borne de date", () => {
    const liste = requeteListe(DESCRIPTEUR);
    assert.match(liste, /subject-matter\/PDON/);
    assert.match(liste, /fd_578\/4\.11\.01/);
    assert.match(liste, /fd_578\/2\.04/);
    assert.equal(liste.match(/UNION/g)?.length, 2, "une union par notion");
    assert.doesNotMatch(liste, /2014|FILTER\(\?date/, "aucune borne de date n'est demandée");
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

  it("retient un arrêt de 2003 et écarte conclusions d'avocat général et types inconnus", () => {
    const cas = (celex: string, date: string) => ({
      celex,
      date,
      type: typeCelex(celex),
    });
    assert.deepEqual(classerEntree(cas("62012CJ0131", "2014-05-13"), DESCRIPTEUR), {
      retenue: true,
    });
    assert.deepEqual(classerEntree(cas("62001CJ0101", "2003-11-06"), DESCRIPTEUR), {
      retenue: true,
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
    const xhtml = `<html xmlns="http://www.w3.org/1999/xhtml"><body>
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
    const xhtml = `<html xmlns="http://www.w3.org/1999/xhtml"><body><p class="sum-title-1">ORDONNANCE</p><p class="normal">La Cour ordonne que le litige soit rayé.</p></body></html>`;
    const unites = unitesCjue(xhtml, "62015CO0001", "2015-03-01", DESCRIPTEUR);
    assert.ok(unites.length > 0);
    assert.equal(unites[0]?.ref, "62015CO0001#h");
    assert.match(unites[0]?.texte ?? "", /rayé/);
  });

  it("lit le HTML patrimonial des arrêts anciens", () => {
    const html = `<HTML><BODY><font face=Arial>
      <center><b>Affaire C-101/01</b><br>Proc&eacute;dure p&eacute;nale<br>contre<br>Bodil Lindqvist
      <p>&laquo;Directive 95/46/CE &#8211; Publication des donn&eacute;es &agrave; caract&egrave;re personnel sur Internet&raquo;</p>
      Arr&ecirc;t de la Cour du 6 novembre 2003</center>
      <dt>86
        <dd></dd>
      </dt> La directive 95/46/CE ne permet pas d&#8217;&eacute;carter les r&egrave;gles nationales de protection.
      <p></p>
      <dt>87
        <dd></dd>
      </dt> La marge d&#8217;appr&eacute;ciation des &Eacute;tats membres est rappel&eacute;e.
      <p>Par ces motifs,</p>
      <P ALIGN="center">LA COUR,</P> dit pour droit que la directive 95/46/CE s&#8217;oppose &agrave; une telle diffusion.
    </BODY></HTML>`;
    assert.equal(formatCapture(html), "heritage");

    const unites = unitesCjue(html, "62001CJ0101", "2003-11-06", DESCRIPTEUR);
    const point86 = unites.find((unite) => unite.ref === "62001CJ0101#point86");
    assert.ok(point86, "le point 86 est indexé");
    assert.match(point86.texte, /^La directive 95\/46\/CE ne permet pas/);
    assert.match(
      point86.texte,
      /écarter les règles nationales de protection/,
      "les entités nominales du HTML patrimonial sont décodées",
    );
    assert.match(point86.chemin, /Arrêt de la Cour C-101\/01 > Motifs$/);
    assert.ok(unites.some((unite) => unite.ref === "62001CJ0101#point87"));
    assert.ok(unites.some((unite) => /Affaire C-101\/01/.test(unite.texte)));
    const dispositif = unites.find((unite) => unite.numero === "dispositif");
    assert.ok(dispositif, "« Par ces motifs » ouvre le dispositif");
    assert.match(dispositif.texte, /^Par ces motifs, LA COUR, dit pour droit/);
    assert.doesNotThrow(() => validerUnitesCorpus(unites, "CJUE"));
  });

  it("retombe sur la numérotation en tête de paragraphe du HTML le plus ancien", () => {
    const html = `<html><body>
      <p>32 Un premier considérant.</p>
      <p>33 Au vu de ces considérations, il y a lieu de répondre que la directive 95/46 s'oppose à cette communication.</p>
      <p>Par ces motifs, la Cour dit pour droit que la directive 95/46 s'oppose à cette communication.</p>
    </body></html>`;
    assert.equal(formatCapture(html), "heritage");
    const unites = unitesCjue(html, "61998CJ0223", "1998-09-17", DESCRIPTEUR);
    const point33 = unites.find((unite) => unite.ref === "61998CJ0223#point33");
    assert.ok(point33, "le point 33 est indexé");
    assert.match(point33.texte, /^Au vu de ces considérations/);
    assert.ok(unites.some((unite) => unite.numero === "dispositif"));
  });

  it("découpe un arrêt anglais : date, numéro d'affaire avec P et dispositif", () => {
    assert.equal(langueCapture(ARRET), "fra");
    assert.equal(
      langueCapture(`<html><body><p>«Renvoi préjudiciel – Marché intérieur – Mai 2022»</p></body></html>`),
      "fra",
      "« Marché » n'est pas le mois anglais March",
    );
    assert.equal(
      langueCapture(
        `<html><body><p>voir arrêt du 27 mars 2019, August Wolff et Remedia/Commission</p></body></html>`,
      ),
      "fra",
      "« August Wolff » est un nom de partie, pas une date anglaise",
    );
    assert.equal(langueCapture(ARRET_EN), "eng");
    const date = dateDecisionCjue(ARRET_EN);
    assert.equal(date, "2025-09-04", "« 4 September 2025 » se lit en tête");

    const unites = unitesCjue(ARRET_EN, CELEX_204, date ?? "", DESCRIPTEUR);
    assert.ok(unites.some((unite) => unite.ref === `${CELEX_204}#point85`));
    assert.match(unites[0]?.texte ?? "", /JUDGMENT OF THE COURT/);

    const dispositif = unites.find((unite) => unite.numero === "dispositif");
    assert.ok(dispositif, "« On those grounds » ouvre le dispositif");
    assert.match(dispositif.texte, /^On those grounds/);
    assert.match(dispositif.chemin, /Arrêt de la Cour C-413\/23 P \(texte anglais\) > Dispositif$/);
    assert.equal(
      dispositif.url,
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62023CJ0413",
    );
    assert.equal(dispositif.date_acte, "2025-09-04");
    assert.doesNotThrow(() => validerUnitesCorpus(unites, "CJUE"));
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

  /** `fetch` qui répond par langue : `fra` puis `eng`, dans l'ordre reçu. */
  function fetchLangues(reponses: Record<string, () => ReturnType<typeof reponse>>): {
    fetch: FetchLike;
    langues: string[];
  } {
    const langues: string[] = [];
    const fetch: FetchLike = async (_url, init) => {
      const langue = init?.headers?.["Accept-Language"] ?? "";
      if (langues.at(-1) !== langue) langues.push(langue);
      const reponseLangue = reponses[langue];
      return reponseLangue === undefined ? reponse(404, "") : reponseLangue();
    };
    return { fetch, langues };
  }

  function lireManifeste(racine: string): ManifesteCjue {
    return JSON.parse(
      readFileSync(join(racine, "data", "corpus", "cjue", "manifest.json"), "utf8"),
    ) as ManifesteCjue;
  }

  function lireUnites(racine: string): Unite[] {
    return readFileSync(join(racine, "data", "corpus", "cjue", "unites.jsonl"), "utf8")
      .split("\n")
      .filter((ligne) => ligne !== "")
      .map((ligne) => JSON.parse(ligne) as Unite);
  }

  it("écrit un corpus filtré, compte les écarts et reste idempotent", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-11",
        reponseListe: LISTE,
        complementaires: [],
        fetchImpl: fetchCaptures({
          [CELEX_ARRET]: ARRET,
          "62015CJ0001": ARRET,
        }),
      });

      assert.equal(resultat.documentsLus, 6);
      assert.equal(resultat.documents, 2);
      assert.deepEqual(resultat.ecartes, {
        date_invalide: 0,
        avis_avocat_general: 1,
        autre_type: 1,
        xhtml_absent: 2,
        echec_telechargement: 0,
        texte_vide: 0,
      });
      assert.equal(resultat.documentsEcartes.length, 4);

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
      assert.equal(manifeste.couverture.langue, "fra");
      assert.deepEqual(manifeste.couverture.langues, { fra: 2, eng: 0 });
      assert.deepEqual(manifeste.couverture.documents_langues, {});
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
        complementaires: [],
        fetchImpl: fetchCaptures({ [CELEX_ARRET]: ARRET, "62015CJ0001": ARRET }),
      });
      const lendemain = await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: LISTE,
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

  it("compte un complémentaire écarté par son type dans documents_lus", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-11",
        reponseListe: { results: { bindings: [] } },
        complementaires: ["62018CC0511"],
        fetchImpl: async () => {
          throw new Error("une conclusion d'avocat général ne se télécharge pas");
        },
      });
      assert.equal(resultat.documents, 0);
      assert.equal(resultat.documentsLus, 1);
      assert.equal(resultat.ecartes.avis_avocat_general, 1);
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cjue", "manifest.json"), "utf8"),
      ) as ManifesteCjue;
      assert.equal(manifeste.documents_lus, 1);
      assert.equal(manifeste.documents + Object.values(manifeste.exclusions).reduce((a, b) => a + b, 0), 1);
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

  it("retient un CELEX classé seulement dans la notion 2.04", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: LISTE_204,
        complementaires: [],
        reponsesXhtml: { [CELEX_204]: ARRET },
      });
      assert.equal(resultat.documents, 1);
      const manifeste = lireManifeste(racine);
      assert.deepEqual(
        manifeste.couverture.notions.map((notion) => notion.libelle),
        [
          "Protection des données à caractère personnel",
          "Protection des données à caractère personnel par les institutions de l'Union",
        ],
      );
      assert.ok(lireUnites(racine).every((unite) => unite.document === CELEX_204));
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("retient un arrêt de 2003 sur la directive 95/46", async () => {
    const racine = racineTemporaire();
    const xhtml = `<html xmlns="http://www.w3.org/1999/xhtml"><body>
      <p class="sum-title-1">ARRÊT DE LA COUR</p>
      <p class="sum-title-1">6 novembre 2003</p>
      <p class="index">« Directive 95/46/CE — Protection des personnes physiques »</p>
      <p class="normal">Dans l’affaire C-101/01,</p>
      <table><tr><td><p class="count" id="point1">1</p></td><td><p class="normal">Par sa question, la juridiction de renvoi demande l’interprétation de la directive 95/46/CE.</p></td></tr></table>
      <p class="normal">Par ces motifs, la Cour dit pour droit que la directive 95/46/CE ne s’oppose pas à la diffusion d’informations personnelles.</p>
    </body></html>`;
    try {
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-14",
        reponseListe: {
          results: {
            bindings: [{ celex: { value: "62001CJ0101" }, date: { value: "2003-11-06" } }],
          },
        },
        complementaires: [],
        reponsesXhtml: { "62001CJ0101": xhtml },
      });
      assert.equal(resultat.documents, 1);
      assert.equal(resultat.ecartes.date_invalide, 0);
      const unites = lireUnites(racine);
      assert.ok(unites.length > 0);
      assert.ok(unites.every((unite) => unite.document === "62001CJ0101"));
      assert.equal(unites[0]?.date_acte, "2003-11-06");
      const point = unites.find((unite) => unite.ref === "62001CJ0101#point1");
      assert.match(point?.texte ?? "", /directive 95\/46\/CE/);
      assert.equal(lireManifeste(racine).couverture.periode.date_min, "2003-11-06");
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("lit en anglais quand le français répond 404", async () => {
    const racine = racineTemporaire();
    try {
      const { fetch, langues } = fetchLangues({
        fra: () => reponse(404, ""),
        eng: () => reponse(200, ARRET_EN),
      });
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: LISTE_204,
        complementaires: [],
        fetchImpl: fetch,
      });
      assert.deepEqual(langues, ["fra", "eng"], "l'ordre des langues est respecté");
      assert.equal(resultat.documents, 1);
      assert.equal(resultat.ecartes.xhtml_absent, 0);
      const manifeste = lireManifeste(racine);
      assert.deepEqual(manifeste.couverture.langues, { fra: 0, eng: 1 });
      assert.deepEqual(manifeste.couverture.documents_langues, { [CELEX_204]: "eng" });
      assert.equal(manifeste.langue, "fra");
      const unites = lireUnites(racine);
      assert.ok(
        unites.every(
          (unite) =>
            unite.url ===
            "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62023CJ0413",
        ),
      );
      assert.ok(unites.every((unite) => unite.chemin.includes("(texte anglais)")));
      assert.equal(
        existsSync(join(racine, "data", "raw", "cjue", `${CELEX_204}.absente.json`)),
        false,
        "un texte trouvé en anglais n'écrit aucun marqueur",
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("lit le HTML patrimonial quand le XHTML n'est servi dans aucune langue", async () => {
    const racine = racineTemporaire();
    const formes = new Set<string>();
    const html = `<HTML><BODY><center><b>Affaire C-101/01</b><br>Bodil Lindqvist</center>
      <dt>86
        <dd></dd>
      </dt> La directive 95/46/CE s'oppose à la diffusion de données non pertinentes.
      <p>Par ces motifs,</p> LA COUR dit pour droit que la directive 95/46/CE s'applique.
    </BODY></HTML>`;
    const fetch: FetchLike = async (_url, init) => {
      const accept = String(init?.headers?.Accept ?? "");
      formes.add(accept);
      return accept === "text/html" ? reponse(200, html) : reponse(404, "");
    };
    try {
      const premier = await syncCjue({
        rootDir: racine,
        date: "2026-11-14",
        reponseListe: {
          results: {
            bindings: [{ celex: { value: "62001CJ0101" }, date: { value: "2003-11-06" } }],
          },
        },
        complementaires: [],
        fetchImpl: fetch,
      });
      assert.deepEqual([...formes], ["application/xhtml+xml", "text/html"]);
      assert.equal(premier.documents, 1);
      assert.equal(premier.ecartes.xhtml_absent, 0);
      assert.equal(
        existsSync(join(racine, "data", "raw", "cjue", "62001CJ0101.html")),
        true,
        "le HTML patrimonial est mis en cache sous .html",
      );
      const unites = lireUnites(racine);
      assert.equal(unites[0]?.date_acte, "2003-11-06", "la date CELLAR fait foi, pas les conclusions");
      assert.ok(unites.some((unite) => unite.ref === "62001CJ0101#point86"));

      const second = await syncCjue({
        rootDir: racine,
        date: "2026-11-14",
        reponseListe: {
          results: {
            bindings: [{ celex: { value: "62001CJ0101" }, date: { value: "2003-11-06" } }],
          },
        },
        complementaires: [],
        fetchImpl: async () => {
          throw new Error("une capture en cache ne se redemande pas");
        },
      });
      assert.equal(second.appels.documents, 0);
      assert.equal(second.ecrit, false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("compte un échec de téléchargement quand le français tombe en panne et l'anglais n'est pas essayé", async () => {
    const racine = racineTemporaire();
    try {
      const { fetch, langues } = fetchLangues({
        fra: () => reponse(502, ""),
        eng: () => reponse(404, ""),
      });
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: LISTE_204,
        complementaires: [],
        fetchImpl: fetch,
      });
      assert.deepEqual(langues, ["fra"], "une panne du français n'est pas un 404 : l'anglais n'est pas essayé");
      assert.equal(resultat.ecartes.echec_telechargement, 1);
      assert.equal(resultat.ecartes.xhtml_absent, 0);
      assert.equal(
        existsSync(join(racine, "data", "raw", "cjue", `${CELEX_204}.absente.json`)),
        false,
        "une panne n'écrit aucun marqueur durable",
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("consigne un XHTML absent dans toutes les langues et ne le redemande plus", async () => {
    const racine = racineTemporaire();
    try {
      const { fetch, langues } = fetchLangues({
        fra: () => reponse(404, ""),
        eng: () => reponse(404, ""),
      });
      const premier = await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: LISTE_204,
        complementaires: [],
        fetchImpl: fetch,
      });
      assert.deepEqual(langues, ["fra", "eng"]);
      assert.equal(premier.ecartes.xhtml_absent, 1);
      const marqueur = JSON.parse(
        readFileSync(
          join(racine, "data", "raw", "cjue", `${CELEX_204}.absente.json`),
          "utf8",
        ),
      ) as { motif: string };
      assert.equal(marqueur.motif, "xhtml_absent");

      const second = await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: LISTE_204,
        complementaires: [],
        fetchImpl: async () => {
          throw new Error("un XHTML absent ne se redemande pas");
        },
      });
      assert.equal(second.appels.documents, 0);
      assert.equal(second.ecartes.xhtml_absent, 1);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("garde durable un marqueur version_francaise_absente déjà écrit", async () => {
    const racine = racineTemporaire();
    try {
      ecrire(
        racine,
        `data/raw/cjue/${CELEX_204}.absente.json`,
        JSON.stringify({
          celex: CELEX_204,
          motif: "version_francaise_absente",
          date: "2026-11-11",
        }),
      );
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: LISTE_204,
        complementaires: [],
        fetchImpl: async () => {
          throw new Error("l'ancien marqueur doit rester durable");
        },
      });
      assert.equal(resultat.appels.documents, 0);
      assert.equal(resultat.ecartes.xhtml_absent, 1);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("inclut en anglais une décision de la veille absente de CELLAR", async () => {
    const racine = racineTemporaire();
    try {
      ecrire(
        racine,
        "data/entries/2026/11/entree.json",
        JSON.stringify({
          source: "cjue",
          url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62023CJ0413",
          publishedAt: "2026-09-04T12:00:00.000Z",
        }),
      );
      const { fetch, langues } = fetchLangues({
        fra: () => reponse(404, ""),
        eng: () => reponse(200, ARRET_EN),
      });
      const resultat = await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: { results: { bindings: [] } },
        complementaires: [],
        fetchImpl: fetch,
      });
      assert.deepEqual(langues, ["fra", "eng"]);
      assert.equal(resultat.documents, 1);
      const manifeste = lireManifeste(racine);
      assert.deepEqual(manifeste.couverture.veille, { entrees: 1, ajoutees: 1 });
      assert.deepEqual(manifeste.couverture.documents_langues, { [CELEX_204]: "eng" });
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("interrompt la passe sur un 429 sans écrire ni exclusion ni marqueur", async () => {
    const racine = racineTemporaire();
    try {
      await syncCjue({
        rootDir: racine,
        date: "2026-11-12",
        reponseListe: LISTE_204,
        complementaires: [],
        reponsesXhtml: { [CELEX_204]: ARRET },
      });
      const cheminUnites = join(racine, "data", "corpus", "cjue", "unites.jsonl");
      const avant = readFileSync(cheminUnites, "utf8");
      const manifesteAvant = readFileSync(
        join(racine, "data", "corpus", "cjue", "manifest.json"),
        "utf8",
      );

      await assert.rejects(
        () =>
          syncCjue({
            rootDir: racine,
            date: "2026-11-12",
            reponseListe: {
              results: {
                bindings: [
                  { celex: { value: CELEX_204 }, date: { value: "2025-09-04" } },
                  { celex: { value: "62021CJ0001" }, date: { value: "2021-06-01" } },
                ],
              },
            },
            complementaires: [],
            fetchImpl: async () => reponse(429, ""),
          }),
        /429/,
      );
      assert.equal(readFileSync(cheminUnites, "utf8"), avant, "le corpus antérieur reste intact");
      assert.equal(
        readFileSync(join(racine, "data", "corpus", "cjue", "manifest.json"), "utf8"),
        manifesteAvant,
      );
      assert.equal(
        existsSync(join(racine, "data", "raw", "cjue", "62021CJ0001.absente.json")),
        false,
        "un 429 n'écrit aucun marqueur",
      );
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
    assert.equal(manifeste.couverture.notions.length, 2);
    const anglais = new Set(Object.keys(manifeste.couverture.documents_langues));
    for (const unite of unites) {
      const attendu = anglais.has(unite.document);
      assert.equal(
        unite.chemin.includes(" (texte anglais)"),
        attendu,
        `${unite.ref} : le chemin et le manifeste s'accordent sur la langue`,
      );
      assert.equal(unite.url.includes("/EN/"), attendu, `${unite.ref} : l'URL suit la langue`);
    }
    assert.doesNotThrow(() => validerUnitesCorpus(unites, "CJUE"));
  });
});
