import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import type { Entry } from "../veille/types.ts";
import type { CarteCollage, CartePreparation, Complements } from "../src/lib/collage.ts";
import {
  cartesCollage,
  lireArticleRgpd32,
  lirePreparationProposee,
  montantEnEuros,
} from "../src/lib/collage.ts";

/** Espace insécable des montants, écrit une fois. */
const NBSP = "\u00a0";

let compteur = 0;

/** Une entrée conforme au contrat, surchargeable champ par champ. */
function entree(champs: Partial<Entry> = {}): Entry {
  compteur += 1;
  return {
    id: `entree-${compteur}`,
    title: `Titre ${compteur}`,
    officialTitle: `Titre ${compteur}`,
    url: `https://exemple.test/${compteur}`,
    publishedAt: "2026-11-01T12:00:00.000Z",
    summary: null,
    references: [],
    themes: ["donnees-personnelles"],
    source: "cnil",
    ...champs,
  };
}

/** Date UTC du mois de novembre 2026, pour des tris lisibles. */
function jour(quantieme: number): string {
  return `2026-11-${String(quantieme).padStart(2, "0")}T12:00:00.000Z`;
}

const MATIERES = ["Données personnelles", "Intelligence artificielle", "Cybersécurité", "Plateformes"];

const ARTICLE = { document: "32016R0679", numero: "32", titre: "Sécurité du traitement", extrait: "1. Compte tenu…" };

const PREPARATION: CartePreparation = {
  procedure: "2022/0084/COD",
  titre: "Proposal for a REGULATION on information security",
  etapes: [
    { libelle: "Proposition", fait: true },
    { libelle: "Amendements PE", fait: true },
    { libelle: "Adoption", fait: false },
  ],
};

/** Les dix cartes du collage, chacune sur sa source réelle. */
function corpus(): Entry[] {
  return [
    entree({ source: "cnil", title: "La CNIL a prononcé 38 nouvelles sanctions", publishedAt: jour(17) }),
    entree({ source: "cepd", title: "Vieux rapport du CEPD", publishedAt: jour(10) }),
    entree({
      source: "cepd",
      title: "Le CEPD publie son rapport annuel",
      summary: "Le comité dresse le bilan de l'année.",
      references: ["Règlement (UE) 2016/679 · art. 70"],
      publishedAt: jour(18),
    }),
    entree({
      source: "cjeu",
      title: "LK contre Firmenauskunft P.U.R. GmbH. (C-528/25) — Arrêt de la Cour (quatrième chambre) du 19 novembre 2026.",
      references: ["Directive 2002/58/CE · art. 13"],
      publishedAt: jour(19),
    }),
    entree({
      source: "cetat",
      title: "Conseil d'État, Juge des référés, 27/10/2026, 520279, Inédit au recueil Lebon",
      publishedAt: jour(27),
    }),
    entree({
      source: "anssi",
      title: "Bulletin d'actualité CERTFR-2026-ACT-048 (16 novembre 2026)",
      publishedAt: jour(16),
    }),
    entree({
      source: "commission",
      title: "la Commission conclut à titre préliminaire que Temu a enfreint la législation",
      summary: "La Commission européenne a conclu à titre préliminaire.",
      publishedAt: jour(17),
    }),
    entree({
      source: "judilibre",
      title: "Cour de cassation, chambre sociale, 18 novembre 2026, 25-15.641",
      references: ["Règlement (UE) 2016/679 · art. 4"],
      publishedAt: jour(18),
    }),
  ];
}

const COMPLEMENTS: Complements = { article: ARTICLE, preparation: PREPARATION, matieres: MATIERES };

/** La carte d'une source, quelle que soit sa colonne. */
function carteDe(colonnes: CarteCollage[][], source: string): CarteCollage {
  const carte = colonnes.flat().find((candidate) => candidate.source === source);
  assert.ok(carte !== undefined, `carte absente : ${source}`);
  return carte;
}

const racines: string[] = [];

/** Racine temporaire, supprimée après la suite. */
function racineTemporaire(prefixe: string): string {
  const racine = mkdtempSync(join(tmpdir(), `vitrine-collage-${prefixe}-`));
  racines.push(racine);
  return racine;
}

