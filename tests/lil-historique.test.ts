import { strict as assert } from "node:assert";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { FetchLike, FetchResponse } from "../veille/fetch.ts";
import { resetUsage } from "../veille/piste.ts";
import type { Unite } from "../mcp/corpus/parse.ts";
import { syncLil } from "../mcp/corpus/lil/sync.ts";
import {
  HISTORIQUE_DEPUIS_LIMITE,
  collecterHistorique,
  lireBlocHistorique,
  lireVersionsHistorique,
  versionApplicable,
} from "../mcp/corpus/lil/historique.ts";
import type { VersionArticle } from "../mcp/corpus/lil/historique.ts";
import { getArticle } from "../mcp/tools.ts";

const LIL = "LEGITEXT000006068624";
const CONFIG = { clientId: "client", clientSecret: "secret", keyId: "cle" };
const DATE_COURANTE = "2026-11-14";

const racines: string[] = [];

afterEach(() => {
  for (const racine of racines.splice(0)) rmSync(racine, { recursive: true, force: true });
});

beforeEach(() => {
  resetUsage();
});

function racineTemporaire(): string {
  const racine = mkdtempSync(join(tmpdir(), "vitrine-lil-historique-"));
  racines.push(racine);
  return racine;
}

function version(
  numero: string,
  identifiant: string,
  date_debut: string,
  date_fin: string | null,
  texte: string,
): VersionArticle {
  return {
    numero,
    identifiant,
    date_debut,
    date_fin,
    texte,
    url: `https://www.legifrance.gouv.fr/loda/id/${identifiant}`,
  };
}

function ecrireJsonl(chemin: string, lignes: unknown[]): void {
  mkdirSync(join(chemin, ".."), { recursive: true });
  writeFileSync(
    chemin,
    lignes.length === 0 ? "" : `${lignes.map((ligne) => JSON.stringify(ligne)).join("\n")}\n`,
    "utf8",
  );
}

type RacineLil = {
  depuis?: string | null;
  versions?: VersionArticle[];
  unites?: Unite[];
};

/** Racine LIL minimale : manifeste, versions et unités seulement. */
function creerRacine(options: RacineLil = {}): string {
  const racine = racineTemporaire();
  const dossier = join(racine, "data", "corpus", "lil");
  mkdirSync(dossier, { recursive: true });
  const manifeste: Record<string, unknown> = {
    corpus: "lil",
    nom: "LIL",
    text_id: LIL,
    version: "LEGITEXT000006068624_14-11-2026",
  };
  if (options.depuis !== null) {
    manifeste.historique = {
      depuis: options.depuis ?? "2010-01-01",
      versions: options.versions?.length ?? 0,
      dates_lues: options.depuis === undefined ? [] : [options.depuis],
      consulte_le: "2026-11-14",
    };
  }
  writeFileSync(join(dossier, "manifest.json"), `${JSON.stringify(manifeste, null, 2)}\n`, "utf8");
  if (options.versions !== undefined) {
    ecrireJsonl(join(dossier, "versions.jsonl"), options.versions);
  }
  if (options.unites !== undefined) {
    ecrireJsonl(join(dossier, "unites.jsonl"), options.unites);
  }
  return racine;
}

const VERSIONS_ARTICLE_8: VersionArticle[] = [
  version("8", "LEGIARTI000000001", "2010-01-01", "2019-06-01", "Version ancienne de l'article 8."),
  version("8", "LEGIARTI000000002", "2019-06-01", null, "Version nouvelle de l'article 8."),
];

