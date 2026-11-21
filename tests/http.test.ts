import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildIndex, cheminIndex } from "../mcp/index/build.ts";
import { openIndex } from "../mcp/index/search.ts";
import type { Index } from "../mcp/index/search.ts";
import { normaliser } from "../mcp/embed/embedder.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import { LIMITE_DEFAUT, MAX_EXTRAIT, MAX_QUESTION, creerServeurHttp } from "../mcp/http.ts";
import type { DependancesHttp } from "../mcp/http.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const DOCUMENT = "32016R0679";

/** Embedder déterministe : sac de mots hachés, sans modèle ni réseau. */
function embedderFactice(dim = 8, model = "factice"): Embedder {
  const vecteur = (texte: string): number[] => {
    const valeurs = new Array<number>(dim).fill(0);
    for (const mot of texte.toLowerCase().split(/\s+/)) {
      if (mot === "") continue;
      let empreinte = 7;
      for (const caractere of mot) empreinte = (empreinte * 31 + (caractere.codePointAt(0) ?? 0)) % 1_000_003;
      valeurs[empreinte % dim] = (valeurs[empreinte % dim] ?? 0) + 1;
    }
    return normaliser(valeurs);
  };
  return {
    model,
    dim,
    embedPassages: async (textes) => textes.map(vecteur),
    embedQuery: async (texte) => vecteur(texte),
  };
}

function unite(numero: number, texte: string): Unite {
  return {
    ref: `${DOCUMENT}#art_${numero}`,
    document: DOCUMENT,
    corpus: "rgpd",
    niveau: "article",
    numero: String(numero),
    chemin: "RGPD > Chapitre I > Dispositions générales",
    texte,
    date_acte: "2016-04-27",
    date_debut: "2018-05-25",
    date_fin: null,
    statut: "en_vigueur",
    url: `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${DOCUMENT}#art_${numero}`,
  };
}

/** Six articles courts et un article long, dont l'extrait doit être coupé. */
const SEPT = [
  unite(1, "objet et objectifs du règlement"),
  unite(2, "champ d'application matériel"),
  unite(3, "droit d'accès de la personne concernée aux données"),
  unite(4, "droit de rectification des données inexactes"),
  unite(5, "principes relatifs au traitement des données"),
  unite(6, "licéité du traitement des données personnelles"),
  unite(7, `${"zebre ".repeat(80)}fin`),
];

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "vitrine-http-"));
}

function ecrireCorpus(root: string, unites: Unite[]): void {
  const dossier = join(root, "data", "corpus", "rgpd");
  mkdirSync(dossier, { recursive: true });
  writeFileSync(
    join(dossier, "unites.jsonl"),
    `${unites.map((entree) => JSON.stringify(entree)).join("\n")}\n`,
    "utf8",
  );
}

/** Juste après la fenêtre d'une minute : la fenêtre fixe est expirée. */
const FENETRE_DEPASSEE = 61_000;

type Options = {
  /** `construit` par défaut ; `absent` ou `corrompu` pour éprouver le 503. */
  index?: "construit" | "absent" | "corrompu";
  limite?: number;
  horloge?: () => number;
  origines?: readonly string[];
};

/**
 * Monte un serveur sur un port éphémère avec son index de test, remet tout en
 * état à la sortie. Le limiteur est large par défaut : seule l'épreuve du 429
 * le borne.
 */
async function avecServeur(
  corps: (base: string) => Promise<void>,
  options: Options = {},
): Promise<void> {
  const root = tempRoot();
  const mode = options.index ?? "construit";
  let index: Index | null = null;
  if (mode === "construit") {
    ecrireCorpus(root, SEPT);
    const construit = await buildIndex(root, embedderFactice());
    index = openIndex(construit.chemin);
  } else if (mode === "corrompu") {
    mkdirSync(join(root, "data", "corpus", "index"), { recursive: true });
    writeFileSync(cheminIndex(root), "ceci n'est pas une base SQLite", "utf8");
  }
  const deps: DependancesHttp = {
    rootDir: root,
    limite: options.limite ?? 1_000,
    ...(index === null ? {} : { index }),
    ...(options.horloge === undefined ? {} : { horloge: options.horloge }),
    ...(options.origines === undefined ? {} : { origines: options.origines }),
  };
  const serveur = creerServeurHttp(deps);
  await new Promise<void>((resoudre, rejeter) => {
    serveur.once("error", rejeter);
    serveur.listen(0, "127.0.0.1", resoudre);
  });
  const adresse = serveur.address();
  assert.ok(adresse !== null && typeof adresse === "object");
  try {
    await corps(`http://127.0.0.1:${adresse.port}`);
  } finally {
    await new Promise<void>((resoudre) => serveur.close(() => resoudre()));
    index?.db.close();
    rmSync(root, { recursive: true, force: true });
  }
}