/** Écrit un JSONL de corpus sous `<racine>/data/corpus/<corpus>/unites.jsonl`. */
function ecrireUnites(racine: string, corpusId: string, lignes: unknown[]): void {
  const dossier = join(racine, "data", "corpus", corpusId);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "unites.jsonl"), `${lignes.map((ligne) => JSON.stringify(ligne)).join("\n")}\n`, "utf8");
}

after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

describe("cartesCollage", () => {
  it("remplit quatre colonnes fixes, chaque source à sa place", () => {
    const colonnes = cartesCollage(corpus(), COMPLEMENTS);
    assert.deepEqual(
      colonnes.map((colonne) => colonne.map((carte) => carte.source)),
      [
        ["Matières suivies", "CNIL"],
        ["CEPD", "EUR-Lex"],
        ["Conseil d'État", "CJUE", "ANSSI"],
        ["Textes en préparation", "Commission européenne", "Cour de cassation"],
      ],
    );
  });

  it("retient la dernière entrée de chaque source", () => {
    const colonnes = cartesCollage(corpus(), COMPLEMENTS);
    const cepd = carteDe(colonnes, "CEPD");
    assert.equal(cepd.genre, "texte");
    if (cepd.genre !== "texte") return;
    assert.equal(cepd.titre, "Le CEPD publie son rapport annuel");
    assert.equal(cepd.date, jour(18));
    assert.equal(cepd.extrait, "Le comité dresse le bilan de l'année.");
    assert.deepEqual(cepd.references, ["RGPD · art. 70"]);
  });

  it("choisit la sanction CNIL même quand une CNIL plus récente ne l'est pas", () => {
    const entrees = [
      entree({ source: "cnil", title: "La CNIL publie son rapport d'activité", publishedAt: jour(19) }),
      entree({ source: "cnil", title: "La CNIL PRONONCE une SANCTION de 5 millions d'euros", publishedAt: jour(12) }),
      entree({ source: "cnil", title: "Sanction simplifiée", publishedAt: null }),
    ];
    const colonnes = cartesCollage(entrees);
    const sanction = carteDe(colonnes, "CNIL");
    assert.equal(sanction.genre, "sanction");
    if (sanction.genre !== "sanction") return;
    assert.equal(sanction.titre, "La CNIL PRONONCE une SANCTION de 5 millions d'euros");
    assert.equal(sanction.date, jour(12));
    assert.equal(sanction.famille, "autorites");
  });

  it("n'affiche aucune carte CNIL quand aucune entrée ne nomme une sanction", () => {
    const entrees = [
      entree({ source: "cnil", title: "La CNIL publie son rapport d'activité", publishedAt: jour(19) }),
      entree({ source: "cnil", title: "Cookies : la CNIL accompagne les professionnels", publishedAt: jour(18) }),
    ];
    const colonnes = cartesCollage(entrees);
    assert.deepEqual(
      colonnes.map((colonne) => colonne.map((carte) => carte.source)),
      [[], [], [], []],
    );
    assert.equal(colonnes.flat().some((carte) => carte.source === "CNIL"), false);
  });

  it("déduit la formation et le numéro du Conseil d'État, tronque sinon", () => {
    const colonnes = cartesCollage(corpus(), COMPLEMENTS);
    const cetat = carteDe(colonnes, "Conseil d'État");
    assert.equal(cetat.genre, "photo");
    if (cetat.genre !== "photo") return;
    assert.equal(cetat.titre, "Juge des référés");
    assert.equal(cetat.numero, "520279");

    const sansFormat = cartesCollage(
      [entree({ source: "cetat", title: "Conseil d'État : une décision sans les mentions habituelles du greffe" })],
    );
    const autre = carteDe(sansFormat, "Conseil d'État");
    assert.equal(autre.genre, "photo");
    if (autre.genre !== "photo") return;
    assert.equal(autre.numero, null);
    assert.ok(autre.titre.endsWith("…"));
    assert.ok(autre.titre.length <= 61);
  });

  it("découpe la CJUE au cadratin et retire le numéro d'affaire", () => {
    const colonnes = cartesCollage(corpus(), COMPLEMENTS);
    const cjue = carteDe(colonnes, "CJUE");
    assert.equal(cjue.genre, "texte");
    if (cjue.genre !== "texte") return;
    assert.equal(cjue.titre, "LK contre Firmenauskunft P.U.R. GmbH.");
    assert.equal(cjue.extrait, "Arrêt de la Cour (quatrième chambre) du 19 novembre 2026.");
    assert.deepEqual(cjue.references, ["ePrivacy · art. 13"]);
  });

  it("déduit la chambre de la Cour de cassation et le numéro de pourvoi", () => {
    const colonnes = cartesCollage(corpus(), COMPLEMENTS);
    const cassation = carteDe(colonnes, "Cour de cassation");
    assert.equal(cassation.genre, "texte");
    if (cassation.genre !== "texte") return;
    assert.equal(cassation.titre, "Chambre sociale");
    assert.deepEqual(cassation.references, ["Pourvoi n° 25-15.641"]);
  });

  it("réduit le bulletin ANSSI à son identifiant CERT-FR en pilule", () => {
    const colonnes = cartesCollage(corpus(), COMPLEMENTS);
    const anssi = carteDe(colonnes, "ANSSI");
    assert.equal(anssi.genre, "pilule");
    if (anssi.genre !== "pilule") return;
    assert.equal(anssi.texte, "ANSSI · CERTFR-2026-ACT-048");
    assert.equal(anssi.famille, "autorites");
  });

  it("omet une source absente sans laisser de trou ni d'erreur", () => {
    const colonnes = cartesCollage([entree({ source: "cnil", title: "Une sanction CNIL" })]);
    assert.equal(colonnes.length, 4);
    assert.deepEqual(
      colonnes.map((colonne) => colonne.map((carte) => carte.source)),
      [["CNIL"], [], [], []],
    );
    assert.deepEqual(cartesCollage([], undefined), [[], [], [], []]);
  });

  it("garde l'article mais pas la préparation quand seul l'article est lu", () => {
    const colonnes = cartesCollage([], { article: ARTICLE, preparation: null, matieres: [] });
    assert.deepEqual(
      colonnes.map((colonne) => colonne.map((carte) => carte.source)),
      [[], ["EUR-Lex"], [], []],
    );
  });

  it("porte les matières cochées et une carte par matière suivie", () => {
    const colonnes = cartesCollage([], { article: null, preparation: null, matieres: MATIERES });
    const matieres = carteDe(colonnes, "Matières suivies");
    assert.equal(matieres.genre, "matieres");
    if (matieres.genre !== "matieres") return;
    assert.deepEqual(matieres.matieres, MATIERES);
    assert.equal(matieres.famille, "textes");
  });
});

