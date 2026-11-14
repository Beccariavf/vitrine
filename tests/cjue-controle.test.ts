import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, it } from "node:test";
import type { FetchLike } from "../veille/fetch.ts";
import { writeRaw } from "../veille/write.ts";
import {
  COUVERTURE,
  RAPPORT_RELATIF,
  celexArret,
  controleCuria,
  ecrireResume,
  extraireAffaires,
  resoudreArret,
  resumeControle,
} from "../mcp/corpus/cjue/controle.ts";
import type { ControleOptions } from "../mcp/corpus/cjue/controle.ts";
import type { SyncCjueOptions } from "../mcp/corpus/cjue/sync.ts";

const TEXTE = [
  "Arrêt du 6 novembre 2003 (grande chambre), Lindqvist (C-101/01, EU:C:2003:596).",
  "Arrêt du 30 mai 2006 (grande chambre), Parlement/Conseil (C-317/04 et C-318/04, EU:C:2006:346).",
  "Arrêts du 6 octobre 2020 (grande chambre), Privacy International (C-623/17, EU:C:2020:790) et",
  "La Quadrature du Net e.a. (C-511/18, C-512/18 et C-520/18, EU:C:2020:791).",
  "Arrêt du 19 avril 2012, Bonnier Audio e.a. (C-461/10, EU:C:2012:219).",
  "Arrêt du 29 janvier 2008 (grande chambre), Promusicae (C-275/06, EU:C:2008:54).",
  "Renvoi à l'affaire C-511/18 et à l'affaire C-511/18.",
  "Arrêt du Tribunal du 16 juillet 2020, T-307/22, EU:T:2022:1.",
].join("\n");

/** Documents présents au corpus de test ; C-275/06 est exclu, C-461/10 manque. */
const PRESENTS = ["62001CJ0101", "62004CJ0317", "62017CJ0623", "62018CJ0511", "62022TJ0307"];

function racineTemporaire(): string {
  return mkdtempSync(join(tmpdir(), "cjue-controle-"));
}

function ecrire(racine: string, relatif: string, contenu: string): void {
  const chemin = join(racine, relatif);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu, "utf8");
}

/** Corpus minimal : un document par CELEX, et les exclusions déclarées au manifeste. */
function ecrireCorpus(
  racine: string,
  documents: readonly string[],
  ecartes: Array<{ celex: string; motif: string }> = [],
): void {
  ecrire(
    racine,
    join("data", "corpus", "cjue", "unites.jsonl"),
    documents.map((document, index) => JSON.stringify({ ref: `${document}#point${index + 1}`, document })).join("\n") + "\n",
  );
  ecrire(
    racine,
    join("data", "corpus", "cjue", "manifest.json"),
    `${JSON.stringify({ couverture: { documents_ecartes: ecartes } }, null, 2)}\n`,
  );
}

function ecrireDescripteur(racine: string, complementaires: string[]): string {
  const chemin = join(racine, "descripteur.json");
  ecrire(
    racine,
    "descripteur.json",
    `${JSON.stringify(
      {
        corpus: "cjue",
        nom: "CJUE",
        titre: "Décisions",
        url_texte: "https://eur-lex.europa.eu/{celex}",
        endpoint_sparql: "https://publications.europa.eu/webapi/rdf/sparql",
        matiere: "http://publications.europa.eu/resource/authority/subject-matter/PDON",
        matiere_libelle: "Protection des données personnelles",
        notions: [],
        celex_complementaires: complementaires,
        langues: ["fra", "eng"],
        types_retenus: { CJ: "Arrêt de la Cour", TJ: "Arrêt du Tribunal" },
        licence: "CC BY 4.0",
      },
      null,
      2,
    )}\n`,
  );
  return chemin;
}

function options(racine: string, descripteurPath: string, extra: Partial<ControleOptions> = {}): ControleOptions {
  return {
    rootDir: racine,
    descripteurPath,
    date: "2026-11-14",
    texteFiche: TEXTE,
    ...extra,
  };
}

describe("l'extraction des numéros d'affaire d'une fiche", () => {
  it("lit un arrêt simple, un arrêt du Tribunal et une jonction", () => {
    const affaires = extraireAffaires(TEXTE);
    const numeros = affaires.map((affaire) => affaire.numero);
    assert.deepEqual(numeros, [
      "C-101/01",
      "C-317/04",
      "C-318/04",
      "C-623/17",
      "C-511/18",
      "C-512/18",
      "C-520/18",
      "C-461/10",
      "C-275/06",
      "T-307/22",
    ]);
  });

  it("réunit les numéros joints par une virgule ou « et », jamais deux arrêts distincts", () => {
    const parNumero = new Map(
      extraireAffaires(TEXTE).map((affaire) => [affaire.numero, affaire.groupe]),
    );
    assert.deepEqual(parNumero.get("C-318/04"), ["C-317/04", "C-318/04"]);
    assert.deepEqual(parNumero.get("C-512/18"), ["C-511/18", "C-512/18", "C-520/18"]);
    assert.deepEqual(parNumero.get("C-623/17"), ["C-623/17"]);
    assert.deepEqual(parNumero.get("C-461/10"), ["C-461/10"]);
  });

  it("déduplique un numéro cité plusieurs fois", () => {
    const affaires = extraireAffaires("C-511/18, C-511/18 et C-511/18.");
    assert.equal(affaires.length, 1);
    assert.deepEqual(affaires[0]?.groupe, ["C-511/18"]);
  });
});

