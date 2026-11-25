import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import type { DescripteurDoctrineUe } from "../mcp/corpus/doctrine-ue/liste.ts";
import { lireDescripteur, validerDescripteur } from "../mcp/corpus/doctrine-ue/liste.ts";
import {
  statutUnite,
  texteDepuisHtml,
  unitesDoctrineUe,
  verifierVersion,
} from "../mcp/corpus/doctrine-ue/parse.ts";
import { syncDoctrineUe } from "../mcp/corpus/doctrine-ue/sync.ts";
import type { ManifesteDoctrineUe } from "../mcp/corpus/doctrine-ue/sync.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";

const ICI = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = join(ICI, "fixtures", "doctrine-ue");
const DESCRIPTEUR = join(FIXTURES, "descripteur.json");
const LIGNES = readFileSync(join(FIXTURES, "lignes-directrices.txt"), "utf8");
const PROJET = readFileSync(join(FIXTURES, "projet.txt"), "utf8");
const PAGE_QR = readFileSync(join(FIXTURES, "page-qr.html"), "utf8");
const JOURNAL = readFileSync(join(FIXTURES, "journal-officiel.xhtml"), "utf8");

const racines: string[] = [];

function racineTemporaire(): string {
  const racine = mkdtempSync(join(tmpdir(), "vitrine-doctrine-ue-"));
  racines.push(racine);
  return racine;
}

after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

/** Réponse binaire minimale pour `chargerPdf`. */
function reponsePdf(octets: Uint8Array, statut = 200): {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
} {
  const copie = new Uint8Array(octets);
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    async arrayBuffer() {
      return copie.buffer;
    },
  };
}

/** Réponse texte minimale pour `chargerTexte`. */
function reponseTexte(texte: string, statut = 200): {
  ok: boolean;
  status: number;
  text(): Promise<string>;
} {
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    async text() {
      return texte;
    },
  };
}

describe("doctrine de la Commission — descripteur", () => {
  it("valide une liste explicite et ses remplacements réciproques", () => {
    const descripteur = lireDescripteur(DESCRIPTEUR);
    assert.equal(descripteur.documents.length, 5);
    assert.equal(validerDescripteur(descripteur), undefined);
  });

  it("refuse un projet remplacé sans réciprocité", () => {
    const descripteur = JSON.parse(
      readFileSync(DESCRIPTEUR, "utf8"),
    ) as DescripteurDoctrineUe;
    const finale = descripteur.documents.find((document) => document.cle === "doc-final");
    assert.ok(finale !== undefined);
    delete finale.remplace;
    assert.throws(() => validerDescripteur(descripteur), /ne déclare pas le remplacer/);
  });

  it("refuse une source hors des domaines admis", () => {
    const descripteur = JSON.parse(
      readFileSync(DESCRIPTEUR, "utf8"),
    ) as DescripteurDoctrineUe;
    const document = descripteur.documents[0];
    assert.ok(document !== undefined);
    document.source = "https://eur-lex.europa.eu/eli/reg/2024/1689/oj";
    assert.throws(() => validerDescripteur(descripteur), /source hors domaine admis/);
  });
});

