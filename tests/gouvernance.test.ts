import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CONSIGNE_SERVEUR } from "../mcp/server.ts";
import {
  CHAMPS_GOUVERNANCE,
  CORPUS,
  LIBELLES_GOUVERNANCE,
  NOMS_CORPUS,
  champsGouvernance,
  gouvernanceDuCorpus,
  resumeGouvernance,
} from "../mcp/corpus/registre.ts";
import { etatCorpus } from "../mcp/tools.ts";

/**
 * La correspondance attendue, dans l'ordre du registre. Ce tableau est le
 * contrat de la présentation « gouvernance de la donnée » : un corpus peut
 * relever de plusieurs champs, et chaque champ est couvert.
 */
const ATTENDU = {
  personnelles: [
    "rgpd", "eprivacy", "police", "eudpr", "rgpdproc", "ccs", "adequation", "donnees",
    "sante_ue", "lil", "textes_fr", "preparation", "cnil", "cada", "cnil_doctrine",
    "ce", "constit", "cepd", "cc", "cjue", "metadonnees",
  ],
  non_personnelles: [
    "donnees", "frontieres", "textes_fr", "preparation", "cada", "ce", "cc", "cjue", "doctrine_ue",
  ],
  ia: [
    "aiact", "frontieres", "preparation", "cnil", "cnil_doctrine", "ce", "constit", "cepd", "cjue",
    "doctrine_ue",
  ],
  sante: [
    "sante_ue", "textes_fr", "preparation", "cnil", "cnil_doctrine", "ce", "constit",
    "cepd", "cc", "cjue",
  ],
} as const;

function racine(): string {
  return mkdtempSync(join(tmpdir(), "gouvernance-"));
}

function ecrireCorpus(root: string, corpus: string): void {
  const dossier = join(root, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "manifest.json"), `${JSON.stringify({ corpus }, null, 2)}\n`);
}

describe("gouvernance de la donnée", () => {
  it("garde la table corpus → champs attendue, un corpus pouvant en relever de plusieurs", () => {
    assert.deepEqual(champsGouvernance(), ATTENDU);
  });

  it("donne au moins un champ à chaque corpus, sans doublon", () => {
    for (const corpus of CORPUS) {
      assert.ok(corpus.gouvernance.length > 0, `${corpus.nom} : champ de gouvernance`);
      assert.equal(
        new Set(corpus.gouvernance).size,
        corpus.gouvernance.length,
        `${corpus.nom} : champ répété`,
      );
      assert.deepEqual(gouvernanceDuCorpus(corpus.nom), [...corpus.gouvernance]);
    }
    assert.equal(gouvernanceDuCorpus("hors-registre").length, 0);
    assert.equal(NOMS_CORPUS.length, CORPUS.length);
  });

  it("résume la correspondance par champ dans la description du serveur", () => {
    const attendu = CHAMPS_GOUVERNANCE.map(
      (champ) =>
        `${LIBELLES_GOUVERNANCE[champ]} — ` +
        `${ATTENDU[champ].map((nom) => `\`${nom}\``).join(", ")}`,
    ).join(" ; ");
    assert.equal(resumeGouvernance(), attendu);
    assert.ok(CONSIGNE_SERVEUR.startsWith("Serveur de lecture et de recherche juridiques"));
    assert.ok(CONSIGNE_SERVEUR.includes("gouvernance de la donnée"));
    assert.ok(CONSIGNE_SERVEUR.includes(attendu));
    for (const champ of CHAMPS_GOUVERNANCE) {
      assert.ok(resumeGouvernance().includes(LIBELLES_GOUVERNANCE[champ]), `libellé ${champ}`);
    }
  });

  it("rend la gouvernance de chaque corpus et le résumé dans etat_corpus", () => {
    const root = racine();
    try {
      ecrireCorpus(root, "cnil");
      ecrireCorpus(root, "metadonnees");
      ecrireCorpus(root, "hors-registre");
      const etat = etatCorpus(root);
      const parNom = new Map(etat.corpus.map((entree) => [entree.corpus, entree]));
      assert.deepEqual(parNom.get("cnil")?.gouvernance, ["personnelles", "ia", "sante"]);
      assert.deepEqual(parNom.get("metadonnees")?.gouvernance, ["personnelles"]);
      assert.deepEqual(parNom.get("hors-registre")?.gouvernance, []);
      assert.deepEqual(etat.champs_gouvernance, ATTENDU);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