describe("montantEnEuros", () => {
  const cas: [string, string | null][] = [
    ["An amende de EUR 805 million a été prononcée", `805${NBSP}M€`],
    ["Une amende de EUR 403 000 000", `403${NBSP}M€`],
    ["Cookies : sanctions de 5 millions d\u2019euros à l'encontre des sociétés", `5${NBSP}M€`],
    ["Une sanction de 7 millions d'euros", `7${NBSP}M€`],
    ["Une amende de EUR 39 000", `39${NBSP}000${NBSP}€`],
    ["Une amende de 5,5 millions d'euros", `5,5${NBSP}M€`],
    ["Une amende de 1,5 milliard d'euros", `1,5${NBSP}Md€`],
    ["Une base de 5 millions d'utilisateurs", null],
    ["La CNIL publie son rapport annuel", null],
  ];

  for (const [titre, attendu] of cas) {
    it(`rend ${attendu ?? "rien"} pour « ${titre} »`, () => {
      assert.equal(montantEnEuros(titre), attendu);
    });
  }
});

describe("lireArticleRgpd32", () => {
  it("s'arrête au premier article 32 du corpus", () => {
    const racine = racineTemporaire("article");
    ecrireUnites(racine, "rgpd", [
      { niveau: "considérant", numero: "1", texte: "(1) La protection des personnes physiques…" },
      { niveau: "article", numero: "33", texte: "Article 33 Notification à l'autorité de contrôle 1. En cas de violation…" },
      {
        niveau: "article",
        numero: "32",
        document: "32016R0679",
        texte:
          "Article 32 Sécurité du traitement 1. Compte tenu de l'état des connaissances, des coûts de mise en œuvre et de la nature, de la portée, du contexte et des finalités du traitement ainsi que des risques, le responsable du traitement met en œuvre les mesures appropriées.",
      },
      { niveau: "article", numero: "32", texte: "Article 32 Doublon 1. Ne doit jamais être lu." },
    ]);

    const article = lireArticleRgpd32(racine);
    assert.ok(article !== null);
    assert.deepEqual(Object.keys(article).sort(), ["document", "extrait", "numero", "titre"]);
    assert.equal(article.document, "32016R0679");
    assert.equal(article.numero, "32");
    assert.equal(article.titre, "Sécurité du traitement");
    assert.ok(article.extrait.startsWith("1. Compte tenu de l'état des connaissances"));
    assert.ok(article.extrait.endsWith("…"));
    assert.ok(article.extrait.length <= 181);
  });

  it("rend null sans fichier, sans planter", () => {
    const racine = racineTemporaire("article-absent");
    assert.equal(lireArticleRgpd32(racine), null);
  });

  it("ignore une ligne illisible", () => {
    const racine = racineTemporaire("article-illisible");
    const dossier = join(racine, "data", "corpus", "rgpd");
    mkdirSync(dossier, { recursive: true });
    writeFileSync(
      join(dossier, "unites.jsonl"),
      `${JSON.stringify({ niveau: "article", numero: "32", texte: "Article 32 Sécurité du traitement 1. Compte tenu…" })}\n{pas du json\n`,
      "utf8",
    );
    const article = lireArticleRgpd32(racine);
    assert.ok(article !== null);
    assert.equal(article.titre, "Sécurité du traitement");
  });
});