describe("get_article daté pour la LIL", () => {
  it("rend la version applicable et exclut la borne de fin", () => {
    const racine = creerRacine({ depuis: "2010-01-01", versions: VERSIONS_ARTICLE_8 });

    const ancienne = getArticle(racine, { document: LIL, numero: "8", date: "2015-01-01" });
    assert.equal(ancienne.trouve, true);
    assert.equal(ancienne.trouve && ancienne.ref, "LEGIARTI000000001");
    assert.equal(ancienne.trouve && ancienne.texte, "Version ancienne de l'article 8.");
    assert.equal(ancienne.trouve && ancienne.date_debut, "2010-01-01");
    assert.equal(ancienne.trouve && ancienne.date_fin, "2019-06-01");
    assert.equal(ancienne.trouve && ancienne.statut, "HISTORIQUE");
    assert.equal(ancienne.trouve && ancienne.statut_application, "inconnu");
    assert.ok(ancienne.trouve && ancienne.perimetre);

    const nouvelle = getArticle(racine, { document: LIL, numero: "8", date: "2020-01-01" });
    assert.equal(nouvelle.trouve, true);
    assert.equal(nouvelle.trouve && nouvelle.texte, "Version nouvelle de l'article 8.");
    assert.equal(nouvelle.trouve && nouvelle.date_fin, null);

    const veille = getArticle(racine, { document: LIL, numero: "8", date: "2019-05-31" });
    assert.equal(veille.trouve && veille.ref, "LEGIARTI000000001");
    const borne = getArticle(racine, { document: LIL, numero: "8", date: "2019-06-01" });
    assert.equal(borne.trouve && borne.ref, "LEGIARTI000000002");
  });

  it("dit un article inexistant à la date demandée", () => {
    const racine = creerRacine({ depuis: "2000-01-01", versions: VERSIONS_ARTICLE_8 });

    const absent = getArticle(racine, { document: LIL, numero: "8", date: "2005-01-01" });

    assert.equal(absent.trouve, false);
    assert.match(absent.message, /Article 8 inexistant à la date 2005-01-01\./);
  });

  it("refuse une date antérieure à l'historique collecté", () => {
    const racine = creerRacine({ depuis: "2010-01-01", versions: VERSIONS_ARTICLE_8 });

    const absent = getArticle(racine, { document: LIL, numero: "8", date: "2005-01-01" });

    assert.equal(absent.trouve, false);
    assert.match(absent.message, /historique non couvert avant 2010-01-01/);
    assert.match(absent.message, /2005-01-01/);
  });

  it("sans date, rend l'article du corpus en vigueur sans lire l'historique", () => {
    const unite: Unite = {
      ref: "LEGIARTI000000003",
      document: LIL,
      corpus: "lil",
      niveau: "article",
      numero: "8",
      chemin: "LIL > Titre Ier",
      texte: "Version en vigueur.",
      date_acte: "2020-01-01",
      date_debut: "2020-01-01",
      date_fin: null,
      statut: "VIGUEUR",
      url: "https://www.legifrance.gouv.fr/loda/id/LEGIARTI000000003",
    };
    const racine = creerRacine({ depuis: null, unites: [unite] });

    const article = getArticle(racine, { document: LIL, numero: "8" });

    assert.equal(article.trouve, true);
    assert.equal(article.trouve && article.ref, "LEGIARTI000000003");
    assert.equal(article.trouve && article.texte, "Version en vigueur.");
    assert.equal(article.trouve && article.statut, "VIGUEUR");
    assert.equal(article.trouve && article.statut_application, "en_vigueur");

    // L'alias résout le document sur les deux chemins, daté comme non daté.
    const alias = getArticle(racine, { document: "LIL", numero: "8" });
    assert.equal(alias.trouve && alias.ref, "LEGIARTI000000003");
  });

  it("refuse une date calendaire impossible sans la décaler", () => {
    const racine = creerRacine({ depuis: "2010-01-01", versions: VERSIONS_ARTICLE_8 });

    for (const date of ["2024-02-30", "2023-02-29", "2024-13-01"]) {
      const absent = getArticle(racine, { document: LIL, numero: "8", date });
      assert.equal(absent.trouve, false, date);
      assert.match(absent.message, /Date attendue AAAA-MM-JJ/, date);
    }
  });

  it("refuse le paramètre date sur un autre corpus", () => {
    const racine = creerRacine({ versions: VERSIONS_ARTICLE_8 });

    const refus = getArticle(racine, {
      document: "32016R0679",
      numero: "17",
      date: "2020-01-01",
    });

    assert.equal(refus.trouve, false);
    assert.match(refus.message, /n'est accepté que pour la LIL \(LEGITEXT000006068624\)/);
    assert.match(refus.message, /32016R0679/);
  });

  it("reconnaît les alias LIL et loi 78-17", () => {
    const racine = creerRacine({ depuis: "2010-01-01", versions: VERSIONS_ARTICLE_8 });

    for (const alias of ["LIL", "loi 78-17", "loi informatique et libertés"]) {
      const article = getArticle(racine, { document: alias, numero: "8", date: "2015-01-01" });
      assert.equal(article.trouve, true, alias);
      assert.equal(article.trouve && article.ref, "LEGIARTI000000001", alias);
    }
  });

  it("réclame la collecte quand le manifeste n'a pas de bloc historique", () => {
    const racine = creerRacine({ depuis: null, versions: VERSIONS_ARTICLE_8 });

    const absent = getArticle(racine, { document: LIL, numero: "8", date: "2015-01-01" });

    assert.equal(absent.trouve, false);
    assert.match(absent.message, /npm run lil:historique/);
  });

  it("refuse une date qui n'est pas AAAA-MM-JJ", () => {
    const racine = creerRacine({ depuis: "2010-01-01", versions: VERSIONS_ARTICLE_8 });

    const absent = getArticle(racine, { document: LIL, numero: "8", date: "14 novembre 2026" });

    assert.equal(absent.trouve, false);
    assert.match(absent.message, /Date attendue AAAA-MM-JJ/);
  });
});

describe("l'historique lu", () => {
  it("tolère un fichier absent et écarte les lignes mal formées", () => {
    const racine = racineTemporaire();
    assert.deepEqual(lireVersionsHistorique(racine), []);

    const dossier = join(racine, "data", "corpus", "lil");
    mkdirSync(dossier, { recursive: true });
    writeFileSync(
      join(dossier, "versions.jsonl"),
      `${JSON.stringify(VERSIONS_ARTICLE_8[0])}\n{"numero":"8"}\nmal formée\n${JSON.stringify(VERSIONS_ARTICLE_8[1])}\n`,
      "utf8",
    );

    const versions = lireVersionsHistorique(racine);
    assert.equal(versions.length, 2);
    assert.deepEqual(
      versions.map((entree) => entree.identifiant),
      ["LEGIARTI000000001", "LEGIARTI000000002"],
    );
    assert.equal(lireBlocHistorique(racine), null);
  });

  it("choisit la version applicable et la plus récente", () => {
    const versions = [
      ...VERSIONS_ARTICLE_8,
      version("8", "LEGIARTI000000000", "2000-01-01", "2010-01-01", "Version initiale."),
    ];

    assert.equal(versionApplicable(versions, "8", "2005-01-01")?.identifiant, "LEGIARTI000000000");
    assert.equal(versionApplicable(versions, "8", "2010-01-01")?.identifiant, "LEGIARTI000000001");
    assert.equal(versionApplicable(versions, "8", "2019-06-01")?.identifiant, "LEGIARTI000000002");
    assert.equal(versionApplicable(versions, "20-1", "2019-06-01"), null);
  });
});

type ArticleBrut = {
  id: string;
  num: string;
  content: string;
  pathTitle: string[];
  etat: string;
  dateDebut: string | null;
  dateFin: string | null;
};

function article(
  id: string,
  num: string,
  texte: string,
  dateDebut: string | null,
  dateFin: string | null = null,
): ArticleBrut {
  return {
    id,
    num,
    content: `<p>${texte}</p>`,
    pathTitle: ["Titre"],
    etat: "VIGUEUR",
    dateDebut,
    dateFin,
  };
}

function reponsePart(id: string, dateDebutVersion: string, articles: ArticleBrut[]): unknown {
  return {
    id,
    title: "Loi n° 78-17",
    dateDebutVersion,
    articles: [],
    sections: [{ title: "Titre Ier", articles }],
  };
}

function reponseJson(valeur: unknown): FetchResponse {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(valeur),
  };
}