describe("la conversion d'un numéro en CELEX d'arrêt", () => {
  it("rend CJ pour la Cour et TJ pour le Tribunal", () => {
    assert.equal(celexArret("C-101/01"), "62001CJ0101");
    assert.equal(celexArret("C-461/10"), "62010CJ0461");
    assert.equal(celexArret("T-307/22"), "62022TJ0307");
  });

  it("refuse un numéro illisible en le nommant", () => {
    assert.throws(() => celexArret("affaire 12"), /affaire 12/);
  });
});

describe("la résolution d'un arrêt par CELLAR", () => {
  it("suit la jonction quand le CELEX déduit n'existe pas", async () => {
    let corps = "";
    const fetchImpl: FetchLike = async (_url, init) => {
      corps = init?.body ?? "";
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            results: { bindings: [{ celex: { value: "62004CJ0317" } }] },
          }),
      };
    };
    const resolution = await resoudreArret("C-318/04", fetchImpl);
    assert.deepEqual(resolution, { celex: "62004CJ0317", via: "jonction" });
    assert.ok(corps.includes("62004CJ0318"));
  });

  it("confirme le CELEX déduit quand il existe", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: { bindings: [{ celex: { value: "62010CJ0461" } }] } }),
    });
    assert.deepEqual(await resoudreArret("C-461/10", fetchImpl), {
      celex: "62010CJ0461",
      via: "cellar",
    });
  });

  it("rend null sans réponse exploitable", async () => {
    const enPanne: FetchLike = async () => ({ ok: false, status: 503, text: async () => "" });
    assert.equal(await resoudreArret("C-461/10", enPanne), null);
    const vide: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: { bindings: [] } }),
    });
    assert.equal(await resoudreArret("C-461/10", vide), null);
  });
});

