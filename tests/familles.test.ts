import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FAMILLES, FAMILLES_LEGENDE, familleDeSource } from "../src/lib/familles.ts";
import { PASTILLES } from "./contrastes.ts";

const SOURCES_VEILLE = ["cnil", "cnil_doctrine", "cjeu", "anssi", "cepd", "arcep", "commission", "commission-dma", "arcom", "cetat", "constit", "judilibre", "legi", "eurlex"];
const CORPUS = ["rgpd", "aiact", "eprivacy", "police", "eudpr", "rgpdproc", "ccs", "lil", "textes_fr", "preparation", "adequation", "cnil", "cnil_doctrine", "cepd", "cjue", "ce", "constit", "cc", "metadonnees"];

describe("familleDeSource", () => {
  it("range les sources de veille et les dix-huit corpus dans une famille nommée", () => {
    const attendu: Record<string, string> = {
      cnil: "autorites",
      cnil_doctrine: "autorites",
      anssi: "autorites",
      arcep: "autorites",
      arcom: "autorites",
      cjeu: "ue",
      cjue: "ue",
      cepd: "ue",
      commission: "ue",
      "commission-dma": "ue",
      cetat: "juridictions",
      judilibre: "juridictions",
      legi: "textes",
      eurlex: "ue",
      ce: "juridictions",
      constit: "juridictions",
      cc: "juridictions",
      rgpd: "textes",
      aiact: "textes",
      eprivacy: "textes",
      police: "textes",
      eudpr: "textes",
      rgpdproc: "textes",
      ccs: "textes",
      lil: "textes",
      textes_fr: "textes",
      preparation: "ue",
      adequation: "ue",
      metadonnees: "autre",
    };
    for (const id of [...SOURCES_VEILLE, ...CORPUS]) {
      assert.equal(familleDeSource(id).id, attendu[id], id);
    }
  });

  it("rend « autre » en encre douce pour un identifiant inconnu, sans lever", () => {
    const famille = familleDeSource("inconnue");
    assert.equal(famille.id, "autre");
    assert.equal(famille.classePastille, "bg-encre-douce");
  });

  it("donne à chaque famille une pastille testée à 3:1 sur fond et surface", () => {
    for (const famille of Object.values(FAMILLES)) {
      assert.equal(famille.classePastille, `bg-${famille.pastille}`);
      const paires = PASTILLES.filter(([texte]) => texte === famille.pastille);
      assert.equal(paires.length, 4, `${famille.id} : ${famille.pastille}`);
    }
  });

  it("donne à chaque famille son aplat de façade, sans texte sur aplat", () => {
    for (const famille of Object.values(FAMILLES)) {
      assert.equal(famille.classeFond, `bg-${famille.fond}`);
    }
  });

  it("nomme quatre familles distinctes dans la légende, chacune avec son libellé", () => {
    assert.deepEqual(
      FAMILLES_LEGENDE.map((famille) => famille.libelle),
      ["Textes", "Autorités françaises", "Union européenne", "Juridictions françaises"],
    );
    assert.equal(new Set(FAMILLES_LEGENDE.map((famille) => famille.pastille)).size, 4);
  });
});
