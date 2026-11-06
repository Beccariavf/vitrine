import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  dateIndex,
  extraireMetaSanction,
  montantIndex,
  nombreEnMots,
  numeroIndex,
} from "../mcp/corpus/cnil/meta.ts";

describe("les nombres en mots", () => {
  it("lit les unités, les dizaines et les échelles", () => {
    assert.equal(nombreEnMots("un"), 1);
    assert.equal(nombreEnMots("cent"), 100);
    assert.equal(nombreEnMots("cinq cent mille"), 500_000);
    assert.equal(nombreEnMots("six millions"), 6_000_000);
    assert.equal(nombreEnMots("deux millions cinq cent mille"), 2_500_000);
    assert.equal(nombreEnMots("quatre-vingt-dix mille"), 90_000);
    assert.equal(nombreEnMots("soixante-quinze mille"), 75_000);
  });

  it("rend null quand aucun mot n'est un nombre", () => {
    assert.equal(nombreEnMots("société anonyme"), null);
  });
});

describe("les métadonnées d'une sanction", () => {
  const meta = (texte: string) => extraireMetaSanction(`PAR CES MOTIFS ${texte}`);

  it("additionne deux amendes distinctes", () => {
    const resultat = meta(
      "prononcer à l'encontre de la société X une amende administrative d'un montant de " +
        "six millions (6 000 000) d'euros ; prononcer à l'encontre de la société Y une amende " +
        "administrative d'un montant d'un million (1 000 000) d'euros ;",
    );
    assert.deepEqual(resultat, { type_sanction: "amende", montant: 7_000_000, injonction: false });
  });

  it("ne compte pas le total avec sa décomposition", () => {
    const resultat = meta(
      "prononcer une amende administrative d'un montant de trois millions cinq cent mille " +
        "(3 500 000) euros pour l'ensemble des manquements constatés, qui se décompose comme " +
        "suit : deux millions cinq cent mille (2 500 000) euros ; un million (1 000 000) euros ;",
    );
    assert.equal(resultat.montant, 3_500_000);
  });

  it("lit un montant décimal écrit en millions", () => {
    const resultat = meta(
      "prononcer une amende administrative de 2,5 millions d'euros ; " +
        "prononcer une amende administrative de 2,5 millions d'euros ;",
    );
    assert.equal(resultat.montant, 5_000_000);
  });

  it("ignore l'astreinte quotidienne", () => {
    const resultat = meta(
      "prononcer une amende administrative d'un montant de cinq mille (5 000) euros ; " +
        "prononcer une injonction assortie d'une astreinte de cent-cinquante (150) euros par jour de retard ;",
    );
    assert.deepEqual(resultat, { type_sanction: "amende", montant: 5_000, injonction: true });
  });

  it("ne compte pas deux fois un montant répété entre parenthèses", () => {
    const resultat = meta("prononcer une sanction pécuniaire de 1 euro (1 euro) ;");
    assert.equal(resultat.montant, 1);
  });

  it("rend null quand le montant est masqué", () => {
    const resultat = meta("prononcer une amende administrative d'un montant de […] d'euros ;");
    assert.deepEqual(resultat, { type_sanction: "amende", montant: null, injonction: false });
  });

  it("lit un montant uniquement en mots", () => {
    const resultat = meta("prononcer une sanction d'un montant de quinze mille euros ;");
    assert.deepEqual(resultat, { type_sanction: "amende", montant: 15_000, injonction: false });
  });

  it("ne compte pas les montants des observations quand le dispositif n'a pas de marqueur", () => {
    const resultat = extraireMetaSanction(
      "La société propose 30 000 euros puis 5 000 euros. " +
        "En conséquence, la Commission décide de prononcer une sanction pécuniaire de " +
        "15.000 euros (quinze mille euros), qui sera rendue publique.",
    );
    assert.equal(resultat.montant, 15_000);
  });

  it("lit une somme totale annoncée avant le montant", () => {
    const resultat = meta(
      "prononcer une sanction pécuniaire de 30 000 euros ; ajouter 5 000 euros par saisine ; " +
        "soit la somme totale de 45 000 euros ;",
    );
    assert.equal(resultat.montant, 45_000);
  });

  it("reconnaît une injonction ordonnée par « enjoint »", () => {
    const resultat = meta("enjoint à la société de mettre en conformité le traitement ;");
    assert.equal(resultat.injonction, true);
  });

  it("distingue avertissement, rappel, injonction, liquidation et interruption", () => {
    assert.equal(meta("prononcer un avertissement à l'encontre de la société X ;").type_sanction, "avertissement");
    assert.equal(meta("prononcer un rappel à l'ordre à l'encontre de X ;").type_sanction, "rappel");
    assert.equal(meta("prononcer une injonction de mettre en conformité le traitement ;").type_sanction, "injonction");
    assert.equal(meta("procéder à la liquidation de l'astreinte pour un montant de 5 200 000 euros ;").montant, 5_200_000);
    assert.equal(meta("dire n'y avoir lieu à liquidation de l'astreinte ;").type_sanction, "liquidation");
    assert.equal(meta("ordonner l'interruption du traitement pour une durée de trois mois ;").type_sanction, "interruption");
  });

  it("ne lit pas un montant dans la publication qui répète l'amende", () => {
    const resultat = meta(
      "prononcer une sanction pécuniaire de 150 000 euros ; rendre cette décision publique ; " +
        "Communiqué : la CNIL a condamné la société à 150 000 euros d'amende ;",
    );
    assert.equal(resultat.montant, 150_000);
  });
});

describe("les valeurs d'index", () => {
  it("convertit une date ISO en AAAAMMJJ", () => {
    assert.equal(dateIndex("2024-03-05"), 20240305);
    assert.equal(dateIndex(""), 0);
    assert.equal(dateIndex("2025-13-40"), 0);
    assert.equal(dateIndex("2025-02-30"), 0);
  });

  it("normalise un numéro et un montant absent", () => {
    assert.equal(numeroIndex("SAN–2026-003"), "SAN-2026-003");
    assert.equal(montantIndex(null), -1);
    assert.equal(montantIndex(1500.9), 1500);
  });
});