describe("doctrine de la Commission — texte", () => {
  it("extrait le corps d'une page de questions-réponses sans navigation ni formulaire", () => {
    const texte = texteDepuisHtml(PAGE_QR);
    assert.ok(texte.includes("Providers are natural or legal persons"));
    assert.ok(texte.includes("Deployers must inform individuals"));
    assert.ok(!texte.includes("Search"));
    assert.ok(!texte.includes("window.analytics"));
    assert.ok(!texte.includes("Related content"));
  });

  it("retire l'en-tête du Journal officiel et garde le texte de l'acte", () => {
    const texte = texteDepuisHtml(JOURNAL, { cellar: true });
    assert.ok(!texte.includes("Journal officiel de l'Union européenne"));
    assert.ok(texte.includes("C/2026/6005"));
    assert.ok(texte.includes("Elles s'appliquent à compter du 2 août 2026."));
  });

  it("découpe un PDF de lignes directrices en fragments adressables", () => {
    const descripteur = lireDescripteur(DESCRIPTEUR);
    const document = descripteur.documents.find((entree) => entree.cle === "doc-final");
    assert.ok(document !== undefined);
    const unites = unitesDoctrineUe(document, LIGNES, "doctrine_ue", "Doctrine de la Commission");
    assert.ok(unites.length > 1);
    assert.equal(unites[0]?.ref, "doc-final#f0");
    assert.ok(unites.every((unite) => unite.corpus === "doctrine_ue"));
    assert.ok(unites.every((unite) => unite.date_acte === "2025-07-29"));
    assert.ok(unites.every((unite) => unite.statut === "final"));
    assert.ok(unites.some((unite) => unite.texte.includes("Reconnaissance des émotions")));
    assert.equal(unites[0]?.chemin, "Doctrine de la Commission > Lignes directrices > Lignes directrices finales");
  });

  it("marque un projet remplacé comme tel", () => {
    const descripteur = lireDescripteur(DESCRIPTEUR);
    const document = descripteur.documents.find((entree) => entree.cle === "doc-projet");
    assert.ok(document !== undefined);
    assert.equal(statutUnite(document), "Projet remplacé par doc-final");
    const unites = unitesDoctrineUe(document, PROJET, "doctrine_ue", "Doctrine de la Commission");
    assert.ok(unites.every((unite) => unite.statut === "Projet remplacé par doc-final"));
    assert.equal(statutApplication("doctrine_ue", unites[0]?.statut ?? ""), "abroge");
  });

  it("refuse un texte qui ne porte plus la version déclarée", () => {
    const descripteur = lireDescripteur(DESCRIPTEUR);
    const document = descripteur.documents.find((entree) => entree.cle === "doc-final");
    assert.ok(document !== undefined);
    assert.throws(
      () => verifierVersion(document, "un autre texte, sans la référence attendue"),
      /C\(2025\) 5052 final/,
    );
  });

  it("range les statuts de la doctrine de la Commission", () => {
    assert.equal(statutApplication("doctrine_ue", "final"), "adoptee");
    assert.equal(statutApplication("doctrine_ue", "projet"), "propose");
    assert.equal(statutApplication("doctrine_ue", "Projet remplacé par doc-final"), "abroge");
    assert.equal(statutApplication("doctrine_ue", "version de travail"), "inconnu");
  });
});

describe("doctrine de la Commission — synchronisation hors ligne", () => {
  it("écrit le corpus, déclare les non-récupérés et marque le remplacement", async () => {
    const racine = racineTemporaire();
    const resultat = await syncDoctrineUe({
      rootDir: racine,
      descripteurPath: DESCRIPTEUR,
      date: "2026-11-25",
      fetchPdf: async (url) => {
        if (url.includes("absent")) return reponsePdf(new Uint8Array(), 404);
        return reponsePdf(new TextEncoder().encode("%PDF-1.4\nfixture"));
      },
      fetchHtml: async () => reponseTexte(PAGE_QR),
      lireCellar: async () => JOURNAL,
      extraireTexte: async (_octets, url) => (url.includes("projet") ? PROJET : LIGNES),
      attendre: async () => undefined,
    });

    assert.equal(resultat.documents, 4);
    assert.ok(resultat.fragments > 0);
    assert.equal(resultat.nonRecuperes, 2);
    assert.equal(resultat.ecartes, 1);

    const manifeste = JSON.parse(
      readFileSync(join(racine, "data", "corpus", "doctrine_ue", "manifest.json"), "utf8"),
    ) as ManifesteDoctrineUe;
    assert.equal(manifeste.documents, 4);
    assert.equal(manifeste.documents_liste, 6);
    assert.equal(manifeste.consulte_le, "2026-11-25");
    assert.deepEqual(manifeste.liste_reference[0]?.consulte_le, "2026-11-25");
    assert.deepEqual(manifeste.remplacements, [
      { projet: "doc-projet", finale: "doc-final" },
    ]);
    assert.ok(
      manifeste.non_recuperes.some((entree) => entree.raison.includes("HTTP 404")),
      "le document dont la source répond 404 est déclaré",
    );
    assert.ok(
      manifeste.non_recuperes.some((entree) => entree.raison.includes("DOCX")),
      "le document déclaré non récupéré au descripteur reste déclaré",
    );

    const finales = manifeste.documents_par_type.lignes_directrices;
    const finale = finales.find((document) => document.cle === "doc-final");
    assert.deepEqual(finale?.remplace, ["doc-projet"]);
    assert.equal(finale?.licence, "CC BY 4.0");
    const projets = manifeste.documents_par_type.projet_lignes_directrices;
    assert.equal(projets[0]?.remplace_par, "doc-final");
    assert.equal(projets[0]?.date_extraction, "2026-11-25");

    const unites = readFileSync(
      join(racine, "data", "corpus", "doctrine_ue", "unites.jsonl"),
      "utf8",
    )
      .split("\n")
      .filter((ligne) => ligne.trim() !== "")
      .map((ligne) => JSON.parse(ligne) as { document: string; statut: string });
    assert.ok(
      unites
        .filter((unite) => unite.document === "doc-projet")
        .every((unite) => unite.statut === "Projet remplacé par doc-final"),
    );
    assert.ok(unites.some((unite) => unite.document === "doc-cellar"));
  });
});