describe("lirePreparationProposee", () => {
  it("retient la première proposition et ses trois étapes", () => {
    const racine = racineTemporaire("preparation");
    ecrireUnites(racine, "preparation", [
      { statut: "PENDANT", numero: "2023/0001/COD", titre: "Pending act" },
      {
        statut: "PROPOSE",
        numero: "2022/0084/COD",
        titre: "Proposal for a REGULATION on information security in the institutions",
        derniere_etape: "TABLAMEND_byEP_CMT — 2025-10-16",
      },
      { statut: "PROPOSE", numero: "2024/9999/COD", titre: "Seconde proposition" },
    ]);

    const preparation = lirePreparationProposee(racine);
    assert.ok(preparation !== null);
    assert.equal(preparation.procedure, "2022/0084/COD");
    assert.equal(preparation.titre, "Proposal for a REGULATION on information security in the institutions");
    assert.deepEqual(preparation.etapes, [
      { libelle: "Proposition", fait: true },
      { libelle: "Amendements PE", fait: true },
      { libelle: "Adoption", fait: false },
    ]);
  });

  it("laisse les amendements non faits sans mention AMEND", () => {
    const racine = racineTemporaire("preparation-sans-amendement");
    ecrireUnites(racine, "preparation", [
      { statut: "PROPOSE", numero: "2022/0084/COD", titre: "Proposal", derniere_etape: "TABLECAN — 2022-03-22" },
    ]);
    assert.deepEqual(lirePreparationProposee(racine)?.etapes.map((etape) => etape.fait), [true, false, false]);
  });

  it("rend null sans fichier et omet les cartes correspondantes", () => {
    const racine = racineTemporaire("preparation-absente");
    assert.equal(lirePreparationProposee(racine), null);
    assert.equal(lireArticleRgpd32(racine), null);

    const colonnes = cartesCollage([], { article: null, preparation: null, matieres: [] });
    assert.deepEqual(
      colonnes.map((colonne) => colonne.map((carte) => carte.source)),
      [[], [], [], []],
    );
  });
});