/** Fetch simulé : un jeton, puis une réponse par date demandée. */
function fetchParDate(parts: Map<string, unknown>, appelees: string[]): FetchLike {
  return async (url, init) => {
    if (url.includes("oauth")) {
      return reponseJson({ access_token: "jeton", expires_in: 3600 });
    }
    if (url.endsWith("/legiPart")) {
      const corps = JSON.parse(init?.body ?? "{}") as { date?: string };
      const date = corps.date ?? "";
      appelees.push(date);
      const part = parts.get(date);
      if (part === undefined) throw new Error(`Date inattendue : ${date}`);
      return reponseJson(part);
    }
    throw new Error(`URL inattendue : ${url}`);
  };
}

const COURANTE = reponsePart("LEGITEXT000006068624_14-11-2026", "2020-01-01", [
  article("LEGIARTI_B2", "9", "Article 9 en vigueur.", "2019-01-01", "2020-01-01"),
  article("LEGIARTI_A", "8", "Article 8 en vigueur.", "2020-01-01"),
]);

const PAR_DATE = new Map<string, unknown>([
  [
    "2019-01-01",
    reponsePart("LEGITEXT000006068624_01-01-2019", "2019-01-01", [
      article("LEGIARTI_B1", "9", "Article 9 de 2019.", "2019-01-01", "2020-01-01"),
      article("LEGIARTI_A0", "8", "Article 8 de 2019.", "2019-01-01", "2020-01-01"),
    ]),
  ],
  ["2020-01-01", COURANTE],
]);

