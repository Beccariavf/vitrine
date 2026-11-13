import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { STATUTS_APPLICATION, statutApplication } from "../mcp/corpus/statut.ts";

describe("le vocabulaire du statut d'application", () => {
  it("porte les sept valeurs du contrat, dans l'ordre et sans doublon", () => {
    assert.deepEqual(STATUTS_APPLICATION, [
      "en_vigueur",
      "abroge",
      "propose",
      "pendant",
      "rendue",
      "adoptee",
      "inconnu",
    ]);
    assert.equal(new Set(STATUTS_APPLICATION).size, 7);
  });
});

describe("la table par corpus", () => {
  it("suit le statut des textes, dans les deux vocabulaires de la source", () => {
    assert.equal(statutApplication("rgpd", "en_vigueur"), "en_vigueur");
    assert.equal(statutApplication("aiact", "en_vigueur"), "en_vigueur");
    assert.equal(statutApplication("lil", "VIGUEUR"), "en_vigueur");
    assert.equal(statutApplication("lil", "ABROGE"), "abroge");
  });

  it("rend une décision rendue quel que soit son statut source", () => {
    assert.equal(statutApplication("ce", "Publié au recueil"), "rendue");
    assert.equal(statutApplication("ce", "Inédit au recueil · Rejet"), "rendue");
    assert.equal(statutApplication("cc", "Publié au Bulletin · Cassation"), "rendue");
    assert.equal(statutApplication("cc", "Non publié au Bulletin · Rejet"), "rendue");
    assert.equal(statutApplication("cjue", "Arrêt de la Cour"), "rendue");
    assert.equal(statutApplication("cjue", "Ordonnance du Tribunal"), "rendue");
    assert.equal(statutApplication("cjue", "n'importe quoi"), "rendue");
  });

  it("sépare la sanction CNIL de sa doctrine, et adopte les lignes directrices du CEPD", () => {
    assert.equal(statutApplication("cnil", "VIGUEUR", "Sanction"), "rendue");
    assert.equal(statutApplication("cnil", "VIGUEUR", "Avis"), "adoptee");
    assert.equal(statutApplication("cnil", "VIGUEUR", "Recommandation/Lignes directrices"), "adoptee");
    assert.equal(statutApplication("cepd", "finale"), "adoptee");
  });

  it("laisse un statut sans effet primer sur la nature, dans les corpus concernés", () => {
    // 471 unités CNIL portent ABROGE sur le corpus réel (462 recommandations, 9 avis),
    // 12 portent ANNULE (2 recommandations, dont une annulée par le Conseil d'État).
    assert.equal(statutApplication("cnil", "ABROGE", "Recommandation/Lignes directrices"), "abroge");
    assert.equal(statutApplication("cnil", "ABROGE", "Avis"), "abroge");
    assert.equal(statutApplication("cnil", "ABROGE", "Sanction"), "abroge");
    assert.equal(statutApplication("cnil", "ANNULE", "Recommandation/Lignes directrices"), "abroge");
    assert.equal(statutApplication("cepd", "ABROGE"), "abroge");
    assert.equal(statutApplication("lil", "abrogé"), "abroge");
  });

  it("ne laisse pas un statut sans effet déborder hors des corpus où il fait sens", () => {
    // La priorité est bornée : le statut d'une décision est sa publication, et un
    // corpus inconnu n'affirme rien, même quand la valeur ressemble à une abrogation.
    assert.equal(statutApplication("ce", "ABROGE"), "rendue");
    assert.equal(statutApplication("cc", "ANNULE"), "rendue");
    assert.equal(statutApplication("inconnu", "ABROGE"), "inconnu");
  });

  it("rend inconnu une doctrine modifiée, jamais applicable d'office", () => {
    // 26 unités CNIL MODIFIE (2 recommandations) : la version rendue n'est pas
    // nécessairement celle en vigueur.
    assert.equal(statutApplication("cnil", "MODIFIE", "Recommandation/Lignes directrices"), "inconnu");
    assert.equal(statutApplication("cepd", "projet"), "inconnu");
    assert.equal(statutApplication("cepd", "EN_CONSULTATION"), "inconnu");
  });

  it("atteint propose et pendant, qu'aucun corpus ne porte aujourd'hui", () => {
    assert.equal(statutApplication("lil", "PROJET"), "propose");
    assert.equal(statutApplication("lil", "PROPOSE"), "propose");
    assert.equal(statutApplication("lil", "PROPOSITION"), "propose");
    assert.equal(statutApplication("lil", "PENDANT"), "pendant");
    assert.equal(statutApplication("aiact", "PROJET"), "propose");
    assert.equal(statutApplication("rgpd", "PENDANT"), "pendant");
  });

  it("rend inconnu sur une valeur, un corpus ou une nature non reconnus", () => {
    assert.equal(statutApplication("rgpd", "n'importe quoi"), "inconnu");
    assert.equal(statutApplication("lil", ""), "inconnu");
    assert.equal(statutApplication("aiact", "MODIFIE"), "inconnu");
    assert.equal(statutApplication("inconnu", "VIGUEUR"), "inconnu");
    assert.equal(statutApplication("", "VIGUEUR"), "inconnu");
    assert.equal(statutApplication("cnil", "VIGUEUR"), "inconnu");
    assert.equal(statutApplication("cnil", "VIGUEUR", "Délibération"), "inconnu");
    assert.equal(statutApplication("cnil", "VIGUEUR", ""), "inconnu");
  });

  it("ne devine jamais l'applicabilité d'un texte non reconnu", () => {
    for (const statut of ["MODIFIE", "ANNULE", "TRANSFERE", "ABROGE ET REMPLACE", "inconnu", ""]) {
      const valeur = statutApplication("lil", statut);
      assert.notEqual(valeur, "en_vigueur", `« ${statut} » ne doit pas rendre en_vigueur`);
    }
  });

  it("reste insensible à la casse et aux diacritiques du statut source", () => {
    assert.equal(statutApplication("lil", "Abrogé"), "abroge");
    assert.equal(statutApplication("lil", "abroge"), "abroge");
    assert.equal(statutApplication("lil", "en vigueur"), "en_vigueur");
    assert.equal(statutApplication("lil", "EN-VIGUEUR"), "en_vigueur");
    assert.equal(statutApplication("rgpd", "En_Vigueur"), "en_vigueur");
    assert.equal(statutApplication("cnil", "VIGUEUR", "recommandation/lignes directrices"), "adoptee");
    assert.equal(statutApplication("CNIL", "VIGUEUR", "sanction"), "rendue");
  });

  it("ne lit pas une propriété héritée du prototype", () => {
    assert.equal(statutApplication("lil", "constructor"), "inconnu");
    assert.equal(statutApplication("constructor", "VIGUEUR"), "inconnu");
    assert.equal(statutApplication("cnil", "VIGUEUR", "toString"), "inconnu");
  });
});