describe("le contrôle de la fiche contre le corpus", () => {
  it("compte présents, joints, exclus et ajoutés, et écrit le rapport", async () => {
    const racine = racineTemporaire();
    try {
      ecrireCorpus(
        racine,
        PRESENTS,
        [{ celex: "62006CJ0275", motif: "xhtml_absent" }],
      );
      const descripteurPath = ecrireDescripteur(racine, []);
      let synchronise = false;
      const resultat = await controleCuria(
        options(racine, descripteurPath, {
          syncImpl: async (_options: SyncCjueOptions) => {
            synchronise = true;
            const unites = readFileSync(join(racine, "data", "corpus", "cjue", "unites.jsonl"), "utf8");
            ecrire(
              racine,
              join("data", "corpus", "cjue", "unites.jsonl"),
              `${unites}${JSON.stringify({ ref: "62010CJ0461#point1", document: "62010CJ0461" })}\n`,
            );
          },
        }),
      );

      assert.equal(synchronise, true);
      assert.equal(resultat.code, 0);
      assert.equal(resultat.rapport.numeros_affaires, 10);
      assert.equal(resultat.rapport.arrets_fiche, 7);
      assert.equal(resultat.rapport.presents, 6);
      assert.equal(resultat.rapport.ajoutes, 1);
      assert.equal(resultat.rapport.manquants_sans_raison, 0);
      assert.deepEqual(resultat.rapport.absents, [
        { celex: "62006CJ0275", numeros: ["C-275/06"], motif: "xhtml_absent" },
      ]);

      const joint = resultat.rapport.arrets.find((arret) => arret.celex === "62004CJ0317");
      assert.deepEqual(joint?.numeros, ["C-317/04", "C-318/04"]);
      assert.equal(joint?.etat, "present");
      const ajoute = resultat.rapport.arrets.find((arret) => arret.celex === "62010CJ0461");
      assert.equal(ajoute?.etat, "ajoute");

      const descripteur = JSON.parse(readFileSync(descripteurPath, "utf8")) as {
        celex_complementaires: string[];
      };
      assert.deepEqual(descripteur.celex_complementaires, ["62010CJ0461"]);

      const rapport = JSON.parse(readFileSync(join(racine, RAPPORT_RELATIF), "utf8")) as {
        fiche: { url: string };
        consulte_le: string;
      };
      assert.equal(rapport.consulte_le, "2026-11-14");
      assert.ok(rapport.fiche.url.endsWith("fiche_thematique_-_donnees_personnelles_-_fr.pdf"));
      assert.ok(readFileSync(join(racine, COUVERTURE), "utf8").includes("<!-- controle-curia:debut -->"));
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("sort en erreur quand un arrêt manque sans raison", async () => {
    const racine = racineTemporaire();
    try {
      ecrireCorpus(racine, PRESENTS, [{ celex: "62006CJ0275", motif: "xhtml_absent" }]);
      const descripteurPath = ecrireDescripteur(racine, []);
      const resultat = await controleCuria(
        options(racine, descripteurPath, { syncImpl: async () => {} }),
      );
      assert.equal(resultat.code, 1);
      assert.equal(resultat.rapport.manquants_sans_raison, 1);
      assert.equal(
        resultat.rapport.arrets.find((arret) => arret.celex === "62010CJ0461")?.etat,
        "absent",
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ne synchronise pas quand un arrêt absent porte déjà une raison durable", async () => {
    const racine = racineTemporaire();
    try {
      ecrireCorpus(
        racine,
        PRESENTS,
        [
          { celex: "62006CJ0275", motif: "xhtml_absent" },
          { celex: "62010CJ0461", motif: "autre_type" },
        ],
      );
      const descripteurPath = ecrireDescripteur(racine, []);
      let synchronise = false;
      const resultat = await controleCuria(
        options(racine, descripteurPath, {
          syncImpl: async () => {
            synchronise = true;
          },
        }),
      );
      assert.equal(synchronise, false);
      assert.equal(resultat.code, 0);
      assert.equal(resultat.rapport.absents.length, 2);
      assert.deepEqual(
        JSON.parse(readFileSync(descripteurPath, "utf8")).celex_complementaires,
        [],
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("refuse de comparer un corpus absent", async () => {
    const racine = racineTemporaire();
    try {
      const descripteurPath = ecrireDescripteur(racine, []);
      await assert.rejects(
        () => controleCuria(options(racine, descripteurPath, { syncImpl: async () => {} })),
        /npm run cjue:sync/,
      );
      assert.deepEqual(
        JSON.parse(readFileSync(descripteurPath, "utf8")).celex_complementaires,
        [],
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("signale l'échec de synchronisation sans compter l'absence comme expliquée", async () => {
    const racine = racineTemporaire();
    try {
      ecrireCorpus(racine, PRESENTS, [{ celex: "62006CJ0275", motif: "xhtml_absent" }]);
      const descripteurPath = ecrireDescripteur(racine, []);
      const resultat = await controleCuria(
        options(racine, descripteurPath, {
          syncImpl: async () => {
            throw new Error("CELLAR indisponible");
          },
        }),
      );
      assert.equal(resultat.code, 1);
      assert.equal(resultat.rapport.manquants_sans_raison, 1);
      assert.equal(resultat.rapport.erreur_sync, "CELLAR indisponible");
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});

describe("le résumé du contrôle dans la couverture", () => {
  it("remplace son bloc sans le dupliquer", () => {
    const racine = racineTemporaire();
    try {
      const chemin = join(racine, COUVERTURE);
      ecrire(racine, COUVERTURE, "# Couverture\n\nUn tableau.\n");
      const rapport = {
        corpus: "cjue" as const,
        fiche: {
          titre: "Protection des données à caractère personnel",
          page: "https://curia.europa.eu/page",
          url: "https://curia.europa.eu/fiche.pdf",
          snapshot: null,
        },
        consulte_le: "2026-11-14",
        numeros_affaires: 51,
        arrets_fiche: 43,
        presents: 42,
        ajoutes: 1,
        absents: [],
        manquants_sans_raison: 0,
        arrets: [],
        erreur_sync: null,
      };
      const resume = resumeControle(rapport);
      ecrireResume(chemin, resume);
      ecrireResume(chemin, resume);
      const contenu = readFileSync(chemin, "utf8");
      assert.equal(contenu.split("<!-- controle-curia:debut -->").length, 2);
      assert.ok(contenu.includes("Contrôle du 2026-11-14"));
      assert.ok(contenu.includes("51 numéros d'affaires pour 43 arrêts"));
      assert.ok(contenu.includes("data/corpus/cjue/controle-curia.json"));
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});

describe("le snapshot binaire de la fiche", () => {
  it("est adressé par le sha256 de ses octets", () => {
    const racine = racineTemporaire();
    try {
      const octets = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x0a]);
      const chemin = writeRaw(racine, octets, "pdf");
      const hash = createHash("sha256").update(Buffer.from(octets)).digest("hex");
      assert.equal(basename(chemin), `${hash}.pdf`);
      assert.deepEqual([...readFileSync(chemin)], [...octets]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});