describe("la collecte de l'historique", () => {
  it("appelle une fois par date distincte, déduplique et écrit le manifeste", async () => {
    const racine = racineTemporaire();
    const appelees: string[] = [];

    const resultat = await collecterHistorique({
      rootDir: racine,
      dateCourante: DATE_COURANTE,
      reponseCourante: COURANTE,
      fetchImpl: fetchParDate(PAR_DATE, appelees),
      config: CONFIG,
    });

    assert.deepEqual(appelees, ["2019-01-01", "2020-01-01"]);
    assert.equal(resultat.appels, 3);
    assert.equal(resultat.versions, 4);
    assert.equal(resultat.depuis, "2019-01-01");
    assert.equal(resultat.budgetEpuise, false);
    assert.equal(resultat.ecrit, true);

    const lignes = readFileSync(join(racine, "data", "corpus", "lil", "versions.jsonl"), "utf8")
      .trimEnd()
      .split("\n")
      .map((ligne) => JSON.parse(ligne) as VersionArticle);
    assert.deepEqual(
      lignes.map((entree) => [entree.numero, entree.date_debut, entree.identifiant]),
      [
        ["8", "2019-01-01", "LEGIARTI_A0"],
        ["8", "2020-01-01", "LEGIARTI_A"],
        ["9", "2019-01-01", "LEGIARTI_B1"],
        ["9", "2019-01-01", "LEGIARTI_B2"],
      ],
    );

    const bloc = lireBlocHistorique(racine);
    assert.ok(bloc);
    assert.equal(bloc.depuis, "2019-01-01");
    assert.equal(bloc.versions, 4);
    assert.deepEqual(bloc.dates_lues, ["2019-01-01", "2020-01-01", DATE_COURANTE]);
    assert.equal(bloc.consulte_le, DATE_COURANTE);
  });

  it("interroge les bornes découvertes jusqu'au point fixe", async () => {
    const racine = racineTemporaire();
    const courante = reponsePart("LEGITEXT000006068624_25-05-2018", "2018-05-25", [
      article("LEGIARTI_ABROGE", "2", "Article 2 abrogé.", "2016-10-09", "2018-05-25"),
      article("LEGIARTI_13_CUR", "13", "Article 13 en 2018.", "2018-05-25"),
    ]);
    const parts = new Map<string, unknown>([
      [
        "2016-10-09",
        reponsePart("LEGITEXT000006068624_09-10-2016", "2016-10-09", [
          article("LEGIARTI_13_2016", "13", "Article 13 en 2016.", "2016-10-09", "2017-01-22"),
        ]),
      ],
      [
        "2017-01-22",
        reponsePart("LEGITEXT000006068624_22-01-2017", "2017-01-22", [
          article("LEGIARTI_13_2017", "13", "Article 13 de 2017.", "2017-01-22", "2018-05-25"),
        ]),
      ],
      ["2018-05-25", courante],
    ]);
    const appelees: string[] = [];

    const resultat = await collecterHistorique({
      rootDir: racine,
      dateCourante: DATE_COURANTE,
      reponseCourante: courante,
      fetchImpl: fetchParDate(parts, appelees),
      config: CONFIG,
    });

    // 2017-01-22 n'est pas dans la graine : il vient de la dateFin vue au
    // 2016-10-09 et doit être interrogé, sinon l'article 13 serait dit absent.
    assert.deepEqual(appelees, ["2016-10-09", "2017-01-22", "2018-05-25"]);
    assert.ok(lireVersionsHistorique(racine).some((v) => v.identifiant === "LEGIARTI_13_2017"));
    assert.equal(resultat.budgetEpuise, false);

    const rendu = getArticle(racine, { document: LIL, numero: "13", date: "2017-06-01" });
    assert.equal(rendu.trouve, true);
    assert.equal(rendu.trouve && rendu.ref, "LEGIARTI_13_2017");
    assert.equal(rendu.trouve && rendu.texte, "Article 13 de 2017.");
  });

  it("rejoue sans nouvel appel grâce aux dates lues", async () => {
    const racine = racineTemporaire();
    const options = {
      rootDir: racine,
      dateCourante: DATE_COURANTE,
      reponseCourante: COURANTE,
      config: CONFIG,
    };
    await collecterHistorique({
      ...options,
      fetchImpl: fetchParDate(PAR_DATE, []),
    });

    const appelees: string[] = [];
    const rejeu = await collecterHistorique({
      ...options,
      fetchImpl: fetchParDate(PAR_DATE, appelees),
    });

    assert.deepEqual(appelees, []);
    assert.equal(rejeu.appels, 0);
    assert.equal(rejeu.ecrit, false);
    assert.equal(rejeu.versions, 4);
  });

  it("--dry-run compte sans écrire", async () => {
    const racine = racineTemporaire();

    const resultat = await collecterHistorique({
      rootDir: racine,
      dateCourante: DATE_COURANTE,
      reponseCourante: COURANTE,
      fetchImpl: fetchParDate(PAR_DATE, []),
      config: CONFIG,
      dryRun: true,
    });

    assert.equal(resultat.ecrit, false);
    assert.equal(resultat.versions, 4);
    assert.equal(existsSync(join(racine, "data")), false);
  });

  it("s'arrête au budget et reprend à la passe suivante", async () => {
    const racine = racineTemporaire();
    const dates = [
      "2020-01-01",
      "2020-02-01",
      "2020-03-01",
      "2020-04-01",
      "2020-05-01",
      "2020-06-01",
      "2020-07-01",
      "2020-08-01",
    ];
    const courante = reponsePart(
      "LEGITEXT000006068624_14-11-2026",
      "2020-01-01",
      dates.map((date, index) => article(`LEGIARTI_${index}`, `${index + 1}`, `Article ${index + 1}.`, date)),
    );
    const parts = new Map<string, unknown>(dates.map((date) => [date, courante]));
    const appelees: string[] = [];

    const partiel = await collecterHistorique({
      rootDir: racine,
      dateCourante: DATE_COURANTE,
      reponseCourante: courante,
      fetchImpl: fetchParDate(parts, appelees),
      config: CONFIG,
      budget: 4,
    });

    assert.equal(partiel.budgetEpuise, true);
    assert.ok(partiel.appels <= 4, `${partiel.appels} appels pour un budget de 4`);
    assert.ok(appelees.length < dates.length);

    const appelees2: string[] = [];
    const reprise = await collecterHistorique({
      rootDir: racine,
      dateCourante: DATE_COURANTE,
      reponseCourante: courante,
      fetchImpl: fetchParDate(parts, appelees2),
      config: CONFIG,
    });

    assert.equal(reprise.budgetEpuise, false);
    assert.deepEqual(reprise.datesLues, [...dates, DATE_COURANTE].sort());
    assert.ok(appelees2.length > 0);
  });

  it("borne à 2018-06-01 quand la collecte complète dépasse le budget", async () => {
    const racine = racineTemporaire();
    const courante = reponsePart("LEGITEXT000006068624_14-11-2026", "2020-01-01", [
      article("LEGIARTI_1", "1", "Article 1.", "2017-01-01"),
      article("LEGIARTI_2", "2", "Article 2.", "2019-01-01"),
      article("LEGIARTI_3", "3", "Article 3.", "2020-01-01"),
    ]);
    const parts = new Map<string, unknown>([
      ["2017-01-01", courante],
      ["2019-01-01", courante],
      ["2020-01-01", courante],
    ]);
    const appelees: string[] = [];

    const resultat = await collecterHistorique({
      rootDir: racine,
      dateCourante: DATE_COURANTE,
      reponseCourante: courante,
      fetchImpl: fetchParDate(parts, appelees),
      config: CONFIG,
      budget: 2,
    });

    assert.equal(resultat.depuis, HISTORIQUE_DEPUIS_LIMITE);
    assert.equal(appelees.includes("2017-01-01"), false);
    assert.ok(appelees.length <= 2, `${appelees.length} appels pour un budget de 2`);
  });
});

