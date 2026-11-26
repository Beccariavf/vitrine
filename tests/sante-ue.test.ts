import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { lireDescripteurs } from "../mcp/corpus/build.ts";
import { documentsPresents, extraireCitations, marquerPresence } from "../mcp/corpus/citations.ts";
import type { Unite } from "../mcp/corpus/parse.ts";
import { INSTRUCTION_SANTE_UE, INSTRUCTIONS_REQUETE } from "../mcp/embed/embedder.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import { documentsNommes, getArticle, search } from "../mcp/tools.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const CELEX = ["32025R0327", "32026R0771", "32026R2083", "32026R2098", "32026R2099"];

type DocumentManifeste = {
  document: string;
  date_debut: string;
  note_application?: string;
  snapshot: string;
  unites: number;
  couverture: { comptes: Record<string, number> };
};

type Manifeste = {
  documents: DocumentManifeste[];
  unites: number;
  couverture: { comptes: Record<string, number> };
};

function manifeste(): Manifeste {
  return JSON.parse(
    readFileSync(join(ROOT, "data", "corpus", "sante_ue", "manifest.json"), "utf8"),
  ) as Manifeste;
}

function unites(): Unite[] {
  return readFileSync(join(ROOT, "data", "corpus", "sante_ue", "unites.jsonl"), "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim() !== "")
    .map((ligne) => JSON.parse(ligne) as Unite);
}

function capture(snapshot: string): string {
  return readFileSync(join(ROOT, "data", "raw", snapshot.slice(0, 2), snapshot), "utf8");
}

describe("corpus sante_ue", () => {
  it("déclare les cinq actes retenus, lus sur CELLAR", () => {
    const descripteurs = lireDescripteurs().filter(
      (descripteur) => descripteur.corpus === "sante_ue",
    );
    assert.deepEqual(
      descripteurs.map((descripteur) => descripteur.document).sort(),
      [...CELEX].sort(),
    );
    assert.ok(
      descripteurs.every((descripteur) => descripteur.parseur === "sante_ue"),
      "parseur sante_ue",
    );
    assert.ok(
      descripteurs.every((descripteur) => descripteur.version === descripteur.document),
      "acte d'origine rendu",
    );
  });

  it("écrit les comptes de chaque acte, article par article", () => {
    const relu = manifeste();
    assert.equal(relu.unites, 325);
    assert.deepEqual(relu.couverture.comptes, {
      documents: 5,
      articles: 148,
      considerants: 171,
      annexes: 6,
    });
    const parActe = new Map(relu.documents.map((document) => [document.document, document]));
    assert.deepEqual(parActe.get("32025R0327")?.couverture.comptes, {
      articles: 105,
      considerants: 115,
      annexes: 4,
    });
    assert.deepEqual(parActe.get("32026R0771")?.couverture.comptes, {
      articles: 11,
      considerants: 13,
    });
    assert.deepEqual(parActe.get("32026R2083")?.couverture.comptes, {
      articles: 19,
      considerants: 27,
    });
    assert.deepEqual(parActe.get("32026R2098")?.couverture.comptes, {
      articles: 4,
      considerants: 7,
      annexes: 1,
    });
    assert.deepEqual(parActe.get("32026R2099")?.couverture.comptes, {
      articles: 9,
      considerants: 9,
      annexes: 1,
    });
  });

  it("date l'application générale et déclare l'échelonnement au manifeste", () => {
    const parActe = new Map(manifeste().documents.map((document) => [document.document, document]));
    assert.equal(parActe.get("32025R0327")?.date_debut, "2027-03-26");
    assert.equal(parActe.get("32026R0771")?.date_debut, "2026-04-28");
    assert.equal(parActe.get("32026R2083")?.date_debut, "2027-03-26");
    assert.equal(parActe.get("32026R2098")?.date_debut, "2029-03-26");
    assert.equal(parActe.get("32026R2099")?.date_debut, "2027-03-26");
    const note = parActe.get("32025R0327")?.note_application ?? "";
    assert.match(note, /2029-03-26/);
    assert.match(note, /2031-03-26/);
    assert.match(note, /2035-03-26/);
    assert.match(parActe.get("32026R2099")?.note_application ?? "", /2029-03-26/);
    for (const document of manifeste().documents) {
      if (document.document !== "32025R0327" && document.document !== "32026R2099") {
        assert.equal(document.note_application, undefined);
      }
    }
  });

  it("repointe chaque unité sur une ancre présente dans sa capture", () => {
    const manifesteRelu = manifeste();
    const captures = new Map(
      manifesteRelu.documents.map((document) => [document.document, capture(document.snapshot)]),
    );
    for (const unite of unites()) {
      const fragment = unite.url.split("#")[1];
      const texte = captures.get(unite.document);
      assert.ok(fragment !== undefined && texte !== undefined, unite.ref);
      assert.ok(texte?.includes(`id="${fragment}"`), `${unite.ref} → #${fragment}`);
    }
  });

  it("attribue l'article 53 du règlement (UE) 2025/327 et le dit présent au corpus", () => {
    for (const texte of [
      "l'article 53 du règlement (UE) 2025/327",
      "l'article 53 du règlement 2025/327",
      "l'article 53 de l'EHDS",
      "article 53 de l'espace européen des données de santé",
    ]) {
      const citations = extraireCitations(texte);
      assert.equal(citations.length, 1, texte);
      assert.equal(citations[0]?.instrument, "EHDS", texte);
      assert.equal(citations[0]?.document, "32025R0327", texte);
      assert.deepEqual(citations[0]?.articles, ["53"], texte);
      assert.equal(marquerPresence(documentsPresents(ROOT), citations)[0]?.hors_corpus, false, texte);
    }
  });

  it("attribue les règlements d'exécution de l'EHDS", () => {
    const cas: Array<[string, string]> = [
      ["l'article 3 du règlement d'exécution (UE) 2026/771", "32026R0771"],
      ["l'article 5 du règlement d'exécution (UE) 2026/2083", "32026R2083"],
      ["l'article 1er du règlement d'exécution (UE) 2026/2098", "32026R2098"],
      ["l'article 7 du règlement d'exécution (UE) 2026/2099", "32026R2099"],
    ];
    for (const [texte, document] of cas) {
      const citations = extraireCitations(texte);
      assert.equal(citations.length, 1, texte);
      assert.equal(citations[0]?.document, document, texte);
      assert.equal(marquerPresence(documentsPresents(ROOT), citations)[0]?.hors_corpus, false, texte);
    }
  });

  it("rend l'article 53 de l'EHDS par son document et son numéro", () => {
    const article = getArticle(ROOT, { document: "32025R0327", numero: "53" });
    assert.equal(article.trouve, true);
    assert.equal(article.trouve ? article.corpus : null, "sante_ue");
    assert.equal(article.trouve ? article.numero : null, "53");
    assert.match(article.trouve ? article.texte : "", /^Article 53/);
    assert.match(article.trouve ? article.texte : "", /utilisation secondaire/);
  });

  it("résout les noms des actes dans les outils", () => {
    const noms: Array<[string, string]> = [
      ["EHDS", "32025R0327"],
      ["règlement (UE) 2025/327", "32025R0327"],
      ["espace européen des données de santé", "32025R0327"],
      ["règlement d'exécution (UE) 2026/771", "32026R0771"],
      ["règlement d'exécution (UE) 2026/2083", "32026R2083"],
      ["règlement d'exécution (UE) 2026/2098", "32026R2098"],
      ["règlement d'exécution (UE) 2026/2099", "32026R2099"],
    ];
    for (const [nom, celex] of noms) {
      assert.deepEqual(documentsNommes(nom), [celex], nom);
    }
    const article = getArticle(ROOT, { document: "EHDS", numero: "54" });
    assert.equal(article.trouve ? article.document : null, "32025R0327");
  });

  it("choisit l'instruction de requête du corpus santé", () => {
    assert.equal(INSTRUCTIONS_REQUETE.sante_ue, INSTRUCTION_SANTE_UE);
    for (const celex of CELEX) assert.equal(INSTRUCTIONS_REQUETE[celex], INSTRUCTION_SANTE_UE);
    assert.match(INSTRUCTION_SANTE_UE, /données de santé/);
  });

  it("nomme l'EHDS dans le refus d'un article absent", async () => {
    const resultat = await search(
      ROOT,
      { question: "l'article 999 de l'EHDS" },
      {
        embedder: {
          model: "test",
          dim: 1,
          embedPassages: async () => [],
          embedQuery: async () => {
            throw new Error("l'embedder ne doit pas être appelé");
          },
        },
      },
    );
    assert.equal(resultat.niveau_confiance, "aucun_resultat_fiable");
    assert.match(resultat.message ?? "", /EHDS \(32025R0327\)/);
  });

  it("rend le statut d'application des actes de santé", () => {
    assert.equal(statutApplication("sante_ue", "EN_VIGUEUR"), "en_vigueur");
    assert.equal(statutApplication("sante_ue", "ABROGE"), "abroge");
  });
});
