import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FAMILLES, FAMILLES_LEGENDE, familleDeSource } from "../src/lib/familles.ts";
import { AUTORISEES } from "./contrastes.ts";

const SOURCES_VEILLE = ["cnil", "cjeu", "anssi", "cepd", "arcep", "commission", "commission-dma", "arcom", "cetat", "constit", "judilibre", "legi", "eurlex"];
const CORPUS = ["rgpd", "aiact", "eprivacy", "police", "eudpr", "rgpdproc", "ccs", "lil", "textes_fr", "preparation", "adequation", "cnil", "cnil_doctrine", "cepd", "cjue", "ce", "constit", "cc"];

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
    };
    for (const id of [...SOURCES_VEILLE, ...CORPUS]) {
      assert.equal(familleDeSource(id).id, attendu[id], id);
    }
  });

  it("rend « autre » en béton et encre pour un identifiant inconnu, sans lever", () => {
    const famille = familleDeSource("inconnue");
    assert.equal(famille.id, "autre");
    assert.equal(famille.classeFond, "bg-concrete");
    assert.equal(famille.classeTexte, "text-ink");
  });

  it("donne à chaque famille un texte contrasté autorisé par le test de contrastes", () => {
    for (const famille of Object.values(FAMILLES)) {
      const paire = AUTORISEES.find(([texte, fond]) => texte === famille.texte && fond === famille.fond);
      assert.ok(paire !== undefined && paire[2] === 4.5, `${famille.id} : ${famille.texte} sur ${famille.fond}`);
      assert.equal(famille.classeFond, `bg-${famille.fond}`);
      assert.equal(famille.classeTexte, `text-${famille.texte}`);
    }
  });

  it("nomme quatre familles distinctes dans la légende, chacune avec son libellé", () => {
    assert.deepEqual(
      FAMILLES_LEGENDE.map((famille) => famille.libelle),
      ["Textes", "Autorités françaises", "Union européenne", "Juridictions françaises"],
    );
    assert.equal(new Set(FAMILLES_LEGENDE.map((famille) => famille.fond)).size, 4);
  });
});