describe("lil:sync conserve le bloc historique", () => {
  it("reporte le bloc collecté sans le perdre", async () => {
    const racine = racineTemporaire();
    const fixture = JSON.parse(
      readFileSync(new URL("./fixtures/lil/legi-part.json", import.meta.url), "utf8"),
    ) as unknown;
    const attendus = { sections: 3, articles: 4 };
    await syncLil({ rootDir: racine, reponse: fixture, date: "2026-11-09", attendus });

    const cheminManifeste = join(racine, "data", "corpus", "lil", "manifest.json");
    const manifeste = JSON.parse(readFileSync(cheminManifeste, "utf8")) as Record<string, unknown>;
    const bloc = {
      depuis: "2019-01-01",
      versions: 2,
      dates_lues: ["2019-01-01", "2020-01-01"],
      consulte_le: "2026-11-14",
    };
    writeFileSync(
      cheminManifeste,
      `${JSON.stringify({ ...manifeste, historique: bloc }, null, 2)}\n`,
      "utf8",
    );

    const rejeu = await syncLil({ rootDir: racine, reponse: fixture, date: "2026-11-09", attendus });
    assert.equal(rejeu.ecrit, false);
    const relu = JSON.parse(readFileSync(cheminManifeste, "utf8")) as Record<string, unknown>;
    assert.deepEqual(relu.historique, bloc);
  });
});
