import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { AUTORISEES, CSS, INTERDITES, echecs, jeton, ratio } from "./contrastes.ts";

describe("contrastes de la palette", () => {
  it("calcule le ratio WCAG de référence", () => {
    assert.equal(ratio("#000000", "#ffffff").toFixed(2), "21.00");
    assert.equal(ratio("#121212", "#f4f0e8").toFixed(2), "16.48");
  });

  it("fait passer chaque paire autorisée à son seuil", () => {
    assert.deepEqual(echecs(CSS, AUTORISEES), []);
  });

  it("garde chaque paire interdite sous son seuil", () => {
    for (const [texte, fond, seuil] of INTERDITES) {
      const valeur = ratio(jeton(CSS, texte), jeton(CSS, fond));
      assert.ok(valeur < seuil, `${texte} sur ${fond} devrait rester sous ${seuil}:1 (${valeur.toFixed(2)}:1)`);
    }
  });

  it("nomme la paire et le ratio quand un vert trop clair remplace le jeton", () => {
    const modifie = CSS.replace(/--color-green:\s*#[0-9a-fA-F]{6};/, "--color-green: #3a7d44;");
    assert.deepEqual(echecs(modifie, AUTORISEES), ["paper sur green : 4.40:1 < 4.5:1"]);
  });

  it("lève en nommant un jeton absent", () => {
    assert.throws(() => jeton(CSS, "violet"), /--color-violet absent/);
  });
});
