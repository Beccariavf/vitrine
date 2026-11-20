import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { AUTORISEES, CSS, INTERDITES, PASTILLES, TEXTES, echecs, echecsTheme, jeton, ratio } from "./contrastes.ts";

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

describe("contrastes de la direction artistique", () => {
  it("fait passer le texte courant à 4,5:1 en clair et en sombre", () => {
    assert.deepEqual(echecsTheme(CSS, TEXTES), []);
  });

  it("fait passer chaque pastille de famille à 3:1 sur les deux fonds et les deux thèmes", () => {
    assert.equal(PASTILLES.length, 16);
    assert.deepEqual(echecsTheme(CSS, PASTILLES), []);
  });

  it("lit une valeur propre à chaque thème", () => {
    assert.equal(jeton(CSS, "fond", "clair"), "#ffffff");
    assert.equal(jeton(CSS, "fond", "sombre"), "#0c111a");
    assert.equal(ratio(jeton(CSS, "encre-douce", "clair"), jeton(CSS, "fond", "clair")).toFixed(2), "5.44");
    assert.equal(ratio(jeton(CSS, "encre-douce", "sombre"), jeton(CSS, "fond", "sombre")).toFixed(2), "7.48");
  });

  it("nomme le thème, la paire et le ratio quand une valeur sombre est dégradée", () => {
    const degrade = CSS.replace("--color-encre-douce: #a0a3a9;", "--color-encre-douce: #3a3f47;");
    assert.deepEqual(echecsTheme(degrade, TEXTES), [
      "sombre · encre-douce sur fond : 1.78:1 < 4.5:1",
      "sombre · encre-douce sur surface : 1.63:1 < 4.5:1",
    ]);
  });

  it("lève en nommant un jeton absent du bloc sombre", () => {
    const sansFilet = CSS.replace("--color-filet: #272c34;", "");
    assert.throws(() => jeton(sansFilet, "filet", "sombre"), /--color-filet absent du thème sombre/);
  });
});
