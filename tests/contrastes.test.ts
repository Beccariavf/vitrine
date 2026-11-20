import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CSS, PASTILLES, TEXTES, echecsTheme, jeton, ratio } from "./contrastes.ts";

describe("contrastes de la direction artistique", () => {
  it("calcule le ratio WCAG de référence", () => {
    assert.equal(ratio("#000000", "#ffffff").toFixed(2), "21.00");
    assert.equal(ratio("#000000", "#000000").toFixed(2), "1.00");
  });

  it("fait passer le texte courant à 4,5:1 en clair et en sombre", () => {
    assert.deepEqual(echecsTheme(CSS, TEXTES), []);
  });

  it("fait passer chaque pastille de famille à 3:1 sur les deux fonds et les deux thèmes", () => {
    assert.equal(PASTILLES.length, 20);
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