function rechercher(base: string, parametres: string, init?: RequestInit): Promise<Response> {
  return fetch(`${base}/recherche${parametres}`, init);
}

/**
 * Envoie une cible de requête telle quelle sur une socket brute : `fetch`
 * normalise `//`, or c'est précisément la cible que le serveur doit refuser
 * sans mourir.
 */
function cibleBrute(port: number, cible: string, hote = `127.0.0.1:${port}`): Promise<string> {
  return new Promise<string>((resoudre, rejeter) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(`GET ${cible} HTTP/1.1\r\nHost: ${hote}\r\nConnection: close\r\n\r\n`);
    });
    let donnees = "";
    socket.setEncoding("utf8");
    socket.on("data", (bloc: string) => {
      donnees += bloc;
    });
    socket.on("end", () => resoudre(donnees));
    socket.on("error", rejeter);
  });
}

describe("l'API HTTP de la recherche lexicale", () => {
  it("rend 200 avec la forme exacte du contrat et cinq passages au plus", async () => {
    await avecServeur(async (base) => {
      const reponse = await rechercher(base, `?q=${encodeURIComponent("données")}`);

      assert.equal(reponse.status, 200);
      assert.equal(reponse.headers.get("content-type"), "application/json; charset=utf-8");
      assert.equal(reponse.headers.get("cache-control"), "no-store");
      assert.equal(
        reponse.headers.get("access-control-allow-origin"),
        null,
        "aucune origine n'est admise sans en-tête Origin",
      );
      const corps = (await reponse.json()) as Record<string, unknown>;
      assert.deepEqual(Object.keys(corps).sort(), ["duree_ms", "mode", "passages", "question"]);
      assert.equal(corps.mode, "lexicale");
      assert.equal(corps.question, "données");
      assert.equal(typeof corps.duree_ms, "number");

      const passages = corps.passages as Record<string, unknown>[];
      assert.ok(passages.length > 0 && passages.length <= 5, "un à cinq passages");
      passages.forEach((passage, position) => {
        assert.deepEqual(Object.keys(passage).sort(), [
          "chemin",
          "corpus",
          "date",
          "extrait",
          "rang",
          "ref",
          "url",
        ]);
        assert.equal(passage.rang, position + 1);
        assert.equal(passage.corpus, "rgpd");
        assert.equal(passage.date, "2016-04-27");
        assert.equal(typeof passage.ref, "string");
        assert.equal(typeof passage.chemin, "string");
        assert.equal(typeof passage.url, "string");
        assert.equal(typeof passage.extrait, "string");
      });
    });
  });

  it("borne le corpus à une collection indexée et accepte une recherche sans passage", async () => {
    await avecServeur(async (base) => {
      const borne = await rechercher(base, `?q=${encodeURIComponent("données")}&corpus=rgpd`);
      assert.equal(borne.status, 200);
      const corps = (await borne.json()) as { passages: { corpus: string }[] };
      assert.ok(corps.passages.length > 0);
      assert.ok(corps.passages.every((passage) => passage.corpus === "rgpd"));

      const vide = await rechercher(base, "?q=xylophone");
      assert.equal(vide.status, 200);
      const sans = (await vide.json()) as { passages: unknown[] };
      assert.deepEqual(sans.passages, []);
    });
  });

  it("coupe l'extrait à 320 caractères au dernier espace, avec des points de suspension", async () => {
    await avecServeur(async (base) => {
      const reponse = await rechercher(base, "?q=zebre");
      const corps = (await reponse.json()) as { passages: { ref: string; extrait: string }[] };

      assert.equal(corps.passages.length, 1);
      const passage = corps.passages[0];
      assert.ok(passage !== undefined);
      assert.equal(passage.ref, `${DOCUMENT}#art_7`);
      assert.ok(passage.extrait.length <= MAX_EXTRAIT, "l'extrait tient dans la borne");
      assert.ok(passage.extrait.endsWith("…"), "un extrait coupé le dit");
      assert.equal(passage.extrait.includes("  "), false, "les espaces sont normalisés");
    });
  });

  it("refuse en 400 une question absente, vide ou trop longue, et un corpus inconnu", async () => {
    await avecServeur(async (base) => {
      const cas = [
        { parametres: "", motif: /q requis/ },
        { parametres: "?q=", motif: /q requis/ },
        { parametres: "?q=%20%20", motif: /q requis/ },
        { parametres: `?q=${"a".repeat(MAX_QUESTION + 1)}`, motif: /trop longue/ },
        { parametres: `?q=${encodeURIComponent("données")}&corpus=inexistant`, motif: /Corpus inconnu/ },
        { parametres: `?q=${encodeURIComponent("données")}&corpus=`, motif: /Corpus inconnu/ },
      ];
      for (const { parametres, motif } of cas) {
        const reponse = await rechercher(base, parametres);
        assert.equal(reponse.status, 400, `400 attendu pour « ${parametres} »`);
        assert.equal(reponse.headers.get("content-type"), "application/json; charset=utf-8");
        const corps = (await reponse.json()) as Record<string, unknown>;
        assert.deepEqual(Object.keys(corps), ["erreur"]);
        assert.match(String(corps.erreur), motif);
      }
    });
  });

  it("borne la question à 300 caractères, comptés en points de code", async () => {
    await avecServeur(async (base) => {
      const exacte = await rechercher(base, `?q=${"a".repeat(MAX_QUESTION)}`);
      assert.equal(exacte.status, 200, "300 caractères passent");

      const emoji = await rechercher(base, `?q=${encodeURIComponent("😀".repeat(MAX_QUESTION))}`);
      assert.equal(emoji.status, 200, "300 points de code passent même hors BMP");

      const trop = await rechercher(base, `?q=${encodeURIComponent("😀".repeat(MAX_QUESTION + 1))}`);
      assert.equal(trop.status, 400, "301 points de code sont refusés");
    });
  });

  it("ne répond qu'à GET /recherche : toute autre route ou méthode est 404", async () => {
    await avecServeur(async (base) => {
      for (const [chemin, init] of [
        ["/autre", {}],
        ["/recherche", { method: "POST" }],
      ] as [string, RequestInit][]) {
        const reponse = await fetch(`${base}${chemin}`, init);
        assert.equal(reponse.status, 404, `404 attendu pour ${init.method ?? "GET"} ${chemin}`);
        assert.equal(reponse.headers.get("content-type"), "application/json; charset=utf-8");
        const corps = (await reponse.json()) as Record<string, unknown>;
        assert.deepEqual(Object.keys(corps), ["erreur"]);
      }

      const preflight = await fetch(`${base}/autre`, { method: "OPTIONS" });
      assert.equal(preflight.status, 404, "le préflight ne vaut que pour /recherche");
    });
  });

  it("répond 404 à une cible de requête malformée, sans tuer le serveur", async () => {
    await avecServeur(async (base) => {
      const port = Number(new URL(base).port);
      const brute = await cibleBrute(port, "//");

      assert.match(brute.split("\r\n")[0] ?? "", /^HTTP\/1\.1 404/);
      const apres = await rechercher(base, "?q=donnees");
      assert.equal(apres.status, 200, "le serveur répond encore après la cible invalide");
    });
  });

  it("refuse en 403 un en-tête Host étranger, sert 127.0.0.1 et localhost sur son port", async () => {
    await avecServeur(async (base) => {
      const port = Number(new URL(base).port);
      for (const hote of ["intrus.test", `intrus.test:${port}`, "127.0.0.1", `localhost:${port + 1}`]) {
        const brute = await cibleBrute(port, "/recherche?q=donnees", hote);
        assert.match(brute.split("\r\n")[0] ?? "", /^HTTP\/1\.1 403/, `403 attendu pour ${hote}`);
        assert.doesNotMatch(brute, /passages/);
      }
      for (const hote of [`127.0.0.1:${port}`, `localhost:${port}`]) {
        const brute = await cibleBrute(port, "/recherche?q=donnees", hote);
        assert.match(brute.split("\r\n")[0] ?? "", /^HTTP\/1\.1 200/, `200 attendu pour ${hote}`);
      }
    });
  });

  it("limite à 20 requêtes par minute et par IP, puis 429 avec le délai restant", async () => {
    let instant = 0;
    await avecServeur(
      async (base) => {
        for (let requete = 0; requete < LIMITE_DEFAUT; requete += 1) {
          const reponse = await rechercher(base, "?q=donnees", {
            headers: { "X-Forwarded-For": `10.0.0.${requete}` },
          });
          assert.equal(reponse.status, 200, `requête ${requete + 1} admise`);
        }

        const refus = await rechercher(base, "?q=donnees", {
          headers: { "X-Forwarded-For": "203.0.113.9" },
        });
        assert.equal(refus.status, 429, "X-Forwarded-For ne change pas le compteur");
        assert.equal(refus.headers.get("content-type"), "application/json; charset=utf-8");
        const corps = (await refus.json()) as Record<string, unknown>;
        assert.deepEqual(Object.keys(corps).sort(), ["erreur", "reessayer_dans_s"]);
        assert.equal(typeof corps.erreur, "string");
        assert.equal(corps.reessayer_dans_s, 60);

        instant = FENETRE_DEPASSEE;
        const apres = await rechercher(base, "?q=donnees");
        assert.equal(apres.status, 200);
        assert.equal(apres.headers.get("cache-control"), "no-store");
      },
      { limite: LIMITE_DEFAUT, horloge: () => instant },
    );
  });

  it("répond 503 sans index ou avec un index illisible, en nommant la commande", async () => {
    for (const mode of ["absent", "corrompu"] as const) {
      await avecServeur(
        async (base) => {
          const reponse = await rechercher(base, "?q=donnees");

          assert.equal(reponse.status, 503, `503 attendu pour un index ${mode}`);
          assert.equal(reponse.headers.get("content-type"), "application/json; charset=utf-8");
          const corps = (await reponse.json()) as Record<string, unknown>;
          assert.deepEqual(Object.keys(corps), ["erreur"]);
          assert.equal(corps.erreur, "Index indisponible. Lancez « npm run corpus:index ».");
          assert.doesNotMatch(String(corps.erreur), /\//, "aucun chemin dans la réponse");
        },
        { index: mode },
      );
    }
  });

  it("limite CORS aux origines configurées, en preflight comme sur la réponse", async () => {
    const permise = "http://exemple.test";
    await avecServeur(
      async (base) => {
        const preflight = await fetch(`${base}/recherche`, {
          method: "OPTIONS",
          headers: { Origin: permise },
        });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get("access-control-allow-origin"), permise);
        assert.equal(preflight.headers.get("access-control-allow-methods"), "GET");

        const refusePreflight = await fetch(`${base}/recherche`, {
          method: "OPTIONS",
          headers: { Origin: "http://intrus.test" },
        });
        assert.equal(refusePreflight.status, 204);
        assert.equal(refusePreflight.headers.get("access-control-allow-origin"), null);

        const permiseGet = await rechercher(base, "?q=donnees", { headers: { Origin: permise } });
        assert.equal(permiseGet.status, 200);
        assert.equal(permiseGet.headers.get("access-control-allow-origin"), permise);
        assert.equal(permiseGet.headers.get("vary"), "Origin");

        const refuseGet = await rechercher(base, "?q=donnees", {
          headers: { Origin: "http://intrus.test" },
        });
        assert.equal(refuseGet.status, 200);
        assert.equal(refuseGet.headers.get("access-control-allow-origin"), null);
      },
      { origines: [permise] },
    );
  });
});
